# DTab Makers Native — Agent Instructions

## Scope and authority

This directory is a greenfield rebuild authorized by the user's 2026-09-18 instruction. Within makers-native/, the previous infrastructure requirements for Supabase, PostgreSQL, Cloudflare ImgBed, New API, legacy compatibility and the old migration sequence are superseded. The earlier product decisions remain unless explicitly changed. Do not edit or remove the old implementation merely to make this directory look cleaner.

Read README.md and docs/ARCHITECTURE.md before implementation. docs/IMPLEMENTATION.md distinguishes planned work from executed validation. This baseline is not a runnable application.

## Official skill

Read the official TencentEdgeOne/edgeone-makers-tools router and only the references relevant to the current task. The reviewed source and paths are recorded in skill-source.json. The official README provides `npx skills add TencentEdgeOne/edgeone-makers-tools`; reading these files through GitHub does not install them into a user's Windows/VPS agent environment. Do not claim installation without executing it in and verifying the intended environment.

Important conventions verified in the reviewed skill:

- cloud-functions/ contains Node business APIs; concrete .js endpoints are the simplest initial shape. Do not start a persistent app.listen server.
- agents/ contains Agent Runtime endpoints. Do not confuse their already-parsed request body and plain-object headers with the Web Request used by ordinary Node Cloud Functions.
- Read runtime secrets through context.env in cloud-functions/ and agents/. Do not silently fall back to process.env in those handlers.
- Blob uses @edgeone/pages-blob. Construct stores with getStore({ name, consistency: 'strong' }). Do not use a process array or local SQLite as production persistence.
- KV is a console-bound global in Edge Functions; it is not context.env.KV and is not the Blob SDK.
- AI_GATEWAY_API_KEY and AI_GATEWAY_BASE_URL must be declared in the application root .env.example. Keep all credentials out of client bundles, VITE_* variables, logs and Git.
- Agent conversation IDs are routing identifiers, not proof of user identity. Bind each conversation to the authenticated DTab subject on the server.
- Use bounded execution, abort handling, heartbeat and the documented stream protocol when implementing Agents. Install only the selected framework, not every SDK.
- Use edgeone makers dev for Makers integration tests. Credentialed Blob development requires account authorization and project linking; use the explicit test project name. Do not provision a new project or enable paid resources implicitly.

## Product boundaries

Preserve the iOS/iPadOS-inspired desktop, shortcuts, folders, Dock, widgets, official store, private gallery, settings, versioned official presets and admin tools. This is not a Windows-style arbitrary multiwindow desktop. Use DTab-owned visual assets. Keep keyboard, touch, reduced-motion, reduced-transparency and responsive behavior.

The commercial model remains free use + ONE membership + points packs. Daily points reset without rollover or mandatory check-in; purchased points do not reset with the day or membership expiry. Exact prices and allowances remain unapproved. Low-cost included tools do not automatically debit points. Paid AI/per-use APIs require explicit metering.

No arbitrary remote JavaScript execution or third-party uploaded app bundles in the main origin. External managed apps are a later integration boundary, not an excuse to recreate multiple login and billing systems.

## Data and financial correctness

Blob strong reads are not transactions. A JavaScript mutex, a function instance's memory, KV read-modify-write, an ETag without documented conditional replacement, or simply writing an immutable ledger entry do not prove prevention of double spending.

The documented onlyIfNew option is a candidate primitive to investigate, not an established distributed-lock or financial transaction implementation. Verify service-side guarantees, conflict observability, retries, multiple instances and crash recovery. A passing one-off load test is not a proof of the guarantee.

Derive object keys and ownership from verified server identity, never from a trusted client uid. Keep privileged roles server-controlled. Do not publish private gallery URLs or issue arbitrary-prefix signed uploads. Published presets and device snapshots must preserve previous versions.

## Work and reporting

Work in stage-sized commits on the rebuild branch. Keep main, existing infrastructure, production DNS and live payments unchanged unless separately authorized. Do not create deployment workflows before the new root has an actual build.

Report passed / failed / blocked / not-run truthfully, and record tool/runtime versions. Mock storage tests are not real Makers tests. A screenshot of an Agents tab does not establish enabled credentials, quota, a deployed Agent, or successful model calls. Do not claim that configured model names prove which model executed this work.
