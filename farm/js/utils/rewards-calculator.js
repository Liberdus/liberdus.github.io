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
            this.isInitialized = false;
        }

        async initialize(contractManagerOrOptions) {
            const { contractManager } = this.normalizeInitArgs(contractManagerOrOptions);

            this.contractManager = contractManager || null;
            this.isInitialized = true;

            return {
                hasContractManager: !!this.contractManager
            };
        }

        normalizeInitArgs(contractManagerOrOptions) {
            if (contractManagerOrOptions && typeof contractManagerOrOptions === 'object' && !Array.isArray(contractManagerOrOptions)) {
                const hasOptionsShape = Object.prototype.hasOwnProperty.call(contractManagerOrOptions, 'contractManager');

                if (hasOptionsShape) {
                    return {
                        contractManager: contractManagerOrOptions.contractManager
                    };
                }
            }

            return {
                contractManager: contractManagerOrOptions
            };
        }

        /**
         * Calculate APR from the on-chain LIB-per-LP ratio.
         *
         * @param {number} hourlyRate - Total LIB distributed per hour across all pools.
         * @param {number} tvlLpTokens - Total LP tokens staked in this pool (formatted, not wei).
         * @param {number|Object} libPerLp - LIB-equivalent value backing one LP token, or legacy options object with libPerLp/poolWeight/totalWeight.
         * @param {number} [poolWeight=1] - Pool-specific weight used for reward distribution.
         * @param {number} [totalWeight=1] - Sum of all pool weights.
         * @returns {number} APR percentage (e.g., 150 equals 150%).
         */
        calcAPR(hourlyRate, tvlLpTokens, libPerLp, poolWeight = 1, totalWeight = 1) {
            if (typeof libPerLp === 'object' && libPerLp !== null) {
                const opts = libPerLp;
                libPerLp = opts.libPerLp ?? 0;
                poolWeight = opts.poolWeight ?? poolWeight;
                totalWeight = opts.totalWeight ?? totalWeight;
            }

            if (!hourlyRate || !tvlLpTokens || !libPerLp || !poolWeight || !totalWeight) {
                return 0;
            }

            const pairPct = poolWeight / totalWeight;
            if (pairPct <= 0) {
                return 0;
            }

            const annualRewards = hourlyRate * 8760 * pairPct;
            return (annualRewards / (tvlLpTokens * libPerLp)) * 100;
        }
    }

    global.RewardsCalculator = RewardsCalculator;
    console.log('✅ RewardsCalculator class registered globally');
})(typeof window !== 'undefined' ? window : global);
