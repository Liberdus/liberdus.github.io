function renderAccount() {
  const root = document.getElementById('root');
  
  root.innerHTML = `
    <header class="header">
      <h1>Settings</h1>
    </header>

    <div class="account-tabs">
      <button class="tab-button active">Account</button>
      <button class="tab-button">Validator</button>
    </div>

    <div class="profile-form">
      <div class="form-group">
        <label>Profile photo</label>
        <button class="setup-button">Set up</button>
      </div>

      <div class="form-group">
        <label>Name</label>
        <span>Daniel Ingamells</span>
      </div>

      <div class="form-group">
        <label>Username</label>
        <span>Ingamells</span>
      </div>

      <div class="form-group">
        <label>Mobile Number</label>
        <span>+44 7599441978</span>
      </div>

      <div class="form-group">
        <label>Email</label>
        <span>dan@liberdus.com</span>
      </div>

      <div class="form-group">
        <span>Notifications</span>
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>

      <div class="form-group">
        <label>Toll</label>
      </div>
      <input type="text" placeholder="Enter USD value" class="input">

      <button class="sign-out-button">Sign Out</button>
    </div>
  `;

  // Add event listener for sign out
  document.querySelector('.sign-out-button').addEventListener('click', () => {
    state.logout();
  });
}