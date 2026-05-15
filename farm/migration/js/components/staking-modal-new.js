/**
 * Staking Modal Component - Matches React StakingModal.tsx exactly
 * Professional modal with tabs, sliders, and form controls
 */

class StakingModalNew {
    constructor() {
        this.isOpen = false;
        this.currentPair = null;
        this.currentTab = 'stake';
        this.stakeAmount = '';
        this.unstakeAmount = '';
        this.userBalance = '0.00';
        this.userStaked = '0.00';
        this.pendingRewards = '0.00';
        this.userBalanceRaw = window.ethers?.BigNumber.from(0);
        this.userBalanceDecimals = 18; // Updated once token metadata loads
        this.userStakedRaw = window.ethers?.BigNumber.from(0);
        this.userStakedDecimals = 18; // Staking contract uses 18 decimals

        // Zap state
        this.zapInputAmount = '';
        this.zapInputTokenAddress = 'native';
        this.zapInputTokens = [];
        this.zapInputTokenBalances = new Map();
        this.zapSelectedToken = null;
        this.zapQuote = null;
        this.zapQuoteStatus = 'idle';
        this.zapQuoteError = '';
        this.zapSlippageBps = window.CONFIG?.KYBER_ZAP?.DEFAULT_SLIPPAGE_BPS || 50;
        this.zapCustomSlippage = '';
        this.zapCustomSlippageError = '';
        this.zapDeadlineMinutes = window.CONFIG?.KYBER_ZAP?.DEFAULT_DEADLINE_MINUTES || 20;
        this.zapQuoteDebounceTimer = null;
        this.zapQuoteRequestId = 0;
        this.zapQuoteRefreshSeconds = 10;
        this.zapQuoteCountdown = 10;
        this.zapQuoteRefreshTimer = null;
        this.zapQuoteRateLimitTimer = null;
        this.zapQuoteRateLimitMessage = '';
        this.zapQuoteKey = '';
        this.zapQuoteInFlightKey = '';
        this.kyberZapService = window.KyberZapService ? new window.KyberZapService() : null;
        this.zapCustomTokenAddress = '';
        this.zapCustomTokenError = '';

        // Approval state
        this.needsApproval = false;
        this.isApproved = false;
        this.currentAllowance = '0';

        // Transaction progress state
        this.actionPhases = {
            approve: 'idle',
            stake: 'idle',
            unstake: 'idle',
            claim: 'idle',
            approveZap: 'idle',
            zap: 'idle'
        };
        this.pendingOperations = {
            approve: false,
            stake: false,
            unstake: false,
            claim: false,
            approveZap: false,
            zap: false
        };

        // Execution guards
        this.isExecutingStake = false;
        this.isExecutingUnstake = false;
        this.isExecutingClaim = false;
        this.isExecutingZap = false;

        // Claim rewards on unstake
        this.claimRewardsOnUnstake = true;

        this.transactionPhaseHandler = this.handleTransactionPhase.bind(this);
        if (typeof window !== 'undefined') {
            window.addEventListener('transaction-phase', this.transactionPhaseHandler);
        }

        // Set global reference immediately
        window.stakingModal = this;
        window.stakingModalNew = this;

        this.init();
    }

    mapOperationToAction(operationName) {
        switch (operationName) {
            case 'approveLPToken':
                return 'approve';
            case 'stake':
                return 'stake';
            case 'unstake':
                return 'unstake';
            case 'claimRewards':
                return 'claim';
            case 'approveZapToken':
                return 'approveZap';
            case 'zapIntoLP':
                return 'zap';
            default:
                return null;
        }
    }

    getPhaseLabel(phase) {
        if (phase === 'userApproval') {
            return ' User Approval...';
        }
        if (phase === 'processing') {
            return ' Processing Transaction...';
        }
        return '';
    }

    setActionPhase(action, phase) {
        if (!this.actionPhases || !Object.prototype.hasOwnProperty.call(this.actionPhases, action)) {
            return;
        }

        if (this.actionPhases[action] === phase) {
            return;
        }

        this.actionPhases[action] = phase;

        if (action === 'approve' || action === 'stake') {
            this.updateStakeButton();
        }

        if (action === 'unstake') {
            this.updateUnstakeButton();
        }

        if (action === 'claim') {
            this.updateClaimButton();
        }

        if (action === 'approveZap' || action === 'zap') {
            this.updateZapButton();
        }
    }

    handleTransactionPhase(event) {
        const detail = event?.detail;
        if (!detail) return;

        const action = this.mapOperationToAction(detail.operationName);
        if (!action || !this.pendingOperations[action]) return;

        switch (detail.phase) {
            case 'user_approval':
                this.setActionPhase(action, 'userApproval');
                break;
            case 'processing':
                this.setActionPhase(action, 'processing');
                break;
            case 'confirmed':
            case 'failed':
            case 'timeout':
            case 'settled':
                this.pendingOperations[action] = false;
                this.setActionPhase(action, 'idle');
                break;
            default:
                break;
        }
    }

    resetActionStates(triggerUpdate = true) {
        if (!this.actionPhases || !this.pendingOperations) return;

        Object.keys(this.actionPhases).forEach(action => {
            this.actionPhases[action] = 'idle';
            this.pendingOperations[action] = false;
        });

        if (triggerUpdate) {
            this.updateButtonStates();
        }
    }

    init() {
        this.createModal();
        this.attachEventListeners();
    }

