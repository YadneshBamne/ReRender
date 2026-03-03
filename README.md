# Render Guardian - VS Code Extension

A production-ready VS Code extension that monitors your Render.com services, detects failures, and provides AI-powered error summaries.

## Features

- 🔐 **Secure Authentication** - API key stored using VS Code SecretStorage
- 📊 **Service Explorer** - TreeView showing all services with real-time status
- 🔍 **Smart Monitoring** - Adaptive polling (3 min normal, 30 sec during deploys)
- 🤖 **AI Summaries** - Human-friendly error explanations (local heuristic + optional OpenAI)
- 🔔 **Smart Notifications** - Failure alerts with no duplicates
- 📈 **Status Bar** - At-a-glance health overview
- 🎯 **Production-Ready** - Error handling, memory leak prevention, comprehensive logging

## Installation

### From Source

1. **Install Dependencies**

```powershell
cd c:\next-js-projects\render
npm install
```

2. **Compile TypeScript**

```powershell
npm run compile
```

3. **Launch Extension (Development)**

- Press `F5` in VS Code to open Extension Development Host
- Or run: `npm run watch` for auto-compilation

### Package for Distribution

```powershell
# Install vsce if not already installed
npm install -g @vscode/vsce

# Package the extension
vsce package

# This creates render-guardian-1.0.0.vsix
```

Install the `.vsix` file:
- VS Code → Extensions → ... menu → Install from VSIX

## Setup

### 1. Get Your Render API Key

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click on your profile → Account Settings
3. Navigate to "API Keys" section
4. Create a new API key
5. Copy the key (starts with `rnd_`)

### 2. Configure the Extension

1. Open Command Palette (`Ctrl+Shift+P`)
2. Run: `Render Guardian: Set API Key`
3. Paste your API key
4. The extension will start monitoring automatically

## Configuration

Add these settings to your VS Code `settings.json`:

```json
{
  "renderGuardian.pollIntervalSeconds": 180,
  "renderGuardian.useAI": false,
  "renderGuardian.aiProvider": "groq",
  "renderGuardian.groqApiKey": "",
  "renderGuardian.openaiApiKey": "",
  "renderGuardian.enableNotifications": true
}
```

### Settings Reference

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `renderGuardian.pollIntervalSeconds` | number | 180 | Health check interval (minimum: 30) |
| `renderGuardian.useAI` | boolean | false | Enable AI-powered summaries |
| `renderGuardian.aiProvider` | string | "groq" | AI provider: "groq" or "openai" |
| `renderGuardian.groqApiKey` | string | "" | Groq API key (optional, recommended) |
| `renderGuardian.openaiApiKey` | string | "" | OpenAI API key (optional) |
| `renderGuardian.enableNotifications` | boolean | true | Show failure notifications |

### Optional: Enable AI Summaries

For enhanced error analysis, you can use **Groq** (recommended, faster & free) or **OpenAI**:

#### Option 1: Groq (Recommended) 🚀

1. Get a free API key at [console.groq.com](https://console.groq.com)
2. Add to settings:

```json
{
  "renderGuardian.useAI": true,
  "renderGuardian.aiProvider": "groq",
  "renderGuardian.groqApiKey": "gsk_..."
}
```

#### Option 2: OpenAI

1. Get an [OpenAI API key](https://platform.openai.com/api-keys)
2. Add to settings:

```json
{
  "renderGuardian.useAI": true,
  "renderGuardian.aiProvider": "openai",
  "renderGuardian.openaiApiKey": "sk-..."
}
```

## Usage

### Commands

- **Render Guardian: Set API Key** - Configure Render API access
- **Render Guardian: Refresh Services** - Manual refresh
- **Render Guardian: View Service Details** - Open service info panel

### TreeView

Access the **Render Services** view from the Activity Bar:

- 🟢 Healthy services
- 🟡 Deploying services
- 🔴 Failed services

Click any service to see:
- Service type and configuration
- Latest deployment status
- Commit information
- Quick link to Render dashboard

### Status Bar

Bottom-left status bar shows:
- 🟢 All healthy
- 🔄 Deployments in progress
- 🔴 Failures detected

Click to refresh all services.

### Notifications

When a deployment fails:
- Error notification appears
- AI/heuristic summary provided
- Quick actions: "View Details" or "Open Dashboard"

## Architecture

```
src/
├── extension.ts              # Extension entry point
├── api/
│   └── renderClient.ts       # Render API client
├── monitoring/
│   ├── poller.ts            # Smart polling engine
│   └── errorDetector.ts     # Failure detection & caching
├── ai/
│   └── summarizer.ts        # Error summarization (AI + heuristic)
├── tree/
│   └── renderTreeProvider.ts # TreeView implementation
└── utils/
    ├── statusBar.ts         # Status bar manager
    └── cache.ts             # Deploy notification cache
```

## Development

### Build

```powershell
npm run compile
```

### Watch Mode

```powershell
npm run watch
```

### Debug

1. Open project in VS Code
2. Press `F5`
3. Extension Development Host opens
4. Test features in the new window

### View Logs

- View → Output → Select "Render Guardian"

## How It Works

### Adaptive Polling

- **Normal**: Checks every 3 minutes (configurable)
- **Active Deploy**: Switches to 30-second polling
- **Smart Detection**: Automatically adjusts based on service state

### Error Detection

1. Monitors deploy status via Render API
2. Detects failure states: `failed`, `build_failed`, `crashed`, `canceled`
3. Maintains in-memory cache to prevent duplicate notifications
4. Extracts meaningful error context

### AI Summarization

**Mode A - Heuristic (Default)**
- Pattern matching for common errors
- Analyzes commit messages and status
- Provides probable cause and fix suggestions

**Mode B - OpenAI (Optional)**
- Sends error context to GPT-3.5
- Receives human-friendly explanation
- Falls back to heuristic on API failure

## Troubleshooting

### No services appearing

1. Check API key is set correctly
2. View Output channel for error messages
3. Verify API key has correct permissions in Render

### Notifications not showing

1. Check `renderGuardian.enableNotifications` is `true`
2. Ensure VS Code notifications are enabled (OS level)

### AI summaries not working

1. Verify `renderGuardian.useAI` is `true`
2. Check OpenAI API key is valid
3. Ensure you have API credits
4. Extension falls back to heuristic analysis on failure

## Publishing

### To VS Code Marketplace

1. Create publisher account at [VS Code Marketplace](https://marketplace.visualstudio.com/)
2. Update `publisher` in `package.json`
3. Package and publish:

```powershell
vsce package
vsce publish
```

## Security

- API keys stored securely using VS Code SecretStorage
- No keys logged or transmitted except to official APIs
- OpenAI key optional and only used if explicitly enabled

## License

MIT License - see LICENSE file for details

## Support

- Report issues on GitHub
- View logs in Output channel: "Render Guardian"
- Check Render API status: https://status.render.com/

## Roadmap

- [ ] Deploy rollback support
- [ ] Custom webhook notifications
- [ ] Multi-account support
- [ ] Log streaming viewer
- [ ] Deploy history charts

---

**Made with ❤️ for the Render community**
