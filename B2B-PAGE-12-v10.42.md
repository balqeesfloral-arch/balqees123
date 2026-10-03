# Balqees Floral B2B Portal — Page 12 Settings v10.42

## Scope
This release implements **Page 12 — Settings** from `Balqees-B2B-Portal-Master-Plan-v1.0.md` and closes the main B2B portal sequence (Pages 1–12).

The implementation keeps **Security & Privacy inside Settings**, exactly as required by the master plan. It is not exposed as a separate top-level portal page.

## 1. Display & Appearance
Implemented as real portal-wide preferences, not a preview-only panel.

Supported settings:
- Theme: Light / Dark / System.
- Balqees accent presets: olive / warm gold / deep green / sand / hotel gray.
- Density: Comfortable / Balanced / Compact.
- Font size: Small / Medium / Large / Extra Large.
- Interface style: Calm / Luxury / Lively.
- Reduced Motion with `prefers-reduced-motion` support.
- Decorations: None / Light / Balanced / Rich.
- Glass effect: Light / Balanced / Clear.
- Background motion: Static / Subtle / Full.
- Card style: Soft / Glass / Flat.
- Sidebar: Wide / Compact / Auto.
- Homepage mode: Visual / Operational / Mixed.
- Widget order and visibility.
- Number style: Arabic-Indic / Latin.
- Display profiles: Executive / Operations / Finance / Minimal.
- Accessibility: high contrast, clear borders, reduced transparency, larger touch targets.
- Performance: Auto / High / Balanced / Performance.
- Image loading: Full / Auto / Data Saver.

### Runtime application
`src/client/portalAppearance.js` maps the saved preferences to portal-level data attributes and CSS variables. `ClientPortalLayout.jsx` applies them at the shell level, so the preference affects the entire B2B portal rather than only `/portal/settings`.

Dashboard widget order/visibility and Visual/Operational homepage modes are applied by `ClientDashboard.jsx`.

Display settings auto-save. Organization/finance/procurement/security settings require explicit Save and confirmation where sensitive.

## 2. Language, Date & Number Formatting
Implemented:
- Arabic / English.
- RTL / LTR through the existing application language flow.
- Gregorian / Hijri (Umm al-Qura) / Dual.
- 12h / 24h.
- Timezone.
- Arabic-Indic / Latin numbers.

`src/client/portalUtils.js` now reads the effective portal preferences so existing pages using `fmtDate` and `sar` inherit the settings.

## 3. Organization Data
Implemented:
- Trade/display name.
- Primary email and phone.
- Billing email.
- Website.
- Sector.
- Preferred language.
- Organization logo upload to the private `organization-assets` bucket.

Verified/legal identity fields are shown separately:
- Legal name.
- Commercial / unified registration number.
- VAT number.
- Entity type.

Verified identity data is **not silently edited**. The page creates an `organization_change_requests` workflow item and the admin counterpart reviews/approves/rejects it.

## 4. Orders & Procurement
Implemented organization settings:
- Default site.
- Default receiving contact.
- PO required.
- Cost Center enabled.
- Internal approval flag.
- Price visibility rules.

`ClientRequestWizard.jsx` consumes the Page 12 defaults. A new request can preselect the configured site/receiving contact and the existing PO validation respects the Page 12 `PO required` setting.

### Internal approval note
The configuration flag is stored and exposed to the request layer, but this release **does not invent a new approval queue/status workflow** that does not exist in the current Page 3 request data model. A full internal approval workflow must be introduced as a separate workflow/schema change if required later.

## 5. Finance
Implemented:
- Show VAT separately.
- Context / pre-tax / VAT-inclusive amount presentation.
- Document grouping by type / month / site.
- Price visibility based on effective member permissions and organization policy.

Applied to:
- Quotations.
- Orders.
- Financial document center grouping.

## 6. Notifications
Page 12 configures the notification engine introduced in Page 11:
- In-App.
- Push.
- Email.
- WhatsApp field retained as a future/provider-dependent channel.
- Quiet Hours.
- Daily digest preference.
- Lock-screen privacy.
- Per-category channel matrix.

These settings are persisted through the Page 11 notification preference infrastructure. The settings page does not fabricate delivery adapters that have not been configured.

## 7. Security & Privacy
Kept inside Page 12 as required.

Implemented:
- Password change using Supabase Auth.
- Real TOTP enrollment / challenge / verify / list / unenroll through Supabase Auth MFA APIs.
- Current Authenticator Assurance Level (AAL1/AAL2).
- Organization MFA policy: none / sensitive roles / all members.
- Server-side requirement for AAL2 when changing the organization MFA policy.
- Current session summary.
- Sign out all **other** sessions using Supabase Auth `scope: 'others'` while keeping the current session.
- Security activity from audit logs.

### Passkeys
The master plan explicitly marks Passkeys as later/future. This release does not fake Passkey support.

## 8. Devices
Uses the Page 11 device registry.

Implemented per device:
- Push status.
- Last seen.
- Active state.
- Disable push/device.
- Remove device with confirmation.

Web Push permission is requested only from Settings and only when the app has `VITE_WEB_PUSH_PUBLIC_KEY` configured and the browser supports Service Workers + PushManager. There is no unsolicited permission prompt at login.

## 9. Integrations
Implemented an extensible `organization_integrations` registry and admin surface for:
- Accounting.
- Email.
- ERP.
- Webhook / future integrations.

The UI reports real registry state only. It does not claim an external provider is connected unless a real configuration exists.

## 10. Policy Precedence
Implemented in the settings RPC:

`System defaults → Organization defaults → Role defaults → User preference`

Organization/role locked display keys are removed from the user layer before the effective preference object is produced, so locked policies are actually enforced rather than merely disabled in the UI.

## 11. Admin Counterpart
Added `AdminOrganizationSettings.jsx` and an Admin navigation route.

Capabilities:
- Select organization.
- Review verified identity change requests.
- Approve/reject requests through audited RPC.
- Inspect organization portal/MFA settings.
- Maintain integration registry/status.

## 12. Supabase Migration
Included:

`SUPABASE-v10.42-B2B-PORTAL-SETTINGS-PAGE-12.sql`

It adds the Page 12 settings tables, RPCs, RLS, audit behavior, organization sector field, private organization asset storage policy, policy merge engine, admin change-request review, and preference synchronization.

**Apply order:** Page 9/10 final migration → Page 11 migration → Page 12 v10.42 migration.

The migration is included in the package but was **not applied to the production Supabase project during this release build**.

## 13. Version
Package version: **10.42.0**.
