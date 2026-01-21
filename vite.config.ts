import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { corsHeaders } from './src/lib/cors';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
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
    },
    outDir: 'dist',
    assetsDir: 'assets',
    copyPublicDir: true
  }
});
