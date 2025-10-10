/**
 * PriceFeeds - Robust price API integration system
 * Handles CoinGecko API, DEX price feeds, and fallback mechanisms
 * Provides real-time price data for LP tokens and reward tokens
 *
 * ENHANCED SINGLETON PATTERN - Prevents redeclaration errors
 */
(function(global) {
    'use strict';

    // CRITICAL FIX: Enhanced redeclaration prevention
    if (global.PriceFeeds) {
        console.warn('PriceFeeds class already exists, skipping redeclaration');
        return;
    }

    // Check for existing instance and preserve it
    if (global.priceFeeds) {
        console.warn('PriceFeeds instance already exists, preserving existing instance');
        return;
    }

    /**
     * PriceFeeds Class - Comprehensive price data management system
     */
    class PriceFeeds {
        constructor() {
            this.isInitialized = false;
            
            // API configuration
            this.config = {
                // CoinGecko API settings
                COINGECKO_BASE_URL: 'https://api.coingecko.com/api/v3',
                COINGECKO_TIMEOUT: 10000, // 10 seconds
                
                // DEX API settings (fallback)
                DEX_APIS: [
                    'https://api.dexscreener.com/latest/dex/tokens/',
                    'https://api.1inch.io/v5.0/137/quote'
                ],
                
                // Cache settings
                CACHE_DURATION: 300000, // 5 minutes
                PRICE_UPDATE_INTERVAL: 60000, // 1 minute
                
                // Retry settings
                MAX_RETRIES: 3,
                RETRY_DELAY: 2000, // 2 seconds
                
                // Rate limiting
                RATE_LIMIT_DELAY: 1000, // 1 second between requests
                MAX_CONCURRENT_REQUESTS: 5
            };
            
            // Price cache
            this.priceCache = new Map();
            this.lastRequestTime = 0;
            this.requestQueue = [];
            this.activeRequests = 0;
            
            // Token mappings
            this.tokenMappings = {
                // Map internal token names to CoinGecko IDs
                'LIB': 'liberty-token', // Example mapping
                'USDT': 'tether',
                'WETH': 'weth',
                'MATIC': 'matic-network',
                'USDC': 'usd-coin'
            };
            
            // LP token price calculation methods
            this.lpTokenMethods = new Map();
            
            // Update interval
            this.updateInterval = null;
            
            console.log('💰 PriceFeeds: Advanced price system initialized');
        }

        /**
         * Initialize the price feeds system
         */
        async initialize() {
            try {
                console.log('💰 PriceFeeds: Starting initialization...');
                
                // Test API connectivity
                await this.testAPIConnectivity();
                
                // Set up automatic price updates
                this.setupAutoUpdate();
                
                // Initialize LP token price calculation methods
                this.setupLPTokenMethods();
                
                // Preload common token prices
                await this.preloadCommonPrices();
                
                this.isInitialized = true;
                console.log('✅ PriceFeeds: Initialization completed successfully');
                
                return true;
            } catch (error) {
                console.error('❌ PriceFeeds: Initialization failed:', error);
                this.isInitialized = false;
                return false;
            }
        }

        /**
         * Test API connectivity
         */
        async testAPIConnectivity() {
            try {
                console.log('🔍 Testing CoinGecko API connectivity...');
                
                const response = await this.makeRequest(`${this.config.COINGECKO_BASE_URL}/ping`);
                
                if (response && response.gecko_says) {
                    console.log('✅ CoinGecko API is accessible');
                    return true;
                }
                
                throw new Error('CoinGecko API test failed');
                
            } catch (error) {
                console.warn('⚠️ CoinGecko API not accessible, will use fallback methods');
                return false;
            }
        }

        /**
         * Set up automatic price updates
         */
        setupAutoUpdate() {
            // Clear existing interval
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
            }
            
            // Set up 1-minute update cycle
            this.updateInterval = setInterval(async () => {
                try {
                    await this.updateAllPrices();
                } catch (error) {
                    console.error('PriceFeeds: Auto-update failed:', error);
                }
            }, this.config.PRICE_UPDATE_INTERVAL);
            
            console.log('🔄 PriceFeeds: Auto-update enabled (1min intervals)');
        }

        /**
         * Set up LP token price calculation methods
         */
        setupLPTokenMethods() {
            // Method 1: Calculate from reserves (if available)
            this.lpTokenMethods.set('reserves', this.calculatePriceFromReserves.bind(this));
            
            // Method 2: Use DEX API
            this.lpTokenMethods.set('dex', this.calculatePriceFromDEX.bind(this));
            
            // Method 3: Fallback to mock prices
            this.lpTokenMethods.set('fallback', this.getFallbackPrice.bind(this));
            
            console.log('🔧 LP token price calculation methods configured');
        }

        /**
         * Preload common token prices
         */
        async preloadCommonPrices() {
            const commonTokens = ['USDT', 'WETH', 'MATIC', 'USDC'];
            
            console.log('📥 Preloading common token prices...');
            
            for (const token of commonTokens) {
                try {
                    await this.getTokenPrice(token);
                } catch (error) {
                    console.warn(`Failed to preload price for ${token}:`, error);
                }
            }
            
            console.log('✅ Common token prices preloaded');
        }

        /**
         * Fetch token price by address from DexScreener (React implementation)
         * This matches the React site's fetchTokenPrice() function exactly
         * @param {string} address - Token contract address
         * @returns {Promise<number>} - Token price in USD
         */
        async fetchTokenPrice(address) {
            if (!address) {
                console.warn('⚠️ No address provided to fetchTokenPrice');
                return 0;
            }

            try {
                const cacheKey = `address_price_${address.toLowerCase()}`;

                // Check cache first
                if (this.isCacheValid(cacheKey)) {
                    const cached = this.priceCache.get(cacheKey);
                    console.log(`💰 Using cached price for ${address}: $${cached.price}`);
                    return cached.price;
                }

                console.log(`🔍 Fetching price from DexScreener for: ${address}`);

                const response = await fetch(
                    `https://api.dexscreener.com/latest/dex/tokens/${address}`,
                    {
                        method: 'GET',
                        headers: { 'Accept': 'application/json' }
                    }
                );

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                const price = parseFloat(data.pairs?.[0]?.priceUsd || 0);

                if (price > 0) {
                    console.log(`✅ Price fetched for ${address}: $${price}`);
                    this.priceCache.set(cacheKey, {
                        price,
                        timestamp: Date.now(),
                        source: 'dexscreener'
                    });
                } else {
                    console.warn(`⚠️ No price data found for ${address}`);
                }

                return price;
            } catch (error) {
                console.error(`❌ Failed to fetch token price for ${address}:`, error);
                return 0;
            }
        }

        /**
         * Get token price from CoinGecko or fallback sources
         */
        async getTokenPrice(tokenSymbol, options = {}) {
            try {
                const cacheKey = `price_${tokenSymbol.toLowerCase()}`;

                // Check cache first
                if (this.isCacheValid(cacheKey) && !options.forceRefresh) {
                    return this.priceCache.get(cacheKey).price;
                }

                console.log(`💰 Fetching price for ${tokenSymbol}...`);

                // Rate limiting
                await this.enforceRateLimit();

                // Get CoinGecko ID for token
                const coinGeckoId = this.tokenMappings[tokenSymbol.toUpperCase()];
                if (!coinGeckoId) {
                    throw new Error(`No CoinGecko mapping found for ${tokenSymbol}`);
                }

                // Fetch price from CoinGecko
                const price = await this.fetchPriceFromCoinGecko(coinGeckoId);

                // Cache the result
                this.priceCache.set(cacheKey, {
                    price: price,
                    timestamp: Date.now(),
                    source: 'coingecko'
                });

                console.log(`✅ Price fetched for ${tokenSymbol}: $${price}`);
                return price;

            } catch (error) {
                console.error(`❌ Failed to get price for ${tokenSymbol}:`, error);

                // Try fallback methods
                return await this.getFallbackTokenPrice(tokenSymbol);
            }
        }

        /**
         * Get LP token price using multiple calculation methods
         */
        async getLPTokenPrice(pairName, options = {}) {
            try {
                const cacheKey = `lp_price_${pairName.toLowerCase()}`;
                
                // Check cache first
                if (this.isCacheValid(cacheKey) && !options.forceRefresh) {
                    return this.priceCache.get(cacheKey).price;
                }
                
                console.log(`💰 Calculating LP token price for ${pairName}...`);
                
                // Try different calculation methods in order
                const methods = ['reserves', 'dex', 'fallback'];
                
                for (const method of methods) {
                    try {
                        const calculator = this.lpTokenMethods.get(method);
                        const price = await calculator(pairName);
                        
                        if (price > 0) {
                            // Cache the result
                            this.priceCache.set(cacheKey, {
                                price: price,
                                timestamp: Date.now(),
                                source: method,
                                pairName: pairName
                            });
                            
                            console.log(`✅ LP price calculated for ${pairName}: $${price} (method: ${method})`);
                            return price;
                        }
                    } catch (error) {
                        console.warn(`LP price calculation method '${method}' failed for ${pairName}:`, error);
                        continue;
                    }
                }
                
                throw new Error(`All LP price calculation methods failed for ${pairName}`);
                
            } catch (error) {
                console.error(`❌ Failed to get LP token price for ${pairName}:`, error);
                return 1.0; // Fallback price
            }
        }

        /**
         * Get reward token price
         */
        async getRewardTokenPrice(options = {}) {
            try {
                // Assuming reward token is LIB token
                return await this.getTokenPrice('LIB', options);
            } catch (error) {
                console.error('Failed to get reward token price:', error);
                return 0.50; // Fallback price
            }
        }

        /**
         * Fetch price from CoinGecko API
         */
        async fetchPriceFromCoinGecko(coinGeckoId) {
            const url = `${this.config.COINGECKO_BASE_URL}/simple/price?ids=${coinGeckoId}&vs_currencies=usd`;
            
            const response = await this.makeRequest(url);
            
            if (response && response[coinGeckoId] && response[coinGeckoId].usd) {
                return response[coinGeckoId].usd;
            }
            
            throw new Error(`Invalid response from CoinGecko for ${coinGeckoId}`);
        }

        /**
         * Calculate LP token price from reserves (Method 1)
         */
        async calculatePriceFromReserves(pairName) {
            // This would require contract calls to get reserves
            // For now, return null to try next method
            console.log(`Reserves method not implemented for ${pairName}`);
            return null;
        }

        /**
         * Calculate LP token price from DEX API (Method 2)
         */
        async calculatePriceFromDEX(pairName) {
            try {
                // Parse pair name to get token symbols
                const [token0, token1] = pairName.split('-');
                
                // Get individual token prices
                const price0 = await this.getTokenPrice(token0);
                const price1 = await this.getTokenPrice(token1);
                
                // Simple calculation: average of both token prices
                // In reality, this would need to account for reserves and pool composition
                const lpPrice = (price0 + price1) / 2;
                
                return lpPrice;
                
            } catch (error) {
                console.error(`DEX price calculation failed for ${pairName}:`, error);
                return null;
            }
        }

        /**
         * Get fallback price for LP tokens (Method 3)
         */
        getFallbackPrice(pairName) {
            const fallbackPrices = {
                'LIB-USDT': 1.25,
                'LIB-WETH': 2.50,
                'LIB-MATIC': 0.85,
                'LIB-USDC': 1.20
            };
            
            return fallbackPrices[pairName] || 1.0;
        }

        /**
         * Get fallback token price
         */
        async getFallbackTokenPrice(tokenSymbol) {
            const fallbackPrices = {
                'LIB': 0.50,
                'USDT': 1.00,
                'USDC': 1.00,
                'WETH': 2500.00,
                'MATIC': 0.80
            };

            const price = fallbackPrices[tokenSymbol.toUpperCase()] || 1.0;

            // Cache fallback price
            const cacheKey = `price_${tokenSymbol.toLowerCase()}`;
            this.priceCache.set(cacheKey, {
                price: price,
                timestamp: Date.now(),
                source: 'fallback'
            });

            console.log(`⚠️ Using fallback price for ${tokenSymbol}: $${price}`);
            return price;
        }

        /**
         * Make HTTP request with timeout and retry logic
         */
        async makeRequest(url, options = {}) {
            const requestOptions = {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'LP-Staking-Platform/1.0'
                },
                ...options
            };

            for (let attempt = 1; attempt <= this.config.MAX_RETRIES; attempt++) {
                try {
                    console.log(`📡 Making request to: ${url} (attempt ${attempt})`);

                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), this.config.COINGECKO_TIMEOUT);

                    const response = await fetch(url, {
                        ...requestOptions,
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    const data = await response.json();
                    console.log(`✅ Request successful: ${url}`);
                    return data;

                } catch (error) {
                    console.warn(`⚠️ Request failed (attempt ${attempt}): ${error.message}`);

                    if (attempt === this.config.MAX_RETRIES) {
                        throw error;
                    }

                    // Wait before retry
                    await this.delay(this.config.RETRY_DELAY * attempt);
                }
            }
        }

        /**
         * Enforce rate limiting between requests
         */
        async enforceRateLimit() {
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;

            if (timeSinceLastRequest < this.config.RATE_LIMIT_DELAY) {
                const waitTime = this.config.RATE_LIMIT_DELAY - timeSinceLastRequest;
                await this.delay(waitTime);
            }

            this.lastRequestTime = Date.now();
        }

        /**
         * Update all cached prices
         */
        async updateAllPrices() {
            try {
                console.log('🔄 Updating all cached prices...');

                const updatePromises = [];

                // Update token prices
                for (const [cacheKey, cacheEntry] of this.priceCache.entries()) {
                    if (cacheKey.startsWith('price_')) {
                        const tokenSymbol = cacheKey.replace('price_', '').toUpperCase();
                        updatePromises.push(
                            this.getTokenPrice(tokenSymbol, { forceRefresh: true })
                                .catch(error => console.warn(`Failed to update ${tokenSymbol}:`, error))
                        );
                    } else if (cacheKey.startsWith('lp_price_')) {
                        const pairName = cacheEntry.pairName;
                        updatePromises.push(
                            this.getLPTokenPrice(pairName, { forceRefresh: true })
                                .catch(error => console.warn(`Failed to update LP ${pairName}:`, error))
                        );
                    }
                }

                // Execute updates with concurrency limit
                await this.executeConcurrentRequests(updatePromises);

                console.log('✅ Price update completed');

            } catch (error) {
                console.error('❌ Price update failed:', error);
            }
        }

        /**
         * Execute concurrent requests with limit
         */
        async executeConcurrentRequests(promises) {
            const results = [];

            for (let i = 0; i < promises.length; i += this.config.MAX_CONCURRENT_REQUESTS) {
                const batch = promises.slice(i, i + this.config.MAX_CONCURRENT_REQUESTS);
                const batchResults = await Promise.allSettled(batch);
                results.push(...batchResults);

                // Small delay between batches
                if (i + this.config.MAX_CONCURRENT_REQUESTS < promises.length) {
                    await this.delay(500);
                }
            }

            return results;
        }

        /**
         * Check if cache entry is valid
         */
        isCacheValid(key) {
            const entry = this.priceCache.get(key);
            if (!entry) return false;

            const age = Date.now() - entry.timestamp;
            return age < this.config.CACHE_DURATION;
        }

        /**
         * Get all cached prices
         */
        getAllCachedPrices() {
            const prices = {};

            for (const [key, entry] of this.priceCache.entries()) {
                prices[key] = {
                    price: entry.price,
                    timestamp: entry.timestamp,
                    source: entry.source,
                    age: Date.now() - entry.timestamp
                };
            }

            return prices;
        }

        /**
         * Clear price cache
         */
        clearCache() {
            this.priceCache.clear();
            console.log('PriceFeeds: Cache cleared');
        }

        /**
         * Get system statistics
         */
        getStats() {
            return {
                cacheSize: this.priceCache.size,
                isInitialized: this.isInitialized,
                autoUpdateEnabled: !!this.updateInterval,
                activeRequests: this.activeRequests,
                queuedRequests: this.requestQueue.length,
                lastRequestTime: this.lastRequestTime
            };
        }

        /**
         * Utility: Delay function
         */
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
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
            this.requestQueue = [];
            this.activeRequests = 0;
            this.isInitialized = false;

            console.log('PriceFeeds: Resources cleaned up');
        }
    }

    // Export to global scope
    global.PriceFeeds = PriceFeeds;

    console.log('✅ PriceFeeds class registered globally');

})(typeof window !== 'undefined' ? window : global);
