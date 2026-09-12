# ProLeague

ProLeague is the official information portal for football Competitions administered or covered by a local federation. It exists to provide supporters, participants, and federation staff with a shared source of published Competition information.

## Language

**Portal**:
The public information product through which the federation publishes official championship content.
_Avoid_: Simulator, football manager, manager game

**Official information**:
Competition content that the federation has approved for public publication through the Portal.
_Avoid_: Simulated data, generated result

**Supporting Reference**:
Evidence cited by a federation decision or administrative record, represented as a validated external URL, a Private Document, an external identifier, or a concise textual reference. It supports the decision without replacing the decision record or duplicating protected document contents.
_Avoid_: Audit Event, arbitrary attachment, copied private document

**Private Document**:
A versioned non-public file retained as evidence for a Season Application, ruling, Player Publication Consent, Privacy Request, or another authorized federation process. It is available only through audited Admin access and is governed by retention and Legal Hold rules rather than the public Media Asset lifecycle.
_Avoid_: Media Asset, public attachment, Article Media Placement

**Competition**:
A football contest administered or covered by the federation, such as a championship or cup. ProLeague may contain multiple Competitions.
_Avoid_: League when referring to every competition type, tournament as a catch-all term

**Season**:
A time-bounded edition of a Competition. A Competition may have multiple Seasons whose information remains separately accessible.
_Avoid_: Competition, current league

**Season Sporting State**:
The sporting phase of a Season: Preparing, Active, Completed, Cancelled, or Abandoned. It is independent of the Season's public visibility, registration windows, Current Season designation, and archival status.
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

**Team Entry Window**:
The independently controlled period during which Team applications for a Season may be recorded and decided. The Admin may close or reopen it without changing the Season Sporting State; reopening requires a recorded reason.
_Avoid_: Roster Registration Window, Season Sporting State

**Roster Registration Window**:
The independently controlled period during which Players may be registered in a Season Roster. Its dates and exceptional reopening are governed by the Competition Season's regulations and do not change the Season Sporting State.
_Avoid_: Team Entry Window, Roster Transfer Window

**Roster Transfer Window**:
A regulation-defined period, commonly between competition rounds but configurable for another interval, during which a Player may end one active Roster Entry and begin another for a different Team in the same Season. It records a sporting registration change only, without contracts, fees, budgets, or market values.
_Avoid_: Transfer market, Roster Registration Window

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
A pairing between two Season Entries in a Knockout Format, resolved by either one Match or the aggregate outcome of two Legs under the round's Tie Resolution Rules.
_Avoid_: Match when referring to the complete two-leg pairing

**Knockout Round**:
A set of Knockout Ties that share the same Tie Resolution Rules, Draw Constraints, and progression destinations. A rule exception for one Tie requires a Format Amendment.
_Avoid_: Competition Stage, Matchday

**Fixed Bracket**:
A Knockout progression structure whose future source slots and pairings are approved before their specific Season Entries are known.
_Avoid_: Draw Outcome, Redraw Each Round

**Redraw Each Round**:
A Knockout progression structure in which a new external federation Draw determines pairings after the preceding Knockout Round is Finalized.
_Avoid_: Fixed Bracket, automatic random pairing

**Tie Resolution Rules**:
The versioned rules by which every Knockout Tie in one Knockout Round determines its winner. A one-match Tie defaults to a Penalty Shootout immediately after a drawn Regulation Score, while extra time or a Replay Match may be selected explicitly; a two-leg Tie uses Aggregate Score and proceeds directly to a Penalty Shootout when level, without extra time or an away-goals rule.
_Avoid_: Ranking Rules, globally fixed cup rules

**Configured Tie**:
A Knockout Tie whose source slots and Tie Resolution Rules are defined even if its specific Season Entries are not yet known.
_Avoid_: Ready Tie

**Ready Tie**:
A Configured Tie whose two participating Season Entries are known and whose required Matches may be scheduled or played.
_Avoid_: Configured Tie, Finalized Tie

