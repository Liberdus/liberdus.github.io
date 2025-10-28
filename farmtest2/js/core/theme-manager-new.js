/**
 * ThemeManager - Simple theme management system matching React version
 * Provides light/dark mode switching with persistence
 */

class ThemeManagerNew {
    constructor() {
        this.currentTheme = 'light';
        this.storageKey = 'lp-staking-theme';
        this.init();
    }

    init() {
        this.loadSavedTheme();
        this.setupThemeToggle();
        this.applyTheme(this.currentTheme);
    }

    loadSavedTheme() {
        const saved = localStorage.getItem(this.storageKey);
        if (saved && (saved === 'light' || saved === 'dark')) {
            this.currentTheme = saved;
        } else {
            // Check system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.currentTheme = prefersDark ? 'dark' : 'light';
        }
    }

    setupThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(this.currentTheme);
        this.saveTheme();
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        // Also apply to body for consistency with UnifiedThemeManager
        document.body.setAttribute('data-theme', theme);
        
        // Update body class for backward compatibility
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${theme}`);

        // Apply CSS custom properties for the theme
        this.applyCSSVariables(theme);

        // Update theme toggle icon with smooth transition
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('.material-icons-outlined');
            if (icon) {
                // Add transition class
                icon.style.transition = 'transform 0.3s ease';
                icon.style.transform = 'rotate(180deg)';

                setTimeout(() => {
                    icon.textContent = theme === 'light' ? 'light_mode' : 'bedtime';
                    icon.style.transform = 'rotate(0deg)';
                }, 150);
            }
        }

        // Dispatch theme change event
        document.dispatchEvent(new CustomEvent('themeChanged', {
            detail: { theme, previousTheme: this.currentTheme === 'light' ? 'dark' : 'light' }
        }));
    }

    applyCSSVariables(theme) {
        const root = document.documentElement;

        if (theme === 'dark') {
            // Dark theme variables
            root.style.setProperty('--background-default', '#121212');
            root.style.setProperty('--background-paper', '#1e1e1e');
            root.style.setProperty('--surface-hover', 'rgba(255, 255, 255, 0.08)');
            root.style.setProperty('--action-selected', 'rgba(25, 118, 210, 0.16)');
            root.style.setProperty('--action-hover', 'rgba(255, 255, 255, 0.08)');

            root.style.setProperty('--text-primary', 'rgba(255, 255, 255, 0.87)');
            root.style.setProperty('--text-secondary', 'rgba(255, 255, 255, 0.6)');
            root.style.setProperty('--text-disabled', 'rgba(255, 255, 255, 0.38)');

            root.style.setProperty('--divider', 'rgba(255, 255, 255, 0.12)');

            // Dark theme shadows
            root.style.setProperty('--shadow-1', '0px 2px 1px -1px rgba(0,0,0,0.4), 0px 1px 1px 0px rgba(0,0,0,0.28), 0px 1px 3px 0px rgba(0,0,0,0.24)');
            root.style.setProperty('--shadow-4', '0px 2px 4px -1px rgba(0,0,0,0.4), 0px 4px 5px 0px rgba(0,0,0,0.28), 0px 1px 10px 0px rgba(0,0,0,0.24)');
            root.style.setProperty('--shadow-8', '0px 5px 5px -3px rgba(0,0,0,0.4), 0px 8px 10px 1px rgba(0,0,0,0.28), 0px 3px 14px 2px rgba(0,0,0,0.24)');
        } else {
            // Light theme variables (reset to defaults)
            root.style.setProperty('--background-default', '#ffffff');
            root.style.setProperty('--background-paper', '#ffffff');
            root.style.setProperty('--surface-hover', 'rgba(0, 0, 0, 0.04)');
            root.style.setProperty('--action-selected', 'rgba(25, 118, 210, 0.08)');
            root.style.setProperty('--action-hover', 'rgba(0, 0, 0, 0.04)');

            root.style.setProperty('--text-primary', 'rgba(0, 0, 0, 0.87)');
            root.style.setProperty('--text-secondary', 'rgba(0, 0, 0, 0.6)');
            root.style.setProperty('--text-disabled', 'rgba(0, 0, 0, 0.38)');

            root.style.setProperty('--divider', 'rgba(0, 0, 0, 0.12)');

            // Light theme shadows
            root.style.setProperty('--shadow-1', '0px 2px 1px -1px rgba(0,0,0,0.2), 0px 1px 1px 0px rgba(0,0,0,0.14), 0px 1px 3px 0px rgba(0,0,0,0.12)');
            root.style.setProperty('--shadow-4', '0px 2px 4px -1px rgba(0,0,0,0.2), 0px 4px 5px 0px rgba(0,0,0,0.14), 0px 1px 10px 0px rgba(0,0,0,0.12)');
            root.style.setProperty('--shadow-8', '0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)');
        }
    }

    saveTheme() {
        localStorage.setItem(this.storageKey, this.currentTheme);
    }

    getCurrentTheme() {
        return this.currentTheme;
    }
}

/**
 * WalletManager - Simple wallet connection management
 * Handles wallet connection state and UI updates
 */

class WalletManagerNew {
    constructor() {
        this.isConnected = false;
        this.account = null;
        this.provider = null;
        this.init();
    }

    init() {
        this.setupConnectButton();
        this.checkConnection();
    }

    setupConnectButton() {
        const connectBtn = document.getElementById('connect-wallet-btn');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.toggleConnection());
        }
    }

    async checkConnection() {
        if (typeof window.ethereum !== 'undefined') {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    this.account = accounts[0];
                    this.isConnected = true;
                    this.updateUI();
                }
            } catch (error) {
                console.error('Failed to check wallet connection:', error);
            }
        }
    }

    async toggleConnection() {
        if (this.isConnected) {
            this.disconnect();
        } else {
            await this.connect();
        }
    }

    async connect() {
        console.log('🔗 Attempting wallet connection...');

        if (typeof window.ethereum === 'undefined') {
            console.log('❌ MetaMask not detected');
            if (window.notificationManager) {
                window.notificationManager.show('Please install MetaMask or another Web3 wallet', 'error');
            } else {
                alert('Please install MetaMask or another Web3 wallet');
            }
            return false;
        }

        try {
            console.log('📡 Requesting account access...');
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

            if (accounts.length > 0) {
                this.account = accounts[0];
                this.isConnected = true;

                // Initialize provider if ethers is available
                if (window.ethers) {
                    this.provider = new window.ethers.providers.Web3Provider(window.ethereum);
                }

                this.updateUI();

                console.log('✅ Wallet connected:', this.account);

                if (window.notificationManager) {
                    window.notificationManager.show(`Wallet connected: ${this.account.slice(0, 6)}...${this.account.slice(-4)}`, 'success');
                } else {
                    alert('Wallet connected successfully!');
                }

                // Refresh home page data
                if (window.homePage) {
                    window.homePage.loadData();
                }

                return true;
            }
        } catch (error) {
            console.error('❌ Failed to connect wallet:', error);

            let errorMessage = 'Failed to connect wallet';
            if (error.code === 4001) {
                errorMessage = 'Wallet connection rejected by user';
            } else if (error.code === -32002) {
                errorMessage = 'Wallet connection request already pending';
            }

            if (window.notificationManager) {
                window.notificationManager.show(errorMessage, 'error');
            } else {
                alert(errorMessage);
            }

            return false;
        }
    }

    disconnect() {
        this.account = null;
        this.isConnected = false;
        this.updateUI();
        
        if (window.notificationManager) {
            window.notificationManager.show('Wallet disconnected', 'info');
        }

        // Refresh home page data
        if (window.homePage) {
            window.homePage.loadData();
        }
    }

    updateUI() {
        const connectBtn = document.getElementById('connect-wallet-btn');
        if (!connectBtn) return;

        if (this.isConnected && this.account) {
            const shortAccount = `${this.account.slice(0, 6)}...${this.account.slice(-4)}`;
            connectBtn.innerHTML = `
                <span class="material-icons">account_balance_wallet</span>
                <span>${shortAccount}</span>
            `;
            connectBtn.style.background = 'var(--success-main)';
        } else {
            connectBtn.innerHTML = `
                <span class="material-icons">account_balance_wallet</span>
                <span>Connect Wallet</span>
            `;
            connectBtn.style.background = 'var(--primary-main)';
        }
    }

    getAccount() {
        return this.account;
    }

    isWalletConnected() {
        return this.isConnected;
    }

    isMetaMaskAvailable() {
        return typeof window.ethereum !== 'undefined';
    }
}

// Initialize managers
let themeManagerNew, walletManagerNew;
document.addEventListener('DOMContentLoaded', () => {
    themeManagerNew = new ThemeManagerNew();
    walletManagerNew = new WalletManagerNew();
    
    // Set global references for compatibility
    window.themeManager = themeManagerNew;
    window.walletManager = walletManagerNew;
});

// Export for global access
window.ThemeManagerNew = ThemeManagerNew;
window.WalletManagerNew = WalletManagerNew;
