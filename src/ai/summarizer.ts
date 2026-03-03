import * as vscode from 'vscode';
import axios from 'axios';
import { Logger } from '../utils/logger';

export interface ErrorContext {
    serviceName: string;
    deployId: string;
    status: string;
    commitMessage: string;
    timestamp: string;
    errorLogs?: string;
}

export class ErrorSummarizer {
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    /**
     * Generate a human-friendly error summary
     * Uses AI if configured, otherwise falls back to heuristic analysis
     */
    async summarize(context: ErrorContext): Promise<string> {
        const config = vscode.workspace.getConfiguration('rerender');
        const useAI = config.get<boolean>('useAI', false);
        const aiProvider = config.get<string>('aiProvider', 'groq');
        const openaiApiKey = config.get<string>('openaiApiKey', '');
        const groqApiKey = config.get<string>('groqApiKey', '');

        if (useAI) {
            const apiKey = aiProvider === 'openai' ? openaiApiKey : groqApiKey;
            
            if (apiKey) {
                try {
                    return await this.summarizeWithAI(context, apiKey, aiProvider);
                } catch (error: any) {
                    this.logger.log(`⚠️ AI summarization failed: ${error.message}`);
                    this.logger.log('📝 Falling back to heuristic analysis');
                    return this.summarizeWithHeuristics(context);
                }
            } else {
                this.logger.log(`⚠️ AI enabled but no ${aiProvider} API key set`);
                return this.summarizeWithHeuristics(context);
            }
        } else {
            return this.summarizeWithHeuristics(context);
        }
    }

    /**
     * Use AI (OpenAI or Groq) to generate a human-friendly summary
     */
    private async summarizeWithAI(context: ErrorContext, apiKey: string, provider: string): Promise<string> {
        this.logger.log(`🤖 Generating AI-powered summary using ${provider}...`);

        // Build prompt with ACTUAL ERROR LOGS if available
        let prompt = `Analyze this deployment failure on Render.com and provide a concise, human-friendly explanation:

Service: ${context.serviceName}
Status: ${context.status}
Commit: ${context.commitMessage}
Timestamp: ${context.timestamp}
`;

        // **CRITICAL: Include actual error logs for real analysis**
        if (context.errorLogs && context.errorLogs.trim().length > 0) {
            prompt += `\nACTUAL ERROR LOGS:\n${context.errorLogs}\n`;
            this.logger.log(`📋 Including ${context.errorLogs.length} chars of error logs in AI analysis`);
        } else {
            prompt += `\nNo detailed logs available. Analyzing based on status: ${context.status}\n`;
        }

        prompt += `\nProvide:
1. 🔍 What Went Wrong: A simple explanation of the root cause based on the error logs
2. 💡 Probable Cause: Why this error occurred
3. 🔧 Suggested Fix: Specific actionable steps to resolve it

Keep it concise, actionable, and format with emojis for clarity. Focus on the actual error messages in the logs.`;

        // API endpoint and model based on provider
        const apiConfig = provider === 'openai' 
            ? {
                url: 'https://api.openai.com/v1/chat/completions',
                model: 'gpt-3.5-turbo'
              }
            : {
                url: 'https://api.groq.com/openai/v1/chat/completions',
                model: 'llama-3.1-8b-instant' // Fast and accurate
              };

        try {
            const response = await axios.post(
                apiConfig.url,
                {
                    model: apiConfig.model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful DevOps assistant analyzing deployment failures. Focus on extracting the root cause from error logs and providing specific, actionable solutions.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 500, // Increased for detailed analysis
                    temperature: 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 15000
                }
            );

            const summary = response.data.choices[0]?.message?.content?.trim();
            if (summary) {
                this.logger.log(`✅ AI summary generated using ${provider}`);
                return summary;
            } else {
                throw new Error('No summary returned from AI');
            }
        } catch (error: any) {
            throw new Error(`${provider} API error: ${error.message}`);
        }
    }