    createModal() {
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;
        const modalTitle = this.isMigrationMode()
            ? `${this.getMigrationConfig().OLD_FARM_LABEL || 'Farm 1.0'} Position`
            : 'Staking';
        const modalTabsClass = this.isMigrationMode()
            ? 'modal-tabs modal-tabs-migration'
            : 'modal-tabs';

        // Create modal HTML matching React version exactly
        const modalHTML = `
            <div id="staking-modal-new" class="modal-overlay" style="display: none;">
                <div class="modal-backdrop" onclick="safeModalClose()"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="modal-title-section">
                            <h2 class="modal-title">${modalTitle}</h2>
                            <div class="pair-info" id="modal-pair-info">
                                <!-- Pair info will be populated -->
                            </div>
                        </div>
                        <button class="modal-close" onclick="safeModalClose()">
                            <span class="material-icons">close</span>
                        </button>
                    </div>
                    
                    <div class="${modalTabsClass}">
                        ${this.isMigrationMode() ? '' : `
                            <button class="tab-button active" aria-label="Create LP" data-tab="zap">
                                <span class="material-icons" aria-hidden="true">bolt</span>
                                <span class="tab-label">Create LP</span>
                            </button>
                            <button class="tab-button" aria-label="Stake" data-tab="stake">
                                <span class="material-icons" aria-hidden="true">add</span>
                                <span class="tab-label">Stake</span>
                            </button>
                        `}
                        <button class="tab-button" aria-label="Unstake" data-tab="unstake">
                            <span class="material-icons" aria-hidden="true">remove</span>
                            <span class="tab-label">Unstake</span>
                        </button>
                        <button class="tab-button" aria-label="Claim" data-tab="claim">
                            <span class="material-icons" aria-hidden="true">redeem</span>
                            <span class="tab-label">Claim</span>
                        </button>
                    </div>
                    
                    <div class="modal-body">
                        <div id="tab-content">
                            <!-- Tab content will be rendered here -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        modalContainer.innerHTML = modalHTML;
    }

    attachEventListeners() {
        // Tab switching
        document.addEventListener('click', (e) => {
            if (e.target.closest('.tab-button')) {
                const tab = e.target.closest('.tab-button').dataset.tab;
                this.switchTab(tab);
            }

            // Percentage buttons
            if (e.target.closest('.percentage-btn')) {
                const percentage = parseInt(e.target.closest('.percentage-btn').dataset.percentage);
                this.setPercentage(percentage);
            }

            if (e.target.closest('.zap-slippage-btn')) {
                const button = e.target.closest('.zap-slippage-btn');
                this.setZapSlippage(button.dataset.slippage);
            }

            if (e.target.closest('.zap-percentage-btn')) {
                const button = e.target.closest('.zap-percentage-btn');
                this.setZapAmountPercentage(parseInt(button.dataset.percentage, 10));
            }

            if (e.target.closest('.zap-token-option')) {
                const button = e.target.closest('.zap-token-option');
                this.setZapInputToken(button.dataset.tokenAddress);
            }

            if (!e.target.closest('.zap-token-picker')) {
                document.querySelectorAll('.zap-token-picker[open]').forEach(menu => {
                    menu.open = false;
                });
            }
        });

        // Input changes
        document.addEventListener('input', (e) => {
            if (e.target.id === 'stake-amount-input') {
                const sanitizedValue = this.applyDecimalLimit(e.target.value, this.userBalanceDecimals);
                if (sanitizedValue !== e.target.value) {
                    e.target.value = sanitizedValue;
                }
                this.stakeAmount = sanitizedValue;
                this.updateSlider('stake');
                this.updateStakeEstimatedAPR();
                this.updateStakeUsdEstimate();

                // Reset approval state when amount changes
                this.isApproved = false;
                this.needsApproval = false;
            }

            if (e.target.id === 'unstake-amount-input') {
                const sanitizedValue = this.applyDecimalLimit(e.target.value, this.userStakedDecimals);
                if (sanitizedValue !== e.target.value) {
                    e.target.value = sanitizedValue;
                }
                this.unstakeAmount = sanitizedValue;
                this.updateSlider('unstake');
                this.updateUnstakeUsdEstimate();
            }

            if (e.target.classList.contains('amount-slider')) {
                this.updateAmountFromSlider(e.target);
            }

            if (e.target.id === 'zap-amount-input') {
                const sanitizedValue = this.applyDecimalLimit(e.target.value, this.zapSelectedToken?.decimals ?? 18);
                if (sanitizedValue !== e.target.value) {
                    e.target.value = sanitizedValue;
                }
                this.zapInputAmount = sanitizedValue;
                this.resetZapQuoteState();
                document.querySelectorAll('.zap-percentage-btn').forEach(btn => btn.classList.remove('active'));
                this.updateZapBalanceError();
                this.updateZapQuotePanel();
                this.debounceZapQuote();
                this.updateZapButton();
            }

            if (e.target.id === 'zap-custom-slippage-input') {
                const sanitizedValue = this.setZapCustomSlippageInput(e.target.value);
                if (sanitizedValue !== e.target.value) {
                    e.target.value = sanitizedValue;
                }
            }

            if (e.target.id === 'zap-custom-token-input') {
                this.zapCustomTokenAddress = e.target.value.trim();
                this.zapCustomTokenError = '';
            }
        });

        // Checkbox changes
        document.addEventListener('change', (e) => {
            if (e.target.id === 'claim-rewards-checkbox') {
                this.claimRewardsOnUnstake = e.target.checked;
                console.log('Claim rewards on unstake:', this.claimRewardsOnUnstake);
                this.updateUnstakeButton();
            }
        });

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if ((e.target.id === 'stake-amount-input' || e.target.id === 'unstake-amount-input') && ['-', '+', 'e', 'E'].includes(e.key)) {
                e.preventDefault();
                return;
            }

            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // Wallet and network change events - close modal when account/network changes
        document.addEventListener('walletConnected', () => {
            this.close();
        });

        document.addEventListener('walletDisconnected', () => {
            this.close();
        });

        // Listen for MetaMask account changes
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                this.close();
            });

            // Listen for network changes
            window.ethereum.on('chainChanged', (chainId) => {
                this.close();
            });
        }
    }

    applyDecimalLimit(value, maxDecimals) {
        if (typeof value !== 'string' || !value) {
            return value;
        }

        const decimalsAllowed = Number.isInteger(maxDecimals) && maxDecimals >= 0 ? maxDecimals : 18;
        let sanitized = value.replace(/^[+-]/, '').replace(/[^0-9.]/g, '');

        if (!sanitized) {
            return '';
        }

        const firstSeparator = sanitized.indexOf('.');

        if (firstSeparator === -1) {
            return sanitized;
        }

        const integerPart = sanitized.slice(0, firstSeparator) || '0';
        let decimalPart = sanitized.slice(firstSeparator + 1).replace(/\./g, '');

        if (decimalPart.length > decimalsAllowed) {
            decimalPart = decimalPart.slice(0, decimalsAllowed);
        }

        if (decimalsAllowed === 0) {
            return integerPart;
        }

        return decimalPart ? `${integerPart}.${decimalPart}` : `${integerPart}.`;
    }

    isMigrationMode() {
        return Boolean(window.CONFIG?.MIGRATION?.ENABLED);
    }

    getMigrationConfig() {
        return window.CONFIG?.MIGRATION || {};
    }

    defaultMigrationUnstakeToMax({ force = false } = {}) {
        if (!this.isMigrationMode()) return;
        if (this.currentTab !== 'unstake') return;
        if (!force && this.unstakeAmount) return;

        const stakedAmount = parseFloat(this.userStaked) || 0;
        if (stakedAmount <= 0) {
            if (force) {
                this.unstakeAmount = '';
            }
            return;
        }

        this.unstakeAmount = this.userStaked;
    }

    async open(pair, tab = 'stake') {
        if (this.isMigrationMode() && (tab === 'stake' || tab === 'zap')) {
            tab = 'unstake';
        }

        this.currentPair = pair;
        this.currentTab = tab;
        this.isOpen = true;

        // Reset approval state
        this.isApproved = false;
        this.needsApproval = false;
        this.currentAllowance = '0';

        // Reset form inputs
        this.stakeAmount = '';
        this.unstakeAmount = '';
        this.zapInputAmount = '';
        this.zapQuote = null;
        this.zapQuoteStatus = 'idle';
        this.zapQuoteError = '';
        this.zapQuoteRateLimitMessage = '';
        this.zapQuoteKey = '';
        this.zapQuoteInFlightKey = '';
        this.zapInputTokenBalances = new Map();
        this.zapCustomTokenAddress = '';
        this.zapCustomTokenError = '';
        this.zapCustomSlippage = '';
        this.zapCustomSlippageError = '';
        this.zapQuoteRequestId += 1;
        this.stopZapQuoteAutoRefresh();

        // Reset transaction progress state
        this.resetActionStates(false);

        // Reset execution guards
        this.isExecutingStake = false;
        this.isExecutingUnstake = false;
        this.isExecutingClaim = false;
        this.isExecutingZap = false;

        // Update pair info
        this.updatePairInfo();

        // Render requested tab immediately with any previously cached data
        this.switchTab(tab);

        // Show modal
        const modal = document.getElementById('staking-modal-new');
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('open'), 10);
        }

        // Load user balances if contract manager is ready
        await this.loadUserBalances();
        await this.loadZapTokens();
        this.defaultMigrationUnstakeToMax({ force: tab === 'unstake' });

        // Re-render the tab to reflect fresh data
        this.switchTab(tab);
        this.syncZapQuoteAutoRefresh();

        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }

    /**
     * Show modal with numeric tab index (React-style)
     * Matches React: show(pair, initialTab)
     * @param {Object} pair - Pair data
     * @param {number} initialTab - Tab index (0=stake, 1=unstake, 2=claim)
     */
    async show(pair, initialTab = 0) {
        // Convert numeric tab index to string tab name
        const tabNames = ['stake', 'unstake', 'claim', 'zap'];
        let tabName = tabNames[initialTab] || 'stake';
        if (this.isMigrationMode() && (tabName === 'stake' || tabName === 'zap')) {
            tabName = 'unstake';
        }

        console.log(`🎯 Opening modal for ${pair.name}, tab: ${tabName} (index: ${initialTab})`);

        // Call the existing open method
        await this.open(pair, tabName);
    }

    /**
     * Format token amount with ethers v5/v6 compatibility
     * @param {string|BigNumber} amount - Token amount in wei
     * @param {number} decimals - Token decimals
     * @returns {string} Formatted amount
     */
    formatTokenAmount(amount, decimals) {
        try {
            // Handle null, undefined, or empty values
            if (!amount || amount === '0' || amount === 0) {
                return '0.00';
            }

            const ethers = window.ethers;

            // If amount is already a formatted string (from formatEther/formatUnits), preserve it
            if (typeof amount === 'string' && amount.includes('.')) {
                // Check if it's a zero value that should be normalized
                const parsed = parseFloat(amount);
                if (parsed === 0) {
                    return '0.00';
                }
                return amount;
            }

            // Try ethers v6 API first (formatUnits is directly on ethers)
            if (ethers.formatUnits) {
                return ethers.formatUnits(amount, decimals);
            }

            // Try ethers v5 API (formatUnits is on ethers.utils)
            if (ethers.utils && ethers.utils.formatUnits) {
                return ethers.utils.formatUnits(amount, decimals);
            }

            // Manual formatting fallback
            const amountStr = amount.toString();
            const divisor = Math.pow(10, Number(decimals));
            const result = (Number(amountStr) / divisor).toFixed(6);
            return result;
        } catch (error) {
            console.error('❌ Error formatting token amount:', error);
            return '0.00';
        }
    }

    getLpUsdPrice() {
        const tvlUsdValue = this.currentPair?.tvlUsd;
        const tvlValue = this.currentPair?.tvl;

        if (tvlUsdValue === undefined || tvlUsdValue === null || tvlUsdValue === '') {
            return null;
        }

        if (tvlValue === undefined || tvlValue === null || tvlValue === '') {
            return null;
        }

        const tvlUsd = Number(tvlUsdValue);
        const tvl = Number(tvlValue);

        if (!Number.isFinite(tvlUsd) || tvlUsd < 0 || !Number.isFinite(tvl) || tvl <= 0) {
            return null;
        }

        return tvlUsd / tvl;
    }

    getLpUsdEstimate(amount) {
        if (amount === undefined || amount === null || amount === '') {
            return null;
        }

        const lpUsdPrice = this.getLpUsdPrice();
        const lpAmount = Number(amount);

        if (lpUsdPrice === null || !Number.isFinite(lpAmount) || lpAmount < 0) {
            return null;
        }

        return lpAmount * lpUsdPrice;
    }

    formatLpUsdEstimate(amount) {
        const estimate = this.getLpUsdEstimate(amount);

        if (estimate === null) {
            return '';
        }

        return window.Formatter?.formatCurrency?.(estimate) || `$${estimate.toFixed(2)}`;
    }

    renderInlineLpUsdEstimate(amount) {
        const estimate = this.formatLpUsdEstimate(amount);
        return estimate ? ` <span class="lp-usd-estimate">(${this.escapeHtml(estimate)})</span>` : '';
    }

    renderLpUsdEstimateElement(id, amount) {
        const estimate = this.formatLpUsdEstimate(amount);
        const hiddenAttribute = estimate ? '' : ' hidden';
        return `<div id="${id}" class="lp-usd-estimate" aria-live="polite"${hiddenAttribute}>${this.escapeHtml(estimate)}</div>`;
    }

    getZapLpAmountForUsdEstimate(amount) {
        if (amount === undefined || amount === null || amount === '' || amount === 'N/A') {
            return null;
        }

        const amountText = String(amount);

        try {
            if (/^\d+$/.test(amountText) && window.ethers) {
                return this.formatTokenAmount(amountText, this.userBalanceDecimals);
            }
        } catch (error) {
            return amountText;
        }

        return amountText;
    }

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    isNativeZapToken(address) {
        return this.getKyberZapService().isNativeToken(address);
    }

    getKyberZapService() {
        if (!this.kyberZapService && window.KyberZapService) {
            this.kyberZapService = new window.KyberZapService();
        }

        if (!this.kyberZapService) {
            throw new Error('Kyber zap service is not available.');
        }

        return this.kyberZapService;
    }

    getCurrentNetworkKey() {
        return this.getKyberZapService().getCurrentNetworkKey();
    }

    getKyberZapNetworkConfig() {
        return this.getKyberZapService().getNetworkConfig();
    }

    async getTokenMetadata(address) {
        return this.getKyberZapService().getTokenMetadata(address);
    }

    async getTokenMarketMetadata(address) {
        return this.getKyberZapService().getTokenMarketMetadata(address);
    }

    async getPairTokenMetadata() {
        const lpTokenAddress = this.currentPair?.lpToken || this.currentPair?.address;
        return this.getKyberZapService().getPairTokenMetadata(lpTokenAddress);
    }

    resetZapQuoteState({ status = 'idle', error = '' } = {}) {
        this.zapQuote = null;
        this.zapQuoteStatus = status;
        this.zapQuoteError = error;
        this.zapQuoteKey = '';
        this.zapQuoteInFlightKey = '';
        this.zapQuoteRequestId += 1;

        this.resetZapQuoteCountdown();
    }

    sortZapInputTokens(tokens) {
        return [...tokens].sort((a, b) => {
            return String(a?.symbol || '').localeCompare(String(b?.symbol || ''), undefined, {
                sensitivity: 'base'
            });
        });
    }

    async loadZapTokens() {
        const networkConfig = this.getKyberZapNetworkConfig();
        if (!networkConfig) {
            this.zapInputTokens = [];
            this.zapSelectedToken = null;
            return;
        }

        const pairTokens = await this.getPairTokenMetadata();
        const pairTokensBySymbol = new Map(pairTokens.map(token => [token.symbol.toUpperCase(), token]));
        const pairTokensByAddress = new Map(pairTokens.map(token => [token.address.toLowerCase(), token]));
        const configuredTokens = networkConfig.INPUT_TOKENS || [];

        const resolvedTokens = configuredTokens.map(token => {
            if (token.address === 'native') {
                const nativeCurrency = window.networkSelector?.getCurrentNetworkConfig?.()?.NATIVE_CURRENCY
                    || window.CONFIG?.NETWORKS?.[this.getCurrentNetworkKey()]?.NATIVE_CURRENCY
                    || { symbol: token.symbol || 'BNB', name: token.name || 'Native Token', decimals: 18 };
                return {
                    ...token,
                    address: 'native',
                    symbol: nativeCurrency.symbol || token.symbol || 'BNB',
                    name: nativeCurrency.name || token.name || 'Native Token',
                    decimals: nativeCurrency.decimals || token.decimals || 18
                };
            }

            if (token.address === 'pool-token') {
                const pairToken = pairTokensBySymbol.get((token.symbol || '').toUpperCase());
                return pairToken || null;
            }

            const pairToken = pairTokensByAddress.get(String(token.address).toLowerCase());
            return pairToken ? { ...token, ...pairToken } : token;
        }).filter(Boolean);

        for (const token of pairTokens) {
            if (!resolvedTokens.some(existing => String(existing.address).toLowerCase() === token.address.toLowerCase())) {
                resolvedTokens.push(token);
            }
        }

        this.zapInputTokens = this.sortZapInputTokens(resolvedTokens);
        if (!this.zapInputTokens.some(token => token.address === this.zapInputTokenAddress)) {
            this.zapInputTokenAddress = this.zapInputTokens[0]?.address || 'native';
        }
        this.zapSelectedToken = this.zapInputTokens.find(token => token.address === this.zapInputTokenAddress) || this.zapInputTokens[0] || null;

        await this.loadZapTokenBalances();
    }

    async loadZapTokenBalances() {
        this.zapInputTokenBalances = new Map();

        if (!window.walletManager?.address || !window.ethers) {
            return;
        }

        const userAddress = window.walletManager.address;
        const provider = window.contractManager?.provider || window.walletManager?.provider;
        if (!provider) return;

        const erc20Abi = ['function balanceOf(address owner) view returns (uint256)'];
        await Promise.all(this.zapInputTokens.map(async token => {
            try {
                let rawBalance;
                if (this.isNativeZapToken(token.address)) {
                    rawBalance = await provider.getBalance(userAddress);
                } else {
                    const contract = new window.ethers.Contract(token.address, erc20Abi, provider);
                    rawBalance = await contract.balanceOf(userAddress);
                }

                this.zapInputTokenBalances.set(token.address, {
                    raw: window.ethers.BigNumber.from(rawBalance),
                    formatted: this.formatTokenAmount(rawBalance, token.decimals ?? 18)
                });
            } catch (error) {
                console.warn('Unable to load zap input token balance:', token.symbol, error.message);
                this.zapInputTokenBalances.set(token.address, {
                    raw: window.ethers.BigNumber.from(0),
                    formatted: '0.00'
                });
            }
        }));
    }

    setZapInputToken(address) {
        if (address === 'custom') {
            this.zapInputTokenAddress = 'custom';
            this.zapSelectedToken = null;
            this.zapInputAmount = '';
            this.resetZapQuoteState();
            this.zapCustomTokenError = '';
            this.stopZapQuoteAutoRefresh();
            this.renderTabContent();
            return;
        }

        this.zapInputTokenAddress = address;
        this.zapSelectedToken = this.zapInputTokens.find(token => token.address === address) || null;
        this.zapInputAmount = '';
        this.resetZapQuoteState();
        this.stopZapQuoteAutoRefresh();
        this.renderTabContent();
    }

    async addZapCustomToken() {
        if (!window.ethers?.utils?.isAddress?.(this.zapCustomTokenAddress)) {
            this.zapCustomTokenError = 'Enter a valid token address.';
            this.renderTabContent();
            return;
        }

        try {
            this.zapCustomTokenError = '';
            const address = window.ethers.utils.getAddress(this.zapCustomTokenAddress);
            const metadata = await this.getTokenMetadata(address);
            const token = {
                address,
                symbol: metadata?.symbol || 'TOKEN',
                name: metadata?.name || 'Token',
                decimals: metadata?.decimals ?? 18,
                iconUrl: '',
                custom: true
            };

            const existingIndex = this.zapInputTokens.findIndex(existing =>
                String(existing.address).toLowerCase() === address.toLowerCase()
            );

            if (existingIndex >= 0) {
                this.zapInputTokens[existingIndex] = { ...this.zapInputTokens[existingIndex], ...token };
            } else {
                this.zapInputTokens.push(token);
            }
            this.zapInputTokens = this.sortZapInputTokens(this.zapInputTokens);

            this.zapInputTokenAddress = token.address;
            this.zapSelectedToken = token;
            this.zapInputAmount = '';
            this.resetZapQuoteState();
            await this.loadZapTokenBalances();
            this.renderTabContent();
            this.loadZapCustomTokenIcon(address).catch(error => {
                console.warn('Unable to load custom zap token icon:', error.message);
            });
        } catch (error) {
            console.error('Failed to add custom zap token:', error);
            this.zapCustomTokenError = 'Unable to load token details.';
            this.renderTabContent();
        }
    }

    async loadZapCustomTokenIcon(address) {
        const tokenIndex = this.zapInputTokens.findIndex(existing =>
            String(existing.address).toLowerCase() === String(address).toLowerCase()
        );
        if (tokenIndex < 0) {
            return false;
        }

        const marketMetadata = await this.getTokenMarketMetadata(address);
        const imageUrl = this.getSafeZapTokenIconUrl(marketMetadata?.imageUrl);
        if (!imageUrl) {
            return false;
        }

        this.zapInputTokens[tokenIndex] = {
            ...this.zapInputTokens[tokenIndex],
            iconUrl: imageUrl
        };

        if (String(this.zapInputTokenAddress).toLowerCase() === String(address).toLowerCase()) {
            this.zapSelectedToken = this.zapInputTokens[tokenIndex];
        }

        this.renderTabContent();
        return true;
    }

    setZapSlippage(value) {
        if (value === 'custom') {
            const customInput = document.getElementById('zap-custom-slippage-input');
            if (customInput) customInput.focus();
        } else {
            const parsed = parseInt(value, 10);
            if (Number.isFinite(parsed) && parsed > 0) {
                this.zapSlippageBps = parsed;
                this.zapCustomSlippage = '';
                this.zapCustomSlippageError = '';
                this.resetZapQuoteState();
                this.renderTabContent();
                this.debounceZapQuote();
            }
        }
    }

    getZapCustomSlippageError(value = this.zapCustomSlippage) {
        if (!value) {
            return '';
        }

        const numericValue = Number(value);
        if (!Number.isFinite(numericValue) || numericValue <= 0 || numericValue > 100) {
            return 'Enter a custom slippage between 0.01% and 100%.';
        }

        return '';
    }

    hasInvalidZapCustomSlippage() {
        return !!this.getZapCustomSlippageError();
    }

    isZapCustomSlippageActive() {
        return !!this.zapCustomSlippage && !this.hasInvalidZapCustomSlippage();
    }

    setZapCustomSlippageInput(value) {
        const sanitizedValue = this.applyDecimalLimit(String(value ?? ''), 2);
        this.zapCustomSlippage = sanitizedValue;
        this.zapCustomSlippageError = this.getZapCustomSlippageError(sanitizedValue);

        if (this.zapCustomSlippageError) {
            this.resetZapQuoteState({
                status: 'error',
                error: this.zapCustomSlippageError
            });
            this.stopZapQuoteAutoRefresh();
            this.updateZapQuotePanel();
            this.updateZapButton();
            return sanitizedValue;
        }

        this.zapQuoteError = '';
        if (!sanitizedValue) {
            if (this.zapQuoteStatus === 'error' && !this.zapQuote) {
                this.zapQuoteStatus = 'idle';
            }
            this.updateZapQuotePanel();
            this.debounceZapQuote();
            this.updateZapButton();
            return sanitizedValue;
        }

        const customValue = Number(sanitizedValue);
        this.zapSlippageBps = Math.round(customValue * 100);
        this.resetZapQuoteState();
        this.updateZapQuotePanel();
        this.debounceZapQuote();
        this.updateZapButton();
        return sanitizedValue;
    }

    setZapAmountPercentage(percentage) {
        if (!this.zapSelectedToken || !Number.isFinite(percentage) || percentage <= 0) {
            return;
        }

        const balance = this.zapInputTokenBalances.get(this.zapSelectedToken.address);
        if (!balance?.raw) {
            return;
        }

        const decimals = this.zapSelectedToken.decimals ?? 18;
        const amountRaw = percentage >= 100
            ? balance.raw
            : balance.raw.mul(percentage).div(100);
        const amount = this.applyDecimalLimit(this.formatTokenAmount(amountRaw, decimals), decimals);

        this.zapInputAmount = amount;
        this.resetZapQuoteState();

        const input = document.getElementById('zap-amount-input');
        if (input) input.value = amount;

        document.querySelectorAll('.zap-percentage-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.percentage, 10) === percentage);
        });

        this.updateZapBalanceError();
        this.updateZapButton();
        this.updateZapQuotePanel();
        this.syncZapQuoteAutoRefresh();
        this.debounceZapQuote();
    }

    debounceZapQuote(delay = 600) {
        if (this.zapQuoteDebounceTimer) {
            clearTimeout(this.zapQuoteDebounceTimer);
        }

        if (!this.canFetchZapQuote()) {
            this.stopZapQuoteAutoRefresh();
            return;
        }

        this.syncZapQuoteAutoRefresh();
        this.zapQuoteDebounceTimer = setTimeout(() => {
            this.fetchZapQuote();
        }, delay);
    }

    canFetchZapQuote() {
        return !!this.zapSelectedToken
            && !!this.zapInputAmount
            && parseFloat(this.zapInputAmount) > 0
            && !this.hasInvalidZapCustomSlippage();
    }

    getZapQuoteRequestKey() {
        const lpTokenAddress = this.currentPair?.lpToken || this.currentPair?.address || '';
        const tokenAddress = this.zapSelectedToken?.address || '';
        let amountRaw = this.zapInputAmount || '';

        try {
            amountRaw = this.getZapAmountRaw()?.toString() || amountRaw;
        } catch (error) {
            // Keep the raw input value in the key if parsing fails; fetch validation will surface the error.
        }

        return this.getKyberZapService().getQuoteRequestKey({
            networkKey: this.getCurrentNetworkKey(),
            walletAddress: window.walletManager?.address || '',
            lpTokenAddress,
            tokenAddress,
            amountRaw,
            slippageBps: this.zapSlippageBps
        });
    }

    getZapQuoteRateLimitWaitMs(now = Date.now()) {
        return this.getKyberZapService().getQuoteRateLimitWaitMs(now);
    }

    scheduleZapQuoteRateLimitRefresh(waitMs = this.getZapQuoteRateLimitWaitMs()) {
        this.clearZapQuoteRateLimitTimer();

        if (waitMs <= 0) {
            return;
        }

        this.zapQuoteRateLimitTimer = setTimeout(() => {
            this.zapQuoteRateLimitTimer = null;
            this.zapQuoteRateLimitMessage = '';
            this.updateZapQuotePanel();
            this.syncZapQuoteAutoRefresh();
        }, waitMs + 50);
    }

    clearZapQuoteRateLimitTimer() {
        if (this.zapQuoteRateLimitTimer) {
            clearTimeout(this.zapQuoteRateLimitTimer);
            this.zapQuoteRateLimitTimer = null;
        }
    }

    getZapInputBalance() {
        return this.zapInputTokenBalances.get(this.zapSelectedToken?.address) || null;
    }

    hasSufficientZapBalance() {
        if (!this.zapSelectedToken || !this.zapInputAmount || parseFloat(this.zapInputAmount) <= 0) {
            return true;
        }

        const balance = this.getZapInputBalance();
        if (!balance?.raw) {
            return true;
        }

        try {
            return balance.raw.gte(this.getZapAmountRaw());
        } catch (error) {
            return false;
        }
    }

    getZapBalanceError() {
        if (this.hasSufficientZapBalance()) {
            return '';
        }

        return `Insufficient ${this.zapSelectedToken?.symbol || 'token'} balance.`;
    }

    updateZapBalanceError() {
        const errorElement = document.getElementById('zap-balance-error');
        if (!errorElement) {
            return;
        }

        const message = this.getZapBalanceError();
        errorElement.textContent = message;
        errorElement.hidden = !message;
    }

    resetZapQuoteCountdown(seconds = this.zapQuoteRefreshSeconds) {
        this.zapQuoteCountdown = seconds;
        this.updateZapQuoteCountdownDisplay();
    }

    updateZapQuoteCountdownDisplay() {
        const countdown = document.getElementById('zap-quote-countdown');
        if (countdown) {
            const rateLimitWaitMs = this.getZapQuoteRateLimitWaitMs();
            countdown.textContent = rateLimitWaitMs > 0
                ? `${Math.ceil(rateLimitWaitMs / 1000)}s`
                : this.canFetchZapQuote() ? `${this.zapQuoteCountdown}s` : '--';
        }
    }

    syncZapQuoteAutoRefresh() {
        const rateLimitWaitMs = this.getZapQuoteRateLimitWaitMs();
        if (rateLimitWaitMs > 0) {
            this.stopZapQuoteAutoRefresh();
            this.scheduleZapQuoteRateLimitRefresh(rateLimitWaitMs);
            return;
        }

        if (this.isOpen && this.currentTab === 'zap' && this.canFetchZapQuote()) {
            this.startZapQuoteAutoRefresh();
        } else {
            this.stopZapQuoteAutoRefresh();
        }
    }

    startZapQuoteAutoRefresh() {
        if (this.zapQuoteRefreshTimer) {
            this.updateZapQuoteCountdownDisplay();
            return;
        }

        this.resetZapQuoteCountdown();
        this.zapQuoteRefreshTimer = setInterval(() => {
            if (!this.isOpen || this.currentTab !== 'zap' || this.isExecutingZap || !this.canFetchZapQuote()) {
                this.stopZapQuoteAutoRefresh();
                return;
            }

            if (this.zapQuoteStatus === 'loading') {
                this.updateZapQuoteCountdownDisplay();
                return;
            }

            const rateLimitWaitMs = this.getZapQuoteRateLimitWaitMs();
            if (rateLimitWaitMs > 0) {
                this.stopZapQuoteAutoRefresh();
                this.scheduleZapQuoteRateLimitRefresh(rateLimitWaitMs);
                this.updateZapQuotePanel();
                return;
            }

            this.zapQuoteCountdown = Math.max(0, this.zapQuoteCountdown - 1);
            this.updateZapQuoteCountdownDisplay();

            if (this.zapQuoteCountdown === 0) {
                this.resetZapQuoteCountdown();
                this.fetchZapQuote({ force: true, silentRateLimit: true });
            }
        }, 1000);
    }

    stopZapQuoteAutoRefresh() {
        if (this.zapQuoteRefreshTimer) {
            clearInterval(this.zapQuoteRefreshTimer);
            this.zapQuoteRefreshTimer = null;
        }

        this.resetZapQuoteCountdown();
    }

    getZapAmountRaw() {
        if (!this.zapSelectedToken || !this.zapInputAmount) return null;
        return window.ethers.utils.parseUnits(this.zapInputAmount.toString(), this.zapSelectedToken.decimals ?? 18);
    }

    getZapRouteData() {
        return this.getKyberZapService().getRouteData(this.zapQuote);
    }

    getZapRouteEncoded() {
        return this.getKyberZapService().getRouteEncoded(this.zapQuote);
    }

    getZapRouterAddress(source = null) {
        return this.getKyberZapService().getRouterAddress(source || this.getZapRouteData());
    }

    validateZapRouterAddress(routerAddress) {
        this.getKyberZapService().validateRouterAddress(routerAddress, this.getKyberZapNetworkConfig());
    }

    getZapQuoteSummaryValue(paths, fallback = 'N/A') {
        return this.getZapQuoteSummaryEntry(paths, fallback).value;
    }

    getZapQuoteSummaryEntry(paths, fallback = 'N/A') {
        const data = this.getZapRouteData();
        for (const path of paths) {
            const value = path.split('.').reduce((current, key) => current?.[key], data);
            if (value !== undefined && value !== null && value !== '') {
                return { value, path };
            }
        }
        return { value: fallback, path: null };
    }

    getZapHighSlippageBps() {
        return window.CONFIG?.KYBER_ZAP?.HIGH_SLIPPAGE_BPS || 300;
    }

    getZapHighPriceImpactPercent() {
        return window.CONFIG?.KYBER_ZAP?.HIGH_PRICE_IMPACT_PERCENT || 5;
    }

    getZapPercentNumber(value, path = '') {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
            return null;
        }

        return String(path).toLowerCase().includes('pcm')
            ? numericValue / 1000
            : numericValue;
    }

    isHighZapSlippage(slippageBps) {
        const numericValue = Number(slippageBps);
        return Number.isFinite(numericValue) && numericValue >= this.getZapHighSlippageBps();
    }

    isHighZapPriceImpact(value, path = '') {
        const percentValue = this.getZapPercentNumber(value, path);
        return percentValue !== null && Math.abs(percentValue) >= this.getZapHighPriceImpactPercent();
    }

    formatZapDisplayAmount(value, decimals = 18, symbol = '') {
        if (value === undefined || value === null || value === 'N/A') {
            return 'N/A';
        }

        const valueText = String(value);
        let formatted = valueText;

        try {
            if (/^\d+$/.test(valueText) && window.ethers) {
                formatted = this.formatTokenAmount(valueText, decimals);
            }
        } catch (error) {
            formatted = valueText;
        }

        const numericValue = Number(formatted);
        if (Number.isFinite(numericValue)) {
            formatted = numericValue === 0
                ? '0'
                : numericValue < 0.000001
                    ? '<0.000001'
                    : numericValue.toLocaleString(undefined, { maximumFractionDigits: 6 });
        }

        return symbol ? `${formatted} ${symbol}` : formatted;
    }

    isZeroZapAmount(value) {
        if (value === undefined || value === null || value === '' || value === 'N/A') {
            return true;
        }

        try {
            const valueText = String(value);
            if (/^\d+$/.test(valueText) && window.ethers?.BigNumber) {
                if (/^0+$/.test(valueText)) {
                    return true;
                }

                return window.ethers.BigNumber.from(valueText).isZero();
            }

            const numericValue = Number(valueText);
            return Number.isFinite(numericValue) && numericValue === 0;
        } catch (error) {
            return false;
        }
    }

    formatZapFeeDisplay(value, decimals = 18, symbol = '') {
        if (this.isZeroZapAmount(value)) {
            return 'None';
        }

        return this.formatZapDisplayAmount(value, decimals, symbol);
    }

    getZapTokenByAddress(address) {
        if (!address) {
            return null;
        }

        const service = this.getKyberZapService();
        const normalizedAddress = service.normalizeAddress(address);
        return this.zapInputTokens.find(token => {
            if (this.isNativeZapToken(address) && this.isNativeZapToken(token.address)) {
                return true;
            }

            return service.normalizeAddress(token.address) === normalizedAddress;
        }) || null;
    }

    getZapProtocolFeeDetails(data = this.getZapRouteData()) {
        const protocolFeeSources = [];
        const addProtocolFeeSource = (source) => {
            if (source && typeof source === 'object') {
                protocolFeeSources.push(source);
            }
        };

        addProtocolFeeSource(data?.zapDetails?.protocolFee);
        addProtocolFeeSource(data?.protocolFee);

        if (Array.isArray(data?.zapDetails?.actions)) {
            data.zapDetails.actions.forEach(action => {
                addProtocolFeeSource(action?.protocolFee);
            });
        }

        for (const source of protocolFeeSources) {
            const tokenFee = Array.isArray(source?.tokens)
                ? (source.tokens.find(token => !this.isZeroZapAmount(token?.amount)) || source.tokens[0])
                : null;
            const amount = tokenFee?.amount ?? source?.amount ?? null;

            if (amount !== null && amount !== undefined) {
                const knownToken = this.getZapTokenByAddress(tokenFee?.address);
                return {
                    amount,
                    symbol: tokenFee?.symbol || knownToken?.symbol || this.zapSelectedToken?.symbol || '',
                    decimals: Number(tokenFee?.decimals ?? knownToken?.decimals ?? this.zapSelectedToken?.decimals ?? 18) || 18
                };
            }
        }

        const fallbackAmount = this.getZapQuoteSummaryValue(['zapDetails.feeAmount', 'fee'], null);
        if (fallbackAmount !== null && fallbackAmount !== undefined) {
            return {
                amount: fallbackAmount,
                symbol: this.zapSelectedToken?.symbol || '',
                decimals: this.zapSelectedToken?.decimals ?? 18
            };
        }

        if (data?.protocolFee !== null && data?.protocolFee !== undefined && typeof data.protocolFee !== 'object') {
            return {
                amount: data.protocolFee,
                symbol: this.zapSelectedToken?.symbol || '',
                decimals: this.zapSelectedToken?.decimals ?? 18
            };
        }

        return null;
    }

    formatZapBalanceDisplay(balance, token) {
        if (!balance || !token) {
            return '';
        }

        const value = balance.formatted || '0';
        const numericValue = Number(value);
        let formatted = value;

        if (Number.isFinite(numericValue)) {
            if (numericValue === 0) {
                formatted = '0';
            } else if (numericValue >= 1000000) {
                formatted = numericValue.toLocaleString(undefined, {
                    notation: 'compact',
                    maximumFractionDigits: 2
                });
            } else if (numericValue >= 1000) {
                formatted = numericValue.toLocaleString(undefined, {
                    maximumFractionDigits: 2
                });
            } else if (numericValue >= 1) {
                formatted = numericValue.toLocaleString(undefined, {
                    maximumFractionDigits: 6
                });
            } else if (numericValue >= 0.00000001) {
                formatted = numericValue.toLocaleString(undefined, {
                    maximumFractionDigits: 10
                });
            } else {
                formatted = '<0.00000001';
            }
        }

        return `${formatted} ${token.symbol}`;
    }

    getZapTokenLabelParts(token) {
        if (!token) {
            return { symbol: '', shortAddress: '', fullLabel: '' };
        }

        const address = token.address;
        const symbol = token.symbol || 'Token';
        if (!address || this.isNativeZapToken(address)) {
            return { symbol, shortAddress: '', fullLabel: symbol };
        }

        const addressText = String(address);
        const shortAddress = addressText.length > 12
            ? `${addressText.slice(0, 6)}...${addressText.slice(-4)}`
            : addressText;

        return {
            symbol,
            shortAddress,
            fullLabel: `${symbol} ${shortAddress}`
        };
    }

    getZapTokenIconClass(token) {
        const symbol = String(token?.symbol || 'token').toLowerCase().replace(/[^a-z0-9_-]/g, '');
        return `zap-token-icon-${symbol || 'token'}`;
    }

    getZapTokenIconText(token) {
        return String(token?.symbol || '?').slice(0, 4).toUpperCase();
    }

    getZapTokenIconNetworkId() {
        const networkConfig = this.getKyberZapNetworkConfig();
        const networkId = networkConfig?.TOKEN_ICON_NETWORK || networkConfig?.CHAIN || 'bsc';
        return String(networkId).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    }

    getZapTokenIconAddress(token) {
        const address = token?.address;
        if (!address || address === 'custom' || address === 'pool-token') {
            return '';
        }

        const networkConfig = this.getKyberZapNetworkConfig();
        if (this.isNativeZapToken(address)) {
            return String(networkConfig?.WRAPPED_NATIVE_TOKEN_ADDRESS || '').toLowerCase();
        }

        const normalizedAddress = String(address).toLowerCase();
        return /^0x[a-f0-9]{40}$/.test(normalizedAddress) ? normalizedAddress : '';
    }

    getLocalZapTokenIconUrl(token) {
        if (token?.custom) {
            return '';
        }

        const networkId = this.getZapTokenIconNetworkId();
        const address = this.getZapTokenIconAddress(token);
        return networkId && address ? `assets/images/tokens/${networkId}/${address}.png` : '';
    }

    getSafeZapTokenIconUrl(url) {
        const value = String(url || '').trim();
        if (!value) {
            return '';
        }

        if (/^https:\/\//i.test(value)) {
            return value;
        }

        if (/^(?:\.\/)?assets\/images\/tokens\/[a-z0-9_-]+\/0x[a-f0-9]{40}\.png$/i.test(value)) {
            return value.replace(/^\.\//, '');
        }

        return '';
    }

    renderZapTokenIcon(token, options = {}) {
        const iconText = options.iconText || this.getZapTokenIconText(token);
        const iconClass = options.iconClass || this.getZapTokenIconClass(token);
        const imageUrl = this.getSafeZapTokenIconUrl(
            Object.prototype.hasOwnProperty.call(options, 'iconUrl') ? options.iconUrl : (token?.iconUrl || this.getLocalZapTokenIconUrl(token))
        );

        if (imageUrl) {
            return `
                <span class="zap-token-icon ${this.escapeHtml(iconClass)} zap-token-icon-has-image" aria-hidden="true">
                    <img
                        class="zap-token-icon-image"
                        src="${this.escapeHtml(imageUrl)}"
                        alt=""
                        loading="lazy"
                        referrerpolicy="no-referrer"
                        onerror="this.parentElement.classList.remove('zap-token-icon-has-image'); this.remove();"
                    >
                    <span class="zap-token-icon-fallback-text">${this.escapeHtml(iconText)}</span>
                </span>
            `;
        }

        return `<span class="zap-token-icon ${this.escapeHtml(iconClass)}" aria-hidden="true">${this.escapeHtml(iconText)}</span>`;
    }

    getZapTokenBalanceLabel(token) {
        if (!token) {
            return '';
        }

        if (token.address === 'custom') {
            return 'Add by address';
        }

        const balance = this.formatZapBalanceDisplay(this.zapInputTokenBalances.get(token.address), token);
        return balance || '--';
    }

    renderZapTokenPickerRow(token, selectedAddress, options = {}) {
        const address = token?.address || '';
        const isSelected = address === selectedAddress;
        const labelParts = this.getZapTokenLabelParts(token);
        const label = options.label || labelParts.fullLabel;
        const shortAddress = options.shortAddress ?? labelParts.shortAddress;
        const balanceLabel = options.balanceLabel || this.getZapTokenBalanceLabel(token);
        const iconText = options.iconText || this.getZapTokenIconText(token);
        const iconClass = options.iconClass || this.getZapTokenIconClass(token);
        const iconOptions = { iconText, iconClass };
        if (Object.prototype.hasOwnProperty.call(options, 'iconUrl')) {
            iconOptions.iconUrl = options.iconUrl;
        }
        const iconHtml = this.renderZapTokenIcon(token, iconOptions);

        return `
            <button
                type="button"
                class="zap-token-option ${isSelected ? 'active' : ''}"
                data-token-address="${this.escapeHtml(address)}"
                role="option"
                aria-selected="${isSelected ? 'true' : 'false'}"
            >
                ${iconHtml}
                <span class="zap-token-option-text">
                    <span class="zap-token-option-label">
                        ${options.label
                            ? this.escapeHtml(label)
                            : `<span>${this.escapeHtml(labelParts.symbol)}</span>${shortAddress ? ` <span class="zap-token-option-address">${this.escapeHtml(shortAddress)}</span>` : ''}`}
                    </span>
                    <span class="zap-token-option-balance">${this.escapeHtml(balanceLabel)}</span>
                </span>
                ${isSelected ? '<span class="material-icons zap-token-check" aria-hidden="true">check</span>' : ''}
            </button>
        `;
    }

    formatZapPercent(value) {
        if (typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, 'value')) {
            const percentValue = this.getZapPercentNumber(value.value, value.path);
            if (percentValue === null) {
                return String(value.value);
            }

            return `${percentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
        }

        if (value === undefined || value === null || value === 'N/A') {
            return 'N/A';
        }

        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
            return String(value);
        }

