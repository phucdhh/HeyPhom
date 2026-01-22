const axios = require('axios');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Status update locks to prevent race conditions
const statusLocks = new Map();

/**
 * GitHub Dataset Routes - Fastify Plugin
 * Handle direct server-side download from GitHub repositories
 */
module.exports = async function (fastify, opts) {
  
  fastify.post('/', async (request, reply) => {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    fastify.log.info(`📦 [${sessionId}] GitHub dataset request received`);
    
    try {
      const { source, owner, repo, branch, path: repoPath, images, quality, formats } = request.body;
      
      fastify.log.info(`📊 [${sessionId}] Body parsed: source=${source}, owner=${owner}, repo=${repo}, images=${images?.length || 0}`);
      
      // Validation
      if (source !== 'github') {
        return reply.status(400).send({
          success: false,
          message: 'Invalid source, expected "github"'
        });
      }
      
      if (!owner || !repo || !images || !Array.isArray(images) || images.length === 0) {
        return reply.status(400).send({
          success: false,
          message: 'Missing required fields: owner, repo, images'
        });
      }
      
      if (images.length < 30) {
        return reply.status(400).send({
          success: false,
          message: `Insufficient images: ${images.length} provided, minimum 30 required`
        });
      }
      
      fastify.log.info(`📊 [${sessionId}] Dataset: ${owner}/${repo}, ${images.length} images`);
      
      const userId = request.headers['x-user-id'];
      if (!userId) {
        return reply.status(400).send({
          success: false,
          message: 'Missing x-user-id header'
        });
      }
      
      // Create session directories using new user structure
      const { getUserSessionDir, getUserUploadsDir } = require('./upload');
      const sessionDir = getUserSessionDir(userId, sessionId);
      const uploadsDir = getUserUploadsDir(userId, sessionId);
      
      await fs.mkdir(uploadsDir, { recursive: true });
      
      // Register job in upload routes (reuse shared job management)
      const { jobs } = require('./upload');
      const job = {
        sessionId,
        userId,
        status: 'downloading',
        source: 'github',
        githubRepo: `${owner}/${repo}`,
        branch: branch || 'master',
        path: repoPath || '',
        imageCount: images.length,
        quality: quality || 'high',
        formats: formats || ['usdz', 'obj', 'stl'],
        progress: 0,
        currentStage: 'Downloading images from GitHub',
        createdAt: new Date().toISOString()
      };
      
      jobs.set(sessionId, job);
      
      // Also save to session file for compatibility
      const sessionFile = path.join(sessionDir, 'session.json');
      await fs.writeFile(sessionFile, JSON.stringify(job, null, 2));
      
      // Get estimated time using shared helper
      const { getEstimatedTime } = require('./upload');
      const estimatedTime = getEstimatedTime(images.length, quality);
      
      // Send immediate response with full details (like upload route)
      reply.send({
        success: true,
        sessionId,
        message: 'GitHub dataset accepted, downloading images...',
        uploadedCount: images.length,
        totalSize: 'N/A', // Unknown until downloaded
        imageCount: images.length,
        quality: quality,
        formats: formats,
        estimatedTime: estimatedTime,
        statusUrl: `/api/jobs/${sessionId}`
      });
      
      // Start background download and processing
      downloadAndProcess(fastify, sessionId, images, quality, formats, sessionDir, uploadsDir);
      
    } catch (error) {
      fastify.log.error(`❌ [${sessionId}] Error:`, error);
      reply.status(500).send({
        success: false,
        message: error.message
      });
    }
  });
};

/**
 * Download images from GitHub and start processing
 */
