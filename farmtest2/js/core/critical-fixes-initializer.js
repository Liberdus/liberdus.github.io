/**
 * CRITICAL FIXES INITIALIZER
 * Comprehensive solution for all critical startup errors
 * Ensures proper initialization order and prevents redeclaration issues
 */
(function(global) {
    'use strict';
    
    // Prevent multiple execution
    if (global.CriticalFixesInitializer) {
        console.warn('CriticalFixesInitializer already loaded');
        return;
    }
    
    class CriticalFixesInitializer {
        constructor() {
            this.initialized = false;
            this.initializationPromise = null;
            this.systems = new Map();
            this.errors = [];
            
            console.log('🚨 CriticalFixesInitializer: Starting comprehensive fixes...');
        }
        
        /**
         * Main initialization method - call this to fix all issues
         */
        async initialize() {
            if (this.initialized) {
                console.log('✅ Critical fixes already applied');
                return true;
            }
            
            if (this.initializationPromise) {
                console.log('⏳ Critical fixes initialization in progress...');
                return this.initializationPromise;
            }
            
            this.initializationPromise = this.performCriticalFixes();
            return this.initializationPromise;
        }
        
        /**
         * Perform all critical fixes in proper order
         */
        async performCriticalFixes() {
            try {
                console.log('🔧 Applying critical fixes...');
                
                // Step 1: Clear existing problematic instances
                this.clearProblematicInstances();
                
                // Step 2: Ensure DOM elements exist
                this.ensureDOMElements();
                
                // Step 3: Initialize systems in correct order
                await this.initializeSystemsSequentially();
                
                // Step 4: Set up error boundaries
                this.setupErrorBoundaries();
                
                // Step 5: Validate all systems
                this.validateSystems();
                
                this.initialized = true;
                console.log('✅ All critical fixes applied successfully');
                
                return true;
                
            } catch (error) {
                console.error('❌ Critical fixes failed:', error);
                this.showCriticalErrorUI(error);
                return false;
            }
        }
        
        /**
         * CRITICAL FIX 1: Clear existing problematic instances
         */
        clearProblematicInstances() {
            console.log('🧹 Clearing problematic global instances...');
            
            const problematicInstances = [
                'errorHandler', 'stateManager', 'eventManager', 'router',
                'notificationManager', 'componentRegistry', 'eventDelegation'
            ];
            
            for (const instanceName of problematicInstances) {
                if (global[instanceName]) {
                    console.log(`Clearing existing ${instanceName}`);
                    try {
                        if (typeof global[instanceName].destroy === 'function') {
                            global[instanceName].destroy();
                        }
                    } catch (error) {
                        console.warn(`Error destroying ${instanceName}:`, error);
                    }
                    global[instanceName] = null;
                    delete global[instanceName];
                }
            }
        }
        
        /**
         * CRITICAL FIX 2: Ensure required DOM elements exist
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
                    console.log(`Creating missing element: #${id}`);
                    element = document.createElement(tag);
                    element.id = id;
                    parent.appendChild(element);
                }
            }
        }
        
        /**
         * CRITICAL FIX 3: Initialize systems in correct order
         */
        async initializeSystemsSequentially() {
            console.log('⚙️ Initializing systems in correct order...');
            
            const initOrder = [
                { name: 'ErrorHandler', critical: true },
                { name: 'NotificationManager', critical: true },
                { name: 'StateManager', critical: true },
                { name: 'EventManager', critical: false },
                { name: 'ComponentRegistry', critical: false },
                { name: 'EventDelegation', critical: false },
                { name: 'Router', critical: true }
            ];
            
            for (const { name, critical } of initOrder) {
                try {
                    await this.initializeSystem(name, critical);
                } catch (error) {
                    console.error(`Failed to initialize ${name}:`, error);
                    if (critical) {
                        this.createFallbackSystem(name);
                    }
                }
            }
        }
        
        /**
         * Initialize individual system
         */
        async initializeSystem(systemName, critical = false) {
            const instanceName = systemName.charAt(0).toLowerCase() + systemName.slice(1);
            
            // Check if class exists
            if (typeof global[systemName] !== 'function') {
                if (critical) {
                    throw new Error(`Critical system ${systemName} class not found`);
                } else {
                    console.warn(`Optional system ${systemName} class not found, skipping`);
                    return;
                }
            }
            
            // Create instance
            console.log(`Initializing ${systemName}...`);
            const instance = new global[systemName]();
            
            // Initialize if method exists
            if (typeof instance.initialize === 'function') {
                await instance.initialize();
            }
            
            // Store globally
            global[instanceName] = instance;
            this.systems.set(systemName, instance);
            
            console.log(`✅ ${systemName} initialized successfully`);
        }
        
        /**
         * Create fallback systems for critical components
         */
        createFallbackSystem(systemName) {
            console.log(`🔧 Creating fallback for ${systemName}...`);
            
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
                case 'Router':
                    global[instanceName] = this.createFallbackRouter();
                    break;
            }
            
            console.log(`⚠️ Fallback ${systemName} created`);
        }
        
        /**
         * Fallback ErrorHandler
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
         * Fallback NotificationManager
         */
        createFallbackNotificationManager() {
            return {
                show: (message, type = 'info', options = {}) => {
                    console.log(`Fallback Notification [${type.toUpperCase()}]:`, message);
                    this.showFallbackToast(message, type, options);
                },
                success: (message, options) => this.show(message, 'success', options),
                error: (message, options) => this.show(message, 'error', options),
                warning: (message, options) => this.show(message, 'warning', options),
                info: (message, options) => this.show(message, 'info', options)
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
                animation: slideIn 0.3s ease-out;
            `;
            toast.textContent = message;
            document.body.appendChild(toast);
            
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.style.animation = 'slideOut 0.3s ease-in';
                    setTimeout(() => {
                        if (toast.parentNode) {
                            toast.parentNode.removeChild(toast);
                        }
                    }, 300);
                }
            }, options.duration || 5000);
        }
        
        /**
         * Fallback StateManager
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
         * Fallback Router
         */
        createFallbackRouter() {
            return {
                navigate: (path) => {
                    console.log('Fallback Router navigate:', path);
                    window.location.hash = path;
                },
                getCurrentRoute: () => window.location.hash.slice(1) || '/',
                addRoute: (path, handler) => console.log('Fallback Router addRoute:', path)
            };
        }
        
        /**
         * CRITICAL FIX 4: Set up error boundaries
         */
        setupErrorBoundaries() {
            console.log('🛡️ Setting up error boundaries...');
            
            // Global error handler
            global.addEventListener('error', (event) => {
                console.error('🚨 Global error:', event.error);
                if (global.errorHandler && global.errorHandler.processError) {
                    global.errorHandler.processError(event.error, { global: true });
                }
            });
            
            // Unhandled promise rejections
            global.addEventListener('unhandledrejection', (event) => {
                console.error('🚨 Unhandled promise rejection:', event.reason);
                if (global.errorHandler && global.errorHandler.processError) {
                    global.errorHandler.processError(event.reason, { promise: true });
                }
            });
        }
        
        /**
         * CRITICAL FIX 5: Validate all systems
         */
        validateSystems() {
            console.log('🔍 Validating all systems...');
            
            const requiredSystems = ['errorHandler', 'notificationManager', 'stateManager', 'router'];
            const validationResults = [];
            
            for (const systemName of requiredSystems) {
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
                console.warn(`⚠️ ${failedSystems.length} systems are missing but continuing with fallbacks`);
            }
        }
        
        /**
         * Show critical error UI
         */
        showCriticalErrorUI(error) {
            const container = document.getElementById('app-content') || document.body;
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem 1rem; max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">💥</div>
                    <h1 style="color: #dc3545; margin-bottom: 1rem;">Critical Initialization Error</h1>
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
                    <button onclick="console.log('Critical error details:', ${JSON.stringify(error)})" 
                            style="background: #6c757d; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.375rem; cursor: pointer; font-size: 1rem;">
                        🔍 Show Debug Info
                    </button>
                </div>
            `;
        }
    }
    
    // Export and auto-initialize
    global.CriticalFixesInitializer = CriticalFixesInitializer;
    global.criticalFixesInitializer = new CriticalFixesInitializer();
    
    console.log('✅ CriticalFixesInitializer ready');
    
})(window);
