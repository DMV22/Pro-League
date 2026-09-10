---
status: accepted
---

# Use a single Next.js modular monolith

ProLeague will launch as one Next.js App Router application containing the public Portal, Admin interface, and server-side application layer in a single deployable unit. PostgreSQL remains the authoritative store, Clerk provides invite-only Admin authentication, and media files live in object storage; a separate REST API and pnpm workspace are deferred because the launch scope has one web client and no confirmed external API consumers.

## Consequences

Server Components may read through server-only application services and repositories, Server Actions handle Admin-initiated mutations, and Route Handlers are reserved for external HTTP boundaries such as Clerk webhooks or a future public API. Domain and application modules must not depend on React components, route files, or Next.js request objects so they can be extracted into a separate service if independent clients, deployment, scaling, or long-running processing become real requirements.
