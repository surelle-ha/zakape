#!/usr/bin/env sh
set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
android_root="$repository_root/apps/studio/src-tauri/gen/android"

if [ -f "$android_root/keystore.properties" ]; then
  echo "Refusing to build: remove gen/android/keystore.properties for an unsigned F-Droid build." >&2
  exit 1
fi

export NUXT_TELEMETRY_DISABLED=1
cd "$repository_root"
pnpm install --frozen-lockfile
pnpm build:android:fdroid
