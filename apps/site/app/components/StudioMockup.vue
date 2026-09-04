<script setup lang="ts">
import { Check, ScanLine } from '@lucide/vue'
import studioScreenshot from '../../../../docs/ui-snapshots/selection-transform-handles.png'
</script>

<template>
  <figure class="product-capture">
    <header class="capture-bar">
      <span><i /> LIVE PRODUCT CAPTURE</span>
      <span class="capture-filename">selection-transform.zakape</span>
      <span><Check :size="11" /> Desktop build</span>
    </header>
    <div class="capture-viewport">
      <img
        :src="studioScreenshot"
        alt="Zakape Studio showing a selected group of pixels with resize and rotation handles"
        width="1440"
        height="960"
      />
      <span class="capture-reticle top-left" aria-hidden="true" />
      <span class="capture-reticle bottom-right" aria-hidden="true" />
    </div>
    <figcaption>
      <span><ScanLine :size="12" /> ACTUAL WORKBENCH / 1440 × 960</span>
      <span>Selection handles · pixel grid · frame timeline</span>
    </figcaption>
  </figure>
</template>
