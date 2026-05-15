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
        const normalizedOptions = typeof options === 'number' ? { duration: options } : (options || {});
        const {
            duration = 5000,
            title = null,
            persistent = false,
            showProgress = true,
            onClick = null,
            supportAction = type === 'error'
        } = normalizedOptions;

        const duplicateKey = this.getDuplicateKey(message, type, title);
        this.pruneNotifications();

        const existingNotification = this.notifications.find(notification => notification.duplicateKey === duplicateKey);
        if (existingNotification) {
            return existingNotification.element;
        }

        const notification = this.createNotification(message, type, { title, persistent, showProgress, onClick, supportAction });
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
            duplicateKey,
            timestamp: Date.now()
        });

        return notification;
    }

    getDuplicateKey(message, type, title) {
        return JSON.stringify({
            type: String(type || 'info'),
            title: title == null ? '' : String(title),
            message: message == null ? '' : String(message)
        });
    }

    pruneNotifications() {
        this.notifications = this.notifications.filter(notification => notification.element?.parentNode);
    }

    createNotification(message, type, options = {}) {
        const { title, persistent, showProgress, onClick, supportAction } = options;
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

        const iconContainer = document.createElement('div');
        iconContainer.className = 'notification-icon';

        const icon = document.createElement('span');
        icon.className = 'material-icons';
        icon.textContent = icons[type] || 'info';
        iconContainer.appendChild(icon);

        const content = document.createElement('div');
        content.className = 'notification-content';

        if (title) {
            const titleElement = document.createElement('div');
            titleElement.className = 'notification-title';
            titleElement.textContent = String(title);
            content.appendChild(titleElement);
        }

        const messageElement = document.createElement('div');
        messageElement.className = 'notification-message';
        messageElement.textContent = String(message ?? '');
        content.appendChild(messageElement);

        const discordHelpUrl = window.CONFIG?.SUPPORT?.DISCORD_HELP_URL;
        if (type === 'error' && supportAction !== false && discordHelpUrl) {
            const actions = document.createElement('div');
            actions.className = 'notification-actions';
            actions.appendChild(this.createSupportLink(discordHelpUrl));
            content.appendChild(actions);
        }

        notification.appendChild(iconContainer);
        notification.appendChild(content);

        const closeButton = document.createElement('button');
        closeButton.className = 'notification-close';
        closeButton.type = 'button';
        closeButton.setAttribute('aria-label', 'Close notification');

        const closeIcon = document.createElement('span');
        closeIcon.className = 'material-icons';
        closeIcon.textContent = 'close';
        closeButton.appendChild(closeIcon);
        closeButton.addEventListener('click', event => {
            event.stopPropagation();
            this.remove(notification);
        });

        notification.appendChild(closeButton);

        if (showProgress && !persistent) {
            const progress = document.createElement('div');
            progress.className = 'notification-progress';
            notification.appendChild(progress);
        }

        return notification;
    }

    createSupportLink(discordUrl) {
        const link = document.createElement('a');
        link.className = 'notification-action-link';
        link.href = discordUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Get support';
        link.setAttribute('aria-label', 'Get support on Discord');

        link.addEventListener('click', event => {
            event.stopPropagation();
        });

        return link;
    }

    remove(notification) {
        if (!notification || !notification.parentNode) return;

        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            this.pruneNotifications();
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
        const normalizedOptions = typeof options === 'number' ? { duration: options } : (options || {});
        return this.show(message, 'error', {
            persistent: true,
            ...normalizedOptions
        });
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
