import axios, { AxiosInstance } from 'axios';
import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

export interface RenderService {
    id: string;
    name: string;
    type: string;
    ownerId: string;
    repo?: string;
    autoDeploy?: string;
    branch?: string;
    createdAt: string;
    updatedAt: string;
    suspendedAt?: string;
    suspended?: string;
    notifyOnFail?: string;
    slug?: string;
    serviceDetails?: {
        url?: string;
        openPorts?: any[];
        parentServer?: any;
        env?: string;
        plan?: string;
        region?: string;
    };
    dashboardUrl?: string;
}

export interface RenderDeploy {
    id: string;
    commit?: {
        id: string;
        message: string;
        createdAt: string;
    };
    status: string;
    finishedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ServiceHealth {
    service: RenderService;
    latestDeploy?: RenderDeploy;
    status: 'healthy' | 'deploying' | 'failed' | 'unknown';
}

export class RenderClient {
    private client: AxiosInstance;
    private context: vscode.ExtensionContext;
    private logger: Logger;
    private baseURL = 'https://api.render.com/v1';

    constructor(context: vscode.ExtensionContext, logger: Logger) {
        this.context = context;
        this.logger = logger;
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 15000,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
    }

    private async getApiKey(): Promise<string | undefined> {
        return await this.context.secrets.get('renderApiKey');
    }

    private async getHeaders(): Promise<Record<string, string>> {
        const apiKey = await this.getApiKey();
        if (!apiKey) {
            throw new Error('Render API key not set');
        }
        return {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
        };
    }

    /**
     * Get the authenticated user's owner ID (required for logs API)
     */
    public async getOwnerId(): Promise<string | undefined> {
        try {
            const headers = await this.getHeaders();
            this.logger.log('Fetching owner ID from /user endpoint...');
            const response = await this.client.get('/user', { headers });
            
            this.logger.log(`User API response: ${JSON.stringify(response.data)}`);
            
            // Try different possible field names
            const ownerId = response.data.ownerId || 
                           response.data.owner?.id || 
                           response.data.id ||
                           response.data.user?.ownerId ||
                           response.data.user?.id;
            
            if (ownerId) {
                this.logger.log(`Successfully retrieved owner ID: ${ownerId}`);
                return ownerId;
            }
            
            this.logger.log('Owner ID not found in response. Available fields: ' + Object.keys(response.data).join(', '));
            return undefined;
        } catch (error: any) {
            this.logger.log(`Failed to get owner ID: ${error.message}`);
            if (error.response) {
                this.logger.log(`API response status: ${error.response.status}`);
                this.logger.log(`API response data: ${JSON.stringify(error.response.data)}`);
            }
            return undefined;
        }
    }

    async getServices(): Promise<RenderService[]> {
        try {
            const headers = await this.getHeaders();
            this.logger.log('📡 Fetching services from Render API...');
            this.logger.log(`🔗 API URL: ${this.baseURL}/services`);
            
            const response = await this.client.get('/services', { headers });
            
            // Debug: Log the response structure
            this.logger.log(`📦 Response type: ${typeof response.data}`);
            this.logger.log(`📦 Is array: ${Array.isArray(response.data)}`);
            if (response.data) {
                const keys = Object.keys(response.data);
                this.logger.log(`📦 Response keys: ${keys.slice(0, 10).join(', ')}`);
                if (keys.length > 0) {
                    const firstKey = keys[0];
                    this.logger.log(`📦 First item: ${JSON.stringify(response.data[firstKey]).substring(0, 200)}`);
                }
            }
            
            // Render API returns array of objects with { cursor, service } structure
            let services: RenderService[] = [];
            
            if (Array.isArray(response.data)) {
                // Each item has structure: { cursor: "...", service: {...actual service data...} }
                services = response.data.map((item: any) => {
                    // Extract the actual service object from the wrapper
                    const service = item.service || item;
                    
                    // Ensure serviceDetails.url is set if available at top level
                    if (!service.serviceDetails) {
                        service.serviceDetails = {};
                    }
                    if (service.serviceUrl && !service.serviceDetails.url) {
                        service.serviceDetails.url = service.serviceUrl;
                    }
                    
                    return service;
                });
            } else if (response.data && typeof response.data === 'object') {
                // Convert object with numeric keys to array
                const keys = Object.keys(response.data).filter(k => !isNaN(Number(k)));
                if (keys.length > 0) {
                    services = keys.map(k => {
                        const service = response.data[k].service || response.data[k];
                        
                        // Ensure serviceDetails.url is set
                        if (!service.serviceDetails) {
                            service.serviceDetails = {};
                        }
                        if (service.serviceUrl && !service.serviceDetails.url) {
                            service.serviceDetails.url = service.serviceUrl;
                        }
                        
                        return service;
                    });
                    this.logger.log(`📋 Converted ${keys.length} numeric keys to array`);
                } else if (response.data.services) {
                    services = response.data.services;
                }
            }
            
            this.logger.log(`✅ Fetched ${services.length} services`);
            if (services.length > 0) {
                this.logger.log(`📝 First service: id=${services[0].id}, name=${services[0].name}, type=${services[0].type}`);
                if (services[0].repo) {
                    this.logger.log(`   Repository: ${services[0].repo}${services[0].branch ? ` @ ${services[0].branch}` : ''}`);
                }
                if (services[0].serviceDetails?.url) {
                    this.logger.log(`   URL: ${services[0].serviceDetails.url}`);
                }
            }
            
            return services;
        } catch (error: any) {
            this.handleError('Failed to fetch services', error);
            throw error; // Re-throw so caller knows it failed
        }
    }

