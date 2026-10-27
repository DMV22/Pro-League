# Agent skills for M4

Verified: 2026-10-27. Status: the user approved and project-scoped installation completed for
`security-best-practices` and `supabase-postgres-best-practices`; both are recorded in `skills-lock.json`.
No application, environment or cloud resource changed. Popularity is a discovery signal, not proof of safety.

Approved sources inspected during installation:
- OpenAI `49f948faa9258a0c61caceaf225e179651397431`.
- Supabase `c9be0e931b7930f7d02126d04774d904c381e7d7`.

The source SHAs were checked before/after installation. Skills CLI records `ref: main` plus its computed
content hash; this is not an immutable source-SHA pin. Review future updates before accepting a new hash.
The earlier candidate analysis below is retained as research, not authorization to install other skills.

## Decision summary

- For #126–128: use the approved `supabase-postgres-best-practices` and `security-best-practices`.
  The generic Neon SQL skill is an examined but unselected alternative; do not install both SQL rule sets.
- Before #129–132 / #137: recommend `clerk-nextjs-patterns`, `clerk-webhooks` and `clerk-testing`.
- Optional: `clerk-setup` for an explicitly approved initial integration; `security-threat-model` for a
  focused assessment before M4 acceptance. Neither is an automatic prerequisite for every task.
- Existing skills and desktop plugins are enough to start #126. Missing optional instructions are not a
  reason to postpone transaction/permission tests, and installing a skill does not implement those guarantees.

## Existing coverage

The checked `skills-lock.json` already covers:

| Need | Existing project skills | M4 use |
| --- | --- | --- |
| Interfaces and ownership | `codebase-design`, `domain-modeling`, `improve-codebase-architecture` | Audit, executor and Outbox interfaces; accepted terminology and ADRs |
| Test discipline | `tdd`, `playwright-cli` | Agreed test seams, PostgreSQL integration and later Admin browser flows |
| Next.js / React | `nextjs-app-router-patterns`, `vercel-react-best-practices` | Server adapters and minimal Admin shell |
| Minimal interface quality | `accessibility`, `web-design-guidelines` | Audit viewer, filters, errors and CSV download controls |
| Research/planning | `research`, `grilling`, `to-spec`, `to-tickets`, `wayfinder` | Evidence and bounded implementation tasks |

The installed Next.js guides in `node_modules/next/dist/docs/` remain authoritative over generic older
Next.js patterns. Design/Stitch skills do not need expansion for the agreed minimal M4 UI.

This desktop session separately exposes Neon Postgres and Render deployment/environment skills, plus
generic Vercel auth guidance. Their absence from the project lockfile does not mean they are unavailable.
Do not install duplicate platform skills or adopt Vercel hosting/Supabase/Neon Auth as a side effect.
The proposed generic Neon SQL skill below is distinct from the desktop platform/connection skill.

## Evaluated additions

### 1. `postgres-best-practices` — Neon (not selected)

