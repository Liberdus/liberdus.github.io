/**
 * LoadingManager - Advanced loading states and skeleton components
 * Provides comprehensive loading indicators, skeleton screens, and progress tracking
 */

class LoadingManager {
    constructor() {
        this.activeLoaders = new Map();
        this.globalLoadingState = false;
        this.init();
    }

    init() {
        this.addStyles();
        this.createGlobalLoader();
    }

    addStyles() {
        if (document.getElementById('loading-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'loading-styles';
        styles.textContent = `
            /* Global Loading Overlay */
            .global-loading-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
            }

            .global-loading-overlay.show {
                opacity: 1;
                visibility: visible;
            }

            .global-loader {
                background: var(--background-paper);
                border-radius: 12px;
                padding: 32px;
                box-shadow: var(--shadow-8);
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 16px;
                min-width: 200px;
            }

            /* Spinner Animations */
            .spinner {
                width: 40px;
                height: 40px;
                border: 3px solid var(--divider);
                border-top: 3px solid var(--primary-main);
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            .spinner.small {
                width: 20px;
                height: 20px;
                border-width: 2px;
            }

            .spinner.large {
                width: 60px;
                height: 60px;
                border-width: 4px;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            /* Pulse Animation */
            .pulse {
                animation: pulse 1.5s ease-in-out infinite;
            }

            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }

            /* Skeleton Loading */
            .skeleton {
                background: linear-gradient(90deg, 
                    var(--divider) 25%, 
                    rgba(255, 255, 255, 0.1) 50%, 
                    var(--divider) 75%);
                background-size: 200% 100%;
                animation: skeleton-loading 1.5s infinite;
                border-radius: 4px;
            }

            @keyframes skeleton-loading {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }

            .skeleton-text {
                height: 16px;
                margin: 4px 0;
            }

            .skeleton-text.large {
                height: 24px;
            }

            .skeleton-text.small {
                height: 12px;
            }

            .skeleton-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
            }

            .skeleton-button {
                height: 36px;
                border-radius: 8px;
            }

            .skeleton-card {
                height: 120px;
                border-radius: 8px;
            }

            /* Loading Button States */
            .btn-loading {
                position: relative;
                pointer-events: none;
                opacity: 0.7;
            }

            .btn-loading::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 16px;
                height: 16px;
                margin: -8px 0 0 -8px;
                border: 2px solid transparent;
                border-top: 2px solid currentColor;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            .btn-loading .btn-text {
                opacity: 0;
            }

            /* Progress Bar */
            .progress-bar {
                width: 100%;
                height: 4px;
                background: var(--divider);
                border-radius: 2px;
                overflow: hidden;
                position: relative;
            }

            .progress-bar-fill {
                height: 100%;
                background: var(--primary-main);
                border-radius: 2px;
                transition: width 0.3s ease;
                position: relative;
            }

            .progress-bar-indeterminate .progress-bar-fill {
                width: 30%;
                animation: progress-indeterminate 2s infinite;
            }

            @keyframes progress-indeterminate {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(400%); }
            }

            /* Loading States for Components */
            .loading-container {
                position: relative;
                min-height: 100px;
            }

            .loading-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255, 255, 255, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: inherit;
                z-index: 10;
            }

            [data-theme="dark"] .loading-overlay {
                background: rgba(0, 0, 0, 0.8);
            }

            /* Responsive Design */
            @media (max-width: 480px) {
                .global-loader {
                    margin: 20px;
                    padding: 24px;
                    min-width: auto;
                    width: calc(100% - 40px);
                }
            }

            /* Respect reduced motion preference */
            @media (prefers-reduced-motion: reduce) {
                .spinner,
                .skeleton,
                .progress-bar-fill {
                    animation: none;
                }

                .pulse {
                    animation: none;
                    opacity: 0.7;
                }
            }
        `;

        document.head.appendChild(styles);
    }

    createGlobalLoader() {
        if (document.getElementById('global-loading-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'global-loading-overlay';
        overlay.className = 'global-loading-overlay';
        
        overlay.innerHTML = `
            <div class="global-loader">
                <div class="spinner large"></div>
                <div class="loading-text">Loading...</div>
                <div class="progress-bar progress-bar-indeterminate">
                    <div class="progress-bar-fill"></div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this.globalOverlay = overlay;
    }

    // Show global loading overlay
    showGlobal(message = 'Loading...') {
        if (!this.globalOverlay) this.createGlobalLoader();
        
        const textElement = this.globalOverlay.querySelector('.loading-text');
        if (textElement) {
            textElement.textContent = message;
        }

        this.globalOverlay.classList.add('show');
        this.globalLoadingState = true;
        document.body.style.overflow = 'hidden';
    }

    // Hide global loading overlay
    hideGlobal() {
        if (this.globalOverlay) {
            this.globalOverlay.classList.remove('show');
        }
        this.globalLoadingState = false;
        document.body.style.overflow = '';
    }

    // Show loading state for specific element
    showElement(element, options = {}) {
        if (!element) return;

        const {
            type = 'spinner',
            size = 'default',
            message = null
        } = options;

        const loaderId = this.generateId();
        
        if (type === 'overlay') {
            this.showOverlay(element, message, loaderId);
        } else if (type === 'button') {
            this.showButtonLoading(element, loaderId);
        } else {
            this.showSpinner(element, size, message, loaderId);
        }

        this.activeLoaders.set(loaderId, { element, type });
        return loaderId;
    }

    // Hide loading state for specific element
    hideElement(loaderId) {
        const loader = this.activeLoaders.get(loaderId);
        if (!loader) return;

        const { element, type } = loader;

        if (type === 'overlay') {
            this.hideOverlay(element);
        } else if (type === 'button') {
            this.hideButtonLoading(element);
        } else {
            this.hideSpinner(element);
        }

        this.activeLoaders.delete(loaderId);
    }

    showOverlay(element, message, loaderId) {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.dataset.loaderId = loaderId;
        
        overlay.innerHTML = `
            <div style="text-align: center;">
                <div class="spinner"></div>
                ${message ? `<div style="margin-top: 12px; color: var(--text-secondary); font-size: 14px;">${message}</div>` : ''}
            </div>
        `;

        element.style.position = 'relative';
        element.appendChild(overlay);
    }

    hideOverlay(element) {
        const overlay = element.querySelector('.loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    showButtonLoading(element) {
        element.classList.add('btn-loading');
        element.disabled = true;
    }

    hideButtonLoading(element) {
        element.classList.remove('btn-loading');
        element.disabled = false;
    }

    showSpinner(element, size, message, loaderId) {
        const spinner = document.createElement('div');
        spinner.className = `spinner ${size}`;
        spinner.dataset.loaderId = loaderId;
        
        if (message) {
            const container = document.createElement('div');
            container.style.textAlign = 'center';
            container.appendChild(spinner);
            
            const text = document.createElement('div');
            text.textContent = message;
            text.style.marginTop = '8px';
            text.style.fontSize = '14px';
            text.style.color = 'var(--text-secondary)';
            container.appendChild(text);
            
            element.appendChild(container);
        } else {
            element.appendChild(spinner);
        }
    }

    hideSpinner(element) {
        const spinners = element.querySelectorAll('.spinner');
        spinners.forEach(spinner => {
            if (spinner.parentElement && spinner.parentElement !== element) {
                spinner.parentElement.remove();
            } else {
                spinner.remove();
            }
        });
    }

    // Create skeleton loading for tables/lists
    createSkeleton(type, count = 3) {
        const container = document.createElement('div');
        
        for (let i = 0; i < count; i++) {
            const item = document.createElement('div');
            item.style.marginBottom = '16px';
            
            if (type === 'table-row') {
                item.innerHTML = `
                    <div class="skeleton skeleton-text" style="width: 20%; display: inline-block; margin-right: 16px;"></div>
                    <div class="skeleton skeleton-text" style="width: 30%; display: inline-block; margin-right: 16px;"></div>
                    <div class="skeleton skeleton-text" style="width: 15%; display: inline-block; margin-right: 16px;"></div>
                    <div class="skeleton skeleton-text" style="width: 25%; display: inline-block;"></div>
                `;
            } else if (type === 'card') {
                item.innerHTML = `
                    <div class="skeleton skeleton-card"></div>
                    <div class="skeleton skeleton-text large" style="width: 80%; margin-top: 12px;"></div>
                    <div class="skeleton skeleton-text" style="width: 60%; margin-top: 8px;"></div>
                `;
            } else {
                item.innerHTML = `
                    <div class="skeleton skeleton-text" style="width: ${60 + Math.random() * 30}%;"></div>
                `;
            }
            
            container.appendChild(item);
        }
        
        return container;
    }

    generateId() {
        return 'loader_' + Math.random().toString(36).substr(2, 9);
    }

    // Clean up all active loaders
    cleanup() {
        this.activeLoaders.forEach((loader, id) => {
            this.hideElement(id);
        });
        this.hideGlobal();
    }
}

// Initialize loading manager
window.LoadingManager = LoadingManager;

// Create global instance
document.addEventListener('DOMContentLoaded', () => {
    if (!window.loadingManager) {
        window.loadingManager = new LoadingManager();
    }
});
