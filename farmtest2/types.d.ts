// Global type declarations for the LP Staking Frontend
declare global {
    interface Window {
        NetworkIndicator: {
            update: (indicatorId: string, selectorId: string, context?: string) => Promise<void>;
        };
        networkSelector: {
            init: (onNetworkChange?: Function) => void;
            createSelector: (containerId: string, context?: string) => void;
            addNetworkToMetaMask: (networkKeyOrObject: string | Object) => Promise<boolean>;
            addNetworkToMetaMaskAndReload: (networkKey: string) => Promise<void>;
        };
    }
}

export {};
