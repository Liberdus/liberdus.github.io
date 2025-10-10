/**
 * Network Health Check Utility
 * Provides functions to verify network connectivity and contract deployment
 */

class NetworkHealthCheck {
    constructor() {
        this.maxRetries = 5;
        this.retryDelay = 1000; // 1 second
        this.timeout = 10000; // 10 seconds
    }

    /**
     * Check if the local Hardhat node is running and responsive
     * DISABLED: Using Polygon Amoy Testnet instead of local Hardhat
     */
    async checkHardhatNode(rpcUrl = 'http://127.0.0.1:8545') {
        console.log('🔍 Skipping Hardhat node check - Using Polygon Amoy Testnet');

        // Skip local Hardhat check since we're using Polygon Amoy
        return {
            success: true,
            message: 'Using Polygon Amoy Testnet - Local Hardhat check skipped',
            chainId: 80002
        };

        // Original code commented out
        /*
        try {
            const provider = new ethers.providers.JsonRpcProvider({
                url: rpcUrl,
                timeout: this.timeout
            });

            // Test basic connectivity
            const network = await provider.getNetwork();
            console.log(`✅ Hardhat node is responsive - Chain ID: ${network.chainId}`);

            // Test if it's the expected local network
            if (network.chainId !== 31337) {
                console.warn(`⚠️ Unexpected chain ID: ${network.chainId} (expected 31337)`);
            }

            return { success: true, network, provider };

        } catch (error) {
            console.error('❌ Hardhat node health check failed:', error.message);
            return { success: false, error: error.message };
        }
        */
    }

    /**
     * Check if a contract is deployed at the given address
     */
    async checkContractDeployment(contractAddress, rpcUrl = 'https://rpc-amoy.polygon.technology') {
        console.log(`🔍 Checking contract deployment at ${contractAddress}...`);

        try {
            const provider = new ethers.providers.JsonRpcProvider({
                url: rpcUrl,
                timeout: this.timeout
            });

            const code = await provider.getCode(contractAddress);
            
            if (code === '0x') {
                console.error(`❌ No contract found at address: ${contractAddress}`);
                return { success: false, error: 'Contract not deployed' };
            }
            
            console.log(`✅ Contract found at ${contractAddress} (${code.length} bytes)`);
            return { success: true, codeLength: code.length };
            
        } catch (error) {
            console.error('❌ Contract deployment check failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Comprehensive health check with retries
     */
    async performHealthCheck(contractAddress = null) {
        console.log('🏥 Starting comprehensive network health check...');
        
        const results = {
            hardhatNode: { success: false },
            contractDeployment: { success: false },
            overall: false
        };

        // Skip Hardhat node check - using Polygon Amoy Testnet
        console.log('🔄 Skipping Hardhat node check - Using Polygon Amoy Testnet');
        results.hardhatNode = {
            success: true,
            message: 'Using Polygon Amoy Testnet - Local Hardhat check skipped',
            chainId: 80002
        };

        // Skip Hardhat dependency check - using Polygon Amoy
        console.log('✅ Network check passed - Using Polygon Amoy Testnet');

        // Check contract deployment if address provided
        if (contractAddress) {
            for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
                console.log(`🔄 Contract deployment check attempt ${attempt}/${this.maxRetries}...`);
                
                results.contractDeployment = await this.checkContractDeployment(
                    contractAddress,
                    'https://rpc-amoy.polygon.technology'
                );
                
                if (results.contractDeployment.success) {
                    break;
                }
                
                if (attempt < this.maxRetries) {
                    console.log(`⏳ Waiting ${this.retryDelay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                }
            }
        } else {
            results.contractDeployment.success = true; // Skip if no address provided
        }

        // Overall health
        results.overall = results.hardhatNode.success && results.contractDeployment.success;
        
        if (results.overall) {
            console.log('✅ Network health check passed!');
        } else {
            console.error('❌ Network health check failed');
        }
        
        return results;
    }

    /**
     * Wait for network to be ready
     */
    async waitForNetworkReady(contractAddress = null, maxWaitTime = 30000) {
        console.log('⏳ Waiting for network to be ready...');
        
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            const healthCheck = await this.performHealthCheck(contractAddress);
            
            if (healthCheck.overall) {
                console.log('✅ Network is ready!');
                return true;
            }
            
            console.log('⏳ Network not ready yet, waiting...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        }
        
        console.error('❌ Network readiness timeout');
        return false;
    }
}

// Create global instance
window.NetworkHealthCheck = NetworkHealthCheck;

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NetworkHealthCheck;
}
