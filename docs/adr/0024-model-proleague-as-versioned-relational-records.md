---
status: accepted
---

# Model ProLeague as versioned relational records

ProLeague will use a normalized PostgreSQL schema in which mutable aggregate roots expose efficient current pointers while revisions, decisions, rulings, lifecycle transitions, activations, and final sporting snapshots remain append-only. Application-generated UUIDv7 identifiers, explicit module ownership, restrictive cross-module foreign keys, optimistic versions, named database constraints, ordered locks, and narrowly bounded JSONB preserve both operational simplicity and the reproducibility of Official information.

The implementation-ready table, constraint, index, access, retention, and anonymization design is recorded in [the relational schema blueprint](../architecture/relational-schema.md). Draft working state is mutable and server-authoritative, but publication or activation produces immutable normalized snapshots; current standings and provisional progression remain derived, while final outputs record their exact input versions. PostgreSQL schema `app` uses least-privilege runtime roles, insert-only Audit History, explicit physical-deletion exceptions, and real PostgreSQL verification under the migration workflow from ADR-0023.
