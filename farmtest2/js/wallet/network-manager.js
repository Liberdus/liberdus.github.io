/**
 * NetworkManager - Handles network switching and validation
 * Manages different blockchain networks and switching between them
 */
class NetworkManager {
    constructor() {
        this.currentNetwork = null;
        this.listeners = new Set();
        
        this.init();
    }

    /**
     * Initialize network manager
     */
    init() {
        this.log('NetworkManager initialized');
        
        // Subscribe to wallet manager events
        if (window.walletManager) {
            window.walletManager.subscribe((event, data) => {
                if (event === 'connected' || event === 'chainChanged') {
                    this.handleNetworkChange(data.chainId);
                }
            });
        }
    }

    /**
     * Check if current network is supported
     */
    isNetworkSupported(chainId = null) {
        const targetChainId = chainId || this.getCurrentChainId();
        return targetChainId === window.CONFIG?.NETWORK?.CHAIN_ID;
    }

    /**
     * Check if wallet is on the required network (synchronous chainId comparison)
     * ⚠️ NETWORK CHECK ONLY - Does NOT verify MetaMask permissions
     * Only compares chainId values, not wallet_getPermissions
     * For permission checks, use hasRequiredNetworkPermission()
     * @param {number} chainId - Chain ID to check (defaults to current)
     * @returns {boolean} True if on required network (chainId match)
     */
    isOnRequiredNetwork(chainId = null) {
        const targetChainId = chainId || this.getCurrentChainId();
        return targetChainId === window.CONFIG?.NETWORK?.CHAIN_ID;
    }

    /**
     * Check if we have required network permission (async with RPC calls)
     * @returns {Promise<boolean>} True if has permission for required network
     */
    async hasRequiredNetworkPermission() {
        try {
            if (!window.ethereum) return false;

            // Check if wallet is connected to dApp
            const permissions = await window.ethereum.request({
                method: 'wallet_getPermissions'
            });

            if (!permissions.some(p => p.parentCapability === 'eth_accounts')) {
                return false; // Not connected to dApp
            }

            // Check if wallet is on the correct network for the selected app network
            const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
            const expectedChainIdHex = this.getChainIdHex();
            
            // If wallet is on wrong network, we need permission to switch
            if (currentChainId !== expectedChainIdHex) {
                console.log(`🔄 Wallet on chain ${currentChainId}, but app expects ${expectedChainIdHex}`);
                return false; // Need permission to switch networks
            }

            // Permission is granted if wallet is connected to dApp and on correct network
            return true;

        } catch (error) {
            console.error('Error checking wallet permissions:', error);
            return false;
        }
    }

    /**
     * Get current chain ID from wallet
     */
    getCurrentChainId() {
        return window.walletManager?.getChainId() || null;
    }

    /**
     * Get network information by chain ID
     * Returns network info if chainId matches configured network, null otherwise
     */
    getNetworkInfo(chainId) {
        if (chainId === window.CONFIG?.NETWORK?.CHAIN_ID) {
            return {
                chainId: window.CONFIG.NETWORK.CHAIN_ID,
                name: window.CONFIG.NETWORK.NAME,
                rpcUrl: window.CONFIG.NETWORK.RPC_URL,
                blockExplorer: window.CONFIG.NETWORK.BLOCK_EXPLORER,
                nativeCurrency: window.CONFIG.NETWORK.NATIVE_CURRENCY
            };
        }
        return null;
    }

    /**
     * Get current network information
     */
    getCurrentNetworkInfo() {
        const chainId = this.getCurrentChainId();
        return chainId ? this.getNetworkInfo(chainId) : null;
    }

    /**
     * Switch to the configured network
     */
    async switchNetwork() {
        if (!window.walletManager?.isConnected()) {
            throw new Error('Wallet not connected');
        }

        const chainId = window.CONFIG?.NETWORK?.CHAIN_ID;
        if (!chainId) {
            throw new Error('Network configuration not found');
        }

        try {
            this.log('Switching to network:', window.CONFIG.NETWORK.NAME);

            // Try to switch to the network
            await this.requestNetworkSwitch(chainId);
            
            this.log('Network switch successful');
            return true;

        } catch (error) {
            // If the network doesn't exist in wallet, try to add it
            if (error.code === 4902 || error.message.includes('Unrecognized chain ID')) {
                this.log('Network not found in wallet, attempting to add...');
                await this.addNetwork();
                return true;
            }
            
            this.logError('Network switch failed:', error);
            throw error;
        }
    }

