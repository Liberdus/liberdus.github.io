export const CONFIG = {
  APP: {
    NAME: 'Liberdus Token UI',
    // Bump manually for now; later we can automate if needed.
    VERSION: '0.0.10',
    // Phase 9.4 (optional): enable low-priority prefetch of shared reads
    PREFETCH_ON_IDLE: false,
  },

  // Phase 3+
  NETWORK: {
    // Polygon Amoy testnet
    CHAIN_ID: 80002,
    NAME: 'Polygon Amoy',
    // Primary RPC. If this endpoint fails, the app will show an error.
    RPC_URL: 'https://rpc-amoy.polygon.technology/',
    BLOCK_EXPLORER: 'https://amoy.polygonscan.com',
    NATIVE_CURRENCY: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
  },

  // Phase 3+
  CONTRACT: {
    // Liberdus governance/token contract deployed on Amoy
    ADDRESS: '0x0c8A4E9A6E2E0b27f9bC6069eD2cBf2e59313752',
    // Optional optimization for event queries later (Phase 4+)
    DEPLOYMENT_BLOCK: 32779661,
    // Earliest Polygon Amoy block observed to contain an `OperationRequested` event for this contract.
    // Verified via RPC `eth_getLogs` from DEPLOYMENT_BLOCK → latest.
    // Used as a deterministic scan floor for first-time visitors (avoids arbitrary time-based caps).
    // Set to deployment block initially; update after first operation is requested
    OPERATION_REQUESTED_START_BLOCK: 32779661,
  },
};
