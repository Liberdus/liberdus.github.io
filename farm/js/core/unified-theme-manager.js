/**
 * Unified Theme Manager - Synchronized theme switching across homepage and admin panel
 * Uses localStorage for persistent theme state across pages
 */
(function(global) {
    'use strict';

    // Prevent multiple initializations
    if (global.UnifiedThemeManager) {
        console.warn('UnifiedThemeManager already exists');
        return;
    }

    class UnifiedThemeManager {
        constructor() {
            this.storageKey = 'lp-staking-theme-v2';
            this.currentTheme = 'light';
            this.listeners = [];
            this.isInitialized = false;
        }

        /**
         * Initialize theme system
         */
        initialize() {
            if (this.isInitialized) {
                console.log('✅ UnifiedThemeManager already initialized');
                return;
            }

            console.log('🎨 Initializing UnifiedThemeManager...');

            // Load saved theme or detect system preference
            this.loadTheme();

            // Apply theme immediately
            this.applyTheme(this.currentTheme, false);

            // Listen for storage changes (cross-tab synchronization)
            window.addEventListener('storage', (e) => {
                if (e.key === this.storageKey && e.newValue) {
                    const newTheme = e.newValue;
                    if (newTheme !== this.currentTheme) {
                        console.log(`🔄 Theme changed in another tab: ${newTheme}`);
                        this.applyTheme(newTheme, false);
                    }
                }
            });

            // Listen for system theme changes
            if (window.matchMedia) {
                const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
                darkModeQuery.addEventListener('change', (e) => {
                    if (!localStorage.getItem(this.storageKey)) {
                        // Only auto-switch if user hasn't set a preference
                        const newTheme = e.matches ? 'dark' : 'light';
                        console.log(`🌓 System theme changed: ${newTheme}`);
                        this.applyTheme(newTheme, true);
                    }
                });
            }

            this.isInitialized = true;
            console.log(`✅ UnifiedThemeManager initialized with theme: ${this.currentTheme}`);
        }

        /**
         * Load theme from storage or detect system preference
         */
        loadTheme() {
            try {
                const savedTheme = localStorage.getItem(this.storageKey);
                if (savedTheme === 'light' || savedTheme === 'dark') {
                    this.currentTheme = savedTheme;
                    console.log(`📂 Loaded saved theme: ${savedTheme}`);
                } else {
                    // Detect system preference
                    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                    this.currentTheme = prefersDark ? 'dark' : 'light';
                    console.log(`🔍 Detected system theme: ${this.currentTheme}`);
                }
            } catch (error) {
                console.error('❌ Error loading theme:', error);
                this.currentTheme = 'light';
            }
        }

        /**
         * Save theme to storage
         */
        saveTheme(theme) {
            try {
                localStorage.setItem(this.storageKey, theme);
                console.log(`💾 Saved theme: ${theme}`);
            } catch (error) {
                console.error('❌ Error saving theme:', error);
            }
        }

        /**
         * Apply theme to document
         */
        applyTheme(theme, save = true) {
            if (theme !== 'light' && theme !== 'dark') {
                console.error(`❌ Invalid theme: ${theme}`);
                return;
            }

            console.log(`🎨 Applying theme: ${theme}`);

            // Update data-theme attribute on html element
            document.documentElement.setAttribute('data-theme', theme);

            // Also apply to body for admin panel
            document.body.setAttribute('data-theme', theme);

            // Update body class for backward compatibility
            document.body.classList.remove('theme-light', 'theme-dark');
            document.body.classList.add(`theme-${theme}`);

            // Update current theme
            this.currentTheme = theme;

            // Save to storage
            if (save) {
                this.saveTheme(theme);
            }

            // Update theme toggle button if it exists
            this.updateToggleButton();

            // Dispatch custom event for theme change
            const themeChangeEvent = new CustomEvent('themeChanged', {
                detail: { theme: theme }
            });
            document.dispatchEvent(themeChangeEvent);

            // Notify listeners
            this.notifyListeners(theme);

            // Update meta theme-color for mobile browsers
            this.updateMetaThemeColor(theme);

            console.log(`✅ Theme applied: ${theme}`);
        }

        /**
         * Toggle between light and dark themes
         */
        toggleTheme() {
            const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
            console.log(`🔄 Toggling theme: ${this.currentTheme} → ${newTheme}`);
            this.applyTheme(newTheme, true);
        }

        /**
         * Get current theme
         */
        getCurrentTheme() {
            return this.currentTheme;
        }

        /**
         * Update theme toggle button
         */
        updateToggleButton() {
            const toggleButton = document.getElementById('theme-toggle');
            if (toggleButton) {
                const icon = toggleButton.querySelector('.material-icons-outlined');
                if (icon) {
                    // Rotate icon 180°
                    icon.style.transition = 'transform 0.3s ease';
                    icon.style.transform = 'rotate(180deg)';
                    
                    // Change icon at halfway point
                    setTimeout(() => {
                        icon.textContent = this.currentTheme === 'light' ? 'bedtime' : 'light_mode';
                        icon.style.transform = 'rotate(0deg)';
                    }, 150);
                    
                    // Remove inline styles after animation to allow CSS hover
                    setTimeout(() => {
                        icon.style.transition = '';
                        icon.style.transform = '';
                    }, 350);
                }
                toggleButton.setAttribute('aria-label', `Switch to ${this.currentTheme === 'light' ? 'dark' : 'light'} mode`);
            }
        }

        /**
         * Setup theme toggle button
         */
        setupToggleButton(buttonId = 'theme-toggle') {
            const toggleButton = document.getElementById(buttonId);
            if (!toggleButton) {
                console.warn(`⚠️ Theme toggle button not found: #${buttonId}`);
                return;
            }

            // Check if already initialized to prevent duplicate listeners
            if (toggleButton.dataset.themeInitialized === 'true') {
                console.log('✅ Theme toggle button already initialized');
                return;
            }

            // Attach click listener
            toggleButton.addEventListener('click', () => {
                this.toggleTheme();
            });
            
            // Mark as initialized
            toggleButton.dataset.themeInitialized = 'true';
            
            this.updateToggleButton();
            console.log('✅ Theme toggle button setup complete');
        }

        /**
         * Update meta theme-color for mobile browsers
         */
        updateMetaThemeColor(theme) {
            let metaThemeColor = document.querySelector('meta[name="theme-color"]');
            
            if (!metaThemeColor) {
                metaThemeColor = document.createElement('meta');
                metaThemeColor.name = 'theme-color';
                document.head.appendChild(metaThemeColor);
            }
            
            // Set color based on theme
            const color = theme === 'dark' ? '#121212' : '#ffffff';
            metaThemeColor.content = color;
        }

        /**
         * Add theme change listener
         */
        addListener(callback) {
            if (typeof callback === 'function') {
                this.listeners.push(callback);
            }
        }

        /**
         * Remove theme change listener
         */
        removeListener(callback) {
            const index = this.listeners.indexOf(callback);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        }

        /**
         * Notify all listeners of theme change
         */
        notifyListeners(theme) {
            this.listeners.forEach(callback => {
                try {
                    callback(theme);
                } catch (error) {
                    console.error('❌ Error in theme listener:', error);
                }
            });
        }

        /**
         * Get theme statistics
         */
        getStats() {
            return {
                currentTheme: this.currentTheme,
                isInitialized: this.isInitialized,
                listenerCount: this.listeners.length,
                storageKey: this.storageKey
            };
        }
    }

    // Create singleton instance
    const unifiedThemeManager = new UnifiedThemeManager();

    // Export to global scope
    global.UnifiedThemeManager = UnifiedThemeManager;
    global.unifiedThemeManager = unifiedThemeManager;

    // Auto-initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            unifiedThemeManager.initialize();
        });
    } else {
        unifiedThemeManager.initialize();
    }

    console.log('✅ UnifiedThemeManager loaded');

})(window);

