import { ViewOrders } from './ViewOrders.js';
import { ethers } from 'ethers';
import { isDebugEnabled } from '../config.js';
import { erc20Abi } from '../abi/erc20.js';

export class TakerOrders extends ViewOrders {
    constructor() {
        super('taker-orders');
        this.isProcessingFill = false;
        
        // Initialize debug logger with TAKER_ORDERS flag
        this.debug = (message, ...args) => {
            if (isDebugEnabled('TAKER_ORDERS')) {
                console.log('[TakerOrders]', message, ...args);
            }
        };
    }

    async refreshOrdersView() {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            this.debug('Refreshing taker orders view');
            
            // Get current user address
            const userAddress = await window.walletManager.getAccount();
            if (!userAddress) {
                throw new Error('No wallet connected');
            }

            // Get all orders and filter for taker
            let ordersToDisplay = Array.from(this.orders.values())
                .filter(order => 
                    order?.taker && 
                    order.taker.toLowerCase() === userAddress.toLowerCase()
                );

            // Get filter state
            const showOnlyActive = this.container.querySelector('#fillable-orders-toggle')?.checked ?? true;
            const pageSize = parseInt(this.container.querySelector('#page-size-select')?.value || '25');

            // Filter active orders if needed
            if (showOnlyActive) {
                ordersToDisplay = await Promise.all(ordersToDisplay.map(async order => {
                    const canFill = await this.canFillOrder(order);
                    const expiryTime = Number(order.timestamp) + this.contractValues.orderExpiry;
                    return {
                        order,
                        canFill,
                        isExpired: Math.floor(Date.now() / 1000) >= expiryTime
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

            // Display orders
            const tbody = this.container.querySelector('tbody');
            if (!tbody) {
                this.debug('ERROR: tbody not found');
                return;
            }
            tbody.innerHTML = '';

            for (const order of paginatedOrders) {
                const newRow = await this.createOrderRow(order);
                if (newRow) {
                    tbody.appendChild(newRow);
                }
            }

            // Update pagination controls
            this.updatePaginationControls(ordersToDisplay.length);

            if (ordersToDisplay.length === 0) {
                tbody.innerHTML = `
                    <tr class="empty-message">
                        <td colspan="8" class="no-orders-message">
                            <div class="placeholder-text">
                                ${showOnlyActive ? 
                                    'No fillable orders available for you' : 
                                    'No orders found for you'}
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

    // Override setupWebSocket to filter for taker events
    setupWebSocket() {
        super.setupWebSocket();

        // Add taker-specific event handling
        this.eventSubscriptions.add({
            event: 'orderSyncComplete',
            callback: async (orders) => {
                if (this.isProcessingFill) return;
                
                const userAddress = await window.walletManager.getAccount();
                this.orders.clear();
                
                Object.values(orders)
                    .filter(order => 
                        order.taker.toLowerCase() === userAddress.toLowerCase()
                    )
                    .forEach(order => {
                        this.orders.set(order.id, order);
                    });
                
                await this.refreshOrdersView();
            }
        });
    }

    // Override setupTable to customize headers and controls
    async setupTable() {
        await super.setupTable();
        
        // Customize table header for taker view
        const thead = this.container.querySelector('thead tr');
        if (thead) {
            thead.innerHTML = `
                <th>ID</th>
                <th>Buy</th>
                <th>Amount</th>
                <th>Sell</th>
                <th>Amount</th>
                <th>Deal</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Action</th>
            `;
        }
    }
}
