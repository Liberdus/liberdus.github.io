/**
 * AdminPage Component
 * Admin panel for managing staking platform
 */
class AdminPage extends BaseComponent {
    constructor() {
        super('#app-content');
        this.isAdmin = false;
        this.pendingActions = [];
        this.contractStats = {};
    }

    /**
     * Render admin page content
     */
    async render() {
        if (!this.isAdmin) {
            return this.renderAccessDenied();
        }

        return `
            <div class="container">
                ${this.renderHeader()}
                ${this.renderAdminContent()}
            </div>
        `;
    }

    /**
     * Render page header
     */
    renderHeader() {
        return `
            <div class="page-header">
                <h1>Admin Panel</h1>
                <p class="text-lg text-secondary">
                    Manage staking platform settings and multi-signature operations
                </p>
            </div>
        `;
    }

    /**
     * Render access denied message
     */
    renderAccessDenied() {
        return `
            <div class="container">
                <div class="card" style="max-width: 500px; margin: 2rem auto;">
                    <div class="card-body text-center">
                        <h2>Access Denied</h2>
                        <p>You don't have permission to access the admin panel.</p>
                        <p class="text-sm text-secondary">Only authorized signers can access this page.</p>
                        <button onclick="window.router.navigate('/')" class="btn btn-secondary">
                            Go Home
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render admin content
     */
    renderAdminContent() {
        return `
            <div class="admin-content">
                ${this.renderContractStats()}
                ${this.renderPendingActions()}
                ${this.renderAdminActions()}
            </div>
        `;
    }

    /**
     * Render contract statistics
     */
    renderContractStats() {
        return `
            <div class="contract-stats">
                <h2>Contract Statistics</h2>
                <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                    <div class="stat-card card">
                        <div class="card-body">
                            <h3 class="stat-title">Total Value Locked</h3>
                            <div class="stat-value">${window.Formatter?.formatUSD(this.contractStats.totalTVL) || '$0.00'}</div>
                            <div class="stat-label">Across all pairs</div>
                        </div>
                    </div>
                    <div class="stat-card card">
                        <div class="card-body">
                            <h3 class="stat-title">Active Pairs</h3>
                            <div class="stat-value">${this.contractStats.activePairs || 0}</div>
                            <div class="stat-label">Staking pairs</div>
                        </div>
                    </div>
                    <div class="stat-card card">
                        <div class="card-body">
                            <h3 class="stat-title">Total Stakers</h3>
                            <div class="stat-value">${this.contractStats.totalStakers || 0}</div>
                            <div class="stat-label">Unique addresses</div>
                        </div>
                    </div>
                    <div class="stat-card card">
                        <div class="card-body">
                            <h3 class="stat-title">Reward Rate</h3>
                            <div class="stat-value">${this.contractStats.hourlyRewardRate || 0}</div>
                            <div class="stat-label">Tokens per hour</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render pending multi-sig actions
     */
    renderPendingActions() {
        return `
            <div class="pending-actions">
                <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2>Pending Multi-Sig Actions</h2>
                    <button id="refresh-actions" class="btn btn-secondary">
                        <span>🔄</span>
                        Refresh
                    </button>
                </div>
                
                ${this.pendingActions.length === 0 ? this.renderNoPendingActions() : this.renderPendingActionsList()}
            </div>
        `;
    }

    /**
     * Render no pending actions message
     */
    renderNoPendingActions() {
        return `
            <div class="card">
                <div class="card-body text-center">
                    <h3>No Pending Actions</h3>
                    <p>There are currently no pending multi-signature actions.</p>
                </div>
            </div>
        `;
    }

    /**
     * Render pending actions list
     */
    renderPendingActionsList() {
        return `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Action Type</th>
                            <th>Proposed By</th>
                            <th>Created</th>
                            <th>Approvals</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.pendingActions.map(action => this.renderActionRow(action)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * Render individual action row
     */
    renderActionRow(action) {
        const approvalCount = action.approvals ? action.approvals.length : 0;
        const requiredApprovals = 3; // 3 out of 4 signers
        
        return `
            <tr>
                <td>
                    <div class="action-type">
                        <strong>${this.getActionTypeName(action.actionType)}</strong>
                        <div class="text-sm text-secondary">${action.description || ''}</div>
                    </div>
                </td>
                <td>
                    <div class="proposer">
                        ${window.Formatter?.formatAddress(action.proposer) || action.proposer}
                    </div>
                </td>
                <td>
                    <div class="created-time">
                        ${window.Formatter?.formatTimeAgo(action.createdAt) || 'Unknown'}
                    </div>
                </td>
                <td>
                    <div class="approvals">
                        <span class="approval-count">${approvalCount}/${requiredApprovals}</span>
                        <div class="approval-progress" style="width: 100px; height: 4px; background: var(--border-primary); border-radius: 2px; margin-top: 4px;">
                            <div style="width: ${(approvalCount / requiredApprovals) * 100}%; height: 100%; background: var(--primary-color); border-radius: 2px;"></div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="status-badge ${action.status}">${action.status}</span>
                </td>
                <td>
                    <div class="action-buttons">
                        ${!action.hasApproved ? `
                            <button 
                                class="btn btn-success btn-small approve-btn" 
                                data-action-id="${action.id}"
                            >
                                Approve
                            </button>
                        ` : ''}
                        <button 
                            class="btn btn-error btn-small reject-btn" 
                            data-action-id="${action.id}"
                        >
                            Reject
                        </button>
                        ${approvalCount >= requiredApprovals ? `
                            <button 
                                class="btn btn-primary btn-small execute-btn" 
                                data-action-id="${action.id}"
                            >
                                Execute
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Render admin actions section
     */
    renderAdminActions() {
        return `
            <div class="admin-actions">
                <h2>Admin Actions</h2>
                <div class="actions-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
                    
                    <div class="action-card card">
                        <div class="card-header">
                            <h3>Reward Rate</h3>
                        </div>
                        <div class="card-body">
                            <p>Update the hourly reward rate for all staking pairs.</p>
                            <button id="update-reward-rate" class="btn btn-primary btn-full">
                                Update Reward Rate
                            </button>
                        </div>
                    </div>
                    
                    <div class="action-card card">
                        <div class="card-header">
                            <h3>Pair Management</h3>
                        </div>
                        <div class="card-body">
                            <p>Add new staking pairs or update existing pair weights.</p>
                            <div style="display: flex; gap: 0.5rem;">
                                <button id="add-pair" class="btn btn-primary flex-1">
                                    Add Pair
                                </button>
                                <button id="update-weights" class="btn btn-secondary flex-1">
                                    Update Weights
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="action-card card">
                        <div class="card-header">
                            <h3>Signer Management</h3>
                        </div>
                        <div class="card-body">
                            <p>Add or remove multi-signature signers.</p>
                            <button id="manage-signers" class="btn btn-primary btn-full">
                                Manage Signers
                            </button>
                        </div>
                    </div>
                    
                    <div class="action-card card">
                        <div class="card-header">
                            <h3>Reward Withdrawal</h3>
                        </div>
                        <div class="card-body">
                            <p>Withdraw accumulated reward tokens from the contract.</p>
                            <button id="withdraw-rewards" class="btn btn-warning btn-full">
                                Withdraw Rewards
                            </button>
                        </div>
                    </div>
                    
                </div>
            </div>
        `;
    }

    /**
     * Get action type display name
     */
    getActionTypeName(actionType) {
        const names = {
            SET_HOURLY_REWARD_RATE: 'Update Reward Rate',
            UPDATE_PAIR_WEIGHTS: 'Update Pair Weights',
            ADD_PAIR: 'Add Staking Pair',
            REMOVE_PAIR: 'Remove Staking Pair',
            CHANGE_SIGNER: 'Change Signer',
            WITHDRAW_REWARDS: 'Withdraw Rewards'
        };
        return names[actionType] || actionType;
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Refresh actions button
        const refreshBtn = this.$('#refresh-actions');
        if (refreshBtn) {
            this.addEventListener(refreshBtn, 'click', () => {
                this.refreshPendingActions();
            });
        }

        // Admin action buttons
        const actionButtons = [
            { id: 'update-reward-rate', handler: () => this.showUpdateRewardRateModal() },
            { id: 'add-pair', handler: () => this.showAddPairModal() },
            { id: 'update-weights', handler: () => this.showUpdateWeightsModal() },
            { id: 'manage-signers', handler: () => this.showManageSignersModal() },
            { id: 'withdraw-rewards', handler: () => this.showWithdrawRewardsModal() }
        ];

        actionButtons.forEach(({ id, handler }) => {
            const btn = this.$(`#${id}`);
            if (btn) {
                this.addEventListener(btn, 'click', handler);
            }
        });

        // Pending action buttons
        this.$$('.approve-btn').forEach(btn => {
            this.addEventListener(btn, 'click', (e) => {
                const actionId = e.target.getAttribute('data-action-id');
                this.handleApproveAction(actionId);
            });
        });

        this.$$('.reject-btn').forEach(btn => {
            this.addEventListener(btn, 'click', (e) => {
                const actionId = e.target.getAttribute('data-action-id');
                this.handleRejectAction(actionId);
            });
        });

        this.$$('.execute-btn').forEach(btn => {
            this.addEventListener(btn, 'click', (e) => {
                const actionId = e.target.getAttribute('data-action-id');
                this.handleExecuteAction(actionId);
            });
        });
    }

