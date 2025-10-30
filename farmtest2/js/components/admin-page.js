/**
 * AdminPage Component - Role-based Admin Panel
 * Implements Phase 3, Day 8 requirements for admin panel with access control
 */

class AdminPage {
    constructor() {
        this.isInitialized = false;
        this.isAuthorized = false;
        this.userAddress = null;
        this.adminRole = null;
        this.contractStats = {};
        this.refreshInterval = null;
        this.isRefreshing = false; // Prevent overlapping refreshes
        this.autoRefreshActive = false; // Prevent multiple auto-refresh timers

        // Development mode from centralized config
        // SECURITY: Default to false (production mode) if DEV_CONFIG is not loaded
        this.DEVELOPMENT_MODE = window.DEV_CONFIG?.ADMIN_DEVELOPMENT_MODE ?? false;

        // Professional Mock Data System
        this.mockProposals = new Map();
        this.mockProposalCounter = 1;
        this.mockVotes = new Map();
        this.mockApprovals = new Map();

        // PERFORMANCE OPTIMIZATION: Proposal state management
        this.proposalsCache = new Map(); // Cache proposals by ID for O(1) access
        this.lastProposalId = 0; // Track highest proposal ID for incremental loading
        this.pendingOptimisticUpdates = new Map(); // Track optimistic updates
        this.isUsingRealData = false; // Track data source

        // PAGINATION OPTIMIZATION: Track loaded proposals for "Load More" functionality
        this.loadedProposalCount = 0; // Track how many proposals are currently loaded
        this.totalProposalCount = 0; // Track total available proposals
        this.isLoadingMore = false; // Prevent multiple simultaneous load more requests

        // SELECTIVE UPDATE OPTIMIZATION: Track proposal states for smart updates
        this.proposalStates = new Map(); // Cache proposal states for change detection
        this.lastKnownProposalCount = 0; // Track last known total proposal count
        this.isSelectiveUpdateEnabled = true; // Enable selective update system

        // Initialize mock system only in development mode
        if (this.DEVELOPMENT_MODE) {
            console.log('🚧 Development mode: Initializing mock system');
            this.initializeMockSystem();
        } else {
            console.log('🚀 Production mode: Skipping mock system');
        }

        // Initialize asynchronously (don't await in constructor)
        this.init().catch(error => {
            console.error('❌ AdminPage initialization failed:', error);
            this.showInitializationError(error);
        });
    }

    /**
     * Initialize Professional Mock System
     * Creates realistic proposal data that feels completely real
     */
    initializeMockSystem() {
        console.log('🔧 Initializing professional mock system...');

        // Initialize with some realistic existing proposals for demo
        this.createMockProposal({
            id: 48,
            actionType: 'SET_HOURLY_REWARD_RATE',
            title: 'Set Reward Rate',
            description: 'Update hourly reward rate to boost staking incentives',
            proposer: '0x9249cFE964C49Cf2d2D0DBBbB33E99235707aa61',
            status: 'PENDING',
            requiredApprovals: 3,
            currentApprovals: 1,
            details: {
                newHourlyRewardRate: '100'
            },
            createdAt: Date.now() - 86400000, // 1 day ago
            expiresAt: Date.now() + 518400000 // 6 days from now
        });

        this.createMockProposal({
            id: 47,
            actionType: 'SET_HOURLY_REWARD_RATE',
            title: 'Set Reward Rate',
            description: 'Update hourly reward rate for better rewards distribution',
            proposer: '0xea7bb30fbcCBB2646B0eFeB31382D3A4da07a3cC',
            status: 'PENDING',
            requiredApprovals: 3,
            currentApprovals: 1,
            details: {
                newHourlyRewardRate: '150'
            },
            createdAt: Date.now() - 172800000, // 2 days ago
            expiresAt: Date.now() + 432000000 // 5 days from now
        });

        this.createMockProposal({
            id: 46,
            actionType: 'ADD_PAIR',
            title: 'Add Pair',
            description: 'Add LIB/ETH LP pair from Uniswap V3 (weight: 20)',
            proposer: '0xea7bb30fbcCBB2646B0eFeB31382D3A4da07a3cC',
            status: 'PENDING',
            requiredApprovals: 3,
            currentApprovals: 0,
            details: {
                pairToAdd: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
                pairNameToAdd: 'LIB/ETH',
                platformToAdd: 'Uniswap V3',
                weightToAdd: 20
            },
            createdAt: Date.now() - 259200000, // 3 days ago
            expiresAt: Date.now() + 345600000 // 4 days from now
        });

        this.createMockProposal({
            id: 45,
            actionType: 'ADD_PAIR',
            title: 'Add Pair',
            description: 'Add LIB/ETH LP pair from Uniswap V3 (weight: 20)',
            proposer: '0xea7bb30fbcCBB2646B0eFeB31382D3A4da07a3cC',
            status: 'PENDING',
            requiredApprovals: 3,
            currentApprovals: 0,
            details: {
                pairToAdd: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
                pairNameToAdd: 'LIB/ETH',
                platformToAdd: 'Uniswap V3',
                weightToAdd: 20
            },
            createdAt: Date.now() - 345600000, // 4 days ago
            expiresAt: Date.now() + 259200000 // 3 days from now
        });

        this.createMockProposal({
            id: 44,
            actionType: 'SET_HOURLY_REWARD_RATE',
            title: 'Set Reward Rate',
            description: 'Governance proposal to update reward rate',
            proposer: '0xea7bb30fbcCBB2646B0eFeB31382D3A4da07a3cC',
            status: 'PENDING',
            requiredApprovals: 3,
            currentApprovals: 0,
            details: {
                newHourlyRewardRate: '200'
            },
            createdAt: Date.now() - 432000000, // 5 days ago
            expiresAt: Date.now() + 172800000 // 2 days from now
        });

        console.log('✅ Professional mock system initialized with realistic proposals');
        console.log('🔧 Mock proposals created:', this.mockProposals.size);
        console.log('🔧 Mock proposal IDs:', Array.from(this.mockProposals.keys()));
    }

    /**
     * Create a mock proposal that looks completely real
     */
    createMockProposal(proposalData) {
        const proposal = {
            id: proposalData.id || this.mockProposalCounter++,
            actionType: proposalData.actionType,
            title: proposalData.title,
            description: proposalData.description,
            proposer: proposalData.proposer,
            status: proposalData.status || 'PENDING',
            requiredApprovals: proposalData.requiredApprovals || 3,
            currentApprovals: proposalData.currentApprovals || 0,
            details: proposalData.details,
            createdAt: proposalData.createdAt || Date.now(),
            expiresAt: proposalData.expiresAt || (Date.now() + 604800000), // 7 days
            votes: [],
            transactionHash: proposalData.transactionHash || ('0x' + Math.random().toString(16).substr(2, 64))
        };

        this.mockProposals.set(proposal.id, proposal);
        this.mockVotes.set(proposal.id, new Map());
        this.mockApprovals.set(proposal.id, new Set());

        return proposal;
    }

    /**
     * Add a vote to a mock proposal
     */
    addMockVote(proposalId, signerAddress, vote) {
        if (!this.mockVotes.has(proposalId)) {
            this.mockVotes.set(proposalId, new Map());
        }

        this.mockVotes.get(proposalId).set(signerAddress, {
            vote: vote, // 'APPROVE' or 'REJECT'
            timestamp: Date.now(),
            transactionHash: '0x' + Math.random().toString(16).substr(2, 64)
        });

        // Update proposal approval count
        const proposal = this.mockProposals.get(proposalId);
        if (proposal && vote === 'APPROVE') {
            this.mockApprovals.get(proposalId).add(signerAddress);
            proposal.currentApprovals = this.mockApprovals.get(proposalId).size;

            // Update status if enough approvals
            if (proposal.currentApprovals >= proposal.requiredApprovals) {
                proposal.status = 'APPROVED';
            }
        }
    }

    /**
     * Show initialization error to user
     */
    showInitializationError(error) {
        const adminContent = document.getElementById('admin-content');
        if (adminContent) {
            adminContent.innerHTML = `
                <div class="error-container">
                    <div class="error-icon">❌</div>
                    <h2>Initialization Failed</h2>
                    <p>The admin panel failed to initialize properly.</p>
                    <div class="error-details">
                        <strong>Error:</strong> ${error.message}
                    </div>
                    <button class="btn btn-primary" onclick="location.reload()">
                        Reload Page
                    </button>
                </div>
            `;
        }
    }

    async init() {
        try {
            console.log('🔐 Initializing Admin Panel...');

            // Development mode bypass
            if (this.DEVELOPMENT_MODE) {
                console.log('🚧 DEVELOPMENT MODE: Bypassing access control');
                this.isAuthorized = true;
                this.userAddress = window.DEV_CONFIG?.MOCK_USER_ADDRESS || '0x1234567890123456789012345678901234567890';

                // Use mock contract stats if enabled
                if (window.DEV_CONFIG?.MOCK_CONTRACT_DATA) {
                    this.contractStats = window.DEV_CONFIG.MOCK_STATS || {};
                }

                await this.loadAdminInterface();
                this.startAutoRefresh();
                this.isInitialized = true;
                console.log('✅ Admin Panel initialized (Development Mode)');
                return;
            }

            // Production mode - wait for contract manager and wallet
            console.log('🚀 Production mode: Waiting for contract manager and wallet...');
            await this.waitForSystemReady();
            console.log('✅ System ready check completed');

            // Network health check removed for performance optimization
            // The contract manager already includes network connectivity checks and RPC failover mechanisms,
            // making this redundant 20-second delay unnecessary. The system will gracefully handle network
            // issues when loading data, providing better user experience with faster initialization.
            console.log('🏥 Skipping network health check for faster initialization...');
            // await this.performNetworkHealthCheck();

            // Wait for contract manager to be ready
            if (!window.contractManager?.isReady()) {
                console.log('⏳ Waiting for contract manager...');
                await this.waitForContractManager();
                console.log('✅ Contract manager ready');
            } else {
                console.log('✅ Contract manager already ready');
            }

            // Check if wallet manager exists and is properly initialized
            console.log('🔍 Checking wallet manager...');
            if (!window.walletManager) {
                console.log('⚠️ Wallet manager not available, showing connect prompt');
                this.showConnectWalletPrompt();
                return;
            }
            console.log('✅ Wallet manager found');

            // Check if wallet is connected (with proper error handling)
            console.log('🔍 Checking wallet connection...');
            let isConnected = false;
            try {
                isConnected = typeof window.walletManager.isConnected === 'function'
                    ? window.walletManager.isConnected()
                    : false;
                console.log('🔍 Wallet connected:', isConnected);
            } catch (walletError) {
                console.warn('⚠️ Wallet manager error:', walletError.message);
                this.showConnectWalletPrompt();
                return;
            }

            if (!isConnected) {
                console.log('⚠️ Wallet not connected, showing connect prompt');
                this.showConnectWalletPrompt();
                return;
            }
            console.log('✅ Wallet is connected');

            // Setup wallet listeners to handle account changes
            this.setupWalletListeners();

            // Verify admin access
            console.log('🔍 Verifying admin access...');
            await this.verifyAdminAccess();
            console.log('✅ Admin access verification completed');

            console.log('🔍 Authorization status:', this.isAuthorized);
            if (this.isAuthorized) {
                console.log('✅ User authorized, loading admin interface...');
                await this.loadAdminInterface();
                console.log('✅ Admin interface loaded, starting auto-refresh...');
                this.startAutoRefresh();
                console.log('✅ Auto-refresh started');
            } else {
                console.log('❌ User not authorized, showing unauthorized access');
                this.showUnauthorizedAccess();
            }

            this.isInitialized = true;
            console.log('✅ Admin Panel initialization completed successfully');

        } catch (error) {
            console.error('❌ Admin Panel initialization failed:', error);
            this.showError('Failed to initialize admin panel', error.message);
        }
    }

    async waitForSystemReady(timeout = 30000) {
        console.log('⏳ Waiting for system components to be ready...');

        const startTime = Date.now();

        return new Promise((resolve, reject) => {
            const checkReady = () => {
                const elapsed = Date.now() - startTime;

                // Check if timeout exceeded
                if (elapsed > timeout) {
                    console.warn(`⚠️ System readiness timeout after ${timeout}ms - proceeding with available components`);
                    // Don't reject, just resolve with what we have
                    resolve();
                    return;
                }

                // Check system components (ENHANCED: More flexible requirements)
                const ethersAvailable = !!window.ethers;
                const configAvailable = !!window.CONFIG;
                const contractManagerExists = !!window.contractManager;

                console.log(`🔍 System check (${Math.round(elapsed/1000)}s):`, {
                    ethers: ethersAvailable,
                    config: configAvailable,
                    contractManager: contractManagerExists,
                    contractManagerReady: contractManagerExists ? window.contractManager.isReady() : false
                });

                // ENHANCED: More flexible requirements - proceed if we have basic components
                if (ethersAvailable && configAvailable) {
                    console.log('✅ Basic system components ready - proceeding with initialization');
                    resolve();
                } else {
                    // Show what's missing
                    const missing = [];
                    if (!ethersAvailable) missing.push('ethers');
                    if (!configAvailable) missing.push('config');

                    console.log(`⏳ Still waiting for: ${missing.join(', ')}`);

                    // Continue checking with shorter interval
                    setTimeout(checkReady, 1000);
                }
            };

            checkReady();
        });
    }

    async performNetworkHealthCheck() {
        try {
            console.log('🏥 Performing network health check...');

            // Check if NetworkHealthCheck is available
            if (!window.NetworkHealthCheck) {
                console.warn('⚠️ NetworkHealthCheck not available, skipping health check');
                return;
            }

            const healthChecker = new window.NetworkHealthCheck();
            const contractAddress = window.CONFIG?.CONTRACTS?.STAKING_CONTRACT;

            // Perform comprehensive health check
            const isReady = await healthChecker.waitForNetworkReady(contractAddress, 20000); // 20 second timeout

            if (!isReady) {
                console.warn('⚠️ Network health check failed, but continuing with initialization');
                // Don't throw error - let the system try to continue
            } else {
                console.log('✅ Network health check passed');
            }
        } catch (error) {
            console.warn('⚠️ Network health check error:', error.message);
            // Don't throw error - let the system try to continue
        }
    }

    async waitForContractManager(timeout = 30000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            const checkReady = () => {
                if (window.contractManager?.isReady()) {
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error('Contract manager timeout'));
                } else {
                    setTimeout(checkReady, 1000);
                }
            };

