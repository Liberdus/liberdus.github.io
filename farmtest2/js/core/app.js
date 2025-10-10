
(function(global) {
    'use strict';

    if (global.App) {
        return;
    }

class App {
    constructor() {
        this.isInitialized = false;
        this.components = new Map();
        this.eventListeners = [];
        
        this.init();
    }


    async init() {
        try {
            this.log('Initializing LP Staking Platform...');
            this.showLoadingScreen();
            const systemsInitialized = await this.initializeCoreSystemsWithManager();
            if (!systemsInitialized) {
                this.log('Core systems initialization had issues, but continuing with fallbacks');
            }
            this.setupGlobalEventListeners();

            // Initialize theme
            this.initializeTheme();

            // Set up routes with error handling
            this.setupRoutes();

            // Initialize wallet connection check with error handling
            await this.initializeWallet();

            // Initialize network management
            this.initializeNetwork();

            // Initialize UI components
            this.initializeUIComponents();

            // Hide loading screen
            setTimeout(() => {
                this.hideLoadingScreen();
            }, window.CONFIG?.UI?.LOADING_DELAY || 2000);

            this.isInitialized = true;
            this.log('✅ Application initialized successfully with all critical fixes applied');

            // Show success notification
            if (window.notificationManager) {
                window.notificationManager.success('LP Staking Platform ready!', { duration: 3000 });
            }

        } catch (error) {
            this.logError('❌ Failed to initialize application:', error);
            this.showInitializationError(error);
        }
    }

    /**
     * CRITICAL FIX: Initialize core systems using SystemManager
     */
    async initializeCoreSystemsWithManager() {
        this.log('🔧 Initializing core systems with SystemManager...');

        // Check if SystemManager is available
        if (!window.systemManager) {
            this.logError('SystemManager not available - creating emergency fallback');
            await this.createEmergencyFallbacks();
            return false;
        }

        try {
            // Initialize all core systems with comprehensive error handling
            const success = await window.systemManager.initialize();

            if (!success) {
                const status = window.systemManager.getSystemStatus();
                this.logError('SystemManager initialization had issues:', status);
                this.log('⚠️ Continuing with available systems and fallbacks');
            }

            // Validate configuration
            if (!window.CONFIG) {
                this.log('⚠️ Configuration not loaded, using defaults');
            }

            // Validate critical systems are available
            this.validateCriticalSystems();

            this.log('✅ Core systems initialized via SystemManager');
            return true;

        } catch (error) {
            this.logError('❌ SystemManager initialization failed:', error);
            await this.createEmergencyFallbacks();
            return false;
        }
    }

    /**
     * CRITICAL FIX: Create emergency fallbacks if SystemManager fails
     */
    async createEmergencyFallbacks() {
        this.log('🚨 Creating emergency fallbacks for critical systems...');

        // Create minimal ErrorHandler
        if (!window.errorHandler) {
            window.errorHandler = {
                processError: (error, context = {}) => {
                    console.error('Emergency ErrorHandler:', error, context);
                    return { category: 'unknown', severity: 'high' };
                }
            };
        }

        // Create minimal NotificationManager
        if (!window.notificationManager) {
            window.notificationManager = {
                success: (msg) => console.log('SUCCESS:', msg),
                error: (msg) => console.error('ERROR:', msg),
                warning: (msg) => console.warn('WARNING:', msg),
                info: (msg) => console.info('INFO:', msg),
                show: (msg, type) => console.log(`${type.toUpperCase()}:`, msg)
            };
        }

        // Create minimal StateManager
        if (!window.stateManager) {
            const state = {};
            window.stateManager = {
                get: (path) => state[path],
                set: (path, value) => { state[path] = value; },
                subscribe: () => () => {}
            };
        }

        // Create minimal Router
        if (!window.router) {
            window.router = {
                navigate: (path) => { window.location.hash = path; },
                getCurrentRoute: () => window.location.hash.slice(1) || '/',
                addRoute: () => {},
                handleNotFound: (path) => {
                    const container = document.getElementById('app-content');
                    if (container) {
                        container.innerHTML = `<div style="text-align: center; padding: 2rem;"><h1>Page Not Found</h1><p>Path: ${path}</p></div>`;
                    }
                },
                handleRouteError: (error) => {
                    console.error('Router error:', error);
                    if (window.notificationManager) {
                        window.notificationManager.error('Navigation error occurred');
                    }
                }
            };
        }

        this.log('⚠️ Emergency fallbacks created');
    }

    /**
     * Validate critical systems are available
     */
    validateCriticalSystems() {
        const criticalSystems = ['errorHandler', 'notificationManager', 'stateManager', 'router'];
        const missingSystems = criticalSystems.filter(system => !window[system]);

        if (missingSystems.length > 0) {
            this.logError('Missing critical systems:', missingSystems);
        } else {
            this.log('✅ All critical systems validated');
        }
    }

    /**
     * Set up global event listeners
     */
    setupGlobalEventListeners() {
        // Theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            this.addEventListener(themeToggle, 'click', () => {
                this.toggleTheme();
            });
        }
        
        // Connect wallet button
        const connectWalletBtn = document.getElementById('connect-wallet-btn');
        if (connectWalletBtn) {
            this.addEventListener(connectWalletBtn, 'click', () => {
                this.handleWalletConnect();
            });
        }
        
        // Network warning buttons
        const switchNetworkBtn = document.getElementById('switch-network-btn');
        if (switchNetworkBtn) {
            this.addEventListener(switchNetworkBtn, 'click', () => {
                this.handleNetworkSwitch();
            });
        }
        
        const dismissWarningBtn = document.getElementById('dismiss-warning-btn');
        if (dismissWarningBtn) {
            this.addEventListener(dismissWarningBtn, 'click', () => {
                this.dismissNetworkWarning();
            });
        }
        
        // Global error handling
        window.addEventListener('error', (event) => {
            this.handleGlobalError(event.error);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            this.handleGlobalError(event.reason);
        });
        
        // Set up mobile support for in-development tooltips
        this.setupInDevelopmentMobileSupport();
        
        this.log('Global event listeners set up');
    }

    /**
     * Set up mobile support for in-development tooltips
     */
    setupInDevelopmentMobileSupport() {
        // Add touch support for mobile devices
        document.addEventListener('touchstart', (e) => {
            const target = e.target.closest('.in-development');
            if (target) {
                // Prevent default action
                e.preventDefault();
                
                // Remove previous mobile-tapped classes
                document.querySelectorAll('.in-development.mobile-tapped').forEach(el => {
                    el.classList.remove('mobile-tapped');
                });
                
                // Add mobile-tapped class to show tooltip
                target.classList.add('mobile-tapped');
                
                // Remove after 3 seconds
                setTimeout(() => {
                    target.classList.remove('mobile-tapped');
                }, 3000);
                
                // Show notification for better mobile UX
                const message = target.getAttribute('data-dev-message') || 'This feature is in development';
                if (window.notificationManager) {
                    window.notificationManager.info('In Development', message);
                }
            }
        });
        
        // Handle clicks on in-development items
        document.addEventListener('click', (e) => {
            const target = e.target.closest('.in-development');
            if (target) {
                e.preventDefault();
                e.stopPropagation();
                
                const message = target.getAttribute('data-dev-message') || 'This feature is in development';
                if (window.notificationManager) {
                    window.notificationManager.info('In Development', message);
                }
                
                // Add shake animation
                target.classList.add('shake');
                setTimeout(() => {
                    target.classList.remove('shake');
                }, 500);
            }
        });
        
        this.log('In-development mobile support initialized');
    }

    /**
     * Initialize theme system
     */
    initializeTheme() {
        // Get saved theme or default
        const savedTheme = localStorage.getItem(window.CONFIG.UI.THEME_STORAGE_KEY) || 'light';
        this.setTheme(savedTheme);
        
        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this.addEventListener(mediaQuery, 'change', (e) => {
            if (window.stateManager.get('ui.theme') === 'auto') {
                this.updateThemeDisplay();
            }
        });
        
        this.log('Theme system initialized');
    }

    /**
     * Set up application routes
     */
    setupRoutes() {
        // Home page
        window.router.register('/', HomePage, {
            title: 'LP Staking Platform - Home'
        });
        
        // Admin page
        window.router.register('/admin', AdminPage, {
            title: 'LP Staking Platform - Admin',
            requiresAuth: true,
            requiresAdmin: true
        });
        
        this.log('Routes registered');
    }

    /**
     * Initialize wallet connection
     */
    async initializeWallet() {
        try {
            // Check for previous connection
            if (window.walletManager) {
                await window.walletManager.checkPreviousConnection();

                // Update UI based on current connection state
                if (window.walletManager.isConnected()) {
                    const walletData = {
                        address: window.walletManager.getAddress(),
                        walletType: window.walletManager.getWalletType(),
                        chainId: window.walletManager.getChainId()
                    };
                    this.updateWalletUI(walletData);
                    this.updateMainContent(walletData);
                } else {
                    this.updateWalletUI(null);
                    this.updateMainContent(null);
                }

                // Subscribe to wallet events
                window.walletManager.subscribe((event, data) => {
                    this.handleWalletEvent(event, data);
                });
            }
        } catch (error) {
            this.logError('Wallet initialization error:', error);
        }
    }

    /**
     * Initialize UI components
     */
    initializeUIComponents() {
        try {
            // Create StakingModal instance
            if (window.StakingModal && !window.stakingModal) {
                window.stakingModal = new window.StakingModal();
                this.log('StakingModal instance created');
            }

            // Initialize other UI components as needed
            this.log('UI components initialized');
        } catch (error) {
            this.logError('Failed to initialize UI components:', error);
        }
    }

    /**
     * Initialize network management
     */
    initializeNetwork() {
        if (window.networkManager) {
            // Subscribe to network events
            window.networkManager.subscribe((event, data) => {
                this.handleNetworkEvent(event, data);
            });
            
            // Initial network check
            window.networkManager.updateNetworkWarning();
        }
    }

    /**
     * Handle wallet events
     */
    handleWalletEvent(event, data) {
        switch (event) {
            case 'connected':
                this.updateWalletUI(data);
                this.updateMainContent(data); // Add main content update
                window.notificationManager.success(
                    'Wallet Connected',
                    `Connected to ${data.address.slice(0, 6)}...${data.address.slice(-4)}`
                );
                break;

            case 'disconnected':
                this.updateWalletUI(null);
                this.updateMainContent(null); // Add main content update
                window.notificationManager.info('Wallet Disconnected', 'Your wallet has been disconnected');
                break;

            case 'accountChanged':
                this.updateWalletUI(data);
                this.updateMainContent(data); // Add main content update
                window.notificationManager.info('Account Changed', 'Wallet account has been changed');
                break;

            case 'chainChanged':
                window.notificationManager.info('Network Changed', 'Network has been changed');
                break;
        }
    }

    /**
     * Handle network events
     */
    handleNetworkEvent(event, data) {
        switch (event) {
            case 'networkChanged':
                if (!data.isCorrect) {
                    window.notificationManager.warning(
                        'Wrong Network',
                        'Please switch to the correct network'
                    );
                }
                break;
        }
    }

    /**
     * Update wallet UI
     */
    updateWalletUI(walletData) {
        const connectBtn = document.getElementById('connect-wallet-btn');
        if (!connectBtn) return;
        
        if (walletData) {
            // Connected state
            connectBtn.innerHTML = `
                <span class="wallet-icon">👛</span>
                <span class="wallet-text">${walletData.address.slice(0, 6)}...${walletData.address.slice(-4)}</span>
            `;
            connectBtn.classList.add('connected');
        } else {
            // Disconnected state
            connectBtn.innerHTML = `
                <span class="wallet-icon">👛</span>
                <span class="wallet-text">Connect Wallet</span>
            `;
            connectBtn.classList.remove('connected');
        }
    }

    /**
     * Update main content based on wallet connection state
     */
    updateMainContent(walletData) {
        const appContent = document.getElementById('app-content');
        if (!appContent) {
            console.error('app-content container not found');
            return;
        }

        if (walletData && walletData.address) {
            // Connected state - show staking interface
            this.showStakingInterface(walletData);
        } else {
            // Disconnected state - show welcome message
            this.showWelcomeMessage();
        }
    }

    /**
     * Show Liberdus welcome message for disconnected users
     */
    showWelcomeMessage() {
        const appContent = document.getElementById('app-content');
        if (!appContent) return;

        appContent.innerHTML = `
            <div class="liberdus-container">
                <div class="liberdus-main">
                    <div class="welcome-section">
                        <div class="welcome-header">
                            <h1 class="welcome-title">LP Staking</h1>
                            <p class="welcome-subtitle">Connect your wallet to start earning rewards on your liquidity provider tokens.</p>
                        </div>

                        <div class="connect-prompt">
                            <div class="connect-card">
                                <div class="connect-icon">👛</div>
                                <h2>Connect Wallet to Get Started</h2>
                                <p>Access your LP staking dashboard and start earning rewards</p>
                                <button onclick="window.app.handleWalletConnect()" class="connect-cta-btn">
                                    <span class="btn-icon">🔗</span>
                                    Connect Wallet
                                </button>
                            </div>
                        </div>

                        <div class="features-preview">
                            <div class="feature-item">
                                <span class="feature-icon">💰</span>
                                <span class="feature-text">Earn Rewards</span>
                            </div>
                            <div class="feature-item">
                                <span class="feature-icon">🔒</span>
                                <span class="feature-text">Secure Staking</span>
                            </div>
                            <div class="feature-item">
                                <span class="feature-icon">📊</span>
                                <span class="feature-text">Real-time APR</span>
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="liberdus-footer">
                        <div class="footer-content">
                            <span class="copyright">© 2024 Liberdus LP Stake. All rights reserved.</span>
                            <div class="social-links">
                                <a href="#" class="social-link">📱</a>
                                <a href="#" class="social-link">🐦</a>
                                <a href="#" class="social-link">💬</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Show Liberdus LP Staking interface - Exact Design Match
     */
    showStakingInterface(walletData) {
        const appContent = document.getElementById('app-content');
        if (!appContent) return;

        appContent.innerHTML = `
            <div class="liberdus-container">
                <div class="liberdus-main">
                    <!-- LP Staking Header -->
                    <div class="lp-staking-header">
                        <h1 class="lp-title">LP Staking</h1>
                        <div class="reward-rate-info">
                            <span class="rate-icon">⏰</span>
                            <span class="rate-text">Hourly Reward Rate: 0.00 LIB</span>
                            <button class="refresh-btn">🔄</button>
                        </div>
                    </div>

                    <!-- LP Staking Table -->
                    <div class="lp-staking-table">
                        <div class="table-header">
                            <div class="header-cell pair-header">
                                <span class="header-icon">🔗</span>
                                <span>Pair</span>
                            </div>
                            <div class="header-cell platform-header">
                                <span class="header-icon">🏛️</span>
                                <span>Platform</span>
                            </div>
                            <div class="header-cell apr-header">
                                <span class="header-icon">📈</span>
                                <span>Est. APR</span>
                            </div>
                            <div class="header-cell weight-header">
                                <span class="header-icon">⚖️</span>
                                <span>Reward Weight</span>
                            </div>
                            <div class="header-cell tvl-header">
                                <span class="header-icon">💰</span>
                                <span>TVL</span>
                            </div>
                            <div class="header-cell share-header">
                                <span class="header-icon">📊</span>
                                <span>My Pool Share</span>
                            </div>
                            <div class="header-cell earnings-header">
                                <span class="header-icon">💎</span>
                                <span>My Earnings</span>
                            </div>
                        </div>

                        <div class="table-body">
                            <!-- LIB-USDT Row -->
                            <div class="table-row">
                                <div class="cell pair-cell">
                                    <div class="pair-info">
                                        <span class="pair-name">LIB-USDT</span>
                                        <span class="pair-link">🔗</span>
                                    </div>
                                </div>
                                <div class="cell platform-cell">
                                    <span class="platform-badge uniswap">Uniswap V2</span>
                                </div>
                                <div class="cell apr-cell">
                                    <span class="apr-value">0.0%</span>
                                </div>
                                <div class="cell weight-cell">
                                    <span class="weight-badge high">70 (100.00%)</span>
                                </div>
                                <div class="cell tvl-cell">
                                    <span class="tvl-value">0.00</span>
                                </div>
                                <div class="cell share-cell">
                                    <span class="share-badge">0.00%</span>
                                </div>
                                <div class="cell earnings-cell">
                                    <span class="earnings-badge">0.0000 LIB</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="liberdus-footer">
                        <div class="footer-content">
                            <span class="copyright">© 2024 Liberdus LP Stake. All rights reserved.</span>
                            <div class="social-links">
                                <a href="#" class="social-link">📱</a>
                                <a href="#" class="social-link">🐦</a>
                                <a href="#" class="social-link">💬</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Handle wallet connect button click
     */
    async handleWalletConnect() {
        if (!window.walletManager) return;

        try {
            if (window.walletManager.isConnected()) {
                // Show disconnect option or wallet info
                this.showWalletMenu();
            } else {
                // Show wallet selection modal
                this.showWalletSelectionModal();
            }
        } catch (error) {
            window.ErrorHandler.handleWalletError(error);
        }
    }

    /**
     * Handle network switch
     */
    async handleNetworkSwitch() {
        if (!window.networkManager) return;
        
        try {
            await window.networkManager.switchToDefaultNetwork();
            window.notificationManager.success('Network Switched', 'Successfully switched to the correct network');
        } catch (error) {
            window.ErrorHandler.handleNetworkError(error);
        }
    }

    /**
     * Dismiss network warning
     */
    dismissNetworkWarning() {
        const warning = document.getElementById('network-warning');
        if (warning) {
            warning.style.display = 'none';
        }
    }

    /**
     * Show wallet selection modal
     */
    showWalletSelectionModal() {
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;

        const modalHTML = `
            <div class="modal-backdrop" id="wallet-modal-backdrop">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">Connect Wallet</h2>
                        <button class="modal-close" id="close-wallet-modal">×</button>
                    </div>
                    <div class="modal-body">
                        <p class="text-secondary mb-6">Choose your preferred wallet to connect to the LP Staking Platform.</p>

                        <div class="wallet-options">
                            <button class="wallet-option" id="connect-metamask">
                                <div class="wallet-icon">🦊</div>
                                <div class="wallet-info">
                                    <h3>MetaMask</h3>
                                    <p>Connect using browser extension</p>
                                </div>
                                <div class="wallet-arrow">→</div>
                            </button>

                            <button class="wallet-option" id="connect-walletconnect">
                                <div class="wallet-icon">📱</div>
                                <div class="wallet-info">
                                    <h3>WalletConnect</h3>
                                    <p>Connect using mobile wallet</p>
                                </div>
                                <div class="wallet-arrow">→</div>
                            </button>
                        </div>

                        <div class="wallet-help">
                            <p class="text-sm text-tertiary">
                                Don't have a wallet?
                                <a href="https://metamask.io" target="_blank" rel="noopener">Get MetaMask</a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        modalContainer.innerHTML = modalHTML;
        modalContainer.style.display = 'block';

        // Add event listeners
        const closeBtn = document.getElementById('close-wallet-modal');
        const backdrop = document.getElementById('wallet-modal-backdrop');
        const metamaskBtn = document.getElementById('connect-metamask');
        const walletconnectBtn = document.getElementById('connect-walletconnect');

        const closeModal = () => {
            modalContainer.style.display = 'none';
            modalContainer.innerHTML = '';
        };

        closeBtn?.addEventListener('click', closeModal);
        backdrop?.addEventListener('click', (e) => {
            if (e.target === backdrop) closeModal();
        });

        metamaskBtn?.addEventListener('click', async () => {
            closeModal();
            try {
                await window.walletManager.connectMetaMask();
            } catch (error) {
                window.ErrorHandler.handleWalletError(error);
            }
        });

        walletconnectBtn?.addEventListener('click', async () => {
            closeModal();
            try {
                await window.walletManager.connectWalletConnect();
            } catch (error) {
                window.ErrorHandler.handleWalletError(error);
            }
        });
    }

    /**
     * Show wallet menu for connected users
     */
    showWalletMenu() {
        const walletData = {
            address: window.walletManager.getAddress(),
            walletType: window.walletManager.getWalletType(),
            chainId: window.walletManager.getChainId()
        };

        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;

        const modalHTML = `
            <div class="modal-backdrop" id="wallet-menu-backdrop">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">Wallet Info</h2>
                        <button class="modal-close" id="close-wallet-menu">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="wallet-info-card">
                            <div class="wallet-type">
                                <span class="wallet-icon">${walletData.walletType === 'metamask' ? '🦊' : '📱'}</span>
                                <span class="wallet-name">${walletData.walletType === 'metamask' ? 'MetaMask' : 'WalletConnect'}</span>
                            </div>

                            <div class="wallet-address">
                                <label>Address:</label>
                                <div class="address-display">
                                    <span class="address">${window.Formatter?.formatAddress(walletData.address) || walletData.address}</span>
                                    <button class="btn btn-small btn-ghost copy-address" data-address="${walletData.address}">
                                        📋 Copy
                                    </button>
                                </div>
                            </div>

                            <div class="wallet-network">
                                <label>Network:</label>
                                <span class="network-name">${window.networkManager?.getCurrentNetworkInfo()?.name || 'Unknown'}</span>
                            </div>
                        </div>

                        <div class="wallet-actions">
                            <button class="btn btn-error btn-full" id="disconnect-wallet">
                                Disconnect Wallet
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        modalContainer.innerHTML = modalHTML;
        modalContainer.style.display = 'block';

        // Add event listeners
        const closeBtn = document.getElementById('close-wallet-menu');
        const backdrop = document.getElementById('wallet-menu-backdrop');
        const disconnectBtn = document.getElementById('disconnect-wallet');
        const copyBtn = document.querySelector('.copy-address');

        const closeModal = () => {
            modalContainer.style.display = 'none';
            modalContainer.innerHTML = '';
        };

        closeBtn?.addEventListener('click', closeModal);
        backdrop?.addEventListener('click', (e) => {
            if (e.target === backdrop) closeModal();
        });

        disconnectBtn?.addEventListener('click', async () => {
            closeModal();
            try {
                await window.walletManager.disconnect();
            } catch (error) {
                window.ErrorHandler.handleWalletError(error);
            }
        });

        copyBtn?.addEventListener('click', async (e) => {
            const address = e.target.getAttribute('data-address');
            try {
                await navigator.clipboard.writeText(address);
                window.notificationManager?.success('Copied!', 'Address copied to clipboard');
            } catch (error) {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = address;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                window.notificationManager?.success('Copied!', 'Address copied to clipboard');
            }
        });
    }

    /**
     * Toggle theme
     */
    toggleTheme() {
        // Theme system is part of Day 10 advanced UI features
        if (window.notificationManager) {
            window.notificationManager.info('Coming Soon', 'Advanced theme system will be implemented in Day 10');
        }
        console.log('Theme toggle clicked - feature coming in Day 10');
    }

    /**
     * Set theme
     */
    setTheme(theme) {
        window.stateManager.set('ui.theme', theme);
        this.updateThemeDisplay();
        
        // Update theme toggle button
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('.theme-icon');
            if (icon) {
                icon.textContent = theme === 'light' ? '🌙' : '☀️';
            }
        }
    }

    /**
     * Update theme display
     */
    updateThemeDisplay() {
        const theme = window.stateManager.get('ui.theme');
        document.documentElement.setAttribute('data-theme', theme);
    }

    /**
     * Show loading screen
     */
    showLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }
    }

    /**
     * Hide loading screen
     */
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 300);
        }
    }

    /**
     * Show initialization error
     */
    showInitializationError(error) {
        this.hideLoadingScreen();
        
        const appContent = document.getElementById('app-content');
        if (appContent) {
            appContent.innerHTML = `
                <div class="container">
                    <div class="card" style="max-width: 500px; margin: 2rem auto;">
                        <div class="card-body text-center">
                            <h2>Initialization Error</h2>
                            <p>Failed to initialize the application. Please refresh the page and try again.</p>
                            <p class="text-sm text-secondary">${error.message}</p>
                            <button onclick="window.location.reload()" class="btn btn-primary">
                                Refresh Page
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Handle global errors
     */
    handleGlobalError(error) {
        this.logError('Global error:', error);
        
        if (window.notificationManager) {
            window.notificationManager.error(
                'Application Error',
                'An unexpected error occurred. Please refresh the page if the problem persists.'
            );
        }
    }

    /**
     * Add event listener with cleanup tracking
     */
    addEventListener(element, event, handler, options = {}) {
        element.addEventListener(event, handler, options);
        
        this.eventListeners.push({
            element,
            event,
            handler,
            options
        });
    }

    /**
     * Cleanup application
     */
    destroy() {
        // Clean up event listeners
        this.eventListeners.forEach(({ element, event, handler, options }) => {
            element.removeEventListener(event, handler, options);
        });
        this.eventListeners = [];
        
        // Destroy components
        this.components.forEach(component => {
            if (component && typeof component.destroy === 'function') {
                component.destroy();
            }
        });
        this.components.clear();
        
        this.log('Application destroyed');
    }

    /**
     * Logging utility
     */
    log(...args) {
        if (window.CONFIG.DEV.DEBUG_MODE) {
            console.log('[App]', ...args);
        }
    }

    /**
     * CRITICAL FIX: Create fallback ErrorHandler
     */
    createFallbackErrorHandler() {
        return {
            processError: (error, context = {}) => {
                console.error('Fallback ErrorHandler:', error, context);
                return { category: 'unknown', severity: 'medium', retryable: false };
            },
            handleError: (error) => console.error('Fallback error handling:', error)
        };
    }

    /**
     * CRITICAL FIX: Create fallback NotificationManager
     */
    createFallbackNotificationManager() {
        return {
            show: (message, type = 'info', options = {}) => {
                console.log(`Fallback Notification [${type.toUpperCase()}]:`, message);
                this.showFallbackToast(message, type, options);
            },
            success: function(message, options) { this.show(message, 'success', options); },
            error: function(message, options) { this.show(message, 'error', options); },
            warning: function(message, options) { this.show(message, 'warning', options); },
            info: function(message, options) { this.show(message, 'info', options); }
        };
    }

    /**
     * Show fallback toast notification
     */
    showFallbackToast(message, type, options = {}) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#007bff'};
            color: white; padding: 12px 20px; border-radius: 4px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 300px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, options.duration || 5000);
    }

    /**
     * CRITICAL FIX: Create fallback StateManager
     */
    createFallbackStateManager() {
        const state = {};
        return {
            get: (path) => {
                const keys = path.split('.');
                let current = state;
                for (const key of keys) {
                    if (current && typeof current === 'object') {
                        current = current[key];
                    } else {
                        return undefined;
                    }
                }
                return current;
            },
            set: (path, value) => {
                const keys = path.split('.');
                let current = state;
                for (let i = 0; i < keys.length - 1; i++) {
                    const key = keys[i];
                    if (!current[key] || typeof current[key] !== 'object') {
                        current[key] = {};
                    }
                    current = current[key];
                }
                current[keys[keys.length - 1]] = value;
                console.log(`Fallback StateManager set: ${path} =`, value);
            },
            subscribe: (path, callback) => {
                console.log(`Fallback StateManager subscribe: ${path}`);
                return () => console.log(`Fallback StateManager unsubscribe: ${path}`);
            }
        };
    }

    /**
     * CRITICAL FIX: Create fallback Router
     */
    createFallbackRouter() {
        return {
            navigate: (path) => {
                console.log('Fallback Router navigate:', path);
                window.location.hash = path;
            },
            getCurrentRoute: () => window.location.hash.slice(1) || '/',
            addRoute: (path, handler) => console.log('Fallback Router addRoute:', path),
            handleNotFound: (path) => {
                console.log('Fallback Router 404:', path);
                const container = document.getElementById('app-content');
                if (container) {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 3rem 1rem;">
                            <h1>Page Not Found</h1>
                            <p>The page "${path}" could not be found.</p>
                            <button onclick="window.location.hash = '/'" style="background: #007bff; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.375rem; cursor: pointer;">
                                Go Home
                            </button>
                        </div>
                    `;
                }
            },
            handleRouteError: (error, path) => {
                console.error('Fallback Router error:', error, path);
                if (window.notificationManager) {
                    window.notificationManager.error('Navigation failed. Please try again.');
                }
            }
        };
    }

    /**
     * Error logging utility
     */
    logError(...args) {
        console.error('[App]', ...args);
    }
}

    // Export App class to global scope
    global.App = App;

    // Initialize application when DOM is ready with proper guards
    document.addEventListener('DOMContentLoaded', () => {
        // Prevent multiple initialization
        if (global.app) {
            console.warn('App already initialized, skipping');
            return;
        }

        try {
            console.log('🚀 Initializing LP Staking Platform...');
            global.app = new App();
        } catch (error) {
            console.error('❌ Critical App initialization error:', error);

            // Show user-friendly error message
            const appContent = document.getElementById('app-content');
            if (appContent) {
                appContent.innerHTML = `
                    <div style="max-width: 600px; margin: 2rem auto; padding: 2rem; background: #fee; border: 1px solid #fcc; border-radius: 0.5rem; color: #c33;">
                        <h2 style="margin-top: 0;">⚠️ Application Initialization Error</h2>
                        <p><strong>Error:</strong> ${error.message}</p>
                        <p>Please refresh the page or contact support if the issue persists.</p>
                        <button onclick="window.location.reload()" style="background: #c33; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.25rem; cursor: pointer;">
                            🔄 Refresh Page
                        </button>
                    </div>
                `;
            }
        }
    });

})(window);
