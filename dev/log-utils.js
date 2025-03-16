/**
 * Logger utility for storing important application logs in IndexedDB
 * Usage:
 * - Store logs: Logger.log(), Logger.warn(), Logger.error()
 * - View logs: Logger.getLogs()
 * - Clear logs: Logger.clearLogs()
 * - Force save: Logger.forceSave()
 * 
 * Features:
 * - Batches and queues logs for efficient storage
 * - Auto-saves on errors, page unload, and visibility changes
 * - Handles service worker logs and lifecycle events
 * - Provides UI modal for viewing logs (up to 1000 entries)
 * 
 * Note: Use these methods only for logs you want to persist.
 * For debug-only logs, use console methods directly.
 */
class Logger {
  static DB_NAME = 'LoggerDB';
  static STORE_NAME = 'logs';
  static MAX_LOGS = 1000;
  static _db = null;
  static _lastTimestamp = 0;  // Track last used timestamp
  static _dbInitPromise = null; // Track ongoing initialization
  static _isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  static _isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                 window.navigator.standalone || // iOS
                 document.referrer.includes('android-app://');

  // In-memory queue configuration
  static _memoryQueue = [];
  static _flushInterval = null;
  static FLUSH_INTERVAL = this._isIOS ? 2000 : 5000;    // More frequent flushes on iOS
  static MAX_QUEUE_SIZE = this._isIOS ? 50 : 100;       // Smaller batches on iOS
  static _isFlushingQueue = false;

  static MAX_BATCH_SIZE = this._isIOS ? 25 : 50;        // Smaller batches on iOS
  static RETRY_DELAY = this._isIOS ? 500 : 1000;        // Faster retries on iOS
  static MAX_RETRIES = this._isIOS ? 5 : 3;            // More retries on iOS
  static _retryQueue = [];
  static _processingRetries = false;
  static _counter = 0;

