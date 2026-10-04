import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

export const CUSTOMER_PREFERENCE_DEFAULTS = Object.freeze({
  preferred_language: 'ar',
  theme: 'system',
  font_scale: 1,
  reduce_motion: false,
  quiet_mode: false,
  personalized_recommendations: true,
  marketing_email: false,
  marketing_in_app: false,
  greeting_messages: false,
  winback_messages: false,
  abandoned_cart_messages: false,
  occasion_reminders: true,
  price_drop_alerts: false,
  back_in_stock_alerts: false,
  quiet_hours_enabled: false,
  reuse_last_checkout_details: true,
  store_budget_limit: null,
  store_budget_overrun: false,
});

const CACHE_PREFIX = 'balqees-customer-preferences-v1:';
const CHANGE_EVENT = 'balqees-customer-preferences-change';

function bool(value, fallback) {
  return value === undefined || value === null ? fallback : value !== false;
}

export function normalizeCustomerPreferences(value = {}) {
  const scale = Number(value.font_scale ?? CUSTOMER_PREFERENCE_DEFAULTS.font_scale);
  return {
    ...CUSTOMER_PREFERENCE_DEFAULTS,
    ...value,
    preferred_language: value.preferred_language === 'en' ? 'en' : 'ar',
    theme: ['system', 'light', 'dark'].includes(value.theme) ? value.theme : 'system',
    font_scale: [0.9, 1, 1.15, 1.3, 1.5].includes(scale) ? scale : 1,
    reduce_motion: !!value.reduce_motion,
    quiet_mode: !!value.quiet_mode,
    personalized_recommendations: bool(value.personalized_recommendations, true),
    marketing_email: !!value.marketing_email,
    marketing_in_app: !!value.marketing_in_app,
    greeting_messages: !!value.greeting_messages,
    winback_messages: !!value.winback_messages,
    abandoned_cart_messages: !!value.abandoned_cart_messages,
    occasion_reminders: bool(value.occasion_reminders, true),
    price_drop_alerts: !!value.price_drop_alerts,
    back_in_stock_alerts: !!value.back_in_stock_alerts,
    quiet_hours_enabled: !!value.quiet_hours_enabled,
    reuse_last_checkout_details: bool(value.reuse_last_checkout_details, true),
    store_budget_limit: value.store_budget_limit === null || value.store_budget_limit === undefined || value.store_budget_limit === '' ? null : Number(value.store_budget_limit),
    store_budget_overrun: !!value.store_budget_overrun,
  };
}

function cacheKey(userId) { return `${CACHE_PREFIX}${userId}`; }

export function readCachedCustomerPreferences(userId) {
  if (!userId || typeof localStorage === 'undefined') return null;
  try {
    const raw = JSON.parse(localStorage.getItem(cacheKey(userId)) || 'null');
    return raw ? normalizeCustomerPreferences(raw) : null;
  } catch {
    return null;
  }
}

export function cacheCustomerPreferences(userId, preferences) {
  if (!userId || typeof localStorage === 'undefined') return;
  const normalized = normalizeCustomerPreferences(preferences);
  try { localStorage.setItem(cacheKey(userId), JSON.stringify(normalized)); } catch { /* cache is best effort */ }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { userId, preferences: normalized } }));
}

export function applyCustomerPreferences(preferences, active = true) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!active || !preferences) {
    root.classList.remove('balqees-customer-prefs', 'balqees-reduce-motion', 'balqees-quiet-mode');
    root.style.removeProperty('--balqees-customer-scale');
    return;
  }
  const p = normalizeCustomerPreferences(preferences);
  root.classList.add('balqees-customer-prefs');
  root.classList.toggle('balqees-reduce-motion', p.reduce_motion || p.quiet_mode);
  root.classList.toggle('balqees-quiet-mode', p.quiet_mode);
  root.style.setProperty('--balqees-customer-scale', String(p.font_scale));
}

