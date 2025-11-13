/**
 * Wallet Popup Component - Matches React RainbowKit ConnectButton functionality
 * Shows wallet address, copy functionality, and disconnect option
 */

class WalletPopup {
    constructor() {
        this.isOpen = false;
        this.popupElement = null;
        this.balanceFetchToken = 0;
        this.walletEventsBound = false;
        this.boundWalletUpdateHandler = this.handleWalletUpdate.bind(this);
        this.boundWalletDisconnectHandler = this.handleWalletDisconnect.bind(this);
        this.init();
    }

    init() {
        this.createPopupContainer();
        this.attachGlobalClickListener();
        this.subscribeToWalletEvents();
        
        // Set global reference
        window.walletPopup = this;
        
        console.log('✅ Wallet popup initialized');
    }

    createPopupContainer() {
        // Create popup container if it doesn't exist
        if (!document.getElementById('wallet-popup-container')) {
            const container = document.createElement('div');
            container.id = 'wallet-popup-container';
            container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 10000;
            `;
            document.body.appendChild(container);
        }
    }

    show(buttonElement) {
        if (this.isOpen) {
            this.hide();
            return;
        }

        // Get wallet data
        const walletData = this.getWalletData();
        if (!walletData || !walletData.address) {
            console.warn('No wallet data available');
            return;
        }

        // Create popup HTML
        const popupHTML = this.createPopupHTML(walletData);
        
        // Get button position
        const buttonRect = buttonElement.getBoundingClientRect();
        
        // Create popup element
        const container = document.getElementById('wallet-popup-container');
        container.innerHTML = popupHTML;
        container.style.pointerEvents = 'auto';
        
        this.popupElement = container.querySelector('.wallet-popup');
        this.isOpen = true;
        
        // Position popup
        this.positionPopup(buttonRect);
        
        // Add event listeners
        this.attachEventListeners();

        // Load native balance display
        this.loadWalletBalance(walletData);
        
        // Show popup with animation
        this.animateIn();
    }

    hide() {
        if (!this.isOpen || !this.popupElement) return;
        
        this.balanceFetchToken++;
        
        this.animateOut(() => {
            const container = document.getElementById('wallet-popup-container');
            if (container) {
                container.innerHTML = '';
                container.style.pointerEvents = 'none';
            }
            this.popupElement = null;
            this.isOpen = false;
        });
    }

    getWalletData() {
        try {
            // Try multiple wallet manager sources
            const walletManager = window.walletManager || window.WalletManagerNew;
            
            if (!walletManager) {
                console.warn('No wallet manager found');
                return null;
            }

            // Check if wallet is connected
            const isConnected = walletManager.isWalletConnected ? 
                              walletManager.isWalletConnected() : 
                              walletManager.isConnected ? walletManager.isConnected() : false;

            if (!isConnected) {
                console.warn('Wallet not connected');
                return null;
            }

            // Get wallet data
            const address = walletManager.getAccount ? walletManager.getAccount() : 
                           walletManager.getAddress ? walletManager.getAddress() : null;
            
            const walletType = walletManager.getWalletType ? walletManager.getWalletType() : 'metamask';
            const chainId = walletManager.getChainId ? walletManager.getChainId() : null;

            return {
                address,
                walletType,
                chainId,
                isConnected
            };
        } catch (error) {
            console.error('Error getting wallet data:', error);
            return null;
        }
    }

    createPopupHTML(walletData) {
        const shortAddress = this.formatAddress(walletData.address);
        const nativeCurrency = window.CONFIG?.NETWORK?.NATIVE_CURRENCY;
        const labelToken = nativeCurrency?.name || nativeCurrency?.symbol;
        const balanceLabel = labelToken ? `${labelToken} Balance` : 'Balance';

        return `
            <div class="wallet-popup">
                <div class="wallet-popup-content">
                    <!-- Close Button -->
                    <button class="wallet-popup-close" title="Close">
                        <span class="material-icons">close</span>
                    </button>

                    <!-- Wallet Balance -->
                    <div class="wallet-balance">
                        <span class="balance-label" data-wallet-balance-label>${balanceLabel}</span>
                        <span class="balance-value" data-wallet-balance>--</span>
                    </div>

                    <!-- Wallet Address -->
                    <div class="wallet-address">
                        <span class="address-text">${shortAddress}</span>
                        <button class="copy-icon-button" data-address="${walletData.address}" title="Copy address">
                            <span class="material-icons">content_copy</span>
                        </button>
                    </div>

                    <!-- Action Buttons -->
                    <div class="wallet-actions">
                        <button class="action-button disconnect-button">
                            <span class="material-icons">logout</span>
                            <span>Disconnect</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    positionPopup(buttonRect) {
        if (!this.popupElement) return;
        
        const popup = this.popupElement;
        const popupRect = popup.getBoundingClientRect();
        
        // Calculate position (below the button, aligned to right edge)
        let top = buttonRect.bottom + 8;
        let left = buttonRect.right - popupRect.width;
        
        // Adjust if popup goes off screen
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        if (left < 8) {
            left = 8;
        }
        
        if (top + popupRect.height > viewportHeight - 8) {
            top = buttonRect.top - popupRect.height - 8;
        }
        
        popup.style.top = `${top}px`;
        popup.style.left = `${left}px`;
    }

    attachEventListeners() {
        if (!this.popupElement) return;

        // Close button
        const closeButton = this.popupElement.querySelector('.wallet-popup-close');
        closeButton?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hide();
        });

        // Copy button
        const copyButton = this.popupElement.querySelector('.copy-icon-button');
        copyButton?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyAddress(e.currentTarget.dataset.address);
        });

        // Disconnect button
        const disconnectButton = this.popupElement.querySelector('.disconnect-button');
        disconnectButton?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.disconnectWallet();
        });

        // Prevent popup from closing when clicking inside
        this.popupElement.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    attachGlobalClickListener() {
        document.addEventListener('click', (e) => {
            if (this.isOpen && !e.target.closest('.wallet-popup') && !e.target.closest('#connect-wallet-btn')) {
                this.hide();
            }
        });
    }

    /**
     * Attach global wallet event listeners so the popup can react to
     * connection/account/chain changes while it is open.
     */
    subscribeToWalletEvents() {
        if (this.walletEventsBound) return;

        document.addEventListener('walletConnected', this.boundWalletUpdateHandler);
        document.addEventListener('walletAccountChanged', this.boundWalletUpdateHandler);
        document.addEventListener('walletChainChanged', this.boundWalletUpdateHandler);
        document.addEventListener('walletDisconnected', this.boundWalletDisconnectHandler);

        this.walletEventsBound = true;
    }

    /**
     * Handle wallet-connected/account-changed/chain-changed events.
     * When the popup is visible, trigger a balance refresh.
     */
    handleWalletUpdate(event) {
        if (!this.isOpen) return;

        this.refreshBalance();
    }

    /**
     * Handle wallet disconnection by resetting the in-flight balance fetches
     * and clearing the UI while the popup is visible.
     */
    handleWalletDisconnect() {
        this.balanceFetchToken++;

        if (this.isOpen) {
            this.updateBalanceUI({ text: '--' });
        }
    }

    /**
     * Refresh the displayed balance if wallet data is still available.
     */
    refreshBalance() {
        if (!this.popupElement) return;

        const walletData = this.getWalletData();
        if (!walletData || !walletData.address) {
            this.updateBalanceUI({ text: '--' });
            return;
        }

        this.loadWalletBalance(walletData);
    }

    /**
     * Fetch and display the native balance for the provided wallet details.
     * Uses a fetch token to avoid race conditions when the popup closes.
     * @param {{ address: string, chainId: number }} walletData
     */
    async loadWalletBalance(walletData) {
        if (!this.popupElement || !walletData || !walletData.address) {
            this.updateBalanceUI({ text: '--' });
            return;
        }

        const network = window.CONFIG?.NETWORK;
        const nativeCurrency = network?.NATIVE_CURRENCY || {};
        const decimals = typeof nativeCurrency.decimals === 'number' ? nativeCurrency.decimals : 18;
        const displaySymbol = nativeCurrency.symbol || 'Native';
        const displayName = nativeCurrency.name || displaySymbol;

        const labelElement = this.popupElement.querySelector('[data-wallet-balance-label]');
        if (labelElement) {
            labelElement.textContent = `${displayName} Balance`;
        }

        this.updateBalanceUI({ text: 'Loading...' });

        const fetchId = ++this.balanceFetchToken;

        try {
            const balance = await this.fetchNativeBalance(
                walletData.address,
                network?.CHAIN_ID,
                walletData.chainId
            );

            if (fetchId !== this.balanceFetchToken) {
                return;
            }

            if (!balance) {
                this.updateBalanceUI({ text: '--' });
                return;
            }

            const formatted = this.formatNativeBalance(balance, decimals);
            this.updateBalanceUI({ text: `${formatted} ${displaySymbol}` });
        } catch (error) {
            console.error('Error loading wallet balance:', error);
            if (fetchId !== this.balanceFetchToken) {
                return;
            }
            this.updateBalanceUI({ text: 'Unable to load', isError: true });
        }
    }

    /**
     * Retrieve the native token balance for the given address.
     * Prefers the wallet provider when on the correct chain, then falls
     * back to ContractManager providers.
     * @param {string} address
     * @param {number} targetChainId - Chain expected by the app
     * @param {number} walletChainId - Chain currently selected in the wallet
     * @returns {Promise<import('ethers').BigNumber|null>}
     */
    async fetchNativeBalance(address, targetChainId, walletChainId) {
        if (!address || !window.ethers) {
            return null;
        }

        let lastError = null;
        const providersTried = new Set();

        const primaryProvider = this.getBalanceProvider(targetChainId, walletChainId);
        if (primaryProvider) {
            providersTried.add(primaryProvider);
            try {
                return await primaryProvider.getBalance(address);
            } catch (error) {
                lastError = error;
                console.warn('Primary provider balance fetch failed, retrying with fallback', error);
            }
        }

        const contractManager = window.contractManager;
        const candidateProviders = [];

        if (contractManager) {
            if (contractManager.provider) {
                candidateProviders.push(contractManager.provider);
            }

            if (typeof contractManager.getWorkingProvider === 'function') {
                try {
                    const workingProvider = await contractManager.getWorkingProvider();
                    if (workingProvider) {
                        candidateProviders.push(workingProvider);
                    }
                } catch (error) {
                    lastError = lastError || error;
                    console.warn('ContractManager getWorkingProvider failed', error);
                }
            }
        }

        for (const provider of candidateProviders) {
            if (!provider || providersTried.has(provider)) continue;

            providersTried.add(provider);

            try {
                return await provider.getBalance(address);
            } catch (error) {
                lastError = error;
                console.warn('Fallback provider balance fetch failed', error);
            }
        }

        if (lastError) {
            throw lastError;
        }

        return null;
    }

    /**
     * Get the wallet provider if it is connected to the expected network.
     * @param {number} targetChainId
     * @param {number} walletChainId
     * @returns {import('ethers').providers.Provider|null}
     */
    getBalanceProvider(targetChainId, walletChainId) {
        const walletManager = window.walletManager;

        if (walletManager) {
            const provider = typeof walletManager.getProvider === 'function'
                ? walletManager.getProvider()
                : walletManager.provider;

            if (provider && targetChainId && walletChainId && walletChainId === targetChainId) {
                return provider;
            }
        }

        return null;
    }

    /**
     * Format a native token balance into a human readable string.
     * @param {import('ethers').BigNumber|string} balance
     * @param {number} [decimals=18]
     * @returns {string}
     */
    formatNativeBalance(balance, decimals = 18) {
        try {
            const formatted = window.ethers?.utils?.formatUnits
                ? window.ethers.utils.formatUnits(balance, decimals)
                : window.ethers.formatUnits(balance, decimals);

            const numeric = Number(formatted);

            if (!Number.isFinite(numeric)) {
                return formatted;
            }

            if (numeric === 0) {
                return '0.0000';
            }

            if (numeric < 0.0001) {
                return '<0.0001';
            }

            return numeric.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 4
            });
        } catch (error) {
            console.error('Error formatting native balance:', error);
            return '--';
        }
    }

    /**
     * Update the balance text node inside the popup with optional error styling.
     * @param {{ text: string, isError?: boolean }} param0
     */
    updateBalanceUI({ text, isError = false }) {
        if (!this.popupElement) return;

        const balanceElement = this.popupElement.querySelector('[data-wallet-balance]');
        if (!balanceElement) return;

        balanceElement.textContent = text;
        balanceElement.classList.toggle('error', !!isError);
    }

    async copyAddress(address) {
        try {
            await navigator.clipboard.writeText(address);
            this.showCopyFeedback();
            
            // Show notification if available
            if (window.notificationManager) {
                window.notificationManager.success('Address copied to clipboard');
            }
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = address;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            this.showCopyFeedback();
            
            if (window.notificationManager) {
                window.notificationManager.success('Address copied to clipboard');
            }
        }
    }

    showCopyFeedback() {
        const copyButton = this.popupElement?.querySelector('.copy-icon-button');
        if (!copyButton) return;

        const icon = copyButton.querySelector('.material-icons');
        if (!icon) return;

        const originalText = icon.textContent;

        icon.textContent = 'check';
        copyButton.classList.add('success');

        setTimeout(() => {
            icon.textContent = originalText;
            copyButton.classList.remove('success');
        }, 1500);
    }

    async disconnectWallet() {
        this.hide();
        
        try {
            const walletManager = window.walletManager || window.WalletManagerNew;
            if (walletManager && walletManager.disconnect) {
                await walletManager.disconnect();
                
                if (window.notificationManager) {
                    window.notificationManager.success('Wallet disconnected successfully');
                }
            }
        } catch (error) {
            console.error('Error disconnecting wallet:', error);
            
            if (window.notificationManager) {
                window.notificationManager.error('Failed to disconnect wallet');
            }
        }
    }

    animateIn() {
        if (!this.popupElement) return;
        
        this.popupElement.style.opacity = '0';
        this.popupElement.style.transform = 'translateY(-10px) scale(0.95)';
        
        requestAnimationFrame(() => {
            this.popupElement.style.transition = 'all 0.2s ease-out';
            this.popupElement.style.opacity = '1';
            this.popupElement.style.transform = 'translateY(0) scale(1)';
        });
    }

    animateOut(callback) {
        if (!this.popupElement) {
            callback();
            return;
        }
        
        this.popupElement.style.transition = 'all 0.15s ease-in';
        this.popupElement.style.opacity = '0';
        this.popupElement.style.transform = 'translateY(-10px) scale(0.95)';
        
        setTimeout(callback, 150);
    }

    formatAddress(address) {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

}

// Initialize wallet popup
document.addEventListener('DOMContentLoaded', () => {
    new WalletPopup();
});

// Export for global access
window.WalletPopup = WalletPopup;
