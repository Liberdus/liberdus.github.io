/**
 * Application Configuration
 * Contains all configuration settings for the LP Staking application
 * Updated for Local Hardhat Network Deployment
 */

// Application Configuration
window.CONFIG = {
    // Multi-Network Configuration
    NETWORKS: {
        AMOY: {
            CHAIN_ID: 80002,
            NAME: 'Amoy',
            RPC_URL: 'https://polygon-amoy.drpc.org',
            FALLBACK_RPCS: [
                'https://polygon-amoy-bor-rpc.publicnode.com',
                'https://rpc-amoy.polygon.technology',
                'https://polygon-amoy.g.alchemy.com/v2/CjcioLVYYWW0tsHWorEfC'
            ],
            BLOCK_EXPLORER: 'https://amoy.polygonscan.com',
            NATIVE_CURRENCY: {
                name: 'Polygon',
                symbol: 'POL',
                decimals: 18
            },
            CONTRACTS: {
                STAKING_CONTRACT: '0x65198C2893a62043fEd14400567a57915b84B63F'
                                  /* '0x5e4216c952190BEA7abC4Fc64e990AfbF4F9885a' */
                                  /* '0x3aca5B70C7153671Fb96705E9593DABd1Ff7717F' */

            }
        },
        POLYGON_MAINNET: {
            CHAIN_ID: 137,
            NAME: 'Polygon Mainnet',
            RPC_URL: 'https://polygon-rpc.com',
            FALLBACK_RPCS: [
                'https://polygon.drpc.org',
                'https://polygon-bor-rpc.publicnode.com'
            ],
            BLOCK_EXPLORER: 'https://polygonscan.com',
            NATIVE_CURRENCY: { name: 'Polygon', symbol: 'POL', decimals: 18 },
            CONTRACTS: {
                STAKING_CONTRACT: '0x0cE924eC0Ed66241d082132a4A6e42E1789f58e0' 
                                  /* '0x74b00fe491Ab0CDf5291af69bD8c4ECD5FBbE8Ca' */

            }
        },
        BSC_MAINNET: {
            CHAIN_ID: 56,
            NAME: 'BNB Smart Chain',
            RPC_URL: 'https://bsc-dataseed.bnbchain.org',
            FALLBACK_RPCS: [
                'https://bsc-dataseed.nariox.org',
                'https://bsc-dataseed.defibit.io',
                'https://bsc-dataseed.ninicoin.io'
            ],
            BLOCK_EXPLORER: 'https://bscscan.com',
            NATIVE_CURRENCY: { name: 'BNB', symbol: 'BNB', decimals: 18 },
            CONTRACTS: {
                STAKING_CONTRACT: '0x67e7cAEc6A043E2E3bFCa27eC5BA12D1ed6EFe4C'
            }
        },
        BSC_TESTNET: {
            CHAIN_ID: 97,
            NAME: 'BNB Smart Chain Testnet',
            RPC_URL: 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
            FALLBACK_RPCS: [
                'https://bsc-testnet-dataseed.bnbchain.org',
                'https://bsc-testnet.bnbchain.org',
                'https://bsc-prebsc-dataseed.bnbchain.org'
            ],
            BLOCK_EXPLORER: 'https://testnet.bscscan.com',
            NATIVE_CURRENCY: { name: 'Test BNB', symbol: 'tBNB', decimals: 18 },
            CONTRACTS: {
                STAKING_CONTRACT: '0x87104FB0A772280697F87eE5Af99E18DBbBbbE24'
            }
        }
    },

    // Multicall2 addresses (canonical deployment for batch loading optimization)
    MULTICALL2: {
        1: '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696',      // Ethereum Mainnet
        56: '0xcA11bde05977b3631167028862bE2a173976CA11',     // BNB Smart Chain
        97: '0xcA11bde05977b3631167028862bE2a173976CA11',     // BNB Smart Chain Testnet
        137: '0x275617327c958bD06b5D6b871E7f491D76113dd8',    // Polygon Mainnet
        80002: '0xcA11bde05977b3631167028862bE2a173976CA11',  // Polygon Amoy Testnet
        31337: '0xcA11bde05977b3631167028862bE2a173976CA11'   // Local Hardhat
    },

    // Application Settings
    APP: {
        NAME: 'Liberdus LP Staking',
        VERSION: '1.0.0',
        DESCRIPTION: 'Stake LP tokens and earn LIB rewards',
        REFRESH_INTERVAL: 30000, // 30 seconds
        NOTIFICATION_DURATION: 5000, // 5 seconds
        ANIMATION_DURATION: 300, // 300ms
        DEBOUNCE_DELAY: 500 // 500ms
    },

    // Farm 1.0 migration notice shown on the Farm page (retired)
    FARM_MIGRATION: {
        ENABLED: false,
        POSITION_CHECK_ENABLED: false,
        HIDE_WHEN_CONNECTED_WALLET_HAS_NO_POSITION: true,
        OLD_FARM_LABEL: 'Farm 1.0',
        OLD_FARM_URL: '',
        OLD_FARM_CONTRACTS: {
            BSC_MAINNET: '0x89E662CB5d784582DB631e2Cbc81bB6643BB2EF4',
            BSC_TESTNET: '0x24F28129B65E9AeDdAfE3f1Fc67ab82DDCF30dF9'
        },
        LEGACY_LP_TOKENS: {}
    },

    // Support Links
    SUPPORT: {
        DISCORD_URL: 'https://liberdus.com/discord/',
        DISCORD_HELP_URL: 'https://liberdus.com/discord/help/'
    },

    // UI Configuration
    UI: {
        THEME: {
            DEFAULT: 'dark',
            STORAGE_KEY: 'liberdus-theme'
        },
        PAGINATION: {
            DEFAULT_PAGE_SIZE: 10,
            MAX_PAGE_SIZE: 100
        },
        DECIMAL_PLACES: {
            TOKEN_AMOUNTS: 6,
            PERCENTAGES: 2,
            PRICES: 8
        }
    },

    // API Configuration
    API: {
        TIMEOUT: 15000, // 15 seconds (increased for slow RPC nodes)
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000, // 1 second
        RPC_RETRY_LOGIC: true,
        FALLBACK_ON_ERROR: true,
        RPC_TIMEOUT: 12000, // 12 seconds for RPC calls (increased)
        MAX_CONCURRENT_REQUESTS: 5
    },

    // Wallet Configuration
    WALLET: {
        AUTO_CONNECT: true,
        CONNECTION_TIMEOUT: 30000 // 30 seconds
    },

    // Staking Configuration
    STAKING: {
        MIN_STAKE_AMOUNT: '0.001', // Minimum stake amount in LP tokens
        MAX_STAKE_AMOUNT: '1000000', // Maximum stake amount in LP tokens
        UNSTAKE_DELAY: 0, // No delay for unstaking (in seconds)
        REWARD_PRECISION: 18 // Token precision for rewards
    },

    // KyberSwap Zap as a Service configuration
    KYBER_ZAP: {
        BASE_URL: 'https://zap-api.kyberswap.com',
        CLIENT_ID: 'liberdus-lp-staking',
        SOURCE: 'liberdus-lp-staking',
        GECKO_TERMINAL_BASE_URL: 'https://api.geckoterminal.com/api/v2',
        NATIVE_TOKEN_ADDRESS: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        DEFAULT_SLIPPAGE_BPS: 50,
        HIGH_SLIPPAGE_BPS: 300,
        HIGH_PRICE_IMPACT_PERCENT: 5,
        QUOTE_RATE_LIMIT_MAX_REQUESTS: 8,
        RATE_LIMIT_WINDOW_MS: 10000,
        DEFAULT_DEADLINE_MINUTES: 20,
        NETWORKS: {
            BSC_MAINNET: {
                CHAIN: 'bsc',
                DEX: 'DEX_UNISWAPV2',
                ROUTER_ADDRESS: '0x0e97C887b61cCd952a53578B04763E7134429e05',
                WRAPPED_NATIVE_TOKEN_ADDRESS: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
                DEX_CANDIDATES: [
                    'DEX_UNISWAPV2',
                    'DEX_PANCAKESWAPV2',
                    'DEX_PANCAKESWAPV3',
                    'DEX_THENAFUSION'
                ],
                FACTORY_DEX_IDS: {
                    '0x8909dc15e40173ff4699343b6eb8132c65e18ec6': 'DEX_UNISWAPV2',
                    '0xca143ce32fe78f1f7019d7d551a6402fc5350c73': 'DEX_PANCAKESWAPV2'
                },
                PLATFORM_DEX_IDS: {
                    'Uniswap V2': 'DEX_UNISWAPV2',
                    'PancakeSwap': 'DEX_PANCAKESWAPV2',
                    'PancakeSwap V2': 'DEX_PANCAKESWAPV2',
                    'PancakeSwap V3': 'DEX_PANCAKESWAPV3',
                    'Thena Fusion': 'DEX_THENAFUSION'
                },
                INPUT_TOKENS: [
                    { symbol: 'BNB', name: 'BNB', address: 'native', decimals: 18 },
                    { symbol: 'WBNB', name: 'Wrapped BNB', address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18 },
                    { symbol: 'USDT', name: 'Tether USD', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
                    { symbol: 'USDC', name: 'USD Coin', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
                    { symbol: 'DAI', name: 'Dai Token', address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', decimals: 18 },
                    { symbol: 'WBTC', name: 'Wrapped BTC', address: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c', decimals: 8 },
                    { symbol: 'CAKE', name: 'PancakeSwap Token', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18 },
                    { symbol: 'ETH', name: 'Binance-Peg Ethereum Token', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18 },
                    { symbol: 'LIB', name: 'Liberdus', address: 'pool-token', decimals: null }
                ]
            }
        }
    },

    // Explicit V2 DEX allowlist for guided remove-liquidity flows.
    // Routers are intentionally configured here because they cannot be safely discovered from LP pairs.
    DEX_REMOVE_LIQUIDITY: {
        56: {
            wrappedNative: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
            factories: {
                '0x8909dc15e40173ff4699343b6eb8132c65e18ec6': {
                    name: 'Uniswap V2',
                    type: 'uniswapV2',
                    router: '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24'
                },
                '0xca143ce32fe78f1f7019d7d551a6402fc5350c73': {
                    name: 'PancakeSwap V2',
                    type: 'uniswapV2',
                    router: '0x10ed43c718714eb63d5aa57b78b54704e256024e'
                }
            }
        }
    },

    // Platform Configuration
    PLATFORMS: {
        // Available platforms for dropdown (matches contract values)
        OPTIONS: [
            'Uniswap V2',
            'SushiSwap',
            'Curve Finance',
            'Balancer',
            'PancakeSwap',
            'PancakeSwap V2',
            'PancakeSwap V3',
            'Thena Fusion'
        ],
        // Base URLs for each platform (address will be inserted where {address} appears)
        BASE_URLS: {
            'Uniswap V2': {
                AMOY: 'https://app.uniswap.org/explore/pools/polygon/{address}',
                POLYGON_MAINNET: 'https://app.uniswap.org/explore/pools/polygon/{address}',
                BSC_MAINNET: 'https://app.uniswap.org/explore/pools/bnb/{address}'
            },
            'SushiSwap': {
                AMOY: 'https://www.sushi.com/analytics/pools/polygon/{address}',
                POLYGON_MAINNET: 'https://www.sushi.com/analytics/pools/polygon/{address}'
            },
            'Curve Finance': {
                AMOY: 'https://curve.fi/polygon/pools/{address}',
                POLYGON_MAINNET: 'https://curve.fi/polygon/pools/{address}'
            },
            'Balancer': {
                AMOY: 'https://app.balancer.fi/#/polygon/pool/{address}',
                POLYGON_MAINNET: 'https://app.balancer.fi/#/polygon/pool/{address}'
            },
            'PancakeSwap': {
                default: 'https://pancakeswap.finance/pools/{address}'
            }
        },
    },

    // Development Configuration
    DEV: {
        DEBUG: true
    },

    // Default Values for Contract Stats
    DEFAULTS: {
        REWARD_TOKEN: '0x05A4cfAF5a8f939d61E4Ec6D6287c9a065d6574c',
        HOURLY_REWARD_RATE: 0,
        REQUIRED_APPROVALS: 3,
        ACTION_COUNTER: 0,
        TOTAL_WEIGHT: 0
    },

    // Feature Flags
    FEATURES: {
        DARK_MODE: true,
        NOTIFICATIONS: true,
        ANIMATIONS: true,
        ACCESSIBILITY: true,
        MOBILE_RESPONSIVE: true,
        ADMIN_PANEL: true,
        MULTI_SIG: false // Not implemented yet
    },

    // Error Messages
    ERRORS: {
        WALLET_NOT_CONNECTED: 'Please connect your wallet to continue',
        INSUFFICIENT_BALANCE: 'Insufficient balance for this transaction',
        TRANSACTION_FAILED: 'Transaction failed. Please try again.',
        NETWORK_ERROR: 'Network error. Please check your connection.',
        CONTRACT_ERROR: 'Smart contract error. Please try again later.',
        INVALID_AMOUNT: 'Please enter a valid amount',
        AMOUNT_TOO_LOW: 'Amount is below minimum stake requirement',
        AMOUNT_TOO_HIGH: 'Amount exceeds maximum stake limit'
    },

    // Success Messages
    SUCCESS: {
        WALLET_CONNECTED: 'Wallet connected successfully',
        STAKE_SUCCESS: 'Tokens staked successfully',
        UNSTAKE_SUCCESS: 'Tokens unstaked successfully',
        CLAIM_SUCCESS: 'Rewards claimed successfully',
        TRANSACTION_CONFIRMED: 'Transaction confirmed'
    }
};

// Token ABI. LPStaking ABI is loaded from assets/abi/LPStaking.json.
window.CONFIG.ABIS = {
    ERC20: [
        'function balanceOf(address owner) external view returns (uint256)',
        'function allowance(address owner, address spender) external view returns (uint256)',
        'function approve(address spender, uint256 amount) external returns (bool)',
        'function transfer(address to, uint256 amount) external returns (bool)',
        'function decimals() external view returns (uint8)',
        'function symbol() external view returns (string)',
        'function name() external view returns (string)'
    ]
};