    async getServiceDeploys(serviceId: string, limit: number = 5): Promise<RenderDeploy[]> {
        try {
            const headers = await this.getHeaders();
            this.logger.log(`📡 Fetching deploys for service ${serviceId}...`);
            
            const response = await this.client.get(`/services/${serviceId}/deploys`, {
                headers,
                params: { limit }
            });
            
            // Deploy API also has wrapper structure: { cursor, deploy }
            let deploys: RenderDeploy[] = [];
            
            if (Array.isArray(response.data)) {
                // Each item has structure: { cursor: "...", deploy: {...actual deploy data...} }
                deploys = response.data.map((item: any) => {
                    return item.deploy || item;
                });
            } else if (response.data) {
                deploys = [response.data.deploy || response.data];
            }
            
            this.logger.log(`✅ Fetched ${deploys.length} deploys`);
            if (deploys.length > 0 && deploys[0]) {
                this.logger.log(`📦 Latest deploy status: ${deploys[0].status || 'unknown'}`);
            }
            
            return deploys;
        } catch (error: any) {
            this.handleError(`Failed to fetch deploys for service ${serviceId}`, error);
            return [];
        }
    }

    /**
     * Fetch deploy logs to get actual error messages
     * Uses the correct Render API logs endpoint: GET /v1/logs
     */
    async getDeployLogs(serviceId: string, deployId: string): Promise<string> {
        const headers = await this.getHeaders();
        const ownerId = await this.getOwnerId();
        
        if (!ownerId) {
            this.logger.log('Could not determine owner ID for logs API');
            return '';
        }
        
        try {
            this.logger.log(`Fetching logs for service ${serviceId}...`);
            
            // Calculate timestamps: last hour
            const endTime = Math.floor(Date.now() / 1000);
            const startTime = endTime - 3600; // 1 hour ago
            
            const response = await this.client.get('/logs', {
                headers,
                params: {
                    ownerId: ownerId,
                    'resource[]': serviceId,
                    'type[]': ['app', 'build'], // Application and build logs
                    limit: 100,
                    startTime: startTime,
                    endTime: endTime,
                    direction: 'backward' // Most recent first
                },
                timeout: 15000
            });
            
            if (response.data && response.data.logs && Array.isArray(response.data.logs)) {
                // Format logs from the API response
                const logLines = response.data.logs.map((log: any) => {
                    const timestamp = log.timestamp ? new Date(log.timestamp).toISOString() : '';
                    const message = log.message || log.text || log.log || '';
                    return `[${timestamp}] ${message}`;
                }).filter((line: string) => line.trim().length > 0);
                
                const logs = logLines.join('\n');
                
                if (logs && logs.length > 0) {
                    this.logger.log(`Fetched ${logs.length} characters of logs from API`);
                    return this.extractErrorsFromLogs(logs);
                }
            }
            
            this.logger.log('No logs found in response');
            return '';
            
        } catch (error: any) {
            this.logger.log(`Failed to fetch logs: ${error.message}`);
            return '';
        }
    }

    /**
     * Extract error lines from logs with context
     */
    private extractErrorsFromLogs(logs: string): string {
        const lines = logs.split('\n');
        const errorLines: string[] = [];
        const contextLines: string[] = [];
        
        // Get lines with error keywords and surrounding context
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineLower = line.toLowerCase();
            
            if (lineLower.includes('error') || 
                lineLower.includes('failed') || 
                lineLower.includes('exception') ||
                lineLower.includes('fatal') ||
                lineLower.includes('cannot') ||
                lineLower.includes('throw') ||
                lineLower.includes('rejected') ||
                lineLower.includes('missing') ||
                lineLower.includes('undefined') ||
                line.includes('at ') || // Stack traces
                line.trim().startsWith('^')) { // Error markers
                
                // Add context: 3 lines before and 5 lines after for stack traces
                const start = Math.max(0, i - 3);
                const end = Math.min(lines.length, i + 6);
                for (let j = start; j < end; j++) {
                    if (!contextLines.includes(lines[j])) {
                        contextLines.push(lines[j]);
                    }
                }
                errorLines.push(line);
            }
        }
        