        return `${numericValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
    }

    getZapRouteSummary() {
        const inputSymbol = this.zapSelectedToken?.symbol || 'Input';
        const pairName = this.currentPair?.name || 'LP';
        const data = this.getZapRouteData();
        const tokens = data?.zapDetails?.swaps?.map(swap => swap?.tokenOutSymbol || swap?.tokenOut?.symbol).filter(Boolean);
        const middle = tokens?.length ? `${tokens.join(' -> ')} -> ` : '';
        return `${inputSymbol} -> ${middle}${pairName} LP`;
    }

    async fetchZapQuote({ force = false, silentRateLimit = false } = {}) {
        if (!this.canFetchZapQuote()) {
            this.stopZapQuoteAutoRefresh();
            this.updateZapBalanceError();
            this.updateZapQuotePanel();
            this.updateZapButton();
            return;
        }

        const quoteKey = this.getZapQuoteRequestKey();
        if (this.zapQuoteStatus === 'loading' && this.zapQuoteInFlightKey === quoteKey) {
            return;
        }

        if (!force && this.zapQuoteStatus === 'ready' && this.zapQuote && this.zapQuoteKey === quoteKey) {
            this.updateZapQuotePanel();
            this.updateZapButton();
            return;
        }

        if (this.zapQuoteDebounceTimer) {
            clearTimeout(this.zapQuoteDebounceTimer);
            this.zapQuoteDebounceTimer = null;
        }

        this.resetZapQuoteCountdown();

        const networkConfig = this.getKyberZapNetworkConfig();
        if (!networkConfig) {
            this.zapQuoteStatus = 'error';
            this.zapQuoteError = 'Zap is not available on this network.';
            this.updateZapQuotePanel();
            this.updateZapButton();
            return;
        }

        if (!window.walletManager?.address) {
            this.zapQuoteStatus = 'error';
            this.zapQuoteError = 'Connect your wallet to create LP tokens.';
            this.updateZapQuotePanel();
            this.updateZapButton();
            return;
        }

        const requestId = ++this.zapQuoteRequestId;
        const previousQuote = this.zapQuote;

        try {
            const lpTokenAddress = this.currentPair?.lpToken || this.currentPair?.address;
            const amountRaw = this.getZapAmountRaw();
            const tokenAddress = this.isNativeZapToken(this.zapSelectedToken.address)
                ? window.CONFIG.KYBER_ZAP.NATIVE_TOKEN_ADDRESS
                : this.zapSelectedToken.address;
            const initialRateLimitWaitMs = this.getZapQuoteRateLimitWaitMs();
            if (initialRateLimitWaitMs > 0) {
                throw this.getKyberZapService().createRateLimitError(initialRateLimitWaitMs);
            }

            this.zapQuoteStatus = 'loading';
            this.zapQuoteError = '';
            this.zapQuoteRateLimitMessage = '';
            this.zapQuoteInFlightKey = quoteKey;
            this.updateZapQuotePanel();
            this.updateZapButton();

            const payload = await this.getKyberZapService().fetchQuote({
                networkConfig,
                lpTokenAddress,
                walletAddress: window.walletManager.address,
                tokenAddress,
                amountRaw,
                slippageBps: this.zapSlippageBps,
                platform: this.currentPair?.platform
            });

            if (requestId !== this.zapQuoteRequestId) {
                return;
            }

            this.zapQuote = payload;
            this.zapQuoteStatus = 'ready';
            this.zapQuoteError = '';
            this.zapQuoteRateLimitMessage = '';
            this.zapQuoteKey = quoteKey;
        } catch (error) {
            if (requestId !== this.zapQuoteRequestId) {
                return;
            }

            if (error?.zapRateLimited) {
                this.scheduleZapQuoteRateLimitRefresh(error.waitMs);
                this.zapQuoteRateLimitMessage = silentRateLimit ? '' : error.message;
                this.zapQuote = previousQuote;
                this.zapQuoteStatus = previousQuote ? 'ready' : (silentRateLimit ? 'idle' : 'error');
                this.zapQuoteError = previousQuote || silentRateLimit ? '' : error.message;
            } else {
                console.error('Failed to fetch zap quote:', error);
                this.zapQuote = null;
                this.zapQuoteStatus = 'error';
                this.zapQuoteError = error.message || 'Unable to fetch a zap quote.';
                this.zapQuoteRateLimitMessage = '';
            }
        } finally {
            if (requestId === this.zapQuoteRequestId) {
                this.zapQuoteInFlightKey = '';
                this.updateZapQuotePanel();
                this.updateZapButton();
                this.syncZapQuoteAutoRefresh();
            }
        }
    }

    /**
     * Check if LP token approval is needed for staking
     * @returns {Promise<boolean>} True if approval is needed
     */
    async checkApprovalNeeded() {
        try {
            if (!window.contractManager || !window.walletManager || !this.currentPair) {
                console.log('⚠️ Missing dependencies for approval check');
                return true; // Assume approval needed
            }

            const lpTokenAddress = this.currentPair.lpToken || this.currentPair.address;
            const userAddress = window.walletManager.address;

            // Get staking contract address (try multiple config paths)
            const stakingAddress = window.networkSelector?.getStakingContractAddress();

            console.log(`🔍 Checking approval for:`, {
                lpToken: lpTokenAddress,
                stakingContract: stakingAddress,
                userAddress: userAddress,
                amount: this.stakeAmount
            });

            // Create LP token contract instance
            const lpTokenABI = [
                'function allowance(address owner, address spender) view returns (uint256)',
                'function approve(address spender, uint256 amount) returns (bool)',
                'function balanceOf(address owner) view returns (uint256)'
            ];

            const provider = window.contractManager.provider || window.walletManager.provider;
            const lpTokenContract = new window.ethers.Contract(lpTokenAddress, lpTokenABI, provider);

            // Get current allowance
            console.log('📞 Calling allowance()...');
            const allowance = await lpTokenContract.allowance(userAddress, stakingAddress);
            console.log(`✅ Allowance retrieved: ${allowance.toString()}`);

            this.currentAllowance = this.formatTokenAmount(allowance, 18);

            // Check if we need approval
            const amountWei = window.ethers.utils.parseEther(this.stakeAmount.toString());
            const needsApproval = allowance.lt(amountWei);

            console.log(`🔍 Approval check result:`, {
                allowanceRaw: allowance.toString(),
                allowanceFormatted: this.currentAllowance,
                requiredAmountWei: amountWei.toString(),
                requiredAmountFormatted: this.stakeAmount,
                needsApproval: needsApproval,
                comparison: `${allowance.toString()} < ${amountWei.toString()} = ${needsApproval}`
            });

            return needsApproval;

        } catch (error) {
            console.error('❌ Failed to check approval:', error);
            console.error('❌ Error details:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
            return true; // Assume approval needed on error
        }
    }

    /**
     * Extract pair name from currentPair for contract manager
     * @returns {string} Pair name for contract manager
     */
    getPairName() {
        if (!this.currentPair) throw new Error('No current pair available');

        const originalAddress = this.currentPair.lpToken || this.currentPair.address;
        if (!originalAddress || typeof originalAddress !== 'string') {
            throw new Error('No LP token address available');
        }
        const normalizedAddress = originalAddress.toLowerCase();
        const manager = window.contractManager;

        if (manager && manager.contractAddresses instanceof Map) {
            for (const [key, value] of manager.contractAddresses.entries()) {
                if (!key.startsWith('LP_')) continue;
                if (typeof value === 'string' && value.toLowerCase() === normalizedAddress) {
                    return key.replace('LP_', '');
                }
            }
        }

        return (this.currentPair.platform !== 'Unknown' ? this.currentPair.platform : 
         `${originalAddress.slice(0, 6)}...${originalAddress.slice(-4)}`);
    }

    /**
     * Approve LP tokens for staking using contract manager
     * 
     * This method delegates to the contract manager's approveLPToken method,
     * which provides centralized error handling, retry logic, and notifications.
     * The contract manager handles all error notifications through its error handler,
     * so no custom error handling is needed in this method.
     * 
     * @returns {Promise<boolean>} True if approval succeeded
     * @throws {Error} When contract manager or wallet not ready
     */
    async approveTokens() {
        try {
            if (!window.contractManager || !window.walletManager || !this.currentPair) {
                throw new Error('Contract manager or wallet not ready');
            }

            this.pendingOperations.approve = true;
            this.setActionPhase('approve', 'userApproval');

            const pairName = this.getPairName();
            console.log(`🔐 Approving LP tokens:`, { pairName, amount: this.stakeAmount });


            // Execute approval and wait for confirmation
            const approveTx = await window.contractManager.approveLPToken(pairName, this.stakeAmount);
            console.log(`✅ Approval transaction sent: ${approveTx.hash}`);

            if (this.actionPhases.approve === 'userApproval') {
                this.setActionPhase('approve', 'processing');
            }

            if (!approveTx.success) {
                throw approveTx.error;
            }

            // Update state and UI
            this.isApproved = true;
            this.needsApproval = false;

            return true;

        } catch (error) {
            console.error('❌ Approval failed:', error);
            const errorMessage = error?.userMessage?.message || error?.message || 'Token approval failed. Please try again.';
            window.notificationManager?.error(errorMessage, {title: error?.userMessage?.title});
            this.isApproved = false;
            return false;
        } finally {
            this.pendingOperations.approve = false;
            this.setActionPhase('approve', 'idle');
        }
    }

    /**
     * Update stake button text and state based on approval status
     */
    updateStakeButton() {
        const stakeButton = document.querySelector('.modal-actions .btn-primary[onclick*="safeModalExecuteStake"]');
        if (!stakeButton) return;

        const buttonIcon = stakeButton.querySelector('.material-icons');
        const buttonText = stakeButton.childNodes[stakeButton.childNodes.length - 1];

        const amount = parseFloat(this.stakeAmount) || 0;
        const weight = parseFloat(this.currentPair?.weight || '0') || 0;
        const hasAmount = amount > 0;
        const hasValidWeight = weight > 0;
        const balanceRaw = this.userBalanceRaw || window.ethers.BigNumber.from(0);
        const stakeUnits = window.ethers.utils.parseUnits(this.stakeAmount || '0', this.userBalanceDecimals);
        const hasSufficientBalance = balanceRaw.gte(stakeUnits);
        const approvalPhase = this.actionPhases?.approve || 'idle';
        const stakePhase = this.actionPhases?.stake || 'idle';
        const activePhase = approvalPhase !== 'idle' ? approvalPhase : stakePhase;

        if (activePhase !== 'idle') {
            stakeButton.disabled = true;
            if (buttonIcon) buttonIcon.textContent = 'hourglass_empty';
            if (buttonText) {
                const phaseLabel = this.getPhaseLabel(activePhase) || ' Processing Transaction...';
                buttonText.textContent = phaseLabel;
            }
            return;
        }

        const shouldDisable = this.isExecutingStake || !hasAmount || !hasValidWeight || !hasSufficientBalance;
        stakeButton.disabled = shouldDisable;
        stakeButton.title = (!hasSufficientBalance && hasAmount)
            ? 'Insufficient LP token balance'
            : 'Stake LP Tokens';

        if (buttonIcon) buttonIcon.textContent = 'add';
        if (buttonText) buttonText.textContent = ' Stake LP Tokens';
    }

    /**
     * Update unstake button text and state during transaction flow
     */
    updateUnstakeButton() {
        const unstakeButton = document.querySelector('.modal-actions .btn-primary[onclick*="safeModalExecuteUnstake"]');
        if (!unstakeButton) return;

        const buttonIcon = unstakeButton.querySelector('.material-icons');
        const buttonText = unstakeButton.childNodes[unstakeButton.childNodes.length - 1];
        const amount = parseFloat(this.unstakeAmount) || 0;
        const hasAmount = amount > 0;
        const stakedRaw = this.userStakedRaw || window.ethers.BigNumber.from(0);
        const unstakeUnits = window.ethers.utils.parseUnits(this.unstakeAmount || '0', this.userStakedDecimals);
        const hasSufficientStaked = stakedRaw.gte(unstakeUnits);
        const unstakePhase = this.actionPhases?.unstake || 'idle';

        if (unstakePhase !== 'idle') {
            unstakeButton.disabled = true;
            if (buttonIcon) buttonIcon.textContent = 'hourglass_empty';
            if (buttonText) {
                const phaseLabel = this.getPhaseLabel(unstakePhase) || ' Processing Transaction...';
                buttonText.textContent = phaseLabel;
            }
            return;
        }

        const shouldDisable = this.isExecutingUnstake || !hasAmount || !hasSufficientStaked;
        unstakeButton.disabled = shouldDisable;
        const oldFarmLabel = this.getMigrationConfig().OLD_FARM_LABEL || 'Farm 1.0';
        unstakeButton.title = (!hasSufficientStaked && hasAmount)
            ? 'Insufficient staked balance'
            : (this.isMigrationMode() ? `Exit ${oldFarmLabel}` : 'Unstake LP Tokens');

        if (buttonIcon) buttonIcon.textContent = this.isMigrationMode() ? 'logout' : 'remove';
        if (buttonText) {
            buttonText.textContent = this.isMigrationMode()
                ? ` Exit ${oldFarmLabel}`
                : ' Unstake LP Tokens';
        }
    }

    /**
     * Update claim button text and state during transaction flow
     */
    updateClaimButton() {
        const claimButton = document.querySelector('.modal-actions .btn-primary[onclick*="safeModalExecuteClaim"]');
        if (!claimButton) return;

        const buttonIcon = claimButton.querySelector('.material-icons');
        const buttonText = claimButton.childNodes[claimButton.childNodes.length - 1];
        const rewards = parseFloat(this.pendingRewards) || 0;
        const hasRewards = rewards > 0;
        const claimPhase = this.actionPhases?.claim || 'idle';

        if (claimPhase !== 'idle') {
            claimButton.disabled = true;
            if (buttonIcon) buttonIcon.textContent = 'hourglass_empty';
            if (buttonText) {
                const phaseLabel = this.getPhaseLabel(claimPhase) || ' Processing Transaction...';
                buttonText.textContent = phaseLabel;
            }
            return;
        }

        const shouldDisable = this.isExecutingClaim || !hasRewards;
        claimButton.disabled = shouldDisable;

        if (buttonIcon) buttonIcon.textContent = 'redeem';
        if (buttonText) buttonText.textContent = ' Claim Rewards';
    }

    updateZapButton() {
        const zapButton = document.querySelector('.modal-actions .btn-primary[onclick*="safeModalExecuteZap"]');
        if (!zapButton) return;

        const buttonIcon = zapButton.querySelector('.material-icons');
        const buttonText = zapButton.childNodes[zapButton.childNodes.length - 1];
        const amount = parseFloat(this.zapInputAmount) || 0;
        const hasAmount = amount > 0;
        const hasSufficientBalance = this.hasSufficientZapBalance();
        const hasValidSlippage = !this.hasInvalidZapCustomSlippage();

        const approvePhase = this.actionPhases?.approveZap || 'idle';
        const zapPhase = this.actionPhases?.zap || 'idle';
        const activePhase = approvePhase !== 'idle' ? approvePhase : zapPhase;

        if (activePhase !== 'idle') {
            zapButton.disabled = true;
            if (buttonIcon) buttonIcon.textContent = 'hourglass_empty';
            if (buttonText) buttonText.textContent = this.getPhaseLabel(activePhase) || ' Processing Transaction...';
            return;
        }

        const hasQuote = this.zapQuoteStatus === 'ready' && !!this.zapQuote;
        const shouldDisable = this.isExecutingZap || !hasAmount || !this.zapSelectedToken || !hasSufficientBalance || !hasQuote || !hasValidSlippage;
        zapButton.disabled = shouldDisable;
        if (!hasValidSlippage) {
            zapButton.title = this.getZapCustomSlippageError();
        } else if (!hasSufficientBalance && hasAmount) {
            zapButton.title = `Insufficient ${this.zapSelectedToken?.symbol || 'token'} balance`;
        } else if (hasQuote) {
            zapButton.title = 'Create LP tokens';
        } else {
            zapButton.title = 'Fetch a quote before creating LP tokens';
        }

        if (buttonIcon) buttonIcon.textContent = 'bolt';
        if (buttonText) buttonText.textContent = ' Create LP';
    }

    /**
     * Load user balances from contract manager
     * Enhanced to use correct lpToken address from pair object
     */
    async loadUserBalances() {
        try {
            if (!window.contractManager || !window.contractManager.isReady()) {
                console.log('🔄 Contract manager not ready, using default balances');
                this.userBalance = '0.00';
                this.userStaked = '0.00';
                this.pendingRewards = '0.00';
                this.userBalanceRaw = window.ethers.BigNumber.from(0);
                this.userStakedRaw = window.ethers.BigNumber.from(0);
                this.updateButtonStates();
                return;
            }

            if (!window.walletManager || !window.walletManager.address) {
                console.log('🔄 Wallet not connected, using default balances');
                this.userBalance = '0.00';
                this.userStaked = '0.00';
                this.pendingRewards = '0.00';
                this.userBalanceRaw = window.ethers.BigNumber.from(0);
                this.userStakedRaw = window.ethers.BigNumber.from(0);
                this.updateButtonStates();
                return;
            }

            const userAddress = window.walletManager.address;
            // Use lpToken address from pair object (matches React implementation)
            const tokenAddress = this.currentPair.lpToken || this.currentPair.address;

            console.log(`🔍 Loading balances for token: ${tokenAddress}`);

            // Get LP token balance using token address directly
            try {
                // Create LP token contract instance
                const lpTokenABI = [
                    'function balanceOf(address owner) view returns (uint256)',
                    'function decimals() view returns (uint8)',
                    'function symbol() view returns (string)',
                    'function name() view returns (string)'
                ];

                const provider = window.contractManager.provider || window.walletManager.provider;
                const lpTokenContract = new window.ethers.Contract(tokenAddress, lpTokenABI, provider);

                // Get balance
                const balance = await lpTokenContract.balanceOf(userAddress);
                const decimals = await lpTokenContract.decimals();

                // Format balance with ethers v5/v6 compatibility
                this.userBalance = this.formatTokenAmount(balance, decimals);
                this.userBalanceRaw = window.ethers.BigNumber.from(balance);
                this.userBalanceDecimals = decimals;

                console.log(`✅ LP Token balance: ${this.userBalance}`);
            } catch (balanceError) {
                console.error('❌ Failed to get LP token balance:', balanceError);
                this.userBalance = '0.00';
                this.userBalanceRaw = window.ethers.BigNumber.from(0);
            }

            // Get user stake info
            try {
                const stakeInfo = await window.contractManager.getUserStake(userAddress, tokenAddress);
                if (stakeInfo) {
                    // Format with ethers v5/v6 compatibility
                    this.userStaked = this.formatTokenAmount(stakeInfo.amount || '0', 18);
                    this.pendingRewards = this.formatTokenAmount(stakeInfo.rewards || '0', 18);
                    this.userStakedRaw = window.ethers.utils.parseUnits((stakeInfo.amount || '0').toString(), 18);
                    this.userStakedDecimals = 18;
                }

                console.log(`✅ Staked: ${this.userStaked}, Rewards: ${this.pendingRewards}`);
            } catch (stakeError) {
                console.error('❌ Failed to get stake info:', stakeError);
                this.userStaked = '0.00';
                this.pendingRewards = '0.00';
                this.userStakedRaw = window.ethers.BigNumber.from(0);
            }

            console.log('✅ User balances loaded:', {
                balance: this.userBalance,
                staked: this.userStaked,
                rewards: this.pendingRewards
            });

            this.updateButtonStates();

        } catch (error) {
            console.error('❌ Failed to load user balances:', error);
            // Use fallback values
            this.userBalance = '0.00';
            this.userStaked = '0.00';
            this.pendingRewards = '0.00';
            this.userBalanceRaw = window.ethers.BigNumber.from(0);
            this.userStakedRaw = window.ethers.BigNumber.from(0);
            this.updateButtonStates();
        }
    }

    close() {
        this.stopZapQuoteAutoRefresh();
        const modal = document.getElementById('staking-modal-new');
        if (modal) {
            modal.classList.remove('open');
            setTimeout(() => {
                modal.style.display = 'none';
                this.isOpen = false;
            }, 300);
            this.clearInputs();
        }

        // Restore body scroll
        document.body.style.overflow = '';
    }
    
    /**
     * Clear all input values and reset state after successful transaction
     */
    clearInputs() {
        // Clear state
        this.stakeAmount = '';
        this.unstakeAmount = '';
        this.zapInputAmount = '';
        this.zapQuote = null;
        this.zapQuoteStatus = 'idle';
        this.zapQuoteError = '';
        this.zapQuoteRateLimitMessage = '';
        this.zapQuoteKey = '';
        this.zapQuoteInFlightKey = '';
        this.zapCustomSlippage = '';
        this.zapCustomSlippageError = '';
        this.zapQuoteRequestId += 1;
        this.stopZapQuoteAutoRefresh();
        this.clearZapQuoteRateLimitTimer();
        this.isApproved = false;
        this.needsApproval = false;
        this.resetActionStates(false);
        
        // Clear DOM inputs and sliders for both stake and unstake
        ['stake', 'unstake'].forEach(type => {
            const input = document.getElementById(`${type}-amount-input`);
            const slider = document.getElementById(`${type}-slider`);
            if (input) input.value = '';
            if (slider) slider.value = '0';
        });
        this.updateStakeUsdEstimate();
        this.updateUnstakeUsdEstimate();

        const zapInput = document.getElementById('zap-amount-input');
        if (zapInput) zapInput.value = '';
        document.querySelectorAll('.zap-percentage-btn').forEach(button => {
            button.classList.remove('active');
        });
        
        console.log('🧹 Input values cleared');
        this.updateButtonStates();
    }

    updatePairInfo() {
        const pairInfoElement = document.getElementById('modal-pair-info');
        if (!pairInfoElement || !this.currentPair) return;

        const platform = this.currentPair.platform;
        const lpTokenAddress = this.currentPair.lpToken || this.currentPair.address;
        const platformUrl = window.Formatter.getPlatformUrl(platform, lpTokenAddress);

        if (platformUrl) {
            pairInfoElement.innerHTML = `
                <a href="${platformUrl}" target="_blank" rel="noopener noreferrer" class="modal-pair-link" title="View pool on ${platform}">
                    <span class="material-icons modal-pair-link-icon" style="font-size: 16px;">swap_horiz</span>
                    <span class="modal-pair-link-text">${this.currentPair.name}</span>
                    <span class="chip chip-primary modal-pair-link-chip">${platform}</span>
                </a>
            `;
            return;
        }

        pairInfoElement.innerHTML = `
            <span class="material-icons" style="font-size: 16px;">swap_horiz</span>
            ${this.currentPair.name}
            <span class="chip chip-primary" style="margin-left: 8px;">${platform}</span>
        `;
    }

    switchTab(tab) {
        if (this.isMigrationMode() && (tab === 'stake' || tab === 'zap')) {
            tab = 'unstake';
        }

        this.currentTab = tab;
        this.defaultMigrationUnstakeToMax();
        this.syncZapQuoteAutoRefresh();

        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Render tab content
        this.renderTabContent();
    }

    renderTabContent() {
        const tabContent = document.getElementById('tab-content');
        if (!tabContent) return;
        tabContent.className = `tab-content tab-content-${this.currentTab}`;

        switch (this.currentTab) {
            case 'stake':
                tabContent.innerHTML = this.renderStakeTab();
                break;
            case 'unstake':
                tabContent.innerHTML = this.renderUnstakeTab();
                break;
            case 'claim':
                tabContent.innerHTML = this.renderClaimTab();
                break;
            case 'zap':
                tabContent.innerHTML = this.renderZapTab();
                break;
        }

        // Attach input event listeners to update button states dynamically
        this.attachTabEventListeners();
    }

    attachTabEventListeners() {
        // Update button states when input changes
        const stakeInput = document.getElementById('stake-amount-input');
        const unstakeInput = document.getElementById('unstake-amount-input');

        if (stakeInput) {
            stakeInput.addEventListener('input', () => {
                const sanitizedValue = this.applyDecimalLimit(stakeInput.value, this.userBalanceDecimals);
                if (sanitizedValue !== stakeInput.value) {
                    stakeInput.value = sanitizedValue;
                }
                this.stakeAmount = sanitizedValue;
                this.updateStakeEstimatedAPR();
                this.updateStakeUsdEstimate();
                this.updateButtonStates();
            });
        }

        if (unstakeInput) {
            unstakeInput.addEventListener('input', () => {
                const sanitizedValue = this.applyDecimalLimit(unstakeInput.value, this.userStakedDecimals);
                if (sanitizedValue !== unstakeInput.value) {
                    unstakeInput.value = sanitizedValue;
                }
                this.unstakeAmount = sanitizedValue;
                this.updateUnstakeUsdEstimate();
                this.updateButtonStates();
            });
        }

        // Initial button state update
        this.updateButtonStates();
    }

    updateButtonStates() {
        this.updateStakeButton();
        this.updateUnstakeButton();
        this.updateClaimButton();
        this.updateZapButton();
    }

    renderStakeTab() {
        return `
            <div class="balance-info">
                <span class="balance-label">Available LP Tokens:</span>
                <span class="balance-value">${this.userBalance} LP${this.renderInlineLpUsdEstimate(this.userBalance)}</span>
            </div>

