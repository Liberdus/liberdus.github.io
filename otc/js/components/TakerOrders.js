import { ViewOrders } from './ViewOrders.js';
import { ethers } from 'ethers';
import { isDebugEnabled } from '../config.js';
import { erc20Abi } from '../abi/erc20.js';

export class TakerOrders extends ViewOrders {
    constructor() {
        super('taker-orders');
        this.isInitializing = false;  // Add initialization flag
        
        // Initialize debug logger
        this.debug = (message, ...args) => {
            if (isDebugEnabled('TAKER_ORDERS')) {
                console.log('[TakerOrders]', message, ...args);
            }
        };
    }

    async initialize(readOnlyMode = true) {
        if (this.isInitializing) {
            this.debug('Already initializing, skipping...');
            return;
        }

        this.isInitializing = true;

        try {
            this.debug('Initializing TakerOrders component');

            // Clear any existing content first
            this.cleanup();
            
            // Always create the wrapper with status container
            this.container.innerHTML = `
                <div class="tab-content-wrapper">
                    <h2>Orders for Me</h2>
                    <div class="status-container"></div>
                    ${readOnlyMode || !window.walletManager?.provider ? 
                        '<p class="connect-prompt">Connect wallet to view orders targeted to you</p>' :
                        '<div class="orders-table-container"></div>'}
                </div>`;

            if (readOnlyMode || !window.walletManager?.provider) {
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
                        <h2>Orders for Me</h2>
                        <div class="status-container"></div>
                        <p class="connect-prompt">Connect wallet to view orders targeted to you</p>
                    </div>`;
                return;
            }

            // Initialize WebSocket and base functionality from ViewOrders
            await super.initialize(readOnlyMode);

            // Clear existing orders before adding new ones
            this.orders.clear();

            // Get and filter orders for the current taker
            const cachedOrders = window.webSocket?.getOrders() || [];
            const filteredOrders = cachedOrders.filter(order => 
                order?.taker && userAddress && 
                order.taker.toLowerCase() === userAddress.toLowerCase()
            );

            this.debug('Loading filtered orders from cache:', filteredOrders);
            
            // Initialize orders Map with filtered orders
            filteredOrders.forEach(order => {
                this.orders.set(order.id, order);
            });

            // Update view
            await this.refreshOrdersView();

        } catch (error) {
            this.debug('Initialization error:', error);
            this.container.innerHTML = `
                <div class="tab-content-wrapper">
                    <h2>Orders for Me</h2>
                    <div class="status-container"></div>
                    <p class="error-message">Failed to load orders. Please try again later.</p>
                </div>`;
        } finally {
            this.isInitializing = false;
        }
    }

    setupWebSocket() {
        // Use parent's debounced refresh mechanism
        const debouncedRefresh = () => {
            this.debouncedRefresh();
        };

        // Clear existing subscriptions before adding new ones
        this.eventSubscriptions.forEach(sub => {
            window.webSocket.unsubscribe(sub.event, sub.callback);
        });
        this.eventSubscriptions.clear();

        // Subscribe to order sync completion with taker filter
        this.eventSubscriptions.add({
            event: 'orderSyncComplete',
            callback: async (orders) => {
                const userAddress = await window.walletManager.getAccount();
                this.orders.clear();
                
                // Filter orders where user is specifically set as taker
                Object.values(orders)
                    .filter(order => order.taker.toLowerCase() === userAddress.toLowerCase())
                    .forEach(order => {
                        this.orders.set(order.id, order);
                    });
                
                debouncedRefresh();
            }
        });

        // Subscribe to filled/canceled orders
        ['OrderFilled', 'OrderCanceled'].forEach(event => {
            this.eventSubscriptions.add({
                event,
                callback: (order) => {
                    if (this.orders.has(order.id)) {
                        this.debug(`Order ${event.toLowerCase()}:`, order);
                        this.orders.get(order.id).status = event === 'OrderFilled' ? 'Filled' : 'Canceled';
                        debouncedRefresh();
                    }
                }
            });
        });

        // Register all subscriptions
        this.eventSubscriptions.forEach(sub => {
            window.webSocket.subscribe(sub.event, sub.callback);
        });
    }

    async createOrderRow(order, tokenDetailsMap) {
        const tr = await super.createOrderRow(order, tokenDetailsMap);
        
        // Replace the action column with fill button for active orders
        const actionCell = tr.querySelector('.action-column');
        const statusCell = tr.querySelector('.order-status');
        
        if (actionCell && statusCell) {
            try {
                const currentTime = Math.floor(Date.now() / 1000);
                const orderTime = Number(order.timestamp);
                const contract = await this.getContract();
                
                const orderExpiry = await contract.ORDER_EXPIRY();
                const isExpired = currentTime > orderTime + orderExpiry.toNumber();
                
                if (!isExpired && order.status === 'Active') {
                    actionCell.innerHTML = `
                        <button class="fill-button" data-order-id="${order.id}">Fill Order</button>
                    `;
                    
                    // Add click handler for fill button
                    const fillButton = actionCell.querySelector('.fill-button');
                    if (fillButton) {
                        fillButton.addEventListener('click', () => this.fillOrder(order.id));
                    }
                } else {
                    actionCell.innerHTML = '<span class="order-status"></span>';
                }
            } catch (error) {
                console.error('[TakerOrders] Error in createOrderRow:', error);
                actionCell.innerHTML = '<span class="order-status error">Error</span>';
            }
        }

        return tr;
    }

    // Override fillOrder to add specific handling for taker orders
    async fillOrder(orderId) {
        const button = this.container.querySelector(`button[data-order-id="${orderId}"]`);
        try {
            if (button) {
                button.disabled = true;
                button.textContent = 'Filling...';
            }

            const order = this.orders.get(Number(orderId));
            if (!order) {
                throw new Error(`Order ${orderId} not found`);
            }
            this.debug('Order details:', order);

            // Get contract and connect to signer
            const contract = await this.getContract();
            const signer = window.walletManager.provider.getSigner();
            const contractWithSigner = contract.connect(signer);

            // Use ERC20 ABI for token contract with signer
            const buyToken = new ethers.Contract(
                order.buyToken,
                erc20Abi,
                window.walletManager.provider
            ).connect(signer);
            
            const userAddress = await window.walletManager.getAccount();
            const balance = await buyToken.balanceOf(userAddress);
            this.debug('Current balance:', balance.toString());
            this.debug('Required amount:', order.buyAmount.toString());

            if (balance.lt(order.buyAmount)) {
                throw new Error(`Insufficient token balance. Have ${ethers.utils.formatEther(balance)}, need ${ethers.utils.formatEther(order.buyAmount)}`);
            }

            // Check allowance using ERC20 contract
            const allowance = await buyToken.allowance(userAddress, contractWithSigner.address);
            this.debug('Current allowance:', allowance.toString());

            if (allowance.lt(order.buyAmount)) {
                this.showStatus('Token approval required...');
                
                try {
                    const approveTx = await buyToken.approve(
                        contractWithSigner.address,
                        order.buyAmount,
                        {
                            gasLimit: 70000,
                            gasPrice: await window.walletManager.provider.getGasPrice()
                        }
                    );
                    
                    this.debug('Approval transaction sent:', approveTx.hash);
                    this.showStatus('Waiting for approval confirmation...');
                    
                    try {
                        await approveTx.wait();
                        this.showSuccess('Token approval confirmed');
                    } catch (waitError) {
                        if (waitError.code === 'TRANSACTION_REPLACED') {
                            if (waitError.cancelled) {
                                throw new Error('Approval transaction was cancelled');
                            } else {
                                this.debug('Approval transaction was sped up:', waitError.replacement.hash);
                                if (waitError.receipt.status === 1) {
                                    this.debug('Replacement approval transaction successful');
                                    this.showSuccess('Token approval confirmed');
                                } else {
                                    throw new Error('Replacement approval transaction failed');
                                }
                            }
                        } else {
                            throw waitError;
                        }
                    }
                } catch (error) {
                    if (error.code === 4001) {
                        this.showError('Token approval was rejected');
                        return;
                    }
                    throw error;
                }
            }

            // Estimate gas for filling the order
            let gasLimit;
            try {
                this.showStatus('Estimating transaction cost...');
                await contractWithSigner.callStatic.fillOrder(orderId);
                const gasEstimate = await contractWithSigner.estimateGas.fillOrder(orderId);
                gasLimit = gasEstimate.mul(120).div(100);
                this.debug('Gas estimate with buffer:', gasLimit.toString());
            } catch (error) {
                this.debug('Gas estimation failed:', error);
                gasLimit = ethers.BigNumber.from(300000);
                this.debug('Using fallback gas limit:', gasLimit.toString());
            }

            // Fill order with estimated gas limit using signed contract
            this.showStatus('Please confirm the transaction...');
            const tx = await contractWithSigner.fillOrder(orderId, {
                gasLimit,
                gasPrice: await window.walletManager.provider.getGasPrice()
            });
            
            this.debug('Fill order transaction sent:', tx.hash);
            this.showStatus('Waiting for transaction confirmation...');
            
            try {
                const receipt = await tx.wait();
                this.debug('Transaction receipt:', receipt);

                if (receipt.status === 0) {
                    throw new Error('Transaction reverted by contract');
                }

                this.showSuccess('Order filled successfully!');
                await this.refreshOrdersView();
            } catch (waitError) {
                if (waitError.code === 'TRANSACTION_REPLACED') {
                    if (waitError.cancelled) {
                        throw new Error('Fill order transaction was cancelled');
                    } else {
                        this.debug('Fill order transaction was sped up:', waitError.replacement.hash);
                        if (waitError.receipt.status === 1) {
                            this.debug('Replacement fill transaction successful');
                            this.showSuccess('Order filled successfully!');
                            await this.refreshOrdersView();
                            return;
                        } else {
                            throw new Error('Replacement fill transaction failed');
                        }
                    }
                } else {
                    throw waitError;
                }
            }

        } catch (error) {
            this.debug('Fill order error details:', error);
            this.showError(this.getReadableError(error));
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = 'Fill Order';
            }
        }
    }

    async refreshOrdersView() {
        try {
            // Get contract instance first
            this.contract = await this.getContract();
            if (!this.contract) {
                throw new Error('Contract not initialized');
            }

            // Get current account
            const userAddress = await window.walletManager.getAccount();
            if (!userAddress) {
                throw new Error('No wallet connected');
            }

            // Clear existing orders from table
            const tbody = this.container.querySelector('tbody');
            if (!tbody) {
                console.warn('[TakerOrders] Table body not found');
                return;
            }
            tbody.innerHTML = '';

            // Get ALL orders from WebSocket cache without filtering
            const allOrders = window.webSocket?.getOrders() || [];
            
            // Filter orders only by taker address
            let ordersToDisplay = allOrders.filter(order => 
                order?.taker && 
                order.taker.toLowerCase() === userAddress.toLowerCase()
            );

            // Check if we should filter for fillable orders
            const showOnlyFillable = this.container.querySelector('#fillable-orders-toggle')?.checked;
            if (showOnlyFillable) {
                // Filter for fillable orders
                const fillableChecks = await Promise.all(
                    ordersToDisplay.map(async order => {
                        const canFill = await this.canFillOrder(order);
                        return canFill ? order : null;
                    })
                );
                ordersToDisplay = fillableChecks.filter(order => order !== null);
            }

            // Get token details for display
            const tokenAddresses = new Set();
            ordersToDisplay.forEach(order => {
                if (order?.sellToken) tokenAddresses.add(order.sellToken.toLowerCase());
                if (order?.buyToken) tokenAddresses.add(order.buyToken.toLowerCase());
            });

            const tokenDetails = await this.getTokenDetails(Array.from(tokenAddresses));
            const tokenDetailsMap = new Map();
            Array.from(tokenAddresses).forEach((address, index) => {
                if (tokenDetails[index]) {
                    tokenDetailsMap.set(address, tokenDetails[index]);
                }
            });

            // Check if we have any orders after filtering
            if (!ordersToDisplay.length) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="no-orders-message">
                            <div class="placeholder-text">
                                No orders found for you
                            </div>
                        </td>
                    </tr>`;
                return;
            }

            // Create and append order rows
            for (const order of ordersToDisplay) {
                try {
                    const orderWithLowercase = {
                        ...order,
                        sellToken: order.sellToken.toLowerCase(),
                        buyToken: order.buyToken.toLowerCase()
                    };
                    const row = await this.createOrderRow(orderWithLowercase, tokenDetailsMap);
                    if (row) {
                        tbody.appendChild(row);
                    }
                } catch (error) {
                    console.error('[TakerOrders] Error creating row for order:', order.id, error);
                }
            }

        } catch (error) {
            this.debug('Error refreshing orders view:', error);
            throw error;
        }
    }

