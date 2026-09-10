---
status: accepted
---

# Configure Knockout resolution and record external Draws

Each Knockout Round will own versioned Tie Resolution Rules shared by its Ties. One-match Ties default to an immediate Penalty Shootout after a drawn Regulation Score, with extra time or one Replay Match available only when explicitly configured. Two-leg Ties use the Aggregate Score of their current official Match Results and proceed directly to a Penalty Shootout when level; they use neither extra time nor an away-goals rule.

## Consequences

Regulation Score, Extra-time Score, Played Score, and Penalty Shootout remain distinct. A Penalty Shootout records only successful-kick totals and winner, attaches to the decisive Match, and never contributes to Played Score, Aggregate Score, Standings, or goal statistics. A Technical Result participates in Aggregate Score when it is the current official Match Result. A Tie Ruling may instead determine the Tie winner without inventing a Match score.

Knockout Ties move through Configured, Ready, In Progress, Awaiting Finalization, and Finalized. Source slots may be published before their Season Entries are known, but a dependent Tie becomes Ready only after both source Ties are Finalized. A second Leg may be played while a first-Leg ruling remains unresolved because its participants do not change, although the federation may suspend the Tie. A Suspended Tie blocks further play and finalization until an Admin records its resumption.

Finalization is always an explicit Admin action after Match Results, Result Rulings, and Tie Rulings are settled. Later Tie Rulings supersede earlier decisions and require reopening a Finalized Tie. If a dependent Tie is already In Progress, changing its source additionally requires a Format Amendment and separate federation resolution.

A Bye is direct progression rather than a fictional Match or Technical Result. The Admin records a Confirmed Bye, which fills its destination slot without a Finalized Tie. All Byes must be confirmed before the Knockout Stage can be finalized.

ProLeague records but does not conduct the federation's random Draw. A Draw Outcome may assign known Season Entries or unresolved source slots using open pairing, seeded pots, prohibited pairings, fixed bracket positions, and explicit home or away order. Competition Formats may use a Fixed Bracket or a new external Draw after each Finalized Knockout Round.

Before publication, a bracket or Draw Outcome must have unique valid source use, no duplicate participant within a round, no cyclic dependencies, satisfied Draw Constraints, explicit home or away order, and valid winner, loser, Bye, Final, and Third-place destinations. A new Draw Outcome may supersede an earlier one with a reason before affected play begins; after play begins, a redraw requires a Format Amendment and federation decision.

Final and Third-place Matches reuse one-match Tie Resolution Rules. Their explicit finalization produces Champion and Runner-up or third and fourth Placement Outputs rather than another advancing participant. Finalizing the Knockout Stage requires every Tie to be Finalized, every Bye confirmed, all rulings settled, all required outputs populated, and no Suspended Tie or missing slot. It produces an immutable Final Knockout Snapshot for historical and audit use.
