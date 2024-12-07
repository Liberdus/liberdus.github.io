import { ViewOrders } from './ViewOrders.js';
import { ethers } from 'ethers';
import { isDebugEnabled } from '../config.js';

export class MyOrders extends ViewOrders {
    constructor() {
        super('my-orders');
        
        // Initialize sort config with id as default sort, descending
        this.sortConfig = {
            column: 'id',
            direction: 'desc',
            isColumnClick: false
        };
        
        // Initialize debug logger
        this.debug = (message, ...args) => {
            if (isDebugEnabled('MY_ORDERS')) {
                console.log('[MyOrders]', message, ...args);
            }
        };

        this.isInitializing = false;
        this.isInitialized = false;
    }

    async initialize(readOnlyMode = true) {
        // Prevent concurrent initializations
        if (this.isInitializing) {
            this.debug('Already initializing, skipping...');
            return;
        }

        this.isInitializing = true;

        try {
            this.debug('Initializing MyOrders component');
            
            if (readOnlyMode || !window.walletManager?.provider) {
                this.container.innerHTML = `
                    <div class="tab-content-wrapper">
                        <h2>My Orders</h2>
                        <p class="connect-prompt">Connect wallet to view your orders</p>
                    </div>`;
                return;
            }

            // Get current account
            let userAddress;
            try {
                userAddress = await window.walletManager.getAccount();
            } catch (error) {
                this.debug('Error getting account:', error);
                userAddress = null;
            }

            if (!userAddress) {
                this.debug('No account connected');
                this.container.innerHTML = `
                    <div class="tab-content-wrapper">
                        <h2>My Orders</h2>
                        <p class="connect-prompt">Connect wallet to view your orders</p>
                    </div>`;
                return;
            }

            // Wait for WebSocket to be fully initialized
            if (!window.webSocket?.isInitialized) {
                this.debug('Waiting for WebSocket initialization...');
                await new Promise(resolve => {
                    const checkInterval = setInterval(() => {
                        if (window.webSocket?.isInitialized) {
                            clearInterval(checkInterval);
                            resolve();
                        }
                    }, 100);
                });
            }

            // Cleanup previous state
            this.cleanup();
            this.container.innerHTML = '';
            
            // Setup table structure
            await this.setupTable();

            // Setup WebSocket handlers after table setup
            this.setupWebSocket();

            // Get initial orders from cache and filter for maker
            try {
                const orders = window.webSocket.getOrders();
                const filteredOrders = orders.filter(order => 
                    order.maker.toLowerCase() === userAddress.toLowerCase()
                );
                await this.refreshOrdersView(filteredOrders);
            } catch (error) {
                this.debug('Error refreshing orders view:', error);
                throw error; // Propagate error for handling
            }

            this.isInitialized = true;
            this.debug('Initialization complete');

        } catch (error) {
            this.debug('Initialization error:', error);
            this.showError(`Failed to load orders: ${error.message}`);
        } finally {
            this.isInitializing = false;
        }
    }

    cleanup() {
        this.debug('Cleaning up MyOrders component');
        super.cleanup(); // Call parent cleanup
        this.isInitialized = false;
        this.isInitializing = false;
    }

    // Override refreshOrdersView to handle errors
    async refreshOrdersView(orders) {
        try {
            if (!window.webSocket?.contract) {
                throw new Error('WebSocket or contract not initialized');
            }

            // Get contract parameters needed for order status
            const [orderExpiry, gracePeriod] = await Promise.all([
                window.webSocket.contract.ORDER_EXPIRY(),
                window.webSocket.contract.GRACE_PERIOD()
            ]);

            // Continue with existing refresh logic
            await super.refreshOrdersView(orders, orderExpiry, gracePeriod);
        } catch (error) {
            this.debug('Error refreshing orders view:', error);
            throw error;
        }
    }

