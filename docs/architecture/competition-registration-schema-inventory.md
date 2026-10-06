# Competition and Registration schema inventory (#69)

The source of truth for the required tables is the [relational schema blueprint](./relational-schema.md). This inventory maps its Competition and Registration sections to the module-owned Drizzle files. The [schema coverage test](../../src/modules/schema-coverage.test.ts) checks every named table and resolves each table configuration inside PostgreSQL schema `app`. No SQL migration is generated or applied in #69.

## Competition ownership

| Blueprint area | Tables described in `src/modules/competition/infrastructure/schema.ts` |
| --- | --- |
| Competition identity and public slugs | `competitions`, `competition_slugs`, `competition_profile_versions` |
| Season identity and independent state/history | `seasons`, `season_slugs`, `season_state_transitions`, `season_visibility_transitions`, `season_archive_transitions`, `current_season_designations` |
| Format root and server-authoritative draft | `competition_formats`, `competition_format_drafts`, `format_draft_stages`, `format_draft_stage_groups`, `format_draft_participant_slots`, `format_draft_dependencies` |
| Draft ranking and qualification | `format_draft_ranking_rule_sets`, `format_draft_points_schemes`, `format_draft_tie_breakers`, `format_draft_qualification_rules` |
| Draft draw and knockout configuration | `format_draft_draw_pools`, `format_draft_draw_pots`, `format_draft_draw_constraints`, `format_draft_knockout_rounds`, `format_draft_knockout_ties`, `format_draft_tie_participant_slots`, `format_draft_resolution_steps` |
| Published format versions and amendment | `competition_format_versions`, `competition_format_activations`, `format_amendments`, `format_amendment_transitions`, `format_amendment_stages` |
| Reusable templates | `format_templates`, `format_template_versions` |
| Stage identity, versions and grouping | `competition_stages`, `competition_stage_versions`, `stage_state_transitions`, `stage_dependencies`, `stage_groups`, `stage_group_versions` |

`format_amendment_stages` is an additional join/history table for the blueprint's “affected Stages” field; it avoids a mutable array or JSONB list. Draft structures are mutable. Format, Stage, profile, slug, activation, transition, and template versions are historical records. The immutable ranking, draw, and knockout rule sets for an activated Stage are owned by Standings & Progression and belong to #70, not to these draft tables.

## Registration ownership

| Blueprint area | Tables described in `src/modules/registration/infrastructure/schema.ts` |
| --- | --- |
| Team identity | `teams`, `team_profile_versions`, `team_slugs` |
| Player identity and private evidence | `players`, `player_identity_versions`, `player_private_details`, `player_private_detail_versions`, `player_merges`, `player_publication_transitions`, `player_publication_consents` |
| Team entry | `season_applications`, `season_application_decisions`, `application_checklist_templates`, `application_checklist_template_items`, `application_checklist_items`, `season_entries`, `season_entry_state_transitions` |
| Independent registration windows and rules | `registration_windows`, `registration_window_transitions`, `roster_rule_sets`, `legionnaire_quota_versions` |
| Roster and eligibility | `season_rosters`, `roster_readiness_decisions`, `roster_entries`, `roster_registration_periods`, `roster_registration_period_revisions`, `roster_entry_decisions`, `legionnaire_classification_decisions`, `roster_transfers`, `roster_eligibility_rulings` |

`application_checklist_template_items` normalizes the items in a versioned checklist before an Application receives its copied review snapshot. `roster_registration_period_revisions` is the additional immutable table approved after identifying that an open-ended immutable current interval cannot be shortened during a transfer. The current `roster_registration_periods` row is mutable and versioned; a source interval becomes `[start, transfer_date)` as the destination interval begins `[transfer_date, end)`. Both changes and their revisions belong to one audited transfer transaction. The historical revision rows must remain insert-only and are not counted as current registrations.

## Constraints declared in Drizzle

- UUID primary keys are application-generated UUIDv7; mutable roots carry `version bigint`, `created_at`, and `updated_at`. Immutable records carry a recorded time and no mutable version.
- Competition and Team normalized slugs have global historical uniqueness; Season slugs are unique within a Competition. Current Season is a Competition pointer separate from the Season sporting, visibility, and archive states.
- Approved Season Entries are unique by `(season_id, team_id)` and by their approved Application. A Season has one Format root; a Season Entry has one Season Roster.
- Draft Stage, Group, Round, Tie, Slot, Tie-breaker, Resolution Step, Format Version, and Stage Version order/code constraints are named. Qualification and Tie participant source columns use XOR checks.
- Representative closed states, nonnegative or ordered rule values, valid one/two-leg counts, date order, and half-open nonempty current registration periods have named checks.
- Registration references to Competition-owned Seasons use restrictive deletion. Intra-module identity and history references are explicit. `daterange` is a PostgreSQL custom column type rather than a JSONB approximation.

## Required review for the first complete migration (#72)

These are not silently assumed to exist merely because a column is present in a Drizzle description:

1. Add `btree_gist` and a GiST `EXCLUDE` on `(player_id WITH =, season_id WITH =, effective_period WITH &&)` for rows with `approval_state = 'approved'` in the **current** `roster_registration_periods` table. Verify adjacency at a transfer date is allowed and overlapping current periods are rejected. Revision rows are excluded from this guard.
2. Enforce append-only grants/triggers for slugs, profiles, versions, activations, decisions, transitions, and `roster_registration_period_revisions`. Protect the current period's `current_revision_id` from pointing to another period and require the update plus revision insert in one audited transaction.
3. Complete ownership constraints for current pointers and decisions with composite foreign keys or equivalent constraint triggers: Competition–Current Season, Competition/Season/Team/Player current slug/profile/version, Format Version–Season, Stage Version–Stage, approved Application–Season Entry, Season Roster–Rule Set, period–Player/Season/Roster Entry, and Transfer source/destination–Player/Season/window. Existing single-column references alone do not prove same-owner relationships.
4. Complete restrictive references once #70–71 describe their owners: Admin actor identities, Media Asset pointers, Governance Supporting References, progression final snapshots/rulings, and draft participant `source_season_entry_id`. Keep private Player details inaccessible to the public reader role.
5. Validate full Format and Stage graphs, active participant uniqueness, finalization readiness, transfer window applicability, roster-size and Legionnaire quotas in the owning application transaction with ordered locks. These multi-row rules are not reducible to a row-level `CHECK`.
6. Review generated SQL and Drizzle metadata together. The initial migration must build the entire supported schema from an empty PostgreSQL 18 database, including all three module tickets #69–71, before any shared-environment application.
