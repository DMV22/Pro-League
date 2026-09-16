---
status: accepted
---

# Use Clerk Hobby and defer mandatory MFA

ProLeague will use Clerk Hobby in invite-only mode for the initial single-role Admin MVP and will not require MFA at launch. This supersedes ADR-0019: its separation of Admin Identity, Access Grants, Clerk authentication, PostgreSQL authorization, revocation, synchronization, and immutable Audit History remains accepted, but mandatory authenticator MFA, configurable 12-hour sessions, 30-minute inactivity expiry, and the described MFA-recovery workflow are removed because they require a materially more expensive Clerk plan than the low-traffic Portal can justify.

## Consequences

Every protected server read and mutation still requires both a valid completed Clerk session and an Active PostgreSQL Admin Access Grant; Clerk metadata, an invitation, middleware, and client UI state never grant authority. Invite-only registration, immediate local suspension or revocation, last-Active-Admin protection, idempotent webhook reconciliation, append-only auditing, and provider-owned credentials remain unchanged.

Clerk Hobby's provider-managed session policy is accepted for the initial MVP. ProLeague does not claim MFA, custom session limits, or a self-service recovery capability that the selected plan does not provide. Sensitive access-management, Break-glass, private-document bulk export, and security-configuration capabilities remain disabled until their verification and recovery controls pass a Security Review.

The Security Review is mandatory before real private documents are uploaded, a second Admin receives access, the federation adopts the Portal for official Production use, a security incident occurs, or a new requirement mandates MFA. The review compares the then-current Clerk Pro, WorkOS AuthKit, and credible alternatives; it does not imply an automatic Clerk upgrade, but the triggering capability cannot be enabled before a replacement or compensating control is accepted.
