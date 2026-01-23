# Liberdus Token UI - Phased Development Plan

## Overview

Rewrite of `liberdus-sc-dao` as a vanilla JavaScript SPA with tabs. Desktop-first, mobile-ready. Wallet connection pattern from `lib-lp-staking-frontend`. Class structure and initialization pattern from `web-client-v2`.

---

## Architecture Pattern

### Class Structure (from `web-client-v2`)

Each component is a class with a `load()` method:

```js
class MyComponent {
  constructor() {
    // Minimal constructor - just initialize properties
  }

  load() {
    // Get DOM elements
    this.element = document.getElementById('myElement');

    // Set up event listeners
    this.element.addEventListener('click', () => this.handleClick());
  }

  handleClick() {
    // Component logic
  }
}

const myComponent = new MyComponent();
```

### Initialization (from `web-client-v2`)

All components load in `DOMContentLoaded`:

```js
document.addEventListener('DOMContentLoaded', async () => {
  // Load components in order
  header.load();
  tabBar.load();
  walletManager.load();
  walletPopup.load();
  networkManager.load();

  proposalsTab.load();
  proposeTab.load();
  bridgeTab.load();

  // Check for previous wallet connection
  await walletManager.checkPreviousConnection();
});
```

---

## PHASE 1: Project Skeleton & Foundation

**Goal:** Working app shell with tab navigation, no blockchain functionality yet.

### Step 1.1 - Project Structure

Create folder structure:

```text
liberdus-token-ui/
├── index.html
├── css/
│   ├── base.css
│   ├── header.css
│   ├── tabs.css
│   └── wallet-popup.css
├── js/
│   ├── app.js              # Main entry, DOMContentLoaded, component loading
│   ├── config.js           # Network config, contract address
│   ├── wallet/
│   │   ├── wallet-manager.js
│   │   ├── metamask-connector.js
│   │   ├── network-manager.js
│   │   └── wallet-popup.js
│   └── components/
│       ├── header.js
│       ├── tab-bar.js
│       ├── proposals-tab.js
│       ├── propose-tab.js
│       └── bridge-tab.js
├── libs/
│   └── ethers.umd.min.js
└── assets/
    └── logo.png
```

Tasks:
- [x] Create all folders
- [x] Create placeholder files

### Step 1.2 - Base CSS System

Port CSS variables from `web-client-v2/styles.css`

Includes:

- Color palette (primary, status, surfaces)
  - `--primary-color`, `--primary-hover`
  - `--danger-color`, `--success-color`, `--warning-color`, `--info-color`
  - `--background-color`, `--text-color`, `--secondary-text-color`
  - `--border-color`, `--hover-background`
- Typography scale
  - `--font-primary`, `--font-monospace`
  - `--font-size-xs` through `--font-size-xxl`
  - `--font-weight-normal` through `--font-weight-bold`
- Shadows and overlays
  - `--elev-1`, `--elev-2`, `--elev-3`
  - `--overlay-shadow`, `--overlay-shadow-large`
- Icon/button tokens
- Additional tokens (primary tints, scrollbar, skeleton, etc.)

Tasks:
- [x] Port CSS variables from `web-client-v2/styles.css`
- [x] Include resets and utility classes

### Step 1.3 - HTML Shell

Create main HTML structure

Includes:
- Header with logo, app name, connect wallet button placeholder
- Tab bar with 3 tabs: Proposals, Propose, Bridge
- Tab content area with 3 panels (placeholder content)
- Footer
- Container divs for wallet popup and notifications

Tasks:
- [x] Create `index.html` with full structure

### Step 1.4 - App Entry Point (`app.js`)

Set up `DOMContentLoaded` listener

Pattern:

```js
document.addEventListener('DOMContentLoaded', async () => {
  header.load();
  tabBar.load();
  proposalsTab.load();
  proposeTab.load();
  bridgeTab.load();
});
```

Tasks:
- [x] Create `app.js` with `DOMContentLoaded`
- [x] Import component classes

### Step 1.5 - Header Component

Create `Header` class with `load()` method

Methods:
- `load()` - Get DOM elements, set up event listeners

Tasks:
- [x] Create class `Header`
- [x] Implement `load()` method
- [x] Get DOM elements (logo, app name, connect button)
- [x] Set up connect button click handler (placeholder)
- [x] Instantiate: `const header = new Header();`

### Step 1.6 - Tab Bar Component

Create `TabBar` class with `load()` method

