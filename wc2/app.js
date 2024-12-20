import { chatsPage } from './components/chats.js';
import { contactsPage } from './components/contacts.js';
import { walletPage } from './components/wallet.js';
import { accountPage } from './components/account.js';

const pages = {
  chats: chatsPage,
  contacts: contactsPage,
  wallet: walletPage,
  account: accountPage
};

function navigate(page) {
  const content = document.getElementById('content');
  content.innerHTML = pages[page]();
  
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  navigate('wallet');
  
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(item.dataset.page);
    });
  });
  
  document.addEventListener('click', (e) => {
    const chatItem = e.target.closest('.chat-item');
    if (chatItem) {
      const chatId = chatItem.dataset.id;
      console.log('Chat clicked:', chatId);
    }
  });
});

