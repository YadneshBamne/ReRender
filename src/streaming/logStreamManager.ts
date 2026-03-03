import * as vscode from 'vscode';
import WebSocket from 'ws';
import { Logger } from '../utils/logger';

export interface LogEntry {
    timestamp: string;
    message: string;
    level?: string;
    type?: string;
    instance?: string;
    host?: string;
}

export interface StreamConfig {
    serviceId: string;
    ownerId: string;
    apiKey: string;
    filters?: {
        type?: string[];
        level?: string[];
        text?: string[];
    };
}

export type LogCallback = (log: LogEntry) => void;
export type ErrorCallback = (error: Error) => void;
export type StateCallback = (state: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error') => void;

/**
 * Production-ready WebSocket log streaming manager for Render API
 * Handles real-time log streaming with automatic reconnection, buffering, and error recovery
 */
export class LogStreamManager {
    private ws: WebSocket | null = null;
    private logger: Logger;
    private config: StreamConfig | null = null;
    
    // Connection state
    private isConnecting: boolean = false;
    private isConnected: boolean = false;
    private shouldReconnect: boolean = true;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 10;
    private reconnectTimer: NodeJS.Timeout | null = null;
    
    // Backoff configuration
    private baseReconnectDelay: number = 1000; // 1 second
    private maxReconnectDelay: number = 30000; // 30 seconds
    private reconnectMultiplier: number = 1.5;
    
    // Buffer management
    private logBuffer: LogEntry[] = [];
    private maxBufferSize: number = 1000;
    private bufferFlushInterval: NodeJS.Timeout | null = null;
    private bufferFlushDelay: number = 100; // 100ms batching
    
    // Callbacks
    private logCallbacks: Set<LogCallback> = new Set();
    private errorCallbacks: Set<ErrorCallback> = new Set();
    private stateCallbacks: Set<StateCallback> = new Set();
    
    // Heartbeat
    private heartbeatTimer: NodeJS.Timeout | null = null;
    private heartbeatInterval: number = 30000; // 30 seconds
    private lastMessageTime: number = Date.now();
    private missedHeartbeats: number = 0;
    private maxMissedHeartbeats: number = 3;
    
    // Message processing
    private messageQueue: any[] = [];
    private isProcessingQueue: boolean = false;
    
    constructor(logger: Logger) {
        this.logger = logger;
    }

    /**
     * Start streaming logs for a specific service
     */
    public async connect(config: StreamConfig): Promise<void> {
        if (this.isConnecting || this.isConnected) {
            this.logger.log('Already connected or connecting to log stream');
            return;
        }

        this.config = config;
        this.shouldReconnect = true;
        this.reconnectAttempts = 0;
        
        await this.establishConnection();
    }

    /**
     * Disconnect from log stream
     */
    public disconnect(): void {
        this.logger.log('Disconnecting log stream...');
        this.shouldReconnect = false;
        this.cleanup();
        this.notifyStateChange('disconnected');
    }

    /**
     * Subscribe to log events
     */
    public onLog(callback: LogCallback): () => void {
        this.logCallbacks.add(callback);
        return () => this.logCallbacks.delete(callback);
    }

    /**
     * Subscribe to error events
     */
    public onError(callback: ErrorCallback): () => void {
        this.errorCallbacks.add(callback);
        return () => this.errorCallbacks.delete(callback);
    }

    /**
     * Subscribe to state changes
     */
    public onStateChange(callback: StateCallback): () => void {
        this.stateCallbacks.add(callback);
        return () => this.stateCallbacks.delete(callback);
    }

    /**
     * Get current buffered logs
     */
    public getBufferedLogs(): LogEntry[] {
        return [...this.logBuffer];
    }

    /**
     * Clear log buffer
     */
    public clearBuffer(): void {
        this.logBuffer = [];
        this.logger.log('Log buffer cleared');
    }

    /**
     * Check if currently connected
     */
    public isStreamConnected(): boolean {
        return this.isConnected;
    }

    /**
     * Establish WebSocket connection to Render's log streaming endpoint
     */
    private async establishConnection(): Promise<void> {
        if (!this.config) {
            throw new Error('Stream configuration not set');
        }

        this.isConnecting = true;
        this.notifyStateChange('connecting');
        this.logger.log(`🔌 Connecting to Render log stream for service ${this.config.serviceId}...`);

        try {
            // Build query parameters - Render API uses repeated parameters without brackets
            const queryParams: string[] = [];
            
            // Add ownerId
            queryParams.push(`ownerId=${encodeURIComponent(this.config.ownerId)}`);
            
            // Add resource (service ID) - use repeated parameter, not array brackets
            queryParams.push(`resource=${encodeURIComponent(this.config.serviceId)}`);
            
            // Add type filters - use repeated parameter, not array brackets
            const types = this.config.filters?.type || ['app', 'build'];
            types.forEach(t => queryParams.push(`type=${encodeURIComponent(t)}`));
            
            // Add limit to prevent overwhelming
            queryParams.push('limit=100');
            
            // Construct WebSocket URL with query string
            const queryString = queryParams.join('&');
            const wsUrl = `wss://api.render.com/v1/logs/subscribe?${queryString}`;
            
            this.logger.log(`🔗 Connecting to: wss://api.render.com/v1/logs/subscribe`);
            this.logger.log(`📋 Query params: ownerId=${this.config.ownerId}, resource=${this.config.serviceId}, types=${types.join(',')}`);
            
            // Create WebSocket with authentication header
            this.ws = new WebSocket(wsUrl, {
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                handshakeTimeout: 15000
            });

            this.logger.log('⏳ WebSocket created, waiting for handshake...');
            this.setupWebSocketHandlers();
            
        } catch (error: any) {
            this.isConnecting = false;
            this.logger.log(`❌ Failed to create WebSocket: ${error.message}`);
            if (error.stack) {
                this.logger.log(`Stack: ${error.stack}`);
            }
            this.notifyError(new Error(`Connection failed: ${error.message}`));
            this.scheduleReconnect();
        }
    }

    /**
     * Setup WebSocket event handlers
     */
    private setupWebSocketHandlers(): void {
        if (!this.ws) return;

        this.ws.on('open', () => this.handleOpen());
        this.ws.on('message', (data: WebSocket.Data) => this.handleMessage(data));
        this.ws.on('error', (error: Error) => this.handleError(error));
        this.ws.on('close', (code: number, reason: Buffer) => this.handleClose(code, reason));
        this.ws.on('ping', () => this.handlePing());
        this.ws.on('pong', () => this.handlePong());
        this.ws.on('unexpected-response', (req, res) => this.handleUnexpectedResponse(req, res));
    }

    /**
     * Handle WebSocket open event
     */
    private handleOpen(): void {
        this.isConnecting = false;
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.lastMessageTime = Date.now();
        this.missedHeartbeats = 0;

        this.logger.log('✅ WebSocket connection established successfully');
        this.logger.log('📡 Subscription active - logs will stream in real-time');
        this.notifyStateChange('connected');
        
        // Start heartbeat monitoring
        this.startHeartbeat();
    }

    /**
     * Send subscription message to filter logs
     */
    private sendSubscription(): void {
        if (!this.ws || !this.config) return;

        const subscription = {
            ownerId: this.config.ownerId,
            resource: [this.config.serviceId],
            type: this.config.filters?.type || ['app', 'build', 'request'],
            level: this.config.filters?.level || [],
            text: this.config.filters?.text || []
        };

        try {
            const subscriptionJson = JSON.stringify(subscription);
            this.logger.log(`📤 Sending subscription: ${subscriptionJson}`);
            this.ws.send(subscriptionJson);
            this.logger.log(`✅ Subscription sent successfully`);
        } catch (error: any) {
            this.logger.log(`❌ Failed to send subscription: ${error.message}`);
            this.notifyError(new Error(`Subscription failed: ${error.message}`));
        }
    }

    /**
     * Handle incoming WebSocket message
     */
    private handleMessage(data: WebSocket.Data): void {
        this.lastMessageTime = Date.now();
        this.missedHeartbeats = 0;

        try {
            const messageStr = data.toString();
            this.logger.log(`📨 Received message: ${messageStr.substring(0, 200)}${messageStr.length > 200 ? '...' : ''}`);
            
            const message = JSON.parse(messageStr);
            
            // Add to queue for non-blocking processing
            this.messageQueue.push(message);
            this.processMessageQueue();
            
        } catch (error: any) {
            this.logger.log(`❌ Failed to parse message: ${error.message}`);
            this.logger.log(`Raw message: ${data.toString().substring(0, 500)}`);
        }
    }

    /**
     * Process message queue without blocking
     */
    private async processMessageQueue(): Promise<void> {
        if (this.isProcessingQueue || this.messageQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        try {
            // Process in batches to avoid blocking
            const batchSize = 50;
            while (this.messageQueue.length > 0) {
                const batch = this.messageQueue.splice(0, batchSize);
                
                for (const message of batch) {
                    this.processLogMessage(message);
                }

                // Yield to event loop every batch
                await new Promise(resolve => setImmediate(resolve));
            }
        } finally {
            this.isProcessingQueue = false;
        }
    }

    /**
     * Process individual log message
     */
    private processLogMessage(message: any): void {
        // Handle different message types
        if (message.type === 'log' || message.message || message.timestamp) {
            const logEntry: LogEntry = {
                timestamp: message.timestamp || new Date().toISOString(),
                message: message.message || message.text || message.log || '',
                level: message.level,
                type: message.type,
                instance: message.instance,
                host: message.host
            };

            // Apply client-side filtering
            if (this.shouldIncludeLog(logEntry)) {
                this.addToBuffer(logEntry);
                this.notifyLogCallbacks(logEntry);
            }
        } else if (message.type === 'heartbeat' || message.ping) {
            // Heartbeat received, connection is alive
            this.logger.log('Heartbeat received');
        }
    }

    /**
     * Client-side log filtering
     */
    private shouldIncludeLog(log: LogEntry): boolean {
        if (!this.config?.filters) return true;

        const filters = this.config.filters;

        // Filter by type
        if (filters.type && filters.type.length > 0) {
            if (log.type && !filters.type.includes(log.type)) {
                return false;
            }
        }

        // Filter by level
        if (filters.level && filters.level.length > 0) {
            if (log.level && !filters.level.includes(log.level)) {
                return false;
            }
        }

        // Filter by text content
        if (filters.text && filters.text.length > 0) {
            const messageText = log.message.toLowerCase();
            const matches = filters.text.some(filter => 
                messageText.includes(filter.toLowerCase())
            );
            if (!matches) {
                return false;
            }
        }

        return true;
    }

    /**
     * Add log to rolling buffer
     */
    private addToBuffer(log: LogEntry): void {
        this.logBuffer.push(log);

        // Maintain rolling buffer size
        if (this.logBuffer.length > this.maxBufferSize) {
            this.logBuffer.shift();
        }
    }

    /**
     * Handle WebSocket error
     */
    private handleError(error: Error): void {
        this.logger.log(`❌ WebSocket error: ${error.message}`);
        this.logger.log(`Error stack: ${error.stack || 'No stack trace'}`);
        this.notifyError(error);
    }

    /**
     * Handle WebSocket close
     */
    private handleClose(code: number, reason: Buffer): void {
        this.isConnected = false;
        this.isConnecting = false;

        const reasonText = reason?.toString() || 'No reason provided';
        this.logger.log(`🔌 WebSocket closed. Code: ${code}, Reason: ${reasonText}`);
        
        // Log close code meanings
        const codeExplanation = this.getCloseCodeExplanation(code);
        this.logger.log(`📋 Close code explanation: ${codeExplanation}`);
        
        this.stopHeartbeat();
        
        // Don't reconnect on authentication errors (401, 403) or bad requests (400)
        if (code === 1008 || code >= 4000) {
            this.logger.log('❌ Authentication or protocol error - stopping reconnection');
            this.shouldReconnect = false;
            this.notifyStateChange('error');
            this.notifyError(new Error(`WebSocket error ${code}: ${codeExplanation}. ${reasonText}`));
            return;
        }
        
        if (this.shouldReconnect) {
            this.notifyStateChange('reconnecting');
            this.scheduleReconnect();
        } else {
            this.notifyStateChange('disconnected');
        }
    }

    /**
     * Handle unexpected HTTP response (indicates handshake failure)
     */
    private handleUnexpectedResponse(req: any, res: any): void {
        this.logger.log(`❌ WebSocket handshake failed with HTTP ${res.statusCode} ${res.statusMessage}`);
        
        // Immediately stop reconnecting on known errors
        if (res.statusCode === 400 || res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 404) {
            this.shouldReconnect = false;
            
            // Cancel any pending reconnect
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
        }
        
        let body = '';
        res.on('data', (chunk: Buffer) => {
            body += chunk.toString();
        });
        
        res.on('end', () => {
            this.logger.log(`Response body: ${body}`);
            
            // Notify appropriate error based on status
            if (res.statusCode === 401 || res.statusCode === 403) {
                this.logger.log('❌ Authentication failed - check your API key');
                this.notifyStateChange('error');
                this.notifyError(new Error(`Authentication failed (HTTP ${res.statusCode})`));
            } else if (res.statusCode === 400) {
                this.logger.log('❌ Bad request - check ownerId and service ID parameters');
                this.notifyStateChange('error');
                this.notifyError(new Error(`Bad request (HTTP ${res.statusCode}): ${body}`));
            } else if (res.statusCode === 404) {
                this.logger.log('❌ Endpoint not found - WebSocket endpoint may not be available');
                this.notifyStateChange('error');
                this.notifyError(new Error('WebSocket endpoint not found'));
            }
        });
    }

    /**
     * Get human-readable explanation for close code
     */
    private getCloseCodeExplanation(code: number): string {
        const explanations: Record<number, string> = {
            1000: 'Normal closure',
            1001: 'Going away',
            1002: 'Protocol error',
            1003: 'Unsupported data',
            1006: 'Abnormal closure (connection lost)',
            1007: 'Invalid frame payload data',
            1008: 'Policy violation',
            1009: 'Message too big',
            1010: 'Missing extension',
            1011: 'Internal server error',
            1015: 'TLS handshake failed',
            4000: 'Authentication failed',
            4001: 'Authorization failed',
            4002: 'Invalid subscription',
            4003: 'Rate limit exceeded'
        };
        return explanations[code] || `Unknown code ${code}`;
    }

    /**
     * Handle ping from server
     */
    private handlePing(): void {
        this.lastMessageTime = Date.now();
        this.missedHeartbeats = 0;
    }

    /**
     * Handle pong from server
     */
    private handlePong(): void {
        this.lastMessageTime = Date.now();
        this.missedHeartbeats = 0;
    }

    /**
     * Start heartbeat monitoring
     */
    private startHeartbeat(): void {
        this.stopHeartbeat();

        this.heartbeatTimer = setInterval(() => {
            const now = Date.now();
            const timeSinceLastMessage = now - this.lastMessageTime;

            if (timeSinceLastMessage > this.heartbeatInterval) {
                this.missedHeartbeats++;
                this.logger.log(`Missed heartbeat ${this.missedHeartbeats}/${this.maxMissedHeartbeats}`);

                if (this.missedHeartbeats >= this.maxMissedHeartbeats) {
                    this.logger.log('Too many missed heartbeats, reconnecting...');
                    this.reconnect();
                } else {
                    // Send ping to check connection
                    this.sendPing();
                }
            }
        }, this.heartbeatInterval);
    }

    /**
     * Stop heartbeat monitoring
     */
    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * Send ping to server
     */
    private sendPing(): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.ping();
            } catch (error: any) {
                this.logger.log(`Failed to send ping: ${error.message}`);
            }
        }
    }

    /**
     * Schedule reconnection with exponential backoff
     */
    private scheduleReconnect(): void {
        // Prevent duplicate reconnect timers
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.log('Max reconnection attempts reached');
            this.notifyError(new Error('Max reconnection attempts reached'));
            this.notifyStateChange('error');
            return;
        }

        this.reconnectAttempts++;
        
        // Calculate backoff delay with exponential increase
        const delay = Math.min(
            this.baseReconnectDelay * Math.pow(this.reconnectMultiplier, this.reconnectAttempts - 1),
            this.maxReconnectDelay
        );

        this.logger.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.reconnect();
        }, delay);
    }

    /**
     * Reconnect to WebSocket
     */
    private reconnect(): void {
        this.cleanup();
        
        if (this.config && this.shouldReconnect) {
            this.establishConnection();
        }
    }

    /**
     * Cleanup resources
     */
    private cleanup(): void {
        // Close WebSocket
        if (this.ws) {
            try {
                this.ws.close();
            } catch (error) {
                // Ignore close errors
            }
            this.ws = null;
        }

        // Stop timers
        this.stopHeartbeat();
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.bufferFlushInterval) {
            clearInterval(this.bufferFlushInterval);
            this.bufferFlushInterval = null;
        }

        this.isConnecting = false;
        this.isConnected = false;
    }

    /**
     * Notify log callbacks
     */
    private notifyLogCallbacks(log: LogEntry): void {
        for (const callback of this.logCallbacks) {
            try {
                callback(log);
            } catch (error: any) {
                this.logger.log(`Error in log callback: ${error.message}`);
            }
        }
    }

    /**
     * Notify error callbacks
     */
    private notifyError(error: Error): void {
        for (const callback of this.errorCallbacks) {
            try {
                callback(error);
            } catch (err: any) {
                this.logger.log(`Error in error callback: ${err.message}`);
            }
        }
    }

    /**
     * Notify state change callbacks
     */
    private notifyStateChange(state: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error'): void {
        for (const callback of this.stateCallbacks) {
            try {
                callback(state);
            } catch (error: any) {
                this.logger.log(`Error in state callback: ${error.message}`);
            }
        }
    }

    /**
     * Dispose and cleanup all resources
     */
    public dispose(): void {
        this.shouldReconnect = false;
        this.cleanup();
        this.logCallbacks.clear();
        this.errorCallbacks.clear();
        this.stateCallbacks.clear();
        this.logBuffer = [];
        this.messageQueue = [];
        this.logger.log('LogStreamManager disposed');
    }
}
