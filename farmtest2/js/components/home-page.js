/**
 * Home Page Component - Matches React home.tsx exactly
 * Displays the main staking interface with data table
 * Implements all functionality from milestones.md
 */

class HomePage {
    constructor() {
        this.pairs = [];
        this.loading = true;
        this.error = null;
        this.refreshInterval = null;
        this.isInitialized = false;
        this.isRefreshing = false; // Prevent overlapping refreshes
        this.autoRefreshActive = false; // Prevent multiple auto-refresh timers
        this.hourlyRewardRate = '0.00';
        this.totalWeight = '0';
        this.lastWalletAddress = null;
        this.lastNetworkId = null;
        this.refreshDebounceTimer = null; // Prevent overlapping refreshes during rapid network changes
        this.isAdmin = false; // Track admin status
        // OPTIMIZATION: Simple caching for contract data that doesn't change frequently
        this.cache = {
            hourlyRewardRate: { value: null, timestamp: 0, ttl: 300000 }, // 5 minutes
            totalWeight: { value: null, timestamp: 0, ttl: 60000 },       // 1 minute
            pairsInfo: { value: null, timestamp: 0, ttl: 120000 }         // 2 minutes
        };

        this.init();
    }

    init() {
        if (this.isInitialized) return;

        console.log('🏠 Initializing HomePage component...');
        this.render();
        this.attachEventListeners();
        this.setupContractManagerListeners();
        this.setupWalletChangeDetection();
        this.setupNetworkIndicator();
        this.setupNetworkSelector();
        this.loadDataWhenReady();
        this.isInitialized = true;

        console.log('✅ HomePage component initialized successfully');
    }

    /**
     * Set up listeners for contract manager events
     */
    setupContractManagerListeners() {
        // Listen for contract manager ready event
        document.addEventListener('contractManagerReady', () => {
            console.log('🏠 HomePage: ContractManager is ready, loading data...');
            this.loadData().catch(() => {});
            // Auto-refresh disabled - manual refresh only
        });

        // Listen for contract manager error event
        document.addEventListener('contractManagerError', (event) => {
            console.error('🏠 HomePage: ContractManager error:', event.detail.error);
            this.error = `Contract manager initialization failed: ${event.detail.error}`;
            this.loading = false;
            this.render();
        });

        // Listen for wallet disconnection
        document.addEventListener('contractManagerDisconnected', () => {
            console.log('🏠 HomePage: ContractManager disconnected, stopping refresh...');
            this.stopAutoRefresh();
            this.pairs = [];
            this.loading = true;
            this.error = null;
            this.render();
        });
    }

