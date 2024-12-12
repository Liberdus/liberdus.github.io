import { isDebugEnabled } from '../config.js';
import { getNetworkConfig } from '../config.js';

export class PricingService {
    constructor() {
        this.prices = new Map();
        this.lastUpdate = null;
        this.updating = false;
        this.subscribers = new Set();
        this.rateLimitDelay = 250; // Ensure we stay under 300 requests/minute
        this.networkConfig = getNetworkConfig();
        
        this.debug = (message, ...args) => {
            if (isDebugEnabled('PRICING')) {
                console.log('[PricingService]', message, ...args);
            }
        };

        this.refreshPromise = null; // Track current refresh promise
    }

    async initialize() {
        await this.refreshPrices();
    }

    subscribe(callback) {
        this.subscribers.add(callback);
    }

    unsubscribe(callback) {
        this.subscribers.delete(callback);
    }

    notifySubscribers(event, data) {
        this.subscribers.forEach(callback => callback(event, data));
    }

    async fetchTokenPrices(tokenAddresses) {
        // DexScreener allows up to 30 addresses per request
        const chunks = [];
        for (let i = 0; i < tokenAddresses.length; i += 30) {
            chunks.push(tokenAddresses.slice(i, i + 30));
        }

        const prices = new Map();
        
        for (const chunk of chunks) {
            try {
                const addresses = chunk.join(',');
                const url = `https://api.dexscreener.com/latest/dex/tokens/${addresses}`;
                
                const response = await fetch(url);
                if (!response.ok) throw new Error('Failed to fetch prices');
                
                const data = await response.json();
                
                // Process each pair to get the most liquid price for each token
                if (data.pairs) {
                    for (const pair of data.pairs) {
                        const baseToken = pair.baseToken.address.toLowerCase();
                        const quoteToken = pair.quoteToken.address.toLowerCase();
                        
                        if (pair.priceUsd) {
                            // Update price if we don't have it or if this pair has more liquidity
                            if (!prices.has(baseToken) || 
                                (pair.liquidity?.usd > prices.get(baseToken).liquidity)) {
                                prices.set(baseToken, {
                                    price: parseFloat(pair.priceUsd),
                                    liquidity: pair.liquidity?.usd || 0
                                });
                            }
                            
                            // If quote token is also in our list, calculate its price
                            if (chunk.includes(quoteToken)) {
                                const quotePrice = parseFloat(pair.priceUsd) / parseFloat(pair.priceNative);
                                if (!prices.has(quoteToken) || 
                                    (pair.liquidity?.usd > prices.get(quoteToken).liquidity)) {
                                    prices.set(quoteToken, {
                                        price: quotePrice,
                                        liquidity: pair.liquidity?.usd || 0
                                    });
                                }
                            }
                        }
                    }
                }

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
                
            } catch (error) {
                this.debug('Error fetching chunk prices:', error);
            }
        }

        return prices;
    }

    async refreshPrices() {
        if (this.updating) {
            return this.refreshPromise; // Return existing promise if refresh in progress
        }
        
        this.updating = true;
        this.notifySubscribers('refreshStart'); // Notify start of refresh

        this.refreshPromise = (async () => {
            try {
                // Get unique token addresses from orders
                const tokenAddresses = new Set();
                if (window.webSocket?.orderCache) {
                    for (const order of window.webSocket.orderCache.values()) {
                        tokenAddresses.add(order.sellToken.toLowerCase());
                        tokenAddresses.add(order.buyToken.toLowerCase());
                    }
                }

                if (tokenAddresses.size === 0) {
                    this.debug('No tokens to fetch prices for');
                    return { success: true, message: 'No tokens to update' };
                }

                const prices = await this.fetchTokenPrices([...tokenAddresses]);
                
                // Update internal price map
                this.prices.clear();
                for (const [address, data] of prices.entries()) {
                    this.prices.set(address, data.price);
                }
                
                this.lastUpdate = Date.now();
                this.notifySubscribers('refreshComplete'); // Notify successful completion
                
                this.debug('Prices updated:', this.prices);
                return { success: true, message: 'Prices updated successfully' };
            } catch (error) {
                this.debug('Error refreshing prices:', error);
                this.notifySubscribers('refreshError', error); // Notify error
                return { success: false, message: 'Failed to update prices' };
            } finally {
                this.updating = false;
                this.refreshPromise = null;
            }
        })();

        return this.refreshPromise;
    }

    getPrice(tokenAddress) {
        return this.prices.get(tokenAddress.toLowerCase()) || 1;
    }

    isPriceEstimated(tokenAddress) {
        return !this.prices.has(tokenAddress.toLowerCase());
    }

    calculateRate(sellToken, buyToken) {
        const sellPrice = this.getPrice(sellToken);
        const buyPrice = this.getPrice(buyToken);
        return buyPrice / sellPrice;
    }

    calculateDeal(price, rate) {
        return price * rate;
    }

    getLastUpdateTime() {
        return this.lastUpdate ? new Date(this.lastUpdate).toLocaleTimeString() : 'Never';
    }
}