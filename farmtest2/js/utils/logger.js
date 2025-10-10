/**
 * Logger Utility
 * Provides consistent logging across the application
 */

class Logger {
    constructor(prefix = '') {
        this.prefix = prefix;
        this.logLevel = window.DEV_CONFIG?.VERBOSE_LOGGING ? 'debug' : 'info';
    }

    log(...args) {
        if (this.prefix) {
            console.log(`[${this.prefix}]`, ...args);
        } else {
            console.log(...args);
        }
    }

    info(...args) {
        if (this.prefix) {
            console.info(`[${this.prefix}]`, ...args);
        } else {
            console.info(...args);
        }
    }

    warn(...args) {
        if (this.prefix) {
            console.warn(`[${this.prefix}]`, ...args);
        } else {
            console.warn(...args);
        }
    }

    error(...args) {
        if (this.prefix) {
            console.error(`[${this.prefix}]`, ...args);
        } else {
            console.error(...args);
        }
    }

    debug(...args) {
        if (this.logLevel === 'debug') {
            if (this.prefix) {
                console.debug(`[${this.prefix}]`, ...args);
            } else {
                console.debug(...args);
            }
        }
    }
}

// Global logger instance
window.Logger = Logger;
window.logger = new Logger('APP');

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Logger;
}