  static async initDB() {
    // If initialization is in progress, wait for it
    if (this._dbInitPromise) {
      return this._dbInitPromise;
    }

    // Create new initialization promise
    this._dbInitPromise = (async () => {
      try {
        // First, try to delete any existing database to start fresh
        // This is the most reliable way to handle Firefox's IndexedDB quirks
        try {
          console.log('[Logger] Attempting to delete existing database...');
          await new Promise((resolve) => {
            const deleteRequest = indexedDB.deleteDatabase(this.DB_NAME);
            deleteRequest.onsuccess = () => {
              console.log('[Logger] Successfully deleted existing database');
              resolve();
            };
            deleteRequest.onerror = (event) => {
              console.warn('[Logger] Failed to delete database:', event.target.error);
              resolve(); // Continue anyway
            };
            deleteRequest.onblocked = () => {
              console.warn('[Logger] Delete blocked, continuing anyway');
              resolve();
            };
          });
        } catch (error) {
          console.warn('[Logger] Error during database reset:', error);
          // Continue anyway
        }

        // Wait a moment to ensure deletion completes
        await new Promise(resolve => setTimeout(resolve, 100));

        // Now create a fresh database
        const db = await new Promise((resolve, reject) => {
          console.log('[Logger] Creating new database...');
          const openRequest = indexedDB.open(this.DB_NAME, 1);
          
          openRequest.onerror = (event) => {
            console.error('[Logger] Database open error:', event.target.error);
            reject(event.target.error);
          };

          openRequest.onblocked = (event) => {
            console.warn('[Logger] Database open blocked, will retry');
            if (this._db) {
              this._db.close();
              this._db = null;
            }
          };

          openRequest.onupgradeneeded = (event) => {
            console.log('[Logger] Database upgrade needed, creating store');
            const db = event.target.result;
            
            try {
              // Always recreate store on upgrade for consistency
              if (db.objectStoreNames.contains(this.STORE_NAME)) {
                db.deleteObjectStore(this.STORE_NAME);
              }
              
              // Create new store
              const store = db.createObjectStore(this.STORE_NAME, { 
                keyPath: 'id'
              });
              store.createIndex('timestamp', 'timestamp', { unique: false });
              console.log('[Logger] Store created successfully during upgrade');
            } catch (error) {
              console.error('[Logger] Error creating store during upgrade:', error);
              // Don't reject here - let onsuccess handle verification
            }
          };

          openRequest.onsuccess = (event) => {
            try {
              const db = event.target.result;
              this._db = db;
              
              // iOS-specific error handling
              db.onversionchange = () => {
                db.close();
                this._db = null;
                this._dbInitPromise = null;
                console.log('[Logger] Database version changed, closing connection');
              };

              // Verify store exists
              if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                console.error('[Logger] Store missing after initialization');
                
                // Try to create the store directly if missing
                try {
                  db.close();
                  this._db = null;
                  
                  // Increment version and try again
                  const reopenRequest = indexedDB.open(this.DB_NAME, 2);
                  
                  reopenRequest.onupgradeneeded = (event) => {
                    console.log('[Logger] Retry creating store with version bump');
                    const db = event.target.result;
                    const store = db.createObjectStore(this.STORE_NAME, { 
                      keyPath: 'id'
                    });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                  };
                  
                  reopenRequest.onsuccess = (event) => {
                    const db = event.target.result;
                    if (db.objectStoreNames.contains(this.STORE_NAME)) {
                      console.log('[Logger] Store created successfully on retry');
                      this._db = db;
                      resolve(db);
                    } else {
                      console.error('[Logger] Store creation failed on retry');
                      db.close();
                      reject(new Error('Store creation failed on retry'));
                    }
                  };
                  
                  reopenRequest.onerror = (event) => {
                    console.error('[Logger] Retry open failed:', event.target.error);
                    reject(event.target.error);
                  };
                  
                  return; // Exit early, waiting for reopenRequest to complete
                } catch (retryError) {
                  console.error('[Logger] Store creation retry failed:', retryError);
                  db.close();
                  this._db = null;
                  reject(new Error('Store creation retry failed'));
                  return;
                }
              }
              
              console.log('[Logger] Database initialized successfully');
              resolve(db);
            } catch (error) {
              console.error('[Logger] Error in onsuccess handler:', error);
              reject(error);
            }
          };
        });

        // Set up periodic flush with iOS-specific handling
        if (!this._flushInterval) {
          this._flushInterval = setInterval(() => {
            this.flushQueue().catch(error => {
              if (this._isIOS && this._isPWA) {
                // On iOS PWA, reset database on serious errors
                if (error.name === 'InvalidStateError' || error.name === 'NotFoundError') {
                  this._db = null;
                  this._dbInitPromise = null;
                }
              }
              console.error('[Logger] Periodic flush failed:', error);
            });
          }, this.FLUSH_INTERVAL);
        }

        // iOS PWA specific visibility change handling
        if (this._isIOS && this._isPWA && typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
              // Force immediate flush on iOS PWA when app goes to background
              this.forceSave().catch(error => {
                console.error('[Logger] iOS PWA background flush failed:', error);
              });
            } else if (document.visibilityState === 'visible') {
              // Reinitialize database when app comes to foreground
              this._db = null;
              this._dbInitPromise = null;
            }
          });
        }

