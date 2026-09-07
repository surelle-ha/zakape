# Privacy

Effective September 4, 2026

Zakape is a local-first application. Zakape does not require an account, include advertising or analytics SDKs, or send project content to the project maintainers. Guest access is always available.

## Data stored on your device

Zakape stores sprite projects, recent-project previews, preferences, and optional assistant chat history on the device where the app runs. Native project files are stored in the app's private data directory on Android and in `Documents/zakape` on desktop. Exported files remain wherever you saved them.

Android marks its native project mirror for encrypted operating-system backup and device-to-device transfer, and asks Android to offer **Keep app data** during uninstall. Whether a backup is created or restored depends on the device's backup settings, available quota, encryption support, uninstall choice, and backup provider. That provider may store project content outside the device under its own terms. Clearing app data explicitly still removes local projects. Exported `.zakape` files are the reliable manual recovery path when device backup is disabled or a project exceeds the provider's limits.

An artist may optionally connect a Google account in the desktop app. Zakape stores the connected account's Google identifier, name, email address, and optional profile-picture URL in local preferences. The access token is kept in memory and the refresh token is stored in the operating-system credential vault. Google login does not upload project or artwork content. Google's terms and privacy policy apply to the sign-in exchange.

## Network access

Core drawing, animation, project storage, and export features work offline. Android requests internet permission only so a user can choose to connect the optional art assistant to a model service. Google login is not included on mobile. On desktop, Zakape contacts Google only after the user starts sign-in or while restoring an existing connected session. Zakape does not contact a model provider until the user configures a connection and sends a request. Model requests may contain the artist's prompt, structured canvas and animation context, and bounded rendered PNG previews. Ollama requests use a loopback connection. Compatible API requests are sent directly to the endpoint selected by the user. The desktop Codex option starts the installed Codex CLI with its existing ChatGPT or API-key sign-in; those requests are processed by the service associated with that login. The selected provider's terms and privacy practices apply. Zakape does not persist the rendered previews.

Desktop builds may contact the public GitHub release endpoint to check for signed application updates. The Android build does not include the desktop updater. The Zakape website is static and does not include analytics or advertising code.

## Help diagnostics and support links

**Help → Copy System Info** runs only when you choose it. It creates a plain-text summary with the Zakape version, build identifier, release type, operating-system family/version, architecture, locale, and a generic rendering-engine label, then writes it to your clipboard. It is not stored, logged, uploaded, or attached to an issue automatically. The summary never includes your name, hostname, device ID, IP address, paths, projects, account, model settings, prompts, tokens, or credentials.

**Report a Bug**, **Suggest a Feature**, and **Support Zakape Development** open the maintained GitHub issue forms or Ko-fi in your system browser. Zakape does not pre-fill or submit an issue, and a failed browser launch does not interrupt artwork or project state.

## Contact

Privacy questions can be opened in the public [Zakape issue tracker](https://github.com/surelle-ha/zakape/issues). Do not include private project content, credentials, or personal information in a public issue.
