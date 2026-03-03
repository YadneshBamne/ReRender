# 🔧 API Key Not Working - Diagnostic Guide

## Let's figure out what's wrong!

Follow these steps **in order** to diagnose the issue:

---

## Step 1: Verify the Extension is Running

1. **Reload the extension window:**
   - If you pressed F5: Close the Extension Development Host window and press F5 again
   - If installed: `Ctrl+Shift+P` → `Developer: Reload Window`

2. **Check the Output Channel:**
   - Go to: **View** → **Output**
   - Select: **"Render Guardian"** from the dropdown
   - You should see:
     ```
     🚀 Render Guardian activated
     ✅ Render Guardian ready
     ```

**If you don't see these messages, the extension didn't activate properly.**

---

## Step 2: Confirm API Key is Saved

1. **Set the API key again:**
   - `Ctrl+Shift+P`
   - Type: `Render Guardian: Set API Key`
   - Paste your key (starts with `rnd_`)
   - Press Enter

2. **You MUST see this message:**
   ```
   ✅ Render API key saved successfully
   ```

3. **Check Output Channel again:**
   ```
   🔑 API key updated
   🔄 Refreshing services...
   📡 Fetching services from Render API...
   ```

**What do you see in the Output channel?**

---

## Step 3: Look for Error Messages

### A. Check for Authentication Errors

Look in the Output channel for:

```
❌ Failed to fetch services - 401: Unauthorized
🔐 Authentication failed. Please check your Render API key.
```

**If you see this:**
- Your API key is **wrong** or **expired**
- Go to https://dashboard.render.com/u/settings#api-keys
- Delete the old key and create a **new one**
- Set it again in VS Code

### B. Check for Network Errors

Look for:

```
❌ Failed to fetch services - No response received from Render API
🌐 Cannot reach Render API. Check your internet connection.
```

**If you see this:**
- Check your internet connection
- Check if your firewall is blocking the extension
- Try visiting https://api.render.com in your browser

### C. Check for Rate Limit

Look for:

```
❌ Failed to fetch services - 429: Too Many Requests
⏱️ Rate limit exceeded.
```

**If you see this:**
- Wait 1-2 minutes
- `Ctrl+Shift+P` → `Render Guardian: Refresh Services`

### D. Check for Empty Response

Look for:

```
📡 Fetching services from Render API...
✅ Fetched 0 services
```

**If you see this:**
- Your API key works!
- But you have **no services** in your Render account
- Go to https://dashboard.render.com/
- Create a test service first

---

## Step 4: Manual API Test

Let's test your API key manually:

### Option A: PowerShell Test

```powershell
# Replace YOUR_API_KEY with your actual key
$headers = @{
    "Authorization" = "Bearer YOUR_API_KEY"
}
Invoke-RestMethod -Uri "https://api.render.com/v1/services" -Headers $headers
```

**Expected result:**
- You should see JSON data with your services
- If you get an error, your API key is invalid

### Option B: Browser Test

1. Install a browser extension like "ModHeader" or "REST Client"
2. Add header: `Authorization: Bearer YOUR_API_KEY`
3. Visit: https://api.render.com/v1/services
4. You should see JSON with your services

---

## Step 5: Check Your Render Account

1. Go to: https://dashboard.render.com/
2. **Do you have any services?**
   - If NO → Create a test service first
   - If YES → Continue to Step 6

2. Click on any service
3. Verify it's not suspended or deleted

---

## Step 6: Common Issues & Fixes

### Issue: "No API key set" message

**Fix:**
```
1. Ctrl+Shift+P
2. Render Guardian: Set API Key
3. Paste key (must start with rnd_)
4. Press Enter
5. Ctrl+Shift+P
6. Developer: Reload Window
```

### Issue: Key is saved but nothing happens

**Fix:**
```
1. View → Output → Select "Render Guardian"
2. Look for red ❌ errors
3. Copy the error message
4. Check Step 3 above for specific errors
```

### Issue: Extension not loading at all

**Fix:**
```
1. Check you're in the right window
   - Press F5 opens a NEW window
   - Your extension only works in the NEW window
   
2. Check the extension is compiled:
   - In terminal: npm run compile
   - Should see: "out" folder created
   
3. Check for TypeScript errors:
   - View → Problems
   - Fix any red errors
```

### Issue: "unknown" still showing

**Fix:**
```
1. View → Output → "Render Guardian"
2. Look for this line:
   ✅ Fetched X services
   
3. If X is 0:
   - You have no services on Render
   - Create one at dashboard.render.com
   
4. If you see ❌ error:
   - Read the error message
   - Usually it's the API key
```

---

## Step 7: Full Reset

If nothing works, do a complete reset:

```powershell
# 1. Close VS Code completely

# 2. Delete compiled files
cd c:\next-js-projects\render
Remove-Item -Recurse -Force out

# 3. Reinstall dependencies
Remove-Item -Recurse -Force node_modules
npm install

# 4. Recompile
npm run compile

# 5. Restart VS Code
code .

# 6. Press F5

# 7. In NEW window:
#    Ctrl+Shift+P → Set API Key
```

---

## Step 8: Share Debug Info

If still not working, share this info:

1. **Output Channel Contents:**
   - View → Output → "Render Guardian"
   - Copy ALL the text
   - Share it

2. **API Key Format (first 10 chars only):**
   - Example: `rnd_abc123...`
   - Don't share the full key!

3. **Number of Services:**
   - Go to https://dashboard.render.com/
   - How many services do you have?

4. **VS Code Version:**
   - Help → About
   - What version?

---

## Quick Checklist

- [ ] Extension activated (see 🚀 in Output channel)
- [ ] API key set (see ✅ message after setting)
- [ ] No ❌ errors in Output channel
- [ ] Have at least 1 service on Render
- [ ] Key format starts with `rnd_`
- [ ] Internet connection working
- [ ] Tried reloading window

---

## Most Common Solutions

### 99% of issues are:

1. **Wrong API key** → Get a new one from Render
2. **No services** → Create a service on Render  
3. **Extension not restarted** → Reload window after setting key

### Try this first:

```
1. Get NEW API key from Render
2. Ctrl+Shift+P → Set API Key
3. Ctrl+Shift+P → Developer: Reload Window
4. Check Output channel for errors
```

---

**What errors do you see in the Output channel?** That will tell us exactly what's wrong! 📊
