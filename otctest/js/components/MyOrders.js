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
            this.debug('Refreshing orders view with:', ordersToDisplay);

            // Get filter state
            const showOnlyCancellable = this.container.querySelector('#fillable-orders-toggle')?.checked ?? true;
            
            // Filter orders based on cancellable status
            const filteredOrders = showOnlyCancellable 
                ? ordersToDisplay.filter(order => {
                    // Show only Active orders that haven't expired
                    const isActive = order.status === 0; // 0 = Active
                    const currentTime = Math.floor(Date.now() / 1000);
                    const orderExpiry = Number(order.timestamp) + this.contractValues.orderExpiry;
                    const isNotExpired = currentTime < orderExpiry;
                    return isActive && isNotExpired;
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
                            No ${showOnlyCancellable ? 'cancellable' : 'active'} orders found
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
}