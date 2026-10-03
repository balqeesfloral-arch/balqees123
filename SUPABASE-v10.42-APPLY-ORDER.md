# Supabase B2B migration order for v10.42

Apply migrations in dependency order:

1. `SUPABASE-v10.40-B2B-TEAM-CARE-FINAL.sql`
2. `SUPABASE-v10.41-B2B-NOTIFICATION-ACTION-CENTER.sql`
3. `SUPABASE-v10.42-B2B-PORTAL-SETTINGS-PAGE-12.sql`

Do not apply Page 12 before Page 11 because Page 12 intentionally reuses the notification/device preference infrastructure introduced by Page 11.

After migration, run database/security advisors and validate with real organization/member roles before production rollout.
