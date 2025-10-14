/**
 * System Initializer - Simple initialization system for the LP Staking app
 * Loads components in the correct order and handles initialization
 */

class SystemInitializerNew {
    constructor() {
        this.loadedScripts = new Set();
        this.initializationPromise = null;
        this.init();
    }

    async init() {
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this.initializeSystem();
        return this.initializationPromise;
    }

    async initializeSystem() {
        try {
            console.log('🚀 Starting system initialization...');

            // Load scripts in order
            await this.loadCoreComponents();
            await this.loadUIComponents();

            console.log('✅ System initialization completed successfully');
            
            // Dispatch ready event
            document.dispatchEvent(new CustomEvent('systemReady'));

        } catch (error) {
            console.error('❌ System initialization failed:', error);
            this.handleInitializationError(error);
        }
    }

    async loadCoreComponents() {
        const components = [
            'js/core/theme-manager-new.js',
            'js/core/notification-manager-new.js',
            'js/core/error-handler.js',
            'js/core/data-fetcher.js',
            'js/wallet/wallet-manager.js',
            'js/contracts/contract-manager.js'
        ];

        for (const component of components) {
            await this.loadScript(component);
        }
    }

    async loadUIComponents() {
        const components = [
            'js/components/home-page.js',
            'js/components/staking-modal-new.js',
            'js/components/transaction-status.js',
            'js/components/apr-display.js',
            'js/components/pending-rewards-display.js'
        ];

        for (const component of components) {
            await this.loadScript(component);
        }
    }

    async loadScript(src) {
        if (this.loadedScripts.has(src)) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;

            script.onload = () => {
                this.loadedScripts.add(src);
                console.log(`✅ Loaded: ${src}`);
                resolve();
            };

            script.onerror = (error) => {
                console.error(`❌ Failed to load: ${src}`, error);
                reject(new Error(`Failed to load script: ${src}`));
            };

            document.head.appendChild(script);
        });
    }

    handleInitializationError(error) {
        // Show error message to user
        const errorContainer = document.getElementById('alert-container');
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div style="
                    background: #f8d7da;
                    color: #721c24;
                    padding: 16px;
                    border-radius: 8px;
                    margin-bottom: 16px;
                    border: 1px solid #f5c6cb;
                ">
                    <strong>System Initialization Failed</strong><br>
                    ${error.message || 'An unknown error occurred'}
                    <br><br>
                    <button onclick="location.reload()" style="
                        background: #721c24;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                    ">
                        Reload Page
                    </button>
                </div>
            `;
        }
    }
}

// Initialize system when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.systemInitializer = new SystemInitializerNew();
});

// Export for global access
window.SystemInitializerNew = SystemInitializerNew;