**In-progress Tie**:
A Knockout Tie in which at least one required Match has begun but the sporting outcome is not yet ready for final review.
_Avoid_: Finished Match, Finalized Tie

**Tie Awaiting Finalization**:
A Knockout Tie with a determined provisional winner but with explicit Admin finalization or an applicable Result Ruling still outstanding.
_Avoid_: Finalized Tie

**Suspended Tie**:
A Ready or In-progress Tie that the federation has temporarily prevented from continuing. Suspension blocks another Match and Tie finalization while preserving played results; both suspension and resumption require a reason and Audit History.
_Avoid_: Cancelled Match, Abandoned Stage

**Finalized Tie**:
A Knockout Tie whose winner and progression output an Admin has explicitly confirmed after all applicable Match Results, Result Rulings, and Tie Rulings are settled. Time passing does not finalize a Tie; only a Finalized Tie may supply a participant to a dependent Knockout Match.
_Avoid_: Finished Match, provisional winner

**Tie Ruling**:
A final federation decision that determines or changes the winner of a Knockout Tie without assigning a score to a specific Match. A later ruling supersedes rather than edits an earlier ruling and records the reason, responsible Admin, decision date, supporting reference, and decision history; changing a Finalized Tie requires reopening it.
_Avoid_: Technical Result, fabricated Match score

**Leg**:
One Match within a two-match Knockout Tie.
_Avoid_: Round, Knockout Tie

**Aggregate Score**:
The combined current official Match Results of both Legs in a two-leg Tie. It uses a Technical Result when that result supersedes a Played Score and excludes every Penalty Shootout; a Tie Ruling may supersede the winner calculated from the aggregate.
_Avoid_: Sum of Played Scores when a Result Ruling applies, Penalty Shootout total

**Regulation Score**:
The goals scored during a Match's regulation playing time.
_Avoid_: Played Score when extra time occurred, Penalty Shootout

**Extra-time Score**:
The goals scored during an explicitly configured period of extra time in a one-match Knockout Tie or its Replay Match.
_Avoid_: Regulation Score, Penalty Shootout

**Penalty Shootout**:
A separate outcome attached to the decisive Match: the sole Match of a one-match Tie, the second Leg, or a Replay Match. It records each Season Entry's successful-kick total and winner, but its kicks do not contribute to the Played Score, Aggregate Score, Standings, or goal statistics and are absent when a Technical Result or Tie Ruling already determines the winner.
_Avoid_: Played Score, extra-time goals

**Replay Match**:
The single additional Match permitted by explicitly configured one-match Tie Resolution Rules after the original Match remains level. Its home order follows those rules; if it also remains level, the default resolution is an immediate Penalty Shootout unless extra time was explicitly enabled.
_Avoid_: Second Leg, rescheduled Match

**Bye**:
An approved direct progression from one Qualification Slot to a destination slot without a Match, Technical Result, or fictional score. It is explicitly confirmed in the Competition Format or Draw Outcome.
_Avoid_: Cancelled Match, Technical Result

**Confirmed Bye**:
A Bye explicitly approved by an Admin as a progression output. It fills its destination slot without creating or finalizing a Knockout Tie; every Bye in a Knockout Stage must be confirmed before Stage finalization.
_Avoid_: Finalized Tie, automatic Match winner

**Draw Outcome**:
The recorded result of an external federation draw that assigns Season Entries or unresolved source slots to Knockout Ties, bracket positions, and home or away order. It preserves the draw date, applicable Draw Constraints, responsible Admin, and any supporting reference; ProLeague validates but does not randomly generate it.
_Avoid_: Platform-generated random draw, Match schedule

**Draw Constraints**:
The published conditions against which a Draw Outcome is validated, including seeded and unseeded pots, open draws, prohibited pairings, fixed bracket slots, and home or away assignment rules.
_Avoid_: Draw Outcome, informal pairing preference