    // Override setupTable to customize for taker orders
    async setupTable() {
        // Call parent's setupTable first
        await super.setupTable();
        
        // Customize the table header for taker orders
        const thead = this.container.querySelector('thead tr');
        if (thead) {
            thead.innerHTML = `
                <th data-sort="id">ID <span class="sort-icon">↕</span></th>
                <th data-sort="buy">Buy <span class="sort-icon">↕</span></th>
                <th>Amount</th>
                <th data-sort="sell">Sell <span class="sort-icon">↕</span></th>
                <th>Amount</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Action</th>
            `;
        }

        // Remove the "Show only fillable orders" toggle since all orders are for this taker
        const filterToggle = this.container.querySelector('.filter-toggle');
        if (filterToggle) {
            filterToggle.remove();
        }
    }

    // Override handleSort to use parent's debouncedRefresh
    handleSort(column) {
        this.debug('Sorting by column:', column);
        
        if (this.sortConfig.column === column) {
            this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortConfig.column = column;
            this.sortConfig.direction = 'asc';
        }

        const headers = this.container.querySelectorAll('th[data-sort]');
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

    // Helper method to get or create status container
    getStatusContainer() {
        this.debug('Getting status container');
        let statusContainer = this.container.querySelector('.status-container');
        if (!statusContainer) {
            this.debug('Creating new status container');
            statusContainer = document.createElement('div');
            statusContainer.className = 'status-container';
            
            // Insert it after the h2 but before the table
            const h2 = this.container.querySelector('h2');
            if (h2) {
                h2.insertAdjacentElement('afterend', statusContainer);
            } else {
                this.debug('No h2 found, appending to tab-content-wrapper');
                const wrapper = this.container.querySelector('.tab-content-wrapper');
                if (wrapper) {
                    wrapper.insertBefore(statusContainer, wrapper.firstChild);
                }
            }
        }
        return statusContainer;
    }

    // Override parent class methods to use our status container
    showStatus(message) {
        this.debug('Showing status:', message);
        const statusContainer = this.getStatusContainer();
        let statusElement = statusContainer.querySelector('.status-message');
        if (!statusElement) {
            this.debug('Creating new status element');
            statusElement = document.createElement('div');
            statusElement.className = 'status-message';
            statusContainer.appendChild(statusElement);
        }
        
        statusElement.textContent = message;
        statusElement.className = 'status-message status-pending';
        this.debug('Status element updated:', statusElement.outerHTML);
    }

    showError(message) {
        this.debug('Showing error:', message);
        const statusContainer = this.getStatusContainer();
        let statusElement = statusContainer.querySelector('.status-message');
        if (!statusElement) {
            this.debug('Creating new status element');
            statusElement = document.createElement('div');
            statusElement.className = 'status-message';
            statusContainer.appendChild(statusElement);
        }
        
        statusElement.textContent = message;
        statusElement.className = 'status-message status-error';
        this.debug('Status element updated:', statusElement.outerHTML);
    }

    showSuccess(message) {
        this.debug('Showing success:', message);
        const statusContainer = this.getStatusContainer();
        let statusElement = statusContainer.querySelector('.status-message');
        if (!statusElement) {
            this.debug('Creating new status element');
            statusElement = document.createElement('div');
            statusElement.className = 'status-message';
            statusContainer.appendChild(statusElement);
        }
        
        statusElement.textContent = message;
        statusElement.className = 'status-message status-success';
        this.debug('Status element updated:', statusElement.outerHTML);
    }
}