Methods:
- `load()` - Get tab buttons and panels, set up click handlers
- `switchTab(tabName)` - Show/hide panels, update active state

Tasks:
- [x] Create class `TabBar`
- [x] Implement `load()` method
- [x] Get tab buttons and tab panels
- [x] Tab switching logic
- [x] Instantiate: `const tabBar = new TabBar();`

### Step 1.7 - Tab & Layout CSS

Create `tabs.css` with tab bar and panel styles

Includes:
- Horizontal tab bar
- Active tab indicator
- Panel show/hide styles
- Mobile-ready (flex-wrap or horizontal scroll)

Tasks:
- [x] Create `tabs.css`
- [x] Style tab bar
- [x] Style tab panels

### PHASE 1 DELIVERABLE

✅ Static HTML/CSS/JS app with working tab navigation, no wallet connection yet.

---

## PHASE 2: Wallet Connection

**Goal:** MetaMask-only wallet connection with a simple “read-only vs tx-enabled” mode (Polygon-only).

**Design decisions for this app:**
- **Supported chain**: Polygon only
- **Supported wallet**: MetaMask only (for now)
- **Read-only mode** (default): use the **configured Polygon RPC URL** (no wallet required)
- **Tx-enabled mode**: only when MetaMask is connected **and** the wallet is on Polygon; use the **wallet provider/signer**
- **UI simplicity**: when not tx-enabled, keep proposal/sign/bridge/propose **inputs + buttons disabled** (no extra permission UI beyond “connect / switch network”)

### Step 2.1 - MetaMask Connector

Port `MetaMaskConnector` class from `lib-lp-staking`

Methods:
- `load()` - Initialize connector
- `isAvailable()` - Check if MetaMask installed
- `connect()` - Request accounts, get chainId, create provider
- `disconnect()` - Clear state, remove listeners
- `setupEventListeners()` - AccountsChanged, chainChanged, connect, disconnect
- `switchNetwork(chainId)` - Request network switch
- `addNetwork(networkConfig)` - Add network to MetaMask
- Getters: `getAccount()`, `getChainId()`, `getProvider()`, `getSigner()`

Tasks:
- [x] Port class `MetaMaskConnector`
- [x] Implement all methods
- [x] Instantiate: `const metamaskConnector = new MetaMaskConnector();`

### Step 2.2 - Wallet Manager

Port `WalletManager` class from `lib-lp-staking`

Methods:
- `load()`, `init()` - Initialize wallet manager (best-effort restore)
- `connectMetaMask()` - Connect with connection promise deduplication
- `disconnect()` - Clear state and notify
- `checkPreviousConnection()` - Restore from localStorage
- `storeConnectionInfo()` / `clearConnectionInfo()` - Persistence
- Event listeners for account/chain changes
- `notifyListeners()` - Dispatch DOM events
- `subscribe(callback)` - Listener registration

Tasks:
- [x] Port class `WalletManager`
- [x] Implement all methods
- [x] Instantiate: `const walletManager = new WalletManager();`

### Step 2.3 - Network Manager

Port `NetworkManager` class from `lib-lp-staking`

Methods:
- `load()` - Initialize network manager
- `isOnRequiredNetwork()` - ChainId comparison (Polygon only)
- `switchNetwork()` - Switch MetaMask to Polygon
- `addNetwork()` - Add Polygon network to MetaMask if missing
- `buildNetworkConfig()` - Transform config to MetaMask format (Polygon config)
- `setupPermissionChangeListener()` - Listen for account/chain changes and keep app mode in sync
- `updateUIState()`, `updateButtonStates()` - Centralized UI updates (mainly: disable/enable tx actions)

Notes:
- We can **de-emphasize** `wallet_getPermissions` / “permission” UX here to keep things simple; for this app, “tx-enabled” can be defined as:
  - MetaMask connected **and**
  - `chainId === POLYGON_CHAIN_ID`

Tasks:
- [x] Port class `NetworkManager`
- [x] Implement all methods
- [x] Instantiate: `const networkManager = new NetworkManager();`

### Step 2.4 - Wallet Popup Component

Port `WalletPopup` class from `lib-lp-staking`

Methods:
- `load()` - Initialize popup
- `show(buttonElement)` / `hide()` - Toggle popup
- `createPopupHTML()` - Build popup content
- `positionPopup()` - Position relative to button
- `loadWalletBalance()` - Fetch and display native balance
- `copyAddress()` - Copy to clipboard with feedback
- `disconnectWallet()` - Trigger disconnect

