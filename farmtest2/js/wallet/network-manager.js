/**
 * NetworkManager - Handles network switching and validation
 * Manages different blockchain networks and switching between them
 */
class NetworkManager {
    constructor() {
        this.currentNetwork = null;
        this.supportedNetworks = window.CONFIG.NETWORKS;
        this.defaultNetwork = window.CONFIG.DEFAULT_NETWORK;
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
        return Object.values(this.supportedNetworks).some(network => network.chainId === targetChainId);
    }

    /**
     * Check if current network is the default/required network
     */
    isCorrectNetwork(chainId = null) {
        const targetChainId = chainId || this.getCurrentChainId();
        return targetChainId === this.defaultNetwork;
    }

    /**
     * Get current chain ID from wallet
     */
    getCurrentChainId() {
        return window.walletManager?.getChainId() || null;
    }

    /**
     * Get network information by chain ID
     */
    getNetworkInfo(chainId) {
        return Object.values(this.supportedNetworks).find(network => network.chainId === chainId);
    }

    /**
     * Get current network information
     */
    getCurrentNetworkInfo() {
        const chainId = this.getCurrentChainId();
        return chainId ? this.getNetworkInfo(chainId) : null;
    }

    /**
     * Switch to a specific network
     */
    async switchNetwork(chainId) {
        if (!window.walletManager?.isConnected()) {
            throw new Error('Wallet not connected');
        }

        const networkInfo = this.getNetworkInfo(chainId);
        if (!networkInfo) {
            throw new Error(`Unsupported network: ${chainId}`);
        }

        try {
            this.log('Switching to network:', networkInfo.name);

            // Try to switch to the network
            await this.requestNetworkSwitch(chainId);
            
            this.log('Network switch successful');
            return true;

        } catch (error) {
            // If the network doesn't exist in wallet, try to add it
            if (error.code === 4902 || error.message.includes('Unrecognized chain ID')) {
                this.log('Network not found in wallet, attempting to add...');
                await this.addNetwork(chainId);
                return true;
            }
            
            this.logError('Network switch failed:', error);
            throw error;
        }
    }

    /**
     * Switch to default network
     */
    async switchToDefaultNetwork() {
        return await this.switchNetwork(this.defaultNetwork);
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
     * Add network to wallet
     */
    async addNetwork(chainId) {
        const networkInfo = this.getNetworkInfo(chainId);
        if (!networkInfo) {
            throw new Error(`Network configuration not found for chain ID: ${chainId}`);
        }

        const hexChainId = `0x${chainId.toString(16)}`;
        
        if (window.ethereum) {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: hexChainId,
                    chainName: networkInfo.name,
                    rpcUrls: [networkInfo.rpcUrl],
                    nativeCurrency: networkInfo.nativeCurrency,
                    blockExplorerUrls: [networkInfo.blockExplorer]
                }]
            });
            
            this.log('Network added successfully:', networkInfo.name);
        } else {
            throw new Error('No wallet provider available');
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
            isCorrect: this.isCorrectNetwork(chainId),
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
        const isCorrect = this.isCorrectNetwork(chainId);
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
                    const networkInfo = this.getNetworkInfo(this.defaultNetwork);
                    messageElement.textContent = `Please switch to ${networkInfo.name}`;
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
            isCorrect: this.isCorrectNetwork(chainId),
            defaultNetwork: this.getNetworkInfo(this.defaultNetwork)
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
        
        Object.entries(this.supportedNetworks).forEach(([key, network]) => {
            if (!network.chainId) {
                errors.push(`Missing chainId for network: ${key}`);
            }
            if (!network.name) {
                errors.push(`Missing name for network: ${key}`);
            }
            if (!network.rpcUrl) {
                errors.push(`Missing rpcUrl for network: ${key}`);
            }
            if (!network.blockExplorer) {
                errors.push(`Missing blockExplorer for network: ${key}`);
            }
            if (!network.nativeCurrency) {
                errors.push(`Missing nativeCurrency for network: ${key}`);
            }
        });

        if (errors.length > 0) {
            this.logError('Network configuration errors:', errors);
            return false;
        }

        return true;
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
     * Error logging utility
     */
    logError(...args) {
        console.error('[NetworkManager]', ...args);
    }
}

// Create global instance
window.networkManager = new NetworkManager();
