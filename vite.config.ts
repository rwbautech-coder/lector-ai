import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import nodeResolve from '@rollup/plugin-node-resolve';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg', 'piper.wasm'],
        workbox: {
          maximumFileSizeToCacheInBytes: 30000000, // 30 MB to cache WASM files
          globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}']
        },
        manifest: {
          name: 'Lector AI',
          short_name: 'LectorAI',
          description: 'AI-powered PDF Reader and TTS',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    base: './', // Crucial for GitHub Pages to work in a subdirectory
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: true, // Enable sourcemaps for better debugging
      minify: false,   // Disable minification to see real variable names
      target: 'esnext', // Support for BigInt and other modern features
    },
    define: {
      // This exposes process.env.API_KEY to the client-side code
      // Note: In production (GitHub Actions), this will be replaced by the secret value
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY)
    }
  };
});