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
      const isSticky = typeof timeoutMs === 'number' && timeoutMs <= 0;
      el.className = `toast toast--${type}${isSticky ? ' toast--sticky' : ''}`;
      el.setAttribute('data-toast-id', toastId);
      el.setAttribute('role', type === 'error' ? 'alert' : 'status');

      el.innerHTML = `
        <div class="toast__icon" aria-hidden="true"></div>
        <div class="toast__content">
          ${title ? `<div class="toast__title"></div>` : ''}
          <div class="toast__message"></div>
        </div>
        ${dismissible ? `<button type="button" class="toast__close" aria-label="Dismiss">×</button>` : ''}
      `;

      if (title) el.querySelector('.toast__title').textContent = String(title);
      el.querySelector('.toast__message').textContent = String(message || '');

      const closeBtn = el.querySelector('.toast__close');
      closeBtn?.addEventListener('click', () => this.dismiss(toastId));

      this.container.appendChild(el);
      // Trigger entry animation (match web-client-v2 style).
      requestAnimationFrame(() => el.classList.add('toast--show'));

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
      el.className = `toast toast--${type}`;
      el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    }
    if (typeof title === 'string') {
      const titleEl = el.querySelector('.toast__title');
      if (titleEl) titleEl.textContent = title;
    }
    if (typeof message === 'string') {
      el.querySelector('.toast__message').textContent = message;
    }

    if (rec.timeoutId) window.clearTimeout(rec.timeoutId);
    rec.timeoutId = null;
    if (typeof timeoutMs === 'number' && timeoutMs > 0) {
      rec.timeoutId = window.setTimeout(() => this.dismiss(id), timeoutMs);
    }

    if (typeof dismissible === 'boolean') {
      const closeBtn = el.querySelector('.toast__close');
      if (!dismissible && closeBtn) closeBtn.remove();
      if (dismissible && !closeBtn) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'toast__close';
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

    rec.el?.remove();
    this._toasts.delete(id);
    return true;
  }
}

