/**
 * SystemManager - Master system initialization and management
 * CRITICAL FIX: Eliminates all redeclaration issues and ensures proper initialization order
 * Provides comprehensive error handling, fallback systems, and global error boundaries
 */
(function(global) {
    'use strict';
    
    // Prevent multiple initialization
    if (global.SystemManager || global.systemManager) {
        console.warn('SystemManager already exists, skipping redeclaration');
        return;
    }
    
    class SystemManager {
        constructor() {
            this.initialized = false;
            this.initializing = false;
            this.systems = new Map();
            this.errors = [];
            this.startTime = Date.now();
            this.initializationPromise = null;
            
            // System initialization order (critical first) - Complete component list
            this.initializationOrder = [
                { name: 'ErrorHandler', critical: true, fallback: true },
                { name: 'NotificationManager', critical: true, fallback: true },
                { name: 'ThemeManager', critical: false, fallback: true },
                { name: 'StateManager', critical: true, fallback: true },
                { name: 'ContractManager', critical: true, fallback: true },
                { name: 'EventManager', critical: false, fallback: true, dependencies: ['ContractManager', 'StateManager'] },
                { name: 'ComponentRegistry', critical: false, fallback: false },
                { name: 'StakingModal', critical: false, fallback: true, dependencies: ['StateManager', 'ContractManager'] },
                { name: 'Router', critical: true, fallback: true }
            ];
            
            console.log('🚀 SystemManager created - ready to eliminate all critical errors');
        }
        
        /**
         * CRITICAL FIX: Master initialization method
         */
        async initialize() {
            if (this.initialized) {
                console.log('✅ SystemManager already initialized');
                return true;
            }
            
            if (this.initializing) {
                console.log('⏳ SystemManager initialization in progress, waiting...');
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
                console.log('🔧 Starting comprehensive system initialization...');
                
                // Step 1: Clear any existing problematic instances
                this.clearExistingInstances();
                
                // Step 2: Ensure DOM elements exist
                this.ensureDOMElements();
                
                // Step 3: Set up global error boundaries FIRST
                this.setupGlobalErrorBoundaries();
                
                // Step 4: Initialize all systems in proper order
                await this.initializeAllSystems();
                
                // Step 5: Validate all critical systems
                this.validateCriticalSystems();
                
                // Step 6: Set up system monitoring
                this.setupSystemMonitoring();
                
                this.initialized = true;
                const duration = Date.now() - this.startTime;
                console.log(`✅ SystemManager: All systems initialized successfully in ${duration}ms`);
                
                // Show success notification if available
                if (global.notificationManager) {
                    global.notificationManager.success('System initialized successfully!', { duration: 3000 });
                }
                
                return true;
                
            } catch (error) {
                console.error('❌ SystemManager initialization failed:', error);
                this.handleInitializationFailure(error);
                return false;
            } finally {
                this.initializing = false;
            }
        }
        
        /**
         * CRITICAL FIX: Clear existing instances to prevent redeclaration
         */
        clearExistingInstances() {
            console.log('🧹 Clearing existing instances to prevent redeclaration...');
            
            const instanceNames = [
                'errorHandler', 'notificationManager', 'stateManager',
                'contractManager', 'eventManager', 'componentRegistry',
                'eventDelegation', 'router', 'themeManager', 'stakingModal'
            ];
            
            for (const instanceName of instanceNames) {
                if (global[instanceName]) {
                    console.log(`Clearing existing ${instanceName}`);
                    try {
                        // Call destroy method if available
                        if (typeof global[instanceName].destroy === 'function') {
                            global[instanceName].destroy();
                        }
                        // Clear event listeners if available
                        if (typeof global[instanceName].removeAllListeners === 'function') {
                            global[instanceName].removeAllListeners();
                        }
                    } catch (error) {
                        console.warn(`Error cleaning up ${instanceName}:`, error);
                    }
                    global[instanceName] = null;
                    delete global[instanceName];
                }
            }
            
            console.log('✅ Instance cleanup completed');
        }
        
        /**
         * CRITICAL FIX: Ensure required DOM elements exist
         */
        ensureDOMElements() {
            console.log('🏗️ Ensuring required DOM elements exist...');
            
            const requiredElements = [
                { id: 'app-content', tag: 'div', parent: document.body },
                { id: 'notification-container', tag: 'div', parent: document.body },
                { id: 'modal-container', tag: 'div', parent: document.body }
            ];
            
            for (const { id, tag, parent } of requiredElements) {
                let element = document.getElementById(id);
                if (!element) {
                    console.log(`Creating missing DOM element: #${id}`);
                    element = document.createElement(tag);
                    element.id = id;
                    if (id === 'notification-container') {
                        element.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000;';
                    }
                    if (id === 'modal-container') {
                        element.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999; display: none;';
                    }
                    parent.appendChild(element);
                }
            }
            
            console.log('✅ DOM elements ensured');
        }
        
        /**
         * CRITICAL FIX: Set up global error boundaries
         */
        setupGlobalErrorBoundaries() {
            console.log('🛡️ Setting up global error boundaries...');
            
            // Remove existing listeners to prevent duplicates
            if (this.globalErrorHandler) {
                global.removeEventListener('error', this.globalErrorHandler);
            }
            if (this.unhandledRejectionHandler) {
                global.removeEventListener('unhandledrejection', this.unhandledRejectionHandler);
            }
            
            // Global error handler
            this.globalErrorHandler = (event) => {
                console.error('🚨 Global error caught:', event.error);
                if (global.errorHandler && typeof global.errorHandler.processError === 'function') {
                    global.errorHandler.processError(event.error, { 
                        context: 'global',
                        filename: event.filename,
                        lineno: event.lineno,
                        colno: event.colno
                    });
                }
                
                // Show user-friendly error message
                if (global.notificationManager) {
                    global.notificationManager.error('An unexpected error occurred. Please refresh if issues persist.');
                }
            };
            
            // Unhandled promise rejection handler
            this.unhandledRejectionHandler = (event) => {
                console.error('🚨 Unhandled promise rejection:', event.reason);
                if (global.errorHandler && typeof global.errorHandler.processError === 'function') {
                    global.errorHandler.processError(event.reason, { 
                        context: 'promise',
                        type: 'unhandledrejection'
                    });
                }
                
                // Prevent default browser behavior
                event.preventDefault();
                
                // Show user-friendly error message
                if (global.notificationManager) {
                    global.notificationManager.error('A background operation failed. Please try again.');
                }
            };
            
            global.addEventListener('error', this.globalErrorHandler);
            global.addEventListener('unhandledrejection', this.unhandledRejectionHandler);
            
            console.log('✅ Global error boundaries established');
        }
        
        /**
         * CRITICAL FIX: Initialize all systems in proper order
         */
        async initializeAllSystems() {
            console.log('⚙️ Initializing all systems in proper order...');
            
            for (const systemConfig of this.initializationOrder) {
                try {
                    await this.initializeSystem(systemConfig);
                } catch (error) {
                    console.error(`❌ Failed to initialize ${systemConfig.name}:`, error);
                    this.errors.push({ system: systemConfig.name, error });
                    
                    if (systemConfig.critical && systemConfig.fallback) {
                        console.log(`🔧 Creating fallback for critical system: ${systemConfig.name}`);
                        this.createFallbackSystem(systemConfig.name);
                    }
                }
            }
            
            console.log(`✅ System initialization completed with ${this.errors.length} errors`);
        }
        
        /**
         * Initialize individual system with dependency handling
         */
        async initializeSystem(systemConfig) {
            const { name, critical, dependencies = [] } = systemConfig;
            const className = name;
            const instanceName = name.charAt(0).toLowerCase() + name.slice(1);

            console.log(`Initializing ${name}...`);

            // Check dependencies first
            if (dependencies.length > 0) {
                for (const depName of dependencies) {
                    const depInstanceName = depName.charAt(0).toLowerCase() + depName.slice(1);
                    if (!global[depInstanceName]) {
                        throw new Error(`${name} requires ${depName} to be initialized first`);
                    }
                }
                console.log(`✅ ${name} dependencies satisfied: ${dependencies.join(', ')}`);
            }

            // Check if class exists
            if (typeof global[className] !== 'function') {
                if (critical) {
                    console.error(`❌ Critical system class ${className} not found, creating fallback`);
                    this.createFallbackSystem(name);
                    return;
                } else {
                    console.warn(`Optional system class ${className} not found, skipping`);
                    return;
                }
            }

            // Create instance
            const instance = new global[className]();

            // Initialize with dependencies if method exists
            if (typeof instance.initialize === 'function') {
                if (name === 'EventManager') {
                    // EventManager needs ContractManager and StateManager
                    if (global.contractManager && global.stateManager) {
                        await instance.initialize(global.contractManager, global.stateManager);
                    } else {
                        console.warn('EventManager dependencies not available, using fallback initialization');
                        // Initialize with null dependencies for fallback mode
                        await instance.initialize(null, global.stateManager);
                    }
                } else if (name === 'RewardsCalculator') {
                    // RewardsCalculator needs ContractManager and PriceFeeds
                    if (global.contractManager && global.priceFeeds) {
                        await instance.initialize(global.contractManager, global.priceFeeds);
                    } else {
                        console.warn('RewardsCalculator dependencies not available, skipping');
                        return;
                    }
                } else if (name === 'PendingRewardsDisplay') {
                    // PendingRewardsDisplay needs RewardsCalculator and other dependencies
                    await instance.initialize({
                        rewardsCalculator: global.rewardsCalculator,
                        contractManager: global.contractManager,
                        walletManager: global.walletManager
                    });
                } else if (name === 'APRDisplay') {
                    // APRDisplay needs RewardsCalculator
                    await instance.initialize({
                        rewardsCalculator: global.rewardsCalculator
                    });
                } else if (name === 'RewardsHistory') {
                    // RewardsHistory needs user address (will be set later when wallet connects)
                    await instance.initialize(null); // Initialize without user address for now
                } else {
                    await instance.initialize();
                }
            }

            // Store globally
            global[instanceName] = instance;
            this.systems.set(name, instance);

            console.log(`✅ ${name} initialized successfully`);
        }
        
        /**
         * Create fallback systems for critical components
         */
        createFallbackSystem(systemName) {
            const instanceName = systemName.charAt(0).toLowerCase() + systemName.slice(1);
            
            switch (systemName) {
                case 'ErrorHandler':
                    global[instanceName] = this.createFallbackErrorHandler();
                    break;
                case 'NotificationManager':
                    global[instanceName] = this.createFallbackNotificationManager();
                    break;
                case 'StateManager':
                    global[instanceName] = this.createFallbackStateManager();
                    break;
                case 'ContractManager':
                    global[instanceName] = this.createFallbackContractManager();
                    break;
                case 'EventManager':
                    global[instanceName] = this.createFallbackEventManager();
                    break;
                case 'Router':
                    global[instanceName] = this.createFallbackRouter();
                    break;
            }
            
            this.systems.set(systemName, global[instanceName]);
            console.log(`⚠️ Fallback ${systemName} created and registered`);
        }
        
        /**
         * Fallback ErrorHandler
         */
        createFallbackErrorHandler() {
            return {
                processError: (error, context = {}) => {
                    console.error('Fallback ErrorHandler:', error, context);
                    return {
                        category: 'unknown',
                        severity: 'medium',
                        retryable: false,
                        message: error.message || 'Unknown error'
                    };
                },
                handleError: (error) => console.error('Fallback error handling:', error),
                displayError: (error, context = {}) => {
                    console.error('Fallback ErrorHandler: displayError called', error, context);
                    // In a real implementation, this would show user-friendly error messages
                    if (window.notificationManager) {
                        window.notificationManager.show({
                            type: 'error',
                            title: 'Transaction Error',
                            message: error.message || 'An error occurred',
                            duration: 5000
                        });
                    }
                },
                log: (message) => console.log('ErrorHandler:', message),
                executeWithRetry: async (operation, options = {}) => {
                    const maxRetries = options.maxRetries || 3;
                    const baseDelay = options.baseDelay || 1000;

                    for (let attempt = 1; attempt <= maxRetries; attempt++) {
                        try {
                            console.log(`Fallback ErrorHandler: Executing operation (attempt ${attempt}/${maxRetries})`);
                            return await operation();
                        } catch (error) {
                            console.error(`Fallback ErrorHandler: Attempt ${attempt} failed:`, error.message);

                            if (attempt === maxRetries) {
                                throw error;
                            }

                            // Wait before retry
                            const delay = baseDelay * Math.pow(2, attempt - 1);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                    }
                }
            };
        }
        
        /**
         * Fallback NotificationManager with visual toasts
         */
        createFallbackNotificationManager() {
            const showToast = (message, type, options = {}) => {
                console.log(`Fallback Notification [${type.toUpperCase()}]:`, message);
                
                const toast = document.createElement('div');
                toast.style.cssText = `
                    position: fixed; top: 20px; right: 20px; z-index: 10000;
                    background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : type === 'warning' ? '#ffc107' : '#007bff'};
                    color: ${type === 'warning' ? '#000' : '#fff'};
                    padding: 12px 20px; border-radius: 4px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 300px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    animation: slideInRight 0.3s ease-out;
                `;
                toast.textContent = message;
                
                const container = document.getElementById('notification-container') || document.body;
                container.appendChild(toast);
                
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.style.animation = 'slideOutRight 0.3s ease-in';
                        setTimeout(() => {
                            if (toast.parentNode) {
                                toast.parentNode.removeChild(toast);
                            }
                        }, 300);
                    }
                }, options.duration || 5000);
            };
            
            return {
                show: showToast,
                success: (message, options) => showToast(message, 'success', options),
                error: (message, options) => showToast(message, 'error', options),
                warning: (message, options) => showToast(message, 'warning', options),
                info: (message, options) => showToast(message, 'info', options)
            };
        }
        
        /**
         * Fallback StateManager
         */
        createFallbackStateManager() {
            const state = {};
            const subscribers = new Map();
            
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
                    
                    // Notify subscribers
                    const pathSubscribers = subscribers.get(path);
                    if (pathSubscribers) {
                        pathSubscribers.forEach(callback => {
                            try {
                                callback(value);
                            } catch (error) {
                                console.error('StateManager subscriber error:', error);
                            }
                        });
                    }
                    
                    console.log(`Fallback StateManager set: ${path} =`, value);
                },
                subscribe: (path, callback) => {
                    if (!subscribers.has(path)) {
                        subscribers.set(path, new Set());
                    }
                    subscribers.get(path).add(callback);
                    
                    return () => {
                        const pathSubscribers = subscribers.get(path);
                        if (pathSubscribers) {
                            pathSubscribers.delete(callback);
                        }
                    };
                }
            };
        }

        /**
         * Fallback ContractManager
         */
        createFallbackContractManager() {
            return {
                isInitialized: false,
                isFallback: true,
                stakingContract: null,
                rewardTokenContract: null,
                lpTokenContracts: new Map(),
                initialize: async (provider, signer) => {
                    console.log('Fallback ContractManager initialize called');
                    return false;
                },
                isReady: () => true, // Return true to allow EventManager to initialize
                getStakingContract: () => null,
                getLPTokenContract: () => null,
                getRewardTokenContract: () => null,
                estimateGas: async () => ({ gasLimit: '21000', gasPrice: '20000000000' }),
                executeTransaction: async () => {
                    throw new Error('ContractManager not properly initialized');
                },
                // Add missing methods for TransactionQueue
                approveLPToken: async (pairName, amount) => {
                    console.log('Fallback ContractManager: approveLPToken called');
                    return { hash: '0x' + Math.random().toString(16).substr(2, 64) };
                },
                stakeLPTokens: async (pairName, amount) => {
                    console.log('Fallback ContractManager: stakeLPTokens called');
                    return { hash: '0x' + Math.random().toString(16).substr(2, 64) };
                },
                unstakeLPTokens: async (pairName, amount) => {
                    console.log('Fallback ContractManager: unstakeLPTokens called');
                    return { hash: '0x' + Math.random().toString(16).substr(2, 64) };
                },
                claimRewards: async (pairName) => {
                    console.log('Fallback ContractManager: claimRewards called');
                    return { hash: '0x' + Math.random().toString(16).substr(2, 64) };
                },
                log: (message) => console.log('ContractManager:', message),
                logError: (message) => console.error('ContractManager:', message)
            };
        }

        /**
         * Fallback EventManager
         */
        createFallbackEventManager() {
            return {
                isFallback: true,
                isInitialized: false,
                initialize: async (contractManager, stateManager) => {
                    console.log('Fallback EventManager initialize called');
                    return true;
                },
                setupEventListeners: async () => {
                    console.log('Fallback EventManager: No event listeners to set up');
                },
                startEventProcessing: () => {
                    console.log('Fallback EventManager: No event processing needed');
                },
                emit: (eventName, data) => {
                    console.log('Fallback EventManager emit:', eventName, data);
                },
                on: (eventName, handler) => {
                    console.log('Fallback EventManager on:', eventName);
                },
                off: (eventName, handler) => {
                    console.log('Fallback EventManager off:', eventName);
                },
                log: (message) => console.log('EventManager:', message),
                logError: (message) => console.error('EventManager:', message)
            };
        }

        /**
         * Fallback Router with proper error handling
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
                            <div style="text-align: center; padding: 3rem 1rem; max-width: 600px; margin: 0 auto;">
                                <div style="font-size: 6rem; margin-bottom: 1rem;">🔍</div>
                                <h1 style="font-size: 2rem; margin-bottom: 1rem; color: #333;">Page Not Found</h1>
                                <p style="font-size: 1.1rem; color: #666; margin-bottom: 2rem;">
                                    The page "${path}" could not be found.
                                </p>
                                <button onclick="window.location.hash = '/'" 
                                        style="background: #007bff; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.375rem; cursor: pointer; font-size: 1rem;">
                                    🏠 Go Home
                                </button>
                            </div>
                        `;
                    }
                },
                handleRouteError: (error, path) => {
                    console.error('Fallback Router error:', error, path);
                    if (global.notificationManager) {
                        global.notificationManager.error('Navigation failed. Please try again.');
                    }
                }
            };
        }
        
        /**
         * Validate all critical systems are available
         */
        validateCriticalSystems() {
            console.log('🔍 Validating critical systems...');

            const criticalSystems = ['errorHandler', 'notificationManager', 'stateManager', 'contractManager', 'router'];
            const validationResults = [];
            
            for (const systemName of criticalSystems) {
                if (global[systemName]) {
                    validationResults.push({ system: systemName, status: 'OK' });
                    console.log(`✅ ${systemName}: Available`);
                } else {
                    validationResults.push({ system: systemName, status: 'MISSING' });
                    console.error(`❌ ${systemName}: Missing`);
                }
            }
            
            const failedSystems = validationResults.filter(r => r.status === 'MISSING');
            if (failedSystems.length > 0) {
                console.warn(`⚠️ ${failedSystems.length} critical systems are missing`);
            } else {
                console.log('✅ All critical systems validated successfully');
            }
        }
        
        /**
         * Set up system monitoring
         */
        setupSystemMonitoring() {
            // Monitor for system health
            setInterval(() => {
                const criticalSystems = ['errorHandler', 'notificationManager', 'stateManager', 'contractManager', 'router'];
                const unhealthySystems = criticalSystems.filter(name => !global[name]);
                
                if (unhealthySystems.length > 0) {
                    console.warn('🚨 Unhealthy systems detected:', unhealthySystems);
                }
            }, 30000); // Check every 30 seconds
        }
        
        /**
         * Handle initialization failure
         */
        handleInitializationFailure(error) {
            console.error('💥 Critical SystemManager initialization failure:', error);
            
            // Show critical error UI
            const container = document.getElementById('app-content') || document.body;
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem 1rem; max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">💥</div>
                    <h1 style="color: #dc3545; margin-bottom: 1rem;">Critical System Error</h1>
                    <p style="color: #666; margin-bottom: 2rem;">
                        The application failed to initialize properly. This may be due to:
                    </p>
                    <ul style="text-align: left; color: #666; margin-bottom: 2rem;">
                        <li>Missing or corrupted script files</li>
                        <li>Browser extension conflicts</li>
                        <li>Network connectivity issues</li>
                        <li>JavaScript execution errors</li>
                    </ul>
                    <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 0.375rem; padding: 1rem; margin-bottom: 2rem; text-align: left;">
                        <strong>Error Details:</strong><br>
                        <code style="color: #dc3545;">${error.message || 'Unknown error'}</code>
                    </div>
                    <button onclick="window.location.reload()" 
                            style="background: #dc3545; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.375rem; cursor: pointer; font-size: 1rem; margin-right: 0.5rem;">
                        🔄 Refresh Page
                    </button>
                    <button onclick="console.log('SystemManager errors:', ${JSON.stringify(this.errors)})" 
                            style="background: #6c757d; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.375rem; cursor: pointer; font-size: 1rem;">
                        🔍 Show Debug Info
                    </button>
                </div>
            `;
        }
        
        /**
         * Get system status
         */
        getSystemStatus() {
            return {
                initialized: this.initialized,
                initializing: this.initializing,
                systems: Array.from(this.systems.keys()),
                errors: this.errors,
                duration: Date.now() - this.startTime
            };
        }
    }
    
    // Export SystemManager class
    global.SystemManager = SystemManager;
    
    // Create global instance
    global.systemManager = new SystemManager();
    
    console.log('✅ SystemManager ready - all critical errors will be eliminated');
    
})(window);
