/**
 * Optimistic UI Updates System - Performance Improvement
 * 
 * This module provides immediate UI feedback for user actions:
 * - Instant visual updates when buttons are clicked
 * - Loading states during blockchain transactions
 * - Rollback capability if transactions fail
 * - Success/error state management
 */

class OptimisticUIUpdates {
    constructor(adminState) {
        this.adminState = adminState;
        this.pendingTransactions = new Map();
        
        console.log('⚡ OptimisticUIUpdates initialized');
    }

    /**
     * Handle approve button click with optimistic update
     */
    async handleOptimisticApprove(proposalId, userAddress, contractManager) {
        console.log(`[OPTIMISTIC] 👍 Handling optimistic approve for proposal ${proposalId}...`);
        
        try {
            // 1. Apply optimistic update immediately
            this.adminState.applyOptimisticUpdate(proposalId, 'approve', userAddress);
            this.updateProposalRowOptimistically(proposalId, 'approve');
            
            // 2. Set loading state
            this.adminState.setActionLoading(proposalId, true, 'approve');
            this.showActionLoading(proposalId, 'approve');
            
            // 3. Execute blockchain transaction
            const transactionPromise = contractManager.approveAction(proposalId);
            this.pendingTransactions.set(proposalId, {
                action: 'approve',
                promise: transactionPromise,
                startTime: Date.now()
            });
            
            // 4. Wait for transaction result
            const result = await transactionPromise;
            
            // 5. Confirm optimistic update with real data
            await this.confirmTransactionSuccess(proposalId, 'approve', contractManager);
            
            return result;
            
        } catch (error) {
            console.error(`[OPTIMISTIC] ❌ Approve failed for proposal ${proposalId}:`, error);
            
            // Rollback optimistic update
            await this.rollbackTransaction(proposalId, 'approve', error);
            throw error;
        }
    }

    /**
     * Handle reject button click with optimistic update
     */
    async handleOptimisticReject(proposalId, userAddress, contractManager) {
        console.log(`[OPTIMISTIC] 👎 Handling optimistic reject for proposal ${proposalId}...`);
        
        try {
            // 1. Apply optimistic update immediately
            this.adminState.applyOptimisticUpdate(proposalId, 'reject', userAddress);
            this.updateProposalRowOptimistically(proposalId, 'reject');
            
            // 2. Set loading state
            this.adminState.setActionLoading(proposalId, true, 'reject');
            this.showActionLoading(proposalId, 'reject');
            
            // 3. Execute blockchain transaction
            const transactionPromise = contractManager.rejectAction(proposalId);
            this.pendingTransactions.set(proposalId, {
                action: 'reject',
                promise: transactionPromise,
                startTime: Date.now()
            });
            
            // 4. Wait for transaction result
            const result = await transactionPromise;
            
            // 5. Confirm optimistic update with real data
            await this.confirmTransactionSuccess(proposalId, 'reject', contractManager);
            
            return result;
            
        } catch (error) {
            console.error(`[OPTIMISTIC] ❌ Reject failed for proposal ${proposalId}:`, error);
            
            // Rollback optimistic update
            await this.rollbackTransaction(proposalId, 'reject', error);
            throw error;
        }
    }

    /**
     * Update proposal row in DOM optimistically
     */
    updateProposalRowOptimistically(proposalId, action) {
        console.log(`[OPTIMISTIC] 🎨 Updating UI optimistically for proposal ${proposalId} (${action})...`);
        
        const proposalRow = document.querySelector(`[data-proposal-id="${proposalId}"]`);
        if (!proposalRow) {
            console.warn(`[OPTIMISTIC] ⚠️ Proposal row not found for ID ${proposalId}`);
            return;
        }

        const proposal = this.adminState.getProposal(proposalId);
        if (!proposal) return;

        // Update approval count
        const approvalElement = proposalRow.querySelector('.approval-count');
        if (approvalElement) {
            approvalElement.textContent = proposal.approvals;
            approvalElement.classList.add('optimistic-update');
        }

        // Update progress bar
        const progressBar = proposalRow.querySelector('.progress-fill');
        if (progressBar) {
            const percentage = (proposal.approvals / this.adminState.contractStats.requiredApprovals) * 100;
            progressBar.style.width = `${Math.min(percentage, 100)}%`;
            progressBar.classList.add('optimistic-update');
        }

        // Update status badge
        const statusBadge = proposalRow.querySelector('.status-badge');
        if (statusBadge) {
            statusBadge.textContent = proposal.status;
            statusBadge.className = `status-badge ${proposal.status} optimistic-update`;
        }

        // Add optimistic styling
        proposalRow.classList.add('optimistic-update');
        
        console.log(`[OPTIMISTIC] ✅ Updated UI for proposal ${proposalId}`);
    }

    /**
     * Show loading state for specific action
     */
    showActionLoading(proposalId, action) {
        const proposalRow = document.querySelector(`[data-proposal-id="${proposalId}"]`);
        if (!proposalRow) return;

        const actionButton = proposalRow.querySelector(`.${action}-btn`);
        if (actionButton) {
            actionButton.disabled = true;
            actionButton.classList.add('loading');
            
            const originalText = actionButton.textContent;
            actionButton.dataset.originalText = originalText;
            actionButton.innerHTML = `
                <span class="loading-spinner"></span>
                ${action === 'approve' ? 'Approving...' : 'Rejecting...'}
            `;
        }

        // Add loading indicator to row
        proposalRow.classList.add('action-loading');
    }

