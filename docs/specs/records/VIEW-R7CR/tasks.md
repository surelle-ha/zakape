# VIEW-R7CR tasks

Tasks are dependency-ordered; `[P]` tasks may run in parallel only after their prerequisites are complete.

- [ ] T01 — Capture the desktop, phone, and tablet baseline behavior and add failing selectors/assertions for menu state, toolbar contents, Home disabling, and touch placement. (AC-1, AC-3, AC-5, AC-7)
- [ ] T02 — Create the typed shared `ApplicationMenu.vue` command model and move existing desktop File/Edit/View/Help and About behavior into it without adding a second global shortcut listener. (AC-1, AC-2, AC-6, AC-8)
- [ ] T03 — Add Transparency checkerboard and Live view to the shared View group, disable all canvas views on Home, and remove all four display controls plus orphaned markup/imports from the zoom toolbar while retaining O, V, G, and Shift+G. (AC-1, AC-2, AC-3, AC-4, AC-7)
- [ ] T04 — Add the touch-only Menu trigger before Home and implement its upward, safe-area-aware File/Edit/View/Help hierarchy with one-category expansion, platform availability, touch targets, focus, and every dismissal path. (AC-5, AC-6, AC-7, AC-8)
- [ ] T05 [P] — Complete desktop Playwright regression coverage for all view states, shortcut synchronization, zoom-only controls, Home disabling, persistence neutrality, and preserved Help actions. (AC-1, AC-2, AC-3, AC-4, AC-7, AC-8)
- [ ] T06 [P] — Complete phone and tablet Playwright coverage for Menu ordering, nested children, representative equivalent commands, view toggles, unavailable actions, dismissal, viewport bounds, and toolbar removal. (AC-3, AC-5, AC-6, AC-7, AC-8)
- [ ] T07 — Update `docs/project-workspace.md` and `docs/qa.md`, regenerate the intended desktop/phone/tablet baselines, and inspect the full-size results including a manual phone-landscape pass. (AC-3, AC-5, AC-6, AC-8)
- [ ] T08 — Run all planned engineering gates, record exact validation evidence and any plan deviations in the spec, update durable project memory only if a lasting architecture convention changes, and complete the spec only when every task is checked. (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8)
