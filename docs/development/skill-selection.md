# Development skill selection

Installed through the `skills.sh` CLI on 31 August 2026:

- `anthropics/skills@frontend-design` — intentional visual direction for the editor and public website.
- `anthropics/skills@webapp-testing` — Playwright interaction tests and UI snapshots.
- `vercel-labs/agent-skills@web-design-guidelines` — accessibility and interface review.
- `vercel-labs/agent-skills@writing-guidelines` — open-source documentation review.

The skills are project-scoped under `.agents/skills` and recorded by `skills-lock.json`. Broad framework skills were not installed because Nuxt and Tauri maintain authoritative versioned documentation, and adding unrelated instructions would increase maintenance and supply-chain surface.
