/**
 * Chunked Upload Utility
 * Uploads files in batches to bypass Cloudflare 100MB limit
 */

const BATCH_SIZE_MB = 80; // Upload max 80MB per batch (safe margin under 100MB)
const MAX_FILES_PER_BATCH = 20; // Max files per batch

export async function uploadInChunks(files, quality, formats, userId, onProgress) {
  // Calculate batches based on file size
  const batches = [];
  let currentBatch = [];
  let currentBatchSize = 0;
  
  for (const file of files) {
    const fileSizeMB = file.size / 1024 / 1024;
    
    // If adding this file would exceed batch size or max files, start new batch
    if (
      (currentBatchSize + fileSizeMB > BATCH_SIZE_MB && currentBatch.length > 0) ||
      currentBatch.length >= MAX_FILES_PER_BATCH
    ) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBatchSize = 0;
    }
    
    currentBatch.push(file);
    currentBatchSize += fileSizeMB;
  }
  
  // Add last batch
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }
  
  console.log(`📦 Split ${files.length} files into ${batches.length} batches`);
  
  // If only one batch, upload normally
  if (batches.length === 1) {
    console.log('✅ Single batch, uploading normally');
    return uploadBatch(batches[0], quality, formats, userId, null, true, onProgress);
  }
  
  // Multiple batches - need session ID
  let sessionId = null;
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNumber = i + 1;
    const isLastBatch = i === batches.length - 1;
    
    console.log(`📤 Uploading batch ${batchNumber}/${batches.length} (${batch.length} files)`);
    
    onProgress?.({
      type: 'batch',
      current: batchNumber,
      total: batches.length,
      files: batch.length
    });
    
    const result = await uploadBatch(
      batch,
      quality,
      formats,
      userId,
      sessionId,
      isLastBatch,  // Pass isLastBatch flag
      (progress) => {
        // Calculate overall progress
        const batchProgress = ((i + progress / 100) / batches.length) * 100;
        onProgress?.({
          type: 'progress',
          batch: batchNumber,
          batchProgress: progress,
          overallProgress: Math.round(batchProgress)
        });
      }
    );
    
    if (!result.success) {
      throw new Error(result.error || 'Upload failed');
    }
    
    // Get session ID from first batch
    if (i === 0) {
      sessionId = result.data?.sessionId;
      if (!sessionId) {
        throw new Error('No session ID returned from first batch');
      }
      console.log('🆔 Session ID:', sessionId);
    }
    
    // Last batch returns final result
    if (isLastBatch) {
      return result;
    }
  }
}

async function uploadBatch(files, quality, formats, userId, sessionId, isLastBatch, onProgress) {
  const formData = new FormData();
  
  files.forEach(file => {
    formData.append('files', file);
  });
  
  formData.append('quality', quality);
  formData.append('formats', formats.join(','));
  
  // Add flag to indicate if more chunks are coming
  if (!isLastBatch) {
    formData.append('moreChunks', 'true');
  }
  
  const API_BASE = import.meta.env.VITE_API_URL || '';
  const uploadUrl = `${API_BASE}/api/upload`;
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentCompleted = Math.round((e.loaded * 100) / e.total);
        onProgress?.(percentCompleted);
      }
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status === 200 || xhr.status === 202) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      } else {
        reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
      }
    });
    
    xhr.addEventListener('error', () => {
      reject(new Error('Network error'));
    });
    
    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });
    
    xhr.open('POST', uploadUrl);
    
    // Add user ID header
    if (userId) {
      xhr.setRequestHeader('X-User-Id', userId);
    }
    
    // If continuing a session, add session ID as header (AFTER open, easier to parse than form field)
    if (sessionId) {
      xhr.setRequestHeader('X-Session-Id', sessionId);
    }
    
    xhr.send(formData);
  });
}
