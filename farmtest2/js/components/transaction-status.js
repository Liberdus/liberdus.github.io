/**
 * TransactionStatusDisplay - Real-time transaction status tracking component
 * Provides comprehensive transaction monitoring with progress indicators and user feedback
 * 
 * Features:
 * - Real-time transaction status updates
 * - Progress indicators for multi-step transactions
 * - Block explorer integration
 * - Error handling and retry mechanisms
 * - Mobile-responsive design
 */
(function(global) {
    'use strict';

    // Prevent redeclaration
    if (global.TransactionStatusDisplay) {
        console.warn('TransactionStatusDisplay class already exists, skipping redeclaration');
        return;
    }

    class TransactionStatusDisplay {
        constructor() {
            this.activeTransactions = new Map();
            this.container = null;
            this.isInitialized = false;
            
            // Transaction status types
            this.STATUS = {
                PENDING: 'pending',
                CONFIRMING: 'confirming',
                CONFIRMED: 'confirmed',
                FAILED: 'failed',
                CANCELLED: 'cancelled'
            };

            // Block explorer configuration
            this.blockExplorer = {
                baseUrl: 'https://amoy.polygonscan.com',
                txPath: '/tx/',
                addressPath: '/address/'
            };

            this.log('TransactionStatusDisplay initialized');
        }

        /**
         * Initialize the transaction status display
         */
        initialize() {
            try {
                this.createContainer();
                this.setupEventListeners();
                this.isInitialized = true;
                this.log('TransactionStatusDisplay initialized successfully');
                return true;
            } catch (error) {
                this.logError('Failed to initialize TransactionStatusDisplay:', error);
                return false;
            }
        }

        /**
         * Create the main container for transaction status displays
         */
        createContainer() {
            // Remove existing container if present
            const existingContainer = document.getElementById('transaction-status-container');
            if (existingContainer) {
                existingContainer.remove();
            }

            // Create new container
            this.container = document.createElement('div');
            this.container.id = 'transaction-status-container';
            this.container.className = 'transaction-status-container';
            this.container.innerHTML = `
                <div class="transaction-status-header">
                    <h3>Transaction Status</h3>
                    <button class="close-btn" onclick="this.parentElement.parentElement.style.display='none'">×</button>
                </div>
                <div class="transaction-status-list" id="transaction-status-list">
                    <!-- Transaction items will be added here -->
                </div>
            `;

            // Add styles
            this.addStyles();

            // Append to body
            document.body.appendChild(this.container);
            
            // Initially hidden
            this.container.style.display = 'none';
        }

        /**
         * Add CSS styles for transaction status display
         */
        addStyles() {
            const styleId = 'transaction-status-styles';
            if (document.getElementById(styleId)) return;

            const styles = document.createElement('style');
            styles.id = styleId;
            styles.textContent = `
                .transaction-status-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    width: 400px;
                    max-width: 90vw;
                    background: var(--bg-primary, #ffffff);
                    border: 1px solid var(--border-color, #e0e0e0);
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                    z-index: 10000;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }

                .transaction-status-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--border-color, #e0e0e0);
                    background: var(--bg-secondary, #f8f9fa);
                    border-radius: 12px 12px 0 0;
                }

                .transaction-status-header h3 {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                    color: var(--text-primary, #333333);
                }

                .transaction-status-header .close-btn {
                    background: none;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    color: var(--text-secondary, #666666);
                    padding: 0;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .transaction-status-list {
                    max-height: 400px;
                    overflow-y: auto;
                    padding: 0;
                }

                .transaction-item {
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--border-color, #e0e0e0);
                    transition: background-color 0.2s ease;
                }

                .transaction-item:last-child {
                    border-bottom: none;
                }

                .transaction-item:hover {
                    background: var(--bg-hover, #f5f5f5);
                }

                .transaction-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }

                .transaction-type {
                    font-weight: 600;
                    font-size: 14px;
                    color: var(--text-primary, #333333);
                }

                .transaction-status {
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 500;
                    text-transform: uppercase;
                }

                .transaction-status.pending {
                    background: rgba(255, 152, 0, 0.1);
                    color: var(--warning-main, #ff9800);
                    border: 1px solid var(--warning-main, #ff9800);
                }

                .transaction-status.confirming {
                    background: rgba(33, 150, 243, 0.1);
                    color: var(--info-main, #2196f3);
                    border: 1px solid var(--info-main, #2196f3);
                }

                .transaction-status.confirmed {
                    background: rgba(76, 175, 80, 0.1);
                    color: var(--success-main, #4caf50);
                    border: 1px solid var(--success-main, #4caf50);
                }

                .transaction-status.failed {
                    background: rgba(244, 67, 54, 0.1);
                    color: var(--error-main, #f44336);
                    border: 1px solid var(--error-main, #f44336);
                }

                .transaction-status.cancelled {
                    background: rgba(158, 158, 158, 0.1);
                    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
                    border: 1px solid var(--divider, rgba(255, 255, 255, 0.12));
                }

                .transaction-details {
                    font-size: 12px;
                    color: var(--text-secondary, #666666);
                    margin-bottom: 8px;
                }

                .transaction-progress {
                    width: 100%;
                    height: 4px;
                    background: var(--bg-secondary, #f0f0f0);
                    border-radius: 2px;
                    overflow: hidden;
                    margin-bottom: 8px;
                }

                .transaction-progress-bar {
                    height: 100%;
                    background: var(--primary-color, #007bff);
                    border-radius: 2px;
                    transition: width 0.3s ease;
                }

                .transaction-actions {
                    display: flex;
                    gap: 8px;
                    margin-top: 8px;
                }

                .transaction-action-btn {
                    padding: 4px 8px;
                    border: 1px solid var(--border-color, #e0e0e0);
                    background: var(--bg-primary, #ffffff);
                    color: var(--text-primary, #333333);
                    border-radius: 4px;
                    font-size: 11px;
                    cursor: pointer;
                    text-decoration: none;
                    transition: all 0.2s ease;
                }

                .transaction-action-btn:hover {
                    background: var(--bg-hover, #f5f5f5);
                    border-color: var(--primary-color, #007bff);
                }

                .transaction-hash {
                    font-family: 'Courier New', monospace;
                    font-size: 11px;
                    word-break: break-all;
                }

                @media (max-width: 768px) {
                    .transaction-status-container {
                        width: 100%;
                        max-width: calc(100vw - 20px);
                        top: 10px;
                        right: 10px;
                        left: 10px;
                    }
                }
            `;

            document.head.appendChild(styles);
        }

        /**
         * Setup event listeners
         */
        setupEventListeners() {
            // Listen for transaction events from EventManager
            if (window.eventManager) {
                window.eventManager.on('transaction:started', (data) => {
                    this.addTransaction(data);
                });

                window.eventManager.on('transaction:updated', (data) => {
                    this.updateTransaction(data.id, data);
                });

                window.eventManager.on('transaction:completed', (data) => {
                    this.updateTransaction(data.id, { status: this.STATUS.CONFIRMED, ...data });
                });

                window.eventManager.on('transaction:failed', (data) => {
                    this.updateTransaction(data.id, { status: this.STATUS.FAILED, ...data });
                });
            }
        }

        /**
         * Add a new transaction to the display
         */
        addTransaction(transactionData) {
            try {
                const {
                    id,
                    type,
                    hash,
                    status = this.STATUS.PENDING,
                    amount,
                    token,
                    gasEstimate
                } = transactionData;

                // Store transaction data
                this.activeTransactions.set(id, {
                    ...transactionData,
                    startTime: Date.now(),
                    progress: 0
                });

                // Create transaction item element
                const transactionItem = this.createTransactionItem(transactionData);
                
                // Add to list
                const list = document.getElementById('transaction-status-list');
                list.insertBefore(transactionItem, list.firstChild);

                // Show container
                this.container.style.display = 'block';

                // Start monitoring if hash is available
                if (hash) {
                    this.monitorTransaction(id, hash);
                }

                this.log('Transaction added:', id, type);
            } catch (error) {
                this.logError('Failed to add transaction:', error);
            }
        }

        /**
         * Create transaction item HTML element
         */
        createTransactionItem(data) {
            const {
                id,
                type,
                hash,
                status,
                amount,
                token,
                gasEstimate
            } = data;

            const item = document.createElement('div');
            item.className = 'transaction-item';
            item.id = `transaction-${id}`;

            const statusText = status.charAt(0).toUpperCase() + status.slice(1);
            const progress = this.getProgressForStatus(status);

            item.innerHTML = `
                <div class="transaction-header">
                    <div class="transaction-type">${this.formatTransactionType(type)}</div>
                    <div class="transaction-status ${status}">${statusText}</div>
                </div>
                
                ${amount && token ? `
                    <div class="transaction-details">
                        Amount: ${amount} ${token}
                    </div>
                ` : ''}
                
                ${gasEstimate ? `
                    <div class="transaction-details">
                        Gas: ${gasEstimate.gasPriceGwei} gwei • Est. Cost: ${gasEstimate.estimatedCostEth} ETH
                    </div>
                ` : ''}
                
                <div class="transaction-progress">
                    <div class="transaction-progress-bar" style="width: ${progress}%"></div>
                </div>
                
                ${hash ? `
                    <div class="transaction-details">
                        <div class="transaction-hash">Hash: ${hash.slice(0, 10)}...${hash.slice(-8)}</div>
                    </div>
                    
                    <div class="transaction-actions">
                        <a href="${this.blockExplorer.baseUrl}${this.blockExplorer.txPath}${hash}" 
                           target="_blank" 
                           class="transaction-action-btn">
                            View on Explorer
                        </a>
                    </div>
                ` : ''}
            `;

            return item;
        }

        /**
         * Update existing transaction
         */
        updateTransaction(id, updateData) {
            try {
                const transaction = this.activeTransactions.get(id);
                if (!transaction) {
                    this.log('Transaction not found for update:', id);
                    return;
                }

                // Update stored data
                const updatedTransaction = { ...transaction, ...updateData };
                this.activeTransactions.set(id, updatedTransaction);

                // Update DOM element
                const element = document.getElementById(`transaction-${id}`);
                if (element) {
                    const newElement = this.createTransactionItem(updatedTransaction);
                    element.replaceWith(newElement);
                }

                // Remove completed transactions after delay
                if (updateData.status === this.STATUS.CONFIRMED || updateData.status === this.STATUS.FAILED) {
                    setTimeout(() => {
                        this.removeTransaction(id);
                    }, 10000); // Remove after 10 seconds
                }

                this.log('Transaction updated:', id, updateData.status);
            } catch (error) {
                this.logError('Failed to update transaction:', error);
            }
        }

        /**
         * Remove transaction from display
         */
        removeTransaction(id) {
            try {
                const element = document.getElementById(`transaction-${id}`);
                if (element) {
                    element.remove();
                }

                this.activeTransactions.delete(id);

                // Hide container if no active transactions
                if (this.activeTransactions.size === 0) {
                    this.container.style.display = 'none';
                }

                this.log('Transaction removed:', id);
            } catch (error) {
                this.logError('Failed to remove transaction:', error);
            }
        }

        /**
         * Monitor transaction confirmation
         */
        async monitorTransaction(id, hash) {
            try {
                if (!window.contractManager?.provider) {
                    this.log('No provider available for transaction monitoring');
                    return;
                }

                const provider = window.contractManager.provider;
                let confirmations = 0;
                const requiredConfirmations = 3;

                // Update status to confirming
                this.updateTransaction(id, { 
                    status: this.STATUS.CONFIRMING,
                    confirmations: 0,
                    requiredConfirmations
                });

                // Wait for transaction receipt
                const receipt = await provider.waitForTransaction(hash, requiredConfirmations);

                if (receipt.status === 1) {
                    // Transaction successful
                    this.updateTransaction(id, {
                        status: this.STATUS.CONFIRMED,
                        confirmations: requiredConfirmations,
                        blockNumber: receipt.blockNumber,
                        gasUsed: receipt.gasUsed.toString()
                    });
                } else {
                    // Transaction failed
                    this.updateTransaction(id, {
                        status: this.STATUS.FAILED,
                        error: 'Transaction reverted'
                    });
                }
            } catch (error) {
                this.logError('Transaction monitoring failed:', error);
                this.updateTransaction(id, {
                    status: this.STATUS.FAILED,
                    error: error.message
                });
            }
        }

        /**
         * Get progress percentage for status
         */
        getProgressForStatus(status) {
            switch (status) {
                case this.STATUS.PENDING: return 25;
                case this.STATUS.CONFIRMING: return 75;
                case this.STATUS.CONFIRMED: return 100;
                case this.STATUS.FAILED: return 100;
                case this.STATUS.CANCELLED: return 0;
                default: return 0;
            }
        }

        /**
         * Format transaction type for display
         */
        formatTransactionType(type) {
            const typeMap = {
                'approve': 'Token Approval',
                'stake': 'Stake Tokens',
                'unstake': 'Unstake Tokens',
                'claim': 'Claim Rewards',
                'transfer': 'Transfer Tokens'
            };

            return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
        }

        /**
         * Clear all transactions
         */
        clearAll() {
            this.activeTransactions.clear();
            const list = document.getElementById('transaction-status-list');
            if (list) {
                list.innerHTML = '';
            }
            this.container.style.display = 'none';
            this.log('All transactions cleared');
        }

        /**
         * Get active transaction count
         */
        getActiveTransactionCount() {
            return this.activeTransactions.size;
        }

        /**
         * Logging utility
         */
        log(...args) {
            if (window.CONFIG?.DEV?.DEBUG_MODE) {
                console.log('[TransactionStatusDisplay]', ...args);
            }
        }

        /**
         * Error logging utility
         */
        logError(...args) {
            console.error('[TransactionStatusDisplay]', ...args);
        }
    }

    // Export to global scope
    global.TransactionStatusDisplay = TransactionStatusDisplay;
    console.log('✅ TransactionStatusDisplay class loaded');

})(window);
