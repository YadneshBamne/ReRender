import * as vscode from 'vscode';

export class DiagnosticLogsPanel {
    public static currentPanel: DiagnosticLogsPanel | undefined;
    private static logs: string[] = [];
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(context: vscode.ExtensionContext) {
        const column = vscode.ViewColumn.One;

        if (DiagnosticLogsPanel.currentPanel) {
            DiagnosticLogsPanel.currentPanel._panel.reveal(column);
            DiagnosticLogsPanel.currentPanel.update();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'renderGuardianDiagnostics',
            'Render Guardian — Diagnostics',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        DiagnosticLogsPanel.currentPanel = new DiagnosticLogsPanel(panel, context);
    }

    public static addLog(message: string) {
        const timestamp = new Date().toLocaleTimeString();
        DiagnosticLogsPanel.logs.push(`[${timestamp}] ${message}`);

        if (DiagnosticLogsPanel.logs.length > 500) {
            DiagnosticLogsPanel.logs = DiagnosticLogsPanel.logs.slice(-500);
        }

        if (DiagnosticLogsPanel.currentPanel) {
            DiagnosticLogsPanel.currentPanel.update();
        }
    }

    public static clearLogs() {
        DiagnosticLogsPanel.logs = [];
        if (DiagnosticLogsPanel.currentPanel) {
            DiagnosticLogsPanel.currentPanel.update();
        }
    }

    private constructor(panel: vscode.WebviewPanel, private context: vscode.ExtensionContext) {
        this._panel = panel;
        this.update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'clear':
                        DiagnosticLogsPanel.clearLogs();
                        break;
                    case 'copy':
                        vscode.env.clipboard.writeText(DiagnosticLogsPanel.logs.join('\n'));
                        vscode.window.showInformationMessage('Logs copied to clipboard');
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    private update() {
        this._panel.webview.html = this.getHtmlContent();
    }

    private getHtmlContent(): string {
        const logCount   = DiagnosticLogsPanel.logs.length;
        const errorCount = DiagnosticLogsPanel.logs.filter(l =>
            l.includes('ERROR') || l.includes('error') || l.includes('FATAL') || l.includes('exception')
        ).length;
        const successCount = DiagnosticLogsPanel.logs.filter(l =>
            l.includes('SUCCESS') || l.includes('success') || l.includes('activated') || l.includes('complete')
        ).length;

        const formattedLogs = this.formatLogs(DiagnosticLogsPanel.logs);

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Diagnostic Logs</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg-base:      #0d0d0d;
    --bg-header:    #111111;
    --bg-toolbar:   #161616;
    --bg-logs:      #0a0a0a;
    --bg-hover:     #1a1a1a;
    --bg-input:     #1c1c1c;

    --border:       #2a2a2a;
    --border-focus: #505050;

    --text-primary:   #e8e8e8;
    --text-secondary: #888888;
    --text-muted:     #444444;

    --accent-red:    #c85c5c;
    --accent-amber:  #b88a28;
    --accent-green:  #4a9e6b;
    --accent-blue:   #4a7fa0;
    --accent-cyan:   #4a9898;

    --font-sans: 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
    --font-mono: 'IBM Plex Mono', 'Courier New', Consolas, monospace;
  }

  html, body {
    height: 100vh;
    overflow: hidden;
    background: var(--bg-base);
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: 13px;
  }

  /* ── HEADER ──────────────────────────────────── */
  .header {
    background: var(--bg-header);
    border-bottom: 1px solid var(--border);
    padding: 16px 28px;
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .header-title {
    font-family: var(--font-mono);
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: 0.03em;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .title-pip {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-muted);
  }
  .title-pip.live { background: var(--accent-green); box-shadow: 0 0 6px rgba(74,158,107,0.5); }

  .divider-v {
    width: 1px;
    height: 16px;
    background: var(--border);
    flex-shrink: 0;
  }

  .stats {
    display: flex;
    gap: 4px;
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--border);
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 11px;
  }

  .stat-label { color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; }
  .stat-val   { color: var(--text-secondary); font-weight: 500; }
  .stat-val.err  { color: var(--accent-red); }
  .stat-val.ok   { color: var(--accent-green); }

  /* ── TOOLBAR ─────────────────────────────────── */
  .toolbar {
    background: var(--bg-toolbar);
    border-bottom: 1px solid var(--border);
    padding: 10px 28px;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .search-wrapper { position: relative; flex: 1; max-width: 340px; }

  .search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 7px 12px 7px 32px;
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

  .toolbar-divider { width: 1px; height: 20px; background: var(--border); flex-shrink: 0; }

  .filter-group { display: flex; gap: 2px; }

  .filter-btn {
    padding: 5px 11px;
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
  .filter-btn.active { background: #202020; color: var(--text-primary); border-color: var(--border-focus); }

  .action-group { display: flex; gap: 6px; margin-left: auto; }

  .btn {
    padding: 6px 13px;
    border-radius: 3px;
    font-size: 11px;
    font-family: var(--font-mono);
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-ghost {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-secondary);
  }
  .btn-ghost:hover { background: var(--bg-hover); color: var(--text-primary); border-color: var(--border-focus); }

  .btn-danger {
    background: transparent;
    border: 1px solid rgba(200,92,92,0.3);
    color: var(--accent-red);
  }
  .btn-danger:hover { background: rgba(200,92,92,0.08); border-color: var(--accent-red); }

  /* ── LOGS ────────────────────────────────────── */
  .logs-container {
    padding: 12px 0;
    height: calc(100vh - 108px);
    overflow-y: auto;
    background: var(--bg-logs);
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.7;
  }

  .log-line {
    display: flex;
    align-items: baseline;
    padding: 1px 28px 1px 0;
    border-left: 2px solid transparent;
    transition: background 0.1s;
  }
  .log-line:hover { background: rgba(255,255,255,0.02); }

  .line-num {
    flex-shrink: 0;
    width: 50px;
    padding: 0 12px 0 16px;
    text-align: right;
    color: #333;
    font-size: 10px;
    user-select: none;
  }

  .ts {
    flex-shrink: 0;
    color: #3a3a3a;
    font-size: 10px;
    margin-right: 10px;
    white-space: nowrap;
  }

  .badge {
    flex-shrink: 0;
    display: inline-block;
    width: 36px;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-align: center;
    padding: 1px 0;
    border-radius: 2px;
    margin-right: 8px;
    text-transform: uppercase;
  }
  .badge-err  { background: rgba(200,92,92,0.18);  color: var(--accent-red); }
  .badge-warn { background: rgba(184,138,40,0.18); color: var(--accent-amber); }
  .badge-ok   { background: rgba(74,158,107,0.15); color: var(--accent-green); }
  .badge-api  { background: rgba(74,127,160,0.15); color: var(--accent-blue); }
  .badge-info { background: rgba(255,255,255,0.04); color: var(--text-muted); }

  .line-text {
    flex: 1;
    white-space: pre-wrap;
    word-break: break-all;
    color: #909090;
  }

  /* variants */
  .error-line   { border-left-color: var(--accent-red);   background: rgba(200,92,92,0.04); }
  .error-line   .line-text { color: #b07070; }

  .warning-line { border-left-color: var(--accent-amber); background: rgba(184,138,40,0.04); }
  .warning-line .line-text { color: #9e8040; }

  .success-line .line-text { color: var(--accent-green); }

  .api-line .line-text     { color: var(--accent-blue); }
  .activate-line .line-text { color: var(--accent-cyan); }
  .check-line .line-text   { color: #606870; }

  .log-line.highlight {
    background: rgba(255,220,50,0.05) !important;
    border-left-color: #666 !important;
  }
  .log-line.highlight .line-text { color: #c8b860; }

  mark.search-match {
    background: rgba(255,220,50,0.25);
    color: inherit;
    border-radius: 2px;
  }

  /* empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 10px;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }
  .empty-icon {
    width: 36px; height: 36px;
    border: 1px solid var(--border);
    border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 6px;
  }
  .empty-title { font-size: 12px; color: var(--text-secondary); }
  .empty-sub   { font-size: 11px; color: var(--text-muted); }

  /* scrollbar */
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #222; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #333; }

  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .logs-container { animation: fadeIn 0.2s ease-out; }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div class="header-left">
    <div class="header-title">
      <span class="title-pip ${logCount > 0 ? 'live' : ''}"></span>
      Render Guardian — Diagnostics
    </div>
    <div class="divider-v"></div>
    <div class="stats">
      <div class="stat">
        <span class="stat-label">Total</span>
        <span class="stat-val" id="statTotal">${logCount}</span>
      </div>
      <div class="stat">
        <span class="stat-label">OK</span>
        <span class="stat-val ok" id="statOk">${successCount}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Err</span>
        <span class="stat-val ${errorCount > 0 ? 'err' : ''}" id="statErr">${errorCount}</span>
      </div>
    </div>
  </div>
</div>

<!-- TOOLBAR -->
<div class="toolbar">
  <div class="search-wrapper">
    <svg class="search-icon" width="12" height="12" viewBox="0 0 16 16" fill="none">
      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.5"/>
      <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <input class="search-input" type="text" id="searchInput" placeholder="Search logs..." oninput="searchLogs(this.value)" />
  </div>

  <div class="toolbar-divider"></div>

  <div class="filter-group">
    <button class="filter-btn active" onclick="filterLogs('all', this)">All</button>
    <button class="filter-btn" onclick="filterLogs('errors', this)">Errors</button>
    <button class="filter-btn" onclick="filterLogs('warnings', this)">Warnings</button>
    <button class="filter-btn" onclick="filterLogs('success', this)">Success</button>
    <button class="filter-btn" onclick="filterLogs('api', this)">API</button>
  </div>

  <div class="action-group">
    <button class="btn btn-ghost" onclick="copyLogs()">Copy all</button>
    <button class="btn btn-danger" onclick="clearLogs()">Clear</button>
  </div>
</div>

<!-- LOGS -->
<div class="logs-container" id="logsContainer">
  ${formattedLogs}
</div>

<script>
  const vscode = acquireVsCodeApi();
  let currentFilter = 'all';
  let currentSearch = '';

  function searchLogs(query) {
    currentSearch = query.toLowerCase().trim();
    applyFilters();
  }

  function filterLogs(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    applyFilters();
  }

  function applyFilters() {
    const lines = document.querySelectorAll('.log-line');
    lines.forEach(line => {
      // restore original text before re-applying highlight
      const textEl = line.querySelector('.line-text');
      if (textEl && textEl.dataset.original) {
        textEl.innerHTML = textEl.dataset.original;
      }

      const text = line.textContent.toLowerCase();
      let show = true;

      if (currentFilter === 'errors' && !line.classList.contains('error-line') && !line.classList.contains('warning-line')) show = false;
      else if (currentFilter === 'warnings' && !line.classList.contains('warning-line')) show = false;
      else if (currentFilter === 'success' && !line.classList.contains('success-line')) show = false;
      else if (currentFilter === 'api' && !line.classList.contains('api-line')) show = false;

      if (currentSearch && !text.includes(currentSearch)) show = false;

      line.style.display = show ? '' : 'none';

      if (show && currentSearch && textEl) {
        if (!textEl.dataset.original) textEl.dataset.original = textEl.innerHTML;
        const escaped = currentSearch.replace(/[.*+?^$()|[\]\\\\]/g, '\\\\$&');
        textEl.innerHTML = textEl.innerHTML.replace(
          new RegExp(\`(\${escaped})\`, 'gi'),
          '<mark class="search-match">$1</mark>'
        );
        line.classList.add('highlight');
      } else {
        line.classList.remove('highlight');
      }
    });
  }

  function copyLogs() {
    vscode.postMessage({ command: 'copy' });
  }

  function clearLogs() {
    if (confirm('Clear all diagnostic logs?')) {
      vscode.postMessage({ command: 'clear' });
    }
  }

  // auto-scroll to bottom on load
  const container = document.getElementById('logsContainer');
  container.scrollTop = container.scrollHeight;
</script>
</body>
</html>`;
    }

    private formatLogs(logs: string[]): string {
        if (!logs.length) {
            return `<div class="empty-state">
                <div class="empty-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                </div>
                <div class="empty-title">No diagnostic logs yet</div>
                <div class="empty-sub">Extension monitoring output will appear here</div>
              </div>`;
        }

        return logs.map((line, index) => {
            let className = 'log-line info-line';
            let badge = '<span class="badge badge-info">INF</span>';

            const lower = line.toLowerCase();

            if (lower.includes('error') || lower.includes('exception') || lower.includes('fatal')) {
                className = 'log-line error-line';
                badge = '<span class="badge badge-err">ERR</span>';
            } else if (lower.includes('warn')) {
                className = 'log-line warning-line';
                badge = '<span class="badge badge-warn">WRN</span>';
            } else if (lower.includes('success') || lower.includes('activated') || lower.includes('complete')) {
                className = 'log-line success-line';
                badge = '<span class="badge badge-ok">OK</span>';
            } else if (lower.includes('api') || lower.includes('fetching') || lower.includes('request')) {
                className = 'log-line api-line';
                badge = '<span class="badge badge-api">API</span>';
            } else if (lower.includes('checking') || lower.includes('verifying')) {
                className = 'log-line check-line';
            }

            // parse [HH:MM:SS] prefix
            const parts = line.match(/^\[([^\]]+)\] (.+)$/s);
            const ts = parts ? `<span class="ts">[${this.escapeHtml(parts[1])}]</span>` : '';
            const msg = parts ? this.escapeHtml(parts[2]) : this.escapeHtml(line);

            const lineNum = `<span class="line-num">${String(index + 1).padStart(3, ' ')}</span>`;

            return `<div class="${className}">${lineNum}${ts}${badge}<span class="line-text">${msg}</span></div>`;
        }).join('');
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    public dispose() {
        DiagnosticLogsPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}