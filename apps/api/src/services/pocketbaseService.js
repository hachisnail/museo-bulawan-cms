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
    this.pb = null;
  }

  _genId() {
    return crypto.randomBytes(8).toString('hex').substring(0, 15);
  }

  async initialize(retries = 5) {
    // No-op: PocketBase is disabled.
  }

  async configureMinIO() {
    // No-op: PocketBase is disabled.
  }

  async startBridging() {
    // No-op: PocketBase is disabled.
  }

  async syncSuperuser(email, password) {
    // No-op: PocketBase is disabled.
  }

  async syncUser(user) {
    // No-op: PocketBase is disabled.
  }

  async getAppUserId(externalId) {
    // No-op: PocketBase is disabled.
    return null;
  }

  async wrapCollection(collectionName) {
    // No-op: PocketBase is disabled.
  }

  async uploadInternal(collectionName, fileInfo, additionalData, fieldName = "attachments") {
    // No-op: PocketBase is disabled.
    return { id: this._genId() };
  }

  /**
   * Upload file(s) to a specific field on an existing record.
   * Unlike uploadInternal (which creates), this UPDATES an existing record.
   */
  async uploadToField(collectionName, recordId, fieldName, fileInfo) {
    // No-op: PocketBase is disabled.
    return { id: recordId };
  }
}

export const pbService = new PocketBaseService();
