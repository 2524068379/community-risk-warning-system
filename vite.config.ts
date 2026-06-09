import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (
            id.includes('antd') ||
            id.includes('@ant-design') ||
            id.includes('/rc-') ||
            id.includes('\\rc-') ||
            id.includes('@rc-component')
          ) {
            return 'antd-vendor';
          }

          if (id.includes('react-router')) {
            return 'router-vendor';
          }

          if (id.includes('axios') || id.includes('zustand')) {
            return 'app-vendor';
          }

          if (id.includes('mpegts.js')) {
            return 'video-vendor';
          }

          if (id.includes('@tensorflow')) {
            return 'tf-vendor';
          }

          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) {
            return 'charts-vendor';
          }

          return undefined;
        }
      }
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true
      }
    }
  }
});
