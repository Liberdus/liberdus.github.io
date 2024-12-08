import { ethers } from 'ethers';
import { getNetworkConfig } from '../config.js';

const LIB_LOGO = new URL('../../assets/32.png', import.meta.url).href;

// Export the network tokens constant so it can be imported elsewhere
export const NETWORK_TOKENS = {
    Polygon: [
        {
            address: `0x693ed886545970F0a3ADf8C59af5cCdb6dDF0a76`,
            symbol: `LIB`,
            name: `Liberdus`,
            decimals: 18,
            logoURI: LIB_LOGO
        },
        {
            address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            symbol: 'WETH',
            name: 'Wrapped Ether',
            decimals: 18,
            logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619/logo.png'
        },
        {
            address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
            logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174/logo.png'
        },
        {
            name: `Wrapped MATIC`,
            symbol: `WMATIC`,
            address: `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270`,
            decimals: 18,
            logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270/logo.png'
        },
        {
            name: `USDT`,
            symbol: `USDT`,
            address: `0xc2132D05D31c914a87C6611C10748AEb04B58e8F`,
            decimals: 6,
            logoURI: `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0xc2132D05D31c914a87C6611C10748AEb04B58e8F/logo.png`
        },
        {
            name: 'Wrapped Bitcoin',
            symbol: `WBTC`,
            address: `0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6`,
            decimals: 18,
            logoURI: `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6/logo.png`
        },
        {
            name: `The Spork Dao Token (PoS)`,
            symbol: `SPORK`,
            address: `0x9CA6a77C8B38159fd2dA9Bd25bc3E259C33F5E39`,
            decimals: 18,
            logoURI: `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0x2953399124f0cbb46d333b213f0a01d3b7f2d08d/logo.png`
        }

    ]
};

export async function getTokenList() {
    try {
        const networkConfig = getNetworkConfig();
        console.log('Getting tokens for network:', networkConfig.name);
        
        // Get predefined tokens for current network
        const networkTokens = NETWORK_TOKENS[networkConfig.name] || [];
        console.log('Predefined tokens:', networkTokens);
        
        // Get user's wallet tokens with balances
        const walletTokens = await getUserWalletTokens();
        console.log('Wallet tokens:', walletTokens);
        
        // Combine and merge duplicates, preserving balance information
        let allTokens = [...networkTokens];
        
        // Update or add wallet tokens, preserving balance information
        walletTokens.forEach(walletToken => {
            const existingIndex = allTokens.findIndex(t => 
                t.address.toLowerCase() === walletToken.address.toLowerCase()
            );
            
            if (existingIndex >= 0) {
                // Update existing token with balance
                allTokens[existingIndex] = {
                    ...allTokens[existingIndex],
                    balance: walletToken.balance
                };
            } else {
                // Add new token
                allTokens.push(walletToken);
            }
        });

        // Remove native token
        const POL_NativeToken_Address = '0x0000000000000000000000000000000000001010';
        allTokens = allTokens.filter(token => 
            token.address.toLowerCase() !== POL_NativeToken_Address.toLowerCase()
        );

        console.log('Final token list:', allTokens);
        return allTokens;
    } catch (error) {
        console.error('Error getting token list:', error);
        return NETWORK_TOKENS[getNetworkConfig().name] || [];
    }
}
async function getUserWalletTokens() {
    if (!window.ethereum) {
        console.log('No ethereum provider found');
        return [];
    }

    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const address = await provider.getSigner().getAddress();
        console.log('Getting tokens for address:', address);

        // Get predefined tokens for current network
        const networkConfig = getNetworkConfig();
        const predefinedTokens = NETWORK_TOKENS[networkConfig.name] || [];
        const tokens = [];

        // Check balances for predefined tokens first
        for (const token of predefinedTokens) {
            try {
                const tokenContract = new ethers.Contract(
                    token.address,
                    [
                        'function balanceOf(address) view returns (uint256)',
                        'function decimals() view returns (uint8)'
                    ],
                    provider
                );

                try {
                    const [rawBalance, decimals] = await Promise.all([
                        tokenContract.balanceOf(address),
                        tokenContract.decimals()
                    ]);

                    // Format balance using the correct decimals
                    const balance = ethers.utils.formatUnits(rawBalance, decimals);

                    if (rawBalance.gt(0)) {
                        tokens.push({
                            ...token,
                            balance
                        });
                        console.log(`Found ${token.symbol} balance: ${balance}`);
                    } else {
                        console.log(`No ${token.symbol} balance found`);
                        tokens.push({
                            ...token,
                            balance: '0'
                        });
                    }
                } catch (balanceError) {
                    console.log(`No ${token.symbol} balance or first interaction needed`);
                    tokens.push({
                        ...token,
                        balance: '0'
                    });
                }
            } catch (error) {
                console.warn(`Error loading token contract at ${token.address}:`, error.message);
                continue;
            }
        }

        // Get transfer events to find other tokens the user might have
        const BLOCKS_PER_DAY = 34560;
        const DAYS = 30;
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = currentBlock - (BLOCKS_PER_DAY * DAYS);

        // Create filters for both incoming and outgoing transfers
        const filters = [
            {
                fromBlock,
                toBlock: 'latest',
                topics: [
                    ethers.utils.id('Transfer(address,address,uint256)'),
                    null,
                    ethers.utils.hexZeroPad(address, 32) // To address
                ]
            },
            {
                fromBlock,
                toBlock: 'latest',
                topics: [
                    ethers.utils.id('Transfer(address,address,uint256)'),
                    ethers.utils.hexZeroPad(address, 32), // From address
                    null
                ]
            }
        ];

        // Get all transfer events
        const allLogs = await Promise.all(filters.map(filter => provider.getLogs(filter)));
        const tokenAddresses = [...new Set(allLogs.flat().map(log => log.address))];
        
        console.log(`Found ${tokenAddresses.length} unique token addresses from transfers`);

        // For each token address, get its details and current balance
        for (const tokenAddress of tokenAddresses) {
            try {
                // Verify contract exists
                const code = await provider.getCode(tokenAddress);
                if (code === '0x') continue;

                // Create contract interface
                const tokenContract = new ethers.Contract(
                    tokenAddress,
                    [
                        'function symbol() view returns (string)',
                        'function name() view returns (string)',
                        'function decimals() view returns (uint8)',
                        'function balanceOf(address) view returns (uint256)'
                    ],
                    provider
                );

                // Get token details and balance
                const [symbol, name, decimals, rawBalance] = await Promise.all([
                    tokenContract.symbol(),
                    tokenContract.name(),
                    tokenContract.decimals(),
                    tokenContract.balanceOf(address)
                ]);

                // Format balance using the correct decimals
                const balance = ethers.utils.formatUnits(rawBalance, decimals);

                // Only add tokens with non-zero balance
                if (rawBalance.gt(0)) {
                    tokens.push({
                        address: tokenAddress,
                        symbol,
                        name,
                        decimals,
                        balance,
                        logoURI: await getTokenIcon(tokenAddress)
                    });
                    console.log(`Added ${symbol} with balance ${balance}`);
                }
            } catch (error) {
                console.warn(`Error loading token at ${tokenAddress}:`, error);
                continue;
            }
        }

        console.log(`Found ${tokens.length} tokens with non-zero balance`);
        return tokens;
    } catch (error) {
        console.error('Error getting user wallet tokens:', error);
        return [];
    }
}

