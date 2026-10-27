import { CONFIG } from '../config.js';

let providerInstance = null;
let providerPromise = null;

/** One ethers provider, with sequential transport failover for site reads. */
export class ReadOnlyRpcProvider {
  constructor({ network = CONFIG.NETWORK, fetchRequest = globalThis.fetch, timeoutMs = 10000, retryDelayMs = 250 } = {}) {
    const ethers = globalThis.window?.ethers;
    if (!ethers?.providers) throw new Error('Ethers.js not loaded');
    if (!network?.RPC_URL) throw new Error('Missing CONFIG.NETWORK.RPC_URL');
    if (!Number.isSafeInteger(Number(network.CHAIN_ID))) throw new Error('Missing/invalid CONFIG.NETWORK.CHAIN_ID');

    this.chainId = Number(network.CHAIN_ID);
    this.urls = [...new Set([network.RPC_URL, ...(network.RPC_FALLBACK_URLS || [])])];
    this.fetchRequest = fetchRequest.bind(globalThis);
    this.timeoutMs = timeoutMs;
    this.retryDelayMs = retryDelayMs;
    this.activeIndex = 0;
    this.nextRequestId = 1;
    this.validatedChains = new Map();
    this.cache = new Map();
    this.inflight = new Map();

    const Provider = ethers.providers.StaticJsonRpcProvider || ethers.providers.JsonRpcProvider;
    this.provider = new Provider(this.urls[0], { chainId: this.chainId, name: network.NAME || 'unknown' });
    this.provider.send = this.send.bind(this);
  }

  async initialize() {
    // The first real request validates the selected endpoint's chain as well.
    await this.send('eth_blockNumber', []);
    return this.provider;
  }

  async send(method, params) {
    const key = JSON.stringify([method, params]);
    const cached = this.cache.get(key);
    if (cached?.expiresAt > Date.now()) return cached.value;
    this.cache.delete(key);
    if (this.inflight.has(key)) return await this.inflight.get(key);

    const request = this._sendWithFailover(method, params);
    this.inflight.set(key, request);
    try {
      const value = await request;
      const ttlMs = this._cacheTtlMs(method);
      if (ttlMs > 0) {
        this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
        while (this.cache.size > 500) this.cache.delete(this.cache.keys().next().value);
      }
      return value;
    } finally {
      this.inflight.delete(key);
    }
  }

  _cacheTtlMs(method) {
    if (method === 'eth_chainId') return 24 * 60 * 60 * 1000;
    if (method === 'eth_blockNumber') return 1500;
    if (method === 'eth_getCode') return 60 * 1000;
    if (method === 'eth_call' || method === 'eth_getLogs') return 10 * 1000;
    return 0;
  }

  async _sendWithFailover(method, params) {
    const firstIndex = this.activeIndex;
    let lastError;
    for (let offset = 0; offset < this.urls.length; offset += 1) {
      const index = (firstIndex + offset) % this.urls.length;
      // One retry per endpoint; every request, including chain checks, has a deadline.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const chainId = await this._validateChain(index);
          const result = method === 'eth_chainId' ? chainId : await this._request(index, method, params);
          this.activeIndex = index;
          return result;
        } catch (error) {
          const action = this._failureAction(error);
          if (!action) throw error;
          lastError = error;
          if ((action === 'retry' && attempt === 0) || offset < this.urls.length - 1) {
            globalThis.document?.dispatchEvent(new CustomEvent('readRpcRetry', { detail: { method } }));
          }
          if (action !== 'retry' || attempt === 1) break;
          await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
        }
      }
    }

    const error = new Error('All configured Polygon RPC endpoints failed. Please try again.');
    error.code = 'NETWORK_ERROR';
    error.error = lastError;
    throw error;
  }

  async _validateChain(index) {
    if (!this.validatedChains.has(index)) {
      const check = this._request(index, 'eth_chainId', []).then((chainId) => {
        if (Number(chainId) !== this.chainId) {
          const error = new Error(`Unexpected RPC chain ID ${chainId}; expected ${this.chainId}.`);
          error.code = 'WRONG_CHAIN';
          throw error;
        }
        return chainId;
      });
      this.validatedChains.set(index, check);
    }
    try {
      return await this.validatedChains.get(index);
    } catch (error) {
      this.validatedChains.delete(index);
      throw error;
    }
  }

  async _request(index, method, params) {
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error('RPC request timed out.');
        error.code = 'TIMEOUT';
        reject(error);
        controller.abort();
      }, this.timeoutMs);
    });
    try {
      return await Promise.race([
        this._fetchResult(index, method, params, controller.signal),
        deadline,
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async _fetchResult(index, method, params, signal) {
    const id = this.nextRequestId++;
    const response = await this.fetchRequest(this.urls[index], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      signal,
    });
    if (!response.ok) {
      const error = new Error(`RPC request failed with HTTP ${response.status}.`);
      error.status = response.status;
      throw error;
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      const error = new Error('RPC returned invalid JSON.');
      error.code = 'INVALID_RESPONSE';
      throw error;
    }
    if (!payload || payload.jsonrpc !== '2.0' || payload.id !== id || (!payload.error && !Object.hasOwn(payload, 'result'))) {
      const error = new Error('RPC returned an invalid response.');
      error.code = 'INVALID_RESPONSE';
      throw error;
    }
    if (payload.error) {
      // Preserve the shape ethers expects when decoding contract reverts.
      const error = new Error(payload.error.message || 'JSON-RPC request failed.');
      error.code = payload.error.code;
      error.data = payload.error.data;
      throw error;
    }
    const invalidHead = method === 'eth_blockNumber' &&
      (typeof payload.result !== 'string' || !/^0x[0-9a-f]+$/i.test(payload.result));
    const invalidLogs = method === 'eth_getLogs' && !Array.isArray(payload.result);
    if (invalidHead || invalidLogs) {
      const error = new Error('RPC returned an invalid result.');
      error.code = 'INVALID_RESPONSE';
      throw error;
    }
    return payload.result;
  }

  _failureAction(error) {
    const message = String(error?.message || '').toLowerCase();
    if (error?.code === 'CALL_EXCEPTION' || error?.code === 3 || /execution reverted|\brevert(?:ed)?\b/.test(message)) return null;
    // Result limits are handled by the proposal scanner's range splitter.
    if (/too many results|query returned more|block range|exceeds limit|\d+ results/.test(message)) return null;
    if (error?.code === 'WRONG_CHAIN') return 'next';
    if (error?.status === 408 || error?.status === 429 || error?.status >= 500) return 'retry';
    if ([401, 403, 404, 405].includes(error?.status)) return 'next';
    if (error?.code === 'TIMEOUT' || error?.code === 'INVALID_RESPONSE' || error instanceof TypeError) return 'retry';
    if (error?.code === -32603 || /rate.?limit|too many requests|timeout|timed out|temporarily|unavailable|overloaded|busy|network|failed to fetch|header not found/.test(message)) return 'retry';
    if (error?.code === -32601 || /unauthorized|forbidden|access denied|api key/.test(message)) return 'next';
    return null;
  }
}

export async function getReadOnlyProvider() {
  if (providerInstance) return providerInstance;
  if (!providerPromise) providerPromise = new ReadOnlyRpcProvider().initialize();
  const pending = providerPromise;
  try {
    const provider = await pending;
    if (providerPromise === pending) providerInstance = provider;
    return provider;
  } catch (error) {
    if (providerPromise === pending) providerPromise = null;
    throw error;
  }
}

export function peekReadOnlyProvider() {
  return providerInstance;
}

export function resetReadOnlyProvider() {
  providerInstance = null;
  providerPromise = null;
}