    /**
     * Set up wallet and network change detection
     */
    setupWalletChangeDetection() {
        // Listen for wallet connection changes
        document.addEventListener('walletConnected', (event) => {
            console.log('🏠 HomePage: Wallet connected, refreshing data...');
            window.NetworkIndicator?.update('network-indicator-home', 'home-network-selector', 'home');
            this.refreshDataAfterWalletChange();
            this.checkAdminAccess();
        });

        document.addEventListener('walletDisconnected', () => {
            console.log('🏠 HomePage: Wallet disconnected, refreshing data...');
            window.NetworkIndicator?.update('network-indicator-home', 'home-network-selector', 'home');
            this.refreshDataAfterWalletChange();
            this.hideAdminButton();
        });

        // Listen for account changes (MetaMask)
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                console.log('🏠 HomePage: Accounts changed:', accounts);
                this.refreshDataAfterWalletChange();
                this.checkAdminAccess();
            });

            // Re-check permissions when wallet network changes
            window.ethereum.on('chainChanged', (chainId) => {
                console.log('🏠 HomePage: Chain changed:', chainId);
                // Only update the network indicator to re-check permissions
                window.NetworkIndicator?.update('network-indicator-home', 'home-network-selector', 'home');
            });

            // Re-check permissions when page regains focus (in case permissions were removed in another tab)
            window.addEventListener('focus', () => {
                console.log('🏠 HomePage: Page focused, re-checking permissions...');
                window.NetworkIndicator?.update('network-indicator-home', 'home-network-selector', 'home');
            });
        }
    }

    /**
     * Refresh data after wallet/network changes (debounced to prevent overlapping loads)
     */
    refreshDataAfterWalletChange() {
        // Cancel any pending refresh
        clearTimeout(this.refreshDebounceTimer);
        this.loading = true;
        this.pairs = [];
        this.error = null;
        this.render(); // Show skeleton immediately
        
        // Schedule new refresh after 500ms (waits for rapid events + network transition to settle)
        this.refreshDebounceTimer = setTimeout(async () => {
            console.log('🔄 Wallet/network changed, clearing cache and refreshing data...');
            // Clear cache to remove stale provider references
            this.cache.hourlyRewardRate = { value: null, timestamp: 0, ttl: this.cache.hourlyRewardRate.ttl };
            this.cache.totalWeight = { value: null, timestamp: 0, ttl: this.cache.totalWeight.ttl };
            this.cache.pairsInfo = { value: null, timestamp: 0, ttl: this.cache.pairsInfo.ttl };
            await this.loadData().catch(() => {});
        }, 1000);
    }

    /**
     * Load data when contract manager is ready
     */
    async loadDataWhenReady() {
        if (window.contractManager && window.contractManager.isReady()) {
            console.log('🏠 HomePage: ContractManager already ready, loading data immediately...');
            await this.loadData().catch(() => {});
            this.checkAdminAccess();
            // Auto-refresh disabled - manual refresh only
        } else {
            console.log('🏠 HomePage: Waiting for ContractManager to be ready...');
            this.loading = true;
            this.error = null;
            this.render();
        }
    }

    // Helper method to safely check wallet connection
    isWalletConnected() {
        try {
            return window.walletManager &&
                   typeof window.walletManager.isWalletConnected === 'function' &&
                   window.walletManager.isWalletConnected();
        } catch (error) {
            console.warn('Error checking wallet connection:', error);
            return false;
        }
    }

    render() {
        const container = document.getElementById('content-container');
        if (!container) return;

        if (this.loading) {
            container.innerHTML = this.renderSkeleton();
        } else if (this.error) {
            container.innerHTML = this.renderError();
        } else {
            container.innerHTML = this.renderHomepage();
        }

        this.attachRetryHandler();
    }

    renderHomepage() {
        return this.renderTable();
    }

    attachRetryHandler() {
        const retryBtn = document.getElementById('retry-load');
        if (retryBtn) {
            retryBtn.onclick = () => {
                this.loadData().catch(() => {});
            };
        }
    }

    renderSkeleton() {
        return `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>
                                <span class="material-icons">swap_horiz</span>
                                Pair
                            </th>
                            <th>
                                <span class="material-icons">business</span>
                                Platform
                            </th>
                            <th>
                                <span class="material-icons">trending_up</span>
                                APR
                            </th>
                            <th>
                                <span class="material-icons">fitness_center</span>
                                Weight
                            </th>
                            <th>
                                <span class="material-icons">account_balance</span>
                                TVL
                            </th>
                            <th>
                                <span class="material-icons">pie_chart</span>
                                My Share
                            </th>
                            <th>
                                <span class="material-icons">monetization_on</span>
                                My Reward
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Array(3).fill(0).map(() => `
                            <tr>
                                <td><div class="skeleton" style="height: 20px; width: 120px;"></div></td>
                                <td><div class="skeleton" style="height: 20px; width: 80px;"></div></td>
                                <td><div class="skeleton" style="height: 20px; width: 60px;"></div></td>
                                <td><div class="skeleton" style="height: 20px; width: 80px;"></div></td>
                                <td><div class="skeleton" style="height: 20px; width: 100px;"></div></td>
                                <td><div class="skeleton" style="height: 20px; width: 80px;"></div></td>
                                <td><div class="skeleton" style="height: 20px; width: 120px;"></div></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderError() {
        return `
            <div class="error-container" style="text-align: center; padding: 48px; color: var(--error-main);">
                <span class="material-icons" style="font-size: 48px; margin-bottom: 16px;">error</span>
                <h3>Failed to load staking data</h3>
                <p>${this.error}</p>
                <button class="btn btn-primary" id="retry-load" type="button" style="margin-top: 16px;">
                    <span class="material-icons">refresh</span>
                    Retry
                </button>
            </div>
        `;
    }

    renderTable() {
        // Generate table rows - either data rows or "no data" row
        let tbodyContent = '';
        if (this.pairs.length === 0) {
            // Show "no data" row when there are no pairs
            tbodyContent = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 48px 24px; color: var(--text-secondary);">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
                            <span class="material-icons" style="font-size: 48px; color: var(--text-secondary); opacity: 0.5;">inbox</span>
                            <div>
                                <p style="font-size: 16px; font-weight: 500; margin: 0 0 8px 0; color: var(--text-primary);">No Staking Pairs Available</p>
                                <p style="font-size: 14px; margin: 0; color: var(--text-secondary);">
                                    There are currently no staking pairs configured in the contract. Please check back later.
                                </p>
                            </div>
                            <button class="btn btn-primary" id="retry-load" type="button" style="margin-top: 8px;">
                                <span class="material-icons">refresh</span>
                                Refresh Data
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            // Show data rows
            tbodyContent = [...this.pairs].sort((a, b) => {
                const parseValue = (value) => {
                    const num = parseFloat(value ?? '0');
                    return Number.isFinite(num) ? num : 0;
                };

                const aprA = parseValue(a.apr);
                const aprB = parseValue(b.apr);
                if (aprB !== aprA) {
                    return aprB - aprA;
                }

                const tvlA = parseValue(a.tvl ?? a.totalStaked);
                const tvlB = parseValue(b.tvl ?? b.totalStaked);
                return tvlB - tvlA;
            }).map(pair => this.renderPairRow(pair)).join('');
        }

        return `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>
                                <span class="material-icons">swap_horiz</span>
                                Pair
                            </th>
                            <th>
                                <span class="material-icons">business</span>
                                Platform
                            </th>
                            <th>
                                <span class="material-icons">trending_up</span>
                                APR
                            </th>
                            <th>
                                <span class="material-icons">fitness_center</span>
                                Weight
                            </th>
                            <th>
                                <span class="material-icons">account_balance</span>
                                TVL
                            </th>
                            <th>
                                <span class="material-icons">pie_chart</span>
                                My Share
                            </th>
                            <th>
                                <span class="material-icons">monetization_on</span>
                                My Reward
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tbodyContent}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderPairRow(pair) {
        const isConnected = this.isWalletConnected();
        const canTransact = isConnected && (window.networkManager?.isOnRequiredNetwork() || false);
        const userShares = pair.userShares || '0.00';
        const userEarnings = pair.userEarnings || '0.00';
        
        return `
            <tr class="pair-row" data-pair-id="${pair.id}" style="cursor: pointer;">
                <td>
                    ${window.Formatter?.formatPairName(pair.name, pair.address, pair.platform) || pair.name}
                </td>
                <td>
                    ${pair.platform ? `<span style="font-weight: 600; font-size: smaller;">${pair.platform}</span>` : '<span>-</span>'}
                </td>
                <td>
                    <span style="color: var(--success-main); font-weight: bold;">${pair.apr || '0.00'}%</span>
                </td>
                <td>
                    <span style="font-weight: 600;">
                        ${pair.weightPercentage || '0.00'}%
                    </span>
                </td>
                <td>
                    <span style="font-weight: 600;">${this.formatNumber(pair.tvl || 0)}</span>
                </td>
                <td>
                    <button class="btn btn-primary btn-small btn-share"
                            data-pair-id="${pair.id}"
                            data-pair-address="${pair.address}"
                            data-tab="0"
                            ${!canTransact ? 'disabled' : ''}
                            title="Stake or Unstake"
                            style="min-width: 100px;">
                        <span class="material-icons" style="font-size: 16px;">share</span>
                        ${userShares}%
                    </button>
                </td>
                <td>
                    <button class="btn btn-secondary btn-small btn-earnings"
                            data-pair-id="${pair.id}"
                            data-pair-address="${pair.address}"
                            data-tab="2"
                            ${!canTransact ? 'disabled' : ''}
                            title="Claim reward"
                            style="min-width: 120px;">
                        <span class="material-icons" style="font-size: 16px;">redeem</span>
                        ${userEarnings} LIB
                    </button>
                </td>
            </tr>
        `;
    }

    attachEventListeners() {
        // Refresh button with enhanced functionality
        const refreshBtn = document.getElementById('refresh-button');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.handleRefreshClick());
        }

        // Delegate event listeners for dynamic content (buttons in table rows)
        document.addEventListener('click', (e) => {
            // Handle row click (open modal on default tab)
            if (e.target.closest('.pair-row')) {
                const pairId = e.target.closest('.pair-row').dataset.pairId;
                // Don't trigger on buttons, links, or pair name links
                if (!e.target.closest('button') && !e.target.closest('a') && !e.target.closest('.pair-name-link')) {
                    // Check if wallet is connected before opening modal
                    if (!this.isWalletConnected()) {
                        if (window.notificationManager) {
                            window.notificationManager.warning(
                                'Please connect your wallet to stake tokens'
                            );
                        }
                        return; // Don't open modal
                    }
                    
                    // Check if wallet is on configured network
                    if (!(window.networkManager?.isOnRequiredNetwork() || false)) {
                        const networkName = window.CONFIG?.NETWORK?.NAME || 'configured network';
                        if (window.notificationManager) {
                            window.notificationManager.warning(
                                `Please switch to ${networkName} network to make transactions`
                            );
                        }
                        return; // Don't open modal
                    }
                    
                    this.openStakingModal(pairId);
                }
            }

            // Handle Share button click (open modal on Stake tab)
            if (e.target.closest('.btn-share')) {
                e.stopPropagation();
                const button = e.target.closest('.btn-share');
                const pairId = button.dataset.pairId;
                const tab = parseInt(button.dataset.tab) || 0;
                this.openStakingModal(pairId, tab === 0 ? 'stake' : 'unstake');
            }

            // Handle Earnings button click (open modal on Claim tab)
            if (e.target.closest('.btn-earnings')) {
                e.stopPropagation();
                const button = e.target.closest('.btn-earnings');
                const pairId = button.dataset.pairId;
                this.openStakingModal(pairId, 'claim');
            }

        });
    }

    /**
     * Handle refresh button click with loading state
     */
    async handleRefreshClick() {
        console.log('🔄 Manual refresh requested');
        const refreshButton = document.getElementById('refresh-button');

        // Add loading state
        if (refreshButton) {
            refreshButton.disabled = true;
            refreshButton.innerHTML = '<span class="material-icons">hourglass_empty</span>';
        }

        try {
            await this.refreshData();
            window.notificationManager.success('Data refreshed successfully!');
        } catch (error) {
            console.error('❌ Manual refresh failed:', error);
            window.notificationManager.error('Failed to refresh data');
        } finally {
            // Reset button state
            if (refreshButton) {
                refreshButton.disabled = false;
                refreshButton.innerHTML = '<span class="material-icons">refresh</span>';
            }
        }
    }

    async loadData() {
        try {
            this.loading = true;
            this.error = null;
            this.render();

            console.log('📊 Loading staking data...');

            // Check if contract manager is ready
            if (!window.contractManager) {
                throw new Error('Contract manager not available');
            }

            if (!window.contractManager.isReady()) {
                console.log('⏳ Waiting for contract manager to be ready...');
                const isReady = await window.contractManager.waitForReady(10000);
                if (!isReady) {
                    throw new Error('Contract manager not ready after timeout');
                }
            }

            // Add small delay to ensure everything is settled
            await new Promise(resolve => setTimeout(resolve, 200));

            // Try to load real blockchain data first
            await this.loadBlockchainData();

            this.loading = false;
            this.render();

            console.log('✅ Staking data loaded successfully');

        } catch (error) {
            console.error('❌ Failed to load staking data:', error);
            this.error = 'Unable to load staking data right now.';
            this.loading = false;
            this.render();
            throw error;
        }
    }

    /**
     * Load empty data when no contracts are deployed
     */
    loadEmptyData() {
        console.log('📊 Loading empty data for network without contracts...');
        
        // Set empty data
        this.hourlyRewardRate = 0;
        this.totalWeight = 0;
        this.pairsData = [];
        this.pairs = [];
        this.loading = false;
        
        // Update display
        this.render();
        
        console.log('✅ Empty data loaded successfully');
    }

    /**
     * Load real blockchain data from contracts - OPTIMIZED FOR SPEED
     */
    async loadBlockchainData() {
        console.log('🚀 Loading blockchain data with parallel optimization...');
        const startTime = performance.now();

        if (!window.contractManager || !window.contractManager.isReady()) {
            throw new Error('Contract manager not ready');
        }

        // Check if there are valid contracts for the current network
        const contracts = window.CONFIG.CONTRACTS;
        if (!contracts.STAKING_CONTRACT || contracts.STAKING_CONTRACT.trim() === '') {
            console.log('⚠️ No contracts deployed on current network - loading empty data');
            this.loadEmptyData();
            return;
        }

        try {
            // OPTIMIZATION 1: Try multicall for basic contract data first
            console.log('⚡ Checking cache and starting optimized data loading...');

            const now = Date.now();
            let hourlyRateWei, totalWeightWei, allPairsInfo;

            // Load basic contract data with multicall
            const basicData = await window.contractManager.getBasicContractData();
            hourlyRateWei = basicData.hourlyRewardRate;
            totalWeightWei = basicData.totalWeight;
            
            // Update cache
            this.cache.hourlyRewardRate = { value: hourlyRateWei, timestamp: now, ttl: this.cache.hourlyRewardRate.ttl };
            this.cache.totalWeight = { value: totalWeightWei, timestamp: now, ttl: this.cache.totalWeight.ttl };

            // Check cache for pairs info
            if (this.cache.pairsInfo.value && (now - this.cache.pairsInfo.timestamp) < this.cache.pairsInfo.ttl) {
                allPairsInfo = this.cache.pairsInfo.value;
                console.log('📦 Using cached pairs info');
            } else {
                allPairsInfo = await window.contractManager.getAllPairsInfo();
                this.cache.pairsInfo = { value: allPairsInfo, timestamp: now, ttl: this.cache.pairsInfo.ttl };
            }

            // Process basic data immediately
            this.hourlyRewardRate = ethers.utils.formatEther(hourlyRateWei);
            this.totalWeight = ethers.utils.formatEther(totalWeightWei);

            const parallelTime = performance.now() - startTime;
            console.log(`⚡ Parallel basic data loaded in ${parallelTime.toFixed(0)}ms`);
            console.log(`✅ Hourly rate: ${this.hourlyRewardRate} LIB/hour, Total weight: ${this.totalWeight}`);
            console.log('📋 Retrieved pairs from contract:', allPairsInfo);

            this.pairs = [];

            if (allPairsInfo.length === 0) {
                console.log('⚠️ No pairs configured in the staking contract yet');
                // Keep pairs empty - will show empty state UI
            } else {
                // OPTIMIZATION 2: Progressive display - show basic pair data immediately
                console.log('⚡ Processing pairs with progressive loading...');

                // First, create basic pair data without user-specific info
                // Filter out pairs with missing critical data (address is required)
                const basicPairs = allPairsInfo
                    .filter(pairInfo => pairInfo.address && pairInfo.address !== '0x0000000000000000000000000000000000000000')
                    .map((pairInfo, i) => {
                        const weightPercentage = this.totalWeight > 0 ?
                            ((parseFloat(pairInfo.weight || '0') * 100) / parseFloat(this.totalWeight)).toFixed(2) :
                            '0.00';

                        // Use address as fallback for name if missing, but don't create fake names
                        const displayName = pairInfo.name || `${pairInfo.address.slice(0, 6)}...${pairInfo.address.slice(-4)}`;

                        return {
                            id: pairInfo.id || (i + 1).toString(),
                            address: pairInfo.address,
                            name: displayName,
                            platform: pairInfo.platform || '',
                            apr: pairInfo.apr || '0.00',
                            tvl: pairInfo.tvl || 0,
                            userShares: '0.00', // Will be updated if wallet connected
                            userEarnings: '0.00', // Will be updated if wallet connected
                            totalStaked: pairInfo.totalStaked || '0',
                            rewardRate: pairInfo.rewardRate || '0',
                            stakingEnabled: pairInfo.isActive !== false,
                            weight: pairInfo.weight || '0',
                            weightPercentage: weightPercentage
                        };
                    });

                // Set basic pairs immediately for progressive display
                this.pairs = basicPairs;
                
                // If all pairs were filtered out, log a warning
                if (basicPairs.length === 0 && allPairsInfo.length > 0) {
                    console.warn('⚠️ All pairs were filtered out due to missing critical data');
                }
                
                this.render(); // Show basic data immediately (will show empty state if pairs.length === 0)

                // OPTIMIZATION 2.5: Calculate TVL and APR in parallel for each pair (skip if no pairs)
                if (this.pairs.length > 0) {
                    console.log('⚡ Calculating TVL and APR for all pairs...');
                    await this.calculateTVLAndAPR();
                    console.log('🎨 Re-rendering after TVL/APR calculation...');
                    console.log('📊 Pairs data after calculation:', this.pairs.map(p => ({ name: p.name, tvl: p.tvl, apr: p.apr })));
                    this.render(); // Re-render with TVL and APR data
                }

                // OPTIMIZATION 3: Load user data in parallel if wallet connected (skip if no pairs)
                if (this.pairs.length > 0 && this.isWalletConnected() && window.walletManager?.currentAccount) {
                    console.log('⚡ Loading user stake data in parallel...');
                    console.log('👛 Using wallet address:', window.walletManager.currentAccount);
                    
                    const isOnCorrectNetwork = window.networkManager?.isOnRequiredNetwork() || false;
                    
                    if (!isOnCorrectNetwork) {
                        const networkName = window.CONFIG?.NETWORK?.NAME || 'configured network';
                        const currentChainId = window.walletManager?.getChainId();
                        const currentNetworkName = window.networkManager?.getNetworkName(currentChainId) || 'Unknown';
                        console.log(`📊 Read-only mode: Wallet on ${currentNetworkName}, viewing ${networkName} data`);
                        console.log(`💡 Switch to ${networkName} to make transactions`);
                    }

                    // Load user data with multicall (use filtered pairs, not allPairsInfo)
                    const validPairsInfo = allPairsInfo.filter(pairInfo => 
                        pairInfo.address && pairInfo.address !== '0x0000000000000000000000000000000000000000'
                    );
                    const userDataMap = await window.contractManager.getUserDataForAllPairs(
                        window.walletManager.currentAccount,
                        validPairsInfo
                    );

                    // Process user data from Map - use address to match pairs correctly
                    this.pairs.forEach((pair, pairIndex) => {
                        const data = userDataMap.get(pair.address);
                        if (!data) {
                            return; // Skip if no user data
                        }

                        const userStake = {
                            amount: ethers.utils.formatEther(data.stake || '0'),
                            rewards: ethers.utils.formatEther(data.pendingRewards || '0')
                        };

                        // Update pairs with user data - EXACT React implementation
                        // React source: lib-lp-staking-frontend/src/pages/home.tsx (Lines 59-64)
                        if (this.pairs[pairIndex]) {
                            // React Line 62: myShare = tvlWei > 0n ? Number((userStake.amount * 100n) / tvlWei) : 0;
                            // Both userStake.amount and tvl are in ether format (already converted from wei)
                            const userStakeAmount = parseFloat(userStake.amount || '0');
                            const tvl = this.pairs[pairIndex].tvl || 0;  // This is now LP token count

                            if (userStakeAmount > 0 && tvl > 0) {
                                // Calculate share percentage: (userStake * 100) / TVL
                                const sharePercentage = (userStakeAmount * 100) / tvl;
                                this.pairs[pairIndex].userShares = sharePercentage.toFixed(2);
                            } else {
                                this.pairs[pairIndex].userShares = '0.00';
                            }

                            // React Line 63: myEarnings = Number(ethers.formatEther(await getPendingRewards(...)));
                            // Format user earnings
                            const earnings = parseFloat(userStake.rewards || '0');
                            this.pairs[pairIndex].userEarnings = earnings.toFixed(4);  // React uses .toFixed(4)

                            console.log(`📊 Pair ${pairIndex}: SharePercentage=${this.pairs[pairIndex].userShares}%, Earnings=${this.pairs[pairIndex].userEarnings} LIB`);
                        }
                    });

                    console.log('⚡ User data loaded and updated');

                    // Re-render to show updated user data
                    this.render();
                    console.log('🎨 UI re-rendered with user data');
                }
            }

               const totalTime = performance.now() - startTime;
               console.log(`🚀 OPTIMIZED: Blockchain data loaded in ${totalTime.toFixed(0)}ms (${this.pairs.length} pairs)`);
        } catch (error) {
            console.error('❌ Failed to load blockchain data:', error);
            
            // Network switched mid-load - gracefully show empty state, next refresh will fix
            if (error.code === 'NETWORK_ERROR' || error.message?.includes('underlying network changed')) {
                console.log('🔄 Network changed during load, skipping (will retry on next refresh)');
                this.pairs = [];
                return;
            }
            
            throw error;
        }
    }

    /**
     * Calculate TVL and APR for all pairs using on-chain LP composition.
     * TVL remains in LP token units, while APR now leverages the LIB-per-LP
     * ratio derived from Uniswap V2 reserve data instead of external pricing.
     */
    async calculateTVLAndAPR() {
        if (this.pairs.length === 0) {
            return; // No pairs to calculate
        }

        if (!window.rewardsCalculator || !window.contractManager) {
            console.warn('⚠️ Rewards calculator or contract manager not available, skipping TVL/APR calculation');
            return;
        }

        try {
            console.log('⚡ Calculating TVL and APR for all pairs...');

            const rewardTokenAddress = (window.contractManager?.contractAddresses instanceof Map)
                ? window.contractManager.contractAddresses.get('REWARD_TOKEN')
                : null;
            const rewardTokenAddressLower = typeof rewardTokenAddress === 'string'
                ? rewardTokenAddress.toLowerCase()
                : null;

            const hourlyRate = Number(this.hourlyRewardRate) || 0;
            const totalWeight = Number(this.totalWeight) || 1;

            const calculations = this.pairs.map(async (pair, index) => {
                try {
                    console.log(`🔍 Calculating TVL/APR for ${pair.name}...`);

                    const breakdown = await window.contractManager.getLPStakeBreakdown(pair.address);
                    const lpDecimals = Number(breakdown?.lpToken?.decimals) || 18;
                    const stakedBn = ethers.BigNumber.from(breakdown?.lpToken?.stakedBalance?.raw || '0');
                    const tvlInTokens = Number(ethers.utils.formatUnits(stakedBn, lpDecimals)) || 0;

                    const poolWeight = Number(pair.weight) || 1;

                    const token0 = breakdown?.token0;
                    const token1 = breakdown?.token1;
                    const token0Addr = token0?.address?.toLowerCase?.();
                    const token1Addr = token1?.address?.toLowerCase?.();

                    let libToken = null;
                    if (rewardTokenAddressLower && token0Addr === rewardTokenAddressLower) {
                        libToken = token0;
                    } else if (rewardTokenAddressLower && token1Addr === rewardTokenAddressLower) {
                        libToken = token1;
                    }

                    if (!libToken) {
                        console.warn(`⚠️ LIB token not found for ${pair.name}, skipping APR calculation`);
                        return;
                    }

                    const libStaked = Number(libToken?.staked?.formatted) || 0;
                    const libReserve = Number(libToken?.reserve?.formatted) || 0;

                    const otherToken = libToken === token0 ? token1 : token0;
                    const otherStaked = Number(otherToken?.staked?.formatted) || 0;
                    const otherReserve = Number(otherToken?.reserve?.formatted) || 0;

                    // Convert the counter token stake to a LIB-equivalent amount using the reserve ratio
                    let otherTokenLibEquivalent = 0;
                    if (otherStaked > 0 && otherReserve > 0 && libReserve > 0) {
                        const otherToLibRate = libReserve / otherReserve;
                        otherTokenLibEquivalent = otherStaked * otherToLibRate;
                    }

                    const totalStakeValueInLib = libStaked + otherTokenLibEquivalent;
                    const stakeValuePerLpInLib = tvlInTokens > 0 ? totalStakeValueInLib / tvlInTokens : 0;

                    if (stakeValuePerLpInLib <= 0) {
                        console.warn(`⚠️ Invalid LIB-equivalent value per LP for ${pair.name}, skipping APR calculation`);
                        return;
                    }

                    const apr = window.rewardsCalculator.calcAPR(
                        hourlyRate,
                        tvlInTokens,
                        stakeValuePerLpInLib,
                        poolWeight,
                        totalWeight
                    );

                    const tvl = tvlInTokens;

                    console.log(`  📊 TVL (LP tokens): ${tvlInTokens}`);
                    console.log(`  💧 LIB-equivalent value per LP token: ${stakeValuePerLpInLib}`);
                    console.log(`  💠 LIB tokens in stake: ${libStaked}`);
                    console.log(`  🔁 Counter-token LIB equivalent: ${otherTokenLibEquivalent}`);
                    console.log(`  📈 Calculated APR: ${apr.toFixed(1)}%`);

                    // Update pair data to match React structure
                    console.log(`🔧 Updating pair ${index} (${pair.name}):`);
                    console.log(`  Before: tvl=${this.pairs[index].tvl}, apr=${this.pairs[index].apr}`);

                    this.pairs[index].tvl = tvl;  // Token count, not USD
                    this.pairs[index].apr = apr.toFixed(1);  // React uses .toFixed(1)
                    this.pairs[index].totalStaked = tvlInTokens.toFixed(6);
                    this.pairs[index].libPerLp = stakeValuePerLpInLib;
                    this.pairs[index].libTokensStaked = libStaked;
                    this.pairs[index].counterTokenStaked = otherStaked;
                    this.pairs[index].counterTokenLibEquivalent = otherTokenLibEquivalent;
                    this.pairs[index].totalStakeValueInLib = totalStakeValueInLib;

                    console.log(`  After: tvl=${this.pairs[index].tvl}, apr=${this.pairs[index].apr}`);
                    console.log(`✅ ${pair.name}: TVL=${tvl.toFixed(2)} LP, APR=${apr.toFixed(1)}%`);

                } catch (error) {
                    console.error(`❌ Failed to calculate TVL/APR for ${pair.name}:`, error);
                    window.notificationManager?.error(`Failed to calculate TVL/APR for ${pair.name}`);
                    // Keep default values (0)
                }
            });

            // Wait for all calculations to complete
            await Promise.all(calculations);
            console.log('✅ TVL and APR calculation completed for all pairs');

        } catch (error) {
            console.error('❌ Failed to calculate TVL and APR:', error);
        }
    }

    openStakingModal(pairId, tab = 'stake') {
        const pair = this.pairs.find(p => p.id === pairId);
        if (!pair) return;

        if (window.stakingModal) {
            window.stakingModal.open(pair, tab);
        } else {
            console.warn('Staking modal not available');
        }
    }

    /**
     * Public method to refresh data (called by staking modal after transactions)
     */
    async refreshData() {
        if (this.isRefreshing) {
            console.log('🔄 Refresh already in progress, skipping...');
            return;
        }

        this.isRefreshing = true;
        this.loading = true;
        console.log('🔄 Refreshing homepage data...');
        this.render(); // Show skeleton table
        try {
            await this.loadData();
            console.log('✅ Homepage data refreshed successfully');
        } catch (error) {
            console.error('❌ Failed to refresh homepage data:', error);
            throw error;
        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * Auto-refresh disabled to prevent flickering and improve user experience
     * Manual refresh is still available via the refresh button
     */
    startAutoRefresh() {
        console.log('🚫 Auto-refresh disabled - use manual refresh button instead');
        // Auto-refresh functionality has been disabled to prevent constant flickering
        // Users can still refresh data manually using the refresh button
        return;
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(2) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(2) + 'K';
        }
        return num.toFixed(2);
    }



    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
            this.autoRefreshActive = false; // Reset auto-refresh flag
            console.log('⏹️ HomePage: Auto-refresh stopped');
        }
    }

    /**
     * Setup network indicator and listeners
     */
    setupNetworkIndicator() {
        // Update indicator initially
        window.NetworkIndicator?.update('network-indicator-home', 'home-network-selector', 'home');

        // Update on wallet connection/disconnection
        document.addEventListener('walletConnected', () => {
            window.NetworkIndicator?.update('network-indicator-home', 'home-network-selector', 'home');
        });

        document.addEventListener('walletDisconnected', () => {
            // Update network indicator to show disconnected state
            window.NetworkIndicator?.update('network-indicator-home', 'home-network-selector', 'home');
        });
    }


    /**
     * Set up network selector
     */
    setupNetworkSelector() {
        if (!window.networkSelector) {
            console.warn('⚠️ Network selector not available');
            return;
        }

        // Initialize network selector with change handler
        window.networkSelector.init(async (networkKey, context) => {
            console.log(`🌐 Network changed to ${networkKey} in ${context}`);
            
            // Clear cache to ensure fresh data is fetched for new network
            this.cache.hourlyRewardRate = { value: null, timestamp: 0, ttl: this.cache.hourlyRewardRate.ttl };
            this.cache.totalWeight = { value: null, timestamp: 0, ttl: this.cache.totalWeight.ttl };
            this.cache.pairsInfo = { value: null, timestamp: 0, ttl: this.cache.pairsInfo.ttl };
            
            // Refresh contract data for new network
            if (window.contractManager) {
                try {
                    await window.contractManager.initialize();
                    this.loadDataWhenReady();
                } catch (error) {
                    console.error('❌ Error refreshing contract data:', error);
                    this.loading = false;
                    this.error = 'Failed to initialize contract for new network';
                    this.render();
                }
            }

            // Update network indicator
            window.NetworkIndicator?.update('network-indicator-home', 'home-network-selector', 'home');
        });

    }


    destroy() {
        this.stopAutoRefresh();
        clearTimeout(this.refreshDebounceTimer);
    }

    /**
     * Check if the connected account has admin access
     */
    async checkAdminAccess() {
        const adminButton = document.getElementById('admin-panel-link');
        if (!adminButton) return;

        console.log('🔍 Checking admin access...');

        // Check if wallet is connected
        if (!this.isWalletConnected()) {
            this.hideAdminButton();
            return;
        }

        try {
            // Wait for contract manager to be ready before making contract calls
            if (window.contractManager && !window.contractManager.isReady()) {
                await window.contractManager.waitForReady(10000); // Wait up to 10 seconds
            }

            // Get the current user address (network-agnostic for permission checks)
            const userAddress = await window.contractManager?.getCurrentSignerForPermissions();
            if (!userAddress) {
                this.hideAdminButton();
                return;
            }

            console.log('👤 Checking admin access for:', userAddress);

            // Development mode check
            if (window.DEV_CONFIG?.AUTHORIZED_ADMINS) {
                const isAuthorizedAdmin = window.DEV_CONFIG.AUTHORIZED_ADMINS.some(
                    admin => admin.toLowerCase() === userAddress.toLowerCase()
                );
                if (isAuthorizedAdmin) {
                    this.showAdminButton();
                    return;
                }
            }

            // Check if user has admin role from contract (with timeout and error handling)
            if (window.contractManager?.hasAdminRole) {
                try {
                    let timeoutId;
                    const timeoutPromise = new Promise((_, reject) => {
                        timeoutId = setTimeout(() => reject(new Error('Admin role check timeout')), 5000);
                    });
                    
                    const hasAdminRole = await Promise.race([
                        window.contractManager.hasAdminRole(userAddress),
                        timeoutPromise
                    ]);
                    
                    // Clear the timeout since the race completed
                    clearTimeout(timeoutId);
                    
                    if (hasAdminRole) {
                        this.showAdminButton();
                        return;
                    }
                } catch (adminRoleError) {
                    console.warn('⚠️ Admin role check failed:', adminRoleError.message);
                }
            }

            // Check if user has the owner approver role (with timeout and error handling)
            if (typeof window.contractManager?.hasOwnerApproverRole === 'function') {
                try {
                    let timeoutId;
                    const timeoutPromise = new Promise((_, reject) => {
                        timeoutId = setTimeout(() => reject(new Error('Owner approver role check timeout')), 5000);
                    });

                    const hasOwnerRole = await Promise.race([
                        window.contractManager.hasOwnerApproverRole(userAddress),
                        timeoutPromise
                    ]);

                    clearTimeout(timeoutId);

                    if (hasOwnerRole) {
                        this.showAdminButton();
                        return;
                    }
                } catch (ownerRoleError) {
                    console.warn('⚠️ Owner approver role check failed:', ownerRoleError.message);
                }
            }

            // If none of the checks passed, hide the button
            this.hideAdminButton();
        } catch (error) {
            console.error('❌ Error checking admin access:', error);
            this.hideAdminButton();
        }
    }

    /**
     * Check if we're currently in the middle of a network switch
     */
    isNetworkSwitching() {
        // Check if contract manager is initializing
        if (window.contractManager && window.contractManager.isInitializing) {
            return true;
        }
        
        // Check if we're in the middle of a network switch
        return window.networkSelector && window.networkSelector.isNetworkSwitching();
    }

    /**
     * Show the admin button
     */
    showAdminButton() {
        const adminButton = document.getElementById('admin-panel-link');
        if (adminButton) {
            adminButton.style.display = 'flex';
            adminButton.classList.remove('admin-checking');
            window.masterInitializer?.updateAdminPanelLink('admin');
            this.isAdmin = true;
        }
    }

    /**
     * Hide the admin button
     */
    hideAdminButton() {
        const adminButton = document.getElementById('admin-panel-link');
        if (adminButton) {
            adminButton.style.display = 'none';
            adminButton.classList.remove('admin-checking');
            window.masterInitializer?.updateAdminPanelLink('admin');
            this.isAdmin = false;
        }
    }

    /**
     * Show admin button with checking indicator
     */
    showAdminButtonChecking() {
        const adminButton = document.getElementById('admin-panel-link');
        if (adminButton) {
            adminButton.style.display = 'flex';
            adminButton.classList.add('admin-checking');
            window.masterInitializer?.updateAdminPanelLink('admin');
            this.isAdmin = false; // Not confirmed yet
        }
    }
}


// Initialize home page
let homePage;
document.addEventListener('DOMContentLoaded', () => {
    homePage = new HomePage();
});

// Export for global access
window.HomePage = HomePage;
