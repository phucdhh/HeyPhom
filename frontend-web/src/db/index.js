/**
 * HeyPhom IndexedDB Setup
 * Using Dexie.js for client-side storage management
 */

import Dexie from 'dexie';

// Initialize database
export const db = new Dexie('HeyPhomDB');

// Define schema version 1
db.version(1).stores({
  projects: 'id, name, status, quality, createdAt, completedAt, serverExpiry'
});

// Define schema version 2 - Add datasets store
db.version(2).stores({
  projects: 'id, name, status, quality, createdAt, completedAt, serverExpiry',
  datasets: 'id, name, source, createdAt' // Store for saved datasets with files
});

// Type definitions for TypeScript-like IDE support
export class Project {
  constructor(
    id,
    name,
    status,
    quality,
    formats,
    progress,
    currentStage,
    createdAt,
    completedAt,
    thumbnail,
    imageCount,
    files,
    serverExpiry
  ) {
    this.id = id; // String (sessionId)
    this.name = name; // String
    this.status = status; // 'uploading' | 'processing' | 'completed' | 'failed'
    this.quality = quality; // 'low' | 'medium' | 'high' | 'ultra'
    this.formats = formats; // Array<'usdz' | 'obj' | 'stl'>
    this.progress = progress; // Number (0-100)
    this.currentStage = currentStage; // String
    this.createdAt = createdAt; // Timestamp
    this.completedAt = completedAt; // Timestamp
    this.thumbnail = thumbnail; // Blob
    this.imageCount = imageCount; // Number
    this.files = files; // { obj: Blob, stl: Blob, usdz: Blob }
    this.serverExpiry = serverExpiry; // Timestamp (createdAt + 24h)
  }
}

export default db;
