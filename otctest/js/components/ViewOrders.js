import { BaseComponent } from './BaseComponent.js';
import { ethers } from 'ethers';
import { erc20Abi } from '../abi/erc20.js';
import { ContractError, CONTRACT_ERRORS } from '../errors/ContractErrors.js';
import { isDebugEnabled, getNetworkConfig } from '../config.js';
import { NETWORK_TOKENS } from '../utils/tokens.js';
import { getTokenList } from '../utils/tokens.js';
import { PricingService } from '../services/PricingService.js';

export class ViewOrders extends BaseComponent {
    constructor(containerId = 'view-orders') {
        super(containerId);
        this.orders = new Map();
        this.tokenCache = new Map();
        this.provider = new ethers.providers.Web3Provider(window.ethereum);
        this.currentPage = 1;
        this.setupErrorHandling();
        this.eventSubscriptions = new Set();
        this.expiryTimers = new Map();
        this.tokenList = [];
        
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

        // Initialize sorting state with null values
        this.sortConfig = {
            column: null,
            direction: null,
            isColumnClick: false
        };

        // Add cache for contract values
        this.contractValues = {
            orderExpiry: null,
            gracePeriod: null
        };

        // Add pricing service
        this.pricingService = new PricingService();
    }

    async init() {
        const { getTokenList } = await import('../utils/tokens.js');
        this.tokenList = await getTokenList();
        await super.init();
        await this.pricingService.initialize();
        
        // Subscribe to price updates
        this.pricingService.subscribe(() => this.refreshOrdersView());
    }

    async getTokenInfo(tokenAddress) {
        try {
            // Use WebSocket's queueRequest to handle rate limiting
            return await window.webSocket.queueRequest(async () => {
                // 1. First try to get from NETWORK_TOKENS (predefined list)
                const predefinedToken = NETWORK_TOKENS[tokenAddress.toLowerCase()];
                if (predefinedToken) {
                    return predefinedToken;
                }

                // 2. Then check WebSocket's token cache
                if (window.webSocket.tokenCache?.has(tokenAddress)) {
                    return window.webSocket.tokenCache.get(tokenAddress);
                }

                // 3. If not found, fetch from contract
                const contract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
                const [symbol, decimals] = await Promise.all([
                    contract.symbol(),
                    contract.decimals()
                ]);

                const tokenInfo = { address: tokenAddress, symbol, decimals };
                
                // Cache in WebSocket service
                if (window.webSocket.tokenCache) {
                    window.webSocket.tokenCache.set(tokenAddress, tokenInfo);
                }

                return tokenInfo;
            });
        } catch (error) {
            this.debug('Error getting token info:', error);
            return {
                address: tokenAddress,
                symbol: `${tokenAddress.slice(0, 4)}...${tokenAddress.slice(-4)}`,
                decimals: 18
            };
        }
    }

