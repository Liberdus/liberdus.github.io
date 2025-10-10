
class BaseComponent {
    constructor(selector = null, props = {}) {
        this.selector = selector;
        this.element = null;
        this.isDestroyed = false;
        this.isMounted = false;
        this.isUpdating = false;


        this.props = { ...props };
        this.state = {};
        this.prevProps = {};
        this.prevState = {};


        this.eventListeners = [];
        this.stateSubscriptions = [];
        this.childComponents = new Map();
        this.refs = new Map();

        // Performance optimization
        this.shouldUpdateCache = new Map();
        this.renderCache = null;
        this.updateScheduled = false;

        // Error handling
        this.errorBoundary = null;
        this.hasError = false;

        // Bind methods to preserve context
        this.mount = this.mount.bind(this);
        this.unmount = this.unmount.bind(this);
        this.destroy = this.destroy.bind(this);
        this.render = this.render.bind(this);
        this.update = this.update.bind(this);
        this.setState = this.setState.bind(this);
        this.forceUpdate = this.forceUpdate.bind(this);

        // Register with ComponentRegistry
        this.registryId = null;
        if (window.componentRegistry) {
            this.registryId = window.componentRegistry.register(this, {
                selector: this.selector,
                parent: props.parent || null
            });
        }

        // Initialize component
        this.initializeComponent();
    }

    /**
     * Initialize component with default state
     */
    initializeComponent() {
        // Override in subclasses to set initial state
        this.state = this.getInitialState();
    }

    /**
     * Get initial state (override in subclasses)
     */
    getInitialState() {
        return {};
    }

    /**
     * Mount component to DOM with React-like lifecycle
     */
    async mount(container = null, props = {}) {
        if (this.isDestroyed) {
            throw new Error('Cannot mount destroyed component');
        }

        if (this.isMounted) {
            this.log('Component already mounted, updating props instead');
            this.updateProps(props);
            return;
        }

        try {
            // Update props if provided
            if (Object.keys(props).length > 0) {
                this.updateProps(props);
            }

            // Find container element
            if (container) {
                this.element = typeof container === 'string'
                    ? document.querySelector(container)
                    : container;
            } else if (this.selector) {
                this.element = document.querySelector(this.selector);
            }

            if (!this.element) {
                throw new Error(`Container not found: ${container || this.selector}`);
            }

            // React-like lifecycle: componentWillMount (deprecated but for compatibility)
            await this.componentWillMount();

            // Call lifecycle hooks
            await this.beforeMount();

            // Render component
            const content = await this.render();
            if (content) {
                this.element.innerHTML = content;
            }

            // Set up refs
            this.setupRefs();

            // Set up event listeners
            this.setupEventListeners();

            // Set up state subscriptions
            this.setupStateSubscriptions();

            this.isMounted = true;

            // React-like lifecycle: componentDidMount
            await this.componentDidMount();

            // Call lifecycle hooks
            await this.afterMount();

            this.log('Component mounted successfully');

        } catch (error) {
            this.handleError(error, 'mount');
            throw error;
        }
    }

    /**
     * Unmount component from DOM with React-like lifecycle
     */
    unmount() {
        if (this.isDestroyed || !this.isMounted) return;

        try {
            // React-like lifecycle: componentWillUnmount
            this.componentWillUnmount();

            // Call lifecycle hook
            this.beforeUnmount();

            // Clean up child components
            for (const [key, child] of this.childComponents) {
                if (child && typeof child.destroy === 'function') {
                    child.destroy();
                }
            }
            this.childComponents.clear();

            // Clean up refs
            this.refs.clear();

            // Clean up event listeners
            this.cleanupEventListeners();

            // Clean up state subscriptions
            this.cleanupStateSubscriptions();

            // Clear DOM content
            if (this.element) {
                this.element.innerHTML = '';
            }

            this.isMounted = false;

            // Call lifecycle hook
            this.afterUnmount();

            this.log('Component unmounted successfully');

        } catch (error) {
            this.handleError(error, 'unmount');
        }
    }

    /**
     * Destroy component completely with cleanup
     */
    destroy() {
        if (this.isDestroyed) return;

        // Unmount if still mounted
        if (this.isMounted) {
            this.unmount();
        }

        // Unregister from ComponentRegistry
        if (this.registryId && window.componentRegistry) {
            window.componentRegistry.unregister(this.registryId);
            this.registryId = null;
        }

        // Clear all references
        this.isDestroyed = true;
        this.isMounted = false;
        this.element = null;
        this.props = {};
        this.state = {};
        this.prevProps = {};
        this.prevState = {};
        this.refs.clear();
        this.childComponents.clear();
        this.shouldUpdateCache.clear();
        this.renderCache = null;
        this.errorBoundary = null;
        this.parent = null;

        this.log('Component destroyed');
    }

