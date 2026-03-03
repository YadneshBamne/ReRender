/**
 * Cache for tracking notified deploys to prevent duplicate notifications
 */
export class DeployCache {
    private cache: Map<string, DeployCacheEntry>;

    constructor() {
        this.cache = new Map();
    }

    /**
     * Check if a deploy has been notified
     */
    has(serviceId: string, deployId: string): boolean {
        const key = this.getKey(serviceId, deployId);
        return this.cache.has(key);
    }

    /**
     * Mark a deploy as notified
     */
    set(serviceId: string, deployId: string): void {
        const key = this.getKey(serviceId, deployId);
        this.cache.set(key, {
            serviceId,
            deployId,
            timestamp: new Date()
        });
    }

    /**
     * Get a cache entry
     */
    get(serviceId: string, deployId: string): DeployCacheEntry | undefined {
        const key = this.getKey(serviceId, deployId);
        return this.cache.get(key);
    }

    /**
     * Clear a specific entry
     */
    delete(serviceId: string, deployId: string): boolean {
        const key = this.getKey(serviceId, deployId);
        return this.cache.delete(key);
    }

    /**
     * Clear all entries for a service
     */
    deleteService(serviceId: string): number {
        let count = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (entry.serviceId === serviceId) {
                this.cache.delete(key);
                count++;
            }
        }
        return count;
    }

    /**
     * Clear entries older than specified hours
     */
    clearOld(maxAgeHours: number): number {
        const now = new Date();
        const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
        let count = 0;

        for (const [key, entry] of this.cache.entries()) {
            const age = now.getTime() - entry.timestamp.getTime();
            if (age > maxAgeMs) {
                this.cache.delete(key);
                count++;
            }
        }

        return count;
    }

    /**
     * Clear all entries
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache size
     */
    size(): number {
        return this.cache.size;
    }

    /**
     * Get all entries for a service
     */
    getServiceEntries(serviceId: string): DeployCacheEntry[] {
        const entries: DeployCacheEntry[] = [];
        for (const entry of this.cache.values()) {
            if (entry.serviceId === serviceId) {
                entries.push(entry);
            }
        }
        return entries;
    }

    private getKey(serviceId: string, deployId: string): string {
        return `${serviceId}:${deployId}`;
    }
}

export interface DeployCacheEntry {
    serviceId: string;
    deployId: string;
    timestamp: Date;
}
