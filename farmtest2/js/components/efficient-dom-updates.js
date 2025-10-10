/**
 * Efficient DOM Update System - Performance Improvement
 * 
 * This module provides targeted DOM updates instead of full re-renders:
 * - Update only specific proposal rows
 * - Preserve scroll position and user interactions
 * - Minimize DOM manipulation for better performance
 * - Smart diffing to update only changed elements
 */

class EfficientDOMUpdates {
    constructor(adminState) {
        this.adminState = adminState;
        this.proposalRowCache = new Map();
        this.updateQueue = [];
        this.isProcessingQueue = false;
        
        console.log('🎨 EfficientDOMUpdates initialized');
    }

    /**
     * Update single proposal row instead of full table re-render
     */
    updateSingleProposalRow(proposalId, proposalData = null) {
        console.log(`[DOM] 🎯 Updating single proposal row ${proposalId}...`);
        
        const proposal = proposalData || this.adminState.getProposal(proposalId);
        if (!proposal) {
            console.warn(`[DOM] ⚠️ Proposal ${proposalId} not found in state`);
            return false;
        }

        const existingRow = document.querySelector(`[data-proposal-id="${proposalId}"]`);
        if (!existingRow) {
            console.warn(`[DOM] ⚠️ Proposal row ${proposalId} not found in DOM`);
            return false;
        }

        // Cache current row state for comparison
        const currentRowData = this.extractRowData(existingRow);
        
        // Check if update is needed (smart diffing)
        if (this.isRowDataEqual(currentRowData, proposal)) {
            console.log(`[DOM] ⏭️ No changes detected for proposal ${proposalId}, skipping update`);
            return true;
        }

        // Update specific elements within the row
        this.updateRowElements(existingRow, proposal, currentRowData);
        
        // Update cache
        this.proposalRowCache.set(proposalId, { ...proposal });
        
        console.log(`[DOM] ✅ Updated proposal row ${proposalId}`);
        return true;
    }

    /**
     * Update specific elements within a proposal row
     */
    updateRowElements(rowElement, proposal, currentData) {
        // Update approval count
        if (currentData.approvals !== proposal.approvals) {
            const approvalElement = rowElement.querySelector('.approval-count');
            if (approvalElement) {
                this.animateNumberChange(approvalElement, currentData.approvals, proposal.approvals);
            }
        }

        // Update progress bar
        const requiredApprovals = this.adminState.contractStats.requiredApprovals || 2;
        const newPercentage = (proposal.approvals / requiredApprovals) * 100;
        const currentPercentage = (currentData.approvals / requiredApprovals) * 100;
        
        if (Math.abs(newPercentage - currentPercentage) > 0.1) {
            const progressBar = rowElement.querySelector('.progress-fill');
            if (progressBar) {
                this.animateProgressBar(progressBar, currentPercentage, newPercentage);
            }
        }

        // Update status badge
        if (currentData.status !== proposal.status) {
            const statusBadge = rowElement.querySelector('.status-badge');
            if (statusBadge) {
                this.updateStatusBadge(statusBadge, proposal.status);
            }
        }

        // Update action buttons visibility/state
        this.updateActionButtons(rowElement, proposal, currentData);

        // Update timestamp if needed
        if (proposal.lastUpdated && proposal.lastUpdated !== currentData.lastUpdated) {
            const timestampElement = rowElement.querySelector('.last-updated');
            if (timestampElement) {
                timestampElement.textContent = this.formatTimestamp(proposal.lastUpdated);
                timestampElement.classList.add('updated-highlight');
                setTimeout(() => timestampElement.classList.remove('updated-highlight'), 2000);
            }
        }
    }

    /**
     * Animate number changes (e.g., approval count)
     */
    animateNumberChange(element, fromValue, toValue) {
        element.classList.add('number-changing');
        
        // Simple animation - could be enhanced with more sophisticated transitions
        setTimeout(() => {
            element.textContent = toValue;
            element.classList.remove('number-changing');
            element.classList.add('number-changed');
            
            setTimeout(() => element.classList.remove('number-changed'), 1000);
        }, 150);
    }

    /**
     * Animate progress bar changes
     */
    animateProgressBar(progressBar, fromPercentage, toPercentage) {
        progressBar.style.transition = 'width 0.3s ease-in-out';
        progressBar.style.width = `${Math.min(toPercentage, 100)}%`;
        
        // Add visual feedback for progress changes
        if (toPercentage > fromPercentage) {
            progressBar.classList.add('progress-increased');
            setTimeout(() => progressBar.classList.remove('progress-increased'), 500);
        }
    }