Source: [official skill](https://github.com/neondatabase/postgres-skills/blob/main/skills/postgres-best-practices/SKILL.md).
Its references include [transaction isolation](https://github.com/neondatabase/postgres-skills/blob/main/skills/postgres-best-practices/references/transaction-isolation.md)
and [security/roles](https://github.com/neondatabase/postgres-skills/blob/main/skills/postgres-best-practices/references/security-roles.md).
These directly support #126–128 rollback, concurrency, restricted-role and retry work. They are SQL guidance,
not a ready-made audited transaction or dispatcher. Preserve existing `pg`, Drizzle and migration tooling.

Adoption at check: approximately 1.9K installs, 53 repository stars. Official publisher, relatively small
repository; inspect relevant references before use. [Listing](https://skills.sh/neondatabase/postgres-skills/postgres-best-practices),
[repository metadata](https://api.github.com/repos/neondatabase/postgres-skills).

Candidate command, not executed:
`npx skills add neondatabase/postgres-skills --skill postgres-best-practices`

### 2. `security-best-practices` — OpenAI

Source: [official skill](https://github.com/openai/skills/blob/main/skills/.curated/security-best-practices/SKILL.md).
It has language/framework-specific references, including TypeScript/Next.js, and selective security review
or secure-by-default triggers. Useful for safe audit evidence, input/error handling, authorization entry
points, secret boundaries and later CSV review. It complements, not replaces, repository ADRs and real tests.

Adoption: approximately 11.3K installs, 28.3K repository stars.
[Listing](https://skills.sh/openai/skills/security-best-practices),
[repository metadata](https://api.github.com/repos/openai/skills).

Candidate command: `npx skills add openai/skills --skill security-best-practices`

### 3. `clerk-nextjs-patterns` — Clerk

Source: [official skill](https://github.com/clerk/skills/blob/main/skills/clerk-nextjs-patterns/SKILL.md).
Use for #129/#134: server session access, protected Server Actions/Route Handlers and request-time auth
with Cache Components. The source includes SDK-generation differences; verify the actual package version.
Clerk-side `has()`/Organization examples cannot replace our Active PostgreSQL Grant check. User-scoped
caching examples do not authorize caching our current access decision in a public/shared cache.

Adoption: approximately 53.5K installs in the live CLI search.
[Listing](https://skills.sh/clerk/skills/clerk-nextjs-patterns).

Candidate command: `npx skills add clerk/skills --skill clerk-nextjs-patterns`

### 4. `clerk-webhooks` — Clerk

Source: [official skill](https://github.com/clerk/skills/blob/main/skills/clerk-webhooks/SKILL.md).
Use for #131–132: framework signature verification, delivery identity and asynchronous provider updates.
Its generic handlers are not our implementation: deleting local users would destroy preserved identity/history;
direct provider-to-database writes omit our application orchestration, receipts, Audit and Outbox. A 2xx
acknowledgement must follow durable receipt/required state persistence, never precede it. Generic examples
do not prove ordering or replay safety. Do not add Resend/Slack/Organizations from incidental examples.

Adoption: approximately 52.8K installs in the live CLI search.
[Listing](https://skills.sh/clerk/skills/clerk-webhooks).

Candidate command: `npx skills add clerk/skills --skill clerk-webhooks`

### 5. `clerk-testing` — Clerk

Source: [official skill](https://github.com/clerk/skills/blob/main/skills/clerk-testing/SKILL.md).
Use for #129/#134/#137 with existing Playwright tests: development-instance test sessions and bot-detection
testing helpers. A successful provider sign-in is not a successful local authorization test: separately cover
missing/Suspended/Revoked grants, authorization DB outage and replay after revocation. Test session files,
tokens and keys must never enter Git or public artifacts. Do not provision a new Clerk app simply because
an example has no keys; resource changes require explicit approval.

Adoption: approximately 46.3K installs in the live CLI search.
[Listing](https://skills.sh/clerk/skills/clerk-testing).

Candidate command: `npx skills add clerk/skills --skill clerk-testing`

The Clerk repository had 89 stars when checked through the [GitHub API](https://api.github.com/repos/clerk/skills).
The low repository star count warrants review, but official publisher provenance and substantive source inspection
matter more than a fixed popularity cutoff. Registry/CLI counts differ due to caching and change over time.
Inspected Clerk revision: `55206a48259bb327090ec5dbd22cfb5d4fa9de25`.

## Conditional additions

- [`clerk-setup`](https://github.com/clerk/skills/blob/main/skills/clerk-setup/SKILL.md): approximately 56.6K
  installs in live CLI search. Useful once for initial framework setup, not ongoing Audit work.
  The source can provision a claimable application, write keys, install global skills/themes and introduce
  public sign-up UI. Those steps are not implied by adding skills and do not fit our bootstrap without review.
  Preserve invite-only registration, selected account/instance and local authorization. Candidate command:
  `npx skills add clerk/skills --skill clerk-setup`.
- [`security-threat-model`](https://github.com/openai/skills/blob/main/skills/.curated/security-threat-model/SKILL.md):
  repository-grounded assets/trust boundaries/abuse paths, optionally before #137 or earlier for unresolved
  auth assumptions. About 8.2K installs ([listing](https://skills.sh/openai/skills/security-threat-model)).
  A generated threat model does **not** pass the ADR-0025 Security Review or enable sensitive capabilities.
  Candidate command: `npx skills add openai/skills --skill security-threat-model`.

## Not recommended for the initial set

- Broad automatic skill packs, multiple overlapping auth/database rule sets, billing/Organizations/custom auth UI.
- Supabase Auth/RLS integration patterns: we retain Clerk plus local server-owned Grants. The official
  [Supabase Postgres skill](https://github.com/supabase/agent-skills/tree/main/skills/supabase-postgres-best-practices)
  is a credible *alternative* SQL reference, not a second mandatory installation beside Neon's generic SQL skill.
- Trail of Bits [sharp-edges](https://github.com/trailofbits/skills/tree/main/plugins/sharp-edges) or
  [differential-review](https://github.com/trailofbits/skills/tree/main/plugins/differential-review): useful optional
  targeted audits, but unnecessary overlap/heavier workflows for the minimum M4 set.
- No suitable official Drizzle-specific installable skill was verified in this review. Use
  [Drizzle transaction documentation](https://orm.drizzle.team/docs/transactions) and the installed version;
  this does not claim that no Drizzle skill exists anywhere.
- No third-party Outbox skill is required to establish the project-specific atomicity/lease/retry invariants.
  Test those against PostgreSQL rather than adopting a new queue vendor from a generic example.

## Adoption procedure after approval

1. Inspect selected entry points and relevant references at a recorded source revision; review external
   instructions as code, including resource creation, package changes, shell commands and secret handling.
2. Install only selected project-scoped skills; do not use `-g` or install an entire collection by default.
3. Inspect the resulting paths and `skills-lock.json` diff. Existing `.agents` ignore policy remains in force;
   the lockfile records the approved project sources, not the personal desktop plugin inventory.
4. Keep runtime dependencies separate: a Clerk skill is instructions, not the `@clerk/nextjs` SDK or `@clerk/testing`.
5. Use existing `codebase-design`/`tdd` plus the relevant new references for each task; do not run all skills on every change.
6. Repository rules win: Clerk proves identity, PostgreSQL Grants authorize; no external API inside the domain
   transaction; preserve immutable history; do not enable second Admin/sensitive operations before ADR-0025 review.
