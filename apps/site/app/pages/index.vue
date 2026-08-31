<script setup lang="ts">
import {
  ArrowRight,
  Check,
  Download,
  Eye,
  FileJson,
  Code2,
  Grid3X3,
  Layers3,
  LockKeyhole,
  MousePointer2,
  Sparkles,
} from '@lucide/vue'

const repository = 'https://github.com/surelle-ha/zakape'

const features = [
  {
    icon: MousePointer2,
    label: 'Pixel-native tools',
    copy: 'Pencil, eraser, fill, picker, lines, shapes, grids, zoom, and an undo history built for tiny decisions.',
  },
  {
    icon: Layers3,
    label: 'Layers × frames',
    copy: 'Build motion in a real timeline with layer visibility, opacity, per-frame timing, duplicate frames, and onion skinning.',
  },
  {
    icon: FileJson,
    label: 'Game-ready output',
    copy: 'Export PNG, animated GIF, sprite-sheet PNG with JSON metadata, or the portable open .zakape project format.',
  },
]
</script>

<template>
  <div class="site-shell">
    <header class="site-nav">
      <a href="#top" class="site-logo" aria-label="Zakape home">
        <span><i /><i /><i /><i /></span>
        <strong>ZAKAPE</strong>
      </a>
      <nav aria-label="Primary navigation">
        <a href="#workbench">Workbench</a>
        <a href="#assistant">Assistant</a>
        <a href="#open-source">Open source</a>
      </nav>
      <a :href="repository" class="nav-source"><Code2 :size="15" /> View source</a>
    </header>

    <main id="top">
      <section class="hero-section">
        <div class="hero-copy">
          <p class="site-kicker"><span /> Open-source desktop sprite editor</p>
          <h1>Draw every pixel.<br /><em>Delegate the fussy bits.</em></h1>
          <p class="hero-lede">
            Zakape is a precise, offline-first animation workbench with an optional model assistant.
            Make the art yourself; invite your model when a bounded edit would save time.
          </p>
          <div class="hero-actions">
            <a :href="`${repository}/releases`" class="cta-primary"
              ><Download :size="17" /> Get the alpha <ArrowRight :size="15"
            /></a>
            <a :href="repository" class="cta-secondary"><Code2 :size="16" /> Follow development</a>
          </div>
          <div class="hero-proof">
            <span><Check :size="13" /> No account</span>
            <span><Check :size="13" /> Works without AI</span>
            <span><Check :size="13" /> MIT licensed</span>
          </div>
        </div>
        <div class="hero-visual">
          <div class="visual-label"><span>01</span> The workbench <i /></div>
          <StudioMockup />
          <div class="format-ticket">
            <span>OUTPUT / 04</span><strong>PNG · GIF · JSON · .ZAKAPE</strong>
          </div>
        </div>
      </section>

      <section id="workbench" class="workbench-section">
        <header class="section-intro">
          <p class="site-kicker"><span /> Built for the loop</p>
          <h2>A real editor first.<br /><em>No prompt required.</em></h2>
          <p>
            Fast iteration depends on muscle memory, visible state, and outputs you can trust.
            Zakape keeps those fundamentals close.
          </p>
        </header>
        <div class="feature-ledger">
          <article v-for="(feature, index) in features" :key="feature.label">
            <span class="feature-number">0{{ index + 1 }}</span>
            <component :is="feature.icon" :size="22" :stroke-width="1.6" />
            <h3>{{ feature.label }}</h3>
            <p>{{ feature.copy }}</p>
            <i class="feature-rule" />
          </article>
        </div>
      </section>

      <section id="assistant" class="assistant-story">
        <div class="assistant-copy">
          <p class="site-kicker light"><span /> Optional by design</p>
          <h2>Your model.<br />Your endpoint.<br /><em>Your call.</em></h2>
          <p>
            Connect any compatible hosted or local model. Zakape sends only the active art context,
            turns the response into a small set of validated pixel operations, and waits for your
            approval.
          </p>
          <ul>
            <li>
              <LockKeyhole :size="16" /><span
                ><strong>Keys stay in memory</strong
                ><small>No secret is stored in the project database.</small></span
              >
            </li>
            <li>
              <Eye :size="16" /><span
                ><strong>Review before apply</strong
                ><small>Every proposal is inspectable and becomes one undo step.</small></span
              >
            </li>
            <li>
              <Grid3X3 :size="16" /><span
                ><strong>Bounded edit language</strong
                ><small>No shell, filesystem, or unrestricted code execution.</small></span
              >
            </li>
          </ul>
        </div>
        <div class="operation-sheet">
          <header>
            <span><Sparkles :size="14" /> MODEL PROPOSAL</span><b>waiting for review</b>
          </header>
          <div class="prompt-line">
            <small>REQUEST</small>
            <p>Add a warm rim light. Preserve the mint silhouette and 8-color palette.</p>
          </div>
          <div class="operation-list">
            <p><span>01</span><code>set_pixels</code><b>8 coordinates</b></p>
            <p><span>02</span><code>replace_palette_color</code><b>#FFD36A → #FF875F</b></p>
          </div>
          <div class="operation-preview">
            <div class="mini-grid">
              <i
                v-for="cell in 64"
                :key="cell"
                :class="{
                  hot: [14, 22, 30, 38, 46, 54].includes(cell),
                  mint: [19, 20, 27, 28, 35, 36, 43, 44].includes(cell),
                }"
              />
            </div>
            <div><span>14 px</span><small>proposed delta</small></div>
          </div>
          <footer>
            <button type="button">Discard</button
            ><button type="button" class="apply"><Check :size="14" /> Apply edit</button>
          </footer>
        </div>
      </section>

      <section class="output-band">
        <div><span>FRAME</span><strong>PNG</strong><small>Scaled or native</small></div>
        <div><span>MOTION</span><strong>GIF</strong><small>Per-frame timing</small></div>
        <div>
          <span>ENGINE</span><strong>SHEET + JSON</strong><small>Predictable metadata</small>
        </div>
        <div><span>PROJECT</span><strong>.ZAKAPE</strong><small>Readable, open JSON</small></div>
      </section>

      <section id="open-source" class="open-section">
        <div class="open-pixels" aria-hidden="true"><i v-for="pixel in 24" :key="pixel" /></div>
        <div>
          <p class="site-kicker"><span /> Built in public</p>
          <h2>The workbench should belong to the artists who shape it.</h2>
        </div>
        <div class="open-copy">
          <p>
            Zakape is MIT licensed. The format, roadmap, research, architecture, and QA notes live
            in the repository alongside the code.
          </p>
          <a :href="repository"><Code2 :size="17" /> Read the source <ArrowRight :size="15" /></a>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <a href="#top" class="site-logo"
        ><span><i /><i /><i /><i /></span><strong>ZAKAPE</strong></a
      >
      <p>Pixel by pixel. Built in the open.</p>
      <div>
        <a :href="repository">GitHub</a><a :href="`${repository}/blob/main/README.md`">Docs</a
        ><a :href="`${repository}/blob/main/LICENSE`">MIT License</a>
      </div>
    </footer>
  </div>
</template>
