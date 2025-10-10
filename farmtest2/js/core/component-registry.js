/**
 * ComponentRegistry - Comprehensive component lifecycle management system
 * Features: Component registration, lifecycle tracking, memory leak prevention
 * Provides centralized management for all application components
 */
class ComponentRegistry {
    constructor() {
        // Component storage
        this.components = new Map();
        this.componentsByType = new Map();
        this.componentHierarchy = new Map();
        
        // Lifecycle tracking
        this.lifecycleHooks = new Map();
        this.globalHooks = {
            beforeMount: [],
            afterMount: [],
            beforeUpdate: [],
            afterUpdate: [],
            beforeUnmount: [],
            afterUnmount: [],
            onError: []
        };
        
        // Performance monitoring
        this.performanceMetrics = new Map();
        this.renderTimes = new Map();
        this.updateCounts = new Map();
        
        // Memory management
        this.cleanupTasks = new Set();
        this.memoryLeakDetection = true;
        this.maxComponents = 1000;
        
        // Development mode features
        this.isDevelopment = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1';
        this.debugMode = this.isDevelopment;
        
        // Auto-cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, 30000); // Every 30 seconds
        
        // Bind methods
        this.register = this.register.bind(this);
        this.unregister = this.unregister.bind(this);
        this.get = this.get.bind(this);
        this.getByType = this.getByType.bind(this);
        this.destroy = this.destroy.bind(this);
        
        this.log('ComponentRegistry initialized');
    }

    /**
     * Register a component
     */
    register(component, options = {}) {
        if (!component || typeof component !== 'object') {
            throw new Error('Invalid component provided to registry');
        }

        // Generate unique ID if not provided
        const id = options.id || this.generateId(component);
        
        // Prevent duplicate registration
        if (this.components.has(id)) {
            this.warn(`Component ${id} is already registered`);
            return id;
        }

        // Check component limit
        if (this.components.size >= this.maxComponents) {
            this.error(`Component limit reached (${this.maxComponents}). Performing cleanup.`);
            this.performCleanup();
        }

        // Component metadata
        const metadata = {
            id,
            component,
            type: component.constructor.name,
            registeredAt: Date.now(),
            mountedAt: null,
            unmountedAt: null,
            updateCount: 0,
            renderCount: 0,
            errorCount: 0,
            parent: options.parent || null,
            children: new Set(),
            selector: component.selector || null,
            element: component.element || null,
            isActive: true,
            ...options
        };

        // Store component
        this.components.set(id, metadata);
        
        // Store by type
        if (!this.componentsByType.has(metadata.type)) {
            this.componentsByType.set(metadata.type, new Set());
        }
        this.componentsByType.get(metadata.type).add(id);
        
        // Set up hierarchy
        if (metadata.parent) {
            const parentMeta = this.components.get(metadata.parent);
            if (parentMeta) {
                parentMeta.children.add(id);
                this.componentHierarchy.set(id, metadata.parent);
            }
        }
        
        // Initialize performance tracking
        this.performanceMetrics.set(id, {
            mountTime: 0,
            renderTime: 0,
            updateTime: 0,
            totalRenderTime: 0,
            averageRenderTime: 0
        });
        
        // Set up component lifecycle hooks
        this.setupComponentHooks(component, id);
        
        this.log(`Component registered: ${id} (${metadata.type})`);
        return id;
    }

    /**
     * Unregister a component
     */
    unregister(id) {
        const metadata = this.components.get(id);
        if (!metadata) {
            this.warn(`Component ${id} not found in registry`);
            return false;
        }

        // Unregister children first
        for (const childId of metadata.children) {
            this.unregister(childId);
        }

        // Remove from parent's children
        if (metadata.parent) {
            const parentMeta = this.components.get(metadata.parent);
            if (parentMeta) {
                parentMeta.children.delete(id);
            }
        }

        // Clean up component
        try {
            if (metadata.component && typeof metadata.component.destroy === 'function') {
                metadata.component.destroy();
            }
        } catch (error) {
            this.error(`Error destroying component ${id}:`, error);
        }

        // Remove from all storage
        this.components.delete(id);
        this.componentsByType.get(metadata.type)?.delete(id);
        this.componentHierarchy.delete(id);
        this.performanceMetrics.delete(id);
        this.renderTimes.delete(id);
        this.updateCounts.delete(id);
        
        // Remove lifecycle hooks
        this.lifecycleHooks.delete(id);

        this.log(`Component unregistered: ${id} (${metadata.type})`);
        return true;
    }

    /**
     * Get component by ID
     */
    get(id) {
        const metadata = this.components.get(id);
        return metadata ? metadata.component : null;
    }

    /**
     * Get components by type
     */
    getByType(type) {
        const ids = this.componentsByType.get(type);
        if (!ids) return [];
        
        return Array.from(ids)
            .map(id => this.components.get(id))
            .filter(meta => meta && meta.isActive)
            .map(meta => meta.component);
    }

    /**
     * Get all registered components
     */
    getAll() {
        return Array.from(this.components.values())
            .filter(meta => meta.isActive)
            .map(meta => meta.component);
    }

