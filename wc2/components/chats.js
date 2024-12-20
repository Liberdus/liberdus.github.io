const chats = [
    {
      id: 1,
      name: 'Omar Syed',
      message: 'I will send you the NFT today',
      time: 'Just now',
      unread: 1,
      status: 'online'
    },
    {
      id: 2,
      name: 'Thant',
      message: "Sure, what's the latest?",
      time: '2:00 PM',
      status: 'offline'
    },
  ];
  
  export function chatsPage() {
    return `
      <div class="header">
        <div class="header-title">
          <h1 class="text-xl font-semibold">Chats</h1>
          <button class="search-button">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </button>
        </div>
        <div class="search-bar">
          <svg class="icon search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input type="text" placeholder="Search messages...">
        </div>
      </div>
      <div class="chat-list">
        ${chats.map(chat => `
          <div class="chat-item" data-id="${chat.id}">
            <div class="avatar">
              ${chat.name[0]}
              <span class="status-dot ${chat.status}"></span>
            </div>
            <div class="chat-content">
              <div class="chat-header">
                <span class="chat-name">${chat.name}</span>
                <span class="chat-time">${chat.time}</span>
              </div>
              <p class="chat-message">${chat.message}</p>
            </div>
            ${chat.unread ? `
              <div class="unread-badge">${chat.unread}</div>
            ` : ''}
          </div>
        `).join('')}
      </div>
      <button class="floating-button">
        <span>+</span>
        <span>New Chat</span>
      </button>
    `;
  }
  
  