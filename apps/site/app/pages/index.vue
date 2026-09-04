<script setup lang="ts">
import {
  ArrowDown,
  ArrowRight,
  Bot,
  Check,
  Code2,
  Download,
  Eye,
  Film,
  FileJson,
  Frame,
  Layers3,
  LockKeyhole,
  MousePointer2,
  Palette,
  Play,
  ShieldCheck,
  Sparkles,
} from '@lucide/vue'
import homeScreenshot from '../../../../docs/ui-snapshots/workspace-home-tab.png'
import assistantScreenshot from '../../../../docs/ui-snapshots/assistant-drawer.png'

const repository = 'https://github.com/surelle-ha/zakape'

const features = [
  {
    icon: MousePointer2,
    label: 'Pixel-native tools',
    copy: 'Draw, fill, sample, mirror, dither, select, transform, and pan without leaving the canvas loop.',
    key: 'P',
  },
  {
    icon: Layers3,
    label: 'Independent layers',
    copy: 'Separate silhouette, color, and detail with per-layer names, visibility, opacity, and blend state.',
    key: 'F2',
  },
  {
    icon: Film,
    label: 'Frame-by-frame motion',
    copy: 'Reorder frames, tune timing, use onion skinning, and watch the animation while you work.',
    key: 'O',
  },
  {
    icon: FileJson,
    label: 'Outputs that travel',
    copy: 'Ship a frame, animated GIF, sprite sheet with metadata, or the open project file.',
    key: 'E',
  },
]

const outputs = [
  ['Still', 'PNG', 'Native or scaled'],
  ['Motion', 'GIF', 'Per-frame timing'],
  ['Engine', 'Sheet + JSON', 'Predictable metadata'],
  ['Project', '.zakape', 'Readable and portable'],
]
</script>

<template>
  <div class="site-shell">
    <SiteSectionScroller />
    <SiteMotion />
    <header class="site-nav">
      <a href="#top" class="site-logo" aria-label="Zakape home">
        <img src="/icon.png" alt="" width="30" height="30" />
        <span><strong>Zakape</strong><small>Pixel studio</small></span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="#workbench">Workbench</a>
        <a href="#workspace">Workspace</a>
        <a href="#assistant">Assistant</a>
        <a href="#open-source">Open source</a>
      </nav>
      <a :href="repository" class="nav-source"><Code2 :size="15" /> View source</a>
    </header>

    <main id="top">
      <section class="hero-section" data-scroll-section data-scroll-label="Opening">
        <div class="hero-copy" data-reveal>
          <p class="site-kicker"><span /> Independent pixel studio</p>
          <h1>Draw every pixel.<br /><em>Make every frame count.</em></h1>
          <p class="hero-lede">
            A focused, local-first workspace for sprites and animation. Work by hand from first mark
            to final export, then invite your own model only when it earns a place in the process.
          </p>
          <div class="hero-actions">
            <a :href="`${repository}/releases`" class="cta-primary">
              <Download :size="17" /> Download alpha <ArrowRight :size="15" />
            </a>
            <a :href="repository" class="cta-secondary"><Code2 :size="16" /> Follow the build</a>
          </div>
          <div class="hero-proof" aria-label="Project qualities">
            <span><Check :size="13" /> Guest access</span>
            <span><Check :size="13" /> Offline editor</span>
            <span><Check :size="13" /> MIT licensed</span>
          </div>
        </div>

        <div
          class="hero-index"
          data-reveal
          data-reveal-delay="0.12"
          aria-label="Workbench coordinates"
        >
          <span>CANVAS / 01</span><i /><span>FRAME 01:04</span><i /><span>ZOOM 1600%</span>
        </div>

        <div class="hero-visual" data-reveal data-reveal-delay="0.18">
          <StudioMockup />
          <div class="hero-note">
            <span>REAL INTERFACE</span>
            <strong>No concept render.</strong>
            <small>Captured from the tested desktop build.</small>
          </div>
        </div>

        <a href="#workbench" class="hero-scroll"><ArrowDown :size="14" /> Read the workbench</a>
      </section>

      <section
        id="workbench"
        class="workbench-section"
        data-scroll-section
        data-scroll-label="Workbench"
      >
        <header class="section-intro" data-reveal>
          <p class="site-kicker"><span /> Built for the loop</p>
          <h2>A real editor first.<br /><em>No prompt required.</em></h2>
          <p>
            Fast iteration comes from muscle memory, visible state, and files you can trust. Every
            control stays close to the thing it changes.
          </p>
        </header>

        <div class="feature-grid" data-reveal data-reveal-delay="0.1">
          <article v-for="(feature, index) in features" :key="feature.label">
            <header>
              <span>0{{ index + 1 }}</span
              ><kbd>{{ feature.key }}</kbd>
            </header>
            <component :is="feature.icon" :size="23" :stroke-width="1.5" />
            <h3>{{ feature.label }}</h3>
            <p>{{ feature.copy }}</p>
          </article>
        </div>
      </section>

      <section
        id="workspace"
        class="workspace-section"
        data-scroll-section
        data-scroll-label="Local desk"
      >
        <div class="workspace-story">
          <div class="workspace-copy" data-reveal>
            <p class="site-kicker"><span /> Your local desk</p>
            <h3>Open where you left off.</h3>
            <p>
              Recent canvases carry their real previews. Changelogs, workspace location, and the
              complete sprite loop live on an indismissable Home tab.
            </p>
            <dl>
              <div>
                <dt>Projects</dt>
                <dd>Local by default</dd>
              </div>
              <div>
                <dt>Working directory</dt>
                <dd>Documents/zakape</dd>
              </div>
              <div>
                <dt>Formats</dt>
                <dd>Open, ordinary files</dd>
              </div>
            </dl>
          </div>
          <figure class="workspace-shot" data-reveal data-reveal-delay="0.12">
            <img
              :src="homeScreenshot"
              alt="Zakape Studio Home tab with recent work, changelog, and workspace details"
              width="1440"
              height="960"
              loading="lazy"
            />
            <figcaption>
              <span>HOME / LIVE BUILD</span><small>Resume, create, or open</small>
            </figcaption>
          </figure>
        </div>
      </section>

      <section
        id="assistant"
        class="assistant-section"
        data-scroll-section
        data-scroll-label="Assistant"
      >
        <div class="assistant-copy" data-reveal>
          <p class="site-kicker light"><span /> Optional by design</p>
          <h2>Your model.<br />Your endpoint.<br /><em>Your approval.</em></h2>
          <p>
            Connect local Ollama or a compatible endpoint. The assistant works against an explicit
            frame or sheet scope, inspects its draft, and returns a reviewable proposal.
          </p>
          <ul>
            <li>
              <LockKeyhole :size="17" />
              <span
                ><strong>Private configuration</strong
                ><small>Keys stay on your device.</small></span
              >
            </li>
            <li>
              <Eye :size="17" />
              <span
                ><strong>Visible before apply</strong
                ><small>Inspect every proposed result.</small></span
              >
            </li>
            <li>
              <ShieldCheck :size="17" />
              <span
                ><strong>Bounded operations</strong
                ><small>No shell or unrestricted code.</small></span
              >
            </li>
          </ul>
        </div>

        <div class="assistant-visual" data-reveal data-reveal-delay="0.12">
          <figure class="assistant-shot">
            <img
              :src="assistantScreenshot"
              alt="Zakape Studio with the Art assistant drawer open beside the canvas"
              width="1440"
              height="960"
              loading="lazy"
            />
            <figcaption><Bot :size="13" /> AGENTIC WORKSPACE / REAL CAPTURE</figcaption>
          </figure>
          <div class="assistant-protocol">
            <header><Sparkles :size="14" /><span>REVIEW SEQUENCE</span></header>
            <ol>
              <li>
                <span>01</span><strong>Describe</strong><small>Set intent and edit scope</small>
              </li>
              <li>
                <span>02</span><strong>Inspect</strong
                ><small>Agent checks its rendered draft</small>
              </li>
              <li>
                <span>03</span><strong>Approve</strong><small>Apply as one undoable edit</small>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section
        class="output-section"
        aria-labelledby="output-heading"
        data-scroll-section
        data-scroll-label="Outputs"
      >
        <header data-reveal>
          <p class="site-kicker"><span /> Leave with files</p>
          <h2 id="output-heading">From the canvas<br />to the build.</h2>
        </header>
        <div class="output-list" data-reveal data-reveal-delay="0.1">
          <article v-for="([kind, format, detail], index) in outputs" :key="format">
            <span>0{{ index + 1 }} / {{ kind }}</span
            ><strong>{{ format }}</strong
            ><small>{{ detail }}</small>
          </article>
        </div>
      </section>

      <section
        id="open-source"
        class="open-section"
        data-scroll-section
        data-scroll-label="Open source"
      >
        <div class="open-mark" aria-hidden="true">
          <Palette :size="26" />
          <span v-for="pixel in 25" :key="pixel" />
        </div>
        <div data-reveal>
          <p class="site-kicker"><span /> Built in public</p>
          <h2>The studio belongs to the artists who shape it.</h2>
        </div>
        <div class="open-copy" data-reveal data-reveal-delay="0.12">
          <p>
            Zakape is MIT licensed. Its project format, roadmap, architecture, privacy notes, and
            visual QA live beside the source.
          </p>
          <a :href="repository"><Code2 :size="17" /> Read the source <ArrowRight :size="15" /></a>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <a href="#top" class="site-logo">
        <img src="/icon.png" alt="" width="30" height="30" />
        <span><strong>Zakape</strong><small>Pixel studio</small></span>
      </a>
      <p><Frame :size="12" /> Pixel by pixel. Built in the open.</p>
      <div>
        <a :href="repository">GitHub</a>
        <a :href="`${repository}/blob/main/README.md`">Docs</a>
        <a :href="`${repository}/releases`"><Play :size="11" /> Releases</a>
      </div>
    </footer>
  </div>
</template>
