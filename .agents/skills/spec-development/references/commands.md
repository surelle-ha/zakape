# Command contract

Run commands from the repository root through `pnpm spec`.

## Discovery and reading

- `resume [ID]`: discover all pending work or recover the context for one explicit ID.
- `status [ID]` / `specs`: show state discovered from record directories. There is no current-spec pointer.
- `inspect ID`: summarize a record and its artifact location.
- `dependencies ID`: show direct and transitive dependencies, types, states, and implementation readiness.
- `history [ID]`: read append-only spec history, or the latest event for every spec.
- `validate [ID]`: check records, required content, references, lifecycle requirements, and dependency cycles.

## Specification

```bash
pnpm spec specify --area AUTH --title "Desktop session recovery" --summary "Restore a protected desktop session after restart."
pnpm spec specify AUTH-K7M2 --finalize
```

Creation produces a random, nonsequential code ID and `clarifying` artifacts. Finalization requires concrete required sections, at least one challenged question/answer/decision, and no open questions.

## Planning

```bash
pnpm spec plan AUTH-K7M2
pnpm spec plan AUTH-K7M2 --finalize
```

Starting planning changes `specified` to `planning`. Finalization requires a concrete plan, actionable tasks, affected files, risks, and validation strategy, then changes it to `planned`.

## Dependency management

```bash
pnpm spec dependency AUTH-K7M2 --add CORE-P9TX --type critical --reason "Session encryption requires the new key store."
```

Critical means implementation cannot safely satisfy its contract without the dependency. Advisory means related unfinished work could improve coordination but does not invalidate independent delivery. Missing targets, duplicates, self-dependencies, and cycles are invalid.

## Implementation and completion

```bash
pnpm spec implement AUTH-K7M2
pnpm spec implement AUTH-K7M2 --override --reason "The compatibility adapter isolates the pending API safely."
pnpm spec evidence AUTH-K7M2 --note "Unit and desktop recovery tests passed."
pnpm spec implement AUTH-K7M2 --complete
```

The override form is reserved for explicit user-authorized critical dependency overrides. Completion requires all task checkboxes and validation evidence.

Use `event ID --note "..."` for durable deviations or discoveries. Use `status ID --set blocked|cancelled --note "..."` only when that state accurately reflects the work.
