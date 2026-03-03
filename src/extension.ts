import * as vscode from 'vscode';
import { RenderClient, RenderService } from './api/renderClient';
import { RenderTreeProvider } from './tree/renderTreeProvider';
import { RealTimeLogPanel } from './ui/realTimeLogPanel';
import { LogStreamManager } from './streaming/logStreamManager';
import { Logger } from './utils/logger';

let renderClient: RenderClient;
let treeProvider: RenderTreeProvider;
let logger: Logger;

export async function activate(context: vscode.ExtensionContext) {
    logger = new Logger('ReRender');
    logger.log('🚀 ReRender activated');

    // Initialize Render API client
    renderClient = new RenderClient(context, logger);

    // Initialize tree provider
    treeProvider = new RenderTreeProvider(renderClient, logger);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('renderServices', treeProvider)
    );

    // Register command: Set API Key
    context.subscriptions.push(
        vscode.commands.registerCommand('rerender.setApiKey', async () => {
            await setApiKey(context);
        })
    );

    // Register command: Refresh Services
    context.subscriptions.push(
        vscode.commands.registerCommand('rerender.refreshServices', async () => {
            logger.log('🔄 Refreshing services...');
            await treeProvider.refresh();
        })
    );

    // Register command: Open Service Logs (triggered when clicking a service)
    context.subscriptions.push(
        vscode.commands.registerCommand('rerender.openServiceLogs', async (service: RenderService) => {
            await openServiceLogs(context, service);
        })
    );

    // Check if API key exists
    const apiKey = await context.secrets.get('renderApiKey');
    if (!apiKey) {
        // Show welcome message
        const action = await vscode.window.showInformationMessage(
            'Welcome to Render Guardian! Set your API key to get started.',
            'Set API Key'
        );

        if (action === 'Set API Key') {
            await setApiKey(context);
        }
    } else {
        // Load services
        await treeProvider.refresh();
    }

    logger.log('✅ Render Guardian ready');
}

async function setApiKey(context: vscode.ExtensionContext) {
    const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your Render API key',
        password: true,
        ignoreFocusOut: true,
        placeHolder: 'rnd_xxxxxxxxxxxxx',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'API key cannot be empty';
            }
            if (!value.startsWith('rnd_')) {
                return 'Render API keys typically start with "rnd_"';
            }
            return null;
        }
    });

    if (apiKey) {
        await context.secrets.store('renderApiKey', apiKey.trim());
        vscode.window.showInformationMessage('✅ API key saved! Loading services...');
        logger.log('🔑 API key updated');

        // Refresh services list
        if (treeProvider) {
            await treeProvider.refresh();
        }
    }
}

async function openServiceLogs(context: vscode.ExtensionContext, service: RenderService) {
    try {
        // Get API key
        const apiKey = await context.secrets.get('renderApiKey');
        if (!apiKey) {
            vscode.window.showErrorMessage('API key not found');
            return;
        }

        logger.log(`📡 Opening logs for service: ${service.name} (${service.id})`);

        // Get ownerId from service
        const ownerId = service.ownerId;
        if (!ownerId) {
            vscode.window.showErrorMessage('Service does not have an owner ID');
            logger.log('Service object missing ownerId field');
            return;
        }

        logger.log(`Using ownerId: ${ownerId}`);

        // Create stream manager
        const streamManager = new LogStreamManager(logger);
        
        // Fetch latest deployment info
        logger.log(`Fetching deployment info for service ${service.id}...`);
        const deploys = await renderClient.getServiceDeploys(service.id, 1);
        const latestDeploy = deploys && deploys.length > 0 ? deploys[0] : undefined;
        
        if (latestDeploy) {
            logger.log(`Latest deploy status: ${latestDeploy.status}`);
        }

        // Create and show real-time log panel
        const serviceDetails = {
            id: service.id,
            repo: service.repo,
            branch: service.branch,
            url: service.serviceDetails?.url
        };
        
        const panel = RealTimeLogPanel.createOrShow(
            context,
            streamManager,
            logger,
            service.name,
            serviceDetails,
            latestDeploy
        );

        // Configure stream
        const streamConfig = {
            serviceId: service.id,
            ownerId: ownerId,
            apiKey: apiKey,
            filters: {
                type: ['app', 'build'],
                level: [],
                text: []
            }
        };

        // Connect to stream
        await streamManager.connect(streamConfig);
        
        logger.log(`✅ Real-time log streaming started for ${service.name}`);
        vscode.window.showInformationMessage(`Streaming logs for ${service.name}`);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.log(`❌ Failed to open logs: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to open logs: ${errorMessage}`);
    }
}

export function deactivate() {
    logger?.log('👋 Render Guardian deactivated');
}
