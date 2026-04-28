import { createClient } from 'redis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

class RedisManager {
    constructor() {
        this.url = env.redis?.url || 'redis://localhost:6379';
        this.client = null;
        this.isConnecting = false;
    }

    /**
     * Returns a singleton Redis client for standard operations (GET, SET, LPUSH).
     */
    async getClient() {
        if (this.client) return this.client;

        if (!this.isConnecting) {
            this.isConnecting = true;
            this.client = createClient({ url: this.url });
            this.client.on('error', (err) => logger.error('Redis Client Error', err));
            
            await this.client.connect();
            logger.info('Redis Standard Client Connected.');
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
     * Generates a fresh, isolated duplicate client.
     * Required for blocking operations like BRPOP that freeze the connection.
     */
    async getWorkerClient() {
        const mainClient = await this.getClient();
        const workerClient = mainClient.duplicate();
        
        workerClient.on('error', (err) => logger.error('Redis Worker Client Error', err));
        await workerClient.connect();
        
        logger.info('Redis Worker Client Connected.');
        return workerClient;
    }
}

export const redisManager = new RedisManager();