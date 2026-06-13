import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Room Service REST
      '/api/rooms': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
      // TURN credential endpoint
      '/api/turn': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
      // Chat Service REST
      '/api/chat': {
        target: 'http://localhost:4002',
        changeOrigin: true,
      },
      // Chat Service Socket.io WebSocket
      '/chat': {
        target: 'http://localhost:4002',
        changeOrigin: true,
        ws: true,
      },
      // Signaling Socket.io WebSocket
      '/socket.io': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Code split TF.js chunks so blur model is lazy-loaded
    rollupOptions: {
      output: {
        manualChunks: {
          'tfjs-core':    ['@tensorflow/tfjs-core'],
          'tfjs-webgl':   ['@tensorflow/tfjs-backend-webgl'],
          'body-seg':     ['@tensorflow-models/body-segmentation'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'socket-vendor': ['socket.io-client'],
        },
      },
    },
  },
});
