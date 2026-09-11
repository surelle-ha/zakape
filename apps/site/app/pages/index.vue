<script setup lang="ts">
import {
  ArrowDown,
  ArrowRight,
  Bot,
  Check,
  Code2,
  Download,
  Film,
  FileJson,
  Layers3,
  LockKeyhole,
  MousePointer2,
  Palette,
  ShieldCheck,
  Sparkles,
} from '@lucide/vue'
const repository = 'https://github.com/surelle-ha/zakape'
const siteURL = 'https://zakape.0110harold.workers.dev'

useSeoMeta({ ogUrl: siteURL })
useHead({ link: [{ rel: 'canonical', href: siteURL }] })

const craft = [
  {
    icon: MousePointer2,
    title: 'Pixel-native tools',
    copy: 'Draw, dither, select, transform, mirror, and pan with controls tuned for deliberate marks.',
  },
  {
    icon: Layers3,
    title: 'Layers with purpose',
    copy: 'Name, order, blend, hide, and shape every layer without losing the thread of the frame.',
  },
  {
    icon: Film,
    title: 'Motion at a glance',
    copy: 'Reorder frames, tune timing, reveal onion skinning, and preview the animation as you work.',
  },
]

const formats = ['PNG stills', 'Animated GIF', 'Sprite sheet + JSON', 'Portable .zakape project']
</script>

<template>
  <div class="site-shell atelier-shell">
    <SiteSectionScroller />
    <SiteMotion />
    <SiteHeader />

    <main id="main-content">
      <section class="atelier-hero" data-scroll-section data-scroll-label="Opening">
        <div class="hero-copy" data-reveal>
          <div class="public-notice" aria-label="Project status">
            <span>Public release</span>
            <span>Open source</span>
            <span>Maintained independently</span>
          </div>
          <p class="site-kicker"><span /> The open digital atelier</p>
          <h1>Craft sprites<br /><em>worthy of a world.</em></h1>
          <p class="hero-lede">
            A focused studio for hand-built pixel art and frame-by-frame animation—with an optional
            assistant that works beside you, never in place of you.
          </p>
          <div class="hero-actions">
            <NuxtLink to="/download" class="cta-primary"
              ><Download :size="17" /> Enter the studio <ArrowRight :size="15"
            /></NuxtLink>
            <a :href="repository" class="cta-secondary"><Code2 :size="16" /> View the source</a>
          </div>
          <div class="hero-proof" aria-label="Project qualities">
            <span><Check :size="13" /> Local-first</span>
            <span><Check :size="13" /> Guest access</span>
            <span><Check :size="13" /> MIT licensed</span>
          </div>
        </div>

        <a href="#atelier" class="hero-scroll"><ArrowDown :size="14" /> Tour the atelier</a>
      </section>

      <section id="atelier" class="atelier-section" data-scroll-section data-scroll-label="Atelier">
        <div class="section-heading" data-reveal>
          <p class="site-kicker"><span /> The maker's workbench</p>
          <h2>Every instrument<br /><em>within reach.</em></h2>
          <p>
            The canvas, timeline, palette, layers, and live preview share one composed workspace.
            Nothing interrupts the rhythm between first mark and final frame.
          </p>
        </div>

        <div class="atelier-showcase" data-reveal data-reveal-delay="0.1">
          <StudioMockup />
          <div class="craft-panels">
            <article v-for="(item, index) in craft" :key="item.title">
              <header>
                <span>0{{ index + 1 }}</span
                ><component :is="item.icon" :size="20" />
              </header>
              <h3>{{ item.title }}</h3>
              <p>{{ item.copy }}</p>
            </article>
          </div>
        </div>

        <div class="atelier-ribbon" data-reveal>
          <span><Palette :size="15" /> Indexed palettes</span>
          <span><Film :size="15" /> Tiled preview</span>
          <span><FileJson :size="15" /> Engine-ready metadata</span>
        </div>
      </section>

      <section
        id="assistant"
        class="companion-section"
        data-scroll-section
        data-scroll-label="Companion"
      >
        <div class="companion-visual" data-reveal>
          <figure class="assistant-frame">
            <img
              src="/art/god-man.png"
              alt="Pixel-art study of Michelangelo's Creation of Adam"
              width="1920"
              height="720"
              loading="lazy"
            />
            <figcaption><Bot :size="13" /> A creative companion, by invitation</figcaption>
          </figure>
        </div>

        <div class="companion-copy" data-reveal data-reveal-delay="0.12">
          <p class="site-kicker"><span /> Intelligence by invitation</p>
          <h2>Your hand leads.<br /><em>Your model assists.</em></h2>
          <p>
            Connect local Ollama or a compatible endpoint. Set the frame or sheet scope, let the
            assistant inspect its own draft, then accept only the work that belongs on your canvas.
          </p>
          <ul>
            <li>
              <LockKeyhole :size="17" /><span
                ><strong>Private configuration</strong
                ><small>Credentials remain on your device.</small></span
              >
            </li>
            <li>
              <Sparkles :size="17" /><span
                ><strong>Iterative proposals</strong
                ><small>The assistant can inspect and refine before handoff.</small></span
              >
            </li>
            <li>
              <ShieldCheck :size="17" /><span
                ><strong>Undoable approval</strong
                ><small>Every applied proposal remains under artist control.</small></span
              >
            </li>
          </ul>
        </div>
      </section>

      <section class="finale-section" data-scroll-section data-scroll-label="Open studio">
        <figure class="finale-art" data-reveal>
          <img
            src="/art/the-scream.png"
            alt="Pixel-art study of Edvard Munch's The Scream"
            width="500"
            height="664"
            loading="lazy"
          />
          <figcaption>Study 03 · Edvard Munch · 1893</figcaption>
        </figure>
        <div class="finale-heading" data-reveal>
          <p class="site-kicker"><span /> Leave with your work</p>
          <h2>Open files.<br />Open source.<br /><em>An open invitation.</em></h2>
        </div>

        <div class="finale-body" data-reveal data-reveal-delay="0.1">
          <div class="format-list" aria-label="Export formats">
            <span v-for="(format, index) in formats" :key="format"
              ><i>0{{ index + 1 }}</i
              >{{ format }}</span
            >
          </div>
          <p>
            Start with the complete local studio for free. The optional $4 monthly plan will add
            sync, private share links, and collaboration—without taking the open editor away.
          </p>
          <div class="finale-actions">
            <NuxtLink to="/pricing" class="cta-primary"
              >Compare plans <ArrowRight :size="15"
            /></NuxtLink>
            <a :href="repository" class="text-link"
              ><Code2 :size="16" /> Shape the project on GitHub</a
            >
          </div>
        </div>

        <footer class="art-credit">
          Pixel studies: Hokusai, <cite>The Great Wave off Kanagawa</cite>; Munch, <cite>The Scream</cite>;
          Michelangelo, <cite>The Creation of Adam</cite>.
        </footer>
      </section>
    </main>

    <SiteFooter />
  </div>
</template>