    /**
     * Render component content (override in subclasses)
     */
    async render() {
        return '';
    }

    /**
     * Update component with React-like lifecycle and optimization
     */
    async update(newProps = {}, forceUpdate = false) {
        if (this.isDestroyed || !this.element || !this.isMounted) return;

        if (this.isUpdating && !forceUpdate) {
            this.log('Update already in progress, skipping');
            return;
        }

        try {
            this.isUpdating = true;

            // Store previous state and props
            this.prevProps = { ...this.props };
            this.prevState = { ...this.state };

            // Update props if provided
            if (Object.keys(newProps).length > 0) {
                this.updateProps(newProps);
            }

            // React-like lifecycle: shouldComponentUpdate
            if (!forceUpdate && !this.shouldComponentUpdate(this.props, this.state)) {
                this.isUpdating = false;
                return;
            }

            // React-like lifecycle: componentWillUpdate (deprecated but for compatibility)
            await this.componentWillUpdate(this.props, this.state);

            // Call lifecycle hook
            await this.beforeUpdate();

            // Render component
            const content = await this.render();
            if (content) {
                this.element.innerHTML = content;
                this.setupRefs();
                this.setupEventListeners();
            }

            // React-like lifecycle: componentDidUpdate
            await this.componentDidUpdate(this.prevProps, this.prevState);

            // Call lifecycle hook
            await this.afterUpdate();

            this.log('Component updated successfully');

        } catch (error) {
            this.handleError(error, 'update');
        } finally {
            this.isUpdating = false;
        }
    }

    /**
     * Force update component (bypass shouldComponentUpdate)
     */
    async forceUpdate() {
        await this.update({}, true);
    }

    /**
     * Set component state with React-like behavior
     */
    setState(partialState, callback = null) {
        if (this.isDestroyed) return;

        // Merge with current state
        const newState = { ...this.state, ...partialState };

        // Check if state actually changed
        if (this.shallowEqual(this.state, newState)) {
            if (callback) callback();
            return;
        }

        this.state = newState;

        // Schedule update
        this.scheduleUpdate();

        // Call callback after update
        if (callback) {
            this.nextTick(callback);
        }
    }

    /**
     * Update props and trigger re-render if needed
     */
    updateProps(newProps) {
        const prevProps = { ...this.props };
        this.props = { ...this.props, ...newProps };

        if (!this.shallowEqual(prevProps, this.props)) {
            this.scheduleUpdate();
        }
    }

    /**
     * Schedule component update (batched)
     */
    scheduleUpdate() {
        if (this.updateScheduled) return;

        this.updateScheduled = true;
        this.nextTick(() => {
            this.updateScheduled = false;
            this.update();
        });
    }

    /**
     * Set up refs from DOM elements
     */
    setupRefs() {
        if (!this.element) return;

        // Clear existing refs
        this.refs.clear();

        // Find all elements with ref attributes
        const refElements = this.element.querySelectorAll('[data-ref]');
        refElements.forEach(el => {
            const refName = el.getAttribute('data-ref');
            this.refs.set(refName, el);
        });
    }

    /**
     * Get ref by name
     */
    ref(name) {
        return this.refs.get(name);
    }

    /**
     * Set up event listeners (override in subclasses)
     */
    setupEventListeners() {
        // Override in subclasses
    }

    /**
     * Set up state subscriptions (override in subclasses)
     */
    setupStateSubscriptions() {
        // Override in subclasses
    }

    // ============ React-like Lifecycle Methods ============

    /**
     * Called before component mounts (deprecated in React but useful for compatibility)
     */
    async componentWillMount() {
        // Override in subclasses
    }

    /**
     * Called after component mounts
     */
    async componentDidMount() {
        // Override in subclasses
    }

    /**
     * Determine if component should update
     */
    shouldComponentUpdate(nextProps, nextState) {
        // Default: update if props or state changed
        return !this.shallowEqual(this.props, nextProps) ||
               !this.shallowEqual(this.state, nextState);
    }

    /**
     * Called before component updates (deprecated in React but useful for compatibility)
     */
    async componentWillUpdate(nextProps, nextState) {
        // Override in subclasses
    }

