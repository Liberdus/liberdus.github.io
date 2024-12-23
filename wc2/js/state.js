class State {
  constructor() {
    this.state = {
      isAuthenticated: localStorage.getItem('authenticated') === 'true',
      currentPage: 'chats',
      currentChatId: null,
      chats: [
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
        {
          id: 3,
          name: 'Jai',
          message: 'Hi, can we discuss the tokenomics?',
          time: '1:00 PM',
          unread: 3,
          status: 'offline'
        }
      ],
      contacts: [
        {
          id: 1,
          name: 'Kaung',
          status: 'Online',
          lastSeen: 'online'
        },
        {
          id: 2,
          name: 'Thant',
          status: 'Last seen 2h ago',
          lastSeen: 'offline'
        }
      ]
    };
  }

  getState() {
    return this.state;
  }

  navigate(page) {
    if (page.startsWith('/chats/')) {
      this.state.currentChatId = parseInt(page.split('/')[2]);
      this.state.currentPage = 'chat-view';
    } else {
      this.state.currentPage = page;
      this.state.currentChatId = null;
    }
    this.render();
  }

  authenticate() {
    this.state.isAuthenticated = true;
    localStorage.setItem('authenticated', 'true');
    this.navigate('chats');
  }

  logout() {
    this.state.isAuthenticated = false;
    localStorage.removeItem('authenticated');
    this.navigate('auth');
  }

  render() {
    const root = document.getElementById('root');


    if (!this.state.isAuthenticated) {
      switch (this.state.currentPage) {
        case 'sign-in':
          renderCreateAccount();
          break;
        case 'recovery-key':
          renderRecoveryKey();
          break;
        case 'import':
          renderImportAccount();
          break;
        default:
          renderGetStarted();
          break;
      }
      this.hideBottomNav();
      return;
    }

    switch (this.state.currentPage) {
      case 'chats':
        renderChats();
        this.showBottomNav();
        break;
      case 'chat-view':
        renderChatView(this.state.currentChatId);
        this.hideBottomNav();
        break;
      case 'contacts':
        renderContacts();
        this.showBottomNav();
        break;
      case 'wallet':
        renderWallet();
        this.showBottomNav();
        break;
      case 'send':
        renderSendPage();
        this.hideBottomNav();
        break;
      case 'account':
        renderAccount();
        this.showBottomNav();
        break;
      default:
        renderChats();
    }

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
      const page = item.getAttribute('data-page');
      item.classList.toggle('active', page === this.state.currentPage);
    });
  }

  hideBottomNav() {
    const bottomNav = document.querySelector('.bottom-nav');
    bottomNav.classList.add('hidden');
  }

  showBottomNav() {
    const bottomNav = document.querySelector('.bottom-nav');
    bottomNav.classList.remove('hidden');
  }
}