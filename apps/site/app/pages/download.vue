<script setup lang="ts">
import {
  AlertCircle,
  CheckCircle2,
  Code2,
  Download,
  ExternalLink,
  Laptop,
  LoaderCircle,
  Smartphone,
} from '@lucide/vue'

type Platform = 'windows' | 'linux' | 'android' | 'macos' | 'ios' | 'unknown'
type ReleaseAsset = { name: string; browser_download_url: string; size: number }
type LatestRelease = {
  tag_name: string
  html_url: string
  published_at: string
  assets: ReleaseAsset[]
}

const siteURL = 'https://zakape.0110harold.workers.dev/download'
const repository = 'https://github.com/surelle-ha/zakape'
const release = ref<LatestRelease | null>(null)
const loading = ref(true)
const loadError = ref(false)
const platform = ref<Platform>('unknown')
const releaseSource = ref('https://github.com/surelle-ha/zakape/releases/latest')

useSeoMeta({
  title: 'Download Zakape — Pixel Art Studio for Desktop and Android',
  description:
    'Download the latest Zakape release for Windows, Linux, or Android. macOS builds are available from source.',
  ogTitle: 'Download Zakape Pixel Studio',
  ogDescription: 'Get the latest Zakape desktop or Android build from the official GitHub release.',
  ogUrl: siteURL,
})
useHead({ link: [{ rel: 'canonical', href: siteURL }] })

const detectPlatform = (): Platform => {
  const source = `${navigator.platform || ''} ${navigator.userAgent || ''}`.toLowerCase()
  if (source.includes('android')) return 'android'
  if (source.includes('iphone') || source.includes('ipad')) return 'ios'
  if (source.includes('mac')) return 'macos'
  if (source.includes('win')) return 'windows'
  if (source.includes('linux')) return 'linux'
  return 'unknown'
}

const assetMatches = (asset: ReleaseAsset, target: Platform) => {
  const name = asset.name.toLowerCase()
  if (target === 'windows') return /\.(exe|msi)$/.test(name)
  if (target === 'linux') return /\.(appimage|deb|rpm)$/.test(name)
  if (target === 'android') return name.endsWith('.apk')
  return false
}

const platformAssets = computed(
  () => release.value?.assets.filter((asset) => assetMatches(asset, platform.value)) ?? [],
)
const primaryAsset = computed(() => {
  const preferred =
    platform.value === 'windows'
      ? '.exe'
      : platform.value === 'linux'
        ? '.appimage'
        : platform.value === 'android'
          ? '.apk'
          : ''
  return platformAssets.value.find((asset) => asset.name.toLowerCase().endsWith(preferred))
})
const platformName = computed(
  () =>
    ({
      windows: 'Windows',
      linux: 'Linux',
      android: 'Android',
      macos: 'macOS',
      ios: 'iOS',
      unknown: 'your device',
    })[platform.value],
)
const targetName = (target: Platform) =>
  ({
    windows: 'Windows',
    linux: 'Linux',
    android: 'Android',
    macos: 'macOS',
    ios: 'iOS',
    unknown: 'Other',
  })[target]
const unavailable = computed(
  () =>
    !loading.value && (!primaryAsset.value || ['macos', 'ios', 'unknown'].includes(platform.value)),
)
const formatBytes = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`

onMounted(async () => {
  platform.value = detectPlatform()
  try {
    release.value = await $fetch<LatestRelease>(
      'https://api.github.com/repos/surelle-ha/zakape/releases/latest',
      { timeout: 10_000, headers: { Accept: 'application/vnd.github+json' } },
    )
    if (release.value?.html_url) releaseSource.value = release.value.html_url
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="site-shell download-shell">
    <SiteHeader />
    <main class="content-page">
      <section class="download-hero">
        <div>
          <p class="site-kicker"><span /> Official builds</p>
          <h1>Make the next frame<br /><em>on your own machine.</em></h1>
          <p>
            Install the latest tested release, keep projects local, and bring your own model only
            when you want assistance.
          </p>
        </div>

        <article class="detected-download">
          <span class="detected-icon">
            <LoaderCircle v-if="loading" class="spin" :size="25" />
            <Smartphone v-else-if="platform === 'android' || platform === 'ios'" :size="25" />
            <Laptop v-else :size="25" />
          </span>
          <p>Detected platform</p>
          <h2>{{ loading ? 'Checking your device…' : platformName }}</h2>
          <template v-if="primaryAsset && !loading">
            <a :href="primaryAsset.browser_download_url" class="cta-primary download-primary">
              <Download :size="18" /> Download {{ release?.tag_name }}
            </a>
            <small>{{ primaryAsset.name }} · {{ formatBytes(primaryAsset.size) }}</small>
          </template>
          <template v-else-if="unavailable">
            <div class="download-unavailable">
              <AlertCircle :size="17" />
              <span
                ><strong>No packaged build for {{ platformName }} yet.</strong>
                <small v-if="platform === 'macos'"
                  >The macOS version can currently be built from source.</small
                >
                <small v-else>Choose another platform or build Zakape from source.</small></span
              >
            </div>
            <a :href="`${repository}#quick-start`" class="cta-secondary"
              ><Code2 :size="16" /> Build from source</a
            >
          </template>
          <template v-else-if="loadError">
            <div class="download-unavailable">
              <AlertCircle :size="17" />
              <span
                ><strong>Release details are unavailable.</strong
                ><small>Open the official release page to continue.</small></span
              >
            </div>
          </template>
        </article>
      </section>

      <section class="platform-downloads">
        <header>
          <p class="site-kicker"><span /> Other platforms</p>
          <h2>One project format.<br />Several ways to work.</h2>
        </header>
        <div class="platform-grid">
          <article
            v-for="target in ['windows', 'linux', 'android', 'macos'] as Platform[]"
            :key="target"
          >
            <span>0{{ ['windows', 'linux', 'android', 'macos'].indexOf(target) + 1 }}</span>
            <h3>{{ targetName(target) }}</h3>
            <p v-if="target === 'macos'">
              Not packaged yet. Build the desktop application from source.
            </p>
            <p v-else>
              {{ release?.assets.filter((asset) => assetMatches(asset, target)).length || 0 }}
              current package(s)
            </p>
            <button
              type="button"
              :class="{ active: platform === target }"
              @click="platform = target"
            >
              {{ target === 'macos' ? 'View source option' : 'Show downloads' }}
            </button>
          </article>
        </div>
      </section>

      <section v-if="platformAssets.length > 1" class="download-alternatives">
        <div>
          <p class="site-kicker"><span /> Package choices</p>
          <h2>{{ platformName }} downloads</h2>
        </div>
        <ul>
          <li v-for="asset in platformAssets" :key="asset.name">
            <CheckCircle2 :size="16" />
            <span
              ><strong>{{ asset.name }}</strong
              ><small>{{ formatBytes(asset.size) }}</small></span
            >
            <a :href="asset.browser_download_url" :aria-label="`Download ${asset.name}`"
              ><Download :size="16"
            /></a>
          </li>
        </ul>
      </section>

      <aside class="release-source">
        <span>{{ release?.tag_name || 'Latest release' }}</span>
        <p>Downloads come directly from the official GitHub release—never a mirror.</p>
        <a :href="releaseSource">Release notes <ExternalLink :size="14" /></a>
      </aside>
    </main>
    <SiteFooter />
  </div>
</template>
