const fs = require('fs').promises;
const path = require('path');

// Helper to scan all user sessions from new directory structure
async function getAllSessionsFromUsers() {
  const usersDir = process.env.USERS_DIR || path.join(__dirname, '../../../users');
  const sessions = [];
  
  try {
    // Check if users directory exists
    try {
      await fs.access(usersDir);
    } catch {
      return sessions;
    }
    
    // Get all user directories
    const users = await fs.readdir(usersDir);
    
    for (const userId of users) {
      const userSessionsDir = path.join(usersDir, userId, 'sessions');
      
      try {
        await fs.access(userSessionsDir);
      } catch {
        continue;
      }
      
      // Get all session directories
      const sessionDirs = await fs.readdir(userSessionsDir);
      
      for (const sessionId of sessionDirs) {
        const sessionFile = path.join(userSessionsDir, sessionId, 'session.json');
        
        try {
          const content = await fs.readFile(sessionFile, 'utf-8');
          const job = JSON.parse(content);
          sessions.push({ ...job, userId });
        } catch (err) {
          // Skip invalid sessions
          continue;
        }
      }
    }
  } catch (err) {
    console.error('Error scanning user sessions:', err);
  }
  
  return sessions;
}

// Import jobs from upload route (in production, use Redis or database)
// For now, we'll read from session files
async function jobRoutes(fastify, options) {
  
  // GET /api/jobs - List all jobs
  fastify.get('/jobs', async (request, reply) => {
    try {
      const { page = 1, limit = 20, status } = request.query;
      
      // Get all sessions from new user structure
      let jobs = await getAllSessionsFromUsers();
      
      // Filter by status if provided
      if (status) {
        jobs = jobs.filter(job => job.status === status);
      }
      
      // Format for response
      jobs = jobs.map(job => ({
        sessionId: job.sessionId,
        userId: job.userId,
        status: job.status,
        progress: job.progress,
        imageCount: job.imageCount,
        quality: job.quality,
        createdAt: job.createdAt,
        completedAt: job.completedAt
      }));
      
      jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedJobs = jobs.slice(startIndex, endIndex);
      
      return {
        success: true,
        data: {
          jobs: paginatedJobs,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: jobs.length,
            pages: Math.ceil(jobs.length / limit)
          }
        }
      };
      
    } catch (error) {
      fastify.log.error('List jobs error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to list jobs',
        message: error.message
      });
    }
  });
  
  // GET /api/jobs/:sessionId - Get job status
  fastify.get('/jobs/:sessionId', async (request, reply) => {
    try {
      const { sessionId } = request.params;
      const { getUserSessionDir, jobs } = require('./upload');
      const userId = request.headers['x-user-id'];
      if (!userId) {
        return reply.status(400).send({
          success: false,
          message: 'Missing x-user-id header'
        });
      }
      
      // PRIORITY: Read from in-memory jobs Map first (always fresh!)
      let job = jobs.get(sessionId);
      
      // Fallback: Read from file if not in memory (e.g., after restart)
      if (!job) {
        const sessionDir = getUserSessionDir(userId, sessionId);
        const sessionFile = path.join(sessionDir, 'session.json');
        
        fastify.log.info(`🔍 Checking session ${sessionId} for user ${userId}: ${sessionFile}`);
        
        try {
          await fs.access(sessionFile);
        } catch {
          return reply.status(404).send({
            success: false,
            error: 'Session not found',
            message: `Session ${sessionId} does not exist`
          });
        }
        
        const content = await fs.readFile(sessionFile, 'utf-8');
        job = JSON.parse(content);
      }
      
      let response = {
        sessionId: job.sessionId,
        status: job.status,
        progress: job.progress,
        imageCount: job.imageCount,
        quality: job.quality,
        formats: job.formats,
        createdAt: job.createdAt
      };
      
      if (job.status === 'processing') {
        response.startedAt = job.startedAt;
        response.stage = job.currentStage || getStage(job.progress);
      }
      
      if (job.status === 'completed') {
        response.completedAt = job.completedAt;
        response.processingTime = getProcessingTime(job.startedAt, job.completedAt);
        response.results = job.results;
        response.expiresAt = getExpirationDate(job.completedAt);
        response.stage = job.currentStage || 'Complete'; // Include final stage
      }
      
      if (job.status === 'failed') {
        response.error = job.error;
        response.failedAt = job.failedAt;
      }
      
      return {
        success: true,
        data: response
      };
      
    } catch (error) {
      fastify.log.error('Get job error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get job status',
        message: error.message
      });
    }
  });
  
  // DELETE /api/jobs/:sessionId - Delete session and files completely
  fastify.delete('/jobs/:sessionId', async (request, reply) => {
    try {
      const { sessionId } = request.params;
      const sessionDir = process.env.SESSION_DIR || path.join(__dirname, '../../sessions');
      const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
      const exportDir = process.env.EXPORT_DIR || path.join(__dirname, '../../exports');
      
      const sessionFile = path.join(sessionDir, `${sessionId}.json`);
      const uploadPath = path.join(uploadDir, sessionId);
      const exportPath = path.join(exportDir, sessionId);
      
      let deletedFiles = 0;
      let freedSpace = 0;
      
      // Count files and size before deletion
      const countFiles = async (dir) => {
        try {
          const files = await fs.readdir(dir);
          for (const file of files) {
            const filePath = path.join(dir, file);
            const stats = await fs.stat(filePath);
            if (stats.isFile()) {
              deletedFiles++;
              freedSpace += stats.size;
            } else if (stats.isDirectory()) {
              await countFiles(filePath);
            }
          }
        } catch {}
      };
      
      await countFiles(uploadPath);
      await countFiles(exportPath);
      
      // Delete directories
      await fs.rm(uploadPath, { recursive: true, force: true });
      await fs.rm(exportPath, { recursive: true, force: true });
      await fs.rm(sessionFile, { force: true });
      
      return {
        success: true,
        message: 'Session deleted successfully',
        data: {
          sessionId,
          deletedFiles,
          freedSpace: `${(freedSpace / 1024 / 1024).toFixed(2)} MB`
        }
      };
      
    } catch (error) {
      fastify.log.error('Delete session error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete session',
        message: error.message
      });
    }
  });
  
  // POST /api/jobs/:sessionId/process - Manually start processing
  fastify.post('/jobs/:sessionId/process', async (request, reply) => {
    try {
      const { sessionId } = request.params;
      const sessionDir = process.env.SESSION_DIR || path.join(__dirname, '../../sessions');
      const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
      const sessionFile = path.join(sessionDir, `${sessionId}.json`);
      
      // Check if session exists
      try {
        await fs.access(sessionFile);
      } catch {
        return reply.status(404).send({
          success: false,
          error: 'Session not found',
          message: `Session ${sessionId} does not exist`
        });
      }
      
      // Read session
      const content = await fs.readFile(sessionFile, 'utf-8');
      const job = JSON.parse(content);
      
      // Check if already processing or completed
      if (job.status === 'processing') {
        return reply.status(400).send({
          success: false,
          error: 'Job already processing',
          message: `Job ${sessionId} is already being processed`
        });
      }
      
      if (job.status === 'completed') {
        return reply.status(400).send({
          success: false,
          error: 'Job already completed',
          message: `Job ${sessionId} has already been completed`
        });
      }
      
      // Import processJob from upload route
      const { processJob, loadJobIntoMemory } = require('./upload');
      const uploadPath = path.join(uploadDir, sessionId);
      
      // Load job into memory Map (important for backend restart)
      loadJobIntoMemory(sessionId, job);
      
      // Start processing (run async without blocking response)
      processJob(sessionId, uploadPath, job.quality, job.formats).catch(err => {
        fastify.log.error(`Job ${sessionId} failed:`, err);
      });
      
      return {
        success: true,
        message: `Processing started for job ${sessionId}`,
        data: {
          sessionId,
          status: 'processing'
        }
      };
      
    } catch (error) {
      fastify.log.error('Start processing error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to start processing',
        message: error.message
      });
    }
  });
}

// Helper functions
function getProcessingTime(startedAt, completedAt) {
  if (!startedAt || !completedAt) return null;
  
  const start = new Date(startedAt);
  const end = new Date(completedAt);
  const diff = Math.floor((end - start) / 1000); // seconds
  
  if (diff < 60) return `${diff} seconds`;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes`;
  
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function getExpirationDate(completedAt) {
  if (!completedAt) return null;
  
  const completed = new Date(completedAt);
  const expiration = new Date(completed);
  expiration.setDate(expiration.getDate() + 7); // Files expire after 7 days
  
  return expiration.toISOString();
}

function getStage(progress) {
  if (progress < 10) return 'Initializing';
  if (progress < 30) return 'Feature Detection';
  if (progress < 60) return 'Point Cloud Generation';
  if (progress < 90) return 'Mesh Reconstruction';
  return 'Finalizing';
}

module.exports = jobRoutes;
