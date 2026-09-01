# Release process

Zakape releases use SemVer and Conventional Commits. Every push to `main` runs CI and updates an automated release pull request:

- `fix:` and `perf:` changes produce a patch release.
- `feat:` changes produce a minor release.
- `feat!:`, `fix!:`, or a `BREAKING CHANGE:` footer produces a major release.
- Documentation, test, build, and CI-only commits do not create a version by themselves.

Merging the release pull request performs the complete delivery sequence:

1. Release Please synchronizes the root, website, studio, Tauri, and Cargo versions and updates `CHANGELOG.md`.
2. A draft `vX.Y.Z` GitHub release and version tag are created.
3. Tauri builds Windows installers, macOS bundles, and Linux packages in parallel.
4. Each native bundle is attached to the draft release.
5. The release is published only after every platform build succeeds.

If a platform build is interrupted, run the **Desktop release** workflow manually with the existing draft tag to rebuild and publish it. Do not create version tags by hand.

The workflow needs **Read and write permissions** and **Allow GitHub Actions to create and approve pull requests** under **Settings → Actions → General → Workflow permissions**. A repository administrator must configure these once.

## macOS signing

macOS releases are universal binaries for Apple Silicon and Intel Macs. The release workflow refuses to publish unless it can sign, notarize, and staple the macOS bundle using these repository secrets:

- `APPLE_CERTIFICATE`: base64-encoded Developer ID Application `.p12` certificate.
- `APPLE_CERTIFICATE_PASSWORD`: password used when exporting the certificate.
- `APPLE_ID`: Apple Developer account email used for notarization.
- `APPLE_PASSWORD`: app-specific password for that Apple ID.
- `APPLE_TEAM_ID`: team ID from the Apple Developer membership page.

Create the certificate and app-specific password through the paid Apple Developer account. Never use a regular Apple ID password or commit certificate material to the repository. Tauri imports the certificate into a temporary CI keychain, signs the universal application, submits it to Apple for notarization, and staples the accepted ticket before uploading the DMG.

The Pages workflow publishes the static site from `apps/site` on updates to `main`.

Before the first website deployment, a repository administrator must select **GitHub Actions** under **Settings → Pages → Build and deployment → Source**. GitHub does not allow a collaborator or the default workflow token to create the initial Pages site. Later deployments need no manual step.

Unsigned alpha bundles may trigger operating-system warnings. Code-signing and updater keys must be configured as repository secrets before automatic updates are enabled.