Tasks:
- [x] Port class `WalletPopup`
- [x] Implement all methods
- [x] Port `wallet-popup.css`
- [x] Instantiate: `const walletPopup = new WalletPopup();`

### Step 2.5 - Connect Button Integration

Update `Header.load()` to wire connect button

States:
- Not connected → Show "Connect Wallet", trigger MetaMask connection on click (app stays read-only via Polygon RPC)
- Connected but wrong network → Show "Switch to Polygon" (or "Connect Wallet"), trigger switch/add Polygon network
- Connected + on Polygon → Show shortened address, show wallet popup on click (tx-enabled)
- Loading states during connection

Tasks:
- [x] Update `Header.load()`
- [x] Create `renderConnectButton()` helper
- [x] Wire click handler

### Step 2.6 - Update DOMContentLoaded

Load wallet components in correct order

Pattern:

```js
document.addEventListener('DOMContentLoaded', async () => {
  // Wallet (order matters)
  walletManager.load();
  await walletManager.init();
  networkManager.load();
  walletPopup.load();

  // UI Components
  header.load();
  tabBar.load();

  // Tab Content
  proposalsTab.load();
  proposeTab.load();
  bridgeTab.load();
});
```

Tasks:
- [x] Update `app.js` `DOMContentLoaded`
- [x] Load wallet components in order

### Step 2.7 - Ethers.js Setup

Include ethers library

Tasks:
- [x] Include `ethers.umd.min.js` in `libs/`
- [x] Load before wallet scripts in HTML

### PHASE 2 DELIVERABLE

✅ MetaMask connection + wallet popup. App uses **Polygon config RPC for reads** and **MetaMask provider/signer for tx** when connected on Polygon. Inputs/buttons are enabled only in tx-enabled mode.

---

## PHASE 3: Configuration & Contract Setup

**Goal:** Network config and contract ABI ready for interaction.

### Step 3.1 - Network Configuration

Create `config.js` with network settings

Structure:

```js
const CONFIG = {
  NETWORK: {
    CHAIN_ID: 137,
    NAME: 'Polygon',
    RPC_URL: 'https://polygon-rpc.com',
    FALLBACK_RPCS: [...],
    BLOCK_EXPLORER: 'https://polygonscan.com',
    NATIVE_CURRENCY: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }
  },
  CONTRACT: {
    ADDRESS: '0x...',
  }
};
```

Tasks:
- [x] Create `config.js`
- [x] Define `CONFIG` object
- [x] Set Polygon values (chain id + RPC + explorer)

### Step 3.2 - ABI Integration

Add contract ABI

Tasks:
- [x] Get ABI from `liberdus-sc-dao/abi.json`
- [x] Store as `abi.json` in repo root (loaded by ContractManager)

### Step 3.3 - Contract Helper

Create contract instance helpers

Functions:

```js
function getContract(signerOrProvider) {
  return new ethers.Contract(CONFIG.CONTRACT.ADDRESS, ABI, signerOrProvider);
}

function getReadOnlyContract() {
  const provider = new ethers.providers.JsonRpcProvider(CONFIG.NETWORK.RPC_URL);
  return getContract(provider);
}
```

Tasks:
- [x] Add helpers via `js/contracts/contract-manager.js` (read-only + tx-enabled contracts)

### Step 3.4 - Network Validation

Add network validation

Tasks:
- [x] Check if wallet is on correct network via `networkManager`
- [x] Prompt to switch networks if wrong ("Connect to Polygon" button state)

### PHASE 3 DELIVERABLE

✅ Config system ready, contract can be instantiated.

---

## PHASE 4: Proposals Tab

**Goal:** Display list of `OperationRequested` events from contract.

**Pagination:**
- **Initial page size**: 25 proposals
- **Load more**: 25 proposals per click
- Keep pagination state in-memory (e.g., last scanned block range / last cursor)
- Use direct contract calls for per-opId state (simplified from Multicall batching)
- Add a lightweight `localStorage` cache for fast reloads (Step 4.5) ✅

### Step 4.1 - Proposals Tab Component

Create `ProposalsTab` class

Methods:
- `load()` - Get DOM elements, initialize
- `loadProposalsPage()` - Fetch and render one page (25)
- `loadMore()` - Fetch next page (25)
- `renderProposalRow()` - Create list item HTML (fast render from event data)
- `hydrateProposalRows()` - Batch-load on-chain details and update rows (multicall)

