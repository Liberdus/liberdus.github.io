/**
 * NetworkManager - Handles network switching and validation
 * Manages different blockchain networks and switching between them
 */
const NETWORK_MANAGER_SCRIPT_SRC = typeof window !== 'undefined' ? window.document?.currentScript?.src || '' : '';
let chainAdapterPromise = null;

function chainAdapterUrl() {
    if (NETWORK_MANAGER_SCRIPT_SRC) {
        return new URL('../../vendor/liberdus-wallet-module/adapters/chain.js', NETWORK_MANAGER_SCRIPT_SRC).href;
    }
    return '../../vendor/liberdus-wallet-module/adapters/chain.js';
}

async function loadChainAdapter() {
    if (!chainAdapterPromise) {
        chainAdapterPromise = import(chainAdapterUrl());
    }
    return chainAdapterPromise;
}

class NetworkManager {
    constructor() {
        this.currentNetwork = null;
        this.listeners = new Set();
        this.permissionListenersBound = false;
        
        this.init();
    }

    /**
     * Initialize network manager
     */
    init() {
        this.log('NetworkManager initialized');

        document.addEventListener('walletConnected', (event) => {
            this.handleNetworkChange(event.detail?.data?.chainId);
        });
        document.addEventListener('walletChainChanged', (event) => {
            this.handleNetworkChange(event.detail?.data?.chainId);
        });
    }

    /**
     * Check if wallet is on the required network (synchronous chainId comparison)
     * ⚠️ NETWORK CHECK ONLY - does not request wallet permissions.
     * Only compares chainId values.
     * For permission checks, use hasRequiredNetworkPermission()
     * @param {number} chainId - Chain ID to check (defaults to current)
     * @returns {boolean} True if on required network (chainId match)
     */
    isOnRequiredNetwork(chainId = null) {
        const targetChainId = chainId || this.getCurrentChainId();
        const currentChainId = window.networkSelector?.getCurrentChainId();
        return targetChainId === currentChainId;
    }

    /**
     * Check if we have required network permission (async with RPC calls)
     * @returns {Promise<boolean>} True if has permission for required network
     */
    async hasRequiredNetworkPermission() {
        if (!window.walletManager?.isConnected()) return false;

        const provider = this.getWalletProvider();
        if (!provider) return false;

        const currentChainId = await provider.request({ method: 'eth_chainId' });
        return currentChainId === this.getChainIdHex();
    }

    /**
     * Get current chain ID from wallet
     */
    getCurrentChainId() {
        return window.walletManager?.getChainId() || null;
    }

    getWalletProvider() {
        if (!window.walletManager?.isConnected()) return null;
        return window.walletManager.getEip1193Provider();
    }

