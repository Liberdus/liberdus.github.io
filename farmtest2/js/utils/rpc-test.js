/**
 * RPC Connection Test Utility
 * Tests RPC endpoints for reliability and performance
 */

class RPCTester {
    constructor() {
        this.testResults = [];
        this.isRunning = false;
    }

    /**
     * Test all configured RPC endpoints
     */
    async testAllRPCs() {
        if (this.isRunning) {
            console.log('RPC test already running...');
            return this.testResults;
        }

        this.isRunning = true;
        this.testResults = [];
        
        console.log('🔄 Starting RPC endpoint tests...');

        // Get RPC URLs from configuration
        const rpcUrls = this.getRPCUrls();
        console.log(`📡 Testing ${rpcUrls.length} RPC endpoints...`);

        // Test each RPC endpoint
        for (let i = 0; i < rpcUrls.length; i++) {
            const rpcUrl = rpcUrls[i];
            console.log(`\n🔄 Testing RPC ${i + 1}/${rpcUrls.length}: ${rpcUrl}`);
            
            const result = await this.testSingleRPC(rpcUrl, i + 1);
            this.testResults.push(result);
            
            // Log immediate result
            const status = result.success ? '✅' : '❌';
            const details = result.success 
                ? `Chain: ${result.chainId}, Block: ${result.blockNumber}, Time: ${result.responseTime}ms`
                : `Error: ${result.error}`;
            console.log(`${status} RPC ${i + 1}: ${details}`);
        }

        // Summary
        const successful = this.testResults.filter(r => r.success).length;
        console.log(`\n📊 RPC Test Summary: ${successful}/${rpcUrls.length} endpoints working`);
        
        this.isRunning = false;
        return this.testResults;
    }

    /**
     * Test a single RPC endpoint
     */
    async testSingleRPC(rpcUrl, index) {
        const result = {
            index,
            url: rpcUrl,
            success: false,
            error: null,
            chainId: null,
            blockNumber: null,
            responseTime: null,
            timestamp: new Date().toISOString()
        };

        try {
            const startTime = Date.now();

            // Create provider with timeout
            const provider = new ethers.providers.JsonRpcProvider({
                url: rpcUrl,
                timeout: 10000
            });

            // Test network connection
            const networkPromise = provider.getNetwork();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Connection timeout (10s)')), 10000)
            );

            const network = await Promise.race([networkPromise, timeoutPromise]);

            // Verify correct network (Polygon Amoy)
            if (network.chainId !== 80002) {
                throw new Error(`Wrong network: expected 80002, got ${network.chainId}`);
            }

            // Test block number retrieval
            const blockPromise = provider.getBlockNumber();
            const blockTimeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Block number timeout (5s)')), 5000)
            );

            const blockNumber = await Promise.race([blockPromise, blockTimeoutPromise]);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            // Success
            result.success = true;
            result.chainId = network.chainId;
            result.blockNumber = blockNumber;
            result.responseTime = responseTime;

        } catch (error) {
            result.error = error.message;
        }

        return result;
    }

    /**
     * Get RPC URLs from configuration
     */
    getRPCUrls() {
        const rpcUrls = [];

        // Primary RPC
        if (window.CONFIG?.NETWORK?.RPC_URL) {
            rpcUrls.push(window.CONFIG.NETWORK.RPC_URL);
        }

        // Fallback RPCs
        if (window.CONFIG?.NETWORK?.FALLBACK_RPCS) {
            rpcUrls.push(...window.CONFIG.NETWORK.FALLBACK_RPCS);
        }

        // Legacy RPC format
        if (window.CONFIG?.RPC?.POLYGON_AMOY) {
            rpcUrls.push(...window.CONFIG.RPC.POLYGON_AMOY);
        }

        // Remove duplicates
        return [...new Set(rpcUrls)];
    }

    /**
     * Get working RPC endpoints
     */
    getWorkingRPCs() {
        return this.testResults.filter(r => r.success);
    }

    /**
     * Get fastest RPC endpoint
     */
    getFastestRPC() {
        const working = this.getWorkingRPCs();
        if (working.length === 0) return null;
        
        return working.reduce((fastest, current) => 
            current.responseTime < fastest.responseTime ? current : fastest
        );
    }

    /**
     * Display detailed test results
     */
    displayResults() {
        console.log('\n📊 Detailed RPC Test Results:');
        console.log('================================');
        
        this.testResults.forEach((result, index) => {
            const status = result.success ? '✅ WORKING' : '❌ FAILED';
            console.log(`\nRPC ${index + 1}: ${status}`);
            console.log(`URL: ${result.url}`);
            
            if (result.success) {
                console.log(`Chain ID: ${result.chainId}`);
                console.log(`Block Number: ${result.blockNumber}`);
                console.log(`Response Time: ${result.responseTime}ms`);
            } else {
                console.log(`Error: ${result.error}`);
            }
        });

        const working = this.getWorkingRPCs();
        const fastest = this.getFastestRPC();

        console.log('\n📈 Summary:');
        console.log(`Working RPCs: ${working.length}/${this.testResults.length}`);
        
        if (fastest) {
            console.log(`Fastest RPC: ${fastest.url} (${fastest.responseTime}ms)`);
        }
    }

    /**
     * Test contract connectivity with working RPCs
     */
    async testContractConnectivity() {
        console.log('\n🔄 Testing contract connectivity...');
        
        const workingRPCs = this.getWorkingRPCs();
        if (workingRPCs.length === 0) {
            console.log('❌ No working RPCs available for contract testing');
            return;
        }

        const contractAddress = window.CONFIG?.CONTRACTS?.STAKING_CONTRACT;
        if (!contractAddress) {
            console.log('❌ No staking contract address configured');
            return;
        }

        for (const rpcResult of workingRPCs.slice(0, 3)) { // Test top 3 working RPCs
            try {
                console.log(`🔄 Testing contract on: ${rpcResult.url}`);
                
                const provider = new ethers.providers.JsonRpcProvider(rpcResult.url);
                const code = await provider.getCode(contractAddress);
                
                if (code === '0x') {
                    console.log(`❌ Contract not found at ${contractAddress}`);
                } else {
                    console.log(`✅ Contract found, bytecode length: ${code.length} chars`);
                    
                    // Try to call a simple view function
                    const contract = new ethers.Contract(
                        contractAddress,
                        ['function rewardToken() external view returns (address)'],
                        provider
                    );
                    
                    const rewardToken = await contract.rewardToken();
                    console.log(`✅ Contract call successful, reward token: ${rewardToken}`);
                }
            } catch (error) {
                console.log(`❌ Contract test failed: ${error.message}`);
            }
        }
    }
}

// Global instance
window.rpcTester = new RPCTester();

// Convenience functions
window.testRPCs = () => window.rpcTester.testAllRPCs();
window.testContract = () => window.rpcTester.testContractConnectivity();

console.log('✅ RPC Tester loaded. Use testRPCs() or testContract() in console.');