            <div class="form-group">
                <label class="form-label">Amount to Stake</label>
                <input
                    type="number"
                    id="stake-amount-input"
                    class="form-input"
                    placeholder="0.00"
                    value="${this.stakeAmount}"
                    min="0"
                    inputmode="decimal"
                >
                ${this.renderLpUsdEstimateElement('stake-usd-estimate', this.stakeAmount)}
                <div class="slider-container">
                    <input
                        type="range"
                        class="slider amount-slider"
                        id="stake-slider"
                        min="0"
                        max="100"
                        value="0"
                        data-type="stake"
                    >
                </div>
                <div class="percentage-buttons">
                    <button class="percentage-btn" data-percentage="25">25%</button>
                    <button class="percentage-btn" data-percentage="50">50%</button>
                    <button class="percentage-btn" data-percentage="75">75%</button>
                    <button class="percentage-btn" data-percentage="100">MAX</button>
                </div>
            </div>

            <div class="balance-info">
                <span class="balance-label">Estimated APR:</span>
                <span id="stake-estimated-apr" class="balance-value success-text">${this.getStakeEstimatedAPRDisplay()}%</span>
            </div>

            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="safeModalClose()">Cancel</button>
                <button class="btn btn-primary" onclick="safeModalExecuteStake()" ${!this.stakeAmount || parseFloat(this.stakeAmount) === 0 ? 'disabled' : ''}>
                    <span class="material-icons">add</span>
                    Stake LP Tokens
                </button>
            </div>
        `;
    }

    calculateEstimatedStakeAPR() {
        if (window.rewardsCalculator?.calcProjectedAPR) {
            return window.rewardsCalculator.calcProjectedAPR({
                hourlyRate: window.homePage?.hourlyRewardRate ?? this.currentPair?.hourlyRewardRate,
                currentTvlLpTokens: this.currentPair?.tvl ?? this.currentPair?.totalStaked,
                addedLpTokens: this.stakeAmount,
                libPerLp: this.currentPair?.libPerLp,
                poolWeight: this.currentPair?.weight,
                totalWeight: window.homePage?.totalWeight ?? this.currentPair?.totalWeight,
                fallbackApr: this.currentPair?.apr
            });
        }

        const fallbackApr = Number(this.currentPair?.apr);
        return Number.isFinite(fallbackApr) ? fallbackApr : 0;
    }

    getStakeEstimatedAPRDisplay() {
        const apr = this.calculateEstimatedStakeAPR();
        return Number.isFinite(apr) ? apr.toFixed(1) : '0.0';
    }

    updateStakeEstimatedAPR() {
        const aprElement = document.getElementById('stake-estimated-apr');
        if (aprElement) {
            aprElement.textContent = `${this.getStakeEstimatedAPRDisplay()}%`;
        }
    }

    updateStakeUsdEstimate() {
        this.updateLpUsdEstimate('stake-usd-estimate', this.stakeAmount);
    }

    renderUnstakeTab() {
        const config = this.getMigrationConfig();
        const oldFarmLabel = config.OLD_FARM_LABEL || 'Farm 1.0';
        const newFarmLabel = config.NEW_FARM_LABEL || 'Farm 2.0';
        const migrationNote = this.isMigrationMode()
            ? `<div class="migration-modal-note" role="status">
                    <span class="material-icons" aria-hidden="true">info</span>
                    <span>Keep <em>Claim reward tokens</em> checked to withdraw your LP and LIB rewards together before moving to ${newFarmLabel}.</span>
               </div>`
            : '';
        const actionLabel = this.isMigrationMode() ? `Exit ${oldFarmLabel}` : 'Unstake LP Tokens';
        const actionIcon = this.isMigrationMode() ? 'logout' : 'remove';
        const stakedAmount = parseFloat(this.userStaked) || 0;
        const unstakeAmount = parseFloat(this.unstakeAmount) || 0;
        const unstakeSliderValue = stakedAmount > 0
            ? Math.min(100, Math.max(0, (unstakeAmount / stakedAmount) * 100))
            : 0;
        const isMaxUnstake = unstakeSliderValue >= 99.999;

        return `
            ${migrationNote}

