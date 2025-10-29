/**
 * ErrorHandler - Comprehensive error management system
 * Provides error categorization, user-friendly messages, and retry logic
 * Handles blockchain, network, and application errors gracefully
 *
 * ENHANCED SINGLETON PATTERN - Completely prevents redeclaration errors
 */
(function(global) {
    'use strict';

    // CRITICAL FIX: Enhanced redeclaration prevention with instance management
    if (global.ErrorHandler) {
        console.warn('ErrorHandler class already exists, skipping redeclaration');
        return;
    }

    // Check for existing instance and preserve it
    if (global.errorHandler) {
        console.warn('ErrorHandler instance already exists, preserving existing instance');
        return;
    }

class ErrorHandler {
    constructor() {
        // Error categories and mappings
        this.errorCategories = {
            NETWORK: 'network',
            BLOCKCHAIN: 'blockchain',
            CONTRACT: 'contract',
            WALLET: 'wallet',
            VALIDATION: 'validation',
            PERMISSION: 'permission',
            RATE_LIMIT: 'rate_limit',
            UNKNOWN: 'unknown'
        };
        
        // Error code mappings
        this.errorCodes = {
            // Network errors
            'NETWORK_ERROR': { category: 'NETWORK', severity: 'high', retryable: true },
            'TIMEOUT': { category: 'NETWORK', severity: 'medium', retryable: true },
            'CONNECTION_REFUSED': { category: 'NETWORK', severity: 'high', retryable: true },
            
            // Blockchain errors
            'INSUFFICIENT_FUNDS': { category: 'BLOCKCHAIN', severity: 'high', retryable: false },
            'GAS_LIMIT_EXCEEDED': { category: 'BLOCKCHAIN', severity: 'medium', retryable: true },
            'NONCE_TOO_LOW': { category: 'BLOCKCHAIN', severity: 'low', retryable: true },
            'REPLACEMENT_UNDERPRICED': { category: 'BLOCKCHAIN', severity: 'low', retryable: true },
            
            // Contract errors
            'CONTRACT_NOT_DEPLOYED': { category: 'CONTRACT', severity: 'high', retryable: false },
            'EXECUTION_REVERTED': { category: 'CONTRACT', severity: 'medium', retryable: false },
            'INVALID_ADDRESS': { category: 'CONTRACT', severity: 'high', retryable: false },
            
            // Wallet errors
            'USER_REJECTED': { category: 'WALLET', severity: 'low', retryable: false },
            'ACTION_REJECTED': { category: 'WALLET', severity: 'low', retryable: false },
            'WALLET_NOT_CONNECTED': { category: 'WALLET', severity: 'high', retryable: false },
            'UNSUPPORTED_NETWORK': { category: 'WALLET', severity: 'medium', retryable: false },
            
            // Validation errors
            'INVALID_AMOUNT': { category: 'VALIDATION', severity: 'medium', retryable: false },
            'AMOUNT_TOO_LOW': { category: 'VALIDATION', severity: 'medium', retryable: false },
            'AMOUNT_TOO_HIGH': { category: 'VALIDATION', severity: 'medium', retryable: false },
            
            // Permission errors
            'INSUFFICIENT_ALLOWANCE': { category: 'PERMISSION', severity: 'medium', retryable: false },
            'UNAUTHORIZED': { category: 'PERMISSION', severity: 'high', retryable: false },
            
            // Rate limiting
            'RATE_LIMITED': { category: 'RATE_LIMIT', severity: 'low', retryable: true }
        };
        
        // User-friendly error messages
        this.userMessages = {
            NETWORK: {
                title: 'Network Connection Issue',
                message: 'Unable to connect to the blockchain network. Please check your internet connection and try again.',
                action: 'Retry Connection'
            },
            BLOCKCHAIN: {
                title: 'Blockchain Transaction Error',
                message: 'There was an issue processing your transaction on the blockchain.',
                action: 'Try Again'
            },
            CONTRACT: {
                title: 'Smart Contract Error',
                message: 'The smart contract encountered an error. This may be a temporary issue.',
                action: 'Retry'
            },
            WALLET: {
                title: 'Wallet Connection Issue',
                message: 'There was a problem with your wallet connection.',
                action: 'Reconnect Wallet'
            },
            VALIDATION: {
                title: 'Invalid Input',
                message: 'Please check your input values and try again.',
                action: 'Correct Input'
            },
            PERMISSION: {
                title: 'Permission Required',
                message: 'Additional permissions are required to complete this action.',
                action: 'Grant Permission'
            },
            RATE_LIMIT: {
                title: 'Too Many Requests',
                message: 'You are making requests too quickly. Please wait a moment and try again.',
                action: 'Wait and Retry'
            },
            UNKNOWN: {
                title: 'Unexpected Error',
                message: 'An unexpected error occurred. Please try again or contact support if the issue persists.',
                action: 'Try Again'
            }
        };
        
        // Specific error message overrides
        this.specificMessages = {
            'INSUFFICIENT_FUNDS': {
                title: 'Insufficient Funds',
                message: 'You do not have enough funds to complete this transaction, including gas fees.',
                action: 'Add Funds'
            },
            'USER_REJECTED': {
                title: 'Transaction Cancelled',
                message: 'You cancelled the transaction in your wallet.',
                action: 'Try Again'
            },
            'ACTION_REJECTED': {
                title: 'Transaction Cancelled',
                message: 'You cancelled the transaction in your wallet.',
                action: 'Try Again'
            },
            'INSUFFICIENT_ALLOWANCE': {
                title: 'Token Approval Required',
                message: 'You need to approve the contract to spend your tokens before staking.',
                action: 'Approve Tokens'
            },
            'EXECUTION_REVERTED': {
                title: 'Transaction Failed',
                message: 'The transaction was rejected by the smart contract. Please check your inputs.',
                action: 'Check Inputs'
            },
            'WALLET_NOT_CONNECTED': {
                title: 'Wallet Not Connected',
                message: 'Please connect your wallet to continue.',
                action: 'Connect Wallet'
            }
        };
        
        // Retry configuration
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 1000, // 1 second
            maxDelay: 10000, // 10 seconds
            backoffMultiplier: 2
        };
        
        // Error history for debugging
        this.errorHistory = [];
        this.maxHistorySize = 100;
        
        this.log('ErrorHandler initialized');
    }

    // ==================== ERROR PROCESSING ====================

    /**
     * Process and categorize error
     */
    processError(error, context = {}) {
        try {
            const processedError = {
                id: this.generateErrorId(),
                timestamp: Date.now(),
                context,
                original: error,
                category: this.categorizeError(error),
                code: this.extractErrorCode(error),
                severity: this.determineSeverity(error),
                retryable: this.isRetryable(error),
                userMessage: this.getUserMessage(error),
                technicalMessage: this.getTechnicalMessage(error),
                suggestions: this.getSuggestions(error),
                metadata: this.extractMetadata(error)
            };
            
            // Add to history
            this.addToHistory(processedError);
            
            // Log error based on severity
            this.logError(processedError);
            
            return processedError;
        } catch (processingError) {
            this.logError('Error processing error:', processingError);
            return this.createFallbackError(error, context);
        }
    }

    /**
     * Categorize error based on type and message
     */
    categorizeError(error) {
        if (!error) return this.errorCategories.UNKNOWN;
        
        const errorString = error.toString().toLowerCase();
        const errorCode = error.code || '';
        
        // Check specific error codes first
        if (this.errorCodes[errorCode]) {
            return this.errorCategories[this.errorCodes[errorCode].category];
        }
        
        // Pattern matching for common errors
        if (errorString.includes('network') || errorString.includes('connection')) {
            return this.errorCategories.NETWORK;
        }
        
        if (errorString.includes('insufficient funds') || errorString.includes('gas')) {
            return this.errorCategories.BLOCKCHAIN;
        }
        
        if (errorString.includes('user rejected') || errorString.includes('user denied') || errorCode === 'ACTION_REJECTED') {
            return this.errorCategories.WALLET;
        }
        
        if (errorString.includes('revert') || errorString.includes('execution')) {
            return this.errorCategories.CONTRACT;
        }
        
        if (errorString.includes('invalid') || errorString.includes('validation')) {
            return this.errorCategories.VALIDATION;
        }
        
        if (errorString.includes('allowance') || errorString.includes('permission')) {
            return this.errorCategories.PERMISSION;
        }
        
        if (errorString.includes('rate limit') || errorString.includes('too many requests')) {
            return this.errorCategories.RATE_LIMIT;
        }
        
        return this.errorCategories.UNKNOWN;
    }

    /**
     * Extract error code from error object
     */
    extractErrorCode(error) {
        if (error.code) return error.code;
        if (error.reason) return error.reason;
        if (error.message) {
            // Try to extract common error patterns
            const patterns = [
                { pattern: /execution reverted/i, code: 'EXECUTION_REVERTED' },
                { pattern: /insufficient funds/i, code: 'INSUFFICIENT_FUNDS' },
                { pattern: /user rejected/i, code: 'USER_REJECTED' },
                { pattern: /user denied/i, code: 'USER_REJECTED' },
                { pattern: /network error/i, code: 'NETWORK_ERROR' },
                { pattern: /timeout/i, code: 'TIMEOUT' }
            ];
            
            for (const { pattern, code } of patterns) {
                if (pattern.test(error.message)) {
                    return code;
                }
            }
        }
        
        return 'UNKNOWN_ERROR';
    }

    /**
     * Determine error severity
     */
    determineSeverity(error) {
        const errorCode = this.extractErrorCode(error);
        const errorInfo = this.errorCodes[errorCode];
        
        if (errorInfo) {
            return errorInfo.severity;
        }
        
        // Default severity based on category
        const category = this.categorizeError(error);
        switch (category) {
            case this.errorCategories.NETWORK:
            case this.errorCategories.BLOCKCHAIN:
            case this.errorCategories.CONTRACT:
                return 'high';
            case this.errorCategories.WALLET:
            case this.errorCategories.VALIDATION:
            case this.errorCategories.PERMISSION:
                return 'medium';
            case this.errorCategories.RATE_LIMIT:
                return 'low';
            default:
                return 'medium';
        }
    }

    /**
     * Check if error is retryable
     */
    isRetryable(error) {
        const errorCode = this.extractErrorCode(error);
        const errorInfo = this.errorCodes[errorCode];
        
        if (errorInfo) {
            return errorInfo.retryable;
        }
        
        // Default retryability based on category
        const category = this.categorizeError(error);
        switch (category) {
            case this.errorCategories.NETWORK:
            case this.errorCategories.RATE_LIMIT:
                return true;
            case this.errorCategories.BLOCKCHAIN:
                return errorCode === 'GAS_LIMIT_EXCEEDED' || errorCode === 'NONCE_TOO_LOW';
            case this.errorCategories.WALLET:
            case this.errorCategories.CONTRACT:
            case this.errorCategories.VALIDATION:
            case this.errorCategories.PERMISSION:
                return false;
            default:
                return false;
        }
    }

    /**
     * Get user-friendly error message
     */
    getUserMessage(error) {
        const errorCode = this.extractErrorCode(error);
        
        // Check for specific message override
        if (this.specificMessages[errorCode]) {
            return this.specificMessages[errorCode];
        }
        
        // Use category-based message
        const category = this.categorizeError(error);
        return this.userMessages[category] || this.userMessages.UNKNOWN;
    }

    /**
     * Get technical error message for debugging
     */
    getTechnicalMessage(error) {
        if (error.message) return error.message;
        if (error.reason) return error.reason;
        if (typeof error === 'string') return error;
        return JSON.stringify(error);
    }

    /**
     * Get error resolution suggestions
     */
    getSuggestions(error) {
        const category = this.categorizeError(error);
        const errorCode = this.extractErrorCode(error);
        
        const suggestions = [];
        
        switch (category) {
            case this.errorCategories.NETWORK:
                suggestions.push('Check your internet connection');
                suggestions.push('Try switching to a different RPC endpoint');
                suggestions.push('Wait a moment and try again');
                break;
                
            case this.errorCategories.BLOCKCHAIN:
                if (errorCode === 'INSUFFICIENT_FUNDS') {
                    suggestions.push('Add more funds to your wallet');
                    suggestions.push('Reduce the transaction amount');
                } else {
                    suggestions.push('Increase gas limit');
                    suggestions.push('Wait for network congestion to reduce');
                }
                break;
                
            case this.errorCategories.WALLET:
                suggestions.push('Reconnect your wallet');
                suggestions.push('Switch to the correct network');
                suggestions.push('Refresh the page and try again');
                break;
                
            case this.errorCategories.CONTRACT:
                suggestions.push('Check contract parameters');
                suggestions.push('Verify contract is deployed');
                suggestions.push('Contact support if issue persists');
                break;
                
            case this.errorCategories.VALIDATION:
                suggestions.push('Check input values');
                suggestions.push('Ensure amounts are within valid ranges');
                suggestions.push('Verify token addresses');
                break;
                
            case this.errorCategories.PERMISSION:
                suggestions.push('Approve token spending');
                suggestions.push('Check wallet permissions');
                suggestions.push('Ensure sufficient allowance');
                break;
                
            default:
                suggestions.push('Try again in a few moments');
                suggestions.push('Refresh the page');
                suggestions.push('Contact support if issue persists');
        }
        
        return suggestions;
    }

    /**
     * Extract metadata from error for debugging
     */
    extractMetadata(error) {
        const metadata = {};

        if (error.transaction) {
            metadata.transaction = {
                hash: error.transaction.hash,
                from: error.transaction.from,
                to: error.transaction.to,
                value: error.transaction.value?.toString(),
                gasLimit: error.transaction.gasLimit?.toString(),
                gasPrice: error.transaction.gasPrice?.toString()
            };
        }

        if (error.receipt) {
            metadata.receipt = {
                blockNumber: error.receipt.blockNumber,
                gasUsed: error.receipt.gasUsed?.toString(),
                status: error.receipt.status
            };
        }

        if (error.stack) {
            metadata.stack = error.stack;
        }

        return metadata;
    }

    // ==================== RETRY LOGIC ====================

    /**
     * Execute operation with retry logic
     */
    async executeWithRetry(operation, context = {}, customRetryConfig = {}) {
        const config = { ...this.retryConfig, ...customRetryConfig };
        let lastError = null;

        for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
            try {
                this.log(`Executing operation (attempt ${attempt}/${config.maxRetries + 1})`);
                const result = await operation();

                if (attempt > 1) {
                    this.log(`Operation succeeded after ${attempt} attempts`);
                }

                return result;
            } catch (error) {
                lastError = error;
                const processedError = this.processError(error, { ...context, attempt });

                // Don't retry if error is not retryable
                if (!processedError.retryable) {
                    this.log('Error is not retryable, failing immediately');
                    throw processedError;
                }

                // Don't retry on last attempt
                if (attempt > config.maxRetries) {
                    this.log(`Operation failed after ${attempt} attempts`);
                    throw processedError;
                }

                // Calculate delay for next attempt
                const delay = Math.min(
                    config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
                    config.maxDelay
                );

                this.log(`Retrying in ${delay}ms (attempt ${attempt + 1}/${config.maxRetries + 1})`);
                await this.delay(delay);
            }
        }

        // This should never be reached, but just in case
        throw this.processError(lastError || new Error('Unknown retry error'), context);
    }

    /**
     * Delay utility for retry logic
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ==================== ERROR DISPLAY ====================

    /**
     * Display error to user via notification system
     */
    displayError(error, options = {}) {
        try {
            const processedError = typeof error === 'object' && error.id ?
                error : this.processError(error, options.context);

            const { showTechnical = false, autoHide = true, duration = 5000 } = options;

            // Create notification
            const notification = {
                id: processedError.id,
                type: 'error',
                title: processedError.userMessage.title,
                message: processedError.userMessage.message,
                action: processedError.userMessage.action,
                timestamp: Date.now(),
                autoHide,
                duration,
                metadata: {
                    category: processedError.category,
                    severity: processedError.severity,
                    retryable: processedError.retryable,
                    suggestions: processedError.suggestions
                }
            };

            // Add technical details if requested
            if (showTechnical) {
                notification.technicalMessage = processedError.technicalMessage;
            }

            // Add to state manager notifications
            if (window.stateManager) {
                const currentNotifications = window.stateManager.get('ui.notifications') || [];
                window.stateManager.set('ui.notifications', [...currentNotifications, notification]);
            }

            this.log('Error displayed to user:', processedError.id);
            return notification;
        } catch (displayError) {
            this.logError('Error displaying error:', displayError);
            return null;
        }
    }

    /**
     * Create fallback error when processing fails
     */
    createFallbackError(originalError, context = {}) {
        return {
            id: this.generateErrorId(),
            timestamp: Date.now(),
            context,
            original: originalError,
            category: this.errorCategories.UNKNOWN,
            code: 'PROCESSING_ERROR',
            severity: 'high',
            retryable: false,
            userMessage: this.userMessages.UNKNOWN,
            technicalMessage: originalError?.message || 'Unknown error occurred',
            suggestions: ['Try again in a few moments', 'Contact support if issue persists'],
            metadata: {}
        };
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Generate unique error ID
     */
    generateErrorId() {
        return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Add error to history
     */
    addToHistory(processedError) {
        if (this.errorHistory.length >= this.maxHistorySize) {
            this.errorHistory.shift();
        }

        this.errorHistory.push({
            id: processedError.id,
            timestamp: processedError.timestamp,
            category: processedError.category,
            code: processedError.code,
            severity: processedError.severity,
            context: processedError.context,
            technicalMessage: processedError.technicalMessage
        });
    }

    /**
     * Get error history
     */
    getErrorHistory(limit = 20) {
        return this.errorHistory.slice(-limit);
    }

    /**
     * Get error statistics
     */
    getErrorStats() {
        const stats = {
            total: this.errorHistory.length,
            byCategory: {},
            bySeverity: {},
            recent: this.errorHistory.filter(e => Date.now() - e.timestamp < 3600000).length // Last hour
        };

        for (const error of this.errorHistory) {
            stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
            stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
        }

        return stats;
    }

    /**
     * Clear error history
     */
    clearHistory() {
        this.errorHistory = [];
        this.log('Error history cleared');
    }

    /**
     * Log error based on severity
     */
    logError(processedError) {
        const logMethod = processedError.severity === 'high' ? 'error' :
                         processedError.severity === 'medium' ? 'warn' : 'log';

        console[logMethod]('[ErrorHandler]', {
            id: processedError.id,
            category: processedError.category,
            code: processedError.code,
            severity: processedError.severity,
            message: processedError.technicalMessage,
            context: processedError.context
        });
    }

    /**
     * Cleanup ErrorHandler
     */
    cleanup() {
        this.clearHistory();
        this.log('ErrorHandler cleaned up');
    }

    /**
     * Logging utility
     */
    log(...args) {
        if (window.CONFIG?.DEV?.DEBUG_MODE) {
            console.log('[ErrorHandler]', ...args);
        }
    }
}

    // Export ErrorHandler class to global scope
    global.ErrorHandler = ErrorHandler;

    // Note: Instance creation is now handled by SystemInitializer
    console.log('✅ ErrorHandler class loaded');

})(window);