    getTokenIcon(token) {
        try {
            if (!token?.address) {
                return this.getDefaultTokenIcon();
            }

            // First check if the token exists in our token list
            const tokenFromList = this.tokenList.find(t => 
                t.address.toLowerCase() === token.address.toLowerCase()
            );

            this.debug('Token from list:', tokenFromList);

            // If we found a token with a logo URI, use it
            if (tokenFromList?.logoURI) {
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

            // Fallback to the existing color-based icon
            const cachedToken = this.tokenCache.get(token.address);
            const symbol = cachedToken?.symbol || token.symbol || '?';
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
        try {
            this.debug('Initializing ViewOrders component');
            
            // Load token list first
            this.tokenList = await getTokenList();
            this.debug('Loaded token list:', this.tokenList);

            // Wait for WebSocket initialization with timeout
            if (!window.webSocket) {
                this.debug('WebSocket not available, waiting for initialization...');
                let attempts = 0;
                const maxAttempts = 10;
                
                while (!window.webSocket && attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    attempts++;
                    this.debug(`Waiting for WebSocket... Attempt ${attempts}/${maxAttempts}`);
                }
                
                if (!window.webSocket) {
                    throw new Error('WebSocket initialization failed');
                }
            }
            this.debug('WebSocket available');
            
            // Store WebSocket reference
            this.webSocket = window.webSocket;

            // Wait for WebSocket to be fully initialized
            if (!this.webSocket.isInitialized) {
                this.debug('WebSocket not yet initialized, waiting...');
                let attempts = 0;
                const maxAttempts = 10;
                
                while (!this.webSocket.isInitialized && attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    attempts++;
                    this.debug(`Waiting for WebSocket initialization... Attempt ${attempts}/${maxAttempts}`);
                }
                
                if (!this.webSocket.isInitialized) {
                    throw new Error('WebSocket failed to initialize');
                }
            }
            this.debug('WebSocket initialized');

            // Wait for contract to be available and cache values
            if (!this.contractValues.orderExpiry || !this.contractValues.gracePeriod) {
                this.debug('Getting contract values...');
                const contract = await this.getContract();
                this.contractValues = {
                    orderExpiry: (await contract.ORDER_EXPIRY()).toNumber(),
                    gracePeriod: (await contract.GRACE_PERIOD()).toNumber()
                };
                this.debug('Cached contract values:', this.contractValues);
            }

            // Get initial orders from cache
            const cachedOrders = window.webSocket.getOrders();
            this.debug('Initial cached orders:', {
                orderCount: cachedOrders?.length || 0,
                orders: cachedOrders
            });
            
            // Cleanup previous state
            this.debug('Cleaning up previous state...');
            this.cleanup();
            this.container.innerHTML = '';
            
            // Setup the table structure
            this.debug('Setting up table structure...');
            await this.setupTable();
            
            // Setup WebSocket subscriptions
            this.debug('Setting up WebSocket subscriptions...');
            await this.setupWebSocket();

            // Initialize orders Map with cached orders
            if (cachedOrders && cachedOrders.length > 0) {
                this.debug('Loading orders from cache:', cachedOrders);
                this.orders.clear();
                cachedOrders.forEach(order => {
                    this.orders.set(order.id, order);
                });
            }

            // Refresh the view with the current filter state
            this.debug('Refreshing orders view...');
            await this.refreshOrdersView();

            this.debug('Initialization complete');
            return true;
        } catch (error) {
            this.debug('Initialization error:', error);
            this.showError('Failed to initialize orders view. Please try again.');
            return false;
        }
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
            this.orders.clear();
            Object.entries(orders).forEach(([orderId, orderData]) => {
                this.orders.set(Number(orderId), {
                    id: Number(orderId),
                    ...orderData
                });
            });
            await this.refreshOrdersView();
        });

        // Add other event subscriptions similarly
        ['OrderCreated', 'OrderFilled', 'OrderCanceled'].forEach(event => {
            addSubscription(event, async (orderData) => {
                this.debug(`${event} event received:`, orderData);
                if (event === 'OrderCreated') {
                    this.orders.set(Number(orderData.id), orderData);
                } else {
                    const order = this.orders.get(Number(orderData.id));
                    if (order) {
                        order.status = event === 'OrderFilled' ? 'Filled' : 'Canceled';
                    }
                }
                await this.refreshOrdersView();
            });
        });
    }

