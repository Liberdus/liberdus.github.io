/**
 * ThemeManager - Complete light/dark theme system with smooth transitions
 * Provides comprehensive theme management with persistent storage and system detection
 * Supports custom themes, smooth animations, and component-specific styling
 *
 * ENHANCED SINGLETON PATTERN - Completely prevents redeclaration errors
 */
(function(global) {
    'use strict';

    // CRITICAL FIX: Enhanced redeclaration prevention with instance management
    if (global.ThemeManager) {
        console.warn('ThemeManager class already exists, skipping redeclaration');
        return;
    }

    // Check for existing instance and preserve it
    if (global.themeManager) {
        console.warn('ThemeManager instance already exists, preserving existing instance');
        return;
    }

class ThemeManager {
    constructor() {
        this.currentTheme = 'light';
        this.isInitialized = false;
        this.transitionDuration = 300;
        this.storageKey = 'lp-staking-theme';
        this.systemThemeQuery = null;
        
        // Theme definitions
        this.themes = {
            light: {
                name: 'Light',
                icon: '☀️',
                colors: {
                    // Primary colors
                    primary: '#1976d2',
                    primaryHover: '#1565c0',
                    primaryLight: '#e3f2fd',
                    secondary: '#dc004e',
                    secondaryHover: '#b8003e',
                    
                    // Background colors
                    background: '#ffffff',
                    backgroundSecondary: '#f8f9fa',
                    backgroundTertiary: '#f5f5f5',
                    surface: '#ffffff',
                    surfaceHover: '#f8f9fa',
                    
                    // Text colors
                    textPrimary: '#212529',
                    textSecondary: '#6c757d',
                    textMuted: '#adb5bd',
                    textInverse: '#ffffff',
                    
                    // Border colors
                    border: '#dee2e6',
                    borderLight: '#e9ecef',
                    borderDark: '#ced4da',
                    
                    // Status colors
                    success: '#28a745',
                    successLight: '#d4edda',
                    warning: '#ffc107',
                    warningLight: '#fff3cd',
                    error: '#dc3545',
                    errorLight: '#f8d7da',
                    info: '#17a2b8',
                    infoLight: '#d1ecf1',
                    
                    // Component specific
                    cardBackground: '#ffffff',
                    cardShadow: 'rgba(0, 0, 0, 0.1)',
                    modalOverlay: 'rgba(0, 0, 0, 0.5)',
                    inputBackground: '#ffffff',
                    inputBorder: '#ced4da',
                    buttonShadow: 'rgba(0, 0, 0, 0.1)',
                    
                    // Chart colors
                    chartPrimary: '#1976d2',
                    chartSecondary: '#dc004e',
                    chartTertiary: '#28a745',
                    chartGrid: '#e9ecef'
                }
            },
            dark: {
                name: 'Dark',
                icon: '🌙',
                colors: {
                    // Primary colors
                    primary: '#4fc3f7',
                    primaryHover: '#29b6f6',
                    primaryLight: '#1a237e',
                    secondary: '#f48fb1',
                    secondaryHover: '#f06292',
                    
                    // Background colors
                    background: '#121212',
                    backgroundSecondary: '#1e1e1e',
                    backgroundTertiary: '#2d2d2d',
                    surface: '#1e1e1e',
                    surfaceHover: '#2d2d2d',
                    
                    // Text colors
                    textPrimary: '#ffffff',
                    textSecondary: '#b0b0b0',
                    textMuted: '#757575',
                    textInverse: '#121212',
                    
                    // Border colors
                    border: '#404040',
                    borderLight: '#333333',
                    borderDark: '#555555',
                    
                    // Status colors
                    success: '#4caf50',
                    successLight: '#1b5e20',
                    warning: '#ff9800',
                    warningLight: '#e65100',
                    error: '#f44336',
                    errorLight: '#b71c1c',
                    info: '#2196f3',
                    infoLight: '#0d47a1',
                    
                    // Component specific
                    cardBackground: '#1e1e1e',
                    cardShadow: 'rgba(0, 0, 0, 0.3)',
                    modalOverlay: 'rgba(0, 0, 0, 0.7)',
                    inputBackground: '#2d2d2d',
                    inputBorder: '#404040',
                    buttonShadow: 'rgba(0, 0, 0, 0.3)',
                    
                    // Chart colors
                    chartPrimary: '#4fc3f7',
                    chartSecondary: '#f48fb1',
                    chartTertiary: '#4caf50',
                    chartGrid: '#404040'
                }
            }
        };
        
        this.log('ThemeManager initialized');
    }

    /**
     * Initialize theme system
     */
    initialize() {
        if (this.isInitialized) {
            this.log('ThemeManager already initialized');
            return;
        }

        this.setupSystemThemeDetection();
        this.loadSavedTheme();
        this.injectThemeStyles();
        this.setupThemeToggle();
        this.applyTheme(this.currentTheme);
        
        this.isInitialized = true;
        this.log('ThemeManager initialization complete');
    }

    /**
     * Setup system theme detection
     */
    setupSystemThemeDetection() {
        if (window.matchMedia) {
            this.systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
            
            // Listen for system theme changes
            this.systemThemeQuery.addEventListener('change', (e) => {
                if (this.currentTheme === 'system') {
                    this.applySystemTheme();
                }
            });
            
            this.log('System theme detection setup complete');
        }
    }

    /**
     * Load saved theme from storage
     */
    loadSavedTheme() {
        try {
            const savedTheme = localStorage.getItem(this.storageKey);
            if (savedTheme && this.themes[savedTheme]) {
                this.currentTheme = savedTheme;
            } else if (this.systemThemeQuery?.matches) {
                this.currentTheme = 'dark';
            }
        } catch (error) {
            this.log('Error loading saved theme:', error);
        }
        
        this.log(`Loaded theme: ${this.currentTheme}`);
    }

    /**
     * Save theme to storage
     */
    saveTheme(theme) {
        try {
            localStorage.setItem(this.storageKey, theme);
        } catch (error) {
            this.log('Error saving theme:', error);
        }
    }

    /**
     * Inject theme styles
     */
    injectThemeStyles() {
        const styleId = 'theme-styles';
        if (document.getElementById(styleId)) {
            return; // Styles already injected
        }

        const styles = `
            :root {
                --transition-theme: all ${this.transitionDuration}ms cubic-bezier(0.4, 0, 0.2, 1);
            }

            * {
                transition: background-color ${this.transitionDuration}ms cubic-bezier(0.4, 0, 0.2, 1),
                           border-color ${this.transitionDuration}ms cubic-bezier(0.4, 0, 0.2, 1),
                           color ${this.transitionDuration}ms cubic-bezier(0.4, 0, 0.2, 1),
                           box-shadow ${this.transitionDuration}ms cubic-bezier(0.4, 0, 0.2, 1);
            }

            .theme-toggle {
                background: var(--surface);
                border: 2px solid var(--border);
                border-radius: 50px;
                padding: 8px 16px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                font-weight: 600;
                color: var(--text-primary);
                transition: var(--transition-theme);
                user-select: none;
            }

            .theme-toggle:hover {
                background: var(--surface-hover);
                border-color: var(--primary);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px var(--button-shadow);
            }

            .theme-toggle-icon {
                font-size: 16px;
                transition: transform 0.3s ease;
            }

            .theme-toggle:hover .theme-toggle-icon {
                transform: scale(1.2);
            }

            /* Smooth theme transition overlay */
            .theme-transition-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: var(--background);
                z-index: 99999;
                opacity: 0;
                pointer-events: none;
                transition: opacity ${this.transitionDuration}ms ease;
            }

            .theme-transition-overlay.active {
                opacity: 1;
            }

            /* Theme-aware components */
            .themed-card {
                background: var(--card-background);
                border: 1px solid var(--border);
                box-shadow: 0 2px 8px var(--card-shadow);
                color: var(--text-primary);
            }

            .themed-input {
                background: var(--input-background);
                border: 1px solid var(--input-border);
                color: var(--text-primary);
            }

            .themed-input:focus {
                border-color: var(--primary);
                box-shadow: 0 0 0 3px var(--primary-light);
            }

            .themed-button {
                background: var(--primary);
                color: var(--text-inverse);
                border: none;
                box-shadow: 0 2px 8px var(--button-shadow);
            }

            .themed-button:hover {
                background: var(--primary-hover);
                transform: translateY(-2px);
            }

            /* Status indicators */
            .status-success { color: var(--success); background: var(--success-light); }
            .status-warning { color: var(--warning); background: var(--warning-light); }
            .status-error { color: var(--error); background: var(--error-light); }
            .status-info { color: var(--info); background: var(--info-light); }
        `;

        const styleSheet = document.createElement('style');
        styleSheet.id = styleId;
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
        
        this.log('Theme styles injected');
    }

    /**
     * Setup theme toggle button
     */
    setupThemeToggle() {
        // Find existing theme toggle or create one
        let toggleButton = document.querySelector('.theme-toggle');
        
        if (!toggleButton) {
            // Look for a placeholder or create in header
            const header = document.querySelector('header') || document.querySelector('.header');
            if (header) {
                toggleButton = document.createElement('button');
                toggleButton.className = 'theme-toggle';
                header.appendChild(toggleButton);
            }
        }

        if (toggleButton) {
            this.updateToggleButton(toggleButton);
            
            toggleButton.addEventListener('click', () => {
                this.toggleTheme();
            });
            
            this.log('Theme toggle button setup complete');
        }
    }

    /**
     * Update toggle button appearance
     */
    updateToggleButton(button) {
        const theme = this.themes[this.currentTheme];
        if (theme) {
            button.innerHTML = `
                <span class="theme-toggle-icon">${theme.icon}</span>
                <span>${theme.name}</span>
            `;
        }
    }

    /**
     * Apply theme
     */
    applyTheme(themeName) {
        const theme = this.themes[themeName];
        if (!theme) {
            this.log(`Theme ${themeName} not found`);
            return;
        }

        // Create transition overlay for smooth theme change
        this.createTransitionOverlay();

        // Apply CSS custom properties
        const root = document.documentElement;
        Object.entries(theme.colors).forEach(([key, value]) => {
            const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
            root.style.setProperty(cssVar, value);
        });

        // Update body class
        document.body.className = document.body.className.replace(/theme-\w+/g, '');
        document.body.classList.add(`theme-${themeName}`);

        // Update meta theme-color for mobile browsers
        this.updateMetaThemeColor(theme.colors.primary);

        // Update toggle button
        const toggleButton = document.querySelector('.theme-toggle');
        if (toggleButton) {
            this.updateToggleButton(toggleButton);
        }

        // Save theme
        this.saveTheme(themeName);
        this.currentTheme = themeName;

        // Notify other components
        if (global.stateManager) {
            global.stateManager.set('ui.theme', {
                name: themeName,
                colors: theme.colors
            });
        }

        // Show notification
        if (global.notificationManager) {
            global.notificationManager.success(`Switched to ${theme.name} theme`, {
                duration: 2000
            });
        }

        this.log(`Applied theme: ${themeName}`);
    }

    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
    }

    /**
     * Apply system theme
     */
    applySystemTheme() {
        const systemTheme = this.systemThemeQuery?.matches ? 'dark' : 'light';
        this.applyTheme(systemTheme);
    }

    /**
     * Create smooth transition overlay
     */
    createTransitionOverlay() {
        let overlay = document.querySelector('.theme-transition-overlay');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'theme-transition-overlay';
            document.body.appendChild(overlay);
        }

        // Trigger transition
        overlay.classList.add('active');
        
        setTimeout(() => {
            overlay.classList.remove('active');
        }, this.transitionDuration / 2);
    }

    /**
     * Update meta theme-color for mobile browsers
     */
    updateMetaThemeColor(color) {
        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = 'theme-color';
            document.head.appendChild(metaThemeColor);
        }
        
        metaThemeColor.content = color;
    }

    /**
     * Get current theme
     */
    getCurrentTheme() {
        return {
            name: this.currentTheme,
            ...this.themes[this.currentTheme]
        };
    }

    /**
     * Get available themes
     */
    getAvailableThemes() {
        return Object.keys(this.themes).map(key => ({
            key,
            ...this.themes[key]
        }));
    }

    /**
     * Add custom theme
     */
    addTheme(name, themeConfig) {
        this.themes[name] = themeConfig;
        this.log(`Custom theme added: ${name}`);
    }

    /**
     * Remove custom theme
     */
    removeTheme(name) {
        if (name === 'light' || name === 'dark') {
            this.log('Cannot remove default themes');
            return false;
        }
        
        if (this.currentTheme === name) {
            this.applyTheme('light');
        }
        
        delete this.themes[name];
        this.log(`Custom theme removed: ${name}`);
        return true;
    }

    /**
     * Get theme statistics
     */
    getStats() {
        return {
            currentTheme: this.currentTheme,
            availableThemes: Object.keys(this.themes).length,
            systemThemeSupported: !!this.systemThemeQuery,
            systemPrefersDark: this.systemThemeQuery?.matches || false
        };
    }

    /**
     * Cleanup theme manager
     */
    cleanup() {
        // Remove event listeners
        if (this.systemThemeQuery) {
            this.systemThemeQuery.removeEventListener('change', this.applySystemTheme);
        }
        
        // Remove styles
        const styles = document.getElementById('theme-styles');
        if (styles) {
            styles.remove();
        }
        
        // Remove transition overlay
        const overlay = document.querySelector('.theme-transition-overlay');
        if (overlay) {
            overlay.remove();
        }
        
        this.isInitialized = false;
        this.log('ThemeManager cleaned up');
    }

    /**
     * Logging utility
     */
    log(...args) {
        if (window.CONFIG?.DEV?.DEBUG_MODE) {
            console.log('[ThemeManager]', ...args);
        }
    }
}

    // Export ThemeManager class to global scope
    global.ThemeManager = ThemeManager;

    // Note: Instance creation is now handled by SystemInitializer
    console.log('✅ ThemeManager class loaded');

})(window);
