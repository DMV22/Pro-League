# Match and Standings/Progression schema inventory (#70)

The [relational schema blueprint](./relational-schema.md) is the domain-level source of truth. This inventory maps its Match and Standings/Progression tables to module-owned Drizzle descriptions. The [coverage test](../../src/modules/schema-coverage.test.ts) checks every table and resolves its metadata in PostgreSQL schema `app`. No SQL migration or business workflow is generated in #70.

## Match ownership

| Blueprint area | Tables described in `src/modules/match/infrastructure/schema.ts` |
| --- | --- |
| Structural calendar and specialized slots | `fixture_rounds`, `fixture_slots`, `league_fixture_slots`, `knockout_fixture_slots`, `playoff_fixture_slots`, `replacement_fixture_slots`, `rest_slots` |
| Match identity, participation and lifecycle | `matches`, `match_participant_assignments`, `match_state_transitions`, `match_visibility_transitions` |
| Publication and scheduling | `match_publication_batches`, `match_publication_batch_items`, `match_schedule_drafts`, `match_schedule_revisions`, `match_actual_kickoffs` |
| Reusable locations and conflict guard | `venues`, `venue_profile_versions`, `playing_fields`, `match_participant_occupancies` |
| Score, ruling and official outcome | `match_result_drafts`, `played_score_versions`, `penalty_shootout_versions`, `result_rulings`, `technical_results`, `match_result_versions`, `disciplinary_summary_versions`, `match_replacements` |

`rest_slots` never references a Match, Venue, or score: it is not a knockout Bye. `match_result_versions` selects exactly one Played Score or Technical Result, while a Penalty Shootout may accompany only a Played Score. `match_replacements` is insert-only; its current decision is inferred through the supersession chain rather than updated in place.

## Standings and Progression ownership

| Blueprint area | Tables described in `src/modules/standings-progression/infrastructure/schema.ts` |
| --- | --- |
| Stage participant identity | `stage_participant_slots`, `stage_participant_assignments` |
| Ranking and qualification configuration | `ranking_rule_sets`, `points_schemes`, `tie_breakers`, `fair_play_weight_sets`, `cross_group_comparison_rules`, `cross_group_tie_breakers`, `qualification_rules`, `qualification_slots` |
| Qualification and ranking decisions | `qualification_outputs`, `qualification_rulings`, `ranking_tie_cases`, `ranking_tie_case_entries`, `ranking_rulings`, `ranking_ruling_positions`, `standing_adjustment_decisions` |
| Final league/group evidence | `final_standings_snapshots`, `final_standings_rows`, `final_standings_evidence` |
| Draw configuration and inputs | `draw_pools`, `draw_pool_entries`, `draw_pots`, `draw_constraints` |
| Round, rules and tie identity | `knockout_rounds`, `knockout_round_versions`, `tie_resolution_rule_sets`, `tie_resolution_steps`, `knockout_ties`, `knockout_tie_versions`, `knockout_tie_participant_slots`, `tie_state_transitions` |
| External draw publication | `draw_outcome_drafts`, `draw_outcome_draft_assignments`, `draw_outcomes`, `draw_outcome_assignments`, `confirmed_byes` |
| Tie decisions and final outputs | `tie_rulings`, `tie_outcomes`, `placement_outputs`, `final_knockout_snapshots`, `final_knockout_evidence` |

`cross_group_tie_breakers`, `ranking_tie_case_entries`, and `draw_outcome_draft_assignments` are normalized child tables added to express the blueprint's independent cross-group ordering, tied participants, and editable external-draw assignments. Draft assignments are not official Draw Outcomes. Provisional Standings and Aggregate Score remain derived, not authoritative rows. Final snapshots reference immutable exact inputs instead of editable calculations.

## Constraints declared in Drizzle

- Application-generated UUIDv7 keys, optimistic versions on mutable roots, and recorded times on immutable decisions follow the shared column conventions.
- A Match has one Fixture Slot and an immutable Calendar UID. Fixture Round, Rest Slot, bracket position, rule step, draw pool/pot, and other structural orders have named uniqueness and positive-position checks.
- Match sporting state and visibility are independent; the row-level Match check requires `finished` exactly when a current Official Result pointer exists. Official Result source is XOR Played/Technical, with a Shootout forbidden on a Technical Result. Scores, card totals and kicks are nonnegative.
- Published Schedule Revisions preserve local date/time, timezone, resolved UTC kickoff when both components are known, Venue/Field names and address, designation, reason, actor and exact Home/Away assignments. A changed physical venue is not inferred to be neutral.
- Playing Fields have at most one default per Venue. The current participant-occupancy guard has one row per Match/Season Entry and a nonempty half-open `tstzrange`; old published schedules remain in Schedule Revisions, not stale occupancy rows. Overlap exclusion is not yet present.
- Ranking and Tie Resolution steps have explicit order. Qualification destinations use direct-slot versus Draw Pool XOR checks. Final evidence rows point to exactly one typed immutable input each. No away-goals resolution step exists for knockout Ties.

## Required review for the first complete migration (#72)

1. Add a deferrable constraint trigger ensuring each `fixture_slots` row has exactly one specialization matching `slot_type`. Validate referenced Stage, Stage Version, Round, Tie and participant source ownership using composite FKs or equivalent constraints.
2. Add `btree_gist` and a GiST exclusion for overlapping `match_participant_occupancies` of the same Season Entry. Replace both participants' guard rows in the Schedule Revision transaction; published Schedule Revisions retain history. Playing Field collisions are warnings with reasoned override, not this hard exclusion.
3. Enforce current pointer ownership: Match assignment/schedule/result/kickoff must belong to that Match; Stage participant assignment to its slot; Knockout Round/Tie version/ruling/outcome to their roots; Draw Assignment to the published Draw; and every snapshot evidence reference to its finalized Stage. Some cross-module FK targets are deferred until #71 describes Governance actors and Supporting References.
4. Add partial uniqueness or equivalent transaction guards for current Stage participant appearances, current Match/Draw/Tie assignments and unsuperseded decisions. Validate unique draw-source use and no cyclic progression across the complete graph.
5. Protect immutable scores, rulings, decisions, transitions, rule sets, Draw Outcomes and final snapshots with insert-only grants/triggers. Supersession changes current pointers or adds a successor; it never edits prior evidence.
6. Validate whole-rule sequences, valid Shootout placement, cross-group criteria, qualification-boundary resolution, matching Home/Away participant versions, all-required final evidence, and all-or-nothing finalization in owning transactions. A row-level `CHECK` cannot prove these cross-row invariants.
7. Review generated SQL and live PostgreSQL metadata from an empty PostgreSQL 18 database together with #69 and #71 before applying any shared-environment migration. The schema descriptions alone do not guarantee these advanced constraints.
