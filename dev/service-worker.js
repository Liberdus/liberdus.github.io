const SW_VERSION = '1.0.0';

// Simplified state management
const state = {
    pollInterval: null,
    timestamp: null,
    account: null,
    lastPollTime: 0,
    notifiedChats: new Set()
};

// Install event - set up any caching needed
self.addEventListener('install', (event) => {
    console.log('Service Worker installing, version:', SW_VERSION);
    
    // Skip waiting to become active immediately
    self.skipWaiting();
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating, version:', SW_VERSION);

    // Claim all clients immediately
    event.waitUntil(clients.claim());
});

// Message event - handle messages from the main thread
self.addEventListener('message', (event) => {
    const { type, timestamp, account } = event.data;
    
    switch (type) {
        case 'start_polling':
            state.timestamp = timestamp;
            state.account = account;
            startPolling();
            break;
        case 'stop_polling':
            stopPolling();
            break;
    }
});

function startPolling() {
    if (state.pollInterval) return;
    
    console.log('Starting message polling');
    state.pollInterval = setInterval(checkForNewMessages, 60000);
    checkForNewMessages();
}

function stopPolling() {
    if (state.pollInterval) {
        clearInterval(state.pollInterval);
        Object.assign(state, {
            pollInterval: null,
            timestamp: null,
            account: null,
            lastPollTime: 0,
            notifiedChats: new Set()
        });
        console.log('[Service Worker] Stopped message polling');
    }
}

// Utility function to ensure address is 64 characters
function longAddress(addr) {
    return addr.padEnd(64, '0');
}

async function checkForNewMessages() {
    try {
        if (!state.timestamp || !state.account) {
            console.log('❌ No poll timestamp or account data');
            return;
        }

        const { address, network } = state.account;
        if (!address || !network?.gateways?.length) {
            console.log('❌ Invalid account configuration');
            return;
        }

        // Get random gateway
        const gateway = network.gateways[Math.floor(Math.random() * network.gateways.length)];
        const paddedAddress = address.padEnd(64, '0');
        
        // Query for new messages
        const url = `${gateway.protocol}://${gateway.host}:${gateway.port}/account/${paddedAddress}/chats/${state.lastPollTime || state.timestamp}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Network response failed: ${response.status}`);

        const { chats } = await response.json();
        if (!chats) return;

        // Track new chats
        const newChats = new Set(
            Object.values(chats).filter(chatId => !state.notifiedChats.has(chatId))
        );

        if (newChats.size > 0) {
            await showNotification(newChats.size);
            newChats.forEach(chatId => state.notifiedChats.add(chatId));
            state.lastPollTime = parseInt(state.timestamp);
        }

    } catch (error) {
        console.error('❌ Error checking messages:', error);
    }
}

async function showNotification(chatCount) {
    if (self.Notification?.permission !== 'granted') return;

    try {
        const notificationText = chatCount === 1 
            ? 'You have new messages in a conversation'
            : `You have new messages in ${chatCount} conversations`;

        await self.registration.showNotification('New Messages', {
            body: notificationText,
            icon: './liberdus_logo_250.png',
            badge: './liberdus_logo_250.png',
            tag: 'new-messages',
            renotify: true
        });
        console.log('✅ Notification sent successfully');
    } catch (error) {
        console.error('❌ Error showing notification:', error);
    }
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    // Focus existing window or open new one
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            for (const client of clientList) {
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
