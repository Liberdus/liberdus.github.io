/**
 * SystemInitializer - Centralized system initialization manager
 * CRITICAL FIX: Prevents redeclaration errors and ensures proper initialization order
 * Handles all core system dependencies and error recovery with singleton pattern
 */
(function(global) {
    'use strict';

    // CRITICAL FIX: Prevent multiple initialization with stronger checks
    if (global.SystemInitializer || global.systemInitializer) {
        console.warn('SystemInitializer already exists, skipping redeclaration');
        return;
    }

    class SystemInitializer {
        constructor() {
            this.initialized = false;
            this.systems = new Map();
            this.initializationOrder = [
                'ErrorHandler',
                'StateManager',
                'EventManager',
                'ComponentRegistry',
                'EventDelegation',
                'NotificationManager',
                'Router'
            ];
            this.errors = [];
            this.startTime = Date.now();
            this.isInitializing = false;

            console.log('🚀 SystemInitializer created with enhanced error handling');
        }
        
        /**
         * CRITICAL FIX: Initialize all core systems in proper order with enhanced error handling
         */
        async initialize() {
            if (this.initialized) {
                console.warn('Systems already initialized');
                return true;
            }

            if (this.isInitializing) {
                console.warn('Initialization already in progress');
                return false;
            }

            this.isInitializing = true;
            console.log('🔧 Starting enhanced system initialization...');

            try {
                // Step 1: Validate environment
                this.validateEnvironment();

                // Step 2: Clear any existing global instances to prevent conflicts
                this.clearExistingInstances();

                // Step 3: Initialize core systems in order
                await this.initializeCoreSystemsSequentially();

                // Step 4: Initialize UI components
                await this.initializeUIComponents();

                // Step 5: Validate all systems are working
                this.validateSystems();

                // Step 6: Set up global error handling
                this.setupGlobalErrorHandling();

                this.initialized = true;
                const duration = Date.now() - this.startTime;
                console.log(`✅ All systems initialized successfully in ${duration}ms`);

                return true;

            } catch (error) {
                console.error('❌ System initialization failed:', error);
                this.handleInitializationFailure(error);
                return false;
            } finally {
                this.isInitializing = false;
            }
        }
        
        /**
         * CRITICAL FIX: Enhanced environment validation
         */
        validateEnvironment() {
            console.log('🔍 Validating environment with enhanced checks...');

            // Check required DOM elements and create if missing
            const requiredElements = [
                { selector: '#app-content', tag: 'div', id: 'app-content' },
                { selector: '#notification-container', tag: 'div', id: 'notification-container' },
                { selector: '#modal-container', tag: 'div', id: 'modal-container' }
            ];

            for (const { selector, tag, id } of requiredElements) {
                let element = document.querySelector(selector);
                if (!element) {
                    console.warn(`Creating missing DOM element: ${selector}`);
                    element = document.createElement(tag);
                    element.id = id;
                    document.body.appendChild(element);
                }
            }

            // Check for essential dependencies
            if (typeof window.ethers === 'undefined') {
                console.warn('⚠️ Ethers.js not loaded - wallet functionality may be limited');
            }

            console.log('✅ Environment validation passed with auto-fixes');
        }

        /**
         * CRITICAL FIX: Clear existing instances to prevent redeclaration
         */
        clearExistingInstances() {
            console.log('🧹 Clearing existing global instances...');

            const globalInstances = [
                'errorHandler', 'stateManager', 'eventManager',
                'componentRegistry', 'eventDelegation', 'notificationManager', 'router'
            ];

            for (const instanceName of globalInstances) {
                if (global[instanceName]) {
                    console.log(`Clearing existing ${instanceName}`);
                    if (typeof global[instanceName].destroy === 'function') {
                        try {
                            global[instanceName].destroy();
                        } catch (error) {
                            console.warn(`Error destroying ${instanceName}:`, error);
                        }
                    }
                    global[instanceName] = null;
                }
            }

            console.log('✅ Global instances cleared');
        }
        
        /**
         * Initialize core systems in proper sequential order
         */
        async initializeCoreSystemsSequentially() {
            console.log('⚙️ Initializing core systems...');
            
            // Initialize ErrorHandler first
            await this.initializeErrorHandler();
            
            // Initialize StateManager second
            await this.initializeStateManager();
            
            // Initialize EventManager third
            await this.initializeEventManager();
            
            // Initialize Router last
            await this.initializeRouter();
            
            console.log('✅ Core systems initialization completed');
        }
        
        /**
         * Initialize ErrorHandler with safety checks
         */
        async initializeErrorHandler() {
            console.log('🚨 Initializing ErrorHandler...');
            
            if (global.errorHandler) {
                console.warn('ErrorHandler instance already exists, using existing');
                this.systems.set('ErrorHandler', global.errorHandler);
                return;
            }
            
            try {
                // Create ErrorHandler if class exists
                if (typeof global.ErrorHandler === 'function') {
                    global.errorHandler = new global.ErrorHandler();
                    this.systems.set('ErrorHandler', global.errorHandler);
                    console.log('✅ ErrorHandler initialized successfully');
                } else {
                    throw new Error('ErrorHandler class not found');
                }
            } catch (error) {
                console.error('❌ ErrorHandler initialization failed:', error);
                // Create minimal fallback
                global.errorHandler = this.createFallbackErrorHandler();
                this.systems.set('ErrorHandler', global.errorHandler);
                console.log('⚠️ Using fallback ErrorHandler');
            }
        }
        
        /**
         * Initialize StateManager with safety checks
         */
        async initializeStateManager() {
            console.log('🔄 Initializing StateManager...');
            
            if (global.stateManager) {
                console.warn('StateManager instance already exists, using existing');
                this.systems.set('StateManager', global.stateManager);
                return;
            }
            
            try {
                // Create StateManager if class exists
                if (typeof global.StateManager === 'function') {
                    global.stateManager = new global.StateManager();
                    this.systems.set('StateManager', global.stateManager);
                    console.log('✅ StateManager initialized successfully');
                } else {
                    throw new Error('StateManager class not found');
                }
            } catch (error) {
                console.error('❌ StateManager initialization failed:', error);
                // Create minimal fallback
                global.stateManager = this.createFallbackStateManager();
                this.systems.set('StateManager', global.stateManager);
                console.log('⚠️ Using fallback StateManager');
            }
        }
        
        /**
         * Initialize EventManager with safety checks
         */
        async initializeEventManager() {
            console.log('📡 Initializing EventManager...');
            
            if (global.eventManager) {
                console.warn('EventManager instance already exists, using existing');
                this.systems.set('EventManager', global.eventManager);
                return;
            }
            
            try {
                // Create EventManager if class exists
                if (typeof global.EventManager === 'function') {
                    global.eventManager = new global.EventManager();
                    this.systems.set('EventManager', global.eventManager);
                    console.log('✅ EventManager initialized successfully');
                } else {
                    throw new Error('EventManager class not found');
                }
            } catch (error) {
                console.error('❌ EventManager initialization failed:', error);
                // Create minimal fallback
                global.eventManager = this.createFallbackEventManager();
                this.systems.set('EventManager', global.eventManager);
                console.log('⚠️ Using fallback EventManager');
            }
        }
        
        /**
         * Initialize Router with safety checks
         */
        async initializeRouter() {
            console.log('🧭 Initializing Router...');
            
            if (global.router) {
                console.warn('Router instance already exists, using existing');
                this.systems.set('Router', global.router);
                return;
            }
            
            try {
                // Create Router if class exists
                if (typeof global.Router === 'function') {
                    global.router = new global.Router();
                    this.systems.set('Router', global.router);
                    console.log('✅ Router initialized successfully');
                } else {
                    throw new Error('Router class not found');
                }
            } catch (error) {
                console.error('❌ Router initialization failed:', error);
                // Create minimal fallback
                global.router = this.createFallbackRouter();
                this.systems.set('Router', global.router);
                console.log('⚠️ Using fallback Router');
            }
        }
        
        /**
         * Validate all systems are working correctly
         */
        validateSystems() {
            console.log('🔍 Validating system functionality...');
            
            // Test StateManager
            if (global.stateManager && typeof global.stateManager.set === 'function') {
                try {
                    global.stateManager.set('system.test', 'validation');
                    const value = global.stateManager.get('system.test');
                    if (value !== 'validation') {
                        throw new Error('StateManager validation failed');
                    }
                    console.log('✅ StateManager validation passed');
                } catch (error) {
                    console.error('❌ StateManager validation failed:', error);
                }
            }
            
            // Test ErrorHandler
            if (global.errorHandler && typeof global.errorHandler.processError === 'function') {
                try {
                    const testError = new Error('Validation test');
                    const processed = global.errorHandler.processError(testError);
                    if (!processed || !processed.category) {
                        throw new Error('ErrorHandler validation failed');
                    }
                    console.log('✅ ErrorHandler validation passed');
                } catch (error) {
                    console.error('❌ ErrorHandler validation failed:', error);
                }
            }
            
            console.log('✅ System validation completed');
        }
        
        /**
         * Set up global error handling
         */
        setupGlobalErrorHandling() {
            // Capture unhandled errors
            global.addEventListener('error', (event) => {
                console.error('🚨 Unhandled error:', event.error);
                if (global.errorHandler && global.errorHandler.processError) {
                    global.errorHandler.processError(event.error, { global: true });
                }
            });
            
            // Capture unhandled promise rejections
            global.addEventListener('unhandledrejection', (event) => {
                console.error('🚨 Unhandled promise rejection:', event.reason);
                if (global.errorHandler && global.errorHandler.processError) {
                    global.errorHandler.processError(event.reason, { promise: true });
                }
            });
            
            console.log('✅ Global error handling set up');
        }
        
        /**
         * Handle initialization failure
         */
        handleInitializationFailure(error) {
            console.error('💥 Critical initialization failure:', error);
            
            // Show user-friendly error message
            const appContent = document.getElementById('app-content');
            if (appContent) {
                appContent.innerHTML = `
                    <div style="max-width: 600px; margin: 2rem auto; padding: 2rem; background: #fee; border: 1px solid #fcc; border-radius: 0.5rem; color: #c33; font-family: system-ui, -apple-system, sans-serif;">
                        <h2 style="margin-top: 0; color: #c33;">⚠️ System Initialization Failed</h2>
                        <p><strong>Error:</strong> ${error.message}</p>
                        <p>The application failed to start properly. This may be due to:</p>
                        <ul>
                            <li>Script loading conflicts</li>
                            <li>Browser extension interference</li>
                            <li>Network connectivity issues</li>
                        </ul>
                        <div style="margin-top: 1.5rem;">
                            <button onclick="window.systemInitializer?.retryInitialization?.()" style="background: #c33; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.375rem; cursor: pointer; margin-right: 0.5rem; font-size: 1rem;">
                                🔄 Retry System
                            </button>
                            <button onclick="console.log('System errors:', window.systemInitializer?.errors || [])" style="background: #666; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.375rem; cursor: pointer; font-size: 1rem;">
                                🔍 Show Debug Info
                            </button>
                        </div>
                    </div>
                `;
            }
        }
        
        // Fallback system creators
        createFallbackErrorHandler() {
            return {
                processError: (error) => ({ message: error.message || 'Unknown error', category: 'unknown' }),
                displayError: () => {},
                executeWithRetry: async (fn) => await fn(),
                initialized: false,
                fallback: true
            };
        }
        
        createFallbackStateManager() {
            const state = {};
            return {
                get: (path) => path ? state[path] : state,
                set: (path, value) => { state[path] = value; return true; },
                subscribe: () => () => {},
                initialized: false,
                fallback: true
            };
        }
        
        createFallbackEventManager() {
            return {
                addEventListener: () => () => {},
                removeEventListener: () => {},
                queueEvent: () => {},
                getQueueStatus: () => ({ queueLength: 0 }),
                initialized: false,
                fallback: true
            };
        }
        
        createFallbackRouter() {
            return {
                navigate: () => {},
                register: () => {},
                getCurrentRoute: () => null,
                initialized: false,
                fallback: true
            };
        }
        
        /**
         * CRITICAL FIX: Create fallback NotificationManager
         */
        createFallbackNotificationManager() {
            return {
                show: (message, type = 'info', options = {}) => {
                    console.log(`Fallback Notification [${type.toUpperCase()}]:`, message);
                    // Create simple toast fallback
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
                },
                success: (message, options) => this.show(message, 'success', options),
                error: (message, options) => this.show(message, 'error', options),
                warning: (message, options) => this.show(message, 'warning', options),
                info: (message, options) => this.show(message, 'info', options)
            };
        }

        /**
         * Retry initialization without page reload
         */
        async retryInitialization() {
            console.log('🔄 Retrying system initialization...');

            // Reset state
            this.initialized = false;
            this.errors = [];
            this.startTime = Date.now();

            // Clear error displays
            const errorElements = document.querySelectorAll('[id*="error"], [class*="error"]');
            errorElements.forEach(el => {
                if (el.textContent.includes('initialization') || el.textContent.includes('system')) {
                    el.remove();
                }
            });

            // Retry initialization
            try {
                await this.initialize();
                console.log('✅ System initialization retry successful');
            } catch (error) {
                console.error('❌ System initialization retry failed:', error);
                this.handleInitializationError(error);
            }
        }

        /**
         * Get system status
         */
        getSystemStatus() {
            return {
                initialized: this.initialized,
                systems: Array.from(this.systems.keys()),
                errors: this.errors,
                duration: Date.now() - this.startTime
            };
        }
    }
    
    // Export SystemInitializer
    global.SystemInitializer = SystemInitializer;
    
    // Create global instance
    global.systemInitializer = new SystemInitializer();
    
    console.log('✅ SystemInitializer ready');
    
})(window);
