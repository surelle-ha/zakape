<script setup lang="ts">
import { Code2 } from '@lucide/vue'

const repository = 'https://github.com/surelle-ha/zakape'
</script>

<template>
  <header class="site-nav">
    <a class="skip-link" href="#main-content">Skip to content</a>
    <NuxtLink to="/" class="site-logo" aria-label="Zakape home">
      <img src="/icon.png" alt="" width="30" height="30" />
      <span><strong>Zakape</strong><small>Pixel studio</small></span>
    </NuxtLink>
    <nav aria-label="Primary navigation">
      <NuxtLink to="/#atelier">Studio</NuxtLink>
      <NuxtLink to="/#assistant">Assistant</NuxtLink>
      <NuxtLink to="/pricing">Pricing</NuxtLink>
      <NuxtLink to="/download">Download</NuxtLink>
      <NuxtLink to="/privacy">Privacy</NuxtLink>
    </nav>
    <a :href="repository" class="nav-source"><Code2 :size="15" /> View source</a>
  </header>
</template>
