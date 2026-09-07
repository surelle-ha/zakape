# Artifact contract

Each record is self-contained:

```text
docs/specs/records/<SPEC-ID>/
  spec.json
  spec.md
  plan.md
  tasks.md
  history.ndjson
```

`spec.json` is the machine-readable lifecycle and graph record. Markdown holds human-reviewable requirements, reasoning, and execution detail. Keep overlapping facts consistent.

## Lifecycle

```text
clarifying -> specified -> planning -> planned -> in_progress -> completed
                                  \-> blocked -> planning/planned/in_progress
```

`cancelled` is terminal. Never manufacture a completion or bypass state gates by directly changing status.

## IDs and selection

IDs match the pattern in `docs/specs/system.json`, such as `AUTH-K7M2`. The area is meaningful; the suffix is random and excludes ambiguous characters. IDs never encode order or priority. Exact ID selection wins, and status is discovered by scanning records.

## History and memory

`history.ndjson` is append-only operational provenance. Use project memory only for durable context that should guide unrelated future work:

- `overview.md`: stable product boundaries and subsystem map;
- `architecture.md`: ownership, data flow, and trust boundaries;
- `conventions.md`: recurring engineering and delivery rules;
- `decisions.md`: architectural/product decisions and rationale;
- `history.md`: important milestones and provenance.

Do not turn project memory into a chat transcript or duplicate every spec-local detail. Update it when a completed spec changes a lasting contract. Keep all AI-development documentation under `docs/`.
