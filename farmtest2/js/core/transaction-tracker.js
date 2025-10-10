/**
 * TransactionTracker - Comprehensive transaction status tracking system
 * Provides real-time transaction monitoring, status updates, and user feedback
 * Eliminates missing transaction status tracking functionality
 */
(function(global) {
    'use strict';

    // Prevent redeclaration
    if (global.TransactionTracker) {
        console.warn('TransactionTracker class already exists, skipping redeclaration');
        return;
    }

    class TransactionTracker {
        constructor() {
            this.transactions = new Map();
            this.subscribers = new Map();
            this.isInitialized = false;
            this.notificationManager = null;
            this.stateManager = null;
            
            // Transaction statuses
            this.statuses = {
                PENDING: 'pending',
                CONFIRMING: 'confirming',
                CONFIRMED: 'confirmed',
                FAILED: 'failed',
                CANCELLED: 'cancelled'
            };
            
            // Transaction types
            this.types = {
                APPROVE: 'approve',
                STAKE: 'stake',
                UNSTAKE: 'unstake',
                CLAIM: 'claim',
                TRANSFER: 'transfer'
            };
            
            this.log('TransactionTracker created - ready for comprehensive transaction monitoring');
        }

        /**
         * Initialize the transaction tracker
         */
        async initialize() {
            if (this.isInitialized) {
                this.log('TransactionTracker already initialized');
                return true;
            }

            try {
                // Wait for dependencies
                await this.waitForDependencies();
                
                // Setup transaction monitoring
                this.setupTransactionMonitoring();
                
                this.isInitialized = true;
                this.log('✅ TransactionTracker initialized successfully');
                return true;
                
            } catch (error) {
                this.log('❌ TransactionTracker initialization failed:', error);
                return false;
            }
        }

        /**
         * Wait for required dependencies
         */
        async waitForDependencies() {
            const maxWait = 10000; // 10 seconds
            const startTime = Date.now();
            
            while (Date.now() - startTime < maxWait) {
                if (global.notificationManager && global.stateManager) {
                    this.notificationManager = global.notificationManager;
                    this.stateManager = global.stateManager;
                    this.log('Dependencies found');
                    return;
                }
                
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Continue without dependencies if not found
            this.log('⚠️ Some dependencies not found, continuing with limited functionality');
        }

        /**
         * Setup transaction monitoring
         */
        setupTransactionMonitoring() {
            this.log('Setting up transaction monitoring...');
            
            // Monitor for new blocks to check transaction confirmations
            if (global.contractManager && global.contractManager.provider) {
                global.contractManager.provider.on('block', (blockNumber) => {
                    this.checkPendingTransactions(blockNumber);
                });
            }
            
            this.log('Transaction monitoring setup complete');
        }

        /**
         * Track a new transaction
         */
        trackTransaction(txHash, type, details = {}) {
            const transaction = {
                hash: txHash,
                type: type,
                status: this.statuses.PENDING,
                timestamp: Date.now(),
                confirmations: 0,
                requiredConfirmations: details.requiredConfirmations || 3,
                gasUsed: null,
                gasPrice: null,
                blockNumber: null,
                details: details,
                error: null
            };
            
            this.transactions.set(txHash, transaction);
            
            // Update state
            if (this.stateManager) {
                this.stateManager.setState(`transactions.${txHash}`, transaction);
            }
            
            // Show initial notification
            if (this.notificationManager) {
                this.notificationManager.loading(
                    `${this.getTypeDisplayName(type)} transaction submitted`,
                    {
                        title: 'Transaction Pending',
                        duration: 0, // Persistent until updated
                        id: `tx-${txHash}`
                    }
                );
            }
            
            // Start monitoring this transaction
            this.monitorTransaction(txHash);
            
            // Notify subscribers
            this.notifySubscribers('transactionAdded', transaction);
            
            this.log(`Started tracking transaction: ${txHash} (${type})`);
            return transaction;
        }

        /**
         * Monitor a specific transaction
         */
        async monitorTransaction(txHash) {
            const transaction = this.transactions.get(txHash);
            if (!transaction) return;
            
            try {
                // Get transaction receipt
                const provider = global.contractManager?.provider;
                if (!provider) {
                    this.log('No provider available for transaction monitoring');
                    return;
                }
                
                const receipt = await provider.getTransactionReceipt(txHash);
                
                if (receipt) {
                    // Transaction is mined
                    this.updateTransactionStatus(txHash, {
                        status: receipt.status === 1 ? this.statuses.CONFIRMING : this.statuses.FAILED,
                        blockNumber: receipt.blockNumber,
                        gasUsed: receipt.gasUsed?.toString(),
                        confirmations: 1
                    });
                    
                    if (receipt.status === 0) {
                        // Transaction failed
                        this.handleTransactionFailure(txHash, 'Transaction reverted');
                    }
                } else {
                    // Transaction still pending
                    setTimeout(() => this.monitorTransaction(txHash), 5000); // Check again in 5 seconds
                }
                
            } catch (error) {
                this.log(`Error monitoring transaction ${txHash}:`, error);
                
                // Retry monitoring
                setTimeout(() => this.monitorTransaction(txHash), 10000); // Retry in 10 seconds
            }
        }

        /**
         * Check pending transactions for confirmations
         */
        async checkPendingTransactions(currentBlockNumber) {
            const pendingTxs = Array.from(this.transactions.values())
                .filter(tx => tx.status === this.statuses.CONFIRMING && tx.blockNumber);
            
            for (const tx of pendingTxs) {
                const confirmations = currentBlockNumber - tx.blockNumber + 1;
                
                if (confirmations >= tx.requiredConfirmations) {
                    // Transaction is confirmed
                    this.updateTransactionStatus(tx.hash, {
                        status: this.statuses.CONFIRMED,
                        confirmations: confirmations
                    });
                    
                    this.handleTransactionSuccess(tx.hash);
                } else {
                    // Update confirmation count
                    this.updateTransactionStatus(tx.hash, {
                        confirmations: confirmations
                    });
                }
            }
        }

        /**
         * Update transaction status
         */
        updateTransactionStatus(txHash, updates) {
            const transaction = this.transactions.get(txHash);
            if (!transaction) return;
            
            // Apply updates
            Object.assign(transaction, updates);
            transaction.lastUpdated = Date.now();
            
            // Update state
            if (this.stateManager) {
                this.stateManager.setState(`transactions.${txHash}`, transaction);
            }
            
            // Update notification
            this.updateTransactionNotification(transaction);
            
            // Notify subscribers
            this.notifySubscribers('transactionUpdated', transaction);
            
            this.log(`Transaction ${txHash} updated:`, updates);
        }

        /**
         * Handle transaction success
         */
        handleTransactionSuccess(txHash) {
            const transaction = this.transactions.get(txHash);
            if (!transaction) return;
            
            // Show success notification
            if (this.notificationManager) {
                this.notificationManager.success(
                    `${this.getTypeDisplayName(transaction.type)} completed successfully!`,
                    {
                        title: 'Transaction Confirmed',
                        duration: 5000,
                        id: `tx-${txHash}`
                    }
                );
            }
            
            // Notify subscribers
            this.notifySubscribers('transactionSuccess', transaction);
            
            this.log(`Transaction ${txHash} completed successfully`);
        }

        /**
         * Handle transaction failure
         */
        handleTransactionFailure(txHash, error) {
            const transaction = this.transactions.get(txHash);
            if (!transaction) return;
            
            // Update transaction with error
            this.updateTransactionStatus(txHash, {
                status: this.statuses.FAILED,
                error: error
            });
            
            // Show error notification
            if (this.notificationManager) {
                this.notificationManager.error(
                    `${this.getTypeDisplayName(transaction.type)} failed: ${error}`,
                    {
                        title: 'Transaction Failed',
                        duration: 0, // Persistent
                        id: `tx-${txHash}`
                    }
                );
            }
            
            // Notify subscribers
            this.notifySubscribers('transactionFailure', transaction);
            
            this.log(`Transaction ${txHash} failed:`, error);
        }

        /**
         * Update transaction notification
         */
        updateTransactionNotification(transaction) {
            if (!this.notificationManager) return;
            
            const notificationId = `tx-${transaction.hash}`;
            
            switch (transaction.status) {
                case this.statuses.CONFIRMING:
                    this.notificationManager.info(
                        `${this.getTypeDisplayName(transaction.type)} confirming... (${transaction.confirmations}/${transaction.requiredConfirmations})`,
                        {
                            title: 'Transaction Confirming',
                            duration: 0,
                            id: notificationId
                        }
                    );
                    break;
                    
                case this.statuses.CONFIRMED:
                    // Success notification is handled in handleTransactionSuccess
                    break;
                    
                case this.statuses.FAILED:
                    // Error notification is handled in handleTransactionFailure
                    break;
            }
        }

        /**
         * Get display name for transaction type
         */
        getTypeDisplayName(type) {
            const displayNames = {
                [this.types.APPROVE]: 'Token Approval',
                [this.types.STAKE]: 'Staking',
                [this.types.UNSTAKE]: 'Unstaking',
                [this.types.CLAIM]: 'Reward Claim',
                [this.types.TRANSFER]: 'Transfer'
            };
            
            return displayNames[type] || type;
        }

        /**
         * Get transaction by hash
         */
        getTransaction(txHash) {
            return this.transactions.get(txHash);
        }

        /**
         * Get all transactions
         */
        getAllTransactions() {
            return Array.from(this.transactions.values());
        }

        /**
         * Get transactions by type
         */
        getTransactionsByType(type) {
            return Array.from(this.transactions.values())
                .filter(tx => tx.type === type);
        }

        /**
         * Get transactions by status
         */
        getTransactionsByStatus(status) {
            return Array.from(this.transactions.values())
                .filter(tx => tx.status === status);
        }

        /**
         * Subscribe to transaction events
         */
        subscribe(event, callback) {
            if (!this.subscribers.has(event)) {
                this.subscribers.set(event, new Set());
            }
            
            this.subscribers.get(event).add(callback);
            
            // Return unsubscribe function
            return () => {
                const eventSubscribers = this.subscribers.get(event);
                if (eventSubscribers) {
                    eventSubscribers.delete(callback);
                }
            };
        }

        /**
         * Notify subscribers
         */
        notifySubscribers(event, data) {
            const eventSubscribers = this.subscribers.get(event);
            if (eventSubscribers) {
                eventSubscribers.forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        this.log(`Error in subscriber callback for ${event}:`, error);
                    }
                });
            }
        }

        /**
         * Clear old transactions
         */
        clearOldTransactions(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
            const now = Date.now();
            const toRemove = [];
            
            this.transactions.forEach((tx, hash) => {
                if (now - tx.timestamp > maxAge && 
                    (tx.status === this.statuses.CONFIRMED || tx.status === this.statuses.FAILED)) {
                    toRemove.push(hash);
                }
            });
            
            toRemove.forEach(hash => {
                this.transactions.delete(hash);
                if (this.stateManager) {
                    this.stateManager.setState(`transactions.${hash}`, null);
                }
            });
            
            if (toRemove.length > 0) {
                this.log(`Cleared ${toRemove.length} old transactions`);
            }
        }

        /**
         * Cleanup
         */
        cleanup() {
            this.transactions.clear();
            this.subscribers.clear();
            this.isInitialized = false;
            this.log('TransactionTracker cleaned up');
        }

        /**
         * Get system health status
         */
        isHealthy() {
            return this.isInitialized;
        }

        /**
         * Logging utility
         */
        log(...args) {
            console.log('[TransactionTracker]', ...args);
        }
    }

    // Export TransactionTracker class
    global.TransactionTracker = TransactionTracker;
    console.log('✅ TransactionTracker class loaded');

})(window);
