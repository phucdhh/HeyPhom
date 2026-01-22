require('dotenv').config();
const fastify = require('fastify')({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
        colorize: true
      }
    }
  },
  bodyLimit: 3 * 1024 * 1024 * 1024, // 3GB body limit
  requestTimeout: 600000 // 10 minutes request timeout
});

const cors = require('@fastify/cors');
const contentParser = require('fastify-multer').contentParser;
const rateLimit = require('@fastify/rate-limit');
const staticFiles = require('@fastify/static');
const websocket = require('@fastify/websocket');
const path = require('path');
const fs = require('fs');

// Configuration
const PORT = parseInt(process.env.PORT) || 4444;
const HOST = process.env.HOST || '0.0.0.0';

// Ensure required directories exist
const usersDir = process.env.USERS_DIR || path.join(__dirname, '../../users');
const requiredDirs = [
  usersDir,
  path.join(usersDir, 'default/sessions'), // Default user for anonymous sessions
  process.env.LOG_DIR || path.join(__dirname, '../logs'),
  process.env.TEMP_DIR || path.join(__dirname, '../temp')
];

requiredDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Register plugins
fastify.register(cors, {
  origin: process.env.ALLOWED_ORIGINS || '*',
  credentials: true
});

// Register WebSocket support
fastify.register(websocket);

// Register fastify-multer content parser
fastify.register(contentParser);

// Note: Multer is configured in upload routes

if (process.env.RATE_LIMIT_ENABLED !== 'false') {
  fastify.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500,
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    skipOnError: false,
    allowList: (request) => {
      // Skip rate limit for job status polling and WebSocket connections
      return request.url.startsWith('/api/jobs/') || 
             request.url.startsWith('/ws/') ||
             request.url.startsWith('/health') ||
             request.url.startsWith('/api/gdrive/') ||  // Allow Google Drive operations
             request.url === '/api/info';
    },
    errorResponseBuilder: (request, context) => {
      return {
        success: false,
        error: 'Rate limit exceeded',
        message: `Too many requests. Please try again in ${Math.ceil(context.ttl / 1000)} seconds.`
      };
    }
  });
}

// Serve static files (for downloads)
fastify.register(staticFiles, {
  root: process.env.EXPORT_DIR || path.join(__dirname, '../exports'),
  prefix: '/downloads/',
  decorateReply: false
});

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  
  if (error.statusCode === 429) {
    return reply.status(429).send({
      success: false,
      error: 'Rate limit exceeded',
      message: error.message
    });
  }
  
  if (error.statusCode === 413) {
    return reply.status(413).send({
      success: false,
      error: 'Payload too large',
      message: 'File size exceeds maximum allowed limit'
    });
  }
  
  reply.status(error.statusCode || 500).send({
    success: false,
    error: error.name || 'Internal Server Error',
    message: error.message || 'An unexpected error occurred'
  });
});

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  const os = require('os');
  
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    system: {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
      freeMemory: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
      loadAverage: os.loadavg()
    }
  };
});

// API info endpoint
fastify.get('/api/info', async (request, reply) => {
  return {
    name: 'HeyPhom API',
    version: '1.0.0',
    description: 'Photogrammetry Processing API for Apple Silicon',
    documentation: '/docs',
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      pid: process.pid
    },
    limits: {
      maxImagesPerSession: parseInt(process.env.MAX_IMAGES_PER_SESSION) || 300,
      maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB) || 10,
      maxTotalSizeGB: parseInt(process.env.MAX_TOTAL_SIZE_GB) || 3,
      allowedFormats: (process.env.ALLOWED_FORMATS || 'jpg,jpeg,png,heic,heif').split(','),
      sessionTimeoutHours: parseInt(process.env.SESSION_TIMEOUT_HOURS) || 24
    },
    endpoints: [
      'GET  /health',
      'GET  /api/info',
      'POST /api/upload',
      'GET  /api/jobs',
      'GET  /api/jobs/:sessionId',
      'DELETE /api/jobs/:sessionId',
      'GET  /api/download/:sessionId/:filename'
    ]
  };
});

// Register routes
const uploadRoutes = require('./routes/upload');
const uploadGDriveRoutes = require('./routes/upload-gdrive');
const jobRoutes = require('./routes/jobs');
const downloadRoutes = require('./routes/download');
const websocketRoutes = require('./routes/websocket');
const githubDatasetRoutes = require('./routes/github-dataset');
const gdriveRoutes = require('./routes/gdrive');

fastify.register(uploadRoutes, { prefix: '/api' });
fastify.register(uploadGDriveRoutes, { prefix: '/api' });
fastify.register(jobRoutes, { prefix: '/api' });
fastify.register(downloadRoutes, { prefix: '/api' });
fastify.register(websocketRoutes);
fastify.register(githubDatasetRoutes, { prefix: '/api/github-dataset' });
fastify.register(gdriveRoutes, { prefix: '/api/gdrive' });

// 404 handler - serve frontend for non-API routes
fastify.setNotFoundHandler((request, reply) => {
  const requestPath = request.url;
  
  // API routes that don't exist - return 404 JSON
  if (requestPath.startsWith('/api') || requestPath.startsWith('/downloads') || requestPath.startsWith('/ws') || requestPath.startsWith('/health')) {
    return reply.status(404).send({
      success: false,
      error: 'Not Found',
      message: `Route ${request.method} ${requestPath} not found`,
      hint: 'Try GET /api/info for available endpoints'
    });
  }
  
  // Serve frontend static files
  const frontendPath = '/Users/mac/HeyPhom/frontend-web/dist';
  
  if (!fs.existsSync(frontendPath)) {
    console.error('Frontend path does not exist:', frontendPath);
    return reply.status(404).send({ success: false, error: 'Frontend not built' });
  }
  
  console.log('Serving from:', frontendPath, 'Request:', requestPath);
  
  // Serve static file or fallback to index.html for SPA routing
  let filePath = path.join(frontendPath, requestPath === '/' ? 'index.html' : requestPath);
  
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    filePath = path.join(frontendPath, 'index.html');
  }
  
  const content = fs.readFileSync(filePath);
  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };
  
  return reply.type(mimeTypes[ext] || 'application/octet-stream').send(content);
});

// Graceful shutdown
const closeGracefully = async (signal) => {
  fastify.log.info(`Received ${signal}, closing gracefully...`);
  
  try {
    await fastify.close();
    fastify.log.info('Server closed successfully');
    process.exit(0);
  } catch (err) {
    fastify.log.error('Error closing server:', err);
    process.exit(1);
  }
};

process.on('SIGINT', () => closeGracefully('SIGINT'));
process.on('SIGTERM', () => closeGracefully('SIGTERM'));

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    
    console.log('');
    console.log('🚀 HeyPhom API Server Started!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📍 Local:   http://localhost:${PORT}`);
    console.log(`🌐 Network: http://${HOST}:${PORT}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📚 API Info:  GET /api/info');
    console.log('❤️  Health:    GET /health');
    console.log('📤 Upload:    POST /api/upload');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

module.exports = fastify;
