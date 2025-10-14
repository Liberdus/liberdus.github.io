/**
 * CacheIntegration - Wrapper functions for integrating UnifiedCache with contract calls
 * Provides cached versions of all major contract methods
 * 
 * @version 1.0.0
 */
(function(global) {
    'use strict';

    // Prevent redeclaration
    if (global.CacheIntegration) {
        console.warn('⚠️ CacheIntegration already exists, skipping redeclaration');
        return;
    }

    class CacheIntegration {
        constructor() {
            this.cache = null;
            this.contractManager = null;
            this.isInitialized = false;
        }

        /**
         * Initialize with cache and contract manager instances
         */
        initialize(cache, contractManager) {
            this.cache = cache || global.unifiedCache;
            this.contractManager = contractManager || global.contractManager;
            
            if (!this.cache) {
                console.error('❌ UnifiedCache not available');
                return false;
            }
            
            if (!this.contractManager) {
                console.warn('⚠️ ContractManager not available yet, will retry on first use');
            }
            
            this.isInitialized = true;
            console.log('✅ CacheIntegration initialized');
            return true;
        }

        /**
         * Ensure contract manager is available
         */
        ensureContractManager() {
            if (!this.contractManager) {
                this.contractManager = global.contractManager;
            }
            return this.contractManager;
        }

        // ============ USER DATA METHODS ============

        /**
         * Get user balances with caching
         */
        async getUserBalances(userAddress) {
            const cm = this.ensureContractManager();
            if (!cm) return null;

            return await this.cache.getWithRefresh(
                'userBalances',
                () => cm.getUserBalances(userAddress),
                { address: userAddress }
            );
        }

        /**
         * Get user stake info with caching
         */
        async getUserStakeInfo(userAddress, lpToken) {
            const cm = this.ensureContractManager();
            if (!cm) return null;

            return await this.cache.getWithRefresh(
                'userStakes',
                () => cm.getUserStakeInfo(userAddress, lpToken),
                { address: userAddress, pairAddress: lpToken }
            );
        }

        /**
         * Get pending rewards with caching
         */
        async getPendingRewards(userAddress, lpToken) {
            const cm = this.ensureContractManager();
            if (!cm) return null;

            return await this.cache.getWithRefresh(
                'userRewards',
                () => cm.getPendingRewards(userAddress, lpToken),
                { address: userAddress, pairAddress: lpToken }
            );
        }

        /**
         * Get user allowance with caching
         */
        async getUserAllowance(userAddress, tokenAddress) {
            const cm = this.ensureContractManager();
            if (!cm) return null;

            return await this.cache.getWithRefresh(
                'userAllowances',
                () => cm.getAllowance(tokenAddress, userAddress),
                { address: userAddress, pairAddress: tokenAddress }
            );
        }

        // ============ PAIR/POOL DATA METHODS ============

        /**
         * Get pair info with caching
         */
        async getPairInfo(lpToken) {
            const cm = this.ensureContractManager();
            if (!cm) return null;

            return await this.cache.getWithRefresh(
                'pairInfo',
                () => cm.getPairInfo(lpToken),
                { pairAddress: lpToken }
            );
        }

        /**
         * Get all pairs with caching
         */
        async getAllPairs() {
            const cm = this.ensureContractManager();
            if (!cm) return null;

            return await this.cache.getWithRefresh(
                'pairList',
                () => cm.getPairs()
            );
        }

        /**
         * Get TVL for a pair with caching
         */
        async getTVL(lpToken) {
            const cm = this.ensureContractManager();
            if (!cm) return null;

            return await this.cache.getWithRefresh(
                'tvlData',
                () => cm.getTVL(lpToken),
                { pairAddress: lpToken }
            );
        }

        // ============ CONTRACT DATA METHODS ============

        /**
         * Get contract stats with caching
         */
        async getContractStats() {
            const cm = this.ensureContractManager();
            if (!cm) return null;

            return await this.cache.getWithRefresh(
                'contractStats',
                () => cm.getContractStats()
            );
        }

        /**
         * Get hourly reward rate with caching
         */
        async getHourlyRewardRate() {
            const cm = this.ensureContractManager();
            if (!cm) return null;

            return await this.cache.getWithRefresh(
                'hourlyRate',
                () => cm.getHourlyRewardRate()
            );
        }

        /**
         * Get required approvals with caching
         */
        async getRequiredApprovals() {
            const cm = this.ensureContractManager();
            if (!cm) return null;

            return await this.cache.getWithRefresh(
                'requiredApprovals',
                () => cm.getRequiredApprovals()
            );
        }

        // ============ ADMIN/GOVERNANCE METHODS ============

        /**
         * Get all proposals with caching
         */
        async getAllActions() {
            const cm = this.ensureContractManager();
            if (!cm) return null;

            return await this.cache.getWithRefresh(
                'proposals',
                () => cm.getAllActions()
            );
        }

        /**
         * Get single action with caching
         */
        async getAction(actionId) {
            const cm = this.ensureContractManager();
            if (!cm) return null;

            return await this.cache.getWithRefresh(
                'proposalDetails',
                () => cm.getSingleActionForUpdate(actionId),
                { id: actionId }
            );
        }

        /**
         * Get action counter with caching
         */
        async getActionCounter() {
            const cm = this.ensureContractManager();
            if (!cm) return null;

            return await this.cache.getWithRefresh(
                'actionCounter',
                () => cm.getActionCounter()
            );
        }

        // ============ PRICE DATA METHODS ============

        /**
         * Get token price with caching
         */
        async getTokenPrice(tokenSymbol) {
            if (!global.priceFeeds) return null;

            return await this.cache.getWithRefresh(
                'tokenPrices',
                () => global.priceFeeds.getTokenPrice(tokenSymbol),
                { id: tokenSymbol }
            );
        }

        /**
         * Get LP token price with caching
         */
        async getLPTokenPrice(pairAddress) {
            if (!global.priceFeeds) return null;

            return await this.cache.getWithRefresh(
                'lpPrices',
                () => global.priceFeeds.getLPTokenPrice(pairAddress),
                { pairAddress: pairAddress }
            );
        }

        // ============ CACHE MANAGEMENT METHODS ============

        /**
         * Invalidate user-specific cache after transactions
         */
        invalidateUserCache(userAddress) {
            this.cache.invalidateType('userBalances');
            this.cache.invalidateType('userStakes');
            this.cache.invalidateType('userRewards');
            this.cache.invalidateType('userAllowances');
            console.log(`🗑️ Invalidated user cache for ${userAddress}`);
        }

        /**
         * Invalidate pool/pair cache after updates
         */
        invalidatePoolCache(lpToken = null) {
            if (lpToken) {
                this.cache.invalidate('pairInfo', { pairAddress: lpToken });
                this.cache.invalidate('tvlData', { pairAddress: lpToken });
            } else {
                this.cache.invalidateType('pairInfo');
                this.cache.invalidateType('tvlData');
                this.cache.invalidateType('pairList');
            }
            console.log(`🗑️ Invalidated pool cache`);
        }

        /**
         * Invalidate proposal cache after governance actions
         */
        invalidateProposalCache(actionId = null) {
            if (actionId) {
                this.cache.invalidate('proposalDetails', { id: actionId });
            } else {
                this.cache.invalidateType('proposals');
                this.cache.invalidateType('proposalDetails');
            }
            this.cache.invalidateType('actionCounter');
            console.log(`🗑️ Invalidated proposal cache`);
        }

        /**
         * Invalidate contract stats cache
         */
        invalidateContractCache() {
            this.cache.invalidateType('contractStats');
            this.cache.invalidateType('hourlyRate');
            console.log(`🗑️ Invalidated contract cache`);
        }
    }

    // Create singleton instance
    const cacheIntegration = new CacheIntegration();
    
    // Expose to global scope
    global.CacheIntegration = CacheIntegration;
    global.cacheIntegration = cacheIntegration;
    
    console.log('✅ CacheIntegration module loaded');

})(window);