async function getTokenIcon(address) {
    // Skip icon fetch for test tokens (you can adjust this check based on your needs)
    if (address.toLowerCase().includes('test')) {
        return null;
    }

    const iconCache = new Map();
    if (iconCache.has(address)) {
        return iconCache.get(address);
    }

    const sources = [
        // Chain-specific token lists (most reliable)
        async () => {
            try {
                return await getChainTokenList(address);
            } catch {
                return null;
            }
        },
        // CoinGecko
        async () => {
            try {
                return await getCoinGeckoIcon(address);
            } catch {
                return null;
            }
        },
        // Trust Wallet
        async () => {
            try {
                const icon = getTrustWalletIcon(address);
                const exists = await checkImageExists(icon);
                return exists ? icon : null;
            } catch {
                return null;
            }
        }
    ];

    for (const getIcon of sources) {
        const icon = await getIcon();
        if (icon) {
            iconCache.set(address, icon);
            return icon;
        }
    }

    // Cache null result to avoid future requests
    iconCache.set(address, null);
    return null;
}

// Helper function to get token icon from chain-specific token list
async function getChainTokenList(address) {
    try {
        const response = await fetch('https://raw.githubusercontent.com/maticnetwork/polygon-token-list/master/src/tokens.json');
        if (!response.ok) return null;
        const data = await response.json();
        const token = data.tokens.find(t => t.address.toLowerCase() === address.toLowerCase());
        return token?.logoURI || null;
    } catch {
        return null;
    }
}

// Helper function to get token icon from CoinGecko
async function getCoinGeckoIcon(address) {
    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/polygon/contract/${address}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data.image?.small || null;
    } catch {
        return null;
    }
}

// Helper function to get token icon from Trust Wallet
function getTrustWalletIcon(address) {
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/${address}/logo.png`;
}

// Helper function to check if an image exists
async function checkImageExists(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch {
        return false;
    }
} 