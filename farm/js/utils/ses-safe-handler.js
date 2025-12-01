/**
 * SES-Safe Error Handler
 * Handles SES (Secure EcmaScript) lockdown issues gracefully
 */

class SESSafeHandler {
    constructor() {
        this.sesDetected = false;
        this.init();
    }

    init() {
        this.detectSES();
        this.setupSafeHandlers();
        this.patchProblematicAPIs();
    }

    detectSES() {
        try {
            // Check for SES lockdown indicators
            if (typeof lockdown !== 'undefined' || 
                window.location.href.includes('lockdown') ||
                document.querySelector('script[src*="lockdown"]')) {
                this.sesDetected = true;
                console.warn('🔒 SES lockdown detected - enabling safe mode');
            }
        } catch (error) {
            // If we can't even check, assume SES is active
            this.sesDetected = true;
            console.warn('🔒 SES environment detected - enabling safe mode');
        }
    }

    setupSafeHandlers() {
        // Override console methods to be SES-safe
        const originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error
        };

        // Safe console wrapper
        window.safeConsole = {
            log: (...args) => {
                try {
                    originalConsole.log(...args);
                } catch (error) {
                    // Fallback for SES environments
                    try {
                        console.log('[SAFE]', ...args);
                    } catch (e) {
                        // Ultimate fallback - do nothing
                    }
                }
            },
            warn: (...args) => {
                try {
                    originalConsole.warn(...args);
                } catch (error) {
                    try {
                        console.warn('[SAFE]', ...args);
                    } catch (e) {
                        // Ultimate fallback
                    }
                }
            },
            error: (...args) => {
                try {
                    originalConsole.error(...args);
                } catch (error) {
                    try {
                        console.error('[SAFE]', ...args);
                    } catch (e) {
                        // Ultimate fallback
                    }
                }
            }
        };
    }

    patchProblematicAPIs() {
        // Patch Date.prototype.toTemporalInstant if it causes issues
        try {
            if (Date.prototype.toTemporalInstant && this.sesDetected) {
                // Create a safe wrapper
                const originalToTemporalInstant = Date.prototype.toTemporalInstant;
                Date.prototype.toTemporalInstant = function(...args) {
                    try {
                        return originalToTemporalInstant.apply(this, args);
                    } catch (error) {
                        console.warn('SES: toTemporalInstant blocked, using fallback');
                        return null;
                    }
                };
            }
        } catch (error) {
            // If we can't patch, that's okay
            console.warn('Could not patch toTemporalInstant:', error.message);
        }
    }

    // Safe function execution wrapper
    safeExecute(fn, fallback = null, context = null) {
        try {
            if (typeof fn === 'function') {
                return context ? fn.call(context) : fn();
            }
            return fallback;
        } catch (error) {
            console.warn('SES-safe execution failed:', error.message);
            return fallback;
        }
    }

    // Safe property access
    safeGet(obj, path, fallback = null) {
        try {
            const keys = path.split('.');
            let current = obj;
            
            for (const key of keys) {
                if (current == null || typeof current !== 'object') {
                    return fallback;
                }
                current = current[key];
            }
            
            return current !== undefined ? current : fallback;
        } catch (error) {
            return fallback;
        }
    }

    // Safe event listener attachment
    safeAddEventListener(element, event, handler, options = false) {
        try {
            if (element && typeof element.addEventListener === 'function') {
                element.addEventListener(event, (e) => {
                    try {
                        handler(e);
                    } catch (error) {
                        console.warn(`SES-safe event handler error for ${event}:`, error.message);
                    }
                }, options);
                return true;
            }
            return false;
        } catch (error) {
            console.warn(`Failed to add event listener for ${event}:`, error.message);
            return false;
        }
    }

    // Safe DOM manipulation
    safeSetInnerHTML(element, html) {
        try {
            if (element && typeof element.innerHTML !== 'undefined') {
                element.innerHTML = html;
                return true;
            }
            return false;
        } catch (error) {
            console.warn('SES-safe innerHTML failed:', error.message);
            return false;
        }
    }

    // Safe local storage access
    safeLocalStorage = {
        getItem: (key) => {
            try {
                return localStorage.getItem(key);
            } catch (error) {
                console.warn('SES-safe localStorage.getItem failed:', error.message);
                return null;
            }
        },
        setItem: (key, value) => {
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (error) {
                console.warn('SES-safe localStorage.setItem failed:', error.message);
                return false;
            }
        },
        removeItem: (key) => {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.warn('SES-safe localStorage.removeItem failed:', error.message);
                return false;
            }
        }
    };

    // Global error handler for SES issues
    setupGlobalErrorHandler() {
        window.addEventListener('error', (event) => {
            if (event.error && event.error.message) {
                const message = event.error.message.toLowerCase();
                
                // Handle SES-specific errors
                if (message.includes('ses') || 
                    message.includes('lockdown') || 
                    message.includes('intrinsic') ||
                    message.includes('unpermitted')) {
                    
                    console.warn('🔒 SES lockdown error handled:', event.error.message);
                    event.preventDefault();
                    return true;
                }
            }
        });

        window.addEventListener('unhandledrejection', (event) => {
            if (event.reason && event.reason.message) {
                const message = event.reason.message.toLowerCase();
                
                if (message.includes('ses') || 
                    message.includes('lockdown') || 
                    message.includes('intrinsic')) {
                    
                    console.warn('🔒 SES lockdown promise rejection handled:', event.reason.message);
                    event.preventDefault();
                    return true;
                }
            }
        });
    }

    // Check if we're in a SES environment
    isSESEnvironment() {
        return this.sesDetected;
    }
}

// Create global instance
window.sesSafeHandler = new SESSafeHandler();
window.sesSafeHandler.setupGlobalErrorHandler();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SESSafeHandler;
}

console.log('✅ SES-Safe Handler initialized');
