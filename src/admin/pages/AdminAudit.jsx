import { useEffect, useMemo, useState } from 'react';
import { Activity, FileClock, Filter, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { dateTime } from '../adminUtils';

const labels = {
  create_product: ['إنشاء منتج', 'Create product'],
  update_product: ['تحديث منتج', 'Update product'],
  create_category: ['إنشاء صنف', 'Create category'],
  update_category: ['تحديث صنف', 'Update category'],
  create_discount: ['إنشاء خصم', 'Create discount'],
  update_discount: ['تحديث خصم', 'Update discount'],
  create_offer: ['إنشاء عرض', 'Create offer'],
  update_offer: ['تحديث عرض', 'Update offer'],
  create_notification: ['إنشاء إشعار', 'Create notification'],
  update_notification: ['تحديث إشعار', 'Update notification'],
  publish_notification: ['نشر إشعار', 'Publish notification'],
  update_order: ['تحديث طلب', 'Update order'],
  update_user_admin_state: ['تحديث حالة مستخدم', 'Update user state'],
  admin_profile_initialized: ['تهيئة حساب المدير', 'Initialize admin account'],
  update_faq: ['تحديث سؤال شائع', 'Update FAQ'],
  create_faq: ['إنشاء سؤال شائع', 'Create FAQ'],
};

export default function AdminAudit({ lang }) {
  const ar = lang === 'ar';
  const [rows, setRows] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [query, setQuery] = useState('');
  const [entity, setEntity] = useState('all');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(300);
    const logs = error ? [] : (data || []);
    setRows(logs);
    const ids = [...new Set(logs.map(x => x.actor_id).filter(Boolean))];
    if (ids.length) {
      const { data: people } = await supabase.from('customer_profiles').select('id,full_name,email').in('id', ids);
      setProfiles(Object.fromEntries((people || []).map(x => [x.id, x])));
    } else setProfiles({});
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const entityTypes = useMemo(() => [...new Set(rows.map(x => x.entity_type).filter(Boolean))], [rows]);
  const filtered = useMemo(() => rows.filter(row => {
    const actor = profiles[row.actor_id] || {};
    const hay = `${row.action || ''} ${row.entity_type || ''} ${row.entity_id || ''} ${actor.full_name || ''} ${actor.email || ''} ${JSON.stringify(row.details || {})}`.toLowerCase();
    return (!query || hay.includes(query.toLowerCase())) && (entity === 'all' || row.entity_type === entity);
  }), [rows, profiles, query, entity]);

  return <div className="admin-page">
    <div className="admin-page-head"><div><span>{ar ? 'حوكمة ومراجعة' : 'GOVERNANCE & TRACEABILITY'}</span><h2>{ar ? 'سجل النشاط الإداري' : 'Administrative activity log'}</h2><p>{ar ? 'سجل زمني للعمليات المهمة داخل لوحة الإدارة للمراجعة وتتبع التغييرات.' : 'A chronological record of important admin actions for review and change traceability.'}</p></div><button className="admin-secondary-button" onClick={load}><RefreshCw className={loading ? 'spin' : ''} size={16}/>{ar ? 'تحديث' : 'Refresh'}</button></div>

    <div className="admin-summary-strip">
      <Summary icon={FileClock} label={ar ? 'آخر 300 عملية' : 'Latest 300 actions'} value={rows.length}/>
      <Summary icon={Activity} label={ar ? 'أنواع العمليات' : 'Action types'} value={new Set(rows.map(x => x.action)).size}/>
      <Summary icon={ShieldCheck} label={ar ? 'كيانات متأثرة' : 'Entity types'} value={entityTypes.length}/>
    </div>

    <section className="admin-panel admin-table-shell">
      <div className="admin-toolbar"><div className="admin-search-field"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={ar ? 'ابحث في السجل…' : 'Search the activity log…'}/></div><div className="admin-filter-group"><Filter size={16}/><select className="admin-select-filter" value={entity} onChange={e => setEntity(e.target.value)}><option value="all">{ar ? 'كل الكيانات' : 'All entities'}</option>{entityTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></div></div>
      <div className="admin-table-responsive"><table className="admin-table"><thead><tr><th>{ar ? 'العملية' : 'Action'}</th><th>{ar ? 'المنفذ' : 'Actor'}</th><th>{ar ? 'الكيان' : 'Entity'}</th><th>{ar ? 'التفاصيل' : 'Details'}</th><th>{ar ? 'الوقت' : 'Time'}</th></tr></thead><tbody>{filtered.map(row => { const actor = profiles[row.actor_id] || {}; const pair = labels[row.action]; return <tr key={row.id}><td><div className="admin-text-stack"><strong>{pair ? pair[ar ? 0 : 1] : row.action}</strong><small>{row.action}</small></div></td><td><div className="admin-text-stack"><strong>{actor.full_name || (ar ? 'مدير النظام' : 'System admin')}</strong><small>{actor.email || '—'}</small></div></td><td><span className="admin-chip">{row.entity_type || 'system'}</span>{row.entity_id && <small className="admin-audit-id">{String(row.entity_id).slice(0, 18)}</small>}</td><td><AuditDetails details={row.details} ar={ar}/></td><td>{dateTime(row.created_at, lang)}</td></tr>; })}</tbody></table></div>
      {!loading && !filtered.length && <div className="admin-empty-state"><FileClock size={28}/><strong>{ar ? 'لا توجد عمليات مطابقة' : 'No matching activity'}</strong><p>{ar ? 'ستظهر هنا عمليات الإدارة المهمة تلقائيًا.' : 'Important administrative changes will appear here automatically.'}</p></div>}
    </section>
  </div>;
}

function AuditDetails({ details, ar }) {
  const entries = Object.entries(details || {}).slice(0, 4);
  if (!entries.length) return <span>—</span>;
  return <div className="admin-audit-details">{entries.map(([key, value]) => <span key={key}><b>{key}</b>: {typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>)}{Object.keys(details || {}).length > 4 && <small>{ar ? 'تفاصيل إضافية محفوظة' : 'More details stored'}</small>}</div>;
}

function Summary({ icon: Icon, label, value }) { return <div className="admin-summary-item"><span><Icon size={18}/></span><div><strong>{value}</strong><small>{label}</small></div></div>; }
