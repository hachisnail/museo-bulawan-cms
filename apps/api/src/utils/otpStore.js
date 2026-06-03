/**
 * OTP Cache Adapter
 * 
 * Uses the consolidated redisManager (which uses InMemoryRedisClient in development).
 * 
 * Usage:
 *   import { otpStore } from '../utils/otpStore.js';
 *   await otpStore.set(email, { otpHash, expiresAt });
 *   const cached = await otpStore.get(email);
 *   await otpStore.delete(email);
 */

import { redisManager } from './redisClient.js';

class RedisOtpStore {
    constructor() {
        this.client = null;
    }

    async _ensureClient() {
        if (!this.client) {
            this.client = await redisManager.getClient();
        }
    }

    async set(key, value, ttlSeconds = 300) {
        await this._ensureClient();
        const prefixed = `otp:${key}`;
        await this.client.setEx(prefixed, ttlSeconds, JSON.stringify(value));
    }

    async get(key) {
        await this._ensureClient();
        const prefixed = `otp:${key}`;
        const raw = await this.client.get(prefixed);
        return raw ? JSON.parse(raw) : null;
    }

    async delete(key) {
        await this._ensureClient();
        const prefixed = `otp:${key}`;
        await this.client.del(prefixed);
    }
}

export const otpStore = new RedisOtpStore();
