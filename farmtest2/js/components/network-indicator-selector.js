/**
 * Network Indicator Selector Component
 * Consolidated component for network status indicators and network switching
 * Combines functionality from network-indicator.js and network-selector.js
 */

/**
 * Network Selector Component
 * Provides a dropdown to switch between different networks
 * Delegates network switching to NetworkManager to avoid duplication
 */
class NetworkSelector {
    constructor() {
        this.onNetworkChange = null;
        this.isInitialized = false;
        this.eventListeners = new Map(); // Store event listeners for cleanup
        this._networkSwitching = false; // Track network switching state
        this.defaultNetwork = 'AMOY';
    }

    getSelectedNetworkKey() {
        const selectedNetworkKey = localStorage.getItem('liberdus-selected-network')
        if (!selectedNetworkKey) {
            localStorage.setItem('liberdus-selected-network', this.defaultNetwork);
            return this.defaultNetwork;
        }
        return selectedNetworkKey;
    }

    /**
     * Load selected network from localStorage and initialize if needed
     * @param {string} defaultNetwork - The default network key to use if no network is selected
     * @returns {string|null} Active network key
     */
    loadSelectedNetwork() {
        const selectedNetworkKey = this.getSelectedNetworkKey();
        if (selectedNetworkKey && window.CONFIG?.NETWORKS[selectedNetworkKey]) {
            console.log(`🔄 Loaded network from storage: ${window.CONFIG.NETWORKS[selectedNetworkKey].NAME}`);
            return selectedNetworkKey;
        }


        console.error('❌ No valid default network configured');
        return null;
    }

    /**
     * Switch to a different network
     * @param {string} networkKey - The network key to switch to
     * @returns {boolean} Success status
     */
    switchNetwork(networkKey) {
        const targetNetwork = window.CONFIG?.NETWORKS[networkKey];
        if (targetNetwork) {
            localStorage.setItem('liberdus-selected-network', networkKey);
            console.log(`🌐 Switched to ${targetNetwork.NAME} network`);
            return true;
        }

        console.error(`❌ Network ${networkKey} not found`);
        return false;
    }

    /**
     * Initialize the network selector
     * @param {Function} onNetworkChange - Callback when network changes
     */
    init(onNetworkChange = null) {
        this.onNetworkChange = onNetworkChange;
        this.isInitialized = true;
        console.log('🌐 Network selector initialized');
        
        // Attach event handlers to any existing network selectors
        document.querySelectorAll('.network-selector').forEach(selector => {
            this.attachEventHandlers(selector, selector.classList.contains('admin') ? 'admin' : 'home');
        });
    }

