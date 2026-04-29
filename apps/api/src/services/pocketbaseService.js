import PocketBase from "pocketbase";
import { EventSource } from "eventsource";
import fs from "fs";
import crypto from "crypto";
import { notificationService } from "./notificationService.js";

// Attach it to the global scope so the PocketBase SDK can find it
global.EventSource = EventSource;

import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { sseManager } from "../utils/sseFactory.js";

function sanitize(collection, record) {
  const map = {
    intakes: (r) => ({
      id: r.id,
      proposed_item_name: r.proposed_item_name,
      status: r.status
    }),
    accessions: (r) => ({
      id: r.id,
      accession_number: r.accession_number,
      status: r.status
    }),
    inventory: (r) => ({
      id: r.id,
      catalog_number: r.catalog_number,
      current_location: r.current_location
    })
  };

  return map[collection] ? map[collection](record) : { id: record.id };
}

class PocketBaseService {
  constructor() {
    this.pb = new PocketBase(env.pb.url);
    this.pb.autoCancellation(false);
  }

  _genId() {
    return crypto.randomBytes(8).toString('hex').substring(0, 15);
  }

  async initialize(retries = 5) {
    for (let i = 0; i < retries; i++) {
      try {
        // 1. Attempt to Authenticate
        await this.pb
          .collection("_superusers")
          .authWithPassword(env.pb.adminEmail, env.pb.adminPassword);
        logger.info("Successfully authenticated with PocketBase backend.");

        // ==========================================
        // Auto-Configure MinIO Storage on successful login!
        // ==========================================
        await this.configureMinIO();

        await this.startBridging();
        return; // Exit loop on success
      } catch (error) {
        // 2. Check if it's a network error (PB is still booting up)
        if (error.status === 0 || error.message.includes("fetch")) {
          logger.warn(
            `PocketBase not ready yet. Retrying in 2 seconds... (${i + 1}/${retries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue; // Try again
        }

        // 3. If PB is online but authentication fails (Empty DB)
        logger.warn(
          "Failed to authenticate with PocketBase. Attempting to auto-provision the service account...",
        );
        try {
          await this.pb.collection("_superusers").create({
            email: env.pb.adminEmail,
            password: env.pb.adminPassword,
            passwordConfirm: env.pb.adminPassword,
          });

          logger.info(
            "Auto-provisioned PocketBase service account successfully!",
          );

          // Auth with the newly created credentials
          await this.pb
            .collection("_superusers")
            .authWithPassword(env.pb.adminEmail, env.pb.adminPassword);

          // ==========================================
          // Configure MinIO on first boot too!
          // ==========================================
          await this.configureMinIO();

          await this.startBridging();
          return; // Exit loop on success
        } catch (creationError) {
          logger.error(
            "CRITICAL: Failed to auto-provision PocketBase service account.",
            {
              error: creationError.message,
              details: creationError.data,
            },
          );
          return; // Stop retrying if it's a hard validation error
        }
      }
    }
    logger.error("CRITICAL: PocketBase did not come online after 10 seconds.");
  }

  async configureMinIO() {
    if (!env.minio.enabled) return;

    try {
      const currentSettings = await this.pb.settings.getAll();

      // Check if already configured to avoid unnecessary API calls
      if (
        currentSettings.s3?.enabled === true &&
        currentSettings.s3?.bucket === env.minio.bucket
      ) {
        return;
      }

      await this.pb.settings.update({
        s3: {
          enabled: true,
          bucket: env.minio.bucket,
          region: env.minio.region,
          endpoint: env.minio.endpoint,
          accessKey: env.minio.accessKey,
          secret: env.minio.secret,
          forcePathStyle: true,
        },
      });

      logger.info(
        "Successfully configured PocketBase to use MinIO S3 Storage.",
      );
    } catch (error) {
      logger.error("Failed to configure MinIO in PocketBase", {
        message: error.message,
        details: error.data,
      });
    }
  }

async startBridging() {
    const collections = ["inventory", "accessions", "intakes", "appointments"];
    await Promise.all(collections.map(collection => this.wrapCollection(collection)));
  }

  async syncSuperuser(email, password) {
    try {
      const superusers = await this.pb
        .collection("_superusers")
        .getFullList({ filter: `email="${email}"` });

      if (superusers.length > 0) {
        await this.pb
          .collection("_superusers")
          .update(superusers[0].id, { password, passwordConfirm: password });
        logger.info(`PocketBase Superuser updated: ${email}`);
      } else {
        await this.pb
          .collection("_superusers")
          .create({ email, password, passwordConfirm: password });
        logger.info(`PocketBase Superuser created: ${email}`);
      }
    } catch (error) {
      logger.error(`Failed to sync superuser to PB`, { error: error.message });
      throw new Error("PB_SYNC_FAILED");
    }
  }

  async syncUser(user) {
    try {
      const externalId = user.id || user.external_id;
      const users = await this.pb
        .collection("app_users")
        .getFullList({ filter: `external_id="${externalId}"` });

      const pbPayload = {
        external_id: externalId,
        email: user.email,
        role: user.role || 'guest',
        name: user.name || `${user.fname || ''} ${user.lname || ''}`.trim(),
        title: user.title || '',
        phone: user.phone || '',
        address: user.address || '',
      };

      if (users.length > 0) {
        await this.pb.collection("app_users").update(users[0].id, pbPayload);
        logger.info(`App User updated in PB: ${user.email}`);
      } else {
        // Manual ID generation to fix "id cannot be blank" error
        const manualId = crypto.randomBytes(8).toString('hex').substring(0, 15);
        await this.pb.collection("app_users").create({
            id: manualId,
            ...pbPayload
        });
        logger.info(`App User created in PB: ${user.email} with ID ${manualId}`);
      }
    } catch (error) {
      logger.error(`Failed to sync user to PB`, { error: error.message, data: error.data });
      // Non-blocking error
    }
  }

  async getAppUserId(externalId) {
    if (!externalId) return null;
    try {
      const user = await this.pb.collection("app_users").getFirstListItem(`external_id="${externalId}"`);
      return user.id;
    } catch {
      return null;
    }
  }

  async wrapCollection(collectionName) {
    // PocketBase SDK handles the connection; Express just listens and broadcasts
    await this.pb.collection(collectionName).subscribe("*", (e) => {
      if (e.action === "create") {
        // Trigger role-based notification for new artifacts/items
        notificationService.sendToRole(
          "admin",
          "New Item Created",
          `A new entry was added to ${collectionName}: ${e.record.title || e.record.id}`,
        );
      }
      // Sanitize the record before broadcasting it to clients
      const safeRecord = sanitize(collectionName, e.record);
      if (safeRecord) {
        sseManager.broadcast(collectionName, e.action, safeRecord);
      }
    });
  }

  async uploadInternal(collectionName, fileInfo, additionalData, fieldName = "attachments") {
    try {
      const formData = new FormData();

      // Ensure we have an ID if not provided (PocketBase validation sometimes requires this for custom schemas)
      if (!additionalData.id) {
        formData.append('id', this._genId());
      }

      // Append all other metadata fields
      for (const key in additionalData) {
        // PocketBase expects JSON data to be stringified when sent via FormData
        const value = typeof additionalData[key] === 'object' ? JSON.stringify(additionalData[key]) : additionalData[key];
        formData.append(key, value);
      }

      // Handle both single file (req.file) and multiple files (req.files array)
      const files = Array.isArray(fileInfo) ? fileInfo : [fileInfo];

      for (const file of files) {
        // READ: Use Blob for modern undici/fetch FormData compatibility in Node
        const buffer = fs.readFileSync(file.path);
        const blob = new Blob([buffer], { type: file.mimetype });
        formData.append(fieldName, blob, file.originalname);
      }

      // DEBUG: Log the final FormData keys to identify what's being sent
      const entries = {};
      for (const [key, value] of formData.entries()) {
          entries[key] = value instanceof Blob ? `[Blob: ${value.type}]` : value;
      }
      logger.info(`PB Upload Attempt: ${collectionName}`, { entries });

      const record = await this.pb.collection(collectionName).create(formData);
      return record;
    } catch (error) {
      logger.error(`PB SDK Upload Error`, { 
        message: error.message, 
        data: error.data, // This contains the specific validation errors from PB
        status: error.status 
      });
      throw error;
    }
  }

  /**
   * Upload file(s) to a specific field on an existing record.
   * Unlike uploadInternal (which creates), this UPDATES an existing record.
   */
  async uploadToField(collectionName, recordId, fieldName, fileInfo) {
    try {
      const formData = new FormData();
      const files = Array.isArray(fileInfo) ? fileInfo : [fileInfo];

      for (const file of files) {
        const buffer = fs.readFileSync(file.path);
        const blob = new Blob([buffer], { type: file.mimetype });
        formData.append(fieldName, blob, file.originalname);
      }

      const record = await this.pb.collection(collectionName).update(recordId, formData);
      return record;
    } catch (error) {
      logger.error(`PB SDK Field Upload Error`, { 
        message: error.message, 
        data: error.data,
        status: error.status
      });
      throw error;
    }
  }
}

export const pbService = new PocketBaseService();
