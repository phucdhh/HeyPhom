const net = require('net');
const path = require('path');

/**
 * Client to communicate with HeyPhom Photogrammetry Daemon
 * Uses Unix domain socket for fast IPC
 */
class PhotogrammetryDaemonClient {
  constructor(socketPath = '/tmp/heyphom-daemon.sock') {
    this.socketPath = socketPath;
  }

  /**
   * Submit a job to the daemon
   * @param {Object} job - Job configuration
   * @param {Function} onProgress - Progress callback (progress, stage)
   * @returns {Promise} - Resolves with job results
   */
  async submitJob(job, onProgress) {
    return new Promise((resolve, reject) => {
      const client = net.createConnection(this.socketPath);
      
      client.on('connect', () => {
        console.log('✅ Connected to photogrammetry daemon');
        
        // Send job request
        const request = JSON.stringify({
          sessionId: job.sessionId,
          inputPath: job.inputPath,
          outputPath: job.outputPath,
          quality: job.quality,
          formats: job.formats || ['usdz']
        });
        
        client.write(request);
      });
      
      let buffer = '';
      
      client.on('data', (data) => {
        buffer += data.toString();
        
        // Try to parse messages (newline delimited JSON)
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const message = JSON.parse(line);
            
            if (message.progress !== undefined) {
              // Progress update
              if (onProgress) {
                onProgress(message.progress, message.stage);
              }
            } else if (message.status === 'completed') {
              // Job completed
              client.end();
              resolve(message.results);
            } else if (message.status === 'failed') {
              // Job failed
              client.end();
              reject(new Error(message.error || 'Job failed'));
            }
          } catch (err) {
            console.error('Failed to parse daemon message:', err.message);
          }
        }
      });
      
      client.on('error', (err) => {
        reject(new Error(`Daemon connection error: ${err.message}`));
      });
      
      client.on('close', () => {
        console.log('🔌 Disconnected from daemon');
      });
    });
  }

  /**
   * Check if daemon is running
   * @returns {Promise<boolean>}
   */
  async isRunning() {
    return new Promise((resolve) => {
      const client = net.createConnection(this.socketPath);
      
      client.on('connect', () => {
        client.end();
        resolve(true);
      });
      
      client.on('error', () => {
        resolve(false);
      });
    });
  }
}

module.exports = PhotogrammetryDaemonClient;
