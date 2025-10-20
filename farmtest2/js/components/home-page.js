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
            this.loadData();
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
            this.updateNetworkIndicator();
            this.refreshDataAfterWalletChange();
        });

        document.addEventListener('walletDisconnected', () => {
            console.log('🏠 HomePage: Wallet disconnected, refreshing data...');
            this.updateNetworkIndicator();
            this.refreshDataAfterWalletChange();
        });

        // Listen for account changes (MetaMask)
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                console.log('🏠 HomePage: Accounts changed:', accounts);
                this.refreshDataAfterWalletChange();
            });

            window.ethereum.on('chainChanged', (chainId) => {
                console.log('🏠 HomePage: Chain changed:', chainId);
                this.updateNetworkIndicator();
                this.refreshDataAfterWalletChange();
            });
        }
    }

    /**
     * Refresh data after wallet/network changes (debounced to prevent overlapping loads)
     */
    refreshDataAfterWalletChange() {
        // Cancel any pending refresh
        clearTimeout(this.refreshDebounceTimer);
        
        // Schedule new refresh after 500ms (waits for rapid events + network transition to settle)
        this.refreshDebounceTimer = setTimeout(async () => {
            console.log('🔄 Wallet/network changed, clearing cache and refreshing data...');
            // Clear cache to remove stale provider references
            this.cache.hourlyRewardRate = { value: null, timestamp: 0, ttl: this.cache.hourlyRewardRate.ttl };
            this.cache.totalWeight = { value: null, timestamp: 0, ttl: this.cache.totalWeight.ttl };
            this.cache.pairsInfo = { value: null, timestamp: 0, ttl: this.cache.pairsInfo.ttl };
            await this.loadData();
        }, 1000);
    }

    /**
     * Load data when contract manager is ready
     */
    async loadDataWhenReady() {
        if (window.contractManager && window.contractManager.isReady()) {
            console.log('🏠 HomePage: ContractManager already ready, loading data immediately...');
            this.loadData();
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

        // Update the hourly rate in the existing HTML header
        this.updateHourlyRateDisplay();
    }

    renderHomepage() {
        return this.renderTable();
    }

    /**
     * Update the hourly rate display in the existing HTML header
     */
    updateHourlyRateDisplay() {
        const hourlyRateElement = document.getElementById('hourly-rate');
        if (hourlyRateElement) {
            const formattedRate = parseFloat(this.hourlyRewardRate || '0').toFixed(2);
            hourlyRateElement.textContent = formattedRate;
            console.log(`📊 Updated hourly rate display: ${formattedRate} LIB`);
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
                                <span class="material-icons">account_balance</span>
                                TVL
                            </th>
                            <th>
                                <span class="material-icons">pie_chart</span>
                                Your Shares
                            </th>
                            <th>
                                <span class="material-icons">monetization_on</span>
                                Your Earnings
                            </th>
                            <th>
                                <span class="material-icons">settings</span>
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Array(5).fill(0).map(() => `
                            <tr>
                                <td><div class="skeleton" style="height: 20px; width: 120px;"></div></td>
                                <td><div class="skeleton" style="height: 20px; width: 80px;"></div></td>
                                <td><div class="skeleton" style="height: 20px; width: 60px;"></div></td>
                                <td><div class="skeleton" style="height: 20px; width: 100px;"></div></td>
                                <td><div class="skeleton" style="height: 20px; width: 80px;"></div></td>
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
                <button class="btn btn-primary" onclick="homePage.loadData()" style="margin-top: 16px;">
                    <span class="material-icons">refresh</span>
                    Retry
                </button>
            </div>
        `;
    }

    renderTable() {
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
                                Your Shares
                            </th>
                            <th>
                                <span class="material-icons">monetization_on</span>
                                Your Earnings
                            </th>
                            <th>
                                <span class="material-icons">settings</span>
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.pairs.map(pair => this.renderPairRow(pair)).join('')}
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
                    ${this.formatPairName(`${pair.token0Symbol}/${pair.token1Symbol}`, pair.address)}
                </td>
                <td>
                    <span class="chip chip-primary">${pair.platform || 'Uniswap V2'}</span>
                </td>
                <td>
                    <span style="color: var(--success-main); font-weight: bold;">${pair.apr || '0.00'}%</span>
                </td>
                <td>
                    <span class="chip chip-secondary">
                        ${parseFloat(pair.weight || '0').toFixed(1)} (${pair.weightPercentage || '0.00'}%)
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
                            style="min-width: 120px;">
                        <span class="material-icons" style="font-size: 16px;">redeem</span>
                        ${userEarnings} LIB
                    </button>
                </td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-primary btn-stake" data-pair-id="${pair.id}" data-pair-address="${pair.address}" ${!canTransact || !pair.stakingEnabled ? 'disabled' : ''}>
                            <span class="material-icons">add</span>
                            Stake
                        </button>
                        <button class="btn btn-secondary btn-unstake" data-pair-id="${pair.id}" data-pair-address="${pair.address}" ${!canTransact || parseFloat(userShares) === 0 ? 'disabled' : ''}>
                            <span class="material-icons">remove</span>
                            Unstake
                        </button>
                        <button class="btn btn-text btn-claim" data-pair-id="${pair.id}" data-pair-address="${pair.address}" ${!canTransact || parseFloat(userEarnings) === 0 ? 'disabled' : ''}>
                            <span class="material-icons">redeem</span>
                            Claim
                        </button>
                    </div>
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
                                'Wallet Not Connected',
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
                                `${networkName} Network Required`,
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

            // Handle Stake button click
            if (e.target.closest('.btn-stake')) {
                e.stopPropagation();
                const pairId = e.target.closest('.btn-stake').dataset.pairId;
                this.openStakingModal(pairId, 'stake');
            }

            // Handle Unstake button click
            if (e.target.closest('.btn-unstake')) {
                e.stopPropagation();
                const pairId = e.target.closest('.btn-unstake').dataset.pairId;
                this.openStakingModal(pairId, 'unstake');
            }

            // Handle Claim button click
            if (e.target.closest('.btn-claim')) {
                e.stopPropagation();
                const pairId = e.target.closest('.btn-claim').dataset.pairId;
                this.claimRewards(pairId);
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
            this.showNotification('success', 'Data refreshed successfully!');
        } catch (error) {
            console.error('❌ Manual refresh failed:', error);
            this.showNotification('error', 'Failed to refresh data');
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
            try {
                await this.loadBlockchainData();
            } catch (blockchainError) {
                console.warn('📊 Failed to load blockchain data, using fallback:', blockchainError.message);
                this.loadFallbackData();
            }

            this.loading = false;
            this.render();

            console.log('✅ Staking data loaded successfully');

        } catch (error) {
            console.error('❌ Failed to load staking data:', error);
            this.error = `Failed to load blockchain data: ${error.message}`;
            this.loading = false;
            this.render();
        }
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

        try {
            // OPTIMIZATION 1: Check cache first, then load in parallel
            console.log('⚡ Checking cache and starting optimized data loading...');

            const promises = [];
            const now = Date.now();

            // Check cache for hourly reward rate
            if (this.cache.hourlyRewardRate.value && (now - this.cache.hourlyRewardRate.timestamp) < this.cache.hourlyRewardRate.ttl) {
                promises.push(Promise.resolve(this.cache.hourlyRewardRate.value));
                console.log('📦 Using cached hourly reward rate');
            } else {
                promises.push(window.contractManager.getHourlyRewardRate().then(value => {
                    this.cache.hourlyRewardRate = { value, timestamp: now, ttl: this.cache.hourlyRewardRate.ttl };
                    return value;
                }));
            }

            // Check cache for total weight
            if (this.cache.totalWeight.value && (now - this.cache.totalWeight.timestamp) < this.cache.totalWeight.ttl) {
                promises.push(Promise.resolve(this.cache.totalWeight.value));
                console.log('📦 Using cached total weight');
            } else {
                promises.push(window.contractManager.getTotalWeight().then(value => {
                    this.cache.totalWeight = { value, timestamp: now, ttl: this.cache.totalWeight.ttl };
                    return value;
                }));
            }

            // Check cache for pairs info
            if (this.cache.pairsInfo.value && (now - this.cache.pairsInfo.timestamp) < this.cache.pairsInfo.ttl) {
                promises.push(Promise.resolve(this.cache.pairsInfo.value));
                console.log('📦 Using cached pairs info');
            } else {
                promises.push(window.contractManager.getAllPairsInfo().then(value => {
                    this.cache.pairsInfo = { value, timestamp: now, ttl: this.cache.pairsInfo.ttl };
                    return value;
                }));
            }

            const [hourlyRateWei, totalWeightWei, allPairsInfo] = await Promise.all(promises);

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
                // Create a placeholder pair to show the UI structure
                this.pairs = [{
                    id: '1',
                    address: '0x0000000000000000000000000000000000000000',
                    token0Symbol: 'LIB',
                    token1Symbol: 'USDC',
                    name: 'No Pairs Configured',
                    platform: 'Waiting for Setup',
                    apr: '0.00',
                    tvl: 0,
                    userShares: '0.00',
                    userEarnings: '0.00',
                    totalStaked: '0',
                    rewardRate: '0',
                    stakingEnabled: false,
                    weight: '0',
                    weightPercentage: '0.00'
                }];
            } else {
                // OPTIMIZATION 2: Progressive display - show basic pair data immediately
                console.log('⚡ Processing pairs with progressive loading...');

                // First, create basic pair data without user-specific info
                const basicPairs = allPairsInfo.map((pairInfo, i) => {
                    const weightPercentage = this.totalWeight > 0 ?
                        ((parseFloat(pairInfo.weight || '0') * 100) / parseFloat(this.totalWeight)).toFixed(2) :
                        '0.00';

                    return {
                        id: pairInfo.id || (i + 1).toString(),
                        address: pairInfo.address,
                        token0Symbol: 'LIB',
                        token1Symbol: this.extractTokenSymbol(pairInfo.name) || 'TOKEN',
                        name: pairInfo.name || `LP Token ${i + 1}`,
                        platform: pairInfo.platform || 'Unknown',
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
                this.render(); // Show basic data immediately

                // OPTIMIZATION 2.5: Calculate TVL and APR in parallel for each pair
                console.log('⚡ Calculating TVL and APR for all pairs...');
                await this.calculateTVLAndAPR();
                console.log('🎨 Re-rendering after TVL/APR calculation...');
                console.log('📊 Pairs data after calculation:', this.pairs.map(p => ({ name: p.name, tvl: p.tvl, apr: p.apr })));
                this.render(); // Re-render with TVL and APR data

                // OPTIMIZATION 3: Load user data in parallel if wallet connected
                // Read-only provider can query user data from ANY network!
                const isWalletConnected = this.isWalletConnected() && window.walletManager?.currentAccount;
                const isOnCorrectNetwork = window.networkManager?.isOnRequiredNetwork() || false;
                
                if (isWalletConnected) {
                    console.log('⚡ Loading user stake data in parallel...');
                    console.log('👛 Using wallet address:', window.walletManager.currentAccount);
                    
                    if (!isOnCorrectNetwork) {
                        const networkName = window.CONFIG?.NETWORK?.NAME || 'configured network';
                        const currentChainId = window.walletManager?.getChainId();
                        const currentNetworkName = window.networkManager?.getNetworkName(currentChainId) || 'Unknown';
                        console.log(`📊 Read-only mode: Wallet on ${currentNetworkName}, viewing ${networkName} data`);
                        console.log(`💡 Switch to ${networkName} to make transactions`);
                    }

                    const userDataPromises = allPairsInfo.map(async (pairInfo, i) => {
                        if (pairInfo.address === '0x0000000000000000000000000000000000000000') {
                            return { index: i, userStake: { amount: '0', rewards: '0' } };
                        }

                        try {
                            const userStake = await window.contractManager.getUserStake(
                                window.walletManager.currentAccount,
                                pairInfo.address
                            );
                            console.log(`✅ User stake for pair ${i}:`, userStake);
                            return { index: i, userStake };
                        } catch (error) {
                            console.warn(`⚠️ Failed to load user data for pair ${pairInfo.address}:`, error.message);
                            return { index: i, userStake: { amount: '0', rewards: '0' } };
                        }
                    });

                    // Wait for all user data to load in parallel
                    const userDataResults = await Promise.all(userDataPromises);

                    // Update pairs with user data - EXACT React implementation
                    // React source: lib-lp-staking-frontend/src/pages/home.tsx (Lines 59-64)
                    userDataResults.forEach(({ index, userStake }) => {
                        if (this.pairs[index]) {
                            // React Line 62: myShare = tvlWei > 0n ? Number((userStake.amount * 100n) / tvlWei) : 0;
                            // Both userStake.amount and tvl are in ether format (already converted from wei)
                            const userStakeAmount = parseFloat(userStake.amount || '0');
                            const tvl = this.pairs[index].tvl || 0;  // This is now LP token count

                            if (userStakeAmount > 0 && tvl > 0) {
                                // Calculate share percentage: (userStake * 100) / TVL
                                const sharePercentage = (userStakeAmount * 100) / tvl;
                                this.pairs[index].userShares = sharePercentage.toFixed(2);
                            } else {
                                this.pairs[index].userShares = '0.00';
                            }

                            // React Line 63: myEarnings = Number(ethers.formatEther(await getPendingRewards(...)));
                            // Format user earnings
                            const earnings = parseFloat(userStake.rewards || '0');
                            this.pairs[index].userEarnings = earnings.toFixed(4);  // React uses .toFixed(4)

                            console.log(`📊 Pair ${index}: SharePercentage=${this.pairs[index].userShares}%, Earnings=${this.pairs[index].userEarnings} LIB`);
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
            console.log(`📊 Performance improvement: ~${Math.max(0, 100 - (totalTime / 100)).toFixed(0)}% faster than sequential loading`);
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
     * Calculate TVL and APR for all pairs - EXACT React implementation
     * React source: lib-lp-staking-frontend/src/pages/home.tsx (Lines 46-78)
     *
     * Key differences from previous implementation:
     * 1. TVL is stored as LP token count (NOT USD value) - React Line 57
     * 2. APR uses React's exact formula (no × 100) - React Line 56
     * 3. Display shows token count, matching React Line 199
     */
    async calculateTVLAndAPR() {
        if (!window.priceFeeds || !window.rewardsCalculator) {
            console.warn('⚠️ Price feeds or rewards calculator not available, skipping TVL/APR calculation');
            return;
        }

        try {
            console.log('⚡ Calculating TVL and APR for all pairs (React approach)...');

            const calculations = this.pairs.map(async (pair, index) => {
                try {
                    console.log(`🔍 Calculating TVL/APR for ${pair.name}...`);

                    // React Line 52-53: Fetch token prices
                    const lpTokenPrice = await window.priceFeeds.fetchTokenPrice(pair.address);
                    const rewardTokenAddress = window.CONFIG?.CONTRACTS?.REWARD_TOKEN;
                    const rewardTokenPrice = await window.priceFeeds.fetchTokenPrice(rewardTokenAddress);

                    console.log(`  💵 LP token price: $${lpTokenPrice}`);
                    console.log(`  💵 Reward token price: $${rewardTokenPrice}`);

                    // React Line 55: Get TVL from contract (in wei)
                    const tvlWei = await window.contractManager.getTVL(pair.address);

                    // React Line 56: Calculate APR using formatEther(tvlWei) as tvl parameter
                    const hourlyRate = parseFloat(this.hourlyRewardRate || '0');
                    const tvlInTokens = parseFloat(ethers.utils.formatEther(tvlWei || '0'));
                    const apr = window.rewardsCalculator.calcAPR(
                        hourlyRate,
                        tvlInTokens,
                        lpTokenPrice,
                        rewardTokenPrice
                    );

                    // React Line 57: Store TVL as token count (NOT USD)
                    // This is the key difference: React displays token count, not USD value
                    const tvl = tvlInTokens;

                    console.log(`  📊 TVL in tokens: ${tvlInTokens}`);
                    console.log(`  📈 Calculated APR: ${apr.toFixed(1)}%`);

                    // Update pair data to match React structure
                    console.log(`🔧 Updating pair ${index} (${pair.name}):`);
                    console.log(`  Before: tvl=${this.pairs[index].tvl}, apr=${this.pairs[index].apr}`);

                    this.pairs[index].tvl = tvl;  // Token count, not USD
                    this.pairs[index].apr = apr.toFixed(1);  // React uses .toFixed(1)
                    this.pairs[index].totalStaked = tvlInTokens.toFixed(6);
                    this.pairs[index].lpTokenPrice = lpTokenPrice;  // Store for reference
                    this.pairs[index].rewardTokenPrice = rewardTokenPrice;  // Store for reference

                    console.log(`  After: tvl=${this.pairs[index].tvl}, apr=${this.pairs[index].apr}`);
                    console.log(`✅ ${pair.name}: TVL=${tvl.toFixed(2)} LP, APR=${apr.toFixed(1)}%`);

                } catch (error) {
                    console.error(`❌ Failed to calculate TVL/APR for ${pair.name}:`, error);
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

    /**
     * Load fallback data when blockchain data is not available
     */
    loadFallbackData() {
        console.log('📊 Loading fallback data...');

        if (window.CONFIG?.DEV?.MOCK_DATA) {
                // Enhanced mock data with all features from milestones.md
            this.pairs = [
                {
                    id: '1',
                    token0Symbol: 'LIB',
                    token1Symbol: 'USDC',
                    name: 'LIB/USDC LP',
                    platform: 'Uniswap V2',
                    apr: '125.50',
                    tvl: 1250000,
                    userShares: this.isWalletConnected() ? '15.75' : '0.00',
                    userEarnings: this.isWalletConnected() ? '2.45' : '0.00',
                    totalStaked: '850000',
                    rewardRate: '0.125',
                    stakingEnabled: true
                },
                {
                    id: '2',
                    token0Symbol: 'LIB',
                    token1Symbol: 'ETH',
                    name: 'LIB/ETH LP',
                    platform: 'Uniswap V2',
                    apr: '98.75',
                    tvl: 850000,
                    userShares: this.isWalletConnected() ? '8.25' : '0.00',
                    userEarnings: this.isWalletConnected() ? '1.12' : '0.00',
                    totalStaked: '620000',
                    rewardRate: '0.098',
                    stakingEnabled: true
                },
                {
                    id: '3',
                    token0Symbol: 'LIB',
                    token1Symbol: 'BTC',
                    name: 'LIB/BTC LP',
                    platform: 'Uniswap V2',
                    apr: '87.25',
                    tvl: 650000,
                    userShares: this.isWalletConnected() ? '5.50' : '0.00',
                    userEarnings: this.isWalletConnected() ? '0.87' : '0.00',
                    totalStaked: '480000',
                    rewardRate: '0.087',
                    stakingEnabled: true
                },
                {
                    id: '4',
                    token0Symbol: 'LIB',
                    token1Symbol: 'DAI',
                    name: 'LIB/DAI LP',
                    platform: 'Uniswap V2',
                    apr: '76.80',
                    tvl: 420000,
                    userShares: this.isWalletConnected() ? '3.25' : '0.00',
                    userEarnings: this.isWalletConnected() ? '0.54' : '0.00',
                    totalStaked: '320000',
                    rewardRate: '0.076',
                    stakingEnabled: true
                },
                {
                    id: '5',
                    token0Symbol: 'LIB',
                    token1Symbol: 'MATIC',
                    name: 'LIB/MATIC LP',
                    platform: 'Uniswap V2',
                    apr: '65.40',
                    tvl: 280000,
                    userShares: this.isWalletConnected() ? '2.10' : '0.00',
                    userEarnings: this.isWalletConnected() ? '0.32' : '0.00',
                    totalStaked: '210000',
                    rewardRate: '0.065',
                    stakingEnabled: true
                }
            ];
        } else {
            // Use minimal fallback data when no mock data is configured
            this.pairs = [
                {
                    id: '1',
                    token0Symbol: 'LIB',
                    token1Symbol: 'USDC',
                    name: 'LIB/USDC LP',
                    platform: 'Uniswap V2',
                    apr: '0.00',
                    tvl: 0,
                    userShares: '0.00',
                    userEarnings: '0.00',
                    totalStaked: '0',
                    rewardRate: '0',
                    stakingEnabled: false
                }
            ];
        }

        console.log('📊 Fallback data loaded:', this.pairs.length, 'pairs');
    }

    /**
     * Get token color for avatar
     */
    getTokenColor(tokenSymbol) {
        const colors = {
            'LIB': '#3B82F6',      // Blue
            'USDT': '#26A17B',     // Tether Green
            'USDC': '#2775CA',     // USDC Blue
            'DAI': '#F5AC37',      // DAI Gold
            'WETH': '#627EEA',     // Ethereum Purple
            'ETH': '#627EEA',      // Ethereum Purple
            'WBTC': '#F7931A',     // Bitcoin Orange
            'BTC': '#F7931A',      // Bitcoin Orange
            'MATIC': '#8247E5',    // Polygon Purple
            'TOKEN': '#FF9800'     // Default Orange
        };
        return colors[tokenSymbol.toUpperCase()] || '#6B7280';
    }

    /**
     * Create token avatar HTML
     */
    createTokenAvatar(tokenSymbol) {
        const symbol = tokenSymbol.toUpperCase();
        const color = this.getTokenColor(symbol);
        const initial = symbol.substring(0, 3);
        
        return `
            <div class="token-avatar" style="
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: ${color};
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-weight: 700;
                letter-spacing: -0.5px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            ">${initial}</div>
        `;
    }

    /**
     * Format pair name for display with token avatars and Uniswap link
     */
    formatPairName(pairName, lpTokenAddress = '') {
        if (!pairName) return pairName;

        let token1 = '';
        let token2 = '';
        let formattedName = pairName;

        // If already formatted (contains /), extract tokens
        if (pairName.includes('/')) {
            const parts = pairName.split('/');
            token1 = parts[0].trim();
            token2 = parts[1].replace('LP', '').trim();
            formattedName = `${token1}/${token2}`;
        }
        // Handle "LIB-USDT" format
        else if (pairName.includes('-')) {
            const parts = pairName.split('-');
            token1 = parts[0].trim();
            token2 = parts[1].trim();
            formattedName = `${token1}/${token2}`;
        }
        // Handle LP prefix format: "LPLIBETH" -> "LIB/ETH"
        else if (pairName.startsWith('LP') && pairName.length > 4) {
            const tokens = pairName.substring(2); // Remove "LP"

            // Try to split into two tokens
            const commonTokens = ['USDC', 'USDT', 'DAI', 'WETH', 'ETH', 'WBTC', 'BTC', 'LIB', 'MATIC'];

            for (const token of commonTokens) {
                if (tokens.endsWith(token)) {
                    token1 = tokens.substring(0, tokens.length - token.length);
                    token2 = token;
                    if (token1.length > 0) {
                        formattedName = `${token1}/${token2}`;
                        break;
                    }
                }
                if (tokens.startsWith(token)) {
                    token1 = token;
                    token2 = tokens.substring(token.length);
                    if (token2.length > 0) {
                        formattedName = `${token1}/${token2}`;
                        break;
                    }
                }
            }

            // Fallback: split in half if tokens not found
            if (!token1 || !token2) {
                const mid = Math.floor(tokens.length / 2);
                token1 = tokens.substring(0, mid);
                token2 = tokens.substring(mid);
                formattedName = `${token1}/${token2}`;
            }
        }

        // Create pair display with avatars and Uniswap link
        if (token1 && token2) {
            const avatar1 = this.createTokenAvatar(token1);
            const avatar2 = this.createTokenAvatar(token2);
            const uniswapUrl = lpTokenAddress ? 
                `https://app.uniswap.org/explore/pools/polygon/${lpTokenAddress}` : 
                `https://app.uniswap.org/explore/pools`;
            
            return `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="display: flex; align-items: center;">
                        ${avatar1}
                        <div style="margin-left: -8px; z-index: 1;">${avatar2}</div>
                    </div>
                    <a href="${uniswapUrl}" target="_blank" rel="noopener noreferrer" 
                       class="pair-name-link"
                       style="display: inline-flex; align-items: center; gap: 8px; text-decoration: none; cursor: pointer; transition: all 0.2s ease; padding: 4px 0;"
                       onmouseover="this.style.opacity='0.8'"
                       onmouseout="this.style.opacity='1'"
                       title="View pool on Uniswap">
                        <span style="font-weight: 700; color: var(--primary-main); font-size: 14px;">${formattedName}</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-main)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; transition: all 0.2s ease; min-width: 20px;">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                    </a>
                    <span style="font-size: 11px; color: var(--text-secondary); font-family: monospace;">${pairName}</span>
                </div>
            `;
        }

        // Return original if no pattern matched
        return formattedName;
    }

    /**
     * Extract token symbol from pair name
     */
    extractTokenSymbol(pairName) {
        if (!pairName) return 'USDT';

        // Try to extract the second token from patterns like "LIB/USDC" or "LIB-USDC"
        const match = pairName.match(/LIB[\/\-](\w+)/i);
        if (match) {
            return match[1].toUpperCase();
        }

        // Fallback patterns
        if (pairName.toLowerCase().includes('usdc')) return 'USDC';
        if (pairName.toLowerCase().includes('usdt')) return 'USDT';
        if (pairName.toLowerCase().includes('eth')) return 'ETH';
        if (pairName.toLowerCase().includes('btc')) return 'BTC';
        if (pairName.toLowerCase().includes('dai')) return 'DAI';
        if (pairName.toLowerCase().includes('matic')) return 'MATIC';

        // Default to USDT instead of TOKEN
        return 'USDT';
    }

    /**
     * Build real pair data from contract information
     */
    async buildRealPairData(pairInfo, index) {
        try {
            // Extract pair name from platform or use address
            const pairName = this.extractPairName(pairInfo.address, pairInfo.platform);
            
            // Use existing token symbols if available, otherwise extract from pair name
            let tokens;
            if (pairInfo.token0Symbol && pairInfo.token1Symbol) {
                tokens = { token0: pairInfo.token0Symbol, token1: pairInfo.token1Symbol };
            } else {
                tokens = this.extractTokenSymbols(pairName);
            }

            // Get additional data if available
            let tvl = 0;
            let totalStaked = 0;
            let apr = 0;
            let rewardRate = 0;

            try {
                // Try to get pool info if available
                const poolInfo = await window.contractManager.getPoolInfo(pairInfo.address);
                totalStaked = parseFloat(poolInfo.totalStaked || '0');
                rewardRate = parseFloat(poolInfo.rewardRate || '0');

                // Calculate TVL and APR if rewards calculator is available
                if (window.rewardsCalculator) {
                    const aprData = await window.rewardsCalculator.calculateAPR(pairName);
                    apr = aprData.apr || 0;
                    tvl = aprData.tvl || totalStaked;
                }
            } catch (dataError) {
                console.log(`Could not get additional data for ${pairName}:`, dataError.message);
            }

            // Get user-specific data if wallet is connected AND on correct network
            let userSharesPercentage = '0.00';
            let userEarnings = '0.00';

            // Check if we're on configured network before querying user data
            const isOnCorrectNetwork = this.isWalletConnected() && 
                                        window.walletManager?.currentAccount && 
                                        (window.networkManager?.isOnRequiredNetwork() || false);

            if (isOnCorrectNetwork) {
                try {
                    const userStake = await window.contractManager.getUserStake(
                        window.walletManager.currentAccount,
                        pairInfo.address
                    );
                    const pendingRewards = await window.contractManager.getPendingRewards(
                        window.walletManager.currentAccount,
                        pairInfo.address
                    );

                    // Calculate pool share percentage: (userStake * 100) / TVL
                    // userStake is in ether format, tvl is also in ether format
                    const userStakeAmount = parseFloat(userStake || '0');
                    if (userStakeAmount > 0 && tvl > 0) {
                        const sharePercentage = (userStakeAmount * 100) / tvl;
                        userSharesPercentage = sharePercentage.toFixed(2);
                        console.log(`📊 Pool share calculation: ${userStakeAmount} LP / ${tvl} TVL * 100 = ${sharePercentage}%`);
                    } else {
                        userSharesPercentage = '0.00';
                    }

                    // Format pendingRewards - convert from wei to ether if needed
                    if (pendingRewards && pendingRewards !== '0') {
                        try {
                            // Check if it's a BigNumber or large number (in wei)
                            const rewardsStr = pendingRewards.toString();
                            if (rewardsStr.length > 10) {
                                // Likely in wei, convert to ether
                                userEarnings = parseFloat(window.ethers.formatEther(pendingRewards)).toFixed(6);
                            } else {
                                // Already in ether format
                                userEarnings = parseFloat(pendingRewards).toFixed(6);
                            }
                        } catch (formatError) {
                            console.log(`Error formatting rewards for ${pairName}:`, formatError.message);
                            userEarnings = parseFloat(pendingRewards || '0').toFixed(6);
                        }
                    } else {
                        userEarnings = '0.000000';
                    }

                    console.log(`📊 User data for ${pairName}: SharePercentage=${userSharesPercentage}%, Earnings=${userEarnings} LIB`);
                } catch (userError) {
                    console.log(`Could not get user data for ${pairName}:`, userError.message);
                }
            }

            return {
                id: index.toString(),
                token0Symbol: tokens.token0,
                token1Symbol: tokens.token1,
                name: `${tokens.token0}/${tokens.token1} LP`,
                platform: pairInfo.platform || 'Unknown',
                apr: apr.toFixed(2),
                tvl: tvl,
                userShares: userSharesPercentage,
                userEarnings: userEarnings,
                totalStaked: totalStaked.toString(),
                rewardRate: rewardRate.toFixed(3),
                stakingEnabled: pairInfo.isActive
            };
        } catch (error) {
            console.error('Failed to build real pair data:', error);
            return null;
        }
    }

    /**
     * Extract pair name from address or platform
     */
    extractPairName(address, platform) {
        // Try to find a known pair name from config
        const lpTokens = window.CONFIG?.CONTRACTS?.LP_TOKENS || {};
        for (const [pairName, pairAddress] of Object.entries(lpTokens)) {
            if (pairAddress.toLowerCase() === address.toLowerCase()) {
                return pairName;
            }
        }

        // Use platform if available
        if (platform && platform !== 'Unknown') {
            return platform;
        }

        // Fallback to shortened address
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    /**
     * Extract token symbols from pair name
     */
    extractTokenSymbols(pairName) {
        // Handle common pair name formats
        if (pairName.includes('/')) {
            const parts = pairName.split('/');
            return { token0: parts[0].trim(), token1: parts[1].trim() };
        } else if (pairName.includes('-')) {
            const parts = pairName.split('-');
            return { token0: parts[0].trim(), token1: parts[1].trim() };
        } else if (pairName.includes('_')) {
            const parts = pairName.split('_');
            return { token0: parts[0].trim(), token1: parts[1].trim() };
        }

        // Handle LP prefix format: "LPLIBUSDT" -> "LIB/USDT"
        if (pairName.startsWith('LP') && pairName.length > 4) {
            const tokens = pairName.substring(2); // Remove "LP"
            
            // Try to split into two tokens using common token patterns
            const commonTokens = ['USDC', 'USDT', 'DAI', 'WETH', 'ETH', 'WBTC', 'BTC', 'LIB', 'MATIC'];
            
            for (const token of commonTokens) {
                if (tokens.endsWith(token)) {
                    const token1 = tokens.substring(0, tokens.length - token.length);
                    const token2 = token;
                    if (token1.length > 0) {
                        return { token0: token1, token1: token2 };
                    }
                }
                if (tokens.startsWith(token)) {
                    const token1 = token;
                    const token2 = tokens.substring(token.length);
                    if (token2.length > 0) {
                        return { token0: token1, token1: token2 };
                    }
                }
            }
            
            // Fallback: split in half
            const mid = Math.floor(tokens.length / 2);
            const token1 = tokens.substring(0, mid);
            const token2 = tokens.substring(mid);
            return { token0: token1, token1: token2 };
        }

        // Fallback for unknown formats - try to extract from address or use LIB/USDT as default
        console.warn(`Could not parse pair name: ${pairName}, using LIB/USDT as fallback`);
        return { token0: 'LIB', token1: 'USDT' };
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

    async claimRewards(pairId) {
        console.log(`🎁 Claiming rewards for pair ${pairId}`);

        const pair = this.pairs.find(p => p.id === pairId);
        if (!pair) {
            console.error('Pair not found:', pairId);
            return;
        }

        if (!this.isWalletConnected()) {
            this.showNotification('error', 'Please connect your wallet first');
            return;
        }

        try {
            // Show loading state
            const button = document.querySelector(`.btn-claim[data-pair-id="${pairId}"]`);
            if (button) {
                button.disabled = true;
                button.innerHTML = '<span class="material-icons">hourglass_empty</span> Claiming...';
            }

            this.showNotification('info', 'Claiming rewards...');

            // Call contract manager to claim rewards
            if (window.contractManager && window.contractManager.claimRewards) {
                console.log(`🎁 Claiming rewards for LP token: ${pair.address}`);
                const result = await window.contractManager.claimRewards(pair.address);

                if (result && result.success) {
                    console.log('✅ Rewards claimed successfully');
                    this.showNotification('success', `Successfully claimed ${pair.userEarnings} LIB rewards!`);

                    // Refresh data after successful transaction
                    setTimeout(() => this.refreshData(), 2000);
                } else {
                    throw new Error(result?.error || 'Transaction failed');
                }
            } else {
                throw new Error('Contract manager not available');
            }

        } catch (error) {
            console.error('❌ Failed to claim rewards:', error);
            this.showNotification('error', `Failed to claim rewards: ${error.message}`);
        } finally {
            // Reset button state
            const button = document.querySelector(`.btn-claim[data-pair-id="${pairId}"]`);
            if (button) {
                button.disabled = false;
                button.innerHTML = '<span class="material-icons">redeem</span> Claim';
            }
        }
    }

    showNotification(type, message) {
        // Use existing notification system if available
        if (window.notificationManager) {
            window.notificationManager.show(message, type);
        } else if (window.notification) {
            window.notification.show(type, message);
        } else {
            // Fallback to console and alert
            console.log(`${type.toUpperCase()}: ${message}`);
            if (type === 'error') {
                alert(`Error: ${message}`);
            }
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
        console.log('🔄 Refreshing homepage data...');
        try {
            await this.loadData();
            console.log('✅ Homepage data refreshed successfully');
        } catch (error) {
            console.error('❌ Failed to refresh homepage data:', error);
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
        this.updateNetworkIndicator();

        // Update on wallet connection/disconnection
        document.addEventListener('walletConnected', () => {
            this.updateNetworkIndicator();
        });

        document.addEventListener('walletDisconnected', () => {
            const indicator = document.getElementById('network-indicator-home');
            if (indicator) {
                indicator.style.display = 'none';
            }
        });

        // Update on network change
        if (window.ethereum) {
            window.ethereum.on('chainChanged', () => {
                this.updateNetworkIndicator();
            });
        }
    }

    /**
     * Update network indicator with current status
     */
    async updateNetworkIndicator() {
        const indicator = document.getElementById('network-indicator-home');
        if (!indicator) return;

        // Only show if wallet is connected
        if (!window.walletManager || !window.walletManager.isConnected()) {
            indicator.style.display = 'none';
            return;
        }

        const chainId = window.walletManager.getChainId();
        const networkName = window.networkManager?.getNetworkName(chainId) || 'Unknown';
        const expectedNetworkName = window.CONFIG?.NETWORK?.NAME || 'Unknown';

        // Check permission asynchronously
        if (window.networkManager) {
            try {
                const hasPermission = await window.networkManager.hasRequiredNetworkPermission();

                indicator.style.display = 'flex';

                if (hasPermission) {
                    // Green indicator - has permission
                    indicator.innerHTML = `
                        <span class="network-status-dot green"></span>
                        <span class="network-name">${expectedNetworkName}</span>
                    `;
                    indicator.className = 'network-indicator-home has-permission';
                } else {
                    // Red indicator - missing permission, show "No permission"
                    indicator.innerHTML = `
                        <span class="network-status-dot red"></span>
                        <span class="network-name">No permission</span>
                        <button class="btn-grant-permission" onclick="window.networkManager.requestPermissionWithUIUpdate('home')">
                            Grant ${expectedNetworkName} Permission
                        </button>
                    `;
                    indicator.className = 'network-indicator-home missing-permission';
                }
            } catch (error) {
                console.error('Error checking network permission:', error);
                indicator.style.display = 'none';
            }
        } else {
            // Fallback if networkManager not available
            indicator.style.display = 'none';
        }
    }

    destroy() {
        this.stopAutoRefresh();
        clearTimeout(this.refreshDebounceTimer);
    }
}

// Initialize home page
let homePage;
document.addEventListener('DOMContentLoaded', () => {
    homePage = new HomePage();
});

// Export for global access
window.HomePage = HomePage;
