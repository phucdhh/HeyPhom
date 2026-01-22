const fs = require('fs').promises;
const path = require('path');

/**
 * Job History Logger
 * Logs completed jobs to CSV for better time estimation
 */
class JobHistoryLogger {
  constructor() {
    this.historyFile = process.env.JOB_HISTORY_FILE || 
                       path.join(__dirname, '../../logs/job-history.csv');
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Create logs directory if not exists
      const dir = path.dirname(this.historyFile);
      await fs.mkdir(dir, { recursive: true });
      
      // Check if file exists, if not create with header
      try {
        await fs.access(this.historyFile);
      } catch {
        const header = 'timestamp,sessionId,imageCount,quality,formats,processingTimeMs,totalTimeMs,usdzSizeMB,objSizeMB,stlSizeMB,success\n';
        await fs.writeFile(this.historyFile, header);
      }
      
      this.initialized = true;
    } catch (err) {
      console.error('Failed to initialize job history logger:', err);
    }
  }

  /**
   * Log a completed job
   * @param {Object} job - Job object with all details
   */
  async logJob(job) {
    await this.initialize();
    
    try {
      const startTime = new Date(job.createdAt).getTime();
      const endTime = new Date(job.completedAt || new Date()).getTime();
      const totalTimeMs = endTime - startTime;
      
      // Calculate processing time (exclude upload time - assume first 30s is upload)
      const processingTimeMs = Math.max(0, totalTimeMs - 30000);
      
      // Extract file sizes
      const usdzSize = job.results?.usdz ? parseFloat(job.results.usdz.size) : 0;
      const objSize = job.results?.obj ? parseFloat(job.results.obj.size) : 0;
      const stlSize = job.results?.stl ? parseFloat(job.results.stl.size) : 0;
      
      const row = [
        new Date().toISOString(),
        job.sessionId,
        job.imageCount || 0,
        job.quality || 'high',
        (job.formats || []).join(';'),
        processingTimeMs,
        totalTimeMs,
        usdzSize.toFixed(2),
        objSize.toFixed(2),
        stlSize.toFixed(2),
        job.status === 'completed' ? 'true' : 'false'
      ].join(',') + '\n';
      
      await fs.appendFile(this.historyFile, row);
    } catch (err) {
      console.error('Failed to log job history:', err);
    }
  }

  /**
   * Get estimated time based on historical data
   * @param {number} imageCount - Number of images
   * @param {string} quality - Quality level
   * @returns {Promise<string>} Estimated time string
   */
  async getEstimatedTime(imageCount, quality) {
    await this.initialize();
    
    try {
      const content = await fs.readFile(this.historyFile, 'utf8');
      const lines = content.split('\n').slice(1).filter(l => l.trim());
      
      if (lines.length === 0) {
        // Fallback to old estimation
        return this.fallbackEstimate(imageCount, quality);
      }
      
      // Parse historical data
      const jobs = lines.map(line => {
        const [timestamp, sessionId, imgCount, qual, formats, procTime, totalTime] = line.split(',');
        return {
          imageCount: parseInt(imgCount),
          quality: qual,
          processingTimeMs: parseInt(procTime),
          totalTimeMs: parseInt(totalTime)
        };
      }).filter(j => j.quality === quality && j.imageCount > 0);
      
      if (jobs.length === 0) {
        return this.fallbackEstimate(imageCount, quality);
      }
      
      // Calculate average time per image
      const avgTimePerImage = jobs.reduce((sum, j) => 
        sum + (j.processingTimeMs / j.imageCount), 0
      ) / jobs.length;
      
      const estimatedMs = avgTimePerImage * imageCount;
      const minutes = Math.ceil(estimatedMs / 60000);
      
      if (minutes < 60) {
        return `${minutes} minutes`;
      } else {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
      }
      
    } catch (err) {
      console.error('Failed to get estimated time from history:', err);
      return this.fallbackEstimate(imageCount, quality);
    }
  }

  fallbackEstimate(imageCount, quality) {
    const baseTime = {
      low: 0.1,
      medium: 0.15,
      high: 0.2,
      ultra: 0.3
    }[quality] || 0.2;
    
    const minutes = Math.ceil(imageCount * baseTime);
    
    if (minutes < 60) {
      return `${minutes} minutes`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    }
  }

  /**
   * Get statistics from job history
   * @returns {Promise<Object>} Statistics object
   */
  async getStatistics() {
    await this.initialize();
    
    try {
      const content = await fs.readFile(this.historyFile, 'utf8');
      const lines = content.split('\n').slice(1).filter(l => l.trim());
      
      const stats = {
        totalJobs: lines.length,
        successfulJobs: 0,
        totalImages: 0,
        totalProcessingTimeMs: 0,
        byQuality: {}
      };
      
      lines.forEach(line => {
        const [, , imgCount, qual, , procTime, , , , , success] = line.split(',');
        
        if (success === 'true') stats.successfulJobs++;
        stats.totalImages += parseInt(imgCount) || 0;
        stats.totalProcessingTimeMs += parseInt(procTime) || 0;
        
        if (!stats.byQuality[qual]) {
          stats.byQuality[qual] = { count: 0, totalTime: 0 };
        }
        stats.byQuality[qual].count++;
        stats.byQuality[qual].totalTime += parseInt(procTime) || 0;
      });
      
      return stats;
    } catch (err) {
      console.error('Failed to get statistics:', err);
      return null;
    }
  }
}

module.exports = new JobHistoryLogger();
