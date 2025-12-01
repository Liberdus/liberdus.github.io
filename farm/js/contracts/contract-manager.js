(function(global) {
    'use strict';


    if (global.ContractManager) {
        console.warn('⚠️ ContractManager already exists, skipping...');
        return;
    }
    if (global.contractManager) {
        console.warn('⚠️ contractManager instance already exists, skipping...');
        return;
    }

class ContractManager {
    constructor() {

        this.stakingContract = null;
        this.rewardTokenContract = null;
        this.lpTokenContracts = new Map(); // Map of LP token contracts


        this.provider = null;
        this.signer = null;
        this.fallbackProviders = [];
        this.currentProviderIndex = 0;
        this.disabledFeatures = new Set(); // Track disabled features due to contract limitations

        // State management
        this.isInitialized = false;
        this.isInitializing = false;
        this.initializationPromise = null;
        this.readyCallbacks = [];
        this.eventListeners = [];
        this.contractABIs = new Map();
        this.contractAddresses = new Map();

        // Enhanced components
        this.gasEstimator = null;
        this.transactionStatus = null;
        this.multicallService = null; // Multicall2 for batch loading optimization

        // Configuration with enhanced provider fallback - OPTIMIZED FOR SPEED
        this.config = {
            maxRetries: 2, // Reduced from 3 for faster failure
            retryDelay: 400, // Reduced from 800ms for faster recovery
            providerTimeout: 2000 // Reduced from 5000ms for faster failover
        };

    }

    /**
     * Initialize the contract manager with read-only provider (no wallet required)
     */
    async initializeReadOnly() {
        if (this.isInitializing) {
            console.log('⏳ ContractManager initialization already in progress, waiting...');
            return this.initializationPromise;
        }

        if (this.isInitialized) {
            console.warn('ContractManager already initialized, skipping...');
            return;
        }

        this.isInitializing = true;

        try {
            this.initializationPromise = this._initializeReadOnlyInternal();
            await this.initializationPromise;

            this.isInitialized = true;
            this.isInitializing = false;
            this._notifyReadyCallbacks();

        } catch (error) {
            this.isInitializing = false;
            console.error('❌ ContractManager read-only initialization failed:', error);
            throw error;
        }
    }

    /**
     * Internal read-only initialization logic
     */
    async _initializeReadOnlyInternal() {
        try {
            // Check if app config is available
            if (!window.CONFIG) {
                console.error('❌ CONFIG not available - cannot initialize contracts');
                throw new Error('CONFIG not loaded');
            }

            // Check if ethers is available
            if (!window.ethers) {
                console.error('❌ Ethers.js not available - cannot initialize contracts');
                throw new Error('Ethers.js not loaded');
            }
            
            // Use the current network's RPC URLs (resolved from CONFIG each time)
            const configuredRpcUrls = this.getAllRPCUrls();

            if (configuredRpcUrls.length === 0) {
                throw new Error('No RPC URL configured for read-only mode');
            }

            console.log(`🔍 Searching for working RPC provider from ${configuredRpcUrls.length} configured endpoints...`);

            // Find a working provider using the comprehensive health checks
            this.provider = await this.getWorkingProvider();
            this.signer = null; // No signer in read-only mode
            console.log('✅ Using working provider:', this.provider.connection?.url || 'Unknown');

            // Initialize fallback providers (read-only)
            await this.initializeFallbackProviders();

            // Initialize Multicall service for batch loading optimization
            if (window.MulticallService && this.provider) {
                try {
                    this.multicallService = new window.MulticallService();
                    const network = await this.provider.getNetwork();
                    const initialized = await this.multicallService.initialize(this.provider, network.chainId);
                    if (!initialized) {
                        console.warn('⚠️ Multicall service not available - using fallback methods');
                    }
                } catch (error) {
                    console.error('⚠️ Failed to initialize Multicall:', error.message);
                }
            }

            // Load contract ABIs
            await this.loadContractABIs();

            // Seed staking address from configuration so we can build the contract instance next
            this.loadStakingAddressFromConfig();

            // Initialize contract instances (read-only)
            await this.initializeContractsReadOnly();

            // Verify contract function availability (with graceful fallback)
            try {
                await this.verifyContractFunctions();
            } catch (error) {
                console.error('⚠️ Contract function verification failed, but continuing:', error.message);
                // Don't throw - allow system to continue with limited functionality
            }

            // Mark as ready even if some verifications failed
            this.isReadyFlag = true;

        } catch (error) {
            console.error('❌ Read-only initialization failed:', error);
            console.error('❌ Error stack:', error.stack);

            // Still mark as ready with limited functionality
            this.isReadyFlag = true;
            console.error('⚠️ ContractManager marked as ready with limited functionality');

            throw error;
        }
    }

    /**
     * Initialize contract instances in read-only mode
     */
    async initializeContractsReadOnly() {
        try {
            let contractsInitialized = 0;

            // Initialize staking contract
            const stakingAddress = this.contractAddresses.get('STAKING');
            const stakingABI = this.contractABIs.get('STAKING');

            if (stakingAddress && stakingABI && this.isValidContractAddress(stakingAddress)) {
                try {
                    this.stakingContract = new ethers.Contract(stakingAddress, stakingABI, this.provider);
                    contractsInitialized++;
                } catch (contractError) {
                    console.error('❌ Failed to create staking contract:', contractError.message);
                    console.error('❌ Contract error stack:', contractError.stack);
                    console.error('Continuing without staking contract...');
                }
            } else {
                console.error('Staking contract address invalid or missing, skipping:', stakingAddress);
            }

            try {
                await this.loadContractAddresses();
            } catch (addressError) {
                console.error('Failed to refresh reward/LP addresses from contract (read-only):', addressError.message);
            }

            // Initialize reward token contract
            const rewardTokenAddress = this.contractAddresses.get('REWARD_TOKEN');
            const erc20ABI = this.contractABIs.get('ERC20');

            if (rewardTokenAddress && erc20ABI && this.isValidContractAddress(rewardTokenAddress)) {
                try {
                    this.rewardTokenContract = new ethers.Contract(rewardTokenAddress, erc20ABI, this.provider);
                    contractsInitialized++;
                } catch (contractError) {
                    console.error('❌ Failed to create reward token contract:', contractError.message);
                    console.error('❌ Contract error stack:', contractError.stack);
                    console.error('Continuing without reward token contract...');
                }
            } else {
                console.error('Reward token address invalid or missing, skipping:', rewardTokenAddress);
            }

            console.log(`📊 Contract instances initialized: ${contractsInitialized}`);

            if (contractsInitialized === 0) {
                throw new Error('No contract instances could be initialized');
            }

        } catch (error) {
            console.error('❌ Failed to initialize contract instances:', error);
            console.error('❌ Error stack:', error.stack);
            throw error;
        }
    }

    /**
     * Upgrade from read-only mode to wallet mode
     */
    async upgradeToWalletMode(provider, signer) {
        try {
            this.isInitializing = true;

            // Update provider and signer, then delegate to shared initialization path
            this.provider = provider;
            this.signer = signer;

            await this._performInitialization(provider, signer);

            // _performInitialization sets isInitialized and notifies callbacks
            this.isInitializing = false;

            // Update any wallet-dependent helpers
            if (this.gasEstimator) {
                this.gasEstimator.updateProvider(provider);
            }
        } catch (error) {
            this.isInitializing = false;
            console.error('❌ Failed to upgrade to wallet mode:', error);
            throw error;
        }
    }

    /**
     * Initialize contract manager with comprehensive provider setup (wallet mode)
     */
    async initialize(provider, signer) {
        // Prevent multiple simultaneous initializations
        if (this.isInitializing) {
            console.log('ContractManager initialization already in progress, waiting...');
            return this.initializationPromise;
        }

        if (this.isInitialized) {
            console.log('ContractManager already initialized');
            return true;
        }

        this.isInitializing = true;
        this.initializationPromise = this._performInitialization(provider, signer);

        try {
            const result = await this.initializationPromise;
            this.isInitializing = false;
            return result;
        } catch (error) {
            this.isInitializing = false;
            this.initializationPromise = null;
            throw error;
        }
    }

    /**
     * Internal initialization method
     */
    async _performInitialization(provider, signer) {
        try {
            // Set primary provider and signer
            this.provider = provider;
            this.signer = signer;

            // Initialize fallback providers
            await this.initializeFallbackProviders();

            // Initialize Multicall service for batch loading optimization
            if (window.MulticallService) {
                this.multicallService = new window.MulticallService();
                const chainId = await this.provider.getNetwork().then(n => n.chainId);
                const initialized = await this.multicallService.initialize(this.provider, chainId);
                if (!initialized) {
                    console.warn('⚠️ Multicall service not available - using fallback methods');
                }
            }

            // Load contract ABIs
            await this.loadContractABIs();

            // Seed staking address from configuration before building the contract instance
            this.loadStakingAddressFromConfig();

            // Initialize contract instances
            await this.initializeContracts();

            // Verify contract connections
            await this.verifyContractConnections();

            this.isInitialized = true;

            // Notify all waiting callbacks
            this._notifyReadyCallbacks();

            return true;
        } catch (error) {
            console.error('❌ Failed to initialize ContractManager:', error);
            await this.handleInitializationError(error);
            throw error;
        }
    }

    /**
     * Get a working provider with comprehensive RPC testing (ENHANCED)
     */
    async getWorkingProvider() {
        const rpcUrls = this.getAllRPCUrls();

        console.log(`🔄 Testing ${rpcUrls.length} RPC endpoints for reliability...`);

        for (let i = 0; i < rpcUrls.length; i++) {
            const rpcUrl = rpcUrls[i];
            try {
                console.log(`🔄 Testing RPC ${i + 1}/${rpcUrls.length}: ${rpcUrl}`);

                // Use longer timeout for local development
                const isLocalhost = rpcUrl.includes('127.0.0.1') || rpcUrl.includes('localhost');
                const timeout = isLocalhost ? 15000 : 8000; // 15 seconds for localhost, 8 for others

                const provider = new ethers.providers.JsonRpcProvider({
                    url: rpcUrl,
                    timeout: timeout
                });

                console.log(`🔧 Using ${timeout}ms timeout for ${isLocalhost ? 'local' : 'remote'} RPC: ${rpcUrl}`);

                // Test basic connectivity
                const networkPromise = provider.getNetwork();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Network timeout')), 8000)
                );

                const network = await Promise.race([networkPromise, timeoutPromise]);

                // Verify correct network (using centralized config)
                const expectedChainId = window.networkSelector?.getCurrentChainId();
                if (network.chainId !== expectedChainId) {
                    throw new Error(`Wrong network: expected ${expectedChainId}, got ${network.chainId}`);
                }

                // Test block number retrieval (tests node sync)
                const blockNumber = await Promise.race([
                    provider.getBlockNumber(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Block number timeout')), 5000))
                ]);

                console.log(`✅ RPC ${i + 1} working: Chain ${network.chainId}, Block ${blockNumber}`);
                return provider;

            } catch (error) {
                // Handle specific error types
                if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
                    console.error(`❌ RPC ${i + 1} failed: Authentication error (401) - ${rpcUrl}`);
                } else if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
                    console.error(`❌ RPC ${i + 1} failed: Access forbidden (403) - ${rpcUrl}`);
                } else if (error.message?.includes('429') || error.message?.includes('rate limit')) {
                    console.error(`❌ RPC ${i + 1} failed: Rate limited (429) - ${rpcUrl}`);
                } else {
                    console.error(`❌ RPC ${i + 1} failed: ${error.message}`);
                }
                continue;
            }
        }

        throw new Error('All RPC endpoints failed - no working provider available');
    }

    /**
     * Get all available RPC URLs from configuration
     */
    getAllRPCUrls() {
        const rpcUrls = [];
        const networkConfig = window.networkSelector?.getCurrentNetworkConfig();

        if (networkConfig?.RPC_URL) {
            rpcUrls.push(networkConfig.RPC_URL);
        }

        if (Array.isArray(networkConfig?.FALLBACK_RPCS)) {
            rpcUrls.push(...networkConfig.FALLBACK_RPCS.filter(Boolean));
        }

        const uniqueRpcUrls = [...new Set(rpcUrls.filter(Boolean))];
        return uniqueRpcUrls;
    }

    /**
     * Initialize fallback providers for redundancy
     */
    async initializeFallbackProviders() {
        try {
            this.fallbackProviders = [];
            this.currentProviderIndex = 0;

            const rpcUrls = this.getAllRPCUrls();

            if (rpcUrls.length === 0) {
                throw new Error('No RPC URLs available for fallback providers');
            }

            // Test each RPC URL with enhanced error handling
            const testResults = [];

            for (let i = 0; i < rpcUrls.length; i++) {
                const rpcUrl = rpcUrls[i];
                const testResult = { url: rpcUrl, success: false, error: null, chainId: null };

                try {
                    console.log(`🔄 Testing RPC ${i + 1}/${rpcUrls.length}:`, rpcUrl);

                    // Create provider with connection info
                    const fallbackProvider = new ethers.providers.JsonRpcProvider({
                        url: rpcUrl,
                        timeout: 10000 // 10 second timeout
                    });

                    // Test connection with multiple timeouts
                    const networkPromise = fallbackProvider.getNetwork();
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Connection timeout (10s)')), 10000)
                    );

                    const network = await Promise.race([networkPromise, timeoutPromise]);

                    // Verify correct network (using centralized config when available)
                    const expectedChainId = window.networkSelector?.getCurrentChainId();
                    if (expectedChainId != null && network.chainId !== expectedChainId) {
                        throw new Error(`Wrong network: expected ${expectedChainId}, got ${network.chainId}`);
                    }

                    // Test a simple call to ensure provider is fully functional
                    const blockNumber = await Promise.race([
                        fallbackProvider.getBlockNumber(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Block number timeout')), 5000))
                    ]);

                    this.fallbackProviders.push(fallbackProvider);
                    testResult.success = true;
                    testResult.chainId = network.chainId;

                    console.log(`✅ RPC ${i + 1} SUCCESS:`, rpcUrl, `(Chain: ${network.chainId}, Block: ${blockNumber})`);

                    // Continue testing more providers for redundancy (don't break after first success)
                    if (this.fallbackProviders.length >= 3) {
                        console.log('✅ Sufficient providers available (3+), stopping tests');
                        break;
                    }

                } catch (error) {
                    testResult.error = error.message;
                    console.error(`❌ RPC ${i + 1} FAILED:`, rpcUrl, '→', error.message);
                }

                testResults.push(testResult);
            }

            // Log detailed test results
            console.log('📊 RPC Test Results Summary:');
            testResults.forEach((result, index) => {
                const status = result.success ? '✅' : '❌';
                const details = result.success
                    ? `Chain ID: ${result.chainId}`
                    : `Error: ${result.error}`;
                console.log(`  ${status} RPC ${index + 1}: ${result.url} - ${details}`);
            });

            console.log(`📊 Successfully initialized ${this.fallbackProviders.length} fallback providers`);

            if (this.fallbackProviders.length === 0) {
                const errorMsg = 'No working fallback providers found. All RPC endpoints failed connection tests.';
                console.error('❌ CRITICAL:', errorMsg);
                console.error('❌ Test results:', testResults.map(r => `${r.url}: ${r.error || 'Success'}`));
                throw new Error(errorMsg);
            }

        } catch (error) {
            console.error('❌ Failed to initialize fallback providers:', error);
            throw error;
        }
    }

    /**
     * Load contract ABIs from configuration or external sources (FIXED)
     */
    async loadContractABIs() {
        try {
            // FIXED: Use ABI from CONFIG instead of hardcoded
            let stakingABI;

            if (window.CONFIG?.ABIS?.STAKING_CONTRACT) {
                stakingABI = window.CONFIG.ABIS.STAKING_CONTRACT;
            } else {
                console.warn('⚠️ CONFIG ABI not found, using fallback ABI');
                // Fallback ABI with essential functions only (no duplicates)
                stakingABI = [
                    "function rewardToken() external view returns (address)",
                    "function hourlyRewardRate() external view returns (uint256)",
                    "function REQUIRED_APPROVALS() external view returns (uint256)",
                    "function actionCounter() external view returns (uint256)",
                    "function totalWeight() external view returns (uint256)",
                    "function getPairs() external view returns (tuple(address lpToken, string pairName, string platform, uint256 weight, bool isActive)[])",
                    "function getActivePairs() external view returns (address[])",
                    "function pairs(address lpToken) external view returns (address lpToken_, string pairName, string platform, uint256 weight, bool isActive)",
                    "function getPairInfo(address lpToken) external view returns (address token, string platform, uint256 weight, bool isActive)",
                    "function getActionPairs(uint256 actionId) external view returns (address[])",
                    "function getActionWeights(uint256 actionId) external view returns (uint256[])",
                    "function getActionApproval(uint256 actionId) external view returns (address[])",
                    "function actions(uint256 actionId) external view returns (uint8 actionType, uint256 newHourlyRewardRate, address pairToAdd, string memory pairNameToAdd, string memory platformToAdd, uint256 weightToAdd, address pairToRemove, address recipient, uint256 withdrawAmount, bool executed, bool expired, uint8 approvals, uint256 proposedTime, bool rejected)",
                    "function stake(address lpToken, uint256 amount) external",
                    "function unstake(address lpToken, uint256 amount, bool claimRewards) external",
                    "function claimRewards(address lpToken) external",

                    // Admin role functions
                    "function hasRole(bytes32 role, address account) external view returns (bool)",
                    "function grantRole(bytes32 role, address account) external",
                    "function revokeRole(bytes32 role, address account) external",

                    // Multi-signature proposal functions
                    "function proposeSetHourlyRewardRate(uint256 newRate) external returns (uint256)",
                    "function proposeUpdatePairWeights(address[] calldata lpTokens, uint256[] calldata weights) external returns (uint256)",
                    "function proposeAddPair(address lpToken, string calldata pairName, string calldata platform, uint256 weight) external returns (uint256)",
                    "function proposeRemovePair(address lpToken) external returns (uint256)",
                    "function proposeChangeSigner(address oldSigner, address newSigner) external returns (uint256)",
                    "function proposeWithdrawRewards(address recipient, uint256 amount) external returns (uint256)",

                    // Multi-signature approval functions
                    "function approveAction(uint256 actionId) external",
                    "function executeAction(uint256 actionId) external",
                    "function rejectAction(uint256 actionId) external",
                    "function isActionExpired(uint256 actionId) external view returns (bool)",
                    "function getSigners() external view returns (address[])",
                    "function hasApproved(uint256 actionId, address signer) external view returns (bool)",
                    "function hasRejected(uint256 actionId, address signer) external view returns (bool)",

                    // Utility functions
                    "function cleanupExpiredActions() external"
                ];
            }

            // ERC20 Token ABI (FIXED: Use CONFIG or fallback)
            let erc20ABI;
            if (window.CONFIG?.ABIS?.ERC20) {
                erc20ABI = window.CONFIG.ABIS.ERC20;
            } else {
                erc20ABI = [
                    "function balanceOf(address owner) external view returns (uint256)",
                    "function allowance(address owner, address spender) external view returns (uint256)",
                    "function approve(address spender, uint256 amount) external returns (bool)",
                    "function transfer(address to, uint256 amount) external returns (bool)",
                    "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
                    "function name() external view returns (string)",
                    "function symbol() external view returns (string)",
                    "function decimals() external view returns (uint8)",
                    "function totalSupply() external view returns (uint256)"
                ];
            }

            // Store ABIs
            this.contractABIs.set('STAKING', stakingABI);
            this.contractABIs.set('ERC20', erc20ABI);
        } catch (error) {
            console.error('Failed to load contract ABIs:', error);
            throw error;
        }
    }

    /**
     * Load staking contract address from configuration so we can build the contract instance.
     */
    loadStakingAddressFromConfig() {
        try {
            const config = window.CONFIG;

            if (!config) {
                console.error('❌ No configuration found (CONFIG)');
                throw new Error('Configuration not available');
            }

            const stakingAddress = window.networkSelector?.getStakingContractAddress();
            console.log('   - Staking contract (config):', stakingAddress);

            if (stakingAddress && this.isValidContractAddress(stakingAddress)) {
                this.contractAddresses.set('STAKING', stakingAddress);
                console.log('Valid staking contract address loaded from config:', stakingAddress);
            } else {
                this.contractAddresses.delete('STAKING');
                console.log('No valid staking contract address provided in config');
            }
        } catch (error) {
            console.error('Failed to load staking contract address from config:', error);
            throw error;
        }
    }

    /**
     * Load reward token and LP token addresses from the staking contract.
     */
    async loadContractAddresses() {
        try {
            if (!this.stakingContract) {
                console.log('Staking contract not initialized; skipping contract-derived addresses');
                return;
            }

            const stakingAddress = this.contractAddresses.get('STAKING');
            if (!stakingAddress || !this.isValidContractAddress(stakingAddress)) {
                console.warn('⚠️ Staking address missing or invalid; cannot load contract-derived addresses');
                return;
            }

            try {
                const rewardTokenAddress = await this.stakingContract.rewardToken();
                if (this.isValidContractAddress(rewardTokenAddress)) {
                    this.contractAddresses.set('REWARD_TOKEN', rewardTokenAddress);
                } else {
                    this.contractAddresses.delete('REWARD_TOKEN');
                    console.warn('⚠️ Received invalid reward token address from contract');
                }
            } catch (error) {
                this.contractAddresses.delete('REWARD_TOKEN');
                console.error('⚠️ Unable to read reward token from contract:', error.message);
            }

            const existingLPKeys = new Set(
                [...this.contractAddresses.keys()].filter(key => key.startsWith('LP_'))
            );
            const activeLPKeys = new Set();

            let pairsRetrieved = false;

            try {
                const pairs = await this.stakingContract.getPairs();
                if (Array.isArray(pairs)) {
                    pairsRetrieved = true;
                    console.log(`✅ Loaded ${pairs.length} LP pair definitions from contract`);

                    pairs.forEach((pair, index) => {
                        if (!pair) {
                            return;
                        }

                        const tuple = Array.isArray(pair) ? pair : [];
                        const lpTokenAddress = tuple[0] || pair.lpToken;
                        const rawPairName = tuple[1] || pair.pairName || pair.name;
                        const isActive = tuple[4] ?? pair.isActive;

                        if (!isActive) {
                            return;
                        }

                        if (!this.isValidContractAddress(lpTokenAddress)) {
                            console.log(`Skipping LP pair with invalid address at index ${index}:`, lpTokenAddress);
                            return;
                        }

                        const normalizedName = this.normalizePairKey(rawPairName);
                        if (!normalizedName) {
                            console.log(`Skipping LP pair with missing name at index ${index}`);
                            return;
                        }

                        const mapKey = `LP_${normalizedName}`;
                        this.contractAddresses.set(mapKey, lpTokenAddress);
                        activeLPKeys.add(mapKey);
                    });
                } else {
                    console.warn('⚠️ getPairs() did not return an array');
                }
            } catch (error) {
                console.error('⚠️ getPairs() call failed:', error.message);
            }

            // Remove stale LP entries that are no longer returned by the contract
            if (pairsRetrieved) {
                for (const key of existingLPKeys) {
                    if (!activeLPKeys.has(key)) {
                        this.contractAddresses.delete(key);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load contract addresses:', error);
        }
    }

    /**
     * Initialize smart contract instances with comprehensive error handling
     */
    async initializeContracts() {
        try {
            let contractsInitialized = 0;

            // Initialize staking contract
            const stakingAddress = this.contractAddresses.get('STAKING');
            const stakingABI = this.contractABIs.get('STAKING');

            if (stakingAddress && stakingABI && this.isValidContractAddress(stakingAddress)) {
                try {
                    // Use signer if available for transactions, otherwise provider for read-only
                    const contractProvider = this.signer || this.provider;
                    this.stakingContract = new ethers.Contract(stakingAddress, stakingABI, contractProvider);
                    console.log('Staking contract initialized:', stakingAddress);
                    console.log('   - Using:', this.signer ? 'signer (transactions enabled)' : 'provider (read-only)');
                    contractsInitialized++;
                } catch (contractError) {
                    console.error('Failed to create staking contract:', contractError.message);
                    console.error('⚠️ Continuing without staking contract...');
                }
            } else {
                console.log('Staking contract address invalid or missing, skipping:', stakingAddress);
            }

            try {
                await this.loadContractAddresses();
            } catch (addressError) {
                console.error('⚠️ Failed to refresh reward/LP addresses from contract (wallet mode):', addressError.message);
            }

            // Initialize reward token contract
            const rewardTokenAddress = this.contractAddresses.get('REWARD_TOKEN');
            const erc20ABI = this.contractABIs.get('ERC20');

            if (rewardTokenAddress && erc20ABI && this.isValidContractAddress(rewardTokenAddress)) {
                try {
                    // Use signer if available for transactions, otherwise provider for read-only
                    const contractProvider = this.signer || this.provider;
                    this.rewardTokenContract = new ethers.Contract(rewardTokenAddress, erc20ABI, contractProvider);
                    console.log('Reward token contract initialized:', rewardTokenAddress);
                    console.log('   - Using:', this.signer ? 'signer (transactions enabled)' : 'provider (read-only)');
                    contractsInitialized++;
                } catch (contractError) {
                    console.error('Failed to create reward token contract:', contractError.message);
                    console.error('⚠️ Continuing without reward token contract...');
                }
            } else {
                console.log('Reward token address invalid or missing, skipping:', rewardTokenAddress);
            }

            // Initialize LP token contracts
            await this.initializeLPTokenContracts();

            console.log(`Contract initialization completed. ${contractsInitialized} main contracts initialized.`);

            // Don't throw error if no contracts initialized - allow fallback to handle it
            if (contractsInitialized === 0) {
                console.log('No valid contracts initialized - system will use fallback mode');
            }
        } catch (error) {
            console.error('Failed to initialize contracts:', error);
            // Don't throw error - allow system to continue with fallback
            console.log('Contract initialization failed, continuing with fallback mode...');
        }
    }

    /**
     * Validate contract address format
     */
    isValidContractAddress(address) {
        // Check if it's a valid Ethereum address format
        if (!address || typeof address !== 'string') return false;

        // Check if it's a proper hex address (42 characters, starts with 0x)
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return false;

        // Check if it's not a placeholder/test address
        const placeholderPatterns = [
            /^0x1234567890123456789012345678901234567890$/,
            /^0x0987654321098765432109876543210987654321$/,
            /^0xabcdefabcdefabcdefabcdefabcdefabcdefabcd$/,
            /^0xfedcbafedcbafedcbafedcbafedcbafedcbafed$/,
            /^0x[0]+$/,
            /^0x[1]+$/,
            /^0x[a]+$/,
            /^0x[f]+$/
        ];

        return !placeholderPatterns.some(pattern => pattern.test(address));
    }

    /**
    * Normalize LP pair names so keys remain consistent regardless of contract formatting
    * @param {string} rawName - Original pair name from the contract
    * @returns {string|null} Normalized pair identifier with an LP prefix, or null when input cannot be normalized
     */
    normalizePairKey(rawName) {
        if (typeof rawName !== 'string') {
            return null;
        }

        const sanitized = rawName.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (sanitized.length === 0) {
            return null;
        }

        return sanitized.startsWith('LP') ? sanitized : `LP${sanitized}`;
    }

    /**
     * Resolve an LP token identifier (name or address) to a contract address
     * @param {string} pairIdentifier - Address, normalized key, or human-readable name
     * @returns {string|null} Resolved contract address or null when not found
     */
    resolveLPTokenAddress(pairIdentifier) {
        if (!pairIdentifier || typeof pairIdentifier !== 'string') {
            return null;
        }

        if (this.isValidContractAddress(pairIdentifier)) {
            return pairIdentifier;
        }

        // Direct map lookup when identifier already matches stored key
        if (pairIdentifier.startsWith('LP_')) {
            const direct = this.contractAddresses.get(pairIdentifier);
            if (direct && this.isValidContractAddress(direct)) {
                return direct;
            }
            pairIdentifier = pairIdentifier.replace(/^LP_/, '');
        }

        const normalizedKey = this.normalizePairKey(pairIdentifier);
        if (!normalizedKey) {
            return null;
        }

        const addressFromMap = this.contractAddresses.get(`LP_${normalizedKey}`);
        if (addressFromMap && this.isValidContractAddress(addressFromMap)) {
            return addressFromMap;
        }

        const lpContract = this.lpTokenContracts.get(normalizedKey);
        if (lpContract?.address && this.isValidContractAddress(lpContract.address)) {
            return lpContract.address;
        }

        return null;
    }

    /**
     * Initialize LP token contracts dynamically
     */
    async initializeLPTokenContracts() {
        try {
            const erc20ABI = this.contractABIs.get('ERC20');
            let validContracts = 0;

            for (const [key, address] of this.contractAddresses.entries()) {
                if (key.startsWith('LP_')) {
                    const pairName = key.replace('LP_', '');

                    // Validate address before creating contract
                    if (!this.isValidContractAddress(address)) {
                        console.log(`Skipping invalid LP token address for ${pairName}: ${address}`);
                        continue;
                    }

                    try {
                        // Use signer if available for transactions, otherwise provider for read-only
                        const contractProvider = this.signer || this.provider;
                        const lpContract = new ethers.Contract(address, erc20ABI, contractProvider);
                        this.lpTokenContracts.set(pairName, lpContract);
                        console.log(`LP token contract initialized for ${pairName}:`, address);
                        console.log(`   - Using: ${this.signer ? 'signer (transactions enabled)' : 'provider (read-only)'}`);
                        validContracts++;
                    } catch (contractError) {
                        console.error(`Failed to create LP contract for ${pairName}:`, contractError.message);
                        continue;
                    }
                }
            }

            console.log(`Initialized ${validContracts} valid LP token contracts out of ${this.contractAddresses.size} addresses`);
        } catch (error) {
            console.error('Failed to initialize LP token contracts:', error);
            // Don't throw error - allow system to continue with fallback
            console.log('Continuing with fallback LP token contract handling...');
        }
    }

    /**
     * Verify contract function availability (NEW)
     */
    async verifyContractFunctions() {
        try {
            if (!this.stakingContract) {
                throw new Error('Staking contract not initialized');
            }

            // Test required functions with timeout
            const requiredFunctions = [
                { name: 'rewardToken', test: () => this.stakingContract.rewardToken(), required: false },
                { name: 'hourlyRewardRate', test: () => this.stakingContract.hourlyRewardRate(), required: false },
                { name: 'REQUIRED_APPROVALS', test: () => this.stakingContract.REQUIRED_APPROVALS(), required: false },
                { name: 'actionCounter', test: () => this.stakingContract.actionCounter(), required: false }
            ];

            let workingFunctions = 0;
            for (const func of requiredFunctions) {
                try {
                    // Add timeout to prevent hanging
                    const result = await Promise.race([
                        func.test(),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Function call timeout')), 10000)
                        )
                    ]);
                    workingFunctions++;
                } catch (error) {
                    if (func.required) {
                        console.error(`❌ Required function ${func.name} failed:`, error.message);
                        throw new Error(`Required function ${func.name} not available: ${error.message}`);
                    } else {
                        console.warn(`⚠️ Optional function ${func.name} not available:`, error.message);
                        this.disabledFeatures.add(func.name);
                    }
                }
            }

            return true;
        } catch (error) {
            console.error('❌ Contract function verification failed:', error);
            console.error('⚠️ Contract function verification failed, but continuing:', error.message);
            // Don't throw error - allow system to continue with limited functionality
            return false;
        }
    }

    /**
     * Verify contract connections and basic functionality (ENHANCED)
     */
    async verifyContractConnections() {
        try {
            // Call the new verification methods
            await this.verifyContractFunctions();
        } catch (error) {
            console.error('❌ Contract verification failed:', error);
            // Don't throw here as this is just verification - let the system continue
            console.error('⚠️ Continuing with limited functionality...');
        }
    }

    /**
     * Handle initialization errors with fallback strategies
     */
    async handleInitializationError(error) {
        try {
            console.log('Handling initialization error with fallback strategies...');

            // Try fallback provider if available
            if (this.fallbackProviders.length > 0 && this.currentProviderIndex < this.fallbackProviders.length - 1) {
                this.currentProviderIndex++;
                const fallbackProvider = this.fallbackProviders[this.currentProviderIndex];

                console.log(`Attempting fallback provider ${this.currentProviderIndex + 1}...`);
                this.provider = fallbackProvider;
                this.signer = fallbackProvider.getSigner();

                // Retry initialization with fallback
                await this.initializeContracts();
                return;
            }

            // Log comprehensive error information
            console.error('All initialization attempts failed:', {
                error: error.message,
                providerIndex: this.currentProviderIndex,
                fallbackProvidersCount: this.fallbackProviders.length
            });

        } catch (fallbackError) {
            console.error('Fallback initialization also failed:', fallbackError);
        }
    }

    /**
     * Check if contracts are initialized and ready for use
     */
    isReady() {
        // Check if initialized and has provider
        // Signer is optional (null in read-only mode)
        const ready = !!(this.isInitialized &&
                        this.provider &&
                        (this.stakingContract || this.rewardTokenContract));

        return ready;
    }

    /**
     * Switch to a different network and reinitialize contracts
     * @param {string} networkKey - The network key to switch to
     */
    async switchNetwork(networkKey) {
        try {
            console.log(`🌐 Switching to ${networkKey} network...`);

            // Reset initialization state
            this.isInitialized = false;
            this.isInitializing = false;
            this.initializationPromise = null;

            // Clear existing contracts
            this.stakingContract = null;
            this.rewardTokenContract = null;
            this.lpTokenContracts.clear();

            // Reset MulticallService
            if (this.multicallService) {
                this.multicallService.reset();
                this.multicallService = null;
            }

            // Update RPC URLs for the new network
            const network = window.CONFIG.NETWORKS[networkKey];
            if (network) {
                // Reset provider rotation for new network
                this.currentProviderIndex = 0;
            }

            // Check if the new network has valid contract addresses
            const contractAddress = window.networkSelector?.getStakingContractAddress();
            if (!contractAddress || contractAddress.trim() === '') {
                const networkName = window.networkSelector?.getCurrentNetworkName() || networkKey || 'current network';
                console.warn(`⚠️ No contracts deployed on ${networkName} - skipping initialization`);
                this.isInitialized = true; // Mark as initialized but with no contracts
                return true;
            }

            // Reinitialize with new network configuration
            await this.initializeReadOnly();
            
            return true;

        } catch (error) {
            console.error(`❌ Failed to switch to ${networkKey} network:`, error);
            throw error;
        }
    }

    /**
     * Check if staking contract is properly initialized
     */
    isStakingContractReady() {
        return this.stakingContract &&
               this.stakingContract.address &&
               this.stakingContract.interface;
    }

    /**
     * Check if reward token contract is properly initialized
     */
    isRewardTokenContractReady() {
        return this.rewardTokenContract &&
               this.rewardTokenContract.address &&
               this.rewardTokenContract.interface;
    }

    /**
     * Get contract readiness status
     */
    getContractStatus() {
        return {
            provider: !!this.provider,
            signer: !!this.signer,
            stakingContract: this.isStakingContractReady(),
            rewardTokenContract: this.isRewardTokenContractReady(),
            isInitialized: this.isInitialized,
            isReady: this.isReady()
        };
    }

    /**
     * Wait for contract manager to be ready
     */
    async waitForReady(timeout = 30000) {
        if (this.isReady()) {
            return true;
        }

        if (this.isInitializing && this.initializationPromise) {
            try {
                await this.initializationPromise;
                return this.isReady();
            } catch (error) {
                console.error('ContractManager initialization failed while waiting:', error);
                return false;
            }
        }

        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                console.error('ContractManager readiness timeout after', timeout, 'ms');
                resolve(false);
            }, timeout);

            this.readyCallbacks.push(() => {
                clearTimeout(timeoutId);
                resolve(this.isReady());
            });
        });
    }

    /**
     * Notify all ready callbacks
     */
    _notifyReadyCallbacks() {
        const callbacks = [...this.readyCallbacks];
        this.readyCallbacks = [];

        callbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('Error in ready callback:', error);
            }
        });
    }

    /**
     * Get LP token contract by pair name
     */
    getLPTokenContract(pairName) {
        const contract = this.lpTokenContracts.get(pairName);
        if (!contract) {
            throw new Error(`LP token contract not found for pair: ${pairName}`);
        }
        return contract;
    }

    // ==================== CONTRACT READ OPERATIONS ====================

    /**
     * Get user's stake information for a specific LP token
     */
    async getUserStake(userAddress, lpTokenAddress) {
        return await this.executeWithRetry(async () => {
            const stakeInfo = await this.stakingContract.getUserStakeInfo(userAddress, lpTokenAddress);
            return {
                amount: ethers.utils.formatEther(stakeInfo.amount || '0'),
                rewards: ethers.utils.formatEther(stakeInfo.pendingRewards || '0')
            };
        }, 'getUserStake');
    }

    /**
     * Get LP stake composition using Uniswap V2 pair reserves
     * Returns LP totals plus underlying token amounts held by the staking contract
     */
    async getLPStakeBreakdown(pairIdentifier) {
        return await this.executeWithRetry(async () => {
            const lpTokenAddress = this.resolveLPTokenAddress(pairIdentifier);
            if (!lpTokenAddress) {
                throw new Error(`Unable to resolve LP token for identifier: ${pairIdentifier}`);
            }

            const stakingAddress = this.contractAddresses.get('STAKING') || window.networkSelector?.getStakingContractAddress();
            if (!stakingAddress || !this.isValidContractAddress(stakingAddress)) {
                throw new Error('Staking contract address not available');
            }

            const provider = this.provider || this.signer?.provider;
            if (!provider) {
                throw new Error('Provider not initialized');
            }

            const pairContract = new ethers.Contract(
                lpTokenAddress,
                [
                    'function token0() view returns (address)',
                    'function token1() view returns (address)',
                    'function getReserves() view returns (uint112,uint112,uint32)',
                    'function totalSupply() view returns (uint256)',
                    'function balanceOf(address owner) view returns (uint256)',
                    'function decimals() view returns (uint8)'
                ],
                provider
            );

            const multicall = this.multicallService;
            if (!multicall || typeof multicall.isReady !== 'function' || !multicall.isReady()) {
                throw new Error('Multicall service not ready');
            }

            const pairCalls = [
                multicall.createCall(pairContract, 'token0'),
                multicall.createCall(pairContract, 'token1'),
                multicall.createCall(pairContract, 'getReserves'),
                multicall.createCall(pairContract, 'totalSupply'),
                multicall.createCall(pairContract, 'balanceOf', [stakingAddress]),
                multicall.createCall(pairContract, 'decimals')
            ];

            const pairResults = await multicall.batchCall(pairCalls, { requireSuccess: true, maxRetries: 0 });
            if (!pairResults || pairResults.length !== pairCalls.length) {
                throw new Error('Multicall pair query failed');
            }

            const decodePair = (index, method) => {
                const entry = pairResults[index];
                if (!entry || entry.success !== true) {
                    throw new Error(`Multicall failed for pair.${method}`);
                }
                const decoded = multicall.decodeResult(pairContract, method, entry.returnData);
                if (decoded === null || decoded === undefined) {
                    throw new Error(`Unable to decode pair.${method}`);
                }
                return decoded;
            };

            const token0Address = decodePair(0, 'token0');
            const token1Address = decodePair(1, 'token1');
            const reserves = decodePair(2, 'getReserves');
            const totalSupplyRaw = decodePair(3, 'totalSupply');
            const stakedBalanceRaw = decodePair(4, 'balanceOf');
            const lpDecimalsRaw = decodePair(5, 'decimals');

            const reserve0 = ethers.BigNumber.from(reserves[0]);
            const reserve1 = ethers.BigNumber.from(reserves[1]);
            const reserveTimestampRaw = Number(reserves[2]);
            if (!Number.isFinite(reserveTimestampRaw)) {
                throw new Error('Invalid reserve timestamp');
            }
            const blockTimestampLast = Math.trunc(reserveTimestampRaw);

            const totalSupply = ethers.BigNumber.from(totalSupplyRaw);
            const stakedBalance = ethers.BigNumber.from(stakedBalanceRaw);

            if (stakedBalance.gt(totalSupply)) {
                throw new Error('Staked balance exceeds total supply');
            }

            const metadataAbi = [
                'function decimals() view returns (uint8)',
                'function symbol() view returns (string)'
            ];

            const token0Contract = new ethers.Contract(token0Address, metadataAbi, provider);
            const token1Contract = new ethers.Contract(token1Address, metadataAbi, provider);

            const tokenMetadataCalls = [
                multicall.createCall(token0Contract, 'decimals'),
                multicall.createCall(token0Contract, 'symbol'),
                multicall.createCall(token1Contract, 'decimals'),
                multicall.createCall(token1Contract, 'symbol')
            ];

            const tokenMetadataResults = await multicall.batchCall(tokenMetadataCalls, { requireSuccess: true, maxRetries: 0 });
            if (!tokenMetadataResults || tokenMetadataResults.length !== tokenMetadataCalls.length) {
                throw new Error('Multicall token metadata query failed');
            }

            const decodeToken = (contract, method, index) => {
                const entry = tokenMetadataResults[index];
                if (!entry || entry.success !== true) {
                    throw new Error(`Multicall failed for ${contract.address}.${method}`);
                }
                const decoded = multicall.decodeResult(contract, method, entry.returnData);
                if (decoded === null || decoded === undefined) {
                    throw new Error(`Unable to decode ${contract.address}.${method}`);
                }
                return decoded;
            };

            const token0DecimalsRaw = decodeToken(token0Contract, 'decimals', 0);
            const token0SymbolRaw = decodeToken(token0Contract, 'symbol', 1);
            const token1DecimalsRaw = decodeToken(token1Contract, 'decimals', 2);
            const token1SymbolRaw = decodeToken(token1Contract, 'symbol', 3);

            const lpDecimalsNum = Number(lpDecimalsRaw);
            const token0DecimalsNum = Number(token0DecimalsRaw);
            const token1DecimalsNum = Number(token1DecimalsRaw);

            if (!Number.isFinite(lpDecimalsNum)) {
                throw new Error('Invalid LP decimals');
            }
            if (!Number.isFinite(token0DecimalsNum)) {
                throw new Error('Invalid token0 decimals');
            }
            if (!Number.isFinite(token1DecimalsNum)) {
                throw new Error('Invalid token1 decimals');
            }

            const lpDecimals = Math.trunc(lpDecimalsNum);
            const token0Decimals = Math.trunc(token0DecimalsNum);
            const token1Decimals = Math.trunc(token1DecimalsNum);

            if (typeof token0SymbolRaw !== 'string' || !token0SymbolRaw.trim()) {
                throw new Error('Invalid token0 symbol');
            }
            if (typeof token1SymbolRaw !== 'string' || !token1SymbolRaw.trim()) {
                throw new Error('Invalid token1 symbol');
            }

            const token0Symbol = token0SymbolRaw.trim();
            const token1Symbol = token1SymbolRaw.trim();

            if (totalSupply.isZero()) {
                throw new Error('LP total supply is zero');
            }

            const token0Staked = stakedBalance.mul(reserve0).div(totalSupply);
            const token1Staked = stakedBalance.mul(reserve1).div(totalSupply);
            const outstandingBalance = totalSupply.sub(stakedBalance);

            return {
                lpTokenAddress,
                stakingContractAddress: stakingAddress,
                blockTimestampLast,
                lpToken: {
                    decimals: lpDecimals,
                    totalSupply: {
                        raw: totalSupply.toString(),
                        formatted: ethers.utils.formatUnits(totalSupply, lpDecimals)
                    },
                    stakedBalance: {
                        raw: stakedBalance.toString(),
                        formatted: ethers.utils.formatUnits(stakedBalance, lpDecimals)
                    },
                    outstandingBalance: {
                        raw: outstandingBalance.toString(),
                        formatted: ethers.utils.formatUnits(outstandingBalance, lpDecimals)
                    }
                },
                token0: {
                    address: token0Address,
                    symbol: token0Symbol,
                    decimals: token0Decimals,
                    reserve: {
                        raw: reserve0.toString(),
                        formatted: ethers.utils.formatUnits(reserve0, token0Decimals)
                    },
                    staked: {
                        raw: token0Staked.toString(),
                        formatted: ethers.utils.formatUnits(token0Staked, token0Decimals)
                    }
                },
                token1: {
                    address: token1Address,
                    symbol: token1Symbol,
                    decimals: token1Decimals,
                    reserve: {
                        raw: reserve1.toString(),
                        formatted: ethers.utils.formatUnits(reserve1, token1Decimals)
                    },
                    staked: {
                        raw: token1Staked.toString(),
                        formatted: ethers.utils.formatUnits(token1Staked, token1Decimals)
                    }
                }
            };
        }, 'getLPStakeBreakdown');
    }

    // ============ ADMIN CONTRACT FUNCTIONS ============

    /**
     * Get signers (like React version) with RPC failover
     */
    async getSigners() {
        return await this.safeContractCall(
            () => this.stakingContract.getSigners(),
            [],
            'getSigners'
        );
    }

    /**
     * Determine action status for UI display
     */
    determineActionStatus(action) {
        if (action.executed) return 'executed';
        if (action.rejected) return 'rejected';
        if (action.expired) return 'expired';
        return 'pending';
    }

    /**
     * Get all actions for admin panel with provider fallback
     */
    async getAllActions() {
        try {
            return await this.executeWithProviderFallback(async (provider, blockTag) => {
                // Create contract instance with specific provider
                const contractWithProvider = new ethers.Contract(
                    this.contractAddresses.get('STAKING'),
                    this.contractABIs.get('STAKING'),
                    provider
                );

                // Force 'latest' block to bypass caching
                return await this._getAllActionsInternal(contractWithProvider, 'latest');
            }, 'getAllActions');

        } catch (error) {
            const errorMsg = error?.message || 'Unknown error';
            console.error('⚠️ All providers failed for getAllActions, trying fallback:', errorMsg);

            // Fallback to standard method with latest block
            return await this.executeWithRetry(async () => {
                return await this._getAllActionsInternal(this.stakingContract, 'latest');
            }, 'getAllActions');
        }
    }

    /**
     * Load all actions using Multicall (ULTRA-FAST)
     * Reduces RPC calls by 66% (1 call instead of 3 per action)
     */
    async _getAllActionsWithMulticall(contract, blockTag = null) {
        try {
            const startTime = performance.now();
            
            // Get action counter with blockTag to ensure fresh data
            const counterOptions = blockTag ? { blockTag } : {};
            const counter = await contract.actionCounter(counterOptions);
            const actionCount = counter.toNumber();
            
            if (actionCount === 0) {
                return [];
            }

            // Load recent 10 actions initially
            const startIndex = actionCount;
            const endIndex = Math.max(actionCount - 10, 1);
            const actionIds = [];
            for (let i = startIndex; i >= endIndex; i--) {
                actionIds.push(i);
            }


            // Prepare all calls: action + pairs + weights + approvals + expired for each ID
            const calls = [];
            actionIds.forEach(actionId => {
                calls.push(this.multicallService.createCall(contract, 'actions', [BigInt(actionId)]));
                calls.push(this.multicallService.createCall(contract, 'getActionPairs', [actionId]));
                calls.push(this.multicallService.createCall(contract, 'getActionWeights', [actionId]));
                calls.push(this.multicallService.createCall(contract, 'getActionApproval', [actionId]));
                calls.push(this.multicallService.createCall(contract, 'isActionExpired', [actionId]));
            });


            // Execute all calls in single RPC request with blockTag for fresh data
            const multicallOptions = { timeout: 20000 };
            if (blockTag) {
                multicallOptions.blockTag = blockTag;
            }
            const results = await this.multicallService.batchCall(calls, multicallOptions);

            if (!results) {
                console.warn('[MULTICALL] ⚠️ Batch call returned null');
                return null;
            }

            // Parse results (5 results per action)
            const actions = [];
            const contractInterface = contract.interface;

            actionIds.forEach((actionId, index) => {
                const baseIndex = index * 5;
                const actionResult = results[baseIndex];
                const pairsResult = results[baseIndex + 1];
                const weightsResult = results[baseIndex + 2];
                const approvalsResult = results[baseIndex + 3];
                const expiredResult = results[baseIndex + 4];

                if (!actionResult?.success) {
                    console.warn(`[MULTICALL] ⚠️ Action ${actionId} call failed`);
                    return;
                }

                try {
                    // Decode results
                    const action = this.multicallService.decodeResult(
                        contractInterface, 'actions', actionResult.returnData
                    );
                    const pairs = pairsResult?.success 
                        ? this.multicallService.decodeResult(
                            contractInterface, 'getActionPairs', pairsResult.returnData
                        ) || []
                        : [];
                    const weights = weightsResult?.success
                        ? this.multicallService.decodeResult(
                            contractInterface, 'getActionWeights', weightsResult.returnData
                        ) || []
                        : [];
                    const approvedBy = approvalsResult?.success
                        ? this.multicallService.decodeResult(
                            contractInterface, 'getActionApproval', approvalsResult.returnData
                        ) || []
                        : [];
                    const expired = expiredResult?.success
                        ? this.multicallService.decodeResult(
                            contractInterface, 'isActionExpired', expiredResult.returnData
                        ) || false
                        : false;

                    if (action) {
                        actions.push({
                            id: actionId,
                            actionType: action.actionType,
                            newHourlyRewardRate: action.newHourlyRewardRate.toString(),
                            pairs: Array.isArray(pairs) ? pairs.map(p => p.toString()) : [],
                            weights: Array.isArray(weights) ? weights.map(w => w.toString()) : [],
                            pairToAdd: action.pairToAdd,
                            pairNameToAdd: action.pairNameToAdd,
                            platformToAdd: action.platformToAdd,
                            weightToAdd: action.weightToAdd.toString(),
                            pairToRemove: action.pairToRemove,
                            recipient: action.recipient,
                            withdrawAmount: action.withdrawAmount.toString(),
                            executed: action.executed,
                            expired: expired || action.expired, // Use multicall result or fallback to action data
                            approvals: action.approvals,
                            approvedBy: Array.isArray(approvedBy) ? approvedBy.map(a => a.toString()) : (action.approvedBy || []),
                            proposedTime: action.proposedTime.toNumber(),
                            rejected: action.rejected
                        });
                    }
                } catch (error) {
                    console.error(`[MULTICALL] ⚠️ Failed to parse action ${actionId}:`, error.message);
                }
            });

            const endTime = performance.now();
            console.log(`[MULTICALL] ⚡ Loaded ${actions.length} actions in ${(endTime - startTime).toFixed(0)}ms`);
            console.log(`[MULTICALL] 📊 Performance: ${calls.length} calls → 1 RPC request (${calls.length}x reduction)`);

            return actions;

        } catch (error) {
            console.error('[MULTICALL] ❌ Multicall loading failed:', error);
            return null;
        }
    }

    /**
     * Internal method to get all actions - OPTIMIZED FOR SPEED WITH MULTICALL
     */
    async _getAllActionsInternal(contract, blockTag = null) {

        // Always try Multicall if available (90% faster) - pass blockTag through
        if (this.multicallService && this.multicallService.isReady()) {
            try {
                const result = await this._getAllActionsWithMulticall(contract, blockTag);
                if (result) {
                    return result;
                }
            } catch (error) {
                console.error('[ACTIONS] ⚠️ Multicall failed, using fallback:', error.message);
            }
        }

        // Get action counter with block tag if provided (force latest to bypass cache)
        const counter = blockTag
            ? await contract.actionCounter({ blockTag })
            : await contract.actionCounter();
        const actionCount = counter.toNumber();

        if (actionCount === 0) {
            console.log('[ACTIONS] 📭 No actions found');
            return [];
        }

        // PERFORMANCE OPTIMIZATION: Load 10 most recent proposals initially for better UX
        // This ensures Load More button appears and users see more proposals
        const startIndex = actionCount;
        const endIndex = Math.max(actionCount - 10, 1); // Load 10 proposals initially
        const actionIds = [];
        for (let i = startIndex; i >= endIndex; i--) {
            actionIds.push(i);
        }


        // Cache for loaded actions to avoid duplicates
        const actionCache = new Map();
        const actions = [];

        // PERFORMANCE OPTIMIZATION: Increase batch size for fewer sequential operations
        const batchSize = 30; // Increased for better parallelization and faster loading
        for (let batchStart = 0; batchStart < actionIds.length; batchStart += batchSize) {
            const batchIds = actionIds.slice(batchStart, batchStart + batchSize);

            // Create parallel promises for this batch
            const batchPromises = batchIds.map(async (actionId) => {
                // Check cache first
                if (actionCache.has(actionId)) {
                    return actionCache.get(actionId);
                }

                try {
                    // Load action, pairs, weights, and approvals in parallel
                    const [action, pairs, weights, approvedBy, expiredOverride] = await Promise.all([
                        blockTag
                            ? contract.actions(BigInt(actionId), { blockTag })
                            : contract.actions(BigInt(actionId)),
                        blockTag
                            ? contract.getActionPairs(actionId, { blockTag })
                            : contract.getActionPairs(actionId),
                        blockTag
                            ? contract.getActionWeights(actionId, { blockTag })
                            : contract.getActionWeights(actionId),
                        blockTag
                            ? contract.getActionApproval(actionId, { blockTag })
                            : contract.getActionApproval(actionId),
                        blockTag
                            ? contract.isActionExpired(actionId, { blockTag })
                            : contract.isActionExpired(actionId)
                    ]);

                    const formattedAction = {
                        id: actionId,
                        actionType: action.actionType,
                        newHourlyRewardRate: action.newHourlyRewardRate.toString(),
                        pairs: pairs.map(p => p.toString()),
                        weights: weights.map(w => w.toString()),
                        pairToAdd: action.pairToAdd,
                        pairNameToAdd: action.pairNameToAdd,
                        platformToAdd: action.platformToAdd,
                        weightToAdd: action.weightToAdd.toString(),
                        pairToRemove: action.pairToRemove,
                        recipient: action.recipient,
                        withdrawAmount: action.withdrawAmount.toString(),
                        executed: action.executed,
                        expired: expiredOverride !== undefined ? !!expiredOverride : action.expired,
                        approvals: action.approvals,
                        approvedBy: approvedBy,
                        proposedTime: action.proposedTime.toNumber(),
                        rejected: action.rejected
                    };

                    // Cache the result
                    actionCache.set(actionId, formattedAction);
                    return formattedAction;

                } catch (error) {
                    console.error(`[ACTIONS] ⚠️ Failed to get action ${actionId}:`, error.message);
                    return null; // Return null for failed actions
                }
            });

            // Wait for batch to complete
            const batchResults = await Promise.allSettled(batchPromises);

            // Process results
            batchResults.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value !== null) {
                    actions.push(result.value);
                } else if (result.status === 'rejected') {
                    console.warn(`[ACTIONS] ⚠️ Batch promise rejected for action ${batchIds[index]}:`, result.reason);
                }
            });

        }
        return actions;
    }

    /**
     * PERFORMANCE OPTIMIZATION: Get actions with pagination for "Load More" functionality
     */
    async getAllActionsWithPagination(skip = 0, limit = 15) {
        try {

            return await this.executeWithProviderFallback(async (provider, blockTag) => {
                const contractWithProvider = new ethers.Contract(
                    this.contractAddresses.get('STAKING'),
                    this.contractABIs.get('STAKING'),
                    provider
                );

                return await this._getAllActionsWithPaginationInternal(contractWithProvider, blockTag, skip, limit);
            }, 'getAllActionsWithPagination');

        } catch (error) {
            const errorMsg = error?.message || 'Unknown error';
            console.error('⚠️ Paginated actions loading failed:', errorMsg);
            return [];
        }
    }

    /**
     * Internal method for paginated action loading
     */
    async _getAllActionsWithPaginationInternal(contract, blockTag = null, skip = 0, limit = 15) {

        // Get action counter
        const counter = blockTag
            ? await contract.actionCounter({ blockTag })
            : await contract.actionCounter();
        const actionCount = counter.toNumber();

        if (actionCount === 0) {
            console.log('[ACTIONS] 📭 No actions found');
            return [];
        }

        // Calculate range for pagination (newest first)
        const startIndex = actionCount - skip;
        const endIndex = Math.max(startIndex - limit, 1);

        if (startIndex <= 0) {
            console.log('[ACTIONS] ℹ️ No more actions to load');
            return [];
        }

        const actionIds = [];
        for (let i = startIndex; i >= endIndex; i--) {
            actionIds.push(i);
        }


        const actions = [];
        const batchSize = 30; // Use same optimized batch size for consistency

        // Process in batches
        for (let batchStart = 0; batchStart < actionIds.length; batchStart += batchSize) {
            const batchIds = actionIds.slice(batchStart, batchStart + batchSize);

            const batchPromises = batchIds.map(async (actionId) => {
                try {
                    // Load action, pairs, weights, and approvals in parallel
                    const [action, pairs, weights, approvedBy, expiredOverride] = await Promise.all([
                        blockTag
                            ? contract.actions(BigInt(actionId), { blockTag })
                            : contract.actions(BigInt(actionId)),
                        blockTag
                            ? contract.getActionPairs(actionId, { blockTag })
                            : contract.getActionPairs(actionId),
                        blockTag
                            ? contract.getActionWeights(actionId, { blockTag })
                            : contract.getActionWeights(actionId),
                        blockTag
                            ? contract.getActionApproval(actionId, { blockTag })
                            : contract.getActionApproval(actionId),
                        blockTag
                            ? contract.isActionExpired(actionId, { blockTag })
                            : contract.isActionExpired(actionId)
                    ]);

                    return {
                        id: actionId,
                        actionType: action.actionType,
                        newHourlyRewardRate: action.newHourlyRewardRate.toString(),
                        pairs: pairs.map(p => p.toString()),
                        weights: weights.map(w => w.toString()),
                        pairToAdd: action.pairToAdd,
                        pairNameToAdd: action.pairNameToAdd,
                        platformToAdd: action.platformToAdd,
                        weightToAdd: action.weightToAdd.toString(),
                        pairToRemove: action.pairToRemove,
                        recipient: action.recipient,
                        withdrawAmount: action.withdrawAmount.toString(),
                        executed: action.executed,
                        expired: expiredOverride !== undefined ? !!expiredOverride : action.expired,
                        approvals: action.approvals,
                        approvedBy: approvedBy,
                        proposedTime: action.proposedTime.toNumber(),
                        rejected: action.rejected
                    };
                } catch (error) {
                    console.error(`[ACTIONS] ⚠️ Failed to get paginated action ${actionId}:`, error.message);
                    return null;
                }
            });

            const batchResults = await Promise.allSettled(batchPromises);

            batchResults.forEach((result) => {
                if (result.status === 'fulfilled' && result.value !== null) {
                    actions.push(result.value);
                }
            });
        }

        return actions;
    }

    /**
     * Check if an address has admin role
     */
    async hasAdminRole(address = null) {
        // Check if contract is properly initialized
        if (!this.stakingContract) {
            console.warn('⚠️ Staking contract not initialized - admin role check skipped');
            return false;
        }

        try {
            return await this.executeWithRetry(async () => {
                const userAddress = address || (this.signer ? await this.signer.getAddress() : null);
                if (!userAddress) {
                    throw new Error('No address provided and no signer available');
                }
                const ADMIN_ROLE = await this.stakingContract.ADMIN_ROLE();
                return await this.stakingContract.hasRole(ADMIN_ROLE, userAddress);
            }, 'hasAdminRole');
        } catch (error) {
            console.warn(`⚠️ Admin role check failed gracefully: ${error.message}`);
            console.warn('This is expected when contracts are not deployed or user lacks admin permissions');
        }
        return false;
    }

    async hasOwnerApproverRole(address = null) {
        if (!this.stakingContract) {
            console.warn('⚠️ Staking contract not initialized - owner role check skipped');
            return false;
        }

        try {
            return await this.executeWithRetry(async () => {
                const userAddress = address || (this.signer ? await this.signer.getAddress() : null);
                if (!userAddress) {
                    throw new Error('No address provided and no signer available');
                }
                const OWNER_ROLE = await this.stakingContract.OWNER_APPROVER_ROLE();
                return await this.stakingContract.hasRole(OWNER_ROLE, userAddress);
            }, 'hasOwnerApproverRole');
        } catch (error) {
            console.warn(`⚠️ Owner approver role check failed gracefully: ${error.message}`);
            return false;
        }
    }

    // ============ ADMIN PROPOSAL FUNCTIONS ============

    /**
     * Propose setting hourly reward rate
     */
    async proposeSetHourlyRewardRate(newRate) {
        try {
            // Ensure we have a proper signer
            await this.ensureSigner();

            const result = await this.executeTransactionOnce(async () => {
                const rateWei = ethers.utils.parseEther(newRate.toString());

                // CRITICAL FIX: Ensure contract is connected with signer (React pattern)
                const contractWithSigner = this.stakingContract.connect(this.signer);

                const tx = await contractWithSigner.proposeSetHourlyRewardRate(rateWei);

                console.log('Propose hourly rate transaction sent:', tx.hash);

                // CRITICAL FIX: Return tx object, not receipt
                // The executeTransactionOnce will call tx.wait() via monitorTransactionWithTimeout
                return tx;
            }, 'proposeSetHourlyRewardRate');

            const proposalId = result.events?.find(e => e.event === 'ProposalCreated')?.args?.actionId?.toString() || 'Unknown';

            const finalResult = {
                success: true,
                transactionHash: result.transactionHash,
                blockNumber: result.blockNumber,
                gasUsed: result.gasUsed.toString(),
                proposalId: proposalId
            };

            return finalResult;
        } catch (error) {
            console.error('Failed to propose hourly rate:', error);
            return {
                success: false,
                error: error
            };
        }
    }

    /**
     * Propose updating pair weights - WORKING CORRECTLY (DO NOT MODIFY LOGIC)
     */
    async proposeUpdatePairWeights(lpTokens, weights) {
        try {
            // Ensure we have a proper signer
            await this.ensureSigner();

            const result = await this.executeTransactionOnce(async () => {
                // CRITICAL: Keep original weight conversion logic - this is working correctly
                const weightsWei = weights.map(w => ethers.utils.parseEther(w.toString()));

                // Prepare contract call with proper signer connection
                const contractWithSigner = this.stakingContract.connect(this.signer);

                const tx = await contractWithSigner.proposeUpdatePairWeights(lpTokens, weightsWei);

                console.log('Propose update weights transaction sent:', tx.hash);

                // CRITICAL FIX: Return tx object, not receipt
                // The executeTransactionOnce will call tx.wait() via monitorTransactionWithTimeout
                return tx;
            }, 'proposeUpdatePairWeights');

            return {
                success: true,
                transactionHash: result.transactionHash,
                blockNumber: result.blockNumber,
                gasUsed: result.gasUsed.toString(),
                message: 'Weight update proposal created successfully'
            };

        } catch (error) {
            console.error('Failed to propose update pair weights:', error);
            return {
                success: false,
                error: error
            };
        }
    }

    /**
     * Propose adding a new pair - FIXED VERSION
     */
    async proposeAddPair(lpToken, pairName, platform, weight) {
        try {
            // STEP 1: Validate inputs with proper address checksumming
            lpToken = this.validateAndChecksumAddress(lpToken, 'LP Token Address');

            if (!pairName || pairName.trim().length === 0) {
                throw new Error('Pair name cannot be empty');
            }
            if (!platform || platform.trim().length === 0) {
                throw new Error('Platform name cannot be empty');
            }
            if (!weight || isNaN(weight) || weight <= 0) {
                throw new Error(`Invalid weight: ${weight}. Must be a positive number.`);
            }

            // STEP 2: Ensure we have a proper signer
            await this.ensureSigner();

            // STEP 3: Check if function exists in contract
            if (typeof this.stakingContract.proposeAddPair !== 'function') {
                console.warn('⚠️ proposeAddPair function not available in deployed contract');
                console.warn('🔧 This contract may not have governance functions implemented');

                return {
                    success: false,
                    error: 'proposeAddPair function is not available on the deployed contract.',
                    methodUnavailable: true
                };
            }

            // STEP 4: Execute transaction with proper parameter handling
            const result = await this.executeTransactionOnce(async () => {
                // Use wei to match update pair weights logic and what the front end expects
                const weightUint256 = ethers.utils.parseEther(weight.toString());

                // CRITICAL FIX: Ensure contract is connected with signer (React pattern)
                const contractWithSigner = this.stakingContract.connect(this.signer);

                // Execute the transaction
                const tx = await contractWithSigner.proposeAddPair(
                    lpToken,
                    pairName,
                    platform,
                    weightUint256 // FIXED: Use uint256, not wei
                );

                console.log('Propose add pair transaction sent:', tx.hash);

                // CRITICAL FIX: Return tx object, not receipt
                return tx;
            }, 'proposeAddPair');

            return {
                success: true,
                transactionHash: result.transactionHash,
                blockNumber: result.blockNumber,
                gasUsed: result.gasUsed.toString(),
                message: 'Add pair proposal created successfully'
            };
        } catch (error) {
            console.error(`[ADD PAIR FIX] ❌ Transaction failed:`, error);
            console.error('Failed to propose add pair:', error);

            return {
                success: false,
                error: error
            };
        }
    }

    /**
     * Ensure we have a proper signer for transactions
     */
    async ensureSigner() {
        try {
            // First ensure MetaMask is connected
            if (typeof window.ethereum === 'undefined') {
                throw new Error('MetaMask not installed');
            }

            // Check if accounts are connected
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length === 0) {
                console.log('🔐 No connected accounts, requesting MetaMask connection...');
                try {
                    await window.ethereum.request({ method: 'eth_requestAccounts' });
                } catch (connectionError) {
                    if (connectionError.code === 4001) {
                        throw new Error('User rejected MetaMask connection');
                    }
                    throw new Error('Failed to connect to MetaMask: ' + connectionError.message);
                }
            }

            // Always create a fresh Web3Provider for transactions (CRITICAL FIX)

            // Create Web3Provider directly from MetaMask
            const web3Provider = new ethers.providers.Web3Provider(window.ethereum);

            // Ensure we're on the correct network (using centralized config)
            const network = await web3Provider.getNetwork();
            const expectedChainId = window.networkSelector?.getCurrentChainId();
            
            // Check permissions for the selected network regardless of current network
            const selectedNetwork = window.networkSelector?.getCurrentChainId();
            const networkName = window.networkSelector?.getCurrentNetworkName();
            
            if (selectedNetwork === expectedChainId) {
                console.log(`🌐 ${networkName} selected in UI, checking permissions...`);
                
                // Check if we have permission for the selected network
                const hasPermission = await window.networkManager.hasRequiredNetworkPermission();
                if (!hasPermission) {
                    console.log(`🔐 Requesting ${networkName} permission...`);
                    try {
                        const permissionGranted = await window.networkManager.requestNetworkPermission('metamask');
                        if (!permissionGranted) {
                            throw new Error(`${networkName} permission required for transactions`);
                        }
                    } catch (error) {
                        // Handle network switching errors gracefully
                        if (error.message.includes('User rejected') || error.message.includes('denied')) {
                            throw new Error(`User rejected ${networkName} permission request`);
                        }
                        throw new Error(`${networkName} permission required for transactions: ${error.message}`);
                    }
                }
            } else if (network.chainId !== expectedChainId) {
                throw new Error(`Please switch to ${networkName} (Chain ID: ${expectedChainId}) in MetaMask`);
            }

            // Get signer from Web3Provider
            this.signer = web3Provider.getSigner();
            // Keep the original provider for read operations, but use Web3Provider for transactions
            this.transactionProvider = web3Provider;

            // Verify signer is connected
            try {
                await this.signer.getAddress();
            } catch (error) {
                console.error('❌ Signer verification failed:', error);

                // If verification fails, try to recreate signer
                if (window.ethereum) {
                    const provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
                    this.signer = provider.getSigner();
                    this.provider = provider;

                    // Try verification again
                    await this.signer.getAddress();
                } else {
                    throw new Error('Signer not properly connected');
                }
            }

        } catch (error) {
            console.error('❌ ensureSigner failed:', error);

            // If it's a user rejection, throw specific error
            if (error.code === 4001) {
                throw new Error('User rejected MetaMask connection');
            }

            throw new Error('Signer not properly connected: ' + error.message);
        }

        // Recreate contracts with signer - CRITICAL FIX
        try {
            await this.initializeContracts();
        } catch (error) {
            console.error('❌ Failed to recreate contracts with signer:', error);
            console.error('⚠️ Continuing without signer update - transactions may not be available');
        }
    }

    /**
     * Propose removing a pair - FIXED VERSION
     */
    async proposeRemovePair(lpToken) {
        try {
            // STEP 1: Validate input with proper address checksumming
            lpToken = this.validateAndChecksumAddress(lpToken, 'LP Token Address');

            // STEP 2: Ensure we have a proper signer
            await this.ensureSigner();

            // STEP 3: Check if function exists in contract
            if (typeof this.stakingContract.proposeRemovePair !== 'function') {
                console.warn('⚠️ proposeRemovePair function not available in deployed contract');
                return {
                    success: false,
                    error: 'proposeRemovePair function is not available on the deployed contract.',
                    methodUnavailable: true
                };
            }

            // STEP 4: Execute transaction with proper error handling
            const result = await this.executeTransactionOnce(async () => {
                // Prepare contract call with proper signer connection
                const contractWithSigner = this.stakingContract.connect(this.signer);

                // Execute the transaction
                const tx = await contractWithSigner.proposeRemovePair(lpToken);

                console.log('Propose remove pair transaction sent:', tx.hash);

                // CRITICAL FIX: Return tx object, not receipt
                // The executeTransactionOnce will call tx.wait() via monitorTransactionWithTimeout
                return tx;
            }, 'proposeRemovePair');

            return {
                success: true,
                transactionHash: result.transactionHash,
                blockNumber: result.blockNumber,
                gasUsed: result.gasUsed.toString(),
                message: 'Remove pair proposal created successfully'
            };

        } catch (error) {
            console.error(`[REMOVE PAIR FIX] ❌ Transaction failed:`, error);
            console.error('Failed to propose remove pair:', error);

            return {
                success: false,
                error: error
            };
        }
    }

    /**
     * Propose changing a signer - FIXED VERSION
     */
    async proposeChangeSigner(oldSigner, newSigner) {
        try {
            // STEP 1: Validate input parameters with proper address checksumming
            oldSigner = this.validateAndChecksumAddress(oldSigner, 'Old Signer Address');
            newSigner = this.validateAndChecksumAddress(newSigner, 'New Signer Address');

            if (oldSigner.toLowerCase() === newSigner.toLowerCase()) {
                throw new Error('Old and new signer addresses cannot be the same');
            }

            // STEP 2: Ensure we have a proper signer
            await this.ensureSigner();

            // STEP 3: Check if function exists in contract
            if (!this.stakingContract || typeof this.stakingContract.proposeChangeSigner !== 'function') {
                console.warn('⚠️ proposeChangeSigner function not available in deployed contract');
                console.warn('⚠️ Contract instance:', this.stakingContract);
                console.warn('⚠️ Available functions:', this.stakingContract ? Object.getOwnPropertyNames(this.stakingContract.functions || {}) : 'No contract');
                return {
                    success: false,
                    error: 'proposeChangeSigner function is not available on the deployed contract.',
                    methodUnavailable: true
                };
            }

            // STEP 4: Execute transaction with proper error handling
            const result = await this.executeTransactionOnce(async () => {
                // CRITICAL FIX: Prepare contract call with proper signer connection
                const contractWithSigner = this.stakingContract.connect(this.signer);

                // Execute the transaction with correct parameter order
                const tx = await contractWithSigner.proposeChangeSigner(oldSigner, newSigner);

                console.log('Propose change signer transaction sent:', tx.hash);

                // CRITICAL FIX: Return tx object, not receipt
                // The executeTransactionOnce will call tx.wait() via monitorTransactionWithTimeout
                return tx;
            }, 'proposeChangeSigner');

            return {
                success: true,
                transactionHash: result.transactionHash,
                blockNumber: result.blockNumber,
                gasUsed: result.gasUsed.toString(),
                message: 'Change signer proposal created successfully'
            };

        } catch (error) {
            console.error(`[CHANGE SIGNER FIX] ❌ Transaction failed:`, error);
            console.error('Failed to propose change signer:', error);

            return {
                success: false,
                error: error
            };
        }
    }

    /**
     * Propose withdrawing rewards
     */
    async proposeWithdrawRewards(recipient, amount) {
        try {
            // Validate recipient address with proper checksumming
            recipient = this.validateAndChecksumAddress(recipient, 'Recipient Address');

            // Ensure we have a proper signer
            await this.ensureSigner();

            const result = await this.executeTransactionOnce(async () => {
                const amountWei = ethers.utils.parseEther(amount.toString());

                // CRITICAL FIX: Prepare contract call with proper signer connection
                const contractWithSigner = this.stakingContract.connect(this.signer);

                const tx = await contractWithSigner.proposeWithdrawRewards(recipient, amountWei);

                console.log('Propose withdraw rewards transaction sent:', tx.hash);

                // CRITICAL FIX: Return tx object, not receipt
                // The executeTransactionOnce will call tx.wait() via monitorTransactionWithTimeout
                return tx;
            }, 'proposeWithdrawRewards');

            return {
                success: true,
                transactionHash: result.transactionHash,
                blockNumber: result.blockNumber,
                gasUsed: result.gasUsed.toString(),
                message: 'Withdraw rewards proposal created successfully'
            };
        } catch (error) {
            console.error(`[WITHDRAW REWARDS FIX] ❌ Transaction failed:`, error);
            console.error('Failed to propose withdraw rewards:', error);

            return {
                success: false,
                error: error
            };
        }
    }

    // ============ ADMIN APPROVAL FUNCTIONS ============

    /**
     * Approve a multi-signature action
     */
    async approveAction(actionId) {
        try {
            // CRITICAL FIX: Convert string actionId to number for contract
            const numericActionId = parseInt(actionId);
            if (isNaN(numericActionId)) {
                throw new Error(`Invalid action ID: ${actionId}. Must be a valid number.`);
            }

            // CRITICAL: Contract method discovery and verification
            // Check for different possible method names
            const possibleMethods = ['approveAction', 'approve', 'voteForAction', 'confirmAction', 'approveProposal'];
            let methodToUse = null;

            for (const method of possibleMethods) {
                if (typeof this.stakingContract[method] === 'function') {
                    methodToUse = method;
                    break;
                }
            }

            if (!methodToUse) {
                console.error(`❌ No approval method found. Available methods:`, Object.keys(this.stakingContract.functions || {}));
                throw new Error('No approval method available in deployed contract. Check contract ABI.');
            }

            // CRITICAL: Ensure we have a proper signer with MetaMask connection
            await this.ensureSigner();

            // Verify signer is actually available
            if (!this.signer) {
                throw new Error('No signer available. Please connect MetaMask and ensure you are on Polygon Amoy network.');
            }

            const result = await this.executeTransactionOnce(async () => {
                // CRITICAL FIX: Ensure contract is connected with signer (like React pattern)
                // Create signer-connected contract instance (React pattern)
                const contractWithSigner = this.stakingContract.connect(this.signer);

                // Use the signer-connected contract (React pattern)
                const tx = await contractWithSigner[methodToUse](numericActionId);

                console.log('Approve action transaction sent:', tx.hash, 'Action ID:', numericActionId);
                // CRITICAL FIX: Return tx object, not receipt
                // The executeTransactionOnce will call tx.wait() via monitorTransactionWithTimeout
                return tx;
            }, 'approveAction');

            return {
                success: true,
                transactionHash: result.transactionHash,
                blockNumber: result.blockNumber
            };
        } catch (error) {
            console.error(`[APPROVE DEBUG] ❌ APPROVE ACTION FAILED!`);
            console.error(`[APPROVE DEBUG] Error details:`, error);
            console.error(`[APPROVE DEBUG] Error message:`, error.message);
            console.error(`[APPROVE DEBUG] Error code:`, error.code);
            console.error(`[APPROVE DEBUG] Error stack:`, error.stack);

            // Special handling for Internal JSON-RPC errors
            if (error.code === -32603 || error.message?.includes('Internal JSON-RPC error')) {
                console.error(`[APPROVE DEBUG] 🚨 INTERNAL JSON-RPC ERROR DETECTED`);
                console.error(`[APPROVE DEBUG] This usually indicates:`);
                console.error(`[APPROVE DEBUG]   1. Contract method signature mismatch`);
                console.error(`[APPROVE DEBUG]   2. Invalid action ID parameter`);
                console.error(`[APPROVE DEBUG]   3. Network/RPC provider issues`);
                console.error(`[APPROVE DEBUG]   4. MetaMask connection problems`);

                // Check contract connection
                console.log(`[APPROVE DEBUG] Contract connection check:`);
                console.log(`[APPROVE DEBUG]   Contract address: ${this.stakingContract?.address || 'undefined'}`);
                console.log(`[APPROVE DEBUG]   Original Action ID: ${actionId} (type: ${typeof actionId})`);
            }

            console.error('Failed to approve action:', error);

            return {
                success: false,
                error: error,
                originalError: error
            };
        }
    }

    /**
     * Execute a multi-signature action - FIXED TO MATCH OTHER METHODS
     */
    async executeAction(actionId) {
        try {
            // Simple validation and conversion like React
            if (!this.stakingContract) {
                throw new Error('Contract not initialized');
            }

            const numericActionId = parseInt(actionId);
            if (isNaN(numericActionId)) {
                throw new Error(`Invalid action ID: ${actionId}. Must be a valid number.`);
            }

            // Ensure we have a proper signer
            await this.ensureSigner();

            // CRITICAL: Check if action can be executed before attempting
            try {
                // Get action details
                const action = await this.stakingContract.actions(numericActionId);

                // Check if already executed
                if (action.executed) {
                    throw new Error(`Action ${numericActionId} has already been executed`);
                }

                // Check if rejected
                if (action.rejected) {
                    throw new Error(`Action ${numericActionId} has been rejected and cannot be executed`);
                }

                // Check expired flag
                if (action.expired) {
                    throw new Error(`Action ${numericActionId} has expired`);
                }

                // Check time-based expiry (7 days = 604800 seconds)
                if (action.proposedTime) {
                    const currentBlock = await this.provider.getBlock('latest');
                    const currentTime = currentBlock.timestamp;
                    const proposedTime = parseInt(action.proposedTime.toString());
                    const expiryTime = proposedTime + 604800; // 7 days

                    if (currentTime > expiryTime) {
                        throw new Error(`Action ${numericActionId} has expired (time-based check)`);
                    }
                }

                // Try to get required approvals (if function exists)
                try {
                    let requiredApprovals;

                    // Try different possible function names
                    if (typeof this.stakingContract.requiredApprovals === 'function') {
                        requiredApprovals = await this.stakingContract.requiredApprovals();
                    } else if (typeof this.stakingContract.REQUIRED_APPROVALS === 'function') {
                        requiredApprovals = await this.stakingContract.REQUIRED_APPROVALS();
                    } else if (typeof this.stakingContract.getRequiredApprovals === 'function') {
                        requiredApprovals = await this.stakingContract.getRequiredApprovals();
                    } else {
                        console.warn(`[EXECUTE DEBUG] ⚠️ Cannot find requiredApprovals function, skipping approval count check`);
                        requiredApprovals = null;
                    }

                    if (requiredApprovals) {
                        // Check if has enough approvals
                        if (action.approvals && action.approvals.lt(requiredApprovals)) {
                            throw new Error(`Action ${numericActionId} does not have enough approvals. Has ${action.approvals.toString()}, needs ${requiredApprovals.toString()}`);
                        }
                    }
                } catch (approvalError) {
                    console.error(`[EXECUTE DEBUG] ⚠️ Could not check approval count:`, approvalError.message);
                    console.error(`[EXECUTE DEBUG] ⚠️ Proceeding with execution attempt...`);
                }

            } catch (checkError) {
                console.error(`[EXECUTE DEBUG] ❌ Pre-execution check failed:`, checkError.message);

                // Only throw if it's a critical error (not approval count check)
                if (checkError.message.includes('does not exist') ||
                    checkError.message.includes('already been executed') ||
                    checkError.message.includes('been rejected') ||
                    checkError.message.includes('does not have enough approvals')) {
                    throw checkError;
                }

                // For other errors, log and continue
                console.warn(`[EXECUTE DEBUG] ⚠️ Non-critical check error, proceeding with execution attempt...`);
            }

            // Execute without retry (user can manually retry by pressing button again)
            const result = await this.executeTransactionOnce(async () => {
                // CRITICAL FIX: Ensure contract is connected with signer (like all other methods)
                const contractWithSigner = this.stakingContract.connect(this.signer);

                // Execute the transaction
                const tx = await contractWithSigner.executeAction(numericActionId);

                // CRITICAL FIX: Return tx object, not receipt
                // The executeTransactionOnce will call tx.wait() via monitorTransactionWithTimeout
                return tx;
            }, 'executeAction');

            return {
                success: true,
                transactionHash: result.transactionHash,
                blockNumber: result.blockNumber,
                gasUsed: result.gasUsed.toString()
            };

        } catch (error) {
            console.error(`[EXECUTE DEBUG] ❌ Failed to execute action:`, error);

            throw error;
        }
    }







    // ============ ADMIN PANEL WRAPPER METHODS ============
    // These methods provide the expected interface for the admin panel

    /**
     * Execute a proposal (wrapper for executeAction) - SIMPLIFIED TO MATCH REACT PATTERN
     */
    async executeProposal(proposalId) {
        try {
            const result = await this.executeAction(proposalId);

            return {
                success: true,
                transactionHash: result.transactionHash,
                blockNumber: result.blockNumber,
                gasUsed: result.gasUsed.toString()
            };

        } catch (error) {

            return {
                success: false,
                error: error
            };
        }
    }

    /**
     * Reject a multi-signature action
     */
    async rejectAction(actionId) {
        try {
            // CRITICAL FIX: Convert string actionId to number for contract
            const numericActionId = parseInt(actionId);
            if (isNaN(numericActionId)) {
                throw new Error(`Invalid action ID: ${actionId}. Must be a valid number.`);
            }

            // Ensure we have a proper signer
            await this.ensureSigner();

            const result = await this.executeTransactionOnce(async () => {
                // CRITICAL FIX: Ensure contract is connected with signer (React pattern)
                const contractWithSigner = this.stakingContract.connect(this.signer);

                const tx = await contractWithSigner.rejectAction(numericActionId);

                console.log('Reject action transaction sent:', tx.hash, 'Action ID:', numericActionId);
                // CRITICAL FIX: Return tx object, not receipt
                // The executeTransactionOnce will call tx.wait() via monitorTransactionWithTimeout
                return tx;
            }, 'rejectAction');

            return {
                success: true,
                transactionHash: result.transactionHash,
                blockNumber: result.blockNumber
            };
        } catch (error) {
            console.error('Failed to reject action:', error);

            return {
                success: false,
                error: error,
                originalError: error
            };
        }
    }

    /**
     * Get action details from contract
     */
    async getAction(actionId) {
        try {
            const [action, approvedBy, expiredOverride] = await Promise.all([
                this.stakingContract.actions(actionId),
                this.stakingContract.getActionApproval(actionId),
                this.stakingContract.isActionExpired(actionId)
            ]);

            const expired = expiredOverride !== undefined ? !!expiredOverride : action.expired;
            return {
                actionType: action.actionType,
                newHourlyRewardRate: action.newHourlyRewardRate,
                pairs: action.pairs,
                weights: action.weights,
                pairToAdd: action.pairToAdd,
                pairNameToAdd: action.pairNameToAdd,
                platformToAdd: action.platformToAdd,
                weightToAdd: action.weightToAdd,
                pairToRemove: action.pairToRemove,
                recipient: action.recipient,
                withdrawAmount: action.withdrawAmount,
                executed: action.executed,
                expired: expired,
                approvals: action.approvals,
                approvedBy: approvedBy,
                proposedTime: action.proposedTime,
                rejected: action.rejected
            };
        } catch (error) {
            console.error(`Failed to get action ${actionId}:`, error);
            // Like React version - return null instead of throwing
            return null;
        }
    }

    /**
     * Get total weight from contract with provider fallback
     */
    async getTotalWeight() {
        try {
            return await this.executeWithProviderFallback(async (provider, blockTag) => {
                // Create contract instance with specific provider
                const contractWithProvider = new ethers.Contract(
                    this.contractAddresses.get('STAKING'),
                    this.contractABIs.get('STAKING'),
                    provider
                );

                console.log('⚖️ Getting total weight from contract...');

                // Call with block tag if provided
                const weight = blockTag
                    ? await contractWithProvider.totalWeight({ blockTag })
                    : await contractWithProvider.totalWeight();

                console.log(`✅ Total weight: ${ethers.utils.formatEther(weight)}`);
                return weight;
            }, 'getTotalWeight');

        } catch (error) {
            const errorMsg = error?.message || 'Unknown error';
            console.error('⚠️ All providers failed for getTotalWeight, using fallback:', errorMsg);

            // Fallback to standard method as last resort
            return await this.executeWithRetry(async () => {
                if (!this.stakingContract) {
                    throw new Error('Staking contract not initialized');
                }
                return await this.stakingContract.totalWeight();
            }, 'getTotalWeight');
        }
    }

    /**
     * Get all pairs with their information
     */
    async getAllPairsInfo() {
        return await this.executeWithRetry(async () => {
            if (!this.stakingContract) {
                throw new Error('Staking contract not initialized');
            }

            console.log('🔍 Getting all pairs info from contract...');

            try {
                // Try multiple methods to get pairs
                let pairs = [];

                // Method 1: Try getPairs() if it exists
                try {
                    pairs = await this.stakingContract.getPairs();
                    console.log('✅ Got pairs from getPairs():', pairs.length);
                } catch (error) {
                    console.error('⚠️ getPairs() not available:', error.message);
                }

                // Method 2: If no pairs, try getActivePairs()
                if (!pairs || pairs.length === 0) {
                    try {
                        pairs = await this.stakingContract.getActivePairs();
                        console.log('✅ Got pairs from getActivePairs():', pairs.length);
                    } catch (error) {
                        console.error('⚠️ getActivePairs() not available:', error.message);
                    }
                }

                const pairsInfo = [];

                // Transform the contract data to the expected format
                for (let i = 0; i < pairs.length; i++) {
                    const pair = pairs[i];
                    try {
                        const pairInfo = {
                            id: (i + 1).toString(),
                            address: pair.lpToken || pair.pairToAdd || pair.address || pair[0],
                            name: pair.pairName || pair.pairNameToAdd || pair.name || pair[1] || `LP Token ${i + 1}`,
                            platform: pair.platform || pair.platformToAdd || pair[2] || 'Unknown',
                            weight: pair.weight ? ethers.utils.formatEther(pair.weight) : (pair.weightToAdd ? ethers.utils.formatEther(pair.weightToAdd) : (pair[3] ? ethers.utils.formatEther(pair[3]) : '0')),
                            isActive: pair.isActive !== undefined ? pair.isActive : (pair[4] !== undefined ? pair[4] : true),
                            // Add computed fields
                            apr: '0', // Would need to be calculated
                            tvl: 0,   // Would need to be calculated
                            totalStaked: '0' // Would need to be calculated
                        };
                        pairsInfo.push(pairInfo);
                        console.log(`✅ Processed pair: ${pairInfo.name} (${pairInfo.address})`);
                    } catch (error) {
                        console.error(`Failed to process pair ${pair.lpToken || pair.address}:`, error.message);
                        continue;
                    }
                }

                console.log(`✅ Returning ${pairsInfo.length} pairs`);
                return pairsInfo;

            } catch (error) {
                console.error('❌ Failed to get pairs info:', error);
                return [];
            }
        }, 'getAllPairsInfo');
    }

    /**
     * Load user data for all LP pairs using multicall optimization
     * @param {string} userAddress - User's wallet address
     * @param {Array} pairs - Array of LP pair objects
     * @returns {Map} Map of pair address to user data (balance, allowance, stake, pendingRewards)
     */
    async getUserDataForAllPairs(userAddress, pairs) {
        const stakingAddress = this.contractAddresses.get('STAKING');
        const calls = [];
        const erc20Interface = new ethers.utils.Interface(this.contractABIs.get('ERC20'));

        // Prepare multicall for each pair (3 calls: balance, allowance, stakeInfo)
        pairs.forEach(pair => {
            const pairAddress = pair.address || pair.lpToken;
            calls.push(
                this.multicallService.createCall({ address: pairAddress, interface: erc20Interface }, 'balanceOf', [userAddress]),
                this.multicallService.createCall({ address: pairAddress, interface: erc20Interface }, 'allowance', [userAddress, stakingAddress]),
                this.multicallService.createCall(this.stakingContract, 'getUserStakeInfo', [userAddress, pairAddress])
            );
        });

        const results = await this.multicallService.batchCall(calls);
        const userData = new Map();

        // Parse results (3 results per pair)
        pairs.forEach((pair, index) => {
            const baseIndex = index * 3;
            const pairAddress = pair.address || pair.lpToken;
            const [balanceResult, allowanceResult, stakeResult] = results.slice(baseIndex, baseIndex + 3);

            const decodedStakeInfo = stakeResult?.success  
                ? this.multicallService.decodeResult(this.stakingContract, 'getUserStakeInfo', stakeResult.returnData)  
                : null;

            userData.set(pairAddress, {
                balance: balanceResult?.success ? this.multicallService.decodeResult(erc20Interface, 'balanceOf', balanceResult.returnData) || ethers.BigNumber.from(0) : ethers.BigNumber.from(0),
                allowance: allowanceResult?.success ? this.multicallService.decodeResult(erc20Interface, 'allowance', allowanceResult.returnData) || ethers.BigNumber.from(0) : ethers.BigNumber.from(0),
                stake: decodedStakeInfo?.amount || ethers.BigNumber.from(0),
                pendingRewards: decodedStakeInfo?.pendingRewards || ethers.BigNumber.from(0)
            });
        });

        return userData;
    }

    // ==================== CONTRACT WRITE OPERATIONS ====================

    /**
     * Approve LP token for staking with enhanced gas estimation
     */
    async approveLPToken(pairName, amount) {
        try {
            // Get LP token contract
            const lpContract = this.getLPTokenContract(pairName);

            return await this.executeTransactionOnce(async () => {
                const stakingAddress = this.contractAddresses.get('STAKING');
                const amountWei = typeof amount === 'bigint' ? amount : ethers.utils.parseEther(amount.toString());
                const tx = await lpContract.approve(stakingAddress, amountWei);

                console.log('Approve transaction sent:', tx.hash);

                return tx;
            }, 'approveLPToken');
        } catch (error) {
            console.error('❌ Failed to approve LP token:', error);
            return {
                success: false,
                error: error
            };
        }
    }

    /**
     * Claim rewards for LP token with enhanced gas estimation
     */
    async claimRewards(lpTokenAddress) {
        // Ensure we have a signer for transactions
        await this.ensureSigner();

        // Verify contract is available
        if (!this.stakingContract) {
            const errorMsg = 'Staking contract is not available. Please ensure you are connected to the correct network.';
            console.error('❌ Cannot claim rewards: Staking contract not initialized');
            
            
            window.notificationManager?.error(errorMsg);
            
            
            return {
                success: false,
                error: errorMsg
            };
        }

        try {
            return await this.executeTransactionOnce(async () => {
                // Connect contract with signer for transaction
                const contractWithSigner = this.stakingContract.connect(this.signer);
                const tx = await contractWithSigner.claimRewards(lpTokenAddress);

                console.log(`✅ Claim rewards transaction sent: ${tx.hash}`);

                // CRITICAL FIX: Return tx object, not receipt
                // The executeTransactionOnce will call tx.wait() via monitorTransactionWithTimeout
                return tx;
            }, 'claimRewards');
        } catch (error) {
            console.error('❌ Failed to claim rewards:', error);
            return {
                success: false,
                error: error
            };
        }
    }

    /**
     * Stake LP tokens
     */
    async stake(lpTokenAddress, amount) {
        // Ensure we have a signer for transactions
        await this.ensureSigner();

        // Verify contract is available
        if (!this.stakingContract) {
            const errorMsg = 'Staking contract is not available. Please ensure you are connected to the correct network.';
            console.error('❌ Cannot stake: Staking contract not initialized');
            
            if (window.notificationManager) {
                window.notificationManager.error(errorMsg);
            }
            
            return {
                success: false,
                error: errorMsg
            };
        }

        try {
            return await this.executeTransactionOnce(async () => {
                // Convert amount to wei
                const amountWei = ethers.utils.parseEther(amount.toString());

                // Connect contract with signer for transaction
                const contractWithSigner = this.stakingContract.connect(this.signer);
                const tx = await contractWithSigner.stake(lpTokenAddress, amountWei);

                console.log(`✅ Stake transaction sent: ${tx.hash}`);
                console.log(`   Amount: ${amount} LP tokens`);

                // CRITICAL FIX: Return tx object, not receipt
                // The executeTransactionOnce will call tx.wait() via monitorTransactionWithTimeout
                return tx;
            }, 'stake');
        } catch (error) {
            console.error('❌ Failed to stake:', error);
            return {
                success: false,
                error: error
            };
        }
    }

    /**
     * Unstake LP tokens
     */
    async unstake(lpTokenAddress, amount, claimRewards) {
        // Ensure we have a signer for transactions
        await this.ensureSigner();

        // Verify contract is available
        if (!this.stakingContract) {
            const errorMsg = 'Staking contract is not available. Please ensure you are connected to the correct network.';
            console.error('❌ Cannot unstake: Staking contract not initialized');
            
            if (window.notificationManager) {
                window.notificationManager.error(errorMsg);
            }
            
            return {
                success: false,
                error: errorMsg
            };
        }

        try {
            return await this.executeTransactionOnce(async () => {
                // Convert amount to wei
                const amountWei = ethers.utils.parseEther(amount.toString());

                // Connect contract with signer for transaction
                const contractWithSigner = this.stakingContract.connect(this.signer);
                const tx = await contractWithSigner.unstake(lpTokenAddress, amountWei, claimRewards);

                console.log(`✅ Unstake transaction sent: ${tx.hash}`);
                console.log(`   Amount: ${amount} LP tokens`);

                // CRITICAL FIX: Return tx object, not receipt
                // The executeTransactionOnce will call tx.wait() via monitorTransactionWithTimeout
                return tx;
            }, 'unstake');
        } catch (error) {
            console.error('❌ Failed to unstake:', error);
            return {
                success: false,
                error: error
            };
        }
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Execute read operation with enhanced retry logic and error handling
     */
    async executeWithRetry(operation, operationName, retries = this.config.maxRetries) {
        const context = { operation: operationName, contractManager: true };

        // Safety check for errorHandler availability
        if (!window.errorHandler || typeof window.errorHandler.executeWithRetry !== 'function') {
            console.warn('ErrorHandler not available, using fallback retry logic');
            return await this.fallbackExecuteWithRetry(operation, operationName, retries);
        }

        return await window.errorHandler.executeWithRetry(async () => {
            try {
                console.log(`Executing ${operationName}`);
                const result = await operation();
                console.log(`${operationName} completed successfully`);
                return result;
            } catch (error) {
                // Enhanced error processing with safety check
                let processedError = error;
                if (window.errorHandler && typeof window.errorHandler.processError === 'function') {
                    processedError = window.errorHandler.processError(error, context);
                } else {
                    console.warn('ErrorHandler.processError not available, using raw error');
                }

                // Try fallback provider for network errors
                const isNetworkError = processedError.category === 'network' || 
                                     error.code === 'NETWORK_ERROR' ||
                                     error.message?.includes('401') ||
                                     error.message?.includes('403') ||
                                     error.message?.includes('429') ||
                                     error.message?.includes('timeout') ||
                                     error.message?.includes('Internal JSON-RPC error') ||
                                     error.message?.includes('could not detect network');
                
                if (isNetworkError && this.canUseFallbackProvider()) {
                    console.log('🌐 Network/RPC error detected, trying fallback provider...');
                    const switched = await this.tryFallbackProvider();
                    if (switched) {
                        console.log('✅ Successfully switched to fallback provider');
                    } else {
                        console.warn('⚠️ Failed to switch to fallback provider, continuing with current provider');
                    }
                }

                throw error; // Re-throw for retry logic
            }
        }, context, {
            maxRetries: retries,
            baseDelay: this.config.retryDelay
        });
    }

    /**
     * Execute operation with provider fallback and block number strategies - PERFORMANCE OPTIMIZED
     */
    async executeWithProviderFallback(operation, operationName, retries = 3) {
        // Get working RPC providers in order of preference
        const workingProviders = await this.getWorkingProvidersForHistoricalState();

        // OPTIMIZATION: Reduced block strategies to only most reliable ones
        const blockStrategies = ['latest', null]; // Removed 'pending' to reduce attempts

        for (let i = 0; i < workingProviders.length; i++) {
            const provider = workingProviders[i];
            const providerUrl = provider.connection?.url || 'Unknown';

            for (let j = 0; j < blockStrategies.length; j++) {
                const blockTag = blockStrategies[j];
                const strategyDesc = blockTag || 'no-block-tag';

                try {
                    const result = await operation(provider, blockTag);
                    return result;

                } catch (error) {
                    const errorMsg = error?.message || 'Unknown error';
                    console.error(`❌ ${operationName} failed with ${providerUrl} (${strategyDesc}):`, errorMsg);

                    // If this is a "missing trie node" error, try next block strategy
                    if (errorMsg.includes && errorMsg.includes('missing trie node')) {
                        console.error('Missing trie node error, trying next block strategy');
                        continue;
                    }

                    // For other errors, try next provider
                    break;
                }
            }
        }

        throw new Error(`${operationName} failed with all providers and block strategies`);
    }

    /**
     * Get working providers optimized for historical state queries - PERFORMANCE OPTIMIZED
     */
    async getWorkingProvidersForHistoricalState() {
        const providers = [];

        // OPTIMIZATION: Only use configured providers to reduce fallback time
        const rpcUrls = this.getAllRPCUrls();

        if (!rpcUrls || rpcUrls.length === 0) {
            throw new Error('No RPC URLs configured for historical state queries');
        }

        for (const rpcUrl of rpcUrls) {
            try {
                const provider = new ethers.providers.JsonRpcProvider({
                    url: rpcUrl,
                    timeout: 4000  // OPTIMIZATION: Reduced timeout from 8000ms to 4000ms for faster failover
                });

                // Quick connectivity test with shorter timeout
                await provider.getBlockNumber();
                providers.push(provider);

            } catch (error) {
                console.error(`⚠️ Provider not available: ${rpcUrl} - ${error.message}`);
                continue;
            }
        }

        if (providers.length === 0) {
            throw new Error('No working providers available for historical state queries');
        }

        console.log(`📡 Found ${providers.length} working providers for historical queries`);
        return providers;
    }

    /**
     * Fallback retry logic when ErrorHandler is not available
     */
    async fallbackExecuteWithRetry(operation, operationName, retries = this.config.maxRetries) {
        let lastError = null;

        for (let attempt = 1; attempt <= retries + 1; attempt++) {
            try {
                console.log(`Fallback: Executing ${operationName} (attempt ${attempt}/${retries + 1})`);
                const result = await operation();

                if (attempt > 1) {
                    console.log(`${operationName} succeeded after ${attempt} attempts`);
                }

                return result;
            } catch (error) {
                lastError = error;
                console.error(`${operationName} attempt ${attempt} failed:`, error);

                // Check for RPC errors that should trigger provider switch
                const isRpcError = error.code === -32603 ||
                                 (error.error && error.error.code === -32603) ||
                                 (error.message && error.message.includes('missing trie node')) ||
                                 (error.message && error.message.includes('Internal JSON-RPC error')) ||
                                 (error.message && error.message.includes('network error')) ||
                                 (error.message && error.message.includes('timeout')) ||
                                 (error.message && error.message.includes('could not detect network'));

                if (isRpcError && attempt <= retries) {
                    console.warn(`🔄 RPC error detected in fallback, switching provider and retrying...`);
                    await this.switchToNextProvider();

                    // Recreate signer with new provider for transactions
                    if (operationName.includes('propose') || operationName.includes('approve') || operationName.includes('reject') || operationName.includes('execute')) {
                        try {
                            this.signer = this.provider.getSigner();
                            await this.initializeContracts();
                            console.log('✅ Provider switched and signer recreated in fallback');
                        } catch (signerError) {
                            console.error('❌ Failed to recreate signer in fallback:', signerError);
                        }
                    }
                }

                // Don't retry on last attempt
                if (attempt > retries) {
                    console.error(`${operationName} failed after ${attempt} attempts`);
                    throw error;
                }

                // Wait before retry with exponential backoff
                const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
                console.log(`Retrying ${operationName} in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError;
    }

    /**
     * Notify listeners about transaction phase changes
     */
    notifyTransactionPhase(operationName, phase) {
        try {
            if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
                return;
            }

            const detail = {
                operationName,
                phase,
                timestamp: Date.now()
            };

            const eventName = 'transaction-phase';
            // Modern browsers support CustomEvent constructor
            if (typeof CustomEvent === 'function') {
                window.dispatchEvent(new CustomEvent(eventName, { detail }));
                return;
            }

            // Fall back to legacy initCustomEvent when CustomEvent constructor is unavailable
            if (typeof document !== 'undefined' && typeof document.createEvent === 'function') {
                const legacyEvent = document.createEvent('CustomEvent');
                const legacyInit = /** @type {any} */ (legacyEvent).initCustomEvent;
                if (typeof legacyInit === 'function') {
                    // Signature marked deprecated but required for older browsers; safe via dynamic call
                    legacyInit.call(legacyEvent, eventName, false, false, detail);
                } else {
                    // Last resort: manually attach detail when initCustomEvent is missing entirely
                    legacyEvent.detail = detail;
                }
                window.dispatchEvent(legacyEvent);
            }
        } catch (error) {
            console.error(`⚠️ Failed to dispatch transaction phase event for ${operationName}: ${error.message}`);
        }
    }

    /**
     * Monitor transaction with timeout and detailed logging
     */
    async monitorTransactionWithTimeout(tx, operationName, timeoutMs = 60000) {
        const startTime = Date.now();
        console.log(`[TX MONITOR] Monitoring transaction ${tx.hash} (timeout: ${timeoutMs/1000}s)`);

        return new Promise((resolve, reject) => {
            // Set up timeout
            const timeoutId = setTimeout(() => {
                console.error(`[TX MONITOR] ⏰ TIMEOUT REACHED after ${timeoutMs/1000} seconds`);
                reject(new Error(`Transaction timeout after ${timeoutMs/1000} seconds.`));
            }, timeoutMs);

            // Use async IIFE to handle await inside Promise executor
            (async () => {
                try {
                    // Monitor transaction with periodic status updates
                    let checkCount = 0;
                    const checkInterval = setInterval(() => {
                        checkCount++;
                        const elapsed = Math.round((Date.now() - startTime) / 1000);
                        console.log(`[TX MONITOR] ⏳ Transaction pending for ${elapsed}s...`);
                    }, 10000); // Log every 10 seconds

                    const receipt = await tx.wait();

                    // Clear monitoring
                    clearTimeout(timeoutId);
                    clearInterval(checkInterval);

                    const totalTime = Math.round((Date.now() - startTime) / 1000);

                    // Check if transaction succeeded or failed
                    if (receipt.status === 0) {
                        console.error(`[TX MONITOR] ❌ TRANSACTION FAILED ON BLOCKCHAIN!`);
                        console.error(`[TX MONITOR] Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed.toString()}, Status: FAILED (0)`);

                        // Throw error with helpful message
                        const error = new Error(`Transaction failed on blockchain. The smart contract rejected the transaction.`);
                        error.code = 'TRANSACTION_REVERTED';
                        error.receipt = receipt;
                        throw error;
                    }

                    // add success to receipt. needed for ui to detect and display success.
                    receipt.success = true;

                    console.log(`[TX MONITOR] ✅ Transaction confirmed in ${totalTime}s - Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed}`);

                    resolve(receipt);

                } catch (error) {
                    console.error(`[TX MONITOR] ❌ TRANSACTION MONITORING ERROR!`);
                    console.error(`[TX MONITOR]   Error type: ${error.constructor.name}`);
                    console.error(`[TX MONITOR]   Error message: ${error.message}`);
                    console.error(`[TX MONITOR]   Error code: ${error.code}`);
                    console.error(`[TX MONITOR]   Error details:`, error);

                    clearTimeout(timeoutId);
                    console.error(`❌ Transaction monitoring failed: ${error.message}`);
                    reject(error);
                }
            })();
        });
    }

    /**
     * Execute transaction once without automatic retry
     * 
     * Used for all user-initiated transactions (staking, proposals, approvals, etc.)
     * Users can manually retry by pressing the button again if a transaction fails.
     * 
     * @param {Function} operation - Async function that returns a transaction object
     * @param {string} operationName - Name of the operation for logging
     * @returns {Promise<Object>} Transaction receipt with hash, blockNumber, etc.
     */
    async executeTransactionOnce(operation, operationName) {
        try {

            // Execute the operation (this sends the transaction)
            this.notifyTransactionPhase(operationName, 'user_approval');
            const tx = await operation();
            this.notifyTransactionPhase(operationName, 'processing');

            // CRITICAL: Log transaction hash immediately after MetaMask confirmation
            console.log(`✅ Transaction submitted to blockchain: ${tx.hash}`);
            console.log(`[TRANSACTION MONITORING] ${operationName} - Hash: ${tx.hash}`);

            // Add transaction monitoring with timeout
            const result = await this.monitorTransactionWithTimeout(tx, operationName, 300000); // 5 minute timeout
            this.notifyTransactionPhase(operationName, 'confirmed');


            return result;
        } catch (error) {
            console.log(`❌ Transaction ${operationName} failed:`, error.message);
            this.notifyTransactionPhase(operationName, 'failed');

            // Process error through errorHandler if available
            const context = { operation: operationName, contractManager: true, transaction: true };
            let processedError = window?.errorHandler?.processError?.(error, context) || error;

            console.error(`Transaction ${operationName} failed:`, error.message);

            // Re-throw error (no retry - user can manually retry)
            throw processedError;
        }
    }


    /**
     * Check if fallback provider can be used
     */
    canUseFallbackProvider() {
        return this.currentProviderIndex < this.fallbackProviders.length - 1;
    }

    /**
     * Try switching to fallback provider with enhanced error handling
     */
    async tryFallbackProvider() {
        if (!this.canUseFallbackProvider()) {
            console.log('No more fallback providers available');
            return false;
        }

        try {
            this.currentProviderIndex++;
            const fallbackProvider = this.fallbackProviders[this.currentProviderIndex];

            console.log(`Switching to fallback provider ${this.currentProviderIndex + 1}/${this.fallbackProviders.length}`);

            // Test the fallback provider first with shorter timeout
            await Promise.race([
                fallbackProvider.getNetwork(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Provider test timeout')), 3000))
            ]);

            // Update provider and signer
            this.provider = fallbackProvider;

            // Get signer if wallet is connected
            if (window.ethereum) {
                try {
                    const provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
                    this.signer = provider.getSigner();
                    console.log('✅ Signer obtained from MetaMask during provider switch');
                } catch (error) {
                    console.error('⚠️ Could not get signer during provider switch:', error.message);
                }
            }

            // Reinitialize contracts with new provider
            await this.initializeContracts();

            console.log('Successfully switched to fallback provider');
            return true;
        } catch (error) {
            console.error('Fallback provider switch failed:', error);
            return false;
        }
    }

    /**
     * Delay utility for retry logic
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Cleanup contract manager
     */
    cleanup() {
        this.eventListeners.forEach(cleanup => {
            try {
                cleanup();
            } catch (error) {
                console.error('Error cleaning up event listener:', error);
            }
        });

        this.eventListeners = [];
        this.stakingContract = null;
        this.rewardTokenContract = null;
        this.lpTokenContracts.clear();
        this.provider = null;
        this.signer = null;
        this.fallbackProviders = [];
        this.contractABIs.clear();
        this.contractAddresses.clear();
        this.isInitialized = false;

        console.log('ContractManager cleaned up completely');
    }

    /**
     * Safe contract call with RPC failover and error handling
     */
    async safeContractCall(contractFunction, errorFallback = null, functionName = 'unknown') {
        const maxRetries = 2;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await contractFunction();

            } catch (error) {
                // Check for contract not deployed errors
                if (error.message.includes('call revert exception') ||
                    error.message.includes('execution reverted') ||
                    error.message.includes('contract not deployed') ||
                    error.message.includes('not a function') ||
                    error.message.includes('Cannot read properties of null') ||
                    error.message.includes('not initialized')) {
                    console.warn(`⚠️ Contract call failed gracefully for ${functionName}: ${error.message}`);
                    console.warn('This is expected when contracts are not deployed on the current network');
                    return errorFallback;
                }

                const isRpcError = error.code === -32603 ||
                                 error.code === 'NETWORK_ERROR' ||
                                 error.code === 'SERVER_ERROR' ||
                                 error.message.includes('missing trie node') ||
                                 error.message.includes('Internal JSON-RPC error') ||
                                 error.message.includes('missing revert data') ||
                                 error.message.includes('NETWORK_ERROR') ||
                                 error.message.includes('SERVER_ERROR') ||
                                 error.message.includes('could not detect network') ||
                                 error.message.includes('call revert exception') ||
                                 (error.error && error.error.code === -32603);

                if (isRpcError && attempt < maxRetries - 1) {
                    console.log(`🔄 RPC error detected in ${functionName} (code: ${error.code}), switching provider and retrying...`);

                    // Try to switch to next provider
                    try {
                        await this.switchToNextProvider();
                        continue; // Retry with new provider
                    } catch (switchError) {
                        console.error(`Failed to switch provider: ${switchError.message}`);
                    }
                } else {
                    console.error(`❌ Contract call failed for ${functionName}:`, error.message);
                    return errorFallback;
                }
            }
        }

        return errorFallback;
    }

    /**
     * Switch to next available RPC provider
     */
    async switchToNextProvider() {
        const rpcUrls = this.getAllRPCUrls();

        if (!rpcUrls || rpcUrls.length === 0) {
            throw new Error('No working RPC providers available');
        }

        if (rpcUrls.length === 1) {
            throw new Error('No alternative RPC providers configured');
        }

        for (let attempt = 0; attempt < rpcUrls.length; attempt++) {
            this.currentProviderIndex = (this.currentProviderIndex + 1) % rpcUrls.length;
            const newRpcUrl = rpcUrls[this.currentProviderIndex];

            if (!newRpcUrl) {
                continue;
            }

            console.log(`🔄 Switching to RPC: ${newRpcUrl}`);

            try {
                // Create new provider with timeout
                this.provider = new ethers.providers.JsonRpcProvider({
                    url: newRpcUrl,
                    timeout: 5000 // 5 second timeout
                });

                // Test the new provider with timeout
                const testPromise = this.provider.getBlockNumber();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Provider test timeout')), 2000)
                );

                await Promise.race([testPromise, timeoutPromise]);

                // Reinitialize contracts with new provider
                if (this.stakingContract) {
                    this.stakingContract = new ethers.Contract(
                        this.stakingContract.address,
                        this.stakingContract.interface,
                        this.signer || this.provider
                    );
                }

                if (this.rewardTokenContract) {
                    this.rewardTokenContract = new ethers.Contract(
                        this.rewardTokenContract.address,
                        this.rewardTokenContract.interface,
                        this.signer || this.provider
                    );
                }

                console.log(`✅ Successfully switched to RPC: ${newRpcUrl}`);
                return; // Success, exit

            } catch (testError) {
                console.error(`❌ Failed to switch to RPC ${newRpcUrl}: ${testError.message}`);
                // Continue to try next RPC
            }
        }

        throw new Error('No working RPC providers available');
    }

    /**
     * Validate and checksum an Ethereum address
     * Prevents "bad address checksum" errors
     * @param {string} address - The address to validate
     * @param {string} fieldName - Name of the field for error messages
     * @returns {string} - Checksummed address
     * @throws {Error} - If address is invalid
     */
    validateAndChecksumAddress(address, fieldName = 'Address') {
        try {
            // Check if address exists
            if (!address) {
                throw new Error(`${fieldName} is required`);
            }

            // Check if it's a valid address format
            if (!ethers.utils.isAddress(address)) {
                throw new Error(`${fieldName} is not a valid Ethereum address: ${address}`);
            }

            // Return checksummed address to prevent checksum errors
            const checksummedAddress = ethers.utils.getAddress(address);


            return checksummedAddress;

        } catch (error) {
            console.error(`[ADDRESS VALIDATION] ❌ Failed to validate ${fieldName}:`, error.message);
            throw new Error(`Invalid ${fieldName}: ${error.message}`);
        }
    }

    /**
     * Get current signer address for permission checks (network-agnostic)
     * Directly queries wallet accounts without signer setup. Use for UI/permission checks.
     * 
     * @returns {Promise<string|null>} The connected wallet address or null if not connected
     */
    async getCurrentSignerForPermissions() {
        try {
            if (typeof window.ethereum === 'undefined') return null;
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            return accounts.length > 0 ? accounts[0] : null;
        } catch (error) {
            if (error.code === 'UNSUPPORTED_OPERATION' || 
                error.message?.includes('unknown account') ||
                error.message?.includes('missing provider')) {
                return null;
            }
            console.error('Failed to get current signer address for permissions:', error);
            return null;
        }
    }

    /**
     * Load basic contract data (hourly reward rate and total weight) using multicall
     * Falls back to individual contract calls if multicall is not available
     * @returns {Object} Object containing hourlyRewardRate and totalWeight in wei
     */
    async getBasicContractData() {
        // Wait up to 2 seconds for multicall to initialize if it exists but isn't ready (race condition fix)
        if (!this.multicallService?.isReady()) {
            for (let i = 0; i < 40 && !this.multicallService?.isReady(); i++) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        // Try multicall if available
        if (this.multicallService?.isReady()) {
            const calls = [
                this.multicallService.createCall(this.stakingContract, 'hourlyRewardRate', []),
                this.multicallService.createCall(this.stakingContract, 'totalWeight', [])
            ];
            const results = await this.multicallService.tryAggregate(calls);
            
            if (results?.length >= 2) {
                return {
                    hourlyRewardRate: results[0]?.success ? this.multicallService.decodeResult(this.stakingContract, 'hourlyRewardRate', results[0].returnData) || ethers.BigNumber.from(0) : ethers.BigNumber.from(0),
                    totalWeight: results[1]?.success ? this.multicallService.decodeResult(this.stakingContract, 'totalWeight', results[1].returnData) || ethers.BigNumber.from(0) : ethers.BigNumber.from(0)
                };
            }
        }
        console.warn('Multicall service not available, falling back to individual contract calls');
        const [hourlyRewardRate, totalWeight] = await Promise.all([
            this.stakingContract.hourlyRewardRate().catch(() => ethers.BigNumber.from(0)),
            this.stakingContract.totalWeight().catch(() => ethers.BigNumber.from(0))
        ]);
        
        return {
            hourlyRewardRate: hourlyRewardRate || ethers.BigNumber.from(0),
            totalWeight: totalWeight || ethers.BigNumber.from(0)
        };
    }

    /**
     * Load contract stats using multicall optimization
     * @returns {Promise<Object|null>} Contract stats object or null if multicall fails
     * @throws {Error} If multicall service is not available
     */
    async getContractStatsWithMulticall() {
        try {
            if (!this.multicallService?.isReady()) {
                throw new Error('Multicall service not available');
            }
            
            const calls = [
                this.multicallService.createCall(this.stakingContract, 'rewardToken', []),
                this.multicallService.createCall(this.stakingContract, 'hourlyRewardRate', []),
                this.multicallService.createCall(this.stakingContract, 'REQUIRED_APPROVALS', []),
                this.multicallService.createCall(this.stakingContract, 'actionCounter', []),
                this.multicallService.createCall(this.stakingContract, 'totalWeight', [])
            ];
            
            const results = await this.multicallService.tryAggregate(calls);
            
            if (!results || results.length !== 5) {
                throw new Error('Invalid multicall results received');
            }
            
            return {
                rewardToken: results[0]?.success ? this.multicallService.decodeResult(this.stakingContract, 'rewardToken', results[0].returnData) : null,
                hourlyRewardRate: results[1]?.success ? this.multicallService.decodeResult(this.stakingContract, 'hourlyRewardRate', results[1].returnData) : null,
                requiredApprovals: results[2]?.success ? this.multicallService.decodeResult(this.stakingContract, 'REQUIRED_APPROVALS', results[2].returnData) : null,
                actionCounter: results[3]?.success ? this.multicallService.decodeResult(this.stakingContract, 'actionCounter', results[3].returnData) : null,
                totalWeight: results[4]?.success ? this.multicallService.decodeResult(this.stakingContract, 'totalWeight', results[4].returnData) : null
            };
        } catch (error) {
            console.error(`⚠️ Multicall failed for contract stats: ${error.message}`);
            return null;
        }
    }
}

    // Export ContractManager class, used in the master-initializer.js file
    global.ContractManager = ContractManager;
})(window);