    /**
     * Update status badge with animation
     */
    updateStatusBadge(statusBadge, newStatus) {
        statusBadge.classList.add('status-changing');
        
        setTimeout(() => {
            statusBadge.textContent = newStatus;
            statusBadge.className = `status-badge ${newStatus}`;
            statusBadge.classList.add('status-changed');
            
            setTimeout(() => statusBadge.classList.remove('status-changed'), 1000);
        }, 150);
    }

    /**
     * Update action buttons based on proposal state
     */
    updateActionButtons(rowElement, proposal, currentData) {
        const approveBtn = rowElement.querySelector('.approve-btn');
        const rejectBtn = rowElement.querySelector('.reject-btn');
        const executeBtn = rowElement.querySelector('.execute-btn');

        // Update approve button
        if (approveBtn) {
            const shouldShow = !proposal.executed && !proposal.rejected && !proposal.hasUserApproved;
            this.toggleButtonVisibility(approveBtn, shouldShow);
        }

        // Update reject button
        if (rejectBtn) {
            const shouldShow = !proposal.executed && !proposal.rejected;
            this.toggleButtonVisibility(rejectBtn, shouldShow);
        }

        // Update execute button
        if (executeBtn) {
            const shouldShow = proposal.canExecute && !proposal.executed;
            this.toggleButtonVisibility(executeBtn, shouldShow);
            
            if (shouldShow && !currentData.canExecute) {
                executeBtn.classList.add('newly-available');
                setTimeout(() => executeBtn.classList.remove('newly-available'), 2000);
            }
        }
    }

    /**
     * Toggle button visibility with animation
     */
    toggleButtonVisibility(button, shouldShow) {
        if (shouldShow && button.style.display === 'none') {
            button.style.display = '';
            button.classList.add('button-appearing');
            setTimeout(() => button.classList.remove('button-appearing'), 300);
        } else if (!shouldShow && button.style.display !== 'none') {
            button.classList.add('button-disappearing');
            setTimeout(() => {
                button.style.display = 'none';
                button.classList.remove('button-disappearing');
            }, 300);
        }
    }

    /**
     * Extract current row data for comparison
     */
    extractRowData(rowElement) {
        const approvalElement = rowElement.querySelector('.approval-count');
        const statusBadge = rowElement.querySelector('.status-badge');
        const timestampElement = rowElement.querySelector('.last-updated');
        
        return {
            approvals: approvalElement ? parseInt(approvalElement.textContent) || 0 : 0,
            status: statusBadge ? statusBadge.textContent.trim() : 'unknown',
            lastUpdated: timestampElement ? timestampElement.dataset.timestamp : null,
            hasUserApproved: rowElement.querySelector('.approve-btn')?.style.display === 'none',
            canExecute: rowElement.querySelector('.execute-btn')?.style.display !== 'none'
        };
    }

    /**
     * Compare row data to determine if update is needed
     */
    isRowDataEqual(currentData, proposalData) {
        return (
            currentData.approvals === proposalData.approvals &&
            currentData.status === proposalData.status &&
            currentData.hasUserApproved === proposalData.hasUserApproved &&
            currentData.canExecute === proposalData.canExecute
        );
    }

    /**
     * Queue multiple updates for batch processing
     */
    queueUpdate(proposalId, proposalData) {
        this.updateQueue.push({ proposalId, proposalData, timestamp: Date.now() });
        
        if (!this.isProcessingQueue) {
            this.processUpdateQueue();
        }
    }