Tasks:
- [x] Create class `ProposalsTab`
- [x] Implement `load()` method
- [x] Get DOM elements (list container, loading state)
- [x] Instantiate: `const proposalsTab = new ProposalsTab();`
- [x] Add "Load more" button (or infinite scroll later)

### Step 4.2 - Query Events

Query `OperationRequested` events from contract

Tasks:
- [x] Query `OperationRequested` events with pagination (25 at a time)
- [x] Use block-range paging (scan backwards from latest block to a known floor block)
- [x] Parse event data (operation type, target, value, timestamp)
- [x] Reverse chronological order
- [x] Batch-load per-opId state using direct contract calls (simplified from Multicall):
  - `operations(operationId)` for each opId in the page
  - optional: `isOperationExpired(operationId)` for each opId in the page

**Recommended improvement (align with `liberdus-sc-dao`):** ✅ **IMPLEMENTED**
- Avoid a hard “last 2 months” cap. Instead:
  - **Set a floor block**: `EVENTS_START_BLOCK = max(DEPLOYMENT_BLOCK, OPERATION_REQUESTED_START_BLOCK)` ✅
  - **Scan backwards in chunks** (recommended default: ~7 days on Polygon, ~302,400 blocks) - *Simplified: single full-range getLogs works for this contract*
  - **Stop scanning once we have enough items for a fast initial render** (start with **5**) ✅
  - Only continue scanning when the user clicks “Load more” (optional later: keep filling in the background until 25 so the first page feels “full”)
- **Provider strategy**: ✅ **IMPLEMENTED**
  - If the RPC supports it (e.g., Infura), first try **one** `eth_getLogs` call from `EVENTS_START_BLOCK` → `latest` (fastest, fewest requests) ✅
  - If that fails (“range too large”, timeouts), fall back to chunked scanning with adaptive range shrinking - *Not needed: Infura handles full range*

**Contract check (Polygon mainnet):**
- Using Infura `eth_getLogs` for `OperationRequested`, the earliest event block observed was:
  - `OPERATION_REQUESTED_START_BLOCK = 64039939`
- This can be hardcoded in `CONFIG.CONTRACT` as an optimization for first-time visitors.

### Step 4.3 - Proposal Detail View

Create `ProposalDetailModal` class

Methods:
- `load()` - Get DOM elements
- `open(opId)` - Show modal with proposal details
- `close()` - Hide modal

Tasks:
- [x] Create class `ProposalDetailModal`
- [x] Show full OpId, all fields, signature count, executed status
- [x] Instantiate: `const proposalDetailModal = new ProposalDetailModal();`

### Step 4.4 - Signing Operations

Add sign operation functionality

Tasks:
- [x] Add "Sign" button in detail modal
- [x] Call contract `submitSignature(operationId, signature)` (tx-enabled only)
- [x] Show transaction status

### Step 4.5 - Proposal Cache (localStorage)

**Goal:** Make proposals load instantly on reload, while still keeping data fresh by doing a background refresh.

**Why:** RPC log scanning + hydration can be slow or rate-limited. Caching the most recent proposals avoids re-scanning on every page refresh.

**Storage choice:** `localStorage` (simple, persistent across reloads, good for small datasets).

**What to cache (minimal, stable shape):**
- **Event summary list** (most recent first), capped to **N entries** (e.g., 200–500):
  - `operationId` (topic[1])
  - `blockNumber`, `transactionHash`, `logIndex`
  - `opType` (topic[2]) and `requester` (topic[3]) if needed for display
  - `data` (hex) only if we want to re-decode `target/value/deadline/timestamp` without re-fetching logs
- **Scan cursor metadata** so the app can continue scanning older ranges without restarting:
  - `nextToBlock` (the current backward scan cursor)
  - `minFromBlock` (scan floor, recommended: `EVENTS_START_BLOCK`)
- **Cache metadata**:
  - `schemaVersion` (e.g., `1`)
  - `chainId`, `contractAddress`, `deploymentBlock`
  - `cachedAtMs` (timestamp for TTL)

**Keying / namespacing:**
- Use a single JSON blob per environment:
  - Example key: `liberdus_token_ui:proposals:v1:${chainId}:${contractAddress}`

**TTL / freshness policy (recommended):**
- **TTL**: 5 minutes (match `liberdus-sc-dao` behavior)
- On load:
  - If cache exists and matches `chainId/contractAddress/deploymentBlock/schemaVersion`:
    - **Show cached proposals immediately**
    - If cache is stale (older than TTL), show a small “Refreshing…” status and refresh in background
  - If cache is missing/invalid/corrupt:
    - Fall back to normal RPC scan

