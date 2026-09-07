# Challenge guide

Clarification is an investigation, not a questionnaire ritual. Inspect the repository first, then ask only questions whose answers materially affect the contract or implementation.

## Challenge dimensions

- **Problem and evidence:** What is failing or missing? Who encounters it? What repository or user evidence supports it? Is the proposed feature treating a symptom?
- **Outcome and scope:** What observable outcome defines success? What adjacent behavior must not change? Is a smaller solution sufficient?
- **Journeys and state:** Cover entry, success, empty state, cancellation, retry, interruption, concurrent edits, restart, and recovery where relevant.
- **Platforms and input:** Define desktop, phone, tablet, web-preview, keyboard, pointer, and touch differences rather than assuming parity.
- **Data and compatibility:** Identify persisted fields, migrations, imported/exported formats, forward/backward compatibility, size limits, and malformed inputs.
- **Trust and privacy:** Identify credentials, filesystem or network boundaries, permissions, untrusted content, disclosure, logging, and offline behavior.
- **Performance:** Establish representative dimensions, interaction latency, memory limits, and whether work belongs on a hot path.
- **UX and accessibility:** Define feedback, focus, shortcuts, touch targets, destructive confirmation, reduced motion, and recovery affordances.
- **Delivery:** Identify release gating, feature flags, updater/store constraints, rollback, observability, and documentation.
- **Acceptance and non-goals:** Convert subjective language into observable criteria and explicitly exclude tempting adjacent work.

## Question quality

Prefer a few grouped questions with consequences over a long generic checklist. Offer a recommended default when repository evidence supports one. Record:

1. the challenged question;
2. the user's answer or verified repository fact;
3. the resulting binding decision.

If a safe assumption is reversible and does not materially change scope, state and record it rather than blocking. Keep the spec in `clarifying` whenever an unresolved choice could change architecture, security, destructive behavior, public contracts, or acceptance criteria.