export async function loadCustomerPreferences(userId) {
  if (!supabase || !userId) return normalizeCustomerPreferences();
  const { data, error } = await supabase.from('customer_preferences').select('*').eq('user_id', userId).maybeSingle();
  if (error) return readCachedCustomerPreferences(userId) || normalizeCustomerPreferences();
  const normalized = normalizeCustomerPreferences(data || {});
  cacheCustomerPreferences(userId, normalized);
  return normalized;
}

export async function personalizationEnabled(userId) {
  if (!userId) return false;
  const cached = readCachedCustomerPreferences(userId);
  if (cached) return cached.personalized_recommendations !== false;
  const preferences = await loadCustomerPreferences(userId);
  return preferences.personalized_recommendations !== false;
}

export async function recordCustomerInterest(payload) {
  if (!supabase || !payload?.user_id) return;
  if (!(await personalizationEnabled(payload.user_id))) return;
  try { await supabase.from('customer_interest_events').insert(payload); } catch { /* personalization is never required for the primary action */ }
}

export function notificationAllowed(notification, preferences) {
  const p = normalizeCustomerPreferences(preferences || {});
  const category = String(notification?.category || '').toLowerCase();
  const type = String(notification?.type || '').toLowerCase();
  const essential = ['order', 'support', 'security', 'account', 'system', 'payment'].includes(category) || ['warning', 'system'].includes(type);
  if (essential) return true;
  if (category === 'occasion') return !p.quiet_mode && p.occasion_reminders;
  if (category === 'abandoned_cart') return !p.quiet_mode && p.abandoned_cart_messages;
  if (category === 'price_drop') return !p.quiet_mode && p.price_drop_alerts;
  if (category === 'back_in_stock') return !p.quiet_mode && p.back_in_stock_alerts;
  if (category === 'greeting') return !p.quiet_mode && p.greeting_messages;
  if (category === 'winback') return !p.quiet_mode && p.winback_messages;
  if (type === 'offer' || ['marketing', 'offer', 'campaign'].includes(category)) return !p.quiet_mode && p.marketing_in_app;
  return true;
}

export function useCustomerPreferenceBridge(setLang) {
  const [session, setSession] = useState(null);
  const [isIndividual, setIsIndividual] = useState(false);
  const [preferences, setPreferences] = useState(null);

  const hydrationId = useRef(0);
  const hydrate = useCallback(async nextSession => {
    const id = ++hydrationId.current;
    const uid = nextSession?.user?.id;
    if (!uid || !supabase) {
      setIsIndividual(false);
      setPreferences(null);
      applyCustomerPreferences(null, false);
      return;
    }
    const { data: profile } = await supabase.from('customer_profiles').select('account_type').eq('id', uid).maybeSingle();
    if (id !== hydrationId.current) return;
    if (profile?.account_type !== 'individual') {
      setIsIndividual(false);
      setPreferences(null);
      applyCustomerPreferences(null, false);
      return;
    }
    const cached = readCachedCustomerPreferences(uid);
    if (cached) {
      setIsIndividual(true);
      setPreferences(cached);
      applyCustomerPreferences(cached, true);
    }
    const next = await loadCustomerPreferences(uid);
    if (id !== hydrationId.current) return;
    setIsIndividual(true);
    setPreferences(next);
    applyCustomerPreferences(next, true);
    if (setLang && (next.preferred_language === 'ar' || next.preferred_language === 'en')) setLang(next.preferred_language);
  }, [setLang]);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    let authTimer;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session || null);
      hydrate(data.session || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next || null);
      window.clearTimeout(authTimer);
      authTimer = window.setTimeout(() => hydrate(next || null), 0);
    });
    const onChange = event => {
      const uid = session?.user?.id;
      if (!uid || event?.detail?.userId !== uid) return;
      const next = normalizeCustomerPreferences(event.detail.preferences || {});
      setPreferences(next);
      applyCustomerPreferences(next, true);
      if (setLang && next.preferred_language) setLang(next.preferred_language);
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      active = false;
      ++hydrationId.current;
      window.clearTimeout(authTimer);
      subscription.unsubscribe();
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  }, [hydrate, session?.user?.id, setLang]);

  useEffect(() => () => applyCustomerPreferences(null, false), []);

  return { session, isIndividual, preferences };
}
