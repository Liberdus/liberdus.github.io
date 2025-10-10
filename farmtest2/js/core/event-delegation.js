/**
 * EventDelegation - Efficient event handling system with delegation
 * Features: Event delegation, performance optimization, memory leak prevention
 * Provides centralized event management for all application components
 */
class EventDelegation {
    constructor() {
        // Event storage
        this.delegatedEvents = new Map();
        this.directEvents = new Map();
        this.eventHandlers = new Map();
        
        // Performance optimization
        this.throttledEvents = new Set(['scroll', 'resize', 'mousemove', 'touchmove']);
        this.debouncedEvents = new Set(['input', 'keyup', 'search']);
        this.passiveEvents = new Set(['scroll', 'wheel', 'touchstart', 'touchmove']);
        
        // Event delegation root
        this.delegationRoot = document.body;
        this.isInitialized = false;
        
        // Throttle and debounce caches
        this.throttleCache = new Map();
        this.debounceCache = new Map();
        
        // Statistics
        this.stats = {
            delegatedEventCount: 0,
            directEventCount: 0,
            handlerExecutions: 0,
            preventedEvents: 0
        };
        
        // Bind methods
        this.delegate = this.delegate.bind(this);
        this.undelegate = this.undelegate.bind(this);
        this.addEventListener = this.addEventListener.bind(this);
        this.removeEventListener = this.removeEventListener.bind(this);
        this.handleDelegatedEvent = this.handleDelegatedEvent.bind(this);
        
        this.initialize();
    }

    /**
     * Initialize event delegation system
     */
    initialize() {
        if (this.isInitialized) return;
        
        // Set up delegation for common events
        const commonEvents = [
            'click', 'dblclick', 'mousedown', 'mouseup', 'mouseover', 'mouseout',
            'keydown', 'keyup', 'keypress', 'input', 'change', 'submit', 'focus', 'blur'
        ];
        
        for (const eventType of commonEvents) {
            this.setupDelegation(eventType);
        }
        
        this.isInitialized = true;
        this.log('EventDelegation system initialized');
    }

    /**
     * Set up event delegation for a specific event type
     */
    setupDelegation(eventType) {
        if (this.delegatedEvents.has(eventType)) return;
        
        const options = this.passiveEvents.has(eventType) ? { passive: true } : false;
        
        this.delegationRoot.addEventListener(eventType, this.handleDelegatedEvent, options);
        this.delegatedEvents.set(eventType, new Map());
        
        this.log(`Event delegation set up for: ${eventType}`);
    }

    /**
     * Handle delegated events
     */
    handleDelegatedEvent(event) {
        const eventType = event.type;
        const handlers = this.delegatedEvents.get(eventType);
        
        if (!handlers || handlers.size === 0) return;
        
        let target = event.target;
        
        // Traverse up the DOM tree to find matching selectors
        while (target && target !== this.delegationRoot) {
            for (const [selector, handlerMap] of handlers) {
                if (target.matches && target.matches(selector)) {
                    for (const [handlerId, handlerInfo] of handlerMap) {
                        try {
                            this.executeHandler(handlerInfo, event, target);
                        } catch (error) {
                            this.error(`Error in delegated event handler ${handlerId}:`, error);
                        }
                    }
                }
            }
            target = target.parentElement;
        }
    }

    /**
     * Execute event handler with performance optimizations
     */
    executeHandler(handlerInfo, event, target) {
        const { handler, options, component } = handlerInfo;
        
        // Check if component is still active
        if (component && component.isDestroyed) {
            return;
        }
        
        // Apply throttling if needed
        if (this.throttledEvents.has(event.type) && options.throttle !== false) {
            const throttleKey = `${handlerInfo.id}_${event.type}`;
            if (this.isThrottled(throttleKey, options.throttleDelay || 16)) {
                return;
            }
        }
        
        // Apply debouncing if needed
        if (this.debouncedEvents.has(event.type) && options.debounce !== false) {
            const debounceKey = `${handlerInfo.id}_${event.type}`;
            this.debounce(debounceKey, () => {
                this.callHandler(handler, event, target, component);
            }, options.debounceDelay || 300);
            return;
        }
        
        // Execute handler immediately
        this.callHandler(handler, event, target, component);
    }

