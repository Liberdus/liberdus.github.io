/**
 * UnifiedCache - Comprehensive localStorage caching system
 * Provides instant data display with background refresh across the entire site
 * 
 * Features:
 * - Automatic cache expiry with configurable TTL per data type
 * - Network and wallet-scoped cache keys
 * - Background refresh with stale-while-revalidate pattern
 * - Manual cache clearing for developers
 * - Memory + localStorage dual-layer caching
 * - No sensitive data storage (only public blockchain data)
 * 
 * @version 1.0.0
 */
(function(global) {
    'use strict';

    // Prevent redeclaration
    if (global.UnifiedCache) {
        console.warn('⚠️ UnifiedCache already exists, skipping redeclaration');
        return;
    }

    class UnifiedCache {
        constructor() {
            this.memoryCache = new Map();
            this.isInitialized = false;
            this.storagePrefix = 'lp_staking_cache_';
            
            // Cache TTL configuration (in milliseconds)
            this.cacheTTL = {
                // User-specific data (shorter TTL)
                userBalances: 30000,        // 30 seconds
                userStakes: 30000,          // 30 seconds
                userRewards: 20000,         // 20 seconds
                userAllowances: 60000,      // 1 minute
                
                // Pool/Pair data (medium TTL)
                pairInfo: 300000,           // 5 minutes
                pairList: 300000,           // 5 minutes
                poolStats: 120000,          // 2 minutes
                tvlData: 60000,             // 1 minute
                aprData: 120000,            // 2 minutes
                
                // Contract data (medium TTL)
                contractStats: 120000,      // 2 minutes
                contractInfo: 600000,       // 10 minutes
                hourlyRate: 300000,         // 5 minutes
                requiredApprovals: 600000,  // 10 minutes
                
                // Admin/Governance data (shorter TTL for real-time updates)
                proposals: 30000,           // 30 seconds
                proposalDetails: 20000,     // 20 seconds
                actionCounter: 30000,       // 30 seconds
                
                // Price data (longer TTL)
                tokenPrices: 300000,        // 5 minutes
                lpPrices: 300000,           // 5 minutes
                
                // Static/Semi-static data (longer TTL)
                tokenInfo: 3600000,         // 1 hour
                networkInfo: 3600000,       // 1 hour
                
                // Default fallback
                default: 300000             // 5 minutes
            };
            
            // Track active refresh operations to prevent duplicates
            this.activeRefreshes = new Set();
            
            // Statistics for monitoring
            this.stats = {
                hits: 0,
                misses: 0,
                refreshes: 0,
                errors: 0
            };
            
            console.log('✅ UnifiedCache initialized');
        }

        /**
         * Initialize the cache system
         */
        initialize() {
            if (this.isInitialized) {
                console.warn('⚠️ UnifiedCache already initialized');
                return;
            }

            // Check localStorage availability
            if (!this.isLocalStorageAvailable()) {
                console.warn('⚠️ localStorage not available, using memory-only cache');
            }

            // Clean up expired entries on initialization
            this.cleanupExpiredEntries();

            this.isInitialized = true;
            console.log('✅ UnifiedCache ready');
        }

        /**
         * Check if localStorage is available
         */
        isLocalStorageAvailable() {
            try {
                const test = '__cache_test__';
                localStorage.setItem(test, test);
                localStorage.removeItem(test);
                return true;
            } catch (e) {
                return false;
            }
        }

        /**
         * Generate cache key with network and wallet scoping
         */
        generateKey(dataType, params = {}) {
            const network = params.network || window.CONFIG?.NETWORK_ID || 'unknown';
            const wallet = params.wallet || window.stateManager?.getState('wallet.address') || 'anonymous';
            
            // Create a unique key based on data type and parameters
            let key = `${this.storagePrefix}${network}_${dataType}`;
            
            // Add wallet scope for user-specific data
            if (this.isUserSpecificData(dataType)) {
                key += `_${wallet.toLowerCase()}`;
            }
            
            // Add additional parameters to key
            if (params.id) key += `_${params.id}`;
            if (params.address) key += `_${params.address.toLowerCase()}`;
            if (params.pairAddress) key += `_${params.pairAddress.toLowerCase()}`;
            
            return key;
        }

        /**
         * Check if data type is user-specific
         */
        isUserSpecificData(dataType) {
            const userSpecificTypes = [
                'userBalances',
                'userStakes',
                'userRewards',
                'userAllowances'
            ];
            return userSpecificTypes.includes(dataType);
        }

        /**
         * Get data from cache (memory first, then localStorage)
         */
        get(dataType, params = {}) {
            const key = this.generateKey(dataType, params);
            
            // Try memory cache first (fastest)
            if (this.memoryCache.has(key)) {
                const cached = this.memoryCache.get(key);
                if (this.isValid(cached)) {
                    this.stats.hits++;
                    console.log(`💾 Cache HIT (memory): ${dataType}`, { age: Date.now() - cached.timestamp });
                    return cached.data;
                }
            }
            
            // Try localStorage (slower but persistent)
            if (this.isLocalStorageAvailable()) {
                try {
                    const stored = localStorage.getItem(key);
                    if (stored) {
                        const cached = JSON.parse(stored);
                        if (this.isValid(cached)) {
                            // Promote to memory cache
                            this.memoryCache.set(key, cached);
                            this.stats.hits++;
                            console.log(`💾 Cache HIT (localStorage): ${dataType}`, { age: Date.now() - cached.timestamp });
                            return cached.data;
                        }
                    }
                } catch (error) {
                    console.warn(`⚠️ Error reading from localStorage:`, error);
                }
            }
            
            this.stats.misses++;
            console.log(`❌ Cache MISS: ${dataType}`);
            return null;
        }

        /**
         * Set data in cache (both memory and localStorage)
         */
        set(dataType, data, params = {}) {
            const key = this.generateKey(dataType, params);
            const ttl = this.cacheTTL[dataType] || this.cacheTTL.default;
            
            const cacheEntry = {
                data: data,
                timestamp: Date.now(),
                ttl: ttl,
                dataType: dataType
            };
            
            // Store in memory cache
            this.memoryCache.set(key, cacheEntry);
            
            // Store in localStorage (if available and data is not too large)
            if (this.isLocalStorageAvailable()) {
                try {
                    const serialized = JSON.stringify(cacheEntry);
                    // Only store if less than 100KB to avoid quota issues
                    if (serialized.length < 100000) {
                        localStorage.setItem(key, serialized);
                    } else {
                        console.warn(`⚠️ Data too large for localStorage: ${dataType} (${serialized.length} bytes)`);
                    }
                } catch (error) {
                    if (error.name === 'QuotaExceededError') {
                        console.warn('⚠️ localStorage quota exceeded, clearing old entries');
                        this.cleanupOldEntries();
                        // Try again after cleanup
                        try {
                            localStorage.setItem(key, JSON.stringify(cacheEntry));
                        } catch (retryError) {
                            console.error('❌ Failed to store in localStorage after cleanup:', retryError);
                        }
                    } else {
                        console.error('❌ Error storing in localStorage:', error);
                    }
                }
            }
            
            console.log(`✅ Cache SET: ${dataType}`, { ttl: `${ttl}ms` });
        }

        /**
         * Check if cached entry is still valid
         */
        isValid(cacheEntry) {
            if (!cacheEntry || !cacheEntry.timestamp) {
                return false;
            }
            
            const age = Date.now() - cacheEntry.timestamp;
            const ttl = cacheEntry.ttl || this.cacheTTL.default;
            
            return age < ttl;
        }

        /**
         * Check if cached entry is stale but still usable
         * (for stale-while-revalidate pattern)
         */
        isStale(cacheEntry) {
            if (!cacheEntry || !cacheEntry.timestamp) {
                return true;
            }
            
            const age = Date.now() - cacheEntry.timestamp;
            const ttl = cacheEntry.ttl || this.cacheTTL.default;
            
            // Consider stale if older than 50% of TTL
            return age > (ttl * 0.5);
        }

        /**
         * Get data with automatic background refresh (stale-while-revalidate)
         */
        async getWithRefresh(dataType, fetchFunction, params = {}) {
            const cached = this.get(dataType, params);
            
            // If we have valid cached data, return it immediately
            if (cached !== null) {
                // Check if data is stale and trigger background refresh
                const key = this.generateKey(dataType, params);
                const cacheEntry = this.memoryCache.get(key) || 
                                  (this.isLocalStorageAvailable() ? 
                                   JSON.parse(localStorage.getItem(key) || 'null') : null);
                
                if (cacheEntry && this.isStale(cacheEntry)) {
                    // Trigger background refresh without waiting
                    this.refreshInBackground(dataType, fetchFunction, params);
                }
                
                return cached;
            }
            
            // No cached data, fetch fresh data
            return await this.fetchAndCache(dataType, fetchFunction, params);
        }

        /**
         * Fetch fresh data and cache it
         */
        async fetchAndCache(dataType, fetchFunction, params = {}) {
            const refreshKey = `${dataType}_${JSON.stringify(params)}`;

            // Prevent duplicate fetches
            if (this.activeRefreshes.has(refreshKey)) {
                console.log(`⏳ Refresh already in progress for ${dataType}, waiting...`);
                // Wait a bit and try to get from cache
                await new Promise(resolve => setTimeout(resolve, 100));
                return this.get(dataType, params);
            }

            this.activeRefreshes.add(refreshKey);

            try {
                console.log(`🔄 Fetching fresh data: ${dataType}`);
                const data = await fetchFunction();

                if (data !== null && data !== undefined) {
                    this.set(dataType, data, params);
                    this.stats.refreshes++;
                }

                return data;
            } catch (error) {
                console.error(`❌ Error fetching ${dataType}:`, error);
                this.stats.errors++;

                // Return stale data if available
                return this.get(dataType, params);
            } finally {
                this.activeRefreshes.delete(refreshKey);
            }
        }

        /**
         * Refresh data in background without blocking
         */
        refreshInBackground(dataType, fetchFunction, params = {}) {
            console.log(`🔄 Background refresh triggered for ${dataType}`);

            // Don't await, let it run in background
            this.fetchAndCache(dataType, fetchFunction, params).catch(error => {
                console.warn(`⚠️ Background refresh failed for ${dataType}:`, error);
            });
        }

        /**
         * Invalidate specific cache entry
         */
        invalidate(dataType, params = {}) {
            const key = this.generateKey(dataType, params);

            // Remove from memory cache
            this.memoryCache.delete(key);

            // Remove from localStorage
            if (this.isLocalStorageAvailable()) {
                try {
                    localStorage.removeItem(key);
                } catch (error) {
                    console.warn(`⚠️ Error removing from localStorage:`, error);
                }
            }

            console.log(`🗑️ Cache invalidated: ${dataType}`);
        }

        /**
         * Invalidate all cache entries of a specific type
         */
        invalidateType(dataType) {
            let count = 0;

            // Clear from memory cache
            for (const key of this.memoryCache.keys()) {
                if (key.includes(`_${dataType}_`) || key.endsWith(`_${dataType}`)) {
                    this.memoryCache.delete(key);
                    count++;
                }
            }

            // Clear from localStorage
            if (this.isLocalStorageAvailable()) {
                try {
                    const keysToRemove = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith(this.storagePrefix) &&
                            (key.includes(`_${dataType}_`) || key.endsWith(`_${dataType}`))) {
                            keysToRemove.push(key);
                        }
                    }
                    keysToRemove.forEach(key => localStorage.removeItem(key));
                    count += keysToRemove.length;
                } catch (error) {
                    console.warn(`⚠️ Error clearing localStorage:`, error);
                }
            }

            console.log(`🗑️ Invalidated ${count} cache entries for type: ${dataType}`);
        }

        /**
         * Clear all cache entries
         */
        clearAll() {
            // Clear memory cache
            const memoryCount = this.memoryCache.size;
            this.memoryCache.clear();

            // Clear localStorage
            let storageCount = 0;
            if (this.isLocalStorageAvailable()) {
                try {
                    const keysToRemove = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith(this.storagePrefix)) {
                            keysToRemove.push(key);
                        }
                    }
                    keysToRemove.forEach(key => localStorage.removeItem(key));
                    storageCount = keysToRemove.length;
                } catch (error) {
                    console.warn(`⚠️ Error clearing localStorage:`, error);
                }
            }

            console.log(`🗑️ Cache cleared: ${memoryCount} memory entries, ${storageCount} localStorage entries`);
        }

        /**
         * Clean up expired entries
         */
        cleanupExpiredEntries() {
            let count = 0;

            // Clean memory cache
            for (const [key, entry] of this.memoryCache.entries()) {
                if (!this.isValid(entry)) {
                    this.memoryCache.delete(key);
                    count++;
                }
            }

            // Clean localStorage
            if (this.isLocalStorageAvailable()) {
                try {
                    const keysToRemove = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const storageKey = localStorage.key(i);
                        if (storageKey && storageKey.startsWith(this.storagePrefix)) {
                            try {
                                const entry = JSON.parse(localStorage.getItem(storageKey));
                                if (!this.isValid(entry)) {
                                    keysToRemove.push(storageKey);
                                }
                            } catch (e) {
                                // Invalid JSON, remove it
                                keysToRemove.push(storageKey);
                            }
                        }
                    }
                    keysToRemove.forEach(key => localStorage.removeItem(key));
                    count += keysToRemove.length;
                } catch (error) {
                    console.warn(`⚠️ Error cleaning localStorage:`, error);
                }
            }

            if (count > 0) {
                console.log(`🧹 Cleaned up ${count} expired cache entries`);
            }
        }

        /**
         * Clean up old entries when quota is exceeded
         */
        cleanupOldEntries() {
            if (!this.isLocalStorageAvailable()) return;

            try {
                const entries = [];

                // Collect all cache entries with timestamps
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(this.storagePrefix)) {
                        try {
                            const entry = JSON.parse(localStorage.getItem(key));
                            entries.push({ key, timestamp: entry.timestamp || 0 });
                        } catch (e) {
                            // Invalid entry, mark for removal
                            entries.push({ key, timestamp: 0 });
                        }
                    }
                }

                // Sort by timestamp (oldest first)
                entries.sort((a, b) => a.timestamp - b.timestamp);

                // Remove oldest 25% of entries
                const removeCount = Math.ceil(entries.length * 0.25);
                for (let i = 0; i < removeCount; i++) {
                    localStorage.removeItem(entries[i].key);
                }

                console.log(`🧹 Removed ${removeCount} old cache entries to free up space`);
            } catch (error) {
                console.error('❌ Error cleaning up old entries:', error);
            }
        }

        /**
         * Get cache statistics
         */
        getStats() {
            const memorySize = this.memoryCache.size;
            let localStorageSize = 0;

            if (this.isLocalStorageAvailable()) {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(this.storagePrefix)) {
                        localStorageSize++;
                    }
                }
            }

            return {
                ...this.stats,
                memoryEntries: memorySize,
                localStorageEntries: localStorageSize,
                hitRate: this.stats.hits + this.stats.misses > 0
                    ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2) + '%'
                    : '0%'
            };
        }

        /**
         * Log cache statistics
         */
        logStats() {
            const stats = this.getStats();
            console.log('📊 Cache Statistics:', stats);
        }
    }

    // Create singleton instance
    const unifiedCache = new UnifiedCache();

    // Expose to global scope
    global.UnifiedCache = UnifiedCache;
    global.unifiedCache = unifiedCache;

    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => unifiedCache.initialize());
    } else {
        unifiedCache.initialize();
    }

    // Expose cache clearing function for developers
    global.clearCache = () => {
        unifiedCache.clearAll();
        console.log('✅ Cache cleared successfully');
    };

    global.cacheStats = () => {
        unifiedCache.logStats();
    };

    console.log('✅ UnifiedCache module loaded');

})(window);

