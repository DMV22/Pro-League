# Render Blueprint schema snapshot

- Source: [Render's official JSON Schema](https://render.com/schema/render.yaml.json).
- Specification: [Blueprint YAML Reference](https://render.com/docs/blueprint-spec).
- Retrieved: 2026-10-20; JSON Schema draft 2020-12.
- Canonical JSON SHA-256 (`JSON.stringify(JSON.parse(file))`):
  `9247b2cf9a9af51d0af41f6a2323106b6dada3407395cd242cfa20bbea806b5c`.

`render.yaml.schema.json` contains the complete official schema, with formatting
only changed. It has no external `$ref` dependencies. Keeping a reviewed snapshot
in Git makes validation reproducible and independent of provider availability.
There is no network request or API credential during validation.

Run from the repository root:

```powershell
npm ci --prefix scripts/preview --ignore-scripts --no-audit --no-fund
npm --prefix scripts/preview run blueprint:validate
```

To update, retrieve the official schema, review its diff, replace the snapshot
without editing its validation rules, and record the new retrieval date and
canonical checksum here. Run the Blueprint tests, validator, quality and types
checks before committing. A new Render field is not automatically accepted until
the snapshot update has been reviewed.

Validation checks YAML parsing and schema structure. It does not authenticate,
query resources, validate quotas or account-specific availability, resolve live
cross-resource references, check immutable-field changes, or deploy anything.
Those remain reviewed infrastructure operations. Schema validation succeeding
does not make a remaining repository-level Render API secret safe for PR code;
follow the secret migration in the automation runbook before activation.
