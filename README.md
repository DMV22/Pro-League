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
- Versioned Tie Resolution Rules per Knockout Round, with exceptions requiring a Format Amendment.
- Direct Penalty Shootout as the default resolution of a drawn one-match Tie, with explicitly configured extra time or Replay Match as optional alternatives.
- Two-leg Ties decided by Aggregate Score and then a direct Penalty Shootout, without extra time or an away-goals rule.
- Separate Regulation, extra-time, Played Score, and Penalty Shootout values so shootout kicks never affect aggregate or goal statistics.
- Byes that advance Qualification Slots without fictional Matches or Technical Results.
- External federation draws recorded as validated Draw Outcomes with pots, pairing constraints, bracket slots, and explicit home or away order.
- Fixed brackets and redraw-after-each-round progression, including unresolved source slots published before their Season Entries are known.
- Knockout Ties progressing through Configured, Ready, In Progress, Awaiting Finalization, and explicitly Finalized states.
- Penalty Shootout summaries that store only successful-kick totals and winner.
- At most one optional Replay Match for a one-match Tie, with immediate penalties as its default draw resolution.
- Audited Tie Rulings that determine advancement without inventing a Match score.
- Superseding Tie Rulings and explicit reopening when a later federation decision changes a Finalized Tie.
- Independent Tie suspension that blocks further play and finalization while preserving completed Match Results.
- Aggregate Scores derived from current official Match Results, including applicable Technical Results and excluding Penalty Shootouts.
- Confirmed Byes that fill destination slots without creating fictional or Finalized Ties.
- Supersedable Draw Outcomes before play, while post-start redraws require a Format Amendment and federation decision.
- Finals and Third-place Matches modeled as one-match Ties with placement outputs rather than advancing participants.
- Placement Outputs created only when a Final or Third-place Match is explicitly Finalized.
- Knockout Stage finalization gated by completed Ties, confirmed Byes, settled rulings, valid outputs, and no suspended or missing slots.
- Immutable Final Knockout Snapshots preserving the bracket, Draw Outcomes, Byes, rulings, and outputs used at finalization.
- Multiple valid format configurations for the same Team count, with the federation's approved format selected and configured by the Admin.
- Reusable Format Templates for common structures, with editable groups, rounds, Legs, progression rules, and placement matches per Season.
- Audited Format Amendments when the federation changes an active Season's structure, including adding or removing a Third-place Match.
- Private validation and explicit atomic publication of Format Amendments, with affected Stage transitions and previous format versions preserved.
- Teams participating through season-specific entries.
- Players registered through Season Rosters.
- Matches generated from Competition Formats or entered manually by an Admin and validated against the Stage structure.
- Manually entered official Matches linked to valid Fixture Slots; additions outside an Active format require a Format Amendment.
- Fixture Rounds as structural groups whose Matches may occur on different days and at different times.
- Independent Match sporting state and Private or Public visibility, including Unscheduled, Scheduled, Postponed, In Progress, Finished, and Cancelled states.
- Season-default IANA timezone with Match-level override and separately supported date TBD and time TBD schedules.
- Scheduled Kickoff as the authoritative published time, with optional Actual Kickoff for relevant ceremonies or delays and no required Actual End.
- Reusable Venues with locality, address, optional coordinates, and Venue TBD.
- Reusable Playing Fields within a Venue so distinct fields may host Matches concurrently.
- Explicit home, away, or neutral Venue Designation while every Match retains Home and Away participant roles.
- Home Matches remaining home when moved to an alternate Venue or Playing Field; only explicit federation designation makes a Match neutral.
- Single or double round-robin generation with a Rest Slot for the resting participant, localized as `Вихідна` in the Ukrainian UI, plus Home/Away balancing, optional date proposals, and explicit Admin confirmation.
- Publication by Match, Fixture Round, Knockout Round, or Stage with preserved Schedule Revisions.
- Schedule validation for participant overlap, source finalization, and format consistency, plus reasoned overrides for rest and Venue timing warnings.
- Multiple Matches on the same playing field and day when their occupancy intervals and configured turnaround time do not overlap.
- Field Occupancy Windows derived from Scheduled Kickoff, expected duration, and turnaround rather than a required Actual End.
- Explicit Match state transitions, including Suspended Match for play that began but awaits a federation decision.
- Mandatory internal reasons and optional public explanations for published Schedule Revisions, postponements, cancellations, and suspensions.
- Regeneration only before first publication; later changes use Schedule Revisions or a Format Amendment.
- Schedule Revisions for kickoff, Venue, Playing Field, or Home/Away changes, while structural fixture changes after Stage activation require a Format Amendment.
- Suspended Matches that can resume as the same Match, finish by ruling, or produce a separately linked Replacement Match.
- Physical deletion limited to unpublished, unstarted, dependency-free Private Matches.
- Partial schedule publication with Public TBD fixtures while later rounds remain Private.
- Historical Venue and Playing Field details preserved through Schedule Revisions rather than rewritten by later venue changes.
- Downloadable read-only iCalendar exports for Public Competition or Season schedules, with stable events across changes and explicit cancellation.
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
- Versioned Ranking Rules per League or Group Stage, with a configurable win/draw/loss Points Scheme defaulting to `3/1/0`.
- Ordered configurable Tie-breakers, including overall, head-to-head, away-goal, fair-play, Playoff Match, and final federation ruling criteria.
- Recursive head-to-head mini-tables, provisional shared positions, and explicit unresolved-tie gates before Stage finalization.
- Configurable Match-level card weights for Fair-play Score without requiring detailed Player event statistics.
- Audited corrections to Match-level Disciplinary Summaries with recalculation and reopening when sporting outcomes change.
- Playoff Matches that settle tied positions without contributing points or goals to the main Standings.
- Declarative qualification by configured positions, per-group places, cross-group ranking, named destination slots, seeding, and byes.
- Audited Qualification Rulings that preserve calculated Standings when an ineligible participant must be replaced, left vacant, or converted to a bye.
- Configurable cross-group comparison using all Matches, exclusion of results against lowest-ranked participants, or exact per-Match ratios.
- Reasoned Standing Adjustments that add or deduct points without directly editing calculated Match totals or positions.
- Cumulative, revocable, and supersedable Standing Adjustments whose previous decisions remain immutable.
- Immutable Final Standings Snapshots and Qualification Outputs produced by explicit Stage finalization.
- Validation that every active Stage has a complete Tie-breaker chain and valid Qualification Slots.
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
