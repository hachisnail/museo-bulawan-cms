import crypto from 'crypto';
import { uploadQueue } from '../utils/uploadQueue.js';

export const handleUpload = (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file provided." });
        }

        const taskId = crypto.randomBytes(8).toString('hex');
        const { collectionName, ...recordData } = req.body;

        if (!collectionName) {
            return res.status(400).json({ error: "collectionName is required in form data." });
        }

        uploadQueue.add({
            taskId,
            userId: req.user.id,
            collection: collectionName,
            fileData: req.file, // multer object (e.g. { path: 'uploads/abc...', originalname: ... })
            recordData: recordData
        });

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
        const { formId, ...data } = req.body;

        if (!formId) {
            return res.status(400).json({ error: "formId is required for donation submissions." });
        }

        uploadQueue.add({
            taskId,
            userId: req.user?.id || 'guest_donation', 
            collection: 'form_submissions', 
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