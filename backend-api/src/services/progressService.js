// Progress tracking service with WebSocket support
const EventEmitter = require('events');

class ProgressService extends EventEmitter {
  constructor() {
    super();
    this.clients = new Map(); // sessionId -> Set of WebSocket connections
    this.lastUpdate = new Map(); // sessionId -> {progress, stage, timestamp}
  }

  // Register a WebSocket client for a session
  registerClient(sessionId, ws) {
    if (!this.clients.has(sessionId)) {
      this.clients.set(sessionId, new Set());
    }
    this.clients.get(sessionId).add(ws);

    // Clean up on close
    ws.on('close', () => {
      const clients = this.clients.get(sessionId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          this.clients.delete(sessionId);
        }
      }
    });
  }

  // Broadcast progress update to all clients watching this session
  updateProgress(sessionId, progressValue) {
    // Normalize data: if number, convert to object
    const data = typeof progressValue === 'number' 
      ? { progress: progressValue }
      : progressValue;
    
    // Throttle: skip if same as last update (within 100ms and no significant change)
    const lastUpdate = this.lastUpdate.get(sessionId);
    const now = Date.now();
    
    if (lastUpdate) {
      const timeDiff = now - lastUpdate.timestamp;
      const progressDiff = Math.abs((data.progress || 0) - (lastUpdate.progress || 0));
      const stageSame = data.stage === lastUpdate.stage;
      
      // CRITICAL: Prevent progress from going backwards
      // If new progress < last progress, ignore the update (unless it's a stage change)
      if (data.progress !== undefined && lastUpdate.progress !== undefined) {
        if (data.progress < lastUpdate.progress && stageSame) {
          console.warn(`⚠️ [${sessionId}] Ignoring backward progress: ${lastUpdate.progress}% -> ${data.progress}%`);
          return;
        }
      }
      
      // Skip if: less than 100ms, progress change < 1%, and same stage
      if (timeDiff < 100 && progressDiff < 1 && stageSame) {
        return;
      }
    }
    
    // Update cache
    this.lastUpdate.set(sessionId, {
      progress: data.progress,
      stage: data.stage,
      timestamp: now
    });
    
    const clients = this.clients.get(sessionId);
    if (clients) {
      const message = JSON.stringify({
        type: 'progress',
        sessionId,
        progress: data.progress,
        stage: data.stage,
        timestamp: new Date().toISOString()
      });
      
      clients.forEach(ws => {
        if (ws.readyState === 1) { // OPEN
          ws.send(message);
        }
      });
    }
    
    // Emit event for other listeners
    this.emit('progress', { sessionId, ...data });
  }

  // Update job status
  updateStatus(sessionId, status, additionalData = {}) {
    this.updateProgress(sessionId, {
      status,
      timestamp: new Date().toISOString(),
      ...additionalData
    });
  }

  // Update stage
  updateStage(sessionId, stage) {
    // Throttle: skip if same as last stage
    const lastUpdate = this.lastUpdate.get(sessionId);
    if (lastUpdate && lastUpdate.stage === stage) {
      return;
    }
    
    // Update cache
    this.lastUpdate.set(sessionId, {
      ...lastUpdate,
      stage,
      timestamp: Date.now()
    });
    
    const clients = this.clients.get(sessionId);
    if (clients) {
      const message = JSON.stringify({
        type: 'stage',
        sessionId,
        stage,
        timestamp: new Date().toISOString()
      });
      
      clients.forEach(ws => {
        if (ws.readyState === 1) { // OPEN
          ws.send(message);
        }
      });
    }
  }

  // Complete job
  complete(sessionId, results) {
    // Clear throttle cache
    this.lastUpdate.delete(sessionId);
    
    const clients = this.clients.get(sessionId);
    if (clients) {
      const message = JSON.stringify({
        type: 'complete',
        sessionId,
        results,
        timestamp: new Date().toISOString()
      });
      
      clients.forEach(ws => {
        if (ws.readyState === 1) { // OPEN
          ws.send(message);
        }
      });
    }
    
    // Clean up after delay
    setTimeout(() => {
      const clients = this.clients.get(sessionId);
      if (clients) {
        clients.forEach(ws => ws.close());
        this.clients.delete(sessionId);
      }
    }, 5000);
  }

  // Fail job
  fail(sessionId, error) {
    this.updateProgress(sessionId, {
      status: 'failed',
      error: error.message || error,
      failedAt: new Date().toISOString()
    });
  }
}

// Singleton instance
const progressService = new ProgressService();

module.exports = progressService;
