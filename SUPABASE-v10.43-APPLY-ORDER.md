# Supabase B2B migration order for v10.43 / QA baseline

Apply the B2B portal migrations in dependency order:

1. `SUPABASE-v10.38-B2B-TEAM-PERMISSIONS-PAGE-9.sql`
2. `SUPABASE-v10.39-B2B-SMART-CARE-PAGE-10.sql`
3. `SUPABASE-v10.40-B2B-TEAM-CARE-FINAL.sql`
4. `SUPABASE-v10.41-B2B-NOTIFICATION-ACTION-CENTER.sql`
5. `SUPABASE-v10.42-B2B-PORTAL-SETTINGS-PAGE-12.sql`
6. `SUPABASE-v10.43-B2B-PORTAL-QA-HARDENING.sql`

Why this order matters:
- v10.40 hardens and extends the Page 9/10 tables and RPCs introduced by v10.38 and v10.39.
- v10.41 introduces the notification/device infrastructure.
- v10.42 intentionally reuses the v10.41 notification/device preference infrastructure.
- v10.43 closes QA-discovered storage baseline gaps and aligns upload MIME rules with the hardened UI.

Pages 9–12 also depend on the earlier B2B baseline migrations (Pages 1–8, including v10.32–v10.37) having been applied. The list above is the dependency chain for the Page 9–12/QA layer, not a replacement for those earlier portal migrations.

Do not skip v10.38 or v10.39 on a fresh database. On an environment where those migrations were already applied, continue from the first unapplied migration only.

After migration, run Supabase security/performance advisors and validate with real organization/member roles before production rollout.

## Page 8 / v10.37 provenance

Page 8 was applied against the canonical live project as:
- `20261001214502 · b2b_financial_document_center_v10_37`
- `20261001214535 · b2b_document_publish_transition_guard_v10_37`

The historical package contains the live-alignment/validation notes but not a standalone v10.37 SQL source file. See `SUPABASE-v10.37-LIVE-MIGRATION-SOURCE.md`. A fresh database must replay that Page 8 migration state before v10.38+.
