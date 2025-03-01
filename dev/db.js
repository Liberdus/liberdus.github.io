// Database configuration
const DB_NAME = 'liberdus';
const DB_VERSION = 1;

// Connection management configuration
const CONNECTION_CONFIG = {
    POOL_SIZE: 3,
    IDLE_TIMEOUT: 60000, // 1 minute
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000
};

// Store names
const STORES = {
    CHATS: 'chats',
    CONTACTS: 'contacts',
    WALLET: 'wallet'
};

// Data validation schemas
const SCHEMAS = {
    [STORES.CHATS]: {
        required: ['chatId', 'chats', 'contacts'],
        types: { 
            chatId: 'string', 
            chats: 'object',
            contacts: 'object',
            version: 'number',
            lastUpdated: 'number'
        }
    },
    [STORES.CONTACTS]: {
        required: ['address', 'contacts'],
        types: { 
            address: 'string', 
            contacts: 'object',
            version: 'number',
            lastUpdated: 'number'
        }
    },
    [STORES.WALLET]: {
        required: ['assetId', 'wallet'],
        types: { 
            assetId: 'string', 
            wallet: 'object',
            version: 'number',
            lastUpdated: 'number'
        }
    }
};

// Custom error classes
class DBError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DBError';
        this.timestamp = Date.now();
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }
}

class ValidationError extends DBError {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

class ConnectionError extends DBError {
    constructor(message) {
        super(message);
        this.name = 'ConnectionError';
    }
}

class TransactionError extends DBError {
    constructor(message, storeName, operation) {
        super(message);
        this.name = 'TransactionError';
        this.storeName = storeName;
        this.operation = operation;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            storeName: this.storeName,
            operation: this.operation
        };
    }
}

// Error logging
const errorLog = [];
const MAX_ERROR_LOG_SIZE = 100;

function logError(error, context = {}) {
    const errorEntry = {
        error: error.toJSON ? error.toJSON() : {
            name: error.name,
            message: error.message,
            stack: error.stack
        },
        context,
        timestamp: Date.now()
    };

    console.error('Database Error:', errorEntry);
    errorLog.unshift(errorEntry);
    
    // Keep log size manageable
    if (errorLog.length > MAX_ERROR_LOG_SIZE) {
        errorLog.pop();
    }

    // TODO: In production, you might want to send errors to a monitoring service
    // sendToMonitoringService(errorEntry);
}

// Recovery mechanisms
async function retryOperation(operation, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            logError(error, { attempt: i + 1, maxRetries });
            
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
            }
        }
    }
    
    throw lastError;
}

// Initialize database with error handling
async function initDB() {
    return retryOperation(async () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                const error = new ConnectionError('Failed to open database');
                logError(error, { request: request.error });
                reject(error);
            };

            request.onsuccess = () => {
                const db = request.result;
                console.log('Database opened successfully');
                resolve(db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                try {
                    // Create stores if they don't exist
                    if (!db.objectStoreNames.contains(STORES.CHATS)) {
                        db.createObjectStore(STORES.CHATS, { keyPath: 'chatId' });
                    }
                    if (!db.objectStoreNames.contains(STORES.CONTACTS)) {
                        db.createObjectStore(STORES.CONTACTS, { keyPath: 'address' });
                    }
                    if (!db.objectStoreNames.contains(STORES.WALLET)) {
                        db.createObjectStore(STORES.WALLET, { keyPath: 'assetId' });
                    }
                } catch (error) {
                    logError(error, { event: 'onupgradeneeded' });
                    throw error;
                }
            };
        });
    });
}

// Connection pool management
class ConnectionPool {
    constructor() {
        this.connections = new Map(); // Map of connection ID to connection info
        this.lastConnectionId = 0;
    }

    async acquire() {
        // Clean up expired connections first
        this.cleanupExpiredConnections();

        // Check for available connection
        for (const [id, connInfo] of this.connections) {
            if (!connInfo.inUse) {
                connInfo.inUse = true;
                connInfo.lastUsed = Date.now();
                return { id, connection: connInfo.connection };
            }
        }

        // Create new connection if pool not full
        if (this.connections.size < CONNECTION_CONFIG.POOL_SIZE) {
            const id = ++this.lastConnectionId;
            const connection = await this.createConnection();
            this.connections.set(id, {
                connection,
                inUse: true,
                lastUsed: Date.now(),
                created: Date.now()
            });
            return { id, connection };
        }

        // Pool is full and all connections are in use
        throw new ConnectionError('Connection pool exhausted');
    }

    release(id) {
        const connInfo = this.connections.get(id);
        if (connInfo) {
            connInfo.inUse = false;
            connInfo.lastUsed = Date.now();
        }
    }

    async createConnection() {
        try {
            return await initDB();
        } catch (error) {
            logError(error, { operation: 'createConnection' });
            throw error;
        }
    }

    cleanupExpiredConnections() {
        const now = Date.now();
        for (const [id, connInfo] of this.connections) {
            if (!connInfo.inUse && (now - connInfo.lastUsed > CONNECTION_CONFIG.IDLE_TIMEOUT)) {
                try {
                    connInfo.connection.close();
                    this.connections.delete(id);
                    console.log(`Closed idle connection ${id}`);
                } catch (error) {
                    logError(error, { operation: 'cleanupExpiredConnections', connectionId: id });
                }
            }
        }
    }

