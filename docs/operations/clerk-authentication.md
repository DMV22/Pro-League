# Clerk authentication and local Admin access

Issue #129 integrates Clerk with the local authorization foundation from #127.
This is not first-Admin bootstrap (#130), webhook processing (#131), access-state
management (#132), or full Admin UI (#134). ADR-0025 still gates sensitive capabilities
and official Production adoption behind Security Review.

## Default-closed operation

Without complete explicit configuration, `/admin` and `/admin/sign-in` show a neutral
unavailable screen; no private Admin data is returned. `GET /api/admin/access` returns
503 with a stable `authorization_unavailable` code. Public Portal routes remain
outside the Clerk proxy matcher and do not require Clerk keys or availability.

There is no synthetic identity switch in production, public bootstrap route, automatic
seed, automatic keyless Clerk app provisioning, or authorization from client metadata.

## Trusted isolated setup

1. Select an operator-owned Clerk development application for isolated testing. Configure
   invite-only access in its Dashboard; this repository does not change that setting.
   Do not create a second real Admin or activate official Production use here.
2. Configure the trusted application's local environment or dedicated test service:

   ```dotenv
   ADMIN_AUTH_ENABLED=true
   ADMIN_AUTH_ORIGINS=http://localhost:3000
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<publishable development key>
   CLERK_SECRET_KEY=<server development secret>
   ```

   Each allowed origin must be exact (scheme, hostname, port), without path, wildcard or
   embedded credentials. Separate multiple origins with commas. HTTPS is required except
   for loopback development. Publishable and secret keys must use the same test/live mode.
   Use the actual local port or dedicated HTTPS test origin, not an arbitrary Preview wildcard.

3. Set the provider's allowed redirects/domains appropriately for `/admin/sign-in` and
   `/admin`. The sign-in UI returns to the fixed local `/admin` path. No public sign-up
   page is provided. Invite-only enforcement remains a required provider configuration.
4. Supply a separately isolated runtime database using its least-privilege runtime role.
   Install reviewed migrations normally. Do not manually grant real access as a substitute
   for #130; any pilot fixture must be synthetic and operator-controlled.
5. Restart/rebuild after environment changes. Never paste secrets into chat, screenshots,
   command arguments, logs, Audit, cache keys or source control. Only the publishable key
   reaches the Clerk UI; the secret stays in server-only composition.

Do not attach Clerk credentials to ordinary PR Preview services or builds, including
environment groups inherited by those services. A malicious PR can read available secrets
regardless of this implementation's opt-in flag. Use no-key default-closed CI for untrusted
code. A real Clerk pilot requires a separate trusted test environment and reviewed code.

## Authorization ownership

- `AdminSessionPort` is implemented by the Clerk adapter. Only completed user sessions
  are accepted, not pending sessions, machine tokens or impersonation sessions.
- The adapter calls Clerk's verified request helper and online session lookup, checks the
  session ID/user ID binding, Active state, creation time and expiry. It returns only
  subject, session ID and provider-verified `startedAt` (epoch milliseconds).
- Every verification makes a new provider check; no cross-request successful-auth cache
  is introduced. This trades latency/provider request budget for current provider status
  and reliable session creation evidence. Review measured rate limits before increasing load.
- The caller wait is limited to five seconds. Timeout means unavailable and no permission;
  it does not claim cancellation of an in-flight SDK request or its internal network retries.
- Identity & Access owns the current mapping, Identity, Grant, restoration and local
  session-denial rules. Email and Clerk organization/role metadata never authorize Admin.
- Reads use one coherent PostgreSQL statement without rendering-long row locks. Commands
  require a `DatabaseTransaction`, lock mapping → Identity → Grant in order, then apply the
  same predicates before claim/replay/commit. No Clerk network call occurs under DB locks.
- A prior page render or status response is not a capability. Server Actions and Route
  Handlers call the guard themselves. Commands use `executeProtectedAdminCommand()` with
  trusted server-owned definitions/policies, never a browser-supplied actor or definition.
- `GET /api/admin/access` and `checkAdminAccessAction()` return only status and the display
  name when authorized. Actor/session IDs and contact email do not enter those DTOs.
  The Action only refreshes status; it is not a business mutation.

## Restoration and session denial

An immutable `admin_access_state_transitions` record from Suspended to Active establishes
the new-sign-in cutoff. A verified session created at or before any such cutoff is denied,
including for replay. Use Clerk session creation time, never JWT `iat`: refreshing a token
does not establish a new sign-in. Timestamp comparison stays in PostgreSQL to preserve the
recorded cutoff's precision.

A matching `admin_sessions.provider_session_hash` also denies access when locally revoked
or bound to another Grant. This integration defines that lookup as SHA-256 of the exact
UTF-8 provider session ID; no raw session ID is stored by these read paths. An absent local
session record is not auto-created during rendering: online Clerk evidence plus current
local authorization is still required. Session ingestion belongs to subsequent M4 work.

Future #132 writers must hold the same Grant lock and atomically record restoration and
session-denial evidence with Audit/Outbox. Changing only the state column by privileged SQL
is not a supported restoration workflow. No restore/revoke capability is activated here.

## Verification and acceptance

- Unit checks cover completed/pending/non-user/revoked/expired/inconsistent provider proof,
  provider timeout/failure, typed read decisions, configuration and direct server composition.
  SDK/driver test doubles stay at external seams; no production bypass is introduced.
- `db:integration` includes `scripts/db/verify-admin-access.ts`: real PostgreSQL mapping,
  Identity/Grant states, effective periods, local session denial, restoration and stable
  command replay. Existing #127 lock-race and rollback checks remain required.
- Browser checks verify default-closed Admin/sign-in, private/no-store JSON and a real
  direct Server Action POST. Baseline accessibility/Lighthouse measure the neutral closed
  Admin screen, not a signed-in dashboard. Public Portal checks remain in the baseline.
- Admin authorization/DTOs have no `use cache`, shared memoization or public cache tags.
  Request-time Admin rendering sits behind Suspense with a neutral loading state.
- Before closing #129: successful CI, isolated real Clerk sign-in/sign-out/pending-session
  pilot, verified local denial/restoration, owner merge and final reconciliation are required.
  Synthetic checks alone do not prove provider Dashboard configuration or end-to-end login.

### Local implementation verification (2026-11-10)

- Passed: 282 unit tests across 42 files, TypeScript, targeted lint, formatting,
  production build and the full PostgreSQL integration suite.
- Passed: 19 targeted desktop/mobile browser and accessibility checks, including the
  direct default-closed Route Handler and Server Action requests.
- Not passed: strict local Lighthouse. A second three-run-per-route measurement without
  the parallel unit run still reported median performance 0.78 on `/` (required 0.90)
  and 0.80 on `/admin` (required 0.85). Home median LCP was 2988.737 ms (limit 2500 ms)
  and median TBT was 641 ms (limit 200 ms). Accessibility and other configured
  non-performance assertions passed. Budgets are unchanged.
- The measurements establish a local performance failure, not its cause or a confirmed
  Clerk regression. The real Clerk pilot, CI and owner acceptance remain pending.

### Base-revision comparison (2026-11-10)

Compared the uncommitted implementation against `develop` at
`7bc35f0b2cb68f04f5ba23a2cc524548fe81b48c` in an isolated worktree. The remote branch
still referenced that commit when checked. Both used locked dependencies, production
builds, Node 22.14.0, Next 16.3.5, React 19.2.8, Lighthouse 12.6.1 and headless Chrome 156. Each route had three sequential cold navigations with the existing mobile settings
(412 × 823, simulated 150 ms RTT, 1638.4 Kbps throughput, 4× CPU slowdown).
No parallel build, test suite or running test database was used during collection.

Both runs explicitly disabled Admin authentication and public database configuration;
the latter used the application's recognized placeholder URL rather than an unreachable
real database. Home therefore had the same unavailable-data state. Base Admin is the
old static placeholder; current Admin is the new closed screen, not a signed-in dashboard.

| Median metric                | Base `develop`   | Current implementation | Existing requirement            |
| ---------------------------- | ---------------- | ---------------------- | ------------------------------- |
| Home Performance (range)     | 0.81 (0.79–0.86) | 0.81 (0.75–0.81)       | ≥ 0.90                          |
| Home LCP                     | 2903 ms          | 2868 ms                | ≤ 2500 ms                       |
| Home TBT                     | 571 ms           | 522 ms                 | ≤ 200 ms                        |
| Admin Performance (range)    | 0.84 (0.83–0.85) | 0.82 (0.78–0.83)       | ≥ 0.85                          |
| Admin LCP                    | 2732 ms          | 3151 ms                | No separate Admin LCP assertion |
| Admin transferred JavaScript | 149439 bytes     | 206649 bytes           | No byte assertion               |

The base also fails strict performance assertions. The Home failure is not unique to
this change, and no external Clerk request was identified in either collected network set.
Current Home JavaScript transfer was 151502 bytes versus 149439 on base.
Admin has a measured additional 57210 bytes of transferred JavaScript and a higher LCP
in this sample; its static SDK imports are a candidate for targeted loading isolation,
not a proven explanation for every timing difference. Three runs with variable host
benchmark results do not establish statistical equivalence or rule out regressions.
Accessibility and the other configured non-performance assertions passed in both sets.
No budgets, assertions or runtime authorization code were changed for this comparison.

Raw base/current HTML and JSON evidence is retained locally under ignored
`artifacts/auth-129-comparison/`. These are local lab results, not field-user metrics
or a test of real Clerk login. The temporary base worktree is not part of the deliverable.

### Closed Admin JavaScript follow-up (2026-11-11)

The Admin routes now render Clerk controls only when configuration and access state
require them. The controls are split at a client boundary; a conditional server import
alone still loaded the Clerk chunk in a production-build check. The disabled UI, API
responses, and server-side authorization rules are unchanged.

On clean Chromium navigations with auth disabled, the initial compressed Next.js scripts
went from 200995 to 150120 bytes on `/admin` and from 193417 to 146849 bytes on
`/admin/sign-in`. The loaded scripts no longer contained the Clerk SDK markers found in
the previous build. These are transfer-size measurements, not new Lighthouse scores.
Browser regression checks cover both routes. Real Clerk sign-in/out remains a separate
pilot check.

## Sources

- [Clerk auth()](https://clerk.com/docs/nextjs/reference/app-router/auth)
- [Clerk getSession()](https://clerk.com/docs/reference/backend/sessions/get-session)
- [Clerk session tokens](https://clerk.com/docs/guides/sessions/session-tokens)
- Installed Next.js guides: `authentication-with-cache-components.md`, `data-security.md`
  and the getting-started Proxy guide in `node_modules/next/dist/docs/`.