            <div class="balance-info">
                <span class="balance-label">Staked LP Tokens:</span>
                <span class="balance-value">${this.userStaked} LP${this.renderInlineLpUsdEstimate(this.userStaked)}</span>
            </div>

            <div class="form-group">
                <label class="form-label">Amount to Unstake</label>
                <input
                    type="number"
                    id="unstake-amount-input"
                    class="form-input"
                    placeholder="0.00"
                    value="${this.unstakeAmount}"
                    min="0"
                    inputmode="decimal"
                >
                ${this.renderLpUsdEstimateElement('unstake-usd-estimate', this.unstakeAmount)}
                <div class="slider-container">
                    <input
                        type="range"
                        class="slider amount-slider"
                        id="unstake-slider"
                        min="0"
                        max="100"
                        value="${unstakeSliderValue}"
                        data-type="unstake"
                    >
                </div>
                <div class="percentage-buttons">
                    <button class="percentage-btn" data-percentage="25">25%</button>
                    <button class="percentage-btn" data-percentage="50">50%</button>
                    <button class="percentage-btn" data-percentage="75">75%</button>
                    <button class="percentage-btn ${isMaxUnstake ? 'active' : ''}" data-percentage="100">MAX</button>
                </div>
            </div>

            <div class="balance-info">
                <span class="balance-label">Pending Rewards:</span>
                <span class="balance-value success-text">${this.pendingRewards} LIB</span>
            </div>

