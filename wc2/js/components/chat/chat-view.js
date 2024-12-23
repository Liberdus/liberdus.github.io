function renderChatView(chatId) {
  const chat = state.getState().chats.find((c) => c.id === chatId);
  const root = document.getElementById("root");

  root.innerHTML = `
      <div class="chat-view-header">
        <button class="back-button" onclick="showChats()">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div class="chat-title">
          <div class="avatar">
            <span>${chat.name[0]}</span>
          </div>
          <h1>${chat.name}</h1>
        </div>
        <button class="back-button">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="8.5" cy="7.5" r="4" />
            <path d="M20 21v-2a4 4 0 00-3-3.87" />
            <path d="M14 3.13a4 4 0 010 7.75" />
          </svg>
        </button>
      </div>
  
      <div class="chat-messages">
        <div class="date-separator">Today</div>
        
        <div class="message-group received">
          <div class="avatar">
            <span>${chat.name[0]}</span>
          </div>
          <div class="message-content">
            <div class="message">I will send you the NFT today. What is your address?</div>
            <div class="message-info">
              <span>${chat.name}</span>
              <span>12:00pm</span>
            </div>
          </div>
        </div>
  
        <div class="message-group received">
          <div class="avatar">
            <span>${chat.name[0]}</span>
          </div>
          <div class="message-content">
            <div class="message">I will send you the NFT today</div>
            <div class="message-info">
              <span>${chat.name}</span>
              <span>12:00pm</span>
            </div>
          </div>
        </div>
  
        <div class="message-group sent">
          <div class="message-content">
            <div class="message">I will send you the NFT today</div>
            <div class="message-info">
              <span>Daniel</span>
              <span>12:00pm</span>
            </div>
          </div>
        </div>
  
        <div class="message-group received">
          <div class="avatar">
            <span>${chat.name[0]}</span>
          </div>
          <div class="message-content">
            <div class="message">I will send you the NFT today</div>
            <div class="message-info">
              <span>${chat.name}</span>
              <span>12:00pm</span>
            </div>
          </div>
        </div>
  
        <div class="message-group sent">
          <div class="message-content">
            <div class="message">I will send you the NFT today</div>
            <div class="message-info">
              <span>Daniel</span>
              <span>12:00pm</span>
            </div>
          </div>
        </div>
  
        <div class="message-group sent">
          <div class="message-content">
            <div class="message">I will send you the NFT today</div>
            <div class="message-info">
              <span>Daniel</span>
              <span>12:00pm</span>
            </div>
          </div>
        </div>
  
        <div class="message-group received">
          <div class="avatar">
            <span>${chat.name[0]}</span>
          </div>
          <div class="message-content">
            <div class="message">I will send you the NFT today</div>
            <div class="message-info">
              <span>${chat.name}</span>
              <span>12:00pm</span>
            </div>
          </div>
        </div>
  
        <div class="message-group received">
          <div class="avatar">
            <span>${chat.name[0]}</span>
          </div>
          <div class="message-content">
            <div class="message">I will send you the NFT today</div>
            <div class="message-info">
              <span>${chat.name}</span>
              <span>12:00pm</span>
            </div>
          </div>
        </div>
  
        <div class="message-group sent">
          <div class="message-content">
            <div class="message">I will send you the NFT today</div>
            <div class="message-info">
              <span>Daniel</span>
              <span>12:00pm</span>
            </div>
          </div>
        </div>
      </div>
  
      <div class="chat-input">
        <div class="message-box">
          <input type="text" class="message-input" placeholder="Message Omar">
        </div>
        <button class="send-button">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 2L11 13" />
            <path d="M22 2L15 22L11 13L2 9L22 2Z" />
          </svg>
        </button>
      </div>
    `;

  // Scroll to bottom of messages
  const messages = document.querySelector(".chat-messages");
  messages.scrollTop = messages.scrollHeight;
}

const showChats = function() {
  state.navigate("chats");
}
