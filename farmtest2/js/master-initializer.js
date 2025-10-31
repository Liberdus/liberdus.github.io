

class MasterInitializer {
    constructor() {
        this.loadedScripts = new Set();
        this.components = new Map();
        this.initializationPromise = null;
        this.isReady = false;

        // Detect which page we're on to conditionally load components
        this.isAdminPage = window.location.pathname.includes('admin');
        
        // Make instance globally available for testing
        window.masterInitializer = this;

        console.log(`🔧 MasterInitializer created (${this.isAdminPage ? 'admin mode' : 'homepage mode'})`);
        // Note: init() will be called manually from DOMContentLoaded event
    }

    async init() {
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this.initializeSystem();
        return this.initializationPromise;
    }

    async initializeSystem() {
        try {
            await this.loadConfiguration();
            await this.loadCoreUtilities();
            await this.loadWalletSystems();
            await this.loadUIComponents();
            await this.initializeComponents();
            this.setupGlobalHandlers();
            this.isReady = true;
            
            // Dispatch ready event
            document.dispatchEvent(new CustomEvent('systemReady', {
                detail: { components: Array.from(this.components.keys()) }
            }));

        } catch (error) {
            console.error('❌ System initialization failed:', error);
            this.handleInitializationError(error);
        }
    }

    async loadConfiguration() {
        console.log('⚙️ Loading application configuration...');

        // Load production logger first
        await this.loadScript('js/utils/production-logger.js');

        // Load SES-safe handler
        await this.loadScript('js/utils/ses-safe-handler.js');

        // Load demo configuration first (if available)
        try {
            await this.loadScript('js/config/demo-config.js');
        } catch (error) {
            console.log('Demo config not found - running in production mode');
        }

        // Load main configuration
        await this.loadScript('js/config/app-config.js');

        // Load mock service if demo mode is enabled
        if (window.DEMO_CONFIG && window.DEMO_CONFIG.ENABLED) {
            try {
                await this.loadScript('js/services/mock-blockchain-service.js');
                console.log('🎭 Demo mode active - Mock blockchain service loaded');
            } catch (error) {
                console.warn('Failed to load mock blockchain service:', error);
            }
        }

        // Verify configuration loaded
        if (!window.CONFIG) {
            throw new Error('Failed to load application configuration');
        }

        console.log('✅ Configuration loaded successfully');
    }

    async loadCoreUtilities() {
        const coreScripts = [
            'js/utils/multicall-service.js',    // Multicall2 for batch loading (90% RPC reduction)
            'js/utils/formatter.js',            // Formatter utilities (needed before UI components)
            'js/components/network-indicator-selector.js',
            'js/core/error-handler.js',        // Error handling system
            'js/core/unified-theme-manager.js', // Unified theme manager
            'js/core/notification-manager-new.js',
            'js/core/loading-manager.js',
            'js/core/accessibility-manager.js'
        ];

        // Only load dev/test utilities if in development mode
        if (window.DEV_CONFIG?.ADMIN_DEVELOPMENT_MODE) {
            console.log('🚧 Development mode: Loading test utilities');
            coreScripts.push('js/utils/rpc-test.js');
            coreScripts.push('js/utils/admin-test.js');
        } else {
            console.log('🚀 Production mode: Skipping test utilities');
        }

        for (const script of coreScripts) {
            await this.loadScript(script);
        }
    }

    async loadWalletSystems() {
        const walletScripts = [
            'js/wallet/wallet-manager.js',
            'js/wallet/network-manager.js',
            'js/contracts/contract-manager.js'
        ];

        // Only load price feeds and rewards calculator on homepage
        if (!this.isAdminPage) {
            walletScripts.push('js/utils/price-feeds.js');
            walletScripts.push('js/utils/rewards-calculator.js');
            console.log('📊 Loading homepage-specific utilities (price feeds, rewards calculator)');
        } else {
            console.log('⏭️ Skipping homepage utilities (admin mode)');
        }

        for (const script of walletScripts) {
            await this.loadScript(script);
        }
    }

