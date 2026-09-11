---
status: accepted
---

# Use Cache Components and server-owned state

ProLeague will target a pinned Next.js 16 release with Cache Components enabled on the Node.js runtime. Public Portal pages will combine prerendered shells, cached server-only Query Layer projections, and Suspense-streamed request-time sections, while authenticated Admin and private content remains request-time. PostgreSQL remains authoritative and the browser never becomes the source of Official information.

This replaces the current Vite prototype's global browser-owned league slice and redux-persist domain storage. The detailed primary-source investigation is retained in [the Next.js rendering and state research](../research/nextjs-rendering-caching-client-state.md).

## Rendering boundaries

Public home, News, Competition, Season, Team, Player, Match, schedule, bracket, and Standings surfaces use Server Components. Cohesive Query Layer functions return serializable view models and define cache boundaries independently, allowing one route to combine a static shell, projections with different freshness, and a small request-time freshness sentinel.

Published and Archived Article canonical pages are server-rendered and cached for SEO and stable public access. Authenticated Admin pages, Audit History, private documents, Draft and Scheduled content, Working Revisions, and previews are rendered per request after both Clerk session and Active PostgreSQL access checks. Authorization decisions and personal data are never stored in a shared cache.

Client Components remain narrow interactive islands for dialogs, navigation controls, rich-text editing, media selection and focal-point tools, upload progress, and drag-and-drop Competition Format or Schedule building. They never authorize commands, calculate Official Standings, own successful mutation results, or decide domain transitions.

Server Actions adapt same-origin Admin mutations and repeat authentication, authorization, validation, expected-version, and command-idempotency checks. Route Handlers are reserved for actual HTTP consumers such as Clerk webhooks, storage callbacks, iCalendar and CSV downloads, health endpoints, external schedulers, and a future API. Server Components read application queries directly rather than calling internal HTTP endpoints.

The MVP has no live event entry, WebSockets, automatic score polling, or global client-side server-data cache. Published Match changes reach Visitors through post-commit cache invalidation.

## Cache model

Cache Components are enabled explicitly and are not mixed with the preceding route-level caching model. Cache directives wrap server-only Query Layer functions, not pages as a blanket policy, repositories, ORM entities, mutable aggregates, or authenticated layouts.

Project cache profiles are defined centrally. Current sporting projections revalidate within 60 seconds and expire after 5 minutes; current Published editorial projections revalidate within 60 seconds and expire after 15 minutes; archive and reference projections revalidate within 15 minutes and expire after 24 hours. Event-driven invalidation is the primary freshness mechanism and these lifetimes are the bounded fallback.

Stable semantic tags identify cohesive projections rather than every underlying row. Initial families include Article, Article list, Portal home, Competition, Season schedule, Season Standings, Stage progression, Match, Team, Player public profile, and Media Asset tags keyed by stable IDs. A versioned infrastructure registry alone translates typed application invalidation intents to concrete Next.js tag strings.

The domain and application layers never import Next.js cache APIs. An application transaction records framework-neutral invalidation intents in the transactional outbox. A CacheInvalidation adapter invokes the platform mechanism after commit, either from a protected scheduler Route Handler or a persistent Node worker. The same outbox item may run more than once and remains idempotent.

A successful Server Action may perform immediate invalidation as a read-your-own-write fast path, but the outbox remains the durable path when the response terminates after the commit. Ordinary publication, schedule, result, Standings, and bracket updates target public visibility within 60 seconds. Historical or reference changes target 15 minutes.

Cached projections expose lastUpdatedAt from committed data rather than render time. A small request-time freshness sentinel reports unresolved cache synchronization or inability to confirm authoritative state; age alone does not mark stable historical information stale. Exhausted ordinary invalidation retries become Reconciliation Required, alert the Technical Operator, and activate the warning without reversing the accepted domain decision.

Privacy Requests, Media Withdrawals, accidental disclosure, and security restrictions use a separate Urgent Purge with no permitted stale response. It suppresses the database representation, denies origin access, evicts tagged data and HTML, purges public media variants from the CDN, and confirms every required step before the request is resolved. Failure keeps the request In Review and raises a critical operational alert. Hosting and storage providers must support this capability.

Redis or a custom shared cache is not part of the initial architecture. The selected host may use its managed shared cache, or a single instance may use the supported local mechanism. A shared custom cache is introduced only if multi-instance deployment or production verification proves it necessary.

## Client state

Shareable resource selection, Stage, round, date, pagination, filters, and sorting use route segments or normalized search parameters. Canonical entity routes use stable identifiers or slugs. Base representations and useful pagination may be indexed; arbitrary filter and sort combinations use a canonical base representation or noindex to avoid duplicate discovery surfaces.

HTML forms and Server Actions own submitted mutation data and validation outcomes. Small non-shareable interactions use component-local React state. Harmless durable preferences may use a narrowly scoped cookie or browser storage only after privacy review.

Redux Toolkit is retained for a concrete complex interaction rather than installed as a global default: the Competition Format and Schedule Builder may use a route-scoped, per-Draft store for multi-panel selection, an in-memory working buffer, and bounded undo or redo. It is initialized from a serializable server snapshot and resets when the Season Draft changes. Server-authoritative autosave and aggregate versions remain the source of truth.

The initial builder store is not persisted in the browser. After a successful autosave, the returned server version becomes the new local base. A stale-version conflict pauses autosave and preserves the buffer in memory while the Admin explicitly discards it or rebases it as a new change; it is never silently merged or allowed to overwrite the server.

RTK Query is not used for ordinary App Router reads because Server Components already own that lifecycle. It may be introduced only for a future proven client-only interaction. The existing league slice, simulation actions, global Redux provider, and PersistGate are migration inputs to retire rather than production boundaries.

## Verification

Acceptance tests must prove that Published content appears in server-rendered HTML; Draft and private content cannot enter public cache, metadata, sitemap, or Open Graph output; committed publication, result, schedule, and privacy changes emit the correct semantic intents; freshness targets and Urgent Purge hold; every Admin action independently authorizes; stale builder state cannot overwrite the server; repeated outbox work is idempotent; and cache failure activates degradation without rolling back domain truth.

After a hosting provider is selected, production acceptance additionally verifies cache persistence across deployment, coherence between instances where applicable, tag revalidation, urgent CDN purge, behavior during PostgreSQL outage, and replay of pending invalidations.
