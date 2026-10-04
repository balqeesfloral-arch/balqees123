import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';

export const SYSTEM_SETTING_DEFAULTS = {
  site_ui: {
    accent: 'seasonal',
    fontScale: 1,
    radius: 'soft',
    contentWidth: 'standard',
    glass: true,
    motion: true,
    defaultLanguage: 'ar',
    seasonalExperience: true,
    showSeasonMessage: true,
    showWhatsapp: true,
    showCertification: true,
    showBottomLabels: true,
  },
  admin_ui: {
    accent: 'olive',
    fontScale: 1,
    density: 'comfortable',
    sidebar: 'expanded',
    topbar: 'sticky',
    contentWidth: 'wide',
    glass: true,
    motion: true,
  },
  store: {
    enabled: true,
    currency: 'SAR',
    vatRate: 15,
    showPrices: true,
    pricesIncludeVat: true,
    guestBrowse: true,
    guestCart: true,
    checkoutRequiresAccount: true,
    allowCoupons: true,
    minimumOrder: 0,
  },
  support: {
    enabled: true,
    visitorWhatsapp: true,
    signedInTickets: true,
    showFaq: true,
  },
  notifications: {
    inApp: true,
    email: false,
    whatsapp: false,
  },
  security: {
    adminAutoLock: true,
    adminIdleMinutes: 60,
  },
};

const PUBLIC_KEYS = new Set(['site_ui', 'store', 'support', 'notifications']);
const SystemSettingsContext = createContext(null);

function mergeRows(rows = []) {
  const next = Object.fromEntries(Object.entries(SYSTEM_SETTING_DEFAULTS).map(([key, value]) => [key, { ...value }]));
  for (const row of rows) {
    if (!next[row.key] || !row.value || typeof row.value !== 'object') continue;
    next[row.key] = { ...next[row.key], ...row.value };
  }
  return next;
}

function applyDocumentSettings(settings) {
  if (typeof document === 'undefined') return;
  const site = settings.site_ui || SYSTEM_SETTING_DEFAULTS.site_ui;
  document.documentElement.style.setProperty('--site-font-scale', String(Number(site.fontScale) || 1));
  document.documentElement.style.setProperty('--site-shell', site.contentWidth === 'wide' ? '1480px' : site.contentWidth === 'compact' ? '1160px' : '1320px');
  document.documentElement.dataset.siteAccent = site.accent || 'seasonal';
  document.documentElement.dataset.siteRadius = site.radius || 'soft';
  document.documentElement.classList.toggle('balqees-no-motion', site.motion === false);
  document.documentElement.classList.toggle('balqees-no-glass', site.glass === false);
}

export function SystemSettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => mergeRows([]));
  const [loading, setLoading] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [error, setError] = useState(null);
  const requestId = useRef(0);

  const refreshSettings = useCallback(async () => {
    const id = ++requestId.current;
    if (!supabase) {
      setError(new Error('Settings backend unavailable'));
      setLoading(false);
      return null;
    }
    try {
      const { data, error: readError } = await supabase
        .from('system_settings')
        .select('key,value,is_public,updated_at')
        .in('key', Object.keys(SYSTEM_SETTING_DEFAULTS));
      if (id !== requestId.current) return null;
      if (readError) throw readError;
      const merged = mergeRows(data || []);
      setSettings(merged);
      setError(null);
      setLastSyncedAt(new Date().toISOString());
      setLoading(false);
      return merged;
    } catch (readError) {
      if (id === requestId.current) { setError(readError); setLoading(false); }
      return null;
    }
  }, []);

  useEffect(() => {
    refreshSettings();
    if (!supabase) return undefined;
    let timer;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(refreshSettings, 100);
    };
    // Supabase calls must run after the Auth callback releases its session lock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setSettings(mergeRows([]));
      schedule();
    });
    const channel = supabase.channel('system-settings-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, schedule).subscribe();
    const onVisible = () => { if (document.visibilityState === 'visible') schedule(); };
    window.addEventListener('focus', schedule);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      ++requestId.current;
      window.clearTimeout(timer);
      subscription.unsubscribe();
      supabase.removeChannel(channel);
      window.removeEventListener('focus', schedule);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshSettings]);
  useEffect(() => { applyDocumentSettings(settings); }, [settings]);

  const saveSetting = useCallback(async (key, value, options = {}) => {
    if (!supabase || !SYSTEM_SETTING_DEFAULTS[key]) return { error: new Error('Settings backend unavailable') };
    const finalValue = { ...SYSTEM_SETTING_DEFAULTS[key], ...(value || {}) };
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || authData?.user?.app_metadata?.role !== 'admin') return { error: authError || new Error('Administrator access required') };
    const isPublic = options.isPublic ?? PUBLIC_KEYS.has(key);
    const { error } = await supabase.from('system_settings').upsert({
      key,
      scope: key === 'admin_ui' ? 'admin' : 'system',
      value: finalValue,
      is_public: isPublic,
      updated_by: authData?.user?.id || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' }).select('key').single();
    if (!error) {
      setError(null);
      ++requestId.current;
      setSettings(current => ({ ...current, [key]: finalValue }));
      setLastSyncedAt(new Date().toISOString());
      window.dispatchEvent(new CustomEvent('balqees:settings-updated', { detail: { key, value: finalValue } }));
    }
    return { error, value: finalValue };
  }, []);

  useEffect(() => {
    const handler = event => {
      const { key, value } = event.detail || {};
      if (!key || !SYSTEM_SETTING_DEFAULTS[key]) return;
      setSettings(current => ({ ...current, [key]: { ...SYSTEM_SETTING_DEFAULTS[key], ...(value || {}) } }));
    };
    window.addEventListener('balqees:settings-updated', handler);
    return () => window.removeEventListener('balqees:settings-updated', handler);
  }, []);

  const value = useMemo(() => ({ settings, loading, error, lastSyncedAt, refreshSettings, saveSetting }), [settings, loading, error, lastSyncedAt, refreshSettings, saveSetting]);
  return <SystemSettingsContext.Provider value={value}>{children}</SystemSettingsContext.Provider>;
}

export function useSystemSettings() {
  const context = useContext(SystemSettingsContext);
  if (!context) throw new Error('useSystemSettings must be used inside SystemSettingsProvider');
  return context;
}
