import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'maskable-icon-512x512.png'],
        manifest: {
          name: 'CareSync Healthcare Companion',
          short_name: 'CareSync',
          description: 'CareSync - Intelligent Healthcare & Daily Routine Companion for Patients and Caregivers',
          theme_color: '#0f766e',
          background_color: '#f8fafc',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            // 1. NEVER CACHE AUTHENTICATION ENDPOINTS (NetworkOnly)
            {
              urlPattern: /^\/api\/auth\/.*/i,
              handler: 'NetworkOnly',
            },
            // 2. CRITICAL CLINICAL & SAFETY ENDPOINTS (Prefer fresh server data, short 5m fallback cache)
            {
              urlPattern: /^\/api\/(medications|alerts|escalation|patient).*/i,
              handler: 'NetworkFirst',
              method: 'GET',
              options: {
                cacheName: 'critical-clinical-cache',
                networkTimeoutSeconds: 3,
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 5 * 60, // 5 minutes max stale fallback
                },
                cacheableResponse: {
                  statuses: [200],
                },
              },
            },
            // 3. HYDRATION & ACTIVITY TELEMETRY
            {
              urlPattern: /^\/api\/(hydration|activity).*/i,
              handler: 'NetworkFirst',
              method: 'GET',
              options: {
                cacheName: 'telemetry-cache',
                networkTimeoutSeconds: 3,
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 30 * 60, // 30 minutes max stale fallback
                },
                cacheableResponse: {
                  statuses: [200],
                },
              },
            },
            // 4. UNSPLASH AVATAR IMAGES
            {
              urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'unsplash-images',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
                },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
