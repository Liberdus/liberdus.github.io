import { BaseComponent } from './BaseComponent.js';
import { ethers } from 'ethers';
import { erc20Abi } from '../abi/erc20.js';
import { ContractError, CONTRACT_ERRORS } from '../errors/ContractErrors.js';
import { isDebugEnabled, getNetworkConfig } from '../config.js';
import { NETWORK_TOKENS } from '../utils/tokens.js';
import { getTokenList } from '../utils/tokens.js';
import { PricingService } from '../services/PricingService.js';
import { walletManager } from '../config.js';

export class ViewOrders extends BaseComponent {
    constructor(containerId = 'view-orders') {
        super(containerId);
        this.provider = new ethers.providers.Web3Provider(window.ethereum);
        this.currentPage = 1;
        this.totalOrders = 0;
        this.setupErrorHandling();
        this.eventSubscriptions = new Set();
        this.expiryTimers = new Map();
        this.tokenList = [];
        this.currentAccount = null;
        
        // Initialize debug logger with VIEW_ORDERS flag
        this.debug = (message, ...args) => {
            if (isDebugEnabled('VIEW_ORDERS')) {
                console.log('[ViewOrders]', message, ...args);
            }
        };

        // Add debounce mechanism
        this._refreshTimeout = null;
        this.debouncedRefresh = () => {
            clearTimeout(this._refreshTimeout);
            this._refreshTimeout = setTimeout(() => {
                this.refreshOrdersView().catch(error => {
                    this.debug('Error refreshing orders:', error);
                });
            }, 100);
        };

        // Add loading state
        this.isLoading = false;

        // Add pricing service
        this.pricingService = new PricingService();
    }

    async init() {
        try {
            this.debug('Initializing ViewOrders...');
            // Get current account first
            this.currentAccount = walletManager.getAccount()?.toLowerCase();
            this.debug('Current account:', this.currentAccount);
            
            this.tokenList = await getTokenList(); // Get full token list with icons
            console.log('DEBUG: tokenList from getTokenList:', this.tokenList);
            this.debug('Token list loaded:', {
                length: this.tokenList?.length || 0,
                sample: this.tokenList?.[0]
            });
            
            await super.init();
            await this.pricingService.initialize();
            
            // Subscribe to price updates
            this.pricingService.subscribe(() => this.refreshOrdersView());
            
            this.debug('ViewOrders initialization complete');
        } catch (error) {
            this.debug('Error in ViewOrders initialization:', error);
            throw error;
        }
    }


    getTokenIcon(token) {
        try {
            if (!token?.address) {
                this.debug('No token address provided:', token);
                return this.getDefaultTokenIcon();
            }

            // Debug log the token list and search attempt
            this.debug('Looking for token icon:', {
                searchAddress: token.address.toLowerCase(),
                tokenListLength: this.tokenList?.length || 0,
                tokenList: this.tokenList
            });

            // First check if the token exists in our token list
            const tokenFromList = this.tokenList.find(t => {
                const matches = t.address.toLowerCase() === token.address.toLowerCase();
                this.debug(`Comparing addresses: ${t.address.toLowerCase()} vs ${token.address.toLowerCase()} = ${matches}`);
                return matches;
            });

            this.debug('Token from list:', tokenFromList);

            // If we found a token with a logo URI, use it
            if (tokenFromList?.logoURI) {
                this.debug('Using logo URI from token list:', tokenFromList.logoURI);
                return `
                    <div class="token-icon">
                        <img src="${tokenFromList.logoURI}" 
                             alt="${tokenFromList.symbol}" 
                             onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
                             class="token-icon-image" />
                        <div class="token-icon-fallback" style="display:none">
                            ${tokenFromList.symbol.charAt(0).toUpperCase()}
                        </div>
                    </div>
                `;
            }

            // If token is in NETWORK_TOKENS, use that logo
            const networkToken = NETWORK_TOKENS[getNetworkConfig().name]?.find(t => 
                t.address.toLowerCase() === token.address.toLowerCase()
            );

            if (networkToken?.logoURI) {
                this.debug('Using logo URI from NETWORK_TOKENS:', networkToken.logoURI);
                return `
                    <div class="token-icon">
                        <img src="${networkToken.logoURI}" 
                             alt="${networkToken.symbol}" 
                             onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
                             class="token-icon-image" />
                        <div class="token-icon-fallback" style="display:none">
                            ${networkToken.symbol.charAt(0).toUpperCase()}
                        </div>
                    </div>
                `;
            }

            // Fallback to color-based icon
            this.debug('No logo URI found, using fallback icon');
            const symbol = token.symbol || '?';
            const firstLetter = symbol.charAt(0).toUpperCase();
            
            const colors = [
                '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
                '#FFEEAD', '#D4A5A5', '#9B59B6', '#3498DB'
            ];
            
            const colorIndex = token.address ? 
                parseInt(token.address.slice(-6), 16) % colors.length :
                Math.floor(Math.random() * colors.length);
            const backgroundColor = colors[colorIndex];
            
            return `
                <div class="token-icon">
                    <div class="token-icon-fallback" style="background: ${backgroundColor}">
                        ${firstLetter}
                    </div>
                </div>
            `;
        } catch (error) {
            this.debug('Error generating token icon:', error);
            return this.getDefaultTokenIcon();
        }
    }

