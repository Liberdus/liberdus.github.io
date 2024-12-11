import { ViewOrders } from './ViewOrders.js';
import { ethers } from 'ethers';
import { isDebugEnabled } from '../config.js';
import { getTokenList } from '../utils/tokens.js';

export class MyOrders extends ViewOrders {
    constructor() {
        super('my-orders');
        
        // Initialize sort config with id as default sort, descending
        this.sortConfig = {
            column: 'id',
            direction: 'desc',
            isColumnClick: false
        };
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
            
            // Load token list first
            this.tokenList = await getTokenList();
            this.debug('Loaded token list:', this.tokenList);

            // Check wallet connection
            if (!window.walletManager.isWalletConnected()) {
                this.container.innerHTML = `
                    <div class="tab-content-wrapper">
                        <h2>My Orders</h2>
                        <p class="connect-prompt">Connect wallet to view your orders</p>
                    </div>`;
                return;
            }

            // Get current account
            let userAddress = window.walletManager.getAccount();
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

            // Clear previous content
            this.container.innerHTML = '';
            
            // Setup table structure (don't call parent's setupTable)
            await this.setupTable();

            // Setup WebSocket handlers
            this.setupWebSocket();

            // Get initial orders and filter for maker
            const orders = window.webSocket.getOrders();
            this.debug('Orders before filtering:', orders);
            
            if (!Array.isArray(orders)) {
                this.debug('Invalid orders data received:', orders);
                throw new Error('Invalid orders data received');
            }

            // Filter orders for current user
            const filteredOrders = orders.filter(order => {
                const matches = order.maker.toLowerCase() === userAddress.toLowerCase();
                this.debug(`Order ${order.id} maker ${order.maker} matches user ${userAddress}: ${matches}`);
                return matches;
            });

            this.debug('Filtered orders:', filteredOrders);

            // Store filtered orders in the orders Map
            this.orders.clear();
            filteredOrders.forEach(order => {
                this.orders.set(order.id, order);
            });

            // Refresh the view with filtered orders
            await this.refreshOrdersView(filteredOrders);

        } catch (error) {
            this.debug('Initialization error:', error);
            this.showError('Failed to initialize orders view');
        } finally {
            this.isInitializing = false;
        }
    }

    async refreshOrdersView(orders) {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            this.debug('Refreshing orders view');
            const ordersToDisplay = orders || Array.from(this.orders.values());
            
            // Get filter state
            const showOnlyCancellable = this.container.querySelector('#fillable-orders-toggle')?.checked ?? true;
            
            // Filter orders based on cancellable status
            const filteredOrders = showOnlyCancellable 
                ? ordersToDisplay.filter(order => {
                    // Show Active orders that haven't expired or are in grace period
                    const isActive = order.status === 'Active';
                    const currentTime = Math.floor(Date.now() / 1000);
                    const expiryTime = window.webSocket.getOrderExpiryTime(order);
                    const gracePeriod = window.webSocket.gracePeriod?.toNumber() || 0;
                    const isWithinGracePeriod = currentTime < (expiryTime + gracePeriod);
                    
                    this.debug(`Order ${order.id} filtering:`, {
                        isActive,
                        status: order.status,
                        currentTime,
                        expiryTime,
                        gracePeriod,
                        isWithinGracePeriod
                    });
                    
                    return isActive && isWithinGracePeriod;
                })
                : ordersToDisplay;

            const tbody = this.container.querySelector('tbody');
            if (!tbody) {
                this.debug('ERROR: tbody not found');
                return;
            }

            if (filteredOrders.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="9" class="no-orders-message">
                            No ${showOnlyCancellable ? 'cancellable' : ''} orders found
                        </td>
                    </tr>`;
            } else {
                tbody.innerHTML = '';
                for (const order of filteredOrders) {
                    const row = await this.createOrderRow(order);
                    if (row) tbody.appendChild(row);
                }
            }

            // Update pagination info
            this.updatePaginationControls(filteredOrders.length);

        } catch (error) {
            this.debug('Error refreshing orders:', error);
            this.showError('Failed to refresh orders');
        } finally {
            this.isLoading = false;
        }
    }

    // Keep the setupTable method as is since it's specific to MyOrders view
    async setupTable() {
        const paginationControls = `
            <div class="pagination-controls">
                <select id="page-size-select" class="page-size-select">
                    <option value="10">10 per page</option>
                    <option value="25">25 per page</option>
                    <option value="50" selected>50 per page</option>
                    <option value="100">100 per page</option>
                    <option value="-1">View all</option>
                </select>
                
                <div class="pagination-buttons">
                    <button class="pagination-button prev-page" title="Previous page" disabled>
                        ←
                    </button>
                    <span class="page-info">Page 1 of 0</span>
                    <button class="pagination-button next-page" title="Next page">
                        →
                    </button>
                </div>
            </div>
        `;

        this.container.innerHTML = `
            <div class="table-container">
                <div class="filter-controls">
                    <div class="filter-row">
                        <label class="filter-toggle" style="display: flex;">
                            <input type="checkbox" id="fillable-orders-toggle" checked>
                            <span>Show only cancellable orders</span>
                        </label>
                        ${paginationControls}
                    </div>
                </div>
                <table class="orders-table">
                    <thead>
                        <tr>
                            <th data-sort="id">ID <span class="sort-icon">↕</span></th>
                            <th>Sell</th>
                            <th>Amount</th>
                            <th>Buy</th>
                            <th>Amount</th>
                            <th>Expires</th>
                            <th data-sort="status">Status <span class="sort-icon">↕</span></th>
                            <th>Taker</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>`;

        // Add event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Add click handlers for sorting
        this.container.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => this.handleSort(th.dataset.sort));
        });

        // Add pagination event listeners
        const pageSize = this.container.querySelector('.page-size-select');
        if (pageSize) {
            pageSize.addEventListener('change', () => this.debouncedRefresh());
        }

        // Add pagination button listeners
        const prevButton = this.container.querySelector('.prev-page');
        const nextButton = this.container.querySelector('.next-page');
        
        if (prevButton) {
            prevButton.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.debouncedRefresh();
                }
            });
        }
        
        if (nextButton) {
            nextButton.addEventListener('click', () => {
                const totalPages = this.getTotalPages();
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.debouncedRefresh();
                }
            });
        }

        // Add filter toggle listener
        const filterToggle = this.container.querySelector('#fillable-orders-toggle');
        if (filterToggle) {
            filterToggle.addEventListener('change', () => {
                this.debouncedRefresh();
            });
        }
    }

    async createOrderRow(order) {
        const row = await super.createOrderRow(order);
        if (!row) return null;

        // Update Taker column (8th column)
        const takerCell = row.querySelector('td:nth-child(8)');
        if (takerCell) {
            takerCell.textContent = '';
            const yourOrderSpan = document.createElement('span');
            yourOrderSpan.className = 'your-order';
            yourOrderSpan.textContent = 'Your Order';
            takerCell.appendChild(yourOrderSpan);
        }

        // Create or get the action cell (9th column)
        let actionCell = row.querySelector('td:nth-child(9)');
        if (!actionCell) {
            actionCell = document.createElement('td');
            row.appendChild(actionCell);
        }

        // Clear existing content
        actionCell.textContent = '';
        actionCell.className = '';

        const isActive = order.status === 'Active' || order.status === 0;
        const currentTime = Math.floor(Date.now() / 1000);
        const expiryTime = window.webSocket.getOrderExpiryTime(order);
        const gracePeriod = window.webSocket.gracePeriod?.toNumber() || 0;
        const totalPeriod = expiryTime + gracePeriod;

        console.log('Cancel button check:', {
            orderId: order.id,
            isActive,
            currentTime,
            expiryTime,
            gracePeriod,
            totalPeriod,
            isWithinGracePeriod: currentTime < totalPeriod,
            timeLeft: totalPeriod - currentTime
        });

        // Show cancel button if order is active and within grace period
        if (isActive && currentTime < totalPeriod) {
            const cancelButton = document.createElement('button');
            cancelButton.className = 'cancel-order-btn';
            cancelButton.textContent = 'Cancel';
            
            cancelButton.addEventListener('click', async () => {
                try {
                    cancelButton.disabled = true;
                    cancelButton.textContent = 'Cancelling...';
                    this.showError(`Cancelling order ${order.id}...`);

                    // Get contract from WebSocket and connect to signer
                    const contract = window.webSocket.contract;
                    if (!contract) {
                        throw new Error('Contract not available');
                    }

                    // Get signer from provider
                    const signer = this.provider.getSigner();
                    const contractWithSigner = contract.connect(signer);
                    
                    // Add gas buffer like in ViewOrders
                    const gasEstimate = await contractWithSigner.estimateGas.cancelOrder(order.id);
                    const gasLimit = gasEstimate.mul(120).div(100); // Add 20% buffer
                    
                    const tx = await contractWithSigner.cancelOrder(order.id, { gasLimit });
                    this.showError(`Cancelling order ${order.id}... Transaction sent`);
                    
                    const receipt = await tx.wait();
                    if (receipt.status === 0) {
                        throw new Error('Transaction reverted by contract');
                    }

                    // Show success notification
                    this.showSuccess(`Order ${order.id} cancelled successfully!`);

                    // Update the row status immediately
                    const statusCell = row.querySelector('td.order-status');
                    if (statusCell) {
                        statusCell.textContent = 'Cancelled';
                        statusCell.classList.add('cancelled');
                    }

                    // Remove the cancel button
                    actionCell.textContent = '-';

                    this.debouncedRefresh();
                } catch (error) {
                    console.error('Error cancelling order:', error);
                    this.showError(this.getReadableError(error));
                } finally {
                    cancelButton.disabled = false;
                    cancelButton.textContent = 'Cancel';
                }
            });
            
            actionCell.appendChild(cancelButton);
        } else {
            actionCell.textContent = '-';
        }

        return row;
    }
}