# Quick Start Guide - Render Guardian

## Step 1: Install Dependencies

```powershell
cd c:\next-js-projects\render
npm install
```

## Step 2: Compile the Extension

```powershell
npm run compile
```

## Step 3: Run in Development Mode

1. Open the project in VS Code
2. Press `F5` to launch the Extension Development Host
3. A new VS Code window opens with the extension loaded

## Step 4: Set Your Render API Key

In the Extension Development Host window:

1. Press `Ctrl+Shift+P` to open Command Palette
2. Type: `Render Guardian: Set API Key`
3. Enter your Render API key (get it from https://dashboard.render.com/account)

## Step 5: View Your Services

1. Click the Render Guardian icon in the Activity Bar (left sidebar)
2. View the "Render Services" tree
3. Click on any service to see details

## Step 6: Test the Monitoring

The extension automatically:
- Polls services every 3 minutes
- Detects deployment failures
- Shows notifications when issues occur
- Updates the status bar

## Verify It's Working

Check the Output channel:
1. View → Output
2. Select "Render Guardian" from dropdown
3. You should see logs like:
   ```
   🚀 Render Guardian activated
   🔑 API key updated
   📡 Fetching services from Render API...
   ✅ Fetched X services
   📊 Status: X healthy, X deploying, X failed
   ```

## Optional: Enable AI Summaries

### Option 1: Groq (Recommended - Faster & Free)

1. Get a free API key from https://console.groq.com
2. Open Settings: `Ctrl+,`
3. Search for "Render Guardian"
4. Set:
   - `Render Guardian: Use AI` → ✓ (checked)
   - `Render Guardian: Ai Provider` → groq
   - `Render Guardian: Groq Api Key` → your Groq key (starts with `gsk_`)

### Option 2: OpenAI

1. Get an OpenAI API key from https://platform.openai.com/api-keys
2. Open Settings: `Ctrl+,`
3. Search for "Render Guardian"
4. Set:
   - `Render Guardian: Use AI` → ✓ (checked)
   - `Render Guardian: Ai Provider` → openai
   - `Render Guardian: Openai Api Key` → your OpenAI key (starts with `sk-`)

## Package for Production

```powershell
# Install packaging tool
npm install -g @vscode/vsce

# Create .vsix file
vsce package

# Install in VS Code
# Extensions → ... → Install from VSIX → select render-guardian-1.0.0.vsix
```

## Troubleshooting

**Problem**: No services showing
- **Solution**: Check Output channel for errors. Verify API key is correct.

**Problem**: Extension not activating
- **Solution**: Run `npm run compile` again. Check for TypeScript errors.

**Problem**: Can't see the sidebar icon
- **Solution**: The icon requires the `resources/icon.svg` file. Compile and reload.

## Test Failure Detection

To test the failure notification:

1. Trigger a deploy failure on Render (e.g., introduce a syntax error)
2. Wait up to 3 minutes (or 30 seconds if deploying)
3. Extension should:
   - Show error notification
   - Update status bar to red
   - Display failure in tree view
   - Log error summary in Output channel

## Next Steps

- Customize polling interval in settings
- Try the "Refresh Services" command
- Click status bar to manually refresh
- Open a service in Render dashboard from tree view

---

**You're all set! 🚀**