**Scan start policy (first-time visitors):**
- If no cache exists, start with:
  - `EVENTS_START_BLOCK` (hardcoded, recommended) as the floor
  - `latestBlock` as the initial `toBlock` cursor
- This removes the need for a time-based cap while still keeping the scan bounded and deterministic.

**Write policy:**
- Update cache after:
  - First successful page fill (initial 25 proposals ready)
  - Each “Load more” (after extending the list / cursor)
- Always enforce max entries (drop oldest)

**Hydration strategy with caching:**
- Treat cached hydrated fields (e.g., `signed/executed`) as **best-effort** only.
- On load, hydrate the **currently visible page** via direct contract calls to refresh `signed/executed/deadline` quickly.

**Invalidation rules:**
- Invalidate cache when any of these change:
  - `chainId`, `contractAddress`, `deploymentBlock`, or `schemaVersion`
- Invalidate cache on JSON parse errors / unexpected shapes
- Optional: add a “Clear cache” link/button for debugging

Tasks:
- [x] Add cache constants + helpers (`loadCache()`, `saveCache()`, `clearCache()`)
- [x] Cache and restore proposals list + scan cursor in `ProposalsTab`
- [x] Enforce max cached items (e.g., 200–500)
- [x] Add TTL + background refresh behavior (“Refreshing…” UI)
- [x] Re-hydrate visible rows on load (direct contract calls) even when showing cached rows
- [x] Add optional “Clear cache” control (debug)

### Step 4.6 - Terminal Scan Cursor (Resolved Block Floor)

**Goal:** Avoid re-scanning blocks that only contain proposals which are already terminal (executed or expired), so we can start future log scans from a newer, safe floor.

**Why:** Once all proposals at/under a certain block are terminal and cached, we never need to re-query logs below that point. This reduces `eth_getLogs` load and speeds up refreshes.

**Definition:**
- **Terminal proposal** = `executed === true` **OR** `isOperationExpired(operationId) === true`.
- **Resolved block floor** = highest block where **all proposals at or below that block** are terminal.

**Approach:**
- Maintain a `resolvedThroughBlock` in the cache metadata.
- Update it only when we can prove a contiguous terminal range:
  - Sort cached proposals by `blockNumber` ascending.
  - Walk from the oldest proposal forward while proposals are terminal.
  - The last contiguous terminal proposal’s `blockNumber` becomes `resolvedThroughBlock`.
  - Stop as soon as a non-terminal proposal is found.
- Only advance the floor; never decrease it.

**Scan policy with this floor:**
- When scanning for new `OperationRequested` logs, set:
  - `fromBlock = max(EVENTS_START_BLOCK, resolvedThroughBlock + 1)`
- Keep `EVENTS_START_BLOCK` as the hard safety floor when no cache exists.

**Persistence:**
- Store `resolvedThroughBlock` alongside existing cache metadata.
- Invalidate if cache schema changes or data is corrupt.

Tasks:
- [x] Add `resolvedThroughBlock` to cache schema + storage
- [x] Compute contiguous terminal range after hydration updates
- [x] Use `resolvedThroughBlock + 1` as scan `fromBlock`
- [x] Guard against regressions (only move forward)

### Step 4.7 - Proposals Filters (Operation + Status)

**Goal:** Add two dropdown filters to the Proposals card header: one for operation type and one for status.

**UI placement:**
- Add a small filter row inside the Proposals card header area, above the list.
- Two `<select>` inputs:
  - **Operation**: All, Mint, Burn, Distribute, PostLaunch, Pause, Unpause, SetBridgeInCaller, SetBridgeInLimits, UpdateSigner
  - **Status**: All, Pending, Executed, Expired

**Behavior:**
- Filtering is **client-side** on the currently loaded proposals (including cached items).
- Keep pagination behavior intact (filters apply to displayed items).
- When filters change, re-render the list and re-run hydration only for visible rows.
- Persist filter selections in `localStorage` (keyed by chainId + contract address).

Tasks:
- [ ] Add filter dropdowns to `ProposalsTab` header markup
- [ ] Implement filter state + localStorage persistence
- [ ] Apply filters to cached and freshly loaded proposals
- [ ] Ensure "Load more" respects current filters

### PHASE 4 DELIVERABLE

✅ View and interact with existing proposals.

---

## PHASE 5: Propose Tab

**Goal:** Create new operation requests.

### Step 5.1 - Propose Tab Component

Create `ProposeTab` class

Methods:
- `load()` - Get form elements, initialize