    getDefaultTokenIcon() {
        return `
            <div class="token-icon">
                <div class="token-icon-fallback" style="background: #FF6B6B">?</div>
            </div>
        `;
    }

    setupErrorHandling() {
        if (!window.webSocket) {
            if (!this._retryAttempt) {
                this.debug('WebSocket not available, waiting for initialization...');
                this._retryAttempt = true;
            }
            setTimeout(() => this.setupErrorHandling(), 1000);
            return;
        }
        this._retryAttempt = false;

        window.webSocket.subscribe('error', (error) => {
            let userMessage = 'An error occurred';
            
            if (error instanceof ContractError) {
                switch(error.code) {
                    case CONTRACT_ERRORS.INVALID_ORDER.code:
                        userMessage = 'This order no longer exists';
                        break;
                    case CONTRACT_ERRORS.INSUFFICIENT_ALLOWANCE.code:
                        userMessage = 'Please approve tokens before proceeding';
                        break;
                    case CONTRACT_ERRORS.UNAUTHORIZED.code:
                        userMessage = 'You are not authorized to perform this action';
                        break;
                    case CONTRACT_ERRORS.EXPIRED_ORDER.code:
                        userMessage = 'This order has expired';
                        break;
                    default:
                        userMessage = error.message;
                }
            }

            this.showError(userMessage);
            this.debug('Order error:', {
                code: error.code,
                message: error.message,
                details: error.details
            });
        });
    }

    async initialize(readOnlyMode = true) {
        if (!this.initialized) {
            // First time setup - create table structure
            await this.setupTable();
            this.initialized = true;
        }
        // Just refresh the view with current cache
        await this.refreshOrdersView();
    }

    async setupWebSocket() {
        this.debug('Setting up WebSocket subscriptions');
        
        if (!window.webSocket?.provider) {
            this.debug('WebSocket provider not available, waiting for reconnection...');
            return;
        }

        // Add provider state logging
        this.debug('WebSocket provider state:', {
            connected: window.webSocket.provider._websocket?.connected,
            readyState: window.webSocket.provider._websocket?.readyState
        });
        
        // Clear existing subscriptions
        this.eventSubscriptions.forEach(sub => {
            window.webSocket.unsubscribe(sub.event, sub.callback);
        });
        this.eventSubscriptions.clear();

        // Add new subscriptions with error handling
        const addSubscription = (event, callback) => {
            const wrappedCallback = async (...args) => {
                try {
                    await callback(...args);
                } catch (error) {
                    this.debug(`Error in ${event} callback:`, error);
                    this.showError('Error processing order update');
                }
            };
            this.eventSubscriptions.add({ event, callback: wrappedCallback });
            window.webSocket.subscribe(event, wrappedCallback);
        };

        // Add subscriptions with error handling
        addSubscription('orderSyncComplete', async (orders) => {
            this.debug('Order sync complete:', orders);
            await this.refreshOrdersView();
        });

        // Add other event subscriptions similarly
        ['OrderCreated', 'OrderFilled', 'OrderCanceled'].forEach(event => {
            addSubscription(event, async (orderData) => {
                this.debug(`${event} event received:`, orderData);
                await this.refreshOrdersView();
            });
        });
    }

