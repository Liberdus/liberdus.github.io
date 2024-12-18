# WebSocket Service Data Structures

This document outlines the key data structures used in the WebSocket service (`otc/js/services/WebSocket.js`).

## Order Structure

The main order structure is stored in the `orderCache` Map and contains the following fields:

```typescript
interface Order {
    // Basic Order Information
    id: number;                 // Unique order identifier
    maker: string;             // Address of order creator
    taker: string;             // Address of intended taker (or zero address)
    
    // Token Information
    sellToken: string;         // Address of token being sold
    sellAmount: BigNumber;     // Amount being sold
    buyToken: string;          // Address of token being bought
    buyAmount: BigNumber;      // Amount to buy
    
    // Order State
    timestamp: number;         // Creation timestamp
    status: 'Active' | 'Filled' | 'Canceled';  // Order status
    orderCreationFee: BigNumber;  // Fee paid to create order
    tries: number;             // Number of retry attempts
    
    // Timing Information
    timings: {
        createdAt: number;     // Creation timestamp
        expiresAt: number;     // Expiration timestamp (createdAt + orderExpiry)
        graceEndsAt: number;   // Grace period end (expiresAt + gracePeriod)
    };
    
    // Price and Deal Information
    dealMetrics: {
        price: number;         // Price ratio
        rate: number;          // Market rate
        deal: number;          // Deal score
        formattedSellAmount: string;  // Human-readable sell amount
        formattedBuyAmount: string;   // Human-readable buy amount
        sellTokenUsdPrice: number;    // USD price of sell token
        buyTokenUsdPrice: number;     // USD price of buy token
        lastUpdated: number;          // Last update timestamp
    };
}
```

## Token Cache Structure

Token information is cached in the `tokenCache` Map to avoid repeated contract calls:

```typescript
interface TokenInfo {
    address: string;      // Token contract address (lowercase)
    symbol: string;       // Token symbol (e.g., "ETH", "USDC")
    decimals: number;     // Token decimals (usually 18)
    name: string;        // Token full name
}
```

## Main Service Data Structures

The WebSocket service maintains several key data structures:

```typescript
class WebSocketService {
    // Core Caches
    private orderCache: Map<number, Order>;        // Maps order IDs to Order objects
    private tokenCache: Map<string, TokenInfo>;    // Maps token addresses to TokenInfo
    private subscribers: Map<string, Set<Function>>; // Maps event names to callback functions
    
    // WebSocket Connection
    private provider: ethers.providers.WebSocketProvider;
    private contract: ethers.Contract;
    
    // Request Queue Management
    private requestQueue: Array<Function>;
    private activeRequests: number;
    private lastRequestTime: number;
}
```

### Key Properties

- `orderCache`: Primary storage for all order information
- `tokenCache`: Caches token information to reduce network calls
- `subscribers`: Manages event subscriptions for real-time updates
- `requestQueue`: Manages rate-limited requests to the blockchain

## Usage Examples

```javascript
// Getting all active orders
const activeOrders = webSocketService.getOrders('Active');

// Checking if an order can be filled
const canFill = webSocketService.canFillOrder(order, currentUserAddress);

// Getting order status
const status = webSocketService.getOrderStatus(order);
```

