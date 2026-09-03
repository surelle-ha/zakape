# Commit workflow

Zakape uses Conventional Commits so release automation can derive predictable semantic versions and changelogs.

Run `pnpm install` once to enable the Husky hooks. The pre-commit hook checks formatting, and the commit-message hook validates the message with Commitlint.

Use this shape:

```text
type(optional-scope): concise command-style summary
```

Common types are `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, and `chore`. Examples:

```text
feat(canvas): add indexed palette remapping
fix(android): preserve adaptive launcher icon
docs: explain local model privacy
```

Run `pnpm commitlint` to validate the latest commit manually. Full lint, type, unit, browser, Rust, and build gates remain enforced by continuous integration.
