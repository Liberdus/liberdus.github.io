/**
 * Storage Manager Utility
 * Provides consistent local storage handling across the application
 */

class StorageManager {
    constructor(prefix = 'lpstaking_') {
        this.prefix = prefix;
        this.isAvailable = this.checkAvailability();
    }

    /**
     * Check if localStorage is available
     */
    checkAvailability() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            console.warn('localStorage not available:', e);
            return false;
        }
    }

    /**
     * Get prefixed key
     */
    getKey(key) {
        return this.prefix + key;
    }

    /**
     * Set item in storage
     */
    set(key, value) {
        if (!this.isAvailable) return false;
        
        try {
            const serializedValue = JSON.stringify(value);
            localStorage.setItem(this.getKey(key), serializedValue);
            return true;
        } catch (error) {
            console.error('Storage set error:', error);
            return false;
        }
    }

    /**
     * Get item from storage
     */
    get(key, defaultValue = null) {
        if (!this.isAvailable) return defaultValue;
        
        try {
            const item = localStorage.getItem(this.getKey(key));
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Storage get error:', error);
            return defaultValue;
        }
    }

    /**
     * Remove item from storage
     */
    remove(key) {
        if (!this.isAvailable) return false;
        
        try {
            localStorage.removeItem(this.getKey(key));
            return true;
        } catch (error) {
            console.error('Storage remove error:', error);
            return false;
        }
    }

    /**
     * Clear all items with prefix
     */
    clear() {
        if (!this.isAvailable) return false;
        
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    localStorage.removeItem(key);
                }
            });
            return true;
        } catch (error) {
            console.error('Storage clear error:', error);
            return false;
        }
    }

    /**
     * Get all keys with prefix
     */
    keys() {
        if (!this.isAvailable) return [];
        
        try {
            const keys = Object.keys(localStorage);
            return keys
                .filter(key => key.startsWith(this.prefix))
                .map(key => key.substring(this.prefix.length));
        } catch (error) {
            console.error('Storage keys error:', error);
            return [];
        }
    }

    /**
     * Check if key exists
     */
    has(key) {
        if (!this.isAvailable) return false;
        
        try {
            return localStorage.getItem(this.getKey(key)) !== null;
        } catch (error) {
            console.error('Storage has error:', error);
            return false;
        }
    }
}

// Global storage manager instance
window.StorageManager = StorageManager;
window.storageManager = new StorageManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
}
