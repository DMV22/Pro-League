# ProLeague

ProLeague is an official information portal for football competitions administered or covered by a local federation. It is being developed as a production-oriented replacement for the repository's original football manager simulator prototype.

The Portal will provide public access to federation-approved news, competitions, seasons, teams, season rosters, matches, results, and standings. Visitors do not need an account. At launch, one invite-only Admin role manages Official information.

## Target architecture

The MVP is designed as a single Next.js App Router modular monolith and a single application deployment:

```text
Public Portal and Admin interface
                |
                v
        Next.js application
        - Server Components
        - Server Actions
        - Route Handlers
        - application services
        - domain modules
                |
        +-------+-------+
        |               |
        v               v
   PostgreSQL      Object storage

Admin identity and sessions: Clerk invite-only
```

- **PostgreSQL** is the authoritative store for public and administrative data.
- **Clerk** authenticates invited Admin identities; the application still verifies that an identity maps to an active Admin record.
- **Object storage** holds uploaded media while PostgreSQL holds its metadata and associations.
- **Server Components** read through server-only application services and repositories.
- **Server Actions** execute mutations initiated by the Admin interface.
- **Route Handlers** expose only genuine HTTP boundaries such as Clerk webhooks or a future public API.
- **Redux Toolkit**, if retained, manages complex client-side UI state only. It is not a source of Official information.

Business rules belong to framework-independent domain and application modules rather than React components, Server Actions, or Route Handlers. This keeps a future extraction to a separate API possible without paying that operational cost during the MVP.

## MVP scope

- Multiple Competitions and Seasons whose formats may contain one or more ordered stages.
- Independent Season sporting lifecycle, public visibility, and Registration Window, with explicit Admin-controlled transitions.
- A Season sporting lifecycle of Preparing, Active, Completed, Cancelled, or Abandoned, with activation gated by a valid format, approved entries, and a ready opening stage.
- Overlapping Active Seasons where needed, while each Competition has only one Admin-designated Current Season.
- Distinct cancellation before the first official Match and abandonment after play has begun, with preserved history and reasons.
- Explicit Season completion after all stages and federation rulings are finalized, followed by a public historical archive.
- Exceptional audited reopening of a Completed Season when a later federation decision changes sporting information.
- Audited reopening of a Season's Registration Window without changing its sporting lifecycle.
- League stages, Group Stages, Knockout stages, and Hybrid Formats.
- One-match and two-leg Knockout Ties, with an optional Third-place Match.
- Multiple valid format configurations for the same Team count, with the federation's approved format selected and configured by the Admin.
- Reusable Format Templates for common structures, with editable groups, rounds, Legs, progression rules, and placement matches per Season.
- Audited Format Amendments when the federation changes an active Season's structure, including adding or removing a Third-place Match.
- Private validation and explicit atomic publication of Format Amendments, with affected Stage transitions and previous format versions preserved.
- Teams participating through season-specific entries.
- Players registered through Season Rosters.
- Matches with Scheduled, Postponed, Cancelled, and Finished states.
- Match Results entered and confirmed manually by an Admin.
- Played Scores preserved separately from federation-assigned Technical Results, with the current official Match Result driving progression and Standings.
- Final federation rulings recorded by the Admin, while protest submission and review remain outside the platform.
- Technical Results for unplayed Matches, such as a `0:3` decision after a Team fails to appear, without inventing a Played Score.
- Admin-entered technical scores that reproduce federation rulings rather than values inferred automatically by the platform.
- Appealed Result Rulings that can replace a Technical Result or restore the Played Score while preserving the full decision history.
- Explicit Admin finalization of Knockout Ties before their winning Teams can enter dependent Matches; deadlines do not finalize progression automatically.
- Explicit Admin finalization of every Competition Stage before its advancing Teams enter a dependent stage.
- Competition Stage progression through Configuring, Ready, Active, Awaiting Finalization, and Finalized states.
- Exceptional audited reopening of a Finalized Stage, restricted once a dependent Stage has become Active.
- Removal of an unstarted Stage and abandonment of a started Stage as distinct, history-preserving Format Amendment outcomes.
- Admin-controlled lifecycle transitions; dates and completed Matches produce reminders and readiness signals, never automatic state changes.
- Standings derived from confirmed results and explicit federation adjustments.
- News Articles with Draft, Published, Archived, and correction history.
- Associations between News Articles and multiple Competitions, Seasons, and Teams.
- Audit history for corrections to published Official information.

Transfers, contracts, player market values, detailed player statistics, public accounts, additional administrative roles, in-platform voting, and protest case management are outside the initial MVP.

## Current state

The checked-in application is still the original Vite, React, Redux Toolkit, and `redux-persist` learning prototype. Its browser-persisted league data is not production architecture and must not become the source of Official information.

The migration to Next.js and PostgreSQL has been designed but not yet implemented. Existing presentational components and useful tests may be migrated selectively; simulator-specific state and behavior will be retired.

Current prototype commands:

```bash
pnpm install
pnpm dev
pnpm test:run
pnpm build
```

## Project documentation

- [Domain language](./CONTEXT.md)
- [Architecture decisions](./docs/adr/)
- [Central data architecture research](./docs/research/central-data-architecture-options.md)

The accepted application shape is recorded in [ADR-0011](./docs/adr/0011-use-a-single-nextjs-modular-monolith.md). It supersedes the earlier decision to build a separate REST API.
