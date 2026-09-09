import tailwindcss from '@tailwindcss/vite'

const baseURL = process.env.NUXT_APP_BASE_URL || '/'
const siteURL = process.env.NUXT_PUBLIC_SITE_URL || 'https://zakape.0110harold.workers.dev'
const title = 'Zakape — Open-source pixel art and sprite animation studio'
const description =
  'Create pixel art, animated sprites, sprite sheets, and game-ready assets in a focused open-source desktop studio with optional local AI assistance.'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  devtools: { enabled: false },
  modules: ['@nuxt/eslint'],
  css: [
    '@fontsource-variable/bricolage-grotesque/index.css',
    '@fontsource-variable/handjet/full.css',
    '@fontsource-variable/azeret-mono/index.css',
    '~/assets/css/main.css',
  ],
  vite: { plugins: [tailwindcss() as never] },
  nitro: { preset: 'static' },
  app: {
    baseURL,
    head: {
      title,
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'description', content: description },
        { name: 'application-name', content: 'Zakape' },
        { name: 'author', content: 'surelle-ha' },
        { name: 'robots', content: 'index, follow, max-image-preview:large' },
        { name: 'theme-color', content: '#090b0f' },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Zakape' },
        { property: 'og:image', content: `${siteURL}/zakape-social-banner.png` },
        { property: 'og:image:width', content: '2048' },
        { property: 'og:image:height', content: '768' },
        { property: 'og:image:alt', content: 'Zakape pixel art studio' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
        { name: 'twitter:image', content: `${siteURL}/zakape-social-banner.png` },
      ],
      link: [{ rel: 'icon', href: `${baseURL}icon.png`, type: 'image/png' }],
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Zakape',
            applicationCategory: 'GraphicsApplication',
            operatingSystem: 'Windows, macOS, Linux, Android',
            description,
            url: siteURL,
            image: `${siteURL}/zakape-social-banner.png`,
            downloadUrl: 'https://github.com/surelle-ha/zakape/releases',
            softwareHelp: 'https://github.com/surelle-ha/zakape',
            author: { '@type': 'Person', name: 'surelle-ha' },
            license: 'https://opensource.org/license/mit',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          }),
        },
      ],
    },
  },
})
