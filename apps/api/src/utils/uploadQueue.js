import fs from 'fs';
import { ulid } from 'ulidx';
import { db } from '../config/db.js';
import { mediaService } from '../services/mediaService.js';
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

        const files = Array.isArray(task.fileData) ? task.fileData : [task.fileData];
        let record = { id: task.recordData?.id };

        // 1. Create the Database Record (if recordData has fields to save)
        if (task.recordData && Object.keys(task.recordData).length > 0) {
            // Generate ID if missing
            if (!task.recordData.id) {
                task.recordData.id = ulid();
            }
            record = await db.insertRecord(task.collection, task.recordData);
        } else if (!record.id) {
             // If no recordData and no ID, we must assume we just need a generic ULID for the attachments
             record.id = ulid();
        }

        // 2. Attach Files to the new Record ID via the Media Service (MinIO + media_attachments table)
        if (files && files.length > 0) {
            await mediaService.attachMedia(
                task.userId, 
                task.collection, 
                record.id, 
                files, 
                'Uploaded via queue'
            );
        }

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
        // Cleanup local multer files
        const filesToClean = Array.isArray(task.fileData) ? task.fileData : [task.fileData];
        filesToClean.forEach(file => {
            if (file && file.path && fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        });
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
            this.client = await redisManager.getClient();
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