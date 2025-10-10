/**
 * PendingRewardsDisplay - Real-time pending rewards display component
 * Shows user's pending rewards with automatic 30-second updates
 * Integrates with RewardsCalculator and provides interactive UI
 *
 * ENHANCED SINGLETON PATTERN - Prevents redeclaration errors
 */
(function(global) {
    'use strict';

    // CRITICAL FIX: Enhanced redeclaration prevention
    if (global.PendingRewardsDisplay) {
        console.warn('PendingRewardsDisplay class already exists, skipping redeclaration');
        return;
    }

    // Check for existing instance and preserve it
    if (global.pendingRewardsDisplay) {
        console.warn('PendingRewardsDisplay instance already exists, preserving existing instance');
        return;
    }

    /**
     * PendingRewardsDisplay Class - Real-time rewards display component
     */
    class PendingRewardsDisplay {
        constructor() {
            this.isInitialized = false;
            this.isVisible = false;
            
            // Dependencies
            this.rewardsCalculator = null;
            this.contractManager = null;
            this.walletManager = null;
            
            // Configuration
            this.config = {
                UPDATE_INTERVAL: 30000, // 30 seconds
                ANIMATION_DURATION: 300, // 300ms
                AUTO_REFRESH: true,
                SHOW_USD_VALUES: true,
                SHOW_ANIMATIONS: true,
                DECIMAL_PLACES: 6
            };
            
            // State management
            this.currentUserAddress = null;
            this.pendingRewardsData = new Map(); // pairName -> rewards data
            this.updateInterval = null;
            this.isUpdating = false;
            
            // DOM elements
            this.container = null;
            this.elements = new Map();
            
            // Event listeners
            this.eventListeners = new Map();
            
            console.log('💰 PendingRewardsDisplay: Real-time display component initialized');
        }

        /**
         * Initialize the pending rewards display
         */
        async initialize(dependencies = {}) {
            try {
                console.log('💰 PendingRewardsDisplay: Starting initialization...');
                
                // Set dependencies
                this.rewardsCalculator = dependencies.rewardsCalculator || global.rewardsCalculator;
                this.contractManager = dependencies.contractManager || global.contractManager;
                this.walletManager = dependencies.walletManager || global.walletManager;
                
                // Validate dependencies
                if (!this.rewardsCalculator) {
                    throw new Error('RewardsCalculator dependency is required');
                }
                
                // Create DOM structure
                this.createDOMStructure();
                
                // Set up event listeners
                this.setupEventListeners();
                
                // Set up automatic updates
                this.setupAutoUpdate();
                
                // Initial data load
                await this.refreshAllRewards();
                
                this.isInitialized = true;
                console.log('✅ PendingRewardsDisplay: Initialization completed successfully');
                
                return true;
            } catch (error) {
                console.error('❌ PendingRewardsDisplay: Initialization failed:', error);
                this.isInitialized = false;
                return false;
            }
        }

        /**
         * Create DOM structure for the component
         */
        createDOMStructure() {
            // Find or create container
            this.container = document.getElementById('pending-rewards-display');
            
            if (!this.container) {
                this.container = document.createElement('div');
                this.container.id = 'pending-rewards-display';
                this.container.className = 'pending-rewards-display';
                
                // Find a suitable parent element
                const parent = document.querySelector('.rewards-section') || 
                              document.querySelector('.main-content') || 
                              document.body;
                parent.appendChild(this.container);
            }
            
            // Create HTML structure
            this.container.innerHTML = `
                <div class="pending-rewards-header">
                    <h3 class="pending-rewards-title">
                        <span class="icon">💰</span>
                        Pending Rewards
                    </h3>
                    <div class="pending-rewards-controls">
                        <button class="refresh-btn" title="Refresh rewards">
                            <span class="icon">🔄</span>
                        </button>
                        <button class="settings-btn" title="Display settings">
                            <span class="icon">⚙️</span>
                        </button>
                    </div>
                </div>
                
                <div class="pending-rewards-content">
                    <div class="loading-state" style="display: none;">
                        <div class="loading-spinner"></div>
                        <span>Loading rewards...</span>
                    </div>
                    
                    <div class="no-rewards-state" style="display: none;">
                        <div class="no-rewards-icon">💸</div>
                        <p>No pending rewards available</p>
                        <small>Start staking to earn rewards!</small>
                    </div>
                    
                    <div class="rewards-list">
                        <!-- Rewards items will be dynamically added here -->
                    </div>
                    
                    <div class="rewards-summary">
                        <div class="summary-item">
                            <span class="label">Total Pending:</span>
                            <span class="value total-pending-amount">0.00</span>
                        </div>
                        <div class="summary-item">
                            <span class="label">USD Value:</span>
                            <span class="value total-pending-usd">$0.00</span>
                        </div>
                    </div>
                </div>
                
                <div class="pending-rewards-footer">
                    <div class="last-updated">
                        Last updated: <span class="timestamp">Never</span>
                    </div>
                    <div class="auto-refresh-indicator">
                        <span class="indicator-dot"></span>
                        Auto-refresh: <span class="status">ON</span>
                    </div>
                </div>
            `;
            
            // Store element references
            this.elements.set('header', this.container.querySelector('.pending-rewards-header'));
            this.elements.set('content', this.container.querySelector('.pending-rewards-content'));
            this.elements.set('loadingState', this.container.querySelector('.loading-state'));
            this.elements.set('noRewardsState', this.container.querySelector('.no-rewards-state'));
            this.elements.set('rewardsList', this.container.querySelector('.rewards-list'));
            this.elements.set('summary', this.container.querySelector('.rewards-summary'));
            this.elements.set('footer', this.container.querySelector('.pending-rewards-footer'));
            this.elements.set('refreshBtn', this.container.querySelector('.refresh-btn'));
            this.elements.set('settingsBtn', this.container.querySelector('.settings-btn'));
            this.elements.set('totalAmount', this.container.querySelector('.total-pending-amount'));
            this.elements.set('totalUSD', this.container.querySelector('.total-pending-usd'));
            this.elements.set('timestamp', this.container.querySelector('.timestamp'));
            this.elements.set('autoRefreshStatus', this.container.querySelector('.auto-refresh-indicator .status'));
            
            console.log('🎨 DOM structure created for PendingRewardsDisplay');
        }

        /**
         * Set up event listeners
         */
        setupEventListeners() {
            // Refresh button
            const refreshBtn = this.elements.get('refreshBtn');
            if (refreshBtn) {
                const refreshHandler = async (e) => {
                    e.preventDefault();
                    await this.refreshAllRewards(true);
                };
                refreshBtn.addEventListener('click', refreshHandler);
                this.eventListeners.set('refresh', refreshHandler);
            }
            
            // Settings button
            const settingsBtn = this.elements.get('settingsBtn');
            if (settingsBtn) {
                const settingsHandler = (e) => {
                    e.preventDefault();
                    this.showSettingsModal();
                };
                settingsBtn.addEventListener('click', settingsHandler);
                this.eventListeners.set('settings', settingsHandler);
            }
            
            // Wallet connection changes
            if (this.walletManager) {
                const walletHandler = (address) => {
                    this.handleWalletChange(address);
                };
                this.walletManager.addConnectionListener(walletHandler);
                this.eventListeners.set('wallet', walletHandler);
            }
            
            // Rewards calculator updates
            if (this.rewardsCalculator) {
                const calculatorHandler = () => {
                    this.refreshAllRewards();
                };
                this.rewardsCalculator.addUpdateListener(calculatorHandler);
                this.eventListeners.set('calculator', calculatorHandler);
            }
            
            console.log('👂 Event listeners set up for PendingRewardsDisplay');
        }

        /**
         * Set up automatic updates
         */
        setupAutoUpdate() {
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
            }
            
            if (this.config.AUTO_REFRESH) {
                this.updateInterval = setInterval(async () => {
                    if (this.isVisible && !this.isUpdating) {
                        await this.refreshAllRewards();
                    }
                }, this.config.UPDATE_INTERVAL);
                
                console.log('🔄 Auto-update enabled (30s intervals)');
                this.updateAutoRefreshIndicator(true);
            }
        }

        /**
         * Refresh all pending rewards data
         */
        async refreshAllRewards(forceRefresh = false) {
            if (this.isUpdating && !forceRefresh) {
                return;
            }
            
            try {
                this.isUpdating = true;
                this.showLoadingState();
                
                // Get current user address
                const userAddress = await this.getCurrentUserAddress();
                if (!userAddress) {
                    this.showNoRewardsState('Please connect your wallet');
                    return;
                }
                
                this.currentUserAddress = userAddress;
                
                // Get supported pools
                const supportedPools = await this.getSupportedPools();
                if (supportedPools.length === 0) {
                    this.showNoRewardsState('No staking pools available');
                    return;
                }
                
                // Fetch rewards for each pool
                const rewardsPromises = supportedPools.map(async (pairName) => {
                    try {
                        const rewardsData = await this.rewardsCalculator.calculatePendingRewards(
                            userAddress, 
                            pairName
                        );
                        return { pairName, rewardsData };
                    } catch (error) {
                        console.error(`Failed to get rewards for ${pairName}:`, error);
                        return { pairName, rewardsData: null };
                    }
                });
                
                const results = await Promise.all(rewardsPromises);
                
                // Update data store
                this.pendingRewardsData.clear();
                let hasRewards = false;
                
                for (const { pairName, rewardsData } of results) {
                    if (rewardsData && parseFloat(rewardsData.pendingRewards) > 0) {
                        this.pendingRewardsData.set(pairName, rewardsData);
                        hasRewards = true;
                    }
                }
                
                // Update display
                if (hasRewards) {
                    this.renderRewardsList();
                    this.updateSummary();
                    this.showRewardsContent();
                } else {
                    this.showNoRewardsState('No pending rewards available');
                }
                
                // Update timestamp
                this.updateTimestamp();
                
                console.log('✅ Pending rewards refreshed successfully');
                
            } catch (error) {
                console.error('❌ Failed to refresh pending rewards:', error);
                this.showErrorState(error.message);
            } finally {
                this.isUpdating = false;
                this.hideLoadingState();
            }
        }

        /**
         * Render the rewards list
         */
        renderRewardsList() {
            const rewardsList = this.elements.get('rewardsList');
            if (!rewardsList) return;
            
            // Clear existing content
            rewardsList.innerHTML = '';
            
            // Create reward items
            for (const [pairName, rewardsData] of this.pendingRewardsData.entries()) {
                const rewardItem = this.createRewardItem(pairName, rewardsData);
                rewardsList.appendChild(rewardItem);
            }
            
            // Add animation class
            if (this.config.SHOW_ANIMATIONS) {
                rewardsList.classList.add('fade-in');
                setTimeout(() => rewardsList.classList.remove('fade-in'), this.config.ANIMATION_DURATION);
            }
        }

        /**
         * Create individual reward item element
         */
        createRewardItem(pairName, rewardsData) {
            const item = document.createElement('div');
            item.className = 'reward-item';
            item.dataset.pairName = pairName;

            const pendingAmount = parseFloat(rewardsData.pendingRewards);
            const isClaimable = pendingAmount > 0;

            item.innerHTML = `
                <div class="reward-item-header">
                    <div class="pool-info">
                        <span class="pool-name">${pairName}</span>
                        <span class="pool-label">LP Pool</span>
                    </div>
                    <div class="reward-amount">
                        <span class="amount">${rewardsData.pendingRewardsFormatted}</span>
                        <span class="token-symbol">LIB</span>
                    </div>
                </div>

                <div class="reward-item-details">
                    <div class="detail-row">
                        <span class="label">USD Value:</span>
                        <span class="value">${rewardsData.pendingRewardsUSDFormatted}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Token Price:</span>
                        <span class="value">$${rewardsData.rewardTokenPrice.toFixed(4)}</span>
                    </div>
                </div>

                <div class="reward-item-actions">
                    <button class="claim-btn ${isClaimable ? '' : 'disabled'}"
                            data-pair="${pairName}"
                            ${!isClaimable ? 'disabled' : ''}>
                        <span class="icon">💎</span>
                        Claim Rewards
                    </button>
                </div>
            `;

            // Add claim button event listener
            const claimBtn = item.querySelector('.claim-btn');
            if (claimBtn && isClaimable) {
                claimBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleClaimRewards(pairName);
                });
            }

            return item;
        }

        /**
         * Update summary totals
         */
        updateSummary() {
            let totalPending = 0;
            let totalUSD = 0;

            for (const rewardsData of this.pendingRewardsData.values()) {
                totalPending += parseFloat(rewardsData.pendingRewards) || 0;
                totalUSD += rewardsData.pendingRewardsUSD || 0;
            }

            // Update total amount
            const totalAmountElement = this.elements.get('totalAmount');
            if (totalAmountElement) {
                totalAmountElement.textContent = this.formatTokenAmount(totalPending);

                // Add animation for value changes
                if (this.config.SHOW_ANIMATIONS) {
                    totalAmountElement.classList.add('value-updated');
                    setTimeout(() => totalAmountElement.classList.remove('value-updated'), 1000);
                }
            }

            // Update total USD
            const totalUSDElement = this.elements.get('totalUSD');
            if (totalUSDElement) {
                totalUSDElement.textContent = this.formatCurrency(totalUSD);

                // Add animation for value changes
                if (this.config.SHOW_ANIMATIONS) {
                    totalUSDElement.classList.add('value-updated');
                    setTimeout(() => totalUSDElement.classList.remove('value-updated'), 1000);
                }
            }
        }

        /**
         * Handle claim rewards action
         */
        async handleClaimRewards(pairName) {
            try {
                console.log(`💎 Claiming rewards for ${pairName}...`);

                // Show loading state on the specific claim button
                const claimBtn = this.container.querySelector(`[data-pair="${pairName}"]`);
                if (claimBtn) {
                    claimBtn.disabled = true;
                    claimBtn.innerHTML = '<span class="loading-spinner"></span> Claiming...';
                }

                // Execute claim through contract manager
                if (!this.contractManager || !this.contractManager.isReady()) {
                    throw new Error('Contract manager not ready');
                }

                const result = await this.contractManager.claimRewards(pairName);

                // Show success notification
                if (global.notificationManager) {
                    global.notificationManager.show({
                        type: 'success',
                        title: 'Rewards Claimed!',
                        message: `Successfully claimed rewards for ${pairName}`,
                        duration: 5000
                    });
                }

                // Record in rewards history
                if (global.rewardsHistory) {
                    const rewardsData = this.pendingRewardsData.get(pairName);
                    await global.rewardsHistory.recordClaim({
                        pairName: pairName,
                        amount: rewardsData.pendingRewards,
                        amountFormatted: rewardsData.pendingRewardsFormatted,
                        amountUSD: rewardsData.pendingRewardsUSD,
                        amountUSDFormatted: rewardsData.pendingRewardsUSDFormatted,
                        transactionHash: result.hash,
                        blockNumber: result.blockNumber,
                        rewardTokenPrice: rewardsData.rewardTokenPrice
                    });
                }

                // Refresh rewards display
                setTimeout(() => {
                    this.refreshAllRewards(true);
                }, 2000); // Wait 2 seconds for blockchain confirmation

            } catch (error) {
                console.error(`❌ Failed to claim rewards for ${pairName}:`, error);

                // Show error notification
                if (global.notificationManager) {
                    global.notificationManager.show({
                        type: 'error',
                        title: 'Claim Failed',
                        message: error.message || 'Failed to claim rewards',
                        duration: 5000
                    });
                }

                // Reset claim button
                const claimBtn = this.container.querySelector(`[data-pair="${pairName}"]`);
                if (claimBtn) {
                    claimBtn.disabled = false;
                    claimBtn.innerHTML = '<span class="icon">💎</span> Claim Rewards';
                }
            }
        }

        /**
         * Show loading state
         */
        showLoadingState() {
            const loadingState = this.elements.get('loadingState');
            const content = this.elements.get('content');

            if (loadingState) loadingState.style.display = 'flex';
            if (content) content.classList.add('loading');
        }

        /**
         * Hide loading state
         */
        hideLoadingState() {
            const loadingState = this.elements.get('loadingState');
            const content = this.elements.get('content');

            if (loadingState) loadingState.style.display = 'none';
            if (content) content.classList.remove('loading');
        }

        /**
         * Show no rewards state
         */
        showNoRewardsState(message = 'No pending rewards available') {
            const noRewardsState = this.elements.get('noRewardsState');
            const rewardsList = this.elements.get('rewardsList');
            const summary = this.elements.get('summary');

            if (noRewardsState) {
                noRewardsState.style.display = 'block';
                const messageElement = noRewardsState.querySelector('p');
                if (messageElement) messageElement.textContent = message;
            }

            if (rewardsList) rewardsList.style.display = 'none';
            if (summary) summary.style.display = 'none';
        }

        /**
         * Show rewards content
         */
        showRewardsContent() {
            const noRewardsState = this.elements.get('noRewardsState');
            const rewardsList = this.elements.get('rewardsList');
            const summary = this.elements.get('summary');

            if (noRewardsState) noRewardsState.style.display = 'none';
            if (rewardsList) rewardsList.style.display = 'block';
            if (summary) summary.style.display = 'block';
        }

        /**
         * Show error state
         */
        showErrorState(message) {
            const noRewardsState = this.elements.get('noRewardsState');
            if (noRewardsState) {
                noRewardsState.style.display = 'block';
                noRewardsState.innerHTML = `
                    <div class="error-icon">⚠️</div>
                    <p>Error loading rewards</p>
                    <small>${message}</small>
                `;
            }
        }

        /**
         * Update timestamp display
         */
        updateTimestamp() {
            const timestampElement = this.elements.get('timestamp');
            if (timestampElement) {
                const now = new Date();
                timestampElement.textContent = now.toLocaleTimeString();
            }
        }

        /**
         * Update auto-refresh indicator
         */
        updateAutoRefreshIndicator(enabled) {
            const statusElement = this.elements.get('autoRefreshStatus');
            const indicator = this.container.querySelector('.indicator-dot');

            if (statusElement) {
                statusElement.textContent = enabled ? 'ON' : 'OFF';
            }

            if (indicator) {
                indicator.className = `indicator-dot ${enabled ? 'active' : 'inactive'}`;
            }
        }

        /**
         * Get current user address
         */
        async getCurrentUserAddress() {
            try {
                if (this.walletManager && this.walletManager.isConnected()) {
                    return await this.walletManager.getAddress();
                }

                // Fallback to contract manager
                if (this.contractManager && this.contractManager.signer) {
                    return await this.contractManager.signer.getAddress();
                }

                return null;
            } catch (error) {
                console.error('Failed to get user address:', error);
                return null;
            }
        }

        /**
         * Get supported pools
         */
        async getSupportedPools() {
            try {
                if (this.rewardsCalculator) {
                    return await this.rewardsCalculator.getSupportedTokens();
                }

                // Fallback to configured pools
                return Object.keys(window.CONFIG.CONTRACTS.LP_TOKENS);
            } catch (error) {
                console.error('Failed to get supported pools:', error);
                return ['LIB-USDT', 'LIB-WETH', 'LIB-MATIC']; // Fallback
            }
        }

        /**
         * Handle wallet connection changes
         */
        async handleWalletChange(address) {
            console.log('👛 Wallet connection changed:', address);

            if (address && address !== this.currentUserAddress) {
                this.currentUserAddress = address;
                await this.refreshAllRewards(true);
            } else if (!address) {
                this.currentUserAddress = null;
                this.showNoRewardsState('Please connect your wallet');
            }
        }

        /**
         * Show settings modal
         */
        showSettingsModal() {
            // Create settings modal (simplified implementation)
            const modal = document.createElement('div');
            modal.className = 'settings-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Display Settings</h3>
                        <button class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="setting-item">
                            <label>
                                <input type="checkbox" ${this.config.AUTO_REFRESH ? 'checked' : ''}>
                                Auto-refresh (30s)
                            </label>
                        </div>
                        <div class="setting-item">
                            <label>
                                <input type="checkbox" ${this.config.SHOW_USD_VALUES ? 'checked' : ''}>
                                Show USD values
                            </label>
                        </div>
                        <div class="setting-item">
                            <label>
                                <input type="checkbox" ${this.config.SHOW_ANIMATIONS ? 'checked' : ''}>
                                Show animations
                            </label>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Add event listeners for modal
            const closeBtn = modal.querySelector('.close-btn');
            closeBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
            });

            // Handle setting changes
            const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach((checkbox, index) => {
                checkbox.addEventListener('change', (e) => {
                    switch (index) {
                        case 0:
                            this.config.AUTO_REFRESH = e.target.checked;
                            this.setupAutoUpdate();
                            break;
                        case 1:
                            this.config.SHOW_USD_VALUES = e.target.checked;
                            this.refreshAllRewards();
                            break;
                        case 2:
                            this.config.SHOW_ANIMATIONS = e.target.checked;
                            break;
                    }
                });
            });
        }

        /**
         * Format token amount for display
         */
        formatTokenAmount(amount) {
            const num = parseFloat(amount) || 0;
            if (num === 0) return '0.00';
            if (num < 0.01) return '<0.01';
            if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
            if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
            return num.toFixed(this.config.DECIMAL_PLACES);
        }

        /**
         * Format currency for display
         */
        formatCurrency(amount) {
            const num = parseFloat(amount) || 0;
            if (num === 0) return '$0.00';
            if (num < 0.01) return '<$0.01';
            if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
            if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
            return `$${num.toFixed(2)}`;
        }

        /**
         * Show/hide the component
         */
        show() {
            if (this.container) {
                this.container.style.display = 'block';
                this.isVisible = true;
                this.refreshAllRewards();
            }
        }

        hide() {
            if (this.container) {
                this.container.style.display = 'none';
                this.isVisible = false;
            }
        }

        /**
         * Get component statistics
         */
        getStats() {
            return {
                isInitialized: this.isInitialized,
                isVisible: this.isVisible,
                isUpdating: this.isUpdating,
                currentUserAddress: this.currentUserAddress,
                pendingRewardsCount: this.pendingRewardsData.size,
                autoRefreshEnabled: !!this.updateInterval,
                lastUpdateTime: this.elements.get('timestamp')?.textContent || 'Never'
            };
        }

        /**
         * Cleanup resources
         */
        destroy() {
            // Clear intervals
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }

            // Remove event listeners
            for (const [key, handler] of this.eventListeners.entries()) {
                // Event listener cleanup would depend on the specific implementation
                console.log(`Cleaning up ${key} event listener`);
            }
            this.eventListeners.clear();

            // Clear data
            this.pendingRewardsData.clear();
            this.elements.clear();

            // Remove DOM element
            if (this.container && this.container.parentNode) {
                this.container.parentNode.removeChild(this.container);
            }

            this.isInitialized = false;
            console.log('PendingRewardsDisplay: Resources cleaned up');
        }
    }

    // Export to global scope
    global.PendingRewardsDisplay = PendingRewardsDisplay;

    console.log('✅ PendingRewardsDisplay class registered globally');

})(typeof window !== 'undefined' ? window : global);
