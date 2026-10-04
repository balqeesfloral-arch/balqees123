import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

export default function useLiveDataRefresh(refresh, tables = []) {
  const callback = useRef(refresh);
  useEffect(() => { callback.current = refresh; }, [refresh]);
  const tableKey = tables.join(',');
  useEffect(() => {
    let timer;
    const watched = tableKey.split(',').filter(Boolean);
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback.current(), 350);
    };
    const onChange = event => {
      if (!event.detail?.table || watched.includes(event.detail.table)) schedule();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') schedule(); };
    window.addEventListener('focus', schedule);
    window.addEventListener('balqees:admin-data-updated', onChange);
    document.addEventListener('visibilitychange', onVisible);
    let channel;
    if (supabase && watched.length) {
      channel = supabase.channel(`data-${watched.join('-')}-${Math.random().toString(36).slice(2)}`);
      watched.forEach(table => channel.on('postgres_changes', { event: '*', schema: 'public', table }, schedule));
      channel.subscribe();
    }
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', schedule);
      window.removeEventListener('balqees:admin-data-updated', onChange);
      document.removeEventListener('visibilitychange', onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [tableKey]);
}