**Draw Pool**:
A configured set of Season Entries or unresolved Qualification Outputs eligible for assignment in one external federation Draw. It may represent an open blind draw or one seeded or unseeded pot; ProLeague validates and records the Draw Outcome but never selects the pairings itself.
_Avoid_: Draw Outcome, automatically generated pairing, Qualification Slot

**Third-place Match**:
A one-match Knockout Tie between the losing semi-finalists that determines third and fourth place under its own Tie Resolution Rules and produces no advancing participant.
_Avoid_: Final

**Placement Output**:
The final placements created only when the relevant Tie is Finalized. A Final produces Champion and Runner-up, while a Third-place Match produces third and fourth places; neither supplies an advancing participant to another Knockout Round.
_Avoid_: Provisional Match winner, Qualification Output

**Final Knockout Snapshot**:
The immutable record produced when an Admin finalizes a Knockout Stage. It captures the bracket, Draw Outcomes, Finalized Ties, Confirmed Byes, applicable rulings, progression outputs, and Placement Outputs that determined the completed structure.
_Avoid_: Editable bracket, provisional Draw Outcome

**Hybrid Format**:
A Competition Format that combines multiple ordered Competition Stages, such as a Group Stage followed by a Knockout Stage.
_Avoid_: Group Stage, Knockout Format

**Team**:
A football side that can participate in one or more Competition Seasons, including different Competitions during the same period.
_Avoid_: Season Entry, Club unless a separate club concept is explicitly introduced

**Season Application**:
An external Team request to participate in one Competition Season that the Admin records with its submission date, private supporting documents, and configurable approval checklist. It proceeds through Recorded, Under Review, Approved, Rejected, or Withdrawn; only approval creates a Season Entry. A mistaken decision is replaced by a reasoned, audited decision rather than rewritten, and Admin-initiated entries use the same lifecycle.
_Avoid_: Season Entry, Team account

**Season Entry**:
A Team's registered participation in one specific Competition Season, created from an Approved Season Application. Its participation state is Registered, Suspended, Withdrawn, or Disqualified, while season-specific sporting data belongs to it rather than duplicating the Team. Suspension preserves its roster but blocks new official Match participation until reinstatement.
_Avoid_: Team, permanent membership

**Season Entry Withdrawal**:
The preserved end of a Team's voluntary participation. Before its first official Match, removal from the format requires a Format Amendment; after play begins, existing results remain and the federation records the applicable sporting consequences rather than deleting the Season Entry.
_Avoid_: Season Application withdrawal, deleted Team

**Player**:
A person who may be registered to represent Teams across different Competition Seasons. The launch profile contains only the identity and public sporting details needed for Season Rosters.
_Avoid_: Roster Entry, transfer asset

**Player Identity**:
The persistent federation record used to recognize the same Player across Seasons, Competitions, and Teams. Full name and date of birth are required; federation identifier and photo are optional. Exact birth date is restricted to the Admin by default, while public presentation uses birth year or calculated age. The Admin searches before creating a record; suspected duplicates are warned about and may only be merged manually with preserved references and Audit History.
_Avoid_: Roster Entry, automatically merged person

**Season Roster**:
The complete set of Players registered for one Season Entry, derived from that entry's Active Roster Entries. Configurable minimum and maximum sizes govern readiness and further registration, with exceptions requiring a Roster Eligibility Ruling.
_Avoid_: Permanent squad, transfer list

**Roster Entry**:
A Player's season-specific registration in one Season Roster, including the playing position applicable to that registration. It proceeds through Pending, Active, Rejected, or Ended and is approved independently from other registrations. Shirt numbers are not properties of the Player or Roster Entry because they may vary by Match.
_Avoid_: Player, contract, permanent shirt number

**Roster Transfer**:
The effective-dated change that ends a Player's active Roster Entry for one Team and creates one for another Team in the same Season during a Roster Transfer Window. The registrations may not overlap, and the Player's earlier Match participation remains attributed to the former Team.
_Avoid_: Player sale, contract, transfer fee

