const fs = require('fs').promises;
const path = require('path');

async function downloadRoutes(fastify, options) {
  
  // GET /api/download/:sessionId/:filename - Download generated model
  fastify.get('/download/:sessionId/:filename', async (request, reply) => {
    try {
      const { sessionId, filename } = request.params;
      const userId = request.headers['x-user-id'];
      if (!userId) {
        return reply.status(400).send({ error: 'Missing x-user-id header' });
      }
      
      // Import helper from upload routes
      const { getUserExportsDir } = require('./upload');
      const exportsDir = getUserExportsDir(userId, sessionId);
      const filePath = path.join(exportsDir, filename);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return reply.status(404).send({
          success: false,
          error: 'File not found',
          message: `File ${filename} does not exist for session ${sessionId}`
        });
      }
      
      // Get file stats
      const stats = await fs.stat(filePath);
      
      // Determine content type
      const ext = path.extname(filename).toLowerCase();
      const contentType = {
        '.usdz': 'model/vnd.usdz+zip',
        '.obj': 'text/plain',
        '.mtl': 'text/plain',
        '.stl': 'application/sla',
        '.ply': 'application/ply',
        '.zip': 'application/zip'
      }[ext] || 'application/octet-stream';
      
      // Send file
      return reply
        .header('Content-Type', contentType)
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .header('Content-Length', stats.size)
        .send(await fs.readFile(filePath));
        
    } catch (error) {
      fastify.log.error('Download error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Download failed',
        message: error.message
      });
    }
  });
  
  // GET /api/download/:sessionId - Download all files as ZIP (future enhancement)
  fastify.get('/download/:sessionId', async (request, reply) => {
    try {
      const { sessionId } = request.params;
      const userId = request.headers['x-user-id'];
      if (!userId) {
        return reply.status(400).send({ error: 'Missing x-user-id header' });
      }
      
      // Import helper from upload routes
      const { getUserExportsDir } = require('./upload');
      const sessionPath = getUserExportsDir(userId, sessionId);
      
      // Check if session exists
      try {
        await fs.access(sessionPath);
      } catch {
        return reply.status(404).send({
          success: false,
          error: 'Session not found',
          message: `Session ${sessionId} does not exist or has no exported files`
        });
      }
      
      // List available files
      const files = await fs.readdir(sessionPath);
      const fileList = [];
      
      for (const file of files) {
        const filePath = path.join(sessionPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          fileList.push({
            filename: file,
            size: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
            url: `/api/download/${sessionId}/${file}`
          });
        }
      }
      
      return {
        success: true,
        data: {
          sessionId,
          files: fileList,
          message: 'To download a specific file, use: GET /api/download/:sessionId/:filename'
        }
      };
      
    } catch (error) {
      fastify.log.error('List downloads error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to list downloads',
        message: error.message
      });
    }
  });
}

module.exports = downloadRoutes;
