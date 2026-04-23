/**
 * GeckoTerminalPriceProvider - Primary token USD pricing by chain + token address.
 */
(function(global) {
    'use strict';

    if (global.GeckoTerminalPriceProvider) {
        console.warn('GeckoTerminalPriceProvider already registered, skipping redeclaration');
        return;
    }

    class GeckoTerminalPriceProvider {
        constructor() {
            this.name = 'geckoterminal';
            this.baseUrl = 'https://api.geckoterminal.com/api/v2/simple/networks';
        }

        normalizeAddress(address) {
            return typeof address === 'string' ? address.toLowerCase() : null;
        }

        getNetworkId(chainId) {
            switch (Number(chainId)) {
                case 56:
                    return 'bsc';
                case 137:
                    return 'polygon_pos';
                default:
                    return null;
            }
        }

        parseTokenPrice(address, data) {
            const normalizedAddress = this.normalizeAddress(address);
            const tokenPrices = data?.data?.attributes?.token_prices;

            if (!normalizedAddress || !tokenPrices || typeof tokenPrices !== 'object') {
                return 0;
            }

            const matchedEntry = Object.entries(tokenPrices).find(([tokenAddress]) => {
                return this.normalizeAddress(tokenAddress) === normalizedAddress;
            });

            return Number.parseFloat(matchedEntry?.[1] || '0') || 0;
        }

        async fetchTokenPrice(address, context = {}) {
            const normalizedAddress = this.normalizeAddress(address);
            const networkId = this.getNetworkId(context.chainId);

            if (!normalizedAddress || !networkId || typeof fetch !== 'function') {
                return 0;
            }

            const response = await fetch(`${this.baseUrl}/${networkId}/token_price/${normalizedAddress}`);
            if (!response.ok) {
                throw new Error(`GeckoTerminal price request failed: ${response.status}`);
            }

            const data = await response.json();
            return this.parseTokenPrice(normalizedAddress, data);
        }
    }

    global.GeckoTerminalPriceProvider = GeckoTerminalPriceProvider;
    console.log('✅ GeckoTerminalPriceProvider class registered globally');
})(typeof window !== 'undefined' ? window : global);
