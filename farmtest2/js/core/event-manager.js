/**
 * EventManager - Real-time contract event handling system
 * Listens for StakeAdded, StakeRemoved, RewardsClaimed events
 * Provides event filtering, processing, and state synchronization
 *
 * ENHANCED SINGLETON PATTERN - Completely prevents redeclaration errors
 */
(function(global) {
    'use strict';

    // CRITICAL FIX: Enhanced redeclaration prevention with instance management
    if (global.EventManager) {
        console.warn('EventManager class already exists, skipping redeclaration');
        return;
    }

    // Check for existing instance and preserve it
    if (global.eventManager) {
        console.warn('EventManager instance already exists, preserving existing instance');
        return;
    }

class EventManager {
    constructor() {
        // Event listeners and filters
        this.eventListeners = new Map(); // Map of eventName -> Set of listeners
        this.contractFilters = new Map(); // Map of contract -> Set of filters
        this.activeSubscriptions = new Map(); // Map of subscriptionId -> subscription data
        
        // Event processing
        this.eventQueue = [];
        this.isProcessing = false;
        this.processingDelay = 100; // ms between event processing
        
        // Configuration
        this.config = {
            maxRetries: 3,
            retryDelay: 1000,
            batchSize: 10,
            enableRealTime: true,
            enableBatching: true,
            maxQueueSize: 1000
        };
        
        // State references
        this.contractManager = null;
        this.stateManager = null;
        
        // Event definitions
        this.eventDefinitions = {
            StakeAdded: {
                signature: 'StakeAdded(address,address,uint256)',
                handler: this.handleStakeAdded.bind(this)
            },
            StakeRemoved: {
                signature: 'StakeRemoved(address,address,uint256)',
                handler: this.handleStakeRemoved.bind(this)
            },
            RewardsClaimed: {
                signature: 'RewardsClaimed(address,address,uint256)',
                handler: this.handleRewardsClaimed.bind(this)
            },
            Transfer: {
                signature: 'Transfer(address,address,uint256)',
                handler: this.handleTransfer.bind(this)
            },
            Approval: {
                signature: 'Approval(address,address,uint256)',
                handler: this.handleApproval.bind(this)
            }
        };
        
        this.log('EventManager initialized');
    }

    // ==================== INITIALIZATION ====================

    /**
     * Initialize EventManager with contract and state managers
     */
    async initialize(contractManager, stateManager) {
        try {
            this.contractManager = contractManager;
            this.stateManager = stateManager;
            
            if (!this.contractManager || !this.stateManager) {
                throw new Error('ContractManager and StateManager are required');
            }

            // Set up event listeners for all supported events (may skip if in fallback mode)
            await this.setupEventListeners();

            // Start event processing queue
            this.startEventProcessing();

            // Log initialization status
            if (this.contractManager.isFallback) {
                this.log('EventManager initialized in fallback mode (no contract events)');
            } else {
                this.log('EventManager initialized with full contract event support');
            }
            
            this.log('EventManager initialized successfully');
            return true;
        } catch (error) {
            this.logError('Failed to initialize EventManager:', error);
            throw error;
        }
    }

    /**
     * Set up event listeners for all contract events
     */
    async setupEventListeners() {
        try {
            // Check if ContractManager exists and is ready
            if (!this.contractManager) {
                this.log('ContractManager not available - skipping event listener setup');
                return;
            }
            
            // Check if ContractManager has isReady method and is ready
            if (typeof this.contractManager.isReady !== 'function') {
                this.log('ContractManager isReady method not available - skipping event listener setup');
                return;
            }
            
            if (!this.contractManager.isReady()) {
                if (this.contractManager.isFallback) {
                    this.log('ContractManager is in fallback mode - skipping event listener setup');
                    return; // Gracefully skip event setup for fallback mode
                } else {
                    this.log('ContractManager is not ready - skipping event listener setup');
                    return; // Don't throw error, just skip
                }
            }

            // Try to get contracts - may be null in fallback mode
            let stakingContract, rewardTokenContract;
            try {
                stakingContract = this.contractManager.getStakingContract();
                rewardTokenContract = this.contractManager.getRewardTokenContract();
            } catch (error) {
                this.log('Contracts not available - skipping event listener setup:', error.message);
                return;
            }
            
            // Set up staking contract event listeners
            await this.setupStakingEventListeners(stakingContract);
            
            // Set up reward token event listeners
            await this.setupTokenEventListeners(rewardTokenContract, 'REWARD_TOKEN');
            
            // Set up LP token event listeners
            await this.setupLPTokenEventListeners();
            
            this.log('All event listeners set up successfully');
        } catch (error) {
            this.logError('Failed to setup event listeners:', error);
            throw error;
        }
    }

    /**
     * Set up staking contract specific event listeners
     */
    async setupStakingEventListeners(stakingContract) {
        try {
            // StakeAdded event
            const stakeAddedFilter = stakingContract.filters.StakeAdded();
            stakingContract.on(stakeAddedFilter, (user, lpToken, amount, event) => {
                this.queueEvent('StakeAdded', {
                    user,
                    lpToken,
                    amount: amount.toString(),
                    blockNumber: event.blockNumber,
                    transactionHash: event.transactionHash,
                    timestamp: Date.now()
                });
            });
            
            // StakeRemoved event
            const stakeRemovedFilter = stakingContract.filters.StakeRemoved();
            stakingContract.on(stakeRemovedFilter, (user, lpToken, amount, event) => {
                this.queueEvent('StakeRemoved', {
                    user,
                    lpToken,
                    amount: amount.toString(),
                    blockNumber: event.blockNumber,
                    transactionHash: event.transactionHash,
                    timestamp: Date.now()
                });
            });
            
            // RewardsClaimed event
            const rewardsClaimedFilter = stakingContract.filters.RewardsClaimed();
            stakingContract.on(rewardsClaimedFilter, (user, lpToken, amount, event) => {
                this.queueEvent('RewardsClaimed', {
                    user,
                    lpToken,
                    amount: amount.toString(),
                    blockNumber: event.blockNumber,
                    transactionHash: event.transactionHash,
                    timestamp: Date.now()
                });
            });
            
            this.log('Staking contract event listeners set up');
        } catch (error) {
            this.logError('Failed to setup staking event listeners:', error);
        }
    }

    /**
     * Set up token contract event listeners
     */
    async setupTokenEventListeners(tokenContract, tokenType) {
        try {
            // Transfer event
            const transferFilter = tokenContract.filters.Transfer();
            tokenContract.on(transferFilter, (from, to, amount, event) => {
                this.queueEvent('Transfer', {
                    from,
                    to,
                    amount: amount.toString(),
                    tokenType,
                    blockNumber: event.blockNumber,
                    transactionHash: event.transactionHash,
                    timestamp: Date.now()
                });
            });
            
            // Approval event
            const approvalFilter = tokenContract.filters.Approval();
            tokenContract.on(approvalFilter, (owner, spender, amount, event) => {
                this.queueEvent('Approval', {
                    owner,
                    spender,
                    amount: amount.toString(),
                    tokenType,
                    blockNumber: event.blockNumber,
                    transactionHash: event.transactionHash,
                    timestamp: Date.now()
                });
            });
            
            this.log(`${tokenType} event listeners set up`);
        } catch (error) {
            this.logError(`Failed to setup ${tokenType} event listeners:`, error);
        }
    }

    /**
     * Set up LP token event listeners for all supported pairs
     */
    async setupLPTokenEventListeners() {
        try {
            const lpTokenContracts = this.contractManager.lpTokenContracts;
            
            for (const [pairName, lpContract] of lpTokenContracts.entries()) {
                await this.setupTokenEventListeners(lpContract, `LP_${pairName}`);
            }
            
            this.log('LP token event listeners set up for all pairs');
        } catch (error) {
            this.logError('Failed to setup LP token event listeners:', error);
        }
    }

    // ==================== EVENT PROCESSING ====================

    /**
     * Queue event for processing
     */
    queueEvent(eventName, eventData) {
        try {
            if (this.eventQueue.length >= this.config.maxQueueSize) {
                this.log('Event queue full, removing oldest event');
                this.eventQueue.shift();
            }
            
            const queuedEvent = {
                id: this.generateEventId(),
                name: eventName,
                data: eventData,
                queuedAt: Date.now(),
                processed: false,
                retries: 0
            };
            
            this.eventQueue.push(queuedEvent);
            this.log('Event queued:', eventName, queuedEvent.id);
            
            // Process immediately if real-time is enabled
            if (this.config.enableRealTime && !this.isProcessing) {
                this.processEventQueue();
            }
        } catch (error) {
            this.logError('Failed to queue event:', eventName, error);
        }
    }

    /**
     * Start event processing loop
     */
    startEventProcessing() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        this.processEventQueue();
        
        // Set up periodic processing for batched events
        if (this.config.enableBatching) {
            setInterval(() => {
                if (this.eventQueue.length > 0) {
                    this.processEventQueue();
                }
            }, this.processingDelay * 10);
        }
        
        this.log('Event processing started');
    }

    /**
     * Process queued events
     */
    async processEventQueue() {
        if (this.eventQueue.length === 0) {
            this.isProcessing = false;
            return;
        }
        
        try {
            const batchSize = this.config.enableBatching ? this.config.batchSize : 1;
            const eventsToProcess = this.eventQueue.splice(0, batchSize);
            
            for (const event of eventsToProcess) {
                await this.processEvent(event);
            }
            
            // Continue processing if more events exist
            if (this.eventQueue.length > 0) {
                setTimeout(() => this.processEventQueue(), this.processingDelay);
            } else {
                this.isProcessing = false;
            }
        } catch (error) {
            this.logError('Error processing event queue:', error);
            this.isProcessing = false;
        }
    }

    /**
     * Process individual event
     */
    async processEvent(event) {
        try {
            this.log('Processing event:', event.name, event.id);

            const eventDefinition = this.eventDefinitions[event.name];
            if (!eventDefinition) {
                this.log('Unknown event type:', event.name);
                return;
            }

            // Call event handler
            await eventDefinition.handler(event.data);

            // Mark as processed
            event.processed = true;
            event.processedAt = Date.now();

            // Notify event listeners
            this.notifyEventListeners(event.name, event.data);

            this.log('Event processed successfully:', event.name, event.id);
        } catch (error) {
            this.logError('Error processing event:', event.name, event.id, error);

            // Retry logic
            if (event.retries < this.config.maxRetries) {
                event.retries++;
                this.eventQueue.push(event); // Re-queue for retry
                this.log('Event re-queued for retry:', event.name, event.id, event.retries);
            } else {
                this.logError('Event failed after max retries:', event.name, event.id);
            }
        }
    }

    // ==================== EVENT HANDLERS ====================

    /**
     * Handle StakeAdded event
     */
    async handleStakeAdded(eventData) {
        try {
            const { user, lpToken, amount } = eventData;
            const currentUser = this.stateManager.get('wallet.address');

            // Update state if this affects current user
            if (user.toLowerCase() === currentUser?.toLowerCase()) {
                // Update user's stake amount
                const currentStake = this.stateManager.get(`staking.stakes.${lpToken}`) || '0';
                const newStake = (parseFloat(ethers.formatEther(currentStake)) + parseFloat(ethers.formatEther(amount))).toString();

                this.stateManager.set(`staking.stakes.${lpToken}`, newStake);

                // Refresh user's LP token balance
                await this.refreshUserBalance(lpToken);

                // Show notification
                this.stateManager.set('ui.notifications', [
                    ...this.stateManager.get('ui.notifications'),
                    {
                        id: this.generateEventId(),
                        type: 'success',
                        title: 'Stake Added',
                        message: `Successfully staked ${ethers.formatEther(amount)} LP tokens`,
                        timestamp: Date.now()
                    }
                ]);
            }

            // Update pool data
            await this.refreshPoolData(lpToken);

            this.log('StakeAdded event handled:', eventData);
        } catch (error) {
            this.logError('Error handling StakeAdded event:', error);
        }
    }

    /**
     * Handle StakeRemoved event
     */
    async handleStakeRemoved(eventData) {
        try {
            const { user, lpToken, amount } = eventData;
            const currentUser = this.stateManager.get('wallet.address');

            // Update state if this affects current user
            if (user.toLowerCase() === currentUser?.toLowerCase()) {
                // Update user's stake amount
                const currentStake = this.stateManager.get(`staking.stakes.${lpToken}`) || '0';
                const newStake = Math.max(0, parseFloat(ethers.formatEther(currentStake)) - parseFloat(ethers.formatEther(amount))).toString();

                this.stateManager.set(`staking.stakes.${lpToken}`, newStake);

                // Refresh user's LP token balance
                await this.refreshUserBalance(lpToken);

                // Show notification
                this.stateManager.set('ui.notifications', [
                    ...this.stateManager.get('ui.notifications'),
                    {
                        id: this.generateEventId(),
                        type: 'success',
                        title: 'Stake Removed',
                        message: `Successfully unstaked ${ethers.formatEther(amount)} LP tokens`,
                        timestamp: Date.now()
                    }
                ]);
            }

            // Update pool data
            await this.refreshPoolData(lpToken);

            this.log('StakeRemoved event handled:', eventData);
        } catch (error) {
            this.logError('Error handling StakeRemoved event:', error);
        }
    }

    /**
     * Handle RewardsClaimed event
     */
    async handleRewardsClaimed(eventData) {
        try {
            const { user, lpToken, amount } = eventData;
            const currentUser = this.stateManager.get('wallet.address');

            // Update state if this affects current user
            if (user.toLowerCase() === currentUser?.toLowerCase()) {
                // Reset pending rewards for this LP token
                this.stateManager.set(`staking.rewards.${lpToken}`, '0');

                // Refresh reward token balance
                await this.refreshRewardTokenBalance();

                // Show notification
                this.stateManager.set('ui.notifications', [
                    ...this.stateManager.get('ui.notifications'),
                    {
                        id: this.generateEventId(),
                        type: 'success',
                        title: 'Rewards Claimed',
                        message: `Successfully claimed ${ethers.formatEther(amount)} reward tokens`,
                        timestamp: Date.now()
                    }
                ]);
            }

            this.log('RewardsClaimed event handled:', eventData);
        } catch (error) {
            this.logError('Error handling RewardsClaimed event:', error);
        }
    }

    /**
     * Handle Transfer event
     */
    async handleTransfer(eventData) {
        try {
            const { from, to, amount, tokenType } = eventData;
            const currentUser = this.stateManager.get('wallet.address');

            // Update balances if current user is involved
            if (from.toLowerCase() === currentUser?.toLowerCase() || to.toLowerCase() === currentUser?.toLowerCase()) {
                if (tokenType === 'REWARD_TOKEN') {
                    await this.refreshRewardTokenBalance();
                } else if (tokenType.startsWith('LP_')) {
                    const pairName = tokenType.replace('LP_', '');
                    await this.refreshUserBalance(this.contractManager.contractAddresses.get(`LP_${pairName}`));
                }
            }

            this.log('Transfer event handled:', eventData);
        } catch (error) {
            this.logError('Error handling Transfer event:', error);
        }
    }

    /**
     * Handle Approval event
     */
    async handleApproval(eventData) {
        try {
            const { owner, spender, amount, tokenType } = eventData;
            const currentUser = this.stateManager.get('wallet.address');
            const stakingAddress = this.contractManager.contractAddresses.get('STAKING');

            // Update allowances if current user approved staking contract
            if (owner.toLowerCase() === currentUser?.toLowerCase() && spender.toLowerCase() === stakingAddress?.toLowerCase()) {
                if (tokenType.startsWith('LP_')) {
                    const pairName = tokenType.replace('LP_', '');
                    this.stateManager.set(`staking.allowances.${pairName}`, ethers.formatEther(amount));
                }
            }

            this.log('Approval event handled:', eventData);
        } catch (error) {
            this.logError('Error handling Approval event:', error);
        }
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Refresh user's LP token balance
     */
    async refreshUserBalance(lpTokenAddress) {
        try {
            const currentUser = this.stateManager.get('wallet.address');
            if (!currentUser) return;

            // Find pair name from address
            let pairName = null;
            for (const [key, address] of this.contractManager.contractAddresses.entries()) {
                if (key.startsWith('LP_') && address.toLowerCase() === lpTokenAddress.toLowerCase()) {
                    pairName = key.replace('LP_', '');
                    break;
                }
            }

            if (pairName) {
                const balance = await this.contractManager.getLPTokenBalance(currentUser, pairName);
                this.stateManager.set(`staking.balances.${pairName}`, balance);
            }
        } catch (error) {
            this.logError('Error refreshing user balance:', error);
        }
    }

    /**
     * Refresh reward token balance
     */
    async refreshRewardTokenBalance() {
        try {
            const currentUser = this.stateManager.get('wallet.address');
            if (!currentUser) return;

            const rewardContract = this.contractManager.getRewardTokenContract();
            const balance = await rewardContract.balanceOf(currentUser);
            this.stateManager.set('wallet.balance', ethers.formatEther(balance));
        } catch (error) {
            this.logError('Error refreshing reward token balance:', error);
        }
    }

    /**
     * Refresh pool data
     */
    async refreshPoolData(lpTokenAddress) {
        try {
            const poolInfo = await this.contractManager.getPoolInfo(lpTokenAddress);

            // Find pair name from address
            let pairName = null;
            for (const [key, address] of this.contractManager.contractAddresses.entries()) {
                if (key.startsWith('LP_') && address.toLowerCase() === lpTokenAddress.toLowerCase()) {
                    pairName = key.replace('LP_', '');
                    break;
                }
            }

            if (pairName) {
                this.stateManager.set(`pools.poolData.${pairName}`, poolInfo);
            }
        } catch (error) {
            this.logError('Error refreshing pool data:', error);
        }
    }

    // ==================== EVENT SUBSCRIPTION SYSTEM ====================

    /**
     * Subscribe to specific event type
     */
    addEventListener(eventName, callback) {
        try {
            if (typeof callback !== 'function') {
                throw new Error('Callback must be a function');
            }

            if (!this.eventListeners.has(eventName)) {
                this.eventListeners.set(eventName, new Set());
            }

            const listener = {
                id: this.generateEventId(),
                callback,
                eventName,
                created: Date.now()
            };

            this.eventListeners.get(eventName).add(listener);

            this.log('Event listener added:', eventName, listener.id);

            // Return unsubscribe function
            return () => this.removeEventListener(eventName, listener.id);
        } catch (error) {
            this.logError('Error adding event listener:', eventName, error);
            return () => {};
        }
    }

    /**
     * Remove event listener
     */
    removeEventListener(eventName, listenerId) {
        try {
            const listeners = this.eventListeners.get(eventName);
            if (listeners) {
                for (const listener of listeners) {
                    if (listener.id === listenerId) {
                        listeners.delete(listener);
                        this.log('Event listener removed:', eventName, listenerId);

                        // Clean up empty listener sets
                        if (listeners.size === 0) {
                            this.eventListeners.delete(eventName);
                        }
                        return true;
                    }
                }
            }
            return false;
        } catch (error) {
            this.logError('Error removing event listener:', eventName, listenerId, error);
            return false;
        }
    }

    /**
     * Notify all event listeners
     */
    notifyEventListeners(eventName, eventData) {
        try {
            const listeners = this.eventListeners.get(eventName);
            if (!listeners) return;

            for (const listener of listeners) {
                try {
                    listener.callback(eventData, eventName);
                } catch (error) {
                    this.logError('Event listener callback error:', eventName, error);
                }
            }
        } catch (error) {
            this.logError('Error notifying event listeners:', eventName, error);
        }
    }

    /**
     * Get event queue status
     */
    getQueueStatus() {
        return {
            queueLength: this.eventQueue.length,
            isProcessing: this.isProcessing,
            totalListeners: Array.from(this.eventListeners.values()).reduce((sum, set) => sum + set.size, 0),
            activeSubscriptions: this.activeSubscriptions.size
        };
    }

    /**
     * Generate unique event ID
     */
    generateEventId() {
        return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Clear event queue
     */
    clearEventQueue() {
        this.eventQueue = [];
        this.log('Event queue cleared');
    }

    /**
     * Pause event processing
     */
    pauseProcessing() {
        this.isProcessing = false;
        this.log('Event processing paused');
    }

    /**
     * Resume event processing
     */
    resumeProcessing() {
        if (!this.isProcessing && this.eventQueue.length > 0) {
            this.startEventProcessing();
            this.log('Event processing resumed');
        }
    }

    /**
     * Get processed events history
     */
    getEventHistory(limit = 50) {
        return this.eventQueue
            .filter(event => event.processed)
            .slice(-limit)
            .map(event => ({
                id: event.id,
                name: event.name,
                data: event.data,
                processedAt: event.processedAt,
                retries: event.retries
            }));
    }

    /**
     * Cleanup EventManager
     */
    cleanup() {
        try {
            // Clear event queue
            this.clearEventQueue();

            // Remove all event listeners
            this.eventListeners.clear();

            // Clear active subscriptions
            this.activeSubscriptions.clear();

            // Clear contract filters
            this.contractFilters.clear();

            // Reset processing state
            this.isProcessing = false;

            // Clear references
            this.contractManager = null;
            this.stateManager = null;

            this.log('EventManager cleaned up');
        } catch (error) {
            this.logError('Error during EventManager cleanup:', error);
        }
    }

    /**
     * Logging utility
     */
    log(...args) {
        if (window.CONFIG?.DEV?.DEBUG_MODE) {
            console.log('[EventManager]', ...args);
        }
    }

    /**
     * Error logging utility
     */
    logError(...args) {
        console.error('[EventManager]', ...args);
    }
}

    // Export EventManager class to global scope
    global.EventManager = EventManager;

    // Note: Instance creation is now handled by SystemInitializer
    console.log('✅ EventManager class loaded');

})(window);
