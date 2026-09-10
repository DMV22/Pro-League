# ProLeague

ProLeague is the official information portal for football Competitions administered or covered by a local federation. It exists to provide supporters, participants, and federation staff with a shared source of published Competition information.

## Language

**Portal**:
The public information product through which the federation publishes official championship content.
_Avoid_: Simulator, football manager, manager game

**Official information**:
Competition content that the federation has approved for public publication through the Portal.
_Avoid_: Simulated data, generated result

**Competition**:
A football contest administered or covered by the federation, such as a championship or cup. ProLeague may contain multiple Competitions.
_Avoid_: League when referring to every competition type, tournament as a catch-all term

**Season**:
A time-bounded edition of a Competition. A Competition may have multiple Seasons whose information remains separately accessible.
_Avoid_: Competition, current league

**Season Sporting State**:
The sporting phase of a Season: Preparing, Active, Completed, Cancelled, or Abandoned. It is independent of the Season's public visibility, Registration Window, Current Season designation, and archival status.
_Avoid_: Using one status for every aspect of a Season

**Preparing Season**:
A Season whose Competition Format, Season Entries, and opening Competition Stage are still being configured or validated. It may become Active only when its format is valid for the approved entries, its opening Stage is ready, and no critical configuration errors remain; a complete future Match schedule is not required.
_Avoid_: Private Season, Draft Season

**Active Season**:
A Season whose sporting program is underway. Multiple Seasons of the same Competition may be Active at the same time.
_Avoid_: Current Season

**Current Season**:
The single Season manually designated by the Admin as the primary current edition of a Competition. This designation is independent of whether the Season is Active and remains until the Admin selects another Current Season.
_Avoid_: Active Season, latest Season

**Cancelled Season**:
A Season ended by the federation before its first official Match. Its reason, configuration, and history remain preserved.
_Avoid_: Abandoned Season, deleted Season

**Abandoned Season**:
A Season ended by the federation after official Matches have begun. Its reason, played Matches, published data, and history remain preserved.
_Avoid_: Cancelled Season, deleted Season

**Completed Season**:
A Season whose sporting activity the Admin has explicitly declared complete after all Competition Stages are finalized and applicable federation rulings are resolved.
_Avoid_: Automatically completed Season

**Reopened Season**:
A previously Completed Season returned to Active because a later federation decision changes sporting information. Reopening requires a recorded reason and Audit History; if archived, the Season must first be returned from the archive, and its affected Finalized Stage must also be reopened.
_Avoid_: Corrected publication, silently active Season

**Archived Season**:
A Completed, Cancelled, or Abandoned Season removed from current presentation while remaining available as public historical information at stable addresses. The Admin may return it from the archive without changing its Season Sporting State; both actions are recorded in Audit History.
_Avoid_: Deleted Season, private Season

**Private Season**:
A Season visible only to the Admin. Public visibility is independent of the Season Sporting State.
_Avoid_: Draft Season

**Public Season**:
A Season whose published information is accessible to Visitors. Public visibility is independent of the Season Sporting State.
_Avoid_: Active Season

**Registration Window**:
The independently controlled period during which new Season Entries may be submitted or created. The Admin may close or reopen it without changing the Season Sporting State; reopening requires a recorded reason.
_Avoid_: Season Sporting State

**Competition Format**:
The complete sporting structure selected for a Season to determine its schedule and progression. It consists of one or more ordered Competition Stages, may combine different Stage Formats, and is not uniquely determined by the number of participating Teams.
_Avoid_: Competition Type when describing a permanent property of a Competition

**Format Template**:
A reusable starting arrangement from which an Admin configures a Season's Competition Format. Applying or modifying a Format Template has no sporting effect until the resulting Competition Format is assigned to that Season.
_Avoid_: Competition Format, fixed federation rule

**Format Amendment**:
An approved change to a Season's Competition Format after Matches have begun. It remains private while being prepared and validated, then takes effect through an explicit Admin action that publishes the new format as a whole while preserving the previous format, reason, responsible Admin, effective time, and affected Competition Stages.
_Avoid_: Silent format edit, new Season

**Competition Stage**:
An ordered phase of a Season with its own participants, Stage Format, and progression rules.
_Avoid_: Round when referring to a phase that may itself contain multiple rounds