    /**
     * Use heuristic analysis to generate a summary
     */
    private summarizeWithHeuristics(context: ErrorContext): string {
        const status = context.status.toLowerCase();
        const commitMsg = context.commitMessage.toLowerCase();
        const serviceName = context.serviceName;
        const logs = context.errorLogs?.toLowerCase() || '';

        let explanation = '';
        let cause = '';
        let fix = '';

        // **ANALYZE ACTUAL ERROR LOGS FIRST** if available
        if (logs && logs.length > 0) {
            this.logger.log(`🔍 Analyzing error logs with heuristics...`);
            
            // Check for specific error patterns in logs
            if (logs.includes('cannot create a client without an access token') || 
                logs.includes('access token') || 
                logs.includes('unauthorized')) {
                explanation = `❌ Authentication error in ${serviceName}.`;
                cause = '🔐 Missing or invalid authentication token/API key.';
                fix = '💡 Fix: Check your environment variables for API keys, access tokens, or credentials. Ensure they are set correctly in Render dashboard.';
            } else if (logs.includes('enoent') || logs.includes('no such file')) {
                explanation = `❌ File not found error during deployment.`;
                cause = '📁 Required file or directory is missing.';
                fix = '💡 Fix: Verify file paths, check .gitignore, and ensure all required files are committed to your repository.';
            } else if (logs.includes('module not found') || logs.includes('cannot find module')) {
                explanation = `❌ Module/dependency not found in ${serviceName}.`;
                cause = '📦 Missing npm package or incorrect import path.';
                fix = '💡 Fix: Run "npm install" locally, verify package.json dependencies, and ensure imports match installed packages.';
            } else if (logs.includes('econnrefused') || logs.includes('connection refused')) {
                explanation = `❌ Connection refused error.`;
                cause = '🌐 Cannot connect to database or external service.';
                fix = '💡 Fix: Verify DATABASE_URL and other connection strings. Check if external services are accessible from Render.';
            } else if (logs.includes('port') && logs.includes('already in use')) {
                explanation = `❌ Port conflict detected.`;
                cause = '🔌 Port is already in use.';
                fix = '💡 Fix: Use process.env.PORT instead of hardcoded port numbers.';
            } else if (logs.includes('database') || logs.includes('db connection')) {
                explanation = `❌ Database connection error in ${serviceName}.`;
                cause = '🗄️ Cannot connect to database.';
                fix = '💡 Fix: Verify DATABASE_URL environment variable is set correctly and database is accessible.';
            } else if (logs.includes('timeout') || logs.includes('timed out')) {
                explanation = `❌ Operation timed out during deployment.`;
                cause = '⏱️ Build or operation exceeded time limit.';
                fix = '💡 Fix: Optimize build scripts, check for hanging processes, or increase timeout limits if possible.';
            } else if (logs.includes('permission denied') || logs.includes('eacces')) {
                explanation = `❌ Permission denied error.`;
                cause = '🔒 Insufficient file or directory permissions.';
                fix = '💡 Fix: Check file permissions in your repository or adjust deployment settings.';
            } else if (logs.includes('out of memory') || logs.includes('heap') || logs.includes('killed')) {
                explanation = `❌ Out of memory error.`;
                cause = '💾 Application consumed too much memory.';
                fix = '💡 Fix: Optimize memory usage or upgrade to a larger Render instance.';
            } else {
                // Generic error from logs
                explanation = `❌ Deployment failed for ${serviceName}.`;
                cause = `🔍 Error detected in logs (see details below).`;
                fix = '💡 Fix: Review the error logs for specific error messages and stack traces.';
            }
            
            return `${explanation}\n${cause}\n${fix}\n\n📋 Log excerpt:\n${context.errorLogs?.split('\n').slice(0, 10).join('\n') || 'No logs'}`;
        }

        // Fallback to status-based analysis if no logs
        // Analyze based on status
        if (status.includes('build_failed') || status.includes('failed')) {
            explanation = `❌ The build process failed for ${serviceName}.`;

            // Detect common issues from commit message
            if (commitMsg.includes('dependency') || commitMsg.includes('package')) {
                cause = '📦 Likely cause: Dependency or package installation issue.';
                fix = '💡 Fix: Check package.json dependencies, lock files, and ensure all required packages are available.';
            } else if (commitMsg.includes('test')) {
                cause = '🧪 Likely cause: Tests are failing.';
                fix = '💡 Fix: Review test logs, fix failing tests, or temporarily skip them if appropriate.';
            } else if (commitMsg.includes('syntax') || commitMsg.includes('error')) {
                cause = '⚠️ Likely cause: Syntax or compilation error in the code.';
                fix = '💡 Fix: Review build logs for specific error messages and fix code issues.';
            } else if (commitMsg.includes('env') || commitMsg.includes('variable')) {
                cause = '🔐 Likely cause: Missing or incorrect environment variables.';
                fix = '💡 Fix: Verify all required environment variables are set in Render dashboard.';
            } else {
                cause = '🔍 Likely cause: Build script failed or compilation error.';
                fix = '💡 Fix: Check build logs in Render dashboard for specific error details.';
            }
        } else if (status.includes('crashed')) {
            explanation = `💥 ${serviceName} crashed after deployment.`;
            cause = '🔍 Likely cause: Runtime error, missing dependencies, or configuration issue.';
            fix = '💡 Fix: Check runtime logs for error details. Common issues: missing DATABASE_URL, PORT configuration, or unhandled exceptions.';
        } else if (status.includes('canceled')) {
            explanation = `⏹️ Deployment was canceled for ${serviceName}.`;
            cause = '👤 Likely cause: Manual cancellation or timeout.';
            fix = '💡 Fix: Retry the deployment or investigate if it was stuck.';
        } else {
            explanation = `⚠️ Deployment failed for ${serviceName} with status: ${status}.`;
            cause = '🔍 Cause: Check deployment logs for details.';
            fix = '💡 Fix: Review the Render dashboard for specific error messages.';
        }

        return `${explanation}\n${cause}\n${fix}`;
    }

    /**
     * Extract actionable insights from error logs
     */
    extractInsights(logs: string): string[] {
        const insights: string[] = [];

        // Common error patterns and their insights
        const patterns = [
            {
                regex: /DATABASE_URL|POSTGRES/i,
                insight: '🔐 Missing database connection - verify DATABASE_URL environment variable'
            },
            {
                regex: /PORT|EADDRINUSE/i,
                insight: '🔌 Port configuration issue - ensure PORT environment variable is set correctly'
            },
            {
                regex: /npm ERR!|yarn error/i,
                insight: '📦 Package installation failed - check package.json and lock file'
            },
            {
                regex: /Module not found|Cannot find module/i,
                insight: '📁 Missing module - ensure all dependencies are in package.json'
            },
            {
                regex: /permission denied|EACCES/i,
                insight: '🔒 Permission error - check file permissions or access rights'
            },
            {
                regex: /timeout|ETIMEDOUT/i,
                insight: '⏱️ Timeout error - operation took too long, may need optimization'
            },
            {
                regex: /out of memory|ENOMEM/i,
                insight: '💾 Memory issue - consider increasing instance size or optimizing memory usage'
            }
        ];

        for (const pattern of patterns) {
            if (pattern.regex.test(logs)) {
                insights.push(pattern.insight);
            }
        }

        return insights;
    }
}
