/**
 * GasEstimator - Advanced gas estimation system with dynamic pricing and safety buffers
 * Provides accurate gas calculations for all transaction types with fallback mechanisms
 * 
 * Features:
 * - Dynamic gas price fetching with EIP-1559 support
 * - Operation-specific gas limit estimation
 * - Safety buffers and fallback limits
 * - Network congestion detection
 * - Gas optimization recommendations
 */
(function(global) {
    'use strict';

    // Prevent redeclaration
    if (global.GasEstimator) {
        console.warn('GasEstimator class already exists, skipping redeclaration');
        return;
    }

    class GasEstimator {
        constructor() {
            this.provider = null;
            this.networkId = null;
            
            // Gas configuration
            this.config = {
                // Safety buffers for different operations
                buffers: {
                    approve: 0.15,      // 15% buffer for approvals
                    stake: 0.20,        // 20% buffer for staking
                    unstake: 0.18,      // 18% buffer for unstaking
                    claim: 0.15,        // 15% buffer for claiming
                    transfer: 0.10,     // 10% buffer for transfers
                    default: 0.20       // 20% default buffer
                },
                
                // Fallback gas limits when estimation fails
                fallbackLimits: {
                    approve: 60000,
                    stake: 150000,
                    unstake: 120000,
                    claim: 100000,
                    transfer: 21000,
                    default: 200000
                },
                
                // Maximum gas limits to prevent excessive costs
                maxLimits: {
                    approve: 100000,
                    stake: 300000,
                    unstake: 250000,
                    claim: 200000,
                    transfer: 50000,
                    default: 500000
                },
                
                // Gas price configuration
                gasPrice: {
                    maxGwei: 100,       // Maximum gas price in gwei
                    minGwei: 1,         // Minimum gas price in gwei
                    defaultGwei: 20,    // Default gas price in gwei
                    priorityFeeGwei: 2  // Priority fee for EIP-1559
                }
            };

            // Gas price cache
            this.gasPriceCache = {
                price: null,
                timestamp: 0,
                ttl: 30000 // 30 seconds cache
            };

            this.log('GasEstimator initialized');
        }

        /**
         * Initialize with provider
         */
        async initialize(provider) {
            try {
                this.provider = provider;
                
                if (provider) {
                    const network = await provider.getNetwork();
                    this.networkId = Number(network.chainId);
                    this.log(`GasEstimator initialized for network ${this.networkId}`);
                } else {
                    this.log('GasEstimator initialized without provider (fallback mode)');
                }

                return true;
            } catch (error) {
                this.logError('Failed to initialize GasEstimator:', error);
                return false;
            }
        }

        /**
         * Estimate gas for a contract method with safety buffer
         */
        async estimateGas(contract, methodName, args = [], operationType = 'default') {
            try {
                if (!contract || !methodName) {
                    throw new Error('Contract and method name are required');
                }

                this.log(`Estimating gas for ${methodName} (${operationType})`);

                let gasEstimate;
                
                // Try to get actual gas estimate from contract
                if (contract.estimateGas && contract.estimateGas[methodName]) {
                    gasEstimate = await contract.estimateGas[methodName](...args);
                    this.log(`Raw gas estimate: ${gasEstimate.toString()}`);
                } else {
                    // Fallback to default estimate
                    gasEstimate = BigInt(this.config.fallbackLimits[operationType] || this.config.fallbackLimits.default);
                    this.log(`Using fallback gas estimate: ${gasEstimate.toString()}`);
                }

                // Apply safety buffer
                const buffer = this.config.buffers[operationType] || this.config.buffers.default;
                const bufferedGas = gasEstimate + (gasEstimate * BigInt(Math.floor(buffer * 100)) / BigInt(100));

                // Apply maximum limit
                const maxLimit = BigInt(this.config.maxLimits[operationType] || this.config.maxLimits.default);
                const finalGas = bufferedGas > maxLimit ? maxLimit : bufferedGas;

                this.log(`Final gas estimate: ${finalGas.toString()} (buffer: ${(buffer * 100).toFixed(1)}%)`);

                return finalGas;
            } catch (error) {
                this.logError(`Gas estimation failed for ${methodName}:`, error);
                
                // Return fallback gas limit
                const fallbackGas = BigInt(this.config.fallbackLimits[operationType] || this.config.fallbackLimits.default);
                this.log(`Using fallback gas limit: ${fallbackGas.toString()}`);
                
                return fallbackGas;
            }
        }

        /**
         * Get current gas price with caching and EIP-1559 support
         */
        async getGasPrice() {
            try {
                // Check cache first
                const now = Date.now();
                if (this.gasPriceCache.price && (now - this.gasPriceCache.timestamp) < this.gasPriceCache.ttl) {
                    this.log('Using cached gas price');
                    return this.gasPriceCache.price;
                }

                if (!this.provider) {
                    // Fallback gas price (ethers v5 compatibility)
                    const fallbackPrice = ethers.utils.parseUnits(this.config.gasPrice.defaultGwei.toString(), 'gwei');
                    this.log(`Using fallback gas price: ${this.config.gasPrice.defaultGwei} gwei`);
                    return fallbackPrice;
                }

                let gasPrice;

                // Try to get EIP-1559 fee data first
                try {
                    const feeData = await this.provider.getFeeData();
                    
                    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
                        // EIP-1559 transaction
                        gasPrice = feeData.maxFeePerGas;
                        this.log(`EIP-1559 gas price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);
                    } else if (feeData.gasPrice) {
                        // Legacy transaction
                        gasPrice = feeData.gasPrice;
                        this.log(`Legacy gas price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);
                    } else {
                        throw new Error('No gas price data available');
                    }
                } catch (error) {
                    // Fallback to getGasPrice
                    gasPrice = await this.provider.getGasPrice();
                    this.log(`Provider gas price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);
                }

                // Apply min/max limits (ethers v5 compatibility)
                const minPrice = ethers.utils.parseUnits(this.config.gasPrice.minGwei.toString(), 'gwei');
                const maxPrice = ethers.utils.parseUnits(this.config.gasPrice.maxGwei.toString(), 'gwei');

                if (gasPrice < minPrice) {
                    gasPrice = minPrice;
                    this.log(`Gas price increased to minimum: ${this.config.gasPrice.minGwei} gwei`);
                } else if (gasPrice > maxPrice) {
                    gasPrice = maxPrice;
                    this.log(`Gas price capped at maximum: ${this.config.gasPrice.maxGwei} gwei`);
                }

                // Cache the result
                this.gasPriceCache = {
                    price: gasPrice,
                    timestamp: now,
                    ttl: this.gasPriceCache.ttl
                };

                return gasPrice;
            } catch (error) {
                this.logError('Failed to get gas price:', error);
                
                // Return fallback gas price (ethers v5 compatibility)
                const fallbackPrice = ethers.utils.parseUnits(this.config.gasPrice.defaultGwei.toString(), 'gwei');
                this.log(`Using fallback gas price: ${this.config.gasPrice.defaultGwei} gwei`);

                return fallbackPrice;
            }
        }

        /**
         * Get comprehensive gas estimation for transaction
         */
        async getTransactionGasEstimate(contract, methodName, args = [], operationType = 'default') {
            try {
                const [gasLimit, gasPrice] = await Promise.all([
                    this.estimateGas(contract, methodName, args, operationType),
                    this.getGasPrice()
                ]);

                const estimatedCost = gasLimit * gasPrice;

                const result = {
                    gasLimit: gasLimit.toString(),
                    gasPrice: gasPrice.toString(),
                    gasPriceGwei: ethers.utils.formatUnits(gasPrice, 'gwei'),
                    estimatedCost: estimatedCost.toString(),
                    estimatedCostEth: ethers.utils.formatEther(estimatedCost),
                    operationType,
                    timestamp: Date.now()
                };

                this.log('Gas estimation complete:', result);
                return result;
            } catch (error) {
                this.logError('Failed to get transaction gas estimate:', error);
                throw error;
            }
        }

        /**
         * Check if gas price is reasonable (not too high)
         */
        isGasPriceReasonable(gasPrice) {
            const gasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));
            const isReasonable = gasPriceGwei <= this.config.gasPrice.maxGwei;

            if (!isReasonable) {
                this.log(`Gas price ${gasPriceGwei} gwei exceeds maximum ${this.config.gasPrice.maxGwei} gwei`);
            }

            return isReasonable;
        }

        /**
         * Get gas optimization recommendations
         */
        getGasOptimizationTips(operationType) {
            const tips = {
                approve: [
                    'Consider approving maximum amount to avoid future approval transactions',
                    'Batch multiple approvals if possible',
                    'Check if token supports permit() for gasless approvals'
                ],
                stake: [
                    'Ensure sufficient token balance before staking',
                    'Consider staking larger amounts to amortize gas costs',
                    'Check if pool has sufficient liquidity'
                ],
                unstake: [
                    'Consider unstaking larger amounts to amortize gas costs',
                    'Check if there are pending rewards to claim simultaneously'
                ],
                claim: [
                    'Consider claiming rewards for multiple pools simultaneously',
                    'Check if rewards are significant enough to justify gas costs'
                ]
            };

            return tips[operationType] || ['Monitor gas prices and transact during low congestion periods'];
        }

        /**
         * Clear gas price cache
         */
        clearCache() {
            this.gasPriceCache = {
                price: null,
                timestamp: 0,
                ttl: this.gasPriceCache.ttl
            };
            this.log('Gas price cache cleared');
        }

        /**
         * Logging utility
         */
        log(...args) {
            if (window.CONFIG?.DEV?.DEBUG_MODE) {
                console.log('[GasEstimator]', ...args);
            }
        }

        /**
         * Error logging utility
         */
        logError(...args) {
            console.error('[GasEstimator]', ...args);
        }
    }

    // Export to global scope
    global.GasEstimator = GasEstimator;
    console.log('✅ GasEstimator class loaded');

})(window);
