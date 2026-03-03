# 🚀 Complete Setup Guide - Start Here!

## The "unknown" Issue

You're seeing "unknown" because **no API key is set yet**. Let's fix that!

---

## 📋 Step-by-Step Setup

### STEP 1: Set Your Render API Key (REQUIRED)

This is the main API key that lets the extension see your Render services.

#### A. Get Your Render API Key

1. **Open your browser** and go to:
   ```
   https://dashboard.render.com/u/settings#api-keys
   ```

2. **Log in** to your Render account

3. **Create API Key:**
   - Click the blue **"Create API Key"** button
   - Name it: `VS Code Extension`
   - Click **"Create"**

4. **Copy the key** - it starts with `rnd_`
   - Example: `rnd_abc123xyz456...`
   - ⚠️ **Save it now** - you won't see it again!

#### B. Add Key to VS Code Extension

**Method 1: Use the Command (Easiest)**

1. In VS Code, press: **`Ctrl+Shift+P`**
2. Type: `Render Guardian: Set API Key`
3. Paste your Render API key
4. Press **Enter**

**You should see:** ✅ "Render API key saved successfully"

**Method 2: Manual Settings**

1. Press: **`Ctrl+Shift+P`**
2. Type: `Preferences: Open User Settings`
3. Search: `render guardian`
4. Find: **Render Guardian: Set API Key** (won't show the key for security)
5. Use Method 1 instead - it's easier!

---

### STEP 2: Verify It's Working

After setting the API key:

1. **Check the Sidebar:**
   - Click the **Render Guardian** icon (left sidebar)
   - You should now see your actual services with names
   - Not "unknown" anymore!

2. **Check Status Bar:**
   - Look at **bottom-left** corner
   - Should show: `🟢 Render: All healthy` (or similar)

3. **Check Output Logs:**
   - Go to: **View** → **Output**
   - Select: **"Render Guardian"** from dropdown
   - Should see:
     ```
     🚀 Render Guardian activated
     🔑 API key updated
     📡 Fetching services from Render API...
     ✅ Fetched 3 services
     📊 Status: 3 healthy, 0 deploying, 0 failed
     ```

---

### STEP 3: Enable AI Summaries (OPTIONAL)

This adds smart error explanations when deployments fail.

#### Option A: Groq (Recommended - FREE & Fast)

1. **Get Groq API Key:**
   - Go to: https://console.groq.com
   - Click **"Start Building"** or **"Sign In"**
   - Sign up (Google/GitHub/Email)
   - After login, go to: https://console.groq.com/keys
   - Click **"Create API Key"**
   - Name it: `Render Guardian`
   - Click **"Submit"**
   - **Copy the key** - starts with `gsk_`

2. **Add to VS Code:**
   - Press: **`Ctrl+,`** (opens Settings)
   - In search box, type: `render guardian`
   - Find these settings and set them:

   ```
   ✅ Render Guardian: Use AI → Check this box
   
   Render Guardian: Ai Provider → Select "groq" from dropdown
   
   Render Guardian: Groq Api Key → Paste your Groq key here
   ```

3. **That's it!** Now failures will have AI-powered explanations

#### Option B: OpenAI (Paid Alternative)

1. **Get OpenAI API Key:**
   - Go to: https://platform.openai.com/api-keys
   - Sign in
   - Add payment method at: https://platform.openai.com/account/billing
   - Create new secret key
   - **Copy the key** - starts with `sk_`

2. **Add to VS Code:**
   - Press: **`Ctrl+,`**
   - Search: `render guardian`
   - Set:

   ```
   ✅ Render Guardian: Use AI → Check this box
   
   Render Guardian: Ai Provider → Select "openai"
   
   Render Guardian: Openai Api Key → Paste your OpenAI key
   ```

---

## 🎯 Quick Summary: Where API Keys Go

### Render API Key (REQUIRED)
**What:** Lets extension see your Render services  
**Command:** `Ctrl+Shift+P` → `Render Guardian: Set API Key`  
**Get it from:** https://dashboard.render.com/u/settings#api-keys  
**Format:** `rnd_...`  

### Groq API Key (OPTIONAL - for AI summaries)
**What:** AI-powered error explanations  
**Where:** Settings (`Ctrl+,`) → Search "render guardian" → Groq Api Key  
**Get it from:** https://console.groq.com/keys  
**Format:** `gsk_...`  

### OpenAI API Key (OPTIONAL - alternative to Groq)
**What:** AI-powered error explanations (costs money)  
**Where:** Settings (`Ctrl+,`) → Search "render guardian" → Openai Api Key  
**Get it from:** https://platform.openai.com/api-keys  
**Format:** `sk_...`  

---

## 🔄 Full Startup Process

Here's how to start everything from scratch:

### If Testing/Developing (Press F5 Method)

```powershell
# 1. Open the project
cd c:\next-js-projects\render
code .

# 2. Press F5 in VS Code
# This opens "Extension Development Host" window

# 3. In the NEW window that opens:
#    - Press Ctrl+Shift+P
#    - Type: "Render Guardian: Set API Key"
#    - Paste your Render API key
#    - Press Enter

# 4. Click Render Guardian icon in sidebar
# 5. You should see your services!
```

### If Installed as Extension (.vsix)

```powershell
# 1. Package it (one-time)
npm install -g @vscode/vsce
vsce package

# 2. Install the .vsix file
#    In VS Code:
#    - Ctrl+Shift+P
#    - Type: "Extensions: Install from VSIX"
#    - Select: render-guardian-1.0.0.vsix
#    - Restart VS Code

# 3. Set API key
#    - Ctrl+Shift+P
#    - Type: "Render Guardian: Set API Key"
#    - Paste key, press Enter

# 4. Click sidebar icon - see your services!
```

---

## 🖼️ Visual Guide: Where Everything Is

### 1. Render Guardian Icon Location
**Left sidebar (Activity Bar)** - Look for the icon with the server/pulse symbol

### 2. Status Bar Location  
**Bottom-left corner** - Shows: `🟢 Render: X services`

### 3. Settings Location
- Press: `Ctrl+,`
- Search: `render guardian`
- You'll see:
  - ✅ Enable Notifications
  - Poll Interval Seconds
  - Use AI
  - Ai Provider
  - Groq Api Key
  - Openai Api Key

### 4. Output Channel Location
- Menu: **View** → **Output**
- Dropdown: Select **"Render Guardian"**

### 5. Commands Location
- Press: `Ctrl+Shift+P`
- Type: `render guardian`
- You'll see:
  - Render Guardian: Set API Key
  - Render Guardian: Refresh Services

---

## ❌ Troubleshooting "unknown"

If you still see "unknown" after setting API key:

### Fix 1: Refresh Services
```
Ctrl+Shift+P → Render Guardian: Refresh Services
```

### Fix 2: Reload Extension
```
Ctrl+Shift+P → Developer: Reload Window
```

### Fix 3: Check API Key
```
1. View → Output → "Render Guardian"
2. Look for errors like:
   ❌ Failed to fetch services - 401: Unauthorized
   
   This means API key is wrong. Set it again.
```

### Fix 4: Verify You Have Render Services
```
1. Go to: https://dashboard.render.com/
2. Make sure you have at least one service created
3. If no services exist, create a test service first
```

---

## ✅ Success Checklist

After setup, you should have:

- [ ] Render API key set (required)
- [ ] Sidebar shows your actual service names (not "unknown")
- [ ] Status bar shows health status
- [ ] Output channel shows logs
- [ ] Can click services to expand details
- [ ] (Optional) Groq or OpenAI key set for AI summaries

---

## 📝 Example: Full Configuration

Here's what your settings should look like when everything is configured:

**Press `Ctrl+,` → Search "render guardian":**

```
Render Guardian Configuration:
├── Enable Notifications: ✓ (checked)
├── Poll Interval Seconds: 180
├── Use AI: ✓ (checked) ← Optional
├── Ai Provider: groq ← Optional
├── Groq Api Key: gsk_abc123... ← Optional
└── Openai Api Key: (empty) ← Optional
```

**Plus the secret Render API key stored securely (not visible in settings)**

---

## 🎬 Quick Start Commands

Copy and paste these:

```powershell
# Start development
cd c:\next-js-projects\render
code .
# Press F5

# Set Render API key
# Ctrl+Shift+P → "Render Guardian: Set API Key"

# Set Groq API key (optional)
# Ctrl+, → search "render guardian" → set Groq Api Key

# View logs
# View → Output → Select "Render Guardian"
```

---

## 🆘 Still Stuck?

1. **Check Output Channel:**
   - View → Output → "Render Guardian"
   - Look for error messages

2. **Check You Have Services:**
   - Go to https://dashboard.render.com/
   - You need at least 1 service

3. **Verify API Key Format:**
   - Should start with `rnd_`
   - No spaces or quotes
   - Should be the full key

4. **Try Manual Refresh:**
   - `Ctrl+Shift+P` → `Render Guardian: Refresh Services`

---

**Once the Render API key is set, "unknown" will disappear and you'll see your real services!** 🎉
