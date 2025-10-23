/**
 * Version Check Utility
 * Ensures users always run the latest version by checking version.html
 * and forcing cache refresh when version changes
 */
(function(window) {
    'use strict';

    // Adjust version file path if running from admin subdirectory
    const isAdminPage = window.location.pathname.includes('admin');
    const VERSION_FILE = isAdminPage ? '../version.html' : 'version.html';
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
        const basePath = isAdminPage ? '../' : '';
        return [
            // HTML pages
            `${basePath}index.html`,
            isAdminPage ? 'index.html' : 'admin/',
            
            // JavaScript - Components (only existing files)
            `${basePath}js/components/admin-page.js`,
            `${basePath}js/components/apr-display.js`,
            `${basePath}js/components/base-component.js`,
            `${basePath}js/components/efficient-dom-updates.js`,
            `${basePath}js/components/home-page.js`,
            `${basePath}js/components/modal.js`,
            `${basePath}js/components/notification.js`,
            `${basePath}js/components/optimistic-ui-updates.js`,
            `${basePath}js/components/optimized-admin-state.js`,
            `${basePath}js/components/pending-rewards-display.js`,
            `${basePath}js/components/performance-monitor.js`,
            `${basePath}js/components/staking-modal-new.js`,
            `${basePath}js/components/staking-modal.js`,
            `${basePath}js/components/transaction-status.js`,
            `${basePath}js/components/wallet-popup.js`,
            
            // JavaScript - Config
            `${basePath}js/config/app-config.js`,
            `${basePath}js/config/demo-config.js`,
            `${basePath}js/config/dev-config.js`,
            
            // JavaScript - Contracts
            `${basePath}js/contracts/contract-manager.js`,
            
            // JavaScript - Core (only existing files)
            `${basePath}js/core/accessibility-manager.js`,
            `${basePath}js/core/animation-manager.js`,
            `${basePath}js/core/error-handler.js`,
            `${basePath}js/core/loading-manager.js`,
            `${basePath}js/core/notification-manager-new.js`,
            `${basePath}js/core/notification-manager.js`,
            `${basePath}js/core/theme-manager-new.js`,
            `${basePath}js/core/unified-theme-manager.js`,
            
            // JavaScript - Root
            `${basePath}js/debug-logger.js`,
            `${basePath}js/master-initializer.js`,
            
            // JavaScript - Pages
            `${basePath}js/pages/home.js`,
            
            // JavaScript - Utils (only existing files)
            `${basePath}js/utils/admin-test.js`,
            `${basePath}js/utils/cache-integration.js`,
            `${basePath}js/utils/event-manager.js`,
            `${basePath}js/utils/gas-estimator.js`,
            `${basePath}js/utils/helpers.js`,
            `${basePath}js/utils/logger.js`,
            `${basePath}js/utils/network-health-check.js`,
            `${basePath}js/utils/price-feeds.js`,
            `${basePath}js/utils/production-logger.js`,
            `${basePath}js/utils/rewards-calculator.js`,
            `${basePath}js/utils/rewards-history.js`,
            `${basePath}js/utils/rpc-test.js`,
            `${basePath}js/utils/ses-safe-handler.js`,
            `${basePath}js/utils/storage-manager.js`,
            `${basePath}js/utils/transaction-queue.js`,
            `${basePath}js/utils/unified-cache.js`,
            `${basePath}js/utils/version-check.js`,
            `${basePath}js/utils/multicall-service.js`,
            
            // JavaScript - Wallet
            `${basePath}js/wallet/metamask-connector.js`,
            `${basePath}js/wallet/network-manager.js`,
            `${basePath}js/wallet/wallet-manager.js`,
            `${basePath}js/wallet/walletconnect-connector.js`,
            
            // Libraries
            `${basePath}libs/ethers.umd.min.js`,

            // Config files (non-JS)
            `${basePath}config/constants.js`,
            
            // CSS - All stylesheets (only existing files)
            `${basePath}css/admin-homepage-theme.css`,
            `${basePath}css/admin-theme.css`,
            `${basePath}css/admin.css`,
            `${basePath}css/base.css`,
            `${basePath}css/component-library.css`,
            `${basePath}css/components.css`,
            `${basePath}css/day10-enhancements.css`,
            `${basePath}css/home-page.css`,
            `${basePath}css/in-development.css`,
            `${basePath}css/main.css`,
            `${basePath}css/responsive.css`,
            `${basePath}css/theme-toggle.css`,
            `${basePath}css/variables.css`,
            `${basePath}css/wallet-popup.css`
        ];
    }

    // Export to window for manual use if needed
    window.versionCheck = checkVersion;
    window.getCurrentVersion = getCurrentVersion;

    // Auto-run version check on load
    checkVersion(getCriticalFiles());

})(window);