**Legionnaire Classification**:
A manual, Season-specific classification of a Roster Entry as Local or Legionnaire under the applicable district rules. The Admin records the classification and, where needed, its basis; the system does not infer it from an address, nationality, or other Player data.
_Avoid_: Nationality, permanent Player category

**Legionnaire Quota**:
A Competition Season rule limiting Active Legionnaire Roster Entries for each Team. It defines a base limit and may define an additional allowance using the Player's date of birth, such as allowing Players born on or before `1991-12-31` when the regulation covers everyone who turns 35 during 2026; neither the limit nor the birth-date cutoff is hard-coded.
_Avoid_: Match-only quota, hard-coded age or birth year

**Roster Eligibility Ruling**:
An audited federation exception that permits a Roster Entry which would otherwise be blocked by a closed registration window, roster-size rule, Legionnaire Quota, or another eligibility condition. It records the Admin, reason, effective period, and supporting reference without silently changing the configured rule. Typographical or identity-data mistakes use a Correction instead.
_Avoid_: Qualification Ruling, unchecked Admin override

**Admin**:
A federation representative whose Admin Identity has a current Active Admin Access Grant. ProLeague may have multiple Admins, but at launch they all share one authorized role rather than separate editorial, publishing, or security roles; impersonation is not permitted.
_Avoid_: Editor, Publisher

**Admin Identity**:
The persistent record of a federation representative and their authorship across administrative access periods. It is mapped to the external authenticated identity after invitation acceptance and remains preserved when an Access Grant ends or an external account is deleted.
_Avoid_: Admin Access Grant, current email address

**Admin Invitation**:
A seven-day invitation for a named email address to obtain administrative access. It proceeds through Pending, Accepted, Expired, or Revoked. A duplicate Pending invitation is not created implicitly; it may be resent, or revoked and replaced, while every prior invitation remains preserved.
_Avoid_: Public sign-up, active Admin access

**Admin Access Grant**:
A distinct period in which an Admin Identity is permitted to administer ProLeague. A former Admin who is appointed again receives a new Access Grant rather than reopening a Revoked one.
_Avoid_: Admin Identity, authentication session

**Admin Access State**:
The Portal's authoritative decision about an Admin Access Grant: Invited, Active, Suspended, or Revoked. Suspension is temporary and reversible without a new invitation, while Revocation permanently ends that grant; neither removes the Admin's authorship or Audit History.
_Avoid_: Authentication session, invitation status

**Authorization Decision**:
The server-side decision that permits a protected operation only when the request has a valid completed identity session mapped to an Active Admin. Client-side visibility never grants authority, and an unavailable or unmatched access record denies the operation.
_Avoid_: Signed-in UI state, identity verification alone

**Admin Session**:
An authenticated administrative session with a configurable maximum lifetime of 12 hours and an inactivity limit of 30 minutes. A new session is required after restoration from suspension, revocation of prior sessions, or expiry.
_Avoid_: Admin Access Grant, indefinite login

**Sensitive Admin Operation**:
An access-management, MFA-recovery, Break-glass, private-document bulk-export, or security-configuration action that requires recent identity reverification in addition to an Active Admin Session.
_Avoid_: Ordinary Official-information editing

**MFA Recovery**:
A controlled recovery after an Admin loses every second factor and backup code. Another Active Admin verifies the person outside the Portal, records a reason, resets MFA, and revokes existing sessions; when no other Admin exists, the Break-glass Procedure is required.
_Avoid_: Self-service reset, password recovery

**Audit Event**:
An immutable record of an administrative, security, or automated action. It identifies the stable actor identity or System, actor-name and email snapshot, action, affected object, UTC server time, structured change or immutable revision reference, reason where required, supporting reference, request correlation, source, and outcome while excluding credentials, tokens, secrets, and private document contents. The related domain change cannot succeed unless its Audit Event is recorded atomically.
_Avoid_: Editable activity note, application log

