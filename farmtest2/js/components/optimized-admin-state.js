/**
 * Optimized Admin State Manager - Performance Improvement
 * 
 * This module implements efficient state management for the admin panel:
 * - Map-based proposal storage for O(1) access
 * - Single action updates instead of full list refreshes
 * - Optimistic UI updates with rollback capability
 * - Per-action loading states
 * - Targeted DOM updates
 */

class OptimizedAdminState {
    constructor() {
        // Map-based storage for O(1) access instead of array-based
        this.proposalsMap = new Map();
        this.actionLoadingStates = new Map();
        this.optimisticUpdates = new Map();
        
        // Performance metrics
        this.metrics = {
            networkCalls: 0,
            uiUpdates: 0,
            fullRefreshes: 0,
            singleUpdates: 0,
            startTime: Date.now()
        };
        
        // Contract stats cache
        this.contractStats = {
            requiredApprovals: 2,
            actionCounter: 0
        };
        
        console.log('🚀 OptimizedAdminState initialized with Map-based storage');
    }

    /**
     * Initialize proposals from full data load (only on first load)
     */
    initializeProposals(proposalsArray) {
        console.log(`[STATE] 📊 Initializing ${proposalsArray.length} proposals in Map storage...`);
        
        this.proposalsMap.clear();
        proposalsArray.forEach(proposal => {
            this.proposalsMap.set(proposal.id, proposal);
        });
        
        this.metrics.fullRefreshes++;
        console.log(`[STATE] ✅ Initialized ${this.proposalsMap.size} proposals in Map`);
    }

    /**
     * Update single proposal efficiently (PERFORMANCE OPTIMIZATION)
     */
    updateSingleProposal(proposalId, updatedData) {
        console.log(`[STATE] 🎯 Updating single proposal ${proposalId}...`);
        
        const existingProposal = this.proposalsMap.get(proposalId);
        if (!existingProposal) {
            console.warn(`[STATE] ⚠️ Proposal ${proposalId} not found in state`);
            return false;
        }

        // Merge updated data with existing proposal
        const updatedProposal = {
            ...existingProposal,
            ...updatedData,
            lastUpdated: Date.now()
        };

        this.proposalsMap.set(proposalId, updatedProposal);
        this.metrics.singleUpdates++;
        
        console.log(`[STATE] ✅ Updated proposal ${proposalId}:`, {
            approvals: updatedProposal.approvals,
            status: updatedProposal.status,
            executed: updatedProposal.executed
        });
        
        return true;
    }

    /**
     * Apply optimistic update for immediate UI feedback
     */
    applyOptimisticUpdate(proposalId, action, userAddress) {
        console.log(`[STATE] ⚡ Applying optimistic ${action} for proposal ${proposalId}...`);
        
        const proposal = this.proposalsMap.get(proposalId);
        if (!proposal) return false;

        // Store original state for rollback
        this.optimisticUpdates.set(proposalId, {
            originalState: { ...proposal },
            action,
            timestamp: Date.now()
        });

        // Apply optimistic changes
        const optimisticChanges = {
            approvals: action === 'approve' ? proposal.approvals + 1 : proposal.approvals,
            status: this.calculateOptimisticStatus(proposal, action),
            hasUserApproved: action === 'approve' ? true : proposal.hasUserApproved,
            isOptimistic: true
        };

        this.updateSingleProposal(proposalId, optimisticChanges);
        return true;
    }

    /**
     * Rollback optimistic update if transaction fails
     */
    rollbackOptimisticUpdate(proposalId) {
        console.log(`[STATE] 🔄 Rolling back optimistic update for proposal ${proposalId}...`);
        
        const optimisticData = this.optimisticUpdates.get(proposalId);
        if (!optimisticData) {
            console.warn(`[STATE] ⚠️ No optimistic update found for proposal ${proposalId}`);
            return false;
        }

        // Restore original state
        this.proposalsMap.set(proposalId, optimisticData.originalState);
        this.optimisticUpdates.delete(proposalId);
        
        console.log(`[STATE] ✅ Rolled back proposal ${proposalId} to original state`);
        return true;
    }