async function downloadAndProcess(fastify, sessionId, images, quality, formats, sessionDir, uploadsDir) {
  const total = images.length;
  let downloaded = 0;
  let failed = 0;
  
  fastify.log.info(`📥 [${sessionId}] Starting download of ${total} images...`);
  
  try {
    // Download images sequentially to avoid rate limiting
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const downloadUrl = img.url || img.download_url;
      
      if (!downloadUrl) {
        fastify.log.warn(`⚠️ [${sessionId}] No URL for ${img.name}`);
        failed++;
        continue;
      }
      
      try {
        // Download image with timeout and retry logic
        let retries = 3;
        let lastError = null;
        
        while (retries > 0) {
          try {
            const response = await axios.get(downloadUrl, {
              responseType: 'arraybuffer',
              timeout: 30000,
              maxRedirects: 5
            });
            
            // Validate content type
            const contentType = response.headers['content-type'];
            if (!contentType || (!contentType.startsWith('image/') && !contentType.includes('octet-stream'))) {
              throw new Error(`Invalid content type: ${contentType}`);
            }
            
            // Save to disk
            const filename = img.name;
            const filepath = path.join(uploadsDir, filename);
            await fs.writeFile(filepath, response.data);
            
            downloaded++;
            break; // Success, exit retry loop
            
          } catch (retryError) {
            lastError = retryError;
            retries--;
            
            // If rate limited (503 or 429), wait before retry
            if (retryError.response && (retryError.response.status === 503 || retryError.response.status === 429)) {
              if (retries > 0) {
                const delay = (4 - retries) * 2000; // 2s, 4s, 6s
                fastify.log.warn(`⚠️ [${sessionId}] Rate limited, retrying ${img.name} in ${delay}ms (${retries} left)...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
              }
            }
            
            // For other errors, throw immediately
            if (retries === 0) throw lastError;
          }
        }
        
        // Update progress every 5 images
        if (downloaded % 5 === 0 || downloaded === total) {
          const progress = Math.round((downloaded / total) * 100);
          
          // Update job in shared jobs Map
          const { jobs, progressService } = require('./upload');
          const job = jobs.get(sessionId);
          if (job) {
            job.progress = progress;
            job.currentStage = `Downloading images: ${downloaded}/${total}`;
            job.downloadedCount = downloaded;
            job.failedCount = failed;
            jobs.set(sessionId, job);
            
            // Broadcast via WebSocket with BOTH progress and stage
            progressService.updateProgress(sessionId, {
              progress: progress,
              stage: `Downloading images: ${downloaded}/${total}`
            });
          }
          
          fastify.log.info(`📥 [${sessionId}] Progress: ${downloaded}/${total} (${progress}%)`);
        }
        
      } catch (downloadError) {
        fastify.log.error(`❌ [${sessionId}] Failed to download ${img.name}:`, downloadError.message);
        if (downloadError.response) {
          fastify.log.error(`   Response status: ${downloadError.response.status}`);
          fastify.log.error(`   Response data: ${downloadError.response.data}`);
        } else if (downloadError.request) {
          fastify.log.error(`   No response received for: ${downloadUrl}`);
        } else {
          fastify.log.error(`   Error details: ${downloadError.stack}`);
        }
        failed++;
      }
    }
    
    fastify.log.info(`✅ [${sessionId}] Download complete: ${downloaded} success, ${failed} failed`);
    
    // Check minimum requirement
    if (downloaded < 30) {
      throw new Error(`Only ${downloaded} images downloaded successfully, minimum 30 required`);
    }
    
    // Update job status to processing before calling processJob
    const { jobs, processJob } = require('./upload');
    fastify.log.info(`🔍 [${sessionId}] Jobs Map size: ${jobs.size}, has session: ${jobs.has(sessionId)}`);
    const job = jobs.get(sessionId);
    fastify.log.info(`🔍 [${sessionId}] Retrieved job: ${job ? 'EXISTS' : 'NULL'}, status: ${job?.status}`);
    
    if (job) {
      job.status = 'processing';
      // Don't reset progress - processing continues from download progress
      // job.progress stays at 100 from download phase
      job.currentStage = '';
      job.downloadComplete = true;
      job.downloadedCount = downloaded;
      job.failedCount = failed;
      jobs.set(sessionId, job);
      
      // Save to session file (use path module to get parent dir from sessionDir)
      const sessionFile = path.join(sessionDir, 'session.json');
      await fs.writeFile(sessionFile, JSON.stringify(job, null, 2));
    }
    
    fastify.log.info(`🚀 [${sessionId}] Starting 3D reconstruction...`);
    
    // Debug: Check jobs Map before calling processJob
    fastify.log.info(`🔍 [${sessionId}] Jobs Map before processJob: size=${jobs.size}, has session=${jobs.has(sessionId)}`);
    const jobBeforeProcess = jobs.get(sessionId);
    fastify.log.info(`🔍 [${sessionId}] Job before processJob: ${jobBeforeProcess ? 'EXISTS' : 'NULL'}, status=${jobBeforeProcess?.status}`);
    
    // Use shared processJob from upload routes (same logic as local files)
    // MUST await to ensure it actually executes
    try {
      await processJob(sessionId, uploadsDir, quality, formats, job.userId);
      
      // Debug: Check jobs Map after processJob
      const jobAfterProcess = jobs.get(sessionId);
      fastify.log.info(`🔍 [${sessionId}] Job after processJob: ${jobAfterProcess ? 'EXISTS' : 'NULL'}, status=${jobAfterProcess?.status}`);
      
      fastify.log.info(`✅ [${sessionId}] Processing completed successfully`);
    } catch (procError) {
      fastify.log.error(`❌ [${sessionId}] Processing failed:`, procError.message);
      fastify.log.error(procError.stack);
    }
    
  } catch (error) {
    fastify.log.error(`❌ [${sessionId}] Download failed:`, error.message);
    fastify.log.error(error.stack); // Log full stack trace
    
    // Update job status to failed
    const { jobs } = require('./upload');
    const job = jobs.get(sessionId);
    if (job) {
      job.status = 'failed';
      job.error = error.message;
      job.failedAt = new Date().toISOString();
      jobs.set(sessionId, job);
    }
  }
}
