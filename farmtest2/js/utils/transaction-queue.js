/**
 * TransactionQueue - Advanced transaction queue management with retry mechanisms
 * Handles transaction sequencing, retry logic, timeout handling, and error recovery
 * 
 * Features:
 * - Sequential transaction processing
 * - Automatic retry with exponential backoff
 * - Timeout handling for stuck transactions
 * - Priority-based queue management
 * - Transaction dependency handling
 * - Comprehensive error recovery
 */
(function(global) {
    'use strict';

    // Prevent redeclaration
    if (global.TransactionQueue) {
        console.warn('TransactionQueue class already exists, skipping redeclaration');
        return;
    }

    class TransactionQueue {
        constructor() {
            this.queue = [];
            this.processing = false;
            this.currentTransaction = null;
            this.transactionHistory = [];
            
            // Configuration
            this.config = {
                maxRetries: 3,
                baseRetryDelay: 2000,      // 2 seconds
                maxRetryDelay: 30000,      // 30 seconds
                transactionTimeout: 300000, // 5 minutes
                maxQueueSize: 50,
                priorityLevels: {
                    HIGH: 3,
                    NORMAL: 2,
                    LOW: 1
                }
            };

            // Transaction states
            this.STATES = {
                QUEUED: 'queued',
                PROCESSING: 'processing',
                PENDING: 'pending',
                CONFIRMING: 'confirming',
                COMPLETED: 'completed',
                FAILED: 'failed',
                CANCELLED: 'cancelled',
                TIMEOUT: 'timeout'
            };

            this.log('TransactionQueue initialized');
        }

        /**
         * Add transaction to queue
         */
        async addTransaction(transactionData) {
            try {
                // Validate transaction data
                if (!transactionData.id || !transactionData.operation) {
                    throw new Error('Transaction must have id and operation');
                }

                // Check queue size limit
                if (this.queue.length >= this.config.maxQueueSize) {
                    throw new Error('Transaction queue is full');
                }

                // Create transaction object
                const transaction = {
                    id: transactionData.id,
                    operation: transactionData.operation,
                    args: transactionData.args || [],
                    priority: transactionData.priority || this.config.priorityLevels.NORMAL,
                    retries: 0,
                    maxRetries: transactionData.maxRetries || this.config.maxRetries,
                    timeout: transactionData.timeout || this.config.transactionTimeout,
                    dependencies: transactionData.dependencies || [],
                    metadata: transactionData.metadata || {},
                    state: this.STATES.QUEUED,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };

                // Add to queue with priority sorting
                this.queue.push(transaction);
                this.sortQueueByPriority();

                this.log('Transaction added to queue:', transaction.id, `Priority: ${transaction.priority}`);

                // Emit event
                this.emitEvent('transaction:queued', transaction);

                // Start processing if not already running
                if (!this.processing) {
                    this.processQueue();
                }

                return transaction.id;
            } catch (error) {
                this.logError('Failed to add transaction to queue:', error);
                throw error;
            }
        }

        /**
         * Process transaction queue
         */
        async processQueue() {
            if (this.processing) {
                this.log('Queue processing already in progress');
                return;
            }

            this.processing = true;
            this.log('Starting queue processing');

            try {
                while (this.queue.length > 0) {
                    const transaction = this.getNextTransaction();
                    
                    if (!transaction) {
                        this.log('No processable transactions in queue');
                        break;
                    }

                    await this.processTransaction(transaction);
                }
            } catch (error) {
                this.logError('Queue processing error:', error);
            } finally {
                this.processing = false;
                this.currentTransaction = null;
                this.log('Queue processing completed');
            }
        }

        /**
         * Get next transaction to process
         */
        getNextTransaction() {
            // Find transaction with highest priority that has no pending dependencies
            for (let i = 0; i < this.queue.length; i++) {
                const transaction = this.queue[i];
                
                if (transaction.state === this.STATES.QUEUED && this.areDependenciesMet(transaction)) {
                    return this.queue.splice(i, 1)[0];
                }
            }

            return null;
        }

        /**
         * Check if transaction dependencies are met
         */
        areDependenciesMet(transaction) {
            if (!transaction.dependencies || transaction.dependencies.length === 0) {
                return true;
            }

            return transaction.dependencies.every(depId => {
                const depTransaction = this.transactionHistory.find(t => t.id === depId);
                return depTransaction && depTransaction.state === this.STATES.COMPLETED;
            });
        }

        /**
         * Process individual transaction
         */
        async processTransaction(transaction) {
            this.currentTransaction = transaction;
            transaction.state = this.STATES.PROCESSING;
            transaction.updatedAt = Date.now();

            this.log('Processing transaction:', transaction.id, transaction.operation);
            this.emitEvent('transaction:processing', transaction);

            try {
                // Set timeout for transaction
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Transaction timeout')), transaction.timeout);
                });

                // Execute transaction with timeout
                const result = await Promise.race([
                    this.executeTransaction(transaction),
                    timeoutPromise
                ]);

                // Transaction completed successfully
                transaction.state = this.STATES.COMPLETED;
                transaction.result = result;
                transaction.completedAt = Date.now();
                
                this.log('Transaction completed:', transaction.id);
                this.emitEvent('transaction:completed', transaction);

            } catch (error) {
                this.logError('Transaction failed:', transaction.id, error.message);
                
                // Handle transaction failure
                await this.handleTransactionFailure(transaction, error);
            }

            // Move to history
            this.transactionHistory.push(transaction);
            
            // Clean up old history entries (keep last 100)
            if (this.transactionHistory.length > 100) {
                this.transactionHistory = this.transactionHistory.slice(-100);
            }
        }

        /**
         * Execute transaction operation
         */
        async executeTransaction(transaction) {
            const { operation, args, metadata } = transaction;

            // Update state to pending
            transaction.state = this.STATES.PENDING;
            this.emitEvent('transaction:pending', transaction);

            // Get contract manager
            if (!window.contractManager) {
                throw new Error('ContractManager not available');
            }

            let result;

            // Execute based on operation type
            switch (operation) {
                case 'approve':
                    result = await window.contractManager.approveLPToken(args[0], args[1]);
                    break;
                    
                case 'stake':
                    result = await window.contractManager.stakeLPTokens(args[0], args[1]);
                    break;
                    
                case 'unstake':
                    result = await window.contractManager.unstakeLPTokens(args[0], args[1]);
                    break;
                    
                case 'claim':
                    result = await window.contractManager.claimRewards(args[0]);
                    break;
                    
                default:
                    throw new Error(`Unknown operation: ${operation}`);
            }

            // Update state to confirming
            transaction.state = this.STATES.CONFIRMING;
            transaction.hash = result.hash;
            this.emitEvent('transaction:confirming', transaction);

            return result;
        }

        /**
         * Handle transaction failure with retry logic
         */
        async handleTransactionFailure(transaction, error) {
            transaction.error = error.message;
            transaction.updatedAt = Date.now();

            // Check if we should retry
            if (transaction.retries < transaction.maxRetries && this.shouldRetry(error)) {
                transaction.retries++;
                transaction.state = this.STATES.QUEUED;
                
                // Calculate retry delay with exponential backoff
                const delay = Math.min(
                    this.config.baseRetryDelay * Math.pow(2, transaction.retries - 1),
                    this.config.maxRetryDelay
                );

                this.log(`Retrying transaction ${transaction.id} in ${delay}ms (attempt ${transaction.retries}/${transaction.maxRetries})`);
                
                // Add back to queue after delay
                setTimeout(() => {
                    this.queue.unshift(transaction); // Add to front for priority
                    this.sortQueueByPriority();
                }, delay);

                this.emitEvent('transaction:retry', transaction);
            } else {
                // Max retries reached or non-retryable error
                transaction.state = error.message.includes('timeout') ? this.STATES.TIMEOUT : this.STATES.FAILED;
                transaction.failedAt = Date.now();
                
                this.logError('Transaction failed permanently:', transaction.id, error.message);
                this.emitEvent('transaction:failed', transaction);
            }
        }

        /**
         * Determine if error is retryable
         */
        shouldRetry(error) {
            const retryableErrors = [
                'network error',
                'timeout',
                'nonce too low',
                'replacement transaction underpriced',
                'insufficient funds for gas',
                'connection error'
            ];

            const errorMessage = error.message.toLowerCase();
            return retryableErrors.some(retryableError => errorMessage.includes(retryableError));
        }

        /**
         * Sort queue by priority (highest first)
         */
        sortQueueByPriority() {
            this.queue.sort((a, b) => {
                // First sort by priority (higher priority first)
                if (a.priority !== b.priority) {
                    return b.priority - a.priority;
                }
                // Then by creation time (older first)
                return a.createdAt - b.createdAt;
            });
        }

        /**
         * Cancel transaction
         */
        cancelTransaction(transactionId) {
            try {
                // Find in queue
                const queueIndex = this.queue.findIndex(t => t.id === transactionId);
                if (queueIndex !== -1) {
                    const transaction = this.queue.splice(queueIndex, 1)[0];
                    transaction.state = this.STATES.CANCELLED;
                    transaction.cancelledAt = Date.now();
                    
                    this.transactionHistory.push(transaction);
                    this.emitEvent('transaction:cancelled', transaction);
                    
                    this.log('Transaction cancelled:', transactionId);
                    return true;
                }

                // Check if it's currently processing
                if (this.currentTransaction && this.currentTransaction.id === transactionId) {
                    this.log('Cannot cancel currently processing transaction:', transactionId);
                    return false;
                }

                this.log('Transaction not found for cancellation:', transactionId);
                return false;
            } catch (error) {
                this.logError('Failed to cancel transaction:', error);
                return false;
            }
        }

        /**
         * Get queue status
         */
        getQueueStatus() {
            return {
                queueLength: this.queue.length,
                processing: this.processing,
                currentTransaction: this.currentTransaction ? {
                    id: this.currentTransaction.id,
                    operation: this.currentTransaction.operation,
                    state: this.currentTransaction.state
                } : null,
                historyLength: this.transactionHistory.length
            };
        }

        /**
         * Get transaction by ID
         */
        getTransaction(transactionId) {
            // Check queue
            const queuedTransaction = this.queue.find(t => t.id === transactionId);
            if (queuedTransaction) return queuedTransaction;

            // Check current transaction
            if (this.currentTransaction && this.currentTransaction.id === transactionId) {
                return this.currentTransaction;
            }

            // Check history
            return this.transactionHistory.find(t => t.id === transactionId);
        }

        /**
         * Clear completed transactions from history
         */
        clearHistory() {
            this.transactionHistory = this.transactionHistory.filter(
                t => t.state !== this.STATES.COMPLETED
            );
            this.log('Transaction history cleared');
        }

        /**
         * Emit event
         */
        emitEvent(eventName, data) {
            if (window.eventManager) {
                window.eventManager.emit(eventName, data);
            }
        }

        /**
         * Logging utility
         */
        log(...args) {
            if (window.CONFIG?.DEV?.DEBUG_MODE) {
                console.log('[TransactionQueue]', ...args);
            }
        }

        /**
         * Error logging utility
         */
        logError(...args) {
            console.error('[TransactionQueue]', ...args);
        }
    }

    // Export to global scope
    global.TransactionQueue = TransactionQueue;
    console.log('✅ TransactionQueue class loaded');

})(window);