**Security Event**:
An Audit Event about an Admin session, authorization denial, MFA recovery, access-state change, external identity deletion, or Break-glass Procedure. It may include network and client context subject to the Portal's privacy and retention rules.
_Avoid_: Every public request, raw authentication-provider log

**External Sync Pending**:
The state of an external security or storage action that was requested but has not yet succeeded. Local denial of access remains effective while retries and outcomes are audited; an external failure never restores permission.
_Avoid_: Successful synchronization, rolled-back local access restriction

**Reconciliation Required**:
An externally initiated administrative or security change whose Audit Event lacks a federation reason or other required context. The change remains visible and cannot be removed while an Active Admin supplies the missing explanation.
_Avoid_: Failed webhook, ignored external change

**Audit History**:
The ordered collection of Audit Events that explains how Official information, access, and exceptional decisions reached their current state.
_Avoid_: Current entity state, raw infrastructure log

**Break-glass Procedure**:
A documented exceptional process for restoring administrative control when normal Admin operations cannot do so, including when the last Active Admin is unavailable. Initial bootstrap uses a one-time operator action that works only while no Active Admin exists; later Break-glass use requires explicit evidence and reconciliation into Audit History rather than direct silent data editing.
_Avoid_: Routine Admin management, silent database edit

**Technical Operator**:
The person responsible for deployment, monitoring, incident response, backup, and restoration without becoming a separate business role in the Admin interface. The Technical Operator restores service, while an Admin validates recovered Official information.
_Avoid_: Admin role, federation decision-maker

**Production Cost Envelope**:
The cost-first operating constraint that targets USD 10–20 in recurring monthly infrastructure cost for the expected small audience while preserving the agreed availability, recovery, backup, privacy, and security guarantees. Exceeding USD 25 requires an explicit decision; domain and transactional email costs are tracked separately. Capacity grows from observed demand rather than speculative traffic forecasts.
_Avoid_: Guaranteed provider price, free at any reliability cost, premature scaling budget

**Backup Retention Policy**:
The recovery schedule comprising seven days of point-in-time database recovery, 14 days of daily backups, and six months of monthly backups. An isolated restore test is performed quarterly and before a high-risk data migration.
_Avoid_: Data Retention Policy, unverified backup existence

**Data Retention Policy**:
The federation-approved schedule that keeps Published competition history and Audit History as its permanent archive; reviews private Player registration data after participation plus five years; keeps supporting application documents for three years after the Season; keeps Privacy Requests for five years; and removes abandoned Drafts and orphaned Media Assets after 30 days unless a Legal Hold applies.
_Avoid_: Backup Retention Policy, indefinite private-data storage

**Service Level Objective**:
The production reliability target against which the Portal is operated. The public Portal targets 99.5% monthly availability excluding announced maintenance, while already Published information is prioritized over Admin mutations during partial failure.
_Avoid_: Absolute uptime guarantee

**Recovery Point Objective**:
The maximum acceptable interval of recent production changes that could be lost after disaster recovery, set to 15 minutes for ProLeague.
_Avoid_: Backup frequency alone

**Recovery Time Objective**:
The target maximum time to restore the production Portal after a critical failure, set to four hours for ProLeague.
_Avoid_: Incident acknowledgement time

**Graceful Degradation**:
A partial-failure state in which cached Published information remains readable while unsafe mutations, publication, or unaudited changes are blocked until authoritative services recover.
_Avoid_: Stale data presented as current without indication

**Player Public Profile**:
The minimal public sporting representation of a Player: full name, permitted photo, birth year or calculated age, playing position, current Season Roster registration, prior Season participation, and published Local or Legionnaire classification. Exact birth date, federation identifier, contacts, address, and supporting documents remain private.
_Avoid_: Player Identity record, complete registration file

