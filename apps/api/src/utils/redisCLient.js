import { createClient } from 'redis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * High-fidelity in-memory mock client that mimics the standard Node Redis (v4) client interface.
 * Implements standard key-value, lists, auto-expiration, and blocking pops.
 */
class InMemoryRedisClient {
    constructor(sharedStore = { keys: new Map(), lists: new Map(), listListeners: new Map() }) {
        this.store = sharedStore;
    }

    async connect() {
        return;
    }

    on(event, callback) {
        // No-op event listener registry
        return this;
    }

    duplicate() {
        return new InMemoryRedisClient(this.store);
    }

    async get(key) {
        const item = this.store.keys.get(key);
        if (!item) return null;
        if (item.expiresAt && Date.now() > item.expiresAt) {
            this.store.keys.delete(key);
            return null;
        }
        return item.value;
    }

    async set(key, value, options = null) {
        let expiresAt = null;
        if (options) {
            if (options.EX) {
                expiresAt = Date.now() + options.EX * 1000;
            } else if (options.PX) {
                expiresAt = Date.now() + options.PX;
            }
        }
        this.store.keys.set(key, { value: String(value), expiresAt });
        return 'OK';
    }

    async setEx(key, ttlSeconds, value) {
        this.store.keys.set(key, {
            value: String(value),
            expiresAt: Date.now() + ttlSeconds * 1000
        });
        return 'OK';
    }

    async del(key) {
        let deleted = 0;
        if (this.store.keys.delete(key)) deleted++;
        if (this.store.lists.delete(key)) deleted++;
        return deleted;
    }

    async lPush(key, value) {
        if (!this.store.lists.has(key)) {
            this.store.lists.set(key, []);
        }
        const list = this.store.lists.get(key);
        list.unshift(String(value)); // LPUSH prepends in Redis

        // If there are blocked brPop listeners waiting on this list, notify the oldest one
        if (this.store.listListeners.has(key)) {
            const listeners = this.store.listListeners.get(key);
            if (listeners.length > 0) {
                const listener = listeners.shift();
                const popped = list.pop(); // Pop from the tail
                listener.resolve({ key: listener.key, element: popped });
            }
        }
        return list.length;
    }

    async lLen(key) {
        const list = this.store.lists.get(key);
        return list ? list.length : 0;
    }

    async brPop(keys, timeout = 0) {
        const keyList = Array.isArray(keys) ? keys : [keys];
        
        // Check if any of the lists have items immediately
        for (const key of keyList) {
            const list = this.store.lists.get(key);
            if (list && list.length > 0) {
                const element = list.pop();
                return { key, element };
            }
        }

        // Wait for an item to be pushed to any of the lists
        return new Promise((resolve) => {
            let resolved = false;

            const cleanupAndResolve = (result) => {
                if (resolved) return;
                resolved = true;
                
                // Deregister this listener from all lists to prevent memory leaks
                for (const key of keyList) {
                    if (this.store.listListeners.has(key)) {
                        const listeners = this.store.listListeners.get(key);
                        const idx = listeners.findIndex(l => l.resolve === cleanupAndResolve);
                        if (idx !== -1) {
                            listeners.splice(idx, 1);
                        }
                    }
                }
                resolve(result);
            };

            // Register the listener for each key in the brPop request
            for (const key of keyList) {
                if (!this.store.listListeners.has(key)) {
                    this.store.listListeners.set(key, []);
                }
                this.store.listListeners.get(key).push({
                    resolve: cleanupAndResolve,
                    key: key
                });
            }

            if (timeout > 0) {
                setTimeout(() => {
                    cleanupAndResolve(null);
                }, timeout * 1000);
            }
        });
    }
}

/**
 * Unified Redis connection manager. Automatically switches to an in-memory client
 * in development/test environments, or falls back to it gracefully if a connection fails.
 */
class RedisManager {
    constructor() {
        this.url = env.redisUrl;
        this.client = null;
        this.isConnecting = false;
        // In development/test or when no REDIS_URL is configured, use in-memory mock client
        this.isInMemory = env.isDev || !env.redisUrl;
        this.sharedStore = {
            keys: new Map(),
            lists: new Map(),
            listListeners: new Map()
        };
    }

    /**
     * Returns a singleton Redis client.
     */
    async getClient() {
        if (this.client) return this.client;

        if (this.isInMemory) {
            logger.info('Initializing Plug-and-Play In-Memory Redis Adapter.');
            this.client = new InMemoryRedisClient(this.sharedStore);
            return this.client;
        }

        if (!this.isConnecting) {
            this.isConnecting = true;
            logger.info(`Connecting to Redis Server at: ${this.url}`);
            try {
                this.client = createClient({ url: this.url });
                this.client.on('error', (err) => logger.error('Redis Client Error', err));
                await this.client.connect();
                logger.info('Redis Standard Client Connected.');
            } catch (err) {
                logger.error(`Failed to connect to Redis. Falling back to In-Memory Adapter. Error: ${err.message}`);
                this.isInMemory = true;
                this.client = new InMemoryRedisClient(this.sharedStore);
            }
            this.isConnecting = false;
        } else {
            // Wait for the connection to be established by another caller
            while (this.isConnecting) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        return this.client;
    }

    /**
     * Returns an isolated worker client. Required for blocking operations like brPop.
     */
    async getWorkerClient() {
        if (this.isInMemory) {
            logger.info('Generating isolated In-Memory Duplicate Client.');
            return new InMemoryRedisClient(this.sharedStore);
        }

        const mainClient = await this.getClient();
        if (this.isInMemory) {
            return new InMemoryRedisClient(this.sharedStore);
        }

        const workerClient = mainClient.duplicate();
        workerClient.on('error', (err) => logger.error('Redis Worker Client Error', err));
        await workerClient.connect();
        logger.info('Redis Worker Client Connected.');
        return workerClient;
    }
}

export const redisManager = new RedisManager();
