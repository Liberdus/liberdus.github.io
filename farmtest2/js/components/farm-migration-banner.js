/**
 * Farm 1.0 migration banner.
 * This keeps temporary migration UI isolated from the main staking page.
 */
class FarmMigrationBanner {
    constructor({ checker, isWalletConnected, requestRender } = {}) {
        this.checker = checker || (window.FarmMigrationChecker ? new window.FarmMigrationChecker() : null);
        this.isWalletConnected = typeof isWalletConnected === 'function'
            ? isWalletConnected
            : () => false;
        this.requestRender = typeof requestRender === 'function'
            ? requestRender
            : () => {};
        this.checkNonce = 0;
        this.status = this.createStatus();
    }

    getConfig() {
        const config = window.CONFIG?.FARM_MIGRATION || {};

        return {
            enabled: config.ENABLED !== false,
            positionCheckEnabled: config.POSITION_CHECK_ENABLED !== false,
            hideWhenConnectedWalletHasNoPosition: config.HIDE_WHEN_CONNECTED_WALLET_HAS_NO_POSITION === true,
            oldFarmLabel: config.OLD_FARM_LABEL || 'Farm 1.0',
            oldFarmUrl: config.OLD_FARM_URL || '',
            oldFarmContracts: config.OLD_FARM_CONTRACTS || {},
            legacyLpTokens: config.LEGACY_LP_TOKENS || {}
        };
    }

    createStatus(overrides = {}) {
        return {
            state: 'idle',
            checked: false,
            checking: false,
            hasPosition: false,
            walletAddress: null,
            networkKey: null,
            stakeAmountRaw: '0',
            pendingRewardsRaw: '0',
            error: null,
            ...overrides
        };
    }

    reset() {
        this.checkNonce++;
        this.status = this.createStatus();
        this.requestRender();
    }

    render() {
        const {
            enabled,
            hideWhenConnectedWalletHasNoPosition,
            oldFarmLabel,
            oldFarmUrl
        } = this.getConfig();

        if (!enabled || !oldFarmUrl) {
            return '';
        }

        const status = this.status || this.createStatus();
        const walletConnected = this.isWalletConnected();

        if (
            walletConnected &&
            status.checked &&
            !status.hasPosition &&
            hideWhenConnectedWalletHasNoPosition
        ) {
            return '';
        }

        const hasMigrationPosition = walletConnected && status.checked && status.hasPosition;
        const bannerClass = hasMigrationPosition
            ? 'farm-migration-banner farm-migration-banner--position-found'
            : 'farm-migration-banner';
        const title = hasMigrationPosition
            ? `${oldFarmLabel} position found`
            : `${oldFarmLabel} migration is available`;
        const message = hasMigrationPosition
            ? `This wallet still has ${oldFarmLabel} LP or rewards to migrate.`
            : 'Open the old farm to unstake LP and claim any remaining rewards.';
        const statusBadge = hasMigrationPosition
            ? '<span class="farm-migration-banner-badge">Position detected</span>'
            : '';

        return `
            <section class="${bannerClass}" aria-labelledby="farm-migration-title">
                <div class="farm-migration-banner-content">
                    <span class="material-icons farm-migration-banner-icon" aria-hidden="true">moving</span>
                    <div class="farm-migration-banner-copy">
                        <div class="farm-migration-banner-heading">
                            <h2 id="farm-migration-title">${title}</h2>
                            ${statusBadge}
                        </div>
                        <p>${message}</p>
                    </div>
                </div>
                <a class="farm-migration-banner-link" href="${oldFarmUrl}" target="_blank" rel="noopener noreferrer">
                    <span>Open ${oldFarmLabel}</span>
                    <span class="material-icons" aria-hidden="true">open_in_new</span>
                </a>
            </section>
        `;
    }

    async checkPosition({ force = false } = {}) {
        const config = this.getConfig();
        const checker = this.checker;

        if (!config.enabled || !config.positionCheckEnabled || !checker) {
            this.status = this.createStatus();
            this.requestRender();
            return;
        }

        const networkKey = checker.getCurrentNetworkKey();
        const walletAddress = await checker.getConnectedWalletAddress();
        if (!walletAddress) {
            this.status = this.createStatus();
            this.requestRender();
            return;
        }

        if (
            !force &&
            this.status?.checked &&
            this.status.walletAddress?.toLowerCase?.() === walletAddress.toLowerCase() &&
            this.status.networkKey === networkKey
        ) {
            return;
        }

        const nonce = ++this.checkNonce;
        this.status = this.createStatus({
            state: 'checking',
            checking: true,
            walletAddress,
            networkKey
        });
        this.requestRender();

        try {
            const result = await checker.fetchPosition(config, walletAddress, networkKey);
            if (nonce !== this.checkNonce) {
                return;
            }

            this.status = this.createStatus({
                state: 'checked',
                checked: true,
                checking: false,
                hasPosition: result.hasPosition,
                walletAddress,
                networkKey,
                stakeAmountRaw: result.stakeAmountRaw,
                pendingRewardsRaw: result.pendingRewardsRaw
            });
        } catch (error) {
            if (nonce !== this.checkNonce) {
                return;
            }

            console.warn('Failed to check Farm 1.0 migration position:', error);
            this.status = this.createStatus({
                state: 'error',
                checked: false,
                checking: false,
                hasPosition: false,
                walletAddress,
                networkKey,
                error
            });
        }

        this.requestRender();
    }
}

window.FarmMigrationBanner = FarmMigrationBanner;