    /**
     * Called after component updates
     */
    async componentDidUpdate(prevProps, prevState) {
        // Override in subclasses
    }

    /**
     * Called before component unmounts
     */
    componentWillUnmount() {
        // Override in subclasses
    }

    /**
     * Error boundary - called when component catches an error
     */
    componentDidCatch(error, errorInfo) {
        this.logError('Component error caught:', error, errorInfo);
        this.hasError = true;

        // Override in subclasses for custom error handling
        return this.renderError(error, errorInfo);
    }

    /**
     * Render error state
     */
    renderError(error, errorInfo) {
        return `
            <div class="component-error">
                <h3>Something went wrong</h3>
                <p>Component: ${this.constructor.name}</p>
                <details>
                    <summary>Error Details</summary>
                    <pre>${error.message}</pre>
                    <pre>${error.stack}</pre>
                </details>
            </div>
        `;
    }

    /**
     * Add event listener with automatic cleanup
     */
    addEventListener(element, event, handler, options = {}) {
        if (!element) return;

        const cleanup = () => {
            element.removeEventListener(event, handler, options);
        };

        element.addEventListener(event, handler, options);
        this.eventListeners.push(cleanup);

        return cleanup;
    }

    /**
     * Subscribe to state changes with automatic cleanup
     */
    subscribeToState(path, callback) {
        if (!window.stateManager) return;

        const unsubscribe = window.stateManager.subscribe(path, callback);
        this.stateSubscriptions.push(unsubscribe);

        return unsubscribe;
    }

    /**
     * Get state value
     */
    getState(path) {
        return window.stateManager?.get(path);
    }

    /**
     * Set state value
     */
    setState(path, value, options = {}) {
        return window.stateManager?.set(path, value, options);
    }

    /**
     * Find element within component
     */
    $(selector) {
        return this.element ? this.element.querySelector(selector) : null;
    }

    /**
     * Find all elements within component
     */
    $$(selector) {
        return this.element ? this.element.querySelectorAll(selector) : [];
    }

    /**
     * Show element
     */
    show(element = null) {
        const target = element || this.element;
        if (target) {
            target.style.display = '';
            target.removeAttribute('hidden');
        }
    }

    /**
     * Hide element
     */
    hide(element = null) {
        const target = element || this.element;
        if (target) {
            target.style.display = 'none';
        }
    }

    /**
     * Toggle element visibility
     */
    toggle(element = null) {
        const target = element || this.element;
        if (target) {
            if (target.style.display === 'none') {
                this.show(target);
            } else {
                this.hide(target);
            }
        }
    }

    /**
     * Add CSS class
     */
    addClass(className, element = null) {
        const target = element || this.element;
        if (target) {
            target.classList.add(className);
        }
    }

    /**
     * Remove CSS class
     */
    removeClass(className, element = null) {
        const target = element || this.element;
        if (target) {
            target.classList.remove(className);
        }
    }

    /**
     * Toggle CSS class
     */
    toggleClass(className, element = null) {
        const target = element || this.element;
        if (target) {
            target.classList.toggle(className);
        }
    }

    /**
     * Clean up event listeners
     */
    cleanupEventListeners() {
        this.eventListeners.forEach(cleanup => {
            try {
                cleanup();
            } catch (error) {
                this.logError('Error cleaning up event listener:', error);
            }
        });
        this.eventListeners = [];
    }

    /**
     * Clean up state subscriptions
     */
    cleanupStateSubscriptions() {
        this.stateSubscriptions.forEach(unsubscribe => {
            try {
                unsubscribe();
            } catch (error) {
                this.logError('Error cleaning up state subscription:', error);
            }
        });
        this.stateSubscriptions = [];
    }

    /**
     * Add child component with enhanced management
     */
    addChild(key, component) {
        if (typeof key === 'object') {
            // If first argument is component, generate key
            component = key;
            key = `child-${this.childComponents.size}`;
        }

        // Remove existing child with same key
        if (this.childComponents.has(key)) {
            this.removeChild(key);
        }

        this.childComponents.set(key, component);

        // Set parent reference
        if (component && typeof component === 'object') {
            component.parent = this;
        }

        return component;
    }

    /**
     * Remove child component by key
     */
    removeChild(key) {
        const component = this.childComponents.get(key);
        if (component) {
            this.childComponents.delete(key);

            // Clean up parent reference
            if (component.parent === this) {
                component.parent = null;
            }

            // Destroy component
            if (component && typeof component.destroy === 'function') {
                component.destroy();
            }
        }
        return component;
    }

