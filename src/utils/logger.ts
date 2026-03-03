import * as vscode from 'vscode';
import { DiagnosticLogsPanel } from '../ui/diagnosticLogsPanel';

export class Logger {
    private outputChannel: vscode.OutputChannel;

    constructor(channelName: string) {
        this.outputChannel = vscode.window.createOutputChannel(channelName);
    }

    log(message: string) {
        this.outputChannel.appendLine(message);
        DiagnosticLogsPanel.addLog(message);
    }

    show() {
        this.outputChannel.show();
    }

    dispose() {
        this.outputChannel.dispose();
    }
}
