
(function(global) {
    'use strict';

    if (global.SystemInitializer || global.systemInitializer) {
        return;
    }

    class SystemInitializer {
        constructor() {
            this.initialized = false;
            this.initializing = false;
            this.loadedScripts = new Set();
            this.failedScripts = new Set();
            this.systemInstances = new Map();
            this.initializationPromise = null;
            
            // Script loading order with dependencies
            this.scriptOrder = [
                // Core utilities first
                { path: 'js/utils/constants.js', name: 'Constants', critical: true },
                { path: 'js/utils/helpers.js', name: 'Helpers', critical: true },
                
                // Base classes
                { path: 'js/core/base-component.js', name: 'BaseComponent', critical: true },
                
                // Core systems (order matters!)
                { path: 'js/core/error-handler.js', name: 'ErrorHandler', critical: true, instance: 'errorHandler' },
                { path: 'js/core/notification-manager.js', name: 'NotificationManager', critical: true, instance: 'notificationManager' },
                { path: 'js/core/theme-manager.js', name: 'ThemeManager', critical: false, instance: 'themeManager' },
                { path: 'js/core/state-manager.js', name: 'StateManager', critical: true, instance: 'stateManager' },
                { path: 'js/contracts/contract-manager.js', name: 'ContractManager', critical: true, instance: 'contractManager' },
                { path: 'js/core/data-fetcher.js', name: 'DataFetcher', critical: false, instance: 'dataFetcher' },
                { path: 'js/core/transaction-tracker.js', name: 'TransactionTracker', critical: false, instance: 'transactionTracker' },
                { path: 'js/core/event-manager.js', name: 'EventManager', critical: false, instance: 'eventManager' },
                
                // Wallet and Network Integration
                { path: 'js/wallet/network-manager.js', name: 'NetworkManager', critical: false, instance: 'networkManager' },
                { path: 'js/wallet/wallet-manager.js', name: 'WalletManager', critical: false, instance: 'walletManager' },

                // Component systems
                { path: 'js/core/component-registry.js', name: 'ComponentRegistry', critical: false, instance: 'componentRegistry' },
                { path: 'js/core/event-delegation.js', name: 'EventDelegation', critical: false, instance: 'eventDelegation' },
                { path: 'js/core/router.js', name: 'Router', critical: true, instance: 'router' },
                
                // UI Components
                { path: 'js/components/staking-modal.js', name: 'StakingModal', critical: false, instance: 'stakingModal' },
                
                // Page components
                { path: 'js/pages/home.js', name: 'HomePage', critical: true },
                { path: 'js/pages/admin.js', name: 'AdminPage', critical: false },

                // Main application
                { path: 'js/core/app.js', name: 'App', critical: true, instance: 'app' },

                // System manager last
                { path: 'js/core/system-manager.js', name: 'SystemManager', critical: true, instance: 'systemManager' }
            ];
            
            this.log('SystemInitializer created - ready for comprehensive initialization');
        }

        /**
         * Initialize the entire system
         */
        async initialize() {
            if (this.initialized) {
                this.log('System already initialized');
                return true;
            }

            if (this.initializing) {
                this.log('Initialization in progress, waiting...');
                return this.initializationPromise;
            }

            this.initializing = true;
            this.initializationPromise = this.performInitialization();
            
            return this.initializationPromise;
        }

        /**
         * Perform complete system initialization
         */
        async performInitialization() {
            try {
                this.log('🚀 Starting comprehensive system initialization...');
                
                // Step 1: Setup global error handling
                this.setupGlobalErrorHandling();
                
                // Step 2: Clear any existing problematic instances
                this.clearExistingInstances();
                
                // Step 3: Load all scripts in proper order
                await this.loadAllScripts();
                
                // Step 4: Initialize all system instances
                await this.initializeSystemInstances();
                
                // Step 5: Validate system health
                this.validateSystemHealth();
                
                // Step 6: Setup system monitoring
                this.setupSystemMonitoring();
                
                this.initialized = true;
                this.log('✅ System initialization completed successfully!');
                
                // Show success notification
                if (global.notificationManager) {
                    global.notificationManager.success('🎉 System initialized successfully!', {
                        duration: 3000,
                        title: 'Welcome to LP Staking'
                    });
                }
                
                return true;
                
            } catch (error) {
                this.log('❌ System initialization failed:', error);
                this.handleInitializationFailure(error);
                return false;
            } finally {
                this.initializing = false;
            }
        }

        /**
         * Setup global error handling
         */
        setupGlobalErrorHandling() {
            // Global error handler
            window.addEventListener('error', (event) => {
                this.log('Global error caught:', event.error);
                if (global.errorHandler) {
                    global.errorHandler.handleError(event.error, 'global');
                }
            });

            // Unhandled promise rejection handler
            window.addEventListener('unhandledrejection', (event) => {
                this.log('Unhandled promise rejection:', event.reason);
                if (global.errorHandler) {
                    global.errorHandler.handleError(event.reason, 'promise');
                }
                event.preventDefault();
            });

            this.log('Global error handling setup complete');
        }

        /**
         * Clear existing instances to prevent conflicts
         */
        clearExistingInstances() {
            this.log('🧹 Clearing existing instances...');
            
            const instanceNames = [
                'errorHandler', 'notificationManager', 'themeManager', 'stateManager',
                'contractManager', 'dataFetcher', 'transactionTracker', 'eventManager',
                'networkManager', 'walletManager', 'componentRegistry', 'eventDelegation',
                'router', 'stakingModal', 'app', 'systemManager'
            ];
            
            instanceNames.forEach(name => {
                if (global[name]) {
                    this.log(`Clearing existing ${name}`);
                    try {
                        if (typeof global[name].cleanup === 'function') {
                            global[name].cleanup();
                        }
                        if (typeof global[name].destroy === 'function') {
                            global[name].destroy();
                        }
                    } catch (error) {
                        this.log(`Error cleaning up ${name}:`, error);
                    }
                    global[name] = null;
                    delete global[name];
                }
            });
            
            // Clear conflicting stylesheets
            const conflictingStyles = [
                'error-handler-styles', 'notification-styles', 'theme-styles',
                'staking-modal-styles', 'component-styles'
            ];
            
            conflictingStyles.forEach(styleId => {
                const existing = document.getElementById(styleId);
                if (existing) {
                    existing.remove();
                }
            });
        }

        /**
         * Load all scripts in proper order
         */
        async loadAllScripts() {
            this.log('📦 Loading all scripts...');
            
            for (const script of this.scriptOrder) {
                try {
                    await this.loadScript(script);
                    this.loadedScripts.add(script.name);
                } catch (error) {
                    this.log(`❌ Failed to load ${script.name}:`, error);
                    this.failedScripts.add(script.name);
                    
                    if (script.critical) {
                        throw new Error(`Critical script ${script.name} failed to load: ${error.message}`);
                    }
                }
            }
            
            this.log(`✅ Script loading complete. Loaded: ${this.loadedScripts.size}, Failed: ${this.failedScripts.size}`);
        }

        /**
         * Load individual script
         */
        async loadScript(scriptConfig) {
            return new Promise((resolve, reject) => {
                // Check if script already exists
                const existingScript = document.querySelector(`script[src*="${scriptConfig.path}"]`);
                if (existingScript) {
                    this.log(`Script ${scriptConfig.name} already loaded`);
                    resolve();
                    return;
                }

                const script = document.createElement('script');
                script.src = scriptConfig.path;
                script.async = false; // Maintain order
                
                script.onload = () => {
                    this.log(`✅ Loaded: ${scriptConfig.name}`);
                    resolve();
                };
                
                script.onerror = (error) => {
                    this.log(`❌ Failed to load: ${scriptConfig.name}`);
                    reject(new Error(`Script load failed: ${scriptConfig.path}`));
                };
                
                document.head.appendChild(script);
            });
        }

        /**
         * Initialize all system instances
         */
        async initializeSystemInstances() {
            this.log('🔧 Initializing system instances...');
            
            const instanceConfigs = this.scriptOrder.filter(script => script.instance);
            
            for (const config of instanceConfigs) {
                try {
                    await this.initializeInstance(config);
                } catch (error) {
                    this.log(`❌ Failed to initialize ${config.name}:`, error);
                    
                    if (config.critical) {
                        throw new Error(`Critical instance ${config.name} failed to initialize: ${error.message}`);
                    }
                }
            }
            
            this.log('✅ System instance initialization complete');
        }

        /**
         * Initialize individual instance
         */
        async initializeInstance(config) {
            const className = config.name;
            const instanceName = config.instance;
            
            // Check if class exists
            if (!global[className]) {
                throw new Error(`Class ${className} not found`);
            }
            
            // Check if instance already exists
            if (global[instanceName]) {
                this.log(`Instance ${instanceName} already exists, skipping`);
                return;
            }
            
            // Create instance
            this.log(`Creating instance: ${instanceName}`);
            const instance = new global[className]();
            global[instanceName] = instance;
            
            // Initialize if method exists
            if (typeof instance.initialize === 'function') {
                this.log(`Initializing: ${instanceName}`);
                await instance.initialize();
            }
            
            this.systemInstances.set(instanceName, instance);
            this.log(`✅ ${instanceName} initialized successfully`);
        }

        /**
         * Validate system health
         */
        validateSystemHealth() {
            this.log('🔍 Validating system health...');
            
            const criticalSystems = [
                'errorHandler', 'notificationManager', 'stateManager', 'contractManager', 'router', 'app'
            ];
            
            const healthReport = {
                healthy: [],
                unhealthy: [],
                missing: []
            };
            
            criticalSystems.forEach(systemName => {
                if (!global[systemName]) {
                    healthReport.missing.push(systemName);
                } else if (typeof global[systemName].isHealthy === 'function') {
                    if (global[systemName].isHealthy()) {
                        healthReport.healthy.push(systemName);
                    } else {
                        healthReport.unhealthy.push(systemName);
                    }
                } else {
                    healthReport.healthy.push(systemName);
                }
            });
            
            this.log('System health report:', healthReport);
            
            if (healthReport.missing.length > 0 || healthReport.unhealthy.length > 0) {
                throw new Error(`System health check failed. Missing: ${healthReport.missing.join(', ')}, Unhealthy: ${healthReport.unhealthy.join(', ')}`);
            }
            
            this.log('✅ System health validation passed');
        }

        /**
         * Setup system monitoring
         */
        setupSystemMonitoring() {
            this.log('📊 Setting up system monitoring...');
            
            // Monitor for memory leaks
            setInterval(() => {
                if (performance.memory) {
                    const memoryInfo = {
                        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
                    };
                    
                    if (memoryInfo.used > memoryInfo.limit * 0.8) {
                        this.log('⚠️ High memory usage detected:', memoryInfo);
                    }
                }
            }, 30000); // Check every 30 seconds
            
            this.log('✅ System monitoring setup complete');
        }

        /**
         * Handle initialization failure
         */
        handleInitializationFailure(error) {
            this.log('💥 Handling initialization failure:', error);
            
            // Show error notification if possible
            if (global.notificationManager) {
                global.notificationManager.error('System initialization failed. Please refresh the page.', {
                    duration: 0, // Persistent
                    title: 'Initialization Error'
                });
            } else {
                // Fallback to alert
                alert('System initialization failed. Please refresh the page.');
            }
            
            // Set up basic error recovery
            this.setupErrorRecovery();
        }

        /**
         * Setup error recovery mechanisms
         */
        setupErrorRecovery() {
            this.log('🔧 Setting up error recovery...');
            
            // Add retry button to page
            const retryButton = document.createElement('button');
            retryButton.textContent = 'Retry Initialization';
            retryButton.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                padding: 12px 24px;
                background: #f44336;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: bold;
            `;
            
            retryButton.addEventListener('click', () => {
                console.log('🔄 Retrying initialization without page reload...');
                retryButton.remove();
                this.retryInitialization();
            });
            
            document.body.appendChild(retryButton);
        }

        /**
         * Retry initialization without page reload
         */
        async retryInitialization() {
            this.log('🔄 Retrying system initialization...');

            // Reset state
            this.initialized = false;
            this.initializing = false;
            this.errors = [];

            // Clear any error displays
            const errorElements = document.querySelectorAll('[id*="error"], [class*="error"]');
            errorElements.forEach(el => {
                if (el.textContent.includes('initialization') || el.textContent.includes('failed')) {
                    el.remove();
                }
            });

            // Retry initialization
            try {
                await this.initialize();
                this.log('✅ System initialization retry successful');
            } catch (error) {
                this.log('❌ System initialization retry failed:', error);
                this.handleInitializationError(error);
            }
        }

        /**
         * Get system status
         */
        getSystemStatus() {
            return {
                initialized: this.initialized,
                initializing: this.initializing,
                loadedScripts: Array.from(this.loadedScripts),
                failedScripts: Array.from(this.failedScripts),
                systemInstances: Array.from(this.systemInstances.keys())
            };
        }

        /**
         * Logging utility
         */
        log(...args) {
            console.log('[SystemInitializer]', ...args);
        }
    }

    // Create and export SystemInitializer
    global.SystemInitializer = SystemInitializer;
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
            const initializer = new SystemInitializer();
            global.systemInitializer = initializer;
            await initializer.initialize();
        });
    } else {
        // DOM already loaded
        const initializer = new SystemInitializer();
        global.systemInitializer = initializer;
        initializer.initialize();
    }

    console.log('✅ SystemInitializer loaded and ready');

})(window);