    async refreshOrdersView() {
        if (this.isLoading) return;
        this.isLoading = true;
        
        try {
            // Get all orders first
            let ordersToDisplay = Array.from(window.webSocket.orderCache.values());
            
            // Apply token filters
            const sellTokenFilter = this.container.querySelector('#sell-token-filter')?.value;
            const buyTokenFilter = this.container.querySelector('#buy-token-filter')?.value;
            const orderSort = this.container.querySelector('#order-sort')?.value;
            const showOnlyActive = this.container.querySelector('#fillable-orders-toggle')?.checked;

            // Filter orders based on status and fillable flag
            ordersToDisplay = ordersToDisplay.filter(order => {
                const currentTime = Math.floor(Date.now() / 1000);
                const isExpired = currentTime > order.timings.expiresAt;
                const isActive = order.status === 'Active' && !isExpired;
                const canFill = window.webSocket.canFillOrder(order, walletManager.getAccount());
                const isUserOrder = order.maker?.toLowerCase() === walletManager.getAccount()?.toLowerCase();

                // Apply token filters
                if (sellTokenFilter && order.sellToken.toLowerCase() !== sellTokenFilter.toLowerCase()) return false;
                if (buyTokenFilter && order.buyToken.toLowerCase() !== buyTokenFilter.toLowerCase()) return false;

                // Apply active/fillable filter
                if (showOnlyActive) {
                    return isActive && (canFill || isUserOrder);
                }
                
                return true; // Show all orders when checkbox is unchecked
            });

            // Set total orders after filtering
            this.totalOrders = ordersToDisplay.length;

            // Apply sorting
            if (orderSort === 'newest') {
                ordersToDisplay.sort((a, b) => b.id - a.id);
            } else if (orderSort === 'best-deal') {
                ordersToDisplay.sort((a, b) => 
                    Number(a.dealMetrics?.deal || Infinity) - 
                    Number(b.dealMetrics?.deal || Infinity)
                );
            }

            // Apply pagination
            const pageSize = parseInt(this.container.querySelector('#page-size-select').value);
            const startIndex = (this.currentPage - 1) * pageSize;
            const endIndex = pageSize === -1 ? ordersToDisplay.length : startIndex + pageSize;
            const paginatedOrders = pageSize === -1 ? 
                ordersToDisplay : 
                ordersToDisplay.slice(startIndex, endIndex);

            // Update the table
            const tbody = this.container.querySelector('tbody');
            tbody.innerHTML = '';
            
            for (const order of paginatedOrders) {
                const newRow = await this.createOrderRow(order);
                if (newRow) {
                    tbody.appendChild(newRow);
                }
            }

            // Update pagination controls
            this.updatePaginationControls(this.totalOrders);

        } catch (error) {
            this.debug('Error refreshing orders:', error);
            this.showError('Failed to refresh orders view');
        } finally {
            this.isLoading = false;
        }
    }

    showReadOnlyMessage() {
        this.container.innerHTML = `
            <div class="tab-content-wrapper">
                <h2>Orders</h2>
                <p class="connect-prompt">Connect wallet to view orders</p>
            </div>`;
    }

