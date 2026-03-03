import * as vscode from 'vscode';

export interface LogViewerData {
    serviceName: string;
    deployId?: string;
    logs: string;
    status?: string;
    timestamp?: string;
}

export class LogViewerPanel {
    private static currentPanel: LogViewerPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, private data: LogViewerData) {
        this.panel = panel;
        this.update();
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.panel.webview.onDidReceiveMessage(
            message => {
                if (message.command === 'copyLogs') {
                    vscode.env.clipboard.writeText(this.data.logs);
                    vscode.window.showInformationMessage('Logs copied to clipboard');
                }
            },
            null,
            this.disposables
        );
    }

    public static createOrShow(extensionUri: vscode.Uri, data: LogViewerData) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (LogViewerPanel.currentPanel) {
            LogViewerPanel.currentPanel.panel.reveal(column);
            LogViewerPanel.currentPanel.data = data;
            LogViewerPanel.currentPanel.update();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'renderLogViewer',
            `${data.serviceName} — Logs`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        LogViewerPanel.currentPanel = new LogViewerPanel(panel, data);
    }

    private update() {
        this.panel.title = `${this.data.serviceName} — Deploy Logs`;
        this.panel.webview.html = this.getHtmlContent();
    }

    private getHtmlContent(): string {
        const { serviceName, deployId, logs, status, timestamp } = this.data;
        const logLines = logs.split('\n');

        const highlightedLogs = logLines.map((line, index) => {
            const lineLower = line.toLowerCase();
            let className = 'log-line';
            let badge = '';

            if (lineLower.includes('error') || lineLower.includes('exception') || lineLower.includes('fatal')) {
                className += ' error-line';
                badge = '<span class="badge badge-error">ERR</span>';
            } else if (lineLower.includes('warn')) {
                className += ' warning-line';
                badge = '<span class="badge badge-warn">WRN</span>';
            } else if (lineLower.includes('success') || lineLower.includes('complete') || lineLower.includes('done')) {
                className += ' success-line';
                badge = '<span class="badge badge-ok">OK</span>';
            } else if (line.trim().startsWith('at ') || line.includes('node_modules')) {
                className += ' stack-trace-line';
            } else if (line.startsWith('==>') || line.startsWith('###')) {
                className += ' section-line';
            }

            const lineNum = `<span class="line-num">${String(index + 1).padStart(4, ' ')}</span>`;
            return `<div class="${className}">${lineNum}${badge}<span class="line-text">${this.escapeHtml(line)}</span></div>`;
        }).join('');

        const errorCount = logLines.filter(l => l.toLowerCase().includes('error')).length;
        const warnCount = logLines.filter(l => l.toLowerCase().includes('warn')).length;
        const statusClass = status === 'live' ? 'status-live' : status === 'failed' ? 'status-failed' : 'status-neutral';

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Deploy Logs</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg-base:       #0d0d0d;
    --bg-header:     #111111;
    --bg-toolbar:    #161616;
    --bg-logs:       #0a0a0a;
    --bg-hover:      #1a1a1a;
    --bg-input:      #1c1c1c;

    --border:        #2a2a2a;
    --border-focus:  #505050;

    --text-primary:  #e8e8e8;
    --text-secondary:#888888;
    --text-muted:    #505050;
    --text-mono:     #c8c8c8;

    --accent-red:    #e05252;
    --accent-amber:  #c8901a;
    --accent-green:  #4a9e6b;
    --accent-blue:   #4a7fa0;
    --accent-purple: #7a6ea0;

    --line-num-color: #383838;

    --font-sans: 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
    --font-mono: 'IBM Plex Mono', 'Courier New', Consolas, monospace;
  }

  html, body {
    height: 100%;
    background: var(--bg-base);
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: 13px;
    line-height: 1.5;
    overflow-x: hidden;
  }

  /* ── HEADER ─────────────────────────────────────────── */
  .header {
    background: var(--bg-header);
    border-bottom: 1px solid var(--border);
    padding: 18px 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header-left { flex: 1; }

  .service-name {
    font-family: var(--font-mono);
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: 0.02em;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }

  .service-icon {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-muted);
    flex-shrink: 0;
  }

  .meta-row {
    display: flex;
    align-items: center;
    gap: 18px;
    font-size: 11px;
    color: var(--text-secondary);
    font-family: var(--font-mono);
    font-weight: 300;
  }

  .meta-item { display: flex; align-items: center; gap: 5px; }
  .meta-label { color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 8px;
    border-radius: 2px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-family: var(--font-mono);
  }
  .status-dot { width: 5px; height: 5px; border-radius: 50%; }
  .status-live  { background: rgba(74,158,107,0.15); color: var(--accent-green); border: 1px solid rgba(74,158,107,0.3); }
  .status-live .status-dot  { background: var(--accent-green); }
  .status-failed { background: rgba(224,82,82,0.12); color: var(--accent-red); border: 1px solid rgba(224,82,82,0.3); }
  .status-failed .status-dot { background: var(--accent-red); }
  .status-neutral { background: rgba(255,255,255,0.05); color: var(--text-secondary); border: 1px solid var(--border); }
  .status-neutral .status-dot { background: var(--text-muted); }

  .header-actions { display: flex; gap: 8px; }

  /* ── BUTTONS ─────────────────────────────────────────── */
  .btn {
    padding: 7px 14px;
    border: 1px solid var(--border);
    border-radius: 3px;
    font-size: 11px;
    font-weight: 500;
    font-family: var(--font-mono);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .btn-ghost {
    background: transparent;
    color: var(--text-secondary);
  }
  .btn-ghost:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--border-focus);
  }
  .btn-solid {
    background: #242424;
    color: var(--text-primary);
    border-color: #3a3a3a;
  }
  .btn-solid:hover {
    background: #2e2e2e;
    border-color: var(--border-focus);
  }

  /* ── TOOLBAR ─────────────────────────────────────────── */
  .toolbar {
    background: var(--bg-toolbar);
    border-bottom: 1px solid var(--border);
    padding: 12px 28px;
    display: flex;
    gap: 16px;
    align-items: center;
    position: sticky;
    top: 73px;
    z-index: 99;
  }

  .search-wrapper {
    flex: 1;
    max-width: 380px;
    position: relative;
  }

  .search-icon-svg {
    position: absolute;
    left: 11px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 7px 12px 7px 34px;
    background: var(--bg-input);
    border: 1px solid var(--border);
    color: var(--text-primary);
    border-radius: 3px;
    font-size: 12px;
    font-family: var(--font-mono);
    transition: border-color 0.15s;
  }
  .search-input::placeholder { color: var(--text-muted); }
  .search-input:focus { outline: none; border-color: var(--border-focus); }

  .filter-group { display: flex; gap: 2px; }
  .filter-btn {
    padding: 6px 12px;
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-muted);
    border-radius: 3px;
    font-size: 11px;
    font-family: var(--font-mono);
    font-weight: 500;
    cursor: pointer;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    transition: all 0.15s;
  }
  .filter-btn:hover { color: var(--text-secondary); border-color: var(--border); }
  .filter-btn.active { background: #222; color: var(--text-primary); border-color: var(--border-focus); }

  .toolbar-divider {
    width: 1px;
    height: 20px;
    background: var(--border);
    flex-shrink: 0;
  }

  .stats-row { display: flex; gap: 16px; margin-left: auto; }
  .stat {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--text-muted);
  }
  .stat-count { color: var(--text-secondary); font-weight: 500; }
  .stat-count.has-errors { color: var(--accent-red); }
  .stat-count.has-warnings { color: var(--accent-amber); }

  /* ── LOG CONTAINER ───────────────────────────────────── */
  .logs-container {
    padding: 16px 0;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.7;
    background: var(--bg-logs);
    min-height: calc(100vh - 160px);
  }

  .log-line {
    display: flex;
    align-items: baseline;
    gap: 0;
    padding: 1px 28px 1px 0;
    border-left: 2px solid transparent;
    transition: background 0.1s;
  }
  .log-line:hover { background: rgba(255,255,255,0.025); }

  .line-num {
    flex-shrink: 0;
    width: 54px;
    padding: 0 14px 0 18px;
    color: var(--line-num-color);
    text-align: right;
    user-select: none;
    font-size: 11px;
  }

  .badge {
    flex-shrink: 0;
    display: inline-block;
    width: 34px;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-align: center;
    padding: 1px 0;
    border-radius: 2px;
    margin-right: 8px;
    vertical-align: baseline;
  }
  .badge-error { background: rgba(224,82,82,0.18); color: var(--accent-red); }
  .badge-warn  { background: rgba(200,144,26,0.18); color: var(--accent-amber); }
  .badge-ok    { background: rgba(74,158,107,0.14); color: var(--accent-green); }

  .line-text {
    flex: 1;
    white-space: pre-wrap;
    word-break: break-all;
    color: #b0b0b0;
  }

  /* log line variants */
  .error-line {
    border-left-color: var(--accent-red);
    background: rgba(224,82,82,0.04);
  }
  .error-line .line-text { color: #cc8080; }

  .warning-line {
    border-left-color: var(--accent-amber);
    background: rgba(200,144,26,0.04);
  }
  .warning-line .line-text { color: #b89050; }

  .success-line .line-text { color: var(--accent-green); }

  .stack-trace-line .line-text {
    color: #505868;
    font-size: 11px;
  }

  .section-line {
    border-left-color: #3a3a3a;
    background: rgba(255,255,255,0.02);
    margin: 6px 0;
  }
  .section-line .line-text {
    color: var(--text-secondary);
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .log-line.highlight {
    background: rgba(255,220,50,0.06) !important;
    border-left-color: #888 !important;
  }
  .log-line.highlight .line-text {
    color: #d4c87a;
  }

  /* ── EMPTY STATE ─────────────────────────────────────── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 40px;
    color: var(--text-muted);
    min-height: calc(100vh - 160px);
    gap: 12px;
  }
  .empty-icon {
    width: 40px;
    height: 40px;
    border: 1px solid var(--border);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }
  .empty-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    font-family: var(--font-mono);
  }
  .empty-sub {
    font-size: 12px;
    color: var(--text-muted);
    text-align: center;
    max-width: 320px;
    line-height: 1.6;
  }

  /* ── ANIMATIONS ──────────────────────────────────────── */
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .logs-container { animation: fadeIn 0.2s ease-out; }

  /* ── SCROLLBAR ───────────────────────────────────────── */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #3a3a3a; }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div class="header-left">
    <div class="service-name">
      <span class="service-icon"></span>
      ${this.escapeHtml(serviceName)}
      ${status ? `<span class="status-badge ${statusClass}"><span class="status-dot"></span>${this.escapeHtml(status)}</span>` : ''}
    </div>
    <div class="meta-row">
      ${deployId ? `<span class="meta-item"><span class="meta-label">Deploy</span><span>${this.escapeHtml(deployId)}</span></span>` : ''}
      ${timestamp ? `<span class="meta-item"><span class="meta-label">Time</span><span>${new Date(timestamp).toLocaleString()}</span></span>` : ''}
    </div>
  </div>
  <div class="header-actions">
    <button class="btn btn-ghost" onclick="scrollToBottom()">Jump to end</button>
    <button class="btn btn-solid" onclick="copyLogs()">Copy all</button>
  </div>
</div>

<!-- TOOLBAR -->
<div class="toolbar">
  <div class="search-wrapper">
    <svg class="search-icon-svg" width="13" height="13" viewBox="0 0 16 16" fill="none">
      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.5"/>
      <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <input class="search-input" type="text" id="searchInput" placeholder="Search logs..." oninput="searchLogs()" />
  </div>

  <div class="toolbar-divider"></div>

  <div class="filter-group">
    <button class="filter-btn active" onclick="filterLogs('all', this)">All</button>
    <button class="filter-btn" onclick="filterLogs('errors', this)">Errors</button>
    <button class="filter-btn" onclick="filterLogs('warnings', this)">Warnings</button>
    <button class="filter-btn" onclick="filterLogs('success', this)">Success</button>
  </div>

  <div class="stats-row">
    <span class="stat">
      <span class="stat-count" id="totalLines">${logLines.length}</span>
      <span>lines</span>
    </span>
    <span class="stat">
      <span class="stat-count ${errorCount > 0 ? 'has-errors' : ''}" id="errorCount">${errorCount}</span>
      <span>errors</span>
    </span>
    <span class="stat">
      <span class="stat-count ${warnCount > 0 ? 'has-warnings' : ''}" id="warnCount">${warnCount}</span>
      <span>warnings</span>
    </span>
  </div>
</div>

<!-- LOGS -->
${logs.trim().length > 0
    ? `<div class="logs-container" id="logsContainer">${highlightedLogs}</div>`
    : `<div class="empty-state">
        <div class="empty-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 12h6m-3-3v6M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>
          </svg>
        </div>
        <div class="empty-title">No logs available</div>
        <div class="empty-sub">Logs may not be accessible via API. Check Render Dashboard for full log output.</div>
       </div>`
}

<script>
  const vscode = acquireVsCodeApi();

  function copyLogs() {
    vscode.postMessage({ command: 'copyLogs' });
  }

  function scrollToBottom() {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  function searchLogs() {
    const term = document.getElementById('searchInput').value.toLowerCase();
    const lines = document.querySelectorAll('.log-line');
    let visible = 0;
    lines.forEach(line => {
      const text = line.textContent.toLowerCase();
      const match = !term || text.includes(term);
      line.style.display = match ? '' : 'none';
      if (match) {
        visible++;
        line.classList.toggle('highlight', !!term && text.includes(term));
      } else {
        line.classList.remove('highlight');
      }
    });
    document.getElementById('totalLines').textContent = visible;
  }

  function filterLogs(filter, btn) {
    const lines = document.querySelectorAll('.log-line');
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    let visible = 0;
    lines.forEach(line => {
      let show = false;
      switch (filter) {
        case 'all':      show = true; break;
        case 'errors':   show = line.classList.contains('error-line'); break;
        case 'warnings': show = line.classList.contains('warning-line'); break;
        case 'success':  show = line.classList.contains('success-line'); break;
      }
      line.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    document.getElementById('totalLines').textContent = visible;
  }

  window.addEventListener('load', () => {
    const firstError = document.querySelector('.error-line');
    if (firstError) {
      setTimeout(() => firstError.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
    }
  });
</script>
</body>
</html>`;
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
        LogViewerPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}