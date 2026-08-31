# Security policy

Zakape is pre-1.0 and currently supports the latest commit on `main`.

Please do not open a public issue for a vulnerability. Use GitHub's private vulnerability reporting for this repository. Include reproduction steps, affected platforms, and impact.

Model API keys are session-only in the current application. Zakape persists the model endpoint and model name, but not the secret. Do not add logging that can expose prompts, art data, bearer tokens, or provider responses.
