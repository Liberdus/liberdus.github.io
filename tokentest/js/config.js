export const CONFIG = {
  APP: {
    NAME: 'Liberdus Token UI',
    // Bump manually for now; later we can automate if needed.
    VERSION: '0.0.0',
    // Phase 9.4 (optional): enable low-priority prefetch of shared reads
    PREFETCH_ON_IDLE: false,
  },

  // Phase 3+
  NETWORK: {
    // Polygon mainnet (Polygon-only app)
    CHAIN_ID: 137,
    NAME: 'Polygon',
    // Primary RPC (Infura). If this endpoint fails, the app will show an error.
    RPC_URL: 'https://polygon-mainnet.infura.io/v3/47dd60e8fe6447ac804a25ea6ec97077',
    BLOCK_EXPLORER: 'https://polygonscan.com',
    NATIVE_CURRENCY: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
  },

  // Phase 3+
  CONTRACT: {
    // Liberdus governance/token contract (from liberdus-sc-dao)
    ADDRESS: '0x693ed886545970F0a3ADf8C59af5cCdb6dDF0a76',
    // Optional optimization for event queries later (Phase 4+)
    DEPLOYMENT_BLOCK: 64039271,
    // Earliest Polygon block observed to contain an `OperationRequested` event for this contract.
    // Verified via Infura `eth_getLogs` from DEPLOYMENT_BLOCK → latest.
    // Used as a deterministic scan floor for first-time visitors (avoids arbitrary time-based caps).
    OPERATION_REQUESTED_START_BLOCK: 64039939,
  },
};

