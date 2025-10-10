/**
 * RewardsHistory - Local storage persistence for rewards claim history
 * Tracks user's reward claims, provides analytics, and manages data persistence
 * Integrates with browser localStorage for data persistence across sessions
 *
 * ENHANCED SINGLETON PATTERN - Prevents redeclaration errors
 */
(function(global) {
    'use strict';

    // CRITICAL FIX: Enhanced redeclaration prevention
    if (global.RewardsHistory) {
        console.warn('RewardsHistory class already exists, skipping redeclaration');
        return;
    }

    // Check for existing instance and preserve it
    if (global.rewardsHistory) {
        console.warn('RewardsHistory instance already exists, preserving existing instance');
        return;
    }

    /**
     * RewardsHistory Class - Comprehensive rewards tracking and persistence system
     */
    class RewardsHistory {
        constructor() {
            this.isInitialized = false;
            
            // Storage configuration
            this.config = {
                STORAGE_KEY: 'lp-staking-rewards-history',
                MAX_HISTORY_ENTRIES: 1000, // Maximum number of entries to store
                DATA_VERSION: '1.0', // For future migration compatibility
                BACKUP_INTERVAL: 300000, // 5 minutes
                CLEANUP_INTERVAL: 86400000, // 24 hours
                MAX_AGE_DAYS: 365 // Keep data for 1 year
            };
            
            // In-memory data store
            this.rewardsData = {
                version: this.config.DATA_VERSION,
                userAddress: null,
                claims: [], // Array of claim records
                statistics: {
                    totalClaimed: '0',
                    totalClaimedUSD: 0,
                    claimCount: 0,
                    firstClaimDate: null,
                    lastClaimDate: null,
                    averageClaimAmount: '0',
                    favoritePool: null
                },
                pools: new Map(), // Pool-specific statistics
                lastUpdated: Date.now()
            };
            
            // Event listeners for data changes
            this.changeListeners = new Set();
            
            // Automatic backup and cleanup intervals
            this.backupInterval = null;
            this.cleanupInterval = null;
            
            console.log('📊 RewardsHistory: Advanced tracking system initialized');
        }

        /**
         * Initialize the rewards history system
         */
        async initialize(userAddress) {
            try {
                console.log('📊 RewardsHistory: Starting initialization...');
                
                this.rewardsData.userAddress = userAddress;
                
                // Load existing data from localStorage
                await this.loadFromStorage();
                
                // Set up automatic backup and cleanup
                this.setupAutoBackup();
                this.setupAutoCleanup();
                
                // Validate and migrate data if needed
                await this.validateAndMigrateData();
                
                this.isInitialized = true;
                console.log('✅ RewardsHistory: Initialization completed successfully');
                
                return true;
            } catch (error) {
                console.error('❌ RewardsHistory: Initialization failed:', error);
                this.isInitialized = false;
                return false;
            }
        }

        /**
         * Record a new reward claim
         */
        async recordClaim(claimData) {
            try {
                console.log('📊 Recording new reward claim:', claimData);
                
                // Validate claim data
                if (!this.validateClaimData(claimData)) {
                    throw new Error('Invalid claim data provided');
                }
                
                // Create claim record
                const claimRecord = {
                    id: this.generateClaimId(),
                    userAddress: this.rewardsData.userAddress,
                    pairName: claimData.pairName,
                    amount: claimData.amount,
                    amountFormatted: claimData.amountFormatted || claimData.amount,
                    amountUSD: claimData.amountUSD || 0,
                    amountUSDFormatted: claimData.amountUSDFormatted || '$0.00',
                    transactionHash: claimData.transactionHash,
                    blockNumber: claimData.blockNumber || null,
                    timestamp: Date.now(),
                    date: new Date().toISOString(),
                    rewardTokenPrice: claimData.rewardTokenPrice || 0,
                    gasUsed: claimData.gasUsed || null,
                    gasCost: claimData.gasCost || null,
                    status: 'confirmed' // confirmed, pending, failed
                };
                
                // Add to claims array
                this.rewardsData.claims.unshift(claimRecord); // Add to beginning for chronological order
                
                // Update statistics
                this.updateStatistics(claimRecord);
                
                // Update pool-specific data
                this.updatePoolStatistics(claimRecord);
                
                // Enforce maximum entries limit
                this.enforceMaxEntries();
                
                // Save to storage
                await this.saveToStorage();
                
                // Notify listeners
                this.notifyChangeListeners('claim_added', claimRecord);
                
                console.log('✅ Reward claim recorded successfully:', claimRecord.id);
                return claimRecord;
                
            } catch (error) {
                console.error('❌ Failed to record reward claim:', error);
                throw error;
            }
        }

        /**
         * Get claim history with filtering and pagination
         */
        getClaimHistory(options = {}) {
            try {
                let claims = [...this.rewardsData.claims];
                
                // Apply filters
                if (options.pairName) {
                    claims = claims.filter(claim => claim.pairName === options.pairName);
                }
                
                if (options.startDate) {
                    const startTime = new Date(options.startDate).getTime();
                    claims = claims.filter(claim => claim.timestamp >= startTime);
                }
                
                if (options.endDate) {
                    const endTime = new Date(options.endDate).getTime();
                    claims = claims.filter(claim => claim.timestamp <= endTime);
                }
                
                if (options.minAmount) {
                    claims = claims.filter(claim => parseFloat(claim.amount) >= parseFloat(options.minAmount));
                }
                
                // Apply sorting
                const sortBy = options.sortBy || 'timestamp';
                const sortOrder = options.sortOrder || 'desc';
                
                claims.sort((a, b) => {
                    let aValue = a[sortBy];
                    let bValue = b[sortBy];
                    
                    if (sortBy === 'amount' || sortBy === 'amountUSD') {
                        aValue = parseFloat(aValue);
                        bValue = parseFloat(bValue);
                    }
                    
                    if (sortOrder === 'desc') {
                        return bValue > aValue ? 1 : -1;
                    } else {
                        return aValue > bValue ? 1 : -1;
                    }
                });
                
                // Apply pagination
                const page = options.page || 1;
                const limit = options.limit || 50;
                const startIndex = (page - 1) * limit;
                const endIndex = startIndex + limit;
                
                const paginatedClaims = claims.slice(startIndex, endIndex);
                
                return {
                    claims: paginatedClaims,
                    totalCount: claims.length,
                    page: page,
                    limit: limit,
                    totalPages: Math.ceil(claims.length / limit),
                    hasMore: endIndex < claims.length
                };
                
            } catch (error) {
                console.error('Failed to get claim history:', error);
                return {
                    claims: [],
                    totalCount: 0,
                    page: 1,
                    limit: 50,
                    totalPages: 0,
                    hasMore: false,
                    error: error.message
                };
            }
        }

        /**
         * Get comprehensive statistics
         */
        getStatistics() {
            return {
                ...this.rewardsData.statistics,
                poolStats: Object.fromEntries(this.rewardsData.pools),
                dataAge: Date.now() - this.rewardsData.lastUpdated,
                totalEntries: this.rewardsData.claims.length,
                storageSize: this.getStorageSize()
            };
        }

        /**
         * Get pool-specific statistics
         */
        getPoolStatistics(pairName) {
            const poolStats = this.rewardsData.pools.get(pairName);
            if (!poolStats) {
                return {
                    pairName: pairName,
                    totalClaimed: '0',
                    totalClaimedUSD: 0,
                    claimCount: 0,
                    averageClaimAmount: '0',
                    firstClaimDate: null,
                    lastClaimDate: null
                };
            }
            
            return { ...poolStats };
        }

        /**
         * Export data for backup or analysis
         */
        exportData(format = 'json') {
            try {
                const exportData = {
                    ...this.rewardsData,
                    pools: Object.fromEntries(this.rewardsData.pools),
                    exportedAt: new Date().toISOString(),
                    exportFormat: format
                };
                
                if (format === 'json') {
                    return JSON.stringify(exportData, null, 2);
                } else if (format === 'csv') {
                    return this.convertToCSV(exportData.claims);
                }
                
                return exportData;
                
            } catch (error) {
                console.error('Failed to export data:', error);
                throw error;
            }
        }

        /**
         * Import data from backup
         */
        async importData(data, options = {}) {
            try {
                console.log('📊 Importing rewards history data...');
                
                let importData;
                if (typeof data === 'string') {
                    importData = JSON.parse(data);
                } else {
                    importData = data;
                }
                
                // Validate imported data
                if (!this.validateImportData(importData)) {
                    throw new Error('Invalid import data format');
                }
                
                // Merge or replace data
                if (options.merge) {
                    await this.mergeImportedData(importData);
                } else {
                    this.rewardsData = {
                        ...importData,
                        pools: new Map(Object.entries(importData.pools || {})),
                        lastUpdated: Date.now()
                    };
                }
                
                // Save to storage
                await this.saveToStorage();
                
                // Notify listeners
                this.notifyChangeListeners('data_imported', importData);
                
                console.log('✅ Data imported successfully');
                return true;
                
            } catch (error) {
                console.error('❌ Failed to import data:', error);
                throw error;
            }
        }

        /**
         * Clear all history data
         */
        async clearHistory(options = {}) {
            try {
                console.log('📊 Clearing rewards history...');

                if (options.pairName) {
                    // Clear specific pool data
                    this.rewardsData.claims = this.rewardsData.claims.filter(
                        claim => claim.pairName !== options.pairName
                    );
                    this.rewardsData.pools.delete(options.pairName);
                } else {
                    // Clear all data
                    this.rewardsData.claims = [];
                    this.rewardsData.pools.clear();
                    this.rewardsData.statistics = {
                        totalClaimed: '0',
                        totalClaimedUSD: 0,
                        claimCount: 0,
                        firstClaimDate: null,
                        lastClaimDate: null,
                        averageClaimAmount: '0',
                        favoritePool: null
                    };
                }

                this.rewardsData.lastUpdated = Date.now();

                // Save to storage
                await this.saveToStorage();

                // Notify listeners
                this.notifyChangeListeners('history_cleared', options);

                console.log('✅ History cleared successfully');
                return true;

            } catch (error) {
                console.error('❌ Failed to clear history:', error);
                throw error;
            }
        }

        // ==================== PRIVATE HELPER METHODS ====================

        /**
         * Validate claim data
         */
        validateClaimData(claimData) {
            const required = ['pairName', 'amount', 'transactionHash'];

            for (const field of required) {
                if (!claimData[field]) {
                    console.error(`Missing required field: ${field}`);
                    return false;
                }
            }

            // Validate amount is a valid number
            if (isNaN(parseFloat(claimData.amount))) {
                console.error('Invalid amount value');
                return false;
            }

            // Validate transaction hash format
            if (!/^0x[a-fA-F0-9]{64}$/.test(claimData.transactionHash)) {
                console.error('Invalid transaction hash format');
                return false;
            }

            return true;
        }

        /**
         * Generate unique claim ID
         */
        generateClaimId() {
            const timestamp = Date.now();
            const random = Math.random().toString(36).substr(2, 9);
            return `claim_${timestamp}_${random}`;
        }

        /**
         * Update overall statistics
         */
        updateStatistics(claimRecord) {
            const stats = this.rewardsData.statistics;

            // Update totals
            const currentTotal = parseFloat(stats.totalClaimed) || 0;
            const claimAmount = parseFloat(claimRecord.amount) || 0;
            stats.totalClaimed = (currentTotal + claimAmount).toString();

            stats.totalClaimedUSD += claimRecord.amountUSD || 0;
            stats.claimCount += 1;

            // Update dates
            if (!stats.firstClaimDate || claimRecord.timestamp < new Date(stats.firstClaimDate).getTime()) {
                stats.firstClaimDate = claimRecord.date;
            }

            stats.lastClaimDate = claimRecord.date;

            // Update average
            stats.averageClaimAmount = (parseFloat(stats.totalClaimed) / stats.claimCount).toString();

            // Update favorite pool (most claimed from)
            this.updateFavoritePool();
        }

        /**
         * Update pool-specific statistics
         */
        updatePoolStatistics(claimRecord) {
            const pairName = claimRecord.pairName;
            let poolStats = this.rewardsData.pools.get(pairName);

            if (!poolStats) {
                poolStats = {
                    pairName: pairName,
                    totalClaimed: '0',
                    totalClaimedUSD: 0,
                    claimCount: 0,
                    averageClaimAmount: '0',
                    firstClaimDate: null,
                    lastClaimDate: null
                };
            }

            // Update pool totals
            const currentTotal = parseFloat(poolStats.totalClaimed) || 0;
            const claimAmount = parseFloat(claimRecord.amount) || 0;
            poolStats.totalClaimed = (currentTotal + claimAmount).toString();

            poolStats.totalClaimedUSD += claimRecord.amountUSD || 0;
            poolStats.claimCount += 1;

            // Update pool dates
            if (!poolStats.firstClaimDate || claimRecord.timestamp < new Date(poolStats.firstClaimDate).getTime()) {
                poolStats.firstClaimDate = claimRecord.date;
            }

            poolStats.lastClaimDate = claimRecord.date;

            // Update pool average
            poolStats.averageClaimAmount = (parseFloat(poolStats.totalClaimed) / poolStats.claimCount).toString();

            this.rewardsData.pools.set(pairName, poolStats);
        }

        /**
         * Update favorite pool based on total claimed amounts
         */
        updateFavoritePool() {
            let maxAmount = 0;
            let favoritePool = null;

            for (const [pairName, poolStats] of this.rewardsData.pools.entries()) {
                const totalClaimed = parseFloat(poolStats.totalClaimed) || 0;
                if (totalClaimed > maxAmount) {
                    maxAmount = totalClaimed;
                    favoritePool = pairName;
                }
            }

            this.rewardsData.statistics.favoritePool = favoritePool;
        }

        /**
         * Enforce maximum entries limit
         */
        enforceMaxEntries() {
            if (this.rewardsData.claims.length > this.config.MAX_HISTORY_ENTRIES) {
                const excessCount = this.rewardsData.claims.length - this.config.MAX_HISTORY_ENTRIES;
                this.rewardsData.claims.splice(-excessCount, excessCount); // Remove oldest entries
                console.log(`Removed ${excessCount} old entries to maintain limit`);
            }
        }

        /**
         * Load data from localStorage
         */
        async loadFromStorage() {
            try {
                const storedData = localStorage.getItem(this.config.STORAGE_KEY);

                if (storedData) {
                    const parsedData = JSON.parse(storedData);

                    // Validate and migrate if needed
                    if (this.validateStoredData(parsedData)) {
                        this.rewardsData = {
                            ...parsedData,
                            pools: new Map(Object.entries(parsedData.pools || {}))
                        };

                        console.log('✅ Rewards history loaded from storage');
                    } else {
                        console.warn('⚠️ Invalid stored data, using defaults');
                    }
                } else {
                    console.log('📊 No existing rewards history found, starting fresh');
                }

            } catch (error) {
                console.error('❌ Failed to load from storage:', error);
                // Continue with default data
            }
        }

        /**
         * Save data to localStorage
         */
        async saveToStorage() {
            try {
                const dataToStore = {
                    ...this.rewardsData,
                    pools: Object.fromEntries(this.rewardsData.pools),
                    lastUpdated: Date.now()
                };

                localStorage.setItem(this.config.STORAGE_KEY, JSON.stringify(dataToStore));
                console.log('💾 Rewards history saved to storage');

            } catch (error) {
                console.error('❌ Failed to save to storage:', error);

                // Handle quota exceeded error
                if (error.name === 'QuotaExceededError') {
                    console.warn('⚠️ Storage quota exceeded, performing cleanup...');
                    await this.performStorageCleanup();

                    // Try saving again with reduced data
                    try {
                        localStorage.setItem(this.config.STORAGE_KEY, JSON.stringify(dataToStore));
                        console.log('💾 Rewards history saved after cleanup');
                    } catch (retryError) {
                        console.error('❌ Failed to save even after cleanup:', retryError);
                    }
                }
            }
        }

        /**
         * Validate stored data format
         */
        validateStoredData(data) {
            return data &&
                   data.version &&
                   Array.isArray(data.claims) &&
                   data.statistics &&
                   typeof data.userAddress === 'string';
        }

        /**
         * Validate import data format
         */
        validateImportData(data) {
            return this.validateStoredData(data);
        }

        /**
         * Set up automatic backup
         */
        setupAutoBackup() {
            if (this.backupInterval) {
                clearInterval(this.backupInterval);
            }

            this.backupInterval = setInterval(async () => {
                try {
                    await this.saveToStorage();
                } catch (error) {
                    console.error('Auto-backup failed:', error);
                }
            }, this.config.BACKUP_INTERVAL);

            console.log('🔄 Auto-backup enabled (5min intervals)');
        }

        /**
         * Set up automatic cleanup
         */
        setupAutoCleanup() {
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
            }

            this.cleanupInterval = setInterval(async () => {
                try {
                    await this.performDataCleanup();
                } catch (error) {
                    console.error('Auto-cleanup failed:', error);
                }
            }, this.config.CLEANUP_INTERVAL);

            console.log('🧹 Auto-cleanup enabled (24h intervals)');
        }

        /**
         * Perform data cleanup (remove old entries)
         */
        async performDataCleanup() {
            const maxAge = this.config.MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
            const cutoffTime = Date.now() - maxAge;

            const initialCount = this.rewardsData.claims.length;
            this.rewardsData.claims = this.rewardsData.claims.filter(
                claim => claim.timestamp > cutoffTime
            );

            const removedCount = initialCount - this.rewardsData.claims.length;

            if (removedCount > 0) {
                console.log(`🧹 Cleaned up ${removedCount} old entries`);
                await this.saveToStorage();
            }
        }

        /**
         * Perform storage cleanup when quota exceeded
         */
        async performStorageCleanup() {
            // Remove oldest 25% of entries
            const removeCount = Math.floor(this.rewardsData.claims.length * 0.25);
            this.rewardsData.claims.splice(-removeCount, removeCount);

            console.log(`🧹 Emergency cleanup: removed ${removeCount} entries`);
        }

        /**
         * Convert claims to CSV format
         */
        convertToCSV(claims) {
            const headers = [
                'Date', 'Pair', 'Amount', 'Amount USD', 'Transaction Hash', 'Block Number'
            ];

            const rows = claims.map(claim => [
                claim.date,
                claim.pairName,
                claim.amount,
                claim.amountUSD,
                claim.transactionHash,
                claim.blockNumber || ''
            ]);

            return [headers, ...rows]
                .map(row => row.map(field => `"${field}"`).join(','))
                .join('\n');
        }

        /**
         * Merge imported data with existing data
         */
        async mergeImportedData(importData) {
            // Merge claims (avoid duplicates by transaction hash)
            const existingHashes = new Set(this.rewardsData.claims.map(claim => claim.transactionHash));

            const newClaims = importData.claims.filter(claim => !existingHashes.has(claim.transactionHash));
            this.rewardsData.claims.push(...newClaims);

            // Sort by timestamp
            this.rewardsData.claims.sort((a, b) => b.timestamp - a.timestamp);

            // Recalculate statistics
            this.recalculateStatistics();

            console.log(`Merged ${newClaims.length} new claims`);
        }

        /**
         * Recalculate all statistics
         */
        recalculateStatistics() {
            // Reset statistics
            this.rewardsData.statistics = {
                totalClaimed: '0',
                totalClaimedUSD: 0,
                claimCount: 0,
                firstClaimDate: null,
                lastClaimDate: null,
                averageClaimAmount: '0',
                favoritePool: null
            };

            this.rewardsData.pools.clear();

            // Recalculate from all claims
            for (const claim of this.rewardsData.claims) {
                this.updateStatistics(claim);
                this.updatePoolStatistics(claim);
            }
        }

        /**
         * Get storage size in bytes
         */
        getStorageSize() {
            try {
                const data = localStorage.getItem(this.config.STORAGE_KEY);
                return data ? new Blob([data]).size : 0;
            } catch (error) {
                return 0;
            }
        }

        /**
         * Add change listener
         */
        addChangeListener(callback) {
            if (typeof callback === 'function') {
                this.changeListeners.add(callback);
            }
        }

        /**
         * Remove change listener
         */
        removeChangeListener(callback) {
            this.changeListeners.delete(callback);
        }

        /**
         * Notify change listeners
         */
        notifyChangeListeners(eventType, data) {
            for (const callback of this.changeListeners) {
                try {
                    callback(eventType, data);
                } catch (error) {
                    console.error('Change listener error:', error);
                }
            }
        }

        /**
         * Validate and migrate data if needed
         */
        async validateAndMigrateData() {
            // Future migration logic can be added here
            console.log('Data validation and migration completed');
        }

        /**
         * Cleanup resources
         */
        destroy() {
            if (this.backupInterval) {
                clearInterval(this.backupInterval);
                this.backupInterval = null;
            }

            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
                this.cleanupInterval = null;
            }

            this.changeListeners.clear();
            this.isInitialized = false;

            console.log('RewardsHistory: Resources cleaned up');
        }
    }

    // Export to global scope
    global.RewardsHistory = RewardsHistory;

    console.log('✅ RewardsHistory class registered globally');

})(typeof window !== 'undefined' ? window : global);
