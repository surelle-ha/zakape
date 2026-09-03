import tailwindcss from '@tailwindcss/vite'

const baseURL = process.env.NUXT_APP_BASE_URL || '/'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  devtools: { enabled: false },
  modules: ['@nuxt/eslint'],
  css: [
    '@fontsource-variable/space-grotesk/index.css',
    '@fontsource-variable/jetbrains-mono/index.css',
    '~/assets/css/main.css',
  ],
  vite: { plugins: [tailwindcss() as never] },
  nitro: { preset: 'static' },
  app: {
    baseURL,
    head: {
      title: 'Zakape — Open-source pixel workbench',
      htmlAttrs: { lang: 'en' },
      meta: [
        {
          name: 'description',
          content:
            'A serious open-source sprite editor with an optional bring-your-own-model art assistant.',
        },
        { name: 'theme-color', content: '#f5f2fb' },
        { property: 'og:title', content: 'Zakape — Open-source pixel workbench' },
        { property: 'og:description', content: 'Draw every pixel. Delegate the fussy bits.' },
        { property: 'og:type', content: 'website' },
      ],
      link: [{ rel: 'icon', href: `${baseURL}icon.png`, type: 'image/png' }],
    },
  },
})
