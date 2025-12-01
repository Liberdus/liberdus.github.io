
// Prevent duplicate class declaration
if (typeof window.WalletManager !== 'undefined') {
    console.log('⚠️ WalletManager already defined, skipping redeclaration');
} else {

class WalletManager {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.address = null;
        this.chainId = null;
        this.walletType = null;
        this.isConnecting = false;
        this.listeners = new Set();
        this.eventListeners = [];

        // Rate limiting for MetaMask requests
        this.lastRequestTime = 0;
        this.requestCooldown = 2000; // 2 seconds between requests (increased)
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 3;
        this.connectionCooldownTime = 10000; // 10 seconds between connection attempts (increased)

        // Connection state management
        this.connectionPromise = null; // Track ongoing connection attempts

        this.init();
    }

    /**
     * Rate-limited MetaMask request wrapper to prevent circuit breaker errors
     */
    async safeMetaMaskRequest(method, params = [], retryCount = 0) {
        const maxRetries = 3;
        const baseDelay = 1000; // 1 second base delay

        // Implement exponential backoff for rate limiting
        const now = Date.now();
        const minDelay = this.requestCooldown * (retryCount + 1);
        if (now - this.lastRequestTime < minDelay) {
            const waitTime = minDelay - (now - this.lastRequestTime);
            console.log(`Rate limiting MetaMask request: waiting ${waitTime}ms (attempt ${retryCount + 1})`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        this.lastRequestTime = Date.now();

        try {
            console.log(`Making MetaMask request: ${method} (attempt ${retryCount + 1})`);
            return await window.ethereum.request({ method, params });
        } catch (error) {
            console.error(`MetaMask request failed (attempt ${retryCount + 1}):`, error);

            // Handle circuit breaker errors specifically
            if (error.code === -32603 && error.message.includes('circuit breaker')) {
                if (retryCount < maxRetries) {
                    const backoffDelay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
                    console.warn(`MetaMask circuit breaker triggered, retrying in ${backoffDelay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, backoffDelay));
                    return this.safeMetaMaskRequest(method, params, retryCount + 1);
                } else {
                    throw new Error('MetaMask is temporarily overloaded. Please wait a few minutes and refresh the page.');
                }
            }

            // Handle other common MetaMask errors
            if (error.code === -32002) {
                throw new Error('MetaMask is already processing a request. Please wait and try again.');
            }

            if (error.code === 4001) {
                throw new Error('Connection cancelled by user.');
            }

            throw error;
        }
    }

    async init() {
        this.isConnecting = true;
        try {

            await this.checkPreviousConnection();

            // Set up event listeners for wallet changes
            this.setupEventListeners();

            this.log('WalletManager initialized');
        } catch (error) {
            this.logError('Failed to initialize WalletManager:', error);
        } finally {
            this.isConnecting = false;
        }
    }

    /**
     * General connect method that chooses the best available wallet
     */
    async connectWallet(preferredType = 'auto') {
        try {
            this.log(`Connecting wallet (preferred: ${preferredType})...`);

            const normalizedPreference = (preferredType || 'auto').toLowerCase();

            if (normalizedPreference === 'metamask' || normalizedPreference === 'auto') {
                if (window.ethereum) {
                    return await this.connectMetaMask();
                }

                if (normalizedPreference === 'metamask') {
                    throw new Error('MetaMask not installed. Please install MetaMask browser extension.');
                }
            }

            throw new Error('No supported wallet found');
        } catch (error) {
            this.logError('Wallet connection failed:', error);
            throw error;
        }
    }

    /**
     * CRITICAL FIX: Connect to MetaMask wallet with circuit breaker protection
     */
    async connectMetaMask() {
        // Return existing connection promise if one is in progress
        if (this.connectionPromise) {
            console.log('Connection already in progress, returning existing promise...');
            return this.connectionPromise;
        }

        // Create new connection promise
        this.connectionPromise = this._performConnection();

        try {
            const result = await this.connectionPromise;
            return result;
        } finally {
            // Clear the connection promise when done (success or failure)
            this.connectionPromise = null;
        }
    }

    /**
     * Internal method to perform the actual connection
     */
    async _performConnection() {
        // Rate limiting and attempt limiting
        const now = Date.now();
        if (this.connectionAttempts >= this.maxConnectionAttempts) {
            const timeSinceLastAttempt = now - this.lastRequestTime;
            if (timeSinceLastAttempt < this.connectionCooldownTime) {
                const waitTime = this.connectionCooldownTime - timeSinceLastAttempt;
                throw new Error(`Too many connection attempts. Please wait ${Math.ceil(waitTime / 1000)} seconds before trying again.`);
            } else {
                // Reset attempts after cooldown
                this.connectionAttempts = 0;
            }
        }

        // Check if already connected
        if (this.isConnected()) {
            console.log('MetaMask already connected:', this.address);
            return {
                success: true,
                address: this.address,
                chainId: this.chainId,
                walletType: this.walletType
            };
        }

        // Check MetaMask availability
        if (!window.ethereum) {
            this.connectionAttempts++;
            throw new Error('MetaMask not installed. Please install MetaMask browser extension.');
        }

        // Set connection state with timeout protection
        this.isConnecting = true;
        this.connectionAttempts++;

        const connectionTimeout = setTimeout(() => {
            if (this.isConnecting) {
                console.error('MetaMask connection timeout');
                this.isConnecting = false;
            }
        }, 30000); // 30 second timeout (reduced from 60)

        try {
            this.log('Connecting to MetaMask...');

            // Check if ethers is available
            if (typeof window.ethers === 'undefined') {
                throw new Error('Ethers.js is not loaded. Please refresh the page and try again.');
            }

            // Request account access with rate limiting
            const accounts = await this.safeMetaMaskRequest('eth_requestAccounts');

            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts found. Please unlock MetaMask.');
            }

            // Create provider and signer
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            this.signer = this.provider.getSigner();
            this.address = accounts[0];
            this.walletType = 'metamask';

            // Get network information
            const network = await this.provider.getNetwork();
            this.chainId = network.chainId;

            // Store connection info
            this.storeConnectionInfo();

            // CRITICAL FIX: Notify listeners with enhanced error handling
            this.notifyListeners('connected', {
                address: this.address,
                chainId: this.chainId,
                walletType: this.walletType
            });

            // Show success notification if NotificationManager is available
            if (window.notificationManager && typeof window.notificationManager.success === 'function') {
                window.notificationManager.success(
                    'Wallet Connected Successfully!',
                    `Address: ${this.address.slice(0, 6)}...${this.address.slice(-4)}`,
                    { duration: 3000 }
                );
            }

            this.log('MetaMask connected successfully:', this.address);

            // Reset connection attempts on success
            this.connectionAttempts = 0;

            return {
                success: true,
                address: this.address,
                chainId: this.chainId,
                walletType: this.walletType
            };

        } catch (error) {
            this.logError('MetaMask connection failed:', error);

            // Show user-friendly error message
            if (window.notificationManager) {
                if (error.code === 4001) {
                    window.notificationManager.warning('You cancelled the connection request');
                } else if (error.code === -32002) {
                    window.notificationManager.warning('MetaMask is already processing a request. Please wait.');
                } else {
                    window.notificationManager.error(error.message || 'An error occurred while connecting');
                }
            }

            throw error;
        } finally {
            clearTimeout(connectionTimeout);
            this.isConnecting = false;
        }
    }
    /**
     * Disconnect wallet
     */
    async disconnect() {
        try {
            this.log('Disconnecting wallet...');

            // Clear stored connection info
            this.clearConnectionInfo();

            // Reset state
            this.provider = null;
            this.signer = null;
            this.address = null;
            this.chainId = null;
            this.walletType = null;

            // Notify listeners
            this.notifyListeners('disconnected', {});

            this.log('Wallet disconnected successfully');

        } catch (error) {
            this.logError('Failed to disconnect wallet:', error);
            throw error;
        }
    }

    /**
     * Check if wallet is connected
     */
    isConnected() {
        return !!(this.provider && this.signer && this.address);
    }

    /**
     * Check if wallet is connected (alias for compatibility)
     */
    isWalletConnected() {
        return this.isConnected();
    }

    /**
     * Get current wallet address
     */
    getAddress() {
        return this.address;
    }

    /**
     * Get current account (alias for address for compatibility)
     */
    get currentAccount() {
        return this.address;
    }

    /**
     * Get current chain ID
     */
    getChainId() {
        return this.chainId;
    }

    /**
     * Get wallet type
     */
    getWalletType() {
        return this.walletType;
    }

    /**
     * Get provider
     */
    getProvider() {
        return this.provider;
    }

    /**
     * Get signer
     */
    getSigner() {
        return this.signer;
    }

    /**
     * Subscribe to wallet events
     */
    subscribe(callback) {
        this.listeners.add(callback);
        
        // Return unsubscribe function
        return () => {
            this.listeners.delete(callback);
        };
    }

    /**
     * Check for previously connected wallet
     */
    async checkPreviousConnection() {
        try {
            // Use safe localStorage access
            const storageKey = window.CONFIG?.UI?.WALLET_STORAGE_KEY || 'lp_staking_wallet_connection';
            const connectionInfo = window.sesSafeHandler?.safeLocalStorage?.getItem(storageKey) ||
                                 localStorage.getItem(storageKey);
            if (!connectionInfo) return false;

            const { walletType, address } = JSON.parse(connectionInfo);
            
            if (walletType === 'metamask' && window.ethereum) {
                // Check if MetaMask is still connected (use eth_accounts to avoid popup)
                try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                    if (accounts && accounts.length > 0 && accounts[0].toLowerCase() === address.toLowerCase()) {
                        console.log('✅ Previous MetaMask connection found, restoring...');
                        
                        // Restore connection without triggering new request
                        this.provider = new ethers.providers.Web3Provider(window.ethereum);
                        this.signer = this.provider.getSigner();
                        this.address = accounts[0];
                        this.walletType = 'metamask';
                        
                        // Get network information
                        const network = await this.provider.getNetwork();
                        this.chainId = network.chainId;
                        
                        // Notify listeners about restored connection
                        this.notifyListeners('connected', {
                            address: this.address,
                            chainId: this.chainId,
                            walletType: this.walletType,
                            restored: true
                        });
                        
                        console.log('✅ MetaMask connection restored successfully:', this.address);
                    return true;
                    }
                } catch (error) {
                    console.warn('Could not check previous connection:', error);
                }
            }

            // Clear invalid connection info
            this.clearConnectionInfo();
            return false;

        } catch (error) {
            this.logError('Failed to check previous connection:', error);
            this.clearConnectionInfo();
            return false;
        }
    }

    /**
     * Store connection information
     */
    storeConnectionInfo() {
        const connectionInfo = {
            walletType: this.walletType,
            address: this.address,
            chainId: this.chainId,
            timestamp: Date.now()
        };
        
        const storageKey = window.CONFIG?.UI?.WALLET_STORAGE_KEY || 'lp_staking_wallet_connection';
        const success = window.sesSafeHandler?.safeLocalStorage?.setItem(storageKey, JSON.stringify(connectionInfo));

        if (!success) {
            // Fallback to regular localStorage
            try {
                localStorage.setItem(storageKey, JSON.stringify(connectionInfo));
            } catch (error) {
                console.warn('Failed to save connection info:', error.message);
            }
        }
    }

    /**
     * Clear stored connection information
     */
    clearConnectionInfo() {
        const storageKey = window.CONFIG?.UI?.WALLET_STORAGE_KEY || 'lp_staking_wallet_connection';
        const success = window.sesSafeHandler?.safeLocalStorage?.removeItem(storageKey);

        if (!success) {
            // Fallback to regular localStorage
            try {
                localStorage.removeItem(storageKey);
            } catch (error) {
                console.warn('Failed to clear connection info:', error.message);
            }
        }
    }

    /**
     * Set up event listeners for wallet changes
     */
    setupEventListeners() {
        if (window.ethereum) {
            // MetaMask event listeners
            const accountsChangedHandler = (accounts) => this.handleAccountsChanged(accounts);
            const chainChangedHandler = (chainId) => this.handleChainChanged(chainId);
            const disconnectHandler = () => this.handleDisconnect();

            window.ethereum.on('accountsChanged', accountsChangedHandler);
            window.ethereum.on('chainChanged', chainChangedHandler);
            window.ethereum.on('disconnect', disconnectHandler);

            // Store references for cleanup
            this.eventListeners.push(
                { target: window.ethereum, event: 'accountsChanged', handler: accountsChangedHandler },
                { target: window.ethereum, event: 'chainChanged', handler: chainChangedHandler },
                { target: window.ethereum, event: 'disconnect', handler: disconnectHandler }
            );
        }
    }

    /**
     * Handle accounts changed event
     */
    async handleAccountsChanged(accounts) {
        this.log('Accounts changed:', accounts);

        if (!accounts || accounts.length === 0) {
            // Check if this is a network change (we have a stored address)
            // MetaMask sometimes sends empty accounts during network switches
            if (this.address) {
                this.log('Empty accounts during network change - ignoring');
                return; // Don't disconnect during network changes
            }
            
            // User disconnected
            this.disconnect();
        } else if (accounts[0] !== this.address) {
            const wasDisconnected = !this.address;
            
            // User switched accounts or reconnected
            this.address = accounts[0];
            
            // Re-initialize provider/signer if reconnecting after disconnect
            if (wasDisconnected && window.ethereum) {
                this.log('Re-initializing provider and signer after reconnection');
                try {
                    this.provider = new ethers.providers.Web3Provider(window.ethereum);
                    this.signer = this.provider.getSigner();
                    this.chainId = (await this.provider.getNetwork()).chainId;
                    
                    // Detect wallet type: prioritize specific wallet flags, fallback to metamask/injected
                    this.walletType = window.ethereum.isTrust ? 'trust' : 
                                     window.ethereum.isCoinbaseWallet ? 'coinbase' :
                                     window.ethereum.isBraveWallet ? 'brave' :
                                     window.ethereum.isMetaMask ? 'metamask' : 'injected';
                } catch (error) {
                    this.logError('Failed to re-initialize provider/signer:', error);
                }
            }
            
            this.storeConnectionInfo();
            
            this.notifyListeners('accountChanged', {
                address: this.address,
                chainId: this.chainId
            });
        }
    }

    /**
     * Handle chain changed event
     */
    handleChainChanged(chainId) {
        const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 16) : chainId;
        this.log('Chain changed:', numericChainId);

        this.chainId = numericChainId;
        this.storeConnectionInfo();

        this.notifyListeners('chainChanged', {
            address: this.address,
            chainId: this.chainId
        });
    }

    /**
     * Handle disconnect event
     */
    handleDisconnect(code, reason) {
        this.log('Disconnect event - code:', code, 'reason:', reason);
        
        // Don't disconnect if we still have an address (likely a network change)
        // MetaMask sometimes fires disconnect during network switches
        if (this.address) {
            this.log('Disconnect during network change - ignoring');
            return;
        }
        
        this.disconnect();
    }

    /**
     * Notify all listeners of events and dispatch DOM events
     */
    notifyListeners(event, data) {
        // Notify registered listeners
        this.listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                this.logError('Listener callback error:', error);
            }
        });

        // Dispatch DOM events for global listening
        try {
            let eventName;
            switch (event) {
                case 'connected':
                    eventName = 'walletConnected';
                    break;
                case 'disconnected':
                    eventName = 'walletDisconnected';
                    break;
                case 'accountChanged':
                    eventName = 'walletAccountChanged';
                    break;
                case 'chainChanged':
                    eventName = 'walletChainChanged';
                    break;
                default:
                    eventName = `wallet${event.charAt(0).toUpperCase() + event.slice(1)}`;
            }

            document.dispatchEvent(new CustomEvent(eventName, {
                detail: { event, data }
            }));

            console.log(`📡 Dispatched ${eventName} event:`, data);

        } catch (error) {
            this.logError('Failed to dispatch DOM event:', error);
        }
    }

    /**
     * Cleanup event listeners
     */
    cleanup() {
        this.eventListeners.forEach(({ target, event, handler }) => {
            target.removeListener(event, handler);
        });
        this.eventListeners = [];
        this.listeners.clear();
    }

    /**
     * Logging utility
     */
    log(...args) {
        try {
            if (window.CONFIG?.DEV?.DEBUG_MODE) {
                if (window.safeConsole) {
                    window.safeConsole.log('[WalletManager]', ...args);
                } else {
                    console.log('[WalletManager]', ...args);
                }
            }
        } catch (error) {
            // Fallback - do nothing if logging fails
        }
    }

    /**
     * Error logging utility
     */
    logError(...args) {
        try {
            if (window.safeConsole) {
                window.safeConsole.error('[WalletManager]', ...args);
            } else {
                console.error('[WalletManager]', ...args);
            }
        } catch (error) {
            // Fallback - do nothing if logging fails
        }
    }
}

// Export the class to global scope
window.WalletManager = WalletManager;

} // End of duplicate prevention guard
