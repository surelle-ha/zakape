# Release process

1. Update the version and changelog.
2. Run `pnpm check`, `pnpm build`, and the desktop build for the target platform.
3. Push a signed tag in the form `v0.x.y`.
4. The release workflow builds Windows, macOS, and Linux bundles and attaches them to a GitHub release.
5. The Pages workflow publishes the static site from `apps/site` on updates to `main`.

Unsigned alpha bundles may trigger operating-system warnings. Code-signing and updater keys must be configured as repository secrets before automatic updates are enabled.