    async loadUIComponents() {
        // Skip homepage UI components on admin page
        if (this.isAdminPage) {
            console.log('⏭️ Skipping homepage UI components (admin mode)');
            return;
        }

        // Homepage only: Load CSS for wallet popup
        await this.loadCSS('css/wallet-popup.css');

        const uiScripts = [
            'js/components/wallet-popup.js',
            'js/components/home-page.js',
            'js/components/staking-modal-new.js'
        ];

        console.log('🏠 Loading homepage UI components');
        for (const script of uiScripts) {
            await this.loadScript(script);
        }
    }

    async initializeComponents() {
        console.log('🔧 Initializing components...');

        // Initialize unified theme manager
        if (window.UnifiedThemeManager) {
            try {
                window.unifiedThemeManager = new window.UnifiedThemeManager();
                window.unifiedThemeManager.initialize();
                this.components.set('unifiedThemeManager', window.unifiedThemeManager);
                console.log('✅ Unified Theme Manager initialized');
            } catch (error) {
                console.error('❌ Failed to initialize UnifiedThemeManager:', error);
            }
        }

        // Initialize error handler (critical for other systems)
        if (window.ErrorHandler && !window.errorHandler) {
            try {
                window.errorHandler = new window.ErrorHandler();
                this.components.set('errorHandler', window.errorHandler);
                console.log('✅ Error Handler initialized');
            } catch (error) {
                console.error('❌ Failed to initialize ErrorHandler:', error);
            }
        } else if (window.errorHandler) {
            console.log('✅ Error Handler already initialized');
        } else {
            console.warn('⚠️ ErrorHandler not available - using fallback error handling');
        }


        // Initialize notification manager
        if (window.NotificationManagerNew) {
            window.notificationManager = new window.NotificationManagerNew();
            this.components.set('notificationManager', window.notificationManager);
            console.log('✅ Notification Manager initialized');
        }

        // Initialize wallet manager - check multiple sources
        console.log('🔍 Checking wallet manager availability...');
        console.log('  - WalletManagerNew:', !!window.WalletManagerNew);
        console.log('  - WalletManager:', !!window.WalletManager);
        console.log('  - walletManager instance:', !!window.walletManager);

        // Try WalletManagerNew first (from theme-manager-new.js)
        if (window.WalletManagerNew && !window.walletManager) {
            try {
                window.walletManager = new window.WalletManagerNew();
                if (window.walletManager.init) {
                    await window.walletManager.init(); // Initialize if init method exists
                }
                this.components.set('walletManager', window.walletManager);
                console.log('✅ Wallet Manager (New) initialized');

                // Update button status after wallet manager is ready
                setTimeout(() => {
                    if (this.updateConnectButtonStatus) {
                        this.updateConnectButtonStatus();
                    }
                }, 500);

            } catch (error) {
                console.error('❌ Failed to initialize WalletManagerNew:', error);
            }
        }

        // Try the main wallet manager if available and no instance exists
        if (window.WalletManager && !window.walletManager) {
            try {
                window.walletManager = new window.WalletManager();
                await window.walletManager.init(); // Initialize wallet manager
                this.components.set('walletManager', window.walletManager);
                console.log('✅ Wallet Manager (Main) initialized');

                // Update button status after wallet manager is ready
                setTimeout(() => {
                    if (this.updateConnectButtonStatus) {
                        this.updateConnectButtonStatus();
                    }
                }, 500);

            } catch (error) {
                console.error('❌ Failed to initialize WalletManager:', error);
            }
        }

        // If wallet manager instance already exists, just register it
        if (window.walletManager && !this.components.has('walletManager')) {
            this.components.set('walletManager', window.walletManager);
            console.log('✅ Existing WalletManager instance registered');
        }

        // Final verification
        if (window.walletManager) {
            console.log('🔍 WalletManager final check:');
            console.log('  - Instance exists:', !!window.walletManager);
            console.log('  - connectMetaMask method:', typeof window.walletManager.connectMetaMask);
            console.log('  - isConnected method:', typeof window.walletManager.isConnected);
        } else {
            console.warn('⚠️ No wallet manager available after initialization attempts');
        }

        // Initialize contract manager with read-only provider
        if (window.ContractManager) {
            window.contractManager = new window.ContractManager();
            this.components.set('contractManager', window.contractManager);
            console.log('✅ Contract Manager created');

            // Set up permission change listener (now handled by network manager)
            if (window.networkManager && typeof window.networkManager.setupPermissionChangeListener === 'function') {
                window.networkManager.setupPermissionChangeListener();
            }

            // Initialize ContractManager: wallet mode if already connected, else read-only
            try {
                const isWalletConnected = !!(window.walletManager && typeof window.walletManager.isConnected === 'function' && window.walletManager.isConnected());
                if (isWalletConnected && typeof window.ethereum !== 'undefined' && window.ethers) {
                    console.log('🔄 Wallet detected as connected on load - initializing in wallet mode...');
                    const provider = new window.ethers.providers.Web3Provider(window.ethereum);
                    const signer = provider.getSigner();
                    await window.contractManager.upgradeToWalletMode(provider, signer);
                    // Notify listeners that ContractManager is ready
                    document.dispatchEvent(new CustomEvent('contractManagerReady', {
                        detail: { contractManager: window.contractManager }
                    }));
                    console.log('✅ ContractManager initialized in wallet mode');
                } else {
                    console.log('🔄 Initializing ContractManager with read-only provider...');
                    await window.contractManager.initializeReadOnly();
                    // Notify listeners that ContractManager is ready
                    document.dispatchEvent(new CustomEvent('contractManagerReady', {
                        detail: { contractManager: window.contractManager }
                    }));
                    console.log('✅ ContractManager initialized with read-only provider');
                }

                // Note: contractManagerReady is dispatched above after initialization
            } catch (error) {
                console.error('❌ Failed to initialize ContractManager with read-only provider:', error);
            }
        }

        // Initialize price feeds system (homepage only)
        if (!this.isAdminPage) {
            console.log('🔍 Checking PriceFeeds availability:', {
                PriceFeedsClass: !!window.PriceFeeds,
                priceFeedsInstance: !!window.priceFeeds
            });

            if (window.PriceFeeds && !window.priceFeeds) {
                try {
                    console.log('🔄 Creating PriceFeeds instance...');
                    window.priceFeeds = new window.PriceFeeds();

                    console.log('🔄 Initializing PriceFeeds...');
                    const initResult = await window.priceFeeds.initialize();

                    this.components.set('priceFeeds', window.priceFeeds);
                    console.log('✅ Price Feeds initialized successfully:', {
                        isInitialized: window.priceFeeds.isInitialized,
                        initResult: initResult
                    });
                } catch (error) {
                    console.error('❌ Failed to initialize PriceFeeds:', error);
                    console.error('   Error stack:', error.stack);
                }
            } else if (window.priceFeeds) {
                console.log('ℹ️ PriceFeeds instance already exists');
            } else {
                console.error('❌ PriceFeeds class not found!');
            }
        } else {
            console.log('⏭️ Skipping PriceFeeds initialization (admin mode)');
        }

        // Initialize rewards calculator (homepage only)
        if (!this.isAdminPage) {
            console.log('🔍 Checking RewardsCalculator availability:', {
                RewardsCalculatorClass: !!window.RewardsCalculator,
                rewardsCalculatorInstance: !!window.rewardsCalculator,
                contractManager: !!window.contractManager,
                priceFeeds: !!window.priceFeeds
            });

            if (window.RewardsCalculator && !window.rewardsCalculator && window.contractManager && window.priceFeeds) {
                try {
                    console.log('🔄 Creating RewardsCalculator instance...');
                    window.rewardsCalculator = new window.RewardsCalculator();

                    console.log('🔄 Initializing RewardsCalculator...');
                    const initResult = await window.rewardsCalculator.initialize(window.contractManager, window.priceFeeds);

                    this.components.set('rewardsCalculator', window.rewardsCalculator);
                    console.log('✅ Rewards Calculator initialized successfully:', {
                        isInitialized: window.rewardsCalculator.isInitialized,
                        initResult: initResult
                    });
                } catch (error) {
                    console.error('❌ Failed to initialize RewardsCalculator:', error);
                    console.error('   Error stack:', error.stack);
                }
            } else if (window.rewardsCalculator) {
                console.log('ℹ️ RewardsCalculator instance already exists');
            } else {
                console.error('❌ RewardsCalculator prerequisites not met!');
            }
        } else {
            console.log('⏭️ Skipping RewardsCalculator initialization (admin mode)');
        }

        // Initialize homepage UI components (homepage only)
        if (!this.isAdminPage) {
            // Initialize home page with contract manager awareness
            if (window.HomePage) {
                window.homePage = new window.HomePage();
                this.components.set('homePage', window.homePage);
                console.log('✅ Home Page initialized');
            }

            // Initialize staking modal
            if (window.StakingModalNew) {
                window.stakingModal = new window.StakingModalNew();
                this.components.set('stakingModal', window.stakingModal);
                console.log('✅ Staking Modal initialized');
            }

            // Initialize wallet popup
            if (window.WalletPopup && !window.walletPopup) {
                try {
                    window.walletPopup = new window.WalletPopup();
                    this.components.set('walletPopup', window.walletPopup);
                    console.log('✅ Wallet Popup initialized');
                } catch (error) {
                    console.error('❌ Failed to initialize WalletPopup:', error);
                }
            }
        } else {
            console.log('⏭️ Skipping homepage UI components initialization (admin mode)');
        }

        // Ensure wallet connection is properly set up
        this.setupWalletIntegration();

        // Set up wallet connection status monitoring
        this.setupWalletStatusMonitoring();
    }

