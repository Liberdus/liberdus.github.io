/**
 * AccessibilityManager - Comprehensive accessibility enhancements
 * Provides ARIA labels, keyboard navigation, screen reader support, and focus management
 */

class AccessibilityManager {
    constructor() {
        this.focusableElements = [
            'a[href]',
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ].join(', ');
        
        this.init();
    }

    init() {
        this.setupKeyboardNavigation();
        this.setupFocusManagement();
        this.setupScreenReaderSupport();
        this.setupSkipLinks();
        this.enhanceExistingElements();
    }

    setupKeyboardNavigation() {
        // Global keyboard event handler
        document.addEventListener('keydown', (e) => {
            this.handleGlobalKeydown(e);
        });

        // Tab trap for modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                const modal = document.querySelector('.modal.show, .notification.show');
                if (modal) {
                    this.trapFocus(e, modal);
                }
            }
        });
    }

    handleGlobalKeydown(e) {
        // Escape key handling
        if (e.key === 'Escape') {
            this.handleEscapeKey();
        }

        // Enter key for button-like elements
        if (e.key === 'Enter' && e.target.getAttribute('role') === 'button') {
            e.target.click();
        }

        // Arrow key navigation for lists and tables
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            this.handleArrowNavigation(e);
        }
    }

    handleEscapeKey() {
        // Close modals
        const modal = document.querySelector('.modal.show');
        if (modal) {
            const closeBtn = modal.querySelector('.modal-close, .btn-cancel');
            if (closeBtn) closeBtn.click();
            return;
        }

        // Close notifications
        const notification = document.querySelector('.notification:last-child');
        if (notification) {
            const closeBtn = notification.querySelector('.notification-close');
            if (closeBtn) closeBtn.click();
            return;
        }

        // Close dropdowns or popups
        const dropdown = document.querySelector('.dropdown.show, .popup.show');
        if (dropdown) {
            dropdown.classList.remove('show');
        }
    }

    handleArrowNavigation(e) {
        const target = e.target;
        const parent = target.closest('[role="listbox"], [role="menu"], [role="tablist"], table tbody');
        
        if (!parent) return;

        const items = Array.from(parent.querySelectorAll(this.focusableElements));
        const currentIndex = items.indexOf(target);
        
        if (currentIndex === -1) return;

        let nextIndex;
        
        switch (e.key) {
            case 'ArrowUp':
                nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
                break;
            case 'ArrowDown':
                nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
                break;
            case 'ArrowLeft':
                if (parent.getAttribute('role') === 'tablist') {
                    nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
                }
                break;
            case 'ArrowRight':
                if (parent.getAttribute('role') === 'tablist') {
                    nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
                }
                break;
        }

        if (nextIndex !== undefined) {
            e.preventDefault();
            items[nextIndex].focus();
        }
    }

    trapFocus(e, container) {
        const focusableElements = container.querySelectorAll(this.focusableElements);
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            }
        } else {
            if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    }

    setupFocusManagement() {
        // Store focus before modal opens
        document.addEventListener('modalOpen', (e) => {
            this.previousFocus = document.activeElement;
            
            // Focus first focusable element in modal
            setTimeout(() => {
                const modal = e.detail.modal;
                const firstFocusable = modal.querySelector(this.focusableElements);
                if (firstFocusable) {
                    firstFocusable.focus();
                }
            }, 100);
        });

        // Restore focus when modal closes
        document.addEventListener('modalClose', () => {
            if (this.previousFocus) {
                this.previousFocus.focus();
                this.previousFocus = null;
            }
        });

        // Focus management for dynamic content
        this.setupFocusIndicators();
    }

    setupFocusIndicators() {
        // Enhanced focus styles
        const style = document.createElement('style');
        style.textContent = `
            /* Enhanced focus indicators */
            *:focus {
                outline: 2px solid var(--primary-main);
                outline-offset: 2px;
            }

            /* Custom focus styles for specific elements */
            .btn:focus,
            button:focus {
                outline: 2px solid var(--primary-main);
                outline-offset: 2px;
                box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.2);
            }

            .form-control:focus,
            input:focus,
            textarea:focus,
            select:focus {
                outline: 2px solid var(--primary-main);
                outline-offset: -2px;
                box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.2);
            }

            /* Skip focus for mouse users */
            .js-focus-visible *:focus:not(.focus-visible) {
                outline: none;
                box-shadow: none;
            }

            /* High contrast mode support */
            @media (prefers-contrast: high) {
                *:focus {
                    outline: 3px solid;
                    outline-offset: 2px;
                }
            }
        `;
        document.head.appendChild(style);

        // Focus-visible polyfill behavior
        document.body.classList.add('js-focus-visible');
    }

    setupScreenReaderSupport() {
        // Create live region for announcements
        this.createLiveRegion();

        // Enhance form labels and descriptions
        this.enhanceFormAccessibility();

        // Add landmark roles
        this.addLandmarkRoles();
    }

    createLiveRegion() {
        if (document.getElementById('sr-live-region')) return;

        const liveRegion = document.createElement('div');
        liveRegion.id = 'sr-live-region';
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `;
        
        document.body.appendChild(liveRegion);
        this.liveRegion = liveRegion;
    }

    announce(message, priority = 'polite') {
        if (!this.liveRegion) this.createLiveRegion();
        
        this.liveRegion.setAttribute('aria-live', priority);
        this.liveRegion.textContent = message;
        
        // Clear after announcement
        setTimeout(() => {
            this.liveRegion.textContent = '';
        }, 1000);
    }

    enhanceFormAccessibility() {
        // Auto-generate labels for inputs without them
        document.querySelectorAll('input, textarea, select').forEach(input => {
            if (!input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')) {
                const label = input.closest('label') || 
                             document.querySelector(`label[for="${input.id}"]`);
                
                if (!label && input.placeholder) {
                    input.setAttribute('aria-label', input.placeholder);
                }
            }

            // Add required indicators
            if (input.required && !input.getAttribute('aria-required')) {
                input.setAttribute('aria-required', 'true');
            }

            // Add invalid state
            if (input.getAttribute('aria-invalid') === null) {
                input.setAttribute('aria-invalid', 'false');
            }
        });

        // Form validation announcements
        document.addEventListener('invalid', (e) => {
            const input = e.target;
            const message = input.validationMessage || 'This field is invalid';
            this.announce(`Error: ${message}`, 'assertive');
            input.setAttribute('aria-invalid', 'true');
        });

        document.addEventListener('input', (e) => {
            const input = e.target;
            if (input.checkValidity()) {
                input.setAttribute('aria-invalid', 'false');
            }
        });
    }

    addLandmarkRoles() {
        // Add main landmark if not present
        if (!document.querySelector('main, [role="main"]')) {
            const mainContent = document.querySelector('.main-content, #main, .container');
            if (mainContent) {
                mainContent.setAttribute('role', 'main');
            }
        }

        // Add navigation landmarks
        document.querySelectorAll('nav').forEach(nav => {
            if (!nav.getAttribute('role')) {
                nav.setAttribute('role', 'navigation');
            }
        });

        // Add banner and contentinfo roles
        const header = document.querySelector('header');
        if (header && !header.getAttribute('role')) {
            header.setAttribute('role', 'banner');
        }

        const footer = document.querySelector('footer');
        if (footer && !footer.getAttribute('role')) {
            footer.setAttribute('role', 'contentinfo');
        }
    }

    setupSkipLinks() {
        if (document.querySelector('.skip-link')) return;

        const skipLink = document.createElement('a');
        skipLink.href = '#main-content';
        skipLink.className = 'skip-link';
        skipLink.textContent = 'Skip to main content';
        
        skipLink.style.cssText = `
            position: absolute;
            top: -40px;
            left: 6px;
            background: var(--primary-main);
            color: white;
            padding: 8px;
            text-decoration: none;
            border-radius: 4px;
            z-index: 10000;
            transition: top 0.3s;
        `;

        skipLink.addEventListener('focus', () => {
            skipLink.style.top = '6px';
        });

        skipLink.addEventListener('blur', () => {
            skipLink.style.top = '-40px';
        });

        document.body.insertBefore(skipLink, document.body.firstChild);

        // Ensure main content has ID
        const mainContent = document.querySelector('main, [role="main"], .main-content');
        if (mainContent && !mainContent.id) {
            mainContent.id = 'main-content';
        }
    }

    enhanceExistingElements() {
        // Enhance buttons
        document.querySelectorAll('button, .btn').forEach(btn => {
            if (!btn.getAttribute('type') && btn.tagName === 'BUTTON') {
                btn.setAttribute('type', 'button');
            }
        });

        // Enhance links
        document.querySelectorAll('a[target="_blank"]').forEach(link => {
            if (!link.getAttribute('aria-label') && !link.textContent.includes('opens in new window')) {
                const currentLabel = link.getAttribute('aria-label') || link.textContent;
                link.setAttribute('aria-label', `${currentLabel} (opens in new window)`);
            }
        });

        // Enhance tables
        document.querySelectorAll('table').forEach(table => {
            if (!table.getAttribute('role')) {
                table.setAttribute('role', 'table');
            }

            // Add caption if missing
            if (!table.querySelector('caption') && !table.getAttribute('aria-label')) {
                const heading = table.previousElementSibling;
                if (heading && heading.matches('h1, h2, h3, h4, h5, h6')) {
                    table.setAttribute('aria-labelledby', heading.id || this.generateId(heading));
                }
            }
        });

        // Enhance modals
        document.querySelectorAll('.modal').forEach(modal => {
            if (!modal.getAttribute('role')) {
                modal.setAttribute('role', 'dialog');
            }
            if (!modal.getAttribute('aria-modal')) {
                modal.setAttribute('aria-modal', 'true');
            }
        });
    }

    generateId(element) {
        const id = 'a11y-' + Math.random().toString(36).substr(2, 9);
        element.id = id;
        return id;
    }

    // Public methods for components to use
    setFocusToElement(selector) {
        const element = document.querySelector(selector);
        if (element) {
            element.focus();
        }
    }

    announceToUser(message, priority = 'polite') {
        this.announce(message, priority);
    }

    addAriaLabel(element, label) {
        if (element) {
            element.setAttribute('aria-label', label);
        }
    }

    addAriaDescription(element, description) {
        if (element) {
            const descId = this.generateId(document.createElement('div'));
            const descElement = document.createElement('div');
            descElement.id = descId;
            descElement.textContent = description;
            descElement.style.cssText = 'position: absolute; left: -10000px;';
            
            document.body.appendChild(descElement);
            element.setAttribute('aria-describedby', descId);
        }
    }
}

// Initialize accessibility manager
window.AccessibilityManager = AccessibilityManager;

document.addEventListener('DOMContentLoaded', () => {
    if (!window.accessibilityManager) {
        window.accessibilityManager = new AccessibilityManager();
    }
});
