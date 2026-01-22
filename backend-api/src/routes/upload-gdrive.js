/**
 * Google Drive Direct Upload
 * Server downloads from Google Drive directly without going through browser
 */

const { nanoid } = require('nanoid');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const progressService = require('../services/progressService');

async function uploadGDriveRoutes(fastify, options) {
  /**
   * POST /api/upload/gdrive
   * Direct upload from Google Drive to server
   * Body: { files: [{id, name}], quality, formats }
   */
  fastify.post('/upload/gdrive', async (request, reply) => {
    const startTime = Date.now();
    
    try {
      const { files, quality = 'high', formats = ['usdz', 'obj', 'glb'] } = request.body;
      const userId = request.headers['x-user-id'];
      if (!userId) {
        return reply.status(400).send({
          success: false,
          message: 'Missing x-user-id header'
        });
      }
      
      if (!files || !Array.isArray(files) || files.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'No files provided',
          message: 'Request must include files array with Google Drive file IDs'
        });
      }
      
      if (files.length < 30) {
        return reply.status(400).send({
          success: false,
          error: 'Insufficient images',
          message: `Need at least 30 images for processing. Received ${files.length}.`
        });
      }
      
      // Generate session ID
      const sessionId = `sess_${Date.now()}_${nanoid(8)}`;
      const uploadModule = require('./upload');
      const sessionPath = uploadModule.getUserUploadsDir(userId, sessionId);
      
      // Create session directory
      await fs.ensureDir(sessionPath);
      console.log(`📁 Created session directory: ${sessionPath} (User: ${userId})`);
      
      // Initialize progress tracking (progressService will auto-create on first update)
      progressService.updateProgress(sessionId, {
        progress: 0,
        stage: `Downloading ${files.length} images from Google Drive...`
      });
      
      // Download files from Google Drive
      const downloadedFiles = [];
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name || `image_${i + 1}.jpg`;
        const filePath = path.join(sessionPath, fileName);
        
        try {
          const progress = Math.round(((i + 1) / files.length) * 100);
          progressService.updateProgress(sessionId, {
            progress,
            stage: `Downloading ${i + 1}/${files.length}: ${fileName}`
          });
          
          // Download from Google Drive via our proxy endpoint
          const downloadUrls = [
            `https://drive.google.com/uc?export=download&id=${file.id}`,
            `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${process.env.GOOGLE_API_KEY}`
          ];
          
          let downloaded = false;
          let lastError = null;
          
          for (const downloadUrl of downloadUrls) {
            try {
              const response = await axios.get(downloadUrl, {
                responseType: 'stream',
                timeout: 30000,
                maxRedirects: 5
              });
              
              // Write to file
              const writer = fs.createWriteStream(filePath);
              response.data.pipe(writer);
              
              await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
              });
              
              const stats = await fs.stat(filePath);
              downloadedFiles.push({
                name: fileName,
                path: filePath,
                size: stats.size
              });
              
              successCount++;
              downloaded = true;
              console.log(`✅ Downloaded: ${fileName} (${stats.size} bytes)`);
              break;
              
            } catch (err) {
              lastError = err;
              console.log(`⚠️ Download method failed for ${fileName}: ${err.message}`);
              continue;
            }
          }
          
          if (!downloaded) {
            failCount++;
            console.error(`❌ Failed to download ${fileName}: ${lastError?.message}`);
            // Continue with other files instead of failing completely
          }
          
        } catch (error) {
          failCount++;
          console.error(`❌ Error processing ${fileName}:`, error.message);
        }
      }
      
      if (downloadedFiles.length < 30) {
        // Cleanup
        await fs.remove(sessionPath);
        // No need to delete session from progressService
        
        return reply.status(400).send({
          success: false,
          error: 'Insufficient successful downloads',
          message: `Only ${downloadedFiles.length} of ${files.length} images downloaded successfully. Need at least 30.`,
          stats: { success: successCount, failed: failCount, total: files.length }
        });
      }
      
      const totalSize = downloadedFiles.reduce((sum, f) => sum + f.size, 0);
      const downloadTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`✅ Downloaded ${successCount} files (${failCount} failed) in ${downloadTime}s`);
      console.log(`📊 Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
      
      // Update progress
      progressService.updateProgress(sessionId, {
        progress: 100,
        stage: 'Download complete, initializing processing...'
      });
      
      // Send response immediately
      reply.send({
        success: true,
        sessionId,
        data: {
          sessionId,
          imageCount: downloadedFiles.length,
          totalSize,
          downloadTime: parseFloat(downloadTime),
          stats: {
            success: successCount,
            failed: failCount,
            total: files.length
          },
          quality,
          formats,
          message: 'Images downloaded from Google Drive, processing started'
        }
      });
      
      // Start processing job asynchronously (don't await - let it run in background)
      uploadModule.processJob(sessionId, sessionPath, quality, formats, userId).catch(err => {
        console.error(`❌ Processing failed for session ${sessionId}:`, err);
      });
      
    } catch (error) {
      console.error('Google Drive upload error:', error);
      reply.status(500).send({
        success: false,
        error: 'Upload failed',
        message: error.message
      });
    }
  });
}

module.exports = uploadGDriveRoutes;
