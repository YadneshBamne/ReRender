import * as vscode from 'vscode';
import { RenderClient, ServiceHealth } from '../api/renderClient';
import { RenderTreeProvider } from '../tree/renderTreeProvider';
import { StatusBarManager } from '../utils/statusBar';
import { ErrorDetector } from './errorDetector';
import { ErrorSummarizer } from '../ai/summarizer';
import { Logger } from '../utils/logger';

export class ServicePoller {
    private pollTimer?: NodeJS.Timeout;
    private isPolling = false;
    private renderClient: RenderClient;
    private treeProvider: RenderTreeProvider;
    private statusBarManager: StatusBarManager;
    private logger: Logger;
    private context: vscode.ExtensionContext;
    private errorDetector: ErrorDetector;
    private errorSummarizer: ErrorSummarizer;

    constructor(
        renderClient: RenderClient,
        treeProvider: RenderTreeProvider,
        statusBarManager: StatusBarManager,
        logger: Logger,
        context: vscode.ExtensionContext
    ) {
        this.renderClient = renderClient;
        this.treeProvider = treeProvider;
        this.statusBarManager = statusBarManager;
        this.logger = logger;
        this.context = context;
        this.errorDetector = new ErrorDetector(context);
        this.errorSummarizer = new ErrorSummarizer(logger);
    }

    async start() {
        if (this.isPolling) {
            this.logger.log('⚠️ Polling already active');
            return;
        }

        const isAuthenticated = await this.renderClient.isAuthenticated();
        if (!isAuthenticated) {
            this.logger.log('⚠️ Cannot start polling - no API key set');
            return;
        }

        this.isPolling = true;
        this.logger.log('▶️ Starting service health monitoring');
        
        // Initial check
        await this.checkServices();
        
        // Schedule next check
        this.scheduleNextCheck();
    }

    stop() {
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = undefined;
        }
        this.isPolling = false;
        this.logger.log('⏸️ Stopped service health monitoring');
    }

    private scheduleNextCheck() {
        if (!this.isPolling) {
            return;
        }

        const config = vscode.workspace.getConfiguration('renderGuardian');
        const baseInterval = config.get<number>('pollIntervalSeconds', 180);
        
        // Adaptive polling: if any service is deploying, check more frequently
        const interval = this.shouldPollFaster() ? 30 : baseInterval;
        
        this.logger.log(`⏰ Next check in ${interval} seconds`);
        
        this.pollTimer = setTimeout(async () => {
            await this.checkServices();
            this.scheduleNextCheck();
        }, interval * 1000);
    }

    private shouldPollFaster(): boolean {
        // Check if any service is currently deploying
        return this.errorDetector.hasActiveDeployments();
    }

    async checkServices() {
        try {
            this.logger.log('\n🔍 Checking service health...');
            
            const servicesHealth = await this.renderClient.getAllServicesHealth();
            
            let healthyCount = 0;
            let deployingCount = 0;
            let failedCount = 0;

            // Process each service
            for (const health of servicesHealth) {
                switch (health.status) {
                    case 'healthy':
                        healthyCount++;
                        break;
                    case 'deploying':
                        deployingCount++;
                        this.errorDetector.markDeploying(health.service.id, health.latestDeploy?.id);
                        break;
                    case 'failed':
                        failedCount++;
                        await this.handleFailure(health);
                        break;
                }
            }

            // Update status bar
            this.statusBarManager.update(healthyCount, deployingCount, failedCount);

            // Update tree view
            await this.treeProvider.refresh();

            this.logger.log(
                `📊 Status: ${healthyCount} healthy, ${deployingCount} deploying, ${failedCount} failed`
            );

        } catch (error: any) {
            this.logger.log(`❌ Error during health check: ${error.message}`);
        }
    }

    private async handleFailure(health: ServiceHealth) {
        const service = health.service;
        const deploy = health.latestDeploy;

        if (!deploy) {
            this.logger.log(`⚠️ No deploy information for failed service: ${service.name}`);
            return;
        }

        // Check if we've already notified about this deploy
        if (this.errorDetector.hasNotified(service.id, deploy.id)) {
            this.logger.log(`🔕 Already notified about deploy ${deploy.id} for ${service.name}`);
            return;
        }

        // Mark as notified
        this.errorDetector.markNotified(service.id, deploy.id);

        // **FETCH ACTUAL ERROR LOGS FROM RENDER API**
        this.logger.log(`📜 Fetching deploy logs for real error analysis...`);
        const errorLogs = await this.renderClient.getDeployLogs(service.id, deploy.id);

        // Extract error information WITH REAL LOGS
        const errorContext = {
            serviceName: service.name,
            deployId: deploy.id,
            status: deploy.status,
            commitMessage: deploy.commit?.message || 'No commit message',
            timestamp: deploy.finishedAt || deploy.updatedAt,
            errorLogs: errorLogs // Pass the real error logs
        };

        // Generate AI summary based on REAL ERROR LOGS
        this.logger.log(`\n🤖 Generating AI analysis from actual error logs...`);
        const summary = await this.errorSummarizer.summarize(errorContext);

        // Log to output channel
        this.logger.log(`\n❌ FAILURE DETECTED`);
        this.logger.log(`Service: ${service.name}`);
        this.logger.log(`Deploy ID: ${deploy.id}`);
        this.logger.log(`Status: ${deploy.status}`);
        if (errorLogs) {
            this.logger.log(`\n📋 Error Logs:\n${errorLogs.substring(0, 500)}${errorLogs.length > 500 ? '...' : ''}`);
        }
        this.logger.log(`\n${summary}`);

        // Prepare error panel data WITH LOGS
        const errorPanelData = {
            service: service,
            deploy: deploy,
            aiSummary: summary,
            errorLogs: errorLogs // Include actual logs in panel
        };

        // Prepare log viewer data
        const logViewerData = {
            serviceName: service.name,
            deployId: deploy.id,
            logs: errorLogs || 'No logs available. Check Render Dashboard for full logs.',
            status: deploy.status,
            timestamp: deploy.finishedAt || deploy.updatedAt
        };

        // Show notification if enabled
        const config = vscode.workspace.getConfiguration('renderGuardian');
        const enableNotifications = config.get<boolean>('enableNotifications', true);

        if (enableNotifications) {
            const action = await vscode.window.showErrorMessage(
                `🔴 ${service.name} deployment failed - ${deploy.status}`,
                'View Analysis',
                'View Logs',
                'Open Dashboard',
                'Dismiss'
            );

            if (action === 'View Analysis') {
                // Open the detailed error panel with AI summary AND LOGS
                vscode.commands.executeCommand('renderGuardian.viewErrorDetails', errorPanelData);
            } else if (action === 'View Logs') {
                // Open the beautiful log viewer panel
                vscode.commands.executeCommand('renderGuardian.viewLogs', logViewerData);
            } else if (action === 'Open Dashboard') {
                const dashboardUrl = `https://dashboard.render.com/web/${service.id}`;
                vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
            }
        } else {
            // Even if notifications are disabled, log that the panel can be opened
            this.logger.log(`💡 Run "Render Guardian: View Service" to see detailed error analysis`);
        }
    }
}