    /**
     * Set up state subscriptions
     */
    setupStateSubscriptions() {
        // Subscribe to admin state changes
        this.subscribeToState('admin', (adminState) => {
            this.isAdmin = adminState.isAdmin;
            this.pendingActions = adminState.pendingActions || [];
            this.update();
        });

        // Subscribe to wallet changes
        this.subscribeToState('wallet', () => {
            this.checkAdminStatus();
        });
    }

    /**
     * Check if current user is admin
     */
    async checkAdminStatus() {
        // This will be implemented with contract integration
        // For now, assume connected wallet is admin
        const isConnected = this.getState('wallet.isConnected');
        this.isAdmin = isConnected;
        this.setState('admin.isAdmin', this.isAdmin);
    }

    /**
     * Refresh pending actions
     */
    async refreshPendingActions() {
        try {
            // This will be implemented with contract integration
            // Mock data for now
            this.pendingActions = [
                {
                    id: '1',
                    actionType: 'SET_HOURLY_REWARD_RATE',
                    proposer: '0x1234567890123456789012345678901234567890',
                    createdAt: Date.now() - 3600000, // 1 hour ago
                    approvals: ['0x1111111111111111111111111111111111111111'],
                    status: 'pending',
                    hasApproved: false,
                    description: 'Update rate to 100 tokens/hour'
                }
            ];
            
            this.setState('admin.pendingActions', this.pendingActions);
            window.notificationManager?.success('Actions Refreshed', 'Pending actions have been updated');
        } catch (error) {
            window.ErrorHandler?.handleNetworkError(error);
        }
    }

