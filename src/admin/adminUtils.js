import { supabase } from '../lib/supabase';

export const money = (value, lang = 'ar') => new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-SA', {
  style: 'currency',
  currency: 'SAR',
  maximumFractionDigits: 2,
}).format(Number(value || 0));

export const dateTime = (value, lang = 'ar') => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Riyadh',
  }).format(d);
};

export const dateOnly = (value, lang = 'ar') => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-GB', {
    dateStyle: 'medium',
    timeZone: 'Asia/Riyadh',
  }).format(d);
};

export function initials(name = '', email = '') {
  const text = String(name || email || 'BQ').trim();
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return text.slice(0, 2).toUpperCase();
}

export function normalizeSlug(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9\-\u0600-\u06ff]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function logAdminAction(action, entityType, entityId = null, details = {}) {
  if (!supabase) return;
  try {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return;
    await supabase.from('audit_logs').insert({
      actor_id: data.user.id,
      action,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      details,
    });
  } catch {
    // Audit logging must never block the admin workflow.
  }
}

export const ADMIN_UI_DEFAULTS = {
  accent: 'olive',
  fontScale: 1,
  density: 'comfortable',
  sidebar: 'expanded',
  glass: true,
  motion: true,
};