            <div class="form-group">
                <label class="checkbox-label">
                    <input
                        type="checkbox"
                        id="claim-rewards-checkbox"
                        ${this.claimRewardsOnUnstake ? 'checked' : ''}
                    >
                    <span class="checkmark"></span>
                    Claim reward tokens
                </label>
            </div>

            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="safeModalClose()">Cancel</button>
                <button class="btn btn-primary" onclick="safeModalExecuteUnstake()" ${!this.unstakeAmount || parseFloat(this.unstakeAmount) === 0 ? 'disabled' : ''}>
                    <span class="material-icons">${actionIcon}</span>
                    ${actionLabel}
                </button>
            </div>
        `;
    }

    updateUnstakeUsdEstimate() {
        this.updateLpUsdEstimate('unstake-usd-estimate', this.unstakeAmount);
    }

    updateLpUsdEstimate(elementId, amount) {
        const estimateElement = document.getElementById(elementId);
        if (estimateElement) {
            const estimate = this.formatLpUsdEstimate(amount);
            estimateElement.textContent = estimate;
            estimateElement.hidden = !estimate;
        }
    }

    renderClaimTab() {
        const config = this.getMigrationConfig();
        const oldFarmLabel = config.OLD_FARM_LABEL || 'Farm 1.0';
        const newFarmLabel = config.NEW_FARM_LABEL || 'Farm 2.0';
        const migrationNote = this.isMigrationMode()
            ? `<div class="migration-modal-note" role="status">
                    <span class="material-icons" aria-hidden="true">info</span>
                    <span>Claim any ${oldFarmLabel} rewards before staking on ${newFarmLabel}.</span>
               </div>`
            : '';

        return `
            ${migrationNote}

            <div class="balance-info">
                <span class="balance-label">Pending Rewards:</span>
                <span class="balance-value success-text">${this.pendingRewards} LIB</span>
            </div>

            <div class="balance-info">
                <span class="balance-label">Staked Amount:</span>
                <span class="balance-value">${this.userStaked} LP${this.renderInlineLpUsdEstimate(this.userStaked)}</span>
            </div>

            <div class="balance-info">
                <span class="balance-label">Current APR:</span>
                <span class="balance-value success-text">${this.currentPair?.apr || '0.00'}%</span>
            </div>

            <div style="text-align: center; margin: var(--spacing-3) 0; color: var(--text-secondary);">
                <span class="material-icons" style="font-size: 48px; color: var(--success-main);">redeem</span>
                <p>Claim your earned rewards</p>
            </div>

            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="safeModalClose()">Cancel</button>
                <button class="btn btn-primary" onclick="safeModalExecuteClaim()" ${parseFloat(this.pendingRewards) === 0 ? 'disabled' : ''}>
                    <span class="material-icons">redeem</span>
                    Claim Rewards
                </button>
            </div>
        `;
    }

    renderZapTab() {
        const networkConfig = this.getKyberZapNetworkConfig();
        const isCustomTokenMode = this.zapInputTokenAddress === 'custom';
        const selectedToken = isCustomTokenMode ? null : (this.zapSelectedToken || this.zapInputTokens[0]);
        const balanceError = selectedToken ? this.getZapBalanceError() : '';
        const slippageOptions = [10, 50, 100];
        const selectedPickerToken = isCustomTokenMode
            ? { symbol: 'Custom', address: 'custom' }
            : selectedToken;
        const selectedPickerLabelParts = isCustomTokenMode
            ? { symbol: 'Custom token', shortAddress: '', fullLabel: 'Custom token' }
            : this.getZapTokenLabelParts(selectedToken);
        const selectedPickerBalance = isCustomTokenMode ? 'Add by address' : this.getZapTokenBalanceLabel(selectedToken);
        const tokenOptions = this.zapInputTokens.map(token => this.renderZapTokenPickerRow(
            token,
            selectedPickerToken?.address
        )).join('') + this.renderZapTokenPickerRow(
            { symbol: 'Custom', address: 'custom' },
            selectedPickerToken?.address,
            { label: 'Custom token', balanceLabel: 'Add by address', iconText: '+', iconClass: 'zap-token-icon-custom' }
        );

        if (!networkConfig) {
            return `
                <div class="zap-empty-state">
                    <span class="material-icons" aria-hidden="true">warning</span>
                    <p>Zap is not available on this network.</p>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="safeModalClose()">Cancel</button>
                </div>
            `;
        }

        return `
            <div class="zap-info-panel">
                <span class="material-icons">info</span>
                <span>Zap turns one token into ${this.escapeHtml(this.currentPair?.name || 'this pair')} LP tokens by swapping as needed and adding liquidity in one transaction.</span>
            </div>

            <div class="zap-input-row">
                <div class="form-group zap-token-group">
                    <div class="zap-label-row">
                        <label class="form-label">Input Token</label>
                    </div>
                    <details class="zap-token-picker">
                        <summary class="zap-token-trigger">
                            ${this.renderZapTokenIcon(selectedPickerToken, isCustomTokenMode ? {
                                iconText: '+',
                                iconClass: 'zap-token-icon-custom',
                                iconUrl: ''
                            } : {})}
                            <span class="zap-token-option-text">
                                <span class="zap-token-option-label">
                                    <span>${this.escapeHtml(selectedPickerLabelParts.symbol || 'Select token')}</span>${selectedPickerLabelParts.shortAddress ? ` <span class="zap-token-option-address">${this.escapeHtml(selectedPickerLabelParts.shortAddress)}</span>` : ''}
                                </span>
                                <span class="zap-token-option-balance">${this.escapeHtml(selectedPickerBalance || '--')}</span>
                            </span>
                            <span class="material-icons zap-token-expand" aria-hidden="true">expand_more</span>
                        </summary>
                        <div class="zap-token-menu" role="listbox" aria-label="Zap input token">
                            ${tokenOptions}
                        </div>
                    </details>
                </div>
                <div class="form-group zap-amount-group">
                    <div class="zap-label-row zap-amount-label-row">
                        <label class="form-label">Amount</label>
                        <div class="zap-percentage-buttons">
                            <button type="button" class="zap-percentage-btn" data-percentage="25" ${!selectedToken ? 'disabled' : ''}>25%</button>
                            <button type="button" class="zap-percentage-btn" data-percentage="50" ${!selectedToken ? 'disabled' : ''}>50%</button>
                            <button type="button" class="zap-percentage-btn" data-percentage="75" ${!selectedToken ? 'disabled' : ''}>75%</button>
                            <button type="button" class="zap-percentage-btn" data-percentage="100" ${!selectedToken ? 'disabled' : ''}>Max</button>
                        </div>
                    </div>
                    <input
                        type="number"
                        id="zap-amount-input"
                        class="form-input"
                        placeholder="0.00"
                        value="${this.escapeHtml(this.zapInputAmount)}"
                        min="0"
                        inputmode="decimal"
                        ${!selectedToken ? 'disabled' : ''}
                    >
                    <div id="zap-balance-error" class="zap-field-error zap-balance-error" aria-live="polite" ${balanceError ? '' : 'hidden'}>${this.escapeHtml(balanceError)}</div>
                </div>
            </div>

