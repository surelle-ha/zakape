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

The Pages workflow publishes the static site from `apps/site` on updates to `main`.

Before the first website deployment, a repository administrator must select **GitHub Actions** under **Settings → Pages → Build and deployment → Source**. GitHub does not allow a collaborator or the default workflow token to create the initial Pages site. Later deployments need no manual step.

Unsigned alpha bundles may trigger operating-system warnings. Code-signing and updater keys must be configured as repository secrets before automatic updates are enabled.
