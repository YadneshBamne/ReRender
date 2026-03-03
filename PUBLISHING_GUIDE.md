# 🚀 Publish to VS Code Marketplace - Simple Guide

## 💰 Cost: **100% FREE** - No Credit Card Required!

This guide shows you how to publish your ReRender extension to the VS Code Marketplace using **GitHub** (no Azure subscription needed).

---

## ⚠️ BEFORE YOU START - Critical Steps

### 1. Remove Your API Key from Settings

**Open `.vscode/settings.json` and make sure it looks like this:**

```json
{
  "rerender.pollIntervalSeconds": 180,
  "rerender.useAI": false,
  "rerender.aiProvider": "groq",
  "rerender.groqApiKey": "",
  "rerender.openaiApiKey": "",
  "rerender.enableNotifications": true
}
```

**Make sure `groqApiKey` is empty!** Don't share your personal API key with the world.

### 2. Update package.json

**Open `package.json` and update these fields:**

```json
{
  "publisher": "your-publisher-id",  // ← Change this (Step 2 below)
  "repository": {
    "url": "https://github.com/YOUR-USERNAME/rerender"  // ← Your GitHub username
  },
  "homepage": "https://github.com/YOUR-USERNAME/rerender#readme"  // ← Your GitHub username
}
```

### 3. Icon (Optional)

**Option A - Keep it simple:**
Delete this line from package.json:
```json
"icon": "icon.png",  // ← DELETE THIS LINE
```

**Option B - Create icon:**
Create a 256x256 PNG image named `icon.png` in the root folder.

---

## 📋 Step-by-Step Publishing Process

### STEP 1: Install Publishing Tool (2 minutes)

**Open PowerShell in your project folder and run:**

```powershell
npm install -g @vscode/vsce
```

Wait for it to complete. You'll see "added 1 package" when done.

---

### STEP 2: Create Publisher Account (5 minutes)

**FREE - No payment required!**

1. **Go to:** https://marketplace.visualstudio.com/manage

2. **Sign in** with Microsoft, GitHub, or Azure account

3. **Click "Create Publisher"** (green button)

4. **Fill in:**
   - **Publisher ID**: `yourname-extensions` (lowercase, no spaces, must be unique)
   - **Display Name**: `Your Name` or `Your Company`
   - **Description**: `VS Code extensions by [Your Name]`

5. **Click "Create"**

6. **✅ Remember your Publisher ID!** You'll need it next.

---

### STEP 3: Get GitHub Personal Access Token (5 minutes)

**Instead of Azure, we'll use GitHub - much simpler!**

1. **Go to:** https://github.com/settings/tokens

2. **Click "Generate new token"** → **"Generate new token (classic)"**

3. **Fill in:**
   - **Note**: `VS Code Publishing`
   - **Expiration**: `90 days` (or longer)
   - **Select scopes**: Check **`repo`** (Full control of private repositories)

4. **Scroll down and click "Generate token"**

5. **Copy the token** (starts with `ghp_...`)
   - ⚠️ **Save it now** - you won't see it again!
   - Paste it in Notepad temporarily

---

### STEP 4: Update package.json with Your Info (2 minutes)

**Open `package.json` and change:**

```json
{
  "publisher": "YOUR-PUBLISHER-ID",  // ← From Step 2
  "repository": {
    "type": "git",
    "url": "https://github.com/YOUR-GITHUB-USERNAME/rerender"  // ← Your username
  },
  "homepage": "https://github.com/YOUR-GITHUB-USERNAME/rerender#readme"
}
```

**Example (if your publisher is "johnsmith-ext" and GitHub is "johnsmith"):**
```json
{
  "publisher": "johnsmith-ext",
  "repository": {
    "type": "git",
    "url": "https://github.com/johnsmith/rerender"
  },
  "homepage": "https://github.com/johnsmith/rerender#readme"
}
```

**Save the file!**

---

### STEP 5: Compile Your Extension (1 minute)

**In PowerShell, run:**

```powershell
npm run compile
```

Make sure there are no errors.

---

### STEP 6: Package Your Extension (2 minutes)

**In PowerShell, run:**

```powershell
vsce package
```

**What happens:**
- Creates `rerender-1.0.0.vsix` file
- You'll see: "Packaged: C:\...\rerender-1.0.0.vsix"

**If you get errors:**
- **"Missing publisher"**: Go back to Step 4, update publisher field
- **"Icon not found"**: Either create icon.png OR remove the icon line from package.json
- **Compilation errors**: Run `npm run compile` and fix any TypeScript errors

---

### STEP 7: Test Locally (5 minutes) - IMPORTANT!

**Before publishing, test it works:**

1. Open VS Code
2. Press `Ctrl+Shift+X` (Extensions)
3. Click `...` menu (top right of Extensions panel)
4. Click **"Install from VSIX..."**
5. Select `rerender-1.0.0.vsix`
6. Extension will install

**Test everything:**
- ✅ Set API key
- ✅ Load services
- ✅ Stream logs
- ✅ Find Errors button
- ✅ AI analysis

**After testing:**
- Uninstall the test version (so you can fresh install from marketplace later)

---

### STEP 8: Publish to Marketplace! 🎉 (2 minutes)

**In PowerShell, run:**

