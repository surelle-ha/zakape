<script setup lang="ts">
import { Eraser, PaintBucket, Pencil, Pipette, Sparkles } from '@lucide/vue'
</script>

<template>
  <div class="studio-mock" aria-label="Zakape editor preview">
    <div class="mock-titlebar">
      <span class="mock-brand"><i /><i /><i /> ZAKAPE</span>
      <span>mint-runner.zakape</span>
      <span class="mock-status"><i /> Saved locally</span>
      <button type="button">Export</button>
    </div>
    <div class="mock-body">
      <div class="mock-tools">
        <span class="active"><Pencil :size="14" /></span>
        <span><Eraser :size="14" /></span>
        <span><PaintBucket :size="14" /></span>
        <span><Pipette :size="14" /></span>
      </div>
      <div class="mock-canvas-wrap">
        <div class="mock-canvas-mat">
          <svg
            viewBox="0 0 320 320"
            role="img"
            aria-label="Mint runner pixel sprite"
            shape-rendering="crispEdges"
          >
            <defs>
              <pattern id="mock-checker" width="20" height="20" patternUnits="userSpaceOnUse">
                <rect width="20" height="20" fill="#ebe8dd" />
                <rect width="10" height="10" fill="#e0ddcf" />
                <rect x="10" y="10" width="10" height="10" fill="#e0ddcf" />
              </pattern>
            </defs>
            <rect width="320" height="320" fill="url(#mock-checker)" />
            <g>
              <rect x="100" y="80" width="120" height="140" fill="#b9f5d0" />
              <rect x="80" y="120" width="20" height="70" fill="#87d5ae" />
              <rect x="220" y="120" width="20" height="70" fill="#87d5ae" />
              <rect x="120" y="50" width="30" height="30" fill="#b9f5d0" />
              <rect x="180" y="50" width="30" height="30" fill="#b9f5d0" />
              <rect x="120" y="110" width="20" height="20" fill="#18221c" />
              <rect x="180" y="110" width="20" height="20" fill="#18221c" />
              <rect x="140" y="160" width="50" height="10" fill="#ff875f" />
              <rect x="110" y="220" width="40" height="50" fill="#51745f" />
              <rect x="180" y="220" width="40" height="50" fill="#51745f" />
              <rect x="250" y="70" width="20" height="20" fill="#ffd36a" />
              <rect x="260" y="60" width="10" height="10" fill="#fff4c8" />
            </g>
          </svg>
        </div>
      </div>
      <div class="mock-assist">
        <span class="mock-kicker"><Sparkles :size="11" /> Assist</span>
        <strong>A second pair of hands, when invited.</strong>
        <p>“Add a warm rim light, but keep the silhouette.”</p>
        <div class="mock-proposal">
          <i /><span><b>Preview ready</b><small>14 bounded pixel edits</small></span>
        </div>
        <button type="button">Review proposal</button>
      </div>
    </div>
    <div class="mock-timeline">
      <span>Timeline</span>
      <i v-for="frame in 4" :key="frame" :class="{ active: frame === 2 }">0{{ frame }}</i>
      <b>+ Add frame</b>
    </div>
  </div>
</template>
