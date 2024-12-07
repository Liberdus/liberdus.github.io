import { BaseComponent } from './BaseComponent.js';
import { ethers } from 'ethers';
import { getNetworkConfig, isDebugEnabled, walletManager } from '../config.js';
import { erc20Abi } from '../abi/erc20.js';
import { getTokenList } from '../utils/tokens.js';

export class CreateOrder extends BaseComponent {
    constructor() {
        super('create-order');
        this.contract = null;
        this.provider = null;
        this.initialized = false;
        this.tokenCache = new Map();
        this.boundCreateOrderHandler = this.handleCreateOrder.bind(this);
        this.isSubmitting = false;
        this.tokens = [];
        
        // Initialize debug logger
        this.debug = (message, ...args) => {
            if (isDebugEnabled('CREATE_ORDER')) {
                console.log('[CreateOrder]', message, ...args);
            }
        };
    }

    async initializeContract() {
        try {
            this.debug('Initializing contract...');
            const networkConfig = getNetworkConfig();
            
            this.debug('Network config:', {
                address: networkConfig.contractAddress,
                abiLength: networkConfig.contractABI?.length
            });

            if (!networkConfig.contractABI) {
                throw new Error('Contract ABI is undefined');
            }
            
            // Get provider and signer from walletManager
            const signer = walletManager.getSigner();
            if (!signer) {
                throw new Error('No signer available - wallet may be disconnected');
            }
            
            // Initialize contract with signer from walletManager
            this.contract = new ethers.Contract(
                networkConfig.contractAddress,
                networkConfig.contractABI,
                signer
            );
            
            this.debug('Contract initialized successfully');
            return this.contract;
        } catch (error) {
            console.error('[CreateOrder] Contract initialization error:', error);
            throw error;
        }
    }

    async initialize(readOnlyMode = true) {
        if (this.isInitializing) {
            this.debug('Already initializing, skipping...');
            return;
        }

        if (this.isInitialized) {
            this.debug('Already initialized, skipping...');
            return;
        }

        this.isInitializing = true;

        try {
            this.debug('Starting initialization...');
            
            if (readOnlyMode) {
                this.setReadOnlyMode();
                return;
            }

            // Wait for WebSocket to be fully initialized
            if (!window.webSocket?.isInitialized) {
                this.debug('Waiting for WebSocket initialization...');
                await new Promise(resolve => {
                    const checkInterval = setInterval(() => {
                        if (window.webSocket?.isInitialized) {
                            clearInterval(checkInterval);
                            resolve();
                        }
                    }, 100);
                });
            }

            // Clear existing content before re-populating
            const sellContainer = document.getElementById('sellContainer');
            const buyContainer = document.getElementById('buyContainer');
            if (sellContainer) sellContainer.innerHTML = '';
            if (buyContainer) buyContainer.innerHTML = '';

            // Use WebSocket's contract instance
            this.contract = window.webSocket.contract;
            this.provider = window.webSocket.provider;

            if (!this.contract) {
                throw new Error('Contract not initialized');
            }
            
            // Enable form when wallet is connected
            this.setConnectedMode();
            
            // Setup UI immediately
            this.populateTokenDropdowns();
            this.setupTokenInputListeners();
            this.setupCreateOrderListener();
            
            // Wait for contract to be ready
            await this.waitForContract();
            
            // Load data with retries
            await Promise.all([
                this.loadOrderCreationFee(),
                this.loadTokens()
            ]);

            this.updateFeeDisplay();
            
            this.isInitialized = true;
            this.debug('Initialization complete');

        } catch (error) {
            this.debug('Error in initialization:', error);
            this.showError('Failed to initialize. Please try again.');
        } finally {
            this.isInitializing = false;
        }
    }

