/**
 * Enhanced Router - React Router-like routing system with browser history support
 * Features: Route guards, navigation hooks, browser history, nested routes, lazy loading
 *
 * ENHANCED SINGLETON PATTERN - Completely prevents redeclaration errors
 */
(function(global) {
    'use strict';

    // CRITICAL FIX: Enhanced redeclaration prevention with instance management
    if (global.Router) {
        console.warn('Router class already exists, skipping redeclaration');
        return;
    }

    // Check for existing instance and preserve it
    if (global.router) {
        console.warn('Router instance already exists, preserving existing instance');
        return;
    }

class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.currentComponent = null;
        this.listeners = new Set();
        this.isNavigating = false;

        // Enhanced features
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        this.navigationHooks = {
            beforeEach: [],
            afterEach: [],
            beforeResolve: []
        };
        this.routeParams = {};
        this.queryParams = {};
        this.nestedRoutes = new Map();
        this.lazyComponents = new Map();

        // Browser history support
        this.supportsPushState = !!(window.history && window.history.pushState);
        this.useHashRouting = !this.supportsPushState;

        this.init();
    }

    /**
     * Initialize enhanced router with browser history support
     */
    init() {
        // Set up event listeners based on browser support
        if (this.supportsPushState && !this.useHashRouting) {
            // Use HTML5 History API
            window.addEventListener('popstate', (e) => this.handlePopState(e));
            window.addEventListener('load', () => this.handleInitialRoute());
        } else {
            // Fallback to hash routing
            window.addEventListener('hashchange', () => this.handleHashChange());
            window.addEventListener('load', () => this.handleHashChange());
        }

        // Set up navigation link handlers with enhanced features
        this.setupNavigationLinks();

        // Set up keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Initialize history
        this.initializeHistory();

        this.log('Enhanced Router initialized with browser history support');
    }

    /**
     * Initialize history tracking
     */
    initializeHistory() {
        const currentPath = this.getCurrentPath();
        this.addToHistory(currentPath, { initial: true });
    }

    /**
     * Set up keyboard shortcuts for navigation
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Alt + Left Arrow - Go back
            if (e.altKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                this.back();
            }

            // Alt + Right Arrow - Go forward
            if (e.altKey && e.key === 'ArrowRight') {
                e.preventDefault();
                this.forward();
            }
        });
    }

    /**
     * Register a route with enhanced options
     */
    register(path, component, options = {}) {
        const route = {
            path,
            component,
            title: options.title || 'LP Staking Platform',
            requiresAuth: options.requiresAuth || false,
            requiresAdmin: options.requiresAdmin || false,
            beforeEnter: options.beforeEnter || null,
            afterEnter: options.afterEnter || null,
            // Enhanced options
            meta: options.meta || {},
            props: options.props || {},
            children: options.children || [],
            lazy: options.lazy || false,
            redirect: options.redirect || null,
            alias: options.alias || [],
            caseSensitive: options.caseSensitive || false
        };

        this.routes.set(path, route);

        // Register aliases
        if (route.alias.length > 0) {
            route.alias.forEach(aliasPath => {
                this.routes.set(aliasPath, { ...route, isAlias: true, originalPath: path });
            });
        }

        // Register nested routes
        if (route.children.length > 0) {
            this.registerNestedRoutes(path, route.children);
        }

        // Handle lazy loading
        if (route.lazy && typeof component === 'function') {
            this.lazyComponents.set(path, component);
        }

        this.log('Route registered:', path);

        return this;
    }

    /**
     * Register nested routes
     */
    registerNestedRoutes(parentPath, children) {
        children.forEach(child => {
            const childPath = this.joinPaths(parentPath, child.path);
            this.register(childPath, child.component, {
                ...child,
                parent: parentPath
            });
        });
    }

    /**
     * Join paths correctly
     */
    joinPaths(parent, child) {
        const cleanParent = parent.replace(/\/$/, '');
        const cleanChild = child.replace(/^\//, '');
        return `${cleanParent}/${cleanChild}`;
    }

    /**
     * Navigate to a route with enhanced browser history support
     */
    async navigate(path, options = {}) {
        const {
            replace = false,
            state = null,
            force = false,
            silent = false
        } = typeof options === 'boolean' ? { replace: options } : options;

        if (this.isNavigating && !force) {
            this.log('Navigation already in progress, ignoring:', path);
            return false;
        }

        try {
            this.log('Navigating to:', path);

            // Parse path and query parameters
            const { pathname, search, hash } = this.parsePath(path);
            const fullPath = pathname + search + hash;

            // Run beforeEach hooks
            const canNavigate = await this.runBeforeEachHooks(fullPath, this.getCurrentPath());
            if (!canNavigate) {
                this.log('Navigation blocked by beforeEach hook');
                return false;
            }

            // Update browser history
            if (!silent) {
                if (this.supportsPushState && !this.useHashRouting) {
                    if (replace) {
                        window.history.replaceState(state, '', fullPath);
                    } else {
                        window.history.pushState(state, '', fullPath);
                    }
                } else {
                    // Hash routing fallback
                    if (replace) {
                        window.location.replace(`#${fullPath}`);
                    } else {
                        window.location.hash = fullPath;
                    }
                }
            }

            // Add to internal history
            if (!replace) {
                this.addToHistory(fullPath, state);
            }

            // Handle route change
            if (!silent) {
                await this.handleRouteChange(fullPath);
            }

            return true;

        } catch (error) {
            this.logError('Navigation failed:', error);
            return false;
        }
    }

    /**
     * Go back in history with enhanced support
     */
    back() {
        if (this.canGoBack()) {
            if (this.supportsPushState && !this.useHashRouting) {
                window.history.back();
            } else {
                // Manual history management for hash routing
                if (this.historyIndex > 0) {
                    this.historyIndex--;
                    const previousPath = this.history[this.historyIndex].path;
                    this.navigate(previousPath, { silent: true });
                }
            }
        } else {
            this.log('Cannot go back, no previous history');
        }
    }

    /**
     * Go forward in history with enhanced support
     */
    forward() {
        if (this.canGoForward()) {
            if (this.supportsPushState && !this.useHashRouting) {
                window.history.forward();
            } else {
                // Manual history management for hash routing
                if (this.historyIndex < this.history.length - 1) {
                    this.historyIndex++;
                    const nextPath = this.history[this.historyIndex].path;
                    this.navigate(nextPath, { silent: true });
                }
            }
        } else {
            this.log('Cannot go forward, no next history');
        }
    }

    /**
     * Replace current route
     */
    replace(path, state = null) {
        return this.navigate(path, { replace: true, state });
    }

    /**
     * Check if can go back
     */
    canGoBack() {
        return this.historyIndex > 0;
    }

    /**
     * Check if can go forward
     */
    canGoForward() {
        return this.historyIndex < this.history.length - 1;
    }

    /**
     * Get current route path with enhanced parsing
     */
    getCurrentPath() {
        if (this.supportsPushState && !this.useHashRouting) {
            return window.location.pathname + window.location.search + window.location.hash;
        } else {
            return window.location.hash.slice(1) || '/';
        }
    }

    /**
     * Get current route object
     */
    getCurrentRoute() {
        return this.currentRoute;
    }

    /**
     * Parse path into components
     */
    parsePath(path) {
        const url = new URL(path, window.location.origin);
        return {
            pathname: url.pathname,
            search: url.search,
            hash: url.hash
        };
    }

    /**
     * Add navigation hooks (React Router-like)
     */
    beforeEach(hook) {
        this.navigationHooks.beforeEach.push(hook);
        return () => {
            const index = this.navigationHooks.beforeEach.indexOf(hook);
            if (index > -1) {
                this.navigationHooks.beforeEach.splice(index, 1);
            }
        };
    }

    afterEach(hook) {
        this.navigationHooks.afterEach.push(hook);
        return () => {
            const index = this.navigationHooks.afterEach.indexOf(hook);
            if (index > -1) {
                this.navigationHooks.afterEach.splice(index, 1);
            }
        };
    }

    beforeResolve(hook) {
        this.navigationHooks.beforeResolve.push(hook);
        return () => {
            const index = this.navigationHooks.beforeResolve.indexOf(hook);
            if (index > -1) {
                this.navigationHooks.beforeResolve.splice(index, 1);
            }
        };
    }

    /**
     * Run beforeEach hooks
     */
    async runBeforeEachHooks(to, from) {
        for (const hook of this.navigationHooks.beforeEach) {
            try {
                const result = await hook(to, from, (path) => {
                    if (path) {
                        this.navigate(path, { replace: true });
                    }
                });

                if (result === false) {
                    return false;
                }
            } catch (error) {
                this.logError('Error in beforeEach hook:', error);
                return false;
            }
        }
        return true;
    }

    /**
     * Run afterEach hooks
     */
    async runAfterEachHooks(to, from) {
        for (const hook of this.navigationHooks.afterEach) {
            try {
                await hook(to, from);
            } catch (error) {
                this.logError('Error in afterEach hook:', error);
            }
        }
    }

    /**
     * Add to internal history
     */
    addToHistory(path, state = null) {
        // Remove any forward history if we're not at the end
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        // Add new entry
        this.history.push({
            path,
            state,
            timestamp: Date.now()
        });

        this.historyIndex = this.history.length - 1;

        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    /**
     * Handle hash change events (legacy support)
     */
    async handleHashChange() {
        const path = this.getCurrentPath();
        await this.handleRouteChange(path);
    }

    /**
     * Handle popstate events (HTML5 History API)
     */
    async handlePopState(event) {
        const path = this.getCurrentPath();
        await this.handleRouteChange(path, event.state);
    }

    /**
     * Handle initial route on page load
     */
    async handleInitialRoute() {
        const path = this.getCurrentPath();
        await this.handleRouteChange(path);
    }

    /**
     * Enhanced route change handler
     */
    async handleRouteChange(path, state = null) {
        if (this.isNavigating) return;

        this.isNavigating = true;

        try {
            // Parse path and extract parameters
            const { pathname, search } = this.parsePath(path);
            this.parseQueryParams(search);

            const route = this.findRoute(pathname);

            if (!route) {
                this.log('Route not found:', path);
                await this.handleNotFound(path);
                return;
            }

            // Handle redirects
            if (route.redirect) {
                this.navigate(route.redirect, { replace: true });
                return;
            }

            // Extract route parameters
            this.routeParams = this.extractRouteParams(pathname, route.path);

            // Run beforeResolve hooks
            for (const hook of this.navigationHooks.beforeResolve) {
                try {
                    const result = await hook(route, this.currentRoute);
                    if (result === false) {
                        this.log('Route blocked by beforeResolve hook');
                        return;
                    }
                } catch (error) {
                    this.logError('Error in beforeResolve hook:', error);
                    return;
                }
            }

            // Check authentication requirements
            if (route.requiresAuth && !this.isAuthenticated()) {
                this.log('Route requires authentication:', path);
                await this.handleAuthRequired(route);
                return;
            }

            // Check admin requirements
            if (route.requiresAdmin && !this.isAdmin()) {
                this.log('Route requires admin access:', path);
                await this.handleAccessDenied(route);
                return;
            }

            // Execute beforeEnter hook
            if (route.beforeEnter) {
                const canEnter = await route.beforeEnter(route, this.currentRoute);
                if (canEnter === false) {
                    this.log('Route entry blocked by beforeEnter hook:', path);
                    return;
                }
            }

            // Clean up current component
            await this.cleanupCurrentComponent();

            // Update current route
            const previousRoute = this.currentRoute;
            this.currentRoute = route;

            // Update page title
            document.title = route.title;

            // Update active navigation links
            this.updateActiveNavigation(path);

            // Load and mount component
            await this.loadAndMountComponent(route, state);

            // Execute afterEnter hook
            if (route.afterEnter) {
                await route.afterEnter(route, previousRoute);
            }

            // Run afterEach hooks
            await this.runAfterEachHooks(path, previousRoute?.path);

            // Notify listeners
            this.notifyListeners('routeChanged', {
                route,
                previousRoute,
                path,
                params: this.routeParams,
                query: this.queryParams,
                state
            });

            this.log('Route changed successfully:', path);

        } catch (error) {
            this.logError('Route change failed:', error);
            await this.handleRouteError(error, path);
        } finally {
            this.isNavigating = false;
        }
    }

    /**
     * Parse query parameters
     */
    parseQueryParams(search) {
        this.queryParams = {};
        if (search) {
            const params = new URLSearchParams(search);
            for (const [key, value] of params) {
                this.queryParams[key] = value;
            }
        }
    }

    /**
     * Extract route parameters from path
     */
    extractRouteParams(actualPath, routePath) {
        const params = {};
        const actualSegments = actualPath.split('/').filter(Boolean);
        const routeSegments = routePath.split('/').filter(Boolean);

        for (let i = 0; i < routeSegments.length; i++) {
            const routeSegment = routeSegments[i];
            const actualSegment = actualSegments[i];

            if (routeSegment.startsWith(':')) {
                const paramName = routeSegment.slice(1);
                params[paramName] = actualSegment;
            }
        }

        return params;
    }

    /**
     * Clean up current component
     */
    async cleanupCurrentComponent() {
        if (this.currentComponent) {
            if (typeof this.currentComponent.componentWillUnmount === 'function') {
                this.currentComponent.componentWillUnmount();
            }
            if (typeof this.currentComponent.destroy === 'function') {
                this.currentComponent.destroy();
            }
            this.currentComponent = null;
        }
    }

    /**
     * Load and mount component with lazy loading support
     */
    async loadAndMountComponent(route, state = null) {
        let ComponentClass = route.component;

        // Handle lazy loading
        if (route.lazy && this.lazyComponents.has(route.path)) {
            try {
                ComponentClass = await this.lazyComponents.get(route.path)();
                if (ComponentClass.default) {
                    ComponentClass = ComponentClass.default;
                }
            } catch (error) {
                this.logError('Failed to load lazy component:', error);
                await this.handleComponentLoadError(error, route);
                return;
            }
        }

        // Create and mount component
        if (typeof ComponentClass === 'function') {
            try {
                this.currentComponent = new ComponentClass(null, {
                    ...route.props,
                    params: this.routeParams,
                    query: this.queryParams,
                    state
                });

                if (typeof this.currentComponent.mount === 'function') {
                    await this.currentComponent.mount();
                }
            } catch (error) {
                this.logError('Failed to mount component:', error);
                await this.handleComponentMountError(error, route);
            }
        } else if (typeof ComponentClass === 'string') {
            // Handle string-based components (HTML content)
            this.renderContent(ComponentClass);
        }
    }

    /**
     * Find route by path
     */
    findRoute(path) {
        // Exact match first
        if (this.routes.has(path)) {
            return this.routes.get(path);
        }

        // Try to find parameterized routes
        for (const [routePath, route] of this.routes) {
            if (this.matchRoute(routePath, path)) {
                return { ...route, params: this.extractParams(routePath, path) };
            }
        }

        return null;
    }

    /**
     * Match route with parameters
     */
    matchRoute(routePath, actualPath) {
        const routeParts = routePath.split('/');
        const actualParts = actualPath.split('/');

        if (routeParts.length !== actualParts.length) {
            return false;
        }

        return routeParts.every((part, index) => {
            return part.startsWith(':') || part === actualParts[index];
        });
    }

    /**
     * Extract parameters from route
     */
    extractParams(routePath, actualPath) {
        const routeParts = routePath.split('/');
        const actualParts = actualPath.split('/');
        const params = {};

        routeParts.forEach((part, index) => {
            if (part.startsWith(':')) {
                const paramName = part.slice(1);
                params[paramName] = actualParts[index];
            }
        });

        return params;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return window.walletManager?.isConnected() || false;
    }

    /**
     * Check if user is admin
     */
    isAdmin() {
        // This will be implemented when contract integration is ready
        // For now, just check if wallet is connected
        return this.isAuthenticated();
    }

    /**
     * Set up navigation link handlers
     */
    setupNavigationLinks() {
        document.addEventListener('click', (event) => {
            const link = event.target.closest('[data-route]');
            if (link) {
                event.preventDefault();
                const route = link.getAttribute('data-route');
                this.navigate(route);
            }
        });
    }

    /**
     * Update active navigation links
     */
    updateActiveNavigation(currentPath) {
        const navLinks = document.querySelectorAll('[data-route]');
        navLinks.forEach(link => {
            const route = link.getAttribute('data-route');
            if (route === currentPath) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    /**
     * Render string content
     */
    renderContent(content) {
        const appContent = document.getElementById('app-content');
        if (appContent) {
            appContent.innerHTML = content;
        }
    }

    /**
     * Show authentication required message
     */
    showAuthenticationRequired() {
        const content = `
            <div class="container">
                <div class="card" style="max-width: 500px; margin: 2rem auto;">
                    <div class="card-body text-center">
                        <h2>Authentication Required</h2>
                        <p>Please connect your wallet to access this page.</p>
                        <button id="connect-wallet-auth" class="btn btn-primary">
                            Connect Wallet
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.renderContent(content);
        
        // Add event listener for connect button
        const connectBtn = document.getElementById('connect-wallet-auth');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => {
                window.walletManager?.connectMetaMask();
            });
        }
    }

    /**
     * Show access denied message
     */
    showAccessDenied() {
        const content = `
            <div class="container">
                <div class="card" style="max-width: 500px; margin: 2rem auto;">
                    <div class="card-body text-center">
                        <h2>Access Denied</h2>
                        <p>You don't have permission to access this page.</p>
                        <button onclick="window.router.navigate('/')" class="btn btn-secondary">
                            Go Home
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.renderContent(content);
    }

    /**
     * Show error message
     */
    showError(message) {
        if (window.notificationManager) {
            window.notificationManager.show('error', 'Navigation Error', message);
        } else {
            alert(message);
        }
    }

    /**
     * Subscribe to router events
     */
    subscribe(callback) {
        this.listeners.add(callback);
        
        // Return unsubscribe function
        return () => {
            this.listeners.delete(callback);
        };
    }

    /**
     * Notify all listeners of events
     */
    notifyListeners(event, data) {
        this.listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                this.logError('Router listener callback error:', error);
            }
        });
    }

    /**
     * Get route parameters
     */
    getParams() {
        return this.currentRoute?.params || {};
    }

    /**
     * Get query parameters
     */
    getQuery() {
        const params = new URLSearchParams(window.location.search);
        const query = {};
        for (const [key, value] of params) {
            query[key] = value;
        }
        return query;
    }

    /**
     * Cleanup router
     */
    destroy() {
        window.removeEventListener('hashchange', this.handleHashChange);
        window.removeEventListener('load', this.handleHashChange);
        
        if (this.currentComponent && typeof this.currentComponent.destroy === 'function') {
            this.currentComponent.destroy();
        }
        
        this.listeners.clear();
        this.routes.clear();
    }

    /**
     * CRITICAL FIX: Handle route not found errors
     */
    async handleNotFound(path) {
        this.log('Handling 404 for path:', path);

        try {
            // Try to find a 404 route
            const notFoundRoute = this.routes.get('404') || this.routes.get('/404');

            if (notFoundRoute) {
                await this.renderRoute(notFoundRoute, path);
                return;
            }

            // Fallback to default 404 handling
            this.render404Page(path);

        } catch (error) {
            this.logError('Error in handleNotFound:', error);
            this.render404Page(path);
        }
    }

    /**
     * CRITICAL FIX: Handle route errors
     */
    async handleRouteError(error, path) {
        this.logError('Route error for path:', path, error);

        try {
            // Notify error handler if available
            if (window.errorHandler && typeof window.errorHandler.processError === 'function') {
                window.errorHandler.processError(error, {
                    context: 'routing',
                    path: path,
                    type: 'route_error'
                });
            }

            // Show user-friendly error message
            if (window.notificationManager && typeof window.notificationManager.error === 'function') {
                window.notificationManager.error(
                    'Navigation failed. Please try again or refresh the page.',
                    { duration: 5000 }
                );
            }

            // Try to recover by navigating to home
            if (path !== '/' && path !== '#/') {
                this.log('Attempting recovery by navigating to home');
                setTimeout(() => {
                    this.navigate('/', { replace: true });
                }, 1000);
            } else {
                // If home page failed, show critical error
                this.renderCriticalError(error);
            }

        } catch (recoveryError) {
            this.logError('Error in handleRouteError recovery:', recoveryError);
            this.renderCriticalError(error);
        }
    }

    /**
     * Render 404 page
     */
    render404Page(path) {
        const container = document.getElementById('app-content');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem 1rem; max-width: 600px; margin: 0 auto;">
                    <div style="font-size: 6rem; margin-bottom: 1rem;">🔍</div>
                    <h1 style="font-size: 2rem; margin-bottom: 1rem; color: #333;">Page Not Found</h1>
                    <p style="font-size: 1.1rem; color: #666; margin-bottom: 2rem;">
                        The page "${path}" could not be found.
                    </p>
                    <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                        <button onclick="window.router?.navigate('/')"
                                style="background: #007bff; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.375rem; cursor: pointer; font-size: 1rem;">
                            🏠 Go Home
                        </button>
                        <button onclick="window.history.back()"
                                style="background: #6c757d; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.375rem; cursor: pointer; font-size: 1rem;">
                            ← Go Back
                        </button>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Render critical error page
     */
    renderCriticalError(error) {
        const container = document.getElementById('app-content');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem 1rem; max-width: 600px; margin: 0 auto;">
                    <div style="font-size: 6rem; margin-bottom: 1rem;">⚠️</div>
                    <h1 style="font-size: 2rem; margin-bottom: 1rem; color: #dc3545;">Navigation Error</h1>
                    <p style="font-size: 1.1rem; color: #666; margin-bottom: 2rem;">
                        A critical error occurred during navigation. Please refresh the page.
                    </p>
                    <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 0.375rem; padding: 1rem; margin-bottom: 2rem; text-align: left;">
                        <strong>Error Details:</strong><br>
                        <code style="color: #dc3545;">${error.message || 'Unknown error'}</code>
                    </div>
                    <button onclick="window.router?.handleRecovery?.()"
                            style="background: #dc3545; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.375rem; cursor: pointer; font-size: 1rem;">
                        🔄 Retry Navigation
                    </button>
                </div>
            `;
        }
    }

    /**
     * Logging utility
     */
    log(...args) {
        if (window.CONFIG.DEV.DEBUG_MODE) {
            console.log('[Router]', ...args);
        }
    }

    /**
     * Error logging utility
     */
    logError(...args) {
        console.error('[Router]', ...args);
    }

    /**
     * Handle recovery from router errors without page reload
     */
    handleRecovery() {
        this.log('🔄 Attempting router recovery...');

        try {
            // Clear error state
            this.currentRoute = null;
            this.isNavigating = false;

            // Clear error displays
            const errorElements = document.querySelectorAll('[id*="error"], [class*="error"]');
            errorElements.forEach(el => {
                if (el.textContent.includes('router') || el.textContent.includes('navigation')) {
                    el.remove();
                }
            });

            // Try to navigate to home
            this.navigate('/', { replace: true });

            this.log('✅ Router recovery successful');
        } catch (error) {
            this.logError('❌ Router recovery failed:', error);
            // Only as last resort, show a message instead of reloading
            if (window.notificationManager) {
                window.notificationManager.error('Navigation Error', 'Please try refreshing the page manually');
            }
        }
    }
}

    // Export Router class to global scope
    global.Router = Router;

    // Note: Instance creation is now handled by SystemInitializer
    console.log('✅ Router class loaded');

})(window);
