/**
 * DataFetcher - Real-time blockchain data fetching system
 * Provides comprehensive data management with caching, error handling, and real-time updates
 * Eliminates missing real-time data functionality
 */
(function(global) {
    'use strict';

    // Prevent redeclaration
    if (global.DataFetcher) {
        console.warn('DataFetcher class already exists, skipping redeclaration');
        return;
    }

    class DataFetcher {
        constructor() {
            this.cache = new Map();
            this.subscriptions = new Map();
            this.updateIntervals = new Map();
            this.isInitialized = false;
            this.contractManager = null;
            this.stateManager = null;
            
            // Data refresh intervals (in milliseconds)
            this.refreshIntervals = {
                userBalances: 10000,      // 10 seconds
                stakingData: 15000,       // 15 seconds
                rewardsData: 20000,       // 20 seconds
                contractStats: 30000,     // 30 seconds
                priceData: 60000          // 1 minute
            };
            
            // Cache expiry times
            this.cacheExpiry = {
                userBalances: 30000,      // 30 seconds
                stakingData: 45000,       // 45 seconds
                rewardsData: 60000,       // 1 minute
                contractStats: 120000,    // 2 minutes
                priceData: 300000         // 5 minutes
            };
            
            this.log('DataFetcher created - ready for real-time data management');
        }

        /**
         * Initialize the data fetcher
         */
        async initialize() {
            if (this.isInitialized) {
                this.log('DataFetcher already initialized');
                return true;
            }

            try {
                // Wait for dependencies
                await this.waitForDependencies();
                
                // Setup data subscriptions
                this.setupDataSubscriptions();
                
                // Start real-time updates
                this.startRealTimeUpdates();
                
                this.isInitialized = true;
                this.log('✅ DataFetcher initialized successfully');
                return true;
                
            } catch (error) {
                this.log('❌ DataFetcher initialization failed:', error);
                return false;
            }
        }

        /**
         * Wait for required dependencies
         */
        async waitForDependencies() {
            const maxWait = 10000; // 10 seconds
            const startTime = Date.now();
            
            while (Date.now() - startTime < maxWait) {
                if (global.contractManager && global.stateManager) {
                    this.contractManager = global.contractManager;
                    this.stateManager = global.stateManager;
                    this.log('Dependencies found');
                    return;
                }
                
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            throw new Error('Required dependencies not found within timeout');
        }

        /**
         * Setup data subscriptions
         */
        setupDataSubscriptions() {
            this.log('Setting up data subscriptions...');
            
            // Subscribe to wallet connection changes
            if (this.stateManager) {
                this.stateManager.subscribe('wallet.connected', (connected) => {
                    if (connected) {
                        this.refreshAllUserData();
                    } else {
                        this.clearUserData();
                    }
                });
                
                this.stateManager.subscribe('wallet.address', (address) => {
                    if (address) {
                        this.refreshAllUserData();
                    }
                });
            }
            
            this.log('Data subscriptions setup complete');
        }

        /**
         * Start real-time updates
         */
        startRealTimeUpdates() {
            this.log('Starting real-time updates...');
            
            // Setup intervals for different data types
            Object.entries(this.refreshIntervals).forEach(([dataType, interval]) => {
                const intervalId = setInterval(() => {
                    this.refreshData(dataType);
                }, interval);
                
                this.updateIntervals.set(dataType, intervalId);
            });
            
            // Initial data fetch
            this.refreshAllData();
            
            this.log('Real-time updates started');
        }

        /**
         * Refresh all data
         */
        async refreshAllData() {
            this.log('Refreshing all data...');
            
            const dataTypes = Object.keys(this.refreshIntervals);
            const promises = dataTypes.map(dataType => this.refreshData(dataType));
            
            try {
                await Promise.allSettled(promises);
                this.log('All data refresh completed');
            } catch (error) {
                this.log('Error during data refresh:', error);
            }
        }

        /**
         * Refresh all user-specific data
         */
        async refreshAllUserData() {
            this.log('Refreshing user data...');
            
            const userDataTypes = ['userBalances', 'stakingData', 'rewardsData'];
            const promises = userDataTypes.map(dataType => this.refreshData(dataType));
            
            try {
                await Promise.allSettled(promises);
                this.log('User data refresh completed');
            } catch (error) {
                this.log('Error during user data refresh:', error);
            }
        }

        /**
         * Refresh specific data type
         */
        async refreshData(dataType) {
            try {
                // Check if data is still fresh in cache
                if (this.isCacheFresh(dataType)) {
                    return this.cache.get(dataType);
                }
                
                let data;
                
                switch (dataType) {
                    case 'userBalances':
                        data = await this.fetchUserBalances();
                        break;
                    case 'stakingData':
                        data = await this.fetchStakingData();
                        break;
                    case 'rewardsData':
                        data = await this.fetchRewardsData();
                        break;
                    case 'contractStats':
                        data = await this.fetchContractStats();
                        break;
                    case 'priceData':
                        data = await this.fetchPriceData();
                        break;
                    default:
                        this.log(`Unknown data type: ${dataType}`);
                        return null;
                }
                
                // Cache the data
                this.cacheData(dataType, data);
                
                // Update state manager
                if (this.stateManager) {
                    this.stateManager.setState(`data.${dataType}`, data);
                }
                
                // Notify subscribers
                this.notifySubscribers(dataType, data);
                
                return data;
                
            } catch (error) {
                this.log(`Error refreshing ${dataType}:`, error);
                
                // Return cached data if available
                return this.cache.get(dataType) || null;
            }
        }

        /**
         * Fetch user balances
         */
        async fetchUserBalances() {
            if (!this.contractManager || !this.contractManager.isConnected()) {
                return null;
            }
            
            const userAddress = this.stateManager?.getState('wallet.address');
            if (!userAddress) {
                return null;
            }
            
            try {
                const balances = await this.contractManager.getUserBalances(userAddress);
                this.log('User balances fetched:', balances);
                return balances;
            } catch (error) {
                this.log('Error fetching user balances:', error);
                throw error;
            }
        }

        /**
         * Fetch staking data
         */
        async fetchStakingData() {
            if (!this.contractManager || !this.contractManager.isConnected()) {
                return null;
            }
            
            const userAddress = this.stateManager?.getState('wallet.address');
            if (!userAddress) {
                return null;
            }
            
            try {
                const stakingData = await this.contractManager.getStakingInfo(userAddress);
                this.log('Staking data fetched:', stakingData);
                return stakingData;
            } catch (error) {
                this.log('Error fetching staking data:', error);
                throw error;
            }
        }

        /**
         * Fetch rewards data
         */
        async fetchRewardsData() {
            if (!this.contractManager || !this.contractManager.isConnected()) {
                return null;
            }
            
            const userAddress = this.stateManager?.getState('wallet.address');
            if (!userAddress) {
                return null;
            }
            
            try {
                const rewardsData = await this.contractManager.getPendingRewards(userAddress);
                this.log('Rewards data fetched:', rewardsData);
                return rewardsData;
            } catch (error) {
                this.log('Error fetching rewards data:', error);
                throw error;
            }
        }

        /**
         * Fetch contract statistics
         */
        async fetchContractStats() {
            if (!this.contractManager || !this.contractManager.isConnected()) {
                return null;
            }
            
            try {
                const stats = await this.contractManager.getContractStats();
                this.log('Contract stats fetched:', stats);
                return stats;
            } catch (error) {
                this.log('Error fetching contract stats:', error);
                throw error;
            }
        }

        /**
         * Fetch price data (mock implementation)
         */
        async fetchPriceData() {
            try {
                // Mock price data - in real implementation, this would fetch from price APIs
                const priceData = {
                    libToken: 1.25,
                    usdtToken: 1.00,
                    lpToken: 2.15,
                    lastUpdated: Date.now()
                };
                
                this.log('Price data fetched:', priceData);
                return priceData;
            } catch (error) {
                this.log('Error fetching price data:', error);
                throw error;
            }
        }

        /**
         * Check if cached data is still fresh
         */
        isCacheFresh(dataType) {
            const cached = this.cache.get(dataType);
            if (!cached) return false;
            
            const expiry = this.cacheExpiry[dataType] || 60000;
            return (Date.now() - cached.timestamp) < expiry;
        }

        /**
         * Cache data with timestamp
         */
        cacheData(dataType, data) {
            this.cache.set(dataType, {
                data,
                timestamp: Date.now()
            });
        }

        /**
         * Get cached data
         */
        getCachedData(dataType) {
            const cached = this.cache.get(dataType);
            return cached ? cached.data : null;
        }

        /**
         * Subscribe to data updates
         */
        subscribe(dataType, callback) {
            if (!this.subscriptions.has(dataType)) {
                this.subscriptions.set(dataType, new Set());
            }
            
            this.subscriptions.get(dataType).add(callback);
            
            // Return unsubscribe function
            return () => {
                const subscribers = this.subscriptions.get(dataType);
                if (subscribers) {
                    subscribers.delete(callback);
                }
            };
        }

        /**
         * Notify subscribers of data updates
         */
        notifySubscribers(dataType, data) {
            const subscribers = this.subscriptions.get(dataType);
            if (subscribers) {
                subscribers.forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        this.log(`Error in subscriber callback for ${dataType}:`, error);
                    }
                });
            }
        }

        /**
         * Clear user-specific data
         */
        clearUserData() {
            const userDataTypes = ['userBalances', 'stakingData', 'rewardsData'];
            userDataTypes.forEach(dataType => {
                this.cache.delete(dataType);
                if (this.stateManager) {
                    this.stateManager.setState(`data.${dataType}`, null);
                }
                this.notifySubscribers(dataType, null);
            });
            
            this.log('User data cleared');
        }

        /**
         * Stop all real-time updates
         */
        stopRealTimeUpdates() {
            this.updateIntervals.forEach((intervalId, dataType) => {
                clearInterval(intervalId);
                this.log(`Stopped updates for ${dataType}`);
            });
            
            this.updateIntervals.clear();
            this.log('All real-time updates stopped');
        }

        /**
         * Cleanup
         */
        cleanup() {
            this.stopRealTimeUpdates();
            this.cache.clear();
            this.subscriptions.clear();
            this.isInitialized = false;
            this.log('DataFetcher cleaned up');
        }

        /**
         * Get system health status
         */
        isHealthy() {
            return this.isInitialized && 
                   this.contractManager && 
                   this.stateManager && 
                   this.updateIntervals.size > 0;
        }

        /**
         * Logging utility
         */
        log(...args) {
            console.log('[DataFetcher]', ...args);
        }
    }

    // Export DataFetcher class
    global.DataFetcher = DataFetcher;
    console.log('✅ DataFetcher class loaded');

})(window);