        // If we found errors, return them with context
        if (errorLines.length > 0) {
            this.logger.log(`🔍 Found ${errorLines.length} error lines in logs`);
            return contextLines.slice(0, 100).join('\n'); // Limit to 100 lines
        }
        
        // Otherwise return last 50 lines (most recent logs)
        const recentLogs = lines.slice(-50).join('\n');
        this.logger.log(`📋 No specific errors found, returning last 50 lines`);
        return recentLogs;
    }

    async getServiceHealth(service: RenderService): Promise<ServiceHealth> {
        try {
            const deploys = await this.getServiceDeploys(service.id, 1);
            const latestDeploy = deploys.length > 0 ? deploys[0] : undefined;

            let status: 'healthy' | 'deploying' | 'failed' | 'unknown' = 'unknown';

            if (latestDeploy && latestDeploy.status) {
                const deployStatus = latestDeploy.status.toLowerCase();
                
                // Comprehensive status detection
                // HEALTHY STATES - Service is running successfully
                const healthyStates = [
                    'live',
                    'available',
                    'running',
                    'active'
                ];
                
                // DEPLOYING STATES - Deployment in progress
                const deployingStates = [
                    'building',
                    'deploying',
                    'updating',
                    'created',
                    'build_in_progress',
                    'deploy_in_progress',
                    'pre_deploy',
                    'pre_deploy_in_progress',
                    'update_in_progress'
                ];
                
                // FAILED STATES - Deployment or service failed
                const failedStates = [
                    'failed',
                    'build_failed',
                    'deploy_failed',
                    'update_failed',
                    'pre_deploy_failed',
                    'canceled',
                    'cancelled',
                    'crashed',
                    'deactivated',
                    'error',
                    'timed_out',
                    'evicted'
                ];
                
                if (healthyStates.includes(deployStatus)) {
                    status = 'healthy';
                    this.logger.log(`✅ ${service.name}: ${deployStatus} (healthy)`);
                } else if (deployingStates.includes(deployStatus)) {
                    status = 'deploying';
                    this.logger.log(`🟡 ${service.name}: ${deployStatus} (deploying)`);
                } else if (failedStates.includes(deployStatus)) {
                    status = 'failed';
                    this.logger.log(`❌ ${service.name}: ${deployStatus} (failed)`);
                } else {
                    // Unknown status - log it so we can add it
                    this.logger.log(`⚪ ${service.name}: ${deployStatus} (unknown status - please report this)`);
                    status = 'unknown';
                }
            } else {
                this.logger.log(`⚪ ${service.name}: No deploy found`);
            }

            return {
                service,
                latestDeploy,
                status
            };
        } catch (error: any) {
            this.logger.log(`⚠️ Error checking health for ${service.name}: ${error.message}`);
            return {
                service,
                status: 'unknown'
            };
        }
    }

    async getAllServicesHealth(): Promise<ServiceHealth[]> {
        const services = await this.getServices();
        const healthChecks = await Promise.all(
            services.map(service => this.getServiceHealth(service))
        );
        return healthChecks;
    }

    private handleError(message: string, error: any) {
        let errorMsg = message;
        let userMsg = message;
        
        if (axios.isAxiosError(error)) {
            if (error.response) {
                errorMsg += ` - ${error.response.status}: ${error.response.statusText}`;
                if (error.response.status === 401) {
                    userMsg = '🔐 Authentication failed. Please check your Render API key.';
                    errorMsg += ' - Invalid API key';
                } else if (error.response.status === 403) {
                    userMsg = '🚫 Access denied. Your API key may not have the required permissions.';
                } else if (error.response.status === 429) {
                    userMsg = '⏱️ Rate limit exceeded. Please wait a moment and try again.';
                }
                if (error.response.data) {
                    errorMsg += ` - ${JSON.stringify(error.response.data)}`;
                }
            } else if (error.request) {
                errorMsg += ' - No response received from Render API';
                userMsg = '🌐 Cannot reach Render API. Check your internet connection.';
            } else {
                errorMsg += ` - ${error.message}`;
            }
        } else {
            errorMsg += ` - ${error.message || 'Unknown error'}`;
        }

        this.logger.log(`❌ ${errorMsg}`);
        
        // Show user-friendly error
        if (userMsg !== message) {
            vscode.window.showErrorMessage(userMsg);
        }
        
        throw new Error(errorMsg);
    }

    isAuthenticated(): Promise<boolean> {
        return this.getApiKey().then(key => !!key);
    }
}
