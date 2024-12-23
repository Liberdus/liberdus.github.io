function renderSendPage() {
  const root = document.getElementById("root");

  root.innerHTML = `
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
    `;
}

// View Management
const showWalletView = function() {
    state.navigate('wallet');
  }
  
  // Transaction Dialog
  const showDialog = function() {
    const dialog = document.getElementById('transaction-dialog');
    const closeButton = dialog.querySelector('.dialog-close');
    dialog.classList.remove('hidden');
    closeButton.classList.add('hidden');
  }
  
  const updateDialog = function(message, showClose = false) {
    const dialogMessage = document.querySelector('.dialog-message');
    const spinner = document.querySelector('.spinner');
    const closeButton = document.querySelector('.dialog-close');
    
    dialogMessage.textContent = message;
    
    if (showClose) {
      spinner.style.display = 'none';
      closeButton.classList.remove('hidden');
    }
  }
  
  const closeDialog = function() {
    const dialog = document.getElementById('transaction-dialog');
    dialog.classList.add('hidden');
  }
  
  // Send Transaction
  const handleSend = async function() {
    showDialog();
    
    // Simulate transaction
    await new Promise(resolve => setTimeout(resolve, 2000));
    updateDialog('Transaction successful!', true);
  }
