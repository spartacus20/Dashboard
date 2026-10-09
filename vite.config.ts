import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { corsHeaders } from './src/lib/cors';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: corsHeaders,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  // Configuración para `vite preview` / entorno de previsualización
  // Necesaria para permitir el host devfront.iacreatorhub.com
  preview: {
    allowedHosts: ['devfront.iacreatorhub.com'],
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
      },
      output: {
        manualChunks: {
          // Separar React core en su propio chunk (cambia raramente → excelente cache)
          'vendor-react': ['react', 'react-dom'],
          // Separar Recharts (muy pesado, ~400KB) en su propio chunk
          'vendor-recharts': ['recharts'],
          // Separar íconos de Lucide
          'vendor-icons': ['lucide-react'],
        },
      },
    },
    outDir: 'dist',
    assetsDir: 'assets',
    copyPublicDir: true
  }
});
