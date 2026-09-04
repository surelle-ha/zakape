import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

const studioPackage = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

export default defineNuxtConfig({
  compatibilityDate: '2026-08-31',
  telemetry: false,
  ssr: false,
  devtools: { enabled: false },
  modules: ['@nuxt/eslint'],
  css: [
    '@fontsource-variable/bricolage-grotesque/index.css',
    '@fontsource-variable/handjet/full.css',
    '@fontsource-variable/azeret-mono/index.css',
    '~/assets/css/main.css',
  ],
  runtimeConfig: {
    public: {
      appVersion: studioPackage.version,
    },
  },
  vite: {
    plugins: [tailwindcss() as never],
  },
  app: {
    head: {
      title: 'Zakape Studio: Pixel workbench',
      meta: [
        { name: 'description', content: 'An open-source pixel art and animation workbench.' },
        { name: 'theme-color', content: '#0f0d17' },
        {
          name: 'viewport',
          content:
            'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
        },
      ],
      link: [{ rel: 'icon', href: '/icon.png', type: 'image/png' }],
    },
  },
})