    setupWalletIntegration() {
        // Ensure MetaMask detection works
        if (typeof window.ethereum !== 'undefined') {
            console.log('✅ MetaMask detected');

            // Add wallet detection to global scope for tests
            window.isMetaMaskAvailable = true;

            // Setup account change listeners
            if (window.ethereum.on) {
                window.ethereum.on('accountsChanged', (accounts) => {
                    console.log('Accounts changed:', accounts);
                    if (window.walletManager) {
                        if (accounts.length === 0) {
                            window.walletManager.disconnect?.();
                        } else {
                            window.walletManager.account = accounts[0];
                            window.walletManager.updateUI?.();
                        }
                    }
                });

                window.ethereum.on('chainChanged', (chainId) => {
                    console.log('Chain changed:', chainId);
                    if (window.notificationManager) {
                        window.notificationManager.info('Network Changed');
                    }
                });
            }
        } else {
            console.log('❌ MetaMask not detected');
            window.isMetaMaskAvailable = false;

            // For testing purposes, create a mock ethereum object
            if (window.location.href.includes('test') || window.location.href.includes('localhost')) {
                console.log('🧪 Creating mock MetaMask for testing...');
                window.ethereum = {
                    isMetaMask: true,
                    request: async (params) => {
                        if (params.method === 'eth_requestAccounts') {
                            return ['0x1234567890123456789012345678901234567890'];
                        } else if (params.method === 'eth_accounts') {
                            return ['0x1234567890123456789012345678901234567890'];
                        }
                        return [];
                    },
                    on: (event, callback) => {
                        console.log(`Mock MetaMask: Registered listener for ${event}`);
                    }
                };
                window.isMetaMaskAvailable = true;
                console.log('✅ Mock MetaMask created for testing');
            }
        }

        // Ensure connect button is properly set up
        const connectBtn = document.getElementById('connect-wallet-btn');
        if (connectBtn && window.walletManager) {
            // Remove any existing listeners
            connectBtn.replaceWith(connectBtn.cloneNode(true));
            const newConnectBtn = document.getElementById('connect-wallet-btn');

            newConnectBtn.addEventListener('click', async (e) => {
                console.log('Connect wallet button clicked');

                // Check if wallet is connected
                const isConnected = window.walletManager.isWalletConnected ?
                                  window.walletManager.isWalletConnected() :
                                  window.walletManager.isConnected ? window.walletManager.isConnected() : false;

                if (isConnected) {
                    // Show wallet popup for connected wallet
                    if (window.walletPopup) {
                        window.walletPopup.show(newConnectBtn);
                    } else {
                        console.warn('Wallet popup not available');
                    }
                } else {
                    // Connect wallet with enhanced protection against circuit breaker
                    try {
                        // Prevent rapid connection attempts
                        if (window.walletManager.isConnecting) {
                            console.log('Connection already in progress, please wait...');
                            if (window.notificationManager) {
                                window.notificationManager.info('Please wait for the current connection attempt to complete');
                            }
                            return;
                        }

                        // Check if MetaMask is available
                        if (!window.ethereum) {
                            console.error('MetaMask not available');
                            if (window.notificationManager) {
                                window.notificationManager.error('Please install MetaMask browser extension to connect your wallet');
                            }
                            return;
                        }

                        // Show connecting notification
                        if (window.notificationManager) {
                            window.notificationManager.info('Please approve the connection in MetaMask');
                        }

                        // Use safe MetaMask connection with circuit breaker protection
                        await window.walletManager.connectMetaMask();

                    } catch (error) {
                        console.error('Failed to connect wallet:', error);

                        // Show user-friendly error message
                        if (window.notificationManager) {
                            let errorMessage = error.message;

                            // Customize error messages for better UX
                            if (error.message.includes('circuit breaker')) {
                                errorMessage = 'MetaMask is temporarily busy. Please wait a moment and try again.';
                            } else if (error.message.includes('already processing')) {
                                errorMessage = 'MetaMask is processing another request. Please wait and try again.';
                            } else if (error.message.includes('cancelled')) {
                                errorMessage = 'Connection was cancelled. Click connect to try again.';
                            }

                            window.notificationManager.error(errorMessage);
                        }
                    }
                }
            });

            console.log('✅ Connect button event listener attached');

            // Initial button status update
            setTimeout(() => {
                this.updateConnectButtonStatus();
            }, 1000); // Wait 1 second for wallet manager to be fully ready
        }
    }

