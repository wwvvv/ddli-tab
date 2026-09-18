# DTab Makers Native — Architecture v0.2

Date: 2026-09-18. Status: architecture and product proposal, not an implemented or production-ready system.

## 1. Scope and sources

Build from scratch around Makers. The user's latest instruction also permits functional modules to change. [PRODUCT.md](PRODUCT.md) is the current scope authority: desktop, app library, AI assistant, files, settings, shared activity and minimal operator administration. Prior fixed Store/Gallery routes and stage ordering are superseded.

No required Supabase, SQL database, Redis, New API, external image host, Vercel, Cloudflare runtime or production VPS is included. Existing infrastructure is not deleted. Upstream model and payment providers remain business dependencies with their own access and cost.

Official source revision f106ce7b9c5893cc3d4afafaec1eb67ed3f5b3c2 was rechecked through GitHub. Paths and primary links are in [PRODUCT.md](PRODUCT.md#7-依据与事实边界) and ../skill-source.json. The storage/Blob references document object/JSON persistence and strong reads but warn about read-modify-write races; the Agent reference documents its distinct runtime, memory, tools, streams and abort requirements. These sources do not constitute a turnkey DTab identity, permission, billing or durable-job service.

## 2. Runtime topology

```text
DTab browser: desktop / apps / assistant / files / settings
    |-- Browser-only tools and guest local state
    |
    `-- Same-origin authorized server requests
            |-- Cloud Functions: identity, files, catalog, state and activity
            |       `-- Blob: private objects + structured JSON records
            |-- Models: bounded model requests
            `-- Agent Runtime when memory/tools/sandbox are needed
                    `-- Makers Models + platform-injected capabilities

Optional only: Middleware / Edge Functions / KV for an identified edge need
```

Do not force every request through middleware, an edge function and a cloud function. Ordinary endpoints can authorize and access Blob directly. Server checks still apply at every actual data/AI entry regardless of frontend route guards.

## 3. Frontend and routes

Use React + TypeScript + Vite for the interactive desktop, with Tailwind CSS and shadcn/ui as building blocks for DTab-owned visuals. Dependency versions must be verified at scaffolding time. No SSR requirement is inferred from Makers support for Next.js.

UI routes: `/`, `/apps`, `/app/:appId`, `/assistant`, `/files`, `/files/:assetId`, `/settings`, `/settings/account`, optional `/activity`, and `/admin`. Do not implement parallel old Store/Gallery apps. Keep API and Agent endpoint routes distinct from frontend fallbacks; unknown `/api/*` requests must not return index.html with a success status.

The planned independent root contains src/, cloud-functions/api/, agents/ only when needed, server/, shared/, tests/, docs/, edgeone.json, package.json, package-lock.json and .env.example. These are planned application paths, not files claimed to exist already.

App code is source-reviewed and registered by appId/actionId. Runtime classes are client/cloud/agent; externally deployed managed apps are future work. Library visibility, desktop placement and paid authorization are independent. Admin data cannot inject arbitrary JS, remote execution URLs or unreviewed tools.

## 4. Storage and query model

Use getStore({ name, consistency: 'strong' }) for business reads/writes. Every structured object has schemaVersion. Server-controlled subject IDs and opaque object IDs define ownership. Do not expose generic prefix-list or arbitrary-key endpoints.

Proposed key families:

```text
auth/subjects/<uid>.json
auth/handles/<normalized-handle-digest>.json
auth/sessions/<token-digest>.json
users/<uid>/profile.json
users/<uid>/desktop/snapshots/<snapshot-id>.json
users/<uid>/desktop/devices/<device-id>.json
users/<uid>/apps/<app-id>.json
users/<uid>/files/<asset-id>.json
media/<uid>/<asset-id>/<variant>
users/<uid>/activity/<day>/<run-id>.json
catalog/apps/<app-id>/versions/<version-id>.json
catalog/presets/<preset-id>/versions/<version-id>.json
ai/<uid>/conversations/<conversation-id>/metadata.json
ai/<uid>/runs/<run-id>.json
audit/<day>/<event-id>.json
```

These are object key families, not relational tables. Use bounded subject/prefix queries and pagination. Do not scan all user records to serve an ordinary request or promise arbitrary joins, global full-text search or live dashboards. Materialized indexes are derived and need repair paths.

Snapshots, run events and published versions are separate records rather than one frequently overwritten global JSON. A mutable pointer is not automatically an atomic synchronization protocol. Preserve conflicting desktop revisions and offer a user decision. Uniqueness/conditional create and any index repair must be justified and tested.

## 5. Identity, files and privacy

DTab identity is application code in Cloud Functions using reviewed authentication primitives, server-verified credentials and secure HttpOnly cookies with CSRF protection. No plaintext passwords or invented crypto. Blob account-handle reservation needs documented uniqueness semantics, observable conflicts and recovery. Session revocation/account disable cannot rely solely on eventual KV or client roles.

The browser is a local workspace/cache, not the source of truth for identity, paid entitlements or spending. Keep local import/export usable and avoid silent cross-device overwrites. Exact future one-time application launch authorization requires its own concurrency/replay review; desktop-only entry is not a security boundary.

Private files use server-generated keys and authorized upload/read/list/download/delete endpoints. Validate actual format, size, quota and content, not merely Content-Type or a caller uid. Verify download confidentiality and source/CDN bypass; upload presigning alone does not establish private download access. Expired, abandoned and partially written uploads need explicit lifecycle handling.

Initial types are bounded UTF-8 TXT/Markdown and selected static images. Markdown is rendered with raw HTML disabled or strict sanitization. Images being stored/previewed does not imply model vision support. PDF/Office/OCR/large media are separately validated extensions.

Only explicitly selected authorized inputs are sent to a model. Treat their content as untrusted instructions. First AI actions are read-input/create-output only; never allow prompt content to delete, overwrite or read unrelated files.

## 6. AI and shared activity

Makers Models is the provider-facing gateway, not a consumer points engine. Read AI_GATEWAY_API_KEY, AI_GATEWAY_BASE_URL and the verified model selection from server environment. Credentials, provider availability and usage/cost reporting must be tested; console provider rows are not enabled credentials and temporary free access is not a price promise.

Use ordinary bounded requests when sufficient, and one chosen Agent Runtime route when conversations/tools/sandbox are needed. Follow the selected runtime's context/request/store contract; cloud-functions/ and agents/ are not interchangeable. Restrict actions, input length, output budget, turns and timeout. Do not assume ordinary function limits apply unchanged to Agent/sandbox execution, or that either provides indefinite background work.

Bind subject, conversation, run, app/action and input/output asset IDs server-side. Activity is a DTab-owned view backed by authorized records, not raw provider traces. It may show known stages and sanitized errors, never fabricated percentages or hidden model reasoning.

Separate the execution outcome from result persistence. A successful model response with failed Blob save is not a fully completed saved result. Show cancel_requested until confirmation. Use unknown for ambiguous timeout/disconnection; reconcile the original run before retrying a potentially chargeable action.

No durable queue, scheduling, disconnect survival or auto-resume is inferred from SSE, memory, Blob task JSON or a console template label. These capabilities remain separately documented and tested milestones. No unrestricted crawler, autonomous external publishing or arbitrary user code in the first release.

## 7. Commercial and release boundaries

Keep free use + one membership + points packs; daily points reset without rollover/check-in, purchased points do not expire on daily reset or membership expiry. Prices, allocations, time zone and conversion require explicit configuration/approval. Low-cost included tools do not debit points; actual paid operations require transparent metering.

With no New API, grants/reservations/settlement/refunds/reconciliation are DTab responsibilities. Strong Blob reads are not transactions, and appending immutable events does not prevent two concurrent spenders. onlyIfNew requires a documented service guarantee and a reviewed, fault-tested algorithm; an in-process mutex, eventual KV lock or ETag alone is insufficient.

Real checkout, recharge and paid public access remain disabled until commercial gates pass. Internal testing also needs authorized funded calls and a bounded budget. Do not promise unlimited free AI or silently add SQL to bypass the Makers-only requirement.

## 8. Deployment

The current branch is documentation only. Scaffold and build the new root before changing any Makers production root or release branch. Preserve current main and existing production settings. Use an explicitly authorized test project for credentialed Makers CLI checks; do not infer access, paid-call authority or quota from screenshots.

Source review, local unit mocks and frontend build are distinct from actual cloud route/storage/AI validation. Record real outcomes and remaining gates, including rollback, rather than reusing old test counts.
