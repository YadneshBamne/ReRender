# Render Deploy Status Reference

This document lists all deploy statuses recognized by Render Guardian and how they're categorized.

## 🟢 Healthy States (Green Icon)
Services with these statuses are running successfully:

- **live** - Service is live and serving traffic
- **available** - Service is available for use
- **running** - Service is currently running
- **active** - Service is active

## 🟡 Deploying States (Yellow Icon)
Services with these statuses are currently deploying or updating:

- **building** - Build in progress
- **deploying** - Deployment in progress
- **updating** - Update in progress
- **created** - Service created, awaiting build
- **build_in_progress** - Build actively running
- **deploy_in_progress** - Deployment actively running
- **pre_deploy** - Pre-deploy hook preparation
- **pre_deploy_in_progress** - Pre-deploy hook executing
- **update_in_progress** - Update actively running

## 🔴 Failed States (Red Icon)
Services with these statuses have failed:

- **failed** - General failure
- **build_failed** - Build process failed
- **deploy_failed** - Deployment process failed
- **update_failed** - Update process failed
- **pre_deploy_failed** - Pre-deploy hook failed
- **canceled** - Deploy canceled by user
- **cancelled** - Deploy cancelled (alternate spelling)
- **crashed** - Service crashed
- **deactivated** - Service deactivated
- **error** - General error state
- **timed_out** - Operation timed out
- **evicted** - Service was evicted

## ⚪ Unknown States (White Icon)
Any status not listed above will be marked as "unknown" and logged in the Output panel. If you see an unknown status:

1. Check the Render Guardian Output panel (View → Output → Select "Render Guardian")
2. Report it in the issues section with the exact status name
3. We'll add support for it in the next update

## Status Detection Logic

The extension uses three independent checks to categorize statuses:

1. **ErrorDetector.isFailureStatus()** - Used for triggering failure notifications
2. **ErrorDetector.isDeployingStatus()** - Used for adaptive polling (30s during deploys)
3. **RenderClient.getServiceHealth()** - Used for TreeView status icons

All three are synchronized to ensure consistent behavior across:
- Status bar display
- TreeView icons
- Failure notifications
- Polling speed adjustment

## Testing Statuses

To verify status detection works correctly:

1. Check the Output panel for status classification logs:
   ```
   ✅ service-name: live (healthy)
   🟡 service-name: deploying (deploying)
   ❌ service-name: update_failed (failed)
   ⚪ service-name: suspended (unknown status - please report this)
   ```

2. Status bar should show accurate counts:
   ```
   📊 Status: X healthy, Y deploying, Z failed
   ```

3. TreeView icons should match:
   - 🟢 = Healthy
   - 🟡 = Deploying
   - 🔴 = Failed
   - ⚪ = Unknown

## Common Status Transitions

Typical deploy flow:
```
created → building → deploying → live
```

Failed deploy flow:
```
created → building → build_failed
created → building → deploying → deploy_failed
live → updating → update_failed
```

Pre-deploy hook flow:
```
created → pre_deploy → pre_deploy_in_progress → building → deploying → live
created → pre_deploy → pre_deploy_failed (stops here)
```

## Notification Behavior

Render Guardian will send VS Code notifications for:
- ✅ Any transition to a **failed state** (if notifications enabled)
- 🔕 No notifications for healthy or deploying states
- 📊 Status bar always shows current counts

Notifications include:
- Service name
- Failed status type
- Deploy timestamp
- AI-powered summary (if Groq/OpenAI configured)
- Button to view service details

## Configuration

Status detection works automatically with no configuration needed. However, you can influence behavior:

```json
{
    "renderGuardian.pollIntervalSeconds": 180,  // Slower polling for stable services (default)
    "renderGuardian.enableNotifications": true,  // Enable failure notifications
    "renderGuardian.useAI": false,               // Enable AI summaries for failures
    "renderGuardian.aiProvider": "groq"          // Use Groq (free) or OpenAI (paid)
}
```

During deployments, polling automatically speeds up to 30 seconds regardless of the configured interval.

## Troubleshooting

**Q: My service shows as "unknown" even though it's working**
A: Check the Render Guardian Output panel to see the exact status. If it's a valid Render status we don't recognize yet, please report it.

**Q: Status isn't updating**
A: 
1. Check the Status Bar for last update time
2. Run "Render Guardian: Refresh Services" command
3. Check Output panel for API errors

**Q: Multiple services stuck in "deploying" state**
A: This is normal if you triggered multiple deployments. The extension will poll every 30 seconds until all complete.

**Q: I don't see failure notifications**
A: 
1. Ensure `renderGuardian.enableNotifications` is true
2. Check if the deploy already failed before extension was activated
3. Extension only notifies once per failed deploy (prevents spam)

## Reference Links

- [Render Deploy API Docs](https://api-docs.render.com/reference/get-deploys)
- [VS Code Status Bar API](https://code.visualstudio.com/api/references/vscode-api#StatusBarItem)
- [Render Service Status](https://render.com/docs/deploys)