    async refreshOrdersView() {
        if (this.isLoading) return;
        this.isLoading = true;
        
        try {
            this.debug('Refreshing orders view');
            
            // Get all orders and convert to array
            let ordersToDisplay = Array.from(this.orders.values());
            
            // Get contract and orderExpiry value first
            const contract = await this.getContract();
            const orderExpiry = window.webSocket?.orderExpiry?.toNumber() || 
                               (await contract.ORDER_EXPIRY()).toNumber();
            const currentTime = Math.floor(Date.now() / 1000);
            
            // Apply sorting if configured
            if (this.sortConfig.column === 'sell' || this.sortConfig.column === 'buy') {
                ordersToDisplay.sort((a, b) => {
                    const tokenA = this.sortConfig.column === 'sell' ? a.sellToken : a.buyToken;
                    const tokenB = this.sortConfig.column === 'sell' ? b.sellToken : b.buyToken;
                    
                    const symbolA = this.tokenCache.get(tokenA)?.symbol || '';
                    const symbolB = this.tokenCache.get(tokenB)?.symbol || '';
                    
                    if (symbolA < symbolB) return -1;
                    if (symbolA > symbolB) return 1;
                    return 0;
                });
            } else if (this.sortConfig.column === 'id') {
                // Sort numerically by ID
                ordersToDisplay.sort((a, b) => {
                    return Number(a.id) - Number(b.id);
                });
            }

            // If descending, reverse the entire array
            if (this.sortConfig.direction === 'desc') {
                ordersToDisplay.reverse();
            }
            
            // Get filter state
            const showOnlyActive = this.container.querySelector('#fillable-orders-toggle')?.checked ?? true;
            const pageSize = parseInt(this.container.querySelector('#page-size-select')?.value || '25');
            
            // Filter active orders if needed
            if (showOnlyActive) {
                ordersToDisplay = await Promise.all(ordersToDisplay.map(async order => {
                    const canFill = await this.canFillOrder(order);
                    const expiryTime = Number(order.timestamp) + orderExpiry;
                    return {
                        order,
                        canFill,
                        isExpired: currentTime >= expiryTime
                    };
                }));

                ordersToDisplay = ordersToDisplay
                    .filter(({ order, canFill, isExpired }) => 
                        canFill && 
                        !isExpired && 
                        order.status !== 'Filled' && 
                        order.status !== 'Canceled'
                    )
                    .map(({ order }) => order);
            }

            // Apply pagination
            const startIndex = (this.currentPage - 1) * pageSize;
            const endIndex = pageSize === -1 ? ordersToDisplay.length : startIndex + pageSize;
            const paginatedOrders = pageSize === -1 ? 
                ordersToDisplay : 
                ordersToDisplay.slice(startIndex, endIndex);

            // Clear existing rows
            const tbody = this.container.querySelector('tbody');
            if (!tbody) {
                this.debug('ERROR: tbody not found');
                return;
            }
            tbody.innerHTML = '';

            // Add paginated rows
            for (const order of paginatedOrders) {
                const newRow = await this.createOrderRow(order);
                if (newRow) {
                    tbody.appendChild(newRow);
                }
            }

            // Update pagination controls with total count before filtering
            this.updatePaginationControls(ordersToDisplay.length);

            if (ordersToDisplay.length === 0) {
                tbody.innerHTML = `
                    <tr class="empty-message">
                        <td colspan="8" class="no-orders-message">
                            <div class="placeholder-text">
                                ${showOnlyActive ? 
                                    'No fillable orders available at this time' : 
                                    'No orders found'}
                            </div>
                        </td>
                    </tr>`;
            }

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

    updateOrderStatus(orderId, status) {
        const order = this.orders.get(orderId.toString());
        if (order) {
            order.status = status;
            this.orders.set(orderId.toString(), order);
            this.debouncedRefresh();
        }
    }

    async addOrderToTable(order, tokenDetailsMap) {
        try {
            this.orders.set(order.id.toString(), order);
            this.debouncedRefresh();
        } catch (error) {
            console.error('[ViewOrders] Error adding order to table:', error);
            throw error;
        }
    }

    removeOrderFromTable(orderId) {
        this.orders.delete(orderId.toString());
        this.debouncedRefresh();
    }

    async setupTable() {
        const tableContainer = this.createElement('div', 'table-container');
        
        // Create top pagination controls with dropdown
        const createTopControls = () => `
            <div class="pagination-controls">
                <select id="page-size-select" class="page-size-select">
                    <option value="10">10 per page</option>
                    <option value="25" selected>25 per page</option>
                    <option value="50">50 per page</option>
                    <option value="100">100 per page</option>
                    <option value="-1">View all</option>
                </select>
                
                <div class="pagination-buttons">
                    <button class="pagination-button prev-page" title="Previous page">
                        ←
                    </button>
                    <span class="page-info">Page 1 of 1</span>
                    <button class="pagination-button next-page" title="Next page">
                        →
                    </button>
                </div>
            </div>
        `;

        // Create bottom pagination controls without dropdown
        const createBottomControls = () => `
            <div class="pagination-controls">
                <div class="pagination-buttons">
                    <button class="pagination-button prev-page" title="Previous page">
                        ←
                    </button>
                    <span class="page-info">Page 1 of 1</span>
                    <button class="pagination-button next-page" title="Next page">
                        →
                    </button>
                </div>
            </div>
        `;
        
        // Add top filter controls with pagination
        const filterControls = this.createElement('div', 'filter-controls');
        filterControls.innerHTML = `
            <div class="filter-row">
                <label class="filter-toggle">
                    <input type="checkbox" id="fillable-orders-toggle" checked>
                    <span>Show only fillable orders</span>
                </label>
                ${createTopControls()}
            </div>
        `;
        
        tableContainer.appendChild(filterControls);
        
        // Add table
        const table = this.createElement('table', 'orders-table');
        
        const thead = this.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th data-sort="id">ID <span class="sort-icon">↕</span></th>
                <th data-sort="buy">Buy <span class="sort-icon">↕</span></th>
                <th>Amount</th>
                <th data-sort="sell">Sell <span class="sort-icon">↕</span></th>
                <th>Amount</th>
                <th>Deal</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Action</th>
            </tr>`;
        
        // Add refresh button to filter controls
        const refreshButton = document.createElement('button');
        refreshButton.className = 'refresh-prices-button';
        refreshButton.innerHTML = '↻ Refresh Prices';
        refreshButton.addEventListener('click', () => this.pricingService.refreshPrices());
        filterControls.querySelector('.filter-row').appendChild(refreshButton);
        
        // Add click handlers for sorting
        thead.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => this.handleSort(th.dataset.sort));
        });
        
        table.appendChild(thead);
        table.appendChild(this.createElement('tbody'));
        tableContainer.appendChild(table);
        
        // Add bottom pagination
        const bottomControls = this.createElement('div', 'filter-controls bottom-controls');
        bottomControls.innerHTML = `
            <div class="filter-row">
                ${createBottomControls()}
            </div>
        `;
        tableContainer.appendChild(bottomControls);
        
        // Add event listeners
        const addPaginationListeners = (container, isTop) => {
            if (isTop) {
                const pageSizeSelect = container.querySelector('.page-size-select');
                if (pageSizeSelect) {
                    pageSizeSelect.addEventListener('change', () => {
                        this.currentPage = 1;
                        this.refreshOrdersView();
                    });
                }
            }
            
            const prevButton = container.querySelector('.prev-page');
            const nextButton = container.querySelector('.next-page');
            
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
        };
        
        // Add listeners to both top and bottom controls
        addPaginationListeners(filterControls, true);
        addPaginationListeners(bottomControls, false);
        
        const toggle = filterControls.querySelector('#fillable-orders-toggle');
        toggle.addEventListener('change', () => this.refreshOrdersView());
        
        this.container.appendChild(tableContainer);

        // Initialize sorting state
        this.sortConfig = {
            column: 'id',
            direction: 'asc'
        };
    }

    handleSort(column) {
        this.debug('Sorting by column:', column);
        
        // If clicking same column, toggle direction
        if (this.sortConfig.column === column) {
            if (this.sortConfig.direction === 'asc') {
                this.sortConfig.direction = 'desc';
            } else if (this.sortConfig.direction === 'desc') {
                // Reset sorting
                this.sortConfig.column = null;
                this.sortConfig.direction = null;
            } else {
                // No current direction, start with ascending
                this.sortConfig.direction = 'asc';
            }
        } else {
            // New column, start with ascending
            this.sortConfig.column = column;
            this.sortConfig.direction = 'asc';
        }

        // Update sort icons
        const headers = this.container.querySelectorAll('th[data-sort]');
        headers.forEach(header => {
            const icon = header.querySelector('.sort-icon');
            if (header.dataset.sort === column && this.sortConfig.direction) {
                header.classList.add('active-sort');
                icon.textContent = this.sortConfig.direction === 'asc' ? '↑' : '↓';
            } else {
                header.classList.remove('active-sort');
                icon.textContent = '↕';
            }
        });

        this.debug('Sort config after update:', this.sortConfig);
        this.refreshOrdersView();
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

    async formatExpiry(timestamp, orderExpiry = null) {
        try {
            // Use provided orderExpiry or cached value
            const expiryValue = orderExpiry || this.contractValues?.orderExpiry || 420;
            const expiryTime = Number(timestamp) + expiryValue;
            const now = Math.floor(Date.now() / 1000);
            const timeLeft = expiryTime - now;
            
            this.debug('Expiry calculation:', {
                timestamp,
                orderExpiry: expiryValue,
                expiryTime,
                now,
                timeLeft,
                timeLeftMinutes: timeLeft / 60
            });
            
            const minutes = Math.ceil(timeLeft / 60);
            return `${minutes}m`;
        } catch (error) {
            this.debug('Error formatting expiry:', error);
            return 'Unknown';
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
            
            const order = this.orders.get(Number(orderId));
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
            this.orders.set(Number(orderId), order);
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

    async getOrderDetails(orderId) {
        try {
            const contract = await this.getContract();
            if (!contract) {
                throw new Error('Contract not initialized');
            }

            const order = await contract.orders(orderId);
            return {
                id: orderId,
                maker: order.maker,
                taker: order.taker,
                sellToken: order.sellToken,
                sellAmount: order.sellAmount,
                buyToken: order.buyToken,
                buyAmount: order.buyAmount,
                timestamp: order.timestamp,
                status: order.status,
                orderCreationFee: order.orderCreationFee,
                tries: order.tries
            };
        } catch (error) {
            console.error('[ViewOrders] Error getting order details:', error);
            throw error;
        }
    }

    cleanup() {
        clearTimeout(this._refreshTimeout);
        // Clear all expiry timers
        if (this.expiryTimers) {
            this.expiryTimers.forEach(timerId => clearInterval(timerId));
            this.expiryTimers.clear();
        }
        
        // Clear existing subscriptions
        this.eventSubscriptions.forEach(sub => {
            if (window.webSocket) {
                window.webSocket.unsubscribe(sub.event, sub.callback);
            }
        });
        this.eventSubscriptions.clear();
        
        // Clear orders map
        this.orders.clear();
        
        // Clear the table
        if (this.container) {
            const tbody = this.container.querySelector('tbody');
            if (tbody) {
                tbody.innerHTML = '';
            }
        }
    }

    async createOrderRow(order) {
        try {
            // Ensure prices are loaded
            await this.pricingService.refreshPrices();
            
            // Get USD prices from pricing service, default to 1 if not available
            const buyTokenUsdPrice = this.pricingService.getPrice(order.sellToken) || 1;
            const sellTokenUsdPrice = this.pricingService.getPrice(order.buyToken) || 1;

            // Debug the actual values
            this.debug('Token prices:', {
                sellToken: order.buyToken,
                sellTokenUsdPrice,
                buyToken: order.sellToken,
                buyTokenUsdPrice,
                pricesMap: this.pricingService.prices,
                usingEstimates: !this.pricingService.getPrice(order.sellToken) || !this.pricingService.getPrice(order.buyToken)
            });

            // Calculate Rate (sellTokenUSD/buyTokenUsdPrice)
            const rate = sellTokenUsdPrice / buyTokenUsdPrice;

            // Add estimated-price class if either price is using the default $1
            const rateClass = (!this.pricingService.getPrice(order.sellToken) || !this.pricingService.getPrice(order.buyToken)) ? 'estimated-price' : '';

            // Get token info for both tokens in the order
            const sellTokenInfo = await this.getTokenInfo(order.sellToken);
            const buyTokenInfo = await this.getTokenInfo(order.buyToken);

            // Now you can use the token info when creating the row
            const sellTokenIcon = this.getTokenIcon(sellTokenInfo);
            const buyTokenIcon = this.getTokenIcon(buyTokenInfo);

            // Use the token symbols from tokenInfo instead of raw addresses
            const sellTokenSymbol = sellTokenInfo.symbol;
            const buyTokenSymbol = buyTokenInfo.symbol;

            const tr = this.createElement('tr');
            tr.dataset.orderId = order.id.toString();
            tr.dataset.timestamp = order.timestamp;
            tr.dataset.status = order.status;

            // Get network tokens
            const networkConfig = getNetworkConfig();
            const networkTokens = NETWORK_TOKENS[networkConfig.name] || [];

            // Get token details, first checking NETWORK_TOKENS, then fallback to tokenDetailsMap
            const getSafeTokenDetails = (tokenAddress) => {
                const predefinedToken = networkTokens.find(
                    t => t.address.toLowerCase() === tokenAddress.toLowerCase()
                );
                if (predefinedToken) {
                    return {
                        ...predefinedToken,
                        ...this.tokenCache.get(tokenAddress)
                    };
                }
                return this.tokenCache.get(tokenAddress) || { symbol: 'UNK', decimals: 18 };
            };

            const sellTokenDetails = getSafeTokenDetails(order.sellToken);
            const buyTokenDetails = getSafeTokenDetails(order.buyToken);
            const canFill = await this.canFillOrder(order);
            const expiryTime = await this.getExpiryTime(order.timestamp);
            const status = this.getOrderStatus(order, expiryTime);
            const formattedExpiry = await this.formatExpiry(order.timestamp);
            
            // Get current account first
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            const currentAccount = accounts[0]?.toLowerCase();
            const isUserOrder = order.maker?.toLowerCase() === currentAccount;
    
            const sellAmount = ethers.utils.formatUnits(order.sellAmount, sellTokenDetails?.decimals || 18);
            const buyAmount = ethers.utils.formatUnits(order.buyAmount, buyTokenDetails?.decimals || 18);

            // Calculate Price (sellAmount/buyAmount) due to taker view
            const price = Number(sellAmount) / Number(buyAmount);

            // Calculate Deal (Price * Rate)
            const deal = price * rate;
            
            // Format USD prices with appropriate precision
            const formatUsdPrice = (price) => {
                if (price >= 100) return `$${price.toFixed(0)}`;
                if (price >= 1) return `$${price.toFixed(2)}`;
                return `$${price.toFixed(4)}`;
            };

            // Add price-estimate class if using default price
            const sellPriceClass = this.pricingService.getPrice(order.buyToken) ? '' : 'price-estimate';
            const buyPriceClass = this.pricingService.getPrice(order.sellToken) ? '' : 'price-estimate';

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
                                ${sellTokenSymbol}
                                <svg class="token-explorer-icon" viewBox="0 0 24 24">
                                    <path fill="currentColor" d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z" />
                                </svg>
                            </a>
                            <span class="token-price ${sellPriceClass}">${formatUsdPrice(buyTokenUsdPrice)}</span>
                        </div>
                    </div>
                </td>
                <td>${Number(sellAmount).toFixed(1)}</td>
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
                                ${buyTokenSymbol}
                                <svg class="token-explorer-icon" viewBox="0 0 24 24">
                                    <path fill="currentColor" d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z" />
                                </svg>
                            </a>
                            <span class="token-price ${buyPriceClass}">${formatUsdPrice(sellTokenUsdPrice)}</span>
                        </div>
                    </div>
                </td>
                <td>${Number(buyAmount).toFixed(1)}</td>
                <td class="${rateClass}">${deal.toFixed(6)}</td>
                <td>${formattedExpiry}</td>
                <td class="order-status">${status}</td>
                <td class="action-column">${canFill ? 
                    `<button class="fill-button" data-order-id="${order.id}">Fill Order</button>` : 
                    isUserOrder ?
                    '<span class="your-order">Your Order</span>' : 
                    ''
                }</td>`;

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
            return ''; // or some error row representation
        }
    }

    async getContractExpiryTimes() {
        if (this.contractValues.orderExpiry && this.contractValues.gracePeriod) {
            return this.contractValues;
        }
        
        const contract = await this.getContract();
        this.contractValues = {
            orderExpiry: (await contract.ORDER_EXPIRY()).toNumber(),
            gracePeriod: (await contract.GRACE_PERIOD()).toNumber()
        };
        return this.contractValues;
    }

    async getExpiryTime(timestamp) {
        try {
            const { orderExpiry, gracePeriod } = await this.getContractExpiryTimes();
            return (Number(timestamp) + orderExpiry + gracePeriod) * 1000; // Convert to milliseconds
        } catch (error) {
            console.error('[ViewOrders] Error calculating expiry time:', error);
            return Number(timestamp) * 1000; // Fallback to original timestamp
        }
    }

    getOrderStatus(order, currentTime, orderExpiry, gracePeriod) {
        this.debug('Order timing:', {
            currentTime,
            orderTime: order.timestamp,
            orderExpiry,  // 420 seconds (7 minutes)
            gracePeriod   // 420 seconds (7 minutes)
        });

        // Check explicit status first
        if (order.status === 'Canceled') return 'Canceled';
        if (order.status === 'Filled') return 'Filled';

        // Then check timing
        const totalExpiry = orderExpiry + gracePeriod;
        const orderTime = Number(order.timestamp);

        if (currentTime > orderTime + totalExpiry) {
            this.debug('Order not active: Past grace period');
            return 'Expired';
        }
        if (currentTime > orderTime + orderExpiry) {
            this.debug('Order status: Awaiting Clean');
            return 'Expired';
        }

        this.debug('Order status: Active');
        return 'Active';
    }

    async canFillOrder(order) {
        try {
            if (!this.webSocket) {
                this.debug('WebSocket not available for canFillOrder');
                return false;
            }

            const result = await this.webSocket.queueRequest(async () => {
                // Ensure WebSocket is initialized
                if (!this.webSocket.isInitialized) {
                    this.debug('WebSocket not initialized, waiting...');
                    await this.webSocket?.initialize();
                }

                // Get current account
                const accounts = await window.ethereum.request({ 
                    method: 'eth_accounts' 
                });
                if (!accounts || accounts.length === 0) {
                    this.debug('No wallet connected');
                    return false;
                }
                const currentAccount = accounts[0].toLowerCase();

                // Convert status from number to string if needed
                const statusMap = ['Active', 'Filled', 'Canceled'];
                const orderStatus = typeof order.status === 'number' ? 
                    statusMap[order.status] : order.status;
                
                if (orderStatus !== 'Active') {
                    this.debug('Order not active:', orderStatus);
                    return false;
                }

                // Use cached orderExpiry from WebSocket
                const orderExpiry = this.webSocket.orderExpiry;
                if (!orderExpiry) {
                    this.debug('Order expiry not available in WebSocket cache');
                    return false;
                }
                this.debug('Using cached order expiry:', orderExpiry.toString());

                const now = Math.floor(Date.now() / 1000);
                const expiryTime = Number(order.timestamp) + orderExpiry.toNumber();

                if (now >= expiryTime) {
                    this.debug('Order expired', {
                        now,
                        timestamp: order.timestamp,
                        orderExpiry: orderExpiry.toNumber(),
                        expiryTime
                    });
                    return false;
                }

                // Check if user is the maker (can't fill own orders)
                if (order.maker?.toLowerCase() === currentAccount) {
                    this.debug('User is maker of order');
                    return false;
                }

                // Check if order is open to all or if user is the specified taker
                const isOpenOrder = order.taker === ethers.constants.AddressZero;
                const isSpecifiedTaker = order.taker?.toLowerCase() === currentAccount;
                const canFill = isOpenOrder || isSpecifiedTaker;

                this.debug('Can fill order:', {
                    isOpenOrder,
                    isSpecifiedTaker,
                    canFill
                });
                
                return canFill;
            });
            return result;
        } catch (error) {
            this.debug('Error in canFillOrder:', error);
            return false;
        }
    }

    getTotalPages() {
        const pageSize = parseInt(this.container.querySelector('#page-size-select').value);
        if (pageSize === -1) return 1; // View all
        return Math.ceil(this.orders.size / pageSize);
    }

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

    async refreshOrders() {
        try {
            this.debug('Refreshing orders view');
            const orders = this.webSocket.getOrders() || [];
            this.debug('Orders from WebSocket:', orders);

            const contract = await this.getContract();
            if (!contract) {
                throw new Error('Contract not initialized');
            }

            const orderExpiry = (await contract.ORDER_EXPIRY()).toNumber();
            const gracePeriod = (await contract.GRACE_PERIOD()).toNumber();
            const currentTime = Math.floor(Date.now() / 1000);

            // Show all orders including cleaned ones
            const filteredOrders = orders.filter(order => {
                const status = this.getOrderStatus(order, currentTime, orderExpiry, gracePeriod);
                this.debug('Processing order:', {
                    orderId: order.id,
                    status,
                    timestamp: order.timestamp,
                    currentTime,
                    orderExpiry,
                    gracePeriod
                });
                return true; // Show all orders
            });

            this.debug('Orders after filtering:', filteredOrders);

            // Sort orders by timestamp descending
            const sortedOrders = [...filteredOrders].sort((a, b) => b.timestamp - a.timestamp);
            await this.displayOrders(sortedOrders);

        } catch (error) {
            this.debug('Error refreshing orders:', error);
            this.showError('Failed to refresh orders');
        }
    }

    async displayOrders(orders) {
        try {
            const contract = await this.getContract();
            const orderExpiry = (await contract.ORDER_EXPIRY()).toNumber();
            this.debug('Order expiry from contract:', {
                orderExpiry,
                inMinutes: orderExpiry / 60
            });
            
            // ... rest of the code ...
        } catch (error) {
            this.debug('Error displaying orders:', error);
            throw error;
        }
    }

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

        const updateExpiry = async () => {
            const expiresCell = row.querySelector('td:nth-child(7)'); // Updated index for Expires column
            if (!expiresCell) return;

            const timestamp = row.dataset.timestamp;
            const currentTime = Math.floor(Date.now() / 1000);
            const contract = await this.getContract();
            const orderExpiry = (await contract.ORDER_EXPIRY()).toNumber();
            const expiryTime = Number(timestamp) + orderExpiry;
            const timeDiff = expiryTime - currentTime;

            const formatTimeDiff = (timeDiff) => {
                const absDiff = Math.abs(timeDiff);
                const days = Math.floor(absDiff / 86400);
                const hours = Math.floor((absDiff % 86400) / 3600);
                const minutes = Math.floor((absDiff % 3600) / 60);
                const sign = timeDiff < 0 ? '-' : '';

                if (days > 0) {
                    return `${sign}${days}d ${hours}h`;
                }
                return `${sign}${hours}h ${minutes}m`;
            };

            const newExpiryText = formatTimeDiff(timeDiff);
            if (expiresCell.textContent !== newExpiryText) {
                expiresCell.textContent = newExpiryText;
            }
        };

        // Update immediately and then every minute
        updateExpiry();
        const timerId = setInterval(updateExpiry, 60000); // Update every minute
        this.expiryTimers.set(row.dataset.orderId, timerId);
    }

    showLoadingState() {
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
    }

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
            2: 'Cancelled',
            3: 'Expired'
        };
        return statusMap[status] || `Unknown (${status})`;
    }

    async getContract() {
        if (!window.webSocket?.contract) {
            throw new Error('WebSocket contract not initialized');
        }
        return window.webSocket.contract;
    }

    updateExpiryTimer(row, order) {
        if (!window.webSocket?.orderExpiry) {
            return;
        }

        const expiresCell = row.querySelector('.expires');
        if (!expiresCell) return;

        const expiryTime = window.webSocket.getOrderExpiryTime(order);
        if (!expiryTime) return;

        const updateExpiry = () => {
            const currentTime = Math.floor(Date.now() / 1000);
            const timeDiff = expiryTime - currentTime;

            const newExpiryText = formatTimeDiff(timeDiff);

            if (expiresCell.textContent !== newExpiryText) {
                expiresCell.textContent = newExpiryText;
            }
        };

        // Update immediately and then every minute
        updateExpiry();
        const timerId = setInterval(updateExpiry, 60000); // Update every minute
        this.expiryTimers.set(row.dataset.orderId, timerId);
    }
}
