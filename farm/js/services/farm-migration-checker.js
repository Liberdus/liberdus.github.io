/**
 * Read-only Farm 1.0 position checker.
 * Reuses ContractManager providers, ABI storage, and fallback reads when available.
 */
class FarmMigrationChecker {
    getCurrentNetworkKey() {
        return window.networkSelector?.getSelectedNetworkKey?.() || null;
    }

    async getConnectedWalletAddress() {
        const contractManager = window.contractManager;

        if (typeof contractManager?.getCurrentSignerForPermissions === 'function') {
            const address = await contractManager.getCurrentSignerForPermissions();
            if (address) {
                return address;
            }
        }

        return window.walletManager?.currentAccount ||
            window.walletManager?.getAddress?.() ||
            window.walletManager?.address ||
            null;
    }

    getOldFarmContractAddress(config, networkKey) {
        if (!networkKey) {
            return null;
        }

        return config.oldFarmContracts?.[networkKey] || null;
    }

    getLegacyLpTokens(config, networkKey) {
        const configuredTokens = config.legacyLpTokens?.[networkKey];

        if (!Array.isArray(configuredTokens)) {
            return [];
        }

        return configuredTokens.filter(Boolean);
    }

    getProvider(networkKey) {
        const contractManager = window.contractManager;
        if (contractManager?.provider) {
            return contractManager.provider;
        }

        if (window.walletManager?.provider) {
            return window.walletManager.provider;
        }

        const networkConfig = window.CONFIG?.NETWORKS?.[networkKey];
        const rpcUrl = networkConfig?.RPC_URL || networkConfig?.FALLBACK_RPCS?.[0];
        if (rpcUrl && typeof contractManager?.getRpcProvider === 'function') {
            return contractManager.getRpcProvider(rpcUrl);
        }

        return null;
    }

    async withProviderFallback(operation, networkKey) {
        const contractManager = window.contractManager;

        if (contractManager?.provider && typeof contractManager.executeWithProviderFallback === 'function') {
            return contractManager.executeWithProviderFallback(
                operation,
                'FarmMigrationChecker.checkPosition',
                2
            );
        }

        const provider = this.getProvider(networkKey);
        if (!provider) {
            return null;
        }

        return operation(provider, null);
    }

    getStakingAbi() {
        return window.contractManager?.contractABIs?.get?.('STAKING') ||
            window.CONFIG?.ABIS?.STAKING_CONTRACT ||
            null;
    }

    createOldFarmContract(oldFarmAddress, provider) {
        const ethers = window.ethers;
        const stakingAbi = this.getStakingAbi();

        if (!ethers?.Contract || !stakingAbi || !oldFarmAddress || !provider) {
            return null;
        }

        return new ethers.Contract(oldFarmAddress, stakingAbi, provider);
    }

    getPairAddress(pair) {
        return pair?.lpToken || pair?.[0] || null;
    }

    getUniqueLpTokens(pairs, legacyTokens) {
        const tokens = new Set();

        if (Array.isArray(pairs)) {
            pairs.forEach((pair) => {
                const pairAddress = this.getPairAddress(pair);

                if (pairAddress) {
                    tokens.add(pairAddress);
                }
            });
        }

        legacyTokens.forEach((token) => tokens.add(token));

        return [...tokens];
    }

    toBigNumber(value) {
        return window.ethers.BigNumber.from(value || 0);
    }

    async callView(contractCall, blockTag) {
        return blockTag
            ? contractCall({ blockTag })
            : contractCall();
    }

    async readPositionForProvider(config, walletAddress, networkKey, provider, blockTag) {
        const oldFarmAddress = this.getOldFarmContractAddress(config, networkKey);
        const oldFarmContract = this.createOldFarmContract(oldFarmAddress, provider);
        if (!oldFarmContract) {
            return { hasPosition: false, stakeAmountRaw: '0', pendingRewardsRaw: '0' };
        }

        const pairs = await this.callView((overrides) => oldFarmContract.getPairs(overrides), blockTag);
        const lpTokens = this.getUniqueLpTokens(pairs, this.getLegacyLpTokens(config, networkKey));
        let totalStake = this.toBigNumber(0);
        let totalRewards = this.toBigNumber(0);

        await Promise.all(lpTokens.map(async (lpToken) => {
            try {
                const stakeInfo = blockTag
                    ? await oldFarmContract.getUserStakeInfo(walletAddress, lpToken, { blockTag })
                    : await oldFarmContract.getUserStakeInfo(walletAddress, lpToken);
                const amount = this.toBigNumber(stakeInfo?.amount ?? stakeInfo?.[0] ?? 0);
                const pendingRewards = this.toBigNumber(stakeInfo?.pendingRewards ?? stakeInfo?.[1] ?? 0);
                totalStake = totalStake.add(amount);
                totalRewards = totalRewards.add(pendingRewards);
            } catch (error) {
                console.warn('Failed to check Farm 1.0 position for LP token:', lpToken, error);
            }
        }));

        return {
            hasPosition: totalStake.gt(0) || totalRewards.gt(0),
            stakeAmountRaw: totalStake.toString(),
            pendingRewardsRaw: totalRewards.toString()
        };
    }

    async fetchPosition(config, walletAddress, networkKey) {
        if (!this.getOldFarmContractAddress(config, networkKey) || !window.ethers?.BigNumber) {
            return { hasPosition: false, stakeAmountRaw: '0', pendingRewardsRaw: '0' };
        }

        return await this.withProviderFallback(
            (provider, blockTag) => this.readPositionForProvider(config, walletAddress, networkKey, provider, blockTag),
            networkKey
        ) || { hasPosition: false, stakeAmountRaw: '0', pendingRewardsRaw: '0' };
    }
}

window.FarmMigrationChecker = FarmMigrationChecker;