    /**
     * Get child component by key
     */
    getChild(key) {
        return this.childComponents.get(key);
    }

    /**
     * Create and add child component
     */
    createChild(key, ComponentClass, ...args) {
        if (typeof key === 'function') {
            // If first argument is ComponentClass, generate key
            ComponentClass = key;
            key = `child-${this.childComponents.size}`;
            args = Array.from(arguments).slice(1);
        }

        const component = new ComponentClass(...args);
        this.addChild(key, component);
        return component;
    }

    /**
     * Find child component by type
     */
    findChild(ComponentClass) {
        for (const component of this.childComponents.values()) {
            if (component instanceof ComponentClass) {
                return component;
            }
        }
        return null;
    }

    /**
     * Find all child components by type
     */
    findChildren(ComponentClass) {
        const results = [];
        for (const component of this.childComponents.values()) {
            if (component instanceof ComponentClass) {
                results.push(component);
            }
        }
        return results;
    }

    /**
     * Get all child components
     */
    getAllChildren() {
        return Array.from(this.childComponents.values());
    }

    /**
     * Emit custom event
     */
    emit(eventName, data = null) {
        const event = new CustomEvent(eventName, {
            detail: data,
            bubbles: true,
            cancelable: true
        });

        if (this.element) {
            this.element.dispatchEvent(event);
        }

        return event;
    }

    /**
     * Listen for custom events
     */
    on(eventName, handler, options = {}) {
        if (!this.element) return;

        return this.addEventListener(this.element, eventName, handler, options);
    }

    /**
     * Listen for custom events once
     */
    once(eventName, handler, options = {}) {
        if (!this.element) return;

        const onceHandler = (event) => {
            handler(event);
            this.element.removeEventListener(eventName, onceHandler, options);
        };

        return this.addEventListener(this.element, eventName, onceHandler, options);
    }

    // ============ Utility Methods ============

    /**
     * Shallow equality check for objects
     */
    shallowEqual(obj1, obj2) {
        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);

        if (keys1.length !== keys2.length) {
            return false;
        }

        for (let key of keys1) {
            if (obj1[key] !== obj2[key]) {
                return false;
            }
        }

        return true;
    }

    /**
     * Schedule callback for next tick
     */
    nextTick(callback) {
        if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(callback);
        } else {
            setTimeout(callback, 0);
        }
    }

    /**
     * Handle component errors
     */
    handleError(error, context = 'unknown') {
        this.hasError = true;

        // Try to use error boundary
        if (this.errorBoundary && typeof this.errorBoundary.componentDidCatch === 'function') {
            return this.errorBoundary.componentDidCatch(error, { context, component: this });
        }

        // Fallback to component's own error handling
        const errorContent = this.componentDidCatch(error, { context, component: this });
        if (errorContent && this.element) {
            this.element.innerHTML = errorContent;
        }

        this.logError(`Error in ${context}:`, error);
    }

    /**
     * Set error boundary component
     */
    setErrorBoundary(errorBoundary) {
        this.errorBoundary = errorBoundary;
    }

    /**
     * Check if component has error
     */
    hasErrorState() {
        return this.hasError;
    }

    /**
     * Clear error state
     */
    clearError() {
        this.hasError = false;
    }

    /**
     * Create element with attributes
     */
    createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);

        // Set attributes
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else if (key.startsWith('data-') || key.startsWith('aria-')) {
                element.setAttribute(key, value);
            } else {
                element[key] = value;
            }
        });

        // Add children
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof HTMLElement) {
                element.appendChild(child);
            }
        });

        return element;
    }

    /**
     * Debounce function calls
     */
    debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(this, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(this, args);
        };
    }

    /**
     * Throttle function calls
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // ============ Lifecycle Hooks (override in subclasses) ============
    async beforeMount() {}
    async afterMount() {}
    async beforeUpdate() {}
    async afterUpdate() {}
    beforeUnmount() {}
    afterUnmount() {}

    /**
     * Logging utility
     */
    log(...args) {
        if (window.CONFIG?.DEV?.DEBUG_MODE) {
            console.log(`[${this.constructor.name}]`, ...args);
        }
    }

    /**
     * Error logging utility
     */
    logError(...args) {
        console.error(`[${this.constructor.name}]`, ...args);
    }
}

// Export for use in other components
window.BaseComponent = BaseComponent;