    closeAll() {
        for (const [id, connInfo] of this.connections) {
            try {
                connInfo.connection.close();
            } catch (error) {
                logError(error, { operation: 'closeAll', connectionId: id });
            }
        }
        this.connections.clear();
    }

    getStats() {
        const now = Date.now();
        return {
            totalConnections: this.connections.size,
            activeConnections: Array.from(this.connections.values()).filter(c => c.inUse).length,
            idleConnections: Array.from(this.connections.values()).filter(c => !c.inUse).length,
            oldestConnection: Math.min(...Array.from(this.connections.values()).map(c => c.created)),
            connectionAges: Array.from(this.connections.entries()).map(([id, c]) => ({
                id,
                age: now - c.created,
                idle: now - c.lastUsed,
                inUse: c.inUse
            }))
        };
    }
}

// Global connection pool instance
const connectionPool = new ConnectionPool();

// Connection management wrapper
async function withConnection(operation) {
    let connInfo = null;
    try {
        connInfo = await connectionPool.acquire();
        const result = await operation(connInfo.connection);
        return result;
    } finally {
        if (connInfo) {
            connectionPool.release(connInfo.id);
        }
    }
}

// Update CRUD operations to use connection pool
async function saveData(storeName, data) {
    return retryOperation(async () => {
        try {
            validateData(storeName, data);
            
            return await withConnection(async (db) => {
                return new Promise((resolve, reject) => {
                    const transaction = db.transaction(storeName, 'readwrite');
                    const store = transaction.objectStore(storeName);

                    transaction.onerror = () => {
                        const error = new TransactionError(
                            'Transaction failed',
                            storeName,
                            'save'
                        );
                        logError(error, { data });
                        reject(error);
                    };

                    const request = store.put(data);

                    request.onsuccess = () => {
                        resolve(request.result);
                    };

                    request.onerror = () => {
                        const error = new TransactionError(
                            'Failed to save data',
                            storeName,
                            'save'
                        );
                        logError(error, { data });
                        reject(error);
                    };
                });
            });
        } catch (error) {
            logError(error, { storeName, data });
            throw error;
        }
    });
}

async function getData(storeName, key) {
    return retryOperation(async () => {
        try {
            return await withConnection(async (db) => {
                return new Promise((resolve, reject) => {
                    const transaction = db.transaction(storeName, 'readonly');
                    const store = transaction.objectStore(storeName);

                    transaction.onerror = () => {
                        const error = new TransactionError(
                            'Transaction failed',
                            storeName,
                            'get'
                        );
                        logError(error, { key });
                        reject(error);
                    };

                    const request = store.get(key);

                    request.onsuccess = () => {
                        resolve(request.result);
                    };

                    request.onerror = () => {
                        const error = new TransactionError(
                            'Failed to get data',
                            storeName,
                            'get'
                        );
                        logError(error, { key });
                        reject(error);
                    };
                });
            });
        } catch (error) {
            logError(error, { storeName, key });
            throw error;
        }
    });
}

async function getAllData(storeName) {
    return retryOperation(async () => {
        try {
            return await withConnection(async (db) => {
                return new Promise((resolve, reject) => {
                    const transaction = db.transaction(storeName, 'readonly');
                    const store = transaction.objectStore(storeName);

                    transaction.onerror = () => {
                        const error = new TransactionError(
                            'Transaction failed',
                            storeName,
                            'getAll'
                        );
                        logError(error);
                        reject(error);
                    };

                    const request = store.getAll();

                    request.onsuccess = () => {
                        resolve(request.result);
                    };

                    request.onerror = () => {
                        const error = new TransactionError(
                            'Failed to get all data',
                            storeName,
                            'getAll'
                        );
                        logError(error);
                        reject(error);
                    };
                });
            });
        } catch (error) {
            logError(error, { storeName });
            throw error;
        }
    });
}

// Connection monitoring
function getConnectionStats() {
    return connectionPool.getStats();
}

// Cleanup function for application shutdown
function closeAllConnections() {
    connectionPool.closeAll();
}

// Data versioning
function addVersionToData(data) {
    return {
        ...data,
        version: Date.now(), // Use timestamp as version
        lastUpdated: Date.now()
    };
}

// Get error log
function getErrorLog() {
    return [...errorLog];
}

// Clear error log
function clearErrorLog() {
    errorLog.length = 0;
}

// Validate data against schema
function validateData(storeName, data) {
    const schema = SCHEMAS[storeName];
    if (!schema) throw new ValidationError(`No schema defined for store: ${storeName}`);
    
    // Check required fields
    for (const field of schema.required) {
        if (data[field] === undefined) {
            throw new ValidationError(`Missing required field: ${field}`);
        }
    }
    
    // Check types
    for (const [field, type] of Object.entries(schema.types)) {
        if (data[field] !== undefined && typeof data[field] !== type) {
            throw new ValidationError(`Field ${field} should be type ${type}`);
        }
    }
    
    return true;
}

// Export functions
export {
    STORES,
    saveData,
    getData,
    getAllData,
    getErrorLog,
    clearErrorLog,
    getConnectionStats,
    closeAllConnections
}; 