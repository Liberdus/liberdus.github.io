import { CONFIG } from './config.js';
import { Header } from './components/header.js';
import { TabBar } from './components/tab-bar.js';
import { ProposalsTab } from './components/proposals-tab.js';
import { ProposeTab } from './components/propose-tab.js';
import { BridgeTab } from './components/bridge-tab.js';
import { ProposalDetailModal } from './components/proposal-detail-modal.js';
import { ToastManager } from './components/toast-manager.js';
import { WalletManager } from './wallet/wallet-manager.js';
import { NetworkManager } from './wallet/network-manager.js';
import { WalletPopup } from './wallet/wallet-popup.js';
import { ContractManager } from './contracts/contract-manager.js';

// Instantiate globally (web-client-v2 pattern)
const header = new Header();
const tabBar = new TabBar();
const proposalsTab = new ProposalsTab();
const proposeTab = new ProposeTab();
const bridgeTab = new BridgeTab();
const proposalDetailModal = new ProposalDetailModal();
const toastManager = new ToastManager();
const walletManager = new WalletManager();
const networkManager = new NetworkManager({ walletManager });
const walletPopup = new WalletPopup({ walletManager, networkManager });
const contractManager = new ContractManager({ walletManager, networkManager });

document.addEventListener('DOMContentLoaded', async () => {
  // Basic config exposure (helpful during dev)
  window.CONFIG = CONFIG;

  // Wallet system globals (lp-staking pattern; used by Header/Popup)
  window.walletManager = walletManager;
  window.networkManager = networkManager;
  window.walletPopup = walletPopup;
  window.contractManager = contractManager;
  window.proposalDetailModal = proposalDetailModal;
  window.toastManager = toastManager;

  toastManager.load();
  walletManager.load();
  await walletManager.init();
  networkManager.load();
  walletPopup.load();
  await contractManager.load();

  header.load();
  tabBar.load();
  proposalDetailModal.load();

  // Tab panel components (Phase 1: placeholders)
  proposalsTab.load();
  proposeTab.load();
  bridgeTab.load();
});

