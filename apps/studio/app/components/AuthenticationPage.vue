<script setup lang="ts">
import { ArrowRight, Check, LoaderCircle, LockKeyhole, Monitor, UserRound } from '@lucide/vue'
import zakapeMark from '../../../../assets/brand/zakape-icon.png'

const { configuration, status, errorMessage, continueAsGuest, signIn } = useGoogleAccount()
const signingIn = computed(() => status.value === 'loading')
const desktopBuild = computed(() => configuration.value?.platform === 'desktop')

const useGoogle = async () => {
  await signIn()
}
</script>

<template>
  <main class="authentication-page" aria-labelledby="authentication-heading">
    <div class="authentication-grid" aria-hidden="true" />
    <section v-motion-enter="'surface'" class="authentication-card">
      <div class="authentication-brand">
        <img :src="zakapeMark" width="58" height="58" alt="" />
        <span><strong>ZAKAPE</strong><small>Sprite workbench</small></span>
      </div>

      <div class="authentication-copy">
        <span class="eyebrow"><LockKeyhole :size="12" /> Choose how to enter</span>
        <h1 id="authentication-heading">Your studio starts on this device.</h1>
        <p>
          Pick a local guest workspace or connect your Google identity on desktop. Your projects,
          pixels, and model settings remain local either way.
        </p>
      </div>

      <div class="authentication-choices">
        <button type="button" class="authentication-choice guest" @click="continueAsGuest">
          <span class="authentication-choice-icon"><UserRound :size="21" /></span>
          <span>
            <strong>Continue as Guest</strong>
            <small>No account, network, or setup required.</small>
          </span>
          <ArrowRight :size="17" />
        </button>

        <button
          v-if="desktopBuild"
          type="button"
          class="authentication-choice google"
          :disabled="signingIn || !configuration?.available"
          @click="useGoogle"
        >
          <span class="authentication-choice-icon google-letter" aria-hidden="true">G</span>
          <span>
            <strong>{{ signingIn ? 'Waiting for Google…' : 'Continue with Google' }}</strong>
            <small>
              {{
                configuration?.available
                  ? 'Sign in through your system browser.'
                  : 'Available in a configured desktop build.'
              }}
            </small>
          </span>
          <LoaderCircle v-if="signingIn" class="spin" :size="17" />
          <ArrowRight v-else :size="17" />
        </button>
      </div>

      <p v-if="errorMessage" class="authentication-error" role="alert">{{ errorMessage }}</p>

      <footer class="authentication-privacy">
        <Monitor :size="14" />
        <span>
          <strong>Local-first by default</strong>
          <small><Check :size="11" /> Artwork is never uploaded during sign-in.</small>
        </span>
      </footer>
    </section>

    <aside class="authentication-note" aria-label="Workspace promise">
      <span>01</span>
      <p>Draw offline. Animate locally. Connect optional tools only when you need them.</p>
    </aside>
  </main>
</template>
