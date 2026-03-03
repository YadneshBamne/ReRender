import * as vscode from 'vscode';
import { RenderService, RenderDeploy } from '../api/renderClient';
import { RenderClient } from '../api/renderClient';

export interface ServicePanelData {
    service: RenderService;
    latestDeploy?: RenderDeploy;
    status: 'healthy' | 'deploying' | 'failed' | 'unknown';
    recentDeploys?: RenderDeploy[];
}

export class ServiceDetailsPanel {
    private static currentPanel: ServiceDetailsPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];

    private constructor(
        panel: vscode.WebviewPanel,
        private data: ServicePanelData,
        private renderClient: RenderClient
    ) {
        this.panel = panel;
        this.update();

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'refresh':
                        this.refreshData();
                        break;
                }
            },
            null,
            this.disposables
        );
    }

    public static async createOrShow(
        extensionUri: vscode.Uri,
        data: ServicePanelData,
        renderClient: RenderClient
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (ServiceDetailsPanel.currentPanel) {
            ServiceDetailsPanel.currentPanel.panel.reveal(column);
            ServiceDetailsPanel.currentPanel.data = data;
            ServiceDetailsPanel.currentPanel.update();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'renderServiceDetails',
            data.service.name,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        ServiceDetailsPanel.currentPanel = new ServiceDetailsPanel(panel, data, renderClient);
    }

    private async refreshData() {
        try {
            const deploys = await this.renderClient.getServiceDeploys(this.data.service.id, 10);
            this.data.recentDeploys = deploys;
            this.data.latestDeploy = deploys[0];
            this.update();
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to refresh: ${error.message}`);
        }
    }

    private update() {
        this.panel.title = `${this.data.service.name} — ${this.data.status}`;
        this.panel.webview.html = this.getHtmlContent();
    }

    private getHtmlContent(): string {
        const { service, latestDeploy, status, recentDeploys } = this.data;
        const statusColor = this.getStatusColor(status);
        const successCount = recentDeploys?.filter(d => this.getDeployStatus(d.status) === 'success').length ?? 0;
        const failCount    = recentDeploys?.filter(d => this.getDeployStatus(d.status) === 'failed').length ?? 0;

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Service Details</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg-base:      #0d0d0d;
    --bg-header:    #111111;
    --bg-section:   #111111;
    --bg-inset:     #0a0a0a;
    --bg-input:     #161616;
    --bg-hover:     #1a1a1a;
    --border:       #2a2a2a;
    --border-focus: #505050;
    --text-primary:   #e8e8e8;
    --text-secondary: #888888;
    --text-muted:     #444444;
    --accent-red:    #c85c5c;
    --accent-amber:  #b88a28;
    --accent-green:  #4a9e6b;
    --accent-blue:   #4a7fa0;
    --font-sans: 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
    --font-mono: 'IBM Plex Mono', 'Courier New', Consolas, monospace;
  }

  html, body {
    background: var(--bg-base);
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: 13px;
    line-height: 1.6;
  }

  /* ── HEADER ──────────────────────────────────── */
  .header {
    background: var(--bg-header);
    border-bottom: 1px solid var(--border);
    padding: 24px 32px;
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }

  .header-left { display: flex; flex-direction: column; gap: 6px; }

  .header-title {
    font-family: var(--font-mono);
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: 0.02em;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .status-pip {
    width: 8px; height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .header-meta {
    display: flex;
    align-items: center;
    gap: 16px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
  }

  .meta-sep { color: var(--border); }

  .status-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    border: 1px solid;
  }

  /* deploying pulse */
  @keyframes pip-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }
  .pip-deploying { animation: pip-pulse 1.8s ease-in-out infinite; }

  /* ── CONTENT ─────────────────────────────────── */
  .content {
    max-width: 1100px;
    margin: 0 auto;
    padding: 28px 32px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* ── STATS ROW ───────────────────────────────── */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }

  .stat-card {
    background: var(--bg-section);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    animation: fadeUp 0.25s ease-out both;
  }
  .stat-card:nth-child(1) { animation-delay: 0.03s; }
  .stat-card:nth-child(2) { animation-delay: 0.06s; }
  .stat-card:nth-child(3) { animation-delay: 0.09s; }
  .stat-card:nth-child(4) { animation-delay: 0.12s; }

  .stat-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .stat-value {
    font-family: var(--font-mono);
    font-size: 22px;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1;
  }

  .stat-sub {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
  }

  /* ── SECTION ─────────────────────────────────── */
  .section {
    background: var(--bg-section);
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
    animation: fadeUp 0.25s ease-out both;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid var(--border);
    background: rgba(255,255,255,0.02);
  }

  .section-label {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-secondary);
  }

  .section-body { padding: 20px; }

  /* ── INFO GRID ───────────────────────────────── */
  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }

  .info-item {
    padding: 12px 14px;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 3px;
    border-left: 2px solid var(--border-focus);
  }

  .info-item.span-2 { grid-column: span 2; }

  .info-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 5px;
  }

  .info-value {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--text-primary);
    word-break: break-word;
  }

  .info-value a {
    color: var(--accent-blue);
    text-decoration: none;
  }
  .info-value a:hover { text-decoration: underline; }

  /* ── DEPLOY TIMELINE ─────────────────────────── */
  .deploy-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .deploy-item {
    display: flex;
    align-items: stretch;
    gap: 0;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 3px;
    overflow: hidden;
    transition: border-color 0.15s;
  }
  .deploy-item:hover { border-color: var(--border-focus); }

  .deploy-accent {
    width: 3px;
    flex-shrink: 0;
  }
  .deploy-accent.success  { background: var(--accent-green); }
  .deploy-accent.deploying { background: var(--accent-amber); }
  .deploy-accent.failed   { background: var(--accent-red); }

  .deploy-body {
    flex: 1;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .deploy-left { display: flex; flex-direction: column; gap: 4px; }

  .deploy-status-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .deploy-badge {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 2px 7px;
    border-radius: 2px;
    border: 1px solid;
  }
  .deploy-badge.success  { color: var(--accent-green); border-color: rgba(74,158,107,0.35);  background: rgba(74,158,107,0.08); }
  .deploy-badge.deploying { color: var(--accent-amber); border-color: rgba(184,138,40,0.35); background: rgba(184,138,40,0.08); }
  .deploy-badge.failed   { color: var(--accent-red);   border-color: rgba(200,92,92,0.35);   background: rgba(200,92,92,0.08); }

  .deploy-id {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
  }

  .deploy-commit {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-secondary);
    font-style: italic;
    margin-top: 2px;
  }

  .deploy-time {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* ── BUTTONS ─────────────────────────────────── */
  .btn {
    padding: 9px 18px;
    border-radius: 3px;
    font-size: 11px;
    font-family: var(--font-mono);
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    cursor: pointer;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all 0.15s;
    border: 1px solid;
  }

  .btn-solid {
    background: #202020;
    color: var(--text-primary);
    border-color: #3a3a3a;
  }
  .btn-solid:hover { background: #282828; border-color: var(--border-focus); }

  .btn-ghost {
    background: transparent;
    color: var(--text-secondary);
    border-color: var(--border);
  }
  .btn-ghost:hover { background: var(--bg-hover); color: var(--text-primary); border-color: var(--border-focus); }

  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border-radius: 3px;
    background: transparent;
    border-color: var(--border);
    color: var(--text-secondary);
  }
  .btn-icon:hover { background: var(--bg-hover); border-color: var(--border-focus); color: var(--text-primary); }

  .action-row { display: flex; gap: 10px; flex-wrap: wrap; }

  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #222; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #333; }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div class="header-left">
    <div class="header-title">
      <span class="status-pip ${status === 'deploying' ? 'pip-deploying' : ''}"
            style="background:${statusColor};box-shadow:0 0 6px ${statusColor}44"></span>
      ${this.escapeHtml(service.name)}
    </div>
    <div class="header-meta">
      <span>${this.escapeHtml(service.type || 'Service')}</span>
      ${service.branch ? `<span class="meta-sep">|</span><span>${this.escapeHtml(service.branch)}</span>` : ''}
      ${latestDeploy ? `<span class="meta-sep">|</span><span>Last deploy ${this.getTimeAgo(latestDeploy.createdAt)}</span>` : ''}
    </div>
  </div>
  <div class="status-tag" style="color:${statusColor};border-color:${statusColor}44;background:${statusColor}0d">
    <span class="status-pip ${status === 'deploying' ? 'pip-deploying' : ''}"
          style="background:${statusColor};width:5px;height:5px"></span>
    ${status.toUpperCase()}
  </div>
</div>

<div class="content">

  <!-- STATS -->
  <div class="stats-row">
    <div class="stat-card">
      <div class="stat-label">Status</div>
      <div class="stat-value" style="font-size:14px;color:${statusColor}">${status}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Deploys</div>
      <div class="stat-value">${recentDeploys?.length ?? 0}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Successful</div>
      <div class="stat-value" style="color:var(--accent-green)">${successCount}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Failed</div>
      <div class="stat-value" style="color:${failCount > 0 ? 'var(--accent-red)' : 'var(--text-muted)'}">${failCount}</div>
    </div>
  </div>

  <!-- SERVICE INFO -->
  <div class="section">
    <div class="section-header">
      <span class="section-label">Service Information</span>
    </div>
    <div class="section-body">
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Service ID</div>
          <div class="info-value">${this.escapeHtml(service.id)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Type</div>
          <div class="info-value">${this.escapeHtml(service.type || 'N/A')}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Branch</div>
          <div class="info-value">${this.escapeHtml(service.branch || 'N/A')}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Created</div>
          <div class="info-value">${service.createdAt ? new Date(service.createdAt).toLocaleDateString() : 'N/A'}</div>
        </div>
        ${service.serviceDetails?.url ? `
        <div class="info-item span-2">
          <div class="info-label">Service URL</div>
          <div class="info-value">
            <a href="${this.escapeHtml(service.serviceDetails.url)}">${this.escapeHtml(service.serviceDetails.url)}</a>
          </div>
        </div>
        ` : ''}
      </div>
    </div>
  </div>

  <!-- RECENT DEPLOYS -->
  ${recentDeploys && recentDeploys.length > 0 ? `
  <div class="section">
    <div class="section-header">
      <span class="section-label">Recent Deploys</span>
      <button class="btn btn-icon" onclick="refreshData()" title="Refresh">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M13.5 2.5A7 7 0 1 0 14.5 8"/>
          <polyline points="14.5 2.5 14.5 6.5 10.5 6.5"/>
        </svg>
      </button>
    </div>
    <div class="section-body">
      <div class="deploy-list">
        ${recentDeploys.map(d => this.renderDeployItem(d)).join('')}
      </div>
    </div>
  </div>
  ` : ''}

  <!-- ACTIONS -->
  <div class="action-row">
    <a href="https://dashboard.render.com/web/${this.escapeHtml(service.id)}" class="btn btn-solid">
      Open in Render Dashboard
    </a>
    ${latestDeploy ? `
    <a href="https://dashboard.render.com/web/${this.escapeHtml(service.id)}/deploys/${this.escapeHtml(latestDeploy.id)}" class="btn btn-ghost">
      View Latest Deploy
    </a>
    ` : ''}
  </div>

</div>

<script>
  const vscode = acquireVsCodeApi();
  function refreshData() {
    vscode.postMessage({ command: 'refresh' });
  }
</script>
</body>
</html>`;
    }

    private renderDeployItem(deploy: RenderDeploy): string {
        const statusClass = this.getDeployStatus(deploy.status);
        const statusLabel = deploy.status.replace(/_/g, ' ').toUpperCase();
        const time = new Date(deploy.createdAt).toLocaleString();
        const shortId = deploy.id.substring(0, 8);

        return `
        <div class="deploy-item">
          <div class="deploy-accent ${statusClass}"></div>
          <div class="deploy-body">
            <div class="deploy-left">
              <div class="deploy-status-row">
                <span class="deploy-badge ${statusClass}">${statusLabel}</span>
                <span class="deploy-id">#${shortId}</span>
              </div>
              ${deploy.commit?.message ? `
              <div class="deploy-commit">${this.escapeHtml(deploy.commit.message)}</div>
              ` : ''}
            </div>
            <div class="deploy-time">${time}</div>
          </div>
        </div>`;
    }

    private getDeployStatus(status: string): string {
        const s = status.toLowerCase();
        if (s === 'live' || s === 'available') { return 'success'; }
        if (s.includes('fail') || s === 'crashed' || s === 'error') { return 'failed'; }
        return 'deploying';
    }

    private getStatusColor(status: string): string {
        switch (status) {
            case 'healthy':   return '#4a9e6b';
            case 'deploying': return '#b88a28';
            case 'failed':    return '#c85c5c';
            default:          return '#505050';
        }
    }

    private getTimeAgo(dateString: string): string {
        const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
        if (seconds < 60)    { return 'just now'; }
        if (seconds < 3600)  { return `${Math.floor(seconds / 60)}m ago`; }
        if (seconds < 86400) { return `${Math.floor(seconds / 3600)}h ago`; }
        return `${Math.floor(seconds / 86400)}d ago`;
    }

    private escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    public dispose() {
        ServiceDetailsPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}