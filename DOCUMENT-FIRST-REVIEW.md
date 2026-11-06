# Document-first review — crm

Guide: Pagelove Document-first development edition2.4, revised2026-11-04; supplied source SHA256 `322d0c1c1c016787edeb67702c62c69610f26916933d0f34ec3dd7b2468b26dc`. Actor: Codex. Review source: `f11d0628a428348443c61af2fb84e9ca8c029955`. Maintainer: repository maintainers. Profiles: A2/A4.

## Model, authority and lifecycle

site/crm-demo/index.html: #people and #log; stable contact and conversation IDs. Read-only people/log arrays derive from those DOM collections; current forms produce escaped HTML commands.

## Operation, state and recovery contract

GET canonical body establishes a strong source revision. POST appends contacts/conversations; conditional PUT updates dueEpoch only after re-reading conversations. A conversation and due-date update are deliberately two steps: partial success is visible and due-only recovery never repeats the conversation.

Local preview: 262144-byte command bound. Clinical/financial decisions, multi-owner workflows, live subscriptions and guaranteed offline shared writes are not offered. Timeout recovery checks generated stable IDs before retry; form text survives refused/stale writes in-page. Copy/export before closing an unsaved form; no claim of durable CRM form backup.

## Enforcement and effects

Fictional open sample; private fixture denies anonymous reads locally. Exact production read/list/export/permission/uniqueness/schema enforcement remains a target-host acceptance gate. No owner token in browser.

## W1–W8 / R01–R12 acceptance

- W1–W3 / R01–R04: selected profiles, HTML preference, stable identities, owned aggregates and the representation exception above are the governing source contract. Derived caches/runtime arrays cannot become independent editable authorities.
- W4 / R05–R07: inspect exact canonical address/selector, actor, source revision and actual enforcement before enabling a newly relied-on mutation. Local fixtures and declaration review do not establish target-host privacy or validation.
- W5–W6 / R08–R10: distinguish working draft, frozen pending command, accepted state and unknown outcome. Preserve original data on rejected/future imports. No automatic external-effect replay. Offline collaboration/subscription features are not implied by browser storage; add tested scope/disposal/reconnect contracts before offering them.
- W7–W8 / R09–R12: audit/CHANGELOG.md records current commands, revisions and results. Existing REVIEW evidence remains historical. Re-run the appropriate source/shape/round-trip/concurrency/negative checks, then actual affected browser tasks. Never label pending live, maximum-device, assistive, restore or security checks as passed.

## Release and maintenance gates

Preserve user records, mutable source paths and incompatible backups during code updates. Do not replace a live document containing user records with a seed. Exclude credentials/private payloads from source, logs, public examples and previews. Pin coupled runtime/definition versions and retain rollback assets. Before real private or consequential use, verify supported read/write paths with valid and known-invalid/unauthorized requests on the actual host, exercise restoration in isolation, and record device/performance/accessibility limits. No new service or identity provider is authorized by this record. Re-review when format, source route, write adapter, host configuration, rules or runtime changes.
