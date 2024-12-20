export function walletPage() {
  return `
    <!-- Wallet View -->
    <div class="view" id="wallet-view">
      <header class="header">
        <h1>Wallet</h1>
        <div class="profile">
          <div class="avatar">
            <img src="https://source.unsplash.com/random/200x200?suit" alt="Profile">
          </div>
          <h2>Ingamells</h2>
          <p class="username">@ingamells</p>
          <button class="copy-button">Copy</button>
        </div>
      </header>

      <div class="content">
        <div class="tabs">
          <button class="tab active">Tokens</button>
          <button class="tab">Activity</button>
          <button class="tab">Governance</button>
        </div>

        <div class="balance">
          <h2>Balance</h2>
          <div class="balance-info">
            <div class="balance-header">
              <div class="token-info">
                <span class="token-symbol">LIB</span>
                <span class="percentage-change positive">1.59%</span>
              </div>
              <span class="usd-value">15.88 USD</span>
            </div>
            <div class="token-amount">87.041 LIB</div>
          </div>
        </div>

        <div class="actions">
          <div class="action-grid">
            <button class="action-button primary" onclick="showSendView()">Send</button>
            <button class="action-button secondary">Stake</button>
            <button class="action-button outline full-width">Receive</button>
            <button class="action-button primary full-width">Buy</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Send View -->
    <div class="view hidden" id="send-view">
      <header class="send-header">
        <button class="back-button" onclick="showWalletView()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <h1>Send Liberdus</h1>
      </header>

      <div class="send-form">
        <div class="input-group">
          <div class="input-wrapper">
            <input type="text" class="input" placeholder="Omar_Syed">
            <button class="input-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </button>
          </div>
        </div>

        <div class="input-group">
          <div class="input-wrapper">
            <input type="text" class="input" placeholder="Amount" value="10">
            <div class="info-icon">
              <span>ℹ</span>
            </div>
          </div>
        </div>

        <div class="transaction-info">
          <p>Transaction Fee - 0.002 LIB</p>
          <p>10 LIB = 13.5 USD</p>
        </div>

        <div class="send-actions">
          <button class="action-button primary" onclick="handleSend()">Send</button>
          <button class="action-button secondary" onclick="showWalletView()">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Transaction Dialog -->
    <div class="dialog hidden" id="transaction-dialog">
      <div class="dialog-overlay"></div>
      <div class="dialog-content">
        <div class="dialog-header">
          <div class="dialog-status">
            <div class="spinner"></div>
            <span class="dialog-message">Sending...</span>
          </div>
          <button class="dialog-close hidden" onclick="closeDialog()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

// View Management
window.showWalletView = function() {
  document.getElementById('wallet-view').classList.remove('hidden');
  document.getElementById('send-view').classList.add('hidden');
}

window.showSendView = function() {
  document.getElementById('wallet-view').classList.add('hidden');
  document.getElementById('send-view').classList.remove('hidden');
}

// Transaction Dialog
window.showDialog = function() {
  const dialog = document.getElementById('transaction-dialog');
  const closeButton = dialog.querySelector('.dialog-close');
  dialog.classList.remove('hidden');
  closeButton.classList.add('hidden');
}

window.updateDialog = function(message, showClose = false) {
  const dialogMessage = document.querySelector('.dialog-message');
  const spinner = document.querySelector('.spinner');
  const closeButton = document.querySelector('.dialog-close');
  
  dialogMessage.textContent = message;
  
  if (showClose) {
    spinner.style.display = 'none';
    closeButton.classList.remove('hidden');
  }
}

window.closeDialog = function() {
  const dialog = document.getElementById('transaction-dialog');
  dialog.classList.add('hidden');
  showWalletView();
}

// Send Transaction
window.handleSend = async function() {
  showDialog();
  
  // Simulate transaction
  await new Promise(resolve => setTimeout(resolve, 2000));
  updateDialog('Transaction successful!', true);
}

// Tab Management
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });
});

