import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/main',
      lib: {
        entry: resolve('electron/main.ts'),
        formats: ['cjs'],
        fileName: () => 'index.js'
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload',
      lib: {
        entry: resolve('electron/preload.ts'),
        formats: ['cjs'],
        fileName: () => 'index.js'
      },
      rollupOptions: {
        output: {
          entryFileNames: 'index.js'
        }
      }
    }
  },
  renderer: {
    root: '.',
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve('src')
      }
    },
    build: {
      outDir: 'dist/renderer',
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        input: resolve('index.html'),
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined
            }
            if (
              id.includes('antd') ||
              id.includes('@ant-design') ||
              id.includes('/rc-') ||
              id.includes('\\rc-') ||
              id.includes('@rc-component')
            ) {
              return 'antd-vendor'
            }
            if (id.includes('react-router')) {
              return 'router-vendor'
            }
            if (id.includes('axios') || id.includes('zustand')) {
              return 'app-vendor'
            }
            if (id.includes('mpegts.js')) {
              return 'video-vendor'
            }
            return undefined
          }
        }
      }
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8787',
          changeOrigin: true
        }
      }
    }
  }
})