Tasks:
- [x] Create class `ProposeTab`
- [x] Get form elements
- [x] Instantiate: `const proposeTab = new ProposeTab();`

### Step 5.2 - Operation Type Selector

Add operation type dropdown

Operation Types:
- Mint, Distribute, Burn, PostLaunch
- Pause, Unpause
- SetBridgeInCaller, SetBridgeInLimits, UpdateSigner

Tasks:
- [x] Create dropdown with operation types
- [x] Implement `onOperationTypeChange()` - update form fields

### Step 5.3 - Dynamic Form Fields

Show relevant fields based on operation type

Fields:
- Target address
- Value/amount
- Data (for some operations)

Tasks:
- [x] Show/hide fields based on operation
- [x] Add field validation

### Step 5.4 - Submit Operation

Implement proposal submission

Tasks:
- [x] Create `submitProposal()` method
- [x] Call `requestOperation(type, target, value, data)`
- [x] Show transaction pending/success/error states

### Step 5.5 - Mint Readiness (Token Next Mint Time)

Add a mint readiness banner under the Propose tab header (matching `liberdus-sc-dao`).

UI placement:
- Directly under the Propose tab header (`<div class="panel-header">...</div>`).
- Example structure (styling TBD):
  - `<div class="page_MintReadiness__NU9rL"><div style="color: red;">Last Mint: ...</div></div>`

Behavior:
- Read the last mint timestamp and cooldown/interval from the token contract (use the same read calls used in `liberdus-sc-dao`).
- Compute the next mint time and render:
  - `Last Mint: <date> - Ready` or `Not Ready: <time remaining>`
- Update on load and after any successful Mint proposal submission.
- Use red text for "Not Ready" and green text for "Ready" (or match current palette).

Tasks:
- [x] Identify contract read methods for last mint + cooldown (from `liberdus-sc-dao` / ABI)
- [x] Add a small Mint Readiness block under the Propose header
- [x] Implement a helper to compute time remaining and formatted output
- [x] Refresh the banner after a successful Mint proposal submission

### PHASE 5 DELIVERABLE

✅ Create new proposals via UI.

---

## PHASE 6: Bridge Tab

**Goal:** Bridge tokens in/out.

### Step 6.1 - Bridge Tab Component

Create `BridgeTab` class

Methods:
- `load()` - Get form elements, initialize

Tasks:
- [x] Create class `BridgeTab`
- [x] Get form elements
- [x] Instantiate: `const bridgeTab = new BridgeTab();`

### Step 6.2 - Bridge Type Selector

Add bridge type toggle/dropdown

Bridge Types:
- Bridge Out (token → coin)
- Bridge In (coin → token)

Tasks:
- [x] Create toggle/dropdown
- [x] Implement `onBridgeTypeChange()` - update form visibility

### Step 6.3 - Bridge Execution

Implement bridge submission

Tasks:
- [x] Create `submitBridge()` method
- [x] Call `bridgeOut()` or `bridgeIn()`
- [x] Show transaction status display

### PHASE 6 DELIVERABLE

✅ Functional bridge interface.

---

## PHASE 7: Polish & Mobile

**Goal:** Refinements, error handling, responsive design.

### Step 7.1 - Notification System

Create `NotificationManager` class

Methods:
- `load()` - Initialize notification container
- `success(message)` - Show success notification
- `error(message)` - Show error notification
- `warning(message)` - Show warning notification
- `info(message)` - Show info notification

Tasks:
- [x] Create class `ToastManager` (toast-style notifications)
- [x] Toast-style notifications
- [x] Instantiate: `const toastManager = new ToastManager();`

### Step 7.2 - Loading States

Add loading indicators

Tasks:
- [ ] Skeleton loaders for data fetching
- [ ] Button loading states during transactions
- [ ] Disable interactions during pending operations

### Step 7.3 - Mobile Responsive

Make UI mobile-friendly

Tasks:
- [ ] Tab bar: horizontal scroll or stacked
- [ ] Forms: full-width inputs
- [ ] Touch-friendly button sizes (44px minimum)
- [ ] Test on common mobile viewports

### PHASE 7 DELIVERABLE

✅ Production-ready UI.

---

## PHASE 8: Parameters Tab

**Goal:** Add a read-only Parameters tab with useful contract details (signers, addresses, limits).

### Step 8.1 - Parameters Tab Component

Create `ParametersTab` class

Methods:
- `load()` - Get DOM elements, initialize