    /**
     * Call event handler with proper context
     */
    callHandler(handler, event, target, component) {
        this.stats.handlerExecutions++;
        
        try {
            if (component) {
                handler.call(component, event, target);
            } else {
                handler(event, target);
            }
        } catch (error) {
            this.error('Error in event handler:', error);
        }
    }

    /**
     * Delegate event with selector
     */
    delegate(eventType, selector, handler, options = {}) {
        if (!eventType || !selector || typeof handler !== 'function') {
            throw new Error('Invalid parameters for event delegation');
        }
        
        // Set up delegation for this event type if not already done
        this.setupDelegation(eventType);
        
        const handlers = this.delegatedEvents.get(eventType);
        
        // Create handler map for this selector if it doesn't exist
        if (!handlers.has(selector)) {
            handlers.set(selector, new Map());
        }
        
        const selectorHandlers = handlers.get(selector);
        const handlerId = this.generateHandlerId();
        
        const handlerInfo = {
            id: handlerId,
            handler,
            options,
            component: options.component || null,
            createdAt: Date.now()
        };
        
        selectorHandlers.set(handlerId, handlerInfo);
        this.stats.delegatedEventCount++;
        
        this.log(`Event delegated: ${eventType} on ${selector} (${handlerId})`);
        return handlerId;
    }

    /**
     * Remove delegated event handler
     */
    undelegate(eventType, selector, handlerId = null) {
        const handlers = this.delegatedEvents.get(eventType);
        if (!handlers) return false;
        
        const selectorHandlers = handlers.get(selector);
        if (!selectorHandlers) return false;
        
        if (handlerId) {
            // Remove specific handler
            const removed = selectorHandlers.delete(handlerId);
            if (removed) {
                this.stats.delegatedEventCount--;
                this.log(`Event handler removed: ${handlerId}`);
            }
            return removed;
        } else {
            // Remove all handlers for this selector
            const count = selectorHandlers.size;
            selectorHandlers.clear();
            this.stats.delegatedEventCount -= count;
            this.log(`All event handlers removed for: ${eventType} on ${selector}`);
            return count > 0;
        }
    }

    /**
     * Add direct event listener (non-delegated)
     */
    addEventListener(element, eventType, handler, options = {}) {
        if (!element || !eventType || typeof handler !== 'function') {
            throw new Error('Invalid parameters for addEventListener');
        }
        
        const handlerId = this.generateHandlerId();
        const eventOptions = this.getEventOptions(eventType, options);
        
        // Wrap handler for performance optimizations
        const wrappedHandler = this.wrapHandler(handler, eventType, options, handlerId);
        
        element.addEventListener(eventType, wrappedHandler, eventOptions);
        
        // Store handler info for cleanup
        if (!this.directEvents.has(element)) {
            this.directEvents.set(element, new Map());
        }
        
        const elementEvents = this.directEvents.get(element);
        if (!elementEvents.has(eventType)) {
            elementEvents.set(eventType, new Map());
        }
        
        elementEvents.get(eventType).set(handlerId, {
            handler: wrappedHandler,
            originalHandler: handler,
            options: eventOptions,
            component: options.component || null
        });
        
        this.stats.directEventCount++;
        this.log(`Direct event listener added: ${eventType} (${handlerId})`);
        
        return handlerId;
    }

    /**
     * Remove direct event listener
     */
    removeEventListener(element, eventType, handlerId = null) {
        const elementEvents = this.directEvents.get(element);
        if (!elementEvents) return false;
        
        const typeEvents = elementEvents.get(eventType);
        if (!typeEvents) return false;
        
        if (handlerId) {
            // Remove specific handler
            const handlerInfo = typeEvents.get(handlerId);
            if (handlerInfo) {
                element.removeEventListener(eventType, handlerInfo.handler, handlerInfo.options);
                typeEvents.delete(handlerId);
                this.stats.directEventCount--;
                this.log(`Direct event listener removed: ${handlerId}`);
                return true;
            }
        } else {
            // Remove all handlers for this event type
            let count = 0;
            for (const [id, handlerInfo] of typeEvents) {
                element.removeEventListener(eventType, handlerInfo.handler, handlerInfo.options);
                count++;
            }
            typeEvents.clear();
            this.stats.directEventCount -= count;
            this.log(`All direct event listeners removed for: ${eventType}`);
            return count > 0;
        }
        
        return false;
    }