**Minor Player**:
A Player under 18 whose public photo and full profile require a recorded lawful basis or representative consent. The record identifies the representative, date, publication scope, and revocation history. Without it, the Portal exposes only the minimum sporting identification required for Official information.
_Avoid_: Adult Player privacy defaults

**Player Publication Consent**:
The private record supporting publication of a Minor Player's photo or full Player Public Profile. It identifies the lawful basis or representative, grant date, permitted scope, expiry when applicable, and revocation history.
_Avoid_: Season Roster approval, public profile field

**Privacy Request**:
A private, audited external request concerning personal data. It is acknowledged within five business days and targeted for resolution within 30 calendar days through Received, In Review, Fulfilled, Partially Fulfilled, or Rejected. Its reasoned resolution may correct data, restrict a public profile, replace or remove a photo, delete unnecessary private data, or preserve required Official sporting history.
_Avoid_: Public correction request, silent profile deletion

**Legal Hold**:
An Admin decision that suspends scheduled deletion of records or Media Assets required by a protest, investigation, or legal obligation. It records a reason and produces an Audit Event.
_Avoid_: Permanent retention by default, unaudited deletion override

**Incident Record**:
A private operational record of a production incident, including severity, timeline, impact, affected data or capabilities, response, recovery, and follow-up actions. SEV-1 and SEV-2 incidents require a postmortem.
_Avoid_: Public News Article, routine application log

**Visitor**:
A person who reads Published News Articles and other public Official information without registering or signing in. Visitor accounts are outside the launch scope.
_Avoid_: User when no authenticated public identity exists

**News Article**:
A Ukrainian-language publication through which the federation communicates news, announcements, and decisions about its Competitions and related activity. It has a category, title, stable slug, summary, body, cover image, responsible Admin, immutable first-publication time, and optional SEO metadata. It may be explicitly associated with multiple Competitions, Seasons, Teams, Matches, and Players; a textual mention alone does not create an association, and an association with a Private entity is publicly linked only after that entity becomes Public.
_Avoid_: Post, blog post, announcement as a catch-all term

**Article Category**:
A required Admin-managed classification used to organize News Articles without introducing separate editorial lifecycles. News, Announcement, and Federation Decision are the initial categories; a used category may be renamed or archived but not deleted.
_Avoid_: Separate publication type, free-text tag

**Article Content Document**:
The structured body of a News Article composed only of supported semantic content such as paragraphs, second- and third-level headings, emphasis, lists, links, quotations, tables, Article Media Placements, and Embedded Videos. The same document determines both Admin preview and public presentation.
_Avoid_: Arbitrary HTML, presentation-specific markup, plain-text body

**Draft**:
A News Article that an Admin has saved but not made publicly accessible. An authenticated Admin may preview its current presentation; public preview links are outside the MVP. Physical deletion is limited to a Draft that has never been Published.
_Avoid_: Unpublished Official information

**Scheduled Article**:
A News Article configured to become Published automatically at a future time in the Portal's `Europe/Kyiv` timezone. The Admin may continue editing the latest saved version, reschedule it, or return it to Draft before publication. Readiness is checked both when scheduling and when publication is attempted; a failed attempt never exposes partial or invalid content.
_Avoid_: Published, manually queued article

**Published**:
A News Article that an Admin has made publicly accessible as Official information, either manually or through its publication schedule. It cannot return to Draft; hiding it from current content requires archival.
_Avoid_: Approved, live

**Archived**:
A previously Published News Article removed from current feeds while remaining available through its stable URL and archive search. It may be restored to Published without changing its first-publication time or being treated as a new publication.
_Avoid_: Deleted, Draft

**Article Revision**:
A preserved version of a News Article's editorial content and associations after first publication. The current Published Revision remains public while its replacement is prepared as a Working Revision; applying the replacement is an explicit Admin action with an internal reason. Ordinary typographical edits are retained internally, while a material factual change is marked as an Article Correction.
_Avoid_: Silent overwrite, Draft autosave

