/**
 * Helper utilities for LP Staking Platform
 * Common functions used throughout the application
 */

/**
 * Error handling utilities
 */
window.ErrorHandler = {
    /**
     * Handle wallet connection errors
     */
    handleWalletError(error) {
        console.error('Wallet Error:', error);
        
        let message = 'An error occurred with your wallet connection.';
        
        if (error.code === 4001) {
            message = 'Connection request was rejected. Please try again.';
        } else if (error.code === -32002) {
            message = 'Connection request is already pending. Please check your wallet.';
        } else if (error.message?.includes('User rejected')) {
            message = 'Connection was rejected. Please approve the connection in your wallet.';
        } else if (error.message?.includes('No Ethereum provider')) {
            message = 'No wallet detected. Please install MetaMask or another Web3 wallet.';
        } else if (error.message?.includes('Chain')) {
            message = 'Network error. Please check your network connection and try again.';
        }
        
        this.showError('Wallet Connection Error', message);
        return message;
    },

    /**
     * Handle transaction errors
     */
    handleTransactionError(error) {
        console.error('Transaction Error:', error);
        
        let message = 'Transaction failed. Please try again.';
        
        if (error.code === 4001) {
            message = 'Transaction was rejected by user.';
        } else if (error.code === -32603) {
            message = 'Transaction failed due to insufficient gas or network error.';
        } else if (error.message?.includes('insufficient funds')) {
            message = 'Insufficient funds to complete this transaction.';
        } else if (error.message?.includes('gas')) {
            message = 'Transaction failed due to gas estimation error. Please try again.';
        } else if (error.message?.includes('nonce')) {
            message = 'Transaction nonce error. Please reset your wallet and try again.';
        } else if (error.message?.includes('replacement')) {
            message = 'Transaction replacement error. Please wait and try again.';
        }
        
        this.showError('Transaction Error', message);
        return message;
    },

    /**
     * Handle network errors
     */
    handleNetworkError(error) {
        console.error('Network Error:', error);
        
        let message = 'Network error occurred. Please check your connection.';
        
        if (error.message?.includes('timeout')) {
            message = 'Request timed out. Please check your network connection and try again.';
        } else if (error.message?.includes('fetch')) {
            message = 'Failed to connect to the network. Please try again later.';
        } else if (error.code === 'NETWORK_ERROR') {
            message = 'Network connection failed. Please check your internet connection.';
        }
        
        this.showError('Network Error', message);
        return message;
    },

    /**
     * Handle contract errors
     */
    handleContractError(error) {
        console.error('Contract Error:', error);
        
        let message = 'Smart contract interaction failed.';
        
        if (error.message?.includes('execution reverted')) {
            message = 'Transaction was reverted by the smart contract. Please check your inputs.';
        } else if (error.message?.includes('call exception')) {
            message = 'Contract call failed. Please ensure you\'re on the correct network.';
        } else if (error.message?.includes('invalid address')) {
            message = 'Invalid contract address. Please refresh the page and try again.';
        }
        
        this.showError('Contract Error', message);
        return message;
    },

    /**
     * Show error notification
     */
    showError(title, message) {
        if (window.notificationManager) {
            window.notificationManager.show('error', title, message);
        } else {
            alert(`${title}: ${message}`);
        }
    },

    /**
     * Show success notification
     */
    showSuccess(title, message) {
        if (window.notificationManager) {
            window.notificationManager.show('success', title, message);
        } else {
            console.log(`${title}: ${message}`);
        }
    },

    /**
     * Show warning notification
     */
    showWarning(title, message) {
        if (window.notificationManager) {
            window.notificationManager.show('warning', title, message);
        } else {
            console.warn(`${title}: ${message}`);
        }
    },

    /**
     * Show info notification
     */
    showInfo(title, message) {
        if (window.notificationManager) {
            window.notificationManager.show('info', title, message);
        } else {
            console.info(`${title}: ${message}`);
        }
    }
};

/**
 * Formatting utilities
 */
window.Formatter = {
    /**
     * Format token amount for display
     */
    formatTokenAmount(amount, decimals = 18, displayDecimals = 4) {
        if (!amount) return '0';
        
        try {
            const formatted = ethers.utils.formatUnits(amount, decimals);
            const num = parseFloat(formatted);
            
            if (num === 0) return '0';
            if (num < 0.0001) return '< 0.0001';
            
            return num.toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: displayDecimals
            });
        } catch (error) {
            console.error('Error formatting token amount:', error);
            return '0';
        }
    },

    /**
     * Format percentage
     */
    formatPercentage(value, decimals = 2) {
        if (!value || isNaN(value)) return '0%';
        
        const num = parseFloat(value);
        return `${num.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimals
        })}%`;
    },

    /**
     * Format USD amount
     */
    formatUSD(amount, decimals = 2) {
        if (!amount || isNaN(amount)) return '$0.00';
        
        const num = parseFloat(amount);
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(num);
    },

    /**
     * Format address for display
     */
    formatAddress(address, startChars = 6, endChars = 4) {
        if (!address) return '';
        
        if (address.length <= startChars + endChars) {
            return address;
        }
        
        return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
    },

    /**
     * Format transaction hash
     */
    formatTxHash(hash, chars = 8) {
        if (!hash) return '';
        return `${hash.slice(0, chars)}...`;
    },

    /**
     * Format time ago
     */
    formatTimeAgo(timestamp) {
        if (!timestamp) return '';
        
        const now = Date.now();
        const diff = now - timestamp;
        
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'Just now';
    }
};