        return db;
      } catch (error) {
        console.error('[Logger] Database initialization failed:', error);
        this._dbInitPromise = null; // Clear failed initialization
        
        // Create a fallback in-memory store
        console.log('[Logger] Setting up in-memory fallback');
        this._useMemoryFallback = true;
        
        // Reject with the original error
        throw error;
      }
    })();

    return this._dbInitPromise;
  }

  static async getDB() {
    try {
      // If we're using memory fallback, don't try to get a real DB
      if (this._useMemoryFallback) {
        return null;
      }
      
      if (!this._db) {
        await this.initDB();
      }
      
      // Double check store exists
      if (this._db && !this._db.objectStoreNames.contains(this.STORE_NAME)) {
        console.warn('[Logger] Store missing after init, reinitializing...');
        this._db.close();
        this._db = null;
        this._dbInitPromise = null;
        await this.initDB();
      }
      
      return this._db;
    } catch (error) {
      console.error('[Logger] getDB failed:', error);
      this._useMemoryFallback = true;
      return null;
    }
  }

  static async flushQueue(force = false) {
    // Skip if queue is empty or already flushing
    if (this._memoryQueue.length === 0 || this._isFlushingQueue) return;
    
    this._isFlushingQueue = true;
    let logsToSave;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    
    try {
      // If we're in memory fallback mode, just clear the queue
      if (this._useMemoryFallback) {
        // In memory fallback mode, we just keep the most recent logs
        if (this._memoryQueue.length > this.MAX_LOGS) {
          this._memoryQueue = this._memoryQueue.slice(-this.MAX_LOGS);
        }
        this._isFlushingQueue = false;
        return;
      }
      
      while (retryCount < MAX_RETRIES) {
        try {
          const db = await this.getDB();
          
          // If getDB returned null, we're in fallback mode
          if (!db) {
            this._useMemoryFallback = true;
            break;
          }
          
          // Verify store exists before attempting transaction
          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            throw new Error('Logs store not found');
          }
          
          const tx = db.transaction(this.STORE_NAME, 'readwrite');
          const store = tx.objectStore(this.STORE_NAME);

          // Process logs in smaller batches
          while (this._memoryQueue.length > 0) {
            // Take a batch of logs
            logsToSave = this._memoryQueue.splice(0, this.MAX_BATCH_SIZE);

            // Save batch
            const addPromises = logsToSave.map(log => 
              new Promise((resolve, reject) => {
                const request = store.add(log);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
              })
            );

            try {
              await Promise.all(addPromises);
            } catch (error) {
              // Add failed logs to retry queue
              this._retryQueue.push(...logsToSave);
              this.scheduleRetry();
              throw error;
            }
          }

          // Wait for transaction to complete
          await new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          });
          
          // Success - exit retry loop
          break;

        } catch (error) {
          console.error(`[Logger] Failed to flush log queue (attempt ${retryCount + 1}):`, error);
          retryCount++;
          
          if (error.message === 'Logs store not found') {
            // Try reinitializing database
            if (this._db) {
              this._db.close();
            }
            this._db = null;
            this._dbInitPromise = null;
            try {
              await this.initDB();
            } catch (initError) {
              console.error('[Logger] Reinitialization failed:', initError);
              this._useMemoryFallback = true;
              break;
            }
          }
          
          // Put logs back in queue if save failed and not force flushing
          if (!force && logsToSave && retryCount === MAX_RETRIES) {
            this._memoryQueue.unshift(...logsToSave);
          }
          
          // Wait before retrying
          if (retryCount < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }
    } catch (error) {
      console.error('[Logger] Unexpected error in flushQueue:', error);
      // Put logs back in queue if save failed and not force flushing
      if (!force && logsToSave) {
        this._memoryQueue.unshift(...logsToSave);
      }
    } finally {
      this._isFlushingQueue = false;
    }
  }

  static async scheduleRetry() {
    if (this._processingRetries) return;
    
    this._processingRetries = true;
    let retryCount = 0;

    while (this._retryQueue.length > 0 && retryCount < this.MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
      
      try {
        const db = await this.getDB();
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);

        // Process retry queue in batches
        while (this._retryQueue.length > 0) {
          const batch = this._retryQueue.splice(0, this.MAX_BATCH_SIZE);
          const promises = batch.map(log => 
            new Promise((resolve, reject) => {
              const request = store.add(log);
              request.onsuccess = () => resolve();
              request.onerror = () => reject(request.error);
            })
          );

          await Promise.all(promises);
        }

        break; // Success - exit retry loop
      } catch (error) {
        retryCount++;
        if (retryCount >= this.MAX_RETRIES) {
          console.error('Max retries reached, some logs may be lost:', error);
        }
      }
    }

    this._processingRetries = false;
  }

  static generateUniqueId() {
    const timestamp = Date.now();
    const counter = (this._counter = (this._counter + 1) % 1000); // Reset at 1000 to keep IDs manageable
    const random = Math.floor(Math.random() * 1000); // Add random component
    return `${timestamp}-${counter.toString().padStart(3, '0')}-${random.toString().padStart(3, '0')}`;
  }

  static queueLog(level, messages, source) {
    const logEntry = {
      id: this.generateUniqueId(),  // Add unique id
      timestamp: Date.now(),
      level,
      message: messages,
      source
    };

    // Add to memory queue
    this._memoryQueue.push(logEntry);

    // Schedule immediate flush for errors
    if (level === 'error') {
      this.flushQueue(true);
      return;
    }

    // Schedule flush if queue is getting full
    if (this._memoryQueue.length >= this.MAX_QUEUE_SIZE) {
      this.flushQueue();
      return;
    }

    // If no flush is scheduled, schedule one
    if (this._flushInterval === null) {
      this._flushInterval = setInterval(() => {
        this.flushQueue();
      }, this.FLUSH_INTERVAL);
    }
  }

  static async getLogs() {
    // Force flush any pending logs
    await this.flushQueue(true);
    
    try {
      const db = await this.getDB();
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      
      // Use getAll() which returns records in insertion order
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get logs:', error);
      return [];
    }
  }

  static async clearLogs() {
    // Clear memory queue first
    this._memoryQueue = [];
    try {
      const db = await this.getDB();
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      await store.clear();
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

  // Update forceSave to handle retry queue
  static async forceSave() {
    try {
      // Clear any existing flush interval
      if (this._flushInterval) {
        clearInterval(this._flushInterval);
        this._flushInterval = null;
      }

      // Special handling for iOS PWA
      if (this._isIOS && this._isPWA) {
        // Force immediate flush with no retries
        await this.flushQueue(true);
        
        // Close and null the database connection
        if (this._db) {
          this._db.close();
          this._db = null;
        }
        this._dbInitPromise = null;
      } else {
        // Normal forceSave behavior
        await this.flushQueue(true);
        
        // Try to save any remaining retry queue items
        if (this._retryQueue.length > 0) {
          await this.scheduleRetry();
        }
      }
    } catch (error) {
      console.error('[Logger] Force save failed:', error);
      // Don't rethrow - we want to continue cleanup
    }
  }

  static async saveState() {
    // Force save any pending logs
    await this.flushQueue(true);
  }

  // New direct logging methods
  static log(...args) {
    const processedArgs = args.map(processValue);
    const source = getCurrentSource();
    this.queueLog('info', processedArgs, source);
  }

  static warn(...args) {
    const processedArgs = args.map(processValue);
    const source = getCurrentSource();
    this.queueLog('warn', processedArgs, source);
  }

  static error(...args) {
    const processedArgs = args.map(processValue);
    const source = getCurrentSource();
    this.queueLog('error', processedArgs, source);
  }
}

// Shared processing function
const processValue = (arg) => {
  if (arg === undefined) return '"undefined"';
  if (arg === null) return '"null"';
  if (arg === '') return '""';
  if (typeof arg === 'object') {
    try {
      // Handle empty objects/arrays
      return Object.keys(arg).length === 0 ? 
             (Array.isArray(arg) ? '[]' : '{}') : 
             JSON.stringify(arg, null, 2);
    } catch (e) {
      return String(arg);
    }
  }
  return String(arg);
};

// Helper to get current script source
const getCurrentSource = () => {
  if (typeof ServiceWorkerGlobalScope !== 'undefined' && 
      self instanceof ServiceWorkerGlobalScope) {
    return 'service-worker.js';
  }

  try {
    const currentScript = document.currentScript;
    if (currentScript?.src) {
      return currentScript.src.split('/').pop();
    }
  } catch (e) {
    // Ignore error - can't get script source
  }

  return 'app.js';
};

// Keep event listeners for saving
if (typeof window !== 'undefined') {
  window.addEventListener('unload', () => Logger.forceSave());
  window.addEventListener('beforeunload', () => Logger.forceSave());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') Logger.forceSave();
  });
}

// In service worker context
if (typeof ServiceWorkerGlobalScope !== 'undefined' && self instanceof ServiceWorkerGlobalScope) {
  self.addEventListener('unload', async () => {
    await Logger.forceSave();
  });
}
