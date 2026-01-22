/**
 * Dataset Storage Functions
 * Store and retrieve datasets with actual File objects in IndexedDB
 */

import { db } from './index'

/**
 * Save a dataset with files to IndexedDB
 * @param {Object} datasetInfo - Dataset metadata
 * @param {File[]|Object[]} files - Array of File objects (local) or metadata objects (GitHub/URL)
 * @returns {Promise<string>} Dataset ID
 */
export async function saveDataset(datasetInfo, files) {
  try {
    const dataset = {
      id: `dataset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: datasetInfo.name,
      source: datasetInfo.source || 'local',
      url: datasetInfo.url || null,
      imageCount: files.length,
      totalSize: files.reduce((acc, f) => acc + (f.size || 0), 0),
      createdAt: Date.now(),
      // For local: Store actual File objects (IndexedDB supports Blobs and Files)
      // For GitHub/URL: Store metadata objects with URLs
      files: files,
      // Additional metadata
      metadata: {
        owner: datasetInfo.owner || null,
        repo: datasetInfo.repo || null,
        branch: datasetInfo.branch || null,
        path: datasetInfo.path || null
      }
    }
    
    await db.datasets.add(dataset)
    console.log('✅ Dataset saved to IndexedDB:', dataset.id)
    return dataset.id
  } catch (error) {
    console.error('Failed to save dataset:', error)
    throw error
  }
}

/**
 * Get a dataset by ID (with files)
 * @param {string} datasetId 
 * @returns {Promise<Object>} Dataset object with files
 */
export async function getDataset(datasetId) {
  try {
    const dataset = await db.datasets.get(datasetId)
    if (!dataset) {
      throw new Error(`Dataset ${datasetId} not found`)
    }
    return dataset
  } catch (error) {
    console.error('Failed to get dataset:', error)
    throw error
  }
}

/**
 * Get all datasets (without files for listing)
 * @returns {Promise<Array>} Array of dataset metadata
 */
export async function getAllDatasets() {
  try {
    const datasets = await db.datasets.toArray()
    // Return without files for performance
    return datasets.map(ds => ({
      id: ds.id,
      name: ds.name,
      source: ds.source,
      url: ds.url,
      imageCount: ds.imageCount,
      totalSize: ds.totalSize,
      createdAt: ds.createdAt,
      metadata: ds.metadata
    }))
  } catch (error) {
    console.error('Failed to get datasets:', error)
    return []
  }
}

/**
 * Delete a dataset
 * @param {string} datasetId 
 */
export async function deleteDataset(datasetId) {
  try {
    await db.datasets.delete(datasetId)
    console.log('✅ Dataset deleted:', datasetId)
  } catch (error) {
    console.error('Failed to delete dataset:', error)
    throw error
  }
}

/**
 * Update dataset name
 * @param {string} datasetId 
 * @param {string} newName 
 */
export async function renameDataset(datasetId, newName) {
  try {
    await db.datasets.update(datasetId, { name: newName })
    console.log('✅ Dataset renamed:', datasetId)
  } catch (error) {
    console.error('Failed to rename dataset:', error)
    throw error
  }
}

/**
 * Get dataset thumbnail (first image as preview)
 * @param {string} datasetId 
 * @returns {Promise<string>} Data URL of first image
 */
export async function getDatasetThumbnail(datasetId) {
  try {
    const dataset = await db.datasets.get(datasetId)
    if (!dataset || !dataset.files || dataset.files.length === 0) {
      return null
    }
    
    const firstFile = dataset.files[0]
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(firstFile)
    })
  } catch (error) {
    console.error('Failed to get dataset thumbnail:', error)
    return null
  }
}

/**
 * Migrate localStorage datasets to IndexedDB
 * This is a one-time migration helper
 */
export async function migrateLocalStorageDatasets() {
  try {
    const oldDatasets = JSON.parse(localStorage.getItem('datasets') || '[]')
    if (oldDatasets.length === 0) {
      console.log('No datasets to migrate')
      return 0
    }
    
    // Migrate metadata only (files are lost in localStorage approach)
    for (const oldDs of oldDatasets) {
      const newDataset = {
        id: `dataset_${oldDs.id}_migrated`,
        name: oldDs.name,
        source: oldDs.source,
        url: oldDs.url || null,
        imageCount: oldDs.imageCount,
        totalSize: oldDs.totalSize || 0,
        createdAt: new Date(oldDs.createdAt).getTime(),
        files: [], // No files from localStorage
        metadata: {
          owner: oldDs.owner || null,
          repo: oldDs.repo || null,
          branch: oldDs.branch || null,
          path: oldDs.path || null
        }
      }
      
      await db.datasets.add(newDataset)
    }
    
    console.log(`✅ Migrated ${oldDatasets.length} datasets to IndexedDB`)
    // Clear old localStorage
    localStorage.removeItem('datasets')
    return oldDatasets.length
  } catch (error) {
    console.error('Failed to migrate datasets:', error)
    return 0
  }
}
