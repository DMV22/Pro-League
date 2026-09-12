---
status: superseded by ADR-0025
---

# Separate Admin identity, access, authentication, and audit

ProLeague will allow multiple federation representatives to share one Admin role while separating persistent Admin Identity, time-bounded Admin Access Grants, Clerk authentication, and immutable Audit History. Clerk proves the signed-in identity and manages credentials, sessions, invitations, and MFA; PostgreSQL remains authoritative for whether that identity currently has administrative access, preventing external metadata or client UI state from silently granting authority.

## Consequences

The Portal uses Clerk invite-only without Organizations or Clerk role metadata as an authorization source. The first Admin is provisioned through a one-time production operator command that works only when no Active Admin exists, takes an explicit email, creates the local identity and grant plus Clerk invitation, and records an Audit Event. Subsequent invitations are initiated through ProLeague by any Active Admin.

An Admin Invitation is valid for seven days and proceeds through Pending, Accepted, Expired, or Revoked. A duplicate Pending invitation is shown rather than recreated; the Admin may resend it or explicitly revoke and replace it. A matching accepted invitation and verified Clerk user activate the Access Grant automatically without a second approval. Every invitation remains historical.

Admin Identity preserves the person and authorship across access periods. Each Admin Access Grant proceeds through Invited, Active, Suspended, or Revoked. Any Active Admin may manage another Admin because the MVP has one role, but no one may suspend or revoke their own current grant or the last Active Admin. Suspension is reversible with a reason and requires a new sign-in; Revocation permanently ends that grant. Reappointing a former Admin creates a new grant, and deleting the external Clerk user system-revokes the current grant without deleting identity or authorship.

Every protected server read and mutation requires a valid completed Clerk session mapped by stable Clerk user ID to an Active Admin Access Grant. Middleware and client-side visibility are convenience layers only. An unmatched, unavailable, suspended, or revoked local record fails closed. Email changes synchronize contact data and Audit History but do not change access; invitation acceptance must initially match the invited email.

All Admins must use authenticator-application MFA with backup codes. Sessions have configurable limits of 12 hours absolute duration and 30 minutes of inactivity. Recent identity reverification is additionally required for Admin access changes, MFA recovery, Break-glass operations, private-document bulk export, and security-configuration changes. MFA recovery is not self-service: another Active Admin verifies the person outside the Portal, records a reason, resets MFA, and revokes every existing session, or uses Break-glass when no other Admin is available.

Suspension or Revocation denies access locally immediately and requests revocation of Clerk sessions. Failure of the external call leaves an External Sync Pending operation that is retried and audited without weakening local denial. Access-state notifications are sent for invitation, activation, restoration, suspension, and revocation unless an incident-specific, audited reason delays notification.

Clerk webhook processing is idempotent by external event ID and source timestamp. Duplicate events have no repeated effect; older updates cannot undo newer local decisions, and a late user update cannot reverse an external deletion. Dashboard-originated changes become System Security Events. When an external event lacks a required reason, it is marked Reconciliation Required until an Active Admin supplies the explanation.

Every Audit Event is append-only and contains the stable actor identity or System, actor display-name and email snapshot, action, target, UTC server time, structured difference or immutable revision reference, reason when required, supporting reference, request correlation, source, and success, denied, or failed outcome. Security Events may additionally retain session ID, IP, and user-agent context under the privacy retention policy. Credentials, tokens, secrets, and private document contents are never audited.

Official-information and access mutations commit atomically with their Audit Event or fail together. Operations against Clerk or object storage instead record Requested and Succeeded or Failed events and reconcile incomplete work. Reasons are mandatory for access-state changes, published corrections, rulings, overrides, lifecycle reversals or terminal decisions, Official-information archival, Media Withdrawal, and Break-glass use; routine private Draft editing does not require one.

Audit coverage includes access invitations and states, MFA recovery, session creation or revocation, authorization denials, external identity changes, Official-information publication and correction, rulings, lifecycle transitions, exceptional overrides, scheduled operations, private supporting-document upload, replacement, view, and download, and failed system operations. It excludes keystrokes, previews, public reads, and individual Draft autosaves. Detailed failed credential attempts remain with Clerk because ProLeague does not process those credentials.

Every Active Admin may filter Audit History by time, actor, action, entity, and outcome; inspect details; navigate to the target; and export the filtered result as CSV. The application exposes no Audit Event update or delete operation. Database permissions enforce append-only behavior; a cryptographic hash chain and Admin impersonation are outside the MVP. Public reads may remain available if auditing fails, but protected mutations fail closed.
