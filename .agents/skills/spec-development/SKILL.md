---
name: spec-development
description: Manage Zakape's repository-native specifications when users invoke specify, plan, implement, status, specs, dependencies, inspect, resume, validate, or history, or when substantial feature work needs dependency-aware planning and persistent project memory.
---

# Spec Development

Use the repository as the durable source of truth. Never infer a global "current" spec or select work by creation order.

## Begin every substantial development session

1. Run `pnpm spec resume`.
2. Read `docs/project-memory/overview.md`, plus the architecture, conventions, decisions, or history files relevant to the request.
3. If the user names an ID, inspect that exact record with `pnpm spec inspect ID` and `pnpm spec dependencies ID`.
4. Inspect relevant source, tests, docs, existing specs, and Git history before changing a record.
5. If a title matches multiple records, ask the user to choose an ID. Never guess from recency.

Use [commands.md](references/commands.md) for command semantics and state transitions. Use [artifacts.md](references/artifacts.md) when editing a spec, plan, tasks, history, or project memory.

## Specify and clarify together

When creating a substantial spec, create a `clarifying` record and then challenge the request in focused, non-redundant rounds. Read [challenge-guide.md](references/challenge-guide.md) before questioning.

- Verify the problem and evidence rather than accepting the proposed solution as the only design.
- Surface product boundaries, platform behavior, failure and recovery paths, migrations, privacy/security, performance, compatibility, accessibility, acceptance criteria, and explicit non-goals when relevant.
- Automatically compare existing specs, source, documentation, and history for likely critical or advisory dependencies.
- Record answered questions and resulting decisions in both `spec.md` and `spec.json`.
- Keep material unknowns in `clarification.openQuestions`. Do not run `specify ID --finalize` until they are resolved and every required section is concrete.

Do not ask questions already answered by the repository. Group related questions and explain why a choice matters. Challenge risky assumptions with evidence.

## Plan and generate tasks together

For `plan ID`, inspect the selected spec and its dependency graph, then inspect the exact implementation surfaces and their history. Starting the command moves the record to `planning`; it does not generate trustworthy content automatically.

In the same pass:

- Write the architecture and implementation approach.
- Identify concrete affected files and ownership boundaries.
- Reconcile detected dependencies and safe sequencing.
- Cover contracts, data migrations, rollback/recovery, risks, and mitigations.
- Generate dependency-ordered, acceptance-linked, independently verifiable tasks. Mark `[P]` only where work is truly parallel-safe.
- Map acceptance criteria to automated and manual validation.
- Synchronize `affectedFiles`, `risks`, and `validation` in `spec.json`.

Run `pnpm spec validate ID`, resolve findings, and only then run `pnpm spec plan ID --finalize`.

## Implement with dependency gates

Before editing implementation files, run `pnpm spec dependencies ID`.

- Recommend completing unfinished dependencies first.
- Advisory dependencies warn but do not prevent work.
- Critical dependencies block by default. Only override after the user explicitly chooses to proceed and provides a concrete reason; use `--override --reason` so it becomes durable history.
- Follow the recorded tasks, checking them as evidence is produced. Record important deviations with `pnpm spec event ID --note "..."` and update the plan when the approach changes.
- Validate proportionally to risk, record results with `pnpm spec evidence ID --note "..."`, update durable project memory for lasting decisions, and complete only after all tasks and validation are done.

Never mark work complete because a session is ending. Do not rewrite `history.ndjson`; it is append-only.

## Scope

An explicit supported command always invokes this workflow. For ordinary work, use it for substantial features, migrations, cross-cutting changes, or work that benefits from durable dependency tracking. Tiny, isolated maintenance may proceed directly unless the user requests a spec.
