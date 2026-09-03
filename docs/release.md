# Release Zakape

Zakape uses Semantic Versioning, Conventional Commits, Release Please, and signed Tauri bundles. Every push to `main` runs CI and updates the automated release pull request.

- `fix:` and `perf:` changes produce a patch release.
- `feat:` changes produce a minor release.
- `feat!:`, `fix!:`, or a `BREAKING CHANGE:` footer produces a major release.
- Documentation, test, build, and CI-only commits do not change the version by themselves.

Merging the release pull request starts the complete desktop delivery sequence:

1. Release Please synchronizes the root, website, studio, Cargo, and Android versions, then updates `CHANGELOG.md`. Tauri resolves the studio package version directly.
2. GitHub creates a draft `vX.Y.Z` release and version tag.
3. Tauri builds the Windows and Linux packages. It also builds macOS when Apple credentials are available.
4. A release-owned Android job builds and verifies the ARM64 APK, renames it to `Zakape-X.Y.Z-android-arm64.apk`, and attaches it directly to the same draft release.
5. Each desktop job signs its updater archive and attaches the native bundle, updater signature, and platform metadata.
6. The release action uploads a merged `latest.json` manifest.
7. GitHub publishes the release only after every selected desktop build and the Android APK succeed.

If a platform build is interrupted, run the **Desktop release** workflow manually with the existing tag and the **all** target. Do not create version tags by hand.

The workflow needs **Read and write permissions** and **Allow GitHub Actions to create and approve pull requests** under **Settings > Actions > General > Workflow permissions**.

## Ship signed desktop updates

Installed desktop builds check the [latest update manifest](https://github.com/surelle-ha/zakape/releases/latest/download/latest.json) shortly after launch.

The automatic check is quiet. An available update appears in the bottom status strip, while **Help > Check for updates** performs a manual check. The update dialog reports checking, download, installation, failure, current-version, and relaunch states. Windows may close after starting its installer; macOS and Linux prompt for a relaunch after installation.

Android does not use the Tauri desktop updater. Google Play continues to manage Android updates and signing.

Tauri verifies every archive before installation with this public key:

```text
dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEQ1NTI1MjRBMjlGQUIxRUUKUldUdXNmb3BTbEpTMVdSS25ZQko0VG5VUHh6ZVlGU01CZCtpa1QwcG12ZkFjdktoaWxQMC9mU0EK
```

The repository never stores the corresponding private key. The release workflow reads it from these GitHub Actions secrets:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

The development machine keeps a recovery copy in `.secrets/zakape-updater.key`. It stores the password in `.secrets/zakape-updater-password.txt`. Git ignores the whole `.secrets/` directory. Back up both files in an encrypted password manager or offline vault. GitHub does not allow secret values to be downloaded after upload.

Losing the private key breaks the update path for existing installations: a newly generated key cannot produce signatures accepted by the public key embedded in those builds. Key rotation therefore requires a manually installed bridge release or a new manual installation. Never print, commit, attach, or paste the private key into logs or documentation.

## Sign and notarize macOS builds

macOS releases are universal binaries for Apple Silicon and Intel Macs. The workflow includes a macOS asset only when it can sign, notarize, and staple the bundle using these repository secrets:

- `APPLE_CERTIFICATE`: base64-encoded Developer ID Application `.p12` certificate.
- `APPLE_CERTIFICATE_PASSWORD`: password used when exporting the certificate.
- `APPLE_ID`: Apple Developer account email used for notarization.
- `APPLE_PASSWORD`: app-specific password for that Apple ID.
- `APPLE_TEAM_ID`: team ID from the Apple Developer membership page.

Create the certificate and app-specific password through the paid Apple Developer account. Never use a regular Apple ID password or commit certificate material. Tauri imports the certificate into a temporary continuous integration (CI) keychain. It signs the universal application, submits it to Apple, and staples the accepted ticket before uploading the Apple disk image (DMG).

Without these secrets, the workflow publishes Windows and Linux assets and adds a macOS availability notice. After configuring the secrets, run **Desktop release** with the published tag and the **macos** target to attach the signed package to the existing release.

## Publish Android builds

The **Android** workflow builds and verifies an Android package (APK) on relevant pushes and pull requests as a development quality gate. Release attachment belongs to the **Desktop release** workflow itself. The release job passes the draft release ID directly to every asset uploader because GitHub can temporarily expose a newly tagged draft under an `untagged-*` placeholder. Uploading by immutable release ID avoids that lookup race. The release cannot publish without `Zakape-X.Y.Z-android-arm64.apk`.

Manual dispatch can produce a signed Android App Bundle (AAB). It can upload the bundle after you configure signing and service-account secrets. Upload the first Play Console bundle manually to establish Play App Signing and application programming interface (API) access.

Release Please synchronizes the SemVer source used to derive Android's numeric `versionCode`. Keystores and signing-property files are ignored. See the [Android build guide](android.md) for local commands, output locations, and required secrets.

## Publish the website

The Pages workflow publishes the static site from `apps/site` after updates to `main`. Before the first deployment, a repository administrator must choose **GitHub Actions** under **Settings > Pages > Build and deployment > Source**. Later deployments need no manual step.