    /**
     * Wrap handler with performance optimizations
     */
    wrapHandler(handler, eventType, options, handlerId) {
        return (event) => {
            // Check throttling
            if (this.throttledEvents.has(eventType) && options.throttle !== false) {
                const throttleKey = `${handlerId}_${eventType}`;
                if (this.isThrottled(throttleKey, options.throttleDelay || 16)) {
                    return;
                }
            }
            
            // Check debouncing
            if (this.debouncedEvents.has(eventType) && options.debounce !== false) {
                const debounceKey = `${handlerId}_${eventType}`;
                this.debounce(debounceKey, () => {
                    this.callHandler(handler, event, event.target, options.component);
                }, options.debounceDelay || 300);
                return;
            }
            
            // Execute handler
            this.callHandler(handler, event, event.target, options.component);
        };
    }

    /**
     * Get event options with defaults
     */
    getEventOptions(eventType, options) {
        const eventOptions = { ...options };
        
        // Set passive for performance-sensitive events
        if (this.passiveEvents.has(eventType) && eventOptions.passive === undefined) {
            eventOptions.passive = true;
        }
        
        return eventOptions;
    }

    /**
     * Check if event is throttled
     */
    isThrottled(key, delay) {
        const now = Date.now();
        const lastExecution = this.throttleCache.get(key);
        
        if (!lastExecution || (now - lastExecution) >= delay) {
            this.throttleCache.set(key, now);
            return false;
        }
        
        return true;
    }

    /**
     * Debounce function execution
     */
    debounce(key, func, delay) {
        const existingTimeout = this.debounceCache.get(key);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }
        
        const timeout = setTimeout(() => {
            func();
            this.debounceCache.delete(key);
        }, delay);
        