    setupWalletStatusMonitoring() {
        // Update connect button based on wallet connection status
        this.updateConnectButtonStatus();

        // Set up periodic status checking
        setInterval(() => {
            this.updateConnectButtonStatus();
        }, 2000); // Check every 2 seconds

        // Listen for wallet connection events
        document.addEventListener('walletConnected', (event) => {
            console.log('Wallet connected event received:', event.detail);
            this.updateConnectButtonStatus();
        });

        document.addEventListener('walletDisconnected', (event) => {
            console.log('Wallet disconnected event received');
            this.updateConnectButtonStatus();
        });

        console.log('✅ Wallet status monitoring set up');
    }

    updateConnectButtonStatus() {
        const connectBtn = document.getElementById('connect-wallet-btn');
        if (!connectBtn) return;

        try {
            // Check if wallet is connected
            const isConnected = window.walletManager &&
                              (window.walletManager.isWalletConnected ?
                               window.walletManager.isWalletConnected() :
                               window.walletManager.isConnected ? window.walletManager.isConnected() : false);

            if (isConnected && window.walletManager.address) {
                // Format address for display (first 6 + last 4 characters)
                const address = window.walletManager.address;
                const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

                // Update button text and style
                connectBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;">
                        <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                    </svg>
                    ${shortAddress}
                `;
                connectBtn.classList.add('connected');
                connectBtn.title = `Connected: ${address}`;

            } else {
                // Update button for disconnected state
                connectBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;">
                        <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                    </svg>
                    Connect Wallet
                `;
                connectBtn.classList.remove('connected');
                connectBtn.title = 'Connect your wallet';
            }

        } catch (error) {
            console.error('Error updating connect button status:', error);
        }
    }

