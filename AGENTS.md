# Repository guidance for Codex and other coding agents

## DTab OS V1

The current runnable project is still a legacy GoTab distribution plus a TypeScript adapter. Do not confuse the target specification with implemented features.

Before OS-related changes, read:

1. [Implementation entry](docs/dtab-os-v1/README.md)
2. [PRD](docs/dtab-os-v1/01-PRD.md)
3. [Architecture](docs/dtab-os-v1/02-ARCHITECTURE.md)
4. [Migration](docs/dtab-os-v1/03-MIGRATION.md)
5. [Audit and release gates](docs/dtab-os-v1/04-AUDIT.md)
6. [Codex tasks](docs/dtab-os-v1/05-CODEX-TASKS.md)

These files describe the accepted OS V1 implementation target. Existing README/build instructions remain the source for running the current legacy version until the relevant implementation commit updates them. Later explicit user decisions take precedence over this specification; record material changes instead of silently contradicting it.

## Hard product boundaries

- iOS/iPadOS-style web OS with DTab-owned visual assets; not Windows/Android.
- One DTab product domain, path-based desktop/store/gallery/settings/admin.
- GitHub + EdgeOne + Supabase + the existing official CloudFlare ImgBed service.
- No Firebase, new image-hosting system, user-provided storage, required production VPS/Redis/microservices.
- Official-only store in V1. No Creator onboarding, third-party executable uploads, revenue sharing or payouts.
- Keep web shortcuts, user add/edit actions, user-uploaded icons, folders and widgets.
- Official preset editor and immutable published versions; never overwrite an existing user's desktop automatically.
- Chat, reader, AI pets, large media processing and third-party miniapps are later phases.

## Change discipline

Start at M0, inspect the real worktree, protect uncommitted changes and rerun the legacy baseline. Work in stage-sized branches/commits. Do not reset, clean, stash or overwrite user work automatically.

Do not modify `legacy/gotab/web` or remove its license. New features must not depend on DOM text injection or hashed/minified exports. Preserve old data and import/export backups; use explicit, idempotent migration with rollback.

The legacy root Service Worker intercepts all `/api/*` and can return the legacy HTML for new navigation. Resolve its update/passthrough/cache rules before exposing `/os` or `/api/v1`. Do not simply move the old build to `/legacy` or run two writable desktop runtimes over the same state.

Do not change package managers by only deleting a lockfile. Verify scripts, lockfile, CI and EdgeOne deployment together. Exact dependency versions require current security/compatibility checks; the conversational version numbers are not an installation command.

## Data, secrets and runtime safety

Never commit or print credentials, tokens, personal media or production database contents. Keep service-role/secret and ImgBed credentials server-only. Do not use frontend flags or editable user metadata for admin authorization.

Do not treat a public ImgBed URL, Referer allowlist, hidden path or token owner label as private per-user authorization. Private media, upload-size limits, RLS, account switching and source/CDN bypass tests are release gates. Failure must remain visible; do not silently ship public storage in place of a private album.

Only source-reviewed official code may execute in the main origin. No arbitrary remote JS entry from the store database, and no inline user SVG/HTML. A URL path is not an origin isolation boundary.

No production DNS changes, destructive database operations, new paid infrastructure, repository visibility changes or real charging without the appropriate user authorization. Local DB tests must not connect to production.

## Validation and reporting

Use actual results: passed / failed / blocked / not-run. Historical test counts and mock tests are not new execution or production verification. Do not delete failing tests or fabricate cloud success.

Each stage must include the relevant type/build/unit/E2E/database checks, migration effects, remaining gates and a rollback path. Put execution reports under `docs/dtab-os-v1/implementation/` when they are actually produced; do not prefill them with successful results.