    /**
     * Hide loading state
     */
    hideActionLoading(proposalId) {
        const proposalRow = document.querySelector(`[data-proposal-id="${proposalId}"]`);
        if (!proposalRow) return;

        // Remove loading from all buttons in this row
        const buttons = proposalRow.querySelectorAll('.btn.loading');
        buttons.forEach(button => {
            button.disabled = false;
            button.classList.remove('loading');
            
            if (button.dataset.originalText) {
                button.textContent = button.dataset.originalText;
                delete button.dataset.originalText;
            }
        });

        // Remove loading indicator from row
        proposalRow.classList.remove('action-loading');
        this.adminState.setActionLoading(proposalId, false);
    }

    /**
     * Confirm transaction success and update with real data
     */
    async confirmTransactionSuccess(proposalId, action, contractManager) {
        console.log(`[OPTIMISTIC] ✅ Confirming transaction success for proposal ${proposalId}...`);
        
        try {
            // Fetch real data from blockchain
            const realData = await contractManager.getSingleActionForUpdate(proposalId);
            
            // Confirm optimistic update with real data
            this.adminState.confirmOptimisticUpdate(proposalId, realData);
            
            // Update UI with confirmed data
            this.updateProposalRowWithRealData(proposalId, realData);
            
            // Hide loading state
            this.hideActionLoading(proposalId);
            
            // Show success feedback
            this.showActionSuccess(proposalId, action);
            
            // Clean up
            this.pendingTransactions.delete(proposalId);
            
        } catch (error) {
            console.error(`[OPTIMISTIC] ❌ Failed to confirm transaction:`, error);
            // If we can't fetch real data, keep optimistic state but remove loading
            this.hideActionLoading(proposalId);
        }
    }

    /**
     * Rollback transaction on failure
     */
    async rollbackTransaction(proposalId, action, error) {
        console.log(`[OPTIMISTIC] 🔄 Rolling back transaction for proposal ${proposalId}...`);
        
        // Rollback state
        this.adminState.rollbackOptimisticUpdate(proposalId);
        
        // Rollback UI
        this.rollbackProposalRowUI(proposalId);
        
        // Hide loading state
        this.hideActionLoading(proposalId);
        
        // Show error feedback
        this.showActionError(proposalId, action, error);
        
        // Clean up
        this.pendingTransactions.delete(proposalId);
    }

    /**
     * Update proposal row with confirmed blockchain data
     */
    updateProposalRowWithRealData(proposalId, realData) {
        const proposalRow = document.querySelector(`[data-proposal-id="${proposalId}"]`);
        if (!proposalRow) return;

        // Remove optimistic styling
        proposalRow.classList.remove('optimistic-update');
        proposalRow.querySelectorAll('.optimistic-update').forEach(el => {
            el.classList.remove('optimistic-update');
        });

        // Update with real data
        const approvalElement = proposalRow.querySelector('.approval-count');
        if (approvalElement) {
            approvalElement.textContent = realData.approvals;
        }

        const progressBar = proposalRow.querySelector('.progress-fill');
        if (progressBar) {
            const percentage = (realData.approvals / this.adminState.contractStats.requiredApprovals) * 100;
            progressBar.style.width = `${Math.min(percentage, 100)}%`;
        }

        const statusBadge = proposalRow.querySelector('.status-badge');
        if (statusBadge) {
            statusBadge.textContent = realData.status;
            statusBadge.className = `status-badge ${realData.status}`;
        }

        console.log(`[OPTIMISTIC] ✅ Updated UI with real data for proposal ${proposalId}`);
    }

    /**
     * Rollback proposal row UI to original state
     */
    rollbackProposalRowUI(proposalId) {
        const proposalRow = document.querySelector(`[data-proposal-id="${proposalId}"]`);
        if (!proposalRow) return;

        const originalProposal = this.adminState.getProposal(proposalId);
        if (!originalProposal) return;

        // Remove optimistic styling
        proposalRow.classList.remove('optimistic-update');
        proposalRow.querySelectorAll('.optimistic-update').forEach(el => {
            el.classList.remove('optimistic-update');
        });

        // Restore original values
        const approvalElement = proposalRow.querySelector('.approval-count');
        if (approvalElement) {
            approvalElement.textContent = originalProposal.approvals;
        }

        const progressBar = proposalRow.querySelector('.progress-fill');
        if (progressBar) {
            const percentage = (originalProposal.approvals / this.adminState.contractStats.requiredApprovals) * 100;
            progressBar.style.width = `${Math.min(percentage, 100)}%`;
        }

        const statusBadge = proposalRow.querySelector('.status-badge');
        if (statusBadge) {
            statusBadge.textContent = originalProposal.status;
            statusBadge.className = `status-badge ${originalProposal.status}`;
        }

        console.log(`[OPTIMISTIC] 🔄 Rolled back UI for proposal ${proposalId}`);
    }

    /**
     * Show success feedback
     */
    showActionSuccess(proposalId, action) {
        if (window.notificationManager) {
            const message = action === 'approve' 
                ? `Successfully approved proposal #${proposalId}` 
                : `Successfully rejected proposal #${proposalId}`;
            window.notificationManager.success('Action Completed', message);
        }
    }

    /**
     * Show error feedback
     */
    showActionError(proposalId, action, error) {
        if (window.notificationManager) {
            const message = action === 'approve' 
                ? `Failed to approve proposal #${proposalId}: ${error.message}` 
                : `Failed to reject proposal #${proposalId}: ${error.message}`;
            window.notificationManager.error('Action Failed', message);
        }
    }

    /**
     * Get pending transactions count
     */
    getPendingTransactionsCount() {
        return this.pendingTransactions.size;
    }

    /**
     * Cancel all pending transactions (for cleanup)
     */
    cancelAllPendingTransactions() {
        this.pendingTransactions.clear();
        console.log('[OPTIMISTIC] 🧹 Cancelled all pending transactions');
    }
}

// Export for use in admin panel
window.OptimisticUIUpdates = OptimisticUIUpdates;