    setupWebSocket() {
        // First call parent's setupWebSocket if it exists
        if (super.setupWebSocket) {
            super.setupWebSocket();
        }

        // Add OrderCanceled event handler
        this.eventSubscriptions.add({
            event: 'OrderCanceled',
            callback: async (orderData) => {
                this.debug('Order canceled event received:', orderData);
                
                // Update the order in our local state
                if (this.orders.has(orderData.id)) {
                    const order = this.orders.get(orderData.id);
                    order.status = 'Canceled';
                    this.orders.set(orderData.id, order);
                    
                    // Update UI elements
                    const statusCell = this.container.querySelector(`tr[data-order-id="${orderData.id}"] .order-status`);
                    const actionCell = this.container.querySelector(`tr[data-order-id="${orderData.id}"] .action-column`);
                    
                    if (statusCell) {
                        statusCell.textContent = 'Canceled';
                        statusCell.className = 'order-status canceled';
                    }
                    if (actionCell) {
                        actionCell.innerHTML = '<span class="order-status">Canceled</span>';
                    }
                }
            }
        });
    }

    async cancelOrder(orderId) {
        const button = this.container.querySelector(`button[data-order-id="${orderId}"]`);
        try {
            if (button) {
                button.disabled = true;
                button.textContent = 'Canceling...';
            }

            this.debug('Starting cancel order process for orderId:', orderId);

            // Get current gas price
            const gasPrice = await this.provider.getGasPrice();
            
            // Estimate gas for the cancelOrder transaction
            let gasLimit;
            try {
                // First try with static call to check if transaction would fail
                await this.contract.callStatic.cancelOrder(orderId);
                
                gasLimit = await this.contract.estimateGas.cancelOrder(orderId);
                // Add 20% buffer to the estimated gas
                gasLimit = gasLimit.mul(120).div(100);
                this.debug('Estimated gas limit with buffer:', gasLimit.toString());
            } catch (error) {
                this.debug('Gas estimation failed:', error);
                gasLimit = ethers.BigNumber.from(200000); // Conservative fallback for cancel
                this.debug('Using fallback gas limit:', gasLimit.toString());
            }

            // Execute the cancel order transaction
            try {
                const tx = await this.contract.cancelOrder(orderId, {
                    gasLimit,
                    gasPrice
                });
                
                this.debug('Transaction sent:', tx.hash);
                
                // Handle transaction replacement
                try {
                    const receipt = await tx.wait();
                    this.debug('Transaction receipt:', receipt);

                    if (receipt.status === 0) {
                        throw new Error('Transaction reverted by contract');
                    }

                    // Update order status in memory
                    const orderToUpdate = this.orders.get(Number(orderId));
                    if (orderToUpdate) {
                        orderToUpdate.status = 'Canceled';
                        this.orders.set(Number(orderId), orderToUpdate);
                        await this.refreshOrdersView();
                    }

                    this.showSuccess(`Order ${orderId} canceled successfully!`);
                } catch (waitError) {
                    // Handle transaction replacement
                    if (waitError.code === 'TRANSACTION_REPLACED') {
                        if (waitError.cancelled) {
                            // Transaction was cancelled
                            throw new Error('Cancel order transaction was cancelled');
                        } else {
                            // Transaction was replaced (speed up)
                            this.debug('Cancel order transaction was sped up:', waitError.replacement.hash);
                            // Check if replacement transaction was successful
                            if (waitError.receipt.status === 1) {
                                this.debug('Replacement cancel transaction successful');
                                
                                // Update order status in memory
                                const orderToUpdate = this.orders.get(Number(orderId));
                                if (orderToUpdate) {
                                    orderToUpdate.status = 'Canceled';
                                    this.orders.set(Number(orderId), orderToUpdate);
                                    await this.refreshOrdersView();
                                }
                                
                                this.showSuccess(`Order ${orderId} canceled successfully!`);
                                return;
                            } else {
                                throw new Error('Replacement cancel transaction failed');
                            }
                        }
                    } else {
                        throw waitError;
                    }
                }
            } catch (error) {
                this.debug('Transaction error:', error);
                throw error;
            }

        } catch (error) {
            this.debug('Cancel order error:', error);
            
            // Handle user rejection
            if (error.code === 4001) {
                this.showError('Transaction rejected by user');
                return;
            }
            
            this.showError(this.getReadableError(error));
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = 'Cancel Order';
            }
        }
    }

    async createOrderRow(order, tokenDetailsMap) {
        const tr = await super.createOrderRow(order, tokenDetailsMap);
        const actionCell = tr.querySelector('.action-column');
        const statusCell = tr.querySelector('.order-status');
        const expiresCell = tr.querySelector('td:nth-child(6)'); // Expires column
        
        // Remove the existing action column if it exists (from parent class)
        if (actionCell) {
            actionCell.remove();
        }

        // Create new taker cell
        const takerCell = document.createElement('td');
        // Check if order is open to anyone (taker is zero address)
        const isPublicOrder = order.taker === ethers.constants.AddressZero;
        
        if (isPublicOrder) {
            takerCell.innerHTML = '<span class="open-order">Public</span>';
        } else {
            // For private orders, show truncated address
            const shortAddress = `${order.taker.slice(0, 6)}...${order.taker.slice(-4)}`;
            takerCell.innerHTML = `<span class="targeted-order" title="${order.taker}">${shortAddress}</span>`;
        }

        // Create new action cell
        const newActionCell = document.createElement('td');
        newActionCell.className = 'action-column';

        try {
            const currentTime = Math.floor(Date.now() / 1000);
            const orderTime = Number(order.timestamp);
            const contract = await this.getContract();
            const orderExpiry = await contract.ORDER_EXPIRY();
            const gracePeriod = await contract.GRACE_PERIOD();
            const isGracePeriodExpired = currentTime > orderTime + orderExpiry.toNumber() + gracePeriod.toNumber();

            if (order.status === 'Canceled') {
                newActionCell.innerHTML = '<span class="order-status">Canceled</span>';
            } else if (order.status === 'Filled') {
                newActionCell.innerHTML = '<span class="order-status">Filled</span>';
            } else if (isGracePeriodExpired) {
                newActionCell.innerHTML = '<span class="order-status">Await Cleanup</span>';
            } else {
                newActionCell.innerHTML = `
                    <button class="cancel-button" data-order-id="${order.id}">Cancel</button>
                `;
                const cancelButton = newActionCell.querySelector('.cancel-button');
                if (cancelButton) {
                    cancelButton.addEventListener('click', () => this.cancelOrder(order.id));
                }
            }
        } catch (error) {
            console.error('[MyOrders] Error in createOrderRow:', error);
            newActionCell.innerHTML = '<span class="order-status error">Error</span>';
        }

        // Append both cells in correct order
        tr.appendChild(takerCell);
        tr.appendChild(newActionCell);

        return tr;
    }

    handleSort(column) {
        this.debug('Sorting by column:', column);
        
        if (this.sortConfig.column === column) {
            this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortConfig.column = column;
            this.sortConfig.direction = 'asc';
        }

        const headers = this.container.querySelector('thead').querySelectorAll('th[data-sort]');
        headers.forEach(header => {
            const icon = header.querySelector('.sort-icon');
            if (header.dataset.sort === column) {
                header.classList.add('active-sort');
                icon.textContent = this.sortConfig.direction === 'asc' ? '↑' : '↓';
            } else {
                header.classList.remove('active-sort');
                icon.textContent = '↕';
            }
        });

        // Use parent's debouncedRefresh instead of direct refreshOrdersView call
        this.debouncedRefresh();
    }

    async setupTable() {
        // Call parent's setupTable to get basic structure
        await super.setupTable();
        
        // Update the filter toggle text to be more specific
        const filterToggleSpan = this.container.querySelector('.filter-toggle span');
        if (filterToggleSpan) {
            filterToggleSpan.textContent = 'Show only cancellable orders';
        }

        // Show the filter toggle
        const filterToggle = this.container.querySelector('.filter-toggle');
        if (filterToggle) {
            filterToggle.style.display = 'flex';
        }
        
        // Update the table header to show maker's perspective
        const thead = this.container.querySelector('thead tr');
        if (thead) {
            thead.innerHTML = `
                <th data-sort="id">ID <span class="sort-icon">↕</span></th>
                <th>Sell</th>
                <th>Amount</th>
                <th>Buy</th>
                <th>Amount</th>
                <th>Expires</th>
                <th data-sort="status">Status <span class="sort-icon">↕</span></th>
                <th>Taker</th>
                <th>Action</th>
            `;

            // Re-add click handlers for sorting
            thead.querySelectorAll('th[data-sort]').forEach(th => {
                th.addEventListener('click', () => this.handleSort(th.dataset.sort));
            });
        }
    }
}