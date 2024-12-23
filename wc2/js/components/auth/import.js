function renderImportAccount() {
  const root = document.getElementById("root");

  root.innerHTML = `
      <div class="import-account-page">
      <header class="send-header">
        <button class="back-button" onclick="state.navigate('auth')">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1>Enter Seed Phrase</h1>
      </header>
        
        <img src="/public/icon-512x512.png" class="auth-logo" alt="Liberdus logo">
        
        <p class="auth-description">
          Enter your 12-word seed phrase to recover your account.
        </p>
        
        <div class="seed-input-container">
          <textarea 
            class="seed-input" 
            placeholder="Enter your seed phrase"
            rows="4"
          ></textarea>
          <button class="qr-scanner-button" onclick="handleScanQR()">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="8" y1="8" x2="16" y2="16" />
              <line x1="8" y1="16" x2="16" y2="8" />
            </svg>
          </button>
        </div>
  
        <button class="auth-button primary" onclick="continueApp()">
          Continue
        </button>
  
        <p class="auth-terms">
          By using this service, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    `;
}

function handleScanQR() {
  // QR scanning functionality would be implemented here
  console.log("QR scanner clicked");
}

function continueApp() {
  // Import account functionality
  state.authenticate();
}