    /**
     * Process queued updates in batches for better performance
     */
    async processUpdateQueue() {
        if (this.isProcessingQueue || this.updateQueue.length === 0) return;
        
        this.isProcessingQueue = true;
        console.log(`[DOM] 📦 Processing ${this.updateQueue.length} queued updates...`);
        
        // Process updates in batches to avoid blocking UI
        const batchSize = 5;
        while (this.updateQueue.length > 0) {
            const batch = this.updateQueue.splice(0, batchSize);
            
            batch.forEach(({ proposalId, proposalData }) => {
                this.updateSingleProposalRow(proposalId, proposalData);
            });
            
            // Yield control to browser between batches
            if (this.updateQueue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        
        this.isProcessingQueue = false;
        console.log(`[DOM] ✅ Finished processing update queue`);
    }

    /**
     * Add new proposal row to DOM (for new proposals)
     */
    addProposalRow(proposal, insertPosition = 'top') {
        console.log(`[DOM] ➕ Adding new proposal row ${proposal.id}...`);
        
        const tableBody = document.querySelector('#proposals-table tbody');
        if (!tableBody) {
            console.error('[DOM] ❌ Proposals table body not found');
            return false;
        }

        const rowHTML = this.generateProposalRowHTML(proposal);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = rowHTML;
        const newRow = tempDiv.firstElementChild;

        if (insertPosition === 'top') {
            tableBody.insertBefore(newRow, tableBody.firstChild);
        } else {
            tableBody.appendChild(newRow);
        }

        // Add appearing animation
        newRow.classList.add('row-appearing');
        setTimeout(() => newRow.classList.remove('row-appearing'), 500);

        console.log(`[DOM] ✅ Added new proposal row ${proposal.id}`);
        return true;
    }

    /**
     * Remove proposal row from DOM
     */
    removeProposalRow(proposalId) {
        console.log(`[DOM] ➖ Removing proposal row ${proposalId}...`);
        
        const rowElement = document.querySelector(`[data-proposal-id="${proposalId}"]`);
        if (!rowElement) {
            console.warn(`[DOM] ⚠️ Proposal row ${proposalId} not found for removal`);
            return false;
        }

        // Add disappearing animation
        rowElement.classList.add('row-disappearing');
        setTimeout(() => {
            rowElement.remove();
            this.proposalRowCache.delete(proposalId);
        }, 300);

        console.log(`[DOM] ✅ Removed proposal row ${proposalId}`);
        return true;
    }

    /**
     * Generate HTML for a proposal row (used for new proposals)
     */
    generateProposalRowHTML(proposal) {
        const requiredApprovals = this.adminState.contractStats.requiredApprovals || 2;
        const progressPercentage = (proposal.approvals / requiredApprovals) * 100;
        
        return `
            <tr class="proposal-row" data-proposal-id="${proposal.id}">
                <td>#${proposal.id}</td>
                <td>${this.formatActionType(proposal.actionType)}</td>
                <td>${this.formatProposer(proposal.proposer)}</td>
                <td>
                    <div class="approval-progress">
                        <span class="approval-count">${proposal.approvals}</span>/${requiredApprovals}
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${Math.min(progressPercentage, 100)}%"></div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="status-badge ${proposal.status}">${proposal.status}</span>
                </td>
                <td>
                    <div class="action-buttons">
                        ${!proposal.hasUserApproved && !proposal.executed && !proposal.rejected ? `
                            <button class="btn btn-success btn-small approve-btn" data-action-id="${proposal.id}">
                                Approve
                            </button>
                        ` : ''}
                        ${!proposal.executed && !proposal.rejected ? `
                            <button class="btn btn-error btn-small reject-btn" data-action-id="${proposal.id}">
                                Reject
                            </button>
                        ` : ''}
                        ${proposal.canExecute ? `
                            <button class="btn btn-primary btn-small execute-btn" data-action-id="${proposal.id}">
                                Execute
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Format action type for display
     */
    formatActionType(actionType) {
        const types = {
            0: 'Set Reward Rate',
            1: 'Update Weights',
            2: 'Add Pair',
            3: 'Remove Pair',
            4: 'Change Signer',
            5: 'Withdraw Rewards'
        };
        return types[actionType] || `Type ${actionType}`;
    }

    /**
     * Format proposer address for display
     */
    formatProposer(address) {
        if (!address) return 'Unknown';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    /**
     * Format timestamp for display
     */
    formatTimestamp(timestamp) {
        return new Date(timestamp).toLocaleTimeString();
    }

    /**
     * Clear all cached row data
     */
    clearCache() {
        this.proposalRowCache.clear();
        this.updateQueue = [];
        console.log('[DOM] 🧹 Cleared DOM update cache');
    }

    /**
     * Get performance metrics
     */
    getMetrics() {
        return {
            cachedRows: this.proposalRowCache.size,
            queuedUpdates: this.updateQueue.length,
            isProcessingQueue: this.isProcessingQueue
        };
    }
}

// Export for use in admin panel
window.EfficientDOMUpdates = EfficientDOMUpdates;
