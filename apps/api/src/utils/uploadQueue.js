import fs from 'fs';
import { createClient } from 'redis';
import { pbService } from '../services/pocketbaseService.js';
import { sseManager } from './sseFactory.js';
import { logger } from './logger.js';
import { env } from '../config/env.js';
import { redisManager } from './redisClient.js';

// ==========================================
// 1. Shared Processing Logic
// ==========================================
const processTask = async (task) => {
    try {
        sseManager.broadcast(`user_${task.userId}`, 'upload_status', { 
            taskId: task.taskId, 
            status: 'processing' 
        });

        const record = await pbService.uploadInternal(task.collection, task.fileData, task.recordData);

        sseManager.broadcast(`user_${task.userId}`, 'upload_status', { 
            taskId: task.taskId, 
            status: 'completed',
            record: record 
        });
    } catch (error) {
        logger.error(`Internal upload failed for task ${task.taskId}`, { error: error.message });
        sseManager.broadcast(`user_${task.userId}`, 'upload_status', { 
            taskId: task.taskId, 
            status: 'error', 
            error: "Failed to process file internally." 
        });
    } finally {
        if (fs.existsSync(task.fileData.path)) {
            fs.unlinkSync(task.fileData.path);
        }
    }
};

// ==========================================
// 2. In-Memory Queue (Development)
// ==========================================
class MemoryQueueAdapter {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        logger.info('Initialized In-Memory Upload Queue.');
    }

    add(task) {
        this.queue.push(task);
        this.updateQueuePositions();
        this.processNext();
    }

    updateQueuePositions() {
        this.queue.forEach((task, index) => {
            sseManager.broadcast(`user_${task.userId}`, 'upload_status', {
                taskId: task.taskId,
                status: 'queued',
                position: index + 1
            });
        });
    }

    async processNext() {
        if (this.isProcessing || this.queue.length === 0) return;
        this.isProcessing = true;
        
        const task = this.queue.shift();
        
        this.updateQueuePositions();
        await processTask(task);
        
        this.isProcessing = false;
        this.processNext();
    }
}

// ==========================================
// 3. Native Redis Queue (Production)
// ==========================================
class NativeRedisQueueAdapter {
    constructor() {
        this.queueKey = 'upload:queue';
        this.client = null;
        this.workerClient = null;
        
        this.init();
    }

    async init() {
        try {
            // Fetch the reusable singleton client
            this.client = await redisManager.getClient();
            // Fetch a dedicated worker client for blocking pops
            this.workerClient = await redisManager.getWorkerClient();
            
            logger.info('Initialized Native Redis Upload Queue.');
            this.startWorker();
        } catch (error) {
            logger.error('Failed to initialize Redis Queue Adapter', { error: error.message });
        }
    }

    async add(task) {
        if (!this.client) throw new Error('Redis client not ready.');

        try {
            const taskString = JSON.stringify(task);
            await this.client.lPush(this.queueKey, taskString);
            const waitingCount = await this.client.lLen(this.queueKey);

            sseManager.broadcast(`user_${task.userId}`, 'upload_status', {
                taskId: task.taskId,
                status: 'queued',
                position: waitingCount
            });
        } catch (error) {
            logger.error('Failed to add task to Redis queue', { error: error.message });
            throw error;
        }
    }

    async startWorker() {
        logger.info('Native Redis Worker listening for tasks...');
        
        while (true) {
            try {
                if (!this.workerClient) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }

                // BRPOP blocks indefinitely (0) until a task arrives
                const result = await this.workerClient.brPop(this.queueKey, 0);
                
                if (result && result.element) {
                    const task = JSON.parse(result.element);
                    await processTask(task);
                }
            } catch (error) {
                logger.error('Redis Worker error during task processing', { error: error.message });
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }
}

export const uploadQueue = (env.nodeEnv === 'production' && env.redis?.enabled) 
    ? new NativeRedisQueueAdapter() 
    : new MemoryQueueAdapter();