Tasks:
- [ ] Create `ParametersTab` class in `js/components/parameters-tab.js`
- [ ] Add a new tab button and panel (`Parameters`) in `index.html`
- [ ] Instantiate: `const parametersTab = new ParametersTab();` and load in `app.js`

### Step 8.2 - Contract Detail Fetching

Read-only data to display (from contract):
- Contract address
- Chain ID
- Signers list (addresses)
- Required signatures (`REQUIRED_SIGNATURES`)
- Launch state (`isPreLaunch`)
- Paused state (`paused`)
- Bridge-in caller (`bridgeInCaller`)
- Bridge-in limits (`maxBridgeInAmount`, `bridgeInCooldown`)
- Minting info (`lastMintTime`, `MINT_INTERVAL`, `MAX_SUPPLY`, `MINT_AMOUNT`)

Tasks:
- [ ] Add a `refresh()` method to fetch and render details
- [ ] Format addresses (short + copy)
- [ ] Format amounts (LIB with 18 decimals) and durations (human readable)

### Step 8.3 - UI Layout & UX

Present details in a clean, scan-friendly layout:
- Use a two-column key/value grid (desktop)
- Stack layout on mobile
- Add copy-to-clipboard controls for addresses
- Add a small refresh control

Tasks:
- [ ] Add styles to `base.css` (or a new `parameters.css`)
- [ ] Add loading and error states (toast + inline placeholders)
- [ ] Respect tx-enabled gating (read-only OK without wallet)

### PHASE 8 DELIVERABLE

✅ Parameters tab shows contract metadata and signer info.

---

## PHASE 9: Performance & RPC Optimization (Reduce Request Count)

**Goal:** Reduce the number of JSON-RPC calls (especially bursts) while keeping UI data fresh.

**Why this matters:** On page load, the app currently performs many `eth_call` reads to populate UI. When the wallet is **not connected**, all of those reads go through the configured RPC (Infura) so they show up as a large number of requests and can hit rate limits. When the wallet **is connected**, many reads shift to the wallet provider (MetaMask) so they are less visible in Infura logs, but the app is still doing similar work.

### Key principles (best practice)

- **One provider instance** per transport (read-only RPC; wallet provider when connected).
- **Static network** providers whenever chainId is known (prevents repeated `eth_chainId` / network detection).
- **Batch reads with Multicall** instead of per-item `eth_call` loops.
- **Lazy-load** tab data (only fetch for the active tab; prefetch others later).
- **Cache + dedupe** (avoid re-fetching the same data repeatedly during a single session and across reloads).
- **Cap concurrency** (avoid bursting many calls at once).

### Step 9.1 - Provider layer hardening (reduce `eth_chainId`)

**Target outcome:** The app should perform at most **one** `eth_chainId` + **one** `eth_blockNumber` on startup for the read-only provider.

Tasks:
- [x] Use a shared singleton read-only provider (avoid creating multiple `JsonRpcProvider` instances)
- [x] Prefer static-network providers when chainId is known (`CONFIG.NETWORK.CHAIN_ID`)
- [x] Remove any helper APIs that create new read-only providers per call (return the singleton instead)

### Step 9.2 - Proposals hydration: Multicall-first (biggest call-count reduction)

**Problem:** Hydrating N proposals via `operations(opId)` + `isOperationExpired(opId)` does \(2N\) RPC calls.

**Solution:** Use `Multicall2.tryAggregate` to batch these reads:
- Build an array of calls: `operations(opId)` and `isOperationExpired(opId)` per opId
- Send in one `eth_call` (via Multicall2) per page
- Decode results and update rows

Tasks:
- [x] Add a `MulticallService` instance to the app (or wire one into `ContractManager`)
- [x] Implement `ContractManager.getOperationsBatch(operationIds)` as multicall-first (fallback to per-call when multicall is unavailable)
- [x] Update `ProposalsTab` hydration to call the batch API (`ContractManager.getOperationsBatch(...)`)
- [x] Ensure hydration is limited to visible rows (current page) to keep calls bounded

### Step 9.3 - Parameters + Propose: batch “header” reads

**Problem:** These tabs often read multiple independent constants (e.g., signers + required signatures + paused + mint params).

**Solution:** Batch “summary reads” with multicall (or at least parallelize with a small concurrency limit).

Tasks:
- [x] Add `ContractManager.getParametersBatch()` that batches common reads (signers, REQUIRED_SIGNATURES, paused, isPreLaunch, bridge params, mint params)
- [x] Use a short TTL in-memory cache for “mostly static” values (e.g., signers, REQUIRED_SIGNATURES)
- [x] Refresh “dynamic” values (e.g., `paused`, mint readiness) on a short interval or on relevant events only