    /**
     * Get network information by chain ID
     * Returns network info if chainId matches configured network, null otherwise
     */
    getNetworkInfo(chainId) {
        const network = window.networkSelector?.getCurrentNetworkConfig();
        if (chainId === network?.CHAIN_ID) {
            return {
                chainId: network.CHAIN_ID,
                name: network.NAME,
                rpcUrl: network.RPC_URL,
                blockExplorer: network.BLOCK_EXPLORER,
                nativeCurrency: network.NATIVE_CURRENCY
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

        const provider = this.getWalletProvider();
        if (!provider) throw new Error('No wallet provider available');

        const { switchOrAddEthereumChain } = await loadChainAdapter();
        await switchOrAddEthereumChain(provider, this.buildNetworkConfig());
        await window.walletManager.sync?.();
        return true;
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
        const provider = this.getWalletProvider();
        if (!provider) throw new Error('No wallet provider available');

        const { switchEthereumChain } = await loadChainAdapter();
        await switchEthereumChain(provider, chainId);
    }

    /**
     * Add the configured network to wallet
     */
    async addNetwork() {
        const provider = this.getWalletProvider();
        if (!provider) throw new Error('No wallet provider available');

        const networkConfig = this.buildNetworkConfig();
        const networkName = window.networkSelector?.getCurrentNetworkName();

        try {
            const { addEthereumChain } = await loadChainAdapter();
            await addEthereumChain(provider, networkConfig);
            
            this.log('Network added successfully:', networkName);
        } catch (error) {
            // Error code 4902 means the chain has not been added
            if (error.code === 4902) {
                throw new Error(`Failed to add ${networkName} network to wallet`);
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
        const networkName = window.networkSelector?.getCurrentNetworkName();

        if (!chainId || !isCorrect) {
            // Show warning
            warningElement.style.display = 'block';
            
            const messageElement = warningElement.querySelector('.warning-message');
            if (messageElement) {
                if (!chainId) {
                    messageElement.textContent = 'Please connect your wallet';
                } else {
                    messageElement.textContent = `Please switch to ${networkName}`;
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
            isCorrect: this.isOnRequiredNetwork(chainId),
            configuredNetwork: this.getNetworkInfo(window.networkSelector?.getCurrentChainId())
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
        const network = window.networkSelector?.getCurrentNetworkConfig();
        
        if (!network) {
            errors.push('No network configuration found (network not selected)');
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
        const chainId = window.networkSelector?.getCurrentChainId();
        return chainId ? '0x' + chainId.toString(16) : null;
    }

    /**
     * Build wallet-ready network configuration
     * Transforms app-config.js format to wallet_addEthereumChain metadata
     * @returns {object} Network configuration for wallet_addEthereumChain
     */
    buildNetworkConfig() {
        const network = window.networkSelector?.getCurrentNetworkConfig();
        if (!network) {
            throw new Error('Network configuration not found');
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
            56: 'BNB Smart Chain',
            97: 'BNB Smart Chain Testnet',
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
     * This switches or adds the network in the connected wallet.
     * @returns {Promise<boolean>} True if permission granted
     */
    async requestNetworkPermission() {
        try {
            return await this.requestSelectedWalletNetwork();
        } catch (error) {
            const networkName = window.networkSelector?.getCurrentNetworkName();
            console.error(`Failed to request ${networkName} permission:`, error);
            throw error;
        }
    }

    /**
     * Request selected wallet network permission
     * @private
     * @returns {Promise<boolean>}
     */
    async requestSelectedWalletNetwork() {
        const networkName = window.networkSelector?.getCurrentNetworkName();
        console.log(`🔐 Requesting ${networkName} network permission...`);
        await this.switchNetwork();
        return true;
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
            const networkName = window.networkSelector?.getCurrentNetworkName();

            // Request permission using modern approach
            await this.requestNetworkPermission();

            // Update UI based on context
            if (context === 'admin' && window.NetworkIndicator) {
                window.NetworkIndicator.update('network-indicator-home', 'admin-network-selector', 'admin');
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
            const networkName = window.networkSelector?.getCurrentNetworkName();
            const errorMessage = `Failed to get network permission. Please grant permission for ${networkName} network in your wallet.`;
            
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
        if (this.permissionListenersBound) return;
        
        console.log('🔍 Setting up permission change listener...');

        document.addEventListener('walletDisconnected', () => {
            console.log('🔌 Wallet disconnected - switching to read-only mode');
            this.handleWalletDisconnected();
        });

        document.addEventListener('walletAccountChanged', async () => {
            console.log('🔐 Account changed, checking permissions...');
            await this.checkAndUpdatePermissionState();
        });

        document.addEventListener('walletChainChanged', async () => {
            console.log('🌐 Network changed, checking permissions...');
            await this.checkAndUpdatePermissionState();
        });
        
        this.permissionListenersBound = true;
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
            const currentChainId = window.walletManager?.getChainId?.() || null;
            const network = window.networkSelector?.getCurrentNetworkConfig();
            const expectedChainId = network?.CHAIN_ID;
            
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
                    window.notificationManager.success(`${network?.NAME} permission confirmed. You can now make transactions.`);
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
            window.NetworkIndicator.update('network-indicator-home', 'admin-network-selector', 'admin');
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
