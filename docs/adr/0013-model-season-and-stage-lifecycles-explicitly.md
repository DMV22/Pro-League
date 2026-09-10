---
status: accepted
---

# Model Season and Competition Stage lifecycles explicitly

ProLeague will represent the sporting lifecycle of a Season independently from its public visibility, Registration Window, Current Season designation, and archival status. Season sporting states are Preparing, Active, Completed, Cancelled, and Abandoned. All transitions are explicit Admin decisions; dates and completed Matches provide reminders or readiness signals but never change a state automatically.

## Consequences

A Preparing Season may become Active only when its Competition Format is valid for its approved Season Entries, its first Competition Stage is ready, and no critical configuration errors remain. The entire future Match calendar does not need to exist before activation. Multiple Seasons of one Competition may be Active concurrently, but the Admin must explicitly designate at most one Current Season for that Competition.

The Admin explicitly completes a Season only after every Competition Stage is finalized and applicable federation rulings are settled. Cancelling a Season before its first official Match and abandoning it after play begins are distinct terminal outcomes whose reasons and history are preserved. Completed, Cancelled, and Abandoned Seasons may be archived without losing public historical addresses. Visibility never changes automatically: a previously Public Season remains public with its status and reason, while a Private Season remains private.

The Registration Window is independent of the sporting lifecycle. The Admin may close or reopen it without changing the Season state, but reopening requires a recorded reason and Audit History.

A Competition Stage proceeds through Configuring, Ready, Active, Awaiting Finalization, and Finalized by explicit Admin actions. A Finalized Stage may supply participants to a dependent Stage. A later exceptional federation decision may reopen a Finalized Stage with a mandatory reason and Audit History; if its dependent Stage is already Active, a Format Amendment and separate federation resolution are required.

A Format Amendment remains private while it is prepared and validated. Applying it is an explicit Admin action that publishes the new Competition Format as one coherent version, preserves the prior version, and records the affected Stage transitions. An unstarted Stage may be Removed, while a Stage whose official Matches have begun may be Abandoned; both remain represented in the Season's history.

A Completed Season may return to Active only when a later federation decision changes sporting information. An archived Season is first returned from the archive, then its affected Stage and the Season are explicitly reopened with reasons and Audit History. Editorial corrections that do not change sporting information do not reopen either lifecycle.
