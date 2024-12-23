function renderWallet() {
  const root = document.getElementById("root");

  root.innerHTML = `
    <header class="header">
      <h1>Wallet</h1>
      <div class="profile-section">
        <div class="avatar large">
          <span>I</span>
        </div>
        <h2>Ingamells</h2>
        <p class="username">@ingamells</p>
        <button class="copy-button">Copy</button>
      </div>
    </header>

    <div class="wallet-tabs">
      <button class="tab-button active">Tokens</button>
      <button class="tab-button">Activity</button>
      <button class="tab-button">Governance</button>
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

    <div class="wallet-actions">
      <button class="action-button primary" onclick="showSendView()">Send</button>
      <button class="action-button secondary">Stake</button>
      <button class="action-button outline full">Receive</button>
      <button class="action-button primary full">Buy</button>
    </div>
  `;
}

const showSendView = function() {
  state.navigate('send');
}