    /**
     * Get component metadata
     */
    getMetadata(id) {
        return this.components.get(id);
    }

    /**
     * Get component hierarchy
     */
    getHierarchy(id) {
        const metadata = this.components.get(id);
        if (!metadata) return null;

        return {
            id,
            type: metadata.type,
            parent: metadata.parent,
            children: Array.from(metadata.children),
            depth: this.getComponentDepth(id)
        };
    }

    /**
     * Get component depth in hierarchy
     */
    getComponentDepth(id, depth = 0) {
        const parent = this.componentHierarchy.get(id);
        if (!parent) return depth;
        return this.getComponentDepth(parent, depth + 1);
    }

    /**
     * Set up component lifecycle hooks
     */
    setupComponentHooks(component, id) {
        const metadata = this.components.get(id);
        if (!metadata) return;

        // Override lifecycle methods to track performance
        const originalMethods = {};
        
        // Mount tracking
        if (typeof component.componentDidMount === 'function') {
            originalMethods.componentDidMount = component.componentDidMount;
            component.componentDidMount = async (...args) => {
                const startTime = performance.now();
                
                // Execute global before hooks
                await this.executeGlobalHooks('beforeMount', component, id);
                
                try {
                    metadata.mountedAt = Date.now();
                    const result = await originalMethods.componentDidMount.apply(component, args);
                    
                    const mountTime = performance.now() - startTime;
                    this.performanceMetrics.get(id).mountTime = mountTime;
                    
                    // Execute global after hooks
                    await this.executeGlobalHooks('afterMount', component, id);
                    
                    this.log(`Component mounted: ${id} (${mountTime.toFixed(2)}ms)`);
                    return result;
                } catch (error) {
                    metadata.errorCount++;
                    await this.executeGlobalHooks('onError', component, id, error);
                    throw error;
                }
            };
        }

        // Update tracking
        if (typeof component.componentDidUpdate === 'function') {
            originalMethods.componentDidUpdate = component.componentDidUpdate;
            component.componentDidUpdate = async (...args) => {
                const startTime = performance.now();
                
                await this.executeGlobalHooks('beforeUpdate', component, id);
                
                try {
                    metadata.updateCount++;
                    const result = await originalMethods.componentDidUpdate.apply(component, args);
                    
                    const updateTime = performance.now() - startTime;
                    this.performanceMetrics.get(id).updateTime = updateTime;
                    
                    await this.executeGlobalHooks('afterUpdate', component, id);
                    
                    return result;
                } catch (error) {
                    metadata.errorCount++;
                    await this.executeGlobalHooks('onError', component, id, error);
                    throw error;
                }
            };
        }

        // Unmount tracking
        if (typeof component.componentWillUnmount === 'function') {
            originalMethods.componentWillUnmount = component.componentWillUnmount;
            component.componentWillUnmount = async (...args) => {
                await this.executeGlobalHooks('beforeUnmount', component, id);
                
                try {
                    metadata.unmountedAt = Date.now();
                    const result = await originalMethods.componentWillUnmount.apply(component, args);
                    
                    await this.executeGlobalHooks('afterUnmount', component, id);
                    
                    this.log(`Component unmounted: ${id}`);
                    return result;
                } catch (error) {
                    metadata.errorCount++;
                    await this.executeGlobalHooks('onError', component, id, error);
                    throw error;
                }
            };
        }

        // Render tracking
        if (typeof component.render === 'function') {
            originalMethods.render = component.render;
            component.render = async (...args) => {
                const startTime = performance.now();
                
                try {
                    metadata.renderCount++;
                    const result = await originalMethods.render.apply(component, args);
                    
                    const renderTime = performance.now() - startTime;
                    const metrics = this.performanceMetrics.get(id);
                    metrics.renderTime = renderTime;
                    metrics.totalRenderTime += renderTime;
                    metrics.averageRenderTime = metrics.totalRenderTime / metadata.renderCount;
                    
                    return result;
                } catch (error) {
                    metadata.errorCount++;
                    await this.executeGlobalHooks('onError', component, id, error);
                    throw error;
                }
            };
        }
    }

    /**
     * Execute global lifecycle hooks
     */
    async executeGlobalHooks(hookName, component, id, ...args) {
        const hooks = this.globalHooks[hookName] || [];

        for (const hook of hooks) {
            try {
                await hook(component, id, ...args);
            } catch (error) {
                this.error(`Error in global ${hookName} hook:`, error);
            }
        }
    }

    /**
     * Add global lifecycle hook
     */
    addGlobalHook(hookName, callback) {
        if (!this.globalHooks[hookName]) {
            this.globalHooks[hookName] = [];
        }

        this.globalHooks[hookName].push(callback);
        this.log(`Global ${hookName} hook added`);
    }

    /**
     * Remove global lifecycle hook
     */
    removeGlobalHook(hookName, callback) {
        if (!this.globalHooks[hookName]) return false;

        const index = this.globalHooks[hookName].indexOf(callback);
        if (index > -1) {
            this.globalHooks[hookName].splice(index, 1);
            this.log(`Global ${hookName} hook removed`);
            return true;
        }

        return false;
    }