**Configuring Stage**:
A Competition Stage whose participants, Stage Format, schedule, or progression rules are still being prepared.
_Avoid_: Ready Stage

**Ready Stage**:
A configured and validated Competition Stage that may be explicitly activated by the Admin when its required participants are known.
_Avoid_: Active Stage

**Active Stage**:
A Competition Stage in which official Matches or other sporting activity may take place.
_Avoid_: Ready Stage, Finalized Stage

**Stage Awaiting Finalization**:
A Competition Stage whose planned sporting activity has ended but whose outcomes, rulings, adjustments, or advancing Teams still require explicit Admin confirmation.
_Avoid_: Finalized Stage

**Finalized Stage**:
A Competition Stage whose final standings or outcomes and advancing Teams an Admin has explicitly confirmed after all applicable Match Results, Standing Adjustments, and Result Rulings are settled. Only a Finalized Stage may supply participants to a dependent Competition Stage.
_Avoid_: Completed schedule, provisional standings

**Reopened Stage**:
A previously Finalized Competition Stage returned to Active because a later federation decision changes sporting information. Reopening requires a recorded reason and Audit History; if a dependent Competition Stage is already Active, a Format Amendment and separate federation resolution are required.
_Avoid_: Silent result correction, ordinary Stage edit

**Removed Stage**:
A Competition Stage removed through a Format Amendment before its first official Match. Its configuration and reason for removal remain in the Season's history.
_Avoid_: Deleted Stage, Abandoned Stage

**Abandoned Stage**:
A Competition Stage ended through a Format Amendment after official Matches have begun. Its reason, played Matches, published information, and history remain preserved, and the Season may continue under the amended Competition Format.
_Avoid_: Removed Stage, deleted Stage

**Stage Format**:
The sporting structure used within one Competition Stage. The MVP supports League and Knockout Stage Formats, including groups and one-match or two-leg ties.
_Avoid_: Competition Format when referring to only one phase of a Season

**League Format**:
A Stage Format in which participant performance across a set of Matches produces Standings.
_Avoid_: Championship as a universal technical format name

**Knockout Format**:
A Stage Format in which Knockout Tie outcomes determine progression between rounds rather than a stage-wide Standings table.
_Avoid_: League Format, Standings-based format

**Group Stage**:
A Competition Stage that partitions participants into groups, produces separate Standings for each group, and advances qualifying participants according to its progression rules.
_Avoid_: League Format when the grouping and advancement phase is meant

**Knockout Tie**:
A pairing between two Teams in a Knockout Format, resolved by either one Match or the aggregate outcome of two Legs.
_Avoid_: Match when referring to the complete two-leg pairing

**Finalized Tie**:
A Knockout Tie whose advancing Team an Admin has explicitly confirmed after all applicable Match Results and Result Rulings are settled. Time passing does not finalize a tie; only a Finalized Tie may supply a participant to a dependent Knockout Match.
_Avoid_: Finished Match, provisional winner

**Leg**:
One Match within a two-match Knockout Tie.
_Avoid_: Round, Knockout Tie

**Third-place Match**:
An optional placement Match between the losing semi-finalists that determines third and fourth place.
_Avoid_: Final

**Hybrid Format**:
A Competition Format that combines multiple ordered Competition Stages, such as a Group Stage followed by a Knockout Stage.
_Avoid_: Group Stage, Knockout Format

**Team**:
A football side that can participate in one or more Competition Seasons, including different Competitions during the same period.
_Avoid_: Season Entry, Club unless a separate club concept is explicitly introduced

**Season Entry**:
A Team's registered participation in one specific Competition Season. Season-specific sporting data belongs to the Season Entry rather than duplicating the Team.
_Avoid_: Team, permanent membership

**Player**:
A person who may be registered to represent Teams across different Competition Seasons. The launch profile contains only the identity and public sporting details needed for Season Rosters.
_Avoid_: Roster Entry, transfer asset

**Season Roster**:
The complete set of Players registered for one Season Entry.
_Avoid_: Permanent squad, transfer list

**Roster Entry**:
A Player's registration in a Season Roster, including the playing position and shirt number applicable to that registration.
_Avoid_: Player, contract, transfer

**Admin**:
An authenticated federation representative authorized to create, edit, and publish Official information. At launch, ProLeague has one authorized role rather than separate editorial and publishing roles.
_Avoid_: Editor, Publisher

**Visitor**:
A person who reads Published News Articles and other public Official information without registering or signing in. Visitor accounts are outside the launch scope.
_Avoid_: User when no authenticated public identity exists

**News Article**:
A dated publication through which the federation communicates news about its Competitions and related activity. It may be explicitly associated with multiple Competitions, Seasons, and Teams; a textual mention alone does not create an association.
_Avoid_: Post, blog post, announcement as a catch-all term

**Draft**:
A News Article that an Admin has saved but not made publicly accessible.
_Avoid_: Unpublished Official information

**Published**:
A News Article that an Admin has made publicly accessible as Official information.
_Avoid_: Approved, live

**Archived**:
A previously Published News Article that is retained by ProLeague but no longer appears as current public content.
_Avoid_: Deleted, Draft

**Correction**:
A replacement of previously published Official information that preserves the earlier value together with who changed it and when. The corrected value becomes the current public version.
_Avoid_: Silent edit, deletion, Result Ruling when the federation changes its decision

**Match**:
A scheduled football contest between two Teams within a Competition Season.
_Avoid_: Pairing, simulated game

**Match Result**:
The current official outcome of a Match recognized by the federation and used for sporting progression. It may confirm the Played Score or supersede it with a Technical Result.
_Avoid_: Played Score when a later federation decision applies, simulated result

**Played Score**:
The goals scored by the Teams on the field before any later federation ruling. It is absent when a Match was not played and remains part of Match history when a Technical Result supersedes it.
_Avoid_: Match Result when a different official outcome applies

**Technical Result**:
A Match Result assigned by the federation for regulatory or disciplinary reasons and entered exactly as ruled by an Admin. It may supersede a Played Score or establish the outcome when the Match was not played; ProLeague does not infer a standard score or represent the preceding review process.
_Avoid_: Played Score, silent score correction

**Result Ruling**:
A final federation decision recorded by an Admin that assigns, revises, or revokes a Technical Result. A later Result Ruling supersedes the prior official outcome without erasing it and may restore the Played Score as the current Match Result.
_Avoid_: Protest, silent result edit

**Scheduled Match**:
A Match whose participants and intended playing time have been published but which does not yet have an official Match Result.
_Avoid_: Upcoming result

**Postponed Match**:
A Match that will not be played at its currently published time and is awaiting or has received a replacement time.
_Avoid_: Cancelled Match

**Cancelled Match**:
A Match that the federation has determined will not be played.
_Avoid_: Postponed Match

**Finished Match**:
A Match whose Match Result has been confirmed by an Admin and is current Official information, whether the Teams played or the federation assigned a Technical Result without play.
_Avoid_: Played Match when the result has not been confirmed

**Standings**:
The ordered positions of Season Entries within a League Stage or one group of a Group Stage, derived from confirmed Finished Matches, the Stage's Ranking Rules, and applicable Standing Adjustments.
_Avoid_: Manually maintained table

**Provisional Standings**:
Standings calculated while a Competition Stage is not Finalized. They may show shared positions and unresolved ties when required Matches, Result Rulings, Playoff Matches, or Ranking Rulings remain outstanding.
_Avoid_: Final Standings, prediction

**Final Standings Snapshot**:
The immutable record produced when an Admin finalizes a League or Group Stage. It captures the final positions and the Match Results, Standing Adjustments, Ranking Rules, and Ranking Rulings that determined them; it is historical evidence rather than an editable Standings table.
_Avoid_: Manually maintained table, current Provisional Standings

**Ranking Rules**:
The versioned sporting rules by which a League or Group Stage derives and orders its Standings. Each Stage owns its Points Scheme, ordered Tie-breakers, and Qualification Rules; a Format Template may provide initial values, but rules are not global platform settings. Before activation, the rules must have a complete Tie-breaker chain ending in a Playoff Match or Ranking Ruling and valid Qualification Slots.
_Avoid_: UI sorting, global league settings

