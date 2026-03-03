import * as vscode from 'vscode';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private logsBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.statusBarItem.command = 'renderGuardian.refreshServices';
        this.statusBarItem.show();
        
        // Add a separate status bar item for viewing diagnostic logs
        this.logsBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            99
        );
        this.logsBarItem.text = '$(output) Logs';
        this.logsBarItem.tooltip = 'View Render Guardian diagnostic logs';
        this.logsBarItem.command = 'renderGuardian.viewDiagnosticLogs';
        this.logsBarItem.show();
        
        this.update(0, 0, 0);
    }

    update(healthy: number, deploying: number, failed: number) {
        let icon = '🟢';
        let text = 'Render: All healthy';
        let color: vscode.ThemeColor | undefined;

        if (failed > 0) {
            icon = '🔴';
            text = `Render: ${failed} failing`;
            color = new vscode.ThemeColor('statusBarItem.errorBackground');
        } else if (deploying > 0) {
            icon = '🔄';
            text = `Render: ${deploying} deploying`;
            color = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else if (healthy === 0) {
            icon = '⚪';
            text = 'Render: No services';
            color = undefined;
        }

        this.statusBarItem.text = `${icon} ${text}`;
        this.statusBarItem.backgroundColor = color;
        this.statusBarItem.tooltip = this.getTooltip(healthy, deploying, failed);
    }

    private getTooltip(healthy: number, deploying: number, failed: number): string {
        const parts: string[] = [];
        
        if (healthy > 0) {
            parts.push(`${healthy} healthy`);
        }
        if (deploying > 0) {
            parts.push(`${deploying} deploying`);
        }
        if (failed > 0) {
            parts.push(`${failed} failed`);
        }

        if (parts.length === 0) {
            return 'No services monitored';
        }

        return `Render Services: ${parts.join(', ')}\n\nClick to refresh`;
    }

    dispose() {
        this.statusBarItem.dispose();
        this.logsBarItem.dispose();
    }
}
