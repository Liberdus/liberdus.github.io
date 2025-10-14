/**
 * Production Logger
 * Respects DEBUG configuration and provides clean logging in production
 */

class ProductionLogger {
    constructor() {
        this.isDebugMode = window.CONFIG?.DEV?.DEBUG || false;
        this.isConsoleLogsEnabled = window.CONFIG?.DEV?.CONSOLE_LOGS || false;
    }

    log(...args) {
        if (this.isConsoleLogsEnabled) {
            console.log(...args);
        }
    }

    info(...args) {
        if (this.isConsoleLogsEnabled) {
            console.info(...args);
        }
    }

    warn(...args) {
        // Always show warnings
        console.warn(...args);
    }

    error(...args) {
        // Always show errors
        console.error(...args);
    }

    debug(...args) {
        if (this.isDebugMode) {
            console.log('[DEBUG]', ...args);
        }
    }

    group(label) {
        if (this.isConsoleLogsEnabled && console.group) {
            console.group(label);
        }
    }

    groupEnd() {
        if (this.isConsoleLogsEnabled && console.groupEnd) {
            console.groupEnd();
        }
    }

    table(data) {
        if (this.isConsoleLogsEnabled && console.table) {
            console.table(data);
        }
    }

    time(label) {
        if (this.isDebugMode && console.time) {
            console.time(label);
        }
    }

    timeEnd(label) {
        if (this.isDebugMode && console.timeEnd) {
            console.timeEnd(label);
        }
    }
}

// Create global logger instance
window.logger = new ProductionLogger();

// Override console methods to use production logger
if (!window.CONFIG?.DEV?.CONSOLE_LOGS) {
    const originalConsole = {
        log: console.log,
        info: console.info,
        warn: console.warn,
        error: console.error
    };

    // Only suppress log and info in production
    console.log = (...args) => {
        if (window.CONFIG?.DEV?.CONSOLE_LOGS) {
            originalConsole.log(...args);
        }
    };

    console.info = (...args) => {
        if (window.CONFIG?.DEV?.CONSOLE_LOGS) {
            originalConsole.info(...args);
        }
    };

    // Keep warn and error always visible
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
}

