# Privacy

Effective September 4, 2026

Zakape is a local-first application. Zakape does not require an account, include advertising or analytics SDKs, or send project content to the project maintainers.

## Data stored on your device

Zakape stores sprite projects, recent-project previews, preferences, and optional assistant chat history on the device where the app runs. Native project files are stored in the app's private data directory on Android and in `Documents/zakape` on desktop. Removing application data or uninstalling the Android app removes its private local data. Exported files remain wherever you saved them.

## Network access

Core drawing, animation, project storage, and export features work offline. Android requests internet permission only so a user can choose to connect the optional art assistant to a model service. Zakape does not contact a model provider until the user configures a connection and sends a request. Requests are sent directly to the endpoint selected by the user, and that provider's terms and privacy practices apply.

Desktop builds may contact the public GitHub release endpoint to check for signed application updates. The Android build does not include the desktop updater. The Zakape website is static and does not include analytics or advertising code.

## Contact

Privacy questions can be opened in the public [Zakape issue tracker](https://github.com/surelle-ha/zakape/issues). Do not include private project content, credentials, or personal information in a public issue.