            ${isCustomTokenMode ? `
                <div class="zap-custom-token-row">
                    <input
                        type="text"
                        id="zap-custom-token-input"
                        class="form-input"
                        placeholder="0x..."
                        value="${this.escapeHtml(this.zapCustomTokenAddress)}"
                        spellcheck="false"
                    >
                    <button class="btn btn-secondary zap-token-add-btn" onclick="safeModalAddZapCustomToken()">
                        <span class="material-icons">add</span>
                        Add
                    </button>
                </div>
                ${this.zapCustomTokenError ? `<div class="zap-field-error">${this.escapeHtml(this.zapCustomTokenError)}</div>` : ''}
            ` : ''}

            <div class="form-group">
                <label class="form-label">Slippage</label>
                <div class="zap-slippage-row">
                    ${slippageOptions.map(option => `
                        <button class="zap-slippage-btn ${this.zapSlippageBps === option && !this.zapCustomSlippage ? 'active' : ''}" data-slippage="${option}">
                            ${(option / 100).toFixed(1)}%
                        </button>
                    `).join('')}
                    <button class="zap-slippage-btn ${this.isZapCustomSlippageActive() ? 'active' : ''}" data-slippage="custom">Custom</button>
                    <input
                        type="number"
                        id="zap-custom-slippage-input"
                        class="form-input zap-custom-slippage"
                        placeholder="${(this.zapSlippageBps / 100).toFixed(2)}%"
                        value="${this.escapeHtml(this.zapCustomSlippage)}"
                        min="0.01"
                        max="100"
                        step="0.01"
                        aria-invalid="${this.zapCustomSlippageError ? 'true' : 'false'}"
                        ${this.zapCustomSlippageError ? 'aria-describedby="zap-custom-slippage-error"' : ''}
                    >
                </div>
                ${this.zapCustomSlippageError ? `<div id="zap-custom-slippage-error" class="zap-field-error">${this.escapeHtml(this.zapCustomSlippageError)}</div>` : ''}
            </div>

