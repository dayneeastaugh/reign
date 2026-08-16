import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// Overridable so the same build can be served from a different path.
const envBase = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  ?.env?.REIGN_BASE;

export default defineConfig({
  // Served from a GitHub Pages project path. Relative start_url/scope below
  // resolve against this, so the service worker registers under it correctly.
  base: envBase ?? '/reign/',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/icon-180.png'],
      manifest: {
        name: 'Reign',
        short_name: 'Reign',
        description: 'A quiet logic puzzle of queens, regions and quests.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f1e7',
        theme_color: '#f6f1e7',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The app shell is precached so play works fully offline...
        globPatterns: ['**/*.{js,css,html,png,svg,woff,woff2}'],
        // ...but quests are deliberately excluded: precaching them would tie
        // content to app releases, which is exactly what the content channel
        // exists to avoid. They are cached at runtime instead.
        globIgnores: ['content/**'],
        navigateFallbackDenylist: [/^\/.*\/content\//],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/content/'),
            // Fresh when online, still playable when not.
            handler: 'NetworkFirst',
            options: {
              cacheName: 'reign-content',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
