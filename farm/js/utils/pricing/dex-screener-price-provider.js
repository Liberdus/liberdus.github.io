/**
 * DexScreenerPriceProvider - Secondary token USD pricing fallback by chain + liquidity.
 */
(function(global) {
    'use strict';

    if (global.DexScreenerPriceProvider) {
        console.warn('DexScreenerPriceProvider already registered, skipping redeclaration');
        return;
    }

    class DexScreenerPriceProvider {
        constructor() {
            this.name = 'dexscreener';
            this.baseUrl = 'https://api.dexscreener.com/latest/dex/tokens';
        }

        normalizeAddress(address) {
            return typeof address === 'string' ? address.toLowerCase() : null;
        }

        parseAmount(value) {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : 0;
        }

        getChainId(chainId) {
            switch (Number(chainId)) {
                case 56:
                    return 'bsc';
                case 137:
                    return 'polygon';
                default:
                    return null;
            }
        }

        getPairLiquidityUsd(pair) {
            return this.parseAmount(pair?.liquidity?.usd);
        }

        getBestPair(address, data, context = {}) {
            const normalizedAddress = this.normalizeAddress(address);
            const resolvedChainId = this.getChainId(context.chainId);
            const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
            const candidatePairs = pairs.filter((pair) => {
                const priceUsd = Number.parseFloat(pair?.priceUsd || '0') || 0;
                const baseTokenAddress = this.normalizeAddress(pair?.baseToken?.address);

                if (priceUsd <= 0 || !normalizedAddress || baseTokenAddress !== normalizedAddress) {
                    return false;
                }

                if (resolvedChainId && pair?.chainId !== resolvedChainId) {
                    return false;
                }

                return true;
            });

            if (candidatePairs.length === 0) {
                return null;
            }

            return candidatePairs.reduce((bestPair, pair) => {
                if (!bestPair) {
                    return pair;
                }

                const bestLiquidityUsd = this.getPairLiquidityUsd(bestPair);
                const pairLiquidityUsd = this.getPairLiquidityUsd(pair);

                if (pairLiquidityUsd > bestLiquidityUsd) {
                    return pair;
                }

                return bestPair;
            }, null);
        }

        async fetchTokenPrice(address, context = {}) {
            const normalizedAddress = this.normalizeAddress(address);
            const resolvedChainId = this.getChainId(context.chainId);

            if (!normalizedAddress || !resolvedChainId || typeof fetch !== 'function') {
                return 0;
            }

            const response = await fetch(`${this.baseUrl}/${normalizedAddress}`);
            if (!response.ok) {
                throw new Error(`DexScreener price request failed: ${response.status}`);
            }

            const data = await response.json();
            const bestPair = this.getBestPair(normalizedAddress, data, context);
            return Number.parseFloat(bestPair?.priceUsd || '0') || 0;
        }
    }

    global.DexScreenerPriceProvider = DexScreenerPriceProvider;
    console.log('✅ DexScreenerPriceProvider class registered globally');
})(typeof window !== 'undefined' ? window : global);
