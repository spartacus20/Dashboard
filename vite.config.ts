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
    headers: corsHeaders
  }
});