    /**
     * Confirm optimistic update with real blockchain data
     */
    confirmOptimisticUpdate(proposalId, realData) {
        console.log(`[STATE] ✅ Confirming optimistic update for proposal ${proposalId}...`);
        
        // Remove optimistic flag and update with real data
        const confirmedData = {
            ...realData,
            isOptimistic: false,
            lastConfirmed: Date.now()
        };

        this.updateSingleProposal(proposalId, confirmedData);
        this.optimisticUpdates.delete(proposalId);
        
        return true;
    }

    /**
     * Set loading state for specific action
     */
    setActionLoading(proposalId, isLoading, action = null) {
        if (isLoading) {
            this.actionLoadingStates.set(proposalId, {
                loading: true,
                action,
                startTime: Date.now()
            });
        } else {
            this.actionLoadingStates.delete(proposalId);
        }
        
        console.log(`[STATE] 🔄 Set loading state for proposal ${proposalId}: ${isLoading}`);
    }

    /**
     * Get loading state for specific action
     */
    getActionLoading(proposalId) {
        return this.actionLoadingStates.get(proposalId) || { loading: false };
    }

    /**
     * Get all proposals as array for UI rendering
     */
    getAllProposals() {
        return Array.from(this.proposalsMap.values());
    }

    /**
     * Get single proposal by ID
     */
    getProposal(proposalId) {
        return this.proposalsMap.get(proposalId);
    }

    /**
     * Get filtered proposals (e.g., hide executed)
     */
    getFilteredProposals(hideExecuted = true) {
        const proposals = this.getAllProposals();
        
        if (hideExecuted) {
            return proposals.filter(p => !p.executed);
        }
        
        return proposals;
    }

    /**
     * Calculate optimistic status based on action
     */
    calculateOptimisticStatus(proposal, action) {
        if (action === 'approve') {
            const newApprovals = proposal.approvals + 1;
            if (newApprovals >= this.contractStats.requiredApprovals) {
                return 'ready-to-execute';
            }
            return 'pending';
        }
        
        if (action === 'reject') {
            return 'rejected';
        }
        
        return proposal.status;
    }

    /**
     * Update contract stats
     */
    updateContractStats(stats) {
        this.contractStats = { ...this.contractStats, ...stats };
        console.log(`[STATE] 📊 Updated contract stats:`, this.contractStats);
    }

    /**
     * Get performance metrics
     */
    getMetrics() {
        const runtime = Date.now() - this.metrics.startTime;
        return {
            ...this.metrics,
            runtime,
            proposalsCount: this.proposalsMap.size,
            optimisticUpdatesActive: this.optimisticUpdates.size,
            loadingActionsCount: this.actionLoadingStates.size,
            efficiency: {
                singleUpdateRatio: this.metrics.singleUpdates / Math.max(this.metrics.fullRefreshes, 1),
                avgNetworkCallsPerMinute: (this.metrics.networkCalls / runtime) * 60000
            }
        };
    }

    /**
     * Log performance metrics
     */
    logMetrics() {
        const metrics = this.getMetrics();
        console.log('📊 Admin State Performance Metrics:', metrics);
        
        if (metrics.efficiency.singleUpdateRatio > 5) {
            console.log('✅ Excellent performance: High single update ratio');
        } else if (metrics.efficiency.singleUpdateRatio > 2) {
            console.log('👍 Good performance: Moderate single update ratio');
        } else {
            console.log('⚠️ Performance warning: Low single update ratio');
        }
    }

    /**
     * Clear all state (for testing/reset)
     */
    clear() {
        this.proposalsMap.clear();
        this.actionLoadingStates.clear();
        this.optimisticUpdates.clear();
        this.metrics = {
            networkCalls: 0,
            uiUpdates: 0,
            fullRefreshes: 0,
            singleUpdates: 0,
            startTime: Date.now()
        };
        console.log('[STATE] 🧹 Cleared all state');
    }
}

// Export for use in admin panel
window.OptimizedAdminState = OptimizedAdminState;
