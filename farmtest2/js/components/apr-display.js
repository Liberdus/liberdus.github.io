/**
 * APRDisplay - Auto-updating APR display component
 * Handles edge cases (zero TVL, zero rewards) and provides real-time APR updates
 * Integrates with RewardsCalculator for accurate APR calculations
 *
 * ENHANCED SINGLETON PATTERN - Prevents redeclaration errors
 */
(function(global) {
    'use strict';

    // CRITICAL FIX: Enhanced redeclaration prevention
    if (global.APRDisplay) {
        console.warn('APRDisplay class already exists, skipping redeclaration');
        return;
    }

    // Check for existing instance and preserve it
    if (global.aprDisplay) {
        console.warn('APRDisplay instance already exists, preserving existing instance');
        return;
    }

    /**
     * APRDisplay Class - Real-time APR display component
     */
    class APRDisplay {
        constructor() {
            this.isInitialized = false;
            this.isVisible = false;
            
            // Dependencies
            this.rewardsCalculator = null;
            
            // Configuration
            this.config = {
                UPDATE_INTERVAL: 60000, // 1 minute
                ANIMATION_DURATION: 500, // 500ms
                AUTO_REFRESH: true,
                SHOW_DETAILED_INFO: true,
                HIGHLIGHT_CHANGES: true,
                DECIMAL_PLACES: 2
            };
            
            // State management
            this.aprData = new Map(); // pairName -> APR data
            this.previousAPRs = new Map(); // For change detection
            this.updateInterval = null;
            this.isUpdating = false;
            
            // DOM elements
            this.container = null;
            this.elements = new Map();
            
            // Event listeners
            this.eventListeners = new Map();
            
            console.log('📊 APRDisplay: Auto-updating APR component initialized');
        }

        /**
         * Initialize the APR display
         */
        async initialize(dependencies = {}) {
            try {
                console.log('📊 APRDisplay: Starting initialization...');
                
                // Set dependencies
                this.rewardsCalculator = dependencies.rewardsCalculator || global.rewardsCalculator;
                
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
                await this.refreshAllAPRs();
                
                this.isInitialized = true;
                console.log('✅ APRDisplay: Initialization completed successfully');
                
                return true;
            } catch (error) {
                console.error('❌ APRDisplay: Initialization failed:', error);
                this.isInitialized = false;
                return false;
            }
        }

        /**
         * Create DOM structure for the component
         */
        createDOMStructure() {
            // Find or create container
            this.container = document.getElementById('apr-display');
            
            if (!this.container) {
                this.container = document.createElement('div');
                this.container.id = 'apr-display';
                this.container.className = 'apr-display';
                
                // Find a suitable parent element
                const parent = document.querySelector('.staking-section') || 
                              document.querySelector('.main-content') || 
                              document.body;
                parent.appendChild(this.container);
            }
            
            // Create HTML structure
            this.container.innerHTML = `
                <div class="apr-display-header">
                    <h3 class="apr-display-title">
                        <span class="icon">📈</span>
                        Annual Percentage Rate (APR)
                    </h3>
                    <div class="apr-display-controls">
                        <button class="refresh-btn" title="Refresh APR data">
                            <span class="icon">🔄</span>
                        </button>
                        <button class="info-btn" title="APR information">
                            <span class="icon">ℹ️</span>
                        </button>
                    </div>
                </div>
                
                <div class="apr-display-content">
                    <div class="loading-state" style="display: none;">
                        <div class="loading-spinner"></div>
                        <span>Calculating APR...</span>
                    </div>
                    
                    <div class="no-data-state" style="display: none;">
                        <div class="no-data-icon">📊</div>
                        <p>No APR data available</p>
                        <small>APR will be displayed when pools have liquidity</small>
                    </div>
                    
                    <div class="apr-list">
                        <!-- APR items will be dynamically added here -->
                    </div>
                    
                    <div class="apr-summary">
                        <div class="summary-item">
                            <span class="label">Highest APR:</span>
                            <span class="value highest-apr">0.00%</span>
                        </div>
                        <div class="summary-item">
                            <span class="label">Average APR:</span>
                            <span class="value average-apr">0.00%</span>
                        </div>
                        <div class="summary-item">
                            <span class="label">Total TVL:</span>
                            <span class="value total-tvl">$0.00</span>
                        </div>
                    </div>
                </div>
                
                <div class="apr-display-footer">
                    <div class="last-updated">
                        Last updated: <span class="timestamp">Never</span>
                    </div>
                    <div class="auto-refresh-indicator">
                        <span class="indicator-dot active"></span>
                        Auto-refresh: <span class="status">ON</span>
                    </div>
                </div>
            `;
            
            // Store element references
            this.elements.set('header', this.container.querySelector('.apr-display-header'));
            this.elements.set('content', this.container.querySelector('.apr-display-content'));
            this.elements.set('loadingState', this.container.querySelector('.loading-state'));
            this.elements.set('noDataState', this.container.querySelector('.no-data-state'));
            this.elements.set('aprList', this.container.querySelector('.apr-list'));
            this.elements.set('summary', this.container.querySelector('.apr-summary'));
            this.elements.set('footer', this.container.querySelector('.apr-display-footer'));
            this.elements.set('refreshBtn', this.container.querySelector('.refresh-btn'));
            this.elements.set('infoBtn', this.container.querySelector('.info-btn'));
            this.elements.set('highestAPR', this.container.querySelector('.highest-apr'));
            this.elements.set('averageAPR', this.container.querySelector('.average-apr'));
            this.elements.set('totalTVL', this.container.querySelector('.total-tvl'));
            this.elements.set('timestamp', this.container.querySelector('.timestamp'));
            this.elements.set('autoRefreshStatus', this.container.querySelector('.auto-refresh-indicator .status'));
            
            console.log('🎨 DOM structure created for APRDisplay');
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
                    await this.refreshAllAPRs(true);
                };
                refreshBtn.addEventListener('click', refreshHandler);
                this.eventListeners.set('refresh', refreshHandler);
            }
            
            // Info button
            const infoBtn = this.elements.get('infoBtn');
            if (infoBtn) {
                const infoHandler = (e) => {
                    e.preventDefault();
                    this.showAPRInfoModal();
                };
                infoBtn.addEventListener('click', infoHandler);
                this.eventListeners.set('info', infoHandler);
            }
            
            // Rewards calculator updates
            if (this.rewardsCalculator) {
                const calculatorHandler = () => {
                    this.refreshAllAPRs();
                };
                this.rewardsCalculator.addUpdateListener(calculatorHandler);
                this.eventListeners.set('calculator', calculatorHandler);
            }
            
            console.log('👂 Event listeners set up for APRDisplay');
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
                        await this.refreshAllAPRs();
                    }
                }, this.config.UPDATE_INTERVAL);
                
                console.log('🔄 Auto-update enabled (1min intervals)');
                this.updateAutoRefreshIndicator(true);
            }
        }

        /**
         * Refresh all APR data
         */
        async refreshAllAPRs(forceRefresh = false) {
            if (this.isUpdating && !forceRefresh) {
                return;
            }
            
            try {
                this.isUpdating = true;
                this.showLoadingState();
                
                // Get supported pools
                const supportedPools = await this.getSupportedPools();
                if (supportedPools.length === 0) {
                    this.showNoDataState('No staking pools available');
                    return;
                }
                
                // Store previous APRs for change detection
                this.previousAPRs.clear();
                for (const [pairName, aprData] of this.aprData.entries()) {
                    this.previousAPRs.set(pairName, aprData.apr);
                }
                
                // Fetch APR for each pool
                const aprPromises = supportedPools.map(async (pairName) => {
                    try {
                        const aprData = await this.rewardsCalculator.calculateAPR(pairName);
                        return { pairName, aprData };
                    } catch (error) {
                        console.error(`Failed to get APR for ${pairName}:`, error);
                        return { pairName, aprData: null };
                    }
                });
                
                const results = await Promise.all(aprPromises);
                
                // Update data store
                this.aprData.clear();
                let hasValidData = false;
                
                for (const { pairName, aprData } of results) {
                    if (aprData && aprData.isValid) {
                        this.aprData.set(pairName, aprData);
                        hasValidData = true;
                    }
                }
                
                // Update display
                if (hasValidData) {
                    this.renderAPRList();
                    this.updateSummary();
                    this.showAPRContent();
                } else {
                    this.showNoDataState('No valid APR data available');
                }
                
                // Update timestamp
                this.updateTimestamp();
                
                console.log('✅ APR data refreshed successfully');
                
            } catch (error) {
                console.error('❌ Failed to refresh APR data:', error);
                this.showErrorState(error.message);
            } finally {
                this.isUpdating = false;
                this.hideLoadingState();
            }
        }

        /**
         * Render the APR list
         */
        renderAPRList() {
            const aprList = this.elements.get('aprList');
            if (!aprList) return;
            
            // Clear existing content
            aprList.innerHTML = '';
            
            // Sort pools by APR (highest first)
            const sortedPools = Array.from(this.aprData.entries())
                .sort(([, a], [, b]) => b.apr - a.apr);
            
            // Create APR items
            for (const [pairName, aprData] of sortedPools) {
                const aprItem = this.createAPRItem(pairName, aprData);
                aprList.appendChild(aprItem);
            }
            
            // Add animation class
            if (this.config.HIGHLIGHT_CHANGES) {
                aprList.classList.add('fade-in');
                setTimeout(() => aprList.classList.remove('fade-in'), this.config.ANIMATION_DURATION);
            }
        }

        /**
         * Create individual APR item element
         */
        createAPRItem(pairName, aprData) {
            const item = document.createElement('div');
            item.className = 'apr-item';
            item.dataset.pairName = pairName;

            // Check for APR changes
            const previousAPR = this.previousAPRs.get(pairName) || 0;
            const currentAPR = aprData.apr;
            const hasIncreased = currentAPR > previousAPR;
            const hasDecreased = currentAPR < previousAPR;
            const changeClass = hasIncreased ? 'increased' : hasDecreased ? 'decreased' : '';

            // Determine APR status
            const aprStatus = this.getAPRStatus(aprData);

            item.innerHTML = `
                <div class="apr-item-header">
                    <div class="pool-info">
                        <span class="pool-name">${pairName}</span>
                        <span class="pool-label">LP Pool</span>
                        <span class="apr-status ${aprStatus.class}">${aprStatus.text}</span>
                    </div>
                    <div class="apr-value ${changeClass}">
                        <span class="apr-percentage">${aprData.aprFormatted}</span>
                        ${changeClass ? `<span class="change-indicator ${changeClass}">
                            ${hasIncreased ? '↗️' : '↘️'}
                        </span>` : ''}
                    </div>
                </div>

                <div class="apr-item-details ${this.config.SHOW_DETAILED_INFO ? '' : 'hidden'}">
                    <div class="detail-row">
                        <span class="label">TVL:</span>
                        <span class="value">${aprData.tvlFormatted}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Total Staked:</span>
                        <span class="value">${this.formatTokenAmount(aprData.totalStaked)} LP</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Reward Rate:</span>
                        <span class="value">${this.formatTokenAmount(aprData.rewardRate)}/sec</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">LP Token Price:</span>
                        <span class="value">$${aprData.lpTokenPrice.toFixed(4)}</span>
                    </div>
                </div>

                <div class="apr-item-actions">
                    <button class="stake-btn" data-pair="${pairName}">
                        <span class="icon">🚀</span>
                        Stake Now
                    </button>
                    <button class="details-btn" data-pair="${pairName}">
                        <span class="icon">📊</span>
                        Details
                    </button>
                </div>
            `;

            // Add event listeners for buttons
            const stakeBtn = item.querySelector('.stake-btn');
            const detailsBtn = item.querySelector('.details-btn');

            if (stakeBtn) {
                stakeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleStakeAction(pairName);
                });
            }

            if (detailsBtn) {
                detailsBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.showPoolDetails(pairName, aprData);
                });
            }

            return item;
        }

        /**
         * Get APR status for display
         */
        getAPRStatus(aprData) {
            const apr = aprData.apr;

            if (!aprData.isValid || apr === 0) {
                return { class: 'inactive', text: 'Inactive' };
            } else if (apr < 10) {
                return { class: 'low', text: 'Low' };
            } else if (apr < 50) {
                return { class: 'moderate', text: 'Moderate' };
            } else if (apr < 100) {
                return { class: 'high', text: 'High' };
            } else {
                return { class: 'very-high', text: 'Very High' };
            }
        }

        /**
         * Update summary statistics
         */
        updateSummary() {
            let highestAPR = 0;
            let totalAPR = 0;
            let totalTVL = 0;
            let validPoolCount = 0;

            for (const aprData of this.aprData.values()) {
                if (aprData.isValid) {
                    highestAPR = Math.max(highestAPR, aprData.apr);
                    totalAPR += aprData.apr;
                    totalTVL += aprData.tvlUSD;
                    validPoolCount++;
                }
            }

            const averageAPR = validPoolCount > 0 ? totalAPR / validPoolCount : 0;

            // Update highest APR
            const highestAPRElement = this.elements.get('highestAPR');
            if (highestAPRElement) {
                highestAPRElement.textContent = this.formatAPR(highestAPR);
                this.animateValueChange(highestAPRElement);
            }

            // Update average APR
            const averageAPRElement = this.elements.get('averageAPR');
            if (averageAPRElement) {
                averageAPRElement.textContent = this.formatAPR(averageAPR);
                this.animateValueChange(averageAPRElement);
            }

            // Update total TVL
            const totalTVLElement = this.elements.get('totalTVL');
            if (totalTVLElement) {
                totalTVLElement.textContent = this.formatCurrency(totalTVL);
                this.animateValueChange(totalTVLElement);
            }
        }

        /**
         * Handle stake action
         */
        handleStakeAction(pairName) {
            console.log(`🚀 Opening staking modal for ${pairName}`);

            // Trigger staking modal if available
            if (global.stakingModal) {
                global.stakingModal.show(pairName);
            } else {
                // Fallback: show notification
                if (global.notificationManager) {
                    global.notificationManager.show({
                        type: 'info',
                        title: 'Staking',
                        message: `Staking functionality for ${pairName} will be available soon`,
                        duration: 3000
                    });
                }
            }
        }

        /**
         * Show pool details modal
         */
        showPoolDetails(pairName, aprData) {
            const modal = document.createElement('div');
            modal.className = 'pool-details-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${pairName} Pool Details</h3>
                        <button class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="detail-section">
                            <h4>APR Information</h4>
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <span class="label">Current APR:</span>
                                    <span class="value">${aprData.aprFormatted}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Status:</span>
                                    <span class="value">${this.getAPRStatus(aprData).text}</span>
                                </div>
                            </div>
                        </div>

                        <div class="detail-section">
                            <h4>Pool Statistics</h4>
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <span class="label">Total Value Locked:</span>
                                    <span class="value">${aprData.tvlFormatted}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Total Staked:</span>
                                    <span class="value">${this.formatTokenAmount(aprData.totalStaked)} LP</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Reward Rate:</span>
                                    <span class="value">${this.formatTokenAmount(aprData.rewardRate)} LIB/sec</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Annual Reward Value:</span>
                                    <span class="value">${this.formatCurrency(aprData.annualRewardValue)}</span>
                                </div>
                            </div>
                        </div>

                        <div class="detail-section">
                            <h4>Token Prices</h4>
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <span class="label">LP Token Price:</span>
                                    <span class="value">$${aprData.lpTokenPrice.toFixed(6)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="label">Reward Token Price:</span>
                                    <span class="value">$${aprData.rewardTokenPrice.toFixed(6)}</span>
                                </div>
                            </div>
                        </div>

                        <div class="detail-section">
                            <h4>Last Updated</h4>
                            <p>${new Date(aprData.lastUpdated).toLocaleString()}</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="stake-btn-modal" data-pair="${pairName}">
                            <span class="icon">🚀</span>
                            Stake in this Pool
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Add event listeners
            const closeBtn = modal.querySelector('.close-btn');
            const stakeBtnModal = modal.querySelector('.stake-btn-modal');

            closeBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
            });

            stakeBtnModal.addEventListener('click', () => {
                document.body.removeChild(modal);
                this.handleStakeAction(pairName);
            });

            // Close on backdrop click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                }
            });
        }

        /**
         * Show APR information modal
         */
        showAPRInfoModal() {
            const modal = document.createElement('div');
            modal.className = 'apr-info-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>APR Information</h3>
                        <button class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="info-section">
                            <h4>What is APR?</h4>
                            <p>Annual Percentage Rate (APR) represents the yearly return you can expect from staking your LP tokens in a pool.</p>
                        </div>

                        <div class="info-section">
                            <h4>How is APR calculated?</h4>
                            <p>APR = (Annual Reward Value / Total Value Locked) × 100</p>
                            <ul>
                                <li><strong>Annual Reward Value:</strong> Total USD value of rewards distributed per year</li>
                                <li><strong>Total Value Locked (TVL):</strong> Total USD value of all staked LP tokens</li>
                            </ul>
                        </div>

                        <div class="info-section">
                            <h4>APR Status Levels</h4>
                            <div class="status-grid">
                                <div class="status-item inactive">
                                    <span class="status-label">Inactive (0%)</span>
                                    <span class="status-desc">No rewards or liquidity</span>
                                </div>
                                <div class="status-item low">
                                    <span class="status-label">Low (0-10%)</span>
                                    <span class="status-desc">Conservative returns</span>
                                </div>
                                <div class="status-item moderate">
                                    <span class="status-label">Moderate (10-50%)</span>
                                    <span class="status-desc">Balanced risk/reward</span>
                                </div>
                                <div class="status-item high">
                                    <span class="status-label">High (50-100%)</span>
                                    <span class="status-desc">High returns</span>
                                </div>
                                <div class="status-item very-high">
                                    <span class="status-label">Very High (100%+)</span>
                                    <span class="status-desc">Maximum returns</span>
                                </div>
                            </div>
                        </div>

                        <div class="info-section">
                            <h4>Important Notes</h4>
                            <ul>
                                <li>APR is calculated based on current conditions and may change</li>
                                <li>Higher APR may indicate higher risk or lower liquidity</li>
                                <li>Past performance does not guarantee future results</li>
                                <li>Consider impermanent loss when providing liquidity</li>
                            </ul>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Add event listeners
            const closeBtn = modal.querySelector('.close-btn');
            closeBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
            });

            // Close on backdrop click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                }
            });
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
         * Show no data state
         */
        showNoDataState(message = 'No APR data available') {
            const noDataState = this.elements.get('noDataState');
            const aprList = this.elements.get('aprList');
            const summary = this.elements.get('summary');

            if (noDataState) {
                noDataState.style.display = 'block';
                const messageElement = noDataState.querySelector('p');
                if (messageElement) messageElement.textContent = message;
            }

            if (aprList) aprList.style.display = 'none';
            if (summary) summary.style.display = 'none';
        }

        /**
         * Show APR content
         */
        showAPRContent() {
            const noDataState = this.elements.get('noDataState');
            const aprList = this.elements.get('aprList');
            const summary = this.elements.get('summary');

            if (noDataState) noDataState.style.display = 'none';
            if (aprList) aprList.style.display = 'block';
            if (summary) summary.style.display = 'block';
        }

        /**
         * Show error state
         */
        showErrorState(message) {
            const noDataState = this.elements.get('noDataState');
            if (noDataState) {
                noDataState.style.display = 'block';
                noDataState.innerHTML = `
                    <div class="error-icon">⚠️</div>
                    <p>Error loading APR data</p>
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
         * Animate value changes
         */
        animateValueChange(element) {
            if (this.config.HIGHLIGHT_CHANGES && element) {
                element.classList.add('value-updated');
                setTimeout(() => element.classList.remove('value-updated'), 1000);
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
         * Format APR for display
         */
        formatAPR(apr) {
            if (apr === 0) return '0.00%';
            if (apr >= 999999) return '999,999%+';
            if (apr < 0.01) return '<0.01%';

            return `${apr.toFixed(this.config.DECIMAL_PLACES)}%`;
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
         * Show/hide the component
         */
        show() {
            if (this.container) {
                this.container.style.display = 'block';
                this.isVisible = true;
                this.refreshAllAPRs();
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
                aprDataCount: this.aprData.size,
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
                console.log(`Cleaning up ${key} event listener`);
            }
            this.eventListeners.clear();

            // Clear data
            this.aprData.clear();
            this.previousAPRs.clear();
            this.elements.clear();

            // Remove DOM element
            if (this.container && this.container.parentNode) {
                this.container.parentNode.removeChild(this.container);
            }

            this.isInitialized = false;
            console.log('APRDisplay: Resources cleaned up');
        }
    }

    // Export to global scope
    global.APRDisplay = APRDisplay;

    console.log('✅ APRDisplay class registered globally');

})(typeof window !== 'undefined' ? window : global);
