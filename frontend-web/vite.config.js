import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4445,
    host: '0.0.0.0',  // Listen on all interfaces (IPv4 + IPv6)
    strictPort: true,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'heyphom.truyenthong.edu.vn'
    ],
    proxy: {
      '/api': {
        target: 'http://192.168.1.100:4444',
        changeOrigin: true,
        timeout: 0, // No timeout
        proxyTimeout: 0 // No proxy timeout
      },
      '/ws': {
        target: 'ws://192.168.1.100:4444',
        changeOrigin: true,
        ws: true
      },
      '/downloads': {
        target: 'http://192.168.1.100:4444',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three']
        }
      }
    }
  },
  resolve: {
    dedupe: ['three']
  },
  optimizeDeps: {
    include: ['three']
  }
})
