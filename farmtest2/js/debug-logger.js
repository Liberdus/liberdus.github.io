/**
 * Comprehensive Debug Logger for LP Staking
 * Captures all errors, silent failures, and transaction states
 */

class DebugLogger {
    constructor() {
        this.logs = [];
        this.errors = [];
        this.transactions = new Map();
        this.silentFailures = [];
        this.startTime = Date.now();
        
        // Enable debug mode
        window.DEBUG_MODE = true;
        
        this.setupGlobalErrorHandlers();
        this.setupConsoleInterception();
        
        console.log('[DEBUG LOGGER] 🚀 Comprehensive debug logging initialized');
    }

    setupGlobalErrorHandlers() {
        // Catch all unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.log('[GLOBAL ERROR] ❌ Unhandled Promise Rejection:');
            console.log('[GLOBAL ERROR]   Reason:', event.reason);
            console.log('[GLOBAL ERROR]   Promise:', event.promise);
            console.log('[GLOBAL ERROR]   Stack:', event.reason?.stack);
            
            this.errors.push({
                type: 'unhandledrejection',
                reason: event.reason,
                timestamp: Date.now(),
                stack: event.reason?.stack
            });
        });

        // Catch all JavaScript errors
        window.addEventListener('error', (event) => {
            console.log('[GLOBAL ERROR] ❌ JavaScript Error:');
            console.log('[GLOBAL ERROR]   Message:', event.message);
            console.log('[GLOBAL ERROR]   Filename:', event.filename);
            console.log('[GLOBAL ERROR]   Line:', event.lineno);
            console.log('[GLOBAL ERROR]   Column:', event.colno);
            console.log('[GLOBAL ERROR]   Error:', event.error);
            
            this.errors.push({
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error,
                timestamp: Date.now()
            });
        });
    }

    setupConsoleInterception() {
        // Intercept console.log to capture all debug messages
        const originalLog = console.log;
        console.log = (...args) => {
            this.logs.push({
                timestamp: Date.now(),
                args: args,
                type: 'log'
            });
            originalLog.apply(console, args);
        };

        // Intercept console.error
        const originalError = console.error;
        console.error = (...args) => {
            this.errors.push({
                timestamp: Date.now(),
                args: args,
                type: 'error'
            });
            originalError.apply(console, args);
        };
    }

    logTransactionStart(hash, operation) {
        console.log(`[TX TRACKER] 🚀 Transaction started: ${operation}`);
        console.log(`[TX TRACKER]   Hash: ${hash}`);
        console.log(`[TX TRACKER]   Time: ${new Date().toISOString()}`);
        
        this.transactions.set(hash, {
            operation,
            startTime: Date.now(),
            status: 'started',
            updates: []
        });
    }

    logTransactionUpdate(hash, status, details = {}) {
        const tx = this.transactions.get(hash);
        if (tx) {
            const elapsed = Date.now() - tx.startTime;
            console.log(`[TX TRACKER] 📊 Transaction update: ${status} (${elapsed}ms)`);
            console.log(`[TX TRACKER]   Hash: ${hash}`);
            console.log(`[TX TRACKER]   Details:`, details);
            
            tx.status = status;
            tx.updates.push({
                status,
                timestamp: Date.now(),
                elapsed,
                details
            });
        }
    }

    logTransactionComplete(hash, receipt) {
        const tx = this.transactions.get(hash);
        if (tx) {
            const totalTime = Date.now() - tx.startTime;
            console.log(`[TX TRACKER] ✅ Transaction completed in ${totalTime}ms`);
            console.log(`[TX TRACKER]   Hash: ${hash}`);
            console.log(`[TX TRACKER]   Block: ${receipt.blockNumber}`);
            console.log(`[TX TRACKER]   Gas used: ${receipt.gasUsed.toString()}`);
            
            tx.status = 'completed';
            tx.receipt = receipt;
            tx.totalTime = totalTime;
        }
    }

    detectSilentFailure(operation, expectedResult, actualResult) {
        if (!actualResult || (expectedResult && actualResult !== expectedResult)) {
            console.log(`[SILENT FAILURE] ⚠️ Detected silent failure in ${operation}`);
            console.log(`[SILENT FAILURE]   Expected: ${expectedResult}`);
            console.log(`[SILENT FAILURE]   Actual: ${actualResult}`);
            
            this.silentFailures.push({
                operation,
                expectedResult,
                actualResult,
                timestamp: Date.now()
            });
        }
    }

    checkPromiseTimeout(promise, operation, timeoutMs = 30000) {
        return Promise.race([
            promise,
            new Promise((_, reject) => {
                setTimeout(() => {
                    console.log(`[PROMISE TIMEOUT] ⏰ ${operation} timed out after ${timeoutMs}ms`);
                    reject(new Error(`Promise timeout: ${operation} after ${timeoutMs}ms`));
                }, timeoutMs);
            })
        ]);
    }

    logNetworkState() {
        if (window.ethereum) {
            console.log('[NETWORK STATE] 🌐 Current network state:');
            
            window.ethereum.request({ method: 'eth_chainId' }).then(chainId => {
                console.log(`[NETWORK STATE]   Chain ID: ${parseInt(chainId, 16)}`);
            });
            
            window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
                console.log(`[NETWORK STATE]   Accounts: ${accounts.length}`);
                if (accounts.length > 0) {
                    console.log(`[NETWORK STATE]   Current account: ${accounts[0]}`);
                }
            });
        }
    }

    logMetaMaskState() {
        console.log('[METAMASK STATE] 🦊 MetaMask state check:');
        console.log(`[METAMASK STATE]   Available: ${!!window.ethereum}`);
        console.log(`[METAMASK STATE]   Is MetaMask: ${window.ethereum?.isMetaMask}`);
        console.log(`[METAMASK STATE]   Connected: ${window.ethereum?.isConnected()}`);
        console.log(`[METAMASK STATE]   Network version: ${window.ethereum?.networkVersion}`);
    }

    generateReport() {
        const report = {
            summary: {
                totalLogs: this.logs.length,
                totalErrors: this.errors.length,
                totalTransactions: this.transactions.size,
                silentFailures: this.silentFailures.length,
                sessionDuration: Date.now() - this.startTime
            },
            errors: this.errors,
            transactions: Array.from(this.transactions.entries()),
            silentFailures: this.silentFailures,
            recentLogs: this.logs.slice(-50) // Last 50 logs
        };

        console.log('[DEBUG REPORT] 📊 Debug session report:');
        console.log('[DEBUG REPORT]', report);
        
        return report;
    }

    exportLogs() {
        const report = this.generateReport();
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `lp-staking-debug-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('[DEBUG LOGGER] 💾 Debug logs exported');
    }
}

// Initialize global debug logger
window.debugLogger = new DebugLogger();

// Add convenience methods to window
window.logTxStart = (hash, operation) => window.debugLogger.logTransactionStart(hash, operation);
window.logTxUpdate = (hash, status, details) => window.debugLogger.logTransactionUpdate(hash, status, details);
window.logTxComplete = (hash, receipt) => window.debugLogger.logTransactionComplete(hash, receipt);
window.detectSilentFailure = (op, expected, actual) => window.debugLogger.detectSilentFailure(op, expected, actual);
window.exportDebugLogs = () => window.debugLogger.exportLogs();

console.log('[DEBUG LOGGER] ✅ Global debug logging ready');
console.log('[DEBUG LOGGER] 💡 Use window.exportDebugLogs() to export logs');
