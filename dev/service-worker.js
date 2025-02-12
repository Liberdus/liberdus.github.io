const SW_VERSION = '1.0.0';

// Simplified state management
const state = {
    pollInterval: null,
    timestamp: null,
    account: null,
    lastPollTime: 0,
    notifiedChats: new Set()
};

// Add periodic sync support
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-messages') {
        console.log('📱 Periodic sync triggered for check-messages');
        event.waitUntil(checkForNewMessages());
    }
});

// Add background sync support as fallback
self.addEventListener('sync', (event) => {
    if (event.tag === 'check-messages') {
        console.log('📱 Background sync triggered for check-messages');
        event.waitUntil(checkForNewMessages());
    }
});

// Install event - set up any caching needed
self.addEventListener('install', (event) => {
    console.log('Service Worker installing, version:', SW_VERSION);
    
    // Skip waiting to become active immediately
    self.skipWaiting();
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating, version:', SW_VERSION);

    // Ensure service worker takes control immediately
    event.waitUntil(
        Promise.all([
            clients.claim(),
            // Enable navigation preload for better performance
            self.registration.navigationPreload?.enable()
        ])
    );
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
        // Try to recover state if needed
        if (!state.account) {
            console.log('📱 No account state, attempting recovery');
            const clients = await self.clients.matchAll();
            console.log('📱 Active clients:', clients.length);
            
            if (clients.length === 0) {
                try {
                    // Try to get from localStorage
                    const storedData = localStorage.getItem('lastAccountData');
                    if (storedData) {
                        state.account = JSON.parse(storedData);
                        state.timestamp = Date.now().toString();
                        console.log('📱 Recovered account data from localStorage');
                    } else {
                        console.log('❌ No stored account data found');
                    }
                } catch (error) {
                    console.error('❌ Failed to recover state from localStorage:', error);
                }
            }
        }

        if (!state.timestamp || !state.account) {
            console.log('❌ No poll timestamp or account data after recovery attempt');
            return;
        }

        const { address, network } = state.account;
        if (!address || !network?.gateways?.length) {
            console.log('❌ Invalid account configuration:', { hasAddress: !!address, hasGateways: !!network?.gateways?.length });
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
        // Direct platform detection using navigator.userAgent
        const userAgent = navigator.userAgent;
        console.log('📱 UserAgent:', userAgent);
        
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        console.log('📱 Platform detection:', { isMobile, userAgent });

        // Only show system notification on mobile
        if (isMobile) {
            console.log('📱 Showing mobile notification');
            const notificationText = chatCount === 1 
                ? 'You have new messages in a conversation'
                : `You have new messages in ${chatCount} conversations`;

            await self.registration.showNotification('New Messages', {
                body: notificationText,
                icon: './liberdus_logo_250.png',
                badge: './liberdus_logo_250.png',
                tag: 'new-messages',
                renotify: true,
                silent: false,
                vibrate: [200, 100, 200],
                sound: './noti.wav'
            });
        } else {
            // Only notify clients if we're on desktop
            console.log('🖥️ Delegating notification to desktop client');
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'new_notification',
                    chatCount,
                    timestamp: Date.now()
                });
            });
        }

    } catch (error) {
        console.error('❌ Error showing notification:', error);
    }
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    // Focus or open window based on context
    event.waitUntil(
        (async () => {
            try {
                const windowClient = await clients.matchAll({
                    type: 'window',
                    includeUncontrolled: true
                });

                // Check if we're running as PWA
                const isPWA = windowClient.some(client => 
                    client.url.includes(self.registration.scope) && 
                    client.frameType === 'top-level' &&
                    client.focused === false
                );

                // Try to focus existing window first
                for (const client of windowClient) {
                    if (client.url.includes(self.registration.scope)) {
                        await client.focus();
                        return;
                    }
                }

                // If no existing window, open new one
                // For PWA, use root path; for browser, use full URL
                const urlToOpen = isPWA ? '/dev' : self.registration.scope;
                await clients.openWindow(urlToOpen);

            } catch (error) {
                console.error('❌ Error handling notification click:', error);
                // Fallback to simple window open
                await clients.openWindow('/dev');
            }
        })()
    );
});
