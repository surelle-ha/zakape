# Zakape specification system

Zakape keeps substantial feature work in a repository-native, dependency-aware specification system. Specs use random code IDs such as `AUTH-K7M2`; their IDs and execution do not depend on creation order.

Start every session with:

```bash
pnpm spec status
pnpm spec resume
```

The commands are state and validation tools. The repository skill at `.agents/skills/spec-development/SKILL.md` defines how an AI agent investigates, challenges, plans, and implements the work.

## Commands

```bash
pnpm spec specify --area AUTH --title "Desktop session recovery" --summary "Restore a protected desktop session."
pnpm spec specify AUTH-K7M2 --finalize
pnpm spec plan AUTH-K7M2
pnpm spec plan AUTH-K7M2 --finalize
pnpm spec implement AUTH-K7M2
pnpm spec implement AUTH-K7M2 --complete
pnpm spec status [AUTH-K7M2]
pnpm spec specs
pnpm spec dependencies AUTH-K7M2
pnpm spec inspect AUTH-K7M2
pnpm spec resume [AUTH-K7M2]
pnpm spec validate [AUTH-K7M2]
pnpm spec history [AUTH-K7M2]
```

Use `pnpm spec help` for mutation flags, including dependency management, event recording, and an explicit critical-dependency override.

## Lifecycle

```text
clarifying → specified → planning → planned → in_progress → completed
                                      ↘ blocked ↗
```

- `specify` combines request definition and clarification. A new record stays `clarifying` until the challenge record, requirements, acceptance criteria, constraints, assumptions, edge cases, and open questions are resolved.
- `plan` combines implementation planning and task generation. It analyzes code, tests, history, dependencies, affected files, risks, and validation in one phase.
- `implement` may start any planned spec. Unfinished advisory dependencies produce warnings. Unfinished critical dependencies block by default, but a deliberate `--override --reason "..."` is logged in the spec history.
- Completion requires every generated task to be checked and validation evidence to be recorded.

Status is derived by scanning `records/*/spec.json`; there is no sequential “current spec” pointer. This makes parallel branches and independent pending work safe.

## Persistent memory

`docs/project-memory/` records durable product context, architecture, conventions, decisions, and important history. Agents update it when a completed spec changes a lasting contract. Spec-local investigation and implementation history stay within each record. Everything is committed so a new clone can recover context without a prior chat.
