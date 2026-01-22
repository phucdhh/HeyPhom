const fs = require('fs').promises;
const path = require('path');

/**
 * Load jobs from session files on server startup
 * This recovers job state after server restart
 */
async function loadJobsFromDisk(sessionDir) {
  const jobs = new Map();
  
  try {
    const files = await fs.readdir(sessionDir);
    const sessionFiles = files.filter(f => f.endsWith('.json'));
    
    for (const file of sessionFiles) {
      try {
        const filePath = path.join(sessionDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const job = JSON.parse(content);
        
        // Mark stuck processing jobs as failed
        if (job.status === 'processing') {
          job.status = 'failed';
          job.error = 'Server restarted during processing';
          job.failedAt = new Date().toISOString();
          
          // Save updated status
          await fs.writeFile(filePath, JSON.stringify(job, null, 2));
        }
        
        jobs.set(job.sessionId, job);
        console.log(`Loaded job: ${job.sessionId} (${job.status})`);
      } catch (err) {
        console.error(`Failed to load ${file}:`, err.message);
      }
    }
    
    console.log(`✅ Loaded ${jobs.size} jobs from disk`);
    return jobs;
  } catch (err) {
    console.error('Failed to load jobs from disk:', err.message);
    return jobs;
  }
}

/**
 * Check if a processing job is actually running
 */
async function isJobProcessRunning(sessionId) {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Check if heyphom-cli is running for this session
    const { stdout } = await execAsync(`ps aux | grep -E "heyphom.*${sessionId}" | grep -v grep || true`);
    return stdout.trim().length > 0;
  } catch (err) {
    return false;
  }
}

/**
 * Cleanup orphaned jobs (marked as processing but no process running)
 */
async function cleanupOrphanedJobs(jobs, sessionDir) {
  let cleaned = 0;
  
  for (const [sessionId, job] of jobs.entries()) {
    if (job.status === 'processing') {
      const isRunning = await isJobProcessRunning(sessionId);
      
      if (!isRunning) {
        console.log(`⚠️  Cleaning up orphaned job: ${sessionId}`);
        
        job.status = 'failed';
        job.error = 'Process terminated unexpectedly';
        job.failedAt = new Date().toISOString();
        jobs.set(sessionId, job);
        
        // Save to disk
        const sessionFile = path.join(sessionDir, `${sessionId}.json`);
        await fs.writeFile(sessionFile, JSON.stringify(job, null, 2));
        
        cleaned++;
      }
    }
  }
  
  if (cleaned > 0) {
    console.log(`✅ Cleaned up ${cleaned} orphaned job(s)`);
  }
  
  return cleaned;
}

/**
 * Periodic check for stuck jobs
 */
function startJobHealthCheck(jobs, sessionDir, intervalMs = 60000) {
  const checkHealth = async () => {
    try {
      await cleanupOrphanedJobs(jobs, sessionDir);
    } catch (err) {
      console.error('Job health check failed:', err);
    }
  };
  
  // Run initial check after 5 seconds
  setTimeout(checkHealth, 5000);
  
  // Then run periodically
  const interval = setInterval(checkHealth, intervalMs);
  
  return interval;
}

module.exports = {
  loadJobsFromDisk,
  isJobProcessRunning,
  cleanupOrphanedJobs,
  startJobHealthCheck
};
