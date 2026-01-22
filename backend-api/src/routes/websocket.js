const progressService = require('../services/progressService');

async function websocketRoutes(fastify, options) {
  // WebSocket endpoint for real-time progress updates
  fastify.get('/ws/:sessionId', { websocket: true }, (connection, req) => {
    const { sessionId } = req.params;
    const ws = connection.socket || connection; // v10 compatibility
    
    fastify.log.info(`WebSocket client connected for session: ${sessionId}`);
    
    // Register client
    progressService.registerClient(sessionId, ws);
    
    // Send initial connection confirmation
    ws.send(JSON.stringify({
      type: 'connected',
      sessionId,
      message: 'Connected to progress updates'
    }));
    
    // Handle client messages (optional ping/pong)
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (err) {
        fastify.log.error('WebSocket message error:', err);
      }
    });
    
    ws.on('error', (err) => {
      fastify.log.error('WebSocket error:', err);
    });
  });
}

module.exports = websocketRoutes;
