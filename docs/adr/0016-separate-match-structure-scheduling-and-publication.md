---
status: accepted
---

# Separate Match structure, scheduling, and publication

ProLeague will model an official Match's structural place, sporting state, public visibility, and schedule as related but distinct concerns. Matches may be generated from an approved Competition Format or entered manually by an Admin, but every official Match must occupy a valid Fixture Slot in a Fixture Round, Knockout Tie, Replay, or Playoff. Adding a Match outside an Active format requires a Format Amendment.

## Consequences

A Fixture Round is structural rather than a calendar day: its Matches may be played on different days and at different times. Single and double round-robin generation will balance Home and Away roles, create a Rest Slot when participant count is odd, and optionally propose dates without publishing them. The Ukrainian UI may label a Rest Slot as `Вихідна`, but it remains distinct from a knockout Bye.

Match Sporting State is explicitly controlled as Unscheduled, Scheduled, Postponed, In Progress, Suspended, Finished, or Cancelled. Time passing and score entry do not transition it automatically. An unplayed Match with a Technical Result becomes Finished without a Played Score and retains preceding schedule-state history.

Visibility is independently Private or Public. Admins may publish one Match, a Fixture Round, a Knockout Round, or a ready portion of a Stage. Public Matches may retain date TBD, time TBD, Venue TBD, or unresolved structural participant information. The entire future calendar is not required before Season activation.

Scheduled Kickoff uses the Season's IANA timezone unless the Match explicitly overrides it. Actual Kickoff is optional when a ceremony, delay, or another relevant circumstance makes the real start useful; Actual End is not required in the MVP.

A reusable Venue contains one or more Playing Fields. Different fields may host Matches concurrently. The same field may host several Matches on one day when their planned Field Occupancy Windows, derived from Scheduled Kickoff, expected duration, and turnaround, do not overlap. Participant and progression-dependency conflicts block publication; minimum-rest and field-turnaround warnings may be overridden with a reason.

Home and Away roles always remain explicit. Moving a Home Match to another Venue or Playing Field because its usual field is unavailable does not make it neutral. Neutral designation applies only when the federation explicitly declares it.

Before first publication, the Admin may edit or regenerate a private schedule. After publication, kickoff, Venue, Playing Field, or Home/Away changes create a Schedule Revision with a mandatory internal reason, optional public explanation, responsible Admin, and preserved previous schedule. Changing participants, Fixture Round membership, Match count, or structural slots after Stage activation requires a Format Amendment.

A Suspended Match preserves already played information while awaiting a federation decision. It may resume as the same Match with a new Scheduled Kickoff, become Finished through confirmation or Technical Result, or produce a separately linked Replacement Match when ordered to restart. A published Match is never deleted; only an unpublished, unstarted, dependency-free Private Match may be removed.

Venues are reusable, but Schedule Revisions preserve the Venue and Playing Field information published for a Match. Typographical corrections may update a Venue; a materially different or relocated venue is a new Venue so historical calendars are not silently rewritten.

The MVP will provide downloadable read-only iCalendar exports for Public Competition or Season schedules. Only Matches with confirmed Scheduled Kickoff appear. Schedule changes retain stable calendar-event identity, while Cancelled Matches are marked cancelled rather than disappearing, enabling Admins and Visitors to distribute and retain schedules offline.
