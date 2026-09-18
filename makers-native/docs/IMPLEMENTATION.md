# Makers Native — Implementation and Acceptance

Status date: 2026-09-18. This plan replaces the old migration sequence for the new directory. It is not a declaration that the implementation is complete.

## Stage 0 — Official capability review and architecture baseline

Completed in this change: read the official skill router, recipes, storage/Blob references, Node Cloud Functions reference and Agent/environment conventions; record the reviewed source; define a greenfield Makers-native architecture; preserve the product and simple pricing policy; identify hard release gates.

Not completed: installation into the user's computer, npm dependency installation, frontend scaffolding, runtime implementation, test execution, Makers account linkage, provisioning or deployment.

## Stage 1 — Native project and guest desktop

Create an independent React/TypeScript/Vite project with its own lockfile, build scripts and Makers configuration. Implement the desktop shell, browser routing, Dock, folders, editable shortcuts, a small official app registry and settings. Use original DTab assets and keep the selected iOS/iPadOS-style interaction direction. Do not import legacy code or service workers.

Acceptance: type check, build, real browser interaction, keyboard/touch and responsive tests; deep-link refresh; no fake installed apps or usage statistics. Makers CLI integration must confirm that unknown `/api/*` paths do not silently return the frontend HTML. Frontend-only success is not proof that Cloud Functions deployed.

## Stage 2 — Blob, identity and personal synchronization

Implement server-side object repositories with strong reads and schema validation. Verify the Blob SDK version and runtime behavior before choosing a lockfile version. Implement native identity using reviewed authentication primitives, account reservation, session creation/revocation and server-side ownership. Add local-first desktop synchronization with preserved snapshots and explicit conflicts.

Acceptance: registration collision, concurrent create, malformed input, account enumeration/rate abuse controls, credential reset policy, cookie/CSRF behavior, account switching, disabled-account denial, logout revocation, expired sessions, cross-user object access, multi-device edits and interrupted writes. Never use a UI-only uid check as authorization.

Identity implementation cannot be marked production-ready without a demonstrated uniqueness and recovery design. An account-control page is not the same as working secure Auth.

## Stage 3 — Store, gallery, presets and administration

Implement official catalog records, installs separate from placements, gallery upload/read/delete, published preset versions, admin roles and audit events. New presets must not automatically replace existing users' desktop state. File metadata and object bytes need recoverable lifecycle states.

Acceptance: private-media source/CDN bypass, signed-upload abuse, content validation, size limits, expired uploads, abandoned object handling, pagination, authorization for every admin operation, rollback of published versions and preservation of user content.

## Stage 4 — One real AI application

Introduce one bounded AI application using Makers Models and, where needed, one selected Makers Agent template. Do not install all supported Agent SDKs. Add authenticated subject/conversation/run binding, server-side model selection, streaming, cancellation, tool limits, error display and usage records.

Acceptance: verify the actual configured gateway, model availability, stream protocol, abort behavior, conversation isolation, request/run correlation and redacted logs. Do not interpret a console provider list as enabled paid credentials. Explicitly distinguish internal test calls from publicly funded AI access; no real paid calls without the appropriate authorization.

## Stage 5 — Commercial settlement

Keep the single-membership and two-points-pool product rules. Establish service-side concurrency guarantees before implementation is accepted. Test same-user parallel runs, duplicate payment callbacks, duplicate grant events, insufficient credit, mixed daily/purchased grants, cross-midnight work, membership expiry, partial upstream failures, unknown billing outcomes, refunds, retries and operator reconciliation.

Required outcome: no duplicate grants or debits, no double spending, no fabricated success after ambiguous failure, and a recoverable audit trail. A raw Blob increment/decrement or an eventual KV lock is rejected. A successful small stress test does not replace a documented primitive guarantee and a reviewed algorithm.

Until accepted: real checkout, recharge, paid-AI public access and automatic charging remain disabled. This is a release gate, not a deletion of the planned commercial functionality. Do not add SQL/New API in the background to avoid resolving the Makers-only requirement.

## Configuration

The adjacent .env.example declares the documented gateway names plus draft DTab-owned application names. It contains no live credentials. Those DTab names are a contract proposal; no current implementation reads them yet. Enabling an environment flag alone is not sufficient authorization to activate a payment feature.

Do not ask the user to paste API Tokens, model keys, session secrets or payment secrets into chat. Configure them in the appropriate authorized local environment or Makers secret settings when that stage is ready.

## Current verification report

| Check | State | Evidence / scope |
| --- | --- | --- |
| Official skill/source read | Done | skill-source.json and cited source files |
| Separate rebuild branch | Created | feat/makers-native-foundation |
| Old main/code preservation | Required by this change | Only new makers-native/ files are added |
| Dependency security/compatibility | Not run | No application dependencies selected or installed |
| Type/build/unit/E2E tests | Not run | Documentation baseline, no runnable application |
| Blob CRUD/onlyIfNew/concurrency | Not run | No authorized Makers test project used |
| Auth/private files | Not implemented | Stage 2/3 gates |
| Models/Agents invocation | Not run | No live key/model call used |
| Payments/points settlement | Not implemented | Stage 5 gate |
| Production deployment | Not run | No production settings changed |

Add real execution reports as stages are implemented. Never copy old test counts, call a planned command an executed test, or claim a cloud deployment from the presence of configuration files.
