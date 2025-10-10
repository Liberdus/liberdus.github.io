
(function(global) {
    'use strict';

    if (global.StakingModal) {
        return;
    }

class StakingModal extends BaseComponent {
    constructor() {
        super();
        this.isOpen = false;
        this.currentTab = 'stake';
        this.pairData = null;
        this.currentPairId = null;
        this.modalElement = null;
        this.overlayElement = null;
        

        this.userBalances = {
            lpToken: '0',
            stakedAmount: '0',
            pendingRewards: '0',
            allowance: '0'
        };
        
        // Input validation
        this.validation = {
            minStakeAmount: 0.001,
            maxStakeAmount: null, // Will be set based on balance
            minUnstakeAmount: 0.001,
            isValidating: false
        };
        
        // Transaction state
        this.transactionState = {
            isProcessing: false,
            currentOperation: null,
            txHash: null,
            error: null
        };
        
        // Animation settings
        this.animationDuration = 300;
        this.slideAnimationDuration = 200;
        
        // Tab configuration
        this.tabs = [
            { id: 'stake', label: 'Stake', icon: '📈' },
            { id: 'unstake', label: 'Unstake', icon: '📉' },
            { id: 'claim', label: 'Claim', icon: '🎁' }
        ];
        
        this.log('StakingModal initialized with enhanced features');
    }

    /**
     * Initialize modal system
     */
    initialize() {
        this.injectModalStyles();
        this.createModalStructure();
        this.setupEventListeners();
        this.log('StakingModal initialization complete');
    }

    /**
     * Open modal for specific pair
     */
    async open(pairId, pairData = null) {
        if (this.isOpen) {
            this.log('Modal already open');
            return;
        }

        this.currentPairId = pairId;
        this.pairData = pairData || await this.loadPairData(pairId);
        
        if (!this.overlayElement) {
            this.initialize();
        }

        // Update modal content with pair data
        this.updateModalContent();
        
        // Load user balances
        await this.loadUserBalances();
        
        // Show modal with animation
        this.overlayElement.classList.add('active');
        this.isOpen = true;
        
        // Focus first input
        setTimeout(() => {
            const firstInput = this.modalElement.querySelector('.staking-amount-input');
            if (firstInput) {
                firstInput.focus();
            }
        }, this.animationDuration);
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        this.log(`Modal opened for pair: ${pairId}`);
    }

    /**
     * Close modal
     */
    close() {
        if (!this.isOpen) {
            return;
        }

        // Hide modal with animation
        this.overlayElement.classList.remove('active');
        this.isOpen = false;
        
        // Reset transaction state
        this.resetTransactionState();
        
        // Restore body scroll
        document.body.style.overflow = '';
        
        // Clear form data after animation
        setTimeout(() => {
            this.clearFormData();
        }, this.animationDuration);
        
        this.log('Modal closed');
    }

    /**
     * Switch to specific tab
     */
    switchTab(tabId) {
        if (this.currentTab === tabId) {
            return;
        }

        // Update tab buttons
        const tabButtons = this.modalElement.querySelectorAll('.staking-modal-tab');
        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        // Update tab content
        const tabContents = this.modalElement.querySelectorAll('.staking-tab-content');
        tabContents.forEach(content => {
            content.style.display = content.dataset.tabContent === tabId ? 'block' : 'none';
        });

        this.currentTab = tabId;
        
        // Reset form state for new tab
        this.resetFormState();
        
        this.log(`Switched to tab: ${tabId}`);
    }

    /**
     * Update modal content with pair data
     */
    updateModalContent() {
        if (!this.pairData) return;

        // Update title
        const titleElement = this.modalElement.querySelector('.pair-name');
        if (titleElement) {
            titleElement.textContent = `${this.pairData.name} Staking`;
        }

        // Update pair icon if available
        const iconElement = this.modalElement.querySelector('.pair-icon');
        if (iconElement && this.pairData.icon) {
            iconElement.textContent = this.pairData.icon;
        }
    }

    /**
     * Load user balances for current pair
     */
    async loadUserBalances() {
        try {
            if (!global.contractManager || !this.currentPairId) {
                this.log('ContractManager not available or no pair selected');
                return;
            }

            // Get user balances from contract manager
            const balances = await global.contractManager.getUserBalances(this.currentPairId);
            
            this.userBalances = {
                lpToken: balances.lpToken || '0',
                stakedAmount: balances.staked || '0',
                pendingRewards: balances.pendingRewards || '0',
                allowance: balances.allowance || '0'
            };

            // Update UI with new balances
            this.updateBalanceDisplays();
            
            this.log('User balances loaded:', this.userBalances);
        } catch (error) {
            this.log('Error loading user balances:', error);
            
            // Use mock data for development
            this.userBalances = {
                lpToken: '100.0',
                stakedAmount: '25.0',
                pendingRewards: '0.0234',
                allowance: '1000000'
            };
            
            this.updateBalanceDisplays();
        }
    }

    /**
     * Update balance displays in UI
     */
    updateBalanceDisplays() {
        // Available balance
        const availableBalance = this.modalElement.querySelector('#available-balance');
        if (availableBalance) {
            availableBalance.textContent = `${parseFloat(this.userBalances.lpToken).toFixed(4)} LP`;
        }

        // Staked balance
        const stakedBalance = this.modalElement.querySelector('#staked-balance');
        if (stakedBalance) {
            stakedBalance.textContent = `${parseFloat(this.userBalances.stakedAmount).toFixed(4)} LP`;
        }

        // Pending rewards
        const pendingRewards = this.modalElement.querySelector('#pending-rewards');
        if (pendingRewards) {
            pendingRewards.textContent = `${parseFloat(this.userBalances.pendingRewards).toFixed(4)} LIB`;
        }

        // Update validation limits
        this.validation.maxStakeAmount = parseFloat(this.userBalances.lpToken);
        
        // Enable/disable buttons based on balances
        this.updateButtonStates();
    }

    /**
     * Update button states based on balances and validation
     */
    updateButtonStates() {
        // Stake button
        const stakeButton = this.modalElement.querySelector('#stake-button');
        const stakeInput = this.modalElement.querySelector('#stake-amount-input');
        if (stakeButton && stakeInput) {
            const amount = parseFloat(stakeInput.value) || 0;
            const hasBalance = parseFloat(this.userBalances.lpToken) > 0;
            const isValidAmount = amount >= this.validation.minStakeAmount && amount <= this.validation.maxStakeAmount;
            stakeButton.disabled = !hasBalance || !isValidAmount || this.transactionState.isProcessing;
        }

        // Unstake button
        const unstakeButton = this.modalElement.querySelector('#unstake-button');
        const unstakeInput = this.modalElement.querySelector('#unstake-amount-input');
        if (unstakeButton && unstakeInput) {
            const amount = parseFloat(unstakeInput.value) || 0;
            const hasStaked = parseFloat(this.userBalances.stakedAmount) > 0;
            const isValidAmount = amount >= this.validation.minUnstakeAmount && amount <= parseFloat(this.userBalances.stakedAmount);
            unstakeButton.disabled = !hasStaked || !isValidAmount || this.transactionState.isProcessing;
        }

        // Claim button
        const claimButton = this.modalElement.querySelector('#claim-button');
        if (claimButton) {
            const hasRewards = parseFloat(this.userBalances.pendingRewards) > 0;
            claimButton.disabled = !hasRewards || this.transactionState.isProcessing;
        }
    }

    /**
     * Handle percentage button clicks
     */
    handlePercentageClick(percentage, tabType) {
        const maxAmount = tabType === 'stake' ? 
            parseFloat(this.userBalances.lpToken) : 
            parseFloat(this.userBalances.stakedAmount);
        
        const amount = percentage === 100 ? maxAmount : (maxAmount * percentage / 100);
        
        // Update input
        const input = this.modalElement.querySelector(`#${tabType}-amount-input`);
        if (input) {
            input.value = amount.toFixed(4);
            this.validateInput(input, tabType);
        }

        // Update slider
        const slider = this.modalElement.querySelector(`#${tabType}-slider`);
        if (slider) {
            slider.value = percentage;
        }

        // Update percentage button states
        const buttons = this.modalElement.querySelectorAll(`[data-tab-content="${tabType}"] .staking-percentage-btn`);
        buttons.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.percentage) === percentage);
        });
    }

    /**
     * Handle slider input
     */
    handleSliderInput(slider, tabType) {
        const percentage = parseInt(slider.value);
        const maxAmount = tabType === 'stake' ? 
            parseFloat(this.userBalances.lpToken) : 
            parseFloat(this.userBalances.stakedAmount);
        
        const amount = (maxAmount * percentage / 100);
        
        // Update input
        const input = this.modalElement.querySelector(`#${tabType}-amount-input`);
        if (input) {
            input.value = amount.toFixed(4);
            this.validateInput(input, tabType);
        }

        // Update percentage button states
        const buttons = this.modalElement.querySelectorAll(`[data-tab-content="${tabType}"] .staking-percentage-btn`);
        buttons.forEach(btn => {
            const btnPercentage = parseInt(btn.dataset.percentage);
            btn.classList.toggle('active', Math.abs(btnPercentage - percentage) < 5);
        });
    }

    /**
     * Validate input amount
     */
    validateInput(input, tabType) {
        const amount = parseFloat(input.value) || 0;
        const errorElement = this.modalElement.querySelector(`#${tabType}-error`);
        
        let isValid = true;
        let errorMessage = '';

        if (amount <= 0) {
            isValid = false;
            errorMessage = 'Amount must be greater than 0';
        } else if (tabType === 'stake') {
            if (amount < this.validation.minStakeAmount) {
                isValid = false;
                errorMessage = `Minimum stake amount is ${this.validation.minStakeAmount}`;
            } else if (amount > parseFloat(this.userBalances.lpToken)) {
                isValid = false;
                errorMessage = 'Insufficient balance';
            }
        } else if (tabType === 'unstake') {
            if (amount < this.validation.minUnstakeAmount) {
                isValid = false;
                errorMessage = `Minimum unstake amount is ${this.validation.minUnstakeAmount}`;
            } else if (amount > parseFloat(this.userBalances.stakedAmount)) {
                isValid = false;
                errorMessage = 'Insufficient staked balance';
            }
        }

        // Update UI
        input.classList.toggle('error', !isValid);
        
        if (errorElement) {
            errorElement.textContent = errorMessage;
            errorElement.style.display = errorMessage ? 'block' : 'none';
        }

        // Update button states
        this.updateButtonStates();

        return isValid;
    }

    /**
     * Execute stake operation
     */
    async executeStake() {
        const input = this.modalElement.querySelector('#stake-amount-input');
        const amount = parseFloat(input.value) || 0;

        if (!this.validateInput(input, 'stake')) {
            return;
        }

        try {
            this.setTransactionState('processing', 'stake');
            
            // Check allowance first
            if (parseFloat(this.userBalances.allowance) < amount) {
                await this.requestApproval(amount);
            }

            // Execute stake transaction
            const txHash = await this.performStakeTransaction(amount);
            
            this.setTransactionState('success', 'stake', txHash);
            
            // Refresh balances
            await this.loadUserBalances();
            
            // Show success notification
            if (global.notificationManager) {
                global.notificationManager.success(`Successfully staked ${amount.toFixed(4)} LP tokens!`);
            }
            
        } catch (error) {
            this.setTransactionState('error', 'stake', null, error.message);
            
            if (global.notificationManager) {
                global.notificationManager.error(`Staking failed: ${error.message}`);
            }
        }
    }

    /**
     * Execute unstake operation
     */
    async executeUnstake() {
        const input = this.modalElement.querySelector('#unstake-amount-input');
        const amount = parseFloat(input.value) || 0;

        if (!this.validateInput(input, 'unstake')) {
            return;
        }

        try {
            this.setTransactionState('processing', 'unstake');
            
            // Execute unstake transaction
            const txHash = await this.performUnstakeTransaction(amount);
            
            this.setTransactionState('success', 'unstake', txHash);
            
            // Refresh balances
            await this.loadUserBalances();
            
            // Show success notification
            if (global.notificationManager) {
                global.notificationManager.success(`Successfully unstaked ${amount.toFixed(4)} LP tokens!`);
            }
            
        } catch (error) {
            this.setTransactionState('error', 'unstake', null, error.message);
            
            if (global.notificationManager) {
                global.notificationManager.error(`Unstaking failed: ${error.message}`);
            }
        }
    }

    /**
     * Execute claim operation
     */
    async executeClaim() {
        try {
            this.setTransactionState('processing', 'claim');
            
            // Execute claim transaction
            const txHash = await this.performClaimTransaction();
            
            this.setTransactionState('success', 'claim', txHash);
            
            // Refresh balances
            await this.loadUserBalances();
            
            // Show success notification
            if (global.notificationManager) {
                global.notificationManager.success(`Successfully claimed ${this.userBalances.pendingRewards} LIB rewards!`);
            }
            
        } catch (error) {
            this.setTransactionState('error', 'claim', null, error.message);
            
            if (global.notificationManager) {
                global.notificationManager.error(`Claiming failed: ${error.message}`);
            }
        }
    }

    /**
     * Set transaction state and update UI
     */
    setTransactionState(state, operation, txHash = null, error = null) {
        this.transactionState = {
            isProcessing: state === 'processing',
            currentOperation: operation,
            txHash,
            error
        };

        // Update button states
        const button = this.modalElement.querySelector(`#${operation}-button`);
        const spinner = button?.querySelector('.staking-loading-spinner');
        const buttonText = button?.querySelector('.button-text');
        const statusElement = this.modalElement.querySelector(`#${operation}-transaction-status`);
        const statusText = this.modalElement.querySelector(`#${operation}-tx-status`);
        const hashElement = this.modalElement.querySelector(`#${operation}-tx-hash`);

        if (button) {
            button.disabled = state === 'processing';
        }

        if (spinner) {
            spinner.style.display = state === 'processing' ? 'block' : 'none';
        }

        if (buttonText) {
            if (state === 'processing') {
                buttonText.textContent = `Processing ${operation}...`;
            } else {
                const defaultTexts = {
                    stake: 'Stake Tokens',
                    unstake: 'Unstake Tokens',
                    claim: '🎁 Claim Rewards'
                };
                buttonText.textContent = defaultTexts[operation];
            }
        }

        if (statusElement) {
            statusElement.style.display = (state === 'processing' || txHash) ? 'block' : 'none';
        }

        if (statusText) {
            const statusTexts = {
                processing: 'Pending',
                success: 'Confirmed',
                error: 'Failed'
            };
            statusText.textContent = statusTexts[state] || 'Unknown';
        }

        if (hashElement && txHash) {
            hashElement.textContent = txHash;
        }

        // Update all button states
        this.updateButtonStates();
    }

    /**
     * Reset transaction state
     */
    resetTransactionState() {
        this.transactionState = {
            isProcessing: false,
            currentOperation: null,
            txHash: null,
            error: null
        };

        // Hide all transaction status elements
        const statusElements = this.modalElement.querySelectorAll('.staking-transaction-status');
        statusElements.forEach(el => el.style.display = 'none');
    }

    /**
     * Reset form state
     */
    resetFormState() {
        // Clear inputs
        const inputs = this.modalElement.querySelectorAll('.staking-amount-input');
        inputs.forEach(input => {
            input.value = '';
            input.classList.remove('error');
        });

        // Reset sliders
        const sliders = this.modalElement.querySelectorAll('.staking-slider');
        sliders.forEach(slider => slider.value = 0);

        // Reset percentage buttons
        const percentageButtons = this.modalElement.querySelectorAll('.staking-percentage-btn');
        percentageButtons.forEach(btn => btn.classList.remove('active'));

        // Hide error messages
        const errorMessages = this.modalElement.querySelectorAll('.staking-error-message');
        errorMessages.forEach(msg => msg.style.display = 'none');

        // Update button states
        this.updateButtonStates();
    }

    /**
     * Clear all form data
     */
    clearFormData() {
        this.resetFormState();
        this.resetTransactionState();
        this.currentPairId = null;
        this.pairData = null;
    }

    /**
     * Load pair data (mock implementation)
     */
    async loadPairData(pairId) {
        // Mock pair data - in real implementation, this would fetch from contract
        return {
            id: pairId,
            name: 'LIB-USDT',
            icon: '🔗',
            apr: '25.5%',
            tvl: '$150,000'
        };
    }

    /**
     * Request token approval (mock implementation)
     */
    async requestApproval(amount) {
        this.log(`Requesting approval for ${amount} tokens`);
        
        // Mock approval - in real implementation, this would call contract
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        this.userBalances.allowance = '1000000'; // Set high allowance
        return true;
    }

    /**
     * Perform stake transaction (real blockchain implementation)
     */
    async performStakeTransaction(amount) {
        this.log(`📈 Performing stake transaction for ${amount} tokens`);

        if (!window.contractManager) {
            throw new Error('Contract manager not available');
        }

        if (!this.currentPair || !this.currentPair.address) {
            throw new Error('No pair selected for staking');
        }

        // Call contract manager to stake tokens
        const result = await window.contractManager.stake(this.currentPair.address, amount);

        if (!result.success) {
            throw new Error(result.error || 'Stake transaction failed');
        }

        this.log(`✅ Stake transaction successful: ${result.hash}`);
        return result.hash;
    }

    /**
     * Perform unstake transaction (real blockchain implementation)
     */
    async performUnstakeTransaction(amount) {
        this.log(`📉 Performing unstake transaction for ${amount} tokens`);

        if (!window.contractManager) {
            throw new Error('Contract manager not available');
        }

        if (!this.currentPair || !this.currentPair.address) {
            throw new Error('No pair selected for unstaking');
        }

        // Call contract manager to unstake tokens
        const result = await window.contractManager.unstake(this.currentPair.address, amount);

        if (!result.success) {
            throw new Error(result.error || 'Unstake transaction failed');
        }

        this.log(`✅ Unstake transaction successful: ${result.hash}`);
        return result.hash;
    }

    /**
     * Perform claim transaction (real blockchain implementation)
     */
    async performClaimTransaction() {
        this.log(`🎁 Performing claim transaction`);

        if (!window.contractManager) {
            throw new Error('Contract manager not available');
        }

        if (!this.currentPair || !this.currentPair.address) {
            throw new Error('No pair selected for claiming');
        }

        // Call contract manager to claim rewards
        const result = await window.contractManager.claimRewards(this.currentPair.address);

        if (!result.success) {
            throw new Error(result.error || 'Claim transaction failed');
        }

        this.log(`✅ Claim transaction successful: ${result.hash}`);
        return result.hash;
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const mockTxHash = `0x${Math.random().toString(16).substr(2, 64)}`;
        return mockTxHash;
    }

    /**
     * Setup event listeners for modal interactions
     */
    setupEventListeners() {
        if (!this.overlayElement || !this.modalElement) {
            this.log('Modal elements not available for event setup');
            return;
        }

        // Close modal on overlay click
        this.overlayElement.addEventListener('click', (e) => {
            if (e.target === this.overlayElement) {
                this.close();
            }
        });

        // Close modal on close button click
        const closeButton = this.modalElement.querySelector('.staking-modal-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.close());
        }

        // Tab switching
        const tabButtons = this.modalElement.querySelectorAll('.staking-modal-tab');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.dataset.tab;
                this.switchTab(tabId);
            });
        });

        // Percentage buttons for stake tab
        const stakePercentageButtons = this.modalElement.querySelectorAll('[data-tab-content="stake"] .staking-percentage-btn');
        stakePercentageButtons.forEach(button => {
            button.addEventListener('click', () => {
                const percentage = parseInt(button.dataset.percentage);
                this.handlePercentageClick(percentage, 'stake');
            });
        });

        // Percentage buttons for unstake tab
        const unstakePercentageButtons = this.modalElement.querySelectorAll('[data-tab-content="unstake"] .staking-percentage-btn');
        unstakePercentageButtons.forEach(button => {
            button.addEventListener('click', () => {
                const percentage = parseInt(button.dataset.percentage);
                this.handlePercentageClick(percentage, 'unstake');
            });
        });

        // Slider inputs
        const stakeSlider = this.modalElement.querySelector('#stake-slider');
        if (stakeSlider) {
            stakeSlider.addEventListener('input', () => {
                this.handleSliderInput(stakeSlider, 'stake');
            });
        }

        const unstakeSlider = this.modalElement.querySelector('#unstake-slider');
        if (unstakeSlider) {
            unstakeSlider.addEventListener('input', () => {
                this.handleSliderInput(unstakeSlider, 'unstake');
            });
        }

        // Amount inputs
        const stakeInput = this.modalElement.querySelector('#stake-amount-input');
        if (stakeInput) {
            stakeInput.addEventListener('input', () => {
                this.validateInput(stakeInput, 'stake');
                this.updateSliderFromInput(stakeInput, 'stake');
            });
        }

        const unstakeInput = this.modalElement.querySelector('#unstake-amount-input');
        if (unstakeInput) {
            unstakeInput.addEventListener('input', () => {
                this.validateInput(unstakeInput, 'unstake');
                this.updateSliderFromInput(unstakeInput, 'unstake');
            });
        }

        // Action buttons
        const stakeButton = this.modalElement.querySelector('#stake-button');
        if (stakeButton) {
            stakeButton.addEventListener('click', () => this.executeStake());
        }

        const unstakeButton = this.modalElement.querySelector('#unstake-button');
        if (unstakeButton) {
            unstakeButton.addEventListener('click', () => this.executeUnstake());
        }

        const claimButton = this.modalElement.querySelector('#claim-button');
        if (claimButton) {
            claimButton.addEventListener('click', () => this.executeClaim());
        }

        // Keyboard navigation
        this.modalElement.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        });

        this.log('Event listeners setup complete');
    }

    /**
     * Update slider from input value
     */
    updateSliderFromInput(input, tabType) {
        const amount = parseFloat(input.value) || 0;
        const maxAmount = tabType === 'stake' ?
            parseFloat(this.userBalances.lpToken) :
            parseFloat(this.userBalances.stakedAmount);

        const percentage = maxAmount > 0 ? Math.min(100, (amount / maxAmount) * 100) : 0;

        const slider = this.modalElement.querySelector(`#${tabType}-slider`);
        if (slider) {
            slider.value = percentage;
        }

        // Update percentage button states
        const buttons = this.modalElement.querySelectorAll(`[data-tab-content="${tabType}"] .staking-percentage-btn`);
        buttons.forEach(btn => {
            const btnPercentage = parseInt(btn.dataset.percentage);
            btn.classList.toggle('active', Math.abs(btnPercentage - percentage) < 5);
        });
    }

    /**
     * Cleanup modal
     */
    cleanup() {
        if (this.overlayElement && this.overlayElement.parentNode) {
            this.overlayElement.parentNode.removeChild(this.overlayElement);
        }
        
        const styles = document.getElementById('staking-modal-styles');
        if (styles) {
            styles.remove();
        }
        
        // Restore body scroll
        document.body.style.overflow = '';
        
        this.log('StakingModal cleaned up');
    }
}

    // Export StakingModal class to global scope
    global.StakingModal = StakingModal;

    // Note: Instance creation is now handled by SystemManager
    console.log('✅ StakingModal class loaded');

})(window);