**Points Scheme**:
The points awarded for a win, draw, and loss in one League or Group Stage. New Stages default to three points for a win, one for a draw, and zero for a loss, but the Admin may configure those values before activation; bonus and penalty-shootout points are outside the MVP.
_Avoid_: Standing Adjustment, hard-coded points

**Tie-breaker**:
One criterion in the ordered list used to separate participants with equal points in Standings. Supported criteria include overall goal difference, overall goals scored, overall away goals, wins, head-to-head points, head-to-head goal difference, head-to-head goals scored, head-to-head away goals, Fair-play Score, a Playoff Match, and a Ranking Ruling; alphabetical order is only a display aid.
_Avoid_: UI sort, arbitrary Admin ordering

**Head-to-head Mini-table**:
Standings derived only from Finished Matches between Season Entries that remain tied at the relevant Tie-breaker. When part of a multi-participant tie is resolved, the configured head-to-head criteria restart for the smaller set that remains tied; an incomplete mini-table leaves the affected positions provisional.
_Avoid_: Overall Standings, direct-match display

**Fair-play Score**:
A Tie-breaker derived from configurable penalty weights applied to a Season Entry's Match-level counts of yellow cards, second-yellow dismissals, and direct red cards. It does not require detailed Player event statistics.
_Avoid_: Standing Adjustment, detailed Player statistics

**Disciplinary Summary**:
The Match-level card totals recorded for one Season Entry and used to derive its Fair-play Score. A Correction preserves the previous totals and recalculates affected Standings; after Stage finalization, a correction that changes position or qualification requires reopening the Stage.
_Avoid_: Detailed Player events, Standing Adjustment

**Playoff Match**:
A Match within a League or Group Stage that resolves the order of specified tied Season Entries without contributing points or goals to the main Standings. The Stage cannot be Finalized until the Match has a Finished Match Result.
_Avoid_: Scheduled league Match, Knockout Tie

**Qualification Rule**:
A rule that derives participants advancing from a Finalized League or Group Stage using configured positions, a number of qualifiers per group or table, cross-group ranking, and named Qualification Slots in their destination Stage or round. A bye may be part of the destination structure, but an Admin does not manually select a Team while the rules determine it unambiguously.
_Avoid_: Manually selected advancing Team

**Qualification Slot**:
A named place in a destination Stage or round filled by a specific Qualification Rule, such as the winner of Group A entering the home position of Quarter-final 1. Slots make bracket placement, seeding, and byes part of the approved Competition Format rather than later Admin discretion.
_Avoid_: Unordered qualifier list, manually assigned bracket place

**Qualification Output**:
The set of Season Entries and byes assigned to Qualification Slots from a Finalized Stage. A later sporting decision that reopens the Stage supersedes its prior Final Standings Snapshot and Qualification Output; recalculation does not silently alter an already Active dependent Stage.
_Avoid_: Provisional qualifier list, silently changed bracket

**Qualification Ruling**:
A federation decision recorded after a sporting position has been calculated when a Season Entry is not permitted to advance. It preserves the calculated Standings and explicitly records the ineligible participant, reason, responsible Admin, supporting reference, and whether the outcome is a replacement participant, vacant place, or bye.
_Avoid_: Hidden Standings change, automatic replacement

**Cross-group Comparison Rule**:
The method used to compare participants holding specified positions in different groups. It defines whether to use all Matches, exclude enough lowest-participant Matches to equalize compared Match counts, or compare unrounded ratios of points, goal difference, and goals scored per Match, followed by its own ordered Tie-breakers; every group in one Group Stage shares its base Ranking Rules.
_Avoid_: Combining group Standings into one table

**Ranking Ruling**:
A final federation decision that orders participants whose position cannot be resolved by the preceding Tie-breakers. It is recorded by an Admin with a mandatory reason and history rather than being inferred from alphabetical order.
_Avoid_: Manual Standings edit, UI sort

**Standing Adjustment**:
A federation decision that adds or deducts points from a participant independently of a Match Result. Active adjustments apply cumulatively; a later decision may revoke or replace an earlier one but never edit or delete it. Every decision records a mandatory reason, effective date, responsible Admin, and history and cannot directly edit Match totals, goals, wins, or a participant's position.
_Avoid_: Manual points edit, Match Result correction