    /**
     * Create network selector dropdown HTML
     * @param {string} containerId - ID of the container to add the selector to
     * @param {string} context - Context for styling ('home' or 'admin')
     */
    createSelector(containerId, context = 'home') {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`❌ Container ${containerId} not found`);
            return;
        }

        const selector = document.createElement('div');
        selector.className = `network-selector ${context}`;
        selector.innerHTML = this.getSelectorHTML();
        container.appendChild(selector);
        
        this.attachEventHandlers(selector, context);
        console.log(`🌐 Network selector added to ${containerId}`);
    }

    /**
     * Get the HTML for the network selector dropdown
     */
    getSelectorHTML() {
        const networks = Object.entries(window.CONFIG.NETWORKS);
        const selectedNetwork = this.getSelectedNetworkKey();
        
        return `
            <div class="network-select-wrapper">
                <select id="network-select" class="network-select">
                    ${networks.map(([key, network]) => `
                        <option value="${key}" ${key === selectedNetwork ? 'selected' : ''}>
                            ${network.NAME}
                        </option>
                    `).join('')}
                </select>
            </div>
        `;
    }

    /**
     * Attach event handlers to the selector
     * @param {HTMLElement} selector - The selector element
     * @param {string} context - Context for the change handler
     */
    attachEventHandlers(selector, context) {
        const select = selector.querySelector('#network-select');
        if (!select) {
            console.error('❌ Network select element not found in selector');
            return;
        }

        // Remove any existing event listener
        const selectId = select.id || 'network-select';
        if (this.eventListeners.has(selectId)) {
            select.removeEventListener('change', this.eventListeners.get(selectId));
        }
        
        // Create and store new event listener
        const listener = (event) => {
            this.handleNetworkChange(event.target.value, context);
        };
        
        this.eventListeners.set(selectId, listener);
        select.addEventListener('change', listener);
    }

    /**
     * Handle network change
     * @param {string} networkKey - The selected network key
     * @param {string} context - Context ('home' or 'admin')
     */
    async handleNetworkChange(networkKey, context) {
        console.log(`🌐 Switching to ${networkKey} network...`);
        
        this._networkSwitching = true;
        
        // Show skeleton table immediately when switching networks (for home page)
        if (window.homePage && context === 'home') {
            window.homePage.loading = true;
            window.homePage.pairs = []; // Clear existing pairs
            window.homePage.error = null;
            window.homePage.render(); // Show skeleton immediately
        }
        
        // Hide admin button immediately when switching networks
        if (window.homePage?.hideAdminButton) {
            window.homePage.hideAdminButton();
        }

        try {
            const success = this.switchNetwork(networkKey);
            if (!success) {
                console.error(`❌ Failed to switch to ${networkKey}`);
                return;
            }

            // Switch contract manager to new network
            if (window.contractManager?.switchNetwork) {
                try {
                    await window.contractManager.switchNetwork(networkKey);
                } catch (error) {
                    console.error('❌ Error switching contract manager:', error);
                }
            }
        } finally {
            // Clear network switching flag immediately after contract operations complete
            this._networkSwitching = false;
        }

        // If wallet is not connected, just update the UI
        const isWalletConnected = window.walletManager && window.walletManager.isConnected();
        if (!isWalletConnected) {
            // Update UI to show the selected network
            this.updateNetworkDisplay();
            
            // Still trigger network change callback to refresh data
            if (this.onNetworkChange) {
                try {
                    await this.onNetworkChange(networkKey, context);
                } catch (error) {
                    console.error('❌ Error in network change callback:', error);
                }
            }
            return;
        }

        // If wallet is connected, try to switch to the selected network
        await this.switchWalletToNetwork(networkKey);

        // Trigger network change callback if provided
        if (this.onNetworkChange) {
            try {
                await this.onNetworkChange(networkKey, context);
            } catch (error) {
                console.error('❌ Error in network change callback:', error);
            }
        }

        // Update UI elements that show network info
        this.updateNetworkDisplay();
    }

    /**
     * Update network display elements
     */
    updateNetworkDisplay() {
        // Update the selector value if it exists
        const selector = document.getElementById('network-select');
        if (selector) {
            selector.value = this.getSelectedNetworkKey();
        }
    }

    /**
     * Get current network configuration (replaces CONFIG.NETWORK getter)
     * @returns {object|undefined} Network configuration object or undefined
     */
    getCurrentNetworkConfig() {
        const selectedNetwork = this.getSelectedNetworkKey();
        return window.CONFIG?.NETWORKS[selectedNetwork] ?? undefined;
    }

    /**
     * Get current network contracts (replaces CONFIG.CONTRACTS getter)
     * @returns {object|undefined} Contracts object or undefined
     */
    getCurrentContracts() {
        const selectedNetwork = this.getSelectedNetworkKey();
        return window.CONFIG?.NETWORKS[selectedNetwork]?.CONTRACTS;
    }

    /**
     * Get current network name
     * @returns {string|undefined} Network name or undefined
     */
    getCurrentNetworkName() {
        return this.getCurrentNetworkConfig()?.NAME;
    }

    /**
     * Get current network chain ID
     * @returns {number|undefined} Chain ID or undefined
     */
    getCurrentChainId() {
        return this.getCurrentNetworkConfig()?.CHAIN_ID;
    }

    /**
     * Get staking contract address for current network
     * @returns {string|undefined} Staking contract address or undefined
     */
    getStakingContractAddress() {
        return this.getCurrentContracts()?.STAKING_CONTRACT;
    }

    /**
     * Get native currency for current network
     * @returns {object|undefined} Native currency object or undefined
     */
    getCurrentNativeCurrency() {
        return this.getCurrentNetworkConfig()?.NATIVE_CURRENCY;
    }

    /**
     * Check if network is currently switching
     * @returns {boolean} True if network is switching
     */
    isNetworkSwitching() {
        return this._networkSwitching;
    }

    /**
     * Switch wallet to the selected network
     * Delegates to NetworkManager to avoid duplication
     * @param {string} networkKey - The network key to switch to
     */
    async switchWalletToNetwork(networkKey) {
        try {
            // Switch localStorage to target network for NetworkManager
            localStorage.setItem('liberdus-selected-network', networkKey);
            
            // Use NetworkManager's switchNetwork method
            await window.networkManager.switchNetwork();
            
            // On success, keep the new network selected (already in localStorage)
            return true;
        } catch (error) {
            console.error(`❌ Failed to switch to ${networkKey}:`, error);
            
            // If the network is not added to MetaMask, try to add it
            if (error.code === 4902) {
                console.log(`🔗 Network ${networkKey} not found in MetaMask, attempting to add it...`);
                return await this.addNetworkToMetaMask(networkKey);
            }
            
            return false;
        }
    }

    /**
     * Add network to MetaMask and switch to it
     * Delegates to NetworkManager.addNetwork()
     * @param {string} networkKey - The network key to add
     */
    async addNetworkToMetaMask(networkKey) {
        try {
            // Switch localStorage to target network for NetworkManager
            localStorage.setItem('liberdus-selected-network', networkKey);
            
            // Use NetworkManager's addNetwork method
            await window.networkManager.addNetwork();
            
            // On success, keep the new network selected (already in localStorage)
            return true;
        } catch (addError) {
            console.error(`❌ Failed to add network to MetaMask:`, addError);
            return false;
        }
    }

    /**
     * Add network to MetaMask and reload the page
     * @param {string} networkKey - The network key to add
     */
    async addNetworkToMetaMaskAndReload(networkKey) {
        try {
            await this.addNetworkToMetaMask(networkKey);
            window.location.reload();
        } catch (error) {
            console.error(`Failed to add ${networkKey}:`, error);
        }
    }
}

/**
 * Network Indicator Component
 * Shared component for displaying network status and permissions
 * Used by both home page and admin page to reduce duplication
 */
class NetworkIndicator {
    /**
     * Update network indicator for a given context
     * @param {string} indicatorId - ID of the indicator element
     * @param {string} selectorId - ID of the network selector container
     * @param {string} context - 'home' or 'admin'
     */
    static async update(indicatorId, selectorId, context = 'home') {
        const indicator = document.getElementById(indicatorId);
        if (!indicator) return;

        // Always show the network indicator
        indicator.style.display = 'flex';

        // Show loading state initially
        indicator.innerHTML = `
            <span class="network-status-dot gray"></span>
            <div id="${selectorId}"></div>
        `;
        indicator.className = `network-indicator-home loading`;

        const isWalletConnected = window.walletManager && window.walletManager.isConnected();

        // Check permission asynchronously if wallet is connected
        if (isWalletConnected && window.networkManager) {
            try {
                const hasPermission = await window.networkManager.hasRequiredNetworkPermission();

                if (hasPermission) {
                    // Green indicator - has permission
                    indicator.innerHTML = `
                        <span class="network-status-dot green"></span>
                        <div id="${selectorId}"></div>
                    `;
                    indicator.className = `network-indicator-home has-permission`;
                } else {
                    // Red indicator - missing permission
                    indicator.innerHTML = `
                        <span class="network-status-dot red"></span>
                        <div id="${selectorId}"></div>
                    `;
                    indicator.className = `network-indicator-home missing-permission`;
                }
            } catch (error) {
                console.error('Error checking network permission:', error);
                // Fallback to no permission state
                indicator.innerHTML = `
                    <span class="network-status-dot red"></span>
                    <div id="${selectorId}"></div>
                `;
                indicator.className = `network-indicator-home missing-permission`;
            }
        } else {
            // No wallet connected - show network selector only
            indicator.innerHTML = `
                <span class="network-status-dot gray"></span>
                <div id="${selectorId}"></div>
            `;
            indicator.className = `network-indicator-home no-wallet`;
        }

        // Add network selector after DOM update
        setTimeout(() => {
            const container = document.getElementById(selectorId);
            if (container && window.networkSelector) {
                container.innerHTML = '';
                window.networkSelector.createSelector(selectorId, context);
            }
        }, 100);
    }
}

// Create global instances
window.networkSelector = new NetworkSelector();
window.NetworkIndicator = NetworkIndicator;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NetworkSelector, NetworkIndicator };
}
