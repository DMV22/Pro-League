---
status: accepted
---

# Configure and version Ranking Rules per Competition Stage

Each League or Group Stage will own versioned Ranking Rules rather than inheriting one global platform rule. A Format Template may provide defaults, including a `3/1/0` Points Scheme, but the Admin configures the Stage's ordered Tie-breakers, Qualification Rules, and cross-group comparison before activation. Every group within one Group Stage shares those rules.

## Consequences

Standings remain derived from Finished Matches and active Standing Adjustments. Standing Adjustments add or deduct points cumulatively and are revoked or replaced by later decisions rather than edited. Match totals, goals, wins, and positions are never directly editable.

The supported Tie-breakers include overall and head-to-head statistics, away-goal criteria, wins, Fair-play Score, a Playoff Match, and a final Ranking Ruling. Multi-participant head-to-head comparisons use a mini-table and restart their configured head-to-head criteria for any smaller tied set that remains. An incomplete mini-table leaves positions provisional. Alphabetical order may stabilize row display but never determines sporting position.

Provisional ties use shared competition ranking positions such as `1, 2, 2, 4`. A Stage cannot be Finalized while a qualification-boundary tie remains unresolved. A Playoff Match resolves only the relevant ordering and contributes no points or goals to the main Standings. If statistical criteria and any configured Playoff Match do not resolve a tie, the Admin records the federation's final Ranking Ruling with its reason and supporting reference.

Fair-play comparison uses configurable penalty weights applied to Match-level Disciplinary Summaries for each Season Entry. Detailed Player events are not required. Corrections retain prior totals and trigger recalculation; if a post-finalization correction changes position or qualification, the Stage must be reopened.

Qualification Rules map calculated positions to named Qualification Slots in the destination Stage or round, including seeding and byes. If a participant is ineligible, a Qualification Ruling preserves the sporting Standings and explicitly records whether another participant fills the slot, it remains vacant, or it becomes a bye.

Cross-group comparisons may use all Matches, exclude enough Matches against the lowest-ranked participants to equalize counted Match totals, or compare exact per-Match ratios. Ranking comparisons use unrounded values even when the Portal displays rounded numbers.

Before activation, validation requires a complete Tie-breaker chain ending in a Playoff Match or Ranking Ruling, criteria for which the Stage can supply data, a coherent cross-group method, and valid destination slots. Once Active, ordinary edits are prohibited; a change requires a Format Amendment, a new rules version, a full recalculation, and preservation of the previous public version.

Finalizing the Stage produces an immutable Final Standings Snapshot and Qualification Output that record the rules and evidence used. A later Result Ruling, Standing Adjustment, or disciplinary correction may supersede them only through the established reopening process. Recalculation never silently changes participants in an already Active dependent Stage.