    setupGlobalHandlers() {
        // Enhanced global error handler with SES lockdown protection
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);

            // Handle SES lockdown errors gracefully
            if (event.error && event.error.message && event.error.message.includes('SES')) {
                console.warn('SES lockdown detected, continuing with limited functionality');
                return true; // Prevent default error handling
            }

            // Use error handler if available
            if (window.errorHandler && window.errorHandler.handleError) {
                window.errorHandler.handleError(event.error, { context: 'global_error' });
            }

            // Handle specific MetaMask circuit breaker errors
            if (event.error && event.error.message && event.error.message.includes('circuit breaker')) {
                if (window.notificationManager) {
                    window.notificationManager.error(
                        'MetaMask is temporarily busy. Please wait a moment and try again.'
                    );
                }
                return true; // Prevent default error handling
            }

            // Generic error notification
            if (window.notificationManager) {
                window.notificationManager.error('An unexpected error occurred. Please try again.');
            }
        });

        // Enhanced unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);

            // Use error handler if available
            if (window.errorHandler && window.errorHandler.handleError) {
                window.errorHandler.handleError(event.reason, { context: 'unhandled_promise' });
            }

            // Handle specific MetaMask circuit breaker errors
            if (event.reason && event.reason.message) {
                if (event.reason.message.includes('circuit breaker')) {
                    if (window.notificationManager) {
                        window.notificationManager.error(
                            'MetaMask is temporarily overloaded. Please wait a moment and try again.'
                        );
                    }
                    event.preventDefault(); // Prevent console spam
                    return;
                } else if (event.reason.message.includes('already processing')) {
                    if (window.notificationManager) {
                        window.notificationManager.warning(
                            'MetaMask is processing another request. Please wait.'
                        );
                    }
                    event.preventDefault();
                    return;
                }
            }

            // Generic error notification
            if (window.notificationManager) {
                window.notificationManager.error('An unexpected error occurred. Please try again.');
            }
        });

        // Set up wallet connection event listeners for contract manager initialization
        this.setupContractManagerIntegration();
    }

    /**
     * Set up contract manager integration with wallet events
     */
    setupContractManagerIntegration() {
        // Listen for wallet connection events
        document.addEventListener('walletConnected', (event) => {
            console.log('🔗 Wallet connected event received:', event.detail);
            this.handleWalletConnection(event.detail);
        });

        document.addEventListener('walletDisconnected', async (event) => {
            console.log('🔌 Wallet disconnected event received');
            await this.handleWalletDisconnection();
        });
    }

    /**
     * Handle wallet connection and initialize contract manager
     */
    async handleWalletConnection(walletDetails) {
        try {
            console.log('🔄 Handling wallet connection and initializing contracts...');

            if (window.contractManager && window.walletManager) {
                // Check if wallet is on configured network before upgrading to wallet mode
                // Use chainId from event data to avoid timing issues
                const isOnRequiredNetwork = window.networkManager 
                    ? window.networkManager.isOnRequiredNetwork(walletDetails?.chainId) 
                    : false;
                
                if (!isOnRequiredNetwork) {
                    const networkName = window.CONFIG?.NETWORK?.NAME || 'configured network';
                    console.log(`📊 Wallet connected but not on ${networkName} - staying in read-only mode`);
                    console.log(`💡 ContractManager will upgrade when switched to ${networkName}`);
                    // Don't upgrade yet - stay in read-only mode
                    // User will see pools but not their personal data
                    return;
                }
                
                const provider = window.walletManager.provider;
                const signer = window.walletManager.signer;

                if (provider && signer) {
                    console.log('🔗 Upgrading ContractManager to wallet mode...');

                    if (window.contractManager.isReady()) {
                        // Already initialized in read-only mode, upgrade to wallet mode
                        await window.contractManager.upgradeToWalletMode(provider, signer);
                        console.log('✅ ContractManager upgraded to wallet mode');
                    } else {
                        // Initialize with wallet provider
                        await window.contractManager.initialize(provider, signer);
                        console.log('✅ ContractManager initialized with wallet');
                    }

                    // Dispatch event for components waiting for contract manager
                    document.dispatchEvent(new CustomEvent('contractManagerWalletReady', {
                        detail: { contractManager: window.contractManager }
                    }));
                } else {
                    console.warn('⚠️ Provider or signer not available from wallet manager');
                }
            }
        } catch (error) {
            console.error('❌ Failed to initialize contract manager:', error);

            // Dispatch error event
            document.dispatchEvent(new CustomEvent('contractManagerError', {
                detail: { error: error.message }
            }));
        }
    }

    /**
     * Handle wallet disconnection
     */
    async handleWalletDisconnection() {
        try {
            console.log('🔌 Handling wallet disconnection...');

            if (window.contractManager) {
                // Downgrade to read-only mode: recreate provider and contracts
                window.contractManager.signer = null;
            // Reinitialize ContractManager in read-only mode using configured RPCs
            await window.contractManager.initializeReadOnly();
                
                console.log('✅ ContractManager downgraded to read-only mode');
            }

            // Dispatch event for components
            document.dispatchEvent(new CustomEvent('contractManagerDisconnected'));
        } catch (error) {
            console.error('❌ Error during wallet disconnection:', error);
        }
    }

    async loadScript(src) {
        if (this.loadedScripts.has(src)) {
            return Promise.resolve();
        }

        // Adjust path if running from admin subdirectory
        const adjustedSrc = this.isAdminPage && src.startsWith('js/') ? `../${src}` : src;

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = adjustedSrc;
            script.async = true;

            script.onload = () => {
                this.loadedScripts.add(src);
                console.log(`✅ Loaded: ${src}`);
                resolve();
            };

            script.onerror = (error) => {
                console.error(`❌ Failed to load: ${src}`, error);
                reject(new Error(`Failed to load script: ${src}`));
            };

            document.head.appendChild(script);
        });
    }

    async loadCSS(href) {
        if (this.loadedScripts.has(href)) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;

            link.onload = () => {
                this.loadedScripts.add(href);
                console.log(`✅ Loaded CSS: ${href}`);
                resolve();
            };

            link.onerror = (error) => {
                console.error(`❌ Failed to load CSS: ${href}`, error);
                reject(new Error(`Failed to load CSS: ${href}`));
            };

            document.head.appendChild(link);
        });
    }

    handleInitializationError(error) {
        // Use standard notification manager
        if (window.notificationManager) {
            window.notificationManager.error(
                'System Initialization Failed',
                `${error.message || 'An unknown error occurred'}. Please refresh the page.`,
                { persistent: true }
            );
        } else {
            // Fallback to console and alert
            console.error('❌ System initialization failed:', error);
            alert(`Initialization Error: ${error.message}\n\nPlease refresh the page.`);
        }

        console.error('❌ System initialization failed:', error);
    }

    // Public API
    getComponent(name) {
        return this.components.get(name);
    }

    isSystemReady() {
        return this.isReady;
    }

    getLoadedComponents() {
        return Array.from(this.components.keys());
    }

    // Retry initialization without full page reload
    async retryInitialization() {
        console.log('🔄 Retrying system initialization...');

        // Reset initialization state
        this.isReady = false;
        this.initializationPromise = null;

        // Retry initialization
        try {
            await this.init();
            console.log('✅ System initialization retry successful');
        } catch (error) {
            console.error('❌ System initialization retry failed:', error);
            this.handleInitializationError(error);
        }
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    if (window.masterInitializer?.isReady) {
        console.log('⚠️ System already initialized, skipping...');
        return;
    }

    console.log('🚀 DOM loaded, starting system initialization...');
    window.masterInitializer = new MasterInitializer();

    try {
        await window.masterInitializer.init();
        console.log('✅ System initialization completed successfully');
    } catch (error) {
        console.error('❌ System initialization failed:', error);
        window.masterInitializer.handleInitializationError(error);
    }
});

// Export for global access
window.MasterInitializer = MasterInitializer;

// Provide backward compatibility
window.SystemInitializerNew = MasterInitializer;
