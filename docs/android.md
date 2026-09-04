# Android builds

Zakape uses the same Nuxt editor inside Tauri on desktop, phones, and tablets. The Android package ID is `io.github.surelleha.zakape`, the minimum supported version is Android 7.0 (API 24), and the generated project targets API 36.

## Local prerequisites

Install Java 21, the Android SDK, Android SDK Platform 36, Build Tools 36.0.0, NDK `27.2.12479018`, and Rust's Android targets. Point Tauri at the SDK and NDK before building:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:NDK_HOME = "$env:ANDROID_HOME\ndk\27.2.12479018"

rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

Build an ARM64 debug APK for a current phone or tablet:

```powershell
pnpm build:android:debug
```

The package is written below `apps/studio/src-tauri/gen/android/app/build/outputs/apk/`. Install it on an attached device with ADB after enabling USB debugging:

```powershell
adb install -r path\to\app-arm64-debug.apk
```

The debug build permits cleartext traffic so development endpoints can be tested. Release builds keep cleartext traffic disabled.

## Phone and tablet layout

- Desktop widths retain the complete three-region workbench.
- Tablet widths retain the canvas, vertical tool rail, document tabs, and timeline. Layers and live preview open in a right-side sheet so the canvas stays usable.
- Phone portrait moves the drawing tools into a horizontally scrollable touch dock. The layer stack opens as a bottom sheet, nonessential titlebar actions collapse, and the timeline remains directly available.
- Short phone landscape layouts use the horizontal touch dock and a reduced timeline height.
- Canvas controls include fit-to-screen zoom, dedicated zoom buttons, grid and transparency toggles. Drawing uses Pointer Events, two-finger pinch changes zoom around the gesture midpoint, and the hand tool supports touch panning.
- Mobile overlays account for display cutouts and system navigation safe areas. Interactive drawing and timeline controls use touch-sized targets.

Android projects are mirrored to the app's private data directory and remain indexed in local PGlite storage. Desktop packages continue to mirror projects to `Documents/zakape`.

## Package validation

The Android package is exercised on a phone-sized Android 16 emulator that uses 16 KiB memory pages. QA covers cold startup, the project launcher, editor creation, touch-oriented workbench controls, and the layers bottom sheet. Native libraries are linked and ZIP-aligned for both 4 KiB and 16 KiB devices. Reference captures live in `docs/ui-snapshots/android-emulator.png` and `docs/ui-snapshots/android-emulator-workbench.png`.

The local ARM64 debug APK and debug AAB are also checked for package identity, version metadata, SDK levels, ABI contents, and signatures. The debug AAB validates bundle assembly only; Google Play releases must use the upload keystore configured below.

## F-Droid release build

F-Droid signs its own APK, so its build must not use a developer keystore. On a Unix-like build host with the pinned toolchain installed, run:

```sh
./scripts/build-fdroid.sh
```

The script refuses to build when `keystore.properties` is present, disables Nuxt telemetry, installs the frozen dependency graph, and produces an unsigned release APK. Gradle 8.14.3 is committed with both the matching wrapper JAR and the official distribution SHA-256. Store metadata and screenshots live under `fastlane/metadata/android/en-US/`; dependency provenance and scanner-facing details are recorded in [the F-Droid notes](fdroid.md).

## Google Play bundle

Google Play requires a signed Android App Bundle. Generate an upload keystore once and protect it as a long-lived release credential:

```powershell
keytool -genkeypair -v -keystore zakape-upload.jks -alias zakape-upload -keyalg RSA -keysize 2048 -validity 10000
```

For a local signed build, create the ignored file `apps/studio/src-tauri/gen/android/keystore.properties`:

```properties
storeFile=C:/absolute/path/to/zakape-upload.jks
storePassword=replace-me
keyAlias=zakape-upload
keyPassword=replace-me
```

Then run:

```powershell
pnpm build:android:bundle
```

The bundle is written below `apps/studio/src-tauri/gen/android/app/build/outputs/bundle/`. Tauri derives Android's numeric `versionCode` from the SemVer version maintained by Release Please, so every released version has a higher Play version code.

Never commit a keystore, `keystore.properties`, or passwords. Losing the upload key can prevent future updates unless Play App Signing key reset procedures are available.

## GitHub Actions

The **Android** workflow builds and verifies an ARM64 debug APK for every relevant push and pull request, then uploads it as a workflow artifact. Its manual dispatch can also build a signed ARM64/ARMv7 Play bundle. Configure these repository secrets first:

- `ANDROID_KEYSTORE_BASE64`: the complete upload keystore encoded as base64.
- `ANDROID_KEY_ALIAS`: the upload key alias.
- `ANDROID_KEY_PASSWORD`: the upload key password.
- `ANDROID_STORE_PASSWORD`: the keystore password.
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`: service-account JSON authorized for the app; only required for direct Play upload.

Run the workflow with **Build a signed Android App Bundle** enabled. Leave **Play track** set to `none` to download and manually inspect the signed AAB. After the app has been created in Play Console and its first bundle has been accepted manually, select `internal`, `alpha`, `beta`, or `production` to upload through the Google Play Developer API.

Before a public launch, complete Play App Signing, the store listing, phone and tablet screenshots, the data-safety form, content rating, target-audience declarations, and privacy-policy requirements in Play Console.
