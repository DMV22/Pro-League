---
status: superseded by ADR-0011
---

# Use a separate modular monolith REST API

ProLeague will place authentication, authorization, validation, and competition business rules in a separate TypeScript REST API organized as a modular monolith. This keeps the domain independent from Next.js Server Actions and Route Handlers, preserves a reusable API for future clients, and avoids the operational cost of microservices while the platform is developed and operated by a small team.

This decision was superseded after reassessing the launch scope: the initial product has one web client, one Admin role, and no confirmed external API consumers, so the operational boundary of a separate API is not yet justified.
