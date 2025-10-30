
window.CONFIG = {

    CONTRACTS: {
        STAKING_CONTRACT: '0x1cAcD190b8a9223f24F6aBFb7Ba6D598B3E513f0', // Deployed on Polygon Amoy
        REWARD_TOKEN: '0x693ed886545970F0a3ADf8C59af5cCdb6dDF0a76', // LIB Token from deployment
        LP_TOKENS: {
            // Add LP token addresses here when available
        }
    },


    NETWORKS: {
        LOCAL_HARDHAT: {
            chainId: 31337,
            name: 'Localhost 8545',
            rpcUrl: 'http://127.0.0.1:8545',
            blockExplorer: 'http://localhost:8545', // No block explorer for local
            nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18
            }
        },
        POLYGON_AMOY: {
            chainId: 80002,
            name: 'Polygon Amoy Testnet',
            rpcUrl: 'https://rpc-amoy.polygon.technology',
            blockExplorer: 'https://amoy.polygonscan.com',
            nativeCurrency: {
                name: 'MATIC',
                symbol: 'MATIC',
                decimals: 18
            }
        }
    },


    DEFAULT_NETWORK: 80002, // Polygon Amoy Testnet


    RPC: {
        LOCAL_HARDHAT: [
            'http://127.0.0.1:8545'
        ],
        POLYGON_AMOY: [
            'https://rpc-amoy.polygon.technology',
            'https://polygon-amoy.gateway.tenderly.co',
            'https://rpc.ankr.com/polygon_amoy',
            'https://polygon-amoy-bor-rpc.publicnode.com'
        ],
        FALLBACK_TIMEOUT: 5000, // 5 seconds
        MAX_RETRIES: 3
    },

    // API Configuration
    APIS: {
        COINGECKO: 'https://api.coingecko.com/api/v3',
        PRICE_UPDATE_INTERVAL: 300000, // 5 minutes
        CACHE_DURATION: 300000 // 5 minutes
    },

    // UI Configuration
    UI: {
        WALLET_STORAGE_KEY: 'lp-staking-wallet-connection',
        DATA_REFRESH_INTERVAL: 30000, // 30 seconds
        NOTIFICATION_DURATION: 5000, // 5 seconds
        MODAL_ANIMATION_DURATION: 300, // 300ms
        LOADING_DELAY: 1000 // 1 second minimum loading
    },

    // Transaction Configuration
    TRANSACTIONS: {
        GAS_MULTIPLIER: 1.2, // 20% buffer
        MAX_GAS_PRICE: '100', // 100 gwei
        DEFAULT_GAS_LIMITS: {
            APPROVE: 60000,
            STAKE: 150000,
            UNSTAKE: 200000,
            CLAIM: 120000,
            ADMIN_ACTION: 300000
        },
        CONFIRMATION_BLOCKS: 1,
        TIMEOUT: 300000 // 5 minutes
    },

    // Validation Rules
    VALIDATION: {
        MIN_STAKE_AMOUNT: '0.0001', // Minimum stake amount
        MAX_DECIMALS: 18,
        ADDRESS_REGEX: /^0x[a-fA-F0-9]{40}$/,
        AMOUNT_REGEX: /^\d*\.?\d*$/
    },

    // Error Messages
    ERRORS: {
        WALLET_NOT_CONNECTED: 'Please connect your wallet first',
        WRONG_NETWORK: 'Please switch to Polygon Amoy Testnet',
        INSUFFICIENT_BALANCE: 'Insufficient balance for this transaction',
        TRANSACTION_REJECTED: 'Transaction was rejected by user',
        NETWORK_ERROR: 'Network error. Please try again.',
        CONTRACT_ERROR: 'Contract interaction failed',
        INVALID_AMOUNT: 'Please enter a valid amount',
        AMOUNT_TOO_LOW: 'Amount is below minimum stake requirement',
        AMOUNT_TOO_HIGH: 'Amount exceeds available balance'
    },

    // Success Messages
    SUCCESS: {
        WALLET_CONNECTED: 'Wallet connected successfully',
        NETWORK_SWITCHED: 'Switched to Polygon Amoy Testnet successfully',
        STAKE_SUCCESS: 'Tokens staked successfully',
        UNSTAKE_SUCCESS: 'Tokens unstaked successfully',
        CLAIM_SUCCESS: 'Rewards claimed successfully',
        APPROVAL_SUCCESS: 'Token approval successful'
    },

    // Feature Flags
    FEATURES: {
        DARK_MODE: true,
        WALLET_CONNECT: true,
        ADMIN_PANEL: true,
        PRICE_FEEDS: true,
        REAL_TIME_UPDATES: true,
        TRANSACTION_HISTORY: true
    },

    // Development Configuration
    DEV: {
        DEBUG_MODE: true, // Enable for development
        MOCK_DATA: false, // Disabled - use real blockchain data
        SKIP_WALLET_CHECK: false, // Set to true to skip wallet requirements
        LOG_LEVEL: 'debug' // 'debug', 'info', 'warn', 'error'
    }
};

// Environment-specific overrides
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.CONFIG.DEV.DEBUG_MODE = true;
    window.CONFIG.DEV.LOG_LEVEL = 'debug';
}

// Freeze configuration to prevent accidental modifications
Object.freeze(window.CONFIG);
Object.freeze(window.CONFIG.CONTRACTS);
Object.freeze(window.CONFIG.NETWORKS);
Object.freeze(window.CONFIG.RPC);
Object.freeze(window.CONFIG.APIS);
Object.freeze(window.CONFIG.UI);
Object.freeze(window.CONFIG.TRANSACTIONS);
Object.freeze(window.CONFIG.VALIDATION);
Object.freeze(window.CONFIG.ERRORS);
Object.freeze(window.CONFIG.SUCCESS);
Object.freeze(window.CONFIG.FEATURES);
Object.freeze(window.CONFIG.DEV);

// Export for module systems (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.CONFIG;
}
