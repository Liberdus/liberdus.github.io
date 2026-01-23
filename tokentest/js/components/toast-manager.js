export class ToastManager {
  constructor({ containerId = 'notification-container' } = {}) {
    this.containerId = containerId;
    this.container = null;
    this._toasts = new Map(); // id -> { el, timeoutId, showTimerId }
    this._nextId = 1;
  }

  load() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = this.containerId;
      // Append to #app container (for relative positioning)
      const appContainer = document.getElementById('app');
      (appContainer || document.body).appendChild(this.container);
    }

    this.container.classList.add('notification-container');
    this.container.setAttribute('aria-live', 'polite');
    this.container.setAttribute('aria-relevant', 'additions');
  }

  show({ title, message, type = 'info', timeoutMs, id, dismissible = true, delayMs = 0 } = {}) {
    const toastId = id || `t${this._nextId++}`;

    // If already exists, update instead.
    if (this._toasts.has(toastId)) {
      this.update(toastId, { title, message, type, timeoutMs, dismissible });
      return toastId;
    }

    const create = () => {
      const el = document.createElement('div');
      el.className = `notification ${type}`;
      el.setAttribute('data-toast-id', toastId);
      el.setAttribute('role', type === 'error' ? 'alert' : 'status');

      // Icon based on type
      const iconMap = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ',
        loading: '⟳',
      };
      const icon = iconMap[type] || 'ℹ';

      el.innerHTML = `
        <div class="notification-icon" aria-hidden="true">${icon}</div>
        <div class="notification-content">
          ${title ? `<div class="notification-title"></div>` : ''}
          <div class="notification-message"></div>
        </div>
        ${dismissible ? `<button type="button" class="notification-close" aria-label="Dismiss">×</button>` : ''}
      `;

      if (title) el.querySelector('.notification-title').textContent = String(title);
      el.querySelector('.notification-message').textContent = String(message || '');

      const closeBtn = el.querySelector('.notification-close');
      closeBtn?.addEventListener('click', () => this.dismiss(toastId));

      this.container.appendChild(el);
      // Trigger entry animation (match lib-lp-staking-frontend style).
      requestAnimationFrame(() => el.classList.add('show'));

      const rec = { el, timeoutId: null, showTimerId: null };
      this._toasts.set(toastId, rec);

      if (typeof timeoutMs === 'number' && timeoutMs > 0) {
        rec.timeoutId = window.setTimeout(() => this.dismiss(toastId), timeoutMs);
      }
    };

    if (delayMs && delayMs > 0) {
      const showTimerId = window.setTimeout(create, delayMs);
      this._toasts.set(toastId, { el: null, timeoutId: null, showTimerId });
    } else {
      create();
    }

    return toastId;
  }

  loading(message, { title = 'Loading', id, delayMs = 200 } = {}) {
    return this.show({ id, title, message, type: 'loading', timeoutMs: 0, dismissible: false, delayMs });
  }

  success(message, { title = 'Done', timeoutMs = 2500, id } = {}) {
    return this.show({ id, title, message, type: 'success', timeoutMs, dismissible: true });
  }

  error(message, { title = 'Error', timeoutMs = 0, id } = {}) {
    // Error toasts stay until user dismisses them (timeoutMs = 0 means no auto-dismiss)
    return this.show({ id, title, message, type: 'error', timeoutMs, dismissible: true });
  }

  update(id, { title, message, type, timeoutMs, dismissible } = {}) {
    const rec = this._toasts.get(id);
    if (!rec) return false;

    // If pending delayed show, cancel and show immediately with updated content.
    if (!rec.el && rec.showTimerId) {
      window.clearTimeout(rec.showTimerId);
      this._toasts.delete(id);
      this.show({ id, title, message, type, timeoutMs, dismissible, delayMs: 0 });
      return true;
    }

    const el = rec.el;
    if (!el) return false;

    if (type) {
      el.className = `notification ${type}`;
      el.setAttribute('role', type === 'error' ? 'alert' : 'status');
      // Update icon
      const iconMap = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ',
        loading: '⟳',
      };
      const iconEl = el.querySelector('.notification-icon');
      if (iconEl) iconEl.textContent = iconMap[type] || 'ℹ';
    }
    if (typeof title === 'string') {
      const titleEl = el.querySelector('.notification-title');
      if (titleEl) titleEl.textContent = title;
    }
    if (typeof message === 'string') {
      const msgEl = el.querySelector('.notification-message');
      if (msgEl) msgEl.textContent = message;
    }

    if (rec.timeoutId) window.clearTimeout(rec.timeoutId);
    rec.timeoutId = null;
    if (typeof timeoutMs === 'number' && timeoutMs > 0) {
      rec.timeoutId = window.setTimeout(() => this.dismiss(id), timeoutMs);
    }

    if (typeof dismissible === 'boolean') {
      const closeBtn = el.querySelector('.notification-close');
      if (!dismissible && closeBtn) closeBtn.remove();
      if (dismissible && !closeBtn) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'notification-close';
        btn.setAttribute('aria-label', 'Dismiss');
        btn.textContent = '×';
        btn.addEventListener('click', () => this.dismiss(id));
        el.appendChild(btn);
      }
    }

    return true;
  }

  dismiss(id) {
    const rec = this._toasts.get(id);
    if (!rec) return false;

    if (rec.showTimerId) window.clearTimeout(rec.showTimerId);
    if (rec.timeoutId) window.clearTimeout(rec.timeoutId);

    const el = rec.el;
    if (el) {
      el.classList.add('hide');
      // Remove after animation
      setTimeout(() => {
        el.remove();
      }, 400);
    }
    this._toasts.delete(id);
    return true;
  }
}

