/**
 * KyberZapQuoteRateLimiter - protects Kyber quote endpoints from bursty UI input.
 */
(function(global) {
    'use strict';

    if (global.KyberZapQuoteRateLimiter) {
        console.warn('KyberZapQuoteRateLimiter already exists, skipping redeclaration');
        return;
    }

    class KyberZapRateLimitError extends Error {
        constructor(message, waitMs) {
            super(message);
            this.name = 'KyberZapRateLimitError';
            this.zapRateLimited = true;
            this.waitMs = waitMs;
        }
    }

    class KyberZapQuoteRateLimiter {
        constructor(options = {}) {
            this.getMaxRequests = options.getMaxRequests || (() => 8);
            this.getWindowMs = options.getWindowMs || (() => 10000);
            this.now = options.now || (() => Date.now());
            this.timestamps = [];
        }

        getLimit() {
            return Number(this.getMaxRequests()) || 8;
        }

        getWindow() {
            return Number(this.getWindowMs()) || 10000;
        }

        prune(now = this.now()) {
            const windowMs = this.getWindow();
            this.timestamps = this.timestamps.filter(timestamp => now - timestamp < windowMs);
        }

        getWaitMs(now = this.now()) {
            this.prune(now);

            if (this.timestamps.length < this.getLimit()) {
                return 0;
            }

            return Math.max(0, this.getWindow() - (now - this.timestamps[0]));
        }

        reserve(now = this.now()) {
            const waitMs = this.getWaitMs(now);
            if (waitMs > 0) {
                return { allowed: false, waitMs };
            }

            this.timestamps.push(now);
            return { allowed: true, waitMs: 0 };
        }

        getMessage(waitMs = this.getWaitMs()) {
            const seconds = Math.max(1, Math.ceil(waitMs / 1000));
            return `Quote refresh paused to avoid Kyber rate limits. Try again in ${seconds}s.`;
        }

        createError(waitMs) {
            return new KyberZapRateLimitError(this.getMessage(waitMs), waitMs);
        }
    }

    global.KyberZapRateLimitError = KyberZapRateLimitError;
    global.KyberZapQuoteRateLimiter = KyberZapQuoteRateLimiter;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { KyberZapQuoteRateLimiter, KyberZapRateLimitError };
    }
})(typeof window !== 'undefined' ? window : globalThis);
