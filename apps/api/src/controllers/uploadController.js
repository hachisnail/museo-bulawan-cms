import crypto from 'crypto';
import { uploadQueue } from '../utils/uploadQueue.js';

export const handleUpload = (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file provided." });
        }

        // Generate a unique ID for this specific upload
        const taskId = crypto.randomBytes(8).toString('hex');

        // Extract metadata the user sent alongside the file (e.g., artifact name)
        const { collectionName, ...recordData } = req.body;

        if (!collectionName) {
            return res.status(400).json({ error: "collectionName is required in form data." });
        }

        // Push it to the background queue
        uploadQueue.add({
            taskId,
            userId: req.user.id,
            collection: collectionName,
            fileData: req.file, // Contains the path to the temp file Multer created
            recordData: recordData
        });

        // Immediately respond to the user so their browser doesn't hang
        res.status(202).json({ 
            message: "File received and queued for processing.",
            taskId: taskId
        });

    } catch (error) {
        next(error);
    }
};

export const handleDonationUpload = (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file provided." });
        }

        const taskId = crypto.randomBytes(8).toString('hex');
        
        // Extract metadata
        const { formId, ...data } = req.body;

        if (!formId) {
            return res.status(400).json({ error: "formId is required for donation submissions." });
        }

        uploadQueue.add({
            taskId,
            userId: req.user?.id || 'guest_donation', 
            collection: 'form_submissions', // Consolidated
            fileData: req.file,
            recordData: {
                form_id: formId,
                data: data,
                status: 'pending'
            }
        });

        res.status(202).json({ 
            message: "Donation received and queued for processing.",
            taskId: taskId
        });

    } catch (error) {
        next(error);
    }
};