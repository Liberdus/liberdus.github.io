/**
 * Network Indicator Selector Component
 * Consolidated component for network status, permissions, and network switching
 * Combines functionality from network-indicator.js, network-selector.js, and permission-utils.js
 */

/**
 * Permission Utilities
 * Shared functions for permission button text and actions
 */
class PermissionUtils {
    /**
     * Get the appropriate button text for permission buttons
     * @param {string} networkName - The network name
     * @returns {string} - The button text
     */
    static getPermissionButtonText(networkName) {
        // For Polygon Mainnet, show "Add Polygon Mainnet" since it's likely not in MetaMask
        if (networkName === 'Polygon Mainnet') {
            return 'Add Polygon';
        }
        // For other networks, show "Grant [Network] Permission"
        return `Grant ${networkName} Permission`;
    }

    /**
     * Get the appropriate button action for permission buttons
     * @param {string} networkName - The network name
     * @param {string} context - Context ('home' or 'admin')
     * @returns {string} - The button action
     */
    static getPermissionButtonAction(networkName, context = 'home') {
        // For Polygon Mainnet, add network to MetaMask
        if (networkName === 'Polygon Mainnet') {
            return 'window.networkSelector.addNetworkToMetaMaskAndReload("POLYGON_MAINNET")';
        }
        // For other networks, use the standard permission request
        return `window.networkManager.requestPermissionWithUIUpdate('${context}')`;
    }

    /**
     * Get the appropriate button title for permission buttons
     * @param {string} networkName - The network name
     * @returns {string} - The button title
     */
    static getPermissionButtonTitle(networkName) {
        // For Polygon Mainnet, show "Add Polygon Mainnet to MetaMask"
        if (networkName === 'Polygon Mainnet') {
            return 'Add Polygon to MetaMask';
        }
        // For other networks, show "Grant permission for [Network]"
        return `Grant permission for ${networkName}`;
    }
}

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
        
        return `
            <div class="network-select-wrapper">
                <select id="network-select" class="network-select">
                    ${networks.map(([key, network]) => `
                        <option value="${key}" ${key === window.CONFIG.SELECTED_NETWORK ? 'selected' : ''}>
                            ${network.NAME}
                        </option>
                    `).join('')}
                </select>
                <span class="network-select-chevron">▼</span>
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
        
        // Hide admin button immediately when switching networks
        if (window.homePage?.hideAdminButton) {
            window.homePage.hideAdminButton();
        }

        try {
            // Switch network in config
            const success = window.CONFIG.switchNetwork(networkKey);
            if (!success) {
                console.error(`❌ Failed to switch to ${networkKey}`);
                return;
            }

            // Update the network name display immediately
            this.updateNetworkNameDisplay(networkKey, context);

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
            selector.value = window.CONFIG.SELECTED_NETWORK;
        }
    }

    /**
     * Update the network name display immediately
     * @param {string} networkKey - The selected network key
     * @param {string} context - Context ('home' or 'admin')
     */
    updateNetworkNameDisplay(networkKey, context) {
        const networkName = window.CONFIG.NETWORKS[networkKey]?.NAME || networkKey;        
        console.log(`📝 Updated network name display to: ${networkName}`);
    }

    /**
     * Get available networks for display
     */
    getAvailableNetworks() {
        return Object.entries(window.CONFIG.NETWORKS).map(([key, network]) => ({
            key,
            name: network.NAME,
            chainId: network.CHAIN_ID
        }));
    }

    /**
     * Check if a network is available
     * @param {string} networkKey - Network key to check
     */
    isNetworkAvailable(networkKey) {
        return !!window.CONFIG.NETWORKS[networkKey];
    }

    /**
     * Get current selected network info
     */
    getCurrentNetwork() {
        return {
            key: window.CONFIG.SELECTED_NETWORK,
            name: window.CONFIG.NETWORK.NAME,
            chainId: window.CONFIG.NETWORK.CHAIN_ID
        };
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
        // Store the original network
        const originalNetwork = window.CONFIG.SELECTED_NETWORK;
        
        try {
            // Temporarily switch config to target network for NetworkManager
            window.CONFIG.SELECTED_NETWORK = networkKey;
            
            // Use NetworkManager's switchNetwork method
            await window.networkManager.switchNetwork();
            
            // On success, keep the new network selected
            return true;
        } catch (error) {
            console.error(`❌ Failed to switch to ${networkKey}:`, error);
            
            // Restore original network on error
            window.CONFIG.SELECTED_NETWORK = originalNetwork;
            
            // If the network is not added to MetaMask, try to add it
            if (error.code === 4902) {
                console.log(`🔗 Network ${networkKey} not found in MetaMask, attempting to add it...`);
                return await this.addNetworkToMetaMask(window.CONFIG.NETWORKS[networkKey]);
            }
            
            return false;
        }
    }

    /**
     * Add network to MetaMask and switch to it
     * Delegates to NetworkManager.addNetwork()
     * @param {string|Object} networkKeyOrObject - The network key or network object
     */
    async addNetworkToMetaMask(networkKeyOrObject) {
        // Store the original network
        const originalNetwork = window.CONFIG.SELECTED_NETWORK;
        
        try {
            let networkKey;
            
            // Handle both network key string and network object
            if (typeof networkKeyOrObject === 'string') {
                networkKey = networkKeyOrObject;
            } else {
                // Find the network key from the network object
                networkKey = Object.keys(window.CONFIG.NETWORKS).find(
                    key => window.CONFIG.NETWORKS[key] === networkKeyOrObject
                );
            }
            
            // Temporarily switch config to target network
            if (networkKey) {
                window.CONFIG.SELECTED_NETWORK = networkKey;
            }
            
            // Use NetworkManager's addNetwork method
            await window.networkManager.addNetwork();
            
            return true;
        } catch (addError) {
            console.error(`❌ Failed to add network to MetaMask:`, addError);
            
            // Restore original network on error
            window.CONFIG.SELECTED_NETWORK = originalNetwork;
            
            return false;
        } finally {
            // Restore the config
            window.CONFIG.SELECTED_NETWORK = originalNetwork;
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
        const expectedNetworkName = window.CONFIG?.NETWORK?.NAME || 'Unknown';

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
                    const buttonText = window.PermissionUtils?.getPermissionButtonText(expectedNetworkName) || `Grant ${expectedNetworkName} Permission`;
                    const buttonAction = window.PermissionUtils?.getPermissionButtonAction(expectedNetworkName, context) || `window.networkManager.requestPermissionWithUIUpdate('${context}')`;
                    
                    indicator.innerHTML = `
                        <span class="network-status-dot red"></span>
                        <div id="${selectorId}"></div>
                        <button class="btn-grant-permission" onclick="${buttonAction}">
                            ${buttonText}
                        </button>
                    `;
                    indicator.className = `network-indicator-home missing-permission`;
                }
            } catch (error) {
                console.error('Error checking network permission:', error);
                // Fallback to no permission state
                const buttonText = window.PermissionUtils?.getPermissionButtonText(expectedNetworkName) || `Grant ${expectedNetworkName} Permission`;
                const buttonAction = window.PermissionUtils?.getPermissionButtonAction(expectedNetworkName, context) || `window.networkManager.requestPermissionWithUIUpdate('${context}')`;
                
                indicator.innerHTML = `
                    <span class="network-status-dot red"></span>
                    <div id="${selectorId}"></div>
                    <button class="btn-grant-permission" onclick="${buttonAction}">
                        ${buttonText}
                    </button>
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
window.PermissionUtils = PermissionUtils;
window.networkSelector = new NetworkSelector();
window.NetworkIndicator = NetworkIndicator;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PermissionUtils, NetworkSelector, NetworkIndicator };
}
