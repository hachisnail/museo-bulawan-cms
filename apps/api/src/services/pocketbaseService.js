import PocketBase from "pocketbase";
import { EventSource } from "eventsource";
import fs from "fs";
import { notificationService } from "./notificationService.js";

// Attach it to the global scope so the PocketBase SDK can find it
global.EventSource = EventSource;

import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { sseManager } from "../utils/sseFactory.js";

class PocketBaseService {
  constructor() {
    this.pb = new PocketBase(env.pb.url);
    this.pb.autoCancellation(false);
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
    await this.wrapCollection("inventory");
    await this.wrapCollection("accessions");
    await this.wrapCollection("intakes");
    await this.wrapCollection("appointments");
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

  async syncUser({ username, email, password, fname, lname }) {
    try {
      const users = await this.pb
        .collection("users")
        .getFullList({ filter: `email="${email}"` });

      const pbPayload = {
        username,
        email,
        emailVisibility: true,
        name: `${fname} ${lname}`.trim(),
      };

      if (password) {
        pbPayload.password = password;
        pbPayload.passwordConfirm = password;
      }

      if (users.length > 0) {
        await this.pb.collection("users").update(users[0].id, pbPayload);
        logger.info(`PocketBase User updated: ${email}`);
      } else {
        await this.pb.collection("users").create(pbPayload);
        logger.info(`PocketBase User created: ${email}`);
      }
    } catch (error) {
      logger.error(`Failed to sync user to PB`, { error: error.message });
      throw new Error("PB_SYNC_FAILED");
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
      // Keep the existing SSE broadcast for UI updates
      sseManager.broadcast(collectionName, e.action, e.record);
    });
  }

  async uploadInternal(collectionName, fileInfo, additionalData) {
    try {
      // 1. Create a native FormData object
      const formData = new FormData();

      // 2. Append all other metadata fields
      for (const key in additionalData) {
        formData.append(key, additionalData[key]);
      }

      // 3. Stream the file directly instead of buffering it into RAM
      // Note: If you encounter native fetch "parameter 2 is not of type Blob" errors on Node 20+,
      // replace the line below with: const fileStream = await fs.promises.openAsBlob(fileInfo.path);
      const fileStream = fs.createReadStream(fileInfo.path);

      formData.append("file", fileStream, fileInfo.originalname);

      // 4. Pass the FormData object directly to the create method
      const record = await this.pb.collection(collectionName).create(formData);
      return record;
    } catch (error) {
      logger.error(`PB SDK Upload Error`, { error: error.message });
      throw error;
    }
  }
}

export const pbService = new PocketBaseService();
