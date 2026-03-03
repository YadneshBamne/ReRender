# 🤖 AI Setup Guide - Groq vs OpenAI

The extension supports AI-powered error summaries using either **Groq** or **OpenAI**. Here's how to set them up:

---

## 🚀 Option 1: Groq (RECOMMENDED)

**Why Groq?**
- ✅ **FREE** - Generous free tier
- ✅ **FAST** - Up to 10x faster than OpenAI
- ✅ **Easy** - Simple sign-up, instant API key
- ✅ **Quality** - Uses Llama 3.1 model (excellent results)

### Get Your Groq API Key

1. **Go to Groq Console**
   - Visit: https://console.groq.com
   - Click "Sign In" (or "Start Building")

2. **Create Account**
   - Sign up with Google, GitHub, or email
   - No credit card required!

3. **Create API Key**
   - After login, go to: https://console.groq.com/keys
   - Click "Create API Key"
   - Give it a name (e.g., "VS Code Render Guardian")
   - Click "Submit"

4. **Copy Your Key**
   - Your API key will be shown (starts with `gsk_`)
   - **Copy it immediately** - you won't see it again!
   - Example: `gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Configure in VS Code

1. Open Settings: `Ctrl+,`
2. Search: "Render Guardian"
3. Configure:
   ```
   Render Guardian: Use AI → ✓ (checked)
   Render Guardian: Ai Provider → groq
   Render Guardian: Groq Api Key → paste your key
   ```

**You're done!** The extension will now use Groq for AI summaries.

---

## 🤖 Option 2: OpenAI

**Why OpenAI?**
- ✅ Well-known, battle-tested
- ✅ GPT-3.5 Turbo model
- ❌ Requires payment (costs ~$0.002 per request)
- ❌ Slower than Groq

### Get Your OpenAI API Key

1. **Go to OpenAI Platform**
   - Visit: https://platform.openai.com/api-keys
   - Sign in to your account

2. **Add Payment Method** (Required)
   - Go to: https://platform.openai.com/account/billing
   - Add a credit card
   - OpenAI charges per API call

3. **Create API Key**
   - Go to: https://platform.openai.com/api-keys
   - Click "+ Create new secret key"
   - Name it (e.g., "Render Guardian")
   - Click "Create secret key"

4. **Copy Your Key**
   - Your API key will be shown (starts with `sk-`)
   - **Copy it immediately** - you won't see it again!
   - Example: `sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Configure in VS Code

1. Open Settings: `Ctrl+,`
2. Search: "Render Guardian"
3. Configure:
   ```
   Render Guardian: Use AI → ✓ (checked)
   Render Guardian: Ai Provider → openai
   Render Guardian: Openai Api Key → paste your key
   ```

---

## 📊 Comparison

| Feature | Groq | OpenAI |
|---------|------|--------|
| **Cost** | FREE (generous limits) | ~$0.002 per summary |
| **Speed** | Very fast (~1-2 sec) | Moderate (~3-5 sec) |
| **Model** | Llama 3.1 8B | GPT-3.5 Turbo |
| **Sign-up** | No credit card | Requires payment |
| **Quality** | Excellent | Excellent |
| **Rate Limits** | 30 req/min free tier | Depends on plan |

**Recommendation:** Start with **Groq** - it's free, fast, and works great!

---

## 🧪 Test Your AI Setup

After configuring:

1. **Check Output Channel**
   - View → Output → "Render Guardian"
   - You should see: `🤖 Generating AI-powered summary using groq...`

2. **Trigger a Test Failure**
   - Make a deploy fail on Render
   - Wait for the extension to detect it
   - Check the notification - it should have an AI-generated summary

3. **Verify It's Working**
   - Output channel shows: `✅ AI summary generated using groq`
   - Notification has detailed, human-friendly explanation
   - Includes probable cause and suggested fix

---

## 🔧 Troubleshooting

### "AI enabled but no groq API key set"

**Solution:** You enabled AI but didn't add the key
- Open Settings → Search "Render Guardian"
- Set `Groq Api Key` to your actual key

### "groq API error: 401"

**Solution:** Invalid API key
- Double-check you copied the full key
- Make sure it starts with `gsk_`
- Try creating a new key at console.groq.com

### "AI summarization failed: timeout"

**Solution:** Network issue or API down
- Check your internet connection
- Extension will fall back to heuristic analysis
- Try again in a few minutes

### AI summaries seem generic

**Solution:** This is normal for simple errors
- AI works best with complex, ambiguous failures
- For common errors (missing env vars), heuristic mode is often sufficient
- AI adds value for unusual or complex failures

---

## 💡 Smart Fallback

The extension is designed to **always work**, even if AI fails:

```
1. Try AI (if enabled and key is set)
   └─ Success → Return AI summary
   └─ Fail → Log error and continue to step 2

2. Use heuristic analysis (built-in patterns)
   └─ Always returns a useful summary
```

You'll never get "no summary" - it just might be less detailed without AI.

---

## 🔐 Security

**Your API keys are safe:**
- ✅ Stored in VS Code settings (not in code)
- ✅ Never logged to console
- ✅ Never sent anywhere except the AI provider
- ✅ Not included in extension package
- ✅ Local to your machine

**Best practices:**
- Don't share your API keys
- Don't commit them to Git
- Rotate them periodically
- Use read-only keys if available

---

## 📝 Example AI Output

**Heuristic (no AI):**
```
❌ The build process failed for my-web-service.
📦 Likely cause: Dependency or package installation issue.
💡 Fix: Check package.json dependencies, lock files, and ensure all required packages are available.
```

**AI-Enhanced (Groq/OpenAI):**
```
❌ Build failed for my-web-service

What happened:
The deployment failed during the npm install phase. The error indicates 
that the package "@types/react@18.2.0" could not be found in the npm registry.

Probable cause:
This version of @types/react may have been unpublished or there's a typo 
in your package.json. The commit message mentions "updated dependencies" 
which suggests a recent change to package versions.

Suggested fix:
1. Check package.json and verify the @types/react version
2. Try using "^18.0.0" instead of exact version "18.2.0"
3. Run `npm install` locally to test
4. Update package-lock.json and redeploy
```

---

## Quick Reference

| Provider | Website | Key Format | Cost |
|----------|---------|------------|------|
| Groq | https://console.groq.com | `gsk_...` | FREE |
| OpenAI | https://platform.openai.com | `sk-...` | Paid |

**Recommended:** Use Groq! 🚀

---

**Need help?** Check the main README.md or the Output channel in VS Code.
