/**
 * File Management Utilities
 * Download files from server and convert to Blobs for IndexedDB storage
 */

import { getUserId } from '../utils/userIdManager';

/**
 * Download file from URL and convert to Blob
 * @param {string} url - File URL
 * @returns {Promise<Blob>} File as Blob
 */
export async function downloadFileAsBlob(url) {
  // Get userId to send in header
  const userId = await getUserId();
  
  const response = await fetch(url, {
    headers: {
      'X-User-Id': userId
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to download: ${url}`);
  }
  return await response.blob();
}

/**
 * Download all model files and return as object
 * @param {Object} results - Results object from server { obj: {url, size}, stl: {...}, usdz: {...} }
 * @returns {Promise<Object>} { obj: Blob, stl: Blob, usdz: Blob }
 */
export async function downloadModelFiles(results) {
  const files = {};
  
  for (const [format, info] of Object.entries(results)) {
    if (info && info.url) {
      console.log(`📥 Downloading ${format.toUpperCase()}...`);
      try {
        const blob = await downloadFileAsBlob(info.url);
        files[format] = blob;
        console.log(`✅ Downloaded ${format.toUpperCase()}: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
      } catch (error) {
        console.error(`❌ Failed to download ${format}:`, error);
      }
    }
  }
  
  return files;
}

/**
 * Create object URL from Blob for viewing/downloading
 * @param {Blob} blob - File blob
 * @returns {string} Object URL
 */
export function createObjectURL(blob) {
  return URL.createObjectURL(blob);
}

/**
 * Revoke object URL to free memory
 * @param {string} url - Object URL
 */
export function revokeObjectURL(url) {
  URL.revokeObjectURL(url);
}

/**
 * Download blob as file
 * @param {Blob} blob - File blob
 * @param {string} filename - Filename for download
 */
export function downloadBlob(blob, filename) {
  const url = createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  revokeObjectURL(url);
}

/**
 * Create thumbnail from first image file
 * @param {File} imageFile - Image file
 * @returns {Promise<Blob>} Thumbnail blob (max 300x300)
 */
export async function createThumbnail(imageFile) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calculate dimensions (max 300x300, keep aspect ratio)
        const maxSize = 300;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and convert to blob
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', 0.8);
      };
      
      img.onerror = reject;
      img.src = e.target.result;
    };
    
    reader.onerror = reject;
    reader.readAsDataURL(imageFile);
  });
}

/**
 * Get file extension from blob type
 * @param {Blob} blob - File blob
 * @returns {string} File extension
 */
export function getFileExtension(blob) {
  const mimeToExt = {
    'application/octet-stream': 'stl',
    'model/obj': 'obj',
    'model/vnd.usdz+zip': 'usdz',
    'image/jpeg': 'jpg',
    'image/png': 'png'
  };
  return mimeToExt[blob.type] || 'bin';
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size (e.g., "1.23 MB")
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}
