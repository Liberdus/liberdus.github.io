function renderCreateAccount() {
  const root = document.getElementById('root');

  root.innerHTML = `
      <div class="create-account-page">
      <header class="send-header">
        <button class="back-button" onclick="state.navigate('auth')">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1>Choose a username</h1>
      </header>
        
        <img src="/public/icon-512x512.png" class="auth-logo" alt="Liberdus logo">
        
        <p class="auth-description">Pick a unique username or display name.</p>
        
        <div class="auth-form">
          <label class="input-label">Username or display name</label>
          <input type="text" class="auth-input" id="username" placeholder="Enter your username">
          <span class="input-status" id="username-status"></span>
          
          <button class="auth-button primary" onclick="handleCreateUsername()">
            <span id="button-text">Create Account</span>
            <span id="button-loader" class="hidden">Creating Account...</span>
          </button>
        </div>
  
        <p class="auth-terms">
          By using this service, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    `;
}

async function handleCreateUsername() {
  const username = document.getElementById('username').value;
  const buttonText = document.getElementById('button-text');
  const buttonLoader = document.getElementById('button-loader');
  const status = document.getElementById('username-status');

  if (!username) {
    status.textContent = 'Username is required';
    status.className = 'input-status error';
    return;
  }

  buttonText.classList.add('hidden');
  buttonLoader.classList.remove('hidden');

  // Simulate username check
  await new Promise(resolve => setTimeout(resolve, 1000));

  status.textContent = 'Username is available!';
  status.className = 'input-status success';

  // Simulate account creation
  await new Promise(resolve => setTimeout(resolve, 1000));

  state.navigate('recovery-key');
}