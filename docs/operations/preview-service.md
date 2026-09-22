# Pull-request Preview service

## Purpose

Runtime-changing pull requests targeting `develop` receive an isolated Render Service Preview with a unique `onrender.com` URL. The Preview is a disposable review surface, not an authoritative environment or a recovery copy.

This M1 baseline intentionally uses a single free Render web service rather than Render Preview Environments. Preview Environments require a Pro workspace and are deferred. PostgreSQL, Clerk, object storage, email, workers, and scheduled jobs are not connected at this milestone.

## Safety boundary

- Preview runs only the committed Next.js shell and synthetic repository content.
- Production secrets, webhooks, personal data, private files, and Production exports are forbidden.
- The Blueprint contains no secret placeholders and requires no Production environment group.
- Render sets `IS_PULL_REQUEST=true` on a Service Preview and adds `X-Robots-Tag: noindex` to Preview responses.
- The base service and its Preview instances use the Free plan. Any proposed paid plan change requires explicit approval.

## Bootstrap

The first Preview cannot exist until `render.yaml` is present on `develop` and the Blueprint has been applied once.

1. Merge the reviewed Blueprint change into `develop`.
2. Open `https://dashboard.render.com/blueprint/new?repo=https://github.com/DMV22/Pro-League`.
3. Authorize the `DMV22/Pro-League` repository and select `render.yaml`.
4. Review that the service is named `pro-league-development`, uses the `develop` branch, the Frankfurt region, and the Free plan.
5. Confirm that no Production environment group or secret is attached, then apply the Blueprint.
6. Wait until the base service reports `Live` and `/` passes its health check.

The next runtime-changing pull request targeting `develop` is the bootstrap verification PR. Render adds a GitHub deployment with a **View deployment** link after the Service Preview becomes available.

## Allocation rules

`render.yaml` uses an explicit `buildFilter`. Changes to application source, public assets, dependency locks, Next.js configuration, TypeScript build configuration, PostCSS configuration, or the Blueprint itself allocate a Preview. Documentation, tests, agent metadata, and GitHub workflow-only changes do not allocate an application instance.

If a runtime-relevant root file is introduced later, add it to `buildFilter.paths` in the same pull request. Treat both `paths` and `ignoredPaths` as complete replacement lists when editing the Blueprint.

## Verification

Copy the Preview origin from **View deployment**. Do not include a route or query string.

PowerShell:

```powershell
$env:PLAYWRIGHT_BASE_URL = "https://<preview>.onrender.com"
$env:LHCI_BASE_URL = $env:PLAYWRIGHT_BASE_URL

pnpm e2e:chromium
pnpm accessibility
pnpm lighthouse

Remove-Item Env:PLAYWRIGHT_BASE_URL
Remove-Item Env:LHCI_BASE_URL
```

The review evidence consists of:

- the GitHub Preview deployment URL and head commit SHA;
- successful desktop and mobile Chromium shell journeys;
- a successful automated accessibility scan;
- Lighthouse evidence using the existing strict budgets;
- confirmation that the response carries `X-Robots-Tag: noindex`.

Render's `noindex` header makes Lighthouse's crawlability audit fail by design. For URLs matching `pro-league-development-pr-<number>.onrender.com`, the Lighthouse configuration omits only the public SEO category assertion. Local and non-Preview URLs still require SEO >= 90; Preview performance, accessibility, best-practices, LCP, CLS, and TBT budgets remain unchanged. Record the `noindex` response header separately as part of Preview acceptance.

After Render reports a successful Service Preview deployment, the `Preview Lighthouse` GitHub Actions workflow runs the same budgets against its URL on a consistent CI runner and uploads the reports. Treat a failed Preview Lighthouse job as an acceptance blocker. This is a post-deploy check; do not make it a prerequisite for Render's `checksPass` deployment trigger.

Free services may cold-start. Warm the public route once before recording review evidence; do not weaken timeouts or Lighthouse budgets to hide a persistent failure.

## Cleanup and failure handling

Render automatically deletes a Service Preview when its pull request is merged or closed. Within 30 minutes of closure, confirm that the Preview no longer appears on the service's **Previews** tab and that its URL no longer serves the application.

If automatic cleanup fails:

1. Delete the Preview manually from the Render Dashboard.
2. Open a GitHub issue labelled `area:operations` and `priority:critical` with the pull request, Preview URL, closure time, observed Render state, and manual cleanup result.
3. Do not create another Preview until the cause and any unexpected cost are understood.

Record provider incidents without copying tokens, environment values, personal data, or private logs into GitHub.

## Future extension

M2 will define disposable PostgreSQL data and deterministic synthetic fixtures. Until that boundary exists, the Service Preview must remain application-only. Moving to full Render Preview Environments requires a separate cost and workspace-plan decision.
