# DTab Makers Native — Architecture v0.1

Date: 2026-09-18. Status: implementation baseline, not a production-readiness claim.

## 1. Decision

Build DTab from scratch around Makers rather than adapt the earlier implementation. DTab remains the user's personal Web OS: a desktop entry, official store, account, personal content, membership and a common AI access layer.

No mandatory Supabase, PostgreSQL, Redis, New API, external image-hosting service, Vercel or Cloudflare runtime is included in this architecture. Existing services are not deleted by this decision. An upstream model or payment provider remains an external business dependency where that capability is used; it is not an additional DTab hosting platform.

## 2. What the official Skill actually establishes

The reviewed official repository is TencentEdgeOne/edgeone-makers-tools. Its README describes one installed routing skill with capability references, not several independently required installations. The source revision and read paths are in ../skill-source.json.

| Evidence | Consequence for DTab |
| --- | --- |
| The storage skill explicitly describes no managed database and recommends Blob key prefixes / JSON records as a backend. | Do not assume Blob is only for images or that every business object needs a SQL table. |
| Blob exposes get, setJSON, list, delete, strong reads and the documented onlyIfNew option. | Build a server-side object repository with explicit schemas, ownership, versioning and pagination. |
| Blob documentation warns that even strong read-modify-write can race. | Do not implement a financial balance by reading a number, subtracting, and overwriting JSON. |
| Node Cloud Functions use cloud-functions/, context.env and the Web Request / Response API. | Keep ordinary account, desktop, gallery and admin APIs in concrete Node endpoints. |
| Agent Runtime has its own request/store/tools/sandbox conventions under agents/. | Use it for AI execution, not as the identity service or a presumed transaction engine. |
| KV is for Edge Functions; it is not the Cloud Functions object store. | Make KV optional for non-authoritative state; most business persistence goes to Blob. |

The reviewed Skill does not establish a turnkey end-user Auth system, a relational transaction service, an atomic debit API, or DTab-compatible consumer billing. These remain application work and explicit validation gates. Console login, deployment login-free modes and Agent session memory do not implement DTab user login.

### Primary sources

All paths below are under the official repository at revision f106ce7b9c5893cc3d4afafaec1eb67ed3f5b3c2:

- https://github.com/TencentEdgeOne/edgeone-makers-tools/blob/f106ce7b9c5893cc3d4afafaec1eb67ed3f5b3c2/skills/edgeone-makers-tools/SKILL.md
- https://github.com/TencentEdgeOne/edgeone-makers-tools/blob/f106ce7b9c5893cc3d4afafaec1eb67ed3f5b3c2/skills/edgeone-makers-tools/references/makers-storage/SKILL.md
- https://github.com/TencentEdgeOne/edgeone-makers-tools/blob/f106ce7b9c5893cc3d4afafaec1eb67ed3f5b3c2/skills/edgeone-makers-tools/references/makers-storage/references/blob.md
- https://github.com/TencentEdgeOne/edgeone-makers-tools/blob/f106ce7b9c5893cc3d4afafaec1eb67ed3f5b3c2/skills/edgeone-makers-tools/references/makers-cloud-functions/references/node-functions.md
- https://github.com/TencentEdgeOne/edgeone-makers-tools/blob/f106ce7b9c5893cc3d4afafaec1eb67ed3f5b3c2/skills/edgeone-makers-tools/references/makers-agents/SKILL.md
- https://github.com/TencentEdgeOne/edgeone-makers-tools/blob/f106ce7b9c5893cc3d4afafaec1eb67ed3f5b3c2/skills/edgeone-makers-tools/references/makers-agents/references/platform/env-and-model.md

## 3. Target runtime topology

```text
Browser: DTab desktop / store / gallery / settings / admin
    |
    | Same-origin requests
    v
EdgeOne Makers project
    |-- Vite + React static application
    |-- Middleware / Edge Functions: only when a concrete edge task needs them
    |-- Cloud Functions: identity, desktop, catalog, uploads, authorization
    |       `-- Blob: JSON records + private objects
    |-- Optional KV: public configuration cache / non-critical hints
    `-- Agents: authorized AI execution, streaming, tools, memory
            `-- Makers Models: configured provider access
```

Do not force every request through Middleware -> Edge Function -> Cloud Function. A same-origin Node endpoint can perform authentication and access Blob directly. Edge middleware can provide an early check, but every protected handler still verifies the identity and ownership it uses.

## 4. Frontend and information architecture

Choose React + TypeScript + Vite for an interactive desktop shell; SSR is not a requirement for this product. This is a product-driven choice, not a requirement imposed by Makers. Tailwind CSS and shadcn/ui are UI building blocks; create a DTab design system rather than present an unmodified component dashboard as the desktop.

Routes: `/`, `/store`, `/gallery`, `/settings`, `/settings/account`, `/admin`, `/app/:appId`. Keep shortcuts, single-level folders, widgets, pagination, Dock, official-only app registry and versioned presets. External website shortcuts open safely in a new tab; do not promise iframe compatibility for every website.

Guest desktop data is local-first. The browser is a local cache/offline workspace, not the authority for identity, paid entitlements or server spending. Multi-device sync is based on preserved revisions and conflict handling, not blind replacement of one shared JSON file.

Planned independent application root:

```text
makers-native/
  src/                   # React frontend
  cloud-functions/api/   # ordinary business endpoints
  agents/                # AI endpoints when an AI application is introduced
  server/                # shared server-only modules; not browser imports
  shared/                # schemas and public contracts only
  tests/
  docs/
  edgeone.json
  package.json
  package-lock.json
  .env.example
  AGENTS.md