    /**
     * Handle approve action
     */
    async handleApproveAction(actionId) {
        try {
            // This will be implemented with contract integration
            console.log('Approve action:', actionId);
            window.notificationManager?.info('Coming Soon', 'Multi-sig approval will be implemented in Day 9');
        } catch (error) {
            window.ErrorHandler?.handleContractError(error);
        }
    }

    /**
     * Handle reject action
     */
    async handleRejectAction(actionId) {
        try {
            // This will be implemented with contract integration
            console.log('Reject action:', actionId);
            window.notificationManager?.info('Coming Soon', 'Multi-sig rejection will be implemented in Day 9');
        } catch (error) {
            window.ErrorHandler?.handleContractError(error);
        }
    }

    /**
     * Handle execute action
     */
    async handleExecuteAction(actionId) {
        try {
            // This will be implemented with contract integration
            console.log('Execute action:', actionId);
            window.notificationManager?.info('Coming Soon', 'Multi-sig execution will be implemented in Day 9');
        } catch (error) {
            window.ErrorHandler?.handleContractError(error);
        }
    }

    // Modal handlers (to be implemented with modal system)
    showUpdateRewardRateModal() {
        window.notificationManager?.info('Coming Soon', 'Reward rate modal will be implemented in Day 9');
    }

    showAddPairModal() {
        window.notificationManager?.info('Coming Soon', 'Add pair modal will be implemented in Day 9');
    }

    showUpdateWeightsModal() {
        window.notificationManager?.info('Coming Soon', 'Update weights modal will be implemented in Day 9');
    }

    showManageSignersModal() {
        window.notificationManager?.info('Coming Soon', 'Manage signers modal will be implemented in Day 9');
    }

    showWithdrawRewardsModal() {
        window.notificationManager?.info('Coming Soon', 'Withdraw rewards modal will be implemented in Day 9');
    }

    /**
     * Component lifecycle - after mount
     */
    async afterMount() {
        await this.checkAdminStatus();
        if (this.isAdmin) {
            await this.refreshPendingActions();
        }
    }
}

// Make available globally
window.AdminPage = AdminPage;
