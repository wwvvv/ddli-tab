# DTab Makers Native — Agent Instructions

## Scope and authority

This directory is a greenfield rebuild authorized on 2026-09-18. The user subsequently allowed the website's functional modules to be redesigned around Makers. Read docs/PRODUCT.md for the current scope proposal. It supersedes fixed Store/Gallery modules, legacy routes and the previous stage order; it does not imply per-feature user approval or completed implementation.

Within makers-native/, old requirements for Supabase, PostgreSQL, Cloudflare ImgBed, New API, legacy compatibility and migration are superseded. Preserve the unified DTab entry, iOS/iPadOS-inspired interaction, account ownership and simple commercial policy. Do not modify or remove the old implementation merely to simplify this directory.

Read README.md, docs/PRODUCT.md, docs/ARCHITECTURE.md and the current milestone in docs/IMPLEMENTATION.md before implementation. The current change is a documentation baseline, not a runnable app.

## Official skill and runtime

Read the official TencentEdgeOne/edgeone-makers-tools router and only relevant references. The reviewed revision is in skill-source.json. GitHub reading does not install the skill on a user's device; do not claim local installation without execution and verification in the intended environment.

- Ordinary APIs live in cloud-functions/; start with concrete documented Node .js endpoints. Do not run app.listen or use local filesystem/arrays as production persistence.
- Agent Runtime endpoints live in agents/. Their parsed body and plain-object headers differ from the Web Request used by ordinary Node Cloud Functions. Follow the actual selected runtime contract.
- Read cloud/agent secrets from context.env. Declare AI_GATEWAY_API_KEY and AI_GATEWAY_BASE_URL in .env.example. Never put secrets in VITE_* variables, client bundles, logs, public JSON or Git.
- Blob uses @edgeone/pages-blob and getStore({ name, consistency: 'strong' }). KV is an Edge Function console-bound global, not context.env.KV or the Blob SDK.
- Conversation IDs, run IDs and asset IDs are identifiers, not authorization. Bind them to the authenticated subject on the server, including history, stop, resume and download endpoints.
- Use one appropriate Agent framework only when needed. Follow bounded loops, budget limits, abort handling, heartbeats and stream conventions. Browser-only tools must not acquire an AI dependency unnecessarily.
- A task record, SSE stream or platform template label does not prove durable execution, background queueing, scheduling, auto-resume or confirmed upstream cancellation. Do not promise those without a verified contract.
- Use edgeone makers dev for integration. Credentialed Blob work needs an authorized linked test project. Do not implicitly provision projects, incur paid calls or change production settings.

## Product boundaries

The current user-facing modules are desktop, app library, AI assistant, files and settings, plus shared activity and operator administration. Gallery is a files image view, not a separately required album system. The app library exposes official reviewed tools/actions rather than a third-party marketplace. A shared text assistant provides summary/rewrite/translation actions instead of multiple independent chat apps.

Keep a useful guest desktop and browser-only tools. Start the AI file path with bounded TXT/Markdown input and new text output; do not infer PDF, OCR, vision, video or arbitrary Office support from a provider list. Never render untrusted HTML or user SVG as executable content.

Retain DTab-owned visuals, keyboard/touch support, responsive layouts, reduced-motion and reduced-transparency. Do not add arbitrary multiwindow, community, creator uploads, revenue sharing, unlimited storage, user-written workflows or new external infrastructure to the initial milestone.

The commercial model remains free use + ONE membership + points packs. Daily points reset without rollover/check-in; purchased points do not reset at midnight or membership expiry. Prices and allowances remain unapproved. Included low-cost tools do not automatically debit points. Paid AI/per-use APIs require explicit metering and release gates.

## Security and correctness

Blob strong reads are not transactions. An in-process mutex, KV read-modify-write, an ETag without documented conditional replacement, or an immutable event alone does not prevent double spending. onlyIfNew is a primitive to investigate, not a proven distributed lock or financial algorithm. Verify documented guarantees, observable conflicts, multiple instances, retries and crash recovery before relying on it.

Derive keys and permissions from server identity. Auth handle reservation needs uniqueness and recovery; logout/disable cannot rely solely on stale KV. Privileged roles must not come from editable profiles. Client Referer or desktop entry is not authorization.

All private file operations and model inputs need ownership checks. Only explicitly selected data may be sent to a model. Treat file/model content as untrusted, not authority to delete, overwrite or exfiltrate data. AI creates separate result assets by default. Published presets and user snapshots preserve earlier revisions and expose conflicts.

Report generation success and persistence success separately. Show cancel_requested until confirmed; use unknown for ambiguous outcomes. Do not fabricate progress or automatically reissue an ambiguous paid request. Provider traces are not a user-visible license to reveal secrets, raw private tool data or hidden model reasoning.

## Work and reporting

Use stage-sized commits on the rebuild branch. Keep main, production DNS, live payments and existing infrastructure unchanged unless separately authorized. No deployment workflows before a real independent build exists.

Report passed / failed / blocked / not-run truthfully. Source review and documentation consistency checks are not runtime tests. Mock tests do not prove Makers behavior. A console tab does not establish enabled credentials, quota, deployment or successful model calls. Do not claim a configured model proves which model executed development work.
