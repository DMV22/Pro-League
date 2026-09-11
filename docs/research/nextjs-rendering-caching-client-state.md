# Next.js rendering, caching, and client-state boundaries for ProLeague

Research date: 2026-09-11

## Question and status

GitHub issue #21 asks which App Router routes should be static, cached, streamed, or rendered at request time; how cache tags and revalidation should preserve the freshness of Official information; which Admin interactions need Client Components; and which state belongs in URLs, forms, React, Redux Toolkit, or the server.

This note records primary-source findings and a recommended direction. It is input to an ADR, not itself an accepted architecture decision. Product-specific recommendations are identified as ProLeague inferences rather than claims made by the cited projects.

The research assumes the current Next.js Cache Components model, documented for Next.js 16.3.4 on the research date. Next.js explicitly separates this model from its previous caching model, so the eventual ADR and implementation should pin the supported Next.js major version and should not mix the two sets of route configuration ([Next.js: Caching](https://nextjs.org/docs/app/getting-started/caching), [Next.js: Caching without Cache Components](https://nextjs.org/docs/app/guides/caching-without-cache-components)).

## Repository constraints

The following accepted decisions bound the answer:

- ADR-0011 selects one Next.js App Router modular monolith. Server Components read through server-only application services, Server Actions adapt Admin-initiated mutations, and Route Handlers are reserved for real HTTP boundaries.
- ADR-0018 requires server-rendered public News Articles, authenticated previews that use the same semantic renderer, server-authoritative autosave, scheduled publication, and no partial exposure when publication readiness fails.
- ADR-0020 prioritizes cached Published information during partial failure, requires server-rendered critical public information, sets a cached-response target of 500 ms, and requires last-updated and stale-warning behavior.
- ADR-0021 permits a server-only read-only Query Layer for cross-module view models. Domain commits precede versioned cache-tag revalidation; post-commit cache work uses an idempotent outbox and may temporarily leave public reads stale under Graceful Degradation.
- PostgreSQL, not a browser store, is authoritative for Official information and Admin access state.

The checked-in `src` is still the Vite learning prototype rather than an App Router tree. `src/main.tsx` mounts a single global Redux provider and `PersistGate`; `src/store/index.ts` persists both `league` and `ui` slices to `localStorage`; `src/features/league/slices/league.slice.ts` currently mutates Teams, Matches, Standings inputs, Transfers, and the current round in the browser. That entire `league` slice conflicts with the accepted production boundaries and should not be migrated as client-owned state. The small `ui` slice is closer to an allowed UI-state shape, but its fields should first be allocated to URL or local React state before retaining Redux.

## Primary-source facts

### Server and Client Components

App Router layouts and pages are Server Components by default. Server Components are appropriate for direct data-source access, secrets, reducing browser JavaScript, and progressively streaming content. Client Components are required for state, event handlers, lifecycle effects, browser APIs, and custom hooks ([Next.js: Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)). React additionally specifies that Server Components may run at build time or for a request, are not sent to the browser as component code, cannot use interactive APIs such as `useState`, and may compose Client Components ([React: Server Components](https://react.dev/reference/rsc/server-components)).

`'use client'` establishes a client module-graph boundary: the marked file and its transitive imports enter the client bundle. Next.js therefore recommends placing Client Components as low as practical in the tree. Values passed from a Server Component to a Client Component must be serializable by React ([Next.js: Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)).

`'use server'` marks Server Functions; it does not identify Server Components. Server Function arguments originate at the client and must be treated as untrusted input ([React: `'use server'`](https://react.dev/reference/rsc/use-server)).

### Cache Components and streaming

Cache Components are opt-in through `cacheComponents: true`. Once enabled, Next.js can combine a prerendered static shell, cached data or UI, and request-time streamed content in one route. The `use cache` directive can cache an async data function, component, page, or file; Next.js recommends pairing each directive with an explicit `cacheLife`. Data-level caching is useful when the same query is reused independently from UI ([Next.js: Caching](https://nextjs.org/docs/app/getting-started/caching), [Next.js: `use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache)).

Uncached asynchronous work and runtime request APIs such as cookies, headers, route params, and search params belong behind a `Suspense` boundary. The fallback can be part of the prerendered shell while request-time content streams later. `Suspense` alone does not make synchronous content dynamic ([Next.js: Caching](https://nextjs.org/docs/app/getting-started/caching)).

With Cache Components enabled, routes are dynamic by default where runtime work requires it, while eligible shells and cached content are extracted automatically. The older `dynamic = 'force-dynamic'`, route-level `revalidate`, and `fetchCache` techniques belong to the previous model and should not be the design vocabulary for this project. Cache Components require the Node.js runtime and do not support the Edge runtime ([Next.js: Caching](https://nextjs.org/docs/app/getting-started/caching)).

### Tags and invalidation

`cacheTag` associates cached work with tags and is valid only inside a `use cache` scope. Current documented limits are 256 characters per tag and 128 tags per cache entry ([Next.js: `cacheTag`](https://nextjs.org/docs/app/api-reference/functions/cacheTag)).

`revalidateTag(tag, 'max')` applies stale-while-revalidate behavior: a later visit may receive stale content while revalidation happens in the background. It may be called from Server Actions and Route Handlers. The single-argument form is deprecated ([Next.js: `revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)).

`updateTag(tag)` immediately expires tagged data and is available only in Server Actions. Next.js positions it for read-your-own-writes after a user mutation; it positions `revalidateTag(tag, 'max')` for content where brief staleness is acceptable. Tag invalidation is more precise than path invalidation when the same data appears on several pages ([Next.js: Revalidating](https://nextjs.org/docs/app/getting-started/revalidating), [Next.js: `updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag)).

### Server Actions and Route Handlers

Server Actions are async server functions invoked over `POST` and are primarily intended for frontend mutations. Forms can invoke them with progressive enhancement, and Next.js can return updated UI and data in the same round trip. Every action remains a reachable server endpoint, so it must authenticate, authorize, and validate its input rather than relying on the surrounding UI ([Next.js: Mutating Data](https://nextjs.org/docs/app/getting-started/mutating-data)). React likewise advises against using Server Functions for data fetching ([React: `'use server'`](https://react.dev/reference/rsc/use-server)).

Route Handlers define HTTP endpoints with the Web `Request` and `Response` APIs. Next.js recommends that Server Components fetch directly from their data source instead of calling the application's own Route Handler: an internal HTTP call fails during build-time prerendering when no server is listening and adds a network round trip during request rendering. Server Actions are queued, so using them as a data-fetching API also serializes reads unnecessarily ([Next.js: Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers), [Next.js: Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend)).

### Redux with App Router

Redux's official App Router guidance says not to create a global singleton Redux store on the server; a store must be created per request. React Server Components should not read from or write to Redux because they cannot use hooks or context and are intended to be stateless. A component that creates, provides, reads, or writes the Redux store must be a Client Component ([Redux: Redux Toolkit Setup with Next.js](https://redux.js.org/usage/nextjs)).

The same guidance recommends Redux only for globally shared, mutable client state and recommends Next.js route/search parameters, forms, React context, and hooks for other state. Server fetching belongs in async Server Components; RTK Query is appropriate only when client-side fetching is actually required. A provider in a persistent layout survives client-side route transitions, so route-specific state must be reset or the provider should be scoped to the route that owns it ([Redux: Redux Toolkit Setup with Next.js](https://redux.js.org/usage/nextjs)).

## Recommended rendering matrix

The matrix below is an architectural inference from the official behavior and the accepted ProLeague requirements.

| Surface | Recommended rendering | Data and cache boundary | Reason |
| --- | --- | --- | --- |
| Public global shell, navigation, footer, accessibility landmarks, static help/legal/contact copy | Prerendered static shell | No request state; redeploy for truly static copy, or cache separately if Admin-managed later | Fast HTML with no browser JavaScript dependency |
| Home page, public News Article feeds, category/archive pages | Cached Server Components inside a static shell | Server-only Query Layer functions with `use cache`, explicit `cacheLife`, and collection tags | Published content is shared by all Visitors and ADR-0020 explicitly prioritizes cached reads |
| Published or Archived News Article canonical page | Cached Server Component | Cache by stable Article ID/version; tag the Article and its Editorial/Media dependencies | SEO, reproducible server rendering, stable URL, and prompt correction invalidation |
| Public Competition, Season, Team, Player, Match, schedule, bracket, and Standings pages | Cached Server Components; use `Suspense` for independently slow sections | Cache cohesive view-model queries, not ORM entities; tag the page projection and coarse dependency collections | The same official data is shared across Visitors; sections can refresh independently without making the whole page wait |
| Public pages with filters, sorting, pagination, selected Stage/round/date | Static/cached shell plus cached or request-time results under `Suspense` | Normalize `searchParams`, pass primitives to cached Query Layer functions, and cache only useful bounded combinations | The URL remains shareable and browser-navigable; arbitrary query combinations must not create an unbounded cache |
| Live/In Progress Match surface | Cached baseline plus a streamed request-time live section, unless operational evidence justifies polling/client fetching | Keep confirmed Official Match state server-owned; use a short `cacheLife` or uncached read for the live section | Avoid turning the entire route into a client application before a real live-update requirement exists |
| Authenticated Admin layouts, dashboards, lists, detail/edit screens, Audit History, private documents, Privacy Requests | Request-time Server Components; do not place personalized/private query results in shared `use cache` entries | Read session and active PostgreSQL Admin status on every protected request; query server-owned data directly | Authorization and current private data take precedence over cross-user cache reuse |
| Draft/Scheduled Article and Working Revision preview | Request-time authenticated Server Component using the same semantic renderer as public content | No public cache; authorize both route and underlying query | ADR-0018 requires authenticated preview and forbids partial public exposure |
| Mutation result shown back to the initiating Admin | Server Action response plus refreshed request-time Admin data | Domain command commits first; do not treat the client result as authoritative state | Supports progressive enhancement and keeps authorization at the server boundary |
| Clerk webhook, object-storage callback, health/integration endpoint, iCalendar export, future public API | Route Handler | Validate/authenticate as applicable; cache only genuinely public GET representations with explicit policy | These are HTTP consumers rather than React UI data loaders |
| `robots.txt`, sitemap, metadata, Open Graph data | Static when independent of content; otherwise cached server generation with the same entity/collection tags | Derive from Published/indexable records only | Prevent private/editorial states from leaking into discovery surfaces |

“Static”, “cached”, “streamed”, and “request-time” are not mutually exclusive route labels under Cache Components. A Season page can have a prerendered shell, cached Season identity and schedule, cached Standings, and a request-time freshness indicator in separate `Suspense` boundaries. The implementation should choose boundaries by independent freshness and failure behavior, not by creating one mode for an entire route.

## Recommended cache model

### Cache at Query Layer functions

Place `use cache`, `cacheLife`, and `cacheTag` around server-only Query Layer functions that return purpose-built serializable view models. Do not cache repositories, mutable domain aggregates, authorization decisions, Admin records, private documents, Drafts, scheduled content before publication, or a whole authenticated layout.

Prefer a small number of cohesive projections over tagging a large page with every row it contains. The 128-tag entry limit makes “one tag per Match on a Season schedule” brittle. A versioned schedule or Standings projection should instead carry a stable aggregate/collection tag whose invalidation is emitted whenever an owning input changes.

Recommended tag families use stable IDs, not mutable slugs or display names:

```text
portal:home
articles:list
article:<articleId>
category:<categoryId>:articles
competitions:list
competition:<competitionId>
season:<seasonId>
season:<seasonId>:schedule
season:<seasonId>:standings
stage:<stageId>:progression
team:<teamId>
player:<playerId>:public
match:<matchId>
media:<mediaAssetId>
```

A cached query attaches the smallest set that describes its output. For example, a canonical Article query can use `article:<id>` plus tags for the small number of directly rendered Media Assets; a Season schedule uses `season:<id>:schedule` rather than every Match tag. A home page uses `portal:home` and `articles:list`, while the publishing workflow emits both. This is a proposed convention and needs validation against the final Query Layer shapes.

### Invalidate only after commit

The durable ordering remains ADR-0021's ordering:

1. Validate and commit the domain mutation, Audit Event, and versioned outbox messages in one PostgreSQL transaction.
2. After commit, invalidate all projection tags named by that committed change.
3. Make invalidation idempotent because the outbox is at-least-once.
4. If invalidation fails, preserve the accepted domain decision, expose External Sync Pending, retry, and eventually reconcile.

Use `updateTag` in the successful Server Action only when the initiating Admin or a redirect to a public page genuinely requires read-your-own-writes. The durable outbox consumer should still perform idempotent tag revalidation because the action can terminate after commit. Use `revalidateTag(tag, 'max')` for ordinary publication, schedule, Match Result, and Standings invalidation where ADR-0020 permits a brief stale interval. Route/path revalidation is a fallback for route structure or metadata not described by data tags, not the primary invalidation model.

The application should emit semantic invalidation intents such as `SeasonScheduleChanged(seasonId)` or a versioned list of tag keys from the application layer. Domain modules must not import `next/cache`; a Next.js infrastructure adapter translates those intents into `updateTag`/`revalidateTag` calls, preserving ADR-0021's framework-neutral ports.

### Freshness and failure

Every cached public projection should include an authoritative `lastUpdatedAt` derived from its committed data/projection version, not from the render clock. A stale warning must be driven by an explicit inability to confirm currentness or an unresolved cache-sync/reconciliation signal; age alone may be shown but should not falsely claim an outage.

Event-driven invalidation should be the normal freshness mechanism. `cacheLife` remains necessary and supplies a bounded fallback, but exact profiles cannot be selected until the project chooses freshness targets and deployment cache capabilities. Public Published history can tolerate longer cache retention than In Progress Matches or the current schedule. Private/Admin reads should remain request-time even if public projections of the same entities are cached.

Privacy restrictions and Media Withdrawals need broad, urgent invalidation. They should invalidate the entity's public tag, every known placement/projection tag recorded by the execution plan, and any relevant discovery/feed tags. Because `revalidateTag(..., 'max')` may serve stale data once, the ADR must decide whether these exceptional cases require an immediate Server Action `updateTag`, a Route Handler-compatible immediate-expiry profile, or a deployment-level purge capability. This is a security/privacy decision, not merely a performance tuning choice.

## Recommended Server/Client boundary

Keep page/layout files and data-bearing feature components as Server Components. They call the Query Layer directly and pass only minimal serializable view data into interactive islands. Candidate Client Components include:

- menus, dialogs, disclosure controls, tabs that are intentionally not URL-addressable, and responsive navigation;
- form controls needing immediate feedback, rich-text editing, media selection/crop/focal-point tools, upload progress, drag-and-drop schedule planning, and other browser APIs;
- optimistic/pending UI around a Server Action;
- a narrowly scoped live-match updater only if a real-time requirement is later accepted.

Client Components do not authorize actions, validate domain rules, decide lifecycle transitions, calculate Official Standings, or own the successful result of a mutation. Their Server Action repeats authentication, Active Admin authorization, input validation, expected-version checking, and command-idempotency checks before invoking an application command.

Passing a rendered Server Component as `children` to an interactive Client shell is preferable to marking an entire page client-side. Do not import server-only Query Layer modules into a client boundary.

## State ownership matrix

| State kind | Owner | ProLeague examples |
| --- | --- | --- |
| Canonical Official information | PostgreSQL through domain/application modules | Competitions, Seasons, Formats, Teams, Rosters, Matches, Results, Standings inputs and final snapshots, Articles, Media metadata, Audit History |
| Protected identity/authorization | Clerk session plus PostgreSQL Admin state, checked server-side | Completed session, Active/Suspended/Revoked Admin access, recent reverification |
| Shareable/navigation state | URL path and normalized search parameters | selected Competition/Season/Stage/round/team/date, public filters, archive page, pagination, table sort whose link should reproduce the view |
| Submitted mutation data and validation result | HTML form + Server Action, with React form state for pending/errors | Result confirmation, lifecycle transition reason, Article publication, schedule revision, filters submitted as navigation |
| Local ephemeral interaction | component-local React state/reducer | open dialog, unsaved input focus, disclosure state, upload progress, temporary crop/focal-point interaction |
| Cross-component mutable client workflow | route-scoped Redux Toolkit only when React composition becomes materially awkward | complex schedule-builder selection across distant panels, multi-panel editor tooling, bounded undo/redo before server autosave |
| Server data needed after hydration | Prefer Server Component refresh/navigation; RTK Query only for a proven client-only interaction | optional polling/live updates, not the ordinary page-loading path |
| Harmless durable preference | cookie or narrowly scoped browser storage after privacy review | density/theme preference; never Official data, session secrets, private Player data, or authorization |
| Draft recovery | Server-authoritative autosave; bounded browser snapshot only as recovery aid | Article Working Revision recovery, clearly marked as unsynced and never publishable directly |

For the current `ui` slice specifically, `selectedTeamId` and `selectedRound` belong in the route/URL when they determine what resource is viewed; `standingsSort` belongs in search parameters when the sorted view should be shareable; and `playerFilter` belongs in normalized search parameters for public/admin list filtering. Local state is sufficient when any of those affect only one non-shareable widget. This leaves no demonstrated need for a global Redux provider in the initial migration.

If a later Admin workflow justifies Redux, create its store per request, mount the provider at the narrow route boundary that owns the workflow, initialize it with serializable server-provided data, and reset route-specific state on entity/route changes. Do not carry the current root `PersistGate` or whitelist the former `league` slice.

## Server Actions versus Route Handlers

Use Server Actions for same-origin UI commands: create/edit/schedule/publish an Article, confirm or supersede a Match Result, revise a schedule, change lifecycle state, approve an application, or execute an authorized privacy step. Thin action adapters should translate `FormData`/serializable inputs into framework-neutral application commands and translate typed outcomes back into form/UI state.

Use Route Handlers for Clerk webhooks, storage callbacks, download/export representations such as iCalendar/CSV when HTTP headers and streaming matter, health/integration endpoints, and a future REST API. Scheduled publication or outbox work should invoke application jobs directly in the server process where the deployment supports it; expose an authenticated Route Handler only when the scheduler/worker is an external HTTP caller.

Neither boundary owns business rules. Server Components should never call internal Route Handlers for ordinary reads, and Server Actions should never be used as a general query API.

## Open decisions for the ADR

1. **Next.js and runtime baseline:** Pin the Next.js major/minor range, explicitly enable Cache Components, and accept the Node.js-runtime constraint, or choose the previous caching model. The recommendations above assume Cache Components.
2. **Deployment cache durability:** Determine whether the chosen low-cost host supplies a durable/shared cache across instances and deploys. This affects Graceful Degradation and may require a custom cache handler or CDN policy.
3. **Freshness classes:** Define maximum acceptable stale intervals for Published Articles, schedules, current Standings, In Progress Matches, corrections, and general archive pages; then map them to named `cacheLife` profiles.
4. **Urgent purge semantics:** Choose the mechanism that guarantees prompt removal for Privacy Requests, Media Withdrawals, accidental disclosure, and incorrect sensitive content when background stale-while-revalidate is insufficient.
5. **Live Match behavior:** Decide whether the MVP means periodic full-page/navigation refresh, client polling, or no live auto-refresh. There is not yet evidence for WebSockets or a global client cache.
6. **Admin shell caching:** Confirm that all authenticated/private data stays request-time and whether any non-sensitive, cross-user reference catalog is worth separately caching after authorization. Never cache an authorization decision.
7. **Redux threshold:** Name at least one concrete cross-component client workflow before retaining Redux Toolkit. Otherwise migrate without a global Redux store and add a route-scoped store only when needed.
8. **URL contract:** Define canonical parameter names, validation/defaults, and which filters/sorts are indexable so caching, metadata, and duplicate-content behavior remain bounded.
9. **Outbox adapter location:** Decide how the post-commit worker reaches Next.js cache APIs in the selected deployment and how reconciliation verifies that each semantic invalidation intent was applied.
10. **Cache observability:** Define measurements for hit ratio, revalidation failures, cache age, unresolved External Sync Pending work, and stale-warning activation without logging personal data.

## Recommended decision direction

Enable Cache Components on a pinned Node.js Next.js baseline. Build public routes from static shells and cached server-only Query Layer projections, with `Suspense` boundaries for independently slow or request-time sections. Keep all authenticated Admin/private views request-time. Use small Client Component islands; use Server Actions for same-origin UI mutations and Route Handlers only for real HTTP consumers.

Treat cache invalidation as a post-commit, versioned, idempotent infrastructure effect using stable semantic tags. Use stale-while-revalidate for ordinary public freshness and design an explicit immediate-purge path for privacy/security removal. Keep Official information, permissions, drafts, and mutation outcomes server-owned. Prefer URL, forms, and local React state in that order; retain route-scoped Redux only for a demonstrated complex client workflow, never as a domain store or default server-data cache.

## Primary sources

- [Next.js: Caching](https://nextjs.org/docs/app/getting-started/caching)
- [Next.js: Caching without Cache Components](https://nextjs.org/docs/app/guides/caching-without-cache-components)
- [Next.js: `use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache)
- [Next.js: `cacheTag`](https://nextjs.org/docs/app/api-reference/functions/cacheTag)
- [Next.js: Revalidating](https://nextjs.org/docs/app/getting-started/revalidating)
- [Next.js: `revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)
- [Next.js: `updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag)
- [Next.js: Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js: Mutating Data](https://nextjs.org/docs/app/getting-started/mutating-data)
- [Next.js: Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [Next.js: Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend)
- [React: Server Components](https://react.dev/reference/rsc/server-components)
- [React: `'use server'`](https://react.dev/reference/rsc/use-server)
- [Redux: Redux Toolkit Setup with Next.js](https://redux.js.org/usage/nextjs)
