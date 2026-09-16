---
status: accepted
---

# Replace the Redux simulator through server-owned vertical slices

ProLeague will freeze the working Vite/Redux prototype behind a Git tag and replace the repository root in place with the Next.js Portal, without a parallel legacy application, dual writes, or an adapter that reproduces the prototype's Redux graph. Browser-persisted and hard-coded simulator data will not become Official information; each Portal capability will instead be delivered as a server-owned vertical slice across PostgreSQL persistence, domain/application rules, Admin workflow, public projection, audit/outbox, cache invalidation, and tests. This sequence was selected over a big-bang rewrite and prolonged coexistence because it creates independently verifiable progress while preventing temporary simulator boundaries from becoming production architecture.

## Consequences

The first functional milestone is a read-only walking skeleton from Competition and Season through a round, results, and Standings. After the Next.js shell passes CI, Vite, global Redux, `redux-persist`, simulation, and out-of-scope transfer-market behavior are removed; Redux may return only as the disposable route-scoped builder state allowed by ADR-0022. The detailed milestones, gates, rollback points, data policy, and launch sequence are recorded in [the cutover blueprint](../architecture/simulator-to-portal-cutover.md).