    async loadOrderCreationFee() {
        try {
            // Check if we have a cached value
            if (this.feeToken?.address && this.feeToken?.amount &&this.feeToken?.symbol) {
                this.debug('Using cached fee token data');
                return;
            }

            const maxRetries = 3;
            let retryCount = 0;
            let lastError;

            while (retryCount < maxRetries) {
                try {
                    const feeTokenAddress = await this.contract.feeToken();
                    this.debug('Fee token address:', feeTokenAddress);

                    const feeAmount = await this.contract.orderCreationFeeAmount();
                    this.debug('Fee amount:', feeAmount);

                    // Get token details
                    const tokenContract = new ethers.Contract(
                        feeTokenAddress,
                        [
                            'function symbol() view returns (string)',
                            'function decimals() view returns (uint8)'
                        ],
                        this.provider
                    );

                    const [symbol, decimals] = await Promise.all([
                       tokenContract.symbol(),
                        tokenContract.decimals()
                    ]);

                    // Cache the results
                    this.feeToken = {
                        address: feeTokenAddress,
                        amount: feeAmount,
                        symbol: symbol,
                        decimals: decimals
                    };

                    // Update the fee display
                    const feeDisplay = document.querySelector('.fee-amount');
                    if (feeDisplay) {
                        const formattedAmount = ethers.utils.formatUnits(feeAmount, decimals);
                        feeDisplay.textContent = `${formattedAmount} ${symbol}`;
                    }

                    return;
                } catch (error) {
                    lastError = error;
                    retryCount++;
                    if (retryCount < maxRetries) {
                        // Exponential backoff: 1s, 2s, 4s, etc.
                        const delay = Math.pow(2, retryCount - 1) * 1000;
                        this.debug(`Retry ${retryCount}/${maxRetries} after ${delay}ms`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }
            throw lastError;
        } catch (error) {
            this.debug('Error loading fee:', error);
            throw error;
        }
    }

    // Add a method to check if contract is ready
    async waitForContract(timeout = 10000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (this.contract && await this.contract.provider.getNetwork()) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('Contract not ready after timeout');
    }

    setReadOnlyMode() {
        const createOrderBtn = document.getElementById('createOrderBtn');
        const orderCreationFee = document.getElementById('orderCreationFee');
        
        if (createOrderBtn) {
            createOrderBtn.disabled = true;
            createOrderBtn.textContent = 'Connect Wallet to Create Order';
        }
        
        // Disable input fields
        ['partner', 'sellToken', 'sellAmount', 'buyToken', 'buyAmount'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.disabled = true;
        });
    }

    setConnectedMode() {
        const createOrderBtn = document.getElementById('createOrderBtn');
        const orderCreationFee = document.getElementById('orderCreationFee');
        
        if (createOrderBtn) {
            createOrderBtn.disabled = false;
            createOrderBtn.textContent = 'Create Order';
        }
        
        // Enable input fields
        ['partner', 'sellToken', 'sellAmount', 'buyToken', 'buyAmount'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.disabled = false;
        });

        // Reload fee if we have it cached
        if (this.feeToken) {
            const feeElement = document.getElementById('orderFee');
            if (feeElement) {
                const formattedFee = ethers.utils.formatUnits(this.feeToken.amount, this.feeToken.decimals);
                feeElement.textContent = `${formattedFee} ${this.feeToken.symbol}`;
            }
        }
    }

    async updateTokenBalance(tokenAddress, elementId) {
        try {
            const balanceElement = document.getElementById(elementId);
            if (!tokenAddress || !ethers.utils.isAddress(tokenAddress)) {
                balanceElement.textContent = '';
                return;
            }

            const tokenDetails = await this.getTokenDetails([tokenAddress]);
            if (tokenDetails && tokenDetails[0]?.symbol) {
                const token = tokenDetails[0];
                const formattedBalance = parseFloat(token.formattedBalance).toFixed(4);
                
                // Update token selector button
                const type = elementId.includes('sell') ? 'sell' : 'buy';
                const selector = document.getElementById(`${type}TokenSelector`);
                selector.innerHTML = `
                    <span class="token-selector-content">
                        <div class="token-icon small">
                            ${this.getTokenIcon(token)}
                        </div>
                        <span>${token.symbol}</span>
                        <svg width="12" height="12" viewBox="0 0 12 12">
                            <path d="M3 5L6 8L9 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </span>
                `;
                
                // Update balance display
                balanceElement.innerHTML = `Balance: ${formattedBalance}`;
            }
        } catch (error) {
            console.error(`Error updating token balance:`, error);
            document.getElementById(elementId).textContent = 'Error loading balance';
        }
    }

    setupTokenInputListeners() {
        const sellTokenInput = document.getElementById('sellToken');
        const buyTokenInput = document.getElementById('buyToken');

        const updateBalance = async (input, balanceId) => {
            const tokenAddress = input.value.trim();
            if (ethers.utils.isAddress(tokenAddress)) {
                const container = input.parentElement;
                const existingTooltip = container.querySelector('.token-address-tooltip');
                if (existingTooltip) {
                    existingTooltip.remove();
                }
                
                const tooltip = document.createElement('div');
                tooltip.className = 'token-address-tooltip';
                tooltip.innerHTML = `
                    Verify token at: 
                    <a href="${this.getExplorerUrl(tokenAddress)}" 
                       target="_blank"
                       style="color: #fff; text-decoration: underline;">
                       ${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}
                    </a>
                `;
                container.appendChild(tooltip);
            }
            await this.updateTokenBalance(tokenAddress, balanceId);
        };

        sellTokenInput.addEventListener('change', () => updateBalance(sellTokenInput, 'sellTokenBalance'));
        buyTokenInput.addEventListener('change', () => updateBalance(buyTokenInput, 'buyTokenBalance'));
    }

    setupCreateOrderListener() {
        const createOrderBtn = document.getElementById('createOrderBtn');
        // Remove ALL existing listeners using clone technique
        const newButton = createOrderBtn.cloneNode(true);
        createOrderBtn.parentNode.replaceChild(newButton, createOrderBtn);
        // Add single new listener
        newButton.addEventListener('click', this.boundCreateOrderHandler);
    }

    async handleCreateOrder(event) {
        event.preventDefault();
        
        const createOrderBtn = document.getElementById('createOrderBtn');
        if (this.isSubmitting) {
            this.debug('Already processing a transaction');
            return;
        }
        
        try {
            // Get form values first
            let taker = document.getElementById('takerAddress')?.value.trim() || '';
            const sellToken = document.getElementById('sellToken').value.trim();
            const sellAmount = document.getElementById('sellAmount').value.trim();
            const buyToken = document.getElementById('buyToken').value.trim();
            const buyAmount = document.getElementById('buyAmount').value.trim();
            
            // Validate inputs
            if (!sellToken || !ethers.utils.isAddress(sellToken)) {
                this.showStatus('Please select a valid token to sell', 'error');
                return;
            }
            if (!buyToken || !ethers.utils.isAddress(buyToken)) {
                this.showStatus('Please select a valid token to buy', 'error');
                return;
            }
            if (!sellAmount || isNaN(sellAmount) || parseFloat(sellAmount) <= 0) {
                this.showStatus('Please enter a valid sell amount', 'error');
                return;
            }
            if (!buyAmount || isNaN(buyAmount) || parseFloat(buyAmount) <= 0) {
                this.showStatus('Please enter a valid buy amount', 'error');
                return;
            }

            this.isSubmitting = true;
            createOrderBtn.disabled = true;
            createOrderBtn.classList.add('disabled');
            this.showStatus('Processing...', 'pending');
            
            // If taker is empty, use zero address for public order
            if (!taker) {
                taker = ethers.constants.AddressZero;
                this.debug('No taker specified, using zero address for public order');
            } else if (!ethers.utils.isAddress(taker)) {
                throw new Error('Invalid taker address format');
            }

            // Get signer from walletManager
            const signer = walletManager.getSigner();
            if (!signer) {
                throw new Error('No signer available - wallet may be disconnected');
            }

            // Reinitialize contract with signer
            const networkConfig = getNetworkConfig();
            this.contract = new ethers.Contract(
                networkConfig.contractAddress,
                networkConfig.contractABI,
                signer
            );

            // Convert amounts to wei
            const sellTokenDecimals = await this.getTokenDecimals(sellToken);
            const buyTokenDecimals = await this.getTokenDecimals(buyToken);
            const sellAmountWei = ethers.utils.parseUnits(sellAmount, sellTokenDecimals);
            const buyAmountWei = ethers.utils.parseUnits(buyAmount, buyTokenDecimals);

            // Before creating the order, check and approve both tokens
            await this.checkAndApproveToken(sellToken, sellAmountWei);
            await this.checkAndApproveToken(this.feeToken.address, this.feeToken.amount);
            
            // Create order
            this.showStatus('Creating order...', 'pending');
            const tx = await this.contract.createOrder(
                taker,
                sellToken,
                sellAmountWei,
                buyToken,
                buyAmountWei
            );

            this.showStatus('Waiting for confirmation...', 'pending');
            await tx.wait();
            
            this.showStatus('Order created successfully!', 'success');
            
            // Reset form after successful order creation
            this.resetForm();
            
            // Reload orders if needed
            if (window.app?.loadOrders) {
                window.app.loadOrders();
            }

        } catch (error) {
            this.debug('Create order error:', error);
            this.showStatus(error.message, 'error');
        } finally {
            this.isSubmitting = false;
            createOrderBtn.disabled = false;
            createOrderBtn.classList.remove('disabled');
        }
    }

    async checkAllowance(tokenAddress, owner, amount) {
        try {
            const tokenContract = new ethers.Contract(
                tokenAddress,
                ['function allowance(address owner, address spender) view returns (uint256)'],
                this.provider
            );
            const allowance = await tokenContract.allowance(owner, this.contract.address);
            return allowance.gte(amount);
        } catch (error) {
            console.error('[CreateOrder] Error checking allowance:', error);
            return false;
        }
    }

    getReadableError(error) {
        // Add more specific error cases
        switch (error.code) {
            case 'ACTION_REJECTED':
                return 'Transaction was rejected by user';
            case 'INSUFFICIENT_FUNDS':
                return 'Insufficient funds for transaction';
            case -32603:
                return 'Network error. Please check your connection';
            case 'UNPREDICTABLE_GAS_LIMIT':
                return 'Error estimating gas. The transaction may fail';
            default:
                return error.reason || error.message || 'Error creating order';
        }
    }

    resetForm() {
        // Clear token inputs and amounts
        document.getElementById('sellToken').value = '';
        document.getElementById('sellAmount').value = '';
        document.getElementById('buyToken').value = '';
        document.getElementById('buyAmount').value = '';
        
        // Clear taker address input
        const takerInput = document.getElementById('takerAddress');
        if (takerInput) {
            takerInput.value = '';
        }
        
        // Clear token balances
        const sellTokenBalance = document.getElementById('sellTokenBalance');
        const buyTokenBalance = document.getElementById('buyTokenBalance');
        if (sellTokenBalance) sellTokenBalance.textContent = '';
        if (buyTokenBalance) buyTokenBalance.textContent = '';
        
        // Reset token selectors to default state
        ['sell', 'buy'].forEach(type => {
            const selector = document.getElementById(`${type}TokenSelector`);
            if (selector) {
                selector.innerHTML = `
                    <span class="token-selector-content">
                        <span>Select Token</span>
                        <svg width="12" height="12" viewBox="0 0 12 12">
                            <path d="M3 5L6 8L9 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </span>
                `;
            }
        });
        
        // Remove any token address tooltips
        document.querySelectorAll('.token-address-tooltip').forEach(tooltip => {
            tooltip.remove();
        });
    }

    async loadTokens() {
        try {
            this.tokens = await getTokenList();
            
            ['sell', 'buy'].forEach(type => {
                const modal = document.getElementById(`${type}TokenModal`);
                if (!modal) return;

                // Get references to token lists
                const userList = modal.querySelector(`#${type}UserTokenList`);
                const allList = modal.querySelector(`#${type}AllTokenList`);

                // Remove filtering for native token
                const tokens = this.tokens.filter(t => t.address);

                // Display tokens in wallet (tokens with balance)
                const walletTokens = tokens.filter(t => t.balance && Number(t.balance) > 0);
                this.displayTokens(walletTokens, userList);

                // Display all other tokens
                this.displayTokens(tokens, allList);

                // Add click handlers
                modal.querySelectorAll('.token-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const address = item.dataset.address;
                        const input = document.getElementById(`${type}Token`);
                        input.value = address;
                        this.updateTokenBalance(address, `${type}TokenBalance`);
                        modal.classList.remove('show');
                    });
                });
            });
        } catch (error) {
            console.error('[CreateOrder] Error loading tokens:', error);
            this.showError('Failed to load tokens. Please try again.');
        }
    }

    populateTokenDropdowns() {
        ['sell', 'buy'].forEach(type => {
            const currentContainer = document.getElementById(`${type}Container`);
            if (!currentContainer) return;
            
            // Create the unified input container
            const container = document.createElement('div');
            container.className = 'unified-token-input';
            
            // Create input wrapper with label
            const inputWrapper = document.createElement('div');
            inputWrapper.className = 'token-input-wrapper';
            
            // Add the label
            const label = document.createElement('span');
            label.className = 'token-input-label';
            label.textContent = type.charAt(0).toUpperCase() + type.slice(1);
            
            // Create amount input
            const amountInput = document.createElement('input');
            amountInput.type = 'text';
            amountInput.id = `${type}Amount`;
            amountInput.className = 'token-amount-input';
            amountInput.placeholder = '0.0';
            
            // Assemble input wrapper
            inputWrapper.appendChild(label);
            inputWrapper.appendChild(amountInput);
            
            // Create token selector button
            const tokenSelector = document.createElement('button');
            tokenSelector.className = 'token-selector-button';
            tokenSelector.id = `${type}TokenSelector`;
            tokenSelector.innerHTML = `
                <span class="token-selector-content">
                    <span>Select token</span>
                    <svg width="12" height="12" viewBox="0 0 12 12">
                        <path d="M3 5L6 8L9 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </span>
            `;
            
            // Hidden input for token address
            const tokenInput = document.createElement('input');
            tokenInput.type = 'hidden';
            tokenInput.id = `${type}Token`;
            
            // Assemble the components
            container.appendChild(inputWrapper);
            container.appendChild(tokenSelector);
            container.appendChild(tokenInput);
            
            // Create balance display
            const balanceDisplay = document.createElement('div');
            balanceDisplay.id = `${type}TokenBalance`;
            balanceDisplay.className = 'token-balance-display';
            
            currentContainer.appendChild(container);
            currentContainer.appendChild(balanceDisplay);
            
            // Add event listeners
            tokenSelector.addEventListener('click', () => {
                const modal = document.getElementById(`${type}TokenModal`);
                if (modal) modal.classList.add('show');
            });
            
            // Create modal if it doesn't exist
            if (!document.getElementById(`${type}TokenModal`)) {
                const modal = this.createTokenModal(type);
                document.body.appendChild(modal);
            }
        });
    }

    createTokenModal(type) {
        const modal = document.createElement('div');
        modal.className = 'token-modal';
        modal.id = `${type}TokenModal`;
        
        modal.innerHTML = `
            <div class="token-modal-content">
                <div class="token-modal-header">
                    <h3>Select Token</h3>
                    <button class="token-modal-close">&times;</button>
                </div>
                <div class="token-modal-search">
                    <span class="search-info-text">
                        Search by token name, symbol, or paste contract address
                    </span>
                    <input type="text" 
                           class="token-search-input" 
                           placeholder="0x... or search token name"
                           id="${type}TokenSearch">
                </div>
                <div class="token-sections">
                    <div id="${type}ContractResult"></div>
                    <div class="token-section">
                        <div class="token-section-header">
                            <h4>Tokens in Wallet</h4>
                            <span class="token-section-subtitle">Your available tokens</span>
                        </div>
                        <div class="token-list" id="${type}UserTokenList">
                            <div class="token-list-loading">
                                <div class="spinner"></div>
                                <div>Loading tokens...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add search functionality
        const searchInput = modal.querySelector(`#${type}TokenSearch`);
        searchInput.addEventListener('input', (e) => this.handleTokenSearch(e.target.value, type));
        
        // Add modal close handlers
        modal.querySelector('.token-modal-close').addEventListener('click', () => {
            modal.classList.remove('show');
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
        
        return modal;
    }

    async handleTokenSearch(searchTerm, type) {
        const contractResult = document.getElementById(`${type}ContractResult`);
        
        // Clear previous results
        contractResult.innerHTML = '';
        
        // If input looks like an address
        if (ethers.utils.isAddress(searchTerm)) {
            const POL_NativeToken_Address = '0x0000000000000000000000000000000000001010';
            if (searchTerm.toLowerCase() === POL_NativeToken_Address.toLowerCase()) {
                contractResult.innerHTML = `
                  <div class="contract-address-result">
                    <div class="contract-not-supported">
                      <span>POL Native Token is not supported. Please use ERC20 tokens.</span>
                    </div>
                  </div>
                `;
                return;
            }
            // Show loading state first
            contractResult.innerHTML = `
                <div class="contract-address-result">
                    <div class="contract-loading">
                        <div class="spinner"></div>
                        <span>Checking contract...</span>
                    </div>
                </div>
            `;

            try {
                const tokenContract = new ethers.Contract(
                    searchTerm,
                    [
                        'function name() view returns (string)',
                        'function symbol() view returns (string)',
                        'function decimals() view returns (uint8)',
                        'function balanceOf(address) view returns (uint256)'
                    ],
                    this.provider
                );

                const [name, symbol, decimals, balance] = await Promise.all([
                    tokenContract.name().catch(() => null),
                    tokenContract.symbol().catch(() => null),
                    tokenContract.decimals().catch(() => null),
                    tokenContract.balanceOf(this.account).catch(() => null)
                ]);

                if (name && symbol && decimals !== null) {
                    // Format balance if available
                    const formattedBalance = balance ? 
                        ethers.utils.formatUnits(balance, decimals) : '0';

                    // Create token object matching the structure used in tokens.js
                    const token = {
                        address: searchTerm,
                        name,
                        symbol,
                        decimals,
                        balance: formattedBalance
                    };

                    // Display the token in the same format as listed tokens
                    contractResult.innerHTML = `
                        <div class="token-item" data-address="${searchTerm}">
                            <div class="token-item-left">
                                <div class="token-icon">
                                    ${this.getTokenIcon(token)}
                                </div>
                                <div class="token-item-info">
                                    <div class="token-item-symbol">${symbol}</div>
                                    <div class="token-item-name">
                                        ${name}
                                        <a href="${this.getExplorerUrl(searchTerm)}" 
                                           class="token-explorer-link"
                                           target="_blank"
                                           title="View contract on explorer">
                                            <svg class="token-explorer-icon" viewBox="0 0 24 24">
                                                <path fill="currentColor" d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z" />
                                            </svg>
                                        </a>
                                    </div>
                                </div>
                            </div>
                            ${balance ? `
                                <div class="token-item-balance">
                                    ${Number(formattedBalance).toFixed(4)}
                                </div>
                            ` : ''}
                        </div>
                    `;

                    // Add click handler
                    const tokenItem = contractResult.querySelector('.token-item');
                    tokenItem.addEventListener('click', () => {
                        const input = document.getElementById(`${type}Token`);
                        input.value = searchTerm;
                        this.updateTokenBalance(searchTerm, `${type}TokenBalance`);
                        document.getElementById(`${type}TokenModal`).classList.remove('show');
                    });
                }
            } catch (error) {
                // Just clear the contract result if there's an error
                contractResult.innerHTML = '';
            }
        }

        // Filter and display wallet tokens
        const searchTermLower = searchTerm.toLowerCase().trim();
        const filteredWalletTokens = this.walletTokens.filter(token => 
            (token.symbol.toLowerCase().includes(searchTermLower) ||
             token.name.toLowerCase().includes(searchTermLower) ||
             token.address.toLowerCase().includes(searchTermLower))
        );

        // Display wallet tokens
        if (filteredWalletTokens.length > 0) {
            userTokenList.innerHTML = filteredWalletTokens.map(token => `
                <div class="token-item" data-address="${token.address}">
                    <div class="token-item-left">
                        <div class="token-icon">
                            ${this.getTokenIcon(token)}
                        </div>
                        <div class="token-item-info">
                            <div class="token-item-symbol">${token.symbol}</div>
                            <div class="token-item-name">
                                ${token.name}
                                <a href="${this.getExplorerUrl(token.address)}" 
                                   class="token-explorer-link"
                                   target="_blank"
                                   title="View contract on explorer">
                                    <svg class="token-explorer-icon" viewBox="0 0 24 24">
                                        <path fill="currentColor" d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z" />
                                    </svg>
                                </a>
                            </div>
                        </div>
                    </div>
                    <div class="token-item-balance">
                        ${Number(token.balance).toFixed(4)}
                    </div>
                </div>
            `).join('');
        } else {
            userTokenList.innerHTML = `
                <div class="token-list-empty">
                    No tokens found in wallet
                </div>
            `;
        }
    }

    displayTokens(tokens, container) {
        if (!container) return; // Guard against null container

        if (!tokens || tokens.length === 0) {
            container.innerHTML = `
                <div class="token-list-empty">
                    No tokens found
                </div>
            `;
            return;
        }

        try {
            container.innerHTML = tokens.map(token => `
                <div class="token-item" data-address="${token.address}">
                    <div class="token-item-left">
                        <div class="token-icon">
                            ${this.getTokenIcon(token)}
                        </div>
                        <div class="token-item-info">
                            <div class="token-item-symbol">${token.symbol}</div>
                            <div class="token-item-name">
                                ${token.name}
                                <a href="${this.getExplorerUrl(token.address)}" 
                                   class="token-explorer-link"
                                   target="_blank"
                                   title="View contract on explorer">
                                    <svg class="token-explorer-icon" viewBox="0 0 24 24">
                                        <path fill="currentColor" d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z" />
                                    </svg>
                                </a>
                            </div>
                        </div>
                    </div>
                    ${token.balance ? `
                        <div class="token-item-balance">
                            ${Number(token.balance).toFixed(4)}
                        </div>
                    ` : ''}
                </div>
            `).join('');

            // Add click handlers
            container.querySelectorAll('.token-item').forEach(item => {
                item.addEventListener('click', () => {
                    const address = item.dataset.address;
                    const type = container.id.includes('sell') ? 'sell' : 'buy';
                    const input = document.getElementById(`${type}Token`);
                    if (input) {
                        input.value = address;
                        this.updateTokenBalance(address, `${type}TokenBalance`);
                        const modal = document.getElementById(`${type}TokenModal`);
                        if (modal) modal.classList.remove('show');
                    }
                });
            });
        } catch (error) {
            console.error('Error displaying tokens:', error);
            container.innerHTML = `
                <div class="token-list-empty">
                    Error loading tokens
                </div>
            `;
        }
    }

    getExplorerUrl(address) {
        const networkConfig = getNetworkConfig();
        if (!networkConfig?.explorer) {
            console.warn('Explorer URL not configured');
            return '#';
        }
        return `${networkConfig.explorer}/address/${ethers.utils.getAddress(address)}`;
    }

    // Add helper method for token icons
    getTokenIcon(token) {
        if (token.iconUrl) {
            return `
                <div class="token-icon">
                    <img src="${token.iconUrl}" alt="${token.symbol}" class="token-icon-image">
                </div>
            `;
        }

        // Fallback to letter-based icon
        const symbol = token.symbol || '?';
        const firstLetter = symbol.charAt(0).toUpperCase();
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
            '#FFEEAD', '#D4A5A5', '#9B59B6', '#3498DB'
        ];
        
        // Generate consistent color based on address
        const colorIndex = parseInt(token.address.slice(-6), 16) % colors.length;
        const backgroundColor = colors[colorIndex];
        
        return `
            <div class="token-icon">
                <div class="token-icon-fallback" style="background: ${backgroundColor}">
                    ${firstLetter}
                </div>
            </div>
        `;
    }

    cleanup() {
        this.debug('Cleaning up CreateOrder component');
        this.isInitialized = false;
        this.isInitializing = false;
        // Remove event listeners
        if (this.boundCreateOrderHandler) {
            const createOrderBtn = document.getElementById('createOrderBtn');
            if (createOrderBtn) {
                createOrderBtn.removeEventListener('click', this.boundCreateOrderHandler);
            }
        }
        
        // Clear containers
        const sellContainer = document.getElementById('sellContainer');
        const buyContainer = document.getElementById('buyContainer');
        if (sellContainer) sellContainer.innerHTML = '';
        if (buyContainer) buyContainer.innerHTML = '';
        
        // Reset state
        this.initialized = false;
        this.isSubmitting = false;
    }

    // Add this method to the CreateOrder class
    showStatus(message, type = 'info') {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `status ${type}`;
        }
        this.debug(`Status update (${type}): ${message}`);
    }

    // Also add a helper method for showing errors
    showError(message) {
        this.showStatus(message, 'error');
    }

    // And a helper for showing success messages
    showSuccess(message) {
        this.showStatus(message, 'success');
    }

    async getTokenDecimals(tokenAddress) {
        try {
            // Check if token is in cache
            const normalizedAddress = tokenAddress.toLowerCase();
            const cachedToken = this.tokenCache.get(normalizedAddress);
            
            if (cachedToken?.decimals) {
                this.debug(`Cache hit for decimals: ${tokenAddress}`);
                return cachedToken.decimals;
            }

            // If not in cache, fetch from contract
            const tokenContract = new ethers.Contract(
                tokenAddress,
                ['function decimals() view returns (uint8)'],
                this.provider
            );
            
            const decimals = await tokenContract.decimals();
            this.debug(`Fetched decimals for token ${tokenAddress}: ${decimals}`);
            
            // Update cache
            if (cachedToken) {
                cachedToken.decimals = decimals;
                this.tokenCache.set(normalizedAddress, cachedToken);
            } else {
                this.tokenCache.set(normalizedAddress, { decimals });
            }
            
            return decimals;
        } catch (error) {
            this.debug(`Error getting token decimals: ${error.message}`);
            throw new Error(`Failed to get decimals for token ${tokenAddress}`);
        }
    }

    async checkAndApproveToken(tokenAddress, amount) {
        try {
            this.debug(`Checking allowance for token: ${tokenAddress}`);
            
            // Get signer from walletManager
            const signer = walletManager.getSigner();
            if (!signer) {
                throw new Error('No signer available - wallet may be disconnected');
            }

            // Get the current address using walletManager
            const currentAddress = await walletManager.getCurrentAddress();
            if (!currentAddress) {
                throw new Error('No wallet address available');
            }

            // Calculate required amount, accounting for fee token if same as sell token
            let requiredAmount = amount;
            
            if (tokenAddress.toLowerCase() === this.feeToken?.address?.toLowerCase()) {
                // If this is the fee token, we need to account for both fee and potential sell amount
                const sellToken = document.getElementById('sellToken')?.value;
                const sellAmountStr = document.getElementById('sellAmount')?.value;
                
                if (sellToken?.toLowerCase() === tokenAddress.toLowerCase() && sellAmountStr) {
                    const sellTokenDecimals = await this.getTokenDecimals(sellToken);
                    const sellAmountWei = ethers.utils.parseUnits(sellAmountStr, sellTokenDecimals);
                    
                    // Add fee amount and sell amount together
                    requiredAmount = this.feeToken.amount.add(sellAmountWei);
                    this.debug(`Token is both fee and sell token. Combined amount for approval: ${requiredAmount.toString()}`);
                }
            }

            // Create token contract instance with the correct signer
            const tokenContract = new ethers.Contract(
                tokenAddress,
                [
                    'function allowance(address owner, address spender) view returns (uint256)',
                    'function approve(address spender, uint256 amount) returns (bool)'
                ],
                signer
            );

            // Get current allowance
            const currentAllowance = await tokenContract.allowance(
                currentAddress,
                this.contract.address
            );

            // If allowance is insufficient, request approval
            if (currentAllowance.lt(requiredAmount)) {
                this.debug(`Insufficient allowance for token ${tokenAddress}. Current: ${currentAllowance}, Required: ${requiredAmount}`);
                this.showStatus('Requesting token approval...', 'pending');
                
                try {
                    const approveTx = await tokenContract.approve(this.contract.address, requiredAmount);
                    this.showStatus('Waiting for approval confirmation...', 'pending');
                    
                    // Wait for transaction and handle replacement
                    try {
                        await approveTx.wait();
                    } catch (waitError) {
                        // Check if transaction was replaced
                        if (waitError.code === 'TRANSACTION_REPLACED') {
                            if (waitError.cancelled) {
                                // Transaction was cancelled (dropped)
                                throw new Error('Approval transaction was cancelled');
                            } else {
                                // Transaction was replaced (speed up)
                                this.debug('Approval transaction was sped up:', waitError.replacement.hash);
                                // Check if replacement transaction was successful
                                if (waitError.receipt.status === 1) {
                                    this.debug('Replacement approval transaction successful');
                                    this.showStatus('Token approved successfully', 'success');
                                    return true;
                                } else {
                                    throw new Error('Replacement approval transaction failed');
                                }
                            }
                        } else {
                            // Other error occurred
                            throw waitError;
                        }
                    }
                    
                    this.debug(`Token ${tokenAddress} approved successfully`);
                    this.showStatus('Token approved successfully', 'success');
                } catch (error) {
                    // Handle user rejection or other errors
                    if (error.code === 4001) { // MetaMask user rejection error code
                        throw new Error('User rejected the approval transaction');
                    }
                    throw error;
                }
            } else {
                this.debug(`Token ${tokenAddress} already has sufficient allowance`);
            }

            return true;
        } catch (error) {
            this.debug('Token approval error:', error);
            this.showStatus(error.message || 'Failed to approve token', 'error');
            throw error;
        }
    }

    // Update the fee display in the UI
    updateFeeDisplay() {
        if (!this.feeToken?.amount || !this.feeToken?.symbol || !this.feeToken?.decimals) {
            this.debug('Fee token data not complete:', this.feeToken);
            return;
        }

        const feeDisplay = document.querySelector('.fee-amount');
        if (feeDisplay) {
            const formattedAmount = ethers.utils.formatUnits(this.feeToken.amount, this.feeToken.decimals);
            feeDisplay.textContent = `${formattedAmount} ${this.feeToken.symbol}`;
        }
    }
}

