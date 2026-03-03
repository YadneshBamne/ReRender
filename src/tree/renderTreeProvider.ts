import * as vscode from 'vscode';
import { RenderClient, RenderService } from '../api/renderClient';
import { Logger } from '../utils/logger';

export class RenderTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private renderClient: RenderClient;
    private logger: Logger;
    private services: RenderService[] = [];
    private isAuthenticated: boolean = false;

    constructor(renderClient: RenderClient, logger: Logger) {
        this.renderClient = renderClient;
        this.logger = logger;
    }

    async refresh(): Promise<void> {
        try {
            this.isAuthenticated = await this.renderClient.isAuthenticated();
            
            if (!this.isAuthenticated) {
                this.logger.log('⚠️ No API key set');
                this.services = [];
                this._onDidChangeTreeData.fire();
                return;
            }
            
            this.logger.log('🔄 Refreshing services...');
            this.services = await this.renderClient.getServices();
            this.logger.log(`✅ Loaded ${this.services.length} services`);
            this._onDidChangeTreeData.fire();
        } catch (error: any) {
            this.logger.log(`❌ Failed to refresh services: ${error.message}`);
            this.services = [];
            this._onDidChangeTreeData.fire();
        }
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TreeItem): Promise<TreeItem[]> {
        if (!element) {
            // Root level
            const isAuth = await this.renderClient.isAuthenticated();
            
            if (!isAuth) {
                // Show API key setup prompt
                const setupItem = new TreeItem(
                    'Set API Key',
                    'Click to configure Render API key',
                    vscode.TreeItemCollapsibleState.None,
                    'setup'
                );
                setupItem.command = {
                    command: 'rerender.setApiKey',
                    title: 'Set API Key'
                };
                return [setupItem];
            }

            if (this.services.length === 0) {
                const emptyItem = new TreeItem(
                    'No services found',
                    'Click refresh to reload',
                    vscode.TreeItemCollapsibleState.None,
                    'info'
                );
                emptyItem.command = {
                    command: 'rerender.refreshServices',
                    title: 'Refresh'
                };
                return [emptyItem];
            }

            // Show services list - expandable to show details
            return this.services.map(service => {
                const item = new TreeItem(
                    service.name,
                    service.type || 'Service',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'service'
                );
                item.tooltip = `${service.name} (${service.type})`;
                item.contextValue = 'service';
                item.service = service;
                return item;
            });
        } else if (element.contextValue === 'service' && element.service) {
            // Service details - show info and action buttons
            const service = element.service;
            const details: TreeItem[] = [];

            // Service ID
            const idItem = new TreeItem(
                'Service ID',
                service.id,
                vscode.TreeItemCollapsibleState.None,
                'detail'
            );
            idItem.tooltip = service.id;
            details.push(idItem);

            // GitHub repo and branch
            if (service.repo) {
                const repoItem = new TreeItem(
                    'Repository',
                    `${service.repo}${service.branch ? ` @ ${service.branch}` : ''}`,
                    vscode.TreeItemCollapsibleState.None,
                    'repo'
                );
                repoItem.tooltip = `GitHub: ${service.repo}`;
                details.push(repoItem);
            }

            // Service URL
            if (service.serviceDetails?.url) {
                const urlItem = new TreeItem(
                    'URL',
                    service.serviceDetails.url,
                    vscode.TreeItemCollapsibleState.None,
                    'link'
                );
                urlItem.tooltip = `Click to open: ${service.serviceDetails.url}`;
                urlItem.command = {
                    command: 'vscode.open',
                    title: 'Open URL',
                    arguments: [vscode.Uri.parse(service.serviceDetails.url)]
                };
                details.push(urlItem);
            }

            // Divider
            const dividerItem = new TreeItem(
                '───────────────',
                '',
                vscode.TreeItemCollapsibleState.None,
                'divider'
            );
            details.push(dividerItem);

            // Stream Logs action
            const logsItem = new TreeItem(
                '▶ Stream Real-Time Logs',
                'Click to start streaming',
                vscode.TreeItemCollapsibleState.None,
                'action'
            );
            logsItem.command = {
                command: 'rerender.openServiceLogs',
                title: 'Stream Logs',
                arguments: [service]
            };
            details.push(logsItem);

            return details;
        }

        return [];
    }
}

class TreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: string
    ) {
        super(label, collapsibleState);
        this.description = description;
    }

    service?: RenderService;

    iconPath = this.getIconPath();

    private getIconPath() {
        switch (this.itemType) {
            case 'setup':
                return new vscode.ThemeIcon('key', new vscode.ThemeColor('charts.yellow'));
            case 'service':
                return new vscode.ThemeIcon('server', new vscode.ThemeColor('charts.blue'));
            case 'repo':
                return new vscode.ThemeIcon('github');
            case 'link':
                return new vscode.ThemeIcon('link-external', new vscode.ThemeColor('charts.green'));
            case 'detail':
                return new vscode.ThemeIcon('tag');
            case 'action':
                return new vscode.ThemeIcon('play', new vscode.ThemeColor('charts.orange'));
            case 'divider':
                return new vscode.ThemeIcon('kebab-horizontal');
            case 'info':
                return new vscode.ThemeIcon('info');
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }
}