            <div id="zap-quote-panel">
                ${this.renderZapQuotePanel()}
            </div>

            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="safeModalClose()">Cancel</button>
                <button class="btn btn-primary" onclick="safeModalExecuteZap()" ${this.zapQuoteStatus !== 'ready' ? 'disabled' : ''}>
                    <span class="material-icons">bolt</span>
                    Create LP
                </button>
            </div>
        `;
    }

    renderZapQuoteRow(label, value, riskClass = '') {
        return `
                    <div class="zap-quote-row${riskClass ? ` ${riskClass}` : ''}">
                        <dt>${this.escapeHtml(label)}</dt>
                        <dd>${this.escapeHtml(value)}</dd>
                    </div>
        `;
    }

    renderZapQuotePanel() {
        const isLoading = this.zapQuoteStatus === 'loading';
        const isError = this.zapQuoteStatus === 'error';
        const hasQuote = this.zapQuoteStatus === 'ready' && !!this.zapQuote;
        const pendingValue = isLoading ? '...' : '-';
        const inputDisplay = this.zapInputAmount
            ? `${this.zapInputAmount} ${this.zapSelectedToken?.symbol || ''}`.trim()
            : '-';
        const canRefreshQuote = this.canFetchZapQuote();
        const rateLimitWaitMs = this.getZapQuoteRateLimitWaitMs();
        const isRateLimited = rateLimitWaitMs > 0;
        const countdownDisplay = isRateLimited
            ? `${Math.ceil(rateLimitWaitMs / 1000)}s`
            : canRefreshQuote ? `${this.zapQuoteCountdown}s` : '--';
        const refreshDisabled = !canRefreshQuote || isLoading || isRateLimited;
        const rateLimitMessage = isRateLimited ? this.zapQuoteRateLimitMessage : '';
        let routeSummary = this.zapInputAmount
            ? this.getZapRouteSummary()
            : 'Enter an amount to preview the LP route.';
        let lpResultDisplay = pendingValue;
        let feeDisplay = pendingValue;
        let priceImpactDisplay = pendingValue;
        let slippageDisplay = `${(Number(this.zapSlippageBps) / 100).toFixed(2)}%`;
        let priceImpactRiskClass = '';
        let slippageRiskClass = this.isHighZapSlippage(this.zapSlippageBps) ? 'zap-risk-high' : '';
        const warningMessages = [];
        const cardClass = [
            'zap-quote-card',
            isLoading ? 'zap-quote-loading' : '',
            isError ? 'zap-quote-error' : '',
            !hasQuote && !isLoading && !isError ? 'zap-quote-placeholder' : ''
        ].filter(Boolean).join(' ');

        if (isLoading) {
            routeSummary = 'Fetching quote...';
        } else if (isError) {
            routeSummary = this.zapQuoteError || 'Unable to fetch a zap quote.';
        } else if (hasQuote) {
            const data = this.getZapRouteData();
            const lpResult = this.getZapQuoteSummaryValue([
                'positionDetails.addedLiquidity',
                'positionDetails.liquidity',
                'zapDetails.lpAmount',
                'amountOut'
            ]);
            const lpAmountDisplay = this.formatZapDisplayAmount(lpResult, this.userBalanceDecimals, 'LP');
            const lpUsdEstimate = this.formatLpUsdEstimate(this.getZapLpAmountForUsdEstimate(lpResult));
            lpResultDisplay = lpAmountDisplay === 'N/A' || !lpUsdEstimate
                ? lpAmountDisplay
                : `${lpAmountDisplay} (${lpUsdEstimate})`;
            const feeDetails = this.getZapProtocolFeeDetails(data);
            feeDisplay = feeDetails ? this.formatZapFeeDisplay(feeDetails.amount, feeDetails.decimals, feeDetails.symbol) : 'N/A';
            const priceImpact = this.getZapQuoteSummaryEntry([
                'zapDetails.priceImpact',
                'zapDetails.priceImpactPcm',
                'priceImpact',
                'priceImpactPcm'
            ], 'N/A');
            priceImpactDisplay = this.formatZapPercent(priceImpact);
            priceImpactRiskClass = this.isHighZapPriceImpact(priceImpact.value, priceImpact.path) ? 'zap-risk-high' : '';
            if (priceImpactRiskClass) {
                warningMessages.push('High price impact. You may receive significantly less LP value than expected.');
            }
            const suggestedSlippage = data?.suggestedSlippage || data?.slippage || this.zapSlippageBps;
            slippageDisplay = `${(Number(suggestedSlippage) / 100).toFixed(2)}%`;
            slippageRiskClass = this.isHighZapSlippage(suggestedSlippage) ? 'zap-risk-high' : '';
            if (slippageRiskClass) {
                warningMessages.push('High slippage tolerance. This transaction may execute at a much worse rate.');
            }
            routeSummary = this.getZapRouteSummary();
        }

        const quoteRows = [
            this.renderZapQuoteRow('Input', inputDisplay),
            this.renderZapQuoteRow('Estimated LP', lpResultDisplay),
            this.renderZapQuoteRow('Kyber Zap Fee', feeDisplay),
            this.renderZapQuoteRow('Price Impact', priceImpactDisplay, priceImpactRiskClass),
            this.renderZapQuoteRow('Slippage', slippageDisplay, slippageRiskClass)
        ].join('');

        return `
            <div class="${cardClass}">
                <div class="zap-quote-header">
                    <div class="zap-route-summary">${this.escapeHtml(routeSummary)}</div>
                    <div class="zap-refresh-controls">
                        <span id="zap-quote-countdown" class="zap-quote-countdown">${this.escapeHtml(countdownDisplay)}</span>
                        <button
                            type="button"
                            class="zap-refresh-btn"
                            onclick="safeModalFetchZapQuote()"
                            title="Refresh quote"
                            aria-label="Refresh quote"
                            ${refreshDisabled ? 'disabled' : ''}
                        >
                            <span class="material-icons">sync</span>
                        </button>
                    </div>
                </div>
                <dl class="zap-quote-list">
                    ${quoteRows}
                </dl>
                ${rateLimitMessage ? `
                    <div class="zap-rate-limit-note" role="status">
                        ${this.escapeHtml(rateLimitMessage)}
                    </div>
                ` : ''}
                ${warningMessages.length ? `
                    <div class="zap-risk-warning" role="alert">
                        <span class="material-icons" aria-hidden="true">warning</span>
                        <div>
                            ${warningMessages.map(message => `<div>${this.escapeHtml(message)}</div>`).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    updateZapQuotePanel() {
        const panel = document.getElementById('zap-quote-panel');
        if (panel) {
            panel.innerHTML = this.renderZapQuotePanel();
        }
    }

    setPercentage(percentage) {
        let amount;
        
        // For 100% (MAX), use the exact original value to preserve precision
        if (percentage === 100) {
            amount = this.currentTab === 'stake' ? this.userBalance : this.userStaked;
        } else {
            // For other percentages, calculate the amount
            const maxAmount = this.currentTab === 'stake' ? parseFloat(this.userBalance) : parseFloat(this.userStaked);
            amount = (maxAmount * percentage / 100).toFixed(6);
        }

        if (this.currentTab === 'stake') {
            this.stakeAmount = amount;
            const input = document.getElementById('stake-amount-input');
            if (input) input.value = amount;
            this.updateSlider('stake');

            // Reset approval state when amount changes
            this.isApproved = false;
            this.needsApproval = false;

            // Update button states
            this.updateStakeEstimatedAPR();
            this.updateStakeUsdEstimate();
            this.updateButtonStates();
        } else if (this.currentTab === 'unstake') {
            this.unstakeAmount = amount;
            const input = document.getElementById('unstake-amount-input');
            if (input) input.value = amount;
            this.updateSlider('unstake');

            // Update button states
            this.updateUnstakeUsdEstimate();
            this.updateButtonStates();
        }

        // Update percentage button states
        document.querySelectorAll('.percentage-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.percentage) === percentage);
        });
    }

    updateSlider(type) {
        const slider = document.getElementById(`${type}-slider`);
        if (!slider) return;

        const amount = parseFloat(type === 'stake' ? this.stakeAmount : this.unstakeAmount) || 0;
        const maxAmount = parseFloat(type === 'stake' ? this.userBalance : this.userStaked) || 1;
        const percentage = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;

        slider.value = percentage;
    }

    updateAmountFromSlider(slider) {
        const type = slider.dataset.type;
        const percentage = parseFloat(slider.value);
        let amount;
        
        // For 100% (MAX), use the exact original value to preserve precision
        // This prevents rounding issues when slider is dragged to max
        if (percentage === 100) {
            amount = type === 'stake' ? this.userBalance : this.userStaked;
        } else {
            // For other percentages, calculate the amount
            const maxAmount = parseFloat(type === 'stake' ? this.userBalance : this.userStaked) || 0;
            amount = (maxAmount * percentage / 100).toFixed(6);
        }

        if (type === 'stake') {
            this.stakeAmount = amount;
            const input = document.getElementById('stake-amount-input');
            if (input) input.value = amount;
            this.updateStakeEstimatedAPR();
            this.updateStakeUsdEstimate();
            this.updateButtonStates();
        } else if (type === 'unstake') {
            this.unstakeAmount = amount;
            const input = document.getElementById('unstake-amount-input');
            if (input) input.value = amount;
            this.updateUnstakeUsdEstimate();
            this.updateButtonStates();
        }
    }

    async approveZapTokenIfNeeded(routerAddress) {
        if (!this.zapSelectedToken || this.isNativeZapToken(this.zapSelectedToken.address)) {
            return true;
        }

        if (!routerAddress) {
            throw new Error('Kyber router address is missing from the quote.');
        }

        await window.contractManager.ensureSigner();

        const userAddress = await window.contractManager.signer.getAddress();
        const amountRaw = this.getZapAmountRaw();
        const erc20Abi = [
            'function allowance(address owner, address spender) view returns (uint256)',
            'function approve(address spender, uint256 amount) returns (bool)'
        ];
        const readProvider = window.contractManager.provider || window.walletManager.provider;
        const tokenReadContract = new window.ethers.Contract(this.zapSelectedToken.address, erc20Abi, readProvider);
        const allowance = await tokenReadContract.allowance(userAddress, routerAddress);

        if (allowance.gte(amountRaw)) {
            return true;
        }

        this.pendingOperations.approveZap = true;
        this.setActionPhase('approveZap', 'userApproval');
        const tokenWithSigner = tokenReadContract.connect(window.contractManager.signer);
        const result = await window.contractManager.executeTransactionOnce(async () => {
            const tx = await tokenWithSigner.approve(routerAddress, amountRaw);
            console.log('Zap input token approval sent:', tx.hash);
            return tx;
        }, 'approveZapToken');

        if (!result.success) {
            throw result.error;
        }

        return true;
    }

    async buildZapRoute() {
        const networkConfig = this.getKyberZapNetworkConfig();
        const route = this.getZapRouteEncoded();
        const deadlineSeconds = Math.floor(Date.now() / 1000) + (this.zapDeadlineMinutes || 20) * 60;

        return this.getKyberZapService().buildRoute({
            networkConfig,
            route,
            sender: window.walletManager.address,
            recipient: window.walletManager.address,
            deadline: deadlineSeconds
        });
    }

    getZapTransactionRequest(buildData) {
        const txData = buildData?.txData || buildData?.calldata || buildData?.callData || buildData?.transaction?.data || buildData?.data;
        const to = this.getZapRouterAddress(buildData);
        const rawValue = buildData?.value || buildData?.txValue || buildData?.transaction?.value || '0';

        if (!to || !txData) {
            throw new Error('Kyber did not return transaction calldata.');
        }

        this.validateZapRouterAddress(to);

        return {
            to,
            data: txData,
            value: window.ethers.BigNumber.from(rawValue || '0')
        };
    }

    async executeZap() {
        if (this.isMigrationMode()) {
            window.notificationManager?.warning(`Create LP is disabled on the ${this.getMigrationConfig().OLD_FARM_LABEL || 'Farm 1.0'} migration page.`);
            return;
        }

        if (this.isExecutingZap) {
            console.log('⚠️ Zap already in progress, ignoring duplicate call');
            return;
        }

        const slippageError = this.getZapCustomSlippageError();
        if (slippageError) {
            this.updateZapQuotePanel();
            this.updateZapButton();
            window.notificationManager?.error(slippageError);
            return;
        }

        if (!this.zapQuote || this.zapQuoteStatus !== 'ready') {
            window.notificationManager?.error('Fetch a zap quote before creating LP tokens.');
            return;
        }

        const balanceError = this.getZapBalanceError();
        if (balanceError) {
            this.updateZapBalanceError();
            this.updateZapButton();
            window.notificationManager?.error(balanceError);
            return;
        }

        try {
            this.isExecutingZap = true;
            this.stopZapQuoteAutoRefresh();
            this.updateZapButton();

            if (!window.contractManager || !window.contractManager.isReady()) {
                window.notificationManager?.error('Contract manager not ready. Please connect your wallet first.');
                return;
            }

            await window.contractManager.ensureSigner();

            window.notificationManager?.info('Building Kyber zap transaction...');
            const buildData = await this.buildZapRoute();
            const transactionRequest = this.getZapTransactionRequest(buildData);
            await this.approveZapTokenIfNeeded(transactionRequest.to);

            this.pendingOperations.zap = true;
            this.setActionPhase('zap', 'userApproval');
            window.notificationManager?.info('Creating LP tokens...');

            const result = await window.contractManager.executeTransactionOnce(async () => {
                const tx = await window.contractManager.signer.sendTransaction(transactionRequest);
                console.log(`✅ Zap transaction sent: ${tx.hash}`);
                return tx;
            }, 'zapIntoLP');

            if (!result.success) {
                throw result.error;
            }

            window.notificationManager?.success('LP tokens created successfully!');
            console.log('✅ Zap transaction successful:', result.hash);

            this.clearInputs();
            await new Promise(resolve => setTimeout(resolve, 2000));
            await this.loadUserBalances();
            await this.loadZapTokenBalances();

            if (window.homePage?.refreshData) {
                await window.homePage.refreshData();
            } else if (window.homePage?.loadData) {
                await window.homePage.loadData();
            }

            this.switchTab('stake');
        } catch (error) {
            console.error('❌ Zap failed:', error);
            const errorMessage = error?.userMessage?.message || error?.message || 'Zap transaction failed. Please try again.';
            window.notificationManager?.error(errorMessage, {title: error?.userMessage?.title});
        } finally {
            this.pendingOperations.approveZap = false;
            this.pendingOperations.zap = false;
            this.setActionPhase('approveZap', 'idle');
            this.setActionPhase('zap', 'idle');
            this.isExecutingZap = false;
            this.updateZapButton();
            this.syncZapQuoteAutoRefresh();
        }
    }

    async executeStake() {
        if (this.isMigrationMode()) {
            window.notificationManager?.warning(`New staking is disabled on the ${this.getMigrationConfig().OLD_FARM_LABEL || 'Farm 1.0'} migration page.`);
            return;
        }

        // Guard against multiple simultaneous executions
        if (this.isExecutingStake) {
            console.log('⚠️ Stake already in progress, ignoring duplicate call');
            return;
        }

        if (!this.stakeAmount || parseFloat(this.stakeAmount) === 0) return;

        try {
            // Set execution guard
            this.isExecutingStake = true;
            this.updateStakeButton();
            console.log('🔒 Stake execution started, guard enabled');

            // Check if contract manager is ready
            if (!window.contractManager || !window.contractManager.isReady()) {
                if (window.notificationManager) {
                    window.notificationManager.error('Contract manager not ready. Please connect your wallet first.');
                }
                return;
            }

            // STEP 1: Check if approval is needed
            if (!this.isApproved) {
                console.log('🔍 Checking if approval is needed...');
                const needsApproval = await this.checkApprovalNeeded();

                if (needsApproval) {
                    console.log('🔐 Approval needed, executing approval...');
                    const approved = await this.approveTokens();

                    if (!approved) {
                        console.log('❌ Approval failed or cancelled');
                        return;
                    }

                    console.log('✅ Approval successful, proceeding to stake...');
                } else {
                    console.log('✅ Sufficient allowance, no approval needed');
                }
            }

            // STEP 2: Execute staking transaction
            if (window.notificationManager) {
                window.notificationManager.info('Staking LP tokens...');
            }

            // Use lpToken address from pair object
            const lpTokenAddress = this.currentPair.lpToken || this.currentPair.address;

            this.pendingOperations.stake = true;
            this.setActionPhase('stake', 'userApproval');
            console.log('📤 Sending stake transaction...');

            // Execute real staking transaction
            const result = await window.contractManager.stake(
                lpTokenAddress,
                this.stakeAmount
            );

            if (this.actionPhases.stake === 'userApproval') {
                this.setActionPhase('stake', 'processing');
            }

            if (!result.success) {
                throw result.error;
            }

            if (window.notificationManager) {
                window.notificationManager.success('LP tokens staked successfully!');
            }

            console.log('✅ Staking transaction successful:', result.hash);

            // Clear inputs after successful transaction
            this.clearInputs();
            
            // Close modal
            this.close();

            // Wait for blockchain state to update before refreshing
            console.log('⏳ Waiting for blockchain state to update...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

            // Refresh home page data with enhanced method
            console.log('🔄 Refreshing home page data after stake...');
            if (window.homePage && window.homePage.refreshData) {
                await window.homePage.refreshData();
            } else if (window.homePage && window.homePage.loadData) {
                await window.homePage.loadData();
            }
            console.log('✅ Home page data refreshed after stake');

        } catch (error) {
            console.error('❌ Staking failed:', error);
            const errorMessage = error?.userMessage?.message || error?.message || 'Staking failed. Please try again.';
            window.notificationManager.error(errorMessage, {title: error?.userMessage?.title});
        } finally {
            // Always release the guard
            this.pendingOperations.stake = false;
            this.setActionPhase('stake', 'idle');
            this.isExecutingStake = false;
            this.updateStakeButton();
            console.log('🔓 Stake execution finished, guard released');
        }
    }

    async executeUnstake() {
        // Guard against multiple simultaneous executions
        if (this.isExecutingUnstake) {
            console.log('⚠️ Unstake already in progress, ignoring duplicate call');
            return;
        }

        if (!this.unstakeAmount || parseFloat(this.unstakeAmount) === 0) return;

        try {
            // Set execution guard
            this.isExecutingUnstake = true;
            this.updateUnstakeButton();
            console.log('🔒 Unstake execution started, guard enabled');

            // Check if contract manager is ready
            if (!window.contractManager || !window.contractManager.isReady()) {
                if (window.notificationManager) {
                    window.notificationManager.error('Contract manager not ready. Please connect your wallet first.');
                }
                return;
            }

            if (window.notificationManager) {
                window.notificationManager.info('Unstaking LP tokens...');
            }

            // Execute real unstaking transaction
            this.pendingOperations.unstake = true;
            this.setActionPhase('unstake', 'userApproval');
            const result = await window.contractManager.unstake(
                this.currentPair.address,
                this.unstakeAmount,
                this.claimRewardsOnUnstake
            );

            if (this.actionPhases.unstake === 'userApproval') {
                this.setActionPhase('unstake', 'processing');
            }

            if (!result.success) {
                throw result.error;
            }

            if (window.notificationManager) {
                window.notificationManager.success('LP tokens unstaked successfully!');
            }

            console.log('✅ Unstaking transaction successful:', result.hash);
            
            // Clear inputs after successful transaction
            this.clearInputs();
            
            // Close modal
            this.close();

            // Wait for blockchain state to update before refreshing
            console.log('⏳ Waiting for blockchain state to update...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

            // Refresh home page data with enhanced method
            console.log('🔄 Refreshing home page data after unstake...');
            if (window.homePage && window.homePage.refreshData) {
                await window.homePage.refreshData();
            } else if (window.homePage && window.homePage.loadData) {
                await window.homePage.loadData();
            }
            console.log('✅ Home page data refreshed after unstake');

        } catch (error) {
            console.error('❌ Unstaking failed:', error);
            const errorMessage = error?.userMessage?.message || error?.message || 'Unstaking failed. Please try again.';
            window.notificationManager.error(errorMessage, {title: error?.userMessage?.title});
        } finally {
            // Always release the guard
            this.pendingOperations.unstake = false;
            this.setActionPhase('unstake', 'idle');
            this.isExecutingUnstake = false;
            this.updateUnstakeButton();
            console.log('🔓 Unstake execution finished, guard released');
        }
    }

    async executeClaim() {
        // Guard against multiple simultaneous executions
        if (this.isExecutingClaim) {
            console.log('⚠️ Claim already in progress, ignoring duplicate call');
            return;
        }

        if (parseFloat(this.pendingRewards) === 0) return;

        try {
            // Set execution guard
            this.isExecutingClaim = true;
            this.updateClaimButton();
            console.log('🔒 Claim execution started, guard enabled');

            // Check if contract manager is ready
            if (!window.contractManager || !window.contractManager.isReady()) {
                if (window.notificationManager) {
                    window.notificationManager.error('Contract manager not ready. Please connect your wallet first.');
                }
                return;
            }

            if (window.notificationManager) {
                window.notificationManager.info('Claiming rewards...');
            }

            // Execute real claim transaction
            this.pendingOperations.claim = true;
            this.setActionPhase('claim', 'userApproval');
            const result = await window.contractManager.claimRewards(
                this.currentPair.address
            );

            if (this.actionPhases.claim === 'userApproval') {
                this.setActionPhase('claim', 'processing');
            }

            if (!result.success) {
                throw result.error;
            }

            if (window.notificationManager) {
                window.notificationManager.success('Rewards claimed successfully!');
            }

            console.log('✅ Claim transaction successful:', result.hash);
            
            // Clear inputs after successful transaction
            this.clearInputs();
            
            // Close modal
            this.close();

            // Wait for blockchain state to update before refreshing
            console.log('⏳ Waiting for blockchain state to update...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

            // Refresh home page data with enhanced method
            console.log('🔄 Refreshing home page data after claim...');
            if (window.homePage && window.homePage.refreshData) {
                await window.homePage.refreshData();
            } else if (window.homePage && window.homePage.loadData) {
                await window.homePage.loadData();
            }
            console.log('✅ Home page data refreshed after claim');

        } catch (error) {
            console.error('❌ Claim failed:', error);
            const errorMessage = error?.userMessage?.message || error?.message || 'Claim failed. Please try again.';
            window.notificationManager.error(errorMessage, {title: error?.userMessage?.title});
        } finally {
            // Always release the guard
            this.pendingOperations.claim = false;
            this.setActionPhase('claim', 'idle');
            this.isExecutingClaim = false;
            this.updateClaimButton();
            console.log('🔓 Claim execution finished, guard released');
        }
    }
}

// Export for global access
window.StakingModalNew = StakingModalNew;

// Initialize staking modal with robust global registration
let stakingModalNew;

// Function to safely initialize modal
function initializeStakingModal() {
    try {
        if (!stakingModalNew) {
            stakingModalNew = new StakingModalNew();

            // Set multiple global references for compatibility
            window.stakingModal = stakingModalNew;
            window.stakingModalNew = stakingModalNew;

            console.log('✅ Staking modal initialized successfully');

            // Dispatch custom event to notify other components
            window.dispatchEvent(new CustomEvent('stakingModalReady', {
                detail: { modal: stakingModalNew }
            }));
        }
        return stakingModalNew;
    } catch (error) {
        console.error('❌ Failed to initialize staking modal:', error);
        return null;
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initializeStakingModal);

// Also initialize immediately if DOM is already ready
if (document.readyState === 'loading') {
    // DOM is still loading, wait for DOMContentLoaded
} else {
    // DOM is already ready, initialize immediately
    initializeStakingModal();
}

// Provide a global function to get the modal instance safely
window.getStakingModal = function() {
    return stakingModalNew || initializeStakingModal();
};

// Safe modal action handlers for onclick events
window.safeModalClose = function() {
    try {
        const modal = window.stakingModal || window.stakingModalNew || window.getStakingModal();
        if (modal && typeof modal.close === 'function') {
            modal.close();
        } else {
            console.warn('⚠️ Modal close method not available');
        }
    } catch (error) {
        console.error('❌ Error closing modal:', error);
    }
};

window.safeModalExecuteStake = function() {
    try {
        const modal = window.stakingModal || window.stakingModalNew || window.getStakingModal();
        if (modal && typeof modal.executeStake === 'function') {
            modal.executeStake();
        } else {
            console.warn('⚠️ Modal executeStake method not available');
        }
    } catch (error) {
        console.error('❌ Error executing stake:', error);
    }
};

window.safeModalExecuteUnstake = function() {
    try {
        const modal = window.stakingModal || window.stakingModalNew || window.getStakingModal();
        if (modal && typeof modal.executeUnstake === 'function') {
            modal.executeUnstake();
        } else {
            console.warn('⚠️ Modal executeUnstake method not available');
        }
    } catch (error) {
        console.error('❌ Error executing unstake:', error);
    }
};

window.safeModalExecuteClaim = function() {
    try {
        const modal = window.stakingModal || window.stakingModalNew || window.getStakingModal();
        if (modal && typeof modal.executeClaim === 'function') {
            modal.executeClaim();
        } else {
            console.warn('⚠️ Modal executeClaim method not available');
        }
    } catch (error) {
        console.error('❌ Error executing claim:', error);
    }
};

window.safeModalFetchZapQuote = function() {
    try {
        const modal = window.stakingModal || window.stakingModalNew || window.getStakingModal();
        if (modal && typeof modal.fetchZapQuote === 'function') {
            modal.fetchZapQuote({ force: true });
        } else {
            console.warn('⚠️ Modal fetchZapQuote method not available');
        }
    } catch (error) {
        console.error('❌ Error fetching zap quote:', error);
    }
};

window.safeModalExecuteZap = function() {
    try {
        const modal = window.stakingModal || window.stakingModalNew || window.getStakingModal();
        if (modal && typeof modal.executeZap === 'function') {
            modal.executeZap();
        } else {
            console.warn('⚠️ Modal executeZap method not available');
        }
    } catch (error) {
        console.error('❌ Error executing zap:', error);
    }
};

window.safeModalAddZapCustomToken = function() {
    try {
        const modal = window.stakingModal || window.stakingModalNew || window.getStakingModal();
        if (modal && typeof modal.addZapCustomToken === 'function') {
            modal.addZapCustomToken();
        } else {
            console.warn('⚠️ Modal addZapCustomToken method not available');
        }
    } catch (error) {
        console.error('❌ Error adding custom zap token:', error);
    }
};
