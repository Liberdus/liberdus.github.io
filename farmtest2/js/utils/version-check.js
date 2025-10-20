/**
 * Version Check Utility
 * Ensures users always run the latest version by checking version.html
 * and forcing cache refresh when version changes
 */
(function(window) {
    'use strict';

    const VERSION_FILE = 'version.html';
    const STORAGE_KEY = 'version';

    /**
     * Get current version from localStorage or version.html
     * @returns {Promise<string>} Current version string
     */
    async function getCurrentVersion() {
        try {
            const response = await fetch(VERSION_FILE, {
                cache: 'reload',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                }
            });
            
            if (response.ok) {
                return (await response.text()).trim();
            }
        } catch (error) {
            console.error('Failed to fetch version:', error);
        }
        
        return localStorage.getItem(STORAGE_KEY) || '0.0.0';
    }

    /**
     * Perform version check and force reload if needed
     * @param {string[]} criticalFiles - Files to force reload on version change
     */
    async function checkVersion(criticalFiles = []) {
        const storedVersion = localStorage.getItem(STORAGE_KEY) || '0.0.0';
        let newVersion = storedVersion;

        try {
            const response = await fetch(VERSION_FILE, {
                cache: 'reload',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                }
            });
            
            if (response.ok) {
                newVersion = (await response.text()).trim();
            } else {
                throw new Error(`Version check failed: ${response.status}`);
            }
        } catch (error) {
            console.error('Version check failed:', error);
            // Continue with stored version on error
            return;
        }

        // Compare versions (convert to comparable numbers: "1.2.3" -> 1002003)
        const storedVer = versionToNumber(storedVersion);
        const newVer = versionToNumber(newVersion);

        if (storedVer !== newVer) {
            console.log(`🔄 Updating to version: ${newVersion} (from ${storedVersion})`);
            localStorage.setItem(STORAGE_KEY, newVersion);
            
            if (criticalFiles.length > 0) {
                await forceReloadFiles(criticalFiles);
            }
            
            window.location.replace(window.location.href.split('?')[0]);
        } else {
            console.log(`✅ Running version: ${storedVersion}`);
        }
    }

    /**
     * Convert semantic version to comparable number
     * @param {string} version - Version string (e.g., "1.2.3")
     * @returns {number} Comparable number
     */
    function versionToNumber(version) {
        const parts = version.replace(/\D/g, '.').split('.').filter(Boolean);
        return parseInt(parts.map((p, i) => p.padStart(3, '0')).join('')) || 0;
    }

    /**
     * Force reload files with cache-busting headers
     * @param {string[]} urls - Files to reload
     */
    async function forceReloadFiles(urls) {
        try {
            const fetchPromises = urls.map(url =>
                fetch(url, {
                    cache: 'reload',
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                    },
                }).catch(err => console.warn(`Failed to reload ${url}:`, err))
            );
            await Promise.all(fetchPromises);
        } catch (error) {
            console.error('Force reload failed:', error);
        }
    }

    /**
     * Get all critical files to reload
     * Auto-generated from directory scan - includes all JS, CSS, and HTML files
     * @returns {string[]} List of all critical files
     */
    function getCriticalFiles() {
        return [
            // HTML pages
            'index.html',
            'admin.html',
            
            // JavaScript - Components
            'js/components/admin-page.js',
            'js/components/apr-display.js',
            'js/components/base-component.js',
            'js/components/efficient-dom-updates.js',
            'js/components/home-page.js',
            'js/components/modal.js',
            'js/components/notification.js',
            'js/components/optimistic-ui-updates.js',
            'js/components/optimized-admin-state.js',
            'js/components/pending-rewards-display.js',
            'js/components/performance-monitor.js',
            'js/components/staking-modal-new.js',
            'js/components/staking-modal.js',
            'js/components/transaction-status.js',
            'js/components/wallet-popup.js',
            
            // JavaScript - Config
            'js/config/app-config.js',
            'js/config/demo-config.js',
            'js/config/dev-config.js',
            
            // JavaScript - Contracts
            'js/contracts/contract-manager.js',
            
            // JavaScript - Core
            'js/core/accessibility-manager.js',
            'js/core/animation-manager.js',
            'js/core/error-handler.js',
            'js/core/loading-manager.js',
            'js/core/notification-manager-new.js',
            'js/core/notification-manager.js',
            'js/core/theme-manager-new.js',
            'js/core/unified-theme-manager.js',
            
            // JavaScript - Root
            'js/debug-logger.js',
            'js/master-initializer.js',
            
            // JavaScript - Pages
            'js/pages/admin.js',
            'js/pages/home.js',
            
            // JavaScript - Utils
            'js/utils/admin-test.js',
            'js/utils/cache-integration.js',
            'js/utils/event-manager.js',
            'js/utils/gas-estimator.js',
            'js/utils/helpers.js',
            'js/utils/logger.js',
            'js/utils/network-health-check.js',
            'js/utils/price-feeds.js',
            'js/utils/production-logger.js',
            'js/utils/rewards-calculator.js',
            'js/utils/rewards-history.js',
            'js/utils/rpc-test.js',
            'js/utils/ses-safe-handler.js',
            'js/utils/storage-manager.js',
            'js/utils/transaction-queue.js',
            'js/utils/unified-cache.js',
            'js/utils/version-check.js',
            
            // JavaScript - Wallet
            'js/wallet/metamask-connector.js',
            'js/wallet/network-manager.js',
            'js/wallet/wallet-manager.js',
            'js/wallet/walletconnect-connector.js',
            
            // Libraries
            'libs/ethers.umd.min.js',
            
            // Config files (non-JS)
            'config/constants.js',
            
            // CSS - All stylesheets
            'css/admin-homepage-theme.css',
            'css/admin-theme.css',
            'css/admin.css',
            'css/base.css',
            'css/component-library.css',
            'css/components.css',
            'css/day10-enhancements.css',
            'css/home-page.css',
            'css/in-development.css',
            'css/main.css',
            'css/responsive.css',
            'css/variables.css',
            'css/wallet-popup.css'
        ];
    }

    // Export to window for manual use if needed
    window.versionCheck = checkVersion;
    window.getCurrentVersion = getCurrentVersion;

    // Auto-run version check on load
    checkVersion(getCriticalFiles());

})(window);

