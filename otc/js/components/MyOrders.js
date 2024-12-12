import { ViewOrders } from './ViewOrders.js';
import { ethers } from 'ethers';
import { isDebugEnabled } from '../config.js';
import { getTokenList } from '../utils/tokens.js';
import { PricingService } from '../services/PricingService.js';

export class MyOrders extends ViewOrders {
    constructor() {
        super('my-orders');
        this.pricingService = new PricingService();
        
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

            // Initialize pricing service
            await this.pricingService.initialize();

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
            let ordersToDisplay = orders || Array.from(this.orders.values());
            
            // Get filter state
            const showOnlyCancellable = this.container.querySelector('#fillable-orders-toggle')?.checked ?? true;
            const sellTokenFilter = this.container.querySelector('#sell-token-filter')?.value;
            const buyTokenFilter = this.container.querySelector('#buy-token-filter')?.value;
            const orderSort = this.container.querySelector('#order-sort')?.value;
            
            // Apply token filters
            if (sellTokenFilter) {
                ordersToDisplay = ordersToDisplay.filter(order => 
                    order.sellToken.toLowerCase() === sellTokenFilter.toLowerCase()
                );
            }

            if (buyTokenFilter) {
                ordersToDisplay = ordersToDisplay.filter(order => 
                    order.buyToken.toLowerCase() === buyTokenFilter.toLowerCase()
                );
            }
            
            // Filter orders based on cancellable status
            if (showOnlyCancellable) {
                ordersToDisplay = ordersToDisplay.filter(order => {
                    // Show Active orders that haven't expired or are in grace period
                    const isActive = order.status === 'Active';
                    const currentTime = Math.floor(Date.now() / 1000);
                    const expiryTime = window.webSocket.getOrderExpiryTime(order);
                    const gracePeriod = window.webSocket.gracePeriod?.toNumber() || 0;
                    const isWithinGracePeriod = currentTime < (expiryTime + gracePeriod);
                    
                    return isActive && isWithinGracePeriod;
                });
            }

            // Apply sorting
            if (orderSort === 'best-deal') {
                // First calculate all deals
                const orderDeals = await Promise.all(ordersToDisplay.map(async (order) => {
                    const sellTokenInfo = await this.getTokenInfo(order.sellToken);
                    const buyTokenInfo = await this.getTokenInfo(order.buyToken);

                    const sellAmount = Number(ethers.utils.formatUnits(order.sellAmount, sellTokenInfo.decimals));
                    const buyAmount = Number(ethers.utils.formatUnits(order.buyAmount, buyTokenInfo.decimals));

                    const sellValueUsd = sellAmount * (this.pricingService?.getPrice(order.sellToken) || 1);
                    const buyValueUsd = buyAmount * (this.pricingService?.getPrice(order.buyToken) || 1);
                    
                    return {
                        orderId: order.id,
                        deal: buyValueUsd / sellValueUsd
                    };
                }));

                // Create a map for quick deal lookups
                const dealMap = new Map(orderDeals.map(item => [item.orderId, item.deal]));

                // Now sort using the pre-calculated deals
                ordersToDisplay.sort((a, b) => {
                    const dealA = dealMap.get(a.id);
                    const dealB = dealMap.get(b.id);
                    // Sort descending (higher deals first)
                    return dealB - dealA;
                });
            } else {
                // Default to newest first
                ordersToDisplay.sort((a, b) => b.timestamp - a.timestamp);
            }

            const tbody = this.container.querySelector('tbody');
            if (!tbody) {
                this.debug('ERROR: tbody not found');
                return;
            }

            if (ordersToDisplay.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="9" class="no-orders-message">
                            No ${showOnlyCancellable ? 'cancellable' : ''} orders found
                        </td>
                    </tr>`;
            } else {
                tbody.innerHTML = '';
                for (const order of ordersToDisplay) {
                    const row = await this.createOrderRow(order);
                    if (row) tbody.appendChild(row);
                }
            }

            // Update pagination info
            this.updatePaginationControls(ordersToDisplay.length);

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
                    <button class="pagination-button next-page" title="Next page" disabled>
                        →
                    </button>
                </div>
            </div>
        `;

        // Main filter controls
        const filterControls = `
            <div class="filter-controls">
                <div class="filter-row">
                    <div class="filters-left">
                        <div class="filters-group">
                            <button class="advanced-filters-toggle">
                                <svg class="filter-icon" viewBox="0 0 24 24" width="16" height="16">
                                    <path fill="currentColor" d="M14,12V19.88C14.04,20.18 13.94,20.5 13.71,20.71C13.32,21.1 12.69,21.1 12.3,20.71L10.29,18.7C10.06,18.47 9.96,18.16 10,17.87V12H9.97L4.21,4.62C3.87,4.19 3.95,3.56 4.38,3.22C4.57,3.08 4.78,3 5,3V3H19V3C19.22,3 19.43,3.08 19.62,3.22C20.05,3.56 20.13,4.19 19.79,4.62L14.03,12H14Z"/>
                                </svg>
                                Filters
                                <svg class="chevron-icon" viewBox="0 0 24 24" width="16" height="16">
                                    <path fill="currentColor" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/>
                                </svg>
                            </button>
                            <label class="filter-toggle">
                                <input type="checkbox" id="fillable-orders-toggle" checked>
                                <span>Show only cancellable orders</span>
                            </label>
                        </div>
                    </div>
                    ${paginationControls}
                </div>
                <div class="advanced-filters" style="display: none;">
                    <div class="filter-row">
                        <div class="token-filters">
                            <select id="sell-token-filter" class="token-filter">
                                <option value="">All Sell Tokens</option>
                                ${this.tokenList.map(token => 
                                    `<option value="${token.address}">${token.symbol}</option>`
                                ).join('')}
                            </select>
                            <select id="buy-token-filter" class="token-filter">
                                <option value="">All Buy Tokens</option>
                                ${this.tokenList.map(token => 
                                    `<option value="${token.address}">${token.symbol}</option>`
                                ).join('')}
                            </select>
                            <select id="order-sort" class="order-sort">
                                <option value="newest">Newest First</option>
                                <option value="best-deal">Best Deal First</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>`;

        const bottomControls = `
            <div class="filter-controls bottom-controls">
                <div class="filter-row">
                    <div class="refresh-container">
                        <button id="refresh-prices-btn" class="refresh-prices-button">↻ Refresh Prices</button>
                        <span class="refresh-status"></span>
                    </div>
                    ${paginationControls}
                </div>
            </div>
        `;

        this.container.innerHTML = `
            <div class="table-container">
                ${filterControls}
                <table class="orders-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Sell</th>
                            <th>Amount</th>
                            <th>Buy</th>
                            <th>Amount</th>
                            <th>Deal</th>
                            <th>Expires</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
                ${bottomControls}
            </div>`;

        // Setup advanced filters toggle
        const advancedFiltersToggle = this.container.querySelector('.advanced-filters-toggle');
        const advancedFilters = this.container.querySelector('.advanced-filters');
        
        if (advancedFiltersToggle && advancedFilters) {
            advancedFiltersToggle.addEventListener('click', () => {
                const isExpanded = advancedFilters.style.display !== 'none';
                advancedFilters.style.display = isExpanded ? 'none' : 'block';
                advancedFiltersToggle.classList.toggle('expanded', !isExpanded);
            });
        }

        // Add event listeners for filters
        const sellTokenFilter = this.container.querySelector('#sell-token-filter');
        const buyTokenFilter = this.container.querySelector('#buy-token-filter');
        const orderSort = this.container.querySelector('#order-sort');

        if (sellTokenFilter) sellTokenFilter.addEventListener('change', () => this.refreshOrdersView());
        if (buyTokenFilter) buyTokenFilter.addEventListener('change', () => this.refreshOrdersView());
        if (orderSort) orderSort.addEventListener('change', () => this.refreshOrdersView());

        // Initialize pagination
        this.currentPage = 1;
        const pageSize = this.container.querySelector('#page-size-select');
        if (pageSize) {
            pageSize.value = '50'; // Set default page size
        }

        // Sync both page size selects
        const pageSizeSelects = this.container.querySelectorAll('.page-size-select');
        pageSizeSelects.forEach(select => {
            select.addEventListener('change', (event) => {
                pageSizeSelects.forEach(otherSelect => {
                    if (otherSelect !== event.target) {
                        otherSelect.value = event.target.value;
                    }
                });
                this.currentPage = 1;
                this.refreshOrdersView();
            });
        });

        // Add filter toggle listener
        const filterToggles = this.container.querySelectorAll('#fillable-orders-toggle');
        filterToggles.forEach(toggle => {
            toggle.addEventListener('change', (event) => {
                filterToggles.forEach(otherToggle => {
                    if (otherToggle !== event.target) {
                        otherToggle.checked = event.target.checked;
                    }
                });
                this.refreshOrdersView();
            });
        });
    }

    setupEventListeners() {
        // Add refresh button functionality
        const refreshButton = this.container.querySelector('#refresh-prices-btn');
        const statusIndicator = this.container.querySelector('.refresh-status');
        
        let refreshTimeout;
        if (refreshButton) {
            refreshButton.addEventListener('click', async () => {
                if (refreshTimeout) return;
                
                refreshButton.disabled = true;
                refreshButton.innerHTML = '↻ Refreshing...';
                statusIndicator.className = 'refresh-status loading';
                statusIndicator.style.opacity = 1;
                
                try {
                    const result = await this.pricingService.refreshPrices();
                    if (result.success) {
                        statusIndicator.className = 'refresh-status success';
                        statusIndicator.textContent = `Updated ${new Date().toLocaleTimeString()}`;
                    } else {
                        statusIndicator.className = 'refresh-status error';
                        statusIndicator.textContent = result.message;
                    }
                } catch (error) {
                    statusIndicator.className = 'refresh-status error';
                    statusIndicator.textContent = 'Failed to refresh prices';
                } finally {
                    refreshButton.disabled = false;
                    refreshButton.innerHTML = '↻ Refresh Prices';
                    
                    refreshTimeout = setTimeout(() => {
                        refreshTimeout = null;
                        statusIndicator.style.opacity = 0;
                    }, 2000);
                }
            });
        }

        // Add pagination event listeners
        const pageSize = this.container.querySelector('.page-size-select');
        if (pageSize) {
            pageSize.addEventListener('change', () => {
                this.currentPage = 1;
                this.refreshOrdersView();
            });
        }

        // Add pagination button listeners
        const prevButton = this.container.querySelector('.prev-page');
        const nextButton = this.container.querySelector('.next-page');
        
        if (prevButton) {
            prevButton.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.refreshOrdersView();
                }
            });
        }
        
        if (nextButton) {
            nextButton.addEventListener('click', () => {
                const totalPages = this.getTotalPages();
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.refreshOrdersView();
                }
            });
        }

        // Add filter toggle listener
        const filterToggle = this.container.querySelector('#fillable-orders-toggle');
        if (filterToggle) {
            filterToggle.addEventListener('change', () => this.refreshOrdersView());
        }
    }

    async createOrderRow(order) {
        try {
            // Create the row element first
            const tr = document.createElement('tr');
            tr.dataset.orderId = order.id.toString();
            tr.dataset.timestamp = order.timestamp.toString();
            
            // Get token info for both tokens in the order
            const sellTokenInfo = await this.getTokenInfo(order.sellToken);
            const buyTokenInfo = await this.getTokenInfo(order.buyToken);

            // Format amounts using correct decimals
            const sellAmount = ethers.utils.formatUnits(order.sellAmount, sellTokenInfo.decimals);
            const buyAmount = ethers.utils.formatUnits(order.buyAmount, buyTokenInfo.decimals);

            // Get USD prices from pricing service, default to 1 if not available
            const sellTokenUsdPrice = this.pricingService?.getPrice(order.sellToken) || 1;
            const buyTokenUsdPrice = this.pricingService?.getPrice(order.buyToken) || 1;

            // Calculate USD values
            const sellValueUSD = Number(sellAmount) * sellTokenUsdPrice;
            const buyValueUSD = Number(buyAmount) * buyTokenUsdPrice;

            // Calculate deal as ratio of USD values (receiving/giving)
            const deal = buyValueUSD / sellValueUSD;

            // Format USD prices with appropriate precision
            const formatUsdPrice = (price) => {
                if (!price) return '';
                if (price >= 100) return `$${price.toFixed(0)}`;
                if (price >= 1) return `$${price.toFixed(2)}`;
                return `$${price.toFixed(4)}`;
            };

            // Add price-estimate class if using default price
            const sellPriceClass = this.pricingService?.getPrice(order.sellToken) ? '' : 'price-estimate';
            const buyPriceClass = this.pricingService?.getPrice(order.buyToken) ? '' : 'price-estimate';

            const formattedExpiry = await this.formatExpiry(order.timestamp);

            tr.innerHTML = `
                <td>${order.id}</td>
                <td>
                    <div class="token-info">
                        ${this.getTokenIcon(sellTokenInfo)}
                        <div class="token-details">
                            <span>${sellTokenInfo.symbol}</span>
                            <span class="token-price ${sellPriceClass}">${formatUsdPrice(sellTokenUsdPrice)}</span>
                        </div>
                    </div>
                </td>
                <td>${Number(sellAmount).toFixed(4)}</td>
                <td>
                    <div class="token-info">
                        ${this.getTokenIcon(buyTokenInfo)}
                        <div class="token-details">
                            <span>${buyTokenInfo.symbol}</span>
                            <span class="token-price ${buyPriceClass}">${formatUsdPrice(buyTokenUsdPrice)}</span>
                        </div>
                    </div>
                </td>
                <td>${Number(buyAmount).toFixed(4)}</td>
                <td>${deal.toFixed(6)}</td>
                <td>${formattedExpiry}</td>
                <td class="order-status">${order.status}</td>
                <td class="action-column"></td>`;

            // Add cancel button logic to action column
            const actionCell = tr.querySelector('.action-column');
            const isActive = order.status === 'Active' || order.status === 0;
            const currentTime = Math.floor(Date.now() / 1000);
            const expiryTime = window.webSocket.getOrderExpiryTime(order);
            const gracePeriod = window.webSocket.gracePeriod?.toNumber() || 0;
            const totalPeriod = expiryTime + gracePeriod;

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
                        
                        // Add gas buffer
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
                        const statusCell = tr.querySelector('td.order-status');
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

            // Start the expiry timer
            this.startExpiryTimer(tr);

            return tr;
        } catch (error) {
            this.debug('Error creating order row:', error);
            return null;
        }
    }

    updatePaginationControls(totalOrders) {
        const pageSize = parseInt(this.container.querySelector('#page-size-select')?.value || '25');
        
        const updateControls = (container) => {
            const prevButton = container.querySelector('.prev-page');
            const nextButton = container.querySelector('.next-page');
            const pageInfo = container.querySelector('.page-info');
            
            if (!prevButton || !nextButton || !pageInfo) {
                console.warn('Pagination controls not found');
                return;
            }
            
            if (pageSize === -1) {
                // Show all orders
                prevButton.disabled = true;
                nextButton.disabled = true;
                pageInfo.textContent = `Showing all ${totalOrders} orders`;
                return;
            }
            
            const totalPages = Math.max(1, Math.ceil(totalOrders / pageSize));
            
            // Ensure current page is within bounds
            this.currentPage = Math.min(Math.max(1, this.currentPage), totalPages);
            
            prevButton.disabled = this.currentPage <= 1;
            nextButton.disabled = this.currentPage >= totalPages;
            
            const startItem = ((this.currentPage - 1) * pageSize) + 1;
            const endItem = Math.min(this.currentPage * pageSize, totalOrders);
            
            pageInfo.textContent = `${startItem}-${endItem} of ${totalOrders} orders (Page ${this.currentPage} of ${totalPages})`;
        };
        
        // Update both top and bottom controls
        const controls = this.container.querySelectorAll('.filter-controls');
        controls.forEach(updateControls);
    }
}