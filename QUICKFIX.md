# ⚡ QUICK START - Fix "unknown" Issue

## 🔴 PROBLEM: Seeing "unknown" in sidebar

## ✅ SOLUTION: Set your Render API key

---

## Step 1: Get Render API Key (2 minutes)

1. Open browser → https://dashboard.render.com/u/settings#api-keys
2. Click **"Create API Key"**
3. Name it: `VS Code Extension`
4. Click **"Create"**
5. **COPY THE KEY** (starts with `rnd_`)

---

## Step 2: Set Key in VS Code (30 seconds)

### In VS Code:

1. Press: **`Ctrl+Shift+P`**
2. Type: **`set api`**
3. Click: **"Render Guardian: Set API Key"**
4. **Paste** your key
5. Press **Enter**

### You'll see:
✅ "Render API key saved successfully"

---

## Step 3: Check It Works (10 seconds)

1. Look at **left sidebar** (Render Guardian panel)
2. **"unknown"** should disappear
3. You should see your **real service names**
4. Icons show status: 🟢 healthy, 🟡 deploying, 🔴 failed

### If still showing "unknown":
- Press: `Ctrl+Shift+P`
- Type: `reload`
- Click: **"Developer: Reload Window"**

---

## 🎯 Optional: Add AI (for smart error summaries)

### Get FREE Groq Key:

1. Go to: https://console.groq.com
2. Sign up (no credit card!)
3. Go to: https://console.groq.com/keys
4. Create API key
5. **COPY KEY** (starts with `gsk_`)

### Set in VS Code:

1. Press: **`Ctrl+,`** (Settings)
2. Search: **`groq`**
3. Fill in:
   - ✅ Check **"Use AI"**
   - Set **"Ai Provider"** to `groq`
   - Paste key in **"Groq Api Key"**

---

## 📍 Quick Reference

| What | Where | How |
|------|-------|-----|
| **Set Render API Key** | `Ctrl+Shift+P` | Type: `set api` |
| **View Services** | Left sidebar | Click Render Guardian icon |
| **View Logs** | View → Output | Select "Render Guardian" |
| **Settings** | `Ctrl+,` | Search: `render guardian` |
| **Refresh** | `Ctrl+Shift+P` | Type: `refresh services` |

---

## 🔧 Troubleshooting

### Still seeing "unknown"?

1. **Check Output for errors:**
   - View → Output → "Render Guardian"
   - Look for red ❌ messages

2. **Verify API key is valid:**
   - Try setting it again
   - Make sure no spaces before/after key

3. **Make sure you have services on Render:**
   - Go to https://dashboard.render.com/
   - You need at least 1 service

4. **Reload VS Code:**
   - `Ctrl+Shift+P` → "Developer: Reload Window"

---

**That's it! The "unknown" will be replaced with your actual service names.** 🎉

---

## Visual Guide

```
VS Code Layout:
┌─────────────────────────────────────────┐
│ Ctrl+Shift+P (Command Palette)          │ ← Type: "set api"
├──────────┬──────────────────────────────┤
│          │                              │
│  🎯 ←───│  Your Code Here              │ ← Left sidebar
│  📁      │                              │    Click icons here
│  🔍      │                              │
│  ⚡ ←───│ Render Guardian shows here   │ ← Click this!
│          │                              │
└──────────┴──────────────────────────────┘
│ 🟢 Render: 3 healthy                    │ ← Status bar (bottom)
└─────────────────────────────────────────┘
```

**After setting API key, the ⚡ icon panel will show your services!**
