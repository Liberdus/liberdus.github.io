/**
 * Admin Panel Testing Utility
 * Tests admin panel functionality and contract interactions
 */

// Prevent redeclaration error
if (typeof window.AdminTester !== 'undefined') {
    console.log('⚠️ AdminTester already loaded, skipping redeclaration');
} else {

class AdminTester {
    constructor() {
        this.testResults = [];
        this.isRunning = false;
    }

    /**
     * Run comprehensive admin panel tests
     */
    async runAllTests() {
        if (this.isRunning) {
            console.log('Admin tests already running...');
            return this.testResults;
        }

        this.isRunning = true;
        this.testResults = [];
        
        console.log('🔄 Starting Admin Panel Tests...');

        const tests = [
            { name: 'Contract Connection', test: () => this.testContractConnection() },
            { name: 'Basic Contract Functions', test: () => this.testBasicFunctions() },
            { name: 'Admin Role Check', test: () => this.testAdminRole() },
            { name: 'Contract Stats Loading', test: () => this.testContractStats() },
            { name: 'Proposals Loading', test: () => this.testProposalsLoading() },
            { name: 'Multi-sig Functions', test: () => this.testMultiSigFunctions() }
        ];

        for (const testCase of tests) {
            console.log(`\n🔄 Running: ${testCase.name}`);
            const result = await this.runSingleTest(testCase.name, testCase.test);
            this.testResults.push(result);
            
            const status = result.success ? '✅' : '❌';
            console.log(`${status} ${testCase.name}: ${result.message}`);
        }

        // Summary
        const successful = this.testResults.filter(r => r.success).length;
        console.log(`\n📊 Admin Test Summary: ${successful}/${tests.length} tests passed`);
        
        this.isRunning = false;
        return this.testResults;
    }

    /**
     * Run a single test with error handling
     */
    async runSingleTest(name, testFunction) {
        const result = {
            name,
            success: false,
            message: '',
            error: null,
            timestamp: new Date().toISOString()
        };

        try {
            const message = await testFunction();
            result.success = true;
            result.message = message || 'Test passed';
        } catch (error) {
            result.error = error.message;
            result.message = `Failed: ${error.message}`;
        }

        return result;
    }

    /**
     * Test contract connection
     */
    async testContractConnection() {
        if (!window.contractManager) {
            throw new Error('ContractManager not available');
        }

        if (!window.contractManager.isReady()) {
            throw new Error('ContractManager not ready');
        }

        if (!window.contractManager.stakingContract) {
            throw new Error('Staking contract not initialized');
        }

        return 'Contract connection successful';
    }

    /**
     * Test basic contract functions
     */
    async testBasicFunctions() {
        const contract = window.contractManager.stakingContract;
        
        // Test rewardToken function
        const rewardToken = await contract.rewardToken();
        if (!rewardToken || rewardToken === '0x0000000000000000000000000000000000000000') {
            throw new Error('Invalid reward token address');
        }

        // Test hourlyRewardRate function
        const hourlyRate = await contract.hourlyRewardRate();
        if (!hourlyRate) {
            throw new Error('Could not get hourly reward rate');
        }

        // Test REQUIRED_APPROVALS function (FIXED)
        const requiredApprovals = await contract.REQUIRED_APPROVALS();
        if (!requiredApprovals || requiredApprovals.toNumber() === 0) {
            throw new Error('Could not get required approvals');
        }

        // Test actionCounter function
        const actionCounter = await contract.actionCounter();
        if (actionCounter === undefined) {
            throw new Error('Could not get action counter');
        }

        return `Basic functions working: rewardToken=${rewardToken.slice(0,10)}..., rate=${hourlyRate.toString()}, approvals=${requiredApprovals.toNumber()}, actions=${actionCounter.toNumber()}`;
    }

    /**
     * Test admin role check
     */
    async testAdminRole() {
        if (!window.walletManager || !window.walletManager.isConnected()) {
            throw new Error('Wallet not connected');
        }

        const userAddress = await window.walletManager.getAddress();
        const contract = window.contractManager.stakingContract;
        
        const ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
        const hasAdminRole = await contract.hasRole(ADMIN_ROLE, userAddress);

        return `Admin role check: ${hasAdminRole ? 'User has admin role' : 'User does not have admin role'}`;
    }

    /**
     * Test contract stats loading
     */
    async testContractStats() {
        if (!window.adminPage) {
            throw new Error('Admin page not available');
        }

        // Test the loadContractStats method
        await window.adminPage.loadContractStats();
        
        const stats = window.adminPage.contractStats;
        if (!stats) {
            throw new Error('Contract stats not loaded');
        }

        const requiredFields = ['rewardToken', 'hourlyRewardRate', 'requiredApprovals', 'actionCounter'];
        for (const field of requiredFields) {
            if (stats[field] === undefined || stats[field] === null) {
                throw new Error(`Missing required stat: ${field}`);
            }
        }

        return `Contract stats loaded: ${Object.keys(stats).length} fields`;
    }

    /**
     * Test proposals loading
     */
    async testProposalsLoading() {
        if (!window.adminPage) {
            throw new Error('Admin page not available');
        }

        // Test the loadProposals method
        const proposals = await window.adminPage.loadProposals();
        
        if (!Array.isArray(proposals)) {
            throw new Error('Proposals should be an array');
        }

        return `Proposals loaded: ${proposals.length} proposals found`;
    }

    /**
     * Test multi-signature functions
     */
    async testMultiSigFunctions() {
        const contract = window.contractManager.stakingContract;
        
        // Test getSigners function
        const signers = await contract.getSigners();
        if (!Array.isArray(signers) || signers.length === 0) {
            throw new Error('No signers found');
        }

        // Test actions function (if there are any actions)
        const actionCounter = await contract.actionCounter();
        const actionCount = actionCounter.toNumber();
        
        if (actionCount > 0) {
            // Test getting the first action
            const action = await contract.actions(1);
            if (!action) {
                throw new Error('Could not retrieve action data');
            }
        }

        return `Multi-sig functions working: ${signers.length} signers, ${actionCount} actions`;
    }

    /**
     * Test specific contract function
     */
    async testFunction(functionName, ...args) {
        try {
            const contract = window.contractManager.stakingContract;
            const result = await contract[functionName](...args);
            console.log(`✅ ${functionName}:`, result);
            return result;
        } catch (error) {
            console.error(`❌ ${functionName} failed:`, error.message);
            throw error;
        }
    }

    /**
     * Display detailed test results
     */
    displayResults() {
        console.log('\n📊 Detailed Admin Test Results:');
        console.log('================================');
        
        this.testResults.forEach((result, index) => {
            const status = result.success ? '✅ PASSED' : '❌ FAILED';
            console.log(`\nTest ${index + 1}: ${status}`);
            console.log(`Name: ${result.name}`);
            console.log(`Message: ${result.message}`);
            
            if (result.error) {
                console.log(`Error: ${result.error}`);
            }
        });

        const passed = this.testResults.filter(r => r.success).length;
        const total = this.testResults.length;

        console.log('\n📈 Summary:');
        console.log(`Passed: ${passed}/${total} tests`);
        console.log(`Success Rate: ${Math.round((passed/total) * 100)}%`);
    }

    /**
     * Test RPC connectivity and performance
     */
    async testRPCs() {
        console.log('🌐 Testing RPC connectivity...');
        const rpcs = window.CONFIG?.NETWORK?.FALLBACK_RPCS || [];
        const results = [];

        for (let i = 0; i < rpcs.length; i++) {
            const rpcUrl = rpcs[i];
            const startTime = Date.now();

            try {
                // Create provider with timeout
                const provider = new ethers.providers.JsonRpcProvider({
                    url: rpcUrl,
                    timeout: 8000
                });

                // Test basic connectivity
                const network = await provider.getNetwork();
                const blockNumber = await provider.getBlockNumber();
                const responseTime = Date.now() - startTime;

                // Validate chain ID
                const expectedChainId = window.CONFIG?.NETWORK?.CHAIN_ID || 80002;
                if (network.chainId !== expectedChainId) {
                    throw new Error(`Wrong chain ID: expected ${expectedChainId}, got ${network.chainId}`);
                }

                const result = {
                    url: rpcUrl,
                    success: true,
                    chainId: network.chainId,
                    blockNumber,
                    responseTime,
                    error: null
                };

                results.push(result);
                console.log(`✅ RPC ${i + 1} OK:`, rpcUrl, `(${responseTime}ms, Block: ${blockNumber})`);
            } catch (error) {
                const responseTime = Date.now() - startTime;
                const result = {
                    url: rpcUrl,
                    success: false,
                    chainId: null,
                    blockNumber: null,
                    responseTime,
                    error: error.message
                };

                results.push(result);
                console.error(`❌ RPC ${i + 1} FAILED:`, rpcUrl, error.message);
            }
        }

        // Sort by response time (fastest first)
        const workingRPCs = results.filter(r => r.success).sort((a, b) => a.responseTime - b.responseTime);

        console.log('📊 RPC Test Summary:');
        console.log(`  Working RPCs: ${workingRPCs.length}/${results.length}`);
        if (workingRPCs.length > 0) {
            console.log(`  Fastest RPC: ${workingRPCs[0].url} (${workingRPCs[0].responseTime}ms)`);
        }

        return { results, workingRPCs };
    }

    /**
     * Quick contract function test
     */
    async quickTest() {
        console.log('🔄 Running quick admin tests...');

        try {
            // Test RPC connectivity first
            const rpcResults = await this.testRPCs();
            if (rpcResults.workingRPCs.length === 0) {
                throw new Error('No working RPC endpoints found');
            }

            // Test basic connection
            await this.testContractConnection();
            console.log('✅ Contract connection OK');

            // Test basic functions
            await this.testBasicFunctions();
            console.log('✅ Basic functions OK');

            console.log('✅ Quick test completed successfully');
        } catch (error) {
            console.error('❌ Quick test failed:', error.message);
        }
    }
}

// Global instance (only create if not exists)
if (!window.adminTester) {
    window.adminTester = new AdminTester();
    window.AdminTester = AdminTester; // Make class available globally
}

// Convenience functions (only create if not exists)
if (!window.testAdmin) {
    window.testAdmin = () => window.adminTester.runAllTests();
    window.quickTestAdmin = () => window.adminTester.quickTest();
    window.testRPCs = () => window.adminTester.testRPCs();
    window.testFunction = (name, ...args) => window.adminTester.testFunction(name, ...args);

    console.log('✅ Admin Tester loaded. Available functions:');
    console.log('  - testAdmin() - Run all tests');
    console.log('  - quickTestAdmin() - Quick test');
    console.log('  - testRPCs() - Test RPC connectivity');
    console.log('  - testFunction(name, ...args) - Test specific function');
}

} // End of redeclaration check
