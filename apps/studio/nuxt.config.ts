import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-08-31',
  ssr: false,
  devtools: { enabled: false },
  modules: ['@nuxt/eslint'],
  css: [
    '@fontsource-variable/space-grotesk/index.css',
    '@fontsource-variable/jetbrains-mono/index.css',
    '~/assets/css/main.css',
  ],
  vite: {
    plugins: [tailwindcss() as never],
  },
  app: {
    head: {
      title: 'Zakape — Pixel workbench',
      meta: [
        { name: 'description', content: 'An open-source pixel art and animation workbench.' },
        { name: 'theme-color', content: '#111411' },
      ],
      link: [{ rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' }],
    },
  },
})
