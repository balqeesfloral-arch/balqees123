# Balqees Floral — Live Supabase connection

Project: `balqees-floral`
Project ref: `urlsngdafpfuetzafggy`
Region: `ap-southeast-1`
API URL: `https://urlsngdafpfuetzafggy.supabase.co`

The local Vite project is already connected using `.env.local` and the Supabase publishable key.
Never place the service-role key in React/Vite client files.

Database setup applied:
- `public.customer_profiles`
- RLS enabled
- own-profile select/update policies
- admin access via `app_metadata.role = admin`
- Auth user -> customer profile trigger
- updated_at trigger

Security Advisor: clean after the RLS hardening migration.

Admin account flow:
1. Create/sign up the admin email once through Supabase Auth.
2. Promote that existing Auth user to `app_metadata.role = admin`.
3. Refresh/re-login so the JWT contains the new admin role.
