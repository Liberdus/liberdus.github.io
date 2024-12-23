function renderContacts() {
  const root = document.getElementById('root');
  const contacts = state.getState().contacts;
  
  root.innerHTML = `
    <header class="header">
      <div class="flex-between">
        <h1>Contacts</h1>
        <button class="search-button">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>
      </div>
      <div class="search-container">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input type="text" class="search-input" placeholder="Search contacts...">
      </div>
    </header>
    
    <div class="contact-list">
      ${contacts.map(contact => `
        <div class="contact-item">
          <div class="avatar">
            <span>${contact.name[0]}</span>
            <span class="status-indicator ${contact.lastSeen === 'online' ? 'status-online' : 'status-offline'}"></span>
          </div>
          <div class="contact-content">
            <div class="contact-name">${contact.name}</div>
            <div class="contact-status">${contact.status}</div>
          </div>
          <button class="contact-actions">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
        </div>
      `).join('')}
    </div>
    
    <button class="floating-button">
      <span>+</span>
      <span>Add Friend</span>
    </button>
  `;
}