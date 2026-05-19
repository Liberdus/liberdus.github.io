/**
 * V2RemoveLiquidityService - Uniswap V2-compatible remove-liquidity helpers.
 *
 * The router allowlist is explicit by chain/factory because LP pairs do not expose
 * a trusted router address.
 */
(function(global) {
    'use strict';

    if (global.V2RemoveLiquidityService) {
        console.warn('V2RemoveLiquidityService already exists, skipping redeclaration');
        return;
    }

    class V2RemoveLiquidityService {
        constructor(options = {}) {
            this.global = options.global || global;
            this.pairMetaCache = new Map();
            this.tokenMetaCache = new Map();
        }

        getConfig() {
            return this.global.CONFIG?.DEX_REMOVE_LIQUIDITY || {};
        }

        getEthers() {
            const ethers = this.global.ethers;
            if (!ethers) {
                throw new Error('Ethers.js is not available.');
            }
            return ethers;
        }

        getProvider(provider) {
            return provider
                || this.global.contractManager?.provider
                || this.global.walletManager?.provider
                || null;
        }

        getCurrentChainId() {
            const chainId = this.global.networkSelector?.getCurrentChainId?.()
                ?? this.global.contractManager?.getCurrentChainIdSafe?.()
                ?? this.global.walletManager?.networkManager?.getCurrentChainId?.();
            const parsed = typeof chainId === 'string' ? Number(chainId) : chainId;
            return Number.isFinite(parsed) ? parsed : null;
        }

        getChainConfig(chainId = this.getCurrentChainId()) {
            if (chainId === null || chainId === undefined) {
                return null;
            }

            return this.getConfig()?.[String(chainId)] || this.getConfig()?.[Number(chainId)] || null;
        }

        normalizeAddress(address) {
            return typeof address === 'string' ? address.toLowerCase() : '';
        }

        getPairMetaCacheKey(lpTokenAddress, chainId = this.getCurrentChainId()) {
            const parsedChainId = typeof chainId === 'string' ? Number(chainId) : chainId;
            const chainKey = Number.isFinite(parsedChainId) ? String(parsedChainId) : 'unknown';
            return `${chainKey}:${this.normalizeAddress(lpTokenAddress)}`;
        }

        getTokenMetaCacheKey(address, chainId = this.getCurrentChainId()) {
            const parsedChainId = typeof chainId === 'string' ? Number(chainId) : chainId;
            const chainKey = Number.isFinite(parsedChainId) ? String(parsedChainId) : 'unknown';
            return `${chainKey}:${this.normalizeAddress(address)}`;
        }

        toBigNumber(value) {
            const ethers = this.getEthers();
            return ethers.BigNumber?.from ? ethers.BigNumber.from(value) : BigInt(value);
        }

        formatUnits(value, decimals = 18) {
            const ethers = this.getEthers();
            if (ethers.utils?.formatUnits) {
                return ethers.utils.formatUnits(value, decimals);
            }
            if (ethers.formatUnits) {
                return ethers.formatUnits(value, decimals);
            }
            return String(value);
        }

        getPairAbi() {
            return [
                'function factory() view returns (address)',
                'function token0() view returns (address)',
                'function token1() view returns (address)',
                'function getReserves() view returns (uint112,uint112,uint32)',
                'function totalSupply() view returns (uint256)',
                'function decimals() view returns (uint8)'
            ];
        }

        getRouterAbi() {
            return [
                'function factory() view returns (address)',
                'function removeLiquidity(address tokenA,address tokenB,uint256 liquidity,uint256 amountAMin,uint256 amountBMin,address to,uint256 deadline) returns (uint256 amountA,uint256 amountB)'
            ];
        }

        getErc20Abi() {
            return [
                'function allowance(address owner,address spender) view returns (uint256)',
                'function approve(address spender,uint256 amount) returns (bool)',
                'function balanceOf(address owner) view returns (uint256)',
                'function decimals() view returns (uint8)',
                'function symbol() view returns (string)',
                'function name() view returns (string)'
            ];
        }

        createContract(address, abi, runner) {
            const ethers = this.getEthers();
            return new ethers.Contract(address, abi, runner);
        }

        async readPairMeta(lpTokenAddress, provider = this.getProvider(), chainId = this.getCurrentChainId()) {
            if (!lpTokenAddress || !provider) {
                throw new Error('LP token address and provider are required.');
            }

            const cacheKey = this.getPairMetaCacheKey(lpTokenAddress, chainId);
            if (this.pairMetaCache.has(cacheKey)) {
                return this.pairMetaCache.get(cacheKey);
            }

            const pairContract = this.createContract(lpTokenAddress, this.getPairAbi(), provider);
            const [factoryAddress, token0Address, token1Address, lpDecimals] = await Promise.all([
                pairContract.factory(),
                pairContract.token0(),
                pairContract.token1(),
                pairContract.decimals().catch(() => 18)
            ]);

            const pairMeta = {
                lpTokenAddress,
                factoryAddress,
                token0Address,
                token1Address,
                lpDecimals: Number(lpDecimals) || 18
            };

            this.pairMetaCache.set(cacheKey, pairMeta);
            return pairMeta;
        }

        async validateRouterFactory({ routerAddress, factoryAddress, provider = this.getProvider() }) {
            if (!routerAddress || !factoryAddress || !provider) {
                throw new Error('Router, factory, and provider are required for router validation.');
            }

            const routerContract = this.createContract(routerAddress, this.getRouterAbi(), provider);
            const routerFactory = await routerContract.factory();
            if (this.normalizeAddress(routerFactory) !== this.normalizeAddress(factoryAddress)) {
                throw new Error('Configured remove-liquidity router does not match the LP factory.');
            }

            return true;
        }

        async getMatchedAdapter({ chainId = this.getCurrentChainId(), lpTokenAddress, provider = this.getProvider() }) {
            const resolvedChainId = Number(chainId);
            if (!Number.isFinite(resolvedChainId)) {
                return {
                    supported: false,
                    reason: 'Unable to determine the selected chain.'
                };
            }

            const chainConfig = this.getChainConfig(resolvedChainId);
            if (!chainConfig) {
                return {
                    supported: false,
                    chainId: resolvedChainId,
                    reason: 'Remove liquidity is not configured for this network.'
                };
            }

            const pairMeta = await this.readPairMeta(lpTokenAddress, provider, resolvedChainId);
            const factoryKey = this.normalizeAddress(pairMeta.factoryAddress);
            const factoryConfig = chainConfig.factories?.[factoryKey] || null;

            if (!factoryConfig?.router) {
                return {
                    supported: false,
                    chainId: resolvedChainId,
                    factoryAddress: pairMeta.factoryAddress,
                    reason: 'This LP factory is not supported for guided remove liquidity.'
                };
            }

            await this.validateRouterFactory({
                routerAddress: factoryConfig.router,
                factoryAddress: pairMeta.factoryAddress,
                provider
            });

            return {
                supported: true,
                chainId: resolvedChainId,
                wrappedNative: chainConfig.wrappedNative,
                factoryAddress: pairMeta.factoryAddress,
                routerAddress: factoryConfig.router,
                name: factoryConfig.name,
                type: factoryConfig.type,
                pairMeta
            };
        }

        async getTokenMetadata(address, provider = this.getProvider(), chainId = this.getCurrentChainId()) {
            const cacheKey = this.getTokenMetaCacheKey(address, chainId);
            if (this.tokenMetaCache.has(cacheKey)) {
                return this.tokenMetaCache.get(cacheKey);
            }

            const tokenContract = this.createContract(address, this.getErc20Abi(), provider);
            const [symbol, name, decimals] = await Promise.all([
                tokenContract.symbol().catch(() => 'TOKEN'),
                tokenContract.name().catch(() => 'Token'),
                tokenContract.decimals().catch(() => 18)
            ]);

            const metadata = {
                address,
                symbol: typeof symbol === 'string' && symbol.trim() ? symbol.trim() : 'TOKEN',
                name: typeof name === 'string' && name.trim() ? name.trim() : 'Token',
                decimals: Number(decimals) || 18
            };

            this.tokenMetaCache.set(cacheKey, metadata);
            return metadata;
        }

        calculateMinAmount(amount, slippageBps) {
            const bps = Number(slippageBps);
            if (!Number.isFinite(bps) || bps < 0 || bps > 10000) {
                throw new Error('Slippage must be between 0 and 10000 bps.');
            }

            return amount.mul(10000 - Math.trunc(bps)).div(10000);
        }

        async getPreview({ chainId = this.getCurrentChainId(), lpTokenAddress, liquidityRaw, slippageBps = 50, provider = this.getProvider() }) {
            if (!liquidityRaw) {
                throw new Error('Liquidity amount is required.');
            }

            const adapter = await this.getMatchedAdapter({ chainId, lpTokenAddress, provider });
            if (!adapter.supported) {
                return adapter;
            }

            const pairContract = this.createContract(lpTokenAddress, this.getPairAbi(), provider);
            const [reserves, totalSupplyRaw] = await Promise.all([
                pairContract.getReserves(),
                pairContract.totalSupply()
            ]);

            const reserve0 = this.toBigNumber(reserves[0]);
            const reserve1 = this.toBigNumber(reserves[1]);
            const totalSupply = this.toBigNumber(totalSupplyRaw);
            const liquidity = this.toBigNumber(liquidityRaw);

            if (totalSupply.isZero?.() || totalSupply.eq?.(0)) {
                throw new Error('LP total supply is zero.');
            }

            const amount0 = liquidity.mul(reserve0).div(totalSupply);
            const amount1 = liquidity.mul(reserve1).div(totalSupply);
            const amount0Min = this.calculateMinAmount(amount0, slippageBps);
            const amount1Min = this.calculateMinAmount(amount1, slippageBps);
            const [token0Meta, token1Meta] = await Promise.all([
                this.getTokenMetadata(adapter.pairMeta.token0Address, provider, adapter.chainId),
                this.getTokenMetadata(adapter.pairMeta.token1Address, provider, adapter.chainId)
            ]);

            return {
                supported: true,
                adapter,
                lpToken: {
                    address: lpTokenAddress,
                    decimals: adapter.pairMeta.lpDecimals,
                    liquidity: {
                        raw: liquidity.toString(),
                        formatted: this.formatUnits(liquidity, adapter.pairMeta.lpDecimals)
                    },
                    totalSupply: {
                        raw: totalSupply.toString(),
                        formatted: this.formatUnits(totalSupply, adapter.pairMeta.lpDecimals)
                    }
                },
                token0: {
                    ...token0Meta,
                    reserve: {
                        raw: reserve0.toString(),
                        formatted: this.formatUnits(reserve0, token0Meta.decimals)
                    },
                    amount: {
                        raw: amount0.toString(),
                        formatted: this.formatUnits(amount0, token0Meta.decimals)
                    },
                    minAmount: {
                        raw: amount0Min.toString(),
                        formatted: this.formatUnits(amount0Min, token0Meta.decimals)
                    }
                },
                token1: {
                    ...token1Meta,
                    reserve: {
                        raw: reserve1.toString(),
                        formatted: this.formatUnits(reserve1, token1Meta.decimals)
                    },
                    amount: {
                        raw: amount1.toString(),
                        formatted: this.formatUnits(amount1, token1Meta.decimals)
                    },
                    minAmount: {
                        raw: amount1Min.toString(),
                        formatted: this.formatUnits(amount1Min, token1Meta.decimals)
                    }
                },
                slippageBps: Number(slippageBps)
            };
        }

        async getAllowance({ lpTokenAddress, owner, spender, provider = this.getProvider() }) {
            if (!lpTokenAddress || !owner || !spender || !provider) {
                throw new Error('LP token, owner, spender, and provider are required for allowance checks.');
            }

            return this.getTokenAllowance({ tokenAddress: lpTokenAddress, owner, spender, provider });
        }

        async getBalance({ lpTokenAddress, owner, provider = this.getProvider() }) {
            if (!lpTokenAddress || !owner || !provider) {
                throw new Error('LP token, owner, and provider are required for balance checks.');
            }

            return this.getTokenBalance({ tokenAddress: lpTokenAddress, owner, provider });
        }

        async getTokenAllowance({ tokenAddress, owner, spender, provider = this.getProvider() }) {
            if (!tokenAddress || !owner || !spender || !provider) {
                throw new Error('Token, owner, spender, and provider are required for allowance checks.');
            }

            const tokenContract = this.createContract(tokenAddress, this.getErc20Abi(), provider);
            return tokenContract.allowance(owner, spender);
        }

        async getTokenBalance({ tokenAddress, owner, provider = this.getProvider() }) {
            if (!tokenAddress || !owner || !provider) {
                throw new Error('Token, owner, and provider are required for balance checks.');
            }

            const tokenContract = this.createContract(tokenAddress, this.getErc20Abi(), provider);
            return tokenContract.balanceOf(owner);
        }

        async approveIfNeeded({ lpTokenAddress, spender, liquidityRaw, signer }) {
            if (!lpTokenAddress || !spender || !liquidityRaw || !signer) {
                throw new Error('LP token, spender, liquidity amount, and signer are required for approval.');
            }

            return this.approveTokenIfNeeded({
                tokenAddress: lpTokenAddress,
                spender,
                amountRaw: liquidityRaw,
                signer
            });
        }

        async approveTokenIfNeeded({ tokenAddress, spender, amountRaw, signer }) {
            if (!tokenAddress || !spender || !amountRaw || !signer) {
                throw new Error('Token, spender, amount, and signer are required for approval.');
            }

            const owner = await signer.getAddress();
            const allowance = await this.getTokenAllowance({
                tokenAddress,
                owner,
                spender,
                provider: signer.provider || this.getProvider()
            });
            const amount = this.toBigNumber(amountRaw);

            if (allowance.gte(amount)) {
                return null;
            }

            const tokenContract = this.createContract(tokenAddress, this.getErc20Abi(), signer);
            return tokenContract.approve(spender, amount);
        }

        async removeLiquidity({ routerAddress, token0, token1, liquidityRaw, amount0Min, amount1Min, recipient, deadline, signer }) {
            if (!routerAddress || !token0 || !token1 || !liquidityRaw || !recipient || !deadline || !signer) {
                throw new Error('Router, tokens, liquidity amount, recipient, deadline, and signer are required.');
            }

            const routerContract = this.createContract(routerAddress, this.getRouterAbi(), signer);
            return routerContract.removeLiquidity(
                token0,
                token1,
                this.toBigNumber(liquidityRaw),
                this.toBigNumber(amount0Min),
                this.toBigNumber(amount1Min),
                recipient,
                deadline
            );
        }
    }

    global.V2RemoveLiquidityService = V2RemoveLiquidityService;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { V2RemoveLiquidityService };
    }
})(typeof window !== 'undefined' ? window : globalThis);