            checkReady();
        });
    }

    async verifyAdminAccess() {
        try {
            console.log('🔍 Verifying admin access...');

            // Get current user address
            if (window.walletManager?.isConnected()) {
                this.userAddress = await window.walletManager.getAddress();
            } else {
                throw new Error('Wallet not connected');
            }

            console.log('👤 User address:', this.userAddress);

            // Check against authorized admin list first (development/fallback)
            if (window.DEV_CONFIG?.AUTHORIZED_ADMINS) {
                const isAuthorizedAdmin = window.DEV_CONFIG.AUTHORIZED_ADMINS.some(
                    adminAddress => adminAddress.toLowerCase() === this.userAddress.toLowerCase()
                );

                if (isAuthorizedAdmin) {
                    this.isAuthorized = true;
                    console.log('✅ Admin access granted: Address in authorized list');
                    return;
                }
            }

            // Check if user has admin role via contract
            if (window.contractManager?.stakingContract) {
                try {
                    // Try to call hasRole function
                    const hasAdminRole = await window.contractManager.hasAdminRole(this.userAddress);

                    this.isAuthorized = hasAdminRole;
                    console.log(`🔐 Contract role check: ${hasAdminRole ? 'AUTHORIZED' : 'DENIED'}`);

                    if (this.isAuthorized) return;

                } catch (roleError) {
                    console.warn('⚠️ Role check failed, checking contract owner as fallback:', roleError.message);

                    // Fallback: check if user is contract owner
                    try {
                        const owner = await window.contractManager.stakingContract.owner();
                        this.isAuthorized = owner.toLowerCase() === this.userAddress.toLowerCase();
                        console.log(`🔐 Owner check: ${this.isAuthorized ? 'AUTHORIZED' : 'DENIED'}`);

                        if (this.isAuthorized) return;

                    } catch (ownerError) {
                        console.warn('⚠️ Owner check also failed:', ownerError.message);
                    }
                }
            } else {
                console.warn('⚠️ Staking contract not available for role verification');
            }

            // Final fallback - deny access
            this.isAuthorized = false;
            console.log('❌ Admin access denied: No authorization method succeeded');

        } catch (error) {
            console.error('❌ Admin access verification failed:', error);
            this.isAuthorized = false;
            throw error;
        }
    }

    showConnectWalletPrompt() {
        const container = document.getElementById('admin-content') || document.body;
        container.innerHTML = `
            <div class="admin-connect-prompt">
                <div class="connect-card">
                    <h2>🔐 Admin Panel Access</h2>
                    <p>Please connect your wallet to access the admin panel.</p>
                    <button class="btn btn-primary" onclick="connectWallet()">
                        Connect Wallet
                    </button>
                </div>
            </div>
        `;
    }


    showUnauthorizedAccess() {
        const container = document.getElementById('admin-content') || document.body;
        const currentNetwork = window.CONFIG?.NETWORK?.NAME || 'Unknown Network';
        const currentChainId = window.CONFIG?.NETWORK?.CHAIN_ID || 'Unknown';
        const currentContract = window.CONFIG?.CONTRACTS?.STAKING_CONTRACT || 'Not configured';
        
        container.innerHTML = `
            <div class="admin-unauthorized">
                <div class="unauthorized-card">
                    <h2>🚫 Access Denied</h2>
                    <p><strong>Switch to an account with admin privileges for this contract.</strong></p>
                    
                    <div class="account-switcher">
                        <h3>👤 Switch Admin Account</h3>
                        <p>Use your wallet to switch to an account that has admin permissions for this contract.</p>
                        <div class="network-info">
                            <div class="network-details">
                                <p><strong>Current Network:</strong> ${currentNetwork} (Chain ID: ${currentChainId})</p>
                                <p><strong>Contract:</strong> ${currentContract}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="network-switcher">
                        <h3>🌐 Alternative: Switch Network</h3>
                        <p>Or try switching to a network where you have admin permissions:</p>
                        <div class="network-selector-container">
                            <select id="unauthorized-network-select" class="network-select">
                                <option value="AMOY" ${window.CONFIG?.SELECTED_NETWORK === 'AMOY' ? 'selected' : ''}>Amoy Testnet</option>
                                <option value="POLYGON_MAINNET" ${window.CONFIG?.SELECTED_NETWORK === 'POLYGON_MAINNET' ? 'selected' : ''}>Polygon Mainnet</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="access-details">
                        <p><strong>Your Address:</strong> ${this.userAddress}</p>
                        <p><strong>Required Role:</strong> ADMIN_ROLE or Contract Owner</p>
                    </div>
                </div>
            </div>
        `;
        
        // Set up network selector for unauthorized access
        this.setupUnauthorizedNetworkSelector();
    }

    /**
     * Set up network selector for unauthorized access screen
     */
    setupUnauthorizedNetworkSelector() {
        const networkSelect = document.getElementById('unauthorized-network-select');
        if (!networkSelect) {
            console.warn('⚠️ Unauthorized network selector not found');
            return;
        }

        networkSelect.addEventListener('change', async (event) => {
            const selectedNetwork = event.target.value;
            console.log(`🔄 Unauthorized access: Switching to ${selectedNetwork} network...`);
            
            try {
                // Use the existing network selector functionality
                if (window.networkSelector) {
                    await window.networkSelector.handleNetworkChange(selectedNetwork, 'admin');
                    console.log(`✅ Network switched to ${selectedNetwork} from unauthorized access screen`);
                } else {
                    console.error('❌ Network selector not available');
                }
            } catch (error) {
                console.error('❌ Error switching network from unauthorized access:', error);
            }
        });

        console.log('✅ Unauthorized network selector set up');
    }



    async loadAdminInterface() {
        console.log('🎨 Loading admin interface...');

        // Initialize performance optimization components
        this.initializeOptimizedComponents();

        // Create admin layout
        this.createAdminLayout();

        // Setup event listeners once layout elements exist
        this.setupEventListeners();

        // Load contract statistics
        await this.loadContractStats();

        // Load main components
        await this.loadMultiSignPanel();

        // Load info card (initializes layout and pulls live contract data)
        await this.loadInfoCard();

        // Setup network selector
        this.setupNetworkSelector();

        // Start auto-refresh
        this.startAutoRefresh();
    }

    /**
     * Initialize optimized performance components
     */
    initializeOptimizedComponents() {
        console.log('⚡ Initializing performance optimization components...');

        try {
            // Initialize optimized state management
            if (window.OptimizedAdminState) {
                this.optimizedAdminState = new window.OptimizedAdminState();
                console.log('✅ OptimizedAdminState initialized');
            }

            // Initialize efficient DOM updates
            if (window.EfficientDOMUpdates && this.optimizedAdminState) {
                this.efficientDOM = new window.EfficientDOMUpdates(this.optimizedAdminState);
                console.log('✅ EfficientDOMUpdates initialized');
            }

            // Initialize optimistic UI updates
            if (window.OptimisticUIUpdates && this.optimizedAdminState) {
                this.optimisticUI = new window.OptimisticUIUpdates(this.optimizedAdminState);
                console.log('✅ OptimisticUIUpdates initialized');
            }

            // Initialize performance monitor
            if (window.PerformanceMonitor) {
                this.performanceMonitor = new window.PerformanceMonitor();
                console.log('✅ PerformanceMonitor initialized');

                // Log performance report every 5 minutes
                setInterval(() => {
                    if (this.performanceMonitor) {
                        this.performanceMonitor.generateReport();
                    }
                }, 300000); // 5 minutes
            }

            console.log('🎉 All performance optimization components initialized successfully');

        } catch (error) {
            console.warn('⚠️ Failed to initialize some optimization components:', error);
            console.log('📋 Falling back to legacy admin panel behavior');
        }
    }

    /**
     * Setup event listeners for admin panel interactions
     */
    setupEventListeners() {
        console.log('🎧 Setting up admin panel event listeners...');

        try {
            this.setProposalButtonsEnabled(false);

            // Theme toggle event listener
            this.setupThemeToggle();

            // Navigation event listeners
            this.setupNavigationListeners();

            // Contract interaction event listeners
            this.setupContractListeners();

            // Modal and form event listeners
            this.setupModalListeners();

            // Refresh and update event listeners
            this.setupRefreshListeners();

            console.log('✅ Admin panel event listeners setup complete');

        } catch (error) {
            console.error('❌ Failed to setup event listeners:', error);
        }
    }

    /**
     * Set up network selector
     */
    setupNetworkSelector() {
        if (!window.networkSelector) {
            console.warn('⚠️ Network selector not available');
            return;
        }

        // Initialize network selector with change handler
        window.networkSelector.init(async (networkKey, context) => {
            console.log(`🌐 Network changed to ${networkKey} in ${context}`);
            
            // Refresh contract data for new network
            if (window.contractManager) {
                try {
                    await window.contractManager.initialize();
                    await this.loadContractStats();
                    await this.loadMultiSignPanel();
                } catch (error) {
                    console.error('❌ Error refreshing contract data:', error);
                }
            }

            // Update network indicator
            window.NetworkIndicator?.update('network-indicator', 'admin-network-selector', 'admin');
        });

    }

    /**
     * Setup theme toggle button with enhanced admin panel support
     */
    setupThemeToggle() {
        if (window.unifiedThemeManager) {
            window.unifiedThemeManager.setupToggleButton('theme-toggle');

            // Force apply theme to all admin elements immediately
            this.applyThemeToAllElements();

            // Listen for theme changes and reapply
            document.addEventListener('themeChanged', () => {
                console.log('🎨 Theme changed, reapplying to admin panel...');
                this.applyThemeToAllElements();
            });

            console.log('✅ Theme toggle button setup complete with admin panel support');
        } else {
            console.warn('⚠️ UnifiedThemeManager not available');
        }
    }

    /**
     * Apply theme to all admin panel elements
     */
    applyThemeToAllElements() {
        const theme = document.documentElement.getAttribute('data-theme') || 'light';
        console.log(`🎨 Applying theme to all admin elements: ${theme}`);

        // Apply to body
        document.body.setAttribute('data-theme', theme);

        // Apply to admin panel
        const adminPanel = document.querySelector('.admin-panel');
        if (adminPanel) {
            adminPanel.setAttribute('data-theme', theme);
        }

        // Apply to all modals
        document.querySelectorAll('.modal-content, .modal-overlay').forEach(el => {
            el.setAttribute('data-theme', theme);
        });

        // Apply to all cards
        document.querySelectorAll('.info-card, .admin-grid-main, .admin-grid-sidebar').forEach(el => {
            el.setAttribute('data-theme', theme);
        });

        // Apply to all notifications
        document.querySelectorAll('.notification').forEach(el => {
            el.setAttribute('data-theme', theme);
        });

        // Force CSS variable update
        this.updateCSSVariables(theme);
    }

    /**
     * Show loading state for contract data
     */
    showLoadingState() {
        const contractInfoSections = document.querySelectorAll('.info-card, .admin-grid-main, .admin-grid-sidebar');
        contractInfoSections.forEach(section => {
            section.classList.add('contract-info-loading');
        });
    }

    /**
     * Hide loading state for contract data
     */
    hideLoadingState() {
        const contractInfoSections = document.querySelectorAll('.info-card, .admin-grid-main, .admin-grid-sidebar');
        contractInfoSections.forEach(section => {
            section.classList.remove('contract-info-loading');
        });
    }

    /**
     * Update CSS variables for theme
     */
    updateCSSVariables(theme) {
        const root = document.documentElement;

        if (theme === 'dark') {
            root.style.setProperty('--background-default', '#121212');
            root.style.setProperty('--background-paper', '#1e1e1e');
            root.style.setProperty('--text-primary', '#ffffff');
            root.style.setProperty('--text-secondary', 'rgba(255, 255, 255, 0.7)');
            root.style.setProperty('--divider', 'rgba(255, 255, 255, 0.12)');
            root.style.setProperty('--surface-hover', 'rgba(255, 255, 255, 0.08)');
        } else {
            root.style.setProperty('--background-default', '#ffffff');
            root.style.setProperty('--background-paper', '#ffffff');
            root.style.setProperty('--text-primary', 'rgba(0, 0, 0, 0.87)');
            root.style.setProperty('--text-secondary', 'rgba(0, 0, 0, 0.6)');
            root.style.setProperty('--divider', 'rgba(0, 0, 0, 0.12)');
            root.style.setProperty('--surface-hover', 'rgba(0, 0, 0, 0.04)');
        }
    }

    /**
     * Setup navigation event listeners
     */
    setupNavigationListeners() {
        // Navigation buttons
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const section = button.getAttribute('data-section');
                if (section) {
                    this.navigateToSection(section);
                }
            });
        });

        // Active navigation highlighting
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('nav-btn')) {
                // Remove active class from all nav buttons
                navButtons.forEach(btn => btn.classList.remove('active'));
                // Add active class to clicked button
                e.target.classList.add('active');
            }
        });
    }

    /**
     * Setup wallet connection event listeners
     */
    setupWalletListeners() {
        // Listen for wallet connection events
        window.addEventListener('walletConnected', (event) => {
            console.log('🎉 Wallet connected event received:', event.detail);
            this.handleWalletConnected(event.detail);
        });

        window.addEventListener('walletDisconnected', () => {
            console.log('👋 Wallet disconnected event received');
            this.handleWalletDisconnected();
        });

        // Listen for account changes
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', async (accounts) => {
                console.log('🔄 Accounts changed:', accounts);
                try {
                    await this.handleAccountsChanged(accounts);
                } catch (error) {
                    console.error('❌ Error handling account change:', error);
                    this.showError('Account Switch Error', 'Failed to switch accounts. Please refresh the page.');
                }
            });

            window.ethereum.on('chainChanged', async (chainId) => {
                console.log('🌐 Chain changed:', chainId);
                try {
                    await this.handleChainChanged(chainId);
                } catch (error) {
                    console.error('❌ Error handling chain changed:', error);
                }
            });
        }
    }

    /**
     * Setup contract interaction event listeners
     */
    setupContractListeners() {
        // Listen for contract events
        window.addEventListener('contractReady', () => {
            console.log('📋 Contract ready event received');
            this.handleContractReady();
        });

        window.addEventListener('contractError', (event) => {
            console.log('❌ Contract error event received:', event.detail);
            this.handleContractError(event.detail);
        });

        // Listen for transaction events
        window.addEventListener('transactionStarted', (event) => {
            console.log('🚀 Transaction started:', event.detail);
            this.handleTransactionStarted(event.detail);
        });

        window.addEventListener('transactionCompleted', (event) => {
            console.log('✅ Transaction completed:', event.detail);
            this.handleTransactionCompleted(event.detail);
        });

        window.addEventListener('transactionFailed', (event) => {
            console.log('❌ Transaction failed:', event.detail);
            this.handleTransactionFailed(event.detail);
        });
    }

    /**
     * Setup modal and form event listeners
     */
    setupModalListeners() {
        // Global modal close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });

        // ENHANCED: Global click handler for modal buttons
        document.addEventListener('click', (e) => {
            // Debug: Log all clicks to see what's being clicked
            console.log('🔘 Click detected:', {
                target: e.target.tagName,
                classes: e.target.className,
                id: e.target.id,
                dataset: e.target.dataset
            });
            // Refresh button
            if (e.target.classList.contains('refresh-btn')) {
                e.preventDefault();
                console.log('🔘 Refresh button clicked');
                this.refreshData();
                return;
            }

            // Proposal buttons (main admin panel buttons)
            if (e.target.classList.contains('proposal-btn') && e.target.dataset.modal) {
                e.preventDefault();
                const modalType = e.target.dataset.modal;
                console.log(`🔘 Proposal button clicked: ${modalType}`);

                // Call the appropriate modal method
                switch (modalType) {
                    case 'hourly-rate':
                        console.log('🔧 DEBUG: About to call showHourlyRateModal()');
                        this.showHourlyRateModal();
                        console.log('🔧 DEBUG: showHourlyRateModal() completed');
                        break;
                    case 'add-pair':
                        this.showAddPairModal();
                        break;
                    case 'remove-pair':
                        this.showRemovePairModal();
                        break;
                    case 'update-weights':
                        this.showUpdateWeightsModal();
                        break;
                    case 'change-signer':
                        this.showChangeSignerModal();
                        break;
                    case 'withdraw-rewards':
                        this.showWithdrawalModal();
                        break;
                    default:
                        console.warn(`Unknown modal type: ${modalType}`);
                }
                return;
            }

            // Modal close buttons
            if (e.target.classList.contains('modal-close') ||
                e.target.closest('.modal-close')) {
                e.preventDefault();
                console.log('🔘 Modal close button clicked');
                this.closeModal();
                return;
            }

            // Modal overlay click (close modal)
            if (e.target.classList.contains('modal-overlay')) {
                e.preventDefault();
                console.log('🔘 Modal overlay clicked');
                this.closeModal();
                return;
            }

            // Cancel buttons in modals
            if (e.target.classList.contains('modal-cancel') ||
                (e.target.classList.contains('btn-secondary') && e.target.closest('.modal-content'))) {
                e.preventDefault();
                console.log('🔘 Modal cancel button clicked');
                this.closeModal();
                return;
            }

            // Add Another Pair button in Update Weights modal
            if (e.target.id === 'add-weight-pair') {
                e.preventDefault();
                console.log('🔘 Add Another Pair button clicked - opening Add Pair modal');
                this.closeModal(); // Close current modal
                setTimeout(() => {
                    this.showAddPairModal(); // Open Add Pair modal
                }, 100);
                return;
            }

            // Action buttons in modals (for backward compatibility)
            if (e.target.classList.contains('btn') && e.target.closest('.modal-content')) {
                const buttonText = e.target.textContent.trim();

                if (buttonText === 'Cancel') {
                    e.preventDefault();
                    console.log('🔘 Modal cancel button clicked (text match)');
                    this.closeModal();
                    return;
                }
            }
        });

        // Form validation listeners
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('form-input')) {
                this.validateFormInput(e.target);
            }
        });

        // ENHANCED: Form submission handling
        document.addEventListener('submit', (e) => {
            const form = e.target;

            // Handle admin forms
            if (form.classList.contains('admin-form') || form.closest('.modal-content')) {
                e.preventDefault(); // Always prevent default first
                console.log('📝 Form submitted:', form.id);

                // Add small delay to ensure DOM is ready
                setTimeout(async () => {
                    // Validate form using form ID
                    if (!this.validateForm(form.id)) {
                        console.warn('⚠️ Form validation failed');
                        return;
                    }

                    console.log('✅ Form validation passed, proceeding with submission');

                    // Handle specific form types with proper error handling
                    try {
                        switch (form.id) {
                            case 'hourly-rate-form':
                                await this.submitHourlyRateProposal(e);
                                break;
                            case 'add-pair-form':
                                await this.submitAddPairProposal(e);
                                break;
                            case 'remove-pair-form':
                                await this.submitRemovePairProposal(e);
                                break;
                            case 'update-weights-form':
                                await this.submitUpdateWeightsProposal(e);
                                break;
                            case 'change-signer-form':
                                await this.submitChangeSignerProposal(e);
                                break;
                            case 'withdrawal-form':
                                await this.submitWithdrawalProposal(e);
                                break;
                            default:
                                console.log('📝 Unhandled form submission:', form.id);
                        }
                    } catch (error) {
                        console.error('❌ Form submission failed:', error);
                        this.showError(error.message || 'Failed to submit form');
                    }
                }, 100);
            }
        });
    }

    /**
     * Setup refresh and update event listeners
     */
    setupRefreshListeners() {
        // Manual refresh button
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('refresh-btn')) {
                e.preventDefault();
                this.refreshData();
            }
        });

        // Auto-refresh toggle
        document.addEventListener('change', (e) => {
            if (e.target.id === 'auto-refresh-toggle') {
                if (e.target.checked) {
                    this.startAutoRefresh();
                } else {
                    this.stopAutoRefresh();
                }
            }
        });

        // SELECTIVE UPDATE OPTIMIZATION: Disable automatic refresh on tab switching
        // Page visibility change (pause refresh when tab not active) - NO AUTO REFRESH ON FOCUS
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseAutoRefresh();
            } else {
                // OPTIMIZATION: Resume auto-refresh but don't trigger immediate refresh
                // This eliminates unnecessary full refreshes when switching tabs
                this.autoRefreshPaused = false;
                console.log('▶️ Auto-refresh resumed (tab active) - no immediate refresh');
            }
        });
    }

    /**
     * Event handler methods
     */
    navigateToSection(section) {
        console.log(`🧭 Navigating to section: ${section}`);

        // Update active navigation
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-section') === section) {
                btn.classList.add('active');
            }
        });

        // Load section content
        switch (section) {
            case 'dashboard':
                this.showDashboard();
                break;
            case 'pairs':
                this.showPairsManagement();
                break;
            case 'users':
                this.showUsersManagement();
                break;
            case 'settings':
                this.showSettings();
                break;
            default:
                console.warn(`Unknown section: ${section}`);
                this.showDashboard();
        }
    }

    handleWalletConnected(detail) {
        console.log('🎉 Handling wallet connected:', detail);

        // Update UI to reflect connected state
        const connectButtons = document.querySelectorAll('.connect-wallet-btn');
        connectButtons.forEach(btn => {
            btn.textContent = 'Wallet Connected';
            btn.disabled = true;
            btn.classList.add('connected');
        });

        // Refresh admin data
        this.refreshData();

        // Re-verify admin access
        this.verifyAdminAccess();
    }

    handleWalletDisconnected() {
        console.log('👋 Handling wallet disconnected');

        // Update UI to reflect disconnected state
        const connectButtons = document.querySelectorAll('.connect-wallet-btn');
        connectButtons.forEach(btn => {
            btn.textContent = 'Connect Wallet';
            btn.disabled = false;
            btn.classList.remove('connected');
        });

        // Show connect prompt
        this.showConnectWalletPrompt();
    }

    async handleAccountsChanged(accounts) {
        console.log('🔄 Handling accounts changed:', accounts);

        if (accounts.length === 0) {
            // No accounts connected
            this.handleWalletDisconnected();
            this.stopAutoRefresh();
        } else {
            // Account switched
            const newAddress = accounts[0];
            console.log('🔄 Account switched to:', newAddress);

            // Update wallet connection info
            if (window.walletConnection) {
                window.walletConnection.address = newAddress;
            }

            // Re-verify admin access with new account
            await this.verifyAdminAccess();
            
            // Stop auto-refresh and update UI based on authorization
            this.stopAutoRefresh();
            if (this.isAuthorized) {
                console.log('✅ New account authorized, reloading interface...');
                await this.loadAdminInterface();
                this.startAutoRefresh();
            } else {
                console.log('❌ New account unauthorized, access denied');
                this.showUnauthorizedAccess();
            }
        }
    }

    async handleChainChanged(chainId) {
        console.log('🌐 Handling chain changed:', chainId);

        // Update network indicator when chain changes
        const indicator = document.getElementById('network-indicator');
        if (indicator) {
            const chainIdDecimal = parseInt(chainId, 16);
            const expectedChainId = window.CONFIG.NETWORK.CHAIN_ID;

            // Check permission asynchronously and update
            if (window.networkManager) {
                window.networkManager.hasRequiredNetworkPermission().then(hasPermission => {
                    window.NetworkIndicator?.update('network-indicator', 'admin-network-selector', 'admin');
                }).catch(error => {
                    console.error('Error checking permission after chain change:', error);
                });
            }
        }

        // CRITICAL: Re-verify admin access when network changes
        // This ensures users are kicked out if they don't have admin permissions on the new network
        console.log('🔐 Re-verifying admin access after network change...');
        try {
            await this.verifyAdminAccess();
            
            if (this.isAuthorized) {
                console.log('✅ Admin access verified for new network');
                // Reload the admin interface to ensure it's working with the new network
                await this.loadAdminInterface();
            } else {
                console.log('❌ Admin access denied for new network - showing unauthorized access');
                this.showUnauthorizedAccess();
            }
        } catch (error) {
            console.error('❌ Error re-verifying admin access after network change:', error);
            this.showUnauthorizedAccess();
        }
    }

    handleContractReady() {
        console.log('📋 Handling contract ready');

        // Refresh contract data
        this.loadContractStats();
        this.refreshData();
    }

    handleContractError(error) {
        console.error('❌ Handling contract error:', error);

        this.showError('Contract Error', error.message || 'Contract interaction failed');
    }

    handleTransactionStarted(detail) {
        console.log('🚀 Handling transaction started:', detail);

        // Show loading indicator
        this.showTransactionStatus('pending', 'Transaction submitted...', detail.hash);
    }

    handleTransactionCompleted(detail) {
        console.log('✅ Handling transaction completed:', detail);

        // Show success message
        this.showTransactionStatus('success', 'Transaction completed!', detail.hash);

        // Refresh data
        setTimeout(() => {
            this.refreshData();
        }, 2000);
    }

    handleTransactionFailed(detail) {
        console.error('❌ Handling transaction failed:', detail);

        // Show error message
        this.showTransactionStatus('error', 'Transaction failed', detail.hash, detail.error);
    }

    validateFormInput(input) {
        const value = input.value.trim();
        const type = input.getAttribute('data-validation');

        let isValid = true;
        let errorMessage = '';

        switch (type) {
            case 'address':
                isValid = /^0x[a-fA-F0-9]{40}$/.test(value);
                errorMessage = 'Please enter a valid Ethereum address';
                break;
            case 'number':
                isValid = !isNaN(value) && parseFloat(value) > 0;
                errorMessage = 'Please enter a valid positive number';
                break;
            case 'required':
                isValid = value.length > 0;
                errorMessage = 'This field is required';
                break;
        }

        // Update input styling
        if (isValid) {
            input.classList.remove('invalid');
            input.classList.add('valid');
        } else {
            input.classList.remove('valid');
            input.classList.add('invalid');
        }

        // Show/hide error message
        const errorElement = input.parentNode.querySelector('.error-message');
        if (errorElement) {
            errorElement.textContent = isValid ? '' : errorMessage;
            errorElement.style.display = isValid ? 'none' : 'block';
        }

        return isValid;
    }

    showTransactionStatus(status, message, hash, error = null) {
        const statusContainer = document.getElementById('transaction-status') || this.createTransactionStatusContainer();

        let statusClass = '';
        let icon = '';

        switch (status) {
            case 'pending':
                statusClass = 'status-pending';
                icon = '⏳';
                break;
            case 'success':
                statusClass = 'status-success';
                icon = '✅';
                break;
            case 'error':
                statusClass = 'status-error';
                icon = '❌';
                break;
        }

        statusContainer.className = `transaction-status ${statusClass}`;
        statusContainer.innerHTML = `
            <div class="status-content">
                <span class="status-icon">${icon}</span>
                <span class="status-message">${message}</span>
                ${hash ? `<a href="https://amoy.polygonscan.com/tx/${hash}" target="_blank" class="tx-link">View Transaction</a>` : ''}
                ${error ? `<div class="error-details">${error}</div>` : ''}
            </div>
            <button class="close-status" onclick="this.parentNode.style.display='none'">×</button>
        `;

        statusContainer.style.display = 'block';

        // Auto-hide success messages after 5 seconds
        if (status === 'success') {
            setTimeout(() => {
                statusContainer.style.display = 'none';
            }, 5000);
        }
    }

    createTransactionStatusContainer() {
        const container = document.createElement('div');
        container.id = 'transaction-status';
        container.className = 'transaction-status';

        // Insert at top of admin content
        const adminContent = document.getElementById('admin-content');
        if (adminContent) {
            adminContent.insertBefore(container, adminContent.firstChild);
        } else {
            document.body.appendChild(container);
        }

        return container;
    }

    pauseAutoRefresh() {
        this.autoRefreshPaused = true;
        console.log('⏸️ Auto-refresh paused (tab not active)');
    }

    resumeAutoRefresh() {
        this.autoRefreshPaused = false;
        console.log('▶️ Auto-refresh resumed (tab active)');

        // SELECTIVE UPDATE OPTIMIZATION: Don't refresh immediately on tab focus
        // This eliminates unnecessary full refreshes when switching tabs
        // Manual refresh button still works if user wants to refresh
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
            this.autoRefreshActive = false; // Reset auto-refresh flag
            console.log('⏹️ Auto-refresh stopped');
        }
    }

    /**
     * Create network indicator component
     * Modern approach: Shows permission status instead of blocking on active network
     */
    createNetworkIndicator() {
        const chainId = window.walletManager?.getChainId();
        const expectedChainId = window.CONFIG.NETWORK.CHAIN_ID;
        const expectedNetworkName = window.CONFIG?.NETWORK?.NAME || 'Unknown';

        // We'll check permission asynchronously and update the indicator
        // For now, show current network status
        const onExpectedNetwork = chainId === expectedChainId;

        // Schedule async permission check to update indicator
        if (window.networkManager) {
            window.networkManager.hasRequiredNetworkPermission().then(hasPermission => {
                window.NetworkIndicator?.update('network-indicator', 'admin-network-selector', 'admin');
            }).catch(error => {
                console.error('Error checking network permission:', error);
            });
        }

        return `
            <div class="network-indicator-home ${onExpectedNetwork ? 'has-permission' : 'missing-permission'}" id="network-indicator">
                <span class="network-status-dot ${onExpectedNetwork ? 'green' : 'red'}"></span>
                <div id="admin-network-selector"></div>
                ${!onExpectedNetwork ? `
                    <button class="btn-grant-permission" onclick="${window.PermissionUtils?.getPermissionButtonAction(expectedNetworkName, 'admin') || `window.networkManager.requestPermissionWithUIUpdate('admin')`}" title="${window.PermissionUtils?.getPermissionButtonTitle(expectedNetworkName) || `Grant permission for ${expectedNetworkName}`}">
                        ${window.PermissionUtils?.getPermissionButtonText(expectedNetworkName) || `Grant ${expectedNetworkName} Permission`}
                    </button>
                ` : ''}
            </div>
        `;
    }



    /**
     * Create wallet address display component
     */
    createWalletAddressDisplay() {
        // Get wallet address from multiple sources
        const address = this.userAddress 
            || window.walletManager?.address 
            || window.walletConnection?.address;

        const walletIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 6px;">
            <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
        </svg>`;

        const displayText = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not Connected';
        const title = address ? `Connected: ${address}` : 'No wallet connected';

        return `
            <div class="wallet-address-display" title="${title}">
                ${walletIcon}
                <span class="wallet-address-text">${displayText}</span>
            </div>
        `;
    }

    createAdminLayout() {
        const container = document.getElementById('admin-content') || document.body;
        const devModeIndicator = this.DEVELOPMENT_MODE
            ? '<div class="dev-mode-banner">🚧 DEVELOPMENT MODE - Access Control Bypassed</div>'
            : '';

        container.innerHTML = `
            <div class="admin-panel">
                ${devModeIndicator}

                <!-- Admin Header with Theme Toggle and Network Indicator -->
                <header class="admin-header">
                    <div class="admin-header-content">
                        <div class="admin-header-left">
                            <button class="btn btn-secondary back-btn" onclick="navigateToHome()" title="Back to Staking Page">
                                ← Back to Staking
                            </button>
                            <h1 class="admin-title">Admin Panel</h1>
                            <span class="version-badge" id="admin-version">v0.0.0</span>
                        </div>
                        <div class="admin-header-right">
                            ${this.createNetworkIndicator()}
                            ${this.createWalletAddressDisplay()}
                            <nav class="admin-nav">
                                <button id="theme-toggle" class="theme-toggle" aria-label="Toggle theme">
                                    <span class="material-icons-outlined">light_mode</span>
                                </button>
                            </nav>
                        </div>
                    </div>
                </header>

                <!-- Container maxWidth="lg" with py: 4 (matching React) -->
                <div class="admin-container">

                    <!-- Grid container spacing={3} -->
                    <div class="admin-grid">
                        <!-- Grid item xs={12} md={9} - MultiSign Panel -->
                        <div class="admin-grid-main">
                            <div id="multisign-panel">
                                <!-- MultiSign Panel will be loaded here -->
                            </div>
                        </div>

                        <!-- Grid item xs={12} md={3} - New Proposal -->
                        <div class="admin-grid-sidebar">
                            <!-- Typography variant="h5" gutterBottom -->
                            <h2 class="proposal-title">New Proposal</h2>

                            <!-- Stack direction="column" spacing={2} -->
                            <div class="proposal-actions">
                                <!-- Button variant="contained" color="primary" -->
                                <button class="proposal-btn" data-modal="hourly-rate" type="button">
                                    Update Hourly Rate
                                </button>
                                <button class="proposal-btn" data-modal="add-pair" type="button">
                                    Add Pair
                                </button>
                                <button class="proposal-btn" data-modal="remove-pair" type="button">
                                    Remove Pair
                                </button>
                                <button class="proposal-btn" data-modal="update-weights" type="button">
                                    Update Pair Weight
                                </button>
                                <button class="proposal-btn" data-modal="change-signer" type="button">
                                    Change Signer
                                </button>
                                <button class="proposal-btn" data-modal="withdraw-rewards" type="button">
                                    Withdraw Rewards
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Box sx={{ mt: 4 }} - Info Card Section -->
                    <div class="info-card-section">
                        <div id="info-card">
                            <!-- Info Card will be loaded here -->
                        </div>
                    </div>
                </div>

            </div>
        `;

        // Prevent proposal actions until the underlying data is ready
        this.setProposalButtonsEnabled(false);
        
        // Display version in header
        if (window.getCurrentVersion) {
            window.getCurrentVersion().then(version => {
                const versionElement = document.getElementById('admin-version');
                if (versionElement) {
                    versionElement.textContent = 'v' + version;
                }
            });
        }
    }

    /**
     * Toggle the proposal buttons so they stay inactive until data is ready
     */
    setProposalButtonsEnabled(enabled) {
        const proposalButtons = document.querySelectorAll('.proposal-btn');

        proposalButtons.forEach(button => {
            button.disabled = !enabled;
            button.setAttribute('aria-disabled', (!enabled).toString());
            if (enabled) {
                button.removeAttribute('title');
            } else if (!button.hasAttribute('title')) {
                button.title = 'Unavailable while proposals load';
            }
        });
    }

    async loadMultiSignPanel() {
        console.log('📋 Loading MultiSign Panel...');
        const panelDiv = document.getElementById('multisign-panel');

        if (!panelDiv) {
            console.warn('⚠️ Network status container not found');
            return;
        }

        try {
            // Show loading indicator
            panelDiv.innerHTML = `
                <div class="multisign-panel">
                    <div class="panel-header">
                        <h2>Multi-Signature Proposals</h2>
                    </div>
                    <div class="loading-container" style="text-align: center; padding: 40px;">
                        <div class="loading-spinner" style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        <div style="margin-top: 15px; color: #666;">Loading proposals...</div>
                        <div style="margin-top: 5px; font-size: 0.9em; color: #999;">This may take a few seconds</div>
                    </div>
                </div>
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            `;

            // Load proposals data
            const proposals = await this.loadProposals();

            // Set loaded proposal count for pagination
            this.loadedProposalCount = proposals.length;
            console.log(`📊 Set loadedProposalCount to ${this.loadedProposalCount}`);

            // Filter proposals based on hide-executed checkbox (default: hide executed)
            const filteredProposals = proposals.filter(proposal => !proposal.executed);
            console.log(`📊 Filtered proposals: ${filteredProposals.length} (hidden ${proposals.length - filteredProposals.length} executed)`);
            console.log(`📊 First 5 filtered proposals:`, filteredProposals.slice(0, 5).map(p => ({ id: p.id, executed: p.executed, actionType: p.actionType })));

            panelDiv.innerHTML = `
                <div class="multisign-panel">
                    <div class="panel-header">
                        <div class="panel-title-row">
                            <h2>Multi-Signature Proposals</h2>
                            <div class="panel-refresh">
                                <button class="btn btn-sm refresh-btn" type="button" onclick="adminPage.refreshData()">
                                    🔄 Refresh
                                </button>
                            </div>
                        </div>
                        <div class="panel-controls">
                            <label class="checkbox-label">
                                <input type="checkbox" id="hide-executed" checked>
                                Hide executed transactions
                            </label>
                            <div class="panel-stats">
                                <span class="stat-chip">Total Proposals: ${proposals.length}</span>
                                <span class="stat-chip">Showing: ${filteredProposals.length}</span>
                                <span class="stat-chip">Required Approvals: ${this.contractStats.requiredApprovals || 2}</span>
                                <span class="stat-chip data-source-indicator" id="data-source-indicator">
                                    ${this.isUsingRealData ? '🔗 Live Data' : '🎭 Demo Data'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="proposals-table">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th></th>
                                    <th>ID</th>
                                    <th>Action Type</th>
                                    <th>Approvals</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="proposals-tbody">
                                ${this.renderProposalsRows(filteredProposals)}
                            </tbody>
                        </table>
                        ${this.renderLoadMoreButton(proposals)}
                    </div>
                </div>
            `;

            // Proposals are ready, enable actions now that data exists
            this.setProposalButtonsEnabled(true);

            // Add event listener for hide-executed checkbox
            const hideExecutedCheckbox = document.getElementById('hide-executed');
            if (hideExecutedCheckbox) {
                hideExecutedCheckbox.addEventListener('change', () => {
                    this.toggleExecutedProposals();
                });
            }

        } catch (error) {
            console.error('❌ Failed to load MultiSign Panel:', error);

            // Provide more detailed error information and fallback UI
            const isContractError = error.message.includes('Contract') || error.message.includes('not available');
            const isNetworkError = error.message.includes('network') || error.message.includes('RPC');

            let errorTitle = '⚠️ Failed to load proposals';
            let errorMessage = error.message;
            let suggestions = '';

            if (isContractError) {
                errorTitle = '🔗 Contract Connection Issue';
                suggestions = `
                    <div class="error-suggestions">
                        <p><strong>Possible solutions:</strong></p>
                        <ul>
                            <li>Check if your wallet is connected to the correct network</li>
                            <li>Verify contract addresses in configuration</li>
                            <li>Try refreshing the page</li>
                        </ul>
                    </div>
                `;
            } else if (isNetworkError) {
                errorTitle = '🌐 Network Connection Issue';
                suggestions = `
                    <div class="error-suggestions">
                        <p><strong>Possible solutions:</strong></p>
                        <ul>
                            <li>Check your internet connection</li>
                            <li>Try switching to a different RPC endpoint</li>
                            <li>Wait a moment and retry</li>
                        </ul>
                    </div>
                `;
            }

            if (panelDiv) {
                panelDiv.innerHTML = `
                    <div class="error-panel">
                        <h3>${errorTitle}</h3>
                        <p class="error-message">${errorMessage}</p>
                        ${suggestions}
                        <div class="error-actions">
                            <button class="btn btn-secondary" onclick="adminPage.loadMultiSignPanel()">
                                🔄 Retry
                            </button>
                            <button class="btn btn-outline" onclick="adminPage.checkNetworkConnectivity().then(ok => console.log('Network check result:', ok))">
                            🌐 Check Network
                        </button>
                        <button class="btn btn-outline" onclick="adminPage.forceLoadRealProposals()">
                            🔗 Try Real Data
                        </button>
                        <button class="btn btn-outline" onclick="adminPage.loadMockProposals().then(proposals => adminPage.renderProposalsRows(proposals))">
                            📋 Load Demo Data
                        </button>
                    </div>
                </div>
            `;
            }

            // Keep proposal actions disabled until recovery
            this.setProposalButtonsEnabled(false);
        }
    }

    getInfoCardSkeleton() {
        return `
            <div class="info-card">
                <div class="card-header">
                    <h3>Contract Information</h3>
                    <button class="btn btn-sm" onclick="adminPage.refreshContractInfo()">
                        🔄 Refresh
                    </button>
                </div>

                <div class="card-content">
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">💰 Reward Balance</div>
                            <div class="info-value" data-info="reward-balance">Loading...</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">⏰ Hourly Rate</div>
                            <div class="info-value" data-info="hourly-rate">Loading...</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">⚖️ Total Weight</div>
                            <div class="info-value" data-info="total-weight">Loading...</div>
                        </div>
                    </div>

                    <div class="pairs-section">
                        <h4>🔗 LP Pairs</h4>
                        <div class="pairs-list" data-info="lp-pairs">
                            <div class="info-value">Loading pairs...</div>
                        </div>
                    </div>

                    <div class="signers-section">
                        <h4>👥 Current Signers</h4>
                        <div class="signers-list" data-info="signers">
                            <div class="info-value">Loading signers...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadInfoCard() {
        console.log('📊 Loading Info Card...');
        const cardDiv = document.getElementById('info-card');

        if (!cardDiv) {
            console.warn('⚠️ Info card container not found.');
            return;
        }

        // Render layout with loading placeholders so the UI stays responsive while data loads
        cardDiv.innerHTML = this.getInfoCardSkeleton();

        try {
            const result = await this.loadContractInformation();
            if (!result || result.success === false) {
                const errorMessage = (result && result.error && result.error.message) || 'An unknown error occurred.';
                cardDiv.innerHTML = `
                    <div class="error-panel">
                        <h3>⚠️ Failed to load contract info</h3>
                        <p>${errorMessage}</p>
                        <button class="btn btn-secondary" onclick="adminPage.loadInfoCard()">
                            🔄 Retry
                        </button>
                    </div>
                `;
            }
        } catch (error) {
            console.error('❌ Failed to load Info Card:', error);
            cardDiv.innerHTML = `
                <div class="error-panel">
                    <h3>⚠️ Failed to load contract info</h3>
                    <p>${error.message}</p>
                    <button class="btn btn-secondary" onclick="adminPage.loadInfoCard()">
                        🔄 Retry
                    </button>
                </div>
            `;
        }
    }

    /**
     * Load professional mock proposals that look completely real
     */
    async loadMockProposals() {
        console.log('📋 Loading enhanced mock proposals...');
        console.log('🔧 DEBUG: Mock proposals map size:', this.mockProposals.size);
        console.log('🔧 DEBUG: Mock proposals keys:', Array.from(this.mockProposals.keys()));

        const mockProposals = this.getMockProposals();
        console.log('🔧 DEBUG: getMockProposals returned:', mockProposals.length, 'proposals');

        // Convert to the format expected by the UI with enhanced data
        const formattedProposals = mockProposals.map(proposal => {
            // Ensure actionType is always defined and valid
            let actionType = proposal.actionType || 'UNKNOWN';
            if (typeof actionType !== 'string') {
                console.warn('⚠️ Invalid actionType for proposal:', proposal);
                actionType = 'UNKNOWN';
            }

            const baseProposal = {
                id: proposal.id || Math.floor(Math.random() * 1000),
                actionType: actionType, // Ensure this is always a string
                approvals: proposal.approvals || proposal.currentApprovals || 1,
                requiredApprovals: proposal.requiredApprovals || 3,
                executed: proposal.executed || proposal.status === 'EXECUTED',
                rejected: proposal.rejected || proposal.status === 'REJECTED',
                expired: proposal.expired || (proposal.expiresAt && proposal.expiresAt < Date.now()),
                proposedTime: proposal.proposedTime || Math.floor((proposal.createdAt || Date.now()) / 1000),
                approvedBy: proposal.approvedBy || Array.from(this.mockApprovals.get(proposal.id) || []),
                title: proposal.title || `Proposal #${proposal.id}`,
                description: proposal.description || 'Mock proposal for testing',
                proposer: proposal.proposer || '0x1234567890123456789012345678901234567890',
                transactionHash: proposal.transactionHash || '0x' + Math.random().toString(16).substr(2, 64),
                votes: proposal.votes || []
            };

            // Add enhanced data based on proposal type for detailed display
            switch (proposal.actionType) {
                case 'ADD_PAIR':
                    return {
                        ...baseProposal,
                        pairToAdd: proposal.details?.pairToAdd || '0x1234567890123456789012345678901234567890',
                        pairNameToAdd: proposal.details?.pairNameToAdd || 'TEST/USDC',
                        platformToAdd: proposal.details?.platformToAdd || 'Uniswap V3',
                        weightToAdd: BigInt(proposal.details?.weightToAdd || 100)
                    };
                case 'UPDATE_RATE':
                case 'SET_HOURLY_REWARD_RATE':
                    return {
                        ...baseProposal,
                        newHourlyRewardRate: (() => {
                            const rawRate = proposal.details?.newHourlyRewardRate ?? '100';
                            const rateString = rawRate.toString();
                            if (ethers?.utils?.parseEther) {
                                return BigInt(ethers.utils.parseEther(rateString).toString());
                            }
                            return BigInt(Math.floor(parseFloat(rateString || '100') * 1e18));
                        })()
                    };
                case 'REMOVE_PAIR':
                    return {
                        ...baseProposal,
                        pairToRemove: proposal.details?.pairToRemove || '0x1234567890123456789012345678901234567890',
                        pairNameToRemove: proposal.details?.pairNameToRemove || 'OLD/USDC'
                    };
                case 'WITHDRAW_REWARDS':
                    return {
                        ...baseProposal,
                        recipient: proposal.details?.recipient || proposal.proposer || '0x1234567890123456789012345678901234567890',
                        withdrawAmount: BigInt(proposal.details?.withdrawAmount || '500000000000000000000')
                    };
                case 'CHANGE_SIGNER':
                    return {
                        ...baseProposal,
                        newSigner: proposal.details?.newSigner || '0x1234567890123456789012345678901234567890'
                    };
                default:
                    return baseProposal;
            }
        });

        console.log(`✅ Loaded ${formattedProposals.length} mock proposals`);
        console.log('🔧 DEBUG: Formatted proposals:', formattedProposals.map(p => ({ id: p.id, actionType: p.actionType })));
        return formattedProposals;
    }

    /**
     * Format mock proposal details for display
     */
    formatMockProposalDetails(proposal) {
        switch (proposal.type) {
            case 'ADD_PAIR':
                return {
                    type: 'Add LP Pair',
                    pairAddress: proposal.data.pairAddress,
                    pairName: proposal.data.pairName,
                    platform: proposal.data.platform,
                    weight: proposal.data.weight
                };
            case 'UPDATE_RATE':
                return {
                    type: 'Update Reward Rate',
                    newRate: proposal.data.newRate
                };
            case 'REMOVE_PAIR':
                return {
                    type: 'Remove LP Pair',
                    pairAddress: proposal.data.pairAddress,
                    reason: proposal.data.reason
                };
            default:
                return {
                    type: proposal.type,
                    data: proposal.data
                };
        }
    }

    /**
     * PERFORMANCE OPTIMIZATION: Add new proposal optimistically
     */
    addProposalOptimistically(proposalData, transactionHash) {
        console.log('🚀 [OPTIMISTIC] Adding proposal optimistically:', proposalData);

        const optimisticProposal = {
            id: proposalData.id || `temp-${Date.now()}`,
            actionType: proposalData.actionType,
            status: 'PENDING',
            proposer: this.userAddress,
            createdAt: Date.now(),
            transactionHash: transactionHash,
            isOptimistic: true,
            ...proposalData
        };

        // Add to cache
        this.proposalsCache.set(optimisticProposal.id, optimisticProposal);
        this.pendingOptimisticUpdates.set(optimisticProposal.id, {
            proposal: optimisticProposal,
            transactionHash: transactionHash,
            timestamp: Date.now()
        });

        // Update UI immediately
        this.renderSingleProposal(optimisticProposal, true);

        console.log('✅ [OPTIMISTIC] Proposal added to UI instantly');
        return optimisticProposal;
    }

    /**
     * PERFORMANCE OPTIMIZATION: Update single proposal without full refresh
     */
    async updateSingleProposal(proposalId, forceRefresh = false) {
        console.log(`🎯 [SINGLE UPDATE] Updating proposal ${proposalId}`);

        try {
            const contractManager = await this.ensureContractReady();
            const proposalData = await contractManager.getAction(proposalId);

            if (proposalData) {
                const formattedProposal = this.formatRealProposals([proposalData])[0];

                // Update cache
                this.proposalsCache.set(proposalId, formattedProposal);

                // Remove from optimistic updates if it exists
                this.pendingOptimisticUpdates.delete(proposalId);

                // Update UI for this specific proposal
                this.renderSingleProposal(formattedProposal, false);

                console.log(`✅ [SINGLE UPDATE] Proposal ${proposalId} updated successfully`);
                return formattedProposal;
            }
        } catch (error) {
            console.error(`❌ [SINGLE UPDATE] Failed to update proposal ${proposalId}:`, error);
        }
    }

    /**
     * PERFORMANCE OPTIMIZATION: Render single proposal in UI
     */
    renderSingleProposal(proposal, isNew = false) {
        const proposalsTable = document.querySelector('#proposals-table tbody');
        if (!proposalsTable) return;

        const existingRow = document.querySelector(`[data-proposal-id="${proposal.id}"]`);

        if (existingRow && !isNew) {
            // Update existing row
            existingRow.outerHTML = this.generateProposalRowHTML(proposal);
        } else if (isNew) {
            // Add new row at the top
            const newRowHTML = this.generateProposalRowHTML(proposal);
            proposalsTable.insertAdjacentHTML('afterbegin', newRowHTML);

            // Highlight new proposal
            const newRow = proposalsTable.querySelector(`[data-proposal-id="${proposal.id}"]`);
            if (newRow) {
                newRow.classList.add('new-proposal-highlight');
                setTimeout(() => {
                    newRow.classList.remove('new-proposal-highlight');
                }, 3000);
            }
        }
    }

    /**
     * PERFORMANCE OPTIMIZATION: Generate HTML for single proposal row
     * This should match the format from renderProposalsRows for consistency
     * INCLUDES BOTH MAIN ROW AND DETAILS ROW
     */
    generateProposalRowHTML(proposal) {
        // Ensure required fields have defaults
        proposal.approvals = proposal.approvals || proposal.currentApprovals || 0;
        proposal.requiredApprovals = proposal.requiredApprovals || 2;
        proposal.executed = proposal.executed || false;
        proposal.rejected = proposal.rejected || false;
        proposal.id = proposal.id || 'unknown';
        proposal.approvedBy = proposal.approvedBy || [];

        const canExecute = proposal.approvals >= proposal.requiredApprovals && !proposal.executed && !proposal.rejected && !proposal.expired;
        const statusClass = proposal.executed ? 'executed' : proposal.rejected ? 'rejected' : proposal.expired ? 'expired' : canExecute ? 'ready' : 'pending';
        const statusText = proposal.executed ? '✅ Executed' : proposal.rejected ? '❌ Rejected' : proposal.expired ? '⏰ Expired' : canExecute ? '🚀 Ready to Execute' : '⏳ Pending';

        // Enhanced action type display with icons
        const actionTypeDisplay = this.getActionTypeDisplay(proposal.actionType);

        // Enhanced proposal summary
        const proposalSummary = this.getProposalSummary(proposal);

        return `
            <tr class="proposal-row ${statusClass}">
                <td>
                    <button class="expand-btn" onclick="adminPage.toggleProposal('${proposal.id}')" title="View Details">
                        <span class="expand-icon">▶</span>
                    </button>
                </td>
                <td>
                    <div class="proposal-id-container">
                        <span class="proposal-id">#${proposal.id}</span>
                        <div class="proposal-summary">${proposalSummary}</div>
                    </div>
                </td>
                <td>
                    <div class="action-type-container">
                        <span class="action-type ${proposal.actionType.toLowerCase()}">${actionTypeDisplay}</span>
                    </div>
                </td>
                <td>
                    <div class="approvals-container">
                        <div class="approval-progress">
                            <div class="approval-bar">
                                <div class="approval-fill" style="width: ${(proposal.approvals / proposal.requiredApprovals) * 100}%"></div>
                            </div>
                            <span class="approval-text">${proposal.approvals} / ${proposal.requiredApprovals}</span>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </td>
                <td>
                    <div class="action-buttons">
                        ${!proposal.executed && !proposal.rejected && !proposal.expired ? this.renderProposalActionButtons(proposal, canExecute) : ''}
                    </div>
                </td>
            </tr>
            <tr id="details-${proposal.id}" class="proposal-details-row" style="display: none;">
                <td colspan="6">
                    <div class="proposal-details">
                        <div class="details-header">
                            <h4>📋 Proposal Details</h4>
                        </div>
                        <div class="details-content">
                            ${this.renderProposalParameters(proposal.actionType, proposal)}
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Render action buttons for proposal with already-voted check
     * Matches React implementation: Disables voting for users who have already approved
     */
    renderProposalActionButtons(proposal, canExecute = false) {
        if (proposal.isOptimistic) {
            return '<span class="text-muted">Processing...</span>';
        }

        // Check if current user has already approved this proposal
        const userAddress = this.userAddress?.toLowerCase();
        const approvedBy = (proposal.approvedBy || []).map(addr => addr.toLowerCase());
        const hasAlreadyApproved = userAddress && approvedBy.includes(userAddress);

        // The first approver is the proposer (auto-approved when created)
        const proposerAddress = approvedBy.length > 0 ? approvedBy[0] : null;
        const isProposer = userAddress && proposerAddress && userAddress === proposerAddress;

        // Debug logging
        console.log(`🔍 Proposal #${proposal.id} voting check:`, {
            userAddress,
            proposerAddress,
            isProposer,
            hasAlreadyApproved,
            approvedBy,
            proposalId: proposal.id
        });

        return `
            <button
                class="btn btn-icon-compact btn-success ${hasAlreadyApproved ? 'disabled' : ''}"
                onclick="adminPage.approveAction('${proposal.id}')"
                title="${hasAlreadyApproved ? 'You have already approved this proposal' : 'Approve Proposal'}"
                ${hasAlreadyApproved ? 'disabled' : ''}
            >
                ✓
            </button>
            <button
                class="btn btn-icon-compact btn-danger ${hasAlreadyApproved ? 'disabled' : ''}"
                onclick="adminPage.rejectAction('${proposal.id}')"
                title="${hasAlreadyApproved ? 'You cannot reject after approving this proposal' : 'Reject Proposal'}"
                ${hasAlreadyApproved ? 'disabled' : ''}
            >
                ✕
            </button>
            ${canExecute ? `
                <button
                    class="btn btn-icon-compact btn-primary"
                    onclick="adminPage.executeAction('${proposal.id}')"
                    title="Execute Proposal"
                >
                    ▶
                </button>
            ` : ''}
            ${hasAlreadyApproved ? `
                <span class="approval-badge" title="You ${isProposer ? 'created and ' : ''}approved this">👤</span>
            ` : ''}
        `;
    }

    /**
     * Refresh admin panel data (optimized version with selective updates)
     */
    async refreshData() {
        if (this.isRefreshing) {
            console.log('🔄 Refresh already in progress, skipping...');
            return;
        }

        // Show loading state
        this.showLoadingState();
        this.setProposalButtonsEnabled(false);

        this.isRefreshing = true;
        console.log('🔄 Refreshing admin panel data...');

        try {
            // IMPORTANT: Clear proposal cache to force fresh data
            this.proposalsCache.clear();
            this.proposalStates.clear();

            // Always refresh contract stats AND contract information (lightweight)
            await Promise.all([
                this.loadContractStats(),
                this.loadContractInformation()
            ]);

            // ALWAYS do full refresh to ensure we get latest data from blockchain
            // Selective updates are disabled during manual refresh to guarantee fresh data
            console.log('🔄 Using full refresh to get latest blockchain data...');
            await this.loadMultiSignPanel();
            console.log('✅ Admin panel data refreshed with fresh blockchain data');

        } catch (error) {
            console.error('❌ Failed to refresh data:', error);

            // Show error notification
            if (window.notificationManager) {
                window.notificationManager.error(
                    'Could not load contract data. Please check your connection.'
                );
            }
        } finally {
            this.isRefreshing = false;

            // Hide loading state
            this.hideLoadingState();
        }
    }

    /**
     * Refresh UI after transaction completion
     * This ensures all data is up-to-date after approve/reject/execute actions
     */
    async refreshAfterTransaction() {
        console.log('🔄 Refreshing UI after transaction...');

        try {
            // Refresh all data in parallel for speed
            await Promise.all([
                this.loadContractStats(),
                this.loadContractInformation(),
                this.loadMultiSignPanel()
            ]);

            console.log('✅ UI refreshed after transaction');
        } catch (error) {
            console.error('❌ Failed to refresh UI after transaction:', error);
        }
    }

    /**
     * SELECTIVE UPDATE OPTIMIZATION: Try to update proposals selectively
     */
    async trySelectiveProposalUpdate() {
        try {
            console.log('🎯 Attempting selective proposal update...');

            // Get current proposals from contract
            const contractManager = await this.ensureContractReady();
            if (!contractManager || !contractManager.getAllActions) {
                return false;
            }

            const currentProposals = await contractManager.getAllActions();
            if (!currentProposals || !Array.isArray(currentProposals)) {
                return false;
            }

            const formattedProposals = this.formatRealProposals(currentProposals);

            // Check for new proposals first
            const currentCount = formattedProposals.length;
            if (currentCount > this.lastKnownProposalCount) {
                console.log(`📋 Detected ${currentCount - this.lastKnownProposalCount} new proposals`);
                // For now, fall back to full refresh for new proposals
                // This ensures proper ordering and display
                return false;
            }

            // Update only changed existing proposals
            const updateSuccess = await this.updateChangedProposalsOnly(formattedProposals);

            if (updateSuccess) {
                // Update our tracking
                this.lastKnownProposalCount = currentCount;
                this.totalProposalCount = currentCount;
                return true;
            }

            return false;

        } catch (error) {
            console.error('❌ Selective proposal update failed:', error);
            return false;
        }
    }

    /**
     * SELECTIVE UPDATE OPTIMIZATION: Enable/disable selective updates
     */
    enableSelectiveUpdates(enabled = true) {
        this.isSelectiveUpdateEnabled = enabled;
        console.log(`🎯 Selective updates ${enabled ? 'enabled' : 'disabled'}`);

        if (!enabled) {
            // Clear cached states when disabling
            this.proposalStates.clear();
            console.log('🧹 Cleared proposal state cache');
        }
    }

    /**
     * SELECTIVE UPDATE OPTIMIZATION: Get selective update status
     */
    getSelectiveUpdateStatus() {
        return {
            enabled: this.isSelectiveUpdateEnabled,
            cachedStates: this.proposalStates.size,
            lastKnownCount: this.lastKnownProposalCount,
            totalCount: this.totalProposalCount
        };
    }

    /**
     * Mock approval system for realistic demo
     */
    mockApproveProposal(proposalId) {
        console.log(`🔧 Mock approving proposal: ${proposalId}`);

        const currentSigner = this.userAddress || '0x9249cFE964C49Cf2d2D0DBBbB33E99235707aa61';

        // Add vote to mock system
        this.addMockVote(proposalId, currentSigner, 'APPROVE');

        const proposal = this.mockProposals.get(proposalId);
        if (proposal) {
            console.log(`✅ Mock approval added. Current approvals: ${proposal.currentApprovals}/${proposal.requiredApprovals}`);
        }

        return {
            success: true,
            transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
            message: 'Mock approval successful'
        };
    }

    /**
     * Mock rejection system for realistic demo
     */
    mockRejectProposal(proposalId) {
        console.log(`🔧 Mock rejecting proposal: ${proposalId}`);

        const currentSigner = this.userAddress || '0x9249cFE964C49Cf2d2D0DBBbB33E99235707aa61';

        // Add vote to mock system
        this.addMockVote(proposalId, currentSigner, 'REJECT');

        const proposal = this.mockProposals.get(proposalId);
        if (proposal) {
            proposal.status = 'REJECTED';
            console.log(`✅ Mock rejection added. Proposal status: ${proposal.status}`);
        }

        return {
            success: true,
            transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
            message: 'Mock rejection successful'
        };
    }

    async loadProposals() {
        console.log('📋 Loading proposals...');
        console.log('🚀 loadProposals method called - starting proposal loading process');

        try {
            // First try to load real proposals from the contract
            const contractManager = await this.ensureContractReady();

            console.log('🔍 Contract Manager Debug:', {
                contractManager: !!contractManager,
                hasGetAllActions: !!(contractManager && contractManager.getAllActions),
                hasIsStakingContractReady: !!(contractManager && contractManager.isStakingContractReady),
                stakingContractReady: contractManager && contractManager.isStakingContractReady ? contractManager.isStakingContractReady() : 'N/A',
                stakingContract: !!(contractManager && contractManager.stakingContract)
            });

            if (contractManager && contractManager.getAllActions) {
                console.log('🔗 Attempting to load real proposals from contract...');

                // Check if staking contract is available
                if (!contractManager.isStakingContractReady || !contractManager.isStakingContractReady()) {
                    throw new Error('Staking contract not properly initialized');
                }

                console.log('📞 Calling contractManager.getAllActions()...');
                const realProposals = await contractManager.getAllActions();
                console.log('📊 getAllActions result:', {
                    type: typeof realProposals,
                    isArray: Array.isArray(realProposals),
                    length: realProposals ? realProposals.length : 'N/A',
                    firstItem: realProposals && realProposals[0] ? realProposals[0] : 'N/A'
                });

                if (realProposals && Array.isArray(realProposals)) {
                    console.log(`✅ Loaded ${realProposals.length} real proposals from contract`);

                    // Set flag to indicate we're using real data
                    this.isUsingRealData = true;

                    // PERFORMANCE OPTIMIZATION: Initialize optimized state with proposals
                    const formattedProposals = this.formatRealProposals(realProposals);
                    console.log(`🔄 Formatted ${formattedProposals.length} proposals for display`);

                    // Update total count for pagination with multiple fallback strategies
                    if (window.contractManager && window.contractManager.stakingContract) {
                        try {
                            // Try multiple methods to get the total count
                            let totalCount = 0;

                            // Method 1: Direct actionCounter call
                            try {
                                const counter = await window.contractManager.stakingContract.actionCounter();
                                totalCount = counter.toNumber();
                                console.log(`📊 Got total count via actionCounter: ${totalCount}`);
                            } catch (counterError) {
                                console.warn('⚠️ actionCounter failed:', counterError.message);

                                // Method 2: Try with different provider
                                try {
                                    const result = await window.contractManager.executeWithProviderFallback(async (provider) => {
                                        const contractWithProvider = new ethers.Contract(
                                            window.contractManager.contractAddresses.get('STAKING'),
                                            window.contractManager.contractABIs.get('STAKING'),
                                            provider
                                        );
                                        const counter = await contractWithProvider.actionCounter();
                                        return counter.toNumber();
                                    }, 'getActionCounter');

                                    totalCount = result;
                                    console.log(`📊 Got total count via fallback provider: ${totalCount}`);
                                } catch (fallbackError) {
                                    console.warn('⚠️ Fallback actionCounter also failed:', fallbackError.message);

                                    // Method 3: Estimate based on loaded proposals
                                    const maxLoadedId = Math.max(...formattedProposals.map(p => p.id));
                                    totalCount = maxLoadedId; // Estimate
                                    console.log(`📊 Estimated total count from max ID: ${totalCount}`);
                                }
                            }

                            this.totalProposalCount = totalCount;
                            console.log(`📊 Final total proposals available: ${this.totalProposalCount}`);
                            console.log(`📊 Currently loaded: ${formattedProposals.length}`);
                            console.log(`📊 Remaining: ${this.totalProposalCount - formattedProposals.length}`);
                        } catch (error) {
                            console.warn('⚠️ All methods to get total proposal count failed:', error.message);
                            // Set to 0 to indicate unknown, but still show Load More button
                            this.totalProposalCount = 0;
                        }
                    }

                    if (this.optimizedAdminState) {
                        this.optimizedAdminState.initializeProposals(formattedProposals);
                        console.log('🎯 Proposals initialized in optimized state management');

                        // Track performance
                        if (this.performanceMonitor) {
                            this.performanceMonitor.trackNetworkCall('full-refresh', {
                                reason: 'initial-load',
                                proposalCount: realProposals.length
                            });
                        }
                    }

                    // SELECTIVE UPDATE OPTIMIZATION: Initialize proposal state cache
                    this.lastKnownProposalCount = this.totalProposalCount;
                    formattedProposals.forEach(proposal => {
                        this.cacheProposalState(proposal);
                        // Also cache the full proposal for filtering
                        this.proposalsCache.set(proposal.id, proposal);
                    });
                    console.log(`🎯 Cached states for ${formattedProposals.length} proposals`);

                    return formattedProposals;
                } else {
                    console.log('⚠️ Invalid response from getAllActions:', realProposals);
                    throw new Error('Invalid response from contract getAllActions method');
                }
            } else {
                throw new Error('Contract manager or getAllActions method not available');
            }
        } catch (error) {
            console.warn('⚠️ Failed to load real proposals, falling back to mock data:', error.message);
            console.error('❌ Full error details:', error);

            // Check if it's a network-related error
            let errorMessage = error.message;
            if (error.message.includes('could not detect network') || error.message.includes('NETWORK_ERROR')) {
                errorMessage = 'Network connection issue - please check your wallet connection and network settings';
            } else if (error.message.includes('call revert exception')) {
                errorMessage = 'Contract call failed - contract may not be deployed or accessible';
            }

            // Show warning notification
            if (window.notificationManager) {
                window.notificationManager.warning(
                    `Could not load real proposals: ${errorMessage}`
                );
            }
        }

        // Fallback to mock proposals if real ones can't be loaded
        console.log('🎭 Using mock proposals as fallback');
        this.isUsingRealData = false;
        return await this.loadMockProposals();
    }

    /**
     * PERFORMANCE OPTIMIZATION: Load more proposals for pagination
     */
    async loadMoreProposals() {
        if (this.isLoadingMore || !this.isUsingRealData) {
            console.log('⚠️ Load more already in progress or not using real data');
            return;
        }

        this.isLoadingMore = true;
        const loadMoreBtn = document.getElementById('load-more-btn');
        if (loadMoreBtn) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.innerHTML = '⏳ Loading...';
        }

        try {
            console.log('📋 Loading more proposals...');

            // Get contract manager
            const contractManager = await this.ensureContractReady();
            if (!contractManager || !contractManager.getAllActionsWithPagination) {
                throw new Error('Contract manager not available for pagination');
            }

            // Load next batch (20 more proposals for better UX)
            console.log(`📋 Loading next batch: skip=${this.loadedProposalCount}, limit=20`);
            let nextBatch;

            try {
                nextBatch = await contractManager.getAllActionsWithPagination(this.loadedProposalCount, 20);
            } catch (paginationError) {
                console.warn('⚠️ Pagination failed, trying alternative method:', paginationError.message);

                // Fallback: Load older proposals by ID
                nextBatch = await this.loadOlderProposalsByID(contractManager, 20);
            }

            if (nextBatch && nextBatch.length > 0) {
                console.log(`✅ Loaded ${nextBatch.length} additional proposals`);

                // Format and append to existing proposals
                const formattedBatch = this.formatRealProposals(nextBatch);

                // Cache the new proposals
                formattedBatch.forEach(proposal => {
                    this.proposalsCache.set(proposal.id, proposal);
                    this.cacheProposalState(proposal);
                });

                // Check if we should show these proposals based on filter
                const hideExecutedCheckbox = document.getElementById('hide-executed');
                const hideExecuted = hideExecutedCheckbox ? hideExecutedCheckbox.checked : true;

                const visibleBatch = hideExecuted
                    ? formattedBatch.filter(proposal => !proposal.executed)
                    : formattedBatch;

                // Append to proposals table
                const proposalsTbody = document.getElementById('proposals-tbody');
                if (proposalsTbody && visibleBatch.length > 0) {
                    const newRowsHTML = visibleBatch.map(proposal =>
                        this.generateProposalRowHTML(proposal)
                    ).join('');
                    proposalsTbody.insertAdjacentHTML('beforeend', newRowsHTML);
                }

                // Update loaded count
                this.loadedProposalCount += formattedBatch.length;

                console.log(`📊 Added ${formattedBatch.length} proposals to cache, ${visibleBatch.length} visible`);

                // Update Load More button
                this.updateLoadMoreButton();

                // Show success notification
                if (window.notificationManager) {
                    window.notificationManager.success(
                        `Loaded ${formattedBatch.length} additional proposals`
                    );
                }
            } else {
                console.log('ℹ️ No more proposals to load - hiding Load More button');

                // Hide the Load More button by removing it
                const loadMoreContainer = document.querySelector('.load-more-container');
                if (loadMoreContainer) {
                    loadMoreContainer.style.display = 'none';
                }

                // Show a message that all proposals are loaded
                const proposalsTable = document.querySelector('.proposals-table');
                if (proposalsTable) {
                    const existingMessage = proposalsTable.querySelector('.all-loaded-message');
                    if (!existingMessage) {
                        const messageDiv = document.createElement('div');
                        messageDiv.className = 'all-loaded-message';
                        messageDiv.style.cssText = 'text-align: center; padding: 20px; color: #666; font-style: italic;';
                        messageDiv.innerHTML = '✅ All proposals loaded';
                        proposalsTable.appendChild(messageDiv);
                    }
                }
            }

        } catch (error) {
            console.error('❌ Failed to load more proposals:', error);

            if (window.notificationManager) {
                window.notificationManager.error(
                    `Could not load additional proposals: ${error.message}`
                );
            }
        } finally {
            this.isLoadingMore = false;

            // Reset button state
            if (loadMoreBtn) {
                loadMoreBtn.disabled = false;

                // Recalculate remaining proposals
                const remainingText = this.totalProposalCount > 0 && this.totalProposalCount > this.loadedProposalCount
                    ? `(${this.totalProposalCount - this.loadedProposalCount} remaining)`
                    : '(more may be available)';

                loadMoreBtn.innerHTML = `📋 Load More Proposals ${remainingText}`;
            }
        }
    }

    /**
     * Update Load More button state
     */
    updateLoadMoreButton() {
        const loadMoreContainer = document.querySelector('.load-more-container');
        if (loadMoreContainer) {
            // Reset isLoadingMore flag before rendering
            this.isLoadingMore = false;
            loadMoreContainer.outerHTML = this.renderLoadMoreButton([]);
        }
    }

    /**
     * SELECTIVE UPDATE OPTIMIZATION: Add single new proposal without full refresh
     */
    async addSingleNewProposal() {
        if (!this.isSelectiveUpdateEnabled) {
            console.log('🔄 Selective updates disabled, falling back to full refresh');
            return await this.refreshData();
        }

        try {
            console.log('🎯 Adding single new proposal without full refresh...');

            // Get current proposal count
            const contractManager = await this.ensureContractReady();
            if (!contractManager || !contractManager.stakingContract) {
                throw new Error('Contract manager not available');
            }

            const counter = await contractManager.stakingContract.actionCounter();
            const currentCount = counter.toNumber();

            // Check if there's actually a new proposal
            if (currentCount <= this.lastKnownProposalCount) {
                console.log('ℹ️ No new proposals detected');
                return;
            }

            // Get the newest proposal (highest ID)
            const newProposalId = currentCount;
            console.log(`📋 Fetching new proposal ID: ${newProposalId}`);

            // Load only the new proposal data
            const [action, pairs, weights] = await Promise.all([
                contractManager.stakingContract.actions(BigInt(newProposalId)),
                contractManager.stakingContract.getActionPairs(newProposalId),
                contractManager.stakingContract.getActionWeights(newProposalId)
            ]);

            // Format the new proposal
            const newProposal = {
                id: newProposalId,
                actionType: action.actionType,
                newHourlyRewardRate: action.newHourlyRewardRate.toString(),
                pairs: pairs.map(p => p.toString()),
                weights: weights.map(w => w.toString()),
                pairToAdd: action.pairToAdd,
                pairNameToAdd: action.pairNameToAdd,
                platformToAdd: action.platformToAdd,
                weightToAdd: action.weightToAdd.toString(),
                pairToRemove: action.pairToRemove,
                recipient: action.recipient,
                withdrawAmount: action.withdrawAmount.toString(),
                executed: action.executed,
                expired: action.expired,
                approvals: action.approvals,
                approvedBy: action.approvedBy,
                proposedTime: action.proposedTime.toNumber(),
                rejected: action.rejected
            };

            const formattedProposal = this.formatRealProposals([newProposal])[0];

            // Add to proposals table at the top
            const proposalsTbody = document.getElementById('proposals-tbody');
            if (proposalsTbody) {
                const newRowHTML = this.generateProposalRowHTML(formattedProposal);
                proposalsTbody.insertAdjacentHTML('afterbegin', newRowHTML);

                // Highlight the new proposal briefly
                const newRow = proposalsTbody.querySelector(`[data-proposal-id="${newProposalId}"]`);
                if (newRow) {
                    newRow.style.backgroundColor = '#e8f5e8';
                    setTimeout(() => {
                        newRow.style.backgroundColor = '';
                    }, 3000);
                }
            }

            // Update counters
            this.lastKnownProposalCount = currentCount;
            this.loadedProposalCount++;
            this.totalProposalCount = currentCount;

            // Update proposal count display
            const statChip = document.querySelector('.stat-chip');
            if (statChip && statChip.textContent.includes('Total Proposals:')) {
                statChip.textContent = `Total Proposals: ${currentCount}`;
            }

            // Cache the new proposal state
            this.cacheProposalState(formattedProposal);

            console.log(`✅ Successfully added new proposal ${newProposalId} without full refresh`);

            // Show success notification
            if (window.notificationManager) {
                window.notificationManager.success(
                    `Proposal #${newProposalId} added successfully`
                );
            }

        } catch (error) {
            console.error('❌ Failed to add single proposal:', error);
            console.log('🔄 Falling back to full refresh...');
            await this.refreshData();
        }
    }

    /**
     * SELECTIVE UPDATE OPTIMIZATION: Cache proposal state for change detection
     */
    cacheProposalState(proposal) {
        const stateKey = `${proposal.id}`;
        const state = {
            approvals: proposal.approvals,
            executed: proposal.executed,
            rejected: proposal.rejected,
            expired: proposal.expired,
            status: proposal.status
        };
        this.proposalStates.set(stateKey, state);
    }

    /**
     * SELECTIVE UPDATE OPTIMIZATION: Check if proposal state has changed
     */
    hasProposalStateChanged(proposal) {
        const stateKey = `${proposal.id}`;
        const cachedState = this.proposalStates.get(stateKey);

        if (!cachedState) {
            return true; // New proposal, consider it changed
        }

        const currentState = {
            approvals: proposal.approvals,
            executed: proposal.executed,
            rejected: proposal.rejected,
            expired: proposal.expired,
            status: proposal.status
        };

        // Compare states
        return (
            cachedState.approvals !== currentState.approvals ||
            cachedState.executed !== currentState.executed ||
            cachedState.rejected !== currentState.rejected ||
            cachedState.expired !== currentState.expired ||
            cachedState.status !== currentState.status
        );
    }

    /**
     * SELECTIVE UPDATE OPTIMIZATION: Update only changed proposals
     */
    async updateChangedProposalsOnly(newProposals) {
        if (!this.isSelectiveUpdateEnabled || !newProposals || newProposals.length === 0) {
            return false; // Fall back to full refresh
        }

        try {
            console.log('🎯 Checking for proposal changes...');
            let changedCount = 0;

            for (const proposal of newProposals) {
                if (this.hasProposalStateChanged(proposal)) {
                    console.log(`📝 Proposal ${proposal.id} has changed, updating...`);

                    // Update the specific proposal row
                    const existingRow = document.querySelector(`[data-proposal-id="${proposal.id}"]`);
                    if (existingRow) {
                        const newRowHTML = this.generateProposalRowHTML(proposal);
                        existingRow.outerHTML = newRowHTML;

                        // Brief highlight to show the change
                        const updatedRow = document.querySelector(`[data-proposal-id="${proposal.id}"]`);
                        if (updatedRow) {
                            updatedRow.style.backgroundColor = '#fff3cd';
                            setTimeout(() => {
                                updatedRow.style.backgroundColor = '';
                            }, 2000);
                        }
                    }

                    // Update cached state
                    this.cacheProposalState(proposal);
                    changedCount++;
                }
            }

            if (changedCount > 0) {
                console.log(`✅ Updated ${changedCount} changed proposals without full refresh`);

                if (window.notificationManager) {
                    window.notificationManager.info(
                        `${changedCount} proposal${changedCount > 1 ? 's' : ''} updated`
                    );
                }
            } else {
                console.log('ℹ️ No proposal changes detected, skipping update');
            }

            return true; // Successfully handled with selective updates

        } catch (error) {
            console.error('❌ Failed to update changed proposals:', error);
            return false; // Fall back to full refresh
        }
    }
    /**
     * Force attempt to load real proposals (for manual retry)
     */
    async forceLoadRealProposals() {
        console.log('🔗 Force attempting to load real proposals...');

        try {
            // Show loading notification
            if (window.notificationManager) {
                window.notificationManager.info('Checking network connectivity...');
            }

            // Check if wallet is connected
            if (!window.walletManager || !window.walletManager.isConnected()) {
                throw new Error('Wallet not connected');
            }

            if (window.notificationManager) {
                window.notificationManager.info('Network OK - loading proposals from blockchain...');
            }

            const contractManager = await this.ensureContractReady();

            if (!contractManager || !contractManager.getAllActions) {
                throw new Error('Contract manager or getAllActions method not available');
            }

            // Force check contract readiness
            if (!contractManager.isStakingContractReady || !contractManager.isStakingContractReady()) {
                throw new Error('Staking contract not properly initialized');
            }

            const realProposals = await contractManager.getAllActions();

            if (realProposals && realProposals.length >= 0) {
                console.log(`✅ Successfully loaded ${realProposals.length} real proposals`);
                this.isUsingRealData = true;

                const formattedProposals = this.formatRealProposals(realProposals);

                // Update the UI
                await this.loadMultiSignPanel();

                return formattedProposals;
            } else {
                throw new Error('No proposals returned from contract');
            }

        } catch (error) {
            console.error('❌ Failed to force load real proposals:', error);
            this.isUsingRealData = false;

            if (window.notificationManager) {
                window.notificationManager.error(
                    `Could not load real proposals: ${error.message}`
                );
            }

            // Fall back to mock data
            await this.loadMultiSignPanel();
        }
    }

    /**
     * Format real contract proposals for UI display
     */
    formatRealProposals(realProposals) {
        console.log('🔄 Formatting real proposals for UI...', {
            count: realProposals.length,
            proposals: realProposals
        });

        if (!Array.isArray(realProposals)) {
            console.error('❌ realProposals is not an array:', realProposals);
            return [];
        }

        if (realProposals.length === 0) {
            console.log('📭 No proposals to format - returning empty array');
            return [];
        }

        return realProposals.map(proposal => {
            // Map contract action types to UI-friendly names
            const actionTypeMap = {
                0: 'SET_HOURLY_REWARD_RATE',
                1: 'UPDATE_PAIR_WEIGHTS',
                2: 'ADD_PAIR',
                3: 'REMOVE_PAIR',
                4: 'CHANGE_SIGNER',
                5: 'WITHDRAW_REWARDS'
            };

            const actionType = actionTypeMap[proposal.actionType] || 'UNKNOWN';

            // Convert BigNumber values to regular numbers/strings safely
            const formatBigNumber = (value) => {
                if (!value) return 0;
                if (typeof value === 'object' && value._isBigNumber) {
                    // Use toString() instead of toNumber() to avoid overflow
                    const strValue = value.toString();
                    const numValue = parseFloat(strValue);
                    // Return as string if too large for safe integer
                    return numValue > Number.MAX_SAFE_INTEGER ? strValue : numValue;
                }
                if (typeof value === 'string' && value.startsWith('0x')) {
                    const bigIntValue = BigInt(value);
                    const numValue = Number(bigIntValue);
                    return numValue > Number.MAX_SAFE_INTEGER ? bigIntValue.toString() : numValue;
                }
                return value;
            };

            const approvals = formatBigNumber(proposal.approvals) || 0;
            const requiredApprovals = this.contractStats?.requiredApprovals || 3;
            const executed = proposal.executed || false;
            const rejected = proposal.rejected || false;
            const expired = proposal.expired || false;

            // Determine status based on proposal state
            let status = 'PENDING';
            if (executed) {
                status = 'EXECUTED';
            } else if (rejected) {
                status = 'REJECTED';
            } else if (expired) {
                status = 'EXPIRED';
            } else if (approvals >= requiredApprovals) {
                status = 'APPROVED';
            }

            const formattedProposal = {
                id: proposal.id || formatBigNumber(proposal.actionId),
                actionType: actionType,
                approvals: approvals,
                currentApprovals: approvals, // Add currentApprovals for consistency
                requiredApprovals: requiredApprovals,
                executed: executed,
                rejected: rejected,
                expired: expired,
                status: status, // Add status field for consistency
                proposedTime: formatBigNumber(proposal.proposedTime) || Math.floor(Date.now() / 1000),
                approvedBy: proposal.approvedBy || [],
                proposer: proposal.proposer || null, // CRITICAL: Include proposer address for own-proposal check

                // Action-specific details
                newHourlyRewardRate: proposal.newHourlyRewardRate ?
                    ethers.utils.formatEther(proposal.newHourlyRewardRate) : null,
                pairToAdd: proposal.pairToAdd || null,
                pairNameToAdd: proposal.pairNameToAdd || null,
                platformToAdd: proposal.platformToAdd || null,
                weightToAdd: formatBigNumber(proposal.weightToAdd) || null,
                pairToRemove: proposal.pairToRemove || null,
                recipient: proposal.recipient || null,
                withdrawAmount: proposal.withdrawAmount ?
                    ethers.utils.formatEther(proposal.withdrawAmount) : null,
                pairs: proposal.pairs || [],
                weights: proposal.weights ? proposal.weights.map(w => formatBigNumber(w)) : []
            };

            console.log(`📋 Formatted proposal ${formattedProposal.id}:`, formattedProposal);
            return formattedProposal;
        });
    }

    getMockProposals() {
        return [
            {
                id: 1,
                actionType: 'SET_HOURLY_REWARD_RATE',
                approvals: 1,
                requiredApprovals: 2,
                executed: false,
                rejected: false,
                details: { newHourlyRewardRate: '100' }
            },
            {
                id: 2,
                actionType: 'ADD_PAIR',
                approvals: 2,
                requiredApprovals: 2,
                executed: true,
                rejected: false,
                details: { pairToAdd: '0x1234...5678' }
            }
        ];
    }

    getActionTypeName(actionType) {
        const types = {
            0: 'Set Hourly Reward Rate',
            1: 'Update Pair Weights',
            2: 'Add Pair',
            3: 'Remove Pair',
            4: 'Change Signer',
            5: 'Withdraw Rewards'
        };
        return types[actionType] || `Unknown Action (${actionType})`;
    }

    formatActionDetails(action) {
        switch (action.actionType) {
            case 0: // SET_HOURLY_REWARD_RATE
                return {
                    newHourlyRewardRate: ethers.utils.formatEther(action.newHourlyRewardRate)
                };
            case 1: // UPDATE_PAIR_WEIGHTS
                return {
                    pairs: action.pairs,
                    weights: action.weights.map(w => ethers.utils.formatEther(w))
                };
            case 2: // ADD_PAIR
                return {
                    pairToAdd: action.pairToAdd,
                    pairNameToAdd: action.pairNameToAdd,
                    platformToAdd: action.platformToAdd,
                    weightToAdd: ethers.utils.formatEther(action.weightToAdd)
                };
            case 3: // REMOVE_PAIR
                return {
                    pairToRemove: action.pairToRemove
                };
            case 4: // CHANGE_SIGNER
                return {
                    // Note: old/new signer info would need to be extracted from pairs array
                    pairs: action.pairs
                };
            case 5: // WITHDRAW_REWARDS
                return {
                    recipient: action.recipient,
                    withdrawAmount: ethers.utils.formatEther(action.withdrawAmount)
                };
            default:
                return {};
        }
    }

    /**
     * PERFORMANCE OPTIMIZATION: Render Load More button for pagination
     */
    renderLoadMoreButton(proposals) {
        // Don't update loaded count here - it should be managed by loadProposals and loadMoreProposals
        // this.loadedProposalCount is already set correctly

        console.log(`🔍 Load More Button Logic:`, {
            isUsingRealData: this.isUsingRealData,
            totalProposalCount: this.totalProposalCount,
            loadedProposalCount: this.loadedProposalCount,
            proposalsLength: proposals ? proposals.length : 0,
            proposalsCacheSize: this.proposalsCache.size
        });

        // Show Load More button if:
        // 1. We're using real data (not mock data)
        // 2. Either we know there are more proposals OR we can't determine total count (show optimistically)
        const hasMoreProposals = this.totalProposalCount > this.loadedProposalCount;
        const unknownTotal = this.totalProposalCount === 0 || this.totalProposalCount === undefined;

        const shouldShowLoadMore = this.isUsingRealData &&
                                  this.loadedProposalCount > 0 &&
                                  (hasMoreProposals || unknownTotal);

        console.log(`🔍 Load More Decision:`, {
            shouldShowLoadMore,
            hasMoreProposals,
            unknownTotal,
            calculation: `${this.totalProposalCount} > ${this.loadedProposalCount} = ${hasMoreProposals}`
        });

        if (shouldShowLoadMore) {
            const remainingText = this.totalProposalCount > 0 && hasMoreProposals
                ? `(${this.totalProposalCount - this.loadedProposalCount} remaining)`
                : '(more may be available)';

            return `
                <div class="load-more-container" style="text-align: center; padding: 20px;">
                    <button class="btn btn-outline" id="load-more-btn" onclick="adminPage.loadMoreProposals()" ${this.isLoadingMore ? 'disabled' : ''}>
                        ${this.isLoadingMore ? '⏳ Loading...' : `📋 Load More Proposals ${remainingText}`}
                    </button>
                    <div class="load-more-info" style="margin-top: 10px; color: #666; font-size: 0.9em;">
                        ${this.totalProposalCount > 0
                            ? `Showing ${this.loadedProposalCount} of ${this.totalProposalCount} proposals`
                            : `Showing ${this.loadedProposalCount} proposals`
                        }
                    </div>
                </div>
            `;
        }

        console.log('🚫 Load More button not shown - conditions not met');
        return ''; // No Load More button needed
    }

    /**
     * Debug method to check proposal loading status
     */
    debugProposalLoading() {
        console.log('🔍 PROPOSAL LOADING DEBUG:');
        console.log(`📊 Total proposals available: ${this.totalProposalCount}`);
        console.log(`📊 Currently loaded: ${this.loadedProposalCount}`);
        console.log(`📊 Cached proposals: ${this.proposalsCache.size}`);
        console.log(`📊 Using real data: ${this.isUsingRealData}`);
        console.log(`📊 Is loading more: ${this.isLoadingMore}`);

        const hideExecutedCheckbox = document.getElementById('hide-executed');
        const hideExecuted = hideExecutedCheckbox ? hideExecutedCheckbox.checked : 'unknown';
        console.log(`📊 Hide executed: ${hideExecuted}`);

        const proposalsTbody = document.getElementById('proposals-tbody');
        const visibleRows = proposalsTbody ? proposalsTbody.querySelectorAll('tr').length : 0;
        console.log(`📊 Visible rows in table: ${visibleRows}`);

        if (this.proposalsCache.size > 0) {
            const cachedProposals = Array.from(this.proposalsCache.values());
            const executedCount = cachedProposals.filter(p => p.executed).length;
            const pendingCount = cachedProposals.filter(p => !p.executed && !p.rejected).length;
            const rejectedCount = cachedProposals.filter(p => p.rejected).length;

            console.log(`📊 Cached proposal breakdown:`);
            console.log(`   - Executed: ${executedCount}`);
            console.log(`   - Pending: ${pendingCount}`);
            console.log(`   - Rejected: ${rejectedCount}`);
        }
    }

    /**
     * Force load all proposals (for debugging/testing)
     */
    async forceLoadAllProposals() {
        console.log('🚀 Force loading ALL proposals...');

        try {
            const contractManager = await this.ensureContractReady();
            if (!contractManager || !contractManager.stakingContract) {
                throw new Error('Contract manager not available');
            }

            // Get total count
            const counter = await contractManager.stakingContract.actionCounter();
            const totalCount = counter.toNumber();
            console.log(`📊 Total proposals in contract: ${totalCount}`);

            if (totalCount === 0) {
                console.log('📭 No proposals found in contract');
                return;
            }

            // Load ALL proposals (not just recent ones)
            console.log('🔄 Loading ALL proposals from contract...');
            const allProposals = await this.loadAllProposalsFromContract(contractManager, totalCount);

            if (allProposals && allProposals.length > 0) {
                console.log(`✅ Loaded ${allProposals.length} proposals total`);

                // Update cache and counts
                this.totalProposalCount = totalCount;
                this.loadedProposalCount = allProposals.length;

                // Cache all proposals
                allProposals.forEach(proposal => {
                    this.proposalsCache.set(proposal.id, proposal);
                    this.cacheProposalState(proposal);
                });

                // Refresh the display
                await this.loadMultiSignPanel();
            }

        } catch (error) {
            console.error('❌ Failed to force load all proposals:', error);
            if (window.notificationManager) {
                window.notificationManager.error(
                    `Could not load all proposals: ${error.message}`
                );
            }
        }
    }

    /**
     * Load all proposals from contract (helper method)
     */
    async loadAllProposalsFromContract(contractManager, totalCount) {
        const allActions = [];
        const batchSize = 50; // Larger batch for bulk loading

        // Load all proposals in batches
        for (let i = 1; i <= totalCount; i += batchSize) {
            const endIndex = Math.min(i + batchSize - 1, totalCount);
            console.log(`🔄 Loading proposals ${i} to ${endIndex}...`);

            const batchPromises = [];
            for (let actionId = i; actionId <= endIndex; actionId++) {
                batchPromises.push(this.loadSingleProposal(contractManager, actionId));
            }

            const batchResults = await Promise.allSettled(batchPromises);
            batchResults.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    allActions.push(result.value);
                }
            });
        }

        // Sort by ID descending (newest first)
        allActions.sort((a, b) => b.id - a.id);

        return this.formatRealProposals(allActions);
    }

    /**
     * Load older proposals by ID (fallback method for pagination)
     */
    async loadOlderProposalsByID(contractManager, limit = 20) {
        console.log(`📋 Loading older proposals by ID (fallback method)...`);

        try {
            // Find the lowest ID we currently have
            const cachedProposals = Array.from(this.proposalsCache.values());
            const minLoadedId = cachedProposals.length > 0
                ? Math.min(...cachedProposals.map(p => p.id))
                : 999999; // Start high if no cache

            console.log(`📊 Lowest loaded ID: ${minLoadedId}, loading ${limit} older proposals`);

            const olderProposals = [];
            const batchPromises = [];

            // Load proposals with IDs lower than our minimum
            for (let id = minLoadedId - 1; id >= Math.max(1, minLoadedId - limit); id--) {
                // Skip if we already have this proposal
                if (this.proposalsCache.has(id)) {
                    continue;
                }

                batchPromises.push(this.loadSingleProposal(contractManager, id));
            }

            if (batchPromises.length === 0) {
                console.log('📭 No older proposals to load');
                return [];
            }

            const results = await Promise.allSettled(batchPromises);
            results.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    olderProposals.push(result.value);
                }
            });

            // Sort by ID descending (newest first)
            olderProposals.sort((a, b) => b.id - a.id);

            console.log(`✅ Loaded ${olderProposals.length} older proposals via ID method`);
            return olderProposals;

        } catch (error) {
            console.error('❌ Failed to load older proposals by ID:', error);
            return [];
        }
    }

    /**
     * Load a single proposal (helper method)
     */
    async loadSingleProposal(contractManager, actionId) {
        try {
            const [action, pairs, weights] = await Promise.all([
                contractManager.stakingContract.actions(BigInt(actionId)),
                contractManager.stakingContract.getActionPairs(actionId),
                contractManager.stakingContract.getActionWeights(actionId)
            ]);

            return {
                id: actionId,
                actionType: action.actionType,
                newHourlyRewardRate: action.newHourlyRewardRate.toString(),
                pairs: pairs.map(p => p.toString()),
                weights: weights.map(w => w.toString()),
                pairToAdd: action.pairToAdd,
                pairNameToAdd: action.pairNameToAdd,
                platformToAdd: action.platformToAdd,
                weightToAdd: action.weightToAdd.toString(),
                pairToRemove: action.pairToRemove,
                recipient: action.recipient,
                withdrawAmount: action.withdrawAmount.toString(),
                executed: action.executed,
                expired: action.expired,
                approvals: action.approvals,
                approvedBy: action.approvedBy,
                proposedTime: action.proposedTime.toNumber(),
                rejected: action.rejected
            };
        } catch (error) {
            console.warn(`⚠️ Failed to load proposal ${actionId}:`, error.message);
            return null;
        }
    }

    /**
     * Toggle visibility of executed proposals
     */
    async toggleExecutedProposals() {
        const hideExecutedCheckbox = document.getElementById('hide-executed');
        const proposalsTbody = document.getElementById('proposals-tbody');

        if (!hideExecutedCheckbox || !proposalsTbody) {
            console.warn('⚠️ Could not find hide-executed checkbox or proposals table');
            return;
        }

        const hideExecuted = hideExecutedCheckbox.checked;
        console.log(`🔄 Toggling executed proposals visibility: ${hideExecuted ? 'hide' : 'show'}`);

        // Get all current proposals from cache or reload
        let allProposals = [];
        if (this.proposalsCache && this.proposalsCache.size > 0) {
            allProposals = Array.from(this.proposalsCache.values());
        } else {
            // Reload proposals if cache is empty
            allProposals = await this.loadProposals();
        }

        // Filter based on checkbox state
        const filteredProposals = hideExecuted
            ? allProposals.filter(proposal => !proposal.executed)
            : allProposals;

        console.log(`📊 Showing ${filteredProposals.length} of ${allProposals.length} proposals`);

        // Update the table
        proposalsTbody.innerHTML = this.renderProposalsRows(filteredProposals);

        // Update stats
        const showingChip = document.querySelector('.stat-chip:nth-child(2)');
        if (showingChip) {
            showingChip.textContent = `Showing: ${filteredProposals.length}`;
        }
    }

    renderProposalsRows(proposals) {
        console.log(`🎨 Rendering ${proposals ? proposals.length : 0} proposal rows`);

        if (!proposals || proposals.length === 0) {
            console.log('📭 No proposals to render');
            return '<tr><td colspan="6" class="no-data">No proposals found</td></tr>';
        }

        console.log(`🎨 Rendering proposals:`, proposals.map(p => ({ id: p.id, actionType: p.actionType, executed: p.executed })));

        return proposals.map(proposal => {
            // Ensure actionType is defined with fallback - more robust checking
            if (!proposal || typeof proposal !== 'object') {
                console.warn('⚠️ Invalid proposal object:', proposal);
                return '<tr><td colspan="6" class="error-row">Invalid proposal data</td></tr>';
            }

            // Ensure actionType is always a string
            if (!proposal.actionType || typeof proposal.actionType !== 'string') {
                console.warn('⚠️ Proposal missing or invalid actionType:', proposal);
                proposal.actionType = 'UNKNOWN';
            }

            // Ensure other required fields have defaults
            proposal.approvals = proposal.approvals || 0;
            proposal.requiredApprovals = proposal.requiredApprovals || 2;
            proposal.executed = proposal.executed || false;
            proposal.rejected = proposal.rejected || false;
            proposal.id = proposal.id || 'unknown';
            proposal.approvedBy = proposal.approvedBy || [];

            const canExecute = proposal.approvals >= proposal.requiredApprovals && !proposal.executed && !proposal.rejected && !proposal.expired;
            const statusClass = proposal.executed ? 'executed' : proposal.rejected ? 'rejected' : proposal.expired ? 'expired' : canExecute ? 'ready' : 'pending';
            const statusText = proposal.executed ? '✅ Executed' : proposal.rejected ? '❌ Rejected' : proposal.expired ? '⏰ Expired' : canExecute ? '🚀 Ready to Execute' : '⏳ Pending';

            // Add visual indicator for ready-to-execute proposals
            if (canExecute) {
                console.log(`🚀 ATTENTION: Proposal #${proposal.id} is ready for execution!`);
            }

            // Enhanced action type display with icons
            const actionTypeDisplay = this.getActionTypeDisplay(proposal.actionType);

            // Enhanced proposal summary
            const proposalSummary = this.getProposalSummary(proposal);

            return `
                <tr class="proposal-row ${statusClass}">
                    <td>
                        <button class="expand-btn" onclick="adminPage.toggleProposal('${proposal.id}')" title="View Details">
                            <span class="expand-icon">▶</span>
                        </button>
                    </td>
                    <td>
                        <div class="proposal-id-container">
                            <span class="proposal-id">#${proposal.id}</span>
                            <div class="proposal-summary">${proposalSummary}</div>
                        </div>
                    </td>
                    <td>
                        <div class="action-type-container">
                            <span class="action-type ${proposal.actionType.toLowerCase()}">${actionTypeDisplay}</span>
                        </div>
                    </td>
                    <td>
                        <div class="approvals-container">
                            <div class="approval-progress">
                                <div class="approval-bar">
                                    <div class="approval-fill" style="width: ${(proposal.approvals / proposal.requiredApprovals) * 100}%"></div>
                                </div>
                                <span class="approval-text">${proposal.approvals} / ${proposal.requiredApprovals}</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </td>
                    <td>
                        <div class="action-buttons">
                            ${!proposal.executed && !proposal.rejected && !proposal.expired ? this.renderProposalActionButtons(proposal, canExecute) : ''}
                        </div>
                    </td>
                </tr>
                <tr id="details-${proposal.id}" class="proposal-details-row" style="display: none;">
                    <td colspan="6">
                        <div class="proposal-details">
                            <div class="details-header">
                                <h4>📋 Proposal Details</h4>
                            </div>
                            <div class="details-content">
                                ${this.renderProposalParameters(proposal.actionType, proposal)}
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Get enhanced action type display with icons
     */
    getActionTypeDisplay(actionType) {
        const actionTypes = {
            'ADD_PAIR': '➕ Add Pair',
            'REMOVE_PAIR': '➖ Remove Pair',
            'UPDATE_PAIR_WEIGHTS': '⚖️ Update Weights',
            'CHANGE_SIGNER': '🔑 Change Signer',
            'UPDATE_HOURLY_RATE': '💰 Update Rate',
            'SET_HOURLY_REWARD_RATE': '💰 Set Reward Rate',
            'WITHDRAW_REWARDS': '💸 Withdraw',
            'HOURLY_RATE': '💰 Update Rate',
            'HOURLY-RATE': '💰 Update Rate',
            'UNKNOWN': '❓ Unknown Action'
        };

        return actionTypes[actionType] || `❓ ${actionType || 'Unknown'}`;
    }

    /**
     * Get detailed proposal summary showing actual form inputs
     */
    getProposalSummary(proposal) {
        try {
            switch (proposal.actionType) {
                case 'ADD_PAIR':
                    // Show detailed pair information from form inputs
                    let summary = '';
                    if (proposal.pairNameToAdd) {
                        summary = `Add ${proposal.pairNameToAdd} LP pair`;
                        if (proposal.platformToAdd) {
                            summary += ` from ${proposal.platformToAdd}`;
                        }
                        if (proposal.weightToAdd) {
                            const weight = typeof proposal.weightToAdd === 'bigint'
                                ? proposal.weightToAdd.toString()
                                : proposal.weightToAdd;
                            summary += ` (weight: ${weight})`;
                        }
                    } else if (proposal.pairToAdd) {
                        summary = `Add LP pair ${this.formatAddress(proposal.pairToAdd)}`;
                    } else {
                        summary = 'Add new LP trading pair';
                    }
                    return summary;

                case 'REMOVE_PAIR':
                    if (proposal.pairToRemove) {
                        // Try to get pair name from existing pairs or show address
                        const pairName = this.getPairNameByAddress(proposal.pairToRemove);
                        if (pairName) {
                            return `Remove ${pairName} LP pair`;
                        } else {
                            return `Remove LP pair ${this.formatAddress(proposal.pairToRemove)}`;
                        }
                    }
                    return 'Remove LP trading pair';

                case 'UPDATE_PAIR_WEIGHTS':
                    if (proposal.pairs && proposal.weights && proposal.pairs.length > 0) {
                        const pairCount = proposal.pairs.length;
                        if (pairCount === 1) {
                            const pairName = this.getPairNameByAddress(proposal.pairs[0]);
                            const weight = proposal.weights[0];
                            return `Update ${pairName || this.formatAddress(proposal.pairs[0])} weight to ${weight}`;
                        } else {
                            return `Update weights for ${pairCount} LP pairs`;
                        }
                    }
                    return 'Update LP pair weights';

                case 'CHANGE_SIGNER':
                    if (proposal.newSigner) {
                        return `Change signer to ${this.formatAddress(proposal.newSigner)}`;
                    }
                    return 'Change authorized signer';

                case 'SET_HOURLY_REWARD_RATE':
                case 'UPDATE_HOURLY_RATE':
                case 'HOURLY_RATE':
                case 'HOURLY-RATE':
                    if (proposal.newHourlyRewardRate) {
                        const rate = typeof proposal.newHourlyRewardRate === 'bigint'
                            ? ethers.utils.formatEther(proposal.newHourlyRewardRate)
                            : proposal.newHourlyRewardRate;
                        return `Set reward rate to ${rate} tokens/hour`;
                    }
                    return 'Governance proposal';

                case 'WITHDRAW_REWARDS':
                    let withdrawSummary = 'Withdraw rewards';
                    if (proposal.withdrawAmount) {
                        const amount = typeof proposal.withdrawAmount === 'bigint'
                            ? ethers.utils.formatEther(proposal.withdrawAmount)
                            : proposal.withdrawAmount;
                        withdrawSummary = `Withdraw ${amount} tokens`;
                    }
                    if (proposal.recipient) {
                        withdrawSummary += ` to ${this.formatAddress(proposal.recipient)}`;
                    }
                    return withdrawSummary;

                default:
                    return proposal.description || 'Governance proposal';
            }
        } catch (error) {
            console.warn('Error generating proposal summary:', error);
            return proposal.description || 'Governance proposal';
        }
    }

    /**
     * Format pair name for better display
     * Converts "LPLIBETH" to "LIB/ETH LP"
     * Converts "LPLIBUSDC" to "LIB/USDC LP"
     */
    formatPairName(pairName) {
        if (!pairName) return pairName;

        // If already formatted (contains /), return as is
        if (pairName.includes('/')) {
            return pairName;
        }

        // Handle LP prefix format: "LPLIBETH" -> "LIB/ETH LP"
        if (pairName.startsWith('LP') && pairName.length > 4) {
            const tokens = pairName.substring(2); // Remove "LP"

            // Try to split into two tokens
            // Common patterns: LIBETH, LIBUSDC, LIBUSDT, ETHUSDC, etc.
            const commonTokens = ['USDC', 'USDT', 'DAI', 'WETH', 'ETH', 'WBTC', 'BTC', 'LIB', 'MATIC'];

            for (const token of commonTokens) {
                if (tokens.endsWith(token)) {
                    const token1 = tokens.substring(0, tokens.length - token.length);
                    const token2 = token;
                    if (token1.length > 0) {
                        return `${token1}/${token2} LP`;
                    }
                }
                if (tokens.startsWith(token)) {
                    const token1 = token;
                    const token2 = tokens.substring(token.length);
                    if (token2.length > 0) {
                        return `${token1}/${token2} LP`;
                    }
                }
            }

            // Fallback: split in half
            const mid = Math.floor(tokens.length / 2);
            const token1 = tokens.substring(0, mid);
            const token2 = tokens.substring(mid);
            return `${token1}/${token2} LP`;
        }

        // Return original if no pattern matched
        return pairName;
    }

    /**
     * Get pair name by address from existing pairs or contract data
     */
    getPairNameByAddress(address) {
        try {
            // Try to find in existing contract pairs
            if (this.contractStats && this.contractStats.pairs) {
                const pair = this.contractStats.pairs.find(p =>
                    p.address && p.address.toLowerCase() === address.toLowerCase()
                );
                if (pair && pair.name) {
                    return this.formatPairName(pair.name);
                }
            }

            // Try to find in mock proposals data
            for (const [, proposal] of this.mockProposals) {
                if (proposal.data && proposal.data.pairAddress &&
                    proposal.data.pairAddress.toLowerCase() === address.toLowerCase() &&
                    proposal.data.pairName) {
                    return this.formatPairName(proposal.data.pairName);
                }
            }

            return null;
        } catch (error) {
            console.warn('Error getting pair name by address:', error);
            return null;
        }
    }

    renderPairsList(pairs) {
        if (!pairs || pairs.length === 0) {
            return '<div class="no-data">No pairs configured</div>';
        }

        return pairs.map(pair => {
            const displayName = pair && pair.name
                ? this.formatPairName(pair.name)
                : (pair && pair.address ? this.getPairNameByAddress(pair.address) : null) || 'Unknown Pair';
            const displayAddress = pair && pair.address
                ? this.formatAddress(pair.address)
                : 'Unknown';
            const displayWeight = (pair && typeof pair.weight !== 'undefined' && pair.weight !== null)
                ? this.formatWeight(pair.weight)
                : '0';

            return `
                <div class="pair-item">
                    <div class="pair-name">${displayName}</div>
                    <div class="pair-address">${displayAddress}</div>
                    <div class="pair-weight">Weight: ${displayWeight}</div>
                </div>
            `;
        }).join('');
    }

    renderSignersList(signers) {
        if (!signers || signers.length === 0) {
            return '<div class="no-data">No signers configured</div>';
        }

        return signers.map(signer => `
            <div class="signer-item">
                <div class="signer-address">${this.formatAddress(signer)}</div>
            </div>
        `).join('');
    }

    async showDashboard() {
        const contentDiv = document.getElementById('admin-section-content');
        
        contentDiv.innerHTML = `
            <div class="dashboard-section">
                <h2>📊 Contract Statistics</h2>
                
                <div class="stats-grid">
                    <div class="info-card">
                        <div class="card-header">
                            <h3>🔗 Active LP Pairs</h3>
                        </div>
                        <div class="card-content">
                            <div class="stat-value" id="active-pairs-count">
                                ${this.contractStats.activePairs || 0}
                            </div>
                            <div class="stat-label">Active Pairs</div>
                        </div>
                    </div>
                    
                    <div class="info-card">
                        <div class="card-header">
                            <h3>💰 Total Value Locked</h3>
                        </div>
                        <div class="card-content">
                            <div class="stat-value" id="total-tvl">
                                $${this.formatNumber(this.contractStats.totalTVL || 0)}
                            </div>
                            <div class="stat-label">USD Value</div>
                        </div>
                    </div>
                    
                    <div class="info-card">
                        <div class="card-header">
                            <h3>👥 Total Stakers</h3>
                        </div>
                        <div class="card-content">
                            <div class="stat-value" id="total-stakers">
                                ${this.contractStats.totalStakers || 0}
                            </div>
                            <div class="stat-label">Unique Users</div>
                        </div>
                    </div>
                    
                    <div class="info-card">
                        <div class="card-header">
                            <h3>🏆 Total Rewards</h3>
                        </div>
                        <div class="card-content">
                            <div class="stat-value" id="total-rewards">
                                ${this.formatNumber(this.contractStats.totalRewards || 0)}
                            </div>
                            <div class="stat-label">LIB Tokens</div>
                        </div>
                    </div>
                </div>
                
                <div class="recent-activity">
                    <h3>📈 Recent Activity</h3>
                    <div class="activity-list" id="recent-activity-list">
                        <div class="activity-item">
                            <span class="activity-time">Loading...</span>
                            <span class="activity-desc">Fetching recent transactions...</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Load real-time data
        await this.loadDashboardData();
    }

    async loadContractStats() {
        try {
            console.log('📊 Loading contract statistics...');

            // Ensure contract manager is ready
            const contractManager = await this.ensureContractReady();

            console.log('📊 Contract manager ready, loading stats...');

            // Initialize stats object
            this.contractStats = {
                activePairs: 0,
                totalPairs: 0,
                totalTVL: 0,
                totalStakers: 0,
                totalRewards: 0,
                rewardBalance: null,
                rewardToken: null,
                rewardTokenSymbol: '',
                hourlyRewardRate: 0,
                requiredApprovals: 0,
                actionCounter: 0
            };

            // Check RPC health first (like React version)
            const isRpcDown = await this.checkRpcHealth(contractManager);

            if (isRpcDown) {
                console.log('⚠️ RPC node issues detected, using demo values');
                this.contractStats.rewardToken = '0x05A4cfAF5a8f939d61E4Ec6D6287c9a065d6574c';
                this.contractStats.hourlyRewardRate = 0;
                this.contractStats.requiredApprovals = 3;
                this.contractStats.actionCounter = 2; // We know we have 2 proposals
                const symbol = this.contractStats.rewardTokenSymbol || 'USDC';
                this.contractStats.rewardTokenSymbol = symbol;
                this.contractStats.rewardBalance = `0.00 ${symbol}`;
            } else {
                // Try multicall for better performance (5 calls -> 1 call)
                const stats = await contractManager.getContractStatsWithMulticall();

                if (stats) {
                    // Use multicall results with config defaults
                    const defaults = window.CONFIG?.DEFAULTS || {};
                    this.contractStats.rewardToken = stats.rewardToken || defaults.REWARD_TOKEN;
                    this.contractStats.hourlyRewardRate = stats.hourlyRewardRate ? 
                        Number(ethers.utils.formatEther(stats.hourlyRewardRate)) : defaults.HOURLY_REWARD_RATE;
                    this.contractStats.requiredApprovals = stats.requiredApprovals?.toNumber() || defaults.REQUIRED_APPROVALS;
                    this.contractStats.actionCounter = stats.actionCounter?.toNumber() || defaults.ACTION_COUNTER;
                    this.contractStats.totalWeight = stats.totalWeight ? 
                        Number(ethers.utils.formatEther(stats.totalWeight)) : defaults.TOTAL_WEIGHT;
                } else {
                    // Fallback to individual calls with config defaults
                    const defaults = window.CONFIG?.DEFAULTS || {};
                    this.contractStats.rewardToken = await this.safeContractCall(
                        () => contractManager.stakingContract.rewardToken(), 
                        defaults.REWARD_TOKEN
                    );
                    this.contractStats.hourlyRewardRate = this.convertBigIntToNumber(
                        await this.safeContractCall(
                            () => contractManager.stakingContract.hourlyRewardRate(), 
                            defaults.HOURLY_REWARD_RATE
                        )
                    );
                    this.contractStats.requiredApprovals = this.convertBigIntToNumber(
                        await this.safeContractCall(
                            () => contractManager.stakingContract.REQUIRED_APPROVALS(), 
                            defaults.REQUIRED_APPROVALS
                        )
                    );
                    this.contractStats.actionCounter = this.convertBigIntToNumber(
                        await this.safeContractCall(
                            () => contractManager.stakingContract.actionCounter(), 
                            defaults.ACTION_COUNTER
                        )
                    );

                    const symbol = await this.safeContractCall(
                        () => contractManager.rewardTokenContract.symbol(),
                        this.contractStats.rewardTokenSymbol || 'USDC'
                    );
                    this.contractStats.rewardTokenSymbol = symbol;

                    this.contractStats.rewardBalance = await this.safeContractCall(
                        async () => {
                            const stakingAddress = contractManager.stakingContract?.address;
                            if (!stakingAddress) {
                                throw new Error('Staking contract address not available');
                            }
                            const balance = await contractManager.rewardTokenContract.balanceOf(stakingAddress);
                            const balanceValue = Number(ethers.utils.formatEther(balance));
                            return `${balanceValue.toFixed(2)} ${symbol}`;
                        },
                        `0.00 ${symbol}`
                    );
                }

                console.log(`📊 rewardToken: ${this.contractStats.rewardToken}`);
                console.log(`📊 hourlyRewardRate: ${this.contractStats.hourlyRewardRate}`);
                console.log(`📊 requiredApprovals: ${this.contractStats.requiredApprovals}`);
                console.log(`📊 actionCounter: ${this.contractStats.actionCounter}`);
            }

            // Get pairs information (with error handling)
            try {
                const allPairs = await contractManager.stakingContract.getPairs();
                this.contractStats.totalPairs = allPairs.length;
                this.contractStats.activePairs = allPairs.filter(pair => pair.isActive).length;
                console.log('📊 Total pairs:', allPairs.length, 'Active:', this.contractStats.activePairs);
            } catch (error) {
                console.warn('⚠️ Could not load pairs info:', error.message);
                this.contractStats.totalPairs = this.contractStats.activePairs;
            }

            // Calculate estimated TVL (placeholder - would need price feeds in real implementation)
            this.contractStats.totalTVL = this.contractStats.activePairs * 10000; // Placeholder

            // Estimate total stakers (placeholder - would need event parsing in real implementation)
            this.contractStats.totalStakers = this.contractStats.activePairs * 25; // Placeholder
            
            // Estimate total rewards (placeholder)
            this.contractStats.totalRewards = this.contractStats.activePairs * 5000; // Placeholder
            
            console.log('✅ Contract stats loaded:', this.contractStats);
            
        } catch (error) {
            console.error('❌ Failed to load contract stats:', error);

            // Provide fallback demo values instead of zeros for better UX
            const fallbackSymbol = (this.contractStats && this.contractStats.rewardTokenSymbol) || 'USDC';
            this.contractStats = {
                activePairs: 3,
                totalPairs: 5,
                totalTVL: 125000,
                totalStakers: 89,
                totalRewards: 15000,
                rewardToken: '0x05A4cfAF5a8f939d61E4Ec6D6287c9a065d6574c',
                hourlyRewardRate: 0.1,
                requiredApprovals: 3,
                actionCounter: 2,
                rewardTokenSymbol: fallbackSymbol,
                rewardBalance: `0.00 ${fallbackSymbol}`,
                isDemo: true // Flag to indicate these are demo values
            };

            // Show user-friendly notification about using demo data
            if (window.notificationManager) {
                window.notificationManager.warning(
                    'Contract data unavailable. Displaying demo values for interface testing.'
                );
            }

            console.log('📊 Using demo contract stats due to error:', this.contractStats);
        }
    }

    async loadDashboardData() {
        // Refresh contract stats
        await this.loadContractStats();
        
        // Update dashboard display
        this.updateDashboardDisplay();
        
        // Update last refresh time
        document.getElementById('last-refresh').textContent = 
            `Last updated: ${new Date().toLocaleTimeString()}`;
    }

    updateDashboardDisplay() {
        // Add demo data indicator if using fallback values
        if (this.contractStats.isDemo) {
            this.addDemoDataIndicator();
        }

        // Update stat values
        const elements = {
            'active-pairs-count': this.contractStats.activePairs || 0,
            'total-tvl': this.formatNumber(this.contractStats.totalTVL || 0),
            'total-stakers': this.contractStats.totalStakers || 0,
            'total-rewards': this.formatNumber(this.contractStats.totalRewards || 0)
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    // Utility methods
    formatAddress(address) {
        if (!address) return 'Unknown';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    /**
     * Add demo data indicator to the UI
     */
    addDemoDataIndicator() {
        // Check if indicator already exists
        if (document.querySelector('.demo-data-indicator')) {
            return;
        }

        // Create demo data indicator
        const indicator = document.createElement('div');
        indicator.className = 'demo-data-indicator';
        indicator.innerHTML = `
            <div class="demo-banner">
                <span class="demo-icon">🎭</span>
                <span class="demo-text">Demo Mode: Contract data unavailable, showing sample values</span>
                <button class="demo-retry-btn" onclick="adminPage.retryContractConnection()">
                    🔄 Retry Connection
                </button>
            </div>
        `;

        // Add to the top of the admin container
        const adminContainer = document.querySelector('.admin-container') || document.body;
        adminContainer.insertBefore(indicator, adminContainer.firstChild);
    }

    /**
     * Retry contract connection
     */
    async retryContractConnection() {
        console.log('🔄 Retrying contract connection...');

        // Remove demo indicator
        const indicator = document.querySelector('.demo-data-indicator');
        if (indicator) {
            indicator.remove();
        }

        // Show loading state
        if (window.notificationManager) {
            window.notificationManager.info('Attempting to reconnect to contracts...');
        }

        try {
            // Reinitialize contract manager
            if (window.contractManager && window.contractManager.initializeReadOnly) {
                await window.contractManager.initializeReadOnly();
            }

            // Reload admin data
            await this.loadContractStats();
            await this.loadMultiSignPanel();

            if (window.notificationManager) {
                window.notificationManager.success('Successfully reconnected to contracts!');
            }
        } catch (error) {
            console.error('❌ Failed to reconnect:', error);
            if (window.notificationManager) {
                window.notificationManager.error('Could not reconnect to contracts. Using demo data.');
            }
        }
    }

    startAutoRefresh() {
        // Prevent multiple auto-refresh timers
        if (this.autoRefreshActive) {
            console.log('🔄 Auto-refresh already active, skipping...');
            return;
        }

        // Clear existing interval if any
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Mark auto-refresh as active
        this.autoRefreshActive = true;
        this.autoRefreshPaused = false;

        // Refresh data every 30 seconds
        this.refreshInterval = setInterval(() => {
            // Only refresh if authorized, content exists, and not paused
            if (this.isAuthorized &&
                document.getElementById('admin-section-content') &&
                !this.autoRefreshPaused) {
                this.refreshData();
            }
        }, 30000);

        console.log('🔄 Auto-refresh started (30s interval)');
    }



    // Placeholder methods for other sections (to be implemented)
    async showPairsManagement() {
        document.getElementById('admin-section-content').innerHTML = `
            <div class="section-placeholder">
                <h2>🔗 LP Pairs Management</h2>
                <p>This section will allow administrators to:</p>
                <ul>
                    <li>Add new LP pairs</li>
                    <li>Configure reward rates</li>
                    <li>Enable/disable pairs</li>
                    <li>Monitor pair performance</li>
                </ul>
                <p><em>Implementation coming in next phase...</em></p>
            </div>
        `;
    }

    async showUsersManagement() {
        document.getElementById('admin-section-content').innerHTML = `
            <div class="section-placeholder">
                <h2>👥 Users Management</h2>
                <p>This section will allow administrators to:</p>
                <ul>
                    <li>View all stakers</li>
                    <li>Monitor user activities</li>
                    <li>Handle user support issues</li>
                    <li>Generate user reports</li>
                </ul>
                <p><em>Implementation coming in next phase...</em></p>
            </div>
        `;
    }

    async showSettings() {
        document.getElementById('admin-section-content').innerHTML = `
            <div class="section-placeholder">
                <h2>⚙️ Contract Settings</h2>
                <p>This section will allow administrators to:</p>
                <ul>
                    <li>Update contract parameters</li>
                    <li>Manage admin roles</li>
                    <li>Configure system settings</li>
                    <li>Emergency controls</li>
                </ul>
                <p><em>Implementation coming in next phase...</em></p>
            </div>
        `;
    }

    toggleProposal(proposalId) {
        console.log(`🔄 Toggling proposal ${proposalId} details`);
        const detailsRow = document.getElementById(`details-${proposalId}`);
        const expandBtn = document.querySelector(`[onclick="adminPage.toggleProposal('${proposalId}')"]`) ||
                         document.querySelector(`[onclick="adminPage.toggleProposal(${proposalId})"]`);
        const expandIcon = expandBtn?.querySelector('.expand-icon');

        if (detailsRow) {
            const isVisible = detailsRow.style.display !== 'none';
            detailsRow.style.display = isVisible ? 'none' : 'table-row';

            if (expandIcon) {
                expandIcon.textContent = isVisible ? '▶' : '▼';
            }

            // Add/remove expanded class for additional styling
            const proposalRow = expandBtn?.closest('.proposal-row');
            if (proposalRow) {
                proposalRow.classList.toggle('expanded', !isVisible);
            }
        }
    }

    // Additional utility methods
    async waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver((mutations, obs) => {
                const element = document.querySelector(selector);
                if (element) {
                    obs.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Enhanced error handling
    handleError(error, context = 'Admin Panel') {
        console.error(`❌ ${context} Error:`, error);

        // Show user-friendly error message
        const errorMessage = error.message || 'An unexpected error occurred';
        this.showError(context, errorMessage);

        // Log additional error details for debugging
        if (error.stack) {
            console.error('Error stack:', error.stack);
        }
    }

    // Network status checking
    async checkNetworkStatus() {
        try {
            if (!window.ethereum) {
                throw new Error('MetaMask not available');
            }

            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            const expectedChainId = window.networkManager?.getChainIdHex() || ('0x' + window.CONFIG.NETWORK.CHAIN_ID.toString(16));
            return chainId === expectedChainId;
        } catch (error) {
            console.error('❌ Network status check failed:', error);
            return false;
        }
    }

    // Contract readiness check with graceful fallback
    async ensureContractReady() {
        if (!window.contractManager) {
            console.log('⚠️ Contract manager not available - will use mock data');
            throw new Error('Contract manager not available');
        }

        // Get detailed contract status
        const status = window.contractManager.getContractStatus ?
                      window.contractManager.getContractStatus() :
                      { isReady: window.contractManager.isReady() };

        console.log('🔍 Contract status check:', status);

        if (!status.isReady) {
            console.log('⏳ Waiting for contract manager to be ready...');
            try {
                await this.waitForContractManager();
            } catch (error) {
                console.log('⚠️ Contract manager failed to initialize - will use mock data');
                throw new Error('Contract manager initialization failed');
            }
        }

        // Additional check for specific contract availability
        if (!status.stakingContract && !status.rewardTokenContract) {
            console.warn('⚠️ No contracts initialized, operations may fail');
        }

        return window.contractManager;
    }

    // Multi-signature utility methods
    getTimeRemaining(expiryTimestamp) {
        const now = Date.now();
        const expiry = new Date(expiryTimestamp).getTime();
        const remaining = expiry - now;

        if (remaining <= 0) {
            return { expired: true, text: 'Expired' };
        }

        const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) {
            return { expired: false, text: `${days}d ${hours}h remaining` };
        } else if (hours > 0) {
            return { expired: false, text: `${hours}h ${minutes}m remaining` };
        } else {
            return { expired: false, text: `${minutes}m remaining` };
        }
    }

    renderDetailedSignatures(signers, signatures) {
        if (!signers || signers.length === 0) {
            return '<div class="no-signers">No signers configured</div>';
        }

        return signers.map(signer => {
            const hasSigned = signatures && signatures.includes(signer);
            const isCurrentUser = signer.toLowerCase() === (this.userAddress || '').toLowerCase();

            return `
                <div class="signature-item ${hasSigned ? 'signed' : 'pending'} ${isCurrentUser ? 'current-user' : ''}">
                    <div class="signer-info">
                        <span class="signer-address">${this.formatAddress(signer)}</span>
                        ${isCurrentUser ? '<span class="user-badge">You</span>' : ''}
                    </div>
                    <div class="signature-status">
                        ${hasSigned ?
                            '<span class="signed-badge">✓ Signed</span>' :
                            '<span class="pending-badge">○ Pending</span>'
                        }
                    </div>
                </div>
            `;
        }).join('');
    }

    renderProposalParameters(type, proposal) {
        // Use the full proposal object instead of just parameters
        if (!proposal) return '<div class="no-parameters">📋 No additional parameters</div>';

        switch (type.toLowerCase()) {
            case 'hourly-rate':
            case 'update-hourly-rate':
            case 'hourly_rate':
            case 'set_hourly_reward_rate':
            case 'set-hourly-reward-rate':
                const rate = proposal.newHourlyRewardRate
                    ? (typeof proposal.newHourlyRewardRate === 'bigint'
                        ? ethers.utils.formatEther(proposal.newHourlyRewardRate)
                        : proposal.newHourlyRewardRate)
                    : 'Not specified';

                let hourlyRateHTML = `
                    <div class="parameters-container">
                        <div class="parameter-card">
                            <div class="parameter-icon">💰</div>
                            <div class="parameter-content">
                                <div class="parameter-label">New Hourly Rate</div>
                                <div class="parameter-value highlight">${rate} tokens/hour</div>
                            </div>
                        </div>`;

                // Add description/reason if available
                if (proposal.description) {
                    hourlyRateHTML += `
                        <div class="parameter-card">
                            <div class="parameter-icon">📝</div>
                            <div class="parameter-content">
                                <div class="parameter-label">Description / Reason</div>
                                <div class="parameter-value">${proposal.description}</div>
                            </div>
                        </div>`;
                }

                hourlyRateHTML += `</div>`;
                return hourlyRateHTML;

            case 'add-pair':
            case 'add_pair':
                // Format weight properly using formatWeight helper
                const weight = proposal.weightToAdd
                    ? this.formatWeight(proposal.weightToAdd, 'allocation weight')
                    : 'Not specified';

                // Show full address for LP token
                const lpTokenAddress = proposal.pairToAdd || 'Not specified';

                let addPairHTML = `
                    <div class="parameters-container">
                        <div class="parameter-card">
                            <div class="parameter-icon">🏷️</div>
                            <div class="parameter-content">
                                <div class="parameter-label">Pair Name</div>
                                <div class="parameter-value">${proposal.pairNameToAdd || 'Not specified'}</div>
                            </div>
                        </div>
                        <div class="parameter-card">
                            <div class="parameter-icon">📍</div>
                            <div class="parameter-content">
                                <div class="parameter-label">LP Token Address</div>
                                <div class="parameter-value address-display" style="font-family: monospace; font-size: 0.85em; word-break: break-all;">${lpTokenAddress}</div>
                            </div>
                        </div>
                        <div class="parameter-card">
                            <div class="parameter-icon">⚖️</div>
                            <div class="parameter-content">
                                <div class="parameter-label">Allocation Weight</div>
                                <div class="parameter-value highlight">${weight}</div>
                            </div>
                        </div>
                        <div class="parameter-card">
                            <div class="parameter-icon">🏢</div>
                            <div class="parameter-content">
                                <div class="parameter-label">Platform</div>
                                <div class="parameter-value">${proposal.platformToAdd || 'Not specified'}</div>
                            </div>
                        </div>`;

                // Add description/reason if available
                if (proposal.description) {
                    addPairHTML += `
                        <div class="parameter-card">
                            <div class="parameter-icon">📝</div>
                            <div class="parameter-content">
                                <div class="parameter-label">Description / Reason</div>
                                <div class="parameter-value">${proposal.description}</div>
                            </div>
                        </div>`;
                }

                addPairHTML += `</div>`;
                return addPairHTML;

            case 'remove-pair':
            case 'remove_pair':
                const pairName = proposal.pairToRemove ? this.getPairNameByAddress(proposal.pairToRemove) : null;
                const removePairAddress = proposal.pairToRemove || 'Not specified';

                let removePairHTML = `
                    <div class="parameters-container">
                        <div class="parameter-card">
                            <div class="parameter-icon">🏷️</div>
                            <div class="parameter-content">
                                <div class="parameter-label">Pair to Remove</div>
                                <div class="parameter-value">${pairName || (proposal.pairToRemove ? this.formatAddress(proposal.pairToRemove) : 'Not specified')}</div>
                            </div>
                        </div>
                        <div class="parameter-card">
                            <div class="parameter-icon">📍</div>
                            <div class="parameter-content">
                                <div class="parameter-label">LP Token Address</div>
                                <div class="parameter-value address-display" style="font-family: monospace; font-size: 0.85em; word-break: break-all;">${removePairAddress}</div>
                            </div>
                        </div>`;

                // Add description/reason if available
                if (proposal.description) {
                    removePairHTML += `
                        <div class="parameter-card">
                            <div class="parameter-icon">📝</div>
                            <div class="parameter-content">
                                <div class="parameter-label">Description / Reason</div>
                                <div class="parameter-value">${proposal.description}</div>
                            </div>
                        </div>`;
                }

                removePairHTML += `</div>`;
                return removePairHTML;

            case 'update-weights':
            case 'update-pair-weight':
            case 'update_weights':
            case 'update_pair_weights':
                if (proposal.pairs && proposal.weights && proposal.pairs.length > 0) {
                    const pairCards = proposal.pairs.map((pairAddress, index) => {
                        const pairName = this.getPairNameByAddress(pairAddress);
                        const rawWeight = proposal.weights[index];
                        // Format weight properly using formatWeight helper
                        const weight = rawWeight ? this.formatWeight(rawWeight, 'weight') : 'Not specified';
                        return `
                            <div class="parameter-card">
                                <div class="parameter-icon">⚖️</div>
                                <div class="parameter-content">
                                    <div class="parameter-label">${pairName || this.formatAddress(pairAddress)}</div>
                                    <div class="parameter-value highlight">Weight: ${weight}</div>
                                </div>
                            </div>
                        `;
                    }).join('');

                    let updateWeightsHTML = `<div class="parameters-container">${pairCards}`;

                    // Add description/reason if available
                    if (proposal.description) {
                        updateWeightsHTML += `
                            <div class="parameter-card">
                                <div class="parameter-icon">📝</div>
                                <div class="parameter-content">
                                    <div class="parameter-label">Description / Reason</div>
                                    <div class="parameter-value">${proposal.description}</div>
                                </div>
                            </div>`;
                    }

                    updateWeightsHTML += `</div>`;
                    return updateWeightsHTML;
                } else {
                    return `
                        <div class="parameters-container">
                            <div class="parameter-card">
                                <div class="parameter-icon">⚖️</div>
                                <div class="parameter-content">
                                    <div class="parameter-label">Weight Updates</div>
                                    <div class="parameter-value">No weight data available</div>
                                </div>
                            </div>
                        </div>
                    `;
                }

            case 'change-signer':
            case 'change_signer':
                const newSignerAddress = proposal.newSigner || 'Not specified';

                let changeSignerHTML = `
                    <div class="parameters-container">
                        <div class="parameter-card">
                            <div class="parameter-icon">🔑</div>
                            <div class="parameter-content">
                                <div class="parameter-label">New Signer Address</div>
                                <div class="parameter-value address-display" style="font-family: monospace; font-size: 0.85em; word-break: break-all;">${newSignerAddress}</div>
                            </div>
                        </div>`;

                // Add description/reason if available
                if (proposal.description) {
                    changeSignerHTML += `
                        <div class="parameter-card">
                            <div class="parameter-icon">📝</div>
                            <div class="parameter-content">
                                <div class="parameter-label">Description / Reason</div>
                                <div class="parameter-value">${proposal.description}</div>
                            </div>
                        </div>`;
                }

                changeSignerHTML += `</div>`;
                return changeSignerHTML;

            case 'withdraw-rewards':
            case 'withdrawal':
            case 'withdraw_rewards':
                const withdrawAmount = proposal.withdrawAmount
                    ? (typeof proposal.withdrawAmount === 'bigint'
                        ? ethers.utils.formatEther(proposal.withdrawAmount)
                        : proposal.withdrawAmount)
                    : 'Not specified';

                const recipientAddress = proposal.recipient || 'Not specified';

                let withdrawHTML = `
                    <div class="parameters-container">
                        <div class="parameter-card">
                            <div class="parameter-icon">💰</div>
                            <div class="parameter-content">
                                <div class="parameter-label">Withdrawal Amount</div>
                                <div class="parameter-value highlight">${withdrawAmount} tokens</div>
                            </div>
                        </div>
                        <div class="parameter-card">
                            <div class="parameter-icon">📍</div>
                            <div class="parameter-content">
                                <div class="parameter-label">Recipient Address</div>
                                <div class="parameter-value address-display" style="font-family: monospace; font-size: 0.85em; word-break: break-all;">${recipientAddress}</div>
                            </div>
                        </div>`;

                // Add description/reason if available
                if (proposal.description) {
                    withdrawHTML += `
                        <div class="parameter-card">
                            <div class="parameter-icon">📝</div>
                            <div class="parameter-content">
                                <div class="parameter-label">Description / Reason</div>
                                <div class="parameter-value">${proposal.description}</div>
                            </div>
                        </div>`;
                }

                withdrawHTML += `</div>`;
                return withdrawHTML;

            default:
                // For unknown types, show all available proposal data
                // Filter out null, undefined, empty strings, zero addresses, and zero values
                const relevantData = {};
                Object.keys(proposal).forEach(key => {
                    const value = proposal[key];

                    // Skip metadata fields
                    if (key === 'id' || key === 'actionType' || key === 'executed' ||
                        key === 'expired' || key === 'approvals' || key === 'rejected' ||
                        key === 'proposedTime' || key === 'requiredApprovals' ||
                        key === 'approvedBy' || key === 'currentApprovals' || key === 'status' ||
                        key === 'description') {
                        return;
                    }

                    // Skip null, undefined, or empty values
                    if (value === null || value === undefined || value === '') {
                        return;
                    }

                    // Skip zero addresses (0x0000...0000)
                    if (typeof value === 'string' && value.startsWith('0x')) {
                        if (value === '0x0000000000000000000000000000000000000000' ||
                            /^0x0+$/.test(value)) {
                            return;
                        }
                    }

                    // Skip zero numeric values
                    if (typeof value === 'number' && value === 0) {
                        return;
                    }

                    // Skip zero bigint values
                    if (typeof value === 'bigint' && value === 0n) {
                        return;
                    }

                    // Skip string "0" or "0.0"
                    if (typeof value === 'string' && (value === '0' || value === '0.0')) {
                        return;
                    }

                    relevantData[key] = value;
                });

                if (Object.keys(relevantData).length === 0 && !proposal.description) {
                    return '<div class="no-parameters">📋 No additional parameters</div>';
                }

                let defaultHTML = '<div class="parameters-container">';

                // Display relevant data with smart formatting
                Object.entries(relevantData).forEach(([key, value]) => {
                    let displayValue = value;

                    // Format weights if key contains "weight"
                    if (key.toLowerCase().includes('weight') && !Array.isArray(value)) {
                        displayValue = this.formatWeight(value, key);
                    }
                    // Format arrays (like pairs or weights arrays)
                    else if (Array.isArray(value)) {
                        if (key.toLowerCase() === 'weights') {
                            // Format weight arrays
                            displayValue = value.map(w => this.formatWeight(w, 'weight')).join(', ');
                        } else if (key.toLowerCase() === 'pairs') {
                            // Format pair addresses
                            displayValue = value.map(addr => {
                                const pairName = this.getPairNameByAddress(addr);
                                return pairName || this.formatAddress(addr);
                            }).join(', ');
                        } else {
                            displayValue = value.join(', ');
                        }
                    }
                    // Format addresses
                    else if (typeof value === 'string' && value.startsWith('0x') && value.length > 20) {
                        displayValue = `<span style="font-family: monospace; font-size: 0.85em; word-break: break-all;">${value}</span>`;
                    }

                    defaultHTML += `
                        <div class="parameter-card">
                            <div class="parameter-icon">📋</div>
                            <div class="parameter-content">
                                <div class="parameter-label">${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</div>
                                <div class="parameter-value">${displayValue}</div>
                            </div>
                        </div>`;
                });

                // Add description/reason if available
                if (proposal.description) {
                    defaultHTML += `
                        <div class="parameter-card">
                            <div class="parameter-icon">📝</div>
                            <div class="parameter-content">
                                <div class="parameter-label">Description / Reason</div>
                                <div class="parameter-value">${proposal.description}</div>
                            </div>
                        </div>`;
                }

                defaultHTML += '</div>';
                return defaultHTML;
        }
    }

    // Universal modal visibility fix
    applyModalVisibilityFixes(modalContainer) {
        console.log('🔧 DEBUG: Applying universal modal visibility fixes');

        // Container fixes
        modalContainer.style.display = 'flex';
        modalContainer.style.zIndex = '999999';
        modalContainer.style.position = 'fixed';
        modalContainer.style.top = '0';
        modalContainer.style.left = '0';
        modalContainer.style.width = '100%';
        modalContainer.style.height = '100%';
        modalContainer.style.pointerEvents = 'auto';
        modalContainer.style.opacity = '1';
        modalContainer.style.visibility = 'visible';

        // Content fixes
        const modalOverlay = modalContainer.querySelector('.modal-overlay');
        const modalContent = modalContainer.querySelector('.modal-content');

        if (modalContent) {
            modalContent.style.background = 'white';
            modalContent.style.zIndex = '1000000';
            modalContent.style.opacity = '1';
            modalContent.style.visibility = 'visible';
            modalContent.style.display = 'block';
            modalContent.style.pointerEvents = 'auto';
            modalContent.style.padding = '0'; // Let CSS handle padding
            modalContent.style.borderRadius = '8px';
            modalContent.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
            modalContent.style.maxHeight = '90vh';
            modalContent.style.overflowY = 'auto';

            // Force modal footer visibility
            const modalFooter = modalContent.querySelector('.modal-footer');
            if (modalFooter) {
                modalFooter.style.display = 'flex';
                modalFooter.style.justifyContent = 'flex-end';
                modalFooter.style.gap = '10px';
                modalFooter.style.padding = '20px';
                modalFooter.style.borderTop = '1px solid #e0e0e0';
                modalFooter.style.background = 'white';
                modalFooter.style.position = 'sticky';
                modalFooter.style.bottom = '0';
                modalFooter.style.zIndex = '1000001';
                modalFooter.style.opacity = '1';
                modalFooter.style.visibility = 'visible';
                modalFooter.style.minHeight = '60px';

                // Force all buttons in footer to be visible
                const buttons = modalFooter.querySelectorAll('button');
                buttons.forEach((btn, index) => {
                    btn.style.display = 'inline-block';
                    btn.style.opacity = '1';
                    btn.style.visibility = 'visible';
                    btn.style.pointerEvents = 'auto';
                    btn.style.minHeight = '40px';
                    btn.style.padding = '10px 20px';
                    btn.style.margin = '0 5px';
                    btn.style.borderRadius = '4px';
                    btn.style.cursor = 'pointer';
                    btn.style.fontSize = '14px';
                    btn.style.zIndex = '1000002';

                    if (btn.classList.contains('btn-primary')) {
                        btn.style.background = '#007bff';
                        btn.style.color = 'white';
                        btn.style.border = '1px solid #007bff';
                    } else if (btn.classList.contains('btn-secondary')) {
                        btn.style.background = '#6c757d';
                        btn.style.color = 'white';
                        btn.style.border = '1px solid #6c757d';
                    }

                    // Add explicit click handler for cancel buttons
                    if (btn.classList.contains('modal-cancel') ||
                        btn.classList.contains('btn-secondary') ||
                        btn.textContent.trim() === 'Cancel') {
                        btn.onclick = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🔘 Cancel button clicked via explicit handler');
                            this.closeModal();
                        };
                        console.log(`🔧 DEBUG: Added click handler to cancel button ${index + 1}`);
                    }

                    console.log(`🔧 DEBUG: Button ${index + 1} forced visible:`, btn.textContent.trim());
                });

                console.log('🔧 DEBUG: Modal footer visibility forced with', buttons.length, 'buttons');
            }
        }

        // Also add click handler to modal close button (X)
        const closeButton = modalContent?.querySelector('.modal-close');
        if (closeButton) {
            closeButton.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔘 Close button (X) clicked via explicit handler');
                this.closeModal();
            };
            console.log('🔧 DEBUG: Added click handler to close button (X)');
        }

        if (modalOverlay) {
            modalOverlay.style.zIndex = '999999';
            modalOverlay.style.opacity = '1';
            modalOverlay.style.visibility = 'visible';
            modalOverlay.style.display = 'flex';
            modalOverlay.style.pointerEvents = 'auto';
            modalOverlay.style.background = 'rgba(0, 0, 0, 0.8)';

            // Add click handler to overlay (close on click outside)
            modalOverlay.onclick = (e) => {
                if (e.target === modalOverlay) {
                    console.log('🔘 Modal overlay clicked - closing modal');
                    this.closeModal();
                }
            };
            console.log('🔧 DEBUG: Added click handler to modal overlay');
        }

        console.log('✅ Universal modal visibility fixes applied');
    }

    // Multi-signature modal components
    showHourlyRateModal() {
        console.log('🔧 DEBUG: showHourlyRateModal called');
        const modalContainer = document.getElementById('modal-container');
        console.log('🔧 DEBUG: modalContainer found:', !!modalContainer);
        if (!modalContainer) {
            console.error('❌ Modal container not found');
            return;
        }

        console.log('🔧 DEBUG: Setting modal HTML content...');
        modalContainer.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>Update Hourly Rate</h3>
                        <button class="modal-close" type="button">×</button>
                    </div>

                    <div class="modal-body">
                        <form id="hourly-rate-form" class="admin-form">
                            <div class="form-group">
                                <label for="new-rate">New Hourly Rate (${this.contractStats?.rewardTokenSymbol || 'USDC'})</label>
                                <input type="number" id="new-rate" class="form-input" step="0.01" min="0" required
                                       placeholder="Enter new hourly rate">
                                <small class="form-help">Current rate: ${this.contractStats?.hourlyRewardRate || 'Loading...'} ${this.contractStats?.rewardTokenSymbol || 'USDC'}/hour</small>
                            </div>

                            <div class="proposal-info">
                                <div class="info-item">
                                    <span class="info-label">Required Approvals:</span>
                                    <span class="info-value">3 of 4 signers</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">Proposal Expiry:</span>
                                    <span class="info-value">7 days from creation</span>
                                </div>
                            </div>
                        </form>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary modal-cancel">
                            Cancel
                        </button>
                        <button type="submit" form="hourly-rate-form" class="btn btn-primary">
                            Create Proposal
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Apply universal modal visibility fixes
        this.applyModalVisibilityFixes(modalContainer);

        console.log('✅ Hourly rate modal opened');
    }

    showAddPairModal() {
        console.log('🔧 DEBUG: showAddPairModal called');
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) {
            console.error('❌ Modal container not found');
            return;
        }
        console.log('🔧 DEBUG: Add Pair modal container found');

        modalContainer.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>Add New Pair</h3>
                        <button class="modal-close" type="button">×</button>
                    </div>

                    <div class="modal-body">
                        <div id="validation-messages" class="validation-messages"></div>
                        <form id="add-pair-form" class="admin-form">
                            <div class="form-group">
                                <label for="pair-address">LP Token Address *</label>
                                <input type="text" id="pair-address" class="form-input" required
                                       placeholder="0x..." pattern="^0x[a-fA-F0-9]{40}$">
                                <small class="form-help">Enter the LP token contract address</small>
                                <div class="field-error" id="pair-address-error"></div>
                            </div>

                            <div class="form-group">
                                <label for="pair-name">Pair Name *</label>
                                <input type="text" id="pair-name" class="form-input" required
                                       placeholder="e.g., LIB/USDC" maxlength="50">
                                <small class="form-help">Descriptive name for the trading pair</small>
                                <div class="field-error" id="pair-name-error"></div>
                            </div>

                            <div class="form-group">
                                <label for="pair-platform">Platform *</label>
                                <select id="pair-platform" class="form-input" required>
                                    <option value="">Select platform...</option>
                                    <option value="Uniswap V3">Uniswap V3</option>
                                    <option value="Uniswap V2">Uniswap V2</option>
                                    <option value="SushiSwap">SushiSwap</option>
                                    <option value="Curve Finance">Curve Finance</option>
                                    <option value="Balancer">Balancer</option>
                                    <option value="PancakeSwap">PancakeSwap</option>
                                    <option value="Other">Other</option>
                                </select>
                                <small class="form-help">Select the DEX platform where this pair trades</small>
                                <div class="field-error" id="pair-platform-error"></div>
                            </div>

                            <div class="form-group">
                                <label for="pair-weight">Allocation Points *</label>
                                <input type="number" id="pair-weight" class="form-input" step="1" min="1" max="10000" required
                                       placeholder="Enter weight (e.g., 100)">
                                <small class="form-help">Weight determines reward allocation (1-10,000)</small>
                                <div class="field-error" id="pair-weight-error"></div>
                            </div>

                            <div class="proposal-info">
                                <div class="info-item">
                                    <span class="info-label">Required Approvals:</span>
                                    <span class="info-value">3 of 4 signers</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">Proposal Expiry:</span>
                                    <span class="info-value">7 days from creation</span>
                                </div>
                            </div>
                        </form>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary modal-cancel">
                            Cancel
                        </button>
                        <button type="submit" form="add-pair-form" class="btn btn-primary" id="add-pair-btn">
                            <span class="btn-text">Create Proposal</span>
                            <span class="btn-loading" style="display: none;">
                                <span class="spinner"></span> Creating...
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Apply universal modal visibility fixes
        this.applyModalVisibilityFixes(modalContainer);

        console.log('✅ Add pair modal opened');

        // Initialize form validation AFTER a delay to prevent immediate triggering
        setTimeout(() => {
            try {
                // Set flag to prevent immediate validation
                this.modalJustOpened = true;
                this.initializeFormValidation('add-pair-form');
                console.log('✅ Add pair form validation initialized');

                // Clear flag after a short delay
                setTimeout(() => {
                    this.modalJustOpened = false;
                }, 1000);
            } catch (error) {
                console.error('❌ Form validation initialization failed:', error);
            }
        }, 100);
    }

    showUpdateWeightsModal() {
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) {
            console.error('❌ Modal container not found');
            return;
        }

        modalContainer.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 700px;">
                    <div class="modal-header" style="padding: 24px; border-bottom: 1px solid var(--divider);">
                        <h3 style="margin: 0; font-size: 24px; font-weight: 600; display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 28px;">⚖️</span>
                            Update Pair Weights
                        </h3>
                        <button class="modal-close" type="button" style="font-size: 28px; color: var(--text-secondary);">×</button>
                    </div>

                    <div class="modal-body" style="padding: 24px; max-height: 600px; overflow-y: auto;">
                        <div id="validation-messages" class="validation-messages"></div>
                        <form id="update-weights-form" class="admin-form">
                            <div class="form-group">
                                <label style="display: block; margin-bottom: 12px; font-weight: 600; font-size: 16px;">Pair Weight Updates</label>
                                <div id="weights-list" style="margin-bottom: 16px;">
                                    <div class="modal-loading-container" style="padding: 40px; text-align: center;">
                                        <div class="modal-loading-spinner" style="width: 40px; height: 40px; border: 4px solid rgba(33, 150, 243, 0.3); border-top-color: var(--primary-main); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto;"></div>
                                        <p style="margin-top: 16px; color: var(--text-secondary);">Loading pairs...</p>
                                    </div>
                                </div>
                                <button type="button" class="btn btn-outline btn-sm" id="add-weight-pair" style="margin-top: 10px; padding: 8px 16px; border: 1px dashed var(--primary-main); background: transparent; color: var(--primary-main);">
                                    + Add Another Pair
                                </button>
                            </div>

                            <div class="proposal-info" style="background: rgba(33, 150, 243, 0.05); border: 1px solid rgba(33, 150, 243, 0.2); border-radius: 8px; padding: 16px; margin-top: 24px;">
                                <div class="info-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                                    <span class="info-label" style="color: var(--text-secondary); font-size: 14px;">Required Approvals:</span>
                                    <span class="info-value" style="color: var(--primary-main); font-weight: 600; font-size: 14px;">3 of 4 signers</span>
                                </div>
                                <div class="info-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-top: 1px solid var(--divider);">
                                    <span class="info-label" style="color: var(--text-secondary); font-size: 14px;">Proposal Expiry:</span>
                                    <span class="info-value" style="color: var(--text-primary); font-weight: 600; font-size: 14px;">7 days from creation</span>
                                </div>
                            </div>
                        </form>
                    </div>

                    <div class="modal-footer" style="display: flex; gap: 12px; justify-content: flex-end; padding: 20px 24px; border-top: 1px solid var(--divider);">
                        <button type="button" class="btn btn-secondary modal-cancel" style="padding: 10px 24px; min-width: 100px;">
                            Cancel
                        </button>
                        <button type="submit" form="update-weights-form" class="btn btn-primary" id="update-weights-btn"
                                style="padding: 10px 24px; min-width: 180px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <span class="btn-text">Create Proposal</span>
                            <span class="btn-loading" style="display: none;">
                                <span class="spinner" style="width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block;"></span>
                                Creating...
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Apply universal modal visibility fixes
        this.applyModalVisibilityFixes(modalContainer);

        console.log('✅ Update weights modal opened');

        // Initialize form validation and load pairs
        this.initializeFormValidation('update-weights-form');
        this.loadPairsForWeightUpdate();
    }

    showRemovePairModal() {
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;

        modalContainer.innerHTML = `
            <div class="modal-overlay" onclick="adminPage.closeModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>✨ Remove LP Pair</h3>
                        <button class="modal-close" onclick="adminPage.closeModal()">×</button>
                    </div>

                    <div class="modal-body">
                        <div id="validation-messages" class="validation-messages"></div>
                        <form id="remove-pair-form" class="admin-form">
                            <div class="form-group">
                                <label for="remove-pair-select">
                                    <span style="display: flex; align-items: center; gap: 8px;">
                                        🔗 Select Pair to Remove *
                                        <span id="pair-loading-indicator" style="display: none; font-size: 12px; color: var(--text-secondary);">
                                            <span class="spinner" style="width: 12px; height: 12px; border-width: 2px;"></span>
                                            Loading...
                                        </span>
                                    </span>
                                </label>
                                <select id="remove-pair-select" class="form-input modern-dropdown" required>
                                    <option value="">Loading pairs...</option>
                                </select>
                                <small class="form-help">Choose the LP pair to remove from staking rewards</small>
                                <div class="field-error" id="remove-pair-select-error"></div>
                            </div>

                            <div class="warning-box" style="background: rgba(255, 152, 0, 0.1); border: 1px solid rgba(255, 152, 0, 0.3); border-radius: 8px; padding: 16px; display: flex; gap: 12px; margin: 20px 0;">
                                <div class="warning-icon" style="font-size: 24px; flex-shrink: 0;">⚠️</div>
                                <div class="warning-text" style="flex: 1; color: var(--text-primary);">
                                    <strong style="display: block; margin-bottom: 6px;">Warning:</strong>
                                    <p style="margin: 0; font-size: 14px; line-height: 1.5;">Removing a pair will stop all reward distributions for that pair. Existing stakers will need to unstake before removal can be completed.</p>
                                </div>
                            </div>

                            <div class="form-group" style="margin: 20px 0;">
                                <label class="checkbox-container" style="display: flex; align-items: flex-start; cursor: pointer; user-select: none; padding: 12px; background: rgba(33, 150, 243, 0.05); border-radius: 8px; border: 1px solid rgba(33, 150, 243, 0.2); transition: all 0.2s;">
                                    <input type="checkbox" id="confirm-removal" required style="width: 20px; height: 20px; margin-right: 12px; margin-top: 2px; cursor: pointer; accent-color: var(--primary-main);">
                                    <span style="flex: 1; font-size: 14px; line-height: 1.5; font-weight: 500;">I understand the consequences of removing this pair</span>
                                </label>
                                <div class="field-error" id="confirm-removal-error"></div>
                            </div>

                            <div class="proposal-info" style="background: rgba(33, 150, 243, 0.05); border: 1px solid rgba(33, 150, 243, 0.2); border-radius: 8px; padding: 16px; margin-top: 20px;">
                                <div class="info-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                                    <span class="info-label" style="color: var(--text-secondary); font-size: 14px;">Required Approvals:</span>
                                    <span class="info-value" style="color: var(--primary-main); font-weight: 600; font-size: 14px;">3 of 4 signers</span>
                                </div>
                                <div class="info-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-top: 1px solid var(--divider);">
                                    <span class="info-label" style="color: var(--text-secondary); font-size: 14px;">Proposal Expiry:</span>
                                    <span class="info-value" style="color: var(--text-primary); font-weight: 600; font-size: 14px;">7 days from creation</span>
                                </div>
                            </div>
                        </form>
                    </div>

                    <div class="modal-footer" style="display: flex; gap: 12px; justify-content: flex-end; padding: 20px 24px; border-top: 1px solid var(--divider);">
                        <button type="button" class="btn btn-secondary modal-cancel" style="padding: 10px 24px; min-width: 100px;">
                            Cancel
                        </button>
                        <button type="submit" form="remove-pair-form" class="btn btn-primary" id="remove-pair-btn"
                                title="Please select a pair and confirm to enable"
                                style="padding: 10px 24px; min-width: 220px;">
                            <span class="btn-text">Submit Removal Proposal</span>
                            <span class="btn-loading" style="display: none;">
                                <span class="spinner" style="width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; margin-right: 8px;"></span>
                                Creating...
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Apply universal modal visibility fixes
        this.applyModalVisibilityFixes(modalContainer);

        // Apply current theme to modal
        const theme = document.documentElement.getAttribute('data-theme') || 'light';
        const modal = modalContainer.querySelector('.modal-content');
        if (modal) {
            modal.setAttribute('data-theme', theme);
        }

        console.log('✅ Remove pair modal opened');

        // Initialize form validation and load pairs
        this.initializeFormValidation('remove-pair-form');
        this.loadPairsForRemoval();

        // Setup button state management
        this.setupRemovePairButtonState();
    }

    /**
     * Setup Remove Pair button state management
     */
    setupRemovePairButtonState() {
        const select = document.getElementById('remove-pair-select');
        const button = document.getElementById('remove-pair-btn');
        const checkbox = document.getElementById('confirm-removal');

        if (!select || !button) return;

        const updateButtonState = () => {
            const hasSelection = select.value && select.value !== '';
            const isConfirmed = checkbox ? checkbox.checked : false;
            const isEnabled = hasSelection && isConfirmed;

            button.disabled = !isEnabled;

            if (!hasSelection) {
                button.setAttribute('title', 'Please select a pair to remove');
                button.style.opacity = '0.6';
                button.style.cursor = 'not-allowed';
            } else if (!isConfirmed) {
                button.setAttribute('title', 'Please check the confirmation box');
                button.style.opacity = '0.6';
                button.style.cursor = 'not-allowed';
            } else {
                button.setAttribute('title', 'Click to create removal proposal');
                button.style.opacity = '1';
                button.style.cursor = 'pointer';
            }
        };

        select.addEventListener('change', updateButtonState);
        if (checkbox) {
            checkbox.addEventListener('change', updateButtonState);
        }

        // Initial state
        updateButtonState();
    }

    showChangeSignerModal() {
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;

        modalContainer.innerHTML = `
            <div class="modal-overlay" onclick="adminPage.closeModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>Change Signer</h3>
                        <button class="modal-close" onclick="adminPage.closeModal()">×</button>
                    </div>

                    <div class="modal-body">
                        <form id="change-signer-form" onsubmit="adminPage.submitChangeSignerProposal(event)">
                            <div class="form-group">
                                <label for="old-signer">Current Signer to Replace</label>
                                <select id="old-signer" required>
                                    <option value="">Choose current signer...</option>
                                    ${this.renderSignerOptions()}
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="new-signer">New Signer Address</label>
                                <input type="text" id="new-signer" required
                                       placeholder="0x..." pattern="^0x[a-fA-F0-9]{40}$">
                                <small class="form-help">Enter the new signer's wallet address</small>
                            </div>

                            <div class="warning-box">
                                <div class="warning-icon">⚠️</div>
                                <div class="warning-text">
                                    <strong>Important:</strong> The new signer will have full admin privileges.
                                    Ensure the address is correct and trusted.
                                </div>
                            </div>

                            <div class="proposal-info">
                                <div class="info-item">
                                    <span class="info-label">Required Approvals:</span>
                                    <span class="info-value">3 of 4 signers</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">Proposal Expiry:</span>
                                    <span class="info-value">7 days from creation</span>
                                </div>
                            </div>
                        </form>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary modal-cancel">
                            Cancel
                        </button>
                        <button type="submit" form="change-signer-form" class="btn btn-primary">
                            Create Signer Change Proposal
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Apply universal modal visibility fixes
        this.applyModalVisibilityFixes(modalContainer);
    }

    showWithdrawalModal() {
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;

        modalContainer.innerHTML = `
            <div class="modal-overlay" onclick="adminPage.closeModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>Withdraw Rewards</h3>
                        <button class="modal-close" onclick="adminPage.closeModal()">×</button>
                    </div>

                    <div class="modal-body">
                        <form id="withdrawal-form" onsubmit="adminPage.submitWithdrawalProposal(event)">
                            <div class="form-group">
                                <label for="withdrawal-amount">Amount (${this.contractStats?.rewardTokenSymbol || 'USDC'})</label>
                                <input type="number" id="withdrawal-amount" step="0.01" min="0" required
                                       placeholder="Enter amount to withdraw">
                                <small class="form-help">Available balance: ${this.contractStats?.rewardBalance || (this.contractStats?.rewardTokenSymbol ? `0.00 ${this.contractStats.rewardTokenSymbol}` : 'Loading...')}</small>
                            </div>

                            <div class="form-group">
                                <label for="withdrawal-address">Recipient Address</label>
                                <input type="text" id="withdrawal-address" required
                                       placeholder="0x..." pattern="^0x[a-fA-F0-9]{40}$">
                                <small class="form-help">Address to receive the withdrawn funds</small>
                            </div>

                            <div class="warning-box">
                                <div class="warning-icon">💰</div>
                                <div class="warning-text">
                                    <strong>Note:</strong> Withdrawn funds will reduce the available reward pool.
                                    Ensure sufficient balance remains for ongoing rewards.
                                </div>
                            </div>

                            <div class="proposal-info">
                                <div class="info-item">
                                    <span class="info-label">Required Approvals:</span>
                                    <span class="info-value">3 of 4 signers</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">Proposal Expiry:</span>
                                    <span class="info-value">7 days from creation</span>
                                </div>
                            </div>
                        </form>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary modal-cancel">
                            Cancel
                        </button>
                        <button type="submit" form="withdrawal-form" class="btn btn-primary">
                            Create Withdrawal Proposal
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Apply universal modal visibility fixes
        this.applyModalVisibilityFixes(modalContainer);
    }

    closeModal() {
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer) {
            modalContainer.style.display = 'none';
            modalContainer.innerHTML = '';
        }
    }

    // Missing function that's called from HTML
    async refreshContractInfo() {
        console.log('🔄 Refreshing contract info...');
        try {
            const result = await this.loadContractInformation();
            if (result && result.success) {
                console.log('✅ Contract info refreshed');
            } else {
                const errorMessage = (result && result.error && result.error.message) || 'Unknown issue';
                console.warn('⚠️ Contract info refresh completed with warnings:', errorMessage);
            }
        } catch (error) {
            console.error('❌ Failed to refresh contract info:', error);
        }
    }

    // Add another pair row in Update Weights modal
    addAnotherPairRow() {
        console.log('🔧 Adding another pair row...');

        const container = document.getElementById('weight-pairs-container');
        if (!container) {
            console.error('❌ Weight pairs container not found');
            return;
        }

        // Count existing pair rows
        const existingRows = container.querySelectorAll('.pair-weight-row').length;
        const newRowIndex = existingRows;

        // Create new pair row HTML
        const newRowHTML = `
            <div class="pair-weight-row" data-index="${newRowIndex}">
                <div class="pair-weight-item">
                    <label for="pair-select-${newRowIndex}">Pair ${newRowIndex + 1}</label>
                    <select id="pair-select-${newRowIndex}" class="form-input" required>
                        <option value="">Select pair...</option>
                        <option value="LPLIBETH">LIB/ETH</option>
                        <option value="LPLIBUSDC">LIB/USDC</option>
                        <option value="LPLIBUSDT">LIB/USDT</option>
                    </select>
                </div>
                <div class="pair-weight-item">
                    <label for="weight-${newRowIndex}">New Weight</label>
                    <input type="number" id="weight-${newRowIndex}" class="form-input"
                           min="1" max="10000" step="1" required placeholder="Enter weight">
                </div>
                <div class="pair-weight-item">
                    <button type="button" class="btn btn-danger btn-sm remove-pair-row"
                            data-index="${newRowIndex}" style="margin-top: 25px;">
                        Remove
                    </button>
                </div>
            </div>
        `;

        // Add the new row before the "Add Another Pair" button
        const addButton = document.getElementById('add-weight-pair');
        if (addButton) {
            addButton.insertAdjacentHTML('beforebegin', newRowHTML);
            console.log(`✅ Added pair row ${newRowIndex + 1}`);

            // Add event listener for the remove button
            const removeBtn = container.querySelector(`[data-index="${newRowIndex}"] .remove-pair-row`);
            if (removeBtn) {
                removeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const rowIndex = e.target.dataset.index;
                    const rowToRemove = container.querySelector(`[data-index="${rowIndex}"]`);
                    if (rowToRemove) {
                        rowToRemove.remove();
                        console.log(`✅ Removed pair row ${parseInt(rowIndex) + 1}`);
                    }
                });
            }
        }
    }

    // Form validation system
    initializeFormValidation(formId) {
        const form = document.getElementById(formId);
        if (!form) return;

        // Add real-time validation
        form.addEventListener('input', (e) => {
            this.validateField(e.target);
        });

        // NOTE: Form submission is handled by the main document event listener
        // No need for individual form listeners to avoid conflicts
    }

    validateField(field) {
        const fieldId = field.id;
        const value = field.value.trim();
        const errorElement = document.getElementById(`${fieldId}-error`);
        let isValid = true;
        let errorMessage = '';

        // Clear previous error
        if (errorElement) {
            errorElement.textContent = '';
            field.classList.remove('error');
        }

        // Required field validation
        if (field.hasAttribute('required') && !value) {
            isValid = false;
            errorMessage = 'This field is required';
        }

        // Specific field validations
        switch (fieldId) {
            case 'pair-address':
                if (value && !this.isValidAddress(value)) {
                    isValid = false;
                    errorMessage = 'Invalid Ethereum address format';
                }
                break;
            case 'pair-name':
                if (value && (value.length < 2 || value.length > 50)) {
                    isValid = false;
                    errorMessage = 'Pair name must be between 2-50 characters';
                }
                break;
            case 'pair-weight':
                const weight = parseInt(value);
                if (value && (isNaN(weight) || weight < 1 || weight > 10000)) {
                    isValid = false;
                    errorMessage = 'Weight must be between 1-10,000';
                }
                break;
        }

        // Display error if invalid
        if (!isValid && errorElement) {
            errorElement.textContent = errorMessage;
            field.classList.add('error');
        }

        return isValid;
    }

    validateForm(formId) {
        console.log('🔧 DEBUG: Looking for form with ID:', formId);

        const form = document.getElementById(formId);
        if (!form) {
            console.log('🔧 DEBUG: Form not found:', formId);

            // Check if modal is open
            const modal = document.getElementById('modal-container');
            console.log('🔧 DEBUG: Modal container exists:', !!modal);
            console.log('🔧 DEBUG: Modal display:', modal ? modal.style.display : 'N/A');

            // Check all forms in the document
            const allForms = document.querySelectorAll('form');
            console.log('🔧 DEBUG: All forms in document:', Array.from(allForms).map(f => f.id));

            return false;
        }

        console.log('🔧 DEBUG: Validating form:', formId);
        let isValid = true;
        const inputs = form.querySelectorAll('input, select, textarea');

        // Check if any required fields are empty
        inputs.forEach(input => {
            const value = input.value.trim();
            const isRequired = input.hasAttribute('required');

            console.log(`🔧 DEBUG: Field ${input.id || input.name}: "${value}" (required: ${isRequired})`);

            if (isRequired && !value) {
                console.log(`❌ Required field empty: ${input.id || input.name}`);

                // Show custom error message instead of browser default
                const errorElement = document.getElementById(`${input.id}-error`);
                if (errorElement) {
                    errorElement.textContent = 'This field is required';
                    errorElement.style.display = 'block';
                }

                // Add error styling
                input.classList.add('error');
                input.classList.remove('valid');

                isValid = false;
            } else if (isRequired && value) {
                // Clear error if field is now filled
                const errorElement = document.getElementById(`${input.id}-error`);
                if (errorElement) {
                    errorElement.textContent = '';
                    errorElement.style.display = 'none';
                }

                // Add valid styling
                input.classList.remove('error');
                input.classList.add('valid');
            }

            // Additional validation for specific field types
            if (value && input.type === 'email' && !value.includes('@')) {
                console.log(`❌ Invalid email: ${input.id || input.name}`);
                isValid = false;
            }

            if (value && input.pattern) {
                const regex = new RegExp(input.pattern);
                if (!regex.test(value)) {
                    console.log(`❌ Pattern mismatch: ${input.id || input.name}`);
                    isValid = false;
                }
            }
        });

        console.log(`🔧 DEBUG: Form validation result: ${isValid ? 'PASSED' : 'FAILED'}`);
        return isValid;
    }

    isValidAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    // React-like safe contract call with RPC failover and fallback values
    async safeContractCall(contractCall, fallbackValue) {
        try {
            const contractManager = await this.ensureContractReady();

            // Use ContractManager's RPC failover system if available
            if (contractManager.safeContractCall) {
                return await contractManager.safeContractCall(
                    contractCall,
                    fallbackValue,
                    'AdminPage-safeContractCall'
                );
            } else {
                // Fallback to simple try-catch
                const result = await contractCall();
                return result;
            }
        } catch (error) {
            console.warn('⚠️ Contract call failed, using fallback:', error.message);
            return fallbackValue;
        }
    }

    // Convert BigInt to number safely without overflow
    convertBigIntToNumber(value) {
        if (typeof value === 'bigint') {
            const numValue = Number(value);
            return numValue > Number.MAX_SAFE_INTEGER ? value.toString() : numValue;
        } else if (value && typeof value.toNumber === 'function') {
            try {
                // Check if the value is too large before calling toNumber()
                const strValue = value.toString();
                const bigIntValue = BigInt(strValue);
                if (bigIntValue > BigInt(Number.MAX_SAFE_INTEGER)) {
                    return strValue;
                }
                return value.toNumber();
            } catch (error) {
                console.warn('BigNumber conversion failed, using string representation:', error);
                return value.toString();
            }
        } else if (value && typeof value.toString === 'function') {
            const strValue = value.toString();
            const numValue = parseInt(strValue);
            return isNaN(numValue) ? 0 : numValue;
        }
        return value;
    }

    // Check RPC health like React version
    async checkRpcHealth(contractManager) {
        try {
            // Try a simple contract call to test RPC health with timeout
            const healthPromise = contractManager.stakingContract.rewardToken();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Health check timeout')), 3000)
            );

            await Promise.race([healthPromise, timeoutPromise]);
            return false; // RPC is healthy
        } catch (error) {
            const errorMessage = error.message || '';
            const isRpcError = error.code === -32603 ||
                             (error.error && error.error.code === -32603) ||
                             errorMessage.includes('Internal JSON-RPC error') ||
                             errorMessage.includes('missing trie node') ||
                             errorMessage.includes('missing revert data') ||
                             errorMessage.includes('CALL_EXCEPTION') ||
                             errorMessage.includes('could not detect network') ||
                             errorMessage.includes('Health check timeout');

            if (isRpcError) {
                console.log('🔍 RPC health check failed - network issues detected:', error.code || errorMessage);
                return true; // RPC is down
            }
            return false;
        }
    }

    // Create demo proposals when RPC is down (like React version fallback)
    createDemoProposals() {
        console.log('🎭 Creating enhanced demo proposals for contract call issues');
        return [
            {
                id: 13,
                actionType: 'ADD_PAIR',
                approvals: 1,
                requiredApprovals: 3,
                executed: false,
                rejected: false,
                expired: false,
                proposedTime: Math.floor(Date.now() / 1000) - 1800, // 30 minutes ago
                approvedBy: ['0x9249cFE964C49Cf2d2D0DBBbB33E99235707aa61'],
                // Enhanced data for detailed display
                pairToAdd: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
                pairNameToAdd: 'WETH/USDC',
                platformToAdd: 'Uniswap V3',
                weightToAdd: BigInt('100')
            },
            {
                id: 12,
                actionType: 'WITHDRAW_REWARDS',
                approvals: 1,
                requiredApprovals: 3,
                executed: false,
                rejected: true,
                expired: false,
                proposedTime: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
                approvedBy: ['0xea7bb30fbcCBB2646B0eFeB31382D3A4da07a3cC'],
                // Enhanced data for detailed display
                recipient: '0xea7bb30fbcCBB2646B0eFeB31382D3A4da07a3cC',
                withdrawAmount: BigInt('500000000000000000000') // 500 tokens
            },
            {
                id: 11,
                actionType: 'SET_HOURLY_REWARD_RATE',
                approvals: 1,
                requiredApprovals: 3,
                executed: false,
                rejected: true,
                expired: false,
                proposedTime: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
                approvedBy: ['0xea7bb30fbcCBB2646B0eFeB31382D3A4da07a3cC'],
                // Enhanced data for detailed display
                newHourlyRewardRate: BigInt('500000000000000000') // 0.5 tokens per hour
            }
        ];
    }

    // Display proposals in the UI (for manual testing)
    displayProposals(proposals) {
        console.log('🎭 Manually displaying proposals in UI...');

        const container = document.getElementById('proposals-container') ||
                         document.querySelector('.proposals-list') ||
                         document.querySelector('#multisign-panel .table-body');

        if (!container) {
            console.warn('⚠️ Could not find proposals container');
            return;
        }

        // Clear existing content
        container.innerHTML = '';

        // Add proposals
        proposals.forEach(proposal => {
            const proposalElement = this.createProposalElement(proposal);
            container.appendChild(proposalElement);
        });

        console.log(`✅ Displayed ${proposals.length} proposals in UI`);
    }

    // Create a proposal element for the UI
    createProposalElement(proposal) {
        const div = document.createElement('div');
        div.className = 'proposal-row';
        div.innerHTML = `
            <div class="proposal-item">
                <div class="proposal-header">
                    <span class="proposal-id">#${proposal.id}</span>
                    <span class="proposal-type">${proposal.actionType}</span>
                    <span class="proposal-status">${proposal.approvals}/${proposal.requiredApprovals} approvals</span>
                </div>
                <div class="proposal-details">
                    ${proposal.details.description || 'No description'}
                </div>
                <div class="proposal-actions">
                    <button class="approve-btn" data-action="approve" data-id="${proposal.id}">
                        ✅ Approve
                    </button>
                    <button class="reject-btn" data-action="reject" data-id="${proposal.id}">
                        ❌ Reject
                    </button>
                </div>
            </div>
        `;
        return div;
    }

    // Load contract information like React InfoCard component
    async loadContractInformation() {
        console.log('📊 Loading contract information from smart contract...');

        const cardDiv = document.getElementById('info-card');
        if (cardDiv && !cardDiv.querySelector('[data-info="reward-balance"]')) {
            cardDiv.innerHTML = this.getInfoCardSkeleton();
        }

        try {
            const contractManager = await this.ensureContractReady();

            // Load real contract data
            const contractInfo = {};

            const fallbackSymbol = this.contractStats?.rewardTokenSymbol || 'USDC';
            const rewardTokenSymbol = await this.safeContractCall(
                () => contractManager.rewardTokenContract.symbol(),
                fallbackSymbol
            );
            console.log('💰 Reward token symbol:', rewardTokenSymbol);
            if (!this.contractStats) {
                this.contractStats = {};
            }
            this.contractStats.rewardTokenSymbol = rewardTokenSymbol;

            contractInfo.rewardBalance = await this.safeContractCall(
                async () => {
                    const stakingAddress = contractManager.stakingContract?.address;
                    if (!stakingAddress) {
                        throw new Error('Staking contract address not available');
                    }
                    const balance = await contractManager.rewardTokenContract.balanceOf(stakingAddress);
                    const balanceValue = Number(ethers.utils.formatEther(balance));
                    return `${balanceValue.toFixed(2)} ${rewardTokenSymbol}`;
                },
                `0.00 ${rewardTokenSymbol}`
            );

            this.contractStats.rewardBalance = contractInfo.rewardBalance;

            contractInfo.hourlyRate = await this.safeContractCall(
                async () => {
                    const rate = await contractManager.stakingContract.hourlyRewardRate();
                    const rateValue = Number(ethers.utils.formatEther(rate));
                    return `${rateValue.toFixed(4)} ${rewardTokenSymbol}/hour`;
                },
                `0.0000 ${rewardTokenSymbol}/hour`
            );

            // Get total weight - real data only
            contractInfo.totalWeight = await this.safeContractCall(
                async () => {
                    const weight = await contractManager.getTotalWeight();
                    if (weight && weight.toString) {
                        const weightStr = weight.toString();
                        const weightBigInt = BigInt(weightStr);
                        const weightNum = Number(weightBigInt);
                        return weightNum > Number.MAX_SAFE_INTEGER ?
                            weightBigInt.toString() : weightNum.toLocaleString();
                    }
                    return '0';
                },
                '0'
            );

            // Get pairs with full information - real data only
            contractInfo.pairs = await this.safeContractCall(
                async () => {
                    const pairsInfo = await contractManager.getAllPairsInfo();
                    return pairsInfo || [];
                },
                []
            );

            // Get signers - real data only
            contractInfo.signers = await this.safeContractCall(
                async () => {
                    const signers = await contractManager.getSigners();
                    return signers || [];
                },
                []
            );

            console.log('✅ Contract information loaded:', contractInfo);
            this.displayContractInfo(contractInfo);
            return { success: true, data: contractInfo };

        } catch (error) {
            console.error('❌ Failed to load contract information:', error);
            // Show error state
            const errorInfo = {
                rewardBalance: 'Error',
                hourlyRate: 'Error',
                totalWeight: 'Error',
                pairs: [],
                signers: []
            };
            this.contractStats = this.contractStats || {};
            this.contractStats.rewardTokenSymbol = this.contractStats.rewardTokenSymbol || 'USDC';
            this.contractStats.rewardBalance = errorInfo.rewardBalance;
            this.displayContractInfo(errorInfo);
            return { success: false, error };
        }
    }

    // Display contract information in the UI
    displayContractInfo(info = {}) {
        console.log('🎭 Displaying contract information in UI...');

        // Update reward balance (already includes token symbol)
        const rewardBalanceEl = document.querySelector('[data-info="reward-balance"]');
        if (rewardBalanceEl) {
            rewardBalanceEl.textContent = info.rewardBalance || 'N/A';
        }

        // Update hourly rate (already includes token symbol)
        const hourlyRateEl = document.querySelector('[data-info="hourly-rate"]');
        if (hourlyRateEl) {
            hourlyRateEl.textContent = info.hourlyRate || 'N/A';
        }

        // Update total weight
        const totalWeightEl = document.querySelector('[data-info="total-weight"]');
        if (totalWeightEl) {
            totalWeightEl.textContent = info.totalWeight || 'N/A';
        }

        // Update LP pairs with real contract data
        const pairsContainer = document.querySelector('[data-info="lp-pairs"]');
        if (pairsContainer) {
            if (info.pairs && info.pairs.length > 0) {
                // Sort pairs by weight (highest first)
                const sortedPairs = [...info.pairs].sort((a, b) => {
                    const weightA = parseFloat(a.weight || '0');
                    const weightB = parseFloat(b.weight || '0');
                    return weightB - weightA; // Descending order (highest first)
                });
                pairsContainer.innerHTML = this.renderPairsList(sortedPairs);
            } else {
                pairsContainer.innerHTML = '<div class="no-data">No LP pairs configured</div>';
            }
        }

        // Update signers with real contract data
        const signersContainer = document.querySelector('[data-info="signers"]');
        if (signersContainer) {
            signersContainer.innerHTML = this.renderSignersList(info.signers);
        }

        console.log('✅ Contract information displayed in UI');
    }

    // Refresh admin data once (prevent multiple refreshes)
    refreshAdminDataOnce() {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }

        this.refreshTimeout = setTimeout(() => {
            console.log('🔄 Refreshing admin data...');
            this.loadMultiSignPanel();
            this.loadContractInformation();
            this.refreshTimeout = null;
        }, 1000);
    }

    // Dynamic data loading methods
    async loadPairsForRemoval() {
        const select = document.getElementById('remove-pair-select');
        const loadingIndicator = document.getElementById('pair-loading-indicator');

        if (!select) return;

        try {
            // Show loading indicator
            if (loadingIndicator) {
                loadingIndicator.style.display = 'inline-flex';
            }

            // Disable select while loading
            select.disabled = true;
            select.innerHTML = '<option value="">Loading pairs...</option>';
            select.innerHTML = '<option value="">Loading pairs...</option>';

            // Get pairs from contract with timeout
            const contractManager = await this.ensureContractReady();

            // Add timeout to prevent hanging
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Loading timeout')), 10000)
            );

            const pairs = await Promise.race([
                contractManager.getAllPairsInfo(),
                timeoutPromise
            ]);

            select.innerHTML = '<option value="">Select a pair to remove...</option>';

            if (pairs && pairs.length > 0) {
                pairs.forEach(pair => {
                    const option = document.createElement('option');
                    option.value = pair.address;
                    // Enhanced display with emoji and better formatting
                    option.textContent = `🔗 ${pair.name} (${pair.address.substring(0, 6)}...${pair.address.substring(38)})`;
                    option.setAttribute('data-pair-name', pair.name);
                    option.setAttribute('data-pair-address', pair.address);
                    select.appendChild(option);
                });
                console.log(`✅ Loaded ${pairs.length} pairs for removal`);
            } else {
                select.innerHTML = '<option value="">No pairs available</option>';
                console.warn('⚠️ No pairs available for removal');
            }

            // Enable select
            select.disabled = false;

        } catch (error) {
            console.error('❌ Failed to load pairs:', error);
            select.innerHTML = '<option value="">⚠️ Failed to load pairs - Please refresh</option>';
            select.disabled = false;

            // Show error notification
            if (window.notificationManager) {
                window.notificationManager.error(
                    'Could not load LP pairs. Please refresh and try again.'
                );
            }
        } finally {
            // Hide loading indicator
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
        }
    }

    async loadPairsForWeightUpdate() {
        const container = document.getElementById('weights-list');
        if (!container) return;

        try {
            // Show loading spinner
            container.innerHTML = '<div class="modal-loading-container" style="padding: 20px; text-align: center;"><div class="modal-loading-spinner"></div><p style="margin-top: 10px; color: var(--text-secondary);">Loading pairs...</p></div>';

            // Get pairs from contract
            const contractManager = await this.ensureContractReady();
            const pairs = await contractManager.getAllPairsInfo();

            if (pairs && pairs.length > 0) {
                let html = '';
                pairs.forEach((pair, index) => {
                    html += `
                        <div class="weight-pair-item" data-pair="${pair.address}" style="margin-bottom: 16px; padding: 16px; border: 1px solid var(--divider); border-radius: 8px; background: var(--background-paper); overflow: hidden;">
                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                <div class="pair-info" style="overflow: hidden;">
                                    <div style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">${pair.name}</div>
                                    <div style="font-size: 11px; color: var(--text-secondary); font-family: monospace; word-break: break-all; line-height: 1.4;">${pair.address}</div>
                            </div>
                                <div style="display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap;">
                                    <div style="display: flex; flex-direction: column; min-width: 100px;">
                                        <span style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px;">Current</span>
                                        <span style="font-size: 20px; font-weight: 600; color: var(--primary-main);">${this.formatWeight(pair.weight)}</span>
                                    </div>
                                    <div style="display: flex; flex-direction: column; flex: 1; min-width: 180px;">
                                        <label for="weight-${index}" style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px;">New Weight</label>
                                <input type="number"
                                       class="form-input weight-input"
                                       id="weight-${index}"
                                               placeholder="Enter new weight"
                                       min="1" max="10000"
                                               style="padding: 10px 12px; border: 1px solid var(--divider); border-radius: 6px; background: var(--background-default); color: var(--text-primary); font-size: 16px; font-weight: 500; width: 100%; box-sizing: border-box;"
                                       data-pair="${pair.address}"
                                       data-current="${this.formatWeight(pair.weight)}">
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                });
                container.innerHTML = html;
            } else {
                container.innerHTML = '<p class="no-data" style="text-align: center; padding: 20px; color: var(--text-secondary);">No pairs available for weight updates</p>';
            }
        } catch (error) {
            console.error('Failed to load pairs for weight update:', error);
            container.innerHTML = '<p class="error-message">Failed to load pairs. Please try again.</p>';
        }
    }

    // Helper methods for user feedback
    showSuccess(message) {
        const text = message || 'Action completed successfully';
        const canShowInline = typeof this.showMessage === 'function' && !!document.querySelector('.modal-body');

        // Show inline feedback when a modal is open
        if (canShowInline) {
            this.showMessage(text, 'success');
        }

        // Surface toast-style feedback when the notification manager exists
        if (window.notificationManager) {
            window.notificationManager.success(text);
        } else if (!canShowInline) {
            alert('✅ ' + text);
        }
    }

    showError(titleOrMessage, detail) {
        const hasDetail = typeof detail === 'string' && detail.trim().length > 0;

        if (hasDetail) {
            const title = titleOrMessage || 'Error';
            const message = detail;

            console.error('❌ Error:', title, '-', message);

            const container = document.getElementById('admin-section-content') || document.body;
            container.innerHTML = `
                <div class="error-display">
                    <h3>❌ ${title}</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="adminPage.init()">
                        Retry
                    </button>
                </div>
            `;
            return;
        }

        const message = typeof titleOrMessage === 'string' && titleOrMessage.trim().length > 0
            ? titleOrMessage
            : 'An unexpected error occurred';

        console.error('❌ Error:', message);

        const canShowInline = typeof this.showMessage === 'function' && !!document.querySelector('.modal-body');

        if (canShowInline) {
            this.showMessage(message, 'error');
        }

        if (window.notificationManager) {
            window.notificationManager.error(message);
        } else if (!canShowInline) {
            alert('❌ ' + message);
        }
    }

    showMessage(message, type = 'info') {
        // Create or update validation messages container
        let container = document.getElementById('validation-messages');
        if (!container) {
            container = document.createElement('div');
            container.id = 'validation-messages';
            container.className = 'validation-messages';

            // Insert at top of modal body
            const modalBody = document.querySelector('.modal-body');
            if (modalBody) {
                modalBody.insertBefore(container, modalBody.firstChild);
            }
        }

        container.innerHTML = `
            <div class="message ${type}">
                <span class="message-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
                <span class="message-text">${message}</span>
            </div>
        `;

        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                if (container) container.innerHTML = '';
            }, 3000);
        }
    }

    // Proposal submission methods
    async submitHourlyRateProposal(event) {
        if (event) event.preventDefault();

        const rate = document.getElementById('new-rate').value;

        // Validate inputs
        if (!rate) {
            this.showError('Please fill in the new hourly rate');
            return;
        }

        const rateNum = parseFloat(rate);
        if (isNaN(rateNum) || rateNum <= 0) {
            this.showError('Rate must be a positive number');
            return;
        }

        try {
            if (window.notificationManager) {
                window.notificationManager.info('Submitting hourly rate change proposal');
            }

            // Call contract method to create proposal
            const contractManager = await this.ensureContractReady();
            const result = await contractManager.proposeSetHourlyRewardRate(rateNum);

            if (result.success) {
                // Close modal first
                this.closeModal();

                // Show success message
                let successMessage = '✅ Hourly rate change proposal submitted successfully!';
                if (result.transactionHash) {
                    successMessage += ` Transaction: ${result.transactionHash.substring(0, 10)}...`;
                }
                this.showSuccess(successMessage);

                // Refresh data once without causing loops
                this.refreshAdminDataOnce();
            } else {
                this.showError(result.error || 'Failed to create proposal');
            }

        } catch (error) {
            console.error('Failed to create hourly rate proposal:', error);
            this.showError('Failed to create proposal: ' + error.message);
        }
    }

    async submitAddPairProposal(event = null) {
        if (event) event.preventDefault();

        console.log('[ADD PAIR UI] 🚀 Starting Add Pair Proposal submission');

        const pairAddress = document.getElementById('pair-address').value;
        const weight = document.getElementById('pair-weight').value;
        const pairName = document.getElementById('pair-name').value;
        const platform = document.getElementById('pair-platform').value;
        console.log('[ADD PAIR UI] 📋 Form data collected:', {
            pairAddress, weight, pairName, platform
        });

        // Enhanced validation with detailed feedback
        if (!pairAddress || !weight || !pairName || !platform) {
            this.showError('Please fill in all required fields: LP Address, Weight, Pair Name, and Platform');
            return;
        }

        if (!this.isValidAddress(pairAddress)) {
            this.showError('Invalid LP token address format. Please enter a valid Ethereum address starting with 0x');
            return;
        }

        const weightNum = parseInt(weight);
        if (isNaN(weightNum) || weightNum < 1 || weightNum > 10000) {
            this.showError('Weight must be a number between 1 and 10,000');
            return;
        }

        if (pairName.length < 2 || pairName.length > 50) {
            this.showError('Pair name must be between 2 and 50 characters');
            return;
        }

        if (platform.length < 2 || platform.length > 30) {
            this.showError('Platform name must be between 2 and 30 characters');
            return;
        }

        try {
            const contractManager = await this.ensureContractReady();
            const result = await contractManager.proposeAddPair(pairAddress, pairName, platform, weightNum);

            if (result.success) {
                this.closeModal();

                let successMessage = '✅ Add Pair proposal created successfully!';
                if (result.transactionHash) {
                    successMessage += ` Transaction: ${result.transactionHash.substring(0, 10)}...`;
                }
                this.showSuccess(successMessage);
                this.refreshAdminDataOnce();
            } else {
                this.showError(result.error || 'Failed to create proposal');
            }

        } catch (error) {
            console.error('Failed to create add pair proposal:', error);
            this.showError('Failed to create proposal: ' + error.message);
        }
    }

    async submitRemovePairProposal(event = null) {
        if (event) event.preventDefault();

        try {
            const pairAddress = document.getElementById('remove-pair-select')?.value;
            const confirmRemoval = document.getElementById('confirm-removal')?.checked;

            // Validate required fields
            if (!pairAddress) {
                this.showError('Please select a pair to remove');
                return;
            }

            if (!confirmRemoval) {
                this.showError('Please confirm that you understand the consequences of removing this pair');
                return;
            }

            const contractManager = await this.ensureContractReady();
            const result = await contractManager.proposeRemovePair(pairAddress);

            if (result.success) {
                this.closeModal();

                let successMessage = '✅ Remove Pair proposal created successfully!';
                if (result.transactionHash) {
                    successMessage += ` Transaction: ${result.transactionHash.substring(0, 10)}...`;
                }
                this.showSuccess(successMessage);
                this.refreshAdminDataOnce();
            } else {
                this.showError(result.error || 'Failed to create removal proposal');
            }

        } catch (error) {
            console.error('Failed to create removal proposal:', error);
            this.showError('Failed to create proposal: ' + error.message);
        }
    }

    async submitUpdateWeightsProposal(event = null) {
        if (event) event.preventDefault();

        const weightInputs = document.querySelectorAll('.weight-input');

        // Collect weight updates
        const weightUpdates = [];
        for (const input of weightInputs) {
            const newWeight = input.value.trim();
            if (!newWeight) {
                continue;
            }

            const pairAddress = input.dataset.pair;
            const currentWeight = parseInt(input.dataset.current, 10);
            const newWeightNum = parseInt(newWeight, 10);

            if (isNaN(newWeightNum) || newWeightNum < 1 || newWeightNum > 10000) {
                this.showError(`Invalid weight value: ${newWeight}. Must be between 1-10,000`);
                return;
            }

            if (newWeightNum !== currentWeight) {
                weightUpdates.push({
                    pairAddress,
                    newWeight: newWeightNum,
                    currentWeight
                });
            }
        }

        if (weightUpdates.length === 0) {
            this.showError('Please specify at least one weight change');
            return;
        }

        try {
            const contractManager = await this.ensureContractReady();

            // Extract addresses and weights for contract call
            const lpTokens = weightUpdates.map(update => update.pairAddress);
            const weights = weightUpdates.map(update => update.newWeight);

            // Create batch weight update proposal
            const result = await contractManager.proposeUpdatePairWeights(lpTokens, weights);

            if (result.success) {
                this.closeModal();

                let successMessage = '✅ Weight update proposal created successfully!';
                if (result.transactionHash) {
                    successMessage += ` Transaction: ${result.transactionHash.substring(0, 10)}...`;
                }
                this.showSuccess(successMessage);
                this.refreshAdminDataOnce();
            } else {
                this.showError(result.error || 'Failed to create weight update proposal');
            }

        } catch (error) {
            console.error('Failed to create weight update proposal:', error);
            this.showError('Failed to create proposal: ' + error.message);
        }
    }

    async submitChangeSignerProposal(event) {
        event.preventDefault();

        console.log('[CHANGE SIGNER UI] 🚀 Starting Change Signer Proposal submission');

        // DUPLICATE PREVENTION FIX: Check if already submitting
        if (this.isSubmittingChangeSigner) {
            console.log('[CHANGE SIGNER UI] ⚠️ Already submitting change signer proposal, ignoring duplicate request');
            return;
        }

        const oldSigner = document.getElementById('old-signer').value;
        const newSigner = document.getElementById('new-signer').value;

        console.log('[CHANGE SIGNER UI] 📋 Form data collected:', {
            oldSigner, newSigner
        });

        // DUPLICATE PREVENTION FIX: Set submission flag and disable submit button
        this.isSubmittingChangeSigner = true;
        const submitBtn = document.querySelector('#change-signer-form button[type="submit"], button[form="change-signer-form"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating Proposal...';
        }

        try {
            // Enhanced validation
            if (!oldSigner || !newSigner) {
                this.showError('Please fill in both old and new signer addresses');
                return;
            }

            if (!ethers.utils.isAddress(oldSigner)) {
                this.showError('Invalid old signer address format');
                return;
            }

            if (!ethers.utils.isAddress(newSigner)) {
                this.showError('Invalid new signer address format');
                return;
            }

            if (oldSigner.toLowerCase() === newSigner.toLowerCase()) {
                this.showError('Old and new signer addresses cannot be the same');
                return;
            }

            if (window.notificationManager) {
                window.notificationManager.info('Submitting signer change proposal');
            }

            const contractManager = await this.ensureContractReady();
            const result = await contractManager.proposeChangeSigner(oldSigner, newSigner);

            if (result.success) {
                this.closeModal();

                let successMessage = '✅ Change signer proposal created successfully!';
                if (result.transactionHash) {
                    successMessage += ` Transaction: ${result.transactionHash.substring(0, 10)}...`;
                }
                this.showSuccess(successMessage);
                this.refreshAdminDataOnce();
            } else {
                this.showError(result.error || 'Failed to create change signer proposal');
            }

        } catch (error) {
            console.error('Failed to create signer change proposal:', error);
            this.showError('Failed to create proposal: ' + error.message);
        } finally {
            // DUPLICATE PREVENTION FIX: Always reset submission state and button
            this.isSubmittingChangeSigner = false;
            const submitBtn = document.querySelector('#change-signer-form button[type="submit"], button[form="change-signer-form"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Signer Change Proposal';
            }
        }
    }

    async submitWithdrawalProposal(event) {
        event.preventDefault();

        console.log('[WITHDRAWAL UI] 🚀 Starting Withdrawal Proposal submission');

        // DUPLICATE PREVENTION FIX: Check if already submitting
        if (this.isSubmittingWithdrawal) {
            console.log('[WITHDRAWAL UI] ⚠️ Already submitting withdrawal proposal, ignoring duplicate request');
            return;
        }

        const amount = document.getElementById('withdrawal-amount').value;
        const toAddress = document.getElementById('withdrawal-address').value;

        console.log('[WITHDRAWAL UI] 📋 Form data collected:', {
            amount, toAddress
        });

        // DUPLICATE PREVENTION FIX: Set submission flag and disable submit button
        this.isSubmittingWithdrawal = true;
        const submitBtn = document.querySelector('#withdrawal-form button[type="submit"], button[form="withdrawal-form"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating Proposal...';
        }

        try {
            // Enhanced validation
            if (!amount || !toAddress) {
                this.showError('Please fill in both amount and recipient address');
                return;
            }

            if (!ethers.utils.isAddress(toAddress)) {
                this.showError('Invalid recipient address format');
                return;
            }

            const amountNum = parseFloat(amount);
            if (isNaN(amountNum) || amountNum <= 0) {
                this.showError('Amount must be a positive number');
                return;
            }

            if (window.notificationManager) {
                window.notificationManager.info('Submitting withdrawal proposal');
            }

            const contractManager = await this.ensureContractReady();
            const result = await contractManager.proposeWithdrawRewards(toAddress, amount);

            if (result.success) {
                this.closeModal();

                let successMessage = '✅ Withdrawal proposal created successfully!';
                if (result.transactionHash) {
                    successMessage += ` Transaction: ${result.transactionHash.substring(0, 10)}...`;
                }
                this.showSuccess(successMessage);
                this.refreshAdminDataOnce();
            } else {
                this.showError(result.error || 'Failed to create withdrawal proposal');
            }

        } catch (error) {
            console.error('Failed to create withdrawal proposal:', error);
            this.showError('Failed to create proposal: ' + error.message);
        } finally {
            // DUPLICATE PREVENTION FIX: Always reset submission state and button
            this.isSubmittingWithdrawal = false;
            const submitBtn = document.querySelector('#withdrawal-form button[type="submit"], button[form="withdrawal-form"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Withdrawal Proposal';
            }
        }
    }

    // Utility methods for modals
    renderPairOptions() {
        if (!this.contractStats?.pairs || this.contractStats.pairs.length === 0) {
            return '<option value="">No pairs available</option>';
        }

        return this.contractStats.pairs.map(pair => `
            <option value="${pair.address}" data-weight="${pair.weight}">
                ${pair.name || this.formatAddress(pair.address)} (Weight: ${pair.weight})
            </option>
        `).join('');
    }

    renderSignerOptions() {
        // Get signers from CONFIG first, then fallback to contractStats
        const signers = window.CONFIG?.GOVERNANCE?.SIGNERS || this.contractStats?.signers || [];

        console.log('🔧 DEBUG: Available signers:', signers);

        if (signers.length === 0) {
            return '<option value="">No signers available</option>';
        }

        return signers.map(signer => `
            <option value="${signer}">
                ${this.formatAddress(signer)}
            </option>
        `).join('');
    }

    // Proposal action methods
    async approveAction(proposalId) {
        try {
            console.log(`🗳️ Approving proposal: ${proposalId}`);

            if (window.notificationManager) {
                window.notificationManager.info(`Submitting approval for proposal #${proposalId}`);
            }

            // Use real contract for approval (like React version)
            const contractManager = await this.ensureContractReady();
            const result = await contractManager.approveAction(proposalId);
            console.log('✅ Real contract approval result:', result);

            if (result.success) {
                console.log('✅ Proposal approved successfully');
                this.showSuccess(`✅ Proposal #${proposalId} approved successfully! Your vote has been recorded on the blockchain.`);
                this.refreshAdminDataOnce();
            } else {
                // Handle specific contract errors like React version
                const errorMessage = result.error || 'Failed to approve proposal';
                if (errorMessage.includes('Already approved')) {
                    this.showError('✋ You have already approved this proposal. Each signer can only vote once per proposal.');
                } else if (errorMessage.includes('Cannot reject after approving')) {
                    this.showError('✋ You cannot reject a proposal you have already approved. Each signer can only vote once.');
                } else {
                    this.showError(errorMessage);
                }
            }

        } catch (error) {
            console.error('❌ Failed to approve proposal:', error);
            this.showError('Unexpected error occurred while approving proposal. Please try again.');
        }
    }

    async rejectAction(proposalId) {
        try {
            console.log(`🗳️ Rejecting proposal: ${proposalId}`);

            if (window.notificationManager) {
                window.notificationManager.info(`Submitting rejection for proposal #${proposalId}`);
            }

            // Use real contract for rejection (like React version)
            const contractManager = await this.ensureContractReady();
            const result = await contractManager.rejectAction(proposalId);
            console.log('✅ Real contract rejection result:', result);

            if (result.success) {
                console.log('✅ Proposal rejected successfully');
                this.showSuccess(`✅ Proposal #${proposalId} rejected successfully! Your vote has been recorded on the blockchain.`);
                this.refreshAdminDataOnce();
            } else {
                // Handle specific contract errors like React version
                const errorMessage = result.error || 'Failed to reject proposal';
                if (errorMessage.includes('Cannot reject after approving')) {
                    this.showError('✋ You cannot reject a proposal you have already approved. Each signer can only vote once per proposal.');
                } else if (errorMessage.includes('Already rejected')) {
                    this.showError('✋ You have already rejected this proposal. Each signer can only vote once per proposal.');
                } else {
                    this.showError(errorMessage);
                }
            }

        } catch (error) {
            console.error('❌ Failed to reject proposal:', error);
            this.showError('Unexpected error occurred while rejecting proposal. Please try again.');
        }
    }

    async executeAction(proposalId) {
        try {
            if (window.notificationManager) {
                window.notificationManager.info(`Executing proposal #${proposalId}`);
            }

            const result = await window.contractManager.executeProposal(proposalId);

            if (result.success) {
                console.log('✅ Proposal executed successfully');
                this.showSuccess(`✅ Proposal #${proposalId} executed successfully! The proposed action has been carried out on the blockchain.`);
                this.refreshAdminDataOnce();
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Failed to execute proposal:', error);
            if (window.notificationManager) {
                window.notificationManager.error(error.message);
            }
        }
    }

    async cancelAction(proposalId) {
        try {
            if (window.notificationManager) {
                window.notificationManager.info(`Cancelling proposal #${proposalId}`);
            }

            const result = await window.contractManager.cancelProposal(proposalId);

            if (result.success) {
                if (window.notificationManager) {
                    window.notificationManager.success(`Successfully cancelled proposal #${proposalId}`);
                }

                // PERFORMANCE OPTIMIZATION: Update single proposal instead of full refresh
                await this.updateSingleProposal(proposalId);
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Failed to cancel proposal:', error);
            if (window.notificationManager) {
                window.notificationManager.error(error.message);
            }
        }
    }

    // Cleanup
    destroy() {
        // Clear intervals
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }

        // Remove event listeners
        if (window.ethereum) {
            try {
                window.ethereum.removeAllListeners('accountsChanged');
                window.ethereum.removeAllListeners('chainChanged');
            } catch (error) {
                console.warn('⚠️ Error removing ethereum listeners:', error);
            }
        }

        // Remove custom event listeners
        window.removeEventListener('walletConnected', this.handleWalletConnected);
        window.removeEventListener('walletDisconnected', this.handleWalletDisconnected);
        window.removeEventListener('contractReady', this.handleContractReady);
        window.removeEventListener('contractError', this.handleContractError);

        // Clear references
        this.isInitialized = false;
        this.isAuthorized = false;
        this.contractStats = {};

        console.log('🧹 Admin Panel destroyed');
    }

    /**
     * Display message when governance features are not available
     */
    displayNoGovernance() {
        const governanceSection = document.querySelector('.governance-section');
        if (governanceSection) {
            governanceSection.innerHTML = `
                <div class="no-governance-message" style="text-align: center; padding: 2rem; background: var(--card-bg); border-radius: 8px; border: 1px solid var(--border-color);">
                    <h3 style="color: var(--text-primary); margin-bottom: 1rem;">🏛️ Governance Features</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">Governance features are not available for this contract.</p>
                    <div style="text-align: left; max-width: 400px; margin: 0 auto;">
                        <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">This may be because:</p>
                        <ul style="color: var(--text-secondary); padding-left: 1.5rem;">
                            <li>The contract doesn't implement multi-signature governance</li>
                            <li>Governance functions are not yet deployed</li>
                            <li>You don't have the required permissions</li>
                            <li>Network connectivity issues</li>
                        </ul>
                    </div>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 1rem;">
                        Basic staking functions should still work normally.
                    </p>
                </div>
            `;
        }
    }

    /**
     * Format numbers for display
     */
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(2) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(2) + 'K';
        }
        return num.toFixed(2);
    }

    /**
     * Format weight values (BigNumber to decimal) - ENHANCED VERSION
     */
    formatWeight(weight, label = "weight") {
        console.log(`[FORMAT DEBUG] Formatting ${label}:`, {
            value: weight,
            type: typeof weight,
            isBigNumber: weight && weight._isBigNumber,
            toString: weight ? weight.toString() : 'null',
            length: typeof weight === 'string' ? weight.length : 'N/A'
        });

        if (!weight) return '0.000';

        try {
            // Handle BigNumber values (like 10000000000000000000)
            if (typeof weight === 'object' && weight._isBigNumber) {
                const formatted = ethers.utils.formatUnits(weight, 18);
                const result = parseFloat(formatted).toFixed(3);
                console.log(`[FORMAT DEBUG] BigNumber ${label} formatted:`, result);
                return result;
            }

            // ENHANCED: Handle string values that look like wei (more aggressive detection)
            if (typeof weight === 'string') {
                // Check if it's a large number string (wei format)
                const weightStr = weight.trim();

                // If it's a very large number (> 1000000000000000000), treat as wei
                if (/^\d+$/.test(weightStr) && weightStr.length >= 18) {
                    const formatted = ethers.utils.formatUnits(weightStr, 18);
                    const result = parseFloat(formatted).toFixed(3);
                    console.log(`[FORMAT DEBUG] Large wei string ${label} formatted: ${weightStr} -> ${result}`, 'success');
                    return result;
                }

                // If it's exactly "10000000000000000000" (10 ether in wei), format it
                if (weightStr === '10000000000000000000') {
                    const result = '10.000';
                    console.log(`[FORMAT DEBUG] Standard wei ${label} formatted: ${weightStr} -> ${result}`, 'success');
                    return result;
                }

                // Handle other large wei values
                if (weightStr.length > 15 && /^\d+$/.test(weightStr)) {
                    const formatted = ethers.utils.formatUnits(weightStr, 18);
                    const result = parseFloat(formatted).toFixed(3);
                    console.log(`[FORMAT DEBUG] Wei string ${label} formatted: ${weightStr} -> ${result}`, 'success');
                    return result;
                }

                // Handle regular string numbers (small values)
                const num = parseFloat(weightStr);
                if (!isNaN(num)) {
                    const result = num.toFixed(3);
                    console.log(`[FORMAT DEBUG] String number ${label} formatted:`, result);
                    return result;
                }
            }

            // Handle regular numbers
            if (typeof weight === 'number') {
                const result = weight.toFixed(3);
                console.log(`[FORMAT DEBUG] Number ${label} formatted:`, result);
                return result;
            }

            console.warn(`[FORMAT DEBUG] Unhandled ${label} type, returning as string:`, weight);
            return weight.toString();
        } catch (error) {
            console.error(`[FORMAT ERROR] BigNumber formatting failed for ${label}:`, error);
            console.error(`[FORMAT ERROR] Input was:`, weight);
            return "0.000";
        }
    }

    /**
     * Navigate to home page with optimized loading
     */
    navigateToHome() {
        console.log('🏠 Navigating to home page...');
        
        // Show loading indicator
        if (window.notificationManager) {
            window.notificationManager.info('Loading homepage...');
        }
        
        // Always navigate directly to index.html to ensure correct destination
        window.location.href = '../';
    }
}

// Export for global access
window.AdminPage = AdminPage;

// Make navigateToHome globally available
window.navigateToHome = function() {
    if (window.adminPage && window.adminPage.navigateToHome) {
        window.adminPage.navigateToHome();
    } else {
        // Fallback navigation
        window.location.href = '../';
    }
};
