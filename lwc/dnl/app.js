const version = '1.0.9';

// https://github.com/paulmillr/noble-secp256k1
// https://github.com/paulmillr/noble-secp256k1/raw/refs/heads/main/index.js
import * as secp from './noble-secp256k1.js'; 

// https://github.com/adraffy/keccak.js
// https://github.com/adraffy/keccak.js/blob/main/src/keccak256.js
//   permute.js and utils.js were copied into keccak256.js instead of being imported
import keccak256 from './keccak256.js';

// https://github.com/dcposch/blakejs
// https://github.com/dcposch/blakejs/blob/master/blake2b.js
//   some functions from util.js were copied into blake2b.js
import blake from './blake2b.js';

// https://github.com/shardus/lib-crypto-web/blob/main/utils/stringify.js
// Needed to stringify and parse bigints; also deterministic stringify
//   modified to use export
import { stringify, parse } from './stringify-shardus.js';

// We want to use encryption that we can see the source code for; don't use the native browser encryption
// https://github.com/paulmillr/noble-ciphers/releases
// https://github.com/paulmillr/noble-ciphers/releases/download/1.2.0/noble-ciphers.js
import { cbc, xchacha20poly1305 } from './noble-ciphers.js';

// Put standalone conversion function in lib.js
import { normalizeUsername, generateIdenticon, formatTime, 
    isValidEthereumAddress, 
    normalizeAddress, longAddress, utf82bin, bin2utf8, hex2big, bigxnum2big,
    big2str, base642bin, bin2base64, hex2bin, bin2hex,
} from './lib.js';


const myHashKey = hex2bin('69fa4195670576c0160d660c3be36556ff8d504725be8a59b5a96509e0c994bc')
const weiDigits = 18; 
const wei = 10n**BigInt(weiDigits)

let myAccount = null
let myData = null

// TODO - get the parameters from the network
// mock network parameters
let parameters = {
    current: {
        transactionFee: 1
    }
}

async function checkOnlineStatus() {
    try {
        const url = new URL(window.location.origin);
        url.searchParams.set('rand', Math.random());
        const response = await fetch(url.toString(), { method: 'HEAD' });
        return response.ok;
    } catch {
        return false;
    }
}

async function checkUsernameAvailability(username, address) {
    // Get random gateway
    const randomGateway = network.gateways[Math.floor(Math.random() * network.gateways.length)];
    const usernameBytes = utf82bin(normalizeUsername(username))
    const usernameHash = blake.blake2bHex(usernameBytes, myHashKey, 32)
    try {
        const response = await fetch(`${randomGateway.protocol}://${randomGateway.host}:${randomGateway.port}/address/${usernameHash}`);
        const data = await response.json();
        if (data && data.address){
            if (address && normalizeAddress(data.address) === normalizeAddress(address)) {
                return 'mine';
            }
            return 'taken'
        }
        if (!data){
            return 'error'
        }
        return 'available'
    } catch (error) {
        console.log('Error checking username:', error);
        return 'error2';
    }
}

function getAvailableUsernames() {
    const { netid } = network;
    const accounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');
    const netidAccounts = accounts.netids[netid];
    if (!netidAccounts || !netidAccounts.usernames) return [];
    return Object.keys(netidAccounts.usernames);
}

function openSignInModal() {
    // Get existing accounts
    const { netid } = network;
    const existingAccounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');
    const netidAccounts = existingAccounts.netids[netid];
    const usernames = netidAccounts?.usernames ? Object.keys(netidAccounts.usernames) : [];

    // First show the modal so we can properly close it if needed
    document.getElementById('signInModal').classList.add('active');

    // If no accounts exist, close modal and open Create Account modal
    if (usernames.length === 0) {
        closeSignInModal();
        openCreateAccountModal();
        return;
    }

    // Multiple accounts exist, show modal with select dropdown
    const usernameSelect = document.getElementById('username');
    const submitButton = document.querySelector('#signInForm button[type="submit"]');
    
    // Populate select with usernames
    usernameSelect.innerHTML = `
        <option value="">Select an account</option>
        ${usernames.map(username => `<option value="${username}">${username}</option>`).join('')}
    `;
    
    
    // Enable submit button when an account is selected
    usernameSelect.addEventListener('change', async () => {
        const username = usernameSelect.value;
        const notFoundMessage = document.getElementById('usernameNotFound');
        const options = usernameSelect.options;
        if (!username) {
            submitButton.disabled = true;
            notFoundMessage.style.display = 'none';
            return;
        }
        const address = netidAccounts.usernames[username].keys.address;
        const availability = await checkUsernameAvailability(username, address);
//console.log('usernames.length', usernames.length);
//console.log('availability', availability);
        const removeButton = document.getElementById('removeAccountButton');
        if (usernames.length === 1 && availability === 'mine') {
            myAccount = netidAccounts.usernames[username];
            myData = parse(localStorage.getItem(`${username}_${netid}`));
            if (!myData) { myData = newDataRecord(myAccount); }
            closeSignInModal();
            document.getElementById('welcomeScreen').style.display = 'none';
            switchView('chats');
            return;
        } else if (availability === 'mine') {
            submitButton.disabled = false;
            submitButton.textContent = 'Sign In';
            submitButton.style.display = 'inline';
            removeButton.style.display = 'none';
            notFoundMessage.style.display = 'none';
        } else if (availability === 'taken') {
            submitButton.style.display = 'none';
            removeButton.style.display = 'inline';
            notFoundMessage.textContent = 'taken';
            notFoundMessage.style.display = 'inline';
        } else if (availability === 'available') {
            submitButton.disabled = false;
            submitButton.textContent = 'Recreate';
            submitButton.style.display = 'inline';
            removeButton.style.display = 'inline';
            notFoundMessage.textContent = 'not found';
            notFoundMessage.style.display = 'inline';
        } else {
            submitButton.disabled = true;
            submitButton.textContent = 'Sign In';
            submitButton.style.display = 'none';
            removeButton.style.display = 'none';
            notFoundMessage.textContent = 'network error';
            notFoundMessage.style.display = 'inline';
        }
    });
    // Add event listener for remove account button
    const removeButton = document.getElementById('removeAccountButton');
    removeButton.addEventListener('click', async () => {
        const username = usernameSelect.value;
        if (!username) return;
        const confirmed = confirm(`Are you sure you want to remove account "${username}"?`);
        if (!confirmed) return;

        // Get network ID from network.js
        const { netid } = network;

        // Get existing accounts
        const existingAccounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');

        // Remove the account from the accounts object
        if (existingAccounts.netids[netid] && existingAccounts.netids[netid].usernames) {
            delete existingAccounts.netids[netid].usernames[username];
            localStorage.setItem('accounts', stringify(existingAccounts));
        }

        // Remove the account data from localStorage
        localStorage.removeItem(`${username}_${netid}`);

        // Reload the page to redirect to welcome screen
        window.location.reload();
    });
    // Initially disable submit button
    submitButton.disabled = true;
    // If only one account exists, select it and trigger change event
    if (usernames.length === 1) {
        usernameSelect.value = usernames[0];
        usernameSelect.dispatchEvent(new Event('change'));
        return;
    }   
}

function closeSignInModal() {
    document.getElementById('signInModal').classList.remove('active');
}

function openCreateAccountModal() {
    document.getElementById('createAccountModal').classList.add('active');
    const usernameInput = document.getElementById('newUsername');
    
    // Check availability on input changes
    let checkTimeout;
    usernameInput.addEventListener('input', (e) => {
        const username = e.target.value;
        const usernameAvailable = document.getElementById('newUsernameAvailable');
        const submitButton = document.querySelector('#createAccountForm button[type="submit"]');
        
        // Clear previous timeout
        if (checkTimeout) {
            clearTimeout(checkTimeout);
        }
        
        // Reset display
        usernameAvailable.style.display = 'none';
        submitButton.disabled = true;
        
        // Check if username is too short
        if (username.length < 3) {
            usernameAvailable.textContent = 'too short';
            usernameAvailable.style.color = '#dc3545';
            usernameAvailable.style.display = 'inline';
            return;
        }
        
        // Check network availability
        checkTimeout = setTimeout(async () => {
            const taken = await checkUsernameAvailability(username);
            if (taken == 'taken') {
                usernameAvailable.textContent = 'taken';
                usernameAvailable.style.color = '#dc3545';
                usernameAvailable.style.display = 'inline';
                submitButton.disabled = true;
            } else if (taken == 'available') {
                usernameAvailable.textContent = 'available';
                usernameAvailable.style.color = '#28a745';
                usernameAvailable.style.display = 'inline';
                submitButton.disabled = false;
            } else {
                usernameAvailable.textContent = 'network error';
                usernameAvailable.style.color = '#dc3545';
                usernameAvailable.style.display = 'inline';
                submitButton.disabled = true;
            }
        }, 1000);
    });
}

function closeCreateAccountModal() {
    document.getElementById('createAccountModal').classList.remove('active');
}

async function handleCreateAccount(event) {
    event.preventDefault();
    const username = normalizeUsername(document.getElementById('newUsername').value)
    
    // Get network ID from network.js
    const { netid } = network;
    
    // Get existing accounts or create new structure
    const existingAccounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');
    
    // Ensure netid and usernames objects exist
    if (!existingAccounts.netids[netid]) {
        existingAccounts.netids[netid] = { usernames: {} };
    }

    // Get private key from input or generate new one
    const providedPrivateKey = document.getElementById('newPrivateKey').value;
    const privateKeyError = document.getElementById('newPrivateKeyError');
    let privateKey, privateKeyHex;
    
    if (providedPrivateKey) {
        // Validate and normalize private key
        const validation = validatePrivateKey(providedPrivateKey);
        if (!validation.valid) {
            privateKeyError.textContent = validation.message;
            privateKeyError.style.color = '#dc3545';
            privateKeyError.style.display = 'inline';
            return;
        }
        
        privateKey = hex2bin(validation.key);
        privateKeyHex = validation.key;
        privateKeyError.style.display = 'none';
    } else {
        privateKey = secp.utils.randomPrivateKey();
        privateKeyHex = bin2hex(privateKey);
    }

    function validatePrivateKey(key) {
        // Trim whitespace
        key = key.trim();
        
        // Remove 0x prefix if present
        if (key.startsWith('0x')) {
            key = key.slice(2);
        }
        
        // Convert to lowercase
        key = key.toLowerCase();
        
        // Validate hex characters
        const hexRegex = /^[0-9a-f]*$/;
        if (!hexRegex.test(key)) {
            return {
                valid: false,
                message: 'Invalid characters - only 0-9 and a-f allowed'
            };
        }
        
        // Validate length (64 chars for 32 bytes)
        if (key.length !== 64) {
            return {
                valid: false,
                message: 'Invalid length - must be 64 hex characters'
            };
        }
        
        return {
            valid: true,
            key: key
        };
    }
    
    // Generate uncompressed public key
    const publicKey = secp.getPublicKey(privateKey, false);
    const publicKeyHex = bin2hex(publicKey);
    
    // Generate address from public key
    const address = keccak256(publicKey.slice(1)).slice(-20);
    const addressHex = bin2hex(address);

    // Create new account entry
    myAccount = {
        netid,
        username,
        keys: {
            address: addressHex,
            public: publicKeyHex,
            secret: privateKeyHex,
            type: "secp256k1"
        }
    };

    // Create new data entry
    myData = newDataRecord(myAccount);
    const res = await postRegisterAlias(username, myAccount.keys);

    if (res && (res.error || !res.result.success)) {
//console.log('no res', res)
        if (res?.result?.reason){
            alert(res.result.reason)
        }
        return;
    }

    // Store updated accounts back in localStorage
    existingAccounts.netids[netid].usernames[username] = myAccount;
    localStorage.setItem('accounts', stringify(existingAccounts));
    
    // Store the account data in localStorage
    localStorage.setItem(`${username}_${netid}`, stringify(myData));
    
    // Close modal and proceed to app
    closeCreateAccountModal();
    document.getElementById('welcomeScreen').style.display = 'none';
    getChats.lastCall = Date.now() // since we just created the account don't check for chat messages
    switchView('chats'); // Default view
}

async function handleSignIn(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const submitButton = document.querySelector('#signInForm button[type="submit"]');

    // Get network ID from network.js
    const { netid } = network;
    
    // Get existing accounts
    const existingAccounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');
    
    // Check if username exists
    if (!existingAccounts.netids[netid]?.usernames?.[username]) {
        console.error('Account not found');
        return;
    }

    // Check if the button text is 'Recreate'
    if (submitButton.textContent === 'Recreate') {
        const privateKey = existingAccounts.netids[netid].usernames[username].keys.secret;
        const newUsernameInput = document.getElementById('newUsername');
        newUsernameInput.value = username;
        closeSignInModal();
        openCreateAccountModal();
        // Dispatch a change event to trigger the availability check
        newUsernameInput.dispatchEvent(new Event('input'));

        document.getElementById('newPrivateKey').value = privateKey;
        closeSignInModal();
        openCreateAccountModal();
        return;
    }

    // Use existing account
    myAccount = existingAccounts.netids[netid].usernames[username];
    myData = parse(localStorage.getItem(`${username}_${netid}`));
    if (!myData) { myData = newDataRecord(myAccount); }
    
    // Close modal and proceed to app
    closeSignInModal();
    document.getElementById('welcomeScreen').style.display = 'none';
    await switchView('chats'); // Default view
}

function newDataRecord(myAccount){
    const myData = {
        timestamp: Date.now(),
        account: myAccount,
        network: {
            gateways: []
        },
        contacts: {},
        chats: [],
        wallet: {
            networth: 0.0,
            timestamp: 0,           // last balance update timestamp
            assets: [
                {
                    id: "liberdus",
                    name: "Liberdus",
                    symbol: "LIB",
                    img: "images/lib.png",
                    chainid:2220,
                    contract: "",
                    price: 1.0,
                    balance: 0n,
                    networth: 0.0,
                    addresses: [
                        {
                            address: myAccount.keys.address,
                            balance: 0n,
                            history: [],
                        }
                    ]
                }
            ],
            keys: {
            }
        },
        state: {
            unread: 0
        },
        settings: {
            encrypt: true,
            toll: 1
        }
    }
    myData.wallet.keys[`${myAccount.keys.address}`] = {
        address: myAccount.keys.address,
        public: myAccount.keys.public,
        secret: myAccount.keys.secret,
        type: myAccount.keys.type
    }
    return myData
}

// Generate deterministic color from hash
function getColorFromHash(hash, index) {
    const hue = parseInt(hash.slice(index * 2, (index * 2) + 2), 16) % 360;
    const saturation = 60 + (parseInt(hash.slice((index * 2) + 2, (index * 2) + 4), 16) % 20);
    const lightness = 45 + (parseInt(hash.slice((index * 2) + 4, (index * 2) + 6), 16) % 10);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Load saved account data and update chat list on page load
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('versionDisplay').textContent = version;

    // Add unload handler to save myData
    window.addEventListener('unload', () => {
        if (myData && myAccount) {
            localStorage.setItem(`${myAccount.username}_${myAccount.netid}`, stringify(myData));
        }
    });
    
    // Check for existing accounts and arrange welcome buttons
    const usernames = getAvailableUsernames()
    const hasAccounts = usernames.length > 0

    const signInBtn = document.getElementById('signInButton');
    const createAccountBtn = document.getElementById('createAccountButton');
    const importAccountBtn = document.getElementById('importAccountButton');
    const welcomeButtons = document.querySelector('.welcome-buttons');

    // Reorder buttons based on accounts existence
    if (hasAccounts) {
        welcomeButtons.innerHTML = ''; // Clear existing order
        welcomeButtons.appendChild(signInBtn);
                welcomeButtons.appendChild(createAccountBtn);
                welcomeButtons.appendChild(importAccountBtn);
        signInBtn.classList.add('primary-button');
        signInBtn.classList.remove('secondary-button');
    } else {
        welcomeButtons.innerHTML = ''; // Clear existing order
        welcomeButtons.appendChild(createAccountBtn);
                welcomeButtons.appendChild(signInBtn);
        welcomeButtons.appendChild(importAccountBtn);
        createAccountBtn.classList.add('primary-button');
        createAccountBtn.classList.remove('secondary-button');
    }

    // Add event listeners
    document.getElementById('search').addEventListener('click', () => {
        // TODO: Implement search functionality
    });
    document.getElementById('toggleMenu').addEventListener('click', toggleMenu);
    document.getElementById('closeMenu').addEventListener('click', toggleMenu);
    
    // Sign In Modal
    signInBtn.addEventListener('click', openSignInModal);
    document.getElementById('closeSignInModal').addEventListener('click', closeSignInModal);
    document.getElementById('signInForm').addEventListener('submit', handleSignIn);

    // Create Account Modal
    createAccountBtn.addEventListener('click', () => {
        document.getElementById('newUsername').value = '';
        document.getElementById('newPrivateKey').value = '';
        document.getElementById('newUsernameAvailable').style.display = 'none';
        document.getElementById('newPrivateKeyError').style.display = 'none';
        openCreateAccountModal();
    });
    document.getElementById('closeCreateAccountModal').addEventListener('click', closeCreateAccountModal);
    document.getElementById('createAccountForm').addEventListener('submit', handleCreateAccount);
    
    // Import Account now opens Import File Modal
    importAccountBtn.addEventListener('click', openImportFileModal);
    
    
    // Account Form Modal
    document.getElementById('openAccountForm').addEventListener('click', openAccountForm);
    document.getElementById('closeAccountForm').addEventListener('click', closeAccountForm);
    document.getElementById('accountForm').addEventListener('submit', handleAccountUpdate);
    
//            document.getElementById('openImportFormMenu').addEventListener('click', openImportFileModal);
    document.getElementById('closeImportForm').addEventListener('click', closeImportFileModal);
    document.getElementById('importForm').addEventListener('submit', handleImportFile);
    
    document.getElementById('openExportForm').addEventListener('click', openExportForm);
    document.getElementById('closeExportForm').addEventListener('click', closeExportForm);
    document.getElementById('exportForm').addEventListener('submit', handleExport);
    
    // Remove Account Modal
    document.getElementById('openRemoveAccount').addEventListener('click', openRemoveAccountModal);
    document.getElementById('closeRemoveAccountModal').addEventListener('click', closeRemoveAccountModal);
    document.getElementById('confirmRemoveAccount').addEventListener('click', handleRemoveAccount);

    // TODO add comment about which send form this is for chat or assets
    document.getElementById('openSendModal').addEventListener('click', openSendModal);
    document.getElementById('closeSendModal').addEventListener('click', closeSendModal);
    document.getElementById('sendForm').addEventListener('submit', handleSend);
    document.getElementById('sendAsset').addEventListener('change', () => {
        updateSendAddresses();
        updateAvailableBalance();
    });
    document.getElementById('sendFromAddress').addEventListener('change', updateAvailableBalance);
    document.getElementById('availableBalance').addEventListener('click', fillAmount);
    
    // Add blur event listener for recipient validation
    document.getElementById('sendToAddress').addEventListener('blur', handleSendToAddressValidation);
    
    document.getElementById('openReceiveModal').addEventListener('click', openReceiveModal);
    document.getElementById('closeReceiveModal').addEventListener('click', closeReceiveModal);
    document.getElementById('receiveAsset').addEventListener('change', updateReceiveAddresses);
    document.getElementById('receiveAddress').addEventListener('change', updateDisplayAddress);
    document.getElementById('copyAddress').addEventListener('click', copyAddress);
    
    document.getElementById('openHistoryModal').addEventListener('click', openHistoryModal);
    document.getElementById('closeHistoryModal').addEventListener('click', closeHistoryModal);
    document.getElementById('historyAsset').addEventListener('change', updateHistoryAddresses);
    document.getElementById('historyAddress').addEventListener('change', updateTransactionHistory);
    
    document.getElementById('switchToChats').addEventListener('click', () => switchView('chats'));
    document.getElementById('switchToContacts').addEventListener('click', () => switchView('contacts'));
    document.getElementById('switchToWallet').addEventListener('click', () => switchView('wallet'));
    
    document.getElementById('handleSignOut').addEventListener('click', handleSignOut);
    document.getElementById('closeChatModal').addEventListener('click', closeChatModal);
    document.getElementById('handleSendMessage').addEventListener('click', handleSendMessage);
    
    // Add refresh balance button handler
    document.getElementById('refreshBalance').addEventListener('click', async () => {
        await updateWalletBalances();
        updateWalletView();
    });
    
    // New Chat functionality
    document.getElementById('newChatButton').addEventListener('click', openNewChatModal);
    document.getElementById('closeNewChatModal').addEventListener('click', closeNewChatModal);
    document.getElementById('newChatForm').addEventListener('submit', handleNewChat);
    
    // Add blur event listener to recipient input for validation
    let recipientCheckTimeout;
    document.getElementById('recipient').addEventListener('change', (e) => {
        const input = e.target.value.trim();
        const errorElement = document.getElementById('recipientError');
        
        // Clear previous timeout
        if (recipientCheckTimeout) {
            clearTimeout(recipientCheckTimeout);
        }
        
        // Reset display
        errorElement.style.display = 'none';
        
        if (input.length >= 3 && !input.startsWith('0x')) {
            // Check network availability after 3 seconds
            recipientCheckTimeout = setTimeout(async () => {
                const taken = await checkUsernameAvailability(input);
                if (taken == 'taken') {
                    errorElement.textContent = 'found';
                    errorElement.style.color = '#28a745';  // Green color for success
                    errorElement.style.display = 'inline';
                } else if (taken == 'available') {
                    showRecipientError('not found');
                } else {
                    showRecipientError('network error');
                }
            }, 3000);
        }
    });

    // Add input event listener for message textarea auto-resize
    document.querySelector('.message-input')?.addEventListener('input', function() {
        this.style.height = '44px';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    // Add to home screen functionality
    let deferredInstallPrompt;
    let addToHomeScreenButton = document.getElementById('addToHomeScreenButton');

    // Device and browser detection with improved iOS browser checks
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isChromeIOS = /CriOS/.test(navigator.userAgent);
    const isFirefoxIOS = /FxiOS/.test(navigator.userAgent);
    const isEdgeIOS = /EdgiOS/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android|CriOS|FxiOS|EdgiOS).)*safari/i.test(navigator.userAgent);
    const isAndroid = /android/i.test(navigator.userAgent);
    const isDesktop = !isIOS && !isAndroid;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        window.navigator.standalone || // iOS
                        document.referrer.includes('android-app://');

    // Add browser detection
    const isOpera = navigator.userAgent.indexOf("OPR") > -1 || navigator.userAgent.indexOf("Opera") > -1;
    const isFirefox = navigator.userAgent.indexOf("Firefox") > -1;

    // Function to check if the app can be installed
    const canInstall = () => {
        // Already installed as PWA
        if (isStandalone) {
            console.log('App is already installed');
            return false;
        }

        // iOS - show button for all browsers (will handle redirect to Safari)
        if (isIOS) {
            const browser = isChromeIOS ? 'Chrome' : 
                          isFirefoxIOS ? 'Firefox' : 
                          isEdgeIOS ? 'Edge' : 
                          isSafari ? 'Safari' : 'other';
            console.log(`iOS ${browser} detected - showing button`);
            return true;
        }

        // For both Desktop and Android, rely on actual install prompt support
        return 'serviceWorker' in navigator && 'BeforeInstallPromptEvent' in window;
    };

    // Function to update button visibility
    const updateButtonVisibility = () => {
        if (addToHomeScreenButton) {
            if (canInstall()) {
                console.log('Can install - showing button');
                addToHomeScreenButton.style.display = 'block';
            } else {
                console.log('Cannot install - hiding button');
                addToHomeScreenButton.style.display = 'none';
            }
        }
    };

    // Create button if it doesn't exist
    if (!addToHomeScreenButton) {
        console.log('Creating Add to Home Screen button');
        const welcomeButtons = document.querySelector('.welcome-buttons');
        if (welcomeButtons) {
            addToHomeScreenButton = document.createElement('button');
            addToHomeScreenButton.id = 'addToHomeScreenButton';
            addToHomeScreenButton.className = 'secondary-button';
            addToHomeScreenButton.textContent = 'Add to Home Screen';
            welcomeButtons.appendChild(addToHomeScreenButton);
        }
    }

    // Set up installation handling
    if (addToHomeScreenButton) {
        console.log('Setting up installation handling');
        console.log('Device/Browser Detection:', {
            isIOS,
            isChromeIOS,
            isFirefoxIOS,
            isEdgeIOS,
            isSafari,
            isDesktop,
            isStandalone
        });

        if (isIOS) {
            if (!isSafari) {
                // Non-Safari iOS browsers
                addToHomeScreenButton.addEventListener('click', () => {
                    const currentUrl = window.location.href;
                    alert('Open in Safari...\n\n' +
                          'iOS only supports adding to home screen through Safari browser.');
                    // Open the current URL in Safari
                    window.location.href = currentUrl;
                });
            } else {
                // iOS Safari - Show numbered install instructions
                addToHomeScreenButton.addEventListener('click', () => {
                    alert('To add to home screen:\n\n' +
                          '1. Tap the share button (rectangle with arrow) at the bottom of Safari\n' +
                          '2. Scroll down and tap "Add to Home Screen"\n' +
                          '3. Tap "Add" in the top right');
                });
            }
        } else if (isDesktop) {
            // Desktop browsers - Handle install prompt
            window.addEventListener('beforeinstallprompt', (e) => {
                console.log('beforeinstallprompt fired on desktop');
                e.preventDefault();
                deferredInstallPrompt = e;
                
                // Make sure the button is visible when we can install
                updateButtonVisibility();
            });

            addToHomeScreenButton.addEventListener('click', async () => {
                if (deferredInstallPrompt) {
                    console.log('prompting desktop install');
                    deferredInstallPrompt.prompt();
                    const { outcome } = await deferredInstallPrompt.userChoice;
                    console.log(`User response to the desktop install prompt: ${outcome}`);
                    deferredInstallPrompt = null;

                    if (outcome === 'accepted') {
                        addToHomeScreenButton.style.display = 'none';
                    }
                } else if (isOpera) {
                    alert('Installation is not supported in Opera browser. Please use Google Chrome or Microsoft Edge.');
                } else if (isFirefox) {
                    alert('Installation is not supported in Firefox browser. Please use Google Chrome or Microsoft Edge.');
                } else {
                    alert('This app is already installed or cannot be installed on this device/browser.');
                }
            });
        } else {
            // Android - Handle install prompt
            window.addEventListener('beforeinstallprompt', (e) => {
                console.log('beforeinstallprompt fired on Android');
                e.preventDefault();
                deferredInstallPrompt = e;
                
                updateButtonVisibility();
            });

            addToHomeScreenButton.addEventListener('click', async () => {
                if (deferredInstallPrompt) {
                    console.log('prompting Android install');
                    deferredInstallPrompt.prompt();
                    const { outcome } = await deferredInstallPrompt.userChoice;
                    console.log(`User response to the Android install prompt: ${outcome}`);
                    deferredInstallPrompt = null;

                    if (outcome === 'accepted') {
                        addToHomeScreenButton.style.display = 'none';
                    }
                }
            });
        }

        // Hide button after successful installation
        window.addEventListener('appinstalled', (event) => {
            console.log('👍', 'appinstalled', event);
            addToHomeScreenButton.style.display = 'none';
        });

        // Check if we can display the install button
        updateButtonVisibility();

        // Listen for display mode changes
        window.matchMedia('(display-mode: standalone)').addEventListener('change', (evt) => {
            updateButtonVisibility();
        });
    }
});

// Update chat list UI
async function updateChatList(force) {
    let gotChats = 0
    if (myAccount && myAccount.keys && myData && myData.wallet && myData.wallet.keys) {
        gotChats = await getChats(myData.wallet.keys[myAccount.keys.address]);     // populates myData with new chat messages
    }
console.log('force gotChats', force, gotChats)
    if (! (force || gotChats)){ return }
    const chatList = document.getElementById('chatList');
//            const chatsData = myData
    const contacts = myData.contacts
    const chats = myData.chats
    
    if (document.getElementById('chatModal').classList.contains('active')) { appendChatModal() }

    if (chats.length === 0) {
        chatList.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 2rem; margin-bottom: 1rem"></div>
                <div style="font-weight: bold; margin-bottom: 0.5rem">No Chats Yet</div>
                <div>Your conversations will appear here</div>
            </div>`;
        return;
    }

console.log('updateChatList chats.length', chats.length)
    
    const chatItems = await Promise.all(chats.map(async chat => {
        const identicon = await generateIdenticon(chat.address);
        const contact = contacts[chat.address]
        const message = contact.messages.at(-1)
        return `
            <li class="chat-item">
                <div class="chat-avatar">${identicon}</div>
                <div class="chat-content">
                    <div class="chat-header">
                        <div class="chat-name">${contact.name || contact.username || `${contact.address.slice(0,8)}...${contact.address.slice(-6)}`}</div>
                        <div class="chat-time">${formatTime(message.timestamp)}</div>
                    </div>
                    <div class="chat-message">
                        ${message.my ? 'You: ' : ''}${message.message}
                        ${contact.unread ? `<span class="chat-unread">${contact.unread}</span>` : ''}
                    </div>
                </div>
            </li>
        `;
    }));
    
    chatList.innerHTML = chatItems.join('');
    
    // Add click handlers to chat items
    document.querySelectorAll('.chat-item').forEach((item, index) => {
        item.onclick = () => openChatModal(chats[index].address);
    });
}

// refresh wallet balance
async function updateWalletBalances() {
    if (!myAccount || !myData || !myData.wallet || !myData.wallet.assets) {
        console.error('No wallet data available');
        return;
    }
    if (!myData.wallet.timestamp){myData.wallet.timestamp = 0}
    if (Date.now() - myData.wallet.timestamp < 5000){return}

    // TODO - first update the asset prices from a public API

    let totalWalletNetworth = 0.0;

    // Update balances for each asset and address
    for (const asset of myData.wallet.assets) {
        let assetTotalBalance = 0n;
        
        // Get balance for each address in the asset
        for (const addr of asset.addresses) {
            try {
                const address = longAddress(addr.address);
                const data = await queryNetwork(`/account/${address}/balance`)
console.log('balance', data)                       
                // Update address balance
                addr.balance = hex2big(data.balance.value) || 0;
                
                // Add to asset total (convert to USD using asset price)
                assetTotalBalance += addr.balance
            } catch (error) {
                console.error(`Error fetching balance for address ${addr.address}:`, error);
            }
        }
        asset.balance = assetTotalBalance;
        asset.networth = asset.price * Number(assetTotalBalance)/Number(wei);
        
        // Add this asset's total to wallet total
        totalWalletNetworth += asset.networth;
    }

    // Update total wallet balance
    myData.wallet.networth = totalWalletNetworth;
    myData.wallet.timestamp = Date.now()
}

async function switchView(view) {
    // Hide all screens
    document.querySelectorAll('.app-screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show selected screen
    document.getElementById(`${view}Screen`).classList.add('active');

    // Show header and footer
    document.getElementById('header').classList.add('active');
    document.getElementById('footer').classList.add('active');
    
    // Update header with username if signed in
    const appName = document.querySelector('.app-name');
    if (myAccount && myAccount.username) {
        appName.textContent = `Liberdus - ${myAccount.username}`;
    } else {
        appName.textContent = 'Liberdus';
    }   

    // Show/hide new chat button
    const newChatButton = document.getElementById('newChatButton');
    if (view === 'chats') {
        newChatButton.classList.add('visible');
    } else {
        newChatButton.classList.remove('visible');
    }

    // Update lists when switching views
    if (view === 'chats') {
        await updateChatList('force');
    } else if (view === 'contacts') {
        await updateContactsList();
    } else if (view === 'wallet') {
        await updateWalletBalances();
        await updateWalletView();
    }
    
    // Update nav button states
    document.querySelectorAll('.nav-button').forEach(button => {
        button.classList.remove('active');
        if (button.textContent.toLowerCase() === view) {
            button.classList.add('active');
        }
    });
}

// Update contacts list UI
async function updateContactsList() {
    const contactsList = document.getElementById('contactsList');
//            const chatsData = myData
    const contacts = myData.contacts;
    
    if (Object.keys(contacts).length === 0) {
        contactsList.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 2rem; margin-bottom: 1rem"></div>
                <div style="font-weight: bold; margin-bottom: 0.5rem">No Contacts Yet</div>
                <div>Your contacts will appear here</div>
            </div>`;
        return;
    }

    const contactsArray = Object.values(contacts);
    const contactItems = await Promise.all(contactsArray.map(async contact => {
        const identicon = await generateIdenticon(contact.address);
        return `
            <li class="chat-item">
                <div class="chat-avatar">${identicon}</div>
                <div class="chat-content">
                    <div class="chat-header">
                        <div class="chat-name">${contact.name || contact.username || `${contact.address.slice(0,8)}...${contact.address.slice(-6)}`}</div>
                    </div>
                    <div class="chat-message">
                        ${contact.email || contact.x || contact.phone || contact.address}
                    </div>
                </div>
            </li>
        `;
    }));
    
    contactsList.innerHTML = contactItems.join('');
    
    // Add click handlers to contact items
    document.querySelectorAll('#contactsList .chat-item').forEach((item, index) => {
        item.onclick = () => openChatModal(contactsArray[index].address);
    });
}

function toggleMenu() {
    document.getElementById('menuModal').classList.toggle('active');
//    document.getElementById('accountModal').classList.remove('active');
}

function openAccountForm() {
    document.getElementById('accountModal').classList.add('active');
    if (myData && myData.account) {
        document.getElementById('name').value = myData.account.name || '';
        document.getElementById('email').value = myData.account.email || '';
        document.getElementById('phone').value = myData.account.phone || '';
        document.getElementById('linkedin').value = myData.account.linkedin || '';
        document.getElementById('x').value = myData.account.x || '';
    }
}

function closeAccountForm() {
    document.getElementById('accountModal').classList.remove('active');
}

function openExportForm() {
    document.getElementById('exportModal').classList.add('active');
}

function closeExportForm() {
    document.getElementById('exportModal').classList.remove('active');
}

// We purposely do not encrypt/decrypt using browser native crypto functions; all crypto functions must be readable
// Decrypt data using ChaCha20-Poly1305
async function decryptData(encryptedData, password) {
    if (!password) return encryptedData;

    // Generate key using 100,000 iterations of blake2b
    let key = utf82bin(password);
    for (let i = 0; i < 100000; i++) {
        key = blake.blake2b(key, null, 32);
    }

    // Decrypt the data using ChaCha20-Poly1305
    return decryptChacha(key, encryptedData);
}

function openImportFileModal() {
    document.getElementById('importModal').classList.add('active');
}

function closeImportFileModal() {
    document.getElementById('importModal').classList.remove('active');
}

async function handleImportFile(event) {
    event.preventDefault();
    const fileInput = document.getElementById('importFile');
    const passwordInput = document.getElementById('importPassword');
    const messageElement = document.getElementById('importMessage');
    
    try {
        // Read the file
        const file = fileInput.files[0];
        let fileContent = await file.text();
        const isNotEncryptedData = fileContent.match('{')

        // Check if data is encrypted and decrypt if necessary
        if ( ! isNotEncryptedData) {
            if (!passwordInput.value.trim()) {
                alert('Password required for encrypted data');
                return
            }
            fileContent = await decryptData(fileContent, passwordInput.value.trim());
            if (fileContent == null){ throw "" }
        }
        const jsonData = parse(fileContent);

        // We first parse to jsonData so that if the parse does not work we don't destroy myData
        myData = parse(fileContent)
        // also need to set myAccount
        const acc = myData.account  // this could have other things which are not needed
        myAccount = {
            netid: acc.netid,
            username: acc.username,
            keys: {
                address: acc.keys.address,
                public: acc.keys.public,
                secret: acc.keys.secret,
                type: acc.keys.type
            }
        }
        // Get existing accounts or create new structure
        const existingAccounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');
        // Store updated accounts back in localStorage
        existingAccounts.netids[myAccount.netid].usernames[myAccount.username] = myAccount;
        localStorage.setItem('accounts', stringify(existingAccounts));

        // Store the localStore entry for username_netid
        localStorage.setItem(`${myAccount.username}_${myAccount.netid}`, stringify(myData));

/*
        // Refresh form data and chat list
//                loadAccountFormData();
        await updateChatList();
*/

        // Show success message
        messageElement.textContent = 'Data imported successfully!';
        messageElement.classList.add('active');
        
        // Reset form and close modal after delay
        setTimeout(() => {
            messageElement.classList.remove('active');
            closeImportFileModal();
            window.location.reload();  // need to go through Sign In to make sure imported account exists on network
            fileInput.value = '';
            passwordInput.value = '';
        }, 2000);
        
    } catch (error) {
        messageElement.textContent = error.message || 'Import failed. Please check file and password.';
        messageElement.style.color = '#dc3545';
        messageElement.classList.add('active');
        setTimeout(() => {
            messageElement.classList.remove('active');
            messageElement.style.color = '#28a745';
        }, 3000);
    }
}


// We purposely do not encrypt/decrypt using browser native crypto functions; all crypto functions must be readable
// Encrypt data using ChaCha20-Poly1305
async function encryptData(data, password) {
    if (!password) return data;

    // Generate salt
    const salt = window.crypto.getRandomValues(new Uint8Array(16));

    // Derive key using 100,000 iterations of blake2b
    let key = utf82bin(password);
    for (let i = 0; i < 100000; i++) {
        key = blake.blake2b(key, null, 32);
    }

    // Encrypt the data using ChaCha20-Poly1305
    const encrypted = encryptChacha(key, data);
    return encrypted
}

async function handleExport(event) {
    event.preventDefault();

    const password = document.getElementById('exportPassword').value;
    const jsonData = stringify(myData, null, 2);
    
    try {
        // Encrypt data if password is provided
        const finalData = password ? 
            await encryptData(jsonData, password) : 
            jsonData;
        
        // Create and trigger download
        const blob = new Blob([finalData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${myAccount.username}-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Close export modal
        closeExportForm();
    } catch (error) {
        console.error('Encryption failed:', error);
        alert('Failed to encrypt data. Please try again.');
    }
}

function openRemoveAccountModal() {
    document.getElementById('removeAccountModal').classList.add('active');
}

function closeRemoveAccountModal() {
    document.getElementById('removeAccountModal').classList.remove('active');
}

async function handleRemoveAccount() {
    // Get network ID from network.js
    const { netid } = network;

    // Get existing accounts
    const existingAccounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');

    // Remove the account from the accounts object
    if (existingAccounts.netids[netid] && existingAccounts.netids[netid].usernames) {
        delete existingAccounts.netids[netid].usernames[myAccount.username];
        localStorage.setItem('accounts', stringify(existingAccounts));
    }

    // Remove the account data from localStorage
    localStorage.removeItem(`${myAccount.username}_${netid}`);

    // Reload the page to redirect to welcome screen
    window.location.reload();
}

function openNewChatModal() {
    document.getElementById('newChatModal').classList.add('active');
    document.getElementById('newChatButton').classList.remove('visible');
}

function closeNewChatModal() {
    document.getElementById('newChatModal').classList.remove('active');
    document.getElementById('newChatForm').reset();
    if (document.getElementById('chatsScreen').classList.contains('active')) {
        document.getElementById('newChatButton').classList.add('visible');
    }
}

// Show error message in the new chat form
function showRecipientError(message) {
    const errorElement = document.getElementById('recipientError');
    errorElement.textContent = message;
    errorElement.style.color = '#dc3545';  // Always red for errors
    errorElement.style.display = 'inline';
}

// Validate recipient in send modal
async function handleSendToAddressValidation(e) {
    const input = e.target.value.trim();
    const errorElement = document.getElementById('sendToAddressError');
    
    // Clear previous error
    errorElement.style.display = 'none';
    
    if (!input) return;
    
    // Check if input is an Ethereum address
    if (input.startsWith('0x')) {
        if (!isValidEthereumAddress(input)) {
            errorElement.textContent = 'Invalid address format';
            errorElement.style.color = '#dc3545';
            errorElement.style.display = 'inline';
        }
        return;
    }
    
    // If not an address, treat as username
    if (input.length < 3) {
        errorElement.textContent = 'Username too short';
        errorElement.style.color = '#dc3545';
        errorElement.style.display = 'inline';
        return;
    }
    
    // Check username availability on network
    const taken = await checkUsernameAvailability(input);
    if (taken === 'taken') {
        errorElement.textContent = 'found';
        errorElement.style.color = '#28a745';
        errorElement.style.display = 'inline';
    } else if (taken === 'available') {
        errorElement.textContent = 'not found';
        errorElement.style.color = '#dc3545';
        errorElement.style.display = 'inline';
    } else {
        errorElement.textContent = 'network error';
        errorElement.style.color = '#dc3545';
        errorElement.style.display = 'inline';
    }
}

// Hide error message in the new chat form
function hideRecipientError() {
    const errorElement = document.getElementById('recipientError');
    errorElement.style.display = 'none';
}

async function handleNewChat(event) {
    event.preventDefault();
    const input = document.getElementById('recipient').value.trim();
    let recipientAddress;
    let username;
    
    hideRecipientError();
    
    // Check if input is an Ethereum address
    if (input.startsWith('0x')) {
        if (!isValidEthereumAddress(input)) {
            showRecipientError('Invalid Ethereum address format');
            return;
        }
        // Input is valid Ethereum address, normalize it
        recipientAddress = normalizeAddress(input);
    } else {
        if (input.length < 3) {
            showRecipientError('Username too short');
            return;
        }
        username = normalizeUsername(input)
        // Treat as username and lookup address
        const usernameBytes = utf82bin(username);
        const usernameHash = blake.blake2bHex(usernameBytes, myHashKey, 32);
        try {
            const data = await queryNetwork(`/address/${usernameHash}`)
            if (!data || !data.address) {
                showRecipientError('Username not found');
                return;
            }
            // Normalize address from API if it has 0x prefix or trailing zeros
            recipientAddress = normalizeAddress(data.address);
        } catch (error) {
            console.log('Error looking up username:', error);
            showRecipientError('Error looking up username');
            return;
        }
    }
    
    // Get or create chat data
    const chatsData = myData
    
    // Check if contact exists
    if (!chatsData.contacts[recipientAddress]) { createNewContact(recipientAddress) }
    chatsData.contacts[recipientAddress].username = !input.startsWith('0x') ? username : undefined

// TODO - maybe we don't need this; this is just adding a blank entry into the chats table
    // Add to chats if not already present
    const existingChat = chatsData.chats.find(chat => chat.address === recipientAddress);
    if (!existingChat) {
        chatsData.chats.unshift({
            address: recipientAddress,
            timestamp: Date.now(),
        });
    }

    // Close new chat modal and open chat modal
    closeNewChatModal();
    openChatModal(recipientAddress);
}

function createNewContact(addr, username){
    const address = normalizeAddress(addr)
    if (myData.contacts[address]){ return }  // already exists
    const c = myData.contacts[address] = {}
    c.address = address
    if (username){ c.username = username }
    c.messages = []
    c.timestamp = Date.now()
    c.unread = 0
}


function openChatModal(address) {
    const modal = document.getElementById('chatModal');
    const modalAvatar = modal.querySelector('.modal-avatar');
    const modalTitle = modal.querySelector('.modal-title');
    const messagesList = modal.querySelector('.messages-list');
    document.getElementById('newChatButton').classList.remove('visible');
    const contact = myData.contacts[address]
    // Set user info
    modalTitle.textContent = contact.name || contact.username || `${contact.address.slice(0,8)}...${contact.address.slice(-6)}`;
    generateIdenticon(contact.address, 40).then(identicon => {
        modalAvatar.innerHTML = identicon;
    });

    // Get messages from contacts data
    const messages = contact?.messages || [];

    // Display messages
    messagesList.innerHTML = messages.map(msg => `
        <div class="message ${msg.my ? 'sent' : 'received'}">
            <div class="message-content">${msg.message}</div>
            <div class="message-time">${formatTime(msg.timestamp)}</div>
        </div>
    `).join('');

    // Scroll to bottom
    setTimeout(() => {
        messagesList.parentElement.scrollTop = messagesList.parentElement.scrollHeight;
    }, 100);

    // Show modal
    modal.classList.add('active');

    // Clear unread count
    if (contact.unread > 0) {
        myData.state.unread = Math.max(0, (myData.state.unread || 0) - contact.unread);
        contact.unread = 0;
        updateChatList();
    } 

    // Setup to update new messages
    appendChatModal.address = address
    appendChatModal.len = messages.length
    pollChatInterval(5000) // poll for messages every 5 seconds
}

function appendChatModal(){
console.log('appendChatModal')
    if (! appendChatModal.address){ return }
//console.log(2)
//    if (document.getElementById('chatModal').classList.contains('active')) { return }
//console.log(3)
    const messages = myData.contacts[appendChatModal.address].messages
    if (appendChatModal.len >= messages.length){ return }
//console.log(4)
    const modal = document.getElementById('chatModal');
    const messagesList = modal.querySelector('.messages-list');

    for (let i=appendChatModal.len; i<messages.length; i++) {
console.log(5, i)
        const m = messages[i]
        m.type = m.my ? 'sent' : 'received'
        // Add message to UI
        messagesList.insertAdjacentHTML('beforeend', `
            <div class="message ${m.type}">
                <div class="message-content" style="white-space: pre-wrap">${m.message}</div>
                <div class="message-time">${formatTime(m.timestamp)}</div>
            </div>
        `);
    }
    appendChatModal.len = messages.length
    // Scroll to bottom
    messagesList.parentElement.scrollTop = messagesList.parentElement.scrollHeight;
}
appendChatModal.address = null
appendChatModal.len = 0

function closeChatModal() {
    document.getElementById('chatModal').classList.remove('active');
    if (document.getElementById('chatsScreen').classList.contains('active')) {
        updateChatList('force')
        document.getElementById('newChatButton').classList.add('visible');
    }
    appendChatModal.address = null
    appendChatModal.len = 0
    pollChatInterval(0)
}

function openReceiveModal() {
    const modal = document.getElementById('receiveModal');
    modal.classList.add('active');
    
    // Get wallet data
    const walletData = myData.wallet

    // Populate assets dropdown
    const assetSelect = document.getElementById('receiveAsset');
    assetSelect.innerHTML = walletData.assets.map((asset, index) => 
        `<option value="${index}">${asset.name} (${asset.symbol})</option>`
    ).join('');
    
    // Update addresses for first asset
    updateReceiveAddresses();
}

function closeReceiveModal() {
    document.getElementById('receiveModal').classList.remove('active');
}

function updateReceiveAddresses() {
    const walletData = myData.wallet
    const assetIndex = document.getElementById('receiveAsset').value;
    const addressSelect = document.getElementById('receiveAddress');

    // Check if we have any assets
    if (!walletData.assets || walletData.assets.length === 0) {
        addressSelect.innerHTML = '<option value="">No addresses available</option>';
        return;
    }

    const asset = walletData.assets[assetIndex];
    
    // Check if asset exists and has addresses
    if (!asset || !asset.addresses || asset.addresses.length === 0) {
        addressSelect.innerHTML = '<option value="">No addresses available</option>';
        return;
    }
    
    // Populate addresses dropdown
    addressSelect.innerHTML = asset.addresses.map((addr, index) =>
        `<option value="${index}">${addr.address} (${(Number(addr.balance)/Number(wei)).toPrecision(4)} ${asset.symbol})</option>`
    ).join('');

    // Update display address
    updateDisplayAddress();
}

function updateDisplayAddress() {
    const walletData = myData.wallet
    
    const assetIndex = document.getElementById('receiveAsset').value;
    const addressIndex = document.getElementById('receiveAddress').value;
    const displayAddress = document.getElementById('displayAddress');
    const qrcodeContainer = document.getElementById('qrcode');
    
    // Clear previous QR code
    qrcodeContainer.innerHTML = '';

    // Check if we have any assets
    if (!walletData.assets || walletData.assets.length === 0) {
        displayAddress.textContent = 'No address available';
        return;
    }

    const asset = walletData.assets[assetIndex];
    
    // Check if asset exists and has addresses
    if (!asset || !asset.addresses || asset.addresses.length === 0) {
        displayAddress.textContent = 'No address available';
        return;
    }

    const address = asset.addresses[addressIndex].address;
    displayAddress.textContent = '0x' + address;
    
    // Update QR code
    new QRCode(qrcodeContainer, {
        text: '0x' + address,
        width: 200,
        height: 200
    });
}

async function copyAddress() {
    const address = document.getElementById('displayAddress').textContent;
    try {
        await navigator.clipboard.writeText(address);
        const button = document.getElementById('copyAddress');
        button.classList.add('success');
        setTimeout(() => {
            button.classList.remove('success');
        }, 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
    }
}

function openSendModal() {
    const modal = document.getElementById('sendModal');
    modal.classList.add('active');
    
    // Get wallet data
    const walletData = myData.wallet
    
    // Populate assets dropdown
    const assetSelect = document.getElementById('sendAsset');
    assetSelect.innerHTML = walletData.assets.map((asset, index) => 
        `<option value="${index}">${asset.name} (${asset.symbol})</option>`
    ).join('');
    
    // Update addresses for first asset
    updateSendAddresses();
}

async function closeSendModal() {
    await updateChatList()
    document.getElementById('sendModal').classList.remove('active');
    document.getElementById('sendForm').reset();
}

function updateSendAddresses() {
    const walletData = myData.wallet
    const assetIndex = document.getElementById('sendAsset').value;
    const addressSelect = document.getElementById('sendFromAddress');

    // Check if we have any assets
    if (!walletData.assets || walletData.assets.length === 0) {
        addressSelect.innerHTML = '<option value="">No addresses available</option>';
        updateAvailableBalance();
        return;
    }

    const asset = walletData.assets[assetIndex];
    
    // Check if asset exists and has addresses
    if (!asset || !asset.addresses || asset.addresses.length === 0) {
        addressSelect.innerHTML = '<option value="">No addresses available</option>';
        updateAvailableBalance();
        return;
    }
    
    // Populate addresses dropdown
    addressSelect.innerHTML = asset.addresses.map((addr, index) =>
        `<option value="${index}">${addr.address} (${(Number(addr.balance)/Number(wei)).toPrecision(4)} ${asset.symbol})</option>`
    ).join('');
    
    // Update available balance display
    updateAvailableBalance();
}

function updateAvailableBalance() {
    const walletData = myData.wallet
    const assetIndex = document.getElementById('sendAsset').value;
    const addressIndex = document.getElementById('sendFromAddress').value;
    const balanceAmount = document.getElementById('balanceAmount');
    const balanceSymbol = document.getElementById('balanceSymbol');

    // Check if we have any assets
    if (!walletData.assets || walletData.assets.length === 0) {
        balanceAmount.textContent = '0.00';
        balanceSymbol.textContent = '';
        return;
    }

    const asset = walletData.assets[assetIndex];
    
    // Check if asset exists and has addresses
    if (!asset || !asset.addresses || asset.addresses.length === 0) {
        balanceAmount.textContent = '0.00';
        balanceSymbol.textContent = asset ? asset.symbol : '';
        return;
    }

    const fromAddress = asset.addresses[addressIndex];
    if (!fromAddress) {
        balanceAmount.textContent = '0.00';
        balanceSymbol.textContent = asset.symbol;
        return;
    }
    
    balanceAmount.textContent = big2str(fromAddress.balance, weiDigits);
    balanceSymbol.textContent = asset.symbol;
}

function fillAmount() {
    const amount = document.getElementById('balanceAmount').textContent;
    document.getElementById('sendAmount').value = amount;
}

async function handleSend(event) {
    event.preventDefault();
    
    const walletData = myData.wallet;
    const assetIndex = document.getElementById('sendAsset').value;
    const addressIndex = document.getElementById('sendFromAddress').value;
    const asset = walletData.assets[assetIndex];
    const fromAddress = asset.addresses[addressIndex];
    const amount = bigxnum2big(wei, document.getElementById('sendAmount').value);
    const recipientInput = document.getElementById('sendToAddress').value.trim();
    const memo = document.getElementById('sendMemo').value || '';
    let toAddress;

    // Validate amount
    if (amount > fromAddress.balance) {  // TODO - include tx fee
        alert('Insufficient balance');
        return;
    }

    // Handle recipient input - could be username or address
    if (recipientInput.startsWith('0x')) {
        if (!isValidEthereumAddress(recipientInput)) {
            alert('Invalid address format');
            return;
        }
        toAddress = normalizeAddress(recipientInput);
    } else {
        if (recipientInput.length < 3) {
            alert('Username too short');
            return;
        }

        // Look up username on network
        const usernameBytes = utf82bin(recipientInput);
        const usernameHash = blake.blake2bHex(usernameBytes, myHashKey, 32);
        
        try {
            const randomGateway = network.gateways[Math.floor(Math.random() * network.gateways.length)];
            const response = await fetch(`${randomGateway.protocol}://${randomGateway.host}:${randomGateway.port}/address/${usernameHash}`);
            const data = await response.json();
            
            if (!data || !data.address) {
                alert('Username not found');
                return;
            }
            toAddress = normalizeAddress(data.address);
        } catch (error) {
            console.error('Error looking up username:', error);
            alert('Error looking up username');
            return;
        }
    }

    // Get sender's keys from wallet
    const keys = walletData.keys[fromAddress.address];
    if (!keys) {
        alert('Keys not found for sender address');
        return;
    }

    try {
        // Send the transaction using postTransferAsset
        const response = await postTransferAsset(toAddress, amount, memo, keys);
        
        if (!response || !response.result || !response.result.success) {
            alert('Transaction failed: ' + response.result.reason);
            return;
        }

// Don't try to update the balance here; the tx might not have gone through; let user refresh the balance from the wallet page
// Maybe we can set a timer to check on the status of the tx using txid and update the balance if the txid was processed
/*
        // Update local balance after successful transaction
        fromAddress.balance -= amount;
        walletData.balance = walletData.assets.reduce((total, asset) =>
            total + asset.addresses.reduce((sum, addr) => sum + bigxnum2num(addr.balance, asset.price), 0), 0);
        // Update wallet view and close modal
        updateWalletView();
*/
        closeSendModal();
        document.getElementById('sendToAddress').value = '';
        document.getElementById('sendAmount').value = '';
        document.getElementById('sendMemo').value = '';
        const sendToAddressError = document.getElementById('sendToAddressError');
        if (sendToAddressError) {
            sendToAddressError.style.display = 'none';
        }
        // Add transaction to history
        const newTransaction = {
            txid: response.txid,
            amount: amount,
            sign: -1,
            timestamp: Date.now(),
            address: toAddress,
            memo: memo
        };
        fromAddress.history.unshift(newTransaction);
    } catch (error) {
        console.error('Transaction error:', error);
        alert('Transaction failed. Please try again.');
    }
}

function handleSignOut() {
    // Save myData to localStorage if it exists
    if (myData && myAccount) {
        localStorage.setItem(`${myAccount.username}_${myAccount.netid}`, stringify(myData));
    }

    // Close all modals
    document.getElementById('menuModal').classList.remove('active');
    document.getElementById('accountModal').classList.remove('active');
    
    // Hide header and footer
    document.getElementById('header').classList.remove('active');
    document.getElementById('footer').classList.remove('active');
    document.getElementById('newChatButton').classList.remove('visible');

    // Reset header text
    document.querySelector('.app-name').textContent = 'Liberdus';
    
    // Hide all app screens
    document.querySelectorAll('.app-screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show welcome screen
    document.getElementById('welcomeScreen').style.display = 'flex';
    
    // Reload the page to get fresh welcome page
    window.location.reload();
}

// Handle sending a message
async function handleSendMessage() {
    const messageInput = document.querySelector('.message-input');
    const message = messageInput.value.trim();
    if (!message) return;

    const modal = document.getElementById('chatModal');
    const modalTitle = modal.querySelector('.modal-title');
    const messagesList = modal.querySelector('.messages-list');

    // Get current chat data
    const chatsData = myData
/*
    const currentAddress = Object.values(chatsData.contacts).find(contact =>
        modalTitle.textContent === (contact.name || contact.username || `${contact.address.slice(0,8)}...${contact.address.slice(-6)}`)
    )?.address;
*/
    const currentAddress = appendChatModal.address
    if (!currentAddress) return;

    // Get sender's keys from wallet
    const keys = myAccount.keys;
    if (!keys) {
        alert('Keys not found for sender address');
        return;
    }

    // Get recipient's public key from contacts
    let recipientPubKey = myData.contacts[currentAddress]?.keys?.public;
    if (!recipientPubKey) {
        const recipientInfo = await queryNetwork(`/account/${longAddress(currentAddress)}`)
        if (!recipientInfo?.account?.publicKey){
            console.log(`no public key found for recipient ${currentAddress}`)
            return
        }
        recipientPubKey = recipientInfo.account.publicKey
        myData.contacts[currentAddress].public = recipientPubKey
    }
    
    // Generate shared secret using ECDH and take first 32 bytes
    const dhkey = secp.getSharedSecret(
        hex2bin(keys.secret),
        hex2bin(recipientPubKey)
    ).slice(1, 33);

    // We purposely do not encrypt/decrypt using browser native crypto functions; all crypto functions must be readable
    // Encrypt message using shared secret
    const encMessage = encryptChacha(dhkey, message)

    try {
        // Create sender info object
        const senderInfo = {
            username: myAccount.username,
            name: myData.account.name,
            email: myData.account.email,
            phone: myData.account.phone,
            linkedin: myData.account.linkedin,
            x: myData.account.x
        };

        // Encrypt sender info
        const encSenderInfo = encryptChacha(dhkey, stringify(senderInfo));

        // Create message payload
        const payload = {
            message: encMessage,
            senderInfo: encSenderInfo,
            encrypted: true,
            encryptionMethod: 'xchacha20poly1305',
            sent_timestamp: Date.now()
        };
//console.log('payload is', payload)
        // Send the message transaction using postSendMessage with default toll of 1
        const response = await postSendMessage(currentAddress, payload, 1, keys);
        
        if (!response || !response.result || !response.result.success) {
            alert('Message failed to send: ' + (response.result?.reason || 'Unknown error'));
            return;
        }

        // Create new message
        const newMessage = {
            message,
            timestamp: Date.now(),
            sent_timestamp: Date.now(),
            my: true
        };

        // Update contacts messages
        if (!chatsData.contacts[currentAddress].messages) {
            createNewContact(currentAddress)
//            chatsData.contacts[currentAddress].messages = [];
        }
        chatsData.contacts[currentAddress].messages.push(newMessage);

        // Update or add to chats list
        const existingChatIndex = chatsData.chats.findIndex(chat => chat.address === currentAddress);
        const chatUpdate = {
            address: currentAddress,
            timestamp: newMessage.timestamp,
        };

        // Remove existing chat if present
        if (existingChatIndex !== -1) {
            chatsData.chats.splice(existingChatIndex, 1);
        }
        // Add updated chat to the beginning of the array
        chatsData.chats.unshift(chatUpdate);

        // Clear input and reset height
        messageInput.value = '';
        messageInput.style.height = '45px';

/*
        // Add message to UI
        messagesList.insertAdjacentHTML('beforeend', `
            <div class="message sent">
                <div class="message-content" style="white-space: pre-wrap">${message}</div>
                <div class="message-time">${formatTime(newMessage.timestamp)}</div>
            </div>
        `);
        // Scroll to bottom
        messagesList.parentElement.scrollTop = messagesList.parentElement.scrollHeight;
*/
        appendChatModal()

        // Scroll to bottom
        messagesList.parentElement.scrollTop = messagesList.parentElement.scrollHeight;

        // Update chat list if visible
        if (document.getElementById('chatsScreen').classList.contains('active')) {
            updateChatList();
        }
    } catch (error) {
        console.error('Message error:', error);
        alert('Failed to send message. Please try again.');
    }
}

// Update wallet view; refresh wallet
function updateWalletView() {
    const walletData = myData.wallet
    
    // Update total networth
    document.getElementById('walletTotalBalance').textContent = (walletData.networth || 0).toFixed(2);
    
    // Update assets list
    const assetsList = document.getElementById('assetsList');
    
    if (!Array.isArray(walletData.assets) || walletData.assets.length === 0) {
        assetsList.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 2rem; margin-bottom: 1rem"></div>
                <div style="font-weight: bold; margin-bottom: 0.5rem">No Assets Yet</div>
                <div>Your assets will appear here</div>
            </div>`;
        return;
    }
    
    assetsList.innerHTML = walletData.assets.map(asset => {
console.log('asset balance', asset, asset.balance)
        return `
            <div class="asset-item">
                <div class="asset-logo">${asset.symbol[0]}</div>
                <div class="asset-info">
                    <div class="asset-name">${asset.name}</div>
                    <div class="asset-symbol">${asset.symbol}</div>
                </div>
                <div class="asset-balance">${(Number(asset.balance)/Number(wei)).toPrecision(4)}</div>
            </div>
        `;
    }).join('');
}

function openHistoryModal() {
            const modal = document.getElementById('historyModal');
            modal.classList.add('active');
            
            // Get wallet data
            const walletData = myData.wallet

            const assetSelect = document.getElementById('historyAsset');
            
            // Check if we have any assets
            if (!walletData.assets || walletData.assets.length === 0) {
                assetSelect.innerHTML = '<option value="">No assets available</option>';
            } else {
                // Populate assets dropdown
                assetSelect.innerHTML = walletData.assets.map((asset, index) =>
                    `<option value="${index}">${asset.name} (${asset.symbol})</option>`
                ).join('');
            }
            
            // Update addresses for first asset
            updateHistoryAddresses();
        }

function closeHistoryModal() {
    document.getElementById('historyModal').classList.remove('active');
}

function updateHistoryAddresses() {
            const walletData = myData.wallet

            const assetIndex = document.getElementById('historyAsset').value;
            const addressSelect = document.getElementById('historyAddress');

            // Check if we have any assets
            if (!walletData.assets || walletData.assets.length === 0) {
                addressSelect.innerHTML = '<option value="">No addresses available</option>';
                updateTransactionHistory();
                return;
            }

            const asset = walletData.assets[assetIndex];
            
            // Check if asset exists and has addresses
            if (!asset || !asset.addresses || asset.addresses.length === 0) {
                addressSelect.innerHTML = '<option value="">No addresses available</option>';
                updateTransactionHistory();
                return;
            }
            
            // Populate addresses dropdown
            addressSelect.innerHTML = asset.addresses.map((addr, index) =>
                `<option value="${index}">${addr.address}</option>`
            ).join('');
            
            // Update transaction history
            updateTransactionHistory();
        }

function updateTransactionHistory() {
    const walletData = myData.wallet

    const assetIndex = document.getElementById('historyAsset').value;
    const addressIndex = document.getElementById('historyAddress').value;
    const transactionList = document.getElementById('transactionList');

    // Check if we have any assets
    if (!walletData.assets || walletData.assets.length === 0) {
        transactionList.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 2rem; margin-bottom: 1rem"></div>
                <div style="font-weight: bold; margin-bottom: 0.5rem">No Transactions</div>
                <div>Your transaction history will appear here</div>
            </div>`;
        return;
    }

    const asset = walletData.assets[assetIndex];
    
    // Check if asset exists and has addresses
    if (!asset || !asset.addresses || asset.addresses.length === 0) {
        transactionList.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 2rem; margin-bottom: 1rem"></div>
                <div style="font-weight: bold; margin-bottom: 0.5rem">No Transactions</div>
                <div>Your transaction history will appear here</div>
            </div>`;
        return;
    }

    const address = asset.addresses[addressIndex];
    if (!address || !address.history || address.history.length === 0) {
        transactionList.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 2rem; margin-bottom: 1rem"></div>
                <div style="font-weight: bold; margin-bottom: 0.5rem">No Transactions</div>
                <div>Your transaction history will appear here</div>
            </div>`;
        return;
    }
    
    transactionList.innerHTML = address.history.map(tx => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-type ${tx.sign === -1 ? 'send' : 'receive'}">
                    ${tx.sign === -1 ? '↑ Sent' : '↓ Received'}
                </div>
                <div class="transaction-amount">
                    ${tx.sign === -1 ? '-' : '+'} ${(Number(tx.amount)/Number(wei)).toPrecision(4)} ${asset.symbol}
                </div>
            </div>
            <div class="transaction-details">
                <div class="transaction-address">
                    ${tx.sign === -1 ? 'To: ' : 'From: '}${tx.address}
                </div>
                <div class="transaction-time">${formatTime(tx.timestamp)}</div>
            </div>
            ${tx.memo ? `<div class="transaction-memo">${tx.memo}</div>` : ''}
        </div>
    `).join('');
}

// Form to allow user to enter info about themself
function handleAccountUpdate(event) {
    event.preventDefault();

    // Get form data
    const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        linkedin: document.getElementById('linkedin').value,
        x: document.getElementById('x').value
    };

    // TODO massage the inputs and check for correct formats; for now assume it is all good

    // Save to myData.account
    myData.account = { ...myData.account, ...formData };

    // Show success message
    const successMessage = document.getElementById('successMessage');
    successMessage.classList.add('active');
    
    // Hide success message after 2 seconds
    setTimeout(() => {
        successMessage.classList.remove('active');
        closeAccountForm();
    }, 2000);
}

async function queryNetwork(url) {
//console.log('query', url)
    if (! checkOnlineStatus()){ 
//TODO show user we are not online
        console.log("not online")
        return null 
    }
    const randomGateway = network.gateways[Math.floor(Math.random() * network.gateways.length)];
    try {
        const response = await fetch(`${randomGateway.protocol}://${randomGateway.host}:${randomGateway.port}${url}`);
console.log('query', `${randomGateway.protocol}://${randomGateway.host}:${randomGateway.port}${url}`)
        const data = await response.json();
console.log('response', data)
        return data
    } catch (error) {
        console.error(`Error fetching balance for address ${addr.address}:`, error);
        return null
    }
}

async function pollChatInterval(milliseconds) {
    if (pollChats.timer){ clearTimeout(pollChats.timer); pollChats.timer = null }
    pollChats.nextPoll = milliseconds
    pollChats()
}

async function pollChats(){
    const now = Date.now()
    if (pollChats.lastPoll + pollChats.nextPoll > now){ return }
    updateChatList()
    pollChats.lastPoll = now
    if (pollChats.nextPoll < 100){ return } // can be used to stop polling; pollChatInterval(0)
    pollChats.timer = setTimeout(pollChats, pollChats.nextPoll)

}
pollChats.lastPoll = 0
pollChats.nextPoll = 10000   // milliseconds between polls
pollChats.timer = null

async function getChats(keys) {  // needs to return the number of chats that need to be processed
//console.log('keys', keys)
    if (! keys){ console.log('no keys in getChats'); return 0 }
    const now = Date.now()
    if (now - getChats.lastCall < 1000){ return 0 }
    getChats.lastCall = now
//console.log('address', keys)
//console.log('mydata', myData)
//console.log('contacts', myData.contacts[keys.address])
//console.log('messages', myData.contacts[keys.address].messages)
//console.log('last messages', myData.contacts[keys.address].messages.at(-1))
//console.log('timestamp', myData.contacts[keys.address].messages.at(-1).timestamp)
    const timestamp = keys.chatTimestamp || 0
//    const timestamp = myData.contacts[keys.address]?.messages?.at(-1).timestamp || 0

    const senders = await queryNetwork(`/account/${longAddress(keys.address)}/chats/${timestamp}`) // TODO get this working
//    const senders = await queryNetwork(`/account/${longAddress(keys.address)}/chats/0`) // TODO stop using this
    const chatCount = Object.keys(senders.chats).length
console.log('getChats senders', timestamp, chatCount, senders)
    if (senders && senders.chats && chatCount){     // TODO check if above is working
        await processChats(senders.chats, keys)
    }
    return chatCount
}
getChats.lastCall = 0

async function processChats(chats, keys) {
    for (let sender in chats) {
        const timestamp = keys.chatTimestamp || 0
        const res = await queryNetwork(`/messages/${chats[sender]}/${timestamp}`)
console.log("processChats sender", sender)
        if (res && res.messages){  // TDDO the messages are actually the whole tx
            const from = normalizeAddress(sender)
            if (!myData.contacts[from]){ createNewContact(from) }
            const contact = myData.contacts[from]
            contact.address = from
            let added = 0
            let newTimestamp = 0
            for (let index in res.messages){
                newTimestamp = res.messages[index].timestamp > newTimestamp ? res.messages[index].timestamp : newTimestamp
                if (res.messages[index].from == longAddress(keys.address)){ continue }  // skip if the message is from us
                const payload = parse(res.messages[index].message)  // changed to use .message
                if (payload.encrypted){ 
                    let senderPublic = myData.contacts[from]?.public
                    if (!senderPublic){
                        const senderInfo = await queryNetwork(`/account/${longAddress(from)}`)
//console.log('senderInfo.account', senderInfo.account)
                        if (!senderInfo?.account?.publicKey){
                            console.log(`no public key found for sender ${sender}`)
                            continue
                        }
                        senderPublic = senderInfo.account.publicKey
                        if (myData.contacts[from]){
                            myData.contacts[from].public = senderPublic
                        }
                    }
                    payload.public = senderPublic
                }
//console.log("payload", payload)
                decryptMessage(payload, keys)  // modifies the payload object
                if (payload.senderInfo){
                    contact.senderInfo = JSON.parse(JSON.stringify(payload.senderInfo))  // make a copy
                    delete payload.senderInfo
                    if (! contact.username && contact.senderInfo.username){
                        // TODO check the network to see if the username given with the message maps to the address of this contact
                        contact.username = contact.senderInfo.username
                    }
                }
//console.log('contact.message', contact.messages)
                if ((contact.messages.length == 0) || (contact.messages.at(-1).sent_timestamp < payload.sent_timestamp)){
                    payload.my = false
                    payload.timestamp = Date.now()
                    contact.messages.push(payload)
                    added += 1
                }    
            }
            if (newTimestamp > 0){
                // Update the timestamp
                keys.chatTimestamp = newTimestamp
            }
            // If messages were added to contact.messages, update myData.chats
            if (added > 0) {
                // Update the timestamp
                keys.chatTimestamp = newTimestamp

                // Get the most recent message
                const latestMessage = contact.messages[contact.messages.length - 1];
                
                // Create chat object with only guaranteed fields
                const chatUpdate = {
                    address: from,
                    timestamp: latestMessage.timestamp,
                };

                contact.unread += added;  // setting this will show a unread bubble count

                // Remove existing chat for this contact if it exists
                const existingChatIndex = myData.chats.findIndex(chat => chat.address === from);
                if (existingChatIndex !== -1) {
                    myData.chats.splice(existingChatIndex, 1);
                }

                // Find insertion point to maintain timestamp order (newest first)
                const insertIndex = myData.chats.findIndex(chat => chat.timestamp < chatUpdate.timestamp);
                
                if (insertIndex === -1) {
                    // If no earlier timestamp found, append to end
                    myData.chats.push(chatUpdate);
                } else {
                    // Insert at correct position to maintain order
                    myData.chats.splice(insertIndex, 0, chatUpdate);
                }
            }
        }
    }
}

// We purposely do not encrypt/decrypt using browser native crypto functions; all crypto functions must be readable
async function decryptMessage(payload, keys){
    if (payload.encrypted) {
        // Generate shared secret using ECDH
        const dhkey = secp.getSharedSecret(
            hex2bin(keys.secret),
            hex2bin(payload.public)
        ).slice(1, 33);
        
        // Decrypt based on encryption method
        if (payload.encryptionMethod === 'xchacha20poly1305') {
            try {
                payload.message = decryptChacha(dhkey, payload.message);
                if (payload.message == null){ payload.message = 'Decryption failed.'}
            } catch (error) {
                console.error('xchacha20poly1305 decryption failed:', error);
                payload.message = 'Decryption failed';
            }
            if (payload.senderInfo) {
                try {
                    payload.senderInfo = parse(decryptChacha(dhkey, payload.senderInfo));
                } catch (error) {
                    console.error('xchacha20poly1305 senderInfo decryption failed:', error);
                    payload.senderInfo = {username:'decryption_failed'}
                }
            }
        } else {
            console.error('Unknown encryption method:', payload.encryptionMethod);
            payload.message = 'Unsupported encryption';
        }
    }
    delete payload.encrypted;
    delete payload.encryptionMethod;
    delete payload.public;
    return payload;
}


async function postSendMessage(to, payload, toll, keys) {
    const toAddr = longAddress(to);
    const fromAddr = longAddress(keys.address)

    const tx = {
        type: 'message',
        from: fromAddr,
        to: toAddr,
        amount: BigInt(toll),
        chatId: blake.blake2bHex([fromAddr, toAddr].sort().join``, myHashKey, 32),
        message: stringify(payload),
        timestamp: Date.now(),
        network: '0000000000000000000000000000000000000000000000000000000000000000',
//                fee: BigInt(parameters.current.transactionFee || 1)           // TODO we should also add a fee
    }
    const res = await injectTx(tx, keys)
//console.log('res', res)
    return res        
}

async function postTransferAsset(to, amount, memo, keys) {
    // Normalize destination address if it's in Ethereum format
    const normalizedTo = to.startsWith('0x') ? normalizeAddress(to) : to;
    
    const tx = {
        type: 'transfer',
        from: longAddress(keys.address),
        to: longAddress(normalizedTo),
        amount: BigInt(amount),
//                memo: memo,                      // TODO encrypt the memo
        timestamp: Date.now(),
        network: '0000000000000000000000000000000000000000000000000000000000000000',
        fee: BigInt(parameters.current.transactionFee || 1)           
    }
    const res = await injectTx(tx, keys)
    return res
}

// TODO - backend - when account is being registered, ensure that loserCase(alias)=alias and hash(alias)==aliasHash 
async function postRegisterAlias(alias, keys){
    const aliasBytes = utf82bin(alias)
    const aliasHash = blake.blake2bHex(aliasBytes, myHashKey, 32)
    const tx = {
        type: 'register',
        aliasHash: aliasHash,
        from: longAddress(keys.address),
        alias: alias,
        publicKey: keys.public,
        timestamp: Date.now()
    }
    const res = await injectTx(tx, keys)
    return res
}

async function injectTx(tx, keys){
    const txid = await signObj(tx, keys)  // add the sign obj to tx
    // Get random gateway
    const randomGateway = network.gateways[Math.floor(Math.random() * network.gateways.length)];
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: stringify({tx: stringify(tx)})
    }
    try {
        const response = await fetch(`${randomGateway.protocol}://${randomGateway.host}:${randomGateway.port}/inject`, options);
        const data = await response.json();     
        data.txid = txid           
        return data
    } catch (error) {
        console.error('Error injecting tx:', error, tx);
        return error;
    }
}

async function signObj(tx, keys){
    const jstr = stringify(tx)
//console.log('tx stringify', jstr)
    const jstrBytes = utf82bin(jstr)
    const txidHex = blake.blake2bHex(jstrBytes, myHashKey, 32)
    const txidHashHex = ethHashMessage(txidHex)     // Asked Thant why we are doing this; 
                                                    //  why hash txid with ethHashMessage again before signing
                                                    //  why not just sign the original txid
                                                    // https://discord.com/channels/746426387606274199/1303158886089359431/1329097165137772574

    const sig = await secp.signAsync(hex2bin(txidHashHex), hex2bin(keys.secret))
    const r = sig.r.toString(16).padStart(64, '0');
    const s = sig.s.toString(16).padStart(64, '0');
    // Convert recovery to hex and append (27 + recovery)
    const v = (27 + sig.recovery).toString(16).padStart(2, '0');
    // Concatenate everything with 0x prefix
    const flatSignature = `0x${r}${s}${v}`;
    tx.sign = {
        owner: longAddress(keys.address),
        sig: flatSignature
    }
    return txidHex
}

// Based on what ethers.js is doing in the following code
// hashMessage() https://github.com/ethers-io/ethers.js/blob/22c081e1cd617b43d267fd4b29cd92ada5fc7e43/src.ts/hash/message.ts#L35
// concat() https://github.com/ethers-io/ethers.js/blob/22c081e1cd617b43d267fd4b29cd92ada5fc7e43/src.ts/utils/data.ts#L116
// MessagePrefix https://github.com/ethers-io/ethers.js/blob/22c081e1cd617b43d267fd4b29cd92ada5fc7e43/src.ts/constants/strings.ts#L16
// keccak256 https://github.com/ethers-io/ethers.js/blob/22c081e1cd617b43d267fd4b29cd92ada5fc7e43/src.ts/crypto/keccak.ts#L44
// input message can be string or binary; output is hex; binary means Uint8Array
function ethHashMessage(message){
    if (typeof(message) === "string") { message = utf82bin(message); }
    const MessagePrefix = "\x19Ethereum Signed Message:\n"
    const str = bin2hex(utf82bin(MessagePrefix)) + bin2hex(utf82bin(String(message.length))) + bin2hex(message)
    return bin2hex(keccak256(hex2bin(str)))
}

// key is binary, data is string, output is base64
function encryptChacha(key, data) {
    const nonce = window.crypto.getRandomValues(new Uint8Array(24))
    const cipher = xchacha20poly1305(key, nonce);
    const encrypted = cipher.encrypt(utf82bin(data));
    
    // Combine nonce + encrypted data (which includes authentication tag)
    const combined = new Uint8Array(nonce.length + encrypted.length);
    combined.set(nonce);
    combined.set(encrypted, nonce.length);
    
    return bin2base64(combined);
}

// key is binary, encrypted is base64, output is string
function decryptChacha(key, encrypted) {
    try {
        // Convert from base64
        const combined = base642bin(encrypted);
        
        // Extract nonce (first 24 bytes) and encrypted data
        const nonce = combined.slice(0, 24);
        const data = combined.slice(24);
        
        const cipher = xchacha20poly1305(key, nonce);
        const decrypted = cipher.decrypt(data);
        return bin2utf8(decrypted);
    } catch (error) {
        console.log('Decryption failed: message authentication failed or corrupted data', error);
        return null
    }
}



        