    /**
     * Generate unique component ID
     */
    generateId(component) {
        const type = component.constructor.name;
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `${type}_${timestamp}_${random}`;
    }

    /**
     * Perform cleanup of inactive components
     */
    performCleanup() {
        const now = Date.now();
        const cleanupThreshold = 5 * 60 * 1000; // 5 minutes
        let cleanedCount = 0;

        for (const [id, metadata] of this.components.entries()) {
            // Clean up unmounted components that have been inactive
            if (metadata.unmountedAt &&
                (now - metadata.unmountedAt) > cleanupThreshold) {
                this.unregister(id);
                cleanedCount++;
            }

            // Clean up components with no element reference
            else if (metadata.component &&
                     metadata.component.element &&
                     !document.contains(metadata.component.element)) {
                metadata.isActive = false;
                this.log(`Component ${id} marked as inactive (element not in DOM)`);
            }
        }

        if (cleanedCount > 0) {
            this.log(`Cleanup completed: ${cleanedCount} components removed`);
        }

        // Execute custom cleanup tasks
        for (const task of this.cleanupTasks) {
            try {
                task();
            } catch (error) {
                this.error('Error in cleanup task:', error);
            }
        }
    }

    /**
     * Add custom cleanup task
     */
    addCleanupTask(task) {
        if (typeof task === 'function') {
            this.cleanupTasks.add(task);
        }
    }

    /**
     * Remove custom cleanup task
     */
    removeCleanupTask(task) {
        this.cleanupTasks.delete(task);
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics(id = null) {
        if (id) {
            const metadata = this.components.get(id);
            const metrics = this.performanceMetrics.get(id);

            if (!metadata || !metrics) return null;

            return {
                id,
                type: metadata.type,
                mountTime: metrics.mountTime,
                renderTime: metrics.renderTime,
                updateTime: metrics.updateTime,
                totalRenderTime: metrics.totalRenderTime,
                averageRenderTime: metrics.averageRenderTime,
                renderCount: metadata.renderCount,
                updateCount: metadata.updateCount,
                errorCount: metadata.errorCount,
                uptime: metadata.mountedAt ? Date.now() - metadata.mountedAt : 0
            };
        }

        // Return all metrics
        const allMetrics = [];
        for (const [componentId, metadata] of this.components.entries()) {
            const componentMetrics = this.getPerformanceMetrics(componentId);
            if (componentMetrics) {
                allMetrics.push(componentMetrics);
            }
        }

        return allMetrics;
    }

    /**
     * Get registry statistics
     */
    getStatistics() {
        const stats = {
            totalComponents: this.components.size,
            activeComponents: 0,
            inactiveComponents: 0,
            componentsByType: {},
            averageRenderTime: 0,
            totalRenderTime: 0,
            totalErrors: 0,
            memoryUsage: this.getMemoryUsage()
        };

        let totalRenderTime = 0;
        let renderCount = 0;

        for (const [id, metadata] of this.components.entries()) {
            if (metadata.isActive) {
                stats.activeComponents++;
            } else {
                stats.inactiveComponents++;
            }

            // Count by type
            if (!stats.componentsByType[metadata.type]) {
                stats.componentsByType[metadata.type] = 0;
            }
            stats.componentsByType[metadata.type]++;

            // Aggregate metrics
            const metrics = this.performanceMetrics.get(id);
            if (metrics) {
                totalRenderTime += metrics.totalRenderTime;
                renderCount += metadata.renderCount;
            }

            stats.totalErrors += metadata.errorCount;
        }

        stats.totalRenderTime = totalRenderTime;
        stats.averageRenderTime = renderCount > 0 ? totalRenderTime / renderCount : 0;

        return stats;
    }

    /**
     * Get memory usage estimation
     */
    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }

        return null;
    }

    /**
     * Enable/disable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        this.log(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Destroy registry and cleanup all components
     */
    destroy() {
        this.log('Destroying ComponentRegistry...');

        // Clear cleanup interval
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        // Unregister all components
        const componentIds = Array.from(this.components.keys());
        for (const id of componentIds) {
            this.unregister(id);
        }

        // Clear all storage
        this.components.clear();
        this.componentsByType.clear();
        this.componentHierarchy.clear();
        this.performanceMetrics.clear();
        this.renderTimes.clear();
        this.updateCounts.clear();
        this.lifecycleHooks.clear();
        this.cleanupTasks.clear();

        // Clear global hooks
        for (const hookName in this.globalHooks) {
            this.globalHooks[hookName] = [];
        }

        this.log('ComponentRegistry destroyed');
    }

    /**
     * Logging methods
     */
    log(message, ...args) {
        if (this.debugMode) {
            console.log(`[ComponentRegistry] ${message}`, ...args);
        }
    }

    warn(message, ...args) {
        if (this.debugMode) {
            console.warn(`[ComponentRegistry] ${message}`, ...args);
        }
    }

    error(message, ...args) {
        console.error(`[ComponentRegistry] ${message}`, ...args);
    }
}

// Create global instance
window.componentRegistry = new ComponentRegistry();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ComponentRegistry;
}
