# Balqees Floral — System Administrator Bootstrap

The administrator account is provisioned server-side only. Never place `SUPABASE_SERVICE_ROLE_KEY` or the administrator password in Vite/browser code.

## 1. Apply database role support
Run `SUPABASE-CUSTOMER-PROFILES.sql` for a fresh setup, or `SUPABASE-ADMIN-ROLE.sql` if the customer profile table already exists.

## 2. Set these variables only in a trusted local/server environment

```bash
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
BALQEES_ADMIN_EMAIL=your-admin-email@example.com
BALQEES_ADMIN_PASSWORD=your-admin-password
```

## 3. Provision or promote the administrator

```bash
npm run admin:create
```

The script creates the Auth user when missing, confirms the email, stores `role=admin` in protected `app_metadata`, and marks the related `customer_profiles` row as `admin`. If the email already exists, it safely promotes that user instead of creating a duplicate.
