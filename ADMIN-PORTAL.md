# Balqees Floral — Admin Control Center v10.7.0

## Route
`/admin`

The route is protected in React and in Supabase. A signed-in user must have:

```json
{ "role": "admin" }
```

inside `auth.users.raw_app_meta_data` / `user.app_metadata`.

## Current administrator identity
The intended administrator email is the Balqees administrator email already agreed for the project. The password is **not stored in this ZIP or in frontend source code**.

## Modules
1. Overview dashboard with live database counts and smart attention signals.
2. Users: customer profiles, organization/individual filters, VIP flag, tags and private internal notes.
3. Orders: status workflow and order-item foundation for the upcoming client catalog.
4. Catalog: product/category CRUD, pricing modes, stock modes, visibility and featured products.
5. Discounts: fixed/percentage rules, validity windows and usage limits.
6. Offers: campaigns with optional discount links and display windows.
7. Notifications: audiences, scheduling, drafts and instant publishing.
8. Communication: support conversations and admin replies.
9. Help Center: FAQs that feed the visitor-facing floating help widget.
10. Settings: appearance, store/pricing, support, notification channels and security overview.
11. Profile: administrator metadata and password changes.

## Supabase foundation applied
The live `balqees-floral` project now includes RLS-protected tables:
`customer_profiles`, `admin_user_state`, `product_categories`, `products`, `discounts`, `offers`, `orders`, `order_items`, `notifications`, `notification_reads`, `support_conversations`, `support_messages`, `faq_items`, `system_settings`, `audit_logs`.

Supabase Security Advisor was checked after the migrations and returned no security lints. Performance Advisor only reports unused indexes because the new database currently has almost no production data.

## Important
User status inside `admin_user_state` is an internal CRM state. Authentication-level banning/suspension should be connected later through a server-side admin function; the browser must never receive a service-role key.
