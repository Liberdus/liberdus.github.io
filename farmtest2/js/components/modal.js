/**
 * Modal Component System with Full Accessibility Support
 * Handles modal creation, display, and management with WCAG compliance
 * Features: Focus management, keyboard navigation, screen reader support
 *
 * SINGLETON PATTERN - Prevents redeclaration errors
 */
(function(global) {
    'use strict';

    // Prevent redeclaration
    if (global.ModalManager) {
        console.warn('ModalManager already exists, skipping redeclaration');
        return;
    }

class ModalManager {
    constructor() {
        this.activeModals = new Map();
        this.modalContainer = null;
        this.isInitialized = false;
        this.focusStack = []; // Track focus for restoration
        this.modalStack = []; // Track modal order for z-index management
        this.keyboardTrapActive = false;

        this.log('ModalManager initialized with accessibility support');
    }

    /**
     * Initialize modal manager
     */
    initialize() {
        try {
            this.modalContainer = document.getElementById('modal-container');
            if (!this.modalContainer) {
                throw new Error('Modal container not found');
            }
            
            this.isInitialized = true;
            this.log('ModalManager initialized successfully');
            
            return true;
        } catch (error) {
            this.logError('Failed to initialize ModalManager:', error);
            throw error;
        }
    }

    /**
     * Show a modal with full accessibility support
     */
    show(modalId, content, options = {}) {
        try {
            if (!this.isInitialized) {
                this.initialize();
            }

            // Store current focus for restoration
            this.focusStack.push(document.activeElement);

            const modal = this.createModal(modalId, content, options);
            const modalData = {
                element: modal,
                id: modalId,
                options: options,
                zIndex: 1000 + this.modalStack.length
            };

            this.activeModals.set(modalId, modalData);
            this.modalStack.push(modalId);

            // Set z-index for stacking
            modal.style.zIndex = modalData.zIndex;

            this.modalContainer.appendChild(modal);
            this.modalContainer.style.display = 'block';

            // Add event listeners
            this.setupModalEventListeners(modalId, modal, options);

            // Set up accessibility features
            this.setupAccessibility(modal, options);

            // Focus management
            this.setupFocusManagement(modal, options);

            // Announce to screen readers
            this.announceModal(modalId, options);

            this.log('Modal shown with accessibility:', modalId);

            return modal;
        } catch (error) {
            this.logError('Failed to show modal:', error);
            throw error;
        }
    }

    /**
     * Hide a modal with accessibility cleanup
     */
    hide(modalId) {
        try {
            const modalData = this.activeModals.get(modalId);
            if (!modalData) {
                this.log('Modal not found:', modalId);
                return;
            }

            const modal = modalData.element;

            // Remove from stack
            const stackIndex = this.modalStack.indexOf(modalId);
            if (stackIndex > -1) {
                this.modalStack.splice(stackIndex, 1);
            }

            // Restore focus to previous element
            if (this.focusStack.length > 0) {
                const previousFocus = this.focusStack.pop();
                if (previousFocus && typeof previousFocus.focus === 'function') {
                    setTimeout(() => previousFocus.focus(), 100);
                }
            }

            // Clean up accessibility attributes
            this.cleanupAccessibility(modal);

            // Remove modal with animation
            modal.classList.add('modal-exit');
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);

            this.activeModals.delete(modalId);

            // Hide container if no active modals
            if (this.activeModals.size === 0) {
                this.modalContainer.style.display = 'none';
                this.keyboardTrapActive = false;

                // Remove body scroll lock
                document.body.classList.remove('modal-open');
            }

            this.log('Modal hidden with accessibility cleanup:', modalId);
        } catch (error) {
            this.logError('Failed to hide modal:', error);
        }
    }

    /**
     * Create modal element with accessibility attributes
     */
    createModal(modalId, content, options) {
        const {
            size = 'medium',
            className = '',
            title = '',
            showCloseButton = true,
            closeOnBackdrop = true,
            closeOnEscape = true
        } = options;

        const modal = document.createElement('div');
        modal.className = `modal-backdrop ${className}`;
        modal.id = `${modalId}-backdrop`;
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', `${modalId}-title`);
        modal.setAttribute('aria-describedby', `${modalId}-description`);

        const modalDialog = document.createElement('div');
        modalDialog.className = `modal-dialog modal-${size}`;
        modalDialog.setAttribute('role', 'document');

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';

        // Add header if title is provided
        if (title || showCloseButton) {
            const header = document.createElement('div');
            header.className = 'modal-header';

            if (title) {
                const titleElement = document.createElement('h2');
                titleElement.className = 'modal-title';
                titleElement.id = `${modalId}-title`;
                titleElement.textContent = title;
                header.appendChild(titleElement);
            }

            if (showCloseButton) {
                const closeButton = document.createElement('button');
                closeButton.className = 'modal-close';
                closeButton.type = 'button';
                closeButton.setAttribute('aria-label', 'Close modal');
                closeButton.innerHTML = '×';
                header.appendChild(closeButton);
            }

            modalContent.appendChild(header);
        }

        // Add body content
        const body = document.createElement('div');
        body.className = 'modal-body';
        body.id = `${modalId}-description`;

        if (typeof content === 'string') {
            body.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            body.appendChild(content);
        }

        modalContent.appendChild(body);
        modalDialog.appendChild(modalContent);
        modal.appendChild(modalDialog);

        return modal;
    }

    /**
     * Setup modal event listeners with enhanced keyboard support
     */
    setupModalEventListeners(modalId, modal, options) {
        // Close on backdrop click
        if (options.closeOnBackdrop !== false) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hide(modalId);
                }
            });
        }

        // Enhanced keyboard handling
        const keydownHandler = (e) => {
            // Close on escape key
            if (e.key === 'Escape' && options.closeOnEscape !== false) {
                e.preventDefault();
                this.hide(modalId);
                return;
            }

            // Tab key handling for focus trap
            if (e.key === 'Tab') {
                this.handleTabKey(e, modal);
            }
        };

        document.addEventListener('keydown', keydownHandler);

        // Store handler for cleanup
        modal._keydownHandler = keydownHandler;

        // Close button
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hide(modalId);
            });
        }
    }

    /**
     * Handle Tab key for focus trapping
     */
    handleTabKey(e, modal) {
        const focusableElements = this.getFocusableElements(modal);
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
            // Shift + Tab
            if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            }
        } else {
            // Tab
            if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    }

    /**
     * Get all focusable elements within modal
     */
    getFocusableElements(modal) {
        const focusableSelectors = [
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            'a[href]',
            '[tabindex]:not([tabindex="-1"])'
        ].join(', ');

        return Array.from(modal.querySelectorAll(focusableSelectors))
            .filter(el => {
                return el.offsetWidth > 0 && el.offsetHeight > 0 &&
                       getComputedStyle(el).visibility !== 'hidden';
            });
    }

    /**
     * Setup accessibility features
     */
    setupAccessibility(modal, options) {
        // Lock body scroll
        document.body.classList.add('modal-open');

        // Set initial focus
        this.setInitialFocus(modal, options);

        // Enable keyboard trap
        this.keyboardTrapActive = true;
    }

    /**
     * Set initial focus in modal
     */
    setInitialFocus(modal, options) {
        const { initialFocus } = options;

        let focusTarget = null;

        if (initialFocus) {
            if (typeof initialFocus === 'string') {
                focusTarget = modal.querySelector(initialFocus);
            } else if (initialFocus instanceof HTMLElement) {
                focusTarget = initialFocus;
            }
        }

        // Fallback to first focusable element
        if (!focusTarget) {
            const focusableElements = this.getFocusableElements(modal);
            focusTarget = focusableElements[0];
        }

        // Final fallback to modal itself
        if (!focusTarget) {
            focusTarget = modal;
            modal.setAttribute('tabindex', '-1');
        }

        setTimeout(() => {
            if (focusTarget) {
                focusTarget.focus();
            }
        }, 100);
    }

    /**
     * Setup focus management
     */
    setupFocusManagement(modal, options) {
        // Prevent focus from leaving modal
        const focusableElements = this.getFocusableElements(modal);

        if (focusableElements.length > 0) {
            // Add focus event listeners to trap focus
            focusableElements.forEach(element => {
                element.addEventListener('focus', () => {
                    // Element is now focused within modal
                });
            });
        }
    }

    /**
     * Announce modal to screen readers
     */
    announceModal(modalId, options) {
        const { announcement } = options;

        if (announcement) {
            const announcer = document.createElement('div');
            announcer.setAttribute('aria-live', 'polite');
            announcer.setAttribute('aria-atomic', 'true');
            announcer.className = 'sr-only';
            announcer.textContent = announcement;

            document.body.appendChild(announcer);

            setTimeout(() => {
                document.body.removeChild(announcer);
            }, 1000);
        }
    }

    /**
     * Clean up accessibility attributes
     */
    cleanupAccessibility(modal) {
        // Remove keyboard event listener
        if (modal._keydownHandler) {
            document.removeEventListener('keydown', modal._keydownHandler);
            delete modal._keydownHandler;
        }

        // Remove any temporary tabindex
        if (modal.getAttribute('tabindex') === '-1') {
            modal.removeAttribute('tabindex');
        }
    }

    /**
     * Hide all modals
     */
    hideAll() {
        const modalIds = Array.from(this.activeModals.keys());
        modalIds.forEach(modalId => this.hide(modalId));
    }

    /**
     * Check if modal is active
     */
    isActive(modalId) {
        return this.activeModals.has(modalId);
    }

    /**
     * Get active modal count
     */
    getActiveCount() {
        return this.activeModals.size;
    }

    /**
     * Logging utility
     */
    log(...args) {
        if (window.CONFIG?.DEV?.DEBUG_MODE) {
            console.log('[ModalManager]', ...args);
        }
    }

    /**
     * Error logging utility
     */
    logError(...args) {
        console.error('[ModalManager]', ...args);
    }
}

    /**
     * Create modal with predefined templates
     */
    createConfirmModal(title, message, options = {}) {
        const {
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            confirmClass = 'btn-primary',
            cancelClass = 'btn-secondary',
            onConfirm = () => {},
            onCancel = () => {}
        } = options;

        const content = `
            <div class="modal-body">
                <p>${this.escapeHtml(message)}</p>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn ${cancelClass}" data-action="cancel">
                    ${this.escapeHtml(cancelText)}
                </button>
                <button type="button" class="btn ${confirmClass}" data-action="confirm">
                    ${this.escapeHtml(confirmText)}
                </button>
            </div>
        `;

        const modalId = `confirm-${Date.now()}`;
        const modal = this.show(modalId, content, {
            ...options,
            title,
            size: 'small',
            closeOnBackdrop: false
        });

        // Set up action handlers
        const confirmBtn = modal.querySelector('[data-action="confirm"]');
        const cancelBtn = modal.querySelector('[data-action="cancel"]');

        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                onConfirm();
                this.hide(modalId);
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                onCancel();
                this.hide(modalId);
            });
        }

        return modalId;
    }

    /**
     * Create alert modal
     */
    createAlertModal(title, message, options = {}) {
        const {
            buttonText = 'OK',
            buttonClass = 'btn-primary',
            onClose = () => {}
        } = options;

        const content = `
            <div class="modal-body">
                <p>${this.escapeHtml(message)}</p>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn ${buttonClass}" data-action="close">
                    ${this.escapeHtml(buttonText)}
                </button>
            </div>
        `;

        const modalId = `alert-${Date.now()}`;
        const modal = this.show(modalId, content, {
            ...options,
            title,
            size: 'small'
        });

        // Set up close handler
        const closeBtn = modal.querySelector('[data-action="close"]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                onClose();
                this.hide(modalId);
            });
        }

        return modalId;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

    // Export ModalManager class to global scope
    global.ModalManager = ModalManager;

    // Create singleton instance if it doesn't exist
    if (!global.modalManager) {
        global.modalManager = new ModalManager();
        console.log('✅ ModalManager instance created');
    }

})(window);
