<script setup lang="ts">
import { Frame, Play } from '@lucide/vue'

const repository = 'https://github.com/surelle-ha/zakape'
</script>

<template>
  <footer class="site-footer">
    <NuxtLink to="/" class="site-logo">
      <img src="/icon.png" alt="" width="30" height="30" />
      <span><strong>Zakape</strong><small>Pixel studio</small></span>
    </NuxtLink>
    <p><Frame :size="12" /> Pixel by pixel. Built in the open.</p>
    <div>
      <NuxtLink to="/pricing">Pricing</NuxtLink>
      <NuxtLink to="/download">Download</NuxtLink>
      <NuxtLink to="/privacy">Privacy</NuxtLink>
      <a :href="repository">GitHub</a>
      <a :href="`${repository}/releases`"><Play :size="11" /> Releases</a>
    </div>
  </footer>
</template>
