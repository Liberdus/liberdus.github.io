/**
 * NotificationManager - Simple notification system
 * Shows toast notifications for user feedback
 */

class NotificationManagerNew {
    constructor() {
        this.notifications = [];
        this.container = null;
        this.init();
    }

    init() {
        this.createContainer();
    }

    createContainer() {
        this.container = document.getElementById('notification-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
        }
    }

    show(message, type = 'info', options = {}) {
        const {
            duration = 5000,
            title = null,
            persistent = false,
            showProgress = true,
            onClick = null
        } = typeof options === 'number' ? { duration: options } : options;

        const notification = this.createNotification(message, type, { title, persistent, showProgress, onClick });
        this.container.appendChild(notification);

        // Trigger animation
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });

        // Add progress bar animation if enabled
        if (showProgress && duration > 0 && !persistent) {
            const progressBar = notification.querySelector('.notification-progress');
            if (progressBar) {
                progressBar.style.animationDuration = `${duration}ms`;
                progressBar.classList.add('animating');
            }
        }

        // Auto remove (unless persistent)
        if (duration > 0 && !persistent) {
            setTimeout(() => this.remove(notification), duration);
        }

        // Add to notifications array
        this.notifications.push({
            element: notification,
            type,
            message,
            timestamp: Date.now()
        });

        return notification;
    }

    createNotification(message, type, options = {}) {
        const { title, persistent, showProgress, onClick } = options;
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        if (onClick) {
            notification.style.cursor = 'pointer';
            notification.addEventListener('click', onClick);
        }

        const icons = {
            success: 'check_circle',
            error: 'error',
            warning: 'warning',
            info: 'info'
        };

        const titleHtml = title ? `<div class="notification-title">${title}</div>` : '';
        const progressHtml = showProgress && !persistent ? '<div class="notification-progress"></div>' : '';

        notification.innerHTML = `
            <div class="notification-icon">
                <span class="material-icons">${icons[type] || 'info'}</span>
            </div>
            <div class="notification-content">
                ${titleHtml}
                <div class="notification-message">${message}</div>
            </div>
            ${!persistent ? `
                <button class="notification-close" aria-label="Close notification">
                    <span class="material-icons">close</span>
                </button>
            ` : ''}
            ${progressHtml}
        `;

        // Add close functionality
        if (!persistent) {
            const closeBtn = notification.querySelector('.notification-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.remove(notification);
                });
            }
        }

        return notification;
    }

    remove(notification) {
        if (!notification || !notification.parentNode) return;

        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    clear() {
        const notifications = this.container.querySelectorAll('.notification');
        notifications.forEach(notification => this.remove(notification));
    }

    success(message, options) {
        return this.show(message, 'success', options);
    }

    error(message, options) {
        return this.show(message, 'error', options);
    }

    warning(message, options) {
        return this.show(message, 'warning', options);
    }

    info(message, options) {
        return this.show(message, 'info', options);
    }
}

// Initialize notification manager
let notificationManagerNew;
document.addEventListener('DOMContentLoaded', () => {
    notificationManagerNew = new NotificationManagerNew();
    window.notificationManager = notificationManagerNew;
});

// Export for global access
window.NotificationManagerNew = NotificationManagerNew;