**Working Revision**:
An unpublished replacement being prepared for a currently Published News Article. It may be previewed and recovered without changing the public version, and becomes current only through explicit publication; scheduling a future replacement is outside the MVP.
_Avoid_: Draft Article, current Published Revision

**Article Correction**:
A material Article Revision that includes a public explanation and marks the News Article as updated without replacing its original publication date.
_Avoid_: Typographical edit, unpublished Draft revision

**Draft Recovery Snapshot**:
A recent server-side recovery point for a Draft or Working Revision. It protects unfinished work without becoming an Article Revision or an audit event for every individual edit; a browser copy, if present, is temporary and never authoritative.
_Avoid_: Published Revision, browser-persisted Official information

**Media Asset**:
An immutable uploaded image that may be reused by multiple News Articles. It records its original filename, media type, byte size, dimensions, source, creator, usage-rights information, responsible Admin, and upload time. Replacing its binary content creates a new Media Asset so published revisions do not change silently.
_Avoid_: Article-specific caption, mutable file, video upload

**Article Media Placement**:
A cover or inline use of a Media Asset in one News Article. It may override the asset's default alternative text and caption for that context; a meaningful placement requires alternative text, while an empty value is valid only when explicitly marked decorative.
_Avoid_: Media Asset, unattributed file

**Media Withdrawal**:
An audited removal of a previously published Media Asset from public display, such as for a usage-rights violation. Public placements receive a neutral replacement while the asset metadata, reason, responsible Admin, and historical references remain preserved.
_Avoid_: Physical deletion, ordinary removal from an Article

**Embedded Video**:
A validated YouTube reference placed in a News Article without uploading or accepting arbitrary iframe markup.
_Avoid_: Uploaded video, arbitrary HTML embed

**Article Publication Readiness**:
The requirement that a News Article have a title, unique slug, summary, non-empty body, active Article Category, cover placement, and valid accessibility classification for every image before it may become Scheduled or Published. Domain associations are optional for general federation news.
_Avoid_: Editorial approval role, association requirement

**Featured Article**:
A Published News Article explicitly promoted in a prominent public feed, optionally until a configured time. Multiple Articles may be Featured concurrently; a public surface selects the newest applicable items by feature time, while ordinary feed order continues to use publication time rather than arbitrary manual ordering.
_Avoid_: Pinned sort order for every article

**Correction**:
A replacement of previously published Official information that preserves the earlier value together with who changed it and when. The corrected value becomes the current public version.
_Avoid_: Silent edit, deletion, Result Ruling when the federation changes its decision

**Match**:
A football contest between two Season Entries within a Competition Stage. It may be generated from the Competition Format or entered manually by an Admin, but it must remain valid for that Stage's approved structure.
_Avoid_: Pairing, simulated game

**Fixture Slot**:
A place for one official Match in a Competition Stage's approved structure, such as a pairing in a Fixture Round, Knockout Tie, Replay, or Playoff. A manually entered Match must fill a valid Fixture Slot; adding another official Match to an Active format requires a Format Amendment.
_Avoid_: Friendly Match, arbitrary calendar entry

**Fixture Round**:
A structural group of Matches in a League or Group Stage. Its Matches may have different dates and kickoff times and may be spread across multiple calendar days.
_Avoid_: Calendar day, Knockout Round

**Rest Slot**:
A scheduling position for a Season Entry that has no Match in one Fixture Round because the Stage has an odd number of participants. It is never a Knockout Bye or progression outcome and may be presented with a localized UI label such as `Вихідна`.
_Avoid_: Bye, Cancelled Match

**Unscheduled Match**:
A Match whose participants or structural slots exist but whose kickoff has not been confirmed. It may remain private or be published with its date, time, or both marked as TBD.
_Avoid_: Postponed Match

**Private Match**:
A Match visible only to the Admin while its sporting and scheduling information is prepared. Visibility is independent of Match Sporting State.
_Avoid_: Unscheduled Match

