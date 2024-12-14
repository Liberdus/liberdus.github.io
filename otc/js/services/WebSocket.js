import { ethers } from 'ethers';
import { getNetworkConfig, isDebugEnabled } from '../config.js';

export class WebSocketService {
    constructor() {
        this.provider = null;
        this.subscribers = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.orderCache = new Map();
        this.isInitialized = false;
        this.contractAddress = null;
        this.contractABI = null;
        this.contract = null;
        
        // Add rate limiting properties
        this.requestQueue = [];
        this.processingQueue = false;
        this.lastRequestTime = 0;
        this.minRequestInterval = 100; // Increase from 100ms to 500ms between requests
        this.maxConcurrentRequests = 2; // Reduce from 3 to 1 concurrent request
        this.activeRequests = 0;
        
        // Add contract constants
        this.orderExpiry = null;
        this.gracePeriod = null;
        
        this.debug = (message, ...args) => {
            if (isDebugEnabled('WEBSOCKET')) {
                console.log('[WebSocket]', message, ...args);
            }
        };
        
        this.tokenCache = new Map();  // Add token cache
    }

    async queueRequest(callback) {
        while (this.activeRequests >= this.maxConcurrentRequests) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Increase wait time
        }
        
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.minRequestInterval) {
            await new Promise(resolve => 
                setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
            );
        }
        
        try {
            this.activeRequests++;
            this.debug(`Making request (active: ${this.activeRequests})`);
            const result = await callback();
            this.lastRequestTime = Date.now();
            return result;
        } catch (error) {
            if (error?.error?.code === -32005) {
                // If we hit rate limit, wait longer before retrying
                this.debug('Rate limit hit, waiting before retry...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                return this.queueRequest(callback); // Retry the request
            }
            this.debug('Request failed:', error);
            throw error;
        } finally {
            this.activeRequests--;
        }
    }

    async initialize() {
        // Prevent multiple initializations
        if (this.isInitialized) {
            console.log('[WebSocket] Already initialized, skipping...');
            return;
        }

        try {
            console.log('[WebSocket] Starting initialization...');
            
            // Add connection attempt tracking
            this.reconnectAttempts++;
            if (this.reconnectAttempts > this.maxReconnectAttempts) {
                throw new Error(`Max connection attempts (${this.maxReconnectAttempts}) exceeded`);
            }

            const config = getNetworkConfig();
            this.debug('Network config loaded, attempting WebSocket connection...');
            
            this.contractAddress = config.contractAddress;
            this.contractABI = config.contractABI;
            
            if (!this.contractABI) {
                throw new Error('Contract ABI not found in network config');
            }
            
            const wsUrls = [config.wsUrl, ...config.fallbackWsUrls];
            let connected = false;
            
            for (const url of wsUrls) {
                try {
                    this.debug('Attempting to connect to WebSocket URL:', url);
                    this.provider = new ethers.providers.WebSocketProvider(url);
                    
                    // Wait for provider to be ready
                    await this.provider.ready;
                    this.debug('Connected to WebSocket:', url);
                    connected = true;
                    break;
                } catch (error) {
                    this.debug('Failed to connect to WebSocket URL:', url, error);
                }
            }
            
            if (!connected) {
                throw new Error('Failed to connect to any WebSocket URL');
            }

            this.contract = new ethers.Contract(
                this.contractAddress,
                this.contractABI,
                this.provider
            );

            this.debug('Contract initialized:', {
                address: this.contract.address,
                abi: this.contract.interface.format()
            });

            this.debug('Fetching contract constants...');
            this.orderExpiry = await this.contract.ORDER_EXPIRY();
            this.gracePeriod = await this.contract.GRACE_PERIOD();
            this.debug('Contract constants loaded:', {
                orderExpiry: this.orderExpiry.toString(),
                gracePeriod: this.gracePeriod.toString()
            });

            this.debug('Contract initialized, starting order sync...');
            await this.syncAllOrders(this.contract);
            this.debug('Setting up event listeners...');
            await this.setupEventListeners(this.contract);
            
            this.isInitialized = true;
            this.debug('Initialization complete');
            this.reconnectAttempts = 0;
            
            return true;
        } catch (error) {
            this.debug('Initialization failed:', {
                message: error.message,
                stack: error.stack
            });
            return this.reconnect();
        }
    }

    async setupEventListeners(contract) {
        try {
            this.debug('Setting up event listeners for contract:', contract.address);
            
            // Add connection state tracking
            this.provider.on("connect", () => {
                this.debug('Provider connected');
            });
            
            this.provider.on("disconnect", (error) => {
                this.debug('Provider disconnected:', error);
                this.reconnect();
            });

            // Test event subscription
            const filter = contract.filters.OrderCreated();
            this.debug('Created filter:', filter);
            
            // Listen for new blocks to ensure connection is alive
            this.provider.on("block", async (blockNumber) => {
                await this.queueRequest(async () => {
                    this.debug('New block received:', blockNumber);
                });
            });

            contract.on("OrderCreated", (...args) => {
                try {
                    const [orderId, maker, taker, sellToken, sellAmount, buyToken, buyAmount, timestamp, fee, event] = args;
                    
                    const orderData = {
                        id: orderId.toNumber(),
                        maker,
                        taker,
                        sellToken,
                        sellAmount,
                        buyToken,
                        buyAmount,
                        timestamp: timestamp.toNumber(),
                        orderCreationFee: fee,
                        status: 'Active',
                        tries: 0
                    };
                    
                    this.orderCache.set(orderId.toNumber(), orderData);
                    this.debug('Cache updated:', Array.from(this.orderCache.entries()));
                    this.notifySubscribers("OrderCreated", orderData);
                } catch (error) {
                    this.debug('Error in OrderCreated handler:', error);
                }
            });

            contract.on("OrderFilled", (...args) => {
                const [orderId] = args;
                const orderIdNum = orderId.toNumber();
                const order = this.orderCache.get(orderIdNum);
                if (order) {
                    order.status = 'Filled';
                    this.orderCache.set(orderIdNum, order);
                    this.debug('Cache updated for filled order:', order);
                    this.notifySubscribers("OrderFilled", order);
                }
            });

            contract.on("OrderCanceled", (orderId, maker, timestamp, event) => {
                const orderIdNum = orderId.toNumber();
                const order = this.orderCache.get(orderIdNum);
                if (order) {
                    order.status = 'Canceled';
                    this.orderCache.set(orderIdNum, order);
                    this.debug('Updated order to Canceled:', orderIdNum);
                    this.notifySubscribers("OrderCanceled", order);
                }
            });

            contract.on("OrderCleanedUp", (orderId) => {
                const orderIdNum = orderId.toNumber();
                if (this.orderCache.has(orderIdNum)) {
                    this.orderCache.delete(orderIdNum);
                    this.debug('Removed cleaned up order:', orderIdNum);
                    this.notifySubscribers("OrderCleanedUp", { id: orderIdNum });
                }
            });
            
            contract.on("RetryOrder", (oldOrderId, newOrderId, maker, tries, timestamp) => {
                const oldOrderIdNum = oldOrderId.toNumber();
                const newOrderIdNum = newOrderId.toNumber();
                
                const order = this.orderCache.get(oldOrderIdNum);
                if (order) {
                    order.id = newOrderIdNum;
                    order.tries = tries.toNumber();
                    order.timestamp = timestamp.toNumber();
                    
                    this.orderCache.delete(oldOrderIdNum);
                    this.orderCache.set(newOrderIdNum, order);
                    this.debug('Updated retried order:', {oldId: oldOrderIdNum, newId: newOrderIdNum, tries: tries.toString()});
                    this.notifySubscribers("RetryOrder", order);
                }
            });
            
            this.debug('Event listeners setup complete');
        } catch (error) {
            this.debug('Error setting up event listeners:', error);
        }
    }

    async syncAllOrders(contract) {
        try {
            this.debug('Starting order sync with contract:', contract.address);
            
            // Get current block and calculate 20 days ago
            const currentBlock = await this.provider.getBlockNumber();
            const blocksPerDay = (24 * 60 * 60) / 2; // ~43,200 blocks per day
            const startBlock = currentBlock - (blocksPerDay * 20); // Look back 20 days
            
            this.debug('Fetching events from block', startBlock, 'to', currentBlock);
            
            // Clear existing cache before sync
            this.orderCache.clear();

            // Fetch all relevant events
            const [createdEvents, filledEvents, canceledEvents, cleanedEvents, retryEvents] = await Promise.all([
                contract.queryFilter(contract.filters.OrderCreated(), startBlock, currentBlock),
                contract.queryFilter(contract.filters.OrderFilled(), startBlock, currentBlock),
                contract.queryFilter(contract.filters.OrderCanceled(), startBlock, currentBlock),
                contract.queryFilter(contract.filters.OrderCleanedUp(), startBlock, currentBlock),
                contract.queryFilter(contract.filters.RetryOrder(), startBlock, currentBlock)
            ]);

            this.debug('Events fetched:', {
                created: createdEvents.length,
                filled: filledEvents.length,
                canceled: canceledEvents.length,
                cleaned: cleanedEvents.length,
                retry: retryEvents.length
            });

            // Process OrderCreated events first to build the base state
            for (const event of createdEvents) {
                const [orderId, maker, taker, sellToken, sellAmount, buyToken, buyAmount, timestamp, fee] = event.args;
                const orderData = {
                    id: orderId.toNumber(),
                    maker,
                    taker,
                    sellToken,
                    sellAmount,
                    buyToken,
                    buyAmount,
                    timestamp: timestamp.toNumber(),
                    status: 'Active',
                    orderCreationFee: fee,
                    tries: 0
                };
                this.orderCache.set(orderData.id, orderData);
                this.debug('Added order to cache:', orderData);
            }

            this.debug('After processing created events, cache size:', this.orderCache.size);

            // Then process status changes
            for (const event of filledEvents) {
                const [orderId] = event.args;
                const orderIdNum = orderId.toNumber();
                const order = this.orderCache.get(orderIdNum);
                if (order) {
                    order.status = 'Filled';
                    this.orderCache.set(orderIdNum, order);
                    this.debug('Updated order to Filled:', orderIdNum);
                } else {
                    this.debug('Filled event for unknown order:', orderIdNum);
                }
            }

            for (const event of canceledEvents) {
                const [orderId] = event.args;
                const orderIdNum = orderId.toNumber();
                const order = this.orderCache.get(orderIdNum);
                if (order) {
                    order.status = 'Canceled';
                    this.orderCache.set(orderIdNum, order);
                    this.debug('Updated order to Canceled:', orderIdNum);
                } else {
                    this.debug('Canceled event for unknown order:', orderIdNum);
                }
            }

            // Process cleanup events (remove orders)
            for (const event of cleanedEvents) {
                const [orderId] = event.args;
                const orderIdNum = orderId.toNumber();
                if (this.orderCache.has(orderIdNum)) {
                    this.orderCache.delete(orderIdNum);
                    this.debug('Removed cleaned up order:', orderIdNum);
                }
            }

            // Process retry events (update order ID and tries)
            for (const event of retryEvents) {
                const [oldOrderId, newOrderId, maker, tries, timestamp] = event.args;
                const oldOrderIdNum = oldOrderId.toNumber();
                const newOrderIdNum = newOrderId.toNumber();
                
                const order = this.orderCache.get(oldOrderIdNum);
                if (order) {
                    // Update order with new ID and tries count
                    order.id = newOrderIdNum;
                    order.tries = tries.toNumber();
                    order.timestamp = timestamp.toNumber();
                    
                    // Remove old order ID and add with new ID
                    this.orderCache.delete(oldOrderIdNum);
                    this.orderCache.set(newOrderIdNum, order);
                    this.debug('Updated retried order:', {oldId: oldOrderIdNum, newId: newOrderIdNum, tries: tries.toString()});
                }
            }

            // Log final cache state
            this.debug('Final order cache:', {
                size: this.orderCache.size,
                orders: Array.from(this.orderCache.entries()).map(([id, order]) => ({
                    id,
                    status: order.status,
                    timestamp: order.timestamp
                }))
            });

            this.notifySubscribers('orderSyncComplete', Object.fromEntries(this.orderCache));
            
        } catch (error) {
            this.debug('Order sync failed:', error);
            this.orderCache.clear();
            this.notifySubscribers('orderSyncComplete', {});
        }
    }

    getOrders(filterStatus = null) {
        try {
            this.debug('Getting orders with filter:', filterStatus);
            const orders = Array.from(this.orderCache.values());
            
            // Add detailed logging of order cache
            this.debug('Current order cache:', {
                size: this.orderCache.size,
                orderStatuses: orders.map(o => ({
                    id: o.id,
                    status: o.status,
                    timestamp: o.timestamp
                }))
            });
            
            if (filterStatus) {
                return orders.filter(order => order.status === filterStatus);
            }
            
            return orders;
        } catch (error) {
            this.debug('Error getting orders:', error);
            return [];
        }
    }

    async reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.debug('Max reconnection attempts reached');
            return false;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        this.debug(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.initialize();
    }

    subscribe(eventName, callback) {
        if (!this.subscribers.has(eventName)) {
            this.subscribers.set(eventName, new Set());
        }
        this.subscribers.get(eventName).add(callback);
    }

    unsubscribe(eventName, callback) {
        if (this.subscribers.has(eventName)) {
            this.subscribers.get(eventName).delete(callback);
        }
    }

    // Example method to listen to contract events
    listenToContractEvents(contract, eventName) {
        if (!this.provider) {
            throw new Error('WebSocket not initialized');
        }

        contract.on(eventName, (...args) => {
            const event = args[args.length - 1]; // Last argument is the event object
            const subscribers = this.subscribers.get(eventName);
            if (subscribers) {
                subscribers.forEach(callback => callback(event));
            }
        });
    }

    updateOrderCache(orderId, orderData) {
        this.orderCache.set(orderId, orderData);
    }

    removeOrder(orderId) {
        this.orderCache.delete(orderId);
    }

    removeOrders(orderIds) {
        if (!Array.isArray(orderIds)) {
            console.warn('[WebSocket] removeOrders called with non-array:', orderIds);
            return;
        }
        
        this.debug('Removing orders:', orderIds);
        orderIds.forEach(orderId => {
            this.orderCache.delete(orderId);
        });
        
        // Notify subscribers of the update
        this.notifySubscribers('ordersUpdated', this.getOrders());
    }

    notifySubscribers(eventName, data) {
        this.debug('Notifying subscribers for event:', eventName);
        const subscribers = this.subscribers.get(eventName);
        if (subscribers) {
            this.debug('Found', subscribers.size, 'subscribers');
            subscribers.forEach(callback => {
                try {
                    this.debug('Calling subscriber callback');
                    callback(data);
                    this.debug('Subscriber callback completed');
                } catch (error) {
                    this.debug('Error in subscriber callback:', error);
                }
            });
        } else {
            this.debug('No subscribers found for event:', eventName);
        }
    }

    isOrderExpired(order) {
        try {
            if (!this.orderExpiry) {
                this.debug('Order expiry not initialized');
                return false;
            }

            const currentTime = Math.floor(Date.now() / 1000);
            const expiryTime = order.timestamp + this.orderExpiry.toNumber();
            
            return currentTime > expiryTime;
        } catch (error) {
            this.debug('Error checking order expiry:', error);
            return false;
        }
    }

    getOrderExpiryTime(order) {
        if (!this.orderExpiry) {
            return null;
        }
        return order.timestamp + this.orderExpiry.toNumber();
    }
}
