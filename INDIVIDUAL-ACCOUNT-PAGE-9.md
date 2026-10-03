# Individual Account — Page 9: Notification Center (v10.22)

Route: `/account/notifications`

Implemented from the approved individual-account plan:

- Quiet smart inbox, not a generic notification feed.
- Primary order: Needs attention → Orders → Balqees messages → Offers & greetings → Reminders → Other.
- Current / Important / Archived views.
- Real unread counts from `notification_reads`.
- Mark all current notifications as read.
- Per-notification archive and restore.
- Automatic archive of old **read** notifications: 45 days for non-essential items; 120 days for operational/high-priority items. Archived items remain recoverable.
- “I don’t want this type” is available only for non-essential categories and changes the actual customer preference in `customer_preferences`.
- Essential order / support / security / account / payment / system notices cannot be muted.
- Quiet mode and customer notification preferences are enforced using `notificationAllowed()`.
- Every actionable notification routes to its real context: order, Balqees Care conversation, cart, occasion, store or account.
- No fake WhatsApp/email notification controls.
- Header bell icons across the individual account now open the dedicated center.
- Home page retains only the latest three notifications and links to the center for the full inbox.
- Responsive mobile layout with the approved 5-item account dock.

Security:

- Uses existing RLS-protected `notifications` / `notification_reads` tables.
- Auto-archive browser RPC is `SECURITY INVOKER`; the owner-checked elevated core is in `private`.
- Supabase Security Advisor returned zero warnings after v10.22 migration.
