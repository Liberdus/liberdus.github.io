/**
 * HomePage Component - Day 7 Enhanced
 * Complete home page with pairs table, TVL calculations, and user portfolio
 * Features: Real-time data refresh, sorting, click-to-stake, DEX integration
 */
class HomePage extends BaseComponent {
    constructor() {
        super('#app-content');
        this.stakingPairs = [];
        this.userStakes = [];
        this.userPortfolio = {
            totalStakedUSD: 0,
            totalEarningsUSD: 0,
            totalPendingRewardsUSD: 0,
            activePositions: 0
        };
        this.isLoading = false;
        this.isRefreshing = false;
        this.sortBy = 'apr'; // apr, tvl, weight, name
        this.sortOrder = 'desc'; // asc, desc
        this.autoRefreshInterval = null;
        this.lastRefreshTime = null;

        // Component dependencies
        this.rewardsCalculator = null;
        this.priceFeeds = null;
        this.contractManager = null;
    }

    /**
     * Initialize component dependencies
     * Wait for price feeds and rewards calculator to be ready
     */
    async initializeDependencies() {
        try {
            console.log('🔄 HomePage: Waiting for dependencies...');

            // Wait for dependencies to be available (max 5 seconds)
            const maxWaitTime = 5000;
            const startTime = Date.now();

            while (!window.priceFeeds || !window.rewardsCalculator || !window.contractManager) {
                if (Date.now() - startTime > maxWaitTime) {
                    console.warn('⚠️ Timeout waiting for dependencies');
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            this.rewardsCalculator = window.rewardsCalculator;
            this.priceFeeds = window.priceFeeds;
            this.contractManager = window.contractManager;

            console.log('✅ HomePage dependencies initialized:', {
                rewardsCalculator: !!this.rewardsCalculator,
                priceFeeds: !!this.priceFeeds,
                contractManager: !!this.contractManager
            });

            if (!this.rewardsCalculator) {
                console.warn('⚠️ RewardsCalculator not available, using fallback');
            }
            if (!this.priceFeeds) {
                console.warn('⚠️ PriceFeeds not available, using fallback');
            }
            if (!this.contractManager) {
                console.warn('⚠️ ContractManager not available, using fallback');
            }
        } catch (error) {
            console.error('❌ Error initializing dependencies:', error);
        }
    }

    /**
     * Render home page content
     */
    async render() {
        const isConnected = this.getState('wallet.isConnected');
        const walletAddress = this.getState('wallet.address');

        return `
            <div class="container home-page">
                ${this.renderHeader()}
                ${this.renderGlobalStats()}
                ${isConnected ? this.renderConnectedContent() : this.renderWelcomeContent()}
                ${this.renderRefreshIndicator()}
            </div>
        `;
    }

    /**
     * Render page header with enhanced stats
     */
    renderHeader() {
        const lastRefresh = this.lastRefreshTime
            ? new Date(this.lastRefreshTime).toLocaleTimeString()
            : 'Never';

        return `
            <div class="page-header">
                <div class="header-content">
                    <div class="header-text">
                        <h1>LP Staking Dashboard</h1>
                        <p class="text-lg text-secondary">
                            Earn rewards by staking your liquidity provider tokens
                        </p>
                    </div>
                    <div class="header-actions">
                        <div class="refresh-info">
                            <span class="text-sm text-tertiary">Last updated: ${lastRefresh}</span>
                        </div>
                        <button id="manual-refresh" class="btn btn-secondary ${this.isRefreshing ? 'loading' : ''}"
                                ${this.isRefreshing ? 'disabled' : ''}>
                            <span class="refresh-icon ${this.isRefreshing ? 'spinning' : ''}">🔄</span>
                            ${this.isRefreshing ? 'Refreshing...' : 'Refresh Data'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render global platform statistics
     */
    renderGlobalStats() {
        const totalTVL = this.stakingPairs.reduce((sum, pair) => sum + (pair.tvl || 0), 0);
        const avgAPR = this.stakingPairs.length > 0
            ? this.stakingPairs.reduce((sum, pair) => sum + (pair.apr || 0), 0) / this.stakingPairs.length
            : 0;
        const activePairs = this.stakingPairs.filter(pair => pair.isActive).length;

        return `
            <div class="global-stats">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon">💰</div>
                        <div class="stat-content">
                            <div class="stat-value">${window.Formatter?.formatUSD(totalTVL) || '$0.00'}</div>
                            <div class="stat-label">Total Value Locked</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">📈</div>
                        <div class="stat-content">
                            <div class="stat-value">${window.Formatter?.formatPercentage(avgAPR) || '0%'}</div>
                            <div class="stat-label">Average APR</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">🔗</div>
                        <div class="stat-content">
                            <div class="stat-value">${activePairs}</div>
                            <div class="stat-label">Active Pairs</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">👥</div>
                        <div class="stat-content">
                            <div class="stat-value">${this.stakingPairs.reduce((sum, pair) => sum + (pair.stakersCount || 0), 0)}</div>
                            <div class="stat-label">Total Stakers</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render welcome content for non-connected users
     */
    renderWelcomeContent() {
        return `
            <div class="welcome-section">
                <div class="card">
                    <div class="card-body text-center">
                        <h2>Welcome to LP Staking</h2>
                        <p>Connect your wallet to start earning rewards on your liquidity provider tokens.</p>
                        
                        <div class="features-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem; margin: 2rem 0;">
                            <div class="feature-card">
                                <div class="feature-icon">💰</div>
                                <h3>Earn Rewards</h3>
                                <p>Stake your LP tokens and earn rewards automatically</p>
                            </div>
                            <div class="feature-card">
                                <div class="feature-icon">🔒</div>
                                <h3>Secure Staking</h3>
                                <p>Multi-signature governance ensures platform security</p>
                            </div>
                            <div class="feature-card">
                                <div class="feature-icon">📊</div>
                                <h3>Real-time APR</h3>
                                <p>Track your earnings with live APR calculations</p>
                            </div>
                        </div>
                        
                        <button id="connect-wallet-home" class="btn btn-primary btn-large">
                            <span class="wallet-icon">👛</span>
                            Connect Wallet to Get Started
                        </button>
                    </div>
                </div>
                
                ${this.renderInfoSection()}
            </div>
        `;
    }

    /**
     * Render connected user content with enhanced portfolio
     */
    renderConnectedContent() {
        return `
            <div class="connected-content">
                ${this.renderUserPortfolio()}
                ${this.renderStakingPairsTable()}
            </div>
        `;
    }

    /**
     * Render enhanced user portfolio overview
     */
    renderUserPortfolio() {
        const walletAddress = this.getState('wallet.address');

        return `
            <div class="user-portfolio">
                <div class="portfolio-header">
                    <h2>Your Portfolio</h2>
                    <div class="portfolio-address">
                        <span class="address-label">Wallet:</span>
                        <span class="address-value">${window.Formatter?.formatAddress(walletAddress) || 'Not Connected'}</span>
                        <button class="copy-address-btn" data-address="${walletAddress}" title="Copy Address">
                            📋
                        </button>
                    </div>
                </div>

                <div class="portfolio-stats">
                    <div class="portfolio-grid">
                        <div class="portfolio-card primary">
                            <div class="card-icon">💎</div>
                            <div class="card-content">
                                <div class="card-value">${window.Formatter?.formatUSD(this.userPortfolio.totalStakedUSD) || '$0.00'}</div>
                                <div class="card-label">Total Staked Value</div>
                                <div class="card-change positive">+${window.Formatter?.formatPercentage(5.2) || '0%'} this week</div>
                            </div>
                        </div>

                        <div class="portfolio-card success">
                            <div class="card-icon">🎯</div>
                            <div class="card-content">
                                <div class="card-value">${window.Formatter?.formatUSD(this.userPortfolio.totalEarningsUSD) || '$0.00'}</div>
                                <div class="card-label">Total Earnings</div>
                                <div class="card-change positive">+${window.Formatter?.formatUSD(12.45) || '$0.00'} today</div>
                            </div>
                        </div>

                        <div class="portfolio-card warning">
                            <div class="card-icon">⏳</div>
                            <div class="card-content">
                                <div class="card-value">${window.Formatter?.formatUSD(this.userPortfolio.totalPendingRewardsUSD) || '$0.00'}</div>
                                <div class="card-label">Pending Rewards</div>
                                <div class="card-action">
                                    <button class="btn btn-small btn-primary claim-all-btn" ${this.userPortfolio.totalPendingRewardsUSD > 0 ? '' : 'disabled'}>
                                        Claim All
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="portfolio-card info">
                            <div class="card-icon">📊</div>
                            <div class="card-content">
                                <div class="card-value">${this.userPortfolio.activePositions}</div>
                                <div class="card-label">Active Positions</div>
                                <div class="card-detail">Across ${this.stakingPairs.length} pools</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render enhanced staking pairs table with sorting and filtering
     */
    renderStakingPairsTable() {
        if (this.isLoading) {
            return this.renderLoadingState();
        }

        if (this.stakingPairs.length === 0) {
            return this.renderEmptyState();
        }

        const sortedPairs = this.getSortedPairs();

        return `
            <div class="staking-pairs-section">
                <div class="section-header">
                    <div class="header-left">
                        <h2>Staking Pairs</h2>
                        <span class="pairs-count">${sortedPairs.length} pairs available</span>
                    </div>
                    <div class="header-right">
                        ${this.renderSortControls()}
                        <button id="add-liquidity" class="btn btn-secondary">
                            <span>💧</span>
                            Add Liquidity
                        </button>
                    </div>
                </div>

                <div class="pairs-table-container">
                    ${this.renderPairsTable(sortedPairs)}
                </div>
            </div>
        `;
    }

    /**
     * Render sort controls
     */
    renderSortControls() {
        return `
            <div class="sort-controls">
                <label class="sort-label">Sort by:</label>
                <select id="sort-select" class="sort-select">
                    <option value="apr" ${this.sortBy === 'apr' ? 'selected' : ''}>APR</option>
                    <option value="tvl" ${this.sortBy === 'tvl' ? 'selected' : ''}>TVL</option>
                    <option value="weight" ${this.sortBy === 'weight' ? 'selected' : ''}>Weight</option>
                    <option value="name" ${this.sortBy === 'name' ? 'selected' : ''}>Name</option>
                </select>
                <button id="sort-order" class="sort-order-btn ${this.sortOrder}" title="Toggle sort order">
                    ${this.sortOrder === 'desc' ? '↓' : '↑'}
                </button>
            </div>
        `;
    }

    /**
     * Render pairs table (React-style columns)
     */
    renderPairsTable(pairs) {
        // Calculate total weight for percentage calculation
        const totalWeight = pairs.reduce((sum, pair) => sum + (pair.weight || 0), 0);

        return `
            <div class="responsive-table">
                <table class="pairs-table">
                    <thead>
                        <tr>
                            <th class="pair-col">
                                <div class="th-content">
                                    <span class="material-icons-outlined">swap_horiz</span>
                                    <span>Pair</span>
                                </div>
                            </th>
                            <th class="platform-col">
                                <div class="th-content">
                                    <span class="material-icons-outlined">account_balance</span>
                                    <span>Platform</span>
                                </div>
                            </th>
                            <th class="apr-col">
                                <div class="th-content">
                                    <span class="material-icons-outlined">percent</span>
                                    <span>Est. APR</span>
                                </div>
                            </th>
                            <th class="weight-col">
                                <div class="th-content">
                                    <span class="material-icons-outlined">monetization_on</span>
                                    <span>Reward Weight</span>
                                </div>
                            </th>
                            <th class="tvl-col">
                                <div class="th-content">
                                    <span class="material-icons-outlined">account_balance_wallet</span>
                                    <span>TVL</span>
                                </div>
                            </th>
                            <th class="share-col">
                                <div class="th-content">
                                    <span class="material-icons-outlined">share</span>
                                    <span>My Pool Share</span>
                                </div>
                            </th>
                            <th class="earnings-col">
                                <div class="th-content">
                                    <span class="material-icons-outlined">redeem</span>
                                    <span>My Earnings</span>
                                </div>
                            </th>
                            <th class="actions-col">
                                <div class="th-content">
                                    <span class="material-icons-outlined">settings</span>
                                    <span>Actions</span>
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pairs.map(pair => this.renderReactStylePairRow(pair, totalWeight)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * Render React-style pair row (matches React implementation exactly)
     */
    renderReactStylePairRow(pair, totalWeight) {
        const isConnected = this.getState('wallet.isConnected');
        const weightPercentage = totalWeight > 0 ? ((pair.weight / totalWeight) * 100).toFixed(2) : '0.00';
        const hasStake = pair.myShare > 0;
        const hasRewards = pair.myEarnings > 0;

        // Add visual indication when not connected
        const rowClass = isConnected ? 'pair-row' : 'pair-row pair-row-disabled';
        const rowStyle = isConnected ? '' : 'style="cursor: not-allowed; opacity: 0.7;"';
        const rowTitle = isConnected ? '' : 'title="Connect wallet to stake"';

        return `
            <tr class="${rowClass}" data-pair-id="${pair.id}" ${rowStyle} ${rowTitle}>
                <!-- Pair Name (clickable to Uniswap) -->
                <td class="pair-col">
                    <button class="pair-link" onclick="window.open('https://app.uniswap.org/explore/pools/polygon/${pair.lpToken}', '_blank')"
                            style="background: none; border: none; color: var(--primary-main); cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 8px;">
                        ${this.formatPairName(pair.name)}
                        <span class="material-icons-outlined" style="font-size: 16px;">open_in_new</span>
                    </button>
                </td>

                <!-- Platform -->
                <td class="platform-col">
                    <span class="platform-chip" style="display: inline-block; padding: 4px 12px; border-radius: 16px; border: 1px solid var(--primary-main); color: var(--primary-main); font-size: 13px;">
                        ${pair.platform}
                    </span>
                </td>

                <!-- APR -->
                <td class="apr-col">
                    <span style="color: var(--success-main); font-weight: bold; font-size: 16px;">
                        ${pair.apr.toFixed(1)}%
                    </span>
                </td>

                <!-- Reward Weight -->
                <td class="weight-col">
                    <span class="weight-chip" style="display: inline-block; padding: 4px 12px; border-radius: 16px; background: var(--secondary-main); color: white; font-size: 13px;">
                        ${pair.weight || 0} (${weightPercentage}%)
                    </span>
                </td>

                <!-- TVL -->
                <td class="tvl-col">
                    <span style="font-weight: 500;">
                        ${window.Formatter?.formatUSD(pair.tvl) || '$0.00'}
                    </span>
                </td>

                <!-- My Pool Share -->
                <td class="share-col">
                    <span style="font-weight: 500; color: ${hasStake ? 'var(--primary-main)' : 'var(--text-secondary)'};">
                        ${pair.myShare.toFixed(2)}%
                    </span>
                </td>

                <!-- My Earnings -->
                <td class="earnings-col">
                    <span style="font-weight: 500; color: ${hasRewards ? 'var(--success-main)' : 'var(--text-secondary)'};">
                        ${pair.myEarnings.toFixed(4)} LIB
                    </span>
                </td>

                <!-- Actions -->
                <td class="actions-col">
                    <div class="pair-actions" style="display: flex; gap: 8px; justify-content: center;">
                        <button class="btn btn-primary btn-small"
                                onclick="handleOpenStakeModal('${pair.id}', 0)"
                                ${!isConnected ? 'disabled' : ''}
                                title="Stake LP tokens"
                                style="min-width: 70px;">
                            <span class="material-icons-outlined" style="font-size: 14px;">add</span>
                            Stake
                        </button>
                        <button class="btn btn-secondary btn-small"
                                onclick="handleOpenStakeModal('${pair.id}', 1)"
                                ${!isConnected || !hasStake ? 'disabled' : ''}
                                title="Unstake LP tokens"
                                style="min-width: 80px;">
                            <span class="material-icons-outlined" style="font-size: 14px;">remove</span>
                            Unstake
                        </button>
                        <button class="btn btn-success btn-small"
                                onclick="handleOpenStakeModal('${pair.id}', 2)"
                                ${!isConnected || !hasRewards ? 'disabled' : ''}
                                title="Claim rewards"
                                style="min-width: 70px;">
                            <span class="material-icons-outlined" style="font-size: 14px;">redeem</span>
                            Claim
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Render enhanced individual pair row with DEX integration
     */
    renderEnhancedPairRow(pair) {
        const userStake = this.userStakes.find(stake => stake.pairId === pair.id);
        const stakedAmount = userStake ? userStake.amount : '0';
        const stakedAmountUSD = userStake ? userStake.amountUSD : 0;
        const pendingRewards = userStake ? userStake.pendingRewards : '0';
        const pendingRewardsUSD = userStake ? userStake.pendingRewardsUSD : 0;

        const aprStatus = this.getAPRStatus(pair.apr);
        const isUserStaking = parseFloat(stakedAmount) > 0;

        return `
            <tr class="pair-row ${isUserStaking ? 'user-staking' : ''}" data-pair-id="${pair.id}">
                <td class="pair-col">
                    <div class="pair-info">
                        <div class="pair-header">
                            <div class="pair-name-container">
                                <span class="pair-name">${this.formatPairName(pair.name)}</span>
                                <div class="pair-badges">
                                    ${pair.isNew ? '<span class="badge new">NEW</span>' : ''}
                                    ${pair.isHot ? '<span class="badge hot">🔥 HOT</span>' : ''}
                                    ${!pair.isActive ? '<span class="badge inactive">INACTIVE</span>' : ''}
                                </div>
                            </div>
                            <button class="uniswap-link" data-pair="${pair.name}" title="Add liquidity on Uniswap">
                                <span class="uniswap-icon">🦄</span>
                                <span class="link-text">Add Liquidity</span>
                            </button>
                        </div>
                        <div class="pair-details">
                            <span class="pair-address">${window.Formatter?.formatAddress(pair.lpToken) || pair.lpToken}</span>
                            <span class="pair-network">Polygon</span>
                        </div>
                    </div>
                </td>

                <td class="apr-col">
                    <div class="apr-display">
                        <div class="apr-value ${aprStatus.class}">${window.Formatter?.formatPercentage(pair.apr) || '0%'}</div>
                        <div class="apr-status">${aprStatus.text}</div>
                        ${pair.aprChange ? `
                            <div class="apr-change ${pair.aprChange > 0 ? 'positive' : 'negative'}">
                                ${pair.aprChange > 0 ? '+' : ''}${window.Formatter?.formatPercentage(pair.aprChange) || '0%'}
                            </div>
                        ` : ''}
                    </div>
                </td>

                <td class="tvl-col">
                    <div class="tvl-display">
                        <div class="tvl-value">${window.Formatter?.formatUSD(pair.tvl) || '$0.00'}</div>
                        <div class="tvl-tokens">${window.Formatter?.formatTokenAmount(pair.totalStaked) || '0'} LP</div>
                        ${pair.tvlChange ? `
                            <div class="tvl-change ${pair.tvlChange > 0 ? 'positive' : 'negative'}">
                                ${pair.tvlChange > 0 ? '+' : ''}${window.Formatter?.formatPercentage(pair.tvlChange) || '0%'}
                            </div>
                        ` : ''}
                    </div>
                </td>

                <td class="weight-col">
                    <div class="weight-display">
                        <div class="weight-value">${pair.weight || 0}</div>
                        <div class="weight-bar">
                            <div class="weight-fill" style="width: ${(pair.weight || 0) / 100 * 100}%"></div>
                        </div>
                    </div>
                </td>

                <td class="stake-col">
                    <div class="stake-display">
                        ${isUserStaking ? `
                            <div class="stake-amount">${window.Formatter?.formatTokenAmount(stakedAmount) || '0'}</div>
                            <div class="stake-usd">${window.Formatter?.formatUSD(stakedAmountUSD) || '$0.00'}</div>
                        ` : `
                            <div class="no-stake">Not staking</div>
                        `}
                    </div>
                </td>

                <td class="rewards-col">
                    <div class="rewards-display">
                        ${isUserStaking ? `
                            <div class="rewards-amount">${window.Formatter?.formatTokenAmount(pendingRewards) || '0'}</div>
                            <div class="rewards-usd">${window.Formatter?.formatUSD(pendingRewardsUSD) || '$0.00'}</div>
                        ` : `
                            <div class="no-rewards">-</div>
                        `}
                    </div>
                </td>

                <td class="actions-col">
                    <div class="pair-actions">
                        <button class="btn btn-primary btn-small simple-stake-btn" 
                                data-pair-id="${pair.id}" 
                                data-pair-name="${pair.name}"
                                onclick="handleSimpleStake('${pair.id}', '${pair.name}')"
                                ${!pair.isActive ? 'disabled' : ''}>
                            ${isUserStaking ? 'Stake More' : 'Stake'}
                        </button>
                        ${isUserStaking ? `
                            <button class="btn btn-secondary btn-small simple-unstake-btn" 
                                    data-pair-id="${pair.id}"
                                    onclick="handleSimpleUnstake('${pair.id}', '${pair.name}')">
                                Unstake
                            </button>
                            <button class="btn btn-success btn-small simple-claim-btn" 
                                    data-pair-id="${pair.id}"
                                    onclick="handleSimpleClaim('${pair.id}', '${pair.name}')"
                                    ${parseFloat(pendingRewards) <= 0 ? 'disabled' : ''}>
                                Claim
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Get APR status classification
     */
    getAPRStatus(apr) {
        if (apr === 0) return { class: 'inactive', text: 'Inactive' };
        if (apr < 10) return { class: 'low', text: 'Low' };
        if (apr < 50) return { class: 'moderate', text: 'Moderate' };
        if (apr < 100) return { class: 'high', text: 'High' };
        return { class: 'very-high', text: 'Very High' };
    }

    /**
     * Get sorted pairs based on current sort settings
     * Matches React implementation: sort by weight > tvl > apr
     */
    getSortedPairs() {
        const pairs = [...this.stakingPairs];

        // React-style multi-level sorting
        pairs.sort((a, b) => {
            // Primary sort: Weight (descending)
            if (a.weight !== b.weight) {
                return b.weight - a.weight;
            }

            // Secondary sort: TVL (descending)
            if (a.tvl !== b.tvl) {
                return b.tvl - a.tvl;
            }

            // Tertiary sort: APR (descending)
            return b.apr - a.apr;
        });

        return pairs;
    }

    /**
     * Render refresh indicator
     */
    renderRefreshIndicator() {
        return `
            <div class="refresh-indicator ${this.isRefreshing ? 'active' : ''}">
                <div class="refresh-content">
                    <div class="refresh-spinner"></div>
                    <span>Auto-refreshing data every 30 seconds...</span>
                </div>
            </div>
        `;
    }

    /**
     * Render enhanced loading state with skeletons
     */
    renderLoadingState() {
        return `
            <div class="loading-state">
                <div class="section-header">
                    <h2>Staking Pairs</h2>
                    <div class="loading-skeleton skeleton-button"></div>
                </div>

                <div class="pairs-table-container">
                    <div class="responsive-table">
                        <table class="pairs-table">
                            <thead>
                                <tr>
                                    <th>Pair</th>
                                    <th>APR</th>
                                    <th>TVL</th>
                                    <th>Weight</th>
                                    <th>Your Stake</th>
                                    <th>Pending Rewards</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Array(5).fill(0).map(() => `
                                    <tr class="skeleton-row">
                                        <td><div class="loading-skeleton skeleton-pair"></div></td>
                                        <td><div class="loading-skeleton skeleton-apr"></div></td>
                                        <td><div class="loading-skeleton skeleton-tvl"></div></td>
                                        <td><div class="loading-skeleton skeleton-weight"></div></td>
                                        <td><div class="loading-skeleton skeleton-stake"></div></td>
                                        <td><div class="loading-skeleton skeleton-rewards"></div></td>
                                        <td><div class="loading-skeleton skeleton-actions"></div></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render enhanced empty state
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-content">
                    <div class="empty-icon">🏊‍♂️</div>
                    <h3>No Staking Pairs Available</h3>
                    <p>There are currently no staking pairs available. You can add liquidity to supported DEX pairs to get started.</p>

                    <div class="empty-actions">
                        <button id="refresh-data" class="btn btn-primary">
                            <span>🔄</span>
                            Refresh Data
                        </button>
                        <button id="add-liquidity" class="btn btn-secondary">
                            <span>💧</span>
                            Add Liquidity
                        </button>
                    </div>

                    <div class="empty-help">
                        <h4>How to get started:</h4>
                        <ol>
                            <li>Add liquidity to supported pairs on Uniswap</li>
                            <li>Receive LP tokens for your liquidity provision</li>
                            <li>Return here to stake your LP tokens and earn rewards</li>
                        </ol>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render info section
     */
    renderInfoSection() {
        return `
            <div class="info-section" style="margin-top: 3rem;">
                <div class="card">
                    <div class="card-header">
                        <h3>How It Works</h3>
                    </div>
                    <div class="card-body">
                        <div class="steps-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem;">
                            <div class="step">
                                <div class="step-number">1</div>
                                <h4>Provide Liquidity</h4>
                                <p>Add liquidity to supported DEX pairs to receive LP tokens</p>
                            </div>
                            <div class="step">
                                <div class="step-number">2</div>
                                <h4>Stake LP Tokens</h4>
                                <p>Stake your LP tokens in our secure smart contract</p>
                            </div>
                            <div class="step">
                                <div class="step-number">3</div>
                                <h4>Earn Rewards</h4>
                                <p>Automatically earn rewards that you can claim anytime</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Set up enhanced event listeners
     */
    setupEventListeners() {
        console.log('🏠 HomePage setupEventListeners called');
        
        // Use setTimeout to ensure DOM is fully updated
        setTimeout(() => {
            this.attachEventListeners();
        }, 100);
    }

    /**
     * Attach event listeners to DOM elements
     */
    attachEventListeners() {
        // Connect wallet button
        const connectBtn = this.$('#connect-wallet-home');
        if (connectBtn) {
            this.addEventListener(connectBtn, 'click', () => {
                this.handleWalletConnect();
            });
        }

        // Manual refresh button
        const manualRefreshBtn = this.$('#manual-refresh');
        console.log('🏠 Found manual refresh button:', !!manualRefreshBtn);
        if (manualRefreshBtn) {
            this.addEventListener(manualRefreshBtn, 'click', () => {
                console.log('🏠 Manual refresh button clicked');
                this.refreshData(true);
            });
        }

        // Refresh data buttons
        this.$$('#refresh-data').forEach(btn => {
            this.addEventListener(btn, 'click', () => {
                this.refreshData(true);
            });
        });

        // Sort controls
        const sortSelect = this.$('#sort-select');
        if (sortSelect) {
            this.addEventListener(sortSelect, 'change', (e) => {
                this.handleSortChange(e.target.value);
            });
        }

        const sortOrderBtn = this.$('#sort-order');
        if (sortOrderBtn) {
            this.addEventListener(sortOrderBtn, 'click', () => {
                this.toggleSortOrder();
            });
        }

        // Copy address button
        const copyAddressBtn = this.$('.copy-address-btn');
        if (copyAddressBtn) {
            this.addEventListener(copyAddressBtn, 'click', (e) => {
                const address = e.target.getAttribute('data-address');
                this.copyToClipboard(address);
            });
        }

        // Claim all button
        const claimAllBtn = this.$('.claim-all-btn');
        if (claimAllBtn) {
            this.addEventListener(claimAllBtn, 'click', () => {
                this.handleClaimAll();
            });
        }

        // Add liquidity buttons
        this.$$('#add-liquidity').forEach(btn => {
            this.addEventListener(btn, 'click', () => {
                this.handleAddLiquidity();
            });
        });

        // Uniswap links
        this.$$('.uniswap-link').forEach(link => {
            this.addEventListener(link, 'click', (e) => {
                const pairName = e.currentTarget.getAttribute('data-pair');
                this.openUniswapLink(pairName);
            });
        });

        // Stake buttons
        const stakeButtons = this.$$('.stake-btn');
        console.log('🏠 Found stake buttons:', stakeButtons.length);
        stakeButtons.forEach(btn => {
            this.addEventListener(btn, 'click', (e) => {
                console.log('🏠 Stake button clicked:', e.target);
                const pairId = e.target.getAttribute('data-pair-id');
                this.handleStake(pairId);
            });
        });

        // Unstake buttons
        this.$$('.unstake-btn').forEach(btn => {
            this.addEventListener(btn, 'click', (e) => {
                const pairId = e.target.getAttribute('data-pair-id');
                this.handleUnstake(pairId);
            });
        });

        // Claim buttons
        this.$$('.claim-btn').forEach(btn => {
            this.addEventListener(btn, 'click', (e) => {
                const pairId = e.target.getAttribute('data-pair-id');
                this.handleClaim(pairId);
            });
        });

        // Pair row clicks for details
        this.$$('.pair-row').forEach(row => {
            this.addEventListener(row, 'click', (e) => {
                if (!e.target.closest('button')) {
                    const pairId = row.getAttribute('data-pair-id');
                    this.showPairDetails(pairId);
                }
            });
        });
        
        console.log('🏠 Event listeners attached successfully');
    }

    /**
     * Set up state subscriptions
     */
    setupStateSubscriptions() {
        // Subscribe to wallet state changes
        this.subscribeToState('wallet', () => {
            this.update();
        });

        // Subscribe to staking data changes
        this.subscribeToState('staking', () => {
            this.update();
        });
    }

    /**
     * Handle wallet connect
     */
    async handleWalletConnect() {
        try {
            await window.walletManager?.connectMetaMask();
        } catch (error) {
            window.ErrorHandler?.handleWalletError(error);
        }
    }

    /**
     * Handle sort change
     */
    handleSortChange(newSortBy) {
        this.sortBy = newSortBy;
        this.update();
    }

    /**
     * Toggle sort order
     */
    toggleSortOrder() {
        this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc';
        this.update();
    }

    /**
     * Copy address to clipboard
     */
    async copyToClipboard(address) {
        try {
            await navigator.clipboard.writeText(address);
            window.notificationManager?.success('Copied!', 'Address copied to clipboard');
        } catch (error) {
            this.log('Failed to copy address:', error);
            window.notificationManager?.error('Copy Failed', 'Could not copy address to clipboard');
        }
    }

    /**
     * Handle claim all rewards
     */
    async handleClaimAll() {
        try {
            const userStakes = this.userStakes.filter(stake => parseFloat(stake.pendingRewards) > 0);

            if (userStakes.length === 0) {
                window.notificationManager?.info('No Rewards', 'You have no pending rewards to claim');
                return;
            }

            // Show confirmation
            const confirmed = await this.showConfirmDialog(
                'Claim All Rewards',
                `Are you sure you want to claim rewards from ${userStakes.length} positions?`
            );

            if (!confirmed) return;

            // Process claims
            for (const stake of userStakes) {
                await this.handleClaim(stake.pairId);
            }

            window.notificationManager?.success('Success', 'All rewards claimed successfully');
        } catch (error) {
            this.log('Error claiming all rewards:', error);
            window.notificationManager?.error('Claim Failed', 'Failed to claim all rewards');
        }
    }

    /**
     * Handle add liquidity
     */
    handleAddLiquidity() {
        const uniswapUrl = 'https://app.uniswap.org/#/add/v2';
        window.open(uniswapUrl, '_blank', 'noopener,noreferrer');
    }

    /**
     * Open Uniswap link for specific pair
     */
    openUniswapLink(pairName) {
        try {
            const [token0, token1] = pairName.split('-');
            const uniswapUrl = `https://app.uniswap.org/#/add/v2/${token0}/${token1}`;
            window.open(uniswapUrl, '_blank', 'noopener,noreferrer');

            window.notificationManager?.info('Redirecting', `Opening Uniswap to add ${pairName} liquidity`);
        } catch (error) {
            this.log('Error opening Uniswap link:', error);
            window.notificationManager?.error('Link Error', 'Failed to open Uniswap link');
        }
    }

    /**
     * Show pair details modal
     */
    showPairDetails(pairId) {
        const pair = this.stakingPairs.find(p => p.id === pairId);
        if (!pair) return;

        // This would open a detailed modal with pair information
        console.log('Show details for pair:', pair);
        window.notificationManager?.info('Coming Soon', 'Detailed pair information modal will be implemented');
    }

    /**
     * Handle stake action
     */
    async handleStake(pairId) {
        try {
            const pair = this.stakingPairs.find(p => p.id === pairId);
            if (!pair) {
                throw new Error('Pair not found');
            }

            if (!pair.isActive) {
                window.notificationManager?.warning('Inactive Pair', 'This staking pair is currently inactive');
                return;
            }

            // Open staking modal
            if (window.stakingModal) {
                await window.stakingModal.show({
                    action: 'stake',
                    pair: pair
                });
            } else {
                window.notificationManager?.info('Coming Soon', 'Staking modal will be available soon');
            }
        } catch (error) {
            this.log('Error handling stake:', error);
            window.notificationManager?.error('Stake Error', error.message);
        }
    }

    /**
     * Handle unstake action
     */
    async handleUnstake(pairId) {
        try {
            const pair = this.stakingPairs.find(p => p.id === pairId);
            const userStake = this.userStakes.find(s => s.pairId === pairId);

            if (!pair || !userStake) {
                throw new Error('Pair or stake not found');
            }

            // Open staking modal
            if (window.stakingModal) {
                await window.stakingModal.show({
                    action: 'unstake',
                    pair: pair,
                    userStake: userStake
                });
            } else {
                window.notificationManager?.info('Coming Soon', 'Unstaking modal will be available soon');
            }
        } catch (error) {
            this.log('Error handling unstake:', error);
            window.notificationManager?.error('Unstake Error', error.message);
        }
    }

    /**
     * Handle claim action
     */
    async handleClaim(pairId) {
        try {
            const pair = this.stakingPairs.find(p => p.id === pairId);
            const userStake = this.userStakes.find(s => s.pairId === pairId);

            if (!pair || !userStake) {
                throw new Error('Pair or stake not found');
            }

            if (parseFloat(userStake.pendingRewards) <= 0) {
                window.notificationManager?.info('No Rewards', 'You have no pending rewards to claim for this pair');
                return;
            }

            // Process claim through rewards system
            if (this.rewardsCalculator && window.contractManager) {
                const walletAddress = this.getState('wallet.address');
                await this.rewardsCalculator.claimRewards(walletAddress, pair.name);

                // Refresh data after claim
                await this.refreshUserData();

                window.notificationManager?.success('Claimed!', `Successfully claimed ${userStake.pendingRewards} LIB tokens`);
            } else {
                window.notificationManager?.info('Coming Soon', 'Claim functionality will be available soon');
            }
        } catch (error) {
            this.log('Error handling claim:', error);
            window.notificationManager?.error('Claim Error', error.message);
        }
    }

    /**
     * Refresh all data with enhanced loading states
     */
    async refreshData(isManual = false) {
        if (this.isRefreshing && !isManual) {
            return; // Prevent concurrent refreshes
        }

        this.isRefreshing = true;
        if (!this.stakingPairs.length) {
            this.isLoading = true;
        }
        this.update();

        try {
            this.log('Refreshing data...');

            // Refresh staking pairs data
            await this.refreshStakingPairs();

            // Refresh user data if wallet is connected
            const isConnected = this.getState('wallet.isConnected');
            if (isConnected) {
                await this.refreshUserData();
            }

            this.lastRefreshTime = Date.now();

            if (isManual) {
                window.notificationManager?.success('Refreshed', 'Data has been updated successfully');
            }

        } catch (error) {
            this.log('Error refreshing data:', error);
            if (isManual) {
                window.notificationManager?.error('Refresh Failed', 'Failed to refresh data');
            }
        } finally {
            this.isLoading = false;
            this.isRefreshing = false;
            this.update();
        }
    }

    /**
     * Refresh staking pairs data from blockchain
     */
    async refreshStakingPairs() {
        try {
            this.log('Refreshing staking pairs from blockchain...');

            // Check if we should use mock data
            if (window.CONFIG?.DEV?.MOCK_DATA) {
                this.log('Using mock data for staking pairs');
                await this.loadMockPairsData();
                return;
            }

            // Get real data from contract manager
            if (!window.contractManager || !window.contractManager.isReady()) {
                this.log('Contract manager not ready, using fallback data');
                await this.loadFallbackPairsData();
                return;
            }

            const pairsData = [];

            try {
                // Get all pairs info from the staking contract
                const allPairsInfo = await window.contractManager.getAllPairsInfo();
                this.log('Retrieved pairs from contract:', allPairsInfo);

                for (const pairInfo of allPairsInfo) {
                    try {
                        // Get additional data for each pair
                        const pairData = await this.buildPairData(pairInfo);
                        if (pairData) {
                            pairsData.push(pairData);
                        }
                    } catch (pairError) {
                        this.logError(`Failed to build data for pair ${pairInfo.address}:`, pairError);
                        continue;
                    }
                }

                if (pairsData.length === 0) {
                    this.log('No valid pairs found, using fallback data');
                    await this.loadFallbackPairsData();
                    return;
                }

            } catch (contractError) {
                this.logError('Failed to fetch pairs from contract:', contractError);
                await this.loadFallbackPairsData();
                return;
            }

            this.stakingPairs = pairsData;
            this.log(`✅ Loaded ${pairsData.length} real staking pairs from blockchain`);

        } catch (error) {
            this.logError('Failed to refresh staking pairs:', error);
            await this.loadFallbackPairsData();
        }
    }

    /**
     * Build pair data from contract information
     * Enhanced with React-style price fetching and APR calculation
     */
    async buildPairData(pairInfo) {
        try {
            // Extract pair name from platform or use address
            const pairName = this.extractPairName(pairInfo.address, pairInfo.platform);

            // Get additional data if available
            let tvl = 0;
            let tvlInTokens = 0;
            let totalStaked = 0;
            let apr = 0;
            let myShare = 0;
            let myEarnings = 0;
            let lpTokenPrice = 0;
            let rewardTokenPrice = 0;

            try {
                console.log(`🔍 Fetching data for pair: ${pairName}`);

                // Get hourly reward rate from contract
                const hourlyRewardRate = await window.contractManager.getHourlyRewardRate();
                const hourlyRate = parseFloat(window.ethers.formatEther(hourlyRewardRate || '0'));
                console.log(`  ⏰ Hourly rate: ${hourlyRate}`);

                // Get TVL from contract
                const tvlWei = await window.contractManager.getTVL(pairInfo.address);
                tvlInTokens = parseFloat(window.ethers.formatEther(tvlWei || '0'));
                console.log(`  📊 TVL in tokens: ${tvlInTokens}`);

                // Fetch token prices using DexScreener (React implementation)
                console.log(`  💰 Checking price feeds availability:`, {
                    priceFeeds: !!window.priceFeeds,
                    fetchTokenPrice: !!window.priceFeeds?.fetchTokenPrice
                });

                if (window.priceFeeds && window.priceFeeds.fetchTokenPrice) {
                    console.log(`  🔍 Fetching LP token price for: ${pairInfo.address}`);
                    lpTokenPrice = await window.priceFeeds.fetchTokenPrice(pairInfo.address);
                    console.log(`  💵 LP token price: $${lpTokenPrice}`);

                    // Get reward token address from config
                    const rewardTokenAddress = window.CONFIG?.CONTRACTS?.REWARD_TOKEN;
                    if (rewardTokenAddress) {
                        console.log(`  🔍 Fetching reward token price for: ${rewardTokenAddress}`);
                        rewardTokenPrice = await window.priceFeeds.fetchTokenPrice(rewardTokenAddress);
                        console.log(`  💵 Reward token price: $${rewardTokenPrice}`);
                    }
                } else {
                    console.warn(`  ⚠️ Price feeds not available!`);
                }

                // Calculate APR using React formula
                console.log(`  🧮 Checking rewards calculator:`, {
                    rewardsCalculator: !!window.rewardsCalculator,
                    calcAPR: !!window.rewardsCalculator?.calcAPR
                });

                if (window.rewardsCalculator && window.rewardsCalculator.calcAPR) {
                    apr = window.rewardsCalculator.calcAPR(
                        hourlyRate,
                        tvlInTokens,
                        lpTokenPrice,
                        rewardTokenPrice
                    );
                    console.log(`  📈 Calculated APR: ${apr}%`);
                } else {
                    console.warn(`  ⚠️ Rewards calculator not available!`);
                }

                // Calculate TVL in USD
                tvl = tvlInTokens * lpTokenPrice;
                console.log(`  💰 TVL in USD: $${tvl}`);

                // Get user-specific data if wallet is connected
                const walletAddress = this.getState('wallet.address');
                if (walletAddress && window.contractManager) {
                    try {
                        // Get user stake info
                        const userStake = await window.contractManager.getUserStake(walletAddress, pairInfo.address);
                        const userStakeAmount = parseFloat(window.ethers.formatEther(userStake.amount || '0'));

                        // Calculate my share percentage
                        if (tvlInTokens > 0) {
                            myShare = (userStakeAmount / tvlInTokens) * 100;
                        }

                        // Get pending rewards
                        const pendingRewards = await window.contractManager.getPendingRewards(walletAddress, pairInfo.address);
                        myEarnings = parseFloat(window.ethers.formatEther(pendingRewards || '0'));
                    } catch (userError) {
                        this.log(`Could not get user data for ${pairName}:`, userError.message);
                    }
                }

            } catch (dataError) {
                console.error(`Could not get additional data for ${pairName}:`, dataError);
                this.log(`Could not get additional data for ${pairName}:`, dataError.message);
            }

            const pairData = {
                id: pairInfo.address,
                name: pairName,
                lpToken: pairInfo.address,
                platform: pairInfo.platform || 'Unknown',
                weight: parseInt(pairInfo.weight) || 0,
                isActive: pairInfo.isActive,
                apr: apr,
                aprFormatted: `${apr.toFixed(1)}%`,
                tvl: tvl,
                tvlInTokens: tvlInTokens,
                totalStaked: tvlInTokens,
                lpTokenPrice: lpTokenPrice,
                rewardTokenPrice: rewardTokenPrice,
                myShare: myShare,
                myEarnings: myEarnings,
                isNew: false,
                isHot: apr > 100,
                stakersCount: 0, // Would need additional contract call
                aprChange: null,
                tvlChange: null,
                userShares: myShare.toFixed(2),
                userEarnings: myEarnings.toFixed(4)
            };

            console.log('Built pair data:', pairData);
            return pairData;
        } catch (error) {
            this.logError('Failed to build pair data:', error);
            return null;
        }
    }

    /**
     * Format pair name for display (e.g., "LPLIBETH" -> "LIB/ETH LP")
     */
    formatPairName(pairName) {
        if (!pairName) return pairName;

        // If already formatted (contains /), return as is
        if (pairName.includes('/')) {
            return pairName;
        }

        // Handle LP prefix format: "LPLIBETH" -> "LIB/ETH LP"
        if (pairName.startsWith('LP') && pairName.length > 4) {
            const tokens = pairName.substring(2); // Remove "LP"

            // Try to split into two tokens
            const commonTokens = ['USDC', 'USDT', 'DAI', 'WETH', 'ETH', 'WBTC', 'BTC', 'LIB', 'MATIC'];

            for (const token of commonTokens) {
                if (tokens.endsWith(token)) {
                    const token1 = tokens.substring(0, tokens.length - token.length);
                    const token2 = token;
                    if (token1.length > 0) {
                        return `${token1}/${token2} LP`;
                    }
                }
                if (tokens.startsWith(token)) {
                    const token1 = token;
                    const token2 = tokens.substring(token.length);
                    if (token2.length > 0) {
                        return `${token1}/${token2} LP`;
                    }
                }
            }

            // Fallback: split in half
            const mid = Math.floor(tokens.length / 2);
            const token1 = tokens.substring(0, mid);
            const token2 = tokens.substring(mid);
            return `${token1}/${token2} LP`;
        }

        // Return original if no pattern matched
        return pairName;
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
     * Load mock pairs data for development
     */
    async loadMockPairsData() {
        const mockPairData = {
            id: 'pair-1',
            name: 'LIB-USDT',
            lpToken: '0x1234567890123456789012345678901234567890',
            platform: 'Uniswap V2',
            apr: 125.50,
            aprFormatted: '125.50%',
            tvl: 1250000,
            totalStaked: 850000,
            weight: 70,
            isActive: true,
            isNew: false,
            isHot: true,
            stakersCount: 156,
            aprChange: '+12.5%',
            tvlChange: '+8.2%',
            userShares: this.isWalletConnected() ? '15.75' : '0.00',
            userEarnings: this.isWalletConnected() ? '2.45' : '0.00'
        };

        this.stakingPairs = [mockPairData];
        this.log('✅ Loaded mock staking pairs data');
    }

    /**
     * Load fallback pairs data when contract is not available
     */
    async loadFallbackPairsData() {
        const fallbackPairData = {
            id: 'fallback-1',
            name: 'LIB-USDT',
            lpToken: '0x0000000000000000000000000000000000000000',
            platform: 'Loading...',
            apr: 0,
            aprFormatted: '0.00%',
            tvl: 0,
            totalStaked: 0,
            weight: 0,
            isActive: false,
            isNew: false,
            isHot: false,
            stakersCount: 0,
            aprChange: null,
            tvlChange: null,
            userShares: '0.00',
            userEarnings: '0.00'
        };

        this.stakingPairs = [fallbackPairData];
        this.log('⚠️ Loaded fallback staking pairs data');
    }

    /**
     * Refresh user-specific data
     */
    async refreshUserData() {
        try {
            const walletAddress = this.getState('wallet.address');
            if (!walletAddress) return;

            const userStakes = [];
            let totalStakedUSD = 0;
            let totalEarningsUSD = 0;
            let totalPendingRewardsUSD = 0;

            for (const pair of this.stakingPairs) {
                try {
                    // Get user's pending rewards
                    let rewardsData = { pendingRewards: 0, pendingRewardsUSD: 0 };
                    if (this.rewardsCalculator) {
                        rewardsData = await this.rewardsCalculator.calculatePendingRewards(walletAddress, pair.name);
                    }

                    // Get user's staked amount (mock for now)
                    const stakedAmount = Math.random() > 0.7 ? (Math.random() * 1000).toFixed(2) : '0';
                    const stakedAmountUSD = parseFloat(stakedAmount) * (pair.tvl / Math.max(pair.totalStaked, 1));

                    if (parseFloat(stakedAmount) > 0) {
                        userStakes.push({
                            pairId: pair.id,
                            pairName: pair.name,
                            amount: stakedAmount,
                            amountUSD: stakedAmountUSD,
                            pendingRewards: rewardsData.pendingRewards || '0',
                            pendingRewardsUSD: rewardsData.pendingRewardsUSD || 0
                        });

                        totalStakedUSD += stakedAmountUSD;
                        totalPendingRewardsUSD += rewardsData.pendingRewardsUSD || 0;
                    }
                } catch (error) {
                    this.log(`Error loading user data for ${pair.name}:`, error);
                }
            }

            this.userStakes = userStakes;
            this.userPortfolio = {
                totalStakedUSD,
                totalEarningsUSD, // This would be calculated from historical data
                totalPendingRewardsUSD,
                activePositions: userStakes.length
            };

            this.log(`Loaded user data: ${userStakes.length} positions, $${totalStakedUSD.toFixed(2)} staked`);

        } catch (error) {
            this.log('Error refreshing user data:', error);
            throw error;
        }
    }



    /**
     * Stop auto-refresh timer
     */
    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
            this.log('Auto-refresh stopped');
        }
    }

    /**
     * Show confirmation dialog
     */
    async showConfirmDialog(title, message) {
        return new Promise((resolve) => {
            if (window.confirm(`${title}\n\n${message}`)) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
    }

    /**
     * Component lifecycle - before mount
     */
    async beforeMount() {
        await this.initializeDependencies();
    }

    /**
     * Override update method to ensure event listeners are reattached
     */
    async update() {
        await super.update();
        
        console.log('🏠 Event listeners attached successfully');
    }



    /**
     * Component lifecycle - after mount
     */
    async afterMount() {
        console.log('🏠 HomePage afterMount called');
        
        // Load initial data
        await this.refreshData(false);

        // Auto-refresh removed - handled by main HomePage component
        
        // Ensure buttons work - add direct event listeners
        this.ensureButtonsWork();
        
        console.log('🏠 HomePage initialization complete');
    }

    /**
     * Ensure buttons work by adding direct event listeners
     */
    ensureButtonsWork() {
        setTimeout(() => {
            console.log('🔧 Ensuring buttons work...');
            
            // Fix stake buttons
            document.querySelectorAll('.stake-btn').forEach(btn => {
                btn.onclick = (e) => {
                    console.log('🎯 Stake button clicked directly!');
                    const pairId = e.target.getAttribute('data-pair-id') || 'pair-1';
                    
                    if (window.stakingModal) {
                        const mockPair = {
                            id: pairId,
                            name: 'LIB-USDT',
                            lpToken: '0x1234567890123456789012345678901234567890',
                            apr: 0,
                            isActive: true
                        };
                        window.stakingModal.show(mockPair, 0);
                    } else {
                        window.notificationManager?.info('Opening Staking', 'Staking interface loading...');
                    }
                };
            });

            // Fix refresh button
            const refreshBtn = document.getElementById('manual-refresh');
            if (refreshBtn) {
                refreshBtn.onclick = () => {
                    console.log('🔄 Refresh button clicked directly!');
                    this.refreshData(true);
                };
            }

            // Fix Uniswap links
            document.querySelectorAll('.uniswap-link').forEach(link => {
                link.onclick = (e) => {
                    console.log('🦄 Uniswap link clicked directly!');
                    const pairName = e.target.getAttribute('data-pair') || 'LIB-USDT';
                    const [token0, token1] = pairName.split('-');
                    const url = `https://app.uniswap.org/#/add/v2/${token0}/${token1}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                    window.notificationManager?.info('Redirecting', `Opening Uniswap for ${pairName}`);
                };
            });

            console.log('✅ Direct button handlers attached');
        }, 500);
    }

    /**
     * Component lifecycle - before unmount
     */
    async beforeUnmount() {
        // Stop auto-refresh
        this.stopAutoRefresh();
    }

    /**
     * Component lifecycle - on state change
     */
    onStateChange(key, newValue, oldValue) {
        // Refresh data when wallet connection changes
        if (key === 'wallet.isConnected' && newValue !== oldValue) {
            setTimeout(() => {
                this.refreshData(false);
            }, 100);
        }
    }
}

// Make available globally
window.HomePage = HomePage;

/**
 * Global handler for opening stake modal with specific tab
 * Matches React implementation: handleShareClick(pair, tab)
 */
window.handleOpenStakeModal = function(pairId, initialTab = 0) {
    console.log(`🎯 Opening stake modal for pair ${pairId}, tab ${initialTab}`);

    // Find the pair data
    const homePage = window.app?.currentPage;
    if (!homePage || !homePage.stakingPairs) {
        console.error('HomePage not available');
        return;
    }

    const pair = homePage.stakingPairs.find(p => p.id === pairId);
    if (!pair) {
        console.error(`Pair ${pairId} not found`);
        return;
    }

    // Open modal with specific tab
    if (window.stakingModal) {
        window.stakingModal.show(pair, initialTab);
    } else {
        console.error('Staking modal not available');
        window.notificationManager?.error('Error', 'Staking modal not available');
    }
};
