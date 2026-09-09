<script setup lang="ts">
import { ArrowRight, Check, Cloud, Code2, GitBranch, Link2, Sparkles, Users } from '@lucide/vue'

const siteURL = 'https://zakape.0110harold.workers.dev/pricing'
const repository = 'https://github.com/surelle-ha/zakape'

useSeoMeta({
  title: 'Pricing — Zakape Pixel Studio',
  description:
    'Use the complete open-source Zakape editor for free. Preview the planned $4 monthly plan for art sync, private share links, and collaboration.',
  ogTitle: 'Zakape plans — an open studio for every artist',
  ogDescription: 'The local editor stays free. Optional connected tools are planned at $4 monthly.',
  ogUrl: siteURL,
})
useHead({ link: [{ rel: 'canonical', href: siteURL }] })

const freeFeatures = [
  'Complete local pixel editor',
  'Frame animation and timeline',
  'Layers, selections, palettes, and exports',
  'Optional bring-your-own-model assistant',
  'MIT-licensed source and project format',
]
const studioFeatures = [
  'Everything in Open Source',
  'Sync and art backups',
  'Private share links',
  'Collaboration mode',
]
</script>

<template>
  <div class="site-shell pricing-shell">
    <SiteHeader />
    <main id="main-content" class="pricing-page">
      <header class="pricing-hero">
        <p class="site-kicker"><span /> Patronage, made simple</p>
        <h1>The studio is free.<br /><em>Connection is optional.</em></h1>
        <p>
          Create locally without a subscription. The planned Studio plan supports hosted services
          for artists who want their work available beyond one device.
        </p>
      </header>

      <section class="pricing-grid" aria-label="Zakape plans">
        <article class="price-card free-card">
          <header>
            <span class="plan-mark"><Code2 :size="20" /></span>
            <div>
              <p>For every maker</p>
              <h2>Open Source</h2>
            </div>
          </header>
          <div class="price"><strong>$0</strong><span>forever</span></div>
          <p class="plan-copy">
            The full local-first creative workspace, with no account required.
          </p>
          <ul>
            <li v-for="feature in freeFeatures" :key="feature">
              <Check :size="16" />{{ feature }}
            </li>
          </ul>
          <NuxtLink to="/download" class="cta-secondary"
            >Download Zakape <ArrowRight :size="15"
          /></NuxtLink>
        </article>

        <article class="price-card studio-card">
          <span class="coming-soon">PLANNED</span>
          <header>
            <span class="plan-mark"><Sparkles :size="20" /></span>
            <div>
              <p>For connected studios</p>
              <h2>Studio</h2>
            </div>
          </header>
          <div class="price"><strong>$4</strong><span>USD / month</span></div>
          <p class="plan-copy">Connected conveniences for artists and small creative teams.</p>
          <ul>
            <li v-for="feature in studioFeatures" :key="feature">
              <Check :size="16" />{{ feature }}
            </li>
          </ul>
          <a :href="`${repository}/issues`" class="cta-primary"
            >Follow the launch <ArrowRight :size="15"
          /></a>
        </article>
      </section>

      <section class="pricing-notes">
        <article>
          <Cloud :size="19" />
          <h3>Sync, never lock-in</h3>
          <p>Connected copies complement ordinary project files on your device.</p>
        </article>
        <article>
          <Link2 :size="19" />
          <h3>Share in private</h3>
          <p>Send work to chosen reviewers without publishing it to a public gallery.</p>
        </article>
        <article>
          <Users :size="19" />
          <h3>Create together</h3>
          <p>Collaboration is designed for a small art team sharing one living canvas.</p>
        </article>
        <article>
          <GitBranch :size="19" />
          <h3>Built in public</h3>
          <p>
            Plans, limitations, and service implementation will remain visible in the repository.
          </p>
        </article>
      </section>

      <aside class="pricing-disclosure">
        <strong>No checkout yet.</strong>
        <p>
          The Studio plan is a published direction, not an active subscription. The free editor is
          available today.
        </p>
      </aside>
    </main>
    <SiteFooter />
  </div>
</template>