/**
 * Validation utilities
 */
window.Validator = {
    /**
     * Validate Ethereum address
     */
    isValidAddress(address) {
        return window.CONFIG.VALIDATION.ADDRESS_REGEX.test(address);
    },

    /**
     * Validate amount input
     */
    isValidAmount(amount) {
        if (!amount || amount === '') return false;
        return window.CONFIG.VALIDATION.AMOUNT_REGEX.test(amount) && parseFloat(amount) > 0;
    },

    /**
     * Validate minimum stake amount
     */
    isAboveMinimum(amount) {
        if (!this.isValidAmount(amount)) return false;
        return parseFloat(amount) >= parseFloat(window.CONFIG.VALIDATION.MIN_STAKE_AMOUNT);
    },

    /**
     * Validate maximum decimals
     */
    hasValidDecimals(amount) {
        if (!amount || amount === '') return true;
        
        const parts = amount.split('.');
        if (parts.length <= 1) return true;
        
        return parts[1].length <= window.CONFIG.VALIDATION.MAX_DECIMALS;
    },

    /**
     * Sanitize input
     */
    sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        
        return input
            .replace(/[<>]/g, '') // Remove potential HTML tags
            .trim()
            .slice(0, 1000); // Limit length
    }
};

/**
 * Storage utilities
 */
window.Storage = {
    /**
     * Set item in localStorage with error handling
     */
    setItem(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
            return false;
        }
    },

    /**
     * Get item from localStorage with error handling
     */
    getItem(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Failed to read from localStorage:', error);
            return defaultValue;
        }
    },

    /**
     * Remove item from localStorage
     */
    removeItem(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Failed to remove from localStorage:', error);
            return false;
        }
    },

    /**
     * Clear all localStorage
     */
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Failed to clear localStorage:', error);
            return false;
        }
    }
};

/**
 * DOM utilities
 */
window.DOM = {
    /**
     * Create element with attributes and content
     */
    createElement(tag, attributes = {}, content = '') {
        const element = document.createElement(tag);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'innerHTML') {
                element.innerHTML = value;
            } else if (key === 'textContent') {
                element.textContent = value;
            } else {
                element.setAttribute(key, value);
            }
        });
        
        if (content) {
            element.innerHTML = content;
        }
        
        return element;
    },

    /**
     * Add event listener with cleanup tracking
     */
    addEventListener(element, event, handler, options = {}) {
        element.addEventListener(event, handler, options);
        
        // Return cleanup function
        return () => {
            element.removeEventListener(event, handler, options);
        };
    },

    /**
     * Show element
     */
    show(element) {
        if (element) {
            element.style.display = '';
            element.removeAttribute('hidden');
        }
    },

    /**
     * Hide element
     */
    hide(element) {
        if (element) {
            element.style.display = 'none';
        }
    },

    /**
     * Toggle element visibility
     */
    toggle(element) {
        if (element) {
            if (element.style.display === 'none') {
                this.show(element);
            } else {
                this.hide(element);
            }
        }
    }
};

/**
 * Async utilities
 */
window.AsyncUtils = {
    /**
     * Sleep for specified milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Retry function with exponential backoff
     */
    async retry(fn, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                if (i === maxRetries - 1) {
                    throw error;
                }
                
                const delay = baseDelay * Math.pow(2, i);
                await this.sleep(delay);
            }
        }
        
        throw lastError;
    },

    /**
     * Timeout wrapper for promises
     */
    timeout(promise, ms) {
        return Promise.race([
            promise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Operation timed out')), ms)
            )
        ]);
    }
};

/**
 * Debug utilities
 */
window.Debug = {
    /**
     * Log with timestamp and context
     */
    log(context, ...args) {
        if (window.CONFIG.DEV.DEBUG_MODE) {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] [${context}]`, ...args);
        }
    },

    /**
     * Error log with timestamp and context
     */
    error(context, ...args) {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] [${context}]`, ...args);
    },

    /**
     * Performance timing
     */
    time(label) {
        if (window.CONFIG.DEV.DEBUG_MODE) {
            console.time(label);
        }
    },

    /**
     * End performance timing
     */
    timeEnd(label) {
        if (window.CONFIG.DEV.DEBUG_MODE) {
            console.timeEnd(label);
        }
    }
};