    /**
     * Switch to default network (alias for switchNetwork)
     */
    async switchToDefaultNetwork() {
        return await this.switchNetwork();
    }

    /**
     * Request network switch via wallet
     */
    async requestNetworkSwitch(chainId) {
        const hexChainId = `0x${chainId.toString(16)}`;
        
        if (window.ethereum) {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: hexChainId }]
            });
        } else {
            throw new Error('No wallet provider available');
        }
    }

    /**
     * Add the configured network to wallet
     */
    async addNetwork() {
        if (!window.ethereum) {
            throw new Error('MetaMask not installed');
        }

        const networkConfig = this.buildNetworkConfig();
        const networkName = window.CONFIG?.NETWORK?.NAME || 'configured network';
        
        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [networkConfig]
            });
            
            this.log('Network added successfully:', networkName);
        } catch (error) {
            // Error code 4902 means the chain has not been added
            if (error.code === 4902) {
                throw new Error(`Failed to add ${networkName} network to MetaMask`);
            }
            
            // Error code -32602 means chain already added (can be ignored)
            if (error.code === -32602) {
                this.log(`${networkName} network already added`);
                return; // Success - network already exists
            }

            // User rejected
            if (error.code === 4001) {
                throw new Error(`User rejected adding ${networkName} network`);
            }

            // Other errors
            console.warn('Error adding network:', error);
            throw error;
        }
    }

    /**
     * Handle network change events
     */
    handleNetworkChange(chainId) {
        this.log('Network changed to:', chainId);
        
        const previousNetwork = this.currentNetwork;
        this.currentNetwork = chainId;
        
        // Notify listeners
        this.notifyListeners('networkChanged', {
            chainId,
            networkInfo: this.getNetworkInfo(chainId),
            isSupported: this.isNetworkSupported(chainId),
            isCorrect: this.isOnRequiredNetwork(chainId),
            previousNetwork
        });

        // Show network warning if needed
        this.updateNetworkWarning();
    }

    /**
     * Update network warning display
     */
    updateNetworkWarning() {
        const warningElement = document.getElementById('network-warning');
        if (!warningElement) return;

        const chainId = this.getCurrentChainId();
        const isCorrect = this.isOnRequiredNetwork(chainId);
        const isSupported = this.isNetworkSupported(chainId);

        if (!chainId || !isCorrect) {
            // Show warning
            warningElement.style.display = 'block';
            
            const messageElement = warningElement.querySelector('.warning-message');
            if (messageElement) {
                if (!chainId) {
                    messageElement.textContent = 'Please connect your wallet';
                } else if (!isSupported) {
                    messageElement.textContent = 'Unsupported network detected';
                } else {
                    messageElement.textContent = `Please switch to ${window.CONFIG?.NETWORK?.NAME || 'the configured network'}`;
                }
            }
        } else {
            // Hide warning
            warningElement.style.display = 'none';
        }
    }

    /**
     * Get network status
     */
    getNetworkStatus() {
        const chainId = this.getCurrentChainId();
        const networkInfo = this.getNetworkInfo(chainId);
        
        return {
            chainId,
            networkInfo,
            isConnected: !!chainId,
            isSupported: this.isNetworkSupported(chainId),
            isCorrect: this.isOnRequiredNetwork(chainId),
            configuredNetwork: this.getNetworkInfo(window.CONFIG?.NETWORK?.CHAIN_ID)
        };
    }

    /**
     * Subscribe to network events
     */
    subscribe(callback) {
        this.listeners.add(callback);
        
        // Return unsubscribe function
        return () => {
            this.listeners.delete(callback);
        };
    }

    /**
     * Notify all listeners of events
     */
    notifyListeners(event, data) {
        this.listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                this.logError('Listener callback error:', error);
            }
        });
    }

    /**
     * Get RPC URL for network
     */
    getRpcUrl(chainId = null) {
        const targetChainId = chainId || this.getCurrentChainId();
        const networkInfo = this.getNetworkInfo(targetChainId);
        return networkInfo?.rpcUrl || null;
    }

    /**
     * Get block explorer URL for network
     */
    getBlockExplorerUrl(chainId = null) {
        const targetChainId = chainId || this.getCurrentChainId();
        const networkInfo = this.getNetworkInfo(targetChainId);
        return networkInfo?.blockExplorer || null;
    }

    /**
     * Get transaction URL for block explorer
     */
    getTransactionUrl(txHash, chainId = null) {
        const explorerUrl = this.getBlockExplorerUrl(chainId);
        return explorerUrl ? `${explorerUrl}/tx/${txHash}` : null;
    }

    /**
     * Get address URL for block explorer
     */
    getAddressUrl(address, chainId = null) {
        const explorerUrl = this.getBlockExplorerUrl(chainId);
        return explorerUrl ? `${explorerUrl}/address/${address}` : null;
    }

    /**
     * Validate network configuration
     */
    validateNetworkConfig() {
        const errors = [];
        const network = window.CONFIG?.NETWORK;
        
        if (!network) {
            errors.push('No network configuration found (CONFIG.NETWORK is missing)');
        } else {
            if (!network.CHAIN_ID) {
                errors.push('Missing CHAIN_ID in network configuration');
            }
            if (!network.NAME) {
                errors.push('Missing NAME in network configuration');
            }
            if (!network.RPC_URL) {
                errors.push('Missing RPC_URL in network configuration');
            }
            if (!network.BLOCK_EXPLORER) {
                errors.push('Missing BLOCK_EXPLORER in network configuration');
            }
            if (!network.NATIVE_CURRENCY) {
                errors.push('Missing NATIVE_CURRENCY in network configuration');
            }
        }

        if (errors.length > 0) {
            this.logError('Network configuration errors:', errors);
            return false;
        }

        return true;
    }

    /**
     * Get the configured chain ID in hex format
     * @returns {string} Chain ID in hex (e.g., '0x13882')
     */
    getChainIdHex() {
        const chainId = window.CONFIG?.NETWORK?.CHAIN_ID;
        return chainId ? '0x' + chainId.toString(16) : null;
    }

    /**
     * Build wallet-ready network configuration
     * Transforms app-config.js format to MetaMask's expected format
     * @returns {object} Network configuration for wallet_addEthereumChain
     */
    buildNetworkConfig() {
        const network = window.CONFIG?.NETWORK;
        if (!network) {
            throw new Error('Network configuration not found in CONFIG.NETWORK');
        }
        
        const hexChainId = '0x' + network.CHAIN_ID.toString(16);
        
        return {
            chainId: hexChainId,
            chainName: network.NAME,
            rpcUrls: [
                network.RPC_URL,
                ...(network.FALLBACK_RPCS || [])
            ],
            nativeCurrency: network.NATIVE_CURRENCY,
            blockExplorerUrls: [network.BLOCK_EXPLORER]
        };
    }

    /**
     * Get network name for a given chain ID
     * @param {number} chainId - Chain ID
     * @returns {string} Network name
     */
    getNetworkName(chainId) {
        if (!chainId) return 'Not Connected';
        
        const networks = {
            1: 'Ethereum Mainnet',
            5: 'Goerli',
            11155111: 'Sepolia',
            137: 'Polygon Mainnet',
            80001: 'Mumbai Testnet',
            80002: 'Amoy',
            31337: 'Localhost',
            59144: 'Linea'
        };
        return networks[chainId] || `Chain ${chainId}`;
    }

    /**
     * Request permission to use the configured network
     * This adds the network to MetaMask and ensures we can interact with it
     * @param {string} walletType - Type of wallet ('metamask', 'walletconnect')
     * @returns {Promise<boolean>} True if permission granted
     */
    async requestNetworkPermission(walletType = 'metamask') {
        try {
            if (walletType === 'metamask') {
                return await this._requestMetaMaskPermission();
            } else if (walletType === 'walletconnect') {
                // WalletConnect handles network permissions during connection
                console.log('WalletConnect permissions managed during connection');
                return true;
            } else {
                throw new Error(`Unsupported wallet type: ${walletType}`);
            }
        } catch (error) {
            const networkName = window.CONFIG?.NETWORK?.NAME || 'configured network';
            console.error(`Failed to request ${networkName} permission:`, error);
            throw error;
        }
    }

    /**
     * Request MetaMask-specific permission
     * @private
     * @returns {Promise<boolean>}
     */
    async _requestMetaMaskPermission() {
        if (!window.ethereum) {
            throw new Error('MetaMask not installed');
        }

        try {
            const networkName = window.CONFIG?.NETWORK?.NAME || 'configured network';
            console.log(`🔐 Requesting ${networkName} network permission...`);

            // First, ensure we have account permissions
            try {
                await window.ethereum.request({
                    method: 'wallet_requestPermissions',
                    params: [{ eth_accounts: {} }]
                });
            } catch (error) {
                // User might have rejected or already has permissions
                if (error.code === 4001) {
                    throw new Error('User rejected permission request');
                }
                // If error is "already processing", continue anyway
            }

            // Add configured network to MetaMask
            await this.addNetwork();
            return true;

        } catch (error) {
            console.error('❌ Failed to request MetaMask permission:', error);
            throw error;
        }
    }

    /**
     * Centralized permission request with UI updates
     * Replaces duplicate logic in admin/ and index.html
     * @param {string} context - 'admin' or 'home'
     * @returns {Promise<boolean>} Success status
     */
    async requestPermissionWithUIUpdate(context = 'admin', showNotification = true) {
        // Set flag for background permission checks
        this._showPermissionNotification = showNotification;
        try {
            const expectedChainId = window.CONFIG?.NETWORK?.CHAIN_ID;
            const networkName = this.getNetworkName(expectedChainId);

            // Request permission using modern approach
            await this.requestNetworkPermission('metamask');

            // Update UI based on context
            if (context === 'admin' && window.NetworkIndicator) {
                window.NetworkIndicator.update('network-indicator', 'admin-network-selector', 'admin');
            } else if (context === 'home' && window.NetworkIndicator) {
                await window.NetworkIndicator.update('network-indicator-home', 'home-network-selector', 'home');
            }

            // Show success notification only if requested
            if (showNotification) {
                const message = `${networkName} network permission granted`;
                if (context === 'admin') {
                    alert(`✅ ${message}! You can now use the admin panel.`);
                } else if (window.notificationManager) {
                    window.notificationManager.success(message);
                }
            }

            return true;
        } catch (error) {
            console.error('❌ Failed to get network permission:', error);
            const networkName = window.CONFIG?.NETWORK?.NAME || 'the configured network';
            const errorMessage = `Failed to get network permission. Please grant permission for ${networkName} network in MetaMask.`;
            
            if (context === 'admin') {
                alert(errorMessage);
            } else if (window.notificationManager) {
                window.notificationManager.error(errorMessage);
            }
            
            throw error;
        } finally {
            // Reset flag to ensure clean state between calls
            this._showPermissionNotification = false;
        }
    }

    /**
     * Logging utility
     */
    log(...args) {
        if (window.CONFIG.DEV.DEBUG_MODE) {
            console.log('[NetworkManager]', ...args);
        }
    }

    /**
     * Set up permission change listener to automatically update UI when permissions change
     * Centralized UI state management for network and permission changes
     */
    setupPermissionChangeListener() {
        if (!window.ethereum) return;
        
        console.log('🔍 Setting up permission change listener...');
        
        // Listen for account changes (permission removal)
        window.ethereum.on('accountsChanged', async (accounts) => {
            console.log('🔐 Account change detected:', accounts);
            
            if (!accounts || accounts.length === 0) {
                console.log('📊 Permission removed - switching to read-only mode');
                this.handlePermissionRemoved();
            } else {
                // Account reconnected, check permissions and update UI
                console.log('🔐 Account reconnected, checking permissions...');
                await this.checkAndUpdatePermissionState();
            }
        });
        
        // Listen for network changes
        window.ethereum.on('chainChanged', async (chainId) => {
            console.log('🌐 Network changed to:', chainId);
            await this.checkAndUpdatePermissionState();
        });
        
        // Listen for permission changes
        window.ethereum.on('disconnect', () => {
            console.log('🔌 Wallet disconnected - switching to read-only mode');
            this.handleWalletDisconnected();
        });
        
        console.log('✅ Permission change listener set up');
    }

    /**
     * Handle permission removal
     */
    handlePermissionRemoved() {
        // Notify contract manager to switch to read-only mode
        if (window.contractManager) {
            window.contractManager.signer = null;
            window.contractManager.transactionProvider = null;
        }
        
        // Update button states immediately
        this.updateButtonStates();
        
        // Update UI state
        this.updateUIState();
        
        // Show notification
        if (window.notificationManager) {
            window.notificationManager.info('Wallet permission was removed. Application is now in read-only mode.');
        }
    }

    /**
     * Handle wallet disconnection
     */
    handleWalletDisconnected() {
        // Notify contract manager to switch to read-only mode
        if (window.contractManager) {
            window.contractManager.signer = null;
            window.contractManager.transactionProvider = null;
        }
        
        // Update button states immediately
        this.updateButtonStates();
        
        // Update UI state
        this.updateUIState();
    }

    /**
     * Check permission state and update UI accordingly
     * Centralized permission checking with UI updates
     */
    async checkAndUpdatePermissionState() {
        try {
            console.log('🔍 Checking permission state...');
            
            // Check if we have permission for the selected network
            const hasPermission = await this.hasRequiredNetworkPermission();
            const currentChainId = window.ethereum ? parseInt(await window.ethereum.request({ method: 'eth_chainId' }), 16) : null;
            const expectedChainId = window.CONFIG?.NETWORK?.CHAIN_ID || 80002;
            
            console.log('Permission state:', { hasPermission, currentChainId, expectedChainId });
            
            if (hasPermission && currentChainId === expectedChainId) {
                // We have permission and are on the correct network
                console.log('✅ Permission confirmed, upgrading to transaction mode...');
                
                // Notify contract manager to ensure signer
                if (window.contractManager && typeof window.contractManager.ensureSigner === 'function') {
                    await window.contractManager.ensureSigner();
                }
                
                this.updateUIState();
                
                // Only show notification for explicit permission requests, not background checks
                if (window.notificationManager && this._showPermissionNotification) {
                    const networkName = window.CONFIG?.NETWORK?.NAME || 'the selected network';
                    window.notificationManager.success(`${networkName} permission confirmed. You can now make transactions.`);
                }
            } else {
                // No permission or wrong network
                console.log('❌ No permission or wrong network, switching to read-only mode...');
                
                // Notify contract manager to switch to read-only mode
                if (window.contractManager) {
                    window.contractManager.signer = null;
                    window.contractManager.transactionProvider = null;
                }
                
                // Update button states immediately
                this.updateButtonStates();
                
                this.updateUIState();
            }
        } catch (error) {
            console.error('Error checking permission state:', error);
            
            // Notify contract manager to switch to read-only mode on error
            if (window.contractManager) {
                window.contractManager.signer = null;
                window.contractManager.transactionProvider = null;
            }
            
            // Update button states immediately
            this.updateButtonStates();
            
            this.updateUIState();
        }
    }

    /**
     * Update UI state based on current permission and network state
     * Centralized UI state management
     */
    updateUIState() {
        console.log('🔄 Updating UI state...');
        
        // ========================================
        // HOME-PAGE SPECIFIC UI UPDATES
        // ========================================
        
        // Update home-page network indicator
        if (window.homePage && window.NetworkIndicator) {
            window.NetworkIndicator.update('network-indicator-home', 'home-network-selector', 'home');
        }
        
        // Trigger home-page data refresh
        if (window.homePage && typeof window.homePage.loadStakingData === 'function') {
            window.homePage.loadStakingData();
        }
        
        // ========================================
        // ADMIN-PAGE SPECIFIC UI UPDATES
        // ========================================
        
        // Update admin network indicator
        if (window.adminPage && window.NetworkIndicator) {
            window.NetworkIndicator.update('network-indicator', 'admin-network-selector', 'admin');
        }
        
        // ========================================
        // CONTRACT-SPECIFIC UI UPDATES
        // ========================================
        
        // Update button states based on permission state
        this.updateButtonStates();
    }

    /**
     * Update button states based on current permission state
     * Centralized button state management for staking actions
     */
    updateButtonStates() {
        const hasSigner = !!window.contractManager?.signer;
        const isReadOnly = !hasSigner;
        
        console.log('🔘 Updating button states:', { hasSigner, isReadOnly });
        
        // Find all action buttons
        const actionButtons = document.querySelectorAll('button[data-pair-id], button[class*="btn-"]');
        
        actionButtons.forEach(button => {
            const buttonText = button.textContent.trim();
            
            // Check if this is a staking action button
            if (buttonText.includes('Stake') || buttonText.includes('Unstake') || 
                buttonText.includes('Claim') || buttonText.includes('redeem') || 
                buttonText.includes('share')) {
                
                if (isReadOnly) {
                    button.disabled = true;
                    button.classList.add('disabled');
                } else {
                    button.disabled = false;
                    button.classList.remove('disabled');
                }
            }
        });
        
        console.log(`✅ Button states updated: ${isReadOnly ? 'disabled' : 'enabled'}`);
    }

    /**
     * Error logging utility
     */
    logError(...args) {
        console.error('[NetworkManager]', ...args);
    }
}

// Create global instance
window.networkManager = new NetworkManager();
