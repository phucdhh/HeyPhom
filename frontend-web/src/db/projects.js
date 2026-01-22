/**
 * Project CRUD Operations
 * Utility functions for managing projects in IndexedDB
 */

import db from './index';

/**
 * Create a new project
 * @param {string} sessionId - Session ID from server
 * @param {Object} data - Project data
 * @returns {Promise<Object>} Created project
 */
export async function createProject(sessionId, data) {
  const project = {
    id: sessionId,
    name: data.name || `Model ${new Date().toLocaleDateString('vi-VN')}`,
    status: 'uploading',
    quality: data.quality || 'low',
    formats: data.formats || ['usdz', 'obj', 'stl'],
    progress: 0,
    currentStage: null,
    imageCount: data.imageCount || 0,
    createdAt: Date.now(),
    completedAt: null,
    thumbnail: data.thumbnail || null, // Blob
    files: null,
    serverExpiry: Date.now() + (24 * 60 * 60 * 1000) // +24 hours
  };
  
  await db.projects.add(project);
  console.log('✅ Project created in IndexedDB:', sessionId);
  return project;
}

/**
 * Get a project by ID
 * @param {string} id - Session ID
 * @returns {Promise<Object|undefined>} Project object
 */
export async function getProject(id) {
  return await db.projects.get(id);
}

/**
 * Get all projects
 * @returns {Promise<Array>} Array of projects
 */
export async function getAllProjects() {
  return await db.projects.toArray();
}

/**
 * Get projects sorted by creation date (newest first)
 * @returns {Promise<Array>} Sorted array of projects
 */
export async function getProjectsSorted() {
  return await db.projects
    .orderBy('createdAt')
    .reverse()
    .toArray();
}

/**
 * Update project data
 * @param {string} id - Session ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<number>} Number of updated records
 */
// Track last stage per project to avoid duplicate logs
const lastStage = new Map();

export async function updateProject(id, updates) {
  const count = await db.projects.update(id, updates);
  if (count > 0) {
    // Only log when stage changes, not every progress update
    if (updates.currentStage && updates.currentStage !== lastStage.get(id)) {
      console.log('🔄 Stage:', id, updates.currentStage);
      lastStage.set(id, updates.currentStage);
    }
    // Log completion
    if (updates.status === 'completed') {
      console.log('✅ Complete:', id);
      lastStage.delete(id);
    }
  }
  return count;
}

/**
 * Update progress and stage from WebSocket
 * @param {string} id - Session ID
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} stage - Current stage name
 */
export async function updateProgress(id, progress, stage) {
  return await updateProject(id, {
    progress: progress,
    currentStage: stage,
    status: progress === 100 ? 'processing' : 'processing'
  });
}

/**
 * Mark project as completed and save files
 * @param {string} id - Session ID
 * @param {Object} files - { obj: Blob, stl: Blob, usdz: Blob }
 */
export async function completeProject(id, files) {
  // Safari compatibility: Ensure all files are proper Blobs
  const validatedFiles = {};
  
  for (const [format, blob] of Object.entries(files)) {
    if (blob instanceof Blob) {
      // Already a Blob, use as-is
      validatedFiles[format] = blob;
      console.log(`✅ ${format}: Valid Blob (${blob.size} bytes, ${blob.type})`);
    } else {
      console.error(`❌ ${format}: Not a Blob!`, typeof blob);
    }
  }
  
  return await updateProject(id, {
    status: 'completed',
    completedAt: Date.now(),
    progress: 100,
    files: validatedFiles
  });
}

/**
 * Mark project as failed
 * @param {string} id - Session ID
 * @param {string} error - Error message
 */
export async function failProject(id, error) {
  return await updateProject(id, {
    status: 'failed',
    error: error
  });
}

/**
 * Delete a project
 * @param {string} id - Session ID
 * @returns {Promise<void>}
 */
export async function deleteProject(id) {
  await db.projects.delete(id);
  console.log('🗑️ Project deleted from IndexedDB:', id);
}

/**
 * Delete multiple projects
 * @param {Array<string>} ids - Array of session IDs
 */
export async function deleteProjects(ids) {
  await db.projects.bulkDelete(ids);
  console.log('🗑️ Deleted projects:', ids.length);
}

/**
 * Get projects by status
 * @param {string} status - Status to filter by
 * @returns {Promise<Array>} Filtered projects
 */
export async function getProjectsByStatus(status) {
  return await db.projects
    .where('status')
    .equals(status)
    .toArray();
}

/**
 * Delete expired projects (serverExpiry < now)
 * Server will delete these files, so we should clean up IndexedDB
 * @returns {Promise<number>} Number of deleted projects
 */
export async function cleanupExpiredProjects() {
  const now = Date.now();
  const expired = await db.projects
    .where('serverExpiry')
    .below(now)
    .toArray();
  
  if (expired.length > 0) {
    const ids = expired.map(p => p.id);
    await deleteProjects(ids);
    console.log(`🧹 Cleaned up ${expired.length} expired projects`);
  }
  
  return expired.length;
}

/**
 * Check if project has expired on server
 * @param {string} id - Session ID
 * @returns {Promise<boolean>} True if expired
 */
export async function isProjectExpired(id) {
  const project = await getProject(id);
  if (!project) return true;
  return project.serverExpiry < Date.now();
}

/**
 * Get storage usage estimate
 * @returns {Promise<Object>} Storage info { usage, quota, usedGB, quotaGB }
 */
export async function getStorageInfo() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const usedGB = estimate.usage / 1024 / 1024 / 1024;
    const quotaGB = estimate.quota / 1024 / 1024 / 1024;
    const percent = (estimate.usage / estimate.quota) * 100;
    
    return {
      usage: estimate.usage,
      quota: estimate.quota,
      usedGB: usedGB,
      quotaGB: quotaGB,
      percent: percent
    };
  }
  return null;
}

/**
 * Count total projects
 * @returns {Promise<number>} Total count
 */
export async function getProjectCount() {
  return await db.projects.count();
}

/**
 * Clear all projects (use with caution!)
 * @returns {Promise<void>}
 */
export async function clearAllProjects() {
  await db.projects.clear();
  console.log('🗑️ All projects cleared from IndexedDB');
}