```powershell
vsce publish -p YOUR_GITHUB_TOKEN
```

**Replace `YOUR_GITHUB_TOKEN` with the GitHub token from Step 3!**

**Example:**
```powershell
vsce publish -p ghp_abc123xyz789...
```

**What happens:**
- Uploads extension to VS Code Marketplace
- You'll see progress messages
- Final message: "Successfully published yourname.rerender@1.0.0"

**🎊 Done! Your extension is published!**

---

## ✅ After Publishing

### When Will It Be Live?

- **Immediately**: Appears in your publisher dashboard
- **5-10 minutes**: Searchable on marketplace website
- **15-30 minutes**: Installable from VS Code Extensions panel

### Verify It Worked:

1. **Go to:** https://marketplace.visualstudio.com
2. **Search:** "ReRender"
3. **You should see your extension!**

### Install It Fresh:

1. In VS Code → Extensions (`Ctrl+Shift+X`)
2. Search "ReRender"
3. Click Install
4. Test everything works

---

## 🔄 Publishing Updates Later

When you add features or fix bugs:

**Bump version and publish:**

```powershell
# For bug fixes (1.0.0 → 1.0.1)
vsce publish patch -p YOUR_GITHUB_TOKEN

# For new features (1.0.0 → 1.1.0)
vsce publish minor -p YOUR_GITHUB_TOKEN

# For breaking changes (1.0.0 → 2.0.0)
vsce publish major -p YOUR_GITHUB_TOKEN
```

**Or update version manually:**

1. Change `"version": "1.0.1"` in package.json
2. Run: `vsce publish -p YOUR_GITHUB_TOKEN`

---

## 📊 Manage Your Extension

### Publisher Dashboard:
**https://marketplace.visualstudio.com/manage/publishers/YOUR-PUBLISHER-ID**

You can see:
- Total installs
- Ratings and reviews
- Download statistics
- Update extension details

### Unpublish (if needed):
```powershell
vsce unpublish YOUR-PUBLISHER-ID.rerender
```

**Warning:** You can't republish with the same version number!

---

## ❌ Common Errors & Solutions

### "Missing publisher name"
**Fix:** Update `"publisher"` in package.json with your actual publisher ID from Step 2

### "Icon file not found"
**Fix:** Either create icon.png (256x256 PNG) OR delete `"icon": "icon.png",` line from package.json

### "Personal access token is invalid"
**Fix:** Make sure you:
- Used GitHub token (not Azure)
- Selected `repo` scope when creating token
- Copied the full token starting with `ghp_`

### "Extension with this name already exists"
**Fix:** Change the `"name"` field in package.json to something unique

### "Failed to compile"
**Fix:** Run `npm run compile` and fix any TypeScript errors shown

---

## 🎯 Quick Checklist

Before publishing, make sure:

- [ ] Removed API key from `.vscode/settings.json`
- [ ] Updated `publisher` in package.json
- [ ] Updated GitHub URLs in package.json
- [ ] Handled icon (created icon.png OR removed icon line)
- [ ] Created publisher account at marketplace.visualstudio.com
- [ ] Created GitHub Personal Access Token with `repo` scope
- [ ] Ran `npm run compile` successfully
- [ ] Ran `vsce package` successfully
- [ ] Tested .vsix file locally
- [ ] Ready to run `vsce publish -p YOUR_TOKEN`

---

## 🎨 Bonus: Change Sidebar Icon

The icon in VS Code's sidebar (Activity Bar) can be changed easily.

**Current icon:** `$(pulse)` (waveform)

### Browse 400+ Built-in Icons:
**https://microsoft.github.io/vscode-codicons/dist/codicon.html**

### Recommended for Your Extension:
- `$(server)` - Server icon (best for Render)
- `$(cloud)` - Cloud icon
- `$(output)` - Logs/output icon
- `$(pulse)` - Current (streaming/real-time)

### How to Change:

1. Open `package.json`
2. Find this section (around line 57):
   ```json
   "viewsContainers": {
     "activitybar": [
       {
         "id": "rerender",
         "title": "ReRender",
         "icon": "$(pulse)"  // ← Change this
       }
     ]
   }
   ```
3. Replace with your choice: `"icon": "$(server)"`
4. Reload VS Code to see the change

---

## 💡 Pro Tips

1. **README is Important**: Add screenshots showing your extension in action
2. **Version Numbers**: Use semantic versioning (1.0.0, 1.0.1, 1.1.0, 2.0.0)
3. **Keep Token Safe**: Don't share your GitHub token with anyone
4. **Test Before Publishing**: Always test the .vsix package locally first
5. **Update Regularly**: Fix bugs and add features based on user feedback

---

## 🆘 Need Help?

- **VS Code Publishing Docs**: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- **Marketplace Management**: https://marketplace.visualstudio.com/manage
- **GitHub Tokens**: https://github.com/settings/tokens

---

## 📝 Summary

**Time Required:** ~20 minutes
**Cost:** $0 - Completely FREE
**Requirements:** GitHub account, no credit card needed

**Quick Steps:**
1. Install vsce
2. Create publisher account (FREE)
3. Get GitHub token (FREE)
4. Update package.json
5. Package extension
6. Test locally
7. Publish with `vsce publish -p YOUR_TOKEN`

**You're ready to publish! Good luck! 🚀**

