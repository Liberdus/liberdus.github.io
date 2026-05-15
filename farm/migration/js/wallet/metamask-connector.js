/**
 * MetaMask Connector
 * Handles MetaMask wallet connection and interactions
 */

class MetaMaskConnector {
    constructor() {
        this.isConnected = false;
        this.account = null;
        this.chainId = null;
        this.provider = null;
    }

    /**
     * Check if MetaMask is available
     */
    isAvailable() {
        return typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;
    }

    /**
     * Connect to MetaMask
     */
    async connect() {
        if (!this.isAvailable()) {
            throw new Error('MetaMask is not installed');
        }

        try {
            // Request account access
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            if (accounts.length === 0) {
                throw new Error('No accounts found');
            }

            this.account = accounts[0];
            this.isConnected = true;

            // Get chain ID
            this.chainId = await window.ethereum.request({
                method: 'eth_chainId'
            });

            // Create provider
            if (window.ethers) {
                this.provider = new ethers.providers.Web3Provider(window.ethereum);
            }

            // Set up event listeners
            this.setupEventListeners();

            return {
                account: this.account,
                chainId: this.chainId,
                provider: this.provider
            };

        } catch (error) {
            this.isConnected = false;
            throw error;
        }
    }

    /**
     * Disconnect from MetaMask
     */
    async disconnect() {
        this.isConnected = false;
        this.account = null;
        this.chainId = null;
        this.provider = null;
        
        // Remove event listeners
        if (window.ethereum) {
            window.ethereum.removeAllListeners();
        }
    }

    /**
     * Setup event listeners for MetaMask events
     */
    setupEventListeners() {
        if (!window.ethereum) return;

        // Account changed
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
                this.disconnect();
                document.dispatchEvent(new CustomEvent('walletDisconnected'));
            } else {
                this.account = accounts[0];
                document.dispatchEvent(new CustomEvent('accountsChanged', {
                    detail: { account: this.account }
                }));
            }
        });

        // Chain changed
        window.ethereum.on('chainChanged', (chainId) => {
            this.chainId = chainId;
            document.dispatchEvent(new CustomEvent('chainChanged', {
                detail: { chainId }
            }));
        });

        // Connection
        window.ethereum.on('connect', (connectInfo) => {
            this.chainId = connectInfo.chainId;
            document.dispatchEvent(new CustomEvent('walletConnected', {
                detail: { chainId: this.chainId }
            }));
        });

        // Disconnection
        window.ethereum.on('disconnect', (error) => {
            this.disconnect();
            document.dispatchEvent(new CustomEvent('walletDisconnected', {
                detail: { error }
            }));
        });
    }

    /**
     * Switch to a specific network
     */
    async switchNetwork(chainId) {
        if (!this.isAvailable()) {
            throw new Error('MetaMask is not available');
        }

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId }],
            });
        } catch (switchError) {
            // This error code indicates that the chain has not been added to MetaMask
            if (switchError.code === 4902) {
                throw new Error('Network not added to MetaMask');
            }
            throw switchError;
        }
    }

    /**
     * Add a network to MetaMask
     */
    async addNetwork(networkConfig) {
        if (!this.isAvailable()) {
            throw new Error('MetaMask is not available');
        }
        
        await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [networkConfig],
        });
    }

    /**
     * Get current account
     */
    getAccount() {
        return this.account;
    }

    /**
     * Get current chain ID
     */
    getChainId() {
        return this.chainId;
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
        return this.provider ? this.provider.getSigner() : null;
    }
}

// Global MetaMask connector instance
window.MetaMaskConnector = MetaMaskConnector;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MetaMaskConnector;
}
