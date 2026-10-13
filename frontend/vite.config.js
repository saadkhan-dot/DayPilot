import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const frontendRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, frontendRoot, '');
  const backendUrl = env.VITE_API_URL || 'http://localhost:3000';

  return {
    root: frontendRoot,
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: backendUrl, changeOrigin: true }
      }
    },
    build: {
      outDir: resolve(frontendRoot, '../dist'),
      emptyOutDir: true
    }
  };
});
