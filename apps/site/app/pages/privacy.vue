<script setup lang="ts">
import { Database, ExternalLink, HardDrive, ShieldCheck, UserRound } from '@lucide/vue'

const siteURL = 'https://zakape.0110harold.workers.dev/privacy'

useSeoMeta({
  title: 'Privacy — Zakape Pixel Studio',
  description:
    'How Zakape handles artwork, local files, model connections, optional Google sign-in, and website requests.',
  ogTitle: 'Privacy — Zakape Pixel Studio',
  ogDescription: 'Clear, plain-language details about data handling in Zakape.',
  ogUrl: siteURL,
})
useHead({ link: [{ rel: 'canonical', href: siteURL }] })

const sections = [
  {
    icon: HardDrive,
    title: 'Your artwork stays yours',
    copy: 'Projects, preferences, assistant sessions, previews, and recent-work records are stored on your device. Zakape does not upload artwork to a Zakape-operated cloud service.',
  },
  {
    icon: Database,
    title: 'Model connections are direct',
    copy: 'If you enable the Art Assistant, requests go directly from your device to the provider or local Ollama endpoint you choose. The selected provider may process prompts and images under its own privacy terms. API keys are session-only.',
  },
  {
    icon: UserRound,
    title: 'Sign-in is optional',
    copy: 'Desktop users may choose Google sign-in. Zakape uses the returned basic profile identity to show the signed-in account. Guest access remains available, and mobile builds do not use Google sign-in today.',
  },
  {
    icon: ShieldCheck,
    title: 'Website delivery',
    copy: 'This website is served by Cloudflare, which may process standard request information such as IP address, device information, and security signals to deliver and protect the site. Zakape does not add advertising trackers or sell visitor data.',
  },
]
</script>

<template>
  <div class="site-shell legal-shell">
    <SiteHeader />
    <main class="content-page">
      <header class="content-hero privacy-hero">
        <p class="site-kicker"><span /> Plain-language policy</p>
        <h1>Private by default.<br /><em>Explicit when connected.</em></h1>
        <p>
          Zakape is a local-first creative tool. This page explains what remains on your device,
          what leaves it when you choose an external service, and which controls remain yours.
        </p>
        <span class="policy-date">Effective September 9, 2026</span>
      </header>

      <section class="privacy-grid" aria-label="Privacy summary">
        <article v-for="item in sections" :key="item.title">
          <component :is="item.icon" :size="22" />
          <h2>{{ item.title }}</h2>
          <p>{{ item.copy }}</p>
        </article>
      </section>

      <section class="policy-details">
        <div>
          <p class="site-kicker"><span /> Your controls</p>
          <h2>Choose what connects.</h2>
        </div>
        <div class="policy-copy">
          <h3>Device storage</h3>
          <p>
            You can delete projects and preferences from the application and manage exported files
            through your operating system. Uninstall behavior depends on the platform and selected
            external project location.
          </p>
          <h3>External services</h3>
          <p>
            Google authentication, GitHub downloads, Cloudflare website delivery, and any model
            provider you select operate under their own terms. Zakape sends data to a model only
            after you configure and use the assistant.
          </p>
          <h3>Open development</h3>
          <p>
            The application source and privacy implementation are public. Security problems should
            be reported privately through the repository security policy rather than a public issue.
          </p>
          <div class="policy-links">
            <a href="https://github.com/surelle-ha/zakape/security/policy"
              >Security policy <ExternalLink :size="14"
            /></a>
            <a href="https://github.com/surelle-ha/zakape/issues"
              >Ask a privacy question <ExternalLink :size="14"
            /></a>
          </div>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>
</template>
