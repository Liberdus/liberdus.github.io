/**
 * RewardsCalculator - Advanced APR computation and rewards tracking system
 * Handles real-time TVL calculations, reward rate computations, and APR display
 * Integrates with price feeds and contract data for accurate calculations
 *
 * ENHANCED SINGLETON PATTERN - Prevents redeclaration errors
 */
(function(global) {
    'use strict';

    // CRITICAL FIX: Enhanced redeclaration prevention
    if (global.RewardsCalculator) {
        console.warn('RewardsCalculator class already exists, skipping redeclaration');
        return;
    }

    // Check for existing instance and preserve it
    if (global.rewardsCalculator) {
        console.warn('RewardsCalculator instance already exists, preserving existing instance');
        return;
    }

    /**
     * RewardsCalculator Class - Comprehensive rewards and APR calculation system
     */
    class RewardsCalculator {
        constructor() {
            this.isInitialized = false;
            this.contractManager = null;
            this.priceFeeds = null;
            
            // Calculation cache for performance
            this.cache = new Map();
            this.cacheTimeout = 30000; // 30 seconds
            
            // APR calculation configuration
            this.config = {
                // Seconds in a year for APR calculations
                SECONDS_PER_YEAR: 365 * 24 * 60 * 60,
                
                // Minimum values to prevent division by zero
                MIN_TVL: 0.01, // $0.01 minimum TVL
                MIN_REWARD_RATE: 0.000001, // Minimum reward rate
                
                // Cache settings
                CACHE_DURATION: 30000, // 30 seconds
                PRICE_CACHE_DURATION: 300000, // 5 minutes
                
                // Calculation precision
                PRECISION_DECIMALS: 6,
                DISPLAY_DECIMALS: 2,
                
                // Error thresholds
                MAX_APR_DISPLAY: 999999, // Cap APR display at 999,999%
                MIN_APR_DISPLAY: 0.01 // Minimum APR to display
            };
            
            // Pool data cache
            this.poolData = new Map();
            this.priceData = new Map();
            this.userRewardsData = new Map();
            
            // Event listeners for real-time updates
            this.updateListeners = new Set();
            this.updateInterval = null;
            
            console.log('🧮 RewardsCalculator: Advanced calculation system initialized');
        }

        /**
         * Initialize the rewards calculator with dependencies
         */
        async initialize(contractManager, priceFeeds) {
            try {
                console.log('🧮 RewardsCalculator: Starting initialization...');
                
                this.contractManager = contractManager;
                this.priceFeeds = priceFeeds;
                
                // Set up automatic data refresh
                this.setupAutoRefresh();
                
                // Initialize pool data cache
                await this.refreshAllPoolData();
                
                this.isInitialized = true;
                console.log('✅ RewardsCalculator: Initialization completed successfully');
                
                return true;
            } catch (error) {
                console.error('❌ RewardsCalculator: Initialization failed:', error);
                this.isInitialized = false;
                return false;
            }
        }

        /**
         * Set up automatic data refresh for real-time updates
         */
        setupAutoRefresh() {
            // Clear existing interval
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
            }
            
            // Set up 30-second refresh cycle
            this.updateInterval = setInterval(async () => {
                try {
                    await this.refreshAllPoolData();
                    this.notifyUpdateListeners();
                } catch (error) {
                    console.error('RewardsCalculator: Auto-refresh failed:', error);
                }
            }, 30000);
            
            console.log('🔄 RewardsCalculator: Auto-refresh enabled (30s intervals)');
        }

        /**
         * Calculate APR with weight consideration
         * Enhanced to properly incorporate pool weights for accurate reward distribution
         *
         * @param {number} hourlyRate - Total hourly reward rate in tokens
         * @param {number} tvl - Total Value Locked in LP tokens (NOT USD)
         * @param {number} lpTokenPrice - LP token price in USD
         * @param {number} rewardTokenPrice - Reward token price in USD
         * @param {number} poolWeight - Weight of this specific pool (default: 1)
         * @param {number} totalWeight - Total weight across all pools (default: 1)
         * @returns {number} - APR as percentage (e.g., 226.5 for 226.5%)
         */
        calcAPR(hourlyRate, tvl, lpTokenPrice, rewardTokenPrice, poolWeight = 1, totalWeight = 1) {
            // If no TVL, no APR
            if (tvl === 0) return 0;

            // Calculate the weighted portion of rewards this pool receives
            const weightedHourlyRate = (poolWeight / totalWeight) * hourlyRate;

            // If no price data, use simplified calculation (tvl in tokens, not USD)
            if (!lpTokenPrice || !rewardTokenPrice) {
                return ((weightedHourlyRate * 24 * 365) / tvl) * 100 || 0;
            }

            // Calculate APR with weighted rewards (tvl in USD)
            // Formula: (Annual Rewards in USD / TVL in USD) * 100
            const annualRewardsUSD = weightedHourlyRate * 24 * 365 * rewardTokenPrice;
            const tvlUSD = tvl * lpTokenPrice;
            return (annualRewardsUSD / tvlUSD) * 100 || 0;
        }

        /**
         * Calculate APR for a specific LP token pool
         */
        async calculateAPR(pairName, options = {}) {
            try {
                const cacheKey = `apr_${pairName}_${JSON.stringify(options)}`;

                // Check cache first
                if (this.isCacheValid(cacheKey)) {
                    return this.cache.get(cacheKey).data;
                }

                console.log(`🧮 Calculating APR for ${pairName}...`);

                // Get pool information
                const poolInfo = await this.getPoolInfo(pairName);
                if (!poolInfo) {
                    throw new Error(`Pool information not available for ${pairName}`);
                }

                // Get price data
                const lpTokenPrice = await this.getLPTokenPrice(pairName);
                const rewardTokenPrice = await this.getRewardTokenPrice();

                // Calculate TVL (Total Value Locked)
                const tvlUSD = this.calculateTVL(poolInfo.totalStaked, lpTokenPrice);

                // Calculate annual reward value
                const annualRewardValue = this.calculateAnnualRewardValue(
                    poolInfo.rewardRate,
                    rewardTokenPrice
                );

                // Calculate APR
                const apr = this.computeAPR(annualRewardValue, tvlUSD);

                // Prepare result
                const result = {
                    apr: apr,
                    aprFormatted: this.formatAPR(apr),
                    tvlUSD: tvlUSD,
                    tvlFormatted: this.formatCurrency(tvlUSD),
                    totalStaked: poolInfo.totalStaked,
                    rewardRate: poolInfo.rewardRate,
                    lpTokenPrice: lpTokenPrice,
                    rewardTokenPrice: rewardTokenPrice,
                    annualRewardValue: annualRewardValue,
                    lastUpdated: Date.now(),
                    isValid: tvlUSD >= this.config.MIN_TVL
                };

                // Cache the result
                this.cache.set(cacheKey, {
                    data: result,
                    timestamp: Date.now()
                });

                console.log(`✅ APR calculated for ${pairName}: ${result.aprFormatted}`);
                return result;

            } catch (error) {
                console.error(`❌ APR calculation failed for ${pairName}:`, error);

                // Return fallback data
                return {
                    apr: 0,
                    aprFormatted: '0.00%',
                    tvlUSD: 0,
                    tvlFormatted: '$0.00',
                    totalStaked: '0',
                    rewardRate: '0',
                    lpTokenPrice: 0,
                    rewardTokenPrice: 0,
                    annualRewardValue: 0,
                    lastUpdated: Date.now(),
                    isValid: false,
                    error: error.message
                };
            }
        }

        /**
         * Calculate user's pending rewards for a specific pool
         */
        async calculatePendingRewards(userAddress, pairName) {
            try {
                const cacheKey = `pending_${userAddress}_${pairName}`;
                
                // Check cache first
                if (this.isCacheValid(cacheKey)) {
                    return this.cache.get(cacheKey).data;
                }
                
                console.log(`🧮 Calculating pending rewards for ${userAddress} in ${pairName}...`);
                
                // Get pending rewards from contract
                const lpTokenAddress = this.contractManager.contractAddresses.get(`LP_${pairName}`);
                const pendingRewards = await this.contractManager.getPendingRewards(userAddress, lpTokenAddress);
                
                // Get reward token price for USD value
                const rewardTokenPrice = await this.getRewardTokenPrice();
                const pendingRewardsUSD = parseFloat(pendingRewards) * rewardTokenPrice;
                
                const result = {
                    pendingRewards: pendingRewards,
                    pendingRewardsFormatted: this.formatTokenAmount(pendingRewards),
                    pendingRewardsUSD: pendingRewardsUSD,
                    pendingRewardsUSDFormatted: this.formatCurrency(pendingRewardsUSD),
                    rewardTokenPrice: rewardTokenPrice,
                    lastUpdated: Date.now(),
                    userAddress: userAddress,
                    pairName: pairName
                };
                
                // Cache the result
                this.cache.set(cacheKey, {
                    data: result,
                    timestamp: Date.now()
                });
                
                return result;
                
            } catch (error) {
                console.error(`❌ Pending rewards calculation failed for ${userAddress} in ${pairName}:`, error);
                
                return {
                    pendingRewards: '0',
                    pendingRewardsFormatted: '0.00',
                    pendingRewardsUSD: 0,
                    pendingRewardsUSDFormatted: '$0.00',
                    rewardTokenPrice: 0,
                    lastUpdated: Date.now(),
                    userAddress: userAddress,
                    pairName: pairName,
                    error: error.message
                };
            }
        }

        /**
         * Get pool information from contract
         */
        async getPoolInfo(pairName) {
            try {
                const lpTokenAddress = this.contractManager.contractAddresses.get(`LP_${pairName}`);
                if (!lpTokenAddress) {
                    // Silent return - this is expected for unconfigured pairs
                    return null;
                }
                
                // Check if method exists before calling
                if (!this.contractManager.stakingContract || 
                    typeof this.contractManager.stakingContract.getPoolInfo !== 'function') {
                    // Silent return - method not available
                    return null;
                }
                
                // Get pool info from staking contract
                const poolInfo = await this.contractManager.stakingContract.getPoolInfo(lpTokenAddress);
                
                return {
                    totalStaked: ethers.formatEther(poolInfo.totalStaked),
                    rewardRate: ethers.formatEther(poolInfo.rewardRate),
                    lastUpdateTime: poolInfo.lastUpdateTime.toString(),
                    lpTokenAddress: lpTokenAddress
                };
                
            } catch (error) {
                // Silent return - these errors are expected when LP tokens don't exist
                return null;
            }
        }

        /**
         * Calculate TVL in USD
         */
        calculateTVL(totalStaked, lpTokenPrice) {
            const stakedAmount = parseFloat(totalStaked) || 0;
            const price = parseFloat(lpTokenPrice) || 0;
            return stakedAmount * price;
        }

        /**
         * Calculate annual reward value in USD
         */
        calculateAnnualRewardValue(rewardRate, rewardTokenPrice) {
            const ratePerSecond = parseFloat(rewardRate) || 0;
            const price = parseFloat(rewardTokenPrice) || 0;
            return ratePerSecond * this.config.SECONDS_PER_YEAR * price;
        }

        /**
         * Compute APR percentage
         */
        computeAPR(annualRewardValue, tvlUSD) {
            if (tvlUSD < this.config.MIN_TVL) {
                return 0;
            }

            const apr = (annualRewardValue / tvlUSD) * 100;

            // Cap APR display
            if (apr > this.config.MAX_APR_DISPLAY) {
                return this.config.MAX_APR_DISPLAY;
            }

            // Minimum APR display
            if (apr < this.config.MIN_APR_DISPLAY && apr > 0) {
                return this.config.MIN_APR_DISPLAY;
            }

            return apr;
        }

        /**
         * Get LP token price (placeholder - will be implemented with price feeds)
         */
        async getLPTokenPrice(pairName) {
            try {
                if (this.priceFeeds && this.priceFeeds.getLPTokenPrice) {
                    return await this.priceFeeds.getLPTokenPrice(pairName);
                }

                // Fallback to mock price for development
                const mockPrices = {
                    'LIB-USDT': 1.25,
                    'LIB-WETH': 2.50,
                    'LIB-MATIC': 0.85
                };

                return mockPrices[pairName] || 1.0;

            } catch (error) {
                console.error(`Failed to get LP token price for ${pairName}:`, error);
                return 1.0; // Fallback price
            }
        }

        /**
         * Get reward token price (placeholder - will be implemented with price feeds)
         */
        async getRewardTokenPrice() {
            try {
                if (this.priceFeeds && this.priceFeeds.getRewardTokenPrice) {
                    return await this.priceFeeds.getRewardTokenPrice();
                }

                // Fallback to mock price for development
                return 0.50; // $0.50 per reward token

            } catch (error) {
                console.error('Failed to get reward token price:', error);
                return 0.50; // Fallback price
            }
        }

        /**
         * Refresh all pool data
         */
        async refreshAllPoolData() {
            try {
                if (!this.contractManager || !this.contractManager.isReady()) {
                    // Silent skip - this is expected on initial load
                    return;
                }

                // Get supported tokens from contract
                const supportedTokens = await this.getSupportedTokens();

                // Refresh data for each pool
                let successCount = 0;
                for (const pairName of supportedTokens) {
                    try {
                        const poolInfo = await this.getPoolInfo(pairName);
                        if (poolInfo) {
                        this.poolData.set(pairName, {
                            ...poolInfo,
                            lastUpdated: Date.now()
                        });
                            successCount++;
                        }
                    } catch (error) {
                        // Silent skip - expected for unconfigured pairs
                    }
                }

                if (successCount > 0) {
                    console.log(`🔄 Pool data refreshed for ${successCount}/${supportedTokens.length} pools`);
                }

            } catch (error) {
                // Silent skip - errors are expected during initialization
            }
        }

        /**
         * Get supported token pairs
         */
        async getSupportedTokens() {
            try {
                if (this.contractManager && this.contractManager.stakingContract) {
                    // Check if method exists before calling
                    if (typeof this.contractManager.stakingContract.getSupportedTokens === 'function') {
                    const tokens = await this.contractManager.stakingContract.getSupportedTokens();
                    // Convert addresses to pair names
                    return this.convertAddressesToPairNames(tokens);
                    } else {
                        console.log('ℹ️ getSupportedTokens method not available, using configured pairs');
                    }
                }

                // Fallback to configured pairs
                if (window.CONFIG && window.CONFIG.CONTRACTS && window.CONFIG.CONTRACTS.LP_TOKENS) {
                return Object.keys(window.CONFIG.CONTRACTS.LP_TOKENS);
                }
                
                return ['LPLIBETH', 'LPLIBUSDC', 'LPLIBUSDT']; // Default fallback pairs

            } catch (error) {
                // Silent fallback - no need to spam console
                console.log('ℹ️ Using fallback supported tokens');
                return ['LPLIBETH', 'LPLIBUSDC', 'LPLIBUSDT']; // Fallback pairs
            }
        }

        /**
         * Convert contract addresses to pair names
         */
        convertAddressesToPairNames(addresses) {
            const pairNames = [];
            const lpTokens = window.CONFIG.CONTRACTS.LP_TOKENS;

            for (const address of addresses) {
                for (const [pairName, pairAddress] of Object.entries(lpTokens)) {
                    if (pairAddress.toLowerCase() === address.toLowerCase()) {
                        pairNames.push(pairName);
                        break;
                    }
                }
            }

            return pairNames.length > 0 ? pairNames : ['LIB-USDT', 'LIB-WETH', 'LIB-MATIC'];
        }

        /**
         * Check if cache entry is valid
         */
        isCacheValid(key) {
            const entry = this.cache.get(key);
            if (!entry) return false;

            const age = Date.now() - entry.timestamp;
            return age < this.config.CACHE_DURATION;
        }

        /**
         * Add update listener for real-time updates
         */
        addUpdateListener(callback) {
            if (typeof callback === 'function') {
                this.updateListeners.add(callback);
                console.log('RewardsCalculator: Update listener added');
            }
        }

        /**
         * Remove update listener
         */
        removeUpdateListener(callback) {
            this.updateListeners.delete(callback);
            console.log('RewardsCalculator: Update listener removed');
        }

        /**
         * Notify all update listeners
         */
        notifyUpdateListeners() {
            for (const callback of this.updateListeners) {
                try {
                    callback();
                } catch (error) {
                    console.error('RewardsCalculator: Update listener error:', error);
                }
            }
        }

        /**
         * Format APR for display
         */
        formatAPR(apr) {
            if (apr === 0) return '0.00%';
            if (apr >= this.config.MAX_APR_DISPLAY) return '999,999%+';
            if (apr < 0.01) return '<0.01%';

            return `${apr.toFixed(this.config.DISPLAY_DECIMALS)}%`;
        }

        /**
         * Format currency for display
         */
        formatCurrency(amount) {
            if (amount === 0) return '$0.00';
            if (amount < 0.01) return '<$0.01';
            if (amount >= 1000000) {
                return `$${(amount / 1000000).toFixed(2)}M`;
            }
            if (amount >= 1000) {
                return `$${(amount / 1000).toFixed(2)}K`;
            }

            return `$${amount.toFixed(2)}`;
        }

        /**
         * Format token amount for display
         */
        formatTokenAmount(amount) {
            const num = parseFloat(amount);
            if (num === 0) return '0.00';
            if (num < 0.01) return '<0.01';
            if (num >= 1000000) {
                return `${(num / 1000000).toFixed(2)}M`;
            }
            if (num >= 1000) {
                return `${(num / 1000).toFixed(2)}K`;
            }

            return num.toFixed(this.config.DISPLAY_DECIMALS);
        }

        /**
         * Clear all caches
         */
        clearCache() {
            this.cache.clear();
            this.poolData.clear();
            this.priceData.clear();
            this.userRewardsData.clear();
            console.log('RewardsCalculator: All caches cleared');
        }

        /**
         * Get calculation statistics
         */
        getStats() {
            return {
                cacheSize: this.cache.size,
                poolDataSize: this.poolData.size,
                priceDataSize: this.priceData.size,
                userRewardsDataSize: this.userRewardsData.size,
                updateListeners: this.updateListeners.size,
                isInitialized: this.isInitialized,
                autoRefreshEnabled: !!this.updateInterval
            };
        }

        /**
         * Cleanup resources
         */
        destroy() {
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }

            this.clearCache();
            this.updateListeners.clear();
            this.isInitialized = false;

            console.log('RewardsCalculator: Resources cleaned up');
        }
    }

    // Export to global scope
    global.RewardsCalculator = RewardsCalculator;

    console.log('✅ RewardsCalculator class registered globally');

})(typeof window !== 'undefined' ? window : global);
