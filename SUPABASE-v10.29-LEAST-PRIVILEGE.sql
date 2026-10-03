-- Balqees Floral v10.29
-- Reduce direct Data API privileges to the minimum needed by the web application.

revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

revoke all on table
  public.products,
  public.product_categories,
  public.price_rules,
  public.offers,
  public.faq_items,
  public.system_settings
from anon;

grant select on table
  public.products,
  public.product_categories,
  public.price_rules,
  public.offers,
  public.faq_items,
  public.system_settings
to anon;

revoke all on table
  public.customer_profiles,
  public.admin_user_state,
  public.orders,
  public.order_items,
  public.order_events,
  public.order_delivery_attempts,
  public.customer_addresses,
  public.customer_recipients,
  public.customer_recipient_addresses,
  public.customer_cart_items,
  public.customer_checkout_drafts,
  public.customer_favorites,
  public.customer_interest_events,
  public.customer_occasions,
  public.customer_preferences,
  public.customer_documents,
  public.customer_document_delivery_events,
  public.customer_privacy_requests,
  public.customer_security_events,
  public.notification_reads,
  public.support_conversations,
  public.support_messages,
  public.organization_members,
  public.organization_sites,
  public.organizations,
  public.organization_cart_items,
  public.quotations,
  public.quotation_items,
  public.contracts,
  public.client_documents,
  public.client_preferences,
  public.document_delivery_events,
  public.audit_logs,
  public.product_costs,
  public.discount_redemptions
from anon;
