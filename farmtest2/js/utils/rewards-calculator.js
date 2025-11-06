/**
 * RewardsCalculator - Minimal APR helper used by the active homepage flow.
 */
(function(global) {
    'use strict';

    if (global.RewardsCalculator) {
        console.warn('RewardsCalculator already registered, skipping redeclaration');
        return;
    }

    if (global.rewardsCalculator) {
        console.warn('RewardsCalculator instance already exists, preserving existing instance');
        return;
    }

    class RewardsCalculator {
        constructor() {
            this.contractManager = null;
            this.priceFeeds = null;
            this.isInitialized = false;
        }

        async initialize(contractManagerOrOptions, priceFeeds) {
            const { contractManager, priceFeeds: normalizedFeeds } = this.normalizeInitArgs(
                contractManagerOrOptions,
                priceFeeds
            );

            this.contractManager = contractManager || null;
            this.priceFeeds = normalizedFeeds || null;
            this.isInitialized = true;

            return {
                hasContractManager: !!this.contractManager,
                hasPriceFeeds: !!this.priceFeeds
            };
        }

        normalizeInitArgs(contractManagerOrOptions, priceFeeds) {
            if (contractManagerOrOptions && typeof contractManagerOrOptions === 'object' && !Array.isArray(contractManagerOrOptions)) {
                const hasOptionsShape = Object.prototype.hasOwnProperty.call(contractManagerOrOptions, 'contractManager') ||
                    Object.prototype.hasOwnProperty.call(contractManagerOrOptions, 'priceFeeds');

                if (hasOptionsShape) {
                    return {
                        contractManager: contractManagerOrOptions.contractManager,
                        priceFeeds: contractManagerOrOptions.priceFeeds
                    };
                }
            }

            return {
                contractManager: contractManagerOrOptions,
                priceFeeds
            };
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
    }

    global.RewardsCalculator = RewardsCalculator;
    console.log('✅ RewardsCalculator class registered globally');
})(typeof window !== 'undefined' ? window : global);
