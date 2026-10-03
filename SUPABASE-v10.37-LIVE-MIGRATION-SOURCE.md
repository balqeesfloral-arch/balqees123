# v10.37 Page 8 — live migration source of truth

The Page 8 Financial & Document Center was aligned and applied directly against the live `balqees-floral` Supabase project. The historical source ZIP does not contain a standalone v10.37 SQL file. During the v10.43 QA pass this was verified against the live migration history.

Canonical applied migrations:

1. `20261001214502 · b2b_financial_document_center_v10_37`
2. `20261001214535 · b2b_document_publish_transition_guard_v10_37`

The live migration history (`supabase_migrations.schema_migrations.statements`) is the source of truth for these two statements. The live project already contains their resulting tables, columns, RPCs, RLS/storage hardening and realtime configuration.

For a **new database built from scratch**, do not assume Page 8 exists just because later v10.40+ files reference it. Export/replay the two v10.37 migration statements from the canonical project (or from the project migration repository, if maintained externally) before applying v10.38+.

Read-only export query on the canonical project:

```sql
select version,name,unnest(statements) as statement
from supabase_migrations.schema_migrations
where name in (
  'b2b_financial_document_center_v10_37',
  'b2b_document_publish_transition_guard_v10_37'
)
order by version;
```

This note is intentionally explicit instead of silently inventing a replacement migration.