        this.debounceCache.set(key, timeout);
    }

    /**
     * Generate unique handler ID
     */
    generateHandlerId() {
        return `handler_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Clean up all event listeners for a component
     */
    cleanupComponent(component) {
        if (!component) return;

        let cleanedCount = 0;

        // Clean up delegated events
        for (const [eventType, handlers] of this.delegatedEvents) {
            for (const [selector, selectorHandlers] of handlers) {
                const toRemove = [];
                for (const [handlerId, handlerInfo] of selectorHandlers) {
                    if (handlerInfo.component === component) {
                        toRemove.push(handlerId);
                    }
                }

                for (const handlerId of toRemove) {
                    selectorHandlers.delete(handlerId);
                    cleanedCount++;
                }
            }
        }

        // Clean up direct events
        for (const [element, elementEvents] of this.directEvents) {
            for (const [eventType, typeEvents] of elementEvents) {
                const toRemove = [];
                for (const [handlerId, handlerInfo] of typeEvents) {
                    if (handlerInfo.component === component) {
                        element.removeEventListener(eventType, handlerInfo.handler, handlerInfo.options);
                        toRemove.push(handlerId);
                    }
                }

                for (const handlerId of toRemove) {
                    typeEvents.delete(handlerId);
                    cleanedCount++;
                }
            }
        }

        this.stats.delegatedEventCount -= cleanedCount;
        this.log(`Cleaned up ${cleanedCount} event listeners for component`);
    }

    /**
     * Clean up all event listeners for an element
     */
    cleanupElement(element) {
        if (!element) return;

        const elementEvents = this.directEvents.get(element);
        if (!elementEvents) return;

        let cleanedCount = 0;

        for (const [eventType, typeEvents] of elementEvents) {
            for (const [handlerId, handlerInfo] of typeEvents) {
                element.removeEventListener(eventType, handlerInfo.handler, handlerInfo.options);
                cleanedCount++;
            }
        }

        this.directEvents.delete(element);
        this.stats.directEventCount -= cleanedCount;
        this.log(`Cleaned up ${cleanedCount} event listeners for element`);
    }

    /**
     * Get event statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            delegatedEventTypes: this.delegatedEvents.size,
            directEventElements: this.directEvents.size,
            throttleCacheSize: this.throttleCache.size,
            debounceCacheSize: this.debounceCache.size
        };
    }

    /**
     * Clear performance caches
     */
    clearCaches() {
        // Clear throttle cache
        this.throttleCache.clear();

        // Clear debounce cache and cancel pending timeouts
        for (const timeout of this.debounceCache.values()) {
            clearTimeout(timeout);
        }
        this.debounceCache.clear();

        this.log('Performance caches cleared');
    }

    /**
     * Trigger custom event
     */
    trigger(element, eventType, detail = null, options = {}) {
        if (!element || !eventType) return false;

        const event = new CustomEvent(eventType, {
            detail,
            bubbles: options.bubbles !== false,
            cancelable: options.cancelable !== false,
            ...options
        });

        return element.dispatchEvent(event);
    }

    /**
     * Create event listener with automatic cleanup
     */
    createManagedListener(element, eventType, handler, options = {}) {
        const handlerId = this.addEventListener(element, eventType, handler, options);

        // Return cleanup function
        return () => {
            this.removeEventListener(element, eventType, handlerId);
        };
    }

    /**
     * Batch event operations for performance
     */
    batch(operations) {
        const results = [];

        for (const operation of operations) {
            try {
                const result = operation();
                results.push(result);
            } catch (error) {
                this.error('Error in batch operation:', error);
                results.push(null);
            }
        }

        return results;
    }

    /**
     * Check if element has event listeners
     */
    hasEventListeners(element, eventType = null) {
        const elementEvents = this.directEvents.get(element);
        if (!elementEvents) return false;

        if (eventType) {
            const typeEvents = elementEvents.get(eventType);
            return typeEvents && typeEvents.size > 0;
        }

        return elementEvents.size > 0;
    }

    /**
     * Get all event listeners for an element
     */
    getEventListeners(element, eventType = null) {
        const elementEvents = this.directEvents.get(element);
        if (!elementEvents) return [];

        const listeners = [];

        if (eventType) {
            const typeEvents = elementEvents.get(eventType);
            if (typeEvents) {
                for (const [handlerId, handlerInfo] of typeEvents) {
                    listeners.push({
                        id: handlerId,
                        eventType,
                        handler: handlerInfo.originalHandler,
                        options: handlerInfo.options,
                        component: handlerInfo.component
                    });
                }
            }
        } else {
            for (const [type, typeEvents] of elementEvents) {
                for (const [handlerId, handlerInfo] of typeEvents) {
                    listeners.push({
                        id: handlerId,
                        eventType: type,
                        handler: handlerInfo.originalHandler,
                        options: handlerInfo.options,
                        component: handlerInfo.component
                    });
                }
            }
        }

        return listeners;
    }

    /**
     * Destroy event delegation system
     */
    destroy() {
        this.log('Destroying EventDelegation system...');

        // Remove all delegated event listeners
        for (const eventType of this.delegatedEvents.keys()) {
            this.delegationRoot.removeEventListener(eventType, this.handleDelegatedEvent);
        }

        // Remove all direct event listeners
        for (const [element, elementEvents] of this.directEvents) {
            this.cleanupElement(element);
        }

        // Clear all caches
        this.clearCaches();

        // Clear all storage
        this.delegatedEvents.clear();
        this.directEvents.clear();
        this.eventHandlers.clear();

        // Reset statistics
        this.stats = {
            delegatedEventCount: 0,
            directEventCount: 0,
            handlerExecutions: 0,
            preventedEvents: 0
        };

        this.isInitialized = false;
        this.log('EventDelegation system destroyed');
    }

    /**
     * Logging methods
     */
    log(message, ...args) {
        if (window.componentRegistry?.debugMode) {
            console.log(`[EventDelegation] ${message}`, ...args);
        }
    }

    warn(message, ...args) {
        if (window.componentRegistry?.debugMode) {
            console.warn(`[EventDelegation] ${message}`, ...args);
        }
    }

    error(message, ...args) {
        console.error(`[EventDelegation] ${message}`, ...args);
    }
}

// Create global instance
window.eventDelegation = new EventDelegation();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventDelegation;
}