    async setupTable() {
        const tableContainer = this.createElement('div', 'table-container');
        
        // Main filter controls
        const filterControls = this.createElement('div', 'filter-controls');
        filterControls.innerHTML = `
            <div class="filter-row">
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
                        <span>Show only fillable orders</span>
                    </label>
                </div>

                <div class="pagination-controls">
                    <select id="page-size-select" class="page-size-select">
                        <option value="10">10 per page</option>
                        <option value="25" selected>25 per page</option>
                        <option value="50">50 per page</option>
                        <option value="100">100 per page</option>
                        <option value="-1">View all</option>
                    </select>
                    
                    <div class="pagination-buttons">
                        <button class="pagination-button prev-page" title="Previous page">←</button>
                        <span class="page-info">Page 1 of 1</span>
                        <button class="pagination-button next-page" title="Next page">→</button>
                    </div>
                </div>
            </div>
        `;
        console.log('DEBUG: tokenList:', this.tokenList);
        // Get tokens from WebSocket's tokenCache
        const tokens = Array.from(window.webSocket.tokenCache.values())
            .sort((a, b) => a.symbol.localeCompare(b.symbol)); // Sort alphabetically by symbol
        
        this.debug('Available tokens:', tokens);

        // Advanced filters section
        const advancedFilters = this.createElement('div', 'advanced-filters');
        advancedFilters.style.display = 'none';
        advancedFilters.innerHTML = `
            <div class="filter-row">
                <div class="token-filters">
                    <select id="sell-token-filter" class="token-filter">
                        <option value="">All Sell Tokens</option>
                        ${tokens.map(token => 
                            `<option value="${token.address}">${token.symbol}</option>`
                        ).join('')}
                    </select>
                    <select id="buy-token-filter" class="token-filter">
                        <option value="">All Buy Tokens</option>
                        ${tokens.map(token => 
                            `<option value="${token.address}">${token.symbol}</option>`
                        ).join('')}
                    </select>
                    <select id="order-sort" class="order-sort">
                        <option value="newest">Newest First</option>
                        <option value="best-deal">Best Deal First</option>
                    </select>
                </div>
            </div>
        `;

        // Add the advanced filters section after the main controls
        filterControls.appendChild(advancedFilters);
        
        // Setup advanced filters toggle
        const advancedFiltersToggle = filterControls.querySelector('.advanced-filters-toggle');
        advancedFiltersToggle.addEventListener('click', () => {
            const isExpanded = advancedFilters.style.display !== 'none';
            advancedFilters.style.display = isExpanded ? 'none' : 'block';
            advancedFiltersToggle.classList.toggle('expanded', !isExpanded);
        });

        // Add event listeners for filters
        const sellTokenFilter = advancedFilters.querySelector('#sell-token-filter');
        const buyTokenFilter = advancedFilters.querySelector('#buy-token-filter');
        const orderSort = advancedFilters.querySelector('#order-sort');

        sellTokenFilter.addEventListener('change', () => this.refreshOrdersView());
        buyTokenFilter.addEventListener('change', () => this.refreshOrdersView());
        orderSort.addEventListener('change', () => this.refreshOrdersView());

        tableContainer.appendChild(filterControls);
        
        // Add table
        const table = this.createElement('table', 'orders-table');
        
        const thead = this.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>ID</th>
                <th>Buy</th>
                <th>Amount</th>
                <th>Sell</th>
                <th>Amount</th>
                <th>Deal</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Action</th>
            </tr>`;
        
        table.appendChild(thead);
        table.appendChild(this.createElement('tbody'));
        tableContainer.appendChild(table);
        
        // Bottom controls with refresh button
        const bottomControls = this.createElement('div', 'filter-controls bottom-controls');
        bottomControls.innerHTML = `
            <div class="filter-row">
                <div class="refresh-container">
                    <button id="refresh-prices-btn" class="refresh-prices-button">↻ Refresh Prices</button>
                    <span class="refresh-status"></span>
                </div>

                <div class="pagination-controls">
                    <div class="pagination-buttons">
                        <button class="pagination-button prev-page" title="Previous page">←</button>
                        <span class="page-info">Page 1 of 1</span>
                        <button class="pagination-button next-page" title="Next page">→</button>
                    </div>
                </div>
            </div>
        `;
        
        tableContainer.appendChild(bottomControls);

        // Setup refresh button functionality
        const refreshButton = bottomControls.querySelector('#refresh-prices-btn');
        const statusIndicator = bottomControls.querySelector('.refresh-status');
        
        let refreshTimeout;
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

        // Sync both page size selects
        const topSelect = filterControls.querySelector('#page-size-select');
        
        topSelect.addEventListener('change', () => {
            this.currentPage = 1;
            this.refreshOrdersView();
        });

        // Add event listeners for pagination
        const toggle = filterControls.querySelector('#fillable-orders-toggle');
        toggle.addEventListener('change', () => this.refreshOrdersView());
        
        // Add event listeners for pagination
        const setupPaginationListeners = (controls) => {
            const prevButton = controls.querySelector('.prev-page');
            const nextButton = controls.querySelector('.next-page');
            const pageInfo = controls.querySelector('.page-info');
            
            prevButton.addEventListener('click', () => {
                console.log('Previous clicked, current page:', this.currentPage);
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.updatePageInfo(pageInfo);
                    this.refreshOrdersView();
                }
            });
            
            nextButton.addEventListener('click', () => {
                const pageSize = parseInt(this.container.querySelector('#page-size-select').value);
                console.log('Next clicked, current page:', this.currentPage, 'total orders:', this.totalOrders, 'page size:', pageSize);
                const totalPages = Math.ceil(this.totalOrders / pageSize);
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.updatePageInfo(pageInfo);
                    this.refreshOrdersView();
                }
            });
        };

        // Add this helper method to your class
        this.updatePageInfo = (pageInfoElement) => {
            const pageSize = parseInt(this.container.querySelector('#page-size-select').value);
            const totalPages = Math.ceil(this.totalOrders / pageSize);
            pageInfoElement.textContent = `Page ${this.currentPage} of ${totalPages}`;
        };

        // Setup pagination for both top and bottom controls
        const controls = tableContainer.querySelectorAll('.filter-controls');
        controls.forEach(setupPaginationListeners);

        this.container.appendChild(tableContainer);
    }

    formatAddress(address) {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    formatTimestamp(timestamp) {
        const date = new Date(Number(timestamp) * 1000);
        return date.toLocaleDateString('en-US', {
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    formatTimeUntil(timestamp) {
        const now = Math.floor(Date.now() / 1000);
        const diff = timestamp - now;
        
        if (diff <= 0) return 'Expired';
        
        const days = Math.floor(diff / 86400); // 86400 seconds in a day
        const hours = Math.floor((diff % 86400) / 3600); // Remaining hours
        const minutes = Math.floor((diff % 3600) / 60); // Remaining minutes
        
        if (days > 0) {
            return `${days}D ${hours}H ${minutes}M`;
        } else if (hours > 0) {
            return `${hours}H ${minutes}M`;
        } else {
            return `${minutes}M`;
        }
    }

    setupEventListeners() {
        this.tbody.addEventListener('click', async (e) => {
            if (e.target.classList.contains('fill-button')) {
                const orderId = e.target.dataset.orderId;
                await this.fillOrder(orderId);
            }
        });
    }

    setupFilters() {
        // Will implement filtering in next iteration
    }

    async checkAllowance(tokenAddress, owner, amount) {
        try {
            const tokenContract = new ethers.Contract(
                tokenAddress,
                ['function allowance(address owner, address spender) view returns (uint256)'],
                this.provider
            );
            const allowance = await tokenContract.allowance(owner, this.webSocket.contractAddress);
            return allowance.gte(amount);
        } catch (error) {
            console.error('[ViewOrders] Error checking allowance:', error);
            return false;
        }
    }

    async fillOrder(orderId, button) {
        try {
            if (button) {
                button.disabled = true;
                button.textContent = 'Processing...';
            }

            this.debug('Starting fill order process for orderId:', orderId);
            
            const order = window.webSocket.orderCache.get(Number(orderId));
            this.debug('Order details:', order);

            if (!order) {
                throw new Error('Order not found');
            }

            // Get contract from WebSocket and connect to signer
            const contract = await this.getContract();
            if (!contract) {
                throw new Error('Contract not available');
            }
            const signer = this.provider.getSigner();
            const contractWithSigner = contract.connect(signer);

            // Check order status first
            const currentOrder = await contractWithSigner.orders(orderId);
            this.debug('Current order state:', currentOrder);
            
            if (currentOrder.status !== 0) {
                throw new Error(`Order is not active (status: ${this.getOrderStatusText(currentOrder.status)})`);
            }

            // Check expiry
            const now = Math.floor(Date.now() / 1000);
            const orderExpiry = await contract.ORDER_EXPIRY();
            const expiryTime = Number(order.timestamp) + orderExpiry.toNumber();
            
            if (now >= expiryTime) {
                throw new Error('Order has expired');
            }

            // Get token contracts
            const buyToken = new ethers.Contract(
                order.buyToken,
                erc20Abi,
                this.provider.getSigner()
            );
            
            const sellToken = new ethers.Contract(
                order.sellToken,
                erc20Abi,
                this.provider.getSigner()
            );

            const currentAccount = await this.provider.getSigner().getAddress();

            // Get token details for proper formatting
            const buyTokenDecimals = await buyToken.decimals();
            const buyTokenSymbol = await buyToken.symbol();
            
            // Check balances first
            const buyTokenBalance = await buyToken.balanceOf(currentAccount);
            this.debug('Buy token balance:', {
                balance: buyTokenBalance.toString(),
                required: order.buyAmount.toString()
            });

            if (buyTokenBalance.lt(order.buyAmount)) {
                const formattedBalance = ethers.utils.formatUnits(buyTokenBalance, buyTokenDecimals);
                const formattedRequired = ethers.utils.formatUnits(order.buyAmount, buyTokenDecimals);
                
                throw new Error(
                    `Insufficient ${buyTokenSymbol} balance.\n` +
                    `Required: ${Number(formattedRequired).toLocaleString()} ${buyTokenSymbol}\n` +
                    `Available: ${Number(formattedBalance).toLocaleString()} ${buyTokenSymbol}`
                );
            }

            // Check allowances
            const buyTokenAllowance = await buyToken.allowance(currentAccount, contract.address);
            this.debug('Buy token allowance:', {
                current: buyTokenAllowance.toString(),
                required: order.buyAmount.toString()
            });

            if (buyTokenAllowance.lt(order.buyAmount)) {
                this.debug('Requesting buy token approval');
                const approveTx = await buyToken.approve(
                    contract.address, 
                    order.buyAmount  // Use exact order amount instead of MaxUint256
                );
                await approveTx.wait();
                this.showSuccess(`${buyTokenSymbol} approval granted`);
            }

            // Verify contract has enough sell tokens
            const contractSellBalance = await sellToken.balanceOf(contract.address);
            this.debug('Contract sell token balance:', {
                balance: contractSellBalance.toString(),
                required: order.sellAmount.toString()
            });

            if (contractSellBalance.lt(order.sellAmount)) {
                const sellTokenSymbol = await sellToken.symbol();
                const sellTokenDecimals = await sellToken.decimals();
                const formattedBalance = ethers.utils.formatUnits(contractSellBalance, sellTokenDecimals);
                const formattedRequired = ethers.utils.formatUnits(order.sellAmount, sellTokenDecimals);
                
                throw new Error(
                    `Contract has insufficient ${sellTokenSymbol} balance.\n` +
                    `Required: ${Number(formattedRequired).toLocaleString()} ${sellTokenSymbol}\n` +
                    `Available: ${Number(formattedBalance).toLocaleString()} ${sellTokenSymbol}`
                );
            }

            // Add gas buffer and execute transaction
            const gasEstimate = await contractWithSigner.estimateGas.fillOrder(orderId);
            this.debug('Gas estimate:', gasEstimate.toString());
            
            const gasLimit = gasEstimate.mul(120).div(100); // Add 20% buffer
            const tx = await contractWithSigner.fillOrder(orderId, { gasLimit });
            this.debug('Transaction sent:', tx.hash);
            
            const receipt = await tx.wait();
            this.debug('Transaction receipt:', receipt);

            if (receipt.status === 0) {
                throw new Error('Transaction reverted by contract');
            }

            order.status = 'Filled';
            /* this.orders.set(Number(orderId), order); */
            await this.refreshOrdersView();

            this.showSuccess(`Order ${orderId} filled successfully!`);

        } catch (error) {
            this.debug('Fill order error details:', error);
            
            // Handle specific error cases
            if (error.code === 4001) {
                this.showError('Transaction rejected by user');
                return;
            }
            
            // Check for revert reason in error data
            if (error.error?.data) {
                try {
                    const decodedError = ethers.utils.toUtf8String(error.error.data);
                    this.showError(`Transaction failed: ${decodedError}`);
                    return;
                } catch (e) {
                    // If we can't decode the error, fall through to default handling
                }
            }
            
            this.showError(this.getReadableError(error));
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = 'Fill Order';
            }
        }
    }

    getReadableError(error) {
        if (error.message?.includes('insufficient allowance')) {
            return 'Insufficient token allowance';
        }
        if (error.message?.includes('insufficient balance')) {
            return 'Insufficient token balance';
        }
        
        switch (error.code) {
            case 'ACTION_REJECTED':
                return 'Transaction was rejected by user';
            case 'INSUFFICIENT_FUNDS':
                return 'Insufficient funds for gas';
            case -32603:
                return 'Transaction would fail. Check order status and approvals.';
            case 'UNPREDICTABLE_GAS_LIMIT':
                return 'Error estimating gas. The transaction may fail.';
            default:
                return error.reason || error.message || 'Unknown error occurred';
        }
    }

    cleanup() {
        // Only clear timers, keep table structure
        if (this.expiryTimers) {
            this.expiryTimers.forEach(timerId => clearInterval(timerId));
            this.expiryTimers.clear();
        }
        // Don't clear the table
    }

    async createOrderRow(order) {
        try {
            // Get token info for both tokens in the order
            const sellTokenInfo = await window.webSocket.getTokenInfo(order.sellToken);
            const buyTokenInfo = await window.webSocket.getTokenInfo(order.buyToken);

            // Get icons
            const sellTokenIcon = this.getTokenIcon(sellTokenInfo);
            const buyTokenIcon = this.getTokenIcon(buyTokenInfo);

            const tr = this.createElement('tr');
            tr.dataset.orderId = order.id.toString();
            tr.dataset.timestamp = order.timestamp;
            tr.dataset.status = order.status;

            const currentAccount = walletManager.getAccount()?.toLowerCase();

            // Use WebSocket's helpers for order status and actions
            const status = window.webSocket.getOrderStatus(order);
            const canFill = window.webSocket.canFillOrder(order, currentAccount);
            const isUserOrder = order.maker?.toLowerCase() === currentAccount;
            const formattedExpiry = this.formatTimeUntil(order.timings.expiresAt);

            // Use cached deal metrics from WebSocket
            const { dealMetrics } = order;
            const {
                formattedSellAmount,
                formattedBuyAmount,
                sellTokenUsdPrice,
                buyTokenUsdPrice,
                deal
            } = dealMetrics || {};

            // Format USD prices with appropriate precision
            const formatUsdPrice = (price) => {
                if (!price) return '$-';
                if (price >= 100) return `$${price.toFixed(0)}`;
                if (price >= 1) return `$${price.toFixed(2)}`;
                return `$${price.toFixed(4)}`;
            };

            // Add price-estimate class if using default price
            const sellPriceClass = sellTokenUsdPrice ? '' : 'price-estimate';
            const buyPriceClass = buyTokenUsdPrice ? '' : 'price-estimate';
            const rateClass = (!sellTokenUsdPrice || !buyTokenUsdPrice) ? 'estimated-price' : '';

            // Check if user is the maker
            const actionContent = isUserOrder ? 
                '<span class="your-order">Your Order</span>' : 
                (canFill ? 
                    `<button class="fill-button" data-order-id="${order.id}">Fill Order</button>` : 
                    '');

            tr.innerHTML = `
                <td>${order.id}</td>
                <td>
                    <div class="token-info">
                        <div class="token-icon small">
                            ${sellTokenIcon}
                        </div>
                        <div class="token-details">
                            <a href="${this.getExplorerUrl(order.sellToken)}" 
                               class="token-link" 
                               target="_blank" 
                               title="View token contract">
                                ${sellTokenInfo.symbol}
                                <svg class="token-explorer-icon" viewBox="0 0 24 24">
                                    <path fill="currentColor" d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z" />
                                </svg>
                            </a>
                            <span class="token-price ${sellPriceClass}">${formatUsdPrice(sellTokenUsdPrice)}</span>
                        </div>
                    </div>
                </td>
                <td>${Number(formattedSellAmount || 0).toFixed(1)}</td>
                <td>
                    <div class="token-info">
                        <div class="token-icon small">
                            ${buyTokenIcon}
                        </div>
                        <div class="token-details">
                            <a href="${this.getExplorerUrl(order.buyToken)}" 
                               class="token-link" 
                               target="_blank" 
                               title="View token contract">
                                ${buyTokenInfo.symbol}
                                <svg class="token-explorer-icon" viewBox="0 0 24 24">
                                    <path fill="currentColor" d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z" />
                                </svg>
                            </a>
                            <span class="token-price ${buyPriceClass}">${formatUsdPrice(buyTokenUsdPrice)}</span>
                        </div>
                    </div>
                </td>
                <td>${Number(formattedBuyAmount || 0).toFixed(1)}</td>
                <td class="${rateClass}">${(deal || 0).toFixed(6)}</td>
                <td>${formattedExpiry}</td>
                <td class="order-status">${status}</td>
                <td class="action-column">${actionContent}</td>`;

            // Add click handler for fill button
            const fillButton = tr.querySelector('.fill-button');
            if (fillButton) {
                fillButton.addEventListener('click', () => this.fillOrder(order.id));
            }

            // Start the expiry timer for this row
            this.startExpiryTimer(tr);
            
            return tr;
        } catch (error) {
            this.debug('Error creating order row:', error);
            return '';
        }
    }

/*     async getContractExpiryTimes() {
        if (this.contractValues.orderExpiry && this.contractValues.gracePeriod) {
            return this.contractValues;
        }
        
        const contract = await this.getContract();
        this.contractValues = {
            orderExpiry: (await contract.ORDER_EXPIRY()).toNumber(),
            gracePeriod: (await contract.GRACE_PERIOD()).toNumber()
        };
        return this.contractValues;
    } */

/*     async getExpiryTime(timestamp) {
        try {
            const { orderExpiry, gracePeriod } = await this.getContractExpiryTimes();
            return (Number(timestamp) + orderExpiry + gracePeriod) * 1000; // Convert to milliseconds
        } catch (error) {
            console.error('[ViewOrders] Error calculating expiry time:', error);
            return Number(timestamp) * 1000; // Fallback to original timestamp
        }
    } */

/*     getTotalPages() {
        const pageSize = parseInt(this.container.querySelector('#page-size-select').value);
        if (pageSize === -1) return 1; // View all
        return Math.ceil(window.webSocket.orderCache.size / pageSize);
    }
 */
    updatePaginationControls(totalOrders) {
        const pageSize = parseInt(this.container.querySelector('#page-size-select')?.value || '25');
        
        const updateControls = (container) => {
            const prevButton = container.querySelector('.prev-page');
            const nextButton = container.querySelector('.next-page');
            const pageInfo = container.querySelector('.page-info');
            
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

/*     async displayOrders(orders) {
        try {
            // Remove contract call since we have expiry in WebSocket
            // const contract = await this.getContract();
            // const orderExpiry = (await contract.ORDER_EXPIRY()).toNumber();
            
            // Use WebSocket's cached values instead
            const orderExpiry = window.webSocket.orderExpiry.toNumber();
            
            // ... rest of display logic ...
        } catch (error) {
            this.debug('Error displaying orders:', error);
            throw error;
        }
    } */

    startExpiryTimer(row) {
        // Clear any existing timer
        const existingTimer = this.expiryTimers?.get(row.dataset.orderId);
        if (existingTimer) {
            clearInterval(existingTimer);
        }

        // Initialize timers Map if not exists
        if (!this.expiryTimers) {
            this.expiryTimers = new Map();
        }

        const updateExpiryAndButton = async () => {
            const expiresCell = row.querySelector('td:nth-child(7)');
            const actionCell = row.querySelector('.action-column');
            if (!expiresCell || !actionCell) return;

            const orderId = row.dataset.orderId;
            const order = window.webSocket.orderCache.get(Number(orderId));
            if (!order) return;

            const currentTime = Math.floor(Date.now() / 1000);
            const isExpired = currentTime > order.timings.expiresAt;
            const timeDiff = order.timings.expiresAt - currentTime;
            const currentAccount = walletManager.getAccount()?.toLowerCase();
            const isUserOrder = order.maker?.toLowerCase() === currentAccount;

            // Update expiry text
            const newExpiryText = this.formatTimeDiff(timeDiff);
            if (expiresCell.textContent !== newExpiryText) {
                expiresCell.textContent = newExpiryText;
            }

            // Update action column content
            if (isUserOrder) {
                actionCell.innerHTML = '<span class="your-order">Your Order</span>';
            } else if (isExpired) {
                actionCell.innerHTML = '<span class="expired-order">Expired</span>';
            } else if (!isUserOrder && window.webSocket.canFillOrder(order, currentAccount)) {
                actionCell.innerHTML = `<button class="fill-button" data-order-id="${order.id}">Fill Order</button>`;
                const fillButton = actionCell.querySelector('.fill-button');
                if (fillButton) {
                    fillButton.addEventListener('click', () => this.fillOrder(order.id));
                }
            } else {
                actionCell.innerHTML = '';
            }
        };

        // Update immediately and then every minute
        updateExpiryAndButton();
        const timerId = setInterval(updateExpiryAndButton, 60000); // Update every minute
        this.expiryTimers.set(row.dataset.orderId, timerId);
    }

/*     showLoadingState() {
        const tbody = this.container.querySelector('tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="loading-message">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">Loading orders...</div>
                    </td>
                </tr>`;
        }
    } */

    getExplorerUrl(address) {
        const networkConfig = getNetworkConfig();
        if (!networkConfig?.explorer) {
            console.warn('Explorer URL not configured');
            return '#';
        }
        return `${networkConfig.explorer}/address/${ethers.utils.getAddress(address)}`;
    }

    getOrderStatusText(status) {
        const statusMap = {
            0: 'Active',
            1: 'Filled',
            2: 'Cancelled'
            // Removed status 3 (Expired) as we want to keep showing 'Active'
        };
        return statusMap[status] || `Unknown (${status})`;
    }

    async getContract() {
        if (!window.webSocket?.contract) {
            throw new Error('WebSocket contract not initialized');
        }
        return window.webSocket.contract;
    }

    formatTimeDiff(seconds) {
        const days = Math.floor(Math.abs(seconds) / 86400);
        const hours = Math.floor((Math.abs(seconds) % 86400) / 3600);
        const minutes = Math.floor((Math.abs(seconds) % 3600) / 60);
        
        const prefix = seconds < 0 ? '-' : '';
        
        if (days > 0) {
            return `${prefix}${days}D ${hours}H ${minutes}M`;
        } else if (hours > 0) {
            return `${prefix}${hours}H ${minutes}M`;
        } else {
            return `${prefix}${minutes}M`;
        }
    }
}
