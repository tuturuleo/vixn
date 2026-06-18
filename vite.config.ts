/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import { resolve } from 'node:path'
import { copyFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { VitePWA } from 'vite-plugin-pwa'

const BASE = '/vixn/'

/**
 * GitHub Pages has no server-side SPA fallback, so we ship a 404.html that is a
 * byte-for-byte copy of index.html. Pages serves it for unknown deep links and
 * the client router takes over. See README for the rationale.
 */
function spaFallback(): Plugin {
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    closeBundle() {
      const out = resolve(__dirname, 'dist')
      copyFileSync(resolve(out, 'index.html'), resolve(out, '404.html'))
    },
  }
}

export default defineConfig({
  base: BASE,
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'vixn — workout tracker',
        short_name: 'vixn',
        description: 'Offline-first workout tracking',
        theme_color: '#0b0b0f',
        background_color: '#0b0b0f',
        display: 'standalone',
        orientation: 'portrait',
        scope: BASE,
        start_url: BASE,
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
        navigateFallback: `${BASE}index.html`,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
    spaFallback(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
