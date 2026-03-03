import * as vscode from 'vscode';
import { DeployCache } from '../utils/cache';

export interface FailureInfo {
    serviceId: string;
    deployId: string;
    timestamp: Date;
    status: string;
}

export class ErrorDetector {
    private notifiedDeploys: DeployCache;
    private activeDeployments: Map<string, string>; // serviceId -> deployId
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.notifiedDeploys = new DeployCache();
        this.activeDeployments = new Map();
    }

    /**
     * Check if we've already sent a notification for this deploy
     */
    hasNotified(serviceId: string, deployId: string): boolean {
        return this.notifiedDeploys.has(serviceId, deployId);
    }

    /**
     * Mark a deploy as having been notified
     */
    markNotified(serviceId: string, deployId: string): void {
        this.notifiedDeploys.set(serviceId, deployId);
    }

    /**
     * Track that a service is currently deploying
     */
    markDeploying(serviceId: string, deployId: string | undefined): void {
        if (deployId) {
            this.activeDeployments.set(serviceId, deployId);
        }
    }

    /**
     * Check if any services are currently deploying
     */
    hasActiveDeployments(): boolean {
        return this.activeDeployments.size > 0;
    }

    /**
     * Clear deploying status for a service
     */
    clearDeploying(serviceId: string): void {
        this.activeDeployments.delete(serviceId);
    }

    /**
     * Get all active deployments
     */
    getActiveDeployments(): Map<string, string> {
        return new Map(this.activeDeployments);
    }

    /**
     * Detect if a deploy status indicates failure
     */
    static isFailureStatus(status: string): boolean {
        const failureStatuses = [
            'failed',
            'build_failed',
            'deploy_failed',
            'update_failed',
            'pre_deploy_failed',
            'canceled',
            'cancelled',
            'crashed',
            'deactivated',
            'error',
            'timed_out',
            'evicted'
        ];

        return failureStatuses.includes(status.toLowerCase());
    }

    /**
     * Detect if a deploy status indicates it's in progress
     */
    static isDeployingStatus(status: string): boolean {
        const deployingStatuses = [
            'building',
            'deploying',
            'updating',
            'created',
            'build_in_progress',
            'deploy_in_progress',
            'pre_deploy',
            'pre_deploy_in_progress',
            'update_in_progress'
        ];

        return deployingStatuses.includes(status.toLowerCase());
    }

    /**
     * Detect if a deploy status indicates success
     */
    static isSuccessStatus(status: string): boolean {
        const successStatuses = [
            'live',
            'available',
            'running',
            'active'
        ];

        return successStatuses.includes(status.toLowerCase());
    }

    /**
     * Extract error patterns from deploy/log messages
     */
    static extractErrorPatterns(message: string): string[] {
        const patterns: string[] = [];

        // Common error patterns
        const errorRegexes = [
            /error:\s*(.+)/gi,
            /exception:\s*(.+)/gi,
            /failed:\s*(.+)/gi,
            /cannot\s+(.+)/gi,
            /unable\s+to\s+(.+)/gi,
            /missing\s+(.+)/gi,
            /not\s+found:\s*(.+)/gi,
            /undefined:\s*(.+)/gi
        ];

        for (const regex of errorRegexes) {
            const matches = message.matchAll(regex);
            for (const match of matches) {
                if (match[1]) {
                    patterns.push(match[1].trim());
                }
            }
        }

        return patterns;
    }

    /**
     * Clear old notifications (cleanup)
     */
    clearOldNotifications(maxAgeHours: number = 24): void {
        this.notifiedDeploys.clearOld(maxAgeHours);
    }
}