```

This is a target layout. The baseline commit does not create or claim runnable implementations for these directories.

## 5. Blob data model

Use `getStore({ name, consistency: 'strong' })` for business data. Introduce a schemaVersion in every structured record. Use authenticated subject IDs and server-generated opaque IDs in keys. Never expose general-purpose read/write/list-by-prefix APIs to browsers.

Proposed key families:

```text
auth/subjects/<uid>.json
auth/handles/<normalized-handle-digest>.json
auth/sessions/<token-digest>.json
users/<uid>/profile.json
users/<uid>/desktop/snapshots/<snapshot-id>.json
users/<uid>/desktop/devices/<device-id>.json
users/<uid>/installs/<app-id>.json
users/<uid>/gallery/items/<asset-id>.json
media/<uid>/<asset-id>/<variant>
catalog/apps/<app-id>/versions/<version-id>.json
catalog/presets/<preset-id>/versions/<version-id>.json
audit/<day>/<event-id>.json
ai/<uid>/conversations/<conversation-id>/metadata.json
ai/<uid>/runs/<run-id>.json
```

These prefixes are not SQL tables and do not provide joins, constraints or transactions. Query by bounded prefix and paginate; do not download every user's records to filter on the frontend. A materialized index is derived data and requires an explicit repair strategy.

Store frequently appended records separately. Published catalog/preset versions and desktop snapshots are immutable by application policy; a writable pointer is not itself an atomic synchronization protocol. Concurrent edits must retain both revisions and surface a conflict rather than silently overwrite data. Any atomic create or pointer-update guarantee must be verified before relying on it.

Auth handle reservation needs service-side uniqueness, observable conflicts and recovery from partial writes. The existence of onlyIfNew is not sufficient evidence that an unreviewed registration algorithm is correct.

### Private files

The application authenticates the user before issuing an upload URL; it generates an owned object key and restricts acceptable content. Verify actual format, size and metadata before publishing an asset into the user's gallery. Do not treat a Content-Type header alone as file validation. Do not assume upload presigning also provides a private download scheme.

Downloads must pass an ownership check or use a separately verified short-lived access mechanism. Use private/no-store behavior for sensitive user responses and test source/CDN bypass. Direct uploads can avoid the Node function request-body path, but quotas, CORS, expiry, oversized uploads and abandoned objects still need validation.

## 6. DTab Identity

Implement a single DTab identity boundary using reviewed authentication primitives in Cloud Functions. Store account metadata and session records in Blob, subject to the registration/session gates. Use server-validated credentials, secure HttpOnly cookies and CSRF protection for browser mutation requests. Do not invent a cryptographic protocol or store plaintext passwords.

Authoritative logout, account disable and privilege checks cannot depend only on eventually consistent KV. Short-circuit caches may improve reads but cannot grant a permission that the authoritative data has revoked. Client-set roles, editable profile fields, a request Referer, or opening an app from the desktop are not authorization.

Future independently deployed official applications must obtain DTab-controlled, audience-bound, short-lived authorization. Exact one-time-code consumption and replay prevention require a verified concurrency primitive. Do not put the main session token into launch URLs. An app's direct-entry redirect is a user-experience policy, separate from API access control.

## 7. Models and Agents

Makers Models is the default provider-facing gateway. DTab retains its own app/user authorization, action classification and user-facing commercial policy. Never equate provider usage statistics with a completed DTab points engine.

Configure AI_GATEWAY_API_KEY, AI_GATEWAY_BASE_URL and the chosen AI_GATEWAY_MODEL on the server. Do not hardcode model names, assume that all provider rows in the console are configured, or build pricing around a temporary free allowance.

For Agent applications, follow the official agents/ entry contract and select one framework according to the actual application. Bind conversation IDs to DTab subjects; enforce ownership on resume, stop, history and file output. Use bounded tool loops, timeouts, abort handling and traceable run IDs. Agent memory is conversation state, not an authorization database or a financial lock.

The reviewed Node Functions reference lists finite execution and request-body limits. Do not put long video generation, unrestricted ffmpeg work or an always-running upstream server into a normal function by assumption. Validate the selected Agent/sandbox limits for each such application. Large applications remain independent milestones, not automatic capabilities of the Core desktop.

## 8. Membership and points

Preserve the approved simple model: free use + one membership + points packs. Daily grants reset without rollover; purchased points do not reset with the day or membership expiry. No mandatory check-in, extra Max tier or per-app VIP. Prices, grants, time zone and quota conversion must be explicit configuration before release, not invented production defaults.

Removing New API as infrastructure does not remove its former responsibilities. DTab now needs a native implementation for grants, reservations, usage settlement, failure release, refunds and reconciliation. Keep distinct states for created/reserved/running/settled/failed/unknown runs. A timed-out request must not blindly create a new paid upstream run.

Makers-only financial feasibility is an open validation task, not a proven capability. Investigate the documented onlyIfNew operation and its service-side semantics, error behavior and multi-instance behavior. Immutable per-event objects may support auditing, but appending an event alone cannot prevent two requests from both spending the same remaining grant. Strong reads, ETags and an in-process mutex do not fill this gap.

Do not launch real charging until the entire settlement design is justified and fault-tested. If the required primitive remains undocumented or insufficient, report that exact blocked gate and continue non-financial implementation; do not hide the gap or silently add an external database. This baseline does not claim that every commercial requirement is already achievable safely using the currently documented primitives.

## 9. Deployment boundary

First create and test the new root independently. Preserve the existing main branch and current production project. Connect a separately authorized preview environment only when the new app builds; do not reuse the existing root package scripts or service worker.

Use Makers CLI for integration, with an explicit test project for credentialed Blob work. Git-based automatic builds require the actual configured project connection; a written instruction is not a completed deployment. Production authorization, secrets, domains, model credentials and payment channels are never inferred from screenshots.