### Step 9.4 - Lazy-load tabs + prefetch strategy

**Target outcome:** Initial load should fetch only what is required for the default visible tab.

Tasks:
- [x] Make each tab `load()` only set up DOM + listeners; do not fetch until tab becomes active
- [x] Add tab activation events in `TabBar` (e.g., `tabActivated` with `{ tabName }`)
- [x] On first activation, fetch and render; on subsequent activations, use cached state and refresh only if stale
- [x] Optional: prefetch the next likely tab with low priority after idle (`requestIdleCallback`)

### Step 9.5 - Cache + dedupe + concurrency control

Tasks:
- [x] Add an in-memory cache for request results keyed by `{ method, params, blockTag }` with a short TTL (10–30s)
- [x] Deduplicate in-flight RPC calls (same key → share the same Promise)
- [x] Add a small concurrency limiter for per-item fallbacks (e.g., max 3–5 concurrent `eth_call`s)

### Step 9.6 - Incremental updates (avoid full refresh work)

Tasks:
- [x] For proposals: check `latestBlock` and only scan `eth_getLogs` from `lastSeenBlock + 1` → `latest`
- [x] Only re-hydrate proposals whose status can change (pending)
- [x] Debounce refresh triggers from wallet events (account/chain changes can fire in bursts)

### PHASE 9 DELIVERABLE

✅ On typical page load, requests are reduced from “many per proposal” to “few per page”:
- Read-only provider init: ~2 RPC calls
- Proposals list load: 1 `eth_getLogs` (or chunked) + 1 multicall hydration per page
- Other tabs: minimal until activated

---

## Summary Timeline

| Phase | Description | Dependency |
|------:|-------------|------------|
| 1 | Skeleton & Foundation | None |
| 2 | Wallet Connection | Phase 1 |
| 3 | Config & Contract Setup | Phase 2 |
| 4 | Proposals Tab | Phase 3 |
| 5 | Propose Tab | Phase 3 |
| 6 | Bridge Tab | Phase 3 |
| 7 | Polish & Mobile | Phases 4-6 |
| 8 | Parameters Tab | Phase 3 |
| 9 | Performance & RPC Optimization | Phases 4-8 |

Note: Phases 4, 5, 6 can be developed in parallel once Phase 3 is complete.

---

## Files Reference

| New File | Based On |
|----------|----------|
| `js/app.js` (pattern) | `web-client-v2/app.js` |
| `css/base.css` | `web-client-v2/styles.css` (CSS variables section) |
| `css/wallet-popup.css` | `lib-lp-staking-frontend/css/wallet-popup.css` |
| `js/wallet/wallet-manager.js` | `lib-lp-staking-frontend/js/wallet/wallet-manager.js` |
| `js/wallet/metamask-connector.js` | `lib-lp-staking-frontend/js/wallet/metamask-connector.js` |
| `js/wallet/network-manager.js` | `lib-lp-staking-frontend/js/wallet/network-manager.js` |
| `js/wallet/wallet-popup.js` | `lib-lp-staking-frontend/js/components/wallet-popup.js` |
| Contract ABI | `liberdus-sc-dao/abi.json` |
| Operation types/logic | `liberdus-sc-dao/src/app/wagmi.ts` |

---

## Component Pattern Summary

### Class Structure

Each component follows this pattern:

```js
class ComponentName {
  constructor() {
    // Initialize properties only
    this.element = null;
  }

  load() {
    // 1. Get DOM elements
    this.element = document.getElementById('componentId');

    // 2. Set up event listeners
    this.element.addEventListener('click', () => this.handleClick());
  }

  // Component methods
  handleClick() { }
  open() { }
  close() { }
  render() { }
}

// Instantiate globally
const componentName = new ComponentName();
```

### Initialization Pattern

`app.js` - Main entry point:

```js
document.addEventListener('DOMContentLoaded', async () => {
  // Load UI components
  header.load();
  tabBar.load();

  // Load wallet system (order matters)
  walletManager.load();
  await walletManager.init();
  networkManager.load();
  networkManager.init();
  walletPopup.load();

  // Load tab content components
  proposalsTab.load();
  proposeTab.load();
  bridgeTab.load();

  // Load utility components
  notificationManager.load();

  // Restore previous wallet connection
  await walletManager.checkPreviousConnection();
});
```
