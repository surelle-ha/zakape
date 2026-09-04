# Google login for desktop

Google login is optional and currently available only in installed Windows, macOS, and Linux builds. After the splash, a dedicated entry page asks the artist to choose Google or Guest access before Home opens. The saved choice is restored on later launches; the entry page returns after sign-out or whenever no valid choice exists. Guest access requires no network connection and has the same drawing, animation, project, and export capabilities. Google login does not upload artwork or enable cloud project storage.

## Authentication design

Zakape uses Google's OAuth 2.0 Authorization Code flow for installed applications with PKCE, a cryptographically random and verified state value, and a loopback callback on a random local port. Authentication opens in the system browser rather than an embedded sign-in view.

The short-lived access token remains in memory. The refresh token is stored in the operating-system credential vault. Zakape stores the account identifier, name, email address, and optional profile-picture URL in its local preferences so it can present the last connected identity before restoring the protected session. Signing out revokes the current access token when possible and deletes the stored refresh credential.

The Home banner does not duplicate account identity. On desktop, the footer account name is the single persistent profile entry point. It opens a right-side drawer with identity details, connection state, local workspace location, recent activity, and on-device project, frame, and canvas-pixel statistics.

Requested scopes are limited to:

- `openid`
- `email`
- `profile`

## Google Cloud Console setup

1. Create or select the Google Cloud project used for Zakape.
2. Configure the OAuth consent screen with the Zakape app name, support email, developer contact, homepage, and privacy-policy URL.
3. Add `openid`, `email`, and `profile` to the consent screen.
4. If the publishing status is **Testing**, add every account that needs to test login as a test user.
5. Create an OAuth client with application type **Desktop app**. A fixed redirect URI is not required; installed-app loopback redirects are assigned at runtime.
6. Copy the client ID and client secret into the build configuration below. Never commit the downloaded client JSON.

Google's desktop client secret is application configuration distributed inside installed-app binaries, not a substitute for PKCE or a user password. Keeping the value in GitHub Secrets prevents accidental disclosure in source and workflow logs.

## Build configuration

Set these GitHub values:

| Kind                | Name                                  | Value                       |
| ------------------- | ------------------------------------- | --------------------------- |
| Repository variable | `ZAKAPE_GOOGLE_DESKTOP_CLIENT_ID`     | Desktop OAuth client ID     |
| Repository secret   | `ZAKAPE_GOOGLE_DESKTOP_CLIENT_SECRET` | Desktop OAuth client secret |

The desktop release workflow enables Cargo feature `google-auth` and reads both values at compile time. Changing a client requires a new desktop build.

For local PowerShell builds:

```powershell
$env:ZAKAPE_GOOGLE_DESKTOP_CLIENT_ID = 'client-id.apps.googleusercontent.com'
$env:ZAKAPE_GOOGLE_DESKTOP_CLIENT_SECRET = 'client-secret'
pnpm build:desktop
```

Do not save real credentials in a tracked script, `.env` file, documentation, issue, or screenshot.

## Mobile and F-Droid behavior

Android and iOS builds do not enable Google login or expose account sign-in controls. Their dependency graph contains no Google Identity or Play Services authentication SDK, while Guest access remains available. The F-Droid build therefore remains independent of proprietary Google services.

## Verification checklist

- Launch a desktop build without credentials and confirm the account panel gives a configuration message while Guest access works.
- Choose Guest, restart, and confirm Home opens without asking again.
- Sign in through the system browser and verify the returned name and email.
- Cancel browser authorization and verify Zakape remains usable as Guest.
- Restart Zakape and verify the credential-vault session restores.
- Open the footer profile drawer and verify the Google name, email, artwork statistics, and workspace information.
- Sign out and verify the dedicated entry page returns and another restart does not restore the account.
- Confirm Android and F-Droid builds contain no Google authentication plugin.
