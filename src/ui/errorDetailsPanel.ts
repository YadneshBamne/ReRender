import * as vscode from 'vscode';
import { RenderService, RenderDeploy } from '../api/renderClient';

export interface ErrorPanelData {
    service: RenderService;
    deploy: RenderDeploy;
    aiSummary?: string;
    errorLogs?: string;
}

export class ErrorDetailsPanel {
    private static currentPanel: ErrorDetailsPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, private data: ErrorPanelData) {
        this.panel = panel;
        this.update();
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    public static createOrShow(extensionUri: vscode.Uri, data: ErrorPanelData) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (ErrorDetailsPanel.currentPanel) {
            ErrorDetailsPanel.currentPanel.panel.reveal(column);
            ErrorDetailsPanel.currentPanel.data = data;
            ErrorDetailsPanel.currentPanel.update();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'renderErrorDetails',
            'Deploy Failure Details',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        ErrorDetailsPanel.currentPanel = new ErrorDetailsPanel(panel, data);
    }

    private update() {
        this.panel.title = `${this.data.service.name} — Deploy Failed`;
        this.panel.webview.html = this.getHtmlContent();
    }

    private getHtmlContent(): string {
        const { service, deploy, aiSummary, errorLogs } = this.data;

        const statusColor = this.getStatusColor(deploy.status);
        const statusLabel = deploy.status.toUpperCase().replace(/_/g, ' ');
        const formattedTime = deploy.finishedAt
            ? new Date(deploy.finishedAt).toLocaleString()
            : new Date(deploy.updatedAt).toLocaleString();

        const shortId = deploy.id.substring(0, 8);

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Deploy Failure Details</title>
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
  .status-pip { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
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

  /* ── LAYOUT ──────────────────────────────────── */
  .content {
    max-width: 1100px;
    margin: 0 auto;
    padding: 28px 32px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* ── SECTION ─────────────────────────────────── */
  .section {
    background: var(--bg-section);
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
    animation: fadeUp 0.25s ease-out both;
  }
  .section:nth-child(2) { animation-delay: 0.06s; }
  .section:nth-child(3) { animation-delay: 0.10s; }
  .section:nth-child(4) { animation-delay: 0.14s; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
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

  /* ── COMMIT ──────────────────────────────────── */
  .commit-block {
    margin-top: 16px;
    padding: 12px 16px;
    background: var(--bg-inset);
    border: 1px solid var(--border);
    border-left: 2px solid var(--accent-blue);
    border-radius: 3px;
  }
  .commit-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 5px;
  }
  .commit-message {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-secondary);
    font-style: italic;
  }

  /* ── AI SECTION ──────────────────────────────── */
  .ai-section {
    background: var(--bg-section);
    border: 1px solid var(--border);
    border-left: 2px solid var(--accent-blue);
    border-radius: 4px;
    overflow: hidden;
    animation: fadeUp 0.25s ease-out both;
    animation-delay: 0.02s;
  }
  .ai-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 20px;
    border-bottom: 1px solid var(--border);
    background: rgba(74,127,160,0.05);
  }
  .ai-label {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent-blue);
  }
  .ai-provider {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-muted);
    padding: 2px 8px;
    border: 1px solid var(--border);
    border-radius: 2px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .severity-badge {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 3px 10px;
    border-radius: 3px;
    border: 1px solid;
    display: none; /* shown by JS once severity is known */
  }
  .severity-critical { display:inline-block; color:#c85c5c; border-color:rgba(200,92,92,0.35);  background:rgba(200,92,92,0.08); }
  .severity-high     { display:inline-block; color:#c87840; border-color:rgba(200,120,64,0.35); background:rgba(200,120,64,0.08); }
  .severity-medium   { display:inline-block; color:#b88a28; border-color:rgba(184,138,40,0.35); background:rgba(184,138,40,0.08); }
  .severity-low      { display:inline-block; color:#4a9e6b; border-color:rgba(74,158,107,0.35); background:rgba(74,158,107,0.08); }

  .ai-body { padding: 20px; }

  /* ── MARKDOWN ────────────────────────────────── */
  .md h1, .md h2, .md h3, .md h4 {
    font-family: var(--font-sans);
    font-weight: 600;
    color: var(--text-primary);
    margin: 20px 0 8px;
    line-height: 1.3;
  }
  .md > *:first-child { margin-top: 0 !important; }
  .md h1 { font-size: 16px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
  .md h2 { font-size: 14px; }
  .md h3 { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.08em; }
  .md h4 { font-size: 12px; color: var(--text-muted); }

  .md p { color: var(--text-secondary); font-size: 13px; line-height: 1.8; margin: 8px 0; }

  .md strong { color: var(--text-primary); font-weight: 600; }
  .md em     { color: var(--text-secondary); font-style: italic; }

  .md ul, .md ol { margin: 8px 0; padding-left: 0; list-style: none; }
  .md li {
    position: relative;
    padding: 3px 0 3px 20px;
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.7;
  }
  .md ul > li::before {
    content: '—';
    position: absolute;
    left: 0;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }
  .md ol { counter-reset: list-counter; }
  .md ol > li { counter-increment: list-counter; }
  .md ol > li::before {
    content: counter(list-counter) '.';
    position: absolute;
    left: 0;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 11px;
  }

  .md code {
    font-family: var(--font-mono);
    font-size: 11px;
    background: var(--bg-inset);
    border: 1px solid var(--border);
    padding: 1px 6px;
    border-radius: 2px;
    color: #9cdcfe;
  }

  .md pre {
    background: var(--bg-inset);
    border: 1px solid var(--border);
    border-left: 2px solid var(--border-focus);
    border-radius: 3px;
    padding: 14px 16px;
    margin: 12px 0;
    overflow-x: auto;
  }
  .md pre code {
    background: none;
    border: none;
    padding: 0;
    font-size: 12px;
    color: #c8c8c8;
    line-height: 1.7;
  }

  .md blockquote {
    border-left: 2px solid var(--accent-amber);
    margin: 12px 0;
    padding: 10px 16px;
    background: rgba(184,138,40,0.05);
    border-radius: 0 3px 3px 0;
  }
  .md blockquote p { color: #9e8040; margin: 0; }

  .md hr { border: none; border-top: 1px solid var(--border); margin: 18px 0; }

  /* ── NO AI ───────────────────────────────────── */
  .no-ai {
    background: var(--bg-section);
    border: 1px solid var(--border);
    border-left: 2px solid var(--accent-amber);
    border-radius: 4px;
    padding: 16px 20px;
  }
  .no-ai-title {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--accent-amber);
    margin-bottom: 8px;
  }
  .no-ai-text { font-size: 12px; color: var(--text-muted); line-height: 1.7; }
  .no-ai-text code {
    font-family: var(--font-mono);
    font-size: 11px;
    background: var(--bg-inset);
    border: 1px solid var(--border);
    padding: 1px 5px;
    border-radius: 2px;
    color: var(--text-secondary);
  }

  /* ── ERROR LOGS ──────────────────────────────── */
  .error-log-block {
    background: var(--bg-inset);
    border-radius: 3px;
    padding: 16px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: #b07070;
    overflow-x: auto;
    max-height: 320px;
    overflow-y: auto;
    line-height: 1.7;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .error-log-block::-webkit-scrollbar { width: 5px; height: 5px; }
  .error-log-block::-webkit-scrollbar-track { background: transparent; }
  .error-log-block::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 3px; }

  /* ── ACTIONS ─────────────────────────────────── */
  .action-row { display: flex; gap: 10px; flex-wrap: wrap; padding-top: 4px; }
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
  }
  .btn-solid { background: #202020; color: var(--text-primary); border: 1px solid #3a3a3a; }
  .btn-solid:hover { background: #282828; border-color: var(--border-focus); }
  .btn-ghost { background: transparent; color: var(--text-secondary); border: 1px solid var(--border); }
  .btn-ghost:hover { background: var(--bg-hover); color: var(--text-primary); border-color: var(--border-focus); }

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
      <span class="status-pip" style="background:${statusColor};box-shadow:0 0 6px ${statusColor}44"></span>
      ${this.escapeHtml(service.name)}
    </div>
    <div class="header-meta">
      <span>Deploy <span style="color:var(--text-secondary)">${shortId}</span></span>
      <span class="meta-sep">|</span>
      <span>${formattedTime}</span>
    </div>
  </div>
  <div class="status-tag" style="color:${statusColor};border-color:${statusColor}44;background:${statusColor}0d">
    <span class="status-pip" style="background:${statusColor};width:5px;height:5px"></span>
    ${statusLabel}
  </div>
</div>

<div class="content">

  <!-- AI / NO AI -->
  ${aiSummary ? `
  <div class="ai-section">
    <div class="ai-header">
      <span class="ai-label">AI Analysis</span>
      <span class="ai-provider">Groq</span>
      <span class="severity-badge" id="severityBadge"></span>
    </div>
    <div class="ai-body">
      <div class="md" id="aiContent"></div>
    </div>
  </div>
  ` : `
  <div class="no-ai">
    <div class="no-ai-title">AI Analysis Unavailable</div>
    <div class="no-ai-text">
      Enable AI-powered error analysis by adding your Groq API key to settings
      (<code>renderGuardian.groqApiKey</code>) and turning on
      <code>renderGuardian.useAI</code>. See <code>AI_SETUP.md</code> for instructions.
    </div>
  </div>
  `}

  <!-- DEPLOY INFO -->
  <div class="section">
    <div class="section-header"><span class="section-label">Deploy Information</span></div>
    <div class="section-body">
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Service</div>
          <div class="info-value">${this.escapeHtml(service.name)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Deploy ID</div>
          <div class="info-value">${this.escapeHtml(deploy.id)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Status</div>
          <div class="info-value" style="color:${statusColor}">${this.escapeHtml(deploy.status)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Failed At</div>
          <div class="info-value">${formattedTime}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Service Type</div>
          <div class="info-value">${this.escapeHtml(service.type || 'N/A')}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Created</div>
          <div class="info-value">${service.createdAt ? new Date(service.createdAt).toLocaleDateString() : 'N/A'}</div>
        </div>
      </div>
      ${deploy.commit?.message ? `
      <div class="commit-block">
        <div class="commit-label">Commit Message</div>
        <div class="commit-message">${this.escapeHtml(deploy.commit.message)}</div>
      </div>` : ''}
    </div>
  </div>

  <!-- ERROR LOGS -->
  ${errorLogs ? `
  <div class="section">
    <div class="section-header"><span class="section-label">Error Logs</span></div>
    <div class="section-body">
      <div class="error-log-block">${this.escapeHtml(errorLogs)}</div>
    </div>
  </div>` : ''}

  <!-- ACTIONS -->
  <div class="action-row">
    <a href="https://dashboard.render.com/web/${this.escapeHtml(service.id)}" class="btn btn-solid">Open in Render Dashboard</a>
    <a href="https://dashboard.render.com/web/${this.escapeHtml(service.id)}/deploys/${this.escapeHtml(deploy.id)}" class="btn btn-ghost">View Full Deploy Logs</a>
  </div>

</div>

<script>
  // ── Inline markdown parser ─────────────────────────────────────────────────
  function parseMarkdown(raw) {
    if (!raw) { return ''; }

    function esc(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function inline(text) {
      // Extract code spans first to protect them from escaping
      const codeSpans = [];
      const withPlaceholders = text.replace(/\`([^\`]+)\`/g, (_, code) => {
        codeSpans.push(code);
        return '\x00CODE' + (codeSpans.length - 1) + '\x00';
      });

      // Now escape HTML on the remaining text
      let result = esc(withPlaceholders);

      // Apply bold/italic (operating on escaped text, no & < > involved)
      result = result
        .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
        .replace(/__([^_]+)__/g, '<strong>$1</strong>')
        .replace(/\\*([^*\\n]+)\\*/g, '<em>$1</em>')
        .replace(/_([^_\\n]+)_/g, '<em>$1</em>');

      // Restore code spans with escaped content
      result = result.replace(/\x00CODE(\\d+)\x00/g, (_, idx) => {
        return '<code>' + esc(codeSpans[parseInt(idx)]) + '</code>';
      });

      return result;
    }

    const lines = raw.split('\\n');
    let html = '';
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // fenced code block
      if (/^\`\`\`/.test(line)) {
        const lang = line.slice(3).trim();
        let code = '';
        i++;
        while (i < lines.length && !/^\`\`\`/.test(lines[i])) {
          code += esc(lines[i]) + '\\n';
          i++;
        }
        html += '<pre><code' + (lang ? ' class="lang-' + esc(lang) + '"' : '') + '>' + code.trimEnd() + '</code></pre>';
        i++;
        continue;
      }

      // headings
      const hm = line.match(/^(#{1,4})\\s+(.*)/);
      if (hm) {
        const lvl = hm[1].length;
        html += '<h' + lvl + '>' + inline(hm[2]) + '</h' + lvl + '>';
        i++; continue;
      }

      // hr (only pure --- or ___ lines, not *** which conflicts with bold)
      if (/^(-{3,}|_{3,})$/.test(line.trim())) {
        html += '<hr>';
        i++; continue;
      }

      // blockquote
      if (/^>\\s?/.test(line)) {
        let bq = '';
        while (i < lines.length && /^>\\s?/.test(lines[i])) {
          bq += inline(lines[i].replace(/^>\\s?/, '')) + ' ';
          i++;
        }
        html += '<blockquote><p>' + bq.trim() + '</p></blockquote>';
        continue;
      }

      // unordered list
      if (/^[-*+]\\s/.test(line)) {
        html += '<ul>';
        while (i < lines.length && /^[-*+]\\s/.test(lines[i])) {
          html += '<li>' + inline(lines[i].replace(/^[-*+]\\s/, '')) + '</li>';
          i++;
        }
        html += '</ul>';
        continue;
      }

      // ordered list
      if (/^\\d+\\.\\s/.test(line)) {
        html += '<ol>';
        while (i < lines.length && /^\\d+\\.\\s/.test(lines[i])) {
          html += '<li>' + inline(lines[i].replace(/^\\d+\\.\\s/, '')) + '</li>';
          i++;
        }
        html += '</ol>';
        continue;
      }

      // blank line
      if (line.trim() === '') { i++; continue; }

      // paragraph
      let para = '';
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !/^(#{1,4}\\s|>\\s?|[-*+]\\s|\\d+\\.\\s|\`\`\`|(-{3,}|_{3,})$)/.test(lines[i])
      ) {
        para += inline(lines[i]) + ' ';
        i++;
      }
      if (para.trim()) { html += '<p>' + para.trim() + '</p>'; }
    }

    return html;
  }

  // ── Severity detection ─────────────────────────────────────────────────────
  function detectSeverity(text) {
    const t = text.toLowerCase();
    if (/\\bcritical\\b|\\bfatal\\b|\\bcrash(ed)?\\b|\\bpanic\\b|\\bsegfault\\b/.test(t)) { return 'critical'; }
    if (/\\bhigh\\b|\\boom\\b|\\bout of memory\\b|\\bkilled\\b|\\bprocess exited\\b/.test(t)) { return 'high'; }
    if (/\\bmedium\\b|\\bwarn(ing)?\\b|\\btimeout\\b|\\bconnection refused\\b/.test(t)) { return 'medium'; }
    return 'low';
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  const rawSummary = ${JSON.stringify(aiSummary || '')};

  if (rawSummary) {
    const contentEl = document.getElementById('aiContent');
    const badgeEl   = document.getElementById('severityBadge');

    if (contentEl) {
      contentEl.innerHTML = parseMarkdown(rawSummary);
    }

    if (badgeEl) {
      const sev = detectSeverity(rawSummary);
      badgeEl.textContent = sev.charAt(0).toUpperCase() + sev.slice(1);
      badgeEl.classList.add('severity-' + sev);
    }
  }
</script>

</body>
</html>`;
    }

    private getStatusColor(status: string): string {
        const s = status.toLowerCase();
        if (s.includes('fail') || s === 'crashed' || s === 'error') { return '#c85c5c'; }
        if (s.includes('cancel')) { return '#b88a28'; }
        return '#666666';
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
        ErrorDetailsPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}