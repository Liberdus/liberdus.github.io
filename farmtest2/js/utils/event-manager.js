/**
 * Event Manager Utility
 * Provides centralized event handling across the application
 */

class EventManager {
    constructor() {
        this.listeners = new Map();
        this.eventHistory = [];
        this.maxHistorySize = 100;
    }

    /**
     * Add event listener
     */
    on(eventName, callback, options = {}) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }
        
        const listener = {
            callback,
            once: options.once || false,
            id: Date.now() + Math.random()
        };
        
        this.listeners.get(eventName).push(listener);
        return listener.id;
    }

    /**
     * Add one-time event listener
     */
    once(eventName, callback) {
        return this.on(eventName, callback, { once: true });
    }

    /**
     * Remove event listener
     */
    off(eventName, listenerId) {
        if (!this.listeners.has(eventName)) return false;
        
        const listeners = this.listeners.get(eventName);
        const index = listeners.findIndex(l => l.id === listenerId);
        
        if (index !== -1) {
            listeners.splice(index, 1);
            return true;
        }
        
        return false;
    }

    /**
     * Emit event
     */
    emit(eventName, data = null) {
        // Add to history
        this.eventHistory.push({
            name: eventName,
            data,
            timestamp: Date.now()
        });
        
        // Limit history size
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }
        
        // Call listeners
        if (this.listeners.has(eventName)) {
            const listeners = this.listeners.get(eventName).slice(); // Copy array
            
            listeners.forEach(listener => {
                try {
                    listener.callback(data);
                    
                    // Remove one-time listeners
                    if (listener.once) {
                        this.off(eventName, listener.id);
                    }
                } catch (error) {
                    console.error(`Error in event listener for ${eventName}:`, error);
                }
            });
        }
        
        // Also emit to DOM
        document.dispatchEvent(new CustomEvent(eventName, { detail: data }));
    }

    /**
     * Remove all listeners for an event
     */
    removeAllListeners(eventName) {
        if (eventName) {
            this.listeners.delete(eventName);
        } else {
            this.listeners.clear();
        }
    }

    /**
     * Get event history
     */
    getHistory(eventName = null) {
        if (eventName) {
            return this.eventHistory.filter(event => event.name === eventName);
        }
        return this.eventHistory.slice();
    }
}

// Global event manager instance
window.EventManager = EventManager;
window.eventManager = new EventManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventManager;
}
