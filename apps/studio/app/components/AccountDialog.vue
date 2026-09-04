<script setup lang="ts">
import { Check, LoaderCircle, LogIn, LogOut, Monitor, ShieldCheck, UserRound, X } from '@lucide/vue'

const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{
  close: []
}>()

const { account, configuration, status, errorMessage, signIn, signOut } = useGoogleAccount()
const dialog = ref<HTMLElement | null>(null)

const buildState = computed(() => {
  if (configuration.value?.available) return 'Google sign-in is ready in this desktop build.'
  if (configuration.value?.platform !== 'desktop')
    return 'Google sign-in is not available on mobile yet.'
  if (configuration.value?.featureEnabled) return 'Developer credentials are required.'
  return 'Install the desktop app to use Google sign-in.'
})

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    await nextTick()
    dialog.value?.focus()
  },
)
</script>

<template>
  <div v-if="open" class="account-dialog-backdrop" @click.self="emit('close')">
    <section
      ref="dialog"
      v-motion-enter="'dialog'"
      class="account-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-dialog-title"
      tabindex="-1"
    >
      <header>
        <div>
          <span class="eyebrow"><Monitor :size="12" /> Desktop account</span>
          <h2 id="account-dialog-title">Keep Guest access, or sign in on desktop.</h2>
        </div>
        <button type="button" aria-label="Close account dialog" @click="emit('close')">
          <X :size="18" />
        </button>
      </header>

      <div class="account-choice-grid">
        <article class="account-choice guest-choice" :class="{ active: !account }">
          <span class="account-choice-icon"><UserRound :size="19" /></span>
          <div>
            <strong>Guest access</strong>
            <p>Draw, animate, save, and export without an account or network connection.</p>
          </div>
          <span class="account-choice-state"><Check :size="13" /> Always available</span>
        </article>

        <article class="account-choice google-choice" :class="{ active: Boolean(account) }">
          <template v-if="account">
            <img v-if="account.picture" :src="account.picture" width="42" height="42" alt="" />
            <span v-else class="account-choice-icon"><UserRound :size="19" /></span>
            <div>
              <strong>{{ account.name }}</strong>
              <p>{{ account.email }}</p>
            </div>
            <span class="account-choice-state"><ShieldCheck :size="13" /> Connected</span>
          </template>
          <template v-else>
            <span class="account-choice-icon google-letter" aria-hidden="true">G</span>
            <div>
              <strong>Google account</strong>
              <p>Use your Google identity in the desktop app. Projects and artwork stay local.</p>
            </div>
            <span class="account-choice-state"><ShieldCheck :size="13" /> Optional</span>
          </template>
        </article>
      </div>

      <div class="account-privacy-note">
        <ShieldCheck :size="16" />
        <p>
          Sign-in opens Google in your system browser. Zakape stores the account profile locally and
          protects the desktop refresh token in your operating-system credential vault. No artwork
          is uploaded.
        </p>
      </div>

      <p v-if="errorMessage" class="account-message error" role="alert">{{ errorMessage }}</p>

      <footer>
        <div class="account-build-state">{{ buildState }}</div>
        <div class="account-dialog-actions">
          <button v-if="account" type="button" class="account-danger-action" @click="signOut">
            <LogOut :size="15" /> Sign out
          </button>
          <button
            v-else
            type="button"
            class="account-google-action"
            :disabled="status === 'loading' || !configuration?.available"
            @click="signIn"
          >
            <LoaderCircle v-if="status === 'loading'" class="spin" :size="16" />
            <LogIn v-else :size="16" />
            Continue with Google
          </button>
        </div>
      </footer>
    </section>
  </div>
</template>
