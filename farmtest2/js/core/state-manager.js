
(function(global) {
    'use strict';

    if (global.StateManager) {
        return;
    }
    if (global.stateManager) {
        return;
    }

class StateManager {
    constructor() {
        // Core state storage
        this.state = {
            // Wallet state
            wallet: {
                isConnected: false,
                address: null,
                balance: '0',
                network: null,
                walletType: null
            },
            
            // Contract state
            contracts: {
                isInitialized: false,
                stakingContract: null,
                rewardTokenContract: null,
                supportedTokens: []
            },
            
            // User staking data
            staking: {
                stakes: new Map(), // Map of lpToken -> stakeData
                rewards: new Map(), // Map of lpToken -> rewardAmount
                allowances: new Map(), // Map of lpToken -> allowanceAmount
                balances: new Map() // Map of lpToken -> balanceAmount
            },
            
            // Pool information
            pools: {
                poolData: new Map(), // Map of lpToken -> poolInfo
                totalValueLocked: '0',
                totalRewardsDistributed: '0'
            },
            
            // UI state
            ui: {
                isLoading: false,
                currentPage: 'home',
                modals: {
                    walletConnect: false,
                    stakeModal: false,
                    unstakeModal: false,
                    claimModal: false
                },
                notifications: []
            },
            
            // Application state
            app: {
                isInitialized: false,
                lastUpdate: null,
                errors: [],
                theme: 'dark'
            }
        };
        
        // Observer management
        this.observers = new Map(); // Map of path -> Set of observers
        this.computedProperties = new Map(); // Map of path -> computation function
        this.middleware = []; // Array of middleware functions
        
        // Configuration
        this.config = {
            enableLogging: true,
            enableMiddleware: true,
            maxHistorySize: 100,
            debounceDelay: 10
        };
        
        // State history for debugging
        this.history = [];
        this.historyIndex = 0;
        
        this.log('StateManager initialized with Observer pattern');
    }

    // ==================== CORE STATE OPERATIONS ====================

    /**
     * Get state value by path (supports nested paths like 'wallet.address')
     */
    get(path) {
        try {
            if (!path) return this.state;
            
            const keys = path.split('.');
            let current = this.state;
            
            for (const key of keys) {
                if (current === null || current === undefined) {
                    return undefined;
                }
                current = current[key];
            }
            
            return current;
        } catch (error) {
            this.logError('Error getting state path:', path, error);
            return undefined;
        }
    }

    /**
     * Set state value by path with observer notifications
     */
    set(path, value, options = {}) {
        try {
            const { silent = false, merge = false } = options;
            
            if (!path) {
                throw new Error('Path is required for state updates');
            }
            
            // Store previous value for comparison
            const previousValue = this.get(path);
            
            // Apply middleware if enabled
            if (this.config.enableMiddleware && !silent) {
                value = this.applyMiddleware(path, value, previousValue);
            }
            
            // Update state
            this.updateNestedState(path, value, merge);
            
            // Add to history
            this.addToHistory(path, value, previousValue);
            
            // Notify observers if value changed
            if (!silent && !this.deepEqual(previousValue, value)) {
                this.notifyObservers(path, value, previousValue);
                this.updateComputedProperties(path);
            }
            
            this.log('State updated:', path, value);
            return true;
        } catch (error) {
            this.logError('Error setting state:', path, error);
            return false;
        }
    }

    /**
     * Update nested state by path
     */
    updateNestedState(path, value, merge = false) {
        const keys = path.split('.');
        let current = this.state;
        
        // Navigate to parent object
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        // Set final value
        const finalKey = keys[keys.length - 1];
        if (merge && typeof current[finalKey] === 'object' && typeof value === 'object') {
            current[finalKey] = { ...current[finalKey], ...value };
        } else {
            current[finalKey] = value;
        }
    }

    /**
     * Merge object into existing state
     */
    merge(path, updates) {
        return this.set(path, updates, { merge: true });
    }

    /**
     * Delete state property by path
     */
    delete(path) {
        try {
            const keys = path.split('.');
            let current = this.state;
            
            // Navigate to parent
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]];
                if (!current) return false;
            }
            
            // Delete property
            const finalKey = keys[keys.length - 1];
            const previousValue = current[finalKey];
            delete current[finalKey];
            
            // Notify observers
            this.notifyObservers(path, undefined, previousValue);
            
            this.log('State deleted:', path);
            return true;
        } catch (error) {
            this.logError('Error deleting state:', path, error);
            return false;
        }
    }

    // ==================== OBSERVER PATTERN IMPLEMENTATION ====================

    /**
     * Subscribe to state changes at specific path
     */
    subscribe(path, callback, options = {}) {
        try {
            const { immediate = false, once = false } = options;
            
            if (typeof callback !== 'function') {
                throw new Error('Callback must be a function');
            }
            
            // Create observer object
            const observer = {
                callback,
                once,
                id: this.generateObserverId(),
                path,
                created: Date.now()
            };
            
            // Add to observers map
            if (!this.observers.has(path)) {
                this.observers.set(path, new Set());
            }
            this.observers.get(path).add(observer);
            
            // Call immediately if requested
            if (immediate) {
                const currentValue = this.get(path);
                callback(currentValue, undefined, path);
            }
            
            this.log('Observer subscribed to path:', path, observer.id);
            
            // Return unsubscribe function
            return () => this.unsubscribe(path, observer.id);
        } catch (error) {
            this.logError('Error subscribing to state:', path, error);
            return () => {};
        }
    }

    /**
     * Unsubscribe from state changes
     */
    unsubscribe(path, observerId) {
        try {
            const observers = this.observers.get(path);
            if (observers) {
                for (const observer of observers) {
                    if (observer.id === observerId) {
                        observers.delete(observer);
                        this.log('Observer unsubscribed:', path, observerId);
                        
                        // Clean up empty observer sets
                        if (observers.size === 0) {
                            this.observers.delete(path);
                        }
                        return true;
                    }
                }
            }
            return false;
        } catch (error) {
            this.logError('Error unsubscribing:', path, observerId, error);
            return false;
        }
    }

    /**
     * Notify all observers of state changes
     */
    notifyObservers(path, newValue, previousValue) {
        try {
            // Notify exact path observers
            this.notifyPathObservers(path, newValue, previousValue);
            
            // Notify parent path observers (for nested updates)
            this.notifyParentObservers(path, newValue, previousValue);
            
            // Notify wildcard observers
            this.notifyWildcardObservers(path, newValue, previousValue);
            
        } catch (error) {
            this.logError('Error notifying observers:', path, error);
        }
    }

    /**
     * Notify observers for exact path match
     */
    notifyPathObservers(path, newValue, previousValue) {
        const observers = this.observers.get(path);
        if (!observers) return;
        
        const observersToRemove = [];
        
        for (const observer of observers) {
            try {
                observer.callback(newValue, previousValue, path);
                
                // Remove one-time observers
                if (observer.once) {
                    observersToRemove.push(observer);
                }
            } catch (error) {
                this.logError('Observer callback error:', path, error);
            }
        }
        
        // Clean up one-time observers
        observersToRemove.forEach(observer => observers.delete(observer));
    }

    /**
     * Notify parent path observers for nested changes
     */
    notifyParentObservers(path, newValue, previousValue) {
        const pathParts = path.split('.');
        
        for (let i = pathParts.length - 1; i > 0; i--) {
            const parentPath = pathParts.slice(0, i).join('.');
            const parentObservers = this.observers.get(parentPath);
            
            if (parentObservers) {
                const parentValue = this.get(parentPath);
                this.notifyPathObservers(parentPath, parentValue, parentValue);
            }
        }
    }

    /**
     * Notify wildcard observers (paths ending with '*')
     */
    notifyWildcardObservers(path, newValue, previousValue) {
        for (const [observerPath, observers] of this.observers.entries()) {
            if (observerPath.endsWith('*')) {
                const wildcardBase = observerPath.slice(0, -1);
                if (path.startsWith(wildcardBase)) {
                    this.notifyPathObservers(observerPath, newValue, previousValue);
                }
            }
        }
    }

    // ==================== COMPUTED PROPERTIES ====================

    /**
     * Define computed property that automatically updates when dependencies change
     */
    computed(path, computeFn, dependencies = []) {
        try {
            if (typeof computeFn !== 'function') {
                throw new Error('Compute function must be a function');
            }

            // Store computed property
            this.computedProperties.set(path, {
                compute: computeFn,
                dependencies,
                lastValue: undefined
            });

            // Subscribe to dependency changes
            dependencies.forEach(depPath => {
                this.subscribe(depPath, () => {
                    this.updateComputedProperty(path);
                });
            });

            // Calculate initial value
            this.updateComputedProperty(path);

            this.log('Computed property defined:', path, dependencies);
        } catch (error) {
            this.logError('Error defining computed property:', path, error);
        }
    }

    /**
     * Update specific computed property
     */
    updateComputedProperty(path) {
        try {
            const computed = this.computedProperties.get(path);
            if (!computed) return;

            const newValue = computed.compute(this.state);
            const previousValue = computed.lastValue;

            if (!this.deepEqual(newValue, previousValue)) {
                computed.lastValue = newValue;
                this.set(path, newValue, { silent: true });
                this.notifyObservers(path, newValue, previousValue);
            }
        } catch (error) {
            this.logError('Error updating computed property:', path, error);
        }
    }

    /**
     * Update all computed properties that depend on changed path
     */
    updateComputedProperties(changedPath) {
        for (const [computedPath, computed] of this.computedProperties.entries()) {
            if (computed.dependencies.some(dep => changedPath.startsWith(dep))) {
                this.updateComputedProperty(computedPath);
            }
        }
    }

    // ==================== MIDDLEWARE SYSTEM ====================

    /**
     * Add middleware function for state changes
     */
    addMiddleware(middlewareFn) {
        if (typeof middlewareFn === 'function') {
            this.middleware.push(middlewareFn);
            this.log('Middleware added');
        }
    }

    /**
     * Remove middleware function
     */
    removeMiddleware(middlewareFn) {
        const index = this.middleware.indexOf(middlewareFn);
        if (index > -1) {
            this.middleware.splice(index, 1);
            this.log('Middleware removed');
        }
    }

    /**
     * Apply all middleware to state change
     */
    applyMiddleware(path, value, previousValue) {
        let processedValue = value;

        for (const middleware of this.middleware) {
            try {
                processedValue = middleware(path, processedValue, previousValue, this.state);
            } catch (error) {
                this.logError('Middleware error:', error);
            }
        }

        return processedValue;
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Generate unique observer ID
     */
    generateObserverId() {
        return `observer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Deep equality check for objects
     */
    deepEqual(obj1, obj2) {
        if (obj1 === obj2) return true;

        if (obj1 == null || obj2 == null) return obj1 === obj2;

        if (typeof obj1 !== typeof obj2) return false;

        if (typeof obj1 !== 'object') return obj1 === obj2;

        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);

        if (keys1.length !== keys2.length) return false;

        for (const key of keys1) {
            if (!keys2.includes(key)) return false;
            if (!this.deepEqual(obj1[key], obj2[key])) return false;
        }

        return true;
    }

    /**
     * Add state change to history
     */
    addToHistory(path, value, previousValue) {
        if (this.history.length >= this.config.maxHistorySize) {
            this.history.shift();
        }

        this.history.push({
            timestamp: Date.now(),
            path,
            value,
            previousValue,
            index: this.historyIndex++
        });
    }

    /**
     * Get state change history
     */
    getHistory(limit = 10) {
        return this.history.slice(-limit);
    }

    /**
     * Reset state to initial values
     */
    reset() {
        const initialState = {
            wallet: { isConnected: false, address: null, balance: '0', network: null, walletType: null },
            contracts: { isInitialized: false, stakingContract: null, rewardTokenContract: null, supportedTokens: [] },
            staking: { stakes: new Map(), rewards: new Map(), allowances: new Map(), balances: new Map() },
            pools: { poolData: new Map(), totalValueLocked: '0', totalRewardsDistributed: '0' },
            ui: { isLoading: false, currentPage: 'home', modals: { walletConnect: false, stakeModal: false, unstakeModal: false, claimModal: false }, notifications: [] },
            app: { isInitialized: false, lastUpdate: null, errors: [], theme: 'dark' }
        };

        this.state = initialState;
        this.notifyObservers('', this.state, {});
        this.log('State reset to initial values');
    }

    /**
     * Get current state snapshot
     */
    getSnapshot() {
        return JSON.parse(JSON.stringify(this.state));
    }

    /**
     * Load state from snapshot
     */
    loadSnapshot(snapshot) {
        try {
            this.state = JSON.parse(JSON.stringify(snapshot));
            this.notifyObservers('', this.state, {});
            this.log('State loaded from snapshot');
            return true;
        } catch (error) {
            this.logError('Error loading snapshot:', error);
            return false;
        }
    }

    /**
     * Get all active observers count
     */
    getObserverCount() {
        let total = 0;
        for (const observers of this.observers.values()) {
            total += observers.size;
        }
        return total;
    }

    /**
     * Cleanup all observers and reset state
     */
    cleanup() {
        this.observers.clear();
        this.computedProperties.clear();
        this.middleware = [];
        this.history = [];
        this.historyIndex = 0;
        this.reset();
        this.log('StateManager cleaned up');
    }

    /**
     * Logging utility
     */
    log(...args) {
        if (this.config.enableLogging && window.CONFIG?.DEV?.DEBUG_MODE) {
            console.log('[StateManager]', ...args);
        }
    }

    /**
     * Error logging utility
     */
    logError(...args) {
        console.error('[StateManager]', ...args);
    }
}

    // Export StateManager class to global scope
    global.StateManager = StateManager;

    // Note: Instance creation is now handled by SystemInitializer
    console.log('✅ StateManager class loaded');

})(window);
