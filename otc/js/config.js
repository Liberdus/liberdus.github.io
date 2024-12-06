import { abi as CONTRACT_ABI } from './abi/OTCSwap.js';
import { ethers } from 'ethers';

const networkConfig = {
    "137": {
        name: "Polygon",
        displayName: "Polygon Mainnet",
        contractAddress: "0x8F37e9b4980340b9DE777Baa4B9c5B2fc1BDc837", // Update this after deployment
        contractABI: CONTRACT_ABI,
        explorer: "https://polygonscan.com",
        rpcUrl: "https://polygon-rpc.com",
        fallbackRpcUrls: [
            "https://rpc-mainnet.matic.network",
            "https://polygon-bor.publicnode.com",
            "https://polygon.llamarpc.com",
            "https://polygon.api.onfinality.io/public"
        ],
        chainId: "0x89",
        nativeCurrency: {
            name: "MATIC",
            symbol: "MATIC",
            decimals: 18
        },
        wsUrl: "wss://ws-mainnet.matic.network",
        fallbackWsUrls: [
            "wss://polygon-bor.publicnode.com",
            "wss://polygon.gateway.tenderly.co",
            "wss://polygon.api.onfinality.io/public-ws"
        ]
    },
};

export const getAllNetworks = () => Object.values(networkConfig);

export const DEBUG_CONFIG = {
    APP: true,
    WEBSOCKET: true,
    COMPONENTS: true,
    WALLET: true,
    VIEW_ORDERS: true,
    CREATE_ORDER: true,
    MY_ORDERS: true,
    TAKER_ORDERS: true,
    CLEANUP_ORDERS: true,
    WALLET_UI: true,
    BASE_COMPONENT: true,
    // Add more specific flags as needed
};

export const isDebugEnabled = (component) => {
    // Check if debug mode is forced via localStorage
    const localDebug = localStorage.getItem('debug');
    if (localDebug) {
        const debugSettings = JSON.parse(localDebug);
        return debugSettings[component] ?? DEBUG_CONFIG[component];
    }
    return DEBUG_CONFIG[component];
};

export class WalletManager {
    constructor() {
        // Update initial chainId check in connect method from "80002" to "137"
        this.contractAddress = networkConfig["137"].contractAddress;
        // Rest of the constructor remains the same
    }
    
    async switchToPolygon() {
        const config = networkConfig["137"];
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: config.chainId }],
            });
        } catch (error) {
            if (error.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: config.chainId,
                        chainName: config.name,
                        nativeCurrency: config.nativeCurrency,
                        rpcUrls: [config.rpcUrl, ...config.fallbackRpcUrls],
                        blockExplorerUrls: [config.explorer]
                    }],
                });
            } else {
                throw error;
            }
        }
    }

    handleChainChanged(chainId) {
        this.chainId = chainId;
        this.notifyListeners('chainChanged', { chainId });
        if (this.onChainChange) {
            this.onChainChange(chainId);
        }
        
        const decimalChainId = parseInt(chainId, 16).toString();
        if (decimalChainId !== "137") {
            this.switchToPolygon();
        }
    }

    // Rest of the class implementation remains the same
}

export const walletManager = new WalletManager();
export const getNetworkConfig = () => networkConfig["137"];