/**
 * Development Configuration
 * Easy toggle for development features
 */

window.DEV_CONFIG = {
    // Admin Panel Settings
    ADMIN_DEVELOPMENT_MODE: false, // Disabled to test with real wallet
    BYPASS_ACCESS_CONTROL: false, // Enable wallet and role checks

    // Authorized Admin Addresses (for production mode)
    AUTHORIZED_ADMINS: [
        '0x9249cFE964C49Cf2d2D0DBBbB33E99235707aa61', // Governance Signer 1
        '0xea7bb30fbcCBB2646B0eFeB31382D3A4da07a3cC', // Governance Signer 2
        '0x2fBe1cd4BC1718B7625932f35e3cb03E6847289F', // Governance Signer 3
        '0xd3ac493dc0dA16077CC589A838ac473bC010324F', // Governance Signer 4
        '0x0B046B290C50f3FDf1C61ecE442d42D9D79BD814'  // Your wallet
    ],
    
    // Contract Settings
    SKIP_WALLET_CONNECTION: false, // Skip wallet connection requirements
    
    // Debug Settings
    VERBOSE_LOGGING: true,        // Enable detailed console logging
    SHOW_DEBUG_INFO: true,        // Show debug information in UI
    
    // Network Settings
    ALLOW_ANY_NETWORK: true,      // Don't enforce specific network
    
    // UI Settings
    SHOW_DEV_INDICATORS: true,    // Show development mode indicators
    ENABLE_TEST_BUTTONS: true,    // Show additional test buttons
    
    // Performance Settings
    DISABLE_AUTO_REFRESH: false,  // Disable auto-refresh for debugging
    EXTENDED_TIMEOUTS: true,      // Use longer timeouts for debugging
    
    // Feature Flags
    ENABLE_EXPERIMENTAL_FEATURES: true, // Enable experimental features
    SKIP_VALIDATION: false,       // Skip form validation (use carefully)

};

// Development utilities
window.DEV_UTILS = {
    // Add admin address
    addAdmin(address) {
        if (!window.DEV_CONFIG.AUTHORIZED_ADMINS.includes(address)) {
            window.DEV_CONFIG.AUTHORIZED_ADMINS.push(address);
            console.log('✅ Admin added:', address);
            console.log('📋 Current admins:', window.DEV_CONFIG.AUTHORIZED_ADMINS);
        } else {
            console.log('⚠️ Admin already exists:', address);
        }
    },

    // Remove admin address
    removeAdmin(address) {
        const index = window.DEV_CONFIG.AUTHORIZED_ADMINS.indexOf(address);
        if (index > -1) {
            window.DEV_CONFIG.AUTHORIZED_ADMINS.splice(index, 1);
            console.log('❌ Admin removed:', address);
            console.log('📋 Current admins:', window.DEV_CONFIG.AUTHORIZED_ADMINS);
        } else {
            console.log('⚠️ Admin not found:', address);
        }
    },

    // List all admins
    listAdmins() {
        console.log('📋 Authorized Admin Addresses:');
        window.DEV_CONFIG.AUTHORIZED_ADMINS.forEach((admin, index) => {
            console.log(`  ${index + 1}. ${admin}`);
        });
        return window.DEV_CONFIG.AUTHORIZED_ADMINS;
    },

    // Toggle development mode
    toggleDevMode() {
        window.DEV_CONFIG.ADMIN_DEVELOPMENT_MODE = !window.DEV_CONFIG.ADMIN_DEVELOPMENT_MODE;
        console.log('🔧 Development mode:', window.DEV_CONFIG.ADMIN_DEVELOPMENT_MODE ? 'ENABLED' : 'DISABLED');
        location.reload();
    },
    
    // Enable production mode
    enableProductionMode() {
        Object.keys(window.DEV_CONFIG).forEach(key => {
            if (typeof window.DEV_CONFIG[key] === 'boolean') {
                window.DEV_CONFIG[key] = false;
            }
        });
        window.DEV_CONFIG.ADMIN_DEVELOPMENT_MODE = false;
        console.log('🚀 Production mode enabled');
        location.reload();
    },
    
    // Reset to development defaults
    resetToDevMode() {
        window.DEV_CONFIG.ADMIN_DEVELOPMENT_MODE = true;
        window.DEV_CONFIG.BYPASS_ACCESS_CONTROL = true;
        window.DEV_CONFIG.VERBOSE_LOGGING = true;
        console.log('🚧 Development mode reset');
        location.reload();
    },
    
    // Log current configuration
    showConfig() {
        console.log('📋 Current Development Configuration:');
        console.table(window.DEV_CONFIG);
    }
};

// Console helpers for development
if (window.DEV_CONFIG.VERBOSE_LOGGING) {
    console.log('🚧 Development configuration loaded');
    console.log('📋 Available dev utilities: DEV_UTILS.toggleDevMode(), DEV_UTILS.showConfig()');
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DEV_CONFIG: window.DEV_CONFIG, DEV_UTILS: window.DEV_UTILS };
}
