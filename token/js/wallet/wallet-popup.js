/**
 * WalletPopup (Phase 2)
 * Simple MetaMask popup:
 * - address (copy)
 * - balance (native, best-effort)
 * - disconnect
 */

export class WalletPopup {
  constructor({ walletManager, networkManager } = {}) {
    this.walletManager = walletManager || null;
    this.networkManager = networkManager || null;

    this.isOpen = false;
    this.popupEl = null;
    this._containerEl = null;
  }

  load() {
    this._ensureContainer();
    this._attachGlobalClickListener();

    document.addEventListener('walletDisconnected', () => this.hide());
    document.addEventListener('walletAccountChanged', () => this.refresh());
    document.addEventListener('walletChainChanged', () => this.refresh());
  }

  toggle(anchorEl) {
    if (this.isOpen) this.hide();
    else this.show(anchorEl);
  }

  async show(anchorEl) {
    const address = this.walletManager?.getAddress?.();
    if (!address) return;

    this._ensureContainer();
    this._containerEl.innerHTML = this._renderHTML({ address, balanceText: 'Loading…' });
    this.popupEl = this._containerEl.querySelector('.wallet-popup');
    this.isOpen = true;

    this._position(anchorEl);
    this._wireEvents();

    // Load balance (best-effort)
    try {
      const provider = this.walletManager?.getProvider?.();
      if (provider && provider.getBalance && window.ethers) {
        const bal = await provider.getBalance(address);
        const formatted = window.ethers.utils.formatEther(bal);
        const display = this._formatBalance(formatted);
        this._setBalance(`${display} ${this._nativeSymbol()}`);
      } else {
        this._setBalance(`-- ${this._nativeSymbol()}`);
      }
    } catch {
      this._setBalance(`-- ${this._nativeSymbol()}`);
    }
  }

  hide() {
    if (!this._containerEl) return;
    this._containerEl.innerHTML = '';
    this.popupEl = null;
    this.isOpen = false;
  }

  refresh() {
    if (!this.isOpen) return;
    // Re-render quickly without anchor re-position unless we have an anchor ref later.
    this.hide();
  }

  _ensureContainer() {
    this._containerEl = document.getElementById('wallet-popup-container');
    if (!this._containerEl) {
      this._containerEl = document.createElement('div');
      this._containerEl.id = 'wallet-popup-container';
      document.body.appendChild(this._containerEl);
    }
  }

  _attachGlobalClickListener() {
    document.addEventListener('click', (e) => {
      if (!this.isOpen) return;
      const target = e.target;
      if (!(target instanceof Element)) {
        this.hide();
        return;
      }
      if (!target.closest('.wallet-popup') && !target.closest('#connect-wallet-btn')) {
        this.hide();
      }
    });
  }

  _position(anchorEl) {
    if (!this.popupEl || !anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const popupRect = this.popupEl.getBoundingClientRect();

    let top = rect.bottom + 8;
    let left = rect.right - popupRect.width;

    if (left < 8) left = 8;
    if (top + popupRect.height > window.innerHeight - 8) {
      top = rect.top - popupRect.height - 8;
    }

    this.popupEl.style.top = `${top}px`;
    this.popupEl.style.left = `${left}px`;
  }

  _wireEvents() {
    if (!this.popupEl) return;

    const closeBtn = this.popupEl.querySelector('[data-wallet-close]');
    const copyBtn = this.popupEl.querySelector('[data-wallet-copy]');
    const disconnectBtn = this.popupEl.querySelector('[data-wallet-disconnect]');

    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });

    copyBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const addr = copyBtn.getAttribute('data-address');
      if (!addr) return;
      await this._copy(addr);
    });

    disconnectBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.walletManager?.disconnect?.();
      this.hide();
    });

    // prevent closing when clicking inside
    this.popupEl.addEventListener('click', (e) => e.stopPropagation());
  }

  _renderHTML({ address, balanceText }) {
    const short = this._shortAddress(address);
    return `
      <div class="wallet-popup" role="dialog" aria-label="Wallet">
        <div class="wallet-popup-content">
          <button class="wallet-popup-close" type="button" title="Close" data-wallet-close>×</button>

          <div class="wallet-balance">
            <div class="balance-label">${this._nativeSymbol()} Balance</div>
            <div class="balance-value" data-wallet-balance>${balanceText}</div>
          </div>

          <div class="wallet-address">
            <span class="address-text">${short}</span>
            <button class="copy-icon-button" type="button" title="Copy address" data-wallet-copy data-address="${address}">
              Copy
            </button>
          </div>

          <div class="wallet-actions">
            <button class="disconnect-button" type="button" data-wallet-disconnect>Disconnect</button>
          </div>
        </div>
      </div>
    `;
  }

  _setBalance(text) {
    const el = this._containerEl?.querySelector('[data-wallet-balance]');
    if (el) el.textContent = text;
  }

  async _copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  _shortAddress(addr) {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  _formatBalance(str) {
    const n = Number(str);
    if (!Number.isFinite(n)) return str;
    if (n === 0) return '0';
    if (n < 0.0001) return '<0.0001';
    return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }

  _nativeSymbol() {
    return this.networkManager?.networkSymbol?.() || (this.networkManager ? 'MATIC' : 'MATIC');
  }
}

