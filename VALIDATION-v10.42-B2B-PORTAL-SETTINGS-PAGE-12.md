# Validation — v10.42 B2B Portal Settings Page 12

## Master-plan alignment

| Master plan item | Status | Verification / note |
|---|---|---|
| Theme Light/Dark/System | ✅ | Portal-wide runtime dataset/CSS variables |
| Balqees accent presets | ✅ | Olive, warm gold, deep green, sand, hotel gray |
| Density | ✅ | Comfortable/Balanced/Compact |
| Font sizing | ✅ | Small/Medium/Large/XL |
| Interface style | ✅ | Calm/Luxury/Lively |
| Reduced Motion | ✅ | Portal setting + `prefers-reduced-motion` |
| Decorations | ✅ | None/Light/Balanced/Rich |
| Glass | ✅ | Light/Balanced/Clear |
| Background motion | ✅ | Static/Subtle/Full |
| Card style | ✅ | Soft/Glass/Flat |
| Sidebar | ✅ | Wide/Compact/Auto |
| Homepage mode | ✅ | Visual/Operational/Mixed affects Dashboard |
| Widget order | ✅ | Dashboard consumes saved order |
| Widget visibility | ✅ | Dashboard consumes saved visibility |
| Number style | ✅ | Arabic-Indic / Latin formatting |
| Display profiles | ✅ | Executive/Operations/Finance/Minimal |
| Accessibility | ✅ | Contrast, borders, transparency, touch targets |
| Performance | ✅ | Auto/High/Balanced/Performance |
| Image loading | ✅ | Full/Auto/Data Saver |
| Arabic/English + RTL/LTR | ✅ | Integrated with existing language flow |
| Gregorian/Hijri/Dual | ✅ | `portalUtils` formatting |
| 12h/24h + timezone | ✅ | Effective portal preferences |
| Organization public profile | ✅ | Explicit save; logo storage included |
| Verified legal data workflow | ✅ | Change request + admin review RPC |
| Default site | ✅ | Consumed by New Request wizard |
| Default receiving officer/contact | ✅ | Consumed by New Request wizard |
| PO required | ✅ | Existing Page 3 validation now reads Page 12 setting |
| Cost Center enabled | ✅ | Stored and exposed to request layer |
| Internal approval enabled | ⚠️ | Configuration flag implemented. Full internal approval queue/status workflow is **not invented** because the current Page 3 schema does not contain it. |
| Price visibility rules | ✅ | `permissions.canSeePrices` drives relevant B2B views |
| VAT presentation | ✅ | Quotation presentation respects finance setting |
| Document grouping | ✅ | Type/month/site in Financial Docs |
| Per-category notifications | ✅ | Uses Page 11 preference infrastructure |
| Quiet Hours | ✅ | Uses Page 11 notification engine |
| Daily Summary | ✅ | Preference saved |
| Lock-screen privacy | ✅ | Preference saved |
| Password | ✅ | Real Supabase Auth update |
| TOTP | ✅ | Real enroll/challenge/verify/list/unenroll |
| Passkeys | ⏳ | Future as explicitly stated in master plan; not faked |
| Sessions | ✅ | Current session + real “sign out other sessions” action |
| Devices | ✅ | Real Page 11 device registry; remove/disable actions |
| MFA policy | ✅ | Org policy + AAL2 guard for policy changes |
| Security activity | ✅ | Audit log feed |
| Accounting/Email/ERP registry | ✅ | Extensible registry/status surface |
| External integration adapters | ⚠️ | No fake connection. Actual provider credentials/adapters remain provider-specific implementation work. |
| Display auto-save | ✅ | Debounced auto-save |
| Sensitive Save + confirmation | ✅ | Explicit save/confirmation for sensitive organization/security settings |
| System → Org → Role → User precedence | ✅ | Server-side effective-settings merge + locked-key enforcement |
| Admin counterpart | ✅ | `AdminOrganizationSettings.jsx` + route |
| Mobile/responsive styling | ✅ | Page-specific responsive CSS added to existing portal breakpoints |

## Security validation
- Exposed Page 12 tables use RLS.
- Settings RPCs verify active organization membership and server-side permissions.
- Organization MFA policy changes require AAL2.
- Verified identity edits are routed through a review workflow.
- Organization logo storage is private and organization-scoped.
- Device ownership remains user-scoped.
- UI hiding is not used as the only authorization mechanism.
- No service-role key is added to the browser bundle.

## Integration validation
- Dashboard uses the saved homepage mode, widget order and widget visibility.
- Portal layout applies appearance settings globally.
- Date and SAR formatters read Page 12 date/number/timezone preferences.
- New Request uses default site, receiving contact, PO rule and procurement settings.
- Quotations use price visibility and finance display preferences.
- Orders use effective price visibility.
- Financial Docs uses configured grouping.
- Notifications use Page 11 preference/device infrastructure.

## Source parse validation
A static JavaScript/JSX parse pass was run against the source/script files with the TypeScript parser in JSX/JS modes. No parse/syntax failures were found in the files covered by that validation pass.

A full Vite production build could **not** be verified in this environment because dependency installation could not complete: the required `vite-8.3.0.tgz` package was not available in the local npm cache, and network installation exceeded the execution window. The package deliberately does not include a partial `node_modules` tree.

## Database deployment status
`SUPABASE-v10.42-B2B-PORTAL-SETTINGS-PAGE-12.sql` is included but **NOT applied to the live production database** by this package-generation step.

Apply it only after the preceding B2B Page 9/10 and Page 11 migrations.

## Final assessment
Page 12 implements the master-plan settings surface and connects the settings to the existing B2B portal where a matching system already exists. Future items explicitly left future by the plan (Passkeys) and provider-specific external integrations are not represented as completed features.
