# F-Droid build and inclusion notes

Zakape's Android application ID is `io.github.surelleha.zakape`. The application and its buildable source are published under the MIT License. The core editor works offline, has no account requirement, and contains no advertising, analytics, tracking, Firebase, Play Services, or crash-reporting SDKs.

## Reproducible toolchain inputs

The repository pins the JavaScript package manager in `package.json`, Node.js in `.node-version`, Rust in `rust-toolchain.toml`, the Android NDK in the Android workflows, and all JavaScript and Rust dependencies in lockfiles. Nuxt telemetry is disabled in configuration and in the F-Droid build script.

The committed Gradle wrapper uses Gradle 8.14.3. Its distribution is authenticated by the SHA-256 value in `gradle-wrapper.properties`:

```text
bd71102213493060956ec229d946beee57158dbd89d0e62b91bca0fa2c5f3531
```

The matching Gradle 8.14.3 wrapper JAR has SHA-256:

```text
7d3a4ac4de1c32b59bc6a4eb8ecb8e612ccd0cf1ae1e99f66902da64df296172
```

## Unsigned release build

Install JDK 21, Android SDK platform 36 and build tools 36.0.0, Android NDK 27.2.12479018, Node.js and Rust from the repository pins, and pnpm 10.17.1. Then run:

```sh
./scripts/build-fdroid.sh
```

The script refuses to run when `apps/studio/src-tauri/gen/android/keystore.properties` exists, then performs a frozen dependency installation and an unsigned release APK build. F-Droid applies its own signing after the build. No Google Play or GitHub signing secret is required.

The release version is maintained by Release Please across the root package, studio package, Cargo package, and Tauri configuration. Tauri derives the increasing Android `versionCode`; version 0.12.0 maps to version code 12000.

## Bundled WebAssembly provenance

Local browser-style persistence is provided by `@electric-sql/pglite` 0.5.8, an Apache-2.0 dependency whose source is published at [electric-sql/pglite](https://github.com/electric-sql/pglite). Its npm package includes PostgreSQL WebAssembly runtime assets. The exact dependency is locked in `pnpm-lock.yaml`; the unpacked 0.5.8 assets used by this release are:

| Asset         |    Bytes | SHA-256                                                            |
| ------------- | -------: | ------------------------------------------------------------------ |
| `initdb.wasm` |   395242 | `4c8988dca3b2f0bbfd23a0714023e4822a2909ead01804f37acffd9ff3ca9f8a` |
| `pglite.wasm` | 10088161 | `356b89f6fcb2ab3a397bec4128327b67b7137ec2a900b13251dade81bcbc0ef0` |
| `pglite.data` |  6295316 | `c574cc331d96e33311470ec57bf58c579d972c111dbd9c0ab54bb42d79ec4c0d` |

## Network behavior

The Android manifest declares internet access for the optional, user-configured model assistant. The endpoint is not hard-coded to a commercial provider, and local Ollama is supported. No request is required to draw, animate, save, or export. Desktop-only updater dependencies and initialization are excluded from Android at compile time.

Store descriptions, current screenshots, the icon, feature graphic, and version-code changelogs live in `fastlane/metadata/android/en-US/` so metadata changes can be reviewed and shipped from this repository.