**Public Match**:
A Match whose current published schedule and sporting information are accessible to Visitors. Visibility is independent of Match Sporting State.
_Avoid_: Scheduled Match

**Match Sporting State**:
The explicitly controlled sporting state of a Match: Unscheduled, Scheduled, Postponed, In Progress, Suspended, Finished, or Cancelled. Calendar time and score entry do not change it automatically.
_Avoid_: Match visibility, calendar status

**Scheduled Kickoff**:
The announced start of a Match, expressed as a local date and time in the Season's timezone or an explicitly overridden Match timezone. Its date, time, or both may remain TBD until confirmed.
_Avoid_: Fixture Round date, publication time

**Actual Kickoff**:
An optional record of when a Match actually began when a ceremony, delay, or other circumstance makes that fact relevant. It does not replace the Scheduled Kickoff, and the MVP does not require an actual end time.
_Avoid_: Schedule Revision, required Match duration

**Venue**:
A reusable place where Matches may be played, identified by name, locality, address, and optional coordinates. A Match may temporarily use Venue TBD.
_Avoid_: Home Team, Match address text

**Playing Field**:
A specific field within a Venue. A Venue may contain one default field or several fields that can host Matches independently and, when distinct, concurrently.
_Avoid_: Venue, Home field designation

**Field Occupancy Window**:
The planned period for which a Playing Field is reserved for a Match, beginning at Scheduled Kickoff and including the expected Match duration and configured turnaround. Multiple Matches may use the same field on one day when their occupancy windows do not overlap.
_Avoid_: Actual Match duration, whole-day Venue booking

**Venue Designation**:
The Match's classification as home, away, or neutral independently of its Home and Away participant roles. A Home Match remains home when moved to another Venue or Playing Field; it is neutral only when the federation explicitly designates it so.
_Avoid_: Inferring neutrality from Team ownership

**Schedule Revision**:
A preserved version of a Match's published kickoff, Venue, Playing Field, participant, or Home and Away assignment. After first publication, every change records the responsible Admin, mandatory internal reason, optional public explanation, and prior public schedule; postponement, cancellation, and suspension always require a reason.
_Avoid_: Silent schedule edit, Match Result correction

**Calendar Export**:
A downloadable offline calendar of Public Matches for a Competition or Season. It includes only Matches with a confirmed Scheduled Kickoff, retains stable event identity across Schedule Revisions, and marks a Cancelled Match as cancelled rather than removing it.
_Avoid_: Editable source calendar, private schedule export

**Scheduling Constraint**:
A validation rule applied when generating or publishing a schedule, including participant overlap, source finalization, format consistency, minimum rest, and Playing Field occupancy. Participant and dependency violations block publication; rest and field-turnaround warnings may be overridden by an Admin with a reason.
_Avoid_: Competition Format rule, hidden scheduling preference

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
A Match whose intended kickoff has been confirmed and which does not yet have an official Match Result. It may remain Private or be Public.
_Avoid_: Upcoming result

**Postponed Match**:
A Match that will not be played at its most recently confirmed kickoff and awaits a replacement schedule. Confirming the replacement returns it to Scheduled while preserving the previous Schedule Revision.
_Avoid_: Cancelled Match

**Cancelled Match**:
A Match that the federation has determined will not be played.
_Avoid_: Postponed Match

**In-progress Match**:
A Match that has begun but does not yet have a confirmed official Match Result.
_Avoid_: Finished Match, Scheduled Match

**Suspended Match**:
A Match that began but did not finish and awaits a federation decision. It preserves the played information and may be resumed, replaced, confirmed at its current score, superseded by a Technical Result, or ended by another explicit ruling.
_Avoid_: Postponed Match, Suspended Tie

**Replacement Match**:
A new Match ordered by the federation to replay a Suspended Match from the beginning. It retains an explicit relationship to the original Match instead of replacing or deleting its history.
_Avoid_: Rescheduled continuation, Replay Match configured as a Tie Resolution Rule

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
