/**
 * NotificationManager - Enhanced toast notifications with accessibility
 * Provides success, error, warning, and info notifications
 * Features: Auto-dismiss, animations, screen reader support, action buttons
 *
 * ENHANCED SINGLETON PATTERN - Completely prevents redeclaration errors
 */
(function(global) {
    'use strict';

    // CRITICAL FIX: Enhanced redeclaration prevention with instance management
    if (global.NotificationManager) {
        console.warn('NotificationManager class already exists, skipping redeclaration');
        return;
    }

    // Check for existing instance and preserve it
    if (global.notificationManager) {
        console.warn('NotificationManager instance already exists, preserving existing instance');
        return;
    }

class NotificationManager {
    constructor() {
        this.container = null;
        this.notifications = new Map();
        this.queue = [];
        this.maxNotifications = 5;
        this.defaultDuration = window.CONFIG?.UI?.NOTIFICATION_DURATION || 5000;
        this.positions = {
            'top-right': 'notification-container-top-right',
            'top-left': 'notification-container-top-left',
            'bottom-right': 'notification-container-bottom-right',
            'bottom-left': 'notification-container-bottom-left',
            'top-center': 'notification-container-top-center',
            'bottom-center': 'notification-container-bottom-center'
        };
        this.currentPosition = 'top-right';

        this.init();
    }

    /**
     * Initialize notification manager
     */
    init() {
        this.container = document.getElementById('notification-container');
        if (!this.container) {
            this.createContainer();
        }

        // Set up global keyboard shortcuts
        this.setupKeyboardShortcuts();

        this.log('NotificationManager initialized with enhanced features');
    }

    /**
     * Create notification container if it doesn't exist
     */
    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.className = `notification-container ${this.positions[this.currentPosition]}`;
        this.container.setAttribute('aria-live', 'polite');
        this.container.setAttribute('aria-atomic', 'false');
        this.container.setAttribute('role', 'status');
        document.body.appendChild(this.container);
    }

    /**
     * Set notification position
     */
    setPosition(position) {
        if (!this.positions[position]) {
            this.logError('Invalid notification position:', position);
            return;
        }

        this.currentPosition = position;
        if (this.container) {
            // Remove old position classes
            Object.values(this.positions).forEach(className => {
                this.container.classList.remove(className);
            });
            // Add new position class
            this.container.classList.add(this.positions[position]);
        }
    }

    /**
     * Setup keyboard shortcuts for notification management
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Shift + D to dismiss all notifications
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                this.dismissAll();
            }
        });
    }

    /**
     * Show notification with enhanced options
     */
    show(type, title, message, options = {}) {
        const {
            duration = this.defaultDuration,
            persistent = false,
            actions = [],
            id = null,
            icon = null,
            className = '',
            priority = 'normal', // 'low', 'normal', 'high', 'urgent'
            sound = false,
            vibrate = false,
            progress = false
        } = options;

        const notification = {
            id: id || this.generateId(),
            type,
            title,
            message,
            duration,
            persistent,
            actions,
            icon,
            className,
            priority,
            sound,
            vibrate,
            progress,
            timestamp: Date.now(),
            startTime: Date.now()
        };

        // Handle priority queue
        if (priority === 'urgent') {
            // Show immediately, potentially removing lower priority notifications
            this.handleUrgentNotification(notification);
        } else if (this.notifications.size >= this.maxNotifications) {
            this.queue.push(notification);
            return notification.id;
        } else {
            this.renderNotification(notification);
        }

        return notification.id;
    }

    /**
     * Handle urgent notifications
     */
    handleUrgentNotification(notification) {
        // If at capacity, remove oldest non-urgent notification
        if (this.notifications.size >= this.maxNotifications) {
            const oldestNonUrgent = Array.from(this.notifications.values())
                .filter(n => n.priority !== 'urgent')
                .sort((a, b) => a.timestamp - b.timestamp)[0];

            if (oldestNonUrgent) {
                this.dismiss(oldestNonUrgent.id);
            }
        }

        this.renderNotification(notification);
    }

    /**
     * Show success notification
     */
    success(title, message, options = {}) {
        return this.show('success', title, message, options);
    }

    /**
     * Show error notification
     */
    error(title, message, options = {}) {
        return this.show('error', title, message, { ...options, persistent: true });
    }

    /**
     * Show warning notification
     */
    warning(title, message, options = {}) {
        return this.show('warning', title, message, options);
    }

    /**
     * Show info notification
     */
    info(title, message, options = {}) {
        return this.show('info', title, message, options);
    }

    /**
     * Render notification to DOM with enhanced features
     */
    renderNotification(notification) {
        const element = this.createNotificationElement(notification);

        // Add to container with proper insertion order
        if (this.currentPosition.includes('top')) {
            this.container.appendChild(element);
        } else {
            this.container.insertBefore(element, this.container.firstChild);
        }

        // Store reference
        this.notifications.set(notification.id, {
            ...notification,
            element,
            progressInterval: null
        });

        // Set up auto-dismiss with progress bar
        if (!notification.persistent && notification.duration > 0) {
            this.setupAutoDismiss(notification);
        }

        // Set up progress bar if enabled
        if (notification.progress && notification.duration > 0) {
            this.setupProgressBar(notification);
        }

        // Trigger entrance animation
        requestAnimationFrame(() => {
            element.classList.add('notification-enter');

            // Trigger sound/vibration if enabled
            this.triggerFeedback(notification);
        });

        // Announce to screen readers for urgent notifications
        if (notification.priority === 'urgent') {
            this.announceToScreenReader(notification);
        }

        this.log('Notification rendered:', notification.type, notification.title);
    }

    /**
     * Setup auto-dismiss with pause on hover
     */
    setupAutoDismiss(notification) {
        const notificationData = this.notifications.get(notification.id);
        if (!notificationData) return;

        let remainingTime = notification.duration;
        let dismissTimer = null;
        let startTime = Date.now();

        const startTimer = () => {
            dismissTimer = setTimeout(() => {
                this.dismiss(notification.id);
            }, remainingTime);
        };

        const pauseTimer = () => {
            if (dismissTimer) {
                clearTimeout(dismissTimer);
                remainingTime -= (Date.now() - startTime);
                dismissTimer = null;
            }
        };

        const resumeTimer = () => {
            startTime = Date.now();
            startTimer();
        };

        // Set up hover events
        notificationData.element.addEventListener('mouseenter', pauseTimer);
        notificationData.element.addEventListener('mouseleave', resumeTimer);
        notificationData.element.addEventListener('focus', pauseTimer);
        notificationData.element.addEventListener('blur', resumeTimer);

        // Start initial timer
        startTimer();

        // Store timer reference for cleanup
        notificationData.dismissTimer = dismissTimer;
    }

    /**
     * Create notification DOM element
     */
    createNotificationElement(notification) {
        const element = document.createElement('div');
        element.className = `notification notification-${notification.type}`;
        element.setAttribute('data-notification-id', notification.id);

        const icon = this.getIcon(notification.type);
        
        element.innerHTML = `
            <div class="notification-icon">${icon}</div>
            <div class="notification-content">
                <div class="notification-title">${this.escapeHtml(notification.title)}</div>
                <div class="notification-message">${this.escapeHtml(notification.message)}</div>
                ${notification.actions.length > 0 ? this.renderActions(notification.actions) : ''}
            </div>
            <button class="notification-close" aria-label="Close notification">×</button>
        `;

        // Set up event listeners
        const closeBtn = element.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.dismiss(notification.id);
        });

        // Set up action buttons
        notification.actions.forEach((action, index) => {
            const actionBtn = element.querySelector(`[data-action-index="${index}"]`);
            if (actionBtn) {
                actionBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    action.handler();
                    if (action.dismissOnClick !== false) {
                        this.dismiss(notification.id);
                    }
                });
            }
        });

        return element;
    }

    /**
     * Render action buttons
     */
    renderActions(actions) {
        return `
            <div class="notification-actions">
                ${actions.map((action, index) => `
                    <button 
                        class="btn btn-small ${action.className || 'btn-primary'}"
                        data-action-index="${index}"
                    >
                        ${this.escapeHtml(action.label)}
                    </button>
                `).join('')}
            </div>
        `;
    }

    /**
     * Get icon for notification type
     */
    getIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    /**
     * Dismiss notification
     */
    dismiss(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        const element = notification.element;

        // Clean up progress interval if it exists
        if (notification.progressInterval) {
            clearInterval(notification.progressInterval);
        }

        // Trigger exit animation
        element.classList.add('notification-exit');

        setTimeout(() => {
            // Remove from DOM
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }

            // Remove from tracking
            this.notifications.delete(id);

            // Process queue
            this.processQueue();

            this.log('Notification dismissed:', id);
        }, 300);
    }

    /**
     * Dismiss all notifications
     */
    dismissAll() {
        const ids = Array.from(this.notifications.keys());
        ids.forEach(id => this.dismiss(id));
    }

    /**
     * Process notification queue
     */
    processQueue() {
        if (this.queue.length > 0 && this.notifications.size < this.maxNotifications) {
            const next = this.queue.shift();
            this.renderNotification(next);
        }
    }

    /**
     * Update existing notification
     */
    update(id, updates) {
        const notification = this.notifications.get(id);
        if (!notification) return false;

        // Update notification data
        Object.assign(notification, updates);

        // Update DOM
        const element = notification.element;
        if (updates.title) {
            const titleEl = element.querySelector('.notification-title');
            if (titleEl) titleEl.textContent = updates.title;
        }
        
        if (updates.message) {
            const messageEl = element.querySelector('.notification-message');
            if (messageEl) messageEl.textContent = updates.message;
        }

        if (updates.type) {
            // Update classes
            element.className = `notification notification-${updates.type}`;
            
            // Update icon
            const iconEl = element.querySelector('.notification-icon');
            if (iconEl) iconEl.textContent = this.getIcon(updates.type);
        }

        return true;
    }

    /**
     * Get notification by ID
     */
    get(id) {
        return this.notifications.get(id);
    }

    /**
     * Get all notifications
     */
    getAll() {
        return Array.from(this.notifications.values());
    }

    /**
     * Clear all notifications
     */
    clear() {
        this.dismissAll();
        this.queue = [];
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Set maximum number of notifications
     */
    setMaxNotifications(max) {
        this.maxNotifications = max;
    }

    /**
     * Set default duration
     */
    setDefaultDuration(duration) {
        this.defaultDuration = duration;
    }

    /**
     * Logging utility
     */
    log(...args) {
        if (window.CONFIG.DEV.DEBUG_MODE) {
            console.log('[NotificationManager]', ...args);
        }
    }

    /**
     * Error logging utility
     */
    logError(...args) {
        console.error('[NotificationManager]', ...args);
    }

    /**
     * Setup progress bar for notification
     */
    setupProgressBar(notification) {
        const notificationData = this.notifications.get(notification.id);
        if (!notificationData) return;

        const element = notificationData.element;
        const progressBar = element.querySelector('.notification-progress');

        if (!progressBar) {
            // Create progress bar if it doesn't exist
            const progressContainer = document.createElement('div');
            progressContainer.className = 'notification-progress-container';
            progressContainer.innerHTML = '<div class="notification-progress"></div>';
            element.appendChild(progressContainer);
        }

        const progressElement = element.querySelector('.notification-progress');
        if (progressElement) {
            let progress = 0;
            const interval = 50; // Update every 50ms
            const increment = (interval / notification.duration) * 100;

            const progressInterval = setInterval(() => {
                progress += increment;
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(progressInterval);
                }
                progressElement.style.width = `${progress}%`;
            }, interval);

            // Store interval for cleanup
            notificationData.progressInterval = progressInterval;
        }
    }

    /**
     * Trigger sound/vibration feedback for notification
     */
    triggerFeedback(notification) {
        try {
            // Trigger sound if enabled and supported
            if (notification.sound && 'Audio' in window) {
                // You can customize the sound file path here
                const audio = new Audio('/assets/sounds/notification.mp3');
                audio.volume = 0.3;
                audio.play().catch(e => {
                    // Silently fail if audio can't be played
                    this.log('Audio playback failed:', e.message);
                });
            }

            // Trigger vibration if enabled and supported
            if (notification.vibrate && 'vibrate' in navigator) {
                // Different vibration patterns based on notification type
                const vibrationPatterns = {
                    success: [100],
                    error: [100, 50, 100],
                    warning: [200],
                    info: [50]
                };

                const pattern = vibrationPatterns[notification.type] || [100];
                navigator.vibrate(pattern);
            }
        } catch (error) {
            this.log('Feedback trigger failed:', error.message);
        }
    }

    /**
     * Announce notification to screen readers
     */
    announceToScreenReader(notification) {
        try {
            // Create a temporary element for screen reader announcement
            const announcement = document.createElement('div');
            announcement.setAttribute('aria-live', 'assertive');
            announcement.setAttribute('aria-atomic', 'true');
            announcement.className = 'sr-only';
            announcement.textContent = `${notification.type}: ${notification.title}. ${notification.message}`;

            // Add to DOM temporarily
            document.body.appendChild(announcement);

            // Remove after announcement
            setTimeout(() => {
                if (announcement.parentNode) {
                    announcement.parentNode.removeChild(announcement);
                }
            }, 1000);
        } catch (error) {
            this.log('Screen reader announcement failed:', error.message);
        }
    }
}

// Add CSS for notification animations
const style = document.createElement('style');
style.textContent = `
    .notification-enter {
        animation: slideInRight 0.3s ease-out;
    }
    
    .notification-exit {
        animation: slideOutRight 0.3s ease-in;
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .notification-actions {
        margin-top: var(--space-3);
        display: flex;
        gap: var(--space-2);
    }

    .notification-progress-container {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 3px;
        background-color: rgba(255, 255, 255, 0.2);
        overflow: hidden;
    }

    .notification-progress {
        height: 100%;
        background-color: currentColor;
        width: 0%;
        transition: width 0.1s ease-out;
    }

    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }
`;
document.head.appendChild(style);

    // Export NotificationManager class to global scope
    global.NotificationManager = NotificationManager;

    // Note: Instance creation is now handled by SystemManager
    console.log('✅ NotificationManager class loaded');

})(window);
