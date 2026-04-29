/**
 * OTP Cache Adapter
 * 
 * Uses an in-memory Map for development and Redis for production.
 * Both adapters expose the same interface: set, get, delete.
 * 
 * Usage:
 *   import { otpStore } from '../utils/otpStore.js';
 *   await otpStore.set(email, { otpHash, expiresAt });
 *   const cached = await otpStore.get(email);
 *   await otpStore.delete(email);
 */

import { env } from '../config/env.js';
import { logger } from './logger.js';

// ==========================================
// MEMORY ADAPTER (development)
// ==========================================
class MemoryOtpStore {
    constructor() {
        this._cache = new Map();
        this._name = 'MemoryOtpStore';
    }

    async set(key, value, ttlSeconds = 300) {
        this._cache.set(key, {
            ...value,
            expiresAt: Date.now() + ttlSeconds * 1000
        });
    }

    async get(key) {
        const entry = this._cache.get(key);
        if (!entry) return null;

        // Auto-expire
        if (Date.now() > entry.expiresAt) {
            this._cache.delete(key);
            return null;
        }
        return entry;
    }

    async delete(key) {
        this._cache.delete(key);
    }
}

// ==========================================
// REDIS ADAPTER (production)
// ==========================================
class RedisOtpStore {
    constructor() {
        this._client = null;
        this._name = 'RedisOtpStore';
    }

    async _ensureClient() {
        if (this._client) return;

        try {
            // Dynamic import so Redis is only loaded in production
            const { createClient } = await import('redis');
            this._client = createClient({
                url: env.redisUrl || 'redis://localhost:6379'
            });

            this._client.on('error', (err) => {
                logger.error('Redis OTP client error', { error: err.message });
            });

            await this._client.connect();
            logger.info('Redis OTP store connected.');
        } catch (error) {
            logger.warn(`Redis unavailable, falling back to memory store: ${error.message}`);
            // Graceful fallback: replace self with memory adapter
            this._fallback = new MemoryOtpStore();
        }
    }

    async set(key, value, ttlSeconds = 300) {
        await this._ensureClient();
        if (this._fallback) return this._fallback.set(key, value, ttlSeconds);

        const prefixed = `otp:${key}`;
        await this._client.setEx(prefixed, ttlSeconds, JSON.stringify(value));
    }

    async get(key) {
        await this._ensureClient();
        if (this._fallback) return this._fallback.get(key);

        const prefixed = `otp:${key}`;
        const raw = await this._client.get(prefixed);
        return raw ? JSON.parse(raw) : null;
    }

    async delete(key) {
        await this._ensureClient();
        if (this._fallback) return this._fallback.delete(key);

        const prefixed = `otp:${key}`;
        await this._client.del(prefixed);
    }
}

// ==========================================
// FACTORY: Pick adapter based on environment
// ==========================================
function createOtpStore() {
    if (env.isProd) {
        logger.info('OTP store: Redis adapter (production)');
        return new RedisOtpStore();
    }
    logger.info('OTP store: Memory adapter (development)');
    return new MemoryOtpStore();
}

export const otpStore = createOtpStore();
