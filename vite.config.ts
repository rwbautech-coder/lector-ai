import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    base: './', // Crucial for GitHub Pages to work in a subdirectory
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false
    },
    define: {
      // This exposes process.env.API_KEY to the client-side code
      // Note: In production (GitHub Actions), this will be replaced by the secret value
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  };
});