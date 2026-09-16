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

## Design system and repository skill

For visual or interactive OS work, also read [Design System](docs/dtab-os-v1/06-DESIGN-SYSTEM.md) and invoke/read [dtab-ios-design](.agents/skills/dtab-ios-design/SKILL.md). Pure database or deployment tasks do not need all visual references.

The canonical skill is `.agents/skills/dtab-ios-design`; do not create a duplicate under `.codex/skills`. Its reference files route component, motion/accessibility and visual-review tasks. Shared dimensions and colors come from the DTab design system, not from unrelated third-party templates.

External Apple-style projects are references only. Do not install their dependencies, copy their full skills, import their scripts or distribute Apple fonts/assets without a separate need and license review. Default to existing CSS/Motion and a small number of glass surfaces. Preserve reduced-motion, reduced-transparency, keyboard and zoom support.

No approved OS mockups or browser visual results are implied by these documents. Use actual available designs; otherwise build a minimal browser sample against the specification and mark visual approval pending. A generated picture does not prove the UI works.

## Model and agent routing

Read [Model Routing v1.1](docs/dtab-os-v1/07-MODEL-ROUTING.md) before assigning work. The user uses the ChatGPT desktop app, not a required CLI workflow. Project defaults: CORE/integration = GPT-5.6 Sol; UI implementation = GPT-5.6 Terra Medium after contracts are stable; PLANNER/milestone REVIEW = GPT-6 Astra. This supersedes the previous default of Sol Medium for ordinary UI work.

The user's 2026-09-16 screenshot shows Sol Medium, Astra Light and Terra Medium in recent model choices, with Terra Medium selected below the composer. This is picker/selection evidence, not verified execution metadata. Sol High, higher Astra efforts, full model availability, client version and cross-model subagent runs remain unverified. Do not mark them passed or infer model IDs from a model's self-description.

Target High for difficult Sol work, and Medium or an available deeper effort for Astra review, only when supported in the user's picker. Until verified, use the observed available setting for bounded work and record the actual effort/substitution; preserve independent review and all release gates. Model names and runtime IDs are separate fields. See the routing document for fallbacks.

These Markdown instructions do not themselves reconfigure the current main session. Official Codex documentation does support model/effort selection for subagents, but use it only through tools/configuration the actual client supports and verify what was launched. Do not simulate multiple models in prose. No active config.toml, custom agent configuration or approval policy is installed by this update; do not silently overwrite user configuration or switch billing paths.

CORE owns shared tokens, desktop contracts/layout, lockfiles, migrations, Auth, Service Worker, media authorization and deployment. Terra UI tasks own only their agreed directories and tests; the reviewer is read-only by default. Multiple conversations do not prove worktree isolation. If isolated parallel writes cannot be established, execute sequentially; never let agents compete over the same writable workspace.

Model strength does not waive tests, release gates, production authorization or protection of existing work. Record recommended role separately from the actual observable model; use unknown when the environment does not expose it. Inspect existing implementation progress before starting; do not redo or overwrite completed stages merely because the model policy changed.
