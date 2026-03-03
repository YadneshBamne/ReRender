import * as vscode from 'vscode';
import { LogStreamManager, LogEntry, StreamConfig } from '../streaming/logStreamManager';
import { Logger } from '../utils/logger';
import { RenderDeploy } from '../api/renderClient';
import { ErrorSummarizer } from '../ai/summarizer';

export interface ServiceDetails {
    id: string;
    repo?: string;
    branch?: string;
    url?: string;
}

export class RealTimeLogPanel {
    private static currentPanel: RealTimeLogPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];
    private streamManager: LogStreamManager;
    private logger: Logger;
    private serviceName: string;
    private serviceDetails?: ServiceDetails;
    private deployInfo?: RenderDeploy;
    private maxDisplayLogs: number = 5000;

    private constructor(
        panel: vscode.WebviewPanel,
        streamManager: LogStreamManager,
        logger: Logger,
        serviceName: string,
        serviceDetails?: ServiceDetails,
        deployInfo?: RenderDeploy
    ) {
        this.panel = panel;
        this.streamManager = streamManager;
        this.logger = logger;
        this.serviceName = serviceName;
        this.serviceDetails = serviceDetails;
        this.deployInfo = deployInfo;
        
        this.update();
        this.setupStreamListeners();
        
        // Handle webview messages
        this.panel.webview.onDidReceiveMessage(
            message => this.handleWebviewMessage(message),
            null,
            this.disposables
        );

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    public static createOrShow(
        context: vscode.ExtensionContext,
        streamManager: LogStreamManager,
        logger: Logger,
        serviceName: string,
        serviceDetails?: ServiceDetails,
        deployInfo?: RenderDeploy
    ): RealTimeLogPanel {
        const column = vscode.ViewColumn.One;

        if (RealTimeLogPanel.currentPanel) {
            RealTimeLogPanel.currentPanel.panel.reveal(column);
            return RealTimeLogPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            'renderRealTimeLogs',
            `Real-Time Logs: ${serviceName}`,
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [context.extensionUri]
            }
        );

        RealTimeLogPanel.currentPanel = new RealTimeLogPanel(panel, streamManager, logger, serviceName, serviceDetails, deployInfo);
        return RealTimeLogPanel.currentPanel;
    }

    private setupStreamListeners(): void {
        // Listen for new logs
        this.streamManager.onLog((log: LogEntry) => {
            this.sendLogToWebview(log);
        });

        // Listen for connection state changes
        this.streamManager.onStateChange((state) => {
            this.sendStateUpdate(state);
        });

        // Listen for errors
        this.streamManager.onError((error) => {
            this.sendError(error.message);
        });
    }

    private handleWebviewMessage(message: any): void {
        switch (message.command) {
            case 'disconnect':
                this.streamManager.disconnect();
                vscode.window.showInformationMessage('Disconnected from log stream');
                break;
            case 'reconnect':
                this.reconnect();
                break;
            case 'clear':
                this.streamManager.clearBuffer();
                this.panel.webview.postMessage({ command: 'clearLogs' });
                break;
            case 'copy':
                const logs = this.streamManager.getBufferedLogs();
                const text = logs.map(l => `[${l.timestamp}] ${l.message}`).join('\n');
                vscode.env.clipboard.writeText(text);
                vscode.window.showInformationMessage('Logs copied to clipboard');
                break;
            case 'analyzeErrors':
                this.analyzeErrorsWithAI();
                break;
            case 'pause':
                // Future: implement pause functionality
                break;
        }
    }

    private async analyzeErrorsWithAI(): Promise<void> {
        try {
            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Analyzing logs for errors...",
                cancellable: false
            }, async () => {
                // Get all buffered logs
                const logs = this.streamManager.getBufferedLogs();
                
                if (logs.length === 0) {
                    vscode.window.showWarningMessage('No logs available to analyze');
                    return;
                }

                // Extract error logs
                const errorLogs = this.extractErrorLogs(logs);
                
                if (errorLogs.length === 0) {
                    vscode.window.showInformationMessage('✅ No errors found in the logs!');
                    return;
                }

                // Prepare context for AI
                const errorText = errorLogs.join('\n');
                const summarizer = new ErrorSummarizer(this.logger);
                
                const context = {
                    serviceName: this.serviceName,
                    deployId: this.deployInfo?.id || 'unknown',
                    status: this.deployInfo?.status || 'error',
                    commitMessage: this.deployInfo?.commit?.message || 'No commit info',
                    timestamp: new Date().toISOString(),
                    errorLogs: errorText
                };

                // Get AI summary
                const analysis = await summarizer.summarize(context);
                
                // Show analysis in a new panel
                this.showErrorAnalysis(errorLogs, analysis);
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error analysis failed: ${error.message}`);
            this.logger.log(`❌ Error analysis failed: ${error.message}`);
        }
    }

    private extractErrorLogs(logs: LogEntry[]): string[] {
        const errorPatterns = [
            /error/i,
            /failed/i,
            /exception/i,
            /fatal/i,
            /critical/i,
            /cannot/i,
            /unable to/i,
            /not found/i,
            /refused/i,
            /denied/i,
            /invalid/i,
            /missing/i,
            /undefined/i,
            /null reference/i,
            /timeout/i,
            /crashed/i,
            /exit code [^0]/i,
            /stack trace/i,
            /\[ERROR\]/i,
            /\bERR\b/i
        ];

        const errorLogs: string[] = [];
        const seenErrors = new Set<string>();

        for (const log of logs) {
            // Check if message matches any error pattern
            const isError = errorPatterns.some(pattern => pattern.test(log.message));
            
            if (isError) {
                // Clean the message (remove ANSI codes)
                const cleanMsg = this.stripAnsiCodes(log.message);
                
                // Avoid duplicates
                if (!seenErrors.has(cleanMsg)) {
                    errorLogs.push(`[${log.timestamp}] ${cleanMsg}`);
                    seenErrors.add(cleanMsg);
                }
            }
        }

        // Limit to last 50 error lines to avoid overwhelming the AI
        return errorLogs.slice(-50);
    }

    private stripAnsiCodes(text: string): string {
        return text.replace(/\x1b\[[0-9;]*m/g, '');
    }

    private showErrorAnalysis(errorLogs: string[], analysis: string): void {
        const panel = vscode.window.createWebviewPanel(
            'errorAnalysis',
            `Error Analysis: ${this.serviceName}`,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.getErrorAnalysisHtml(errorLogs, analysis);
    }

    private getErrorAnalysisHtml(errorLogs: string[], analysis: string): string {
        const errorCount = errorLogs.length;
        const escapedLogs = errorLogs.map(log => this.escapeHtml(log)).join('<br>');
        const formattedAnalysis = this.formatAnalysis(analysis);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error Analysis</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
            color: #e0e0e0;
            overflow: hidden;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .header {
            background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
            padding: 16px 20px;
            border-bottom: 2px solid #3a3a3a;
            flex-shrink: 0;
        }

        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        .header h1 {
            font-size: 20px;
            color: #ffffff;
            font-weight: 600;
        }

        .header .stats {
            display: flex;
            gap: 16px;
            font-size: 12px;
            color: #999;
            margin-top: 8px;
        }

        .stat-item {
            display: flex;
            gap: 6px;
        }

        .stat-item span {
            color: #e0e0e0;
            font-weight: 600;
        }

        .content {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
        }

        .section {
            background: rgba(42, 42, 42, 0.6);
            border: 1px solid #2a2a2a;
            border-radius: 4px;
            padding: 16px 20px;
            margin-bottom: 16px;
        }

        .section-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 12px;
            color: #ffffff;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding-bottom: 8px;
            border-bottom: 1px solid #3a3a3a;
        }

        .ai-analysis {
            background: #0a0a0a;
            border-left: 3px solid #7b68ee;
            padding: 16px;
            border-radius: 3px;
            font-size: 13px;
            line-height: 1.7;
            white-space: pre-wrap;
            color: #e8e8e8;
        }

        .error-logs {
            background: #0a0a0a;
            border-left: 3px solid #f44336;
            padding: 12px;
            border-radius: 3px;
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.6;
            overflow-x: auto;
            max-height: 500px;
            overflow-y: auto;
            color: #e0e0e0;
        }

        .error-count {
            display: inline-block;
            background: rgba(244, 67, 54, 0.2);
            border: 1px solid #f44336;
            color: #f14c4c;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: 600;
            font-family: 'Consolas', monospace;
        }

        ::-webkit-scrollbar {
            width: 10px;
            height: 10px;
        }

        ::-webkit-scrollbar-track {
            background: #0a0a0a;
        }

        ::-webkit-scrollbar-thumb {
            background: #3a3a3a;
            border-radius: 5px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: #555;
        }

        .footer {
            padding: 12px 20px;
            background: rgba(42, 42, 42, 0.95);
            border-top: 1px solid #3a3a3a;
            text-align: center;
            color: #666;
            font-size: 11px;
            flex-shrink: 0;
        }

        .powered-badge {
            display: inline-block;
            color: #999;
            font-family: 'Consolas', monospace;
        }

        .powered-badge strong {
            color: #7b68ee;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-top">
            <h1>Error Analysis: ${this.serviceName}</h1>
        </div>
        <div class="stats">
            <div class="stat-item">Errors Found: <span class="error-count">${errorCount}</span></div>
            <div class="stat-item">Analysis: <span>AI-Powered</span></div>
        </div>
    </div>

    <div class="content">
        <div class="section">
            <div class="section-title">AI Analysis & Solution</div>
            <div class="ai-analysis">${formattedAnalysis}</div>
        </div>

        <div class="section">
            <div class="section-title">Error Logs (Last ${errorCount} Entries)</div>
            <div class="error-logs">${escapedLogs}</div>
        </div>
    </div>

</body>
</html>`;
    }

    private formatAnalysis(text: string): string {
        // Convert markdown-like formatting to HTML
        let formatted = this.escapeHtml(text);
        
        // Bold text
        formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        
        // Convert numbered lists
        formatted = formatted.replace(/^(\d+\.)\s/gm, '<br>$1 ');
        
        // Preserve line breaks
        formatted = formatted.replace(/\n/g, '<br>');
        
        return formatted;
    }

    private reconnect(): void {
        this.logger.log('Reconnecting to log stream...');
        this.panel.webview.postMessage({ command: 'clearLogs' });
        // Stream manager will handle reconnection automatically
    }

    private sendLogToWebview(log: LogEntry): void {
        this.panel.webview.postMessage({
            command: 'newLog',
            log: log
        });
    }

    private sendStateUpdate(state: string): void {
        this.panel.webview.postMessage({
            command: 'stateChange',
            state: state
        });
    }

    private sendError(error: string): void {
        this.panel.webview.postMessage({
            command: 'error',
            error: error
        });
    }

    private update(): void {
        this.panel.webview.html = this.getHtmlContent();
        
        // Send initial buffered logs
        const bufferedLogs = this.streamManager.getBufferedLogs();
        for (const log of bufferedLogs) {
            this.sendLogToWebview(log);
        }
    }
    
    private getDeployInfoHtml(): string {
        let serviceInfo = '';
        if (this.serviceDetails) {
            const details = this.serviceDetails;
            
            let repoInfo = '';
            if (details.repo && details.branch) {
                repoInfo = `<a href="${this.escapeHtml(details.repo)}" target="_blank" rel="noopener noreferrer"><span class="service-detail">${this.escapeHtml(details.repo)}</span></a><span class="service-id">@ ${this.escapeHtml(details.branch)}</span></span>`;
            }
            
            let urlInfo = '';
            if (details.url) {
                urlInfo = `<span class="service-detail">🔗 <a href="${this.escapeHtml(details.url)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(details.url)}</a></span>`;
            }
            
            serviceInfo = `
                <div class="service-info">
                    Service ID:<span class="service-id">${this.escapeHtml(details.id)}</span>
                    ${repoInfo}
                    ${urlInfo}
                </div>
            `;
        }
        
        if (!this.deployInfo) {
            return serviceInfo;
        }
        
        const deploy = this.deployInfo;
        const createdAt = new Date(deploy.createdAt);
        const formattedDate = createdAt.toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
        });
        const formattedTime = createdAt.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true 
        });
        
        let commitInfo = '';
        if (deploy.commit) {
            const shortHash = deploy.commit.id.substring(0, 7);
            commitInfo = `
                <div class="deploy-commit">
                    Commit:<span class="commit-hash">${shortHash}</span>
                    <span class="commit-message">${this.escapeHtml(deploy.commit.message)}</span>
                </div>
            `;
        }
        
        // Extract error message if status indicates failure
        let errorInfo = '';
        if (deploy.status.toLowerCase().includes('fail')) {
            errorInfo = `
                <div class="deploy-error">
                    Exited with status 1 while running your code.
                    Read our <a href="https://render.com/docs" target="_blank" rel="noopener noreferrer" style="color: #4fc3f7;">docs</a> for common ways to troubleshoot your deploy.
                </div>
            `;
        }
        
        return `
            ${serviceInfo}
            <div class="deploy-info">
                <div class="deploy-timestamp">${formattedDate} at ${formattedTime}</div>
                ${commitInfo}
                ${errorInfo}
            </div>
        `;
    }
    
    private escapeHtml(text: string): string {
        const map: { [key: string]: string } = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }

    private getHtmlContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Real-Time Logs</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
            color: #e0e0e0;
            overflow: hidden;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .header {
            background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
            padding: 16px 20px;
            border-bottom: 2px solid #3a3a3a;
            flex-shrink: 0;
        }

        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }

        .header h1 {
            font-size: 20px;
            color: #ffffff;
        }

        .status-bar {
            display: flex;
            gap: 16px;
            align-items: center;
            font-size: 13px;
        }

        .status-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 12px;
            border-radius: 12px;
            background: rgba(42, 42, 42, 0.6);
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }

        .status-connected .status-dot { background: #4caf50; }
        .status-connecting .status-dot { background: #ff9800; }
        .status-disconnected .status-dot { background: #666; }
        .status-reconnecting .status-dot { background: #2196f3; }
        .status-error .status-dot { background: #f44336; }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .find-errors-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            background: linear-gradient(135deg, #6a1b9a 0%, #8e24aa 100%);
            border: 1px solid #9c27b0;
            border-radius: 6px;
            color: #ffffff;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 2px 4px rgba(142, 36, 170, 0.2);
        }

        .find-errors-btn:hover {
            background: linear-gradient(135deg, #7b1fa2 0%, #9c27b0 100%);
            box-shadow: 0 4px 8px rgba(142, 36, 170, 0.3);
            transform: translateY(-1px);
        }

        .find-errors-btn:active {
            transform: translateY(0);
            box-shadow: 0 2px 4px rgba(142, 36, 170, 0.2);
        }

        .find-errors-btn svg {
            width: 14px;
            height: 14px;
        }

        .stats {
            display: flex;
            gap: 16px;
            font-size: 12px;
            color: #999;
        }

        .stat-item span {
            color: #e0e0e0;
            font-weight: 600;
        }
        
        .service-info {
            background: rgba(30, 30, 45, 0.8);
            border: 1px solid #4a4a6a;
            border-radius: 6px;
            padding: 10px 16px;
            margin-top: 12px;
            display: flex;
            align-items: center;
            gap: 16px;
            font-size: 12px;
            flex-wrap: wrap;
        }
        
        .service-id {
            font-family: 'Courier New', monospace;
            background: rgba(42, 42, 60, 0.8);
            padding: 4px 10px;
            border-radius: 4px;
            color: #ffa726;
            font-size: 12px;
            font-weight: 600;
        }
        
        .service-detail {
            color: #b0b0b0;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .service-detail a {
            color: #4fc3f7;
            text-decoration: none;
        }
        
        .service-detail a:hover {
            text-decoration: underline;
        }
        
        .deploy-info {
            background: rgba(20, 20, 20, 0.8);
            border: 1px solid #3a3a3a;
            border-radius: 6px;
            padding: 12px 16px;
            margin-top: 8px;
            display: flex;
            align-items: center;
            gap: 16px;
            font-size: 13px;
        }
        
        .deploy-timestamp {
            color: #e0e0e0;
            font-weight: 500;
        }
        
        .deploy-badge {
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .deploy-badge.live { background: #4caf50; color: white; }
        .deploy-badge.success { background: #4caf50; color: white; }
        .deploy-badge.failed { background: #f44336; color: white; }
        .deploy-badge.build_failed { background: #f44336; color: white; }
        .deploy-badge.pre_deploy_failed { background: #f44336; color: white; }
        .deploy-badge.canceled { background: #ff9800; color: white; }
        .deploy-badge.cancelled { background: #ff9800; color: white; }
        .deploy-badge.deactivated { background: #666; color: white; }
        .deploy-badge.created { background: #2196f3; color: white; }
        .deploy-badge.build_in_progress { background: #2196f3; color: white; }
        .deploy-badge.update_in_progress { background: #2196f3; color: white; }
        .deploy-badge.pre_deploy_in_progress { background: #2196f3; color: white; }
        
        .deploy-commit {
            display: flex;
            align-items: center;
            gap: 8px;
            flex: 1;
        }
        
        .commit-hash {
            font-family: 'Courier New', monospace;
            background: rgba(42, 42, 42, 0.8);
            padding: 3px 8px;
            border-radius: 4px;
            color: #4fc3f7;
            font-size: 12px;
        }
        
        .commit-message {
            color: #b0b0b0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .deploy-error {
            color: #f14c4c;
            font-weight: 500;
        }
        
        .deploy-error a {
            color: #4fc3f7;
            text-decoration: underline;
            text-decoration-style: dotted;
        }
        
        .deploy-error a:hover {
            color: #81d4fa;
            text-decoration-style: solid;
        }

        .toolbar {
            background: rgba(42, 42, 42, 0.95);
            padding: 12px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #3a3a3a;
            flex-shrink: 0;
        }

        .search-box {
            padding: 6px 12px;
            border: 1px solid #3a3a3a;
            border-radius: 4px;
            background: #1a1a1a;
            width: 300px;
            font-size: 13px;
            color: #e0e0e0;
        }

        .search-box:focus {
            outline: none;
            border-color: #555;
            background: #222;
        }

        .button-group {
            display: flex;
            gap: 8px;
        }

        button {
            padding: 6px 12px;
            border: 1px solid #3a3a3a;
            border-radius: 4px;
            background: #2a2a2a;
            color: #e0e0e0;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }

        button:hover {
            background: #3a3a3a;
            border-color: #555;
        }

        button:active {
            transform: scale(0.98);
        }

        button.danger {
            border-color: #f44336;
            color: #f44336;
        }

        button.danger:hover {
            background: #f44336;
            color: #fff;
        }

        .logs-container {
            flex: 1;
            overflow-y: auto;
            padding: 12px 20px;
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.5;
            background: #0a0a0a;
        }

        .log-entry {
            padding: 4px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            white-space: pre-wrap;
            word-break: break-word;
            display: flex;
            gap: 12px;
        }

        .log-entry:hover {
            background: rgba(255, 255, 255, 0.02);
        }

        .log-timestamp {
            color: #666;
            flex-shrink: 0;
            font-size: 11px;
        }

        .log-message {
            flex: 1;
            color: #e0e0e0;
            font-family: 'Consolas', 'Courier New', monospace;
        }

        .log-message span {
            font-family: inherit;
        }

        .log-message a {
            color: #4fc3f7;
            text-decoration: underline;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration-style: dotted;
        }

        .log-message a:hover {
            color: #81d4fa;
            text-decoration: underline;
            text-decoration-style: solid;
            background: rgba(79, 195, 247, 0.1);
            padding: 0 2px;
            border-radius: 2px;
        }

        .log-level-error { color: #f44336; }
        .log-level-warn { color: #ff9800; }
        .log-level-info { color: #2196f3; }
        .log-level-debug { color: #9e9e9e; }
        .log-type-build { color: #4caf50; }
        .log-type-request { color: #00bcd4; }

        .highlight {
            background: rgba(255, 235, 59, 0.3);
        }

        ::-webkit-scrollbar {
            width: 10px;
        }

        ::-webkit-scrollbar-track {
            background: #0a0a0a;
        }

        ::-webkit-scrollbar-thumb {
            background: #3a3a3a;
            border-radius: 5px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: #555;
        }

        .auto-scroll-indicator {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 8px 16px;
            background: #2a2a2a;
            border: 1px solid #3a3a3a;
            border-radius: 20px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .auto-scroll-indicator:hover {
            background: #3a3a3a;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-top">
            <h1>Real-Time Logs: ${this.serviceName}</h1>
            <div class="status-bar">
                <button id="btn-find-errors" class="find-errors-btn" title="Analyze logs for errors with AI">
                    Crucify Errors
                </button>
                <div id="status-indicator" class="status-indicator status-connecting">
                    <div class="status-dot"></div>
                    <span id="status-text">Connecting...</span>
                </div>
            </div>
        </div>
        <div class="stats">
            <div class="stat-item">Logs: <span id="log-count">0</span></div>
            <div class="stat-item">Buffer: <span id="buffer-size">0</span></div>
            <div class="stat-item">Rate: <span id="log-rate">0</span>/s</div>
        </div>
        ${this.getDeployInfoHtml()}
    </div>

    <div class="toolbar">
        <input type="text" class="search-box" id="search-box" placeholder="Search logs...">
        <div class="button-group">
            <button id="btn-clear">Clear</button>
            <button id="btn-copy">Copy All</button>
            <button id="btn-reconnect">Reconnect</button>
            <button id="btn-disconnect" class="danger">Disconnect</button>
        </div>
    </div>

    <div class="logs-container" id="logs-container"></div>

    <div id="auto-scroll-indicator" class="auto-scroll-indicator" style="display: none;">
        Auto-scroll enabled
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        let logs = [];
        let filteredLogs = [];
        let autoScroll = true;
        let searchTerm = '';
        let logCount = 0;
        let lastLogTime = Date.now();
        let logRate = 0;

        const logsContainer = document.getElementById('logs-container');
        const searchBox = document.getElementById('search-box');
        const statusIndicator = document.getElementById('status-indicator');
        const statusText = document.getElementById('status-text');
        const logCountEl = document.getElementById('log-count');
        const bufferSizeEl = document.getElementById('buffer-size');
        const logRateEl = document.getElementById('log-rate');
        const autoScrollIndicator = document.getElementById('auto-scroll-indicator');

        // Button handlers
        document.getElementById('btn-clear').addEventListener('click', () => {
            vscode.postMessage({ command: 'clear' });
            logs = [];
            filteredLogs = [];
            renderLogs();
        });

        document.getElementById('btn-copy').addEventListener('click', () => {
            vscode.postMessage({ command: 'copy' });
        });

        document.getElementById('btn-reconnect').addEventListener('click', () => {
            vscode.postMessage({ command: 'reconnect' });
        });

        document.getElementById('btn-disconnect').addEventListener('click', () => {
            vscode.postMessage({ command: 'disconnect' });
        });

        document.getElementById('btn-find-errors').addEventListener('click', () => {
            vscode.postMessage({ command: 'analyzeErrors' });
        });

        // Search handler
        searchBox.addEventListener('input', (e) => {
            searchTerm = e.target.value.toLowerCase();
            filterAndRenderLogs();
        });

        // Scroll detection
        logsContainer.addEventListener('scroll', () => {
            const isAtBottom = logsContainer.scrollHeight - logsContainer.scrollTop <= logsContainer.clientHeight + 50;
            autoScroll = isAtBottom;
            autoScrollIndicator.style.display = autoScroll ? 'none' : 'block';
        });

        autoScrollIndicator.addEventListener('click', () => {
            autoScroll = true;
            scrollToBottom();
            autoScrollIndicator.style.display = 'none';
        });

        // Message handler
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'newLog':
                    addLog(message.log);
                    break;
                case 'stateChange':
                    updateStatus(message.state);
                    break;
                case 'error':
                    showError(message.error);
                    break;
                case 'clearLogs':
                    logs = [];
                    filteredLogs = [];
                    renderLogs();
                    break;
            }
        });

        function addLog(log) {
            logs.push(log);
            logCount++;
            
            // Maintain buffer size
            if (logs.length > ${this.maxDisplayLogs}) {
                logs.shift();
            }

            // Calculate log rate
            const now = Date.now();
            const timeDiff = (now - lastLogTime) / 1000;
            if (timeDiff > 0) {
                logRate = Math.round(1 / timeDiff);
            }
            lastLogTime = now;

            updateStats();
            
            if (matchesSearch(log)) {
                filteredLogs.push(log);
                appendLogToDOM(log);
                
                if (autoScroll) {
                    scrollToBottom();
                }
            }
        }

        function matchesSearch(log) {
            if (!searchTerm) return true;
            return log.message.toLowerCase().includes(searchTerm) ||
                   (log.level && log.level.toLowerCase().includes(searchTerm)) ||
                   (log.type && log.type.toLowerCase().includes(searchTerm));
        }

        function appendLogToDOM(log) {
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            if (log.level) entry.classList.add(\`log-level-\${log.level}\`);
            if (log.type) entry.classList.add(\`log-type-\${log.type}\`);
            
            const timestamp = document.createElement('span');
            timestamp.className = 'log-timestamp';
            timestamp.textContent = formatTimestamp(log.timestamp);
            
            const message = document.createElement('span');
            message.className = 'log-message';
            
            // Parse ANSI codes and convert to HTML
            let htmlMessage = parseAnsiToHtml(log.message);
            
            // Convert URLs to clickable links
            htmlMessage = linkifyUrls(htmlMessage);
            
            message.innerHTML = htmlMessage;
            
            // Highlight search term if present
            if (searchTerm && log.message.toLowerCase().includes(searchTerm)) {
                const highlightedHtml = highlightText(htmlMessage, searchTerm);
                message.innerHTML = highlightedHtml;
            }
            
            entry.appendChild(timestamp);
            entry.appendChild(message);
            logsContainer.appendChild(entry);
        }

        function linkifyUrls(html) {
            // URL regex patterns
            const patterns = [
                // HTTP/HTTPS URLs
                /(https?:\\/\\/[^\\s<>"']+)/gi,
                // www. domains
                /(www\\.[a-zA-Z0-9][a-zA-Z0-9-]*\\.[a-zA-Z]{2,}[^\\s<>"']*)/gi,
                // Common domains without www
                /\\b([a-zA-Z0-9][a-zA-Z0-9-]*\\.(?:com|org|net|io|dev|app|co|ai|tech|xyz|cloud)(?:\\/[^\\s<>"']*)?)\\b/gi,
                // Localhost and IP addresses with ports
                /\\b((?:localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0|(?:[0-9]{1,3}\\.){3}[0-9]{1,3})(?::[0-9]{1,5})?(?:\\/[^\\s<>"']*)?)\\b/gi
            ];
            
            let result = html;
            
            // Process each pattern
            for (const pattern of patterns) {
                result = result.replace(pattern, function(match) {
                    // Skip if already inside an anchor tag
                    if (match.includes('<a ') || match.includes('</a>')) {
                        return match;
                    }
                    
                    let url = match.trim();
                    let href = url;
                    
                    // Add protocol if missing
                    if (!url.match(/^https?:\\/\\//i)) {
                        // Use http for localhost/IPs, https for domains
                        if (url.match(/^(?:localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0|(?:[0-9]{1,3}\\.){3}[0-9]{1,3})/)) {
                            href = 'http://' + url;
                        } else {
                            href = 'https://' + url;
                        }
                    }
                    
                    return '<a href="' + href + '" target="_blank" rel="noopener noreferrer" title="Click to open: ' + href + '">' + url + '</a>';
                });
            }
            
            return result;
        }

        function parseAnsiToHtml(text) {
            // ANSI color code mappings
            const colors = {
                '30': '#000000', '31': '#cd3131', '32': '#0dbc79', '33': '#e5e510',
                '34': '#2472c8', '35': '#bc3fbc', '36': '#11a8cd', '37': '#e5e5e5',
                '90': '#666666', '91': '#f14c4c', '92': '#23d18b', '93': '#f5f543',
                '94': '#3b8eea', '95': '#d670d6', '96': '#29b8db', '97': '#ffffff',
                '40': 'bg-#000000', '41': 'bg-#cd3131', '42': 'bg-#0dbc79', '43': 'bg-#e5e510',
                '44': 'bg-#2472c8', '45': 'bg-#bc3fbc', '46': 'bg-#11a8cd', '47': 'bg-#e5e5e5',
                '100': 'bg-#666666', '101': 'bg-#f14c4c', '102': 'bg-#23d18b', '103': 'bg-#f5f543',
                '104': 'bg-#3b8eea', '105': 'bg-#d670d6', '106': 'bg-#29b8db', '107': 'bg-#ffffff'
            };

            // Clean up terminal control sequences
            let cleaned = text
                .replace(/\\(B\\[m/g, '[0m')           // Convert (B[m to reset
                .replace(/\\[\\(B/g, '')                // Remove charset sequences
                .replace(/\\(B/g, '')                   // Remove other B sequences
                .replace(/\\x1b/g, '')                 // Remove ESC character if present
                .replace(/\\u001b/g, '')               // Remove unicode ESC
                .replace(/\\[m/g, '')                  // Remove orphaned [m (reset without ESC)
                .replace(/\\[K/g, '')                  // Remove orphaned [K (clear line)
                .replace(/\\[([0-9]{1,2})?[ABCDEFGJKST]/g, '')  // Remove orphaned cursor movement codes
                .replace(/\\[([0-9;]*)[Hf]/g, '');    // Remove orphaned cursor position codes

            let html = '';
            let openSpans = 0;
            let currentColor = null;
            let isBold = false;
            let isDim = false;
            
            // Process ANSI codes - handle both [Xm and ESC[Xm formats
            const ansiRegex = /\\[([0-9;]+)m/g;
            let lastIndex = 0;
            let match;
            
            while ((match = ansiRegex.exec(cleaned)) !== null) {
                // Add text before the ANSI code
                if (match.index > lastIndex) {
                    const textBefore = cleaned.substring(lastIndex, match.index);
                    html += escapeHtml(textBefore);
                }
                
                const codes = match[1].split(';');
                
                for (const code of codes) {
                    if (code === '0' || code === '00') {
                        // Reset all
                        while (openSpans > 0) {
                            html += '</span>';
                            openSpans--;
                        }
                        currentColor = null;
                        isBold = false;
                        isDim = false;
                    } else if (code === '1') {
                        isBold = true;
                    } else if (code === '2') {
                        isDim = true;
                    } else if (code === '22') {
                        // Reset bold/dim
                        isBold = false;
                        isDim = false;
                    } else if (colors[code]) {
                        currentColor = colors[code];
                    }
                }
                
                // Close previous span if any
                while (openSpans > 0) {
                    html += '</span>';
                    openSpans--;
                }
                
                // Open new span with current styles
                const styles = [];
                if (isBold) styles.push('font-weight:bold');
                if (isDim) styles.push('opacity:0.6');
                if (currentColor) {
                    if (currentColor.startsWith('bg-')) {
                        styles.push('background-color:' + currentColor.substring(3));
                        styles.push('padding:0 2px');
                    } else {
                        styles.push('color:' + currentColor);
                    }
                }
                
                if (styles.length > 0) {
                    html += '<span style="' + styles.join(';') + '">';
                    openSpans++;
                }
                
                lastIndex = ansiRegex.lastIndex;
            }
            
            // Add remaining text
            if (lastIndex < cleaned.length) {
                html += escapeHtml(cleaned.substring(lastIndex));
            }
            
            // Close any remaining open spans
            while (openSpans > 0) {
                html += '</span>';
                openSpans--;
            }
            
            // Apply error highlighting if no ANSI colors were applied
            if (!html || html === escapeHtml(text)) {
                html = highlightErrors(escapeHtml(text));
            } else {
                html = highlightErrors(html);
            }
            
            return html;
        }
        
        function highlightErrors(html) {
            // Error pattern detection - case insensitive
            const errorPatterns = [
                { regex: /\\b(error|ERROR|Error)\\b/g, color: '#f14c4c', bold: true },
                { regex: /\\b(failed|FAILED|Failed|failure|FAILURE|Failure)\\b/g, color: '#f14c4c', bold: true },
                { regex: /\\b(exception|EXCEPTION|Exception)\\b/g, color: '#f14c4c', bold: true },
                { regex: /\\b(fatal|FATAL|Fatal)\\b/g, color: '#ff5252', bold: true },
                { regex: /\\b(warning|WARNING|Warning|warn|WARN|Warn)\\b/g, color: '#ff9800', bold: false },
                { regex: /\\b(deprecated|DEPRECATED|Deprecated)\\b/g, color: '#ff9800', bold: false }
            ];
            
            let result = html;
            
            for (const pattern of errorPatterns) {
                result = result.replace(pattern.regex, function(match) {
                    const style = 'color:' + pattern.color + ';' + (pattern.bold ? 'font-weight:bold;' : '');
                    return '<span style="' + style + '">' + match + '</span>';
                });
            }
            
            return result;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function formatTimestamp(timestamp) {
            const date = new Date(timestamp);
            return date.toLocaleTimeString('en-US', { hour12: true }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
        }

        function highlightText(text, term) {
            if (!term) return text;
            const lowerText = text.toLowerCase();
            const lowerTerm = term.toLowerCase();
            const index = lowerText.indexOf(lowerTerm);
            
            if (index === -1) return text;
            
            const before = text.substring(0, index);
            const match = text.substring(index, index + term.length);
            const after = text.substring(index + term.length);
            
            return before + '<span class="highlight">' + match + '</span>' + highlightText(after, term);
        }

        function filterAndRenderLogs() {
            filteredLogs = logs.filter(matchesSearch);
            renderLogs();
        }

        function renderLogs() {
            logsContainer.innerHTML = '';
            filteredLogs.forEach(log => appendLogToDOM(log));
            if (autoScroll) {
                scrollToBottom();
            }
        }

        function scrollToBottom() {
            logsContainer.scrollTop = logsContainer.scrollHeight;
        }

        function updateStatus(state) {
            statusIndicator.className = \`status-indicator status-\${state}\`;
            const statusTexts = {
                connecting: 'Connecting...',
                connected: 'Connected',
                disconnected: 'Disconnected',
                reconnecting: 'Reconnecting...',
                error: 'Error'
            };
            statusText.textContent = statusTexts[state] || state;
        }

        function updateStats() {
            logCountEl.textContent = logCount;
            bufferSizeEl.textContent = logs.length;
            logRateEl.textContent = logRate;
        }

        function showError(error) {
            console.error('Stream error:', error);
        }

        // Update log rate every second
        setInterval(() => {
            logRate = 0;
            updateStats();
        }, 1000);
    </script>
</body>
</html>`;
    }

    public dispose(): void {
        RealTimeLogPanel.currentPanel = undefined;

        this.panel.dispose();

        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
