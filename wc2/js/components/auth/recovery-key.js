function renderRecoveryKey() {
    const root = document.getElementById('root');
    const privateKey = generatePrivateKey();

    root.innerHTML = `
      <div class="recovery-key-page">
      <header class="send-header">
        <button class="back-button" onclick="state.navigate('sign-in')">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1>Account Created</h1>
      </header>
        
        <img src="./public/icon-512x512.png" class="auth-logo" alt="Liberdus logo">
        
        <p class="auth-description">
          Use your recovery privateKey to access your account on new devices. 
          Keep it safe and secure, as your account cannot be recovered without it. 
          Do not share it with anyone.
        </p>
        
        <div class="recovery-key">${privateKey}</div>
        
        <div class="auth-actions">
          <button class="auth-button primary" onclick="handleContinue()">Continue</button>
          <button class="auth-button secondary" onclick="copyToClipboard('${privateKey}')">Copy</button>
        </div>
  
        <p class="auth-terms">
          By using this service, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    `;
}

function generatePrivateKey() {
    return '0xd866be488f00188c02c85b63a809f54527a24b52327933beedecca85a76d2a5b';
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
}

function handleContinue() {
    state.authenticate();
}