# 🚀 How to Test Render Guardian & Get Your API Key

## Part 1: Get Your Render API Key

### Step-by-Step Instructions

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com/
   - Log in to your account

2. **Navigate to Account Settings**
   - Click your **profile picture** in the top-right corner
   - Select **"Account Settings"** from the dropdown

3. **Find API Keys Section**
   - In the left sidebar, click **"API Keys"**
   - Or go directly to: https://dashboard.render.com/u/settings#api-keys

4. **Create a New API Key**
   - Click the **"Create API Key"** button
   - Give it a name (e.g., "VS Code Extension")
   - Click **"Create"**

5. **Copy Your API Key**
   - Your new API key will be displayed (starts with `rnd_`)
   - **⚠️ IMPORTANT:** Copy it immediately - you won't see it again!
   - Example format: `rnd_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`

6. **Keep It Secure**
   - Don't share it publicly
   - Don't commit it to Git
   - The extension stores it securely in VS Code

---

## Part 2: Test the Extension

### Method 1: Quick Test (F5)

This is the easiest way to test during development:

1. **Open the Project in VS Code**
   ```powershell
   cd c:\next-js-projects\render
   code .
   ```

2. **Press F5**
   - This launches the "Extension Development Host"
   - A new VS Code window will open with your extension loaded

3. **Set Your API Key**
   - In the new window, press `Ctrl+Shift+P`
   - Type: `Render Guardian: Set API Key`
   - Paste your API key from Render
   - Press Enter

4. **View Your Services**
   - Look for the **Render Guardian** icon in the Activity Bar (left sidebar)
   - Click it to open the services panel
   - You should see all your Render services listed

5. **Check the Status Bar**
   - Look at the bottom-left status bar
   - You should see: `🟢 Render: All healthy` (or similar)

6. **View Logs**
   - Go to `View → Output`
   - Select **"Render Guardian"** from the dropdown
   - You'll see detailed logs like:
     ```
     🚀 Render Guardian activated
     📡 Fetching services from Render API...
     ✅ Fetched 3 services
     📊 Status: 3 healthy, 0 deploying, 0 failed
     ```

### Method 2: Install as VSIX (Production Test)

Test it like a real user would install it:

1. **Package the Extension**
   ```powershell
   # Install the packaging tool (one-time)
   npm install -g @vscode/vsce
   
   # Package your extension
   vsce package
   ```

   This creates: `render-guardian-1.0.0.vsix`

2. **Install the VSIX**
   - In VS Code: `Ctrl+Shift+P`
   - Type: `Extensions: Install from VSIX...`
   - Select the `render-guardian-1.0.0.vsix` file
   - Restart VS Code

3. **Test It**
   - Follow the same steps as Method 1 (set API key, view services)

---

## Part 3: What to Test

### ✅ Basic Functionality

1. **API Key Storage**
   - Set API key → Should save successfully
   - Restart VS Code → Should remember your key
   - Try invalid key → Should show validation error

2. **Service List**
   - Should see all your Render services
   - Each service shows correct status icon:
     - 🟢 = Healthy (live)
     - 🟡 = Deploying
     - 🔴 = Failed

3. **Service Details**
   - Click on a service → Should expand
   - Should show: Type, Repository, Branch, Latest Deploy
   - Click "Open Dashboard" → Opens Render in browser

4. **Status Bar**
   - Should show overall health
   - Click it → Refreshes all services
   - Color changes based on status:
     - Green background = All healthy
     - Yellow = Deploying
     - Red = Failures

5. **Refresh Command**
   - `Ctrl+Shift+P` → `Render Guardian: Refresh Services`
   - Should update the service list

### ✅ Monitoring Features

1. **Automatic Polling**
   - Wait 3 minutes
   - Check Output channel → Should see periodic health checks
   - Log message: `🔍 Checking service health...`

2. **Deploy Detection**
   - Trigger a deploy on Render
   - Wait ~30 seconds
   - Extension should detect it and poll faster
   - Status should change to 🟡 deploying

3. **Failure Notifications**
   - Cause a deploy to fail (e.g., introduce a syntax error)
   - Wait up to 3 minutes
   - You should get:
     - ❌ Desktop notification
     - 🔴 Red status bar
     - Error summary in Output channel
   - Click notification → Should show options:
     - "View Details"
     - "Open Dashboard"

4. **No Duplicate Alerts**
   - After a failure, wait another 3 minutes
   - Should NOT get another notification for the same deploy
   - Check Output: `🔕 Already notified about deploy xxx`

### ✅ AI Features (Optional)

If you want to test AI-powered summaries:

1. **Get OpenAI API Key**
   - Go to: https://platform.openai.com/api-keys
   - Create a new API key
   - Copy it (starts with `sk-`)

2. **Configure Settings**
   - In VS Code: `Ctrl+,` (Settings)
   - Search: "Render Guardian"
   - Enable: `Render Guardian: Use AI`
   - Set: `Render Guardian: Openai Api Key` → your key

3. **Test It**
   - Trigger a failure
   - Check Output channel for AI-generated summary
   - Should be more detailed than default heuristic

---

## Part 4: Troubleshooting

### Problem: "No services found"

**Solutions:**
- Check if you have any services in your Render account
- Verify API key is correct
- Check Output channel for API errors
- Try: `Ctrl+Shift+P` → `Render Guardian: Refresh Services`

### Problem: "No API key set"

**Solutions:**
- Run: `Render Guardian: Set API Key`
- Make sure you copied the full key (starts with `rnd_`)
- Don't include any spaces or quotes

### Problem: Extension not appearing

**Solutions:**
- Check if compiled: `npm run compile`
- Look for `out/` folder in project
- Check for compilation errors
- Restart VS Code

### Problem: Can't see the sidebar icon

**Solutions:**
- The icon might be in the overflow menu (three dots)
- Look for "Render Guardian" in the Activity Bar
- Try restarting VS Code

### Problem: Services not updating

**Solutions:**
- Check internet connection
- Verify Render API is online: https://status.render.com/
- Check Output channel for errors
- Try manual refresh

---

## Part 5: Testing Checklist

Use this to verify everything works:

- [ ] API key prompt on first start
- [ ] Services appear in TreeView
- [ ] Can expand/collapse services
- [ ] Status icons correct (🟢🟡🔴)
- [ ] Status bar shows health
- [ ] Click status bar refreshes
- [ ] "Open Dashboard" link works
- [ ] Output channel shows logs
- [ ] Manual refresh command works
- [ ] Automatic polling every 3 minutes
- [ ] Deploy detection works
- [ ] Failure notification appears
- [ ] No duplicate notifications
- [ ] Settings can be changed
- [ ] Extension remembers API key after restart

---

## Part 6: Real-World Test Scenario

**Complete End-to-End Test:**

1. **Setup** (5 min)
   - Press F5 in VS Code
   - Set your Render API key
   - Verify services appear

2. **Normal Operation** (5 min)
   - Watch services for 5 minutes
   - Should see at least one polling cycle
   - Check Output channel logs

3. **Deploy Test** (10 min)
   - Make a change to one of your Render services
   - Trigger a deploy
   - Watch extension detect it
   - Verify 🟡 status appears
   - Polling should speed up to 30 seconds

4. **Failure Test** (10 min)
   - Introduce an error (e.g., wrong env var)
   - Deploy again
   - Wait for failure
   - Verify notification appears
   - Check error summary makes sense
   - Verify no duplicate notification

5. **Recovery Test** (5 min)
   - Fix the error
   - Deploy again
   - Watch it turn green
   - Verify everything back to normal

---

## Part 7: Example Output

When working correctly, your Output channel should look like:

```
🚀 Render Guardian activated
🔑 API key updated
📡 Fetching services from Render API...
✅ Fetched 3 services
📊 Status: 3 healthy, 0 deploying, 0 failed
⏰ Next check in 180 seconds

🔍 Checking service health...
📡 Fetching services from Render API...
✅ Fetched 3 services
📡 Fetching deploys for service srv_xxxxx...
✅ Fetched 1 deploys
📊 Status: 2 healthy, 1 deploying, 0 failed
⏰ Next check in 30 seconds

🔍 Checking service health...
❌ FAILURE DETECTED
Service: my-web-service
Deploy ID: dep_xxxxx
Status: build_failed

❌ The build process failed for my-web-service.
📦 Likely cause: Dependency or package installation issue.
💡 Fix: Check package.json dependencies, lock files...
```

---

## Quick Reference

| Action | Command |
|--------|---------|
| Set API Key | `Ctrl+Shift+P` → `Render Guardian: Set API Key` |
| Refresh Services | `Ctrl+Shift+P` → `Render Guardian: Refresh Services` |
| View Logs | `View → Output` → Select "Render Guardian" |
| Test Extension | Press `F5` in VS Code |
| Package Extension | `vsce package` |

**Render API Key URL:** https://dashboard.render.com/u/settings#api-keys

**Need Help?**
- Check Output channel for detailed logs
- Review README.md for full documentation
- Verify Render API status: https://status.render.com/

---

**You're ready to test! 🎉**
