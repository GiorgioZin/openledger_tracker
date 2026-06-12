import { defineConfig } from 'vite'
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Static hosts like GitHub Pages have no SPA fallback: reloading a deep client
// route (e.g. /openledger_tracker/weight) 404s because no such file exists.
// Publishing the app shell as 404.html makes the host serve it for any unknown
// path, so the app boots and React Router renders the right route on reload.
function spa404Fallback() {
  return {
    name: 'spa-404-fallback',
    closeBundle() {
      const index = resolve('dist/index.html')
      if (existsSync(index)) copyFileSync(index, resolve('dist/404.html'))
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Ledger',
        short_name: 'Ledger',
        description: 'Personal macro, weight & workout tracker',
        theme_color: '#0b1120',
        background_color: '#0b1120',
        display: 'standalone',
        orientation: 'portrait',
        // Relative so the installed PWA opens under the deploy base
        // (e.g. /openledger_tracker/) rather than the origin root.
        start_url: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
    spa404Fallback(),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['src/test/setup.js'],
    // Force demo mode in tests so the suite never depends on a real backend,
    // regardless of any .env present locally.
    env: { VITE_DEMO: 'true' },
  },
})
