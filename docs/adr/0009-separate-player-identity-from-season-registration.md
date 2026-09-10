---
status: superseded by ADR-0017
---

# Separate player identity from season registration

ProLeague will represent a Player independently from each Roster Entry, while a Season Roster belongs to a Team's Season Entry. This preserves one player identity across seasons and competitions while allowing position and shirt number to vary by registration; contracts, market values, budgets, transfers, and detailed player statistics remain outside the launch scope.

This decision was superseded when the MVP added regulation-level roster transfers and clarified that shirt numbers vary by Match rather than by Roster Entry. ADR-0017 retains the separation between Player Identity and seasonal registration while defining the complete Team entry and Season Roster lifecycle.
