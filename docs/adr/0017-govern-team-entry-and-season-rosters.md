---
status: accepted
---

# Govern Team entry and Season Rosters explicitly

ProLeague will separate an external Team's Season Application, its approved Season Entry, a persistent Player Identity, and each season-specific Roster Entry. The Admin records and decides applications because Team accounts and online application submission are outside the MVP. This decision supersedes ADR-0009 while retaining its core separation between a Player and seasonal registration.

## Consequences

A Season Application records its submission date, private supporting documents, and a configurable approval checklist. It proceeds through Recorded, Under Review, Approved, Rejected, or Withdrawn. Only an Approved application creates a Season Entry. The Admin makes the final decision; correcting a mistaken decision creates a reasoned, audited superseding decision instead of rewriting history. Even when the Admin initiates the record, the same Season Application lifecycle is used.

A Season Entry proceeds through Registered, Suspended, Withdrawn, or Disqualified. Suspension preserves its roster but blocks those Players from representing the Team in new official Matches until reinstatement. Withdrawal before the first official Match requires a Format Amendment to remove the participant. After play begins, withdrawal or disqualification preserves the Season Entry and Match history while the federation records the sporting consequences through the applicable rulings.

Team Entry, Roster Registration, and Roster Transfer Windows are independently configured and may be reopened only with a recorded reason. A Roster Entry proceeds through Pending, Active, Rejected, or Ended and is approved independently. The Season Roster is the set of Active Roster Entries; configurable minimum and maximum sizes govern readiness and approval. Exceeding the maximum blocks activation, while failing the minimum blocks the Season Entry from becoming ready for competition.

A Player Identity persists across Teams, Seasons, and Competitions. Full name and date of birth are required; federation identifier and photo are optional. The exact birth date is restricted to Admin use by default, while the public profile exposes only birth year or calculated age. Existing Players must be searched before creation. Suspected duplicates are never merged automatically; an audited Admin merge redirects all references to the retained identity and preserves the retired record in history.

Shirt number is not stored on Player Identity or Roster Entry because it may change for each Match. It will belong to a future Match Sheet if match protocols enter scope. Playing position may remain season-specific. Application and eligibility documents are private objects available only to the Admin; the public portal may expose their verification outcome but not the files.

A Player may have only one Active Roster Entry within the same Season, while participation in a different Competition Season may coexist. During a Roster Transfer Window, a Roster Transfer ends the former registration and begins the destination registration on effective dates that cannot overlap. Earlier Match participation remains attributed to the former Team. This is a sporting registration workflow only; contracts, fees, market values, budgets, and a transfer market remain outside the MVP.

The Admin manually classifies each Roster Entry as Local or Legionnaire according to the applicable district rules; the platform never infers this from address or nationality. A versioned Legionnaire Quota limits Active Legionnaire Roster Entries per Team and may add a birth-date-based allowance. For example, a `1991-12-31` cutoff includes everyone born in 1991 or earlier when the rule covers Players who turn 35 during 2026. Both limits and cutoff dates are configurable per Competition Season. Changing the rule triggers revalidation without automatically cancelling existing registrations.

Ordinary data mistakes use an audited Correction. Activating a registration outside a permitted window, above a roster or Legionnaire limit, or under another exceptional eligibility condition requires a reasoned Roster Eligibility Ruling with the responsible Admin, effective period, and supporting reference. Rules are never silently bypassed.
