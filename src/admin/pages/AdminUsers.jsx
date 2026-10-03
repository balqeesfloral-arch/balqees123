import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  Filter,
  Mail,
  MoreHorizontal,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { dateTime, initials, logAdminAction } from '../adminUtils';

export default function AdminUsers({ lang }) {
  const ar = lang === 'ar';
  const [users, setUsers] = useState([]);
  const [states, setStates] = useState({});
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ status: 'active', vip: false, tags: '', internal_notes: '' });

  async function load() {
    setLoading(true);
    const [profiles, stateRows] = await Promise.all([
      supabase.from('customer_profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('admin_user_state').select('*'),
    ]);
    setUsers(profiles.data || []);
    setStates(Object.fromEntries((stateRows.data || []).map(row => [row.user_id, row])));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => users.filter(user => {
    const hay = `${user.full_name || ''} ${user.email || ''} ${user.phone || ''} ${user.username || ''} ${user.establishment_display_name || ''}`.toLowerCase();
    return (!query || hay.includes(query.toLowerCase())) && (type === 'all' || user.account_type === type);
  }), [users, query, type]);

  function openUser(user) {
    const state = states[user.id] || {};
    setDraft({ status: state.status || 'active', vip: Boolean(state.vip), tags: (state.tags || []).join(', '), internal_notes: state.internal_notes || '' });
    setSelected(user);
  }

  async function saveState() {
    if (!selected) return;
    setSaving(true);
    const payload = {
      user_id: selected.id,
      status: draft.status,
      vip: draft.vip,
      tags: draft.tags.split(',').map(x => x.trim()).filter(Boolean),
      internal_notes: draft.internal_notes.trim() || null,
    };
    const { error } = await supabase.from('admin_user_state').upsert(payload, { onConflict: 'user_id' });
    if (!error) {
      await logAdminAction('update_user_admin_state', 'customer_profile', selected.id, { status: payload.status, vip: payload.vip, tags: payload.tags });
      setStates(current => ({ ...current, [selected.id]: { ...(current[selected.id] || {}), ...payload } }));
      setSelected(null);
    }
    setSaving(false);
  }

  const orgCount = users.filter(u => u.account_type === 'company').length;
  const individualCount = users.filter(u => u.account_type === 'individual').length;

  return <div className="admin-page">
    <PageHead ar={ar} title={ar ? 'إدارة المستخدمين' : 'User management'} text={ar ? 'ملف موحد لكل عميل، مع تصنيف الحساب، بيانات التواصل، الملاحظات الداخلية والعلامات.' : 'A unified customer view with account type, contact details, internal notes and tags.'} onRefresh={load} loading={loading}/>

    <div className="admin-summary-strip">
      <Summary icon={UsersRound} label={ar ? 'إجمالي الحسابات' : 'Total accounts'} value={users.length}/>
      <Summary icon={Building2} label={ar ? 'حسابات منشآت' : 'Organizations'} value={orgCount}/>
      <Summary icon={UserRound} label={ar ? 'حسابات فردية' : 'Individuals'} value={individualCount}/>
      <Summary icon={Star} label={ar ? 'عملاء مميزون' : 'VIP clients'} value={Object.values(states).filter(x => x.vip).length}/>
    </div>

    <section className="admin-panel admin-table-shell">
      <div className="admin-toolbar">
        <div className="admin-search-field"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={ar ? 'ابحث بالاسم أو البريد أو الجوال أو المنشأة…' : 'Search name, email, phone or organization…'}/>{query && <button onClick={() => setQuery('')}><X size={15}/></button>}</div>
        <div className="admin-filter-group"><Filter size={16}/><button className={type === 'all' ? 'active' : ''} onClick={() => setType('all')}>{ar ? 'الكل' : 'All'}</button><button className={type === 'company' ? 'active' : ''} onClick={() => setType('company')}>{ar ? 'منشآت' : 'Organizations'}</button><button className={type === 'individual' ? 'active' : ''} onClick={() => setType('individual')}>{ar ? 'أفراد' : 'Individuals'}</button></div>
      </div>
      <div className="admin-table-responsive"><table className="admin-table"><thead><tr><th>{ar ? 'المستخدم' : 'User'}</th><th>{ar ? 'نوع الحساب' : 'Type'}</th><th>{ar ? 'التواصل' : 'Contact'}</th><th>{ar ? 'حالة الوصول' : 'Access status'}</th><th>{ar ? 'التسجيل' : 'Joined'}</th><th/></tr></thead><tbody>{filtered.map(user => { const state = states[user.id] || {}; return <tr key={user.id}><td><div className="admin-user-cell"><span className="admin-avatar">{initials(user.full_name, user.email)}</span><div><strong>{user.full_name || '—'}{state.vip && <Star size={13}/>}</strong><small>@{user.username || '—'}</small>{user.role === 'admin' && <em className="admin-role-mini">{ar ? 'مدير النظام' : 'System admin'}</em>}<em>{user.establishment_display_name || ''}</em></div></div></td><td><span className={`admin-chip ${user.account_type}`}>{user.account_type === 'company' ? (ar ? 'منشأة' : 'Organization') : (ar ? 'فردي' : 'Individual')}</span></td><td><div className="admin-contact-lines"><span><Mail size={13}/>{user.email || '—'}</span><span dir="ltr"><Phone size={13}/>{user.phone || '—'}</span></div></td><td><span className={`admin-status-dot ${state.status || 'active'}`}>{state.status === 'suspended' ? (ar ? 'معلّق مؤقتًا' : 'Temporarily suspended') : state.status === 'blocked' ? (ar ? 'موقوف' : 'Blocked') : (ar ? 'نشط' : 'Active')}</span></td><td>{dateTime(user.created_at, lang)}</td><td><button className="admin-row-action" onClick={() => openUser(user)}><MoreHorizontal size={18}/></button></td></tr>; })}</tbody></table></div>
      {!loading && !filtered.length && <div className="admin-empty-state"><UsersRound size={27}/><strong>{ar ? 'لا توجد نتائج' : 'No matching users'}</strong><p>{ar ? 'غيّر البحث أو الفلتر لعرض حسابات أخرى.' : 'Adjust your search or filter.'}</p></div>}
    </section>

    {selected && <div className="admin-drawer-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null); }}><aside className="admin-drawer"><div className="admin-drawer-head"><div><small>{ar ? 'ملف العميل' : 'CUSTOMER PROFILE'}</small><h3>{selected.full_name || selected.email}</h3></div><button onClick={() => setSelected(null)}><X size={19}/></button></div><div className="admin-drawer-scroll">
      <div className="admin-profile-summary"><span className="admin-avatar large">{initials(selected.full_name, selected.email)}</span><div><strong>{selected.full_name || '—'}</strong><p>{selected.email || '—'}</p><span className={`admin-chip ${selected.account_type}`}>{selected.account_type === 'company' ? (ar ? 'حساب منشأة' : 'Organization account') : (ar ? 'حساب فردي' : 'Individual account')}</span></div></div>
      <div className="admin-detail-grid"><Detail label={ar ? 'اسم المستخدم' : 'Username'} value={selected.username}/><Detail label={ar ? 'الجوال' : 'Mobile'} value={selected.phone}/><Detail label={ar ? 'اسم المنشأة' : 'Organization'} value={selected.establishment_display_name}/><Detail label={ar ? 'تاريخ التسجيل' : 'Joined'} value={dateTime(selected.created_at, lang)}/></div>
      {selected.organization && <div className="admin-info-box"><strong>{ar ? 'بيانات المنشأة' : 'Organization data'}</strong><p>{selected.organization.legal_name || '—'}</p><small>{selected.organization.unified_commercial_number ? `${ar ? 'السجل الموحد' : 'Unified CR'}: ${selected.organization.unified_commercial_number}` : ''}</small></div>}
      {selected.national_address && <div className="admin-info-box"><strong>{ar ? 'العنوان الوطني' : 'National Address'}</strong><p>{[selected.national_address.building_number, selected.national_address.street, selected.national_address.district, selected.national_address.city, selected.national_address.postal_code].filter(Boolean).join('، ') || '—'}</p></div>}
      <div className="admin-form-section"><div className="admin-form-section-title"><ShieldCheck size={17}/><div><strong>{ar ? 'إدارة العلاقة والوصول' : 'Relationship & access management'}</strong><small>{ar ? 'الحالة تؤثر على دخول العميل، بينما VIP والعلامات والملاحظات تبقى إدارية داخلية.' : 'Access status affects customer sign-in; VIP, tags and notes remain internal.'}</small></div></div><div className="admin-form-grid two"><label>{ar ? 'حالة الوصول' : 'Access status'}<select value={draft.status} onChange={e => setDraft(v => ({ ...v, status: e.target.value }))}><option value="active">{ar ? 'نشط' : 'Active'}</option><option value="suspended">{ar ? 'معلّق' : 'Suspended'}</option><option value="blocked">{ar ? 'محظور' : 'Blocked'}</option></select></label><label className="admin-switch-field"><span>{ar ? 'عميل مميز VIP' : 'VIP client'}</span><button className={`admin-switch ${draft.vip ? 'on' : ''}`} onClick={() => setDraft(v => ({ ...v, vip: !v.vip }))} type="button"><i/></button></label></div><label>{ar ? 'العلامات' : 'Tags'}<input value={draft.tags} onChange={e => setDraft(v => ({ ...v, tags: e.target.value }))} placeholder={ar ? 'فندق، عميل متكرر، عناية خاصة' : 'hotel, recurring, priority'}/></label><label>{ar ? 'ملاحظات داخلية' : 'Internal notes'}<textarea rows="5" value={draft.internal_notes} onChange={e => setDraft(v => ({ ...v, internal_notes: e.target.value }))} placeholder={ar ? 'ملاحظات لا تظهر للمستخدم…' : 'Notes invisible to the user…'}/></label></div>
      <div className="admin-security-note"><ShieldCheck size={16}/><span>{ar ? 'صلاحية مدير النظام تُدار من Supabase app_metadata ولا يمكن للمستخدم منحها لنفسه.' : 'System admin privileges are controlled by Supabase app_metadata and cannot be self-assigned.'}</span></div>
    </div><div className="admin-drawer-actions"><button className="admin-secondary-button" onClick={() => setSelected(null)}>{ar ? 'إلغاء' : 'Cancel'}</button><button className="admin-primary-button" onClick={saveState} disabled={saving}>{saving ? (ar ? 'جاري الحفظ…' : 'Saving…') : <><Check size={16}/>{ar ? 'حفظ التغييرات' : 'Save changes'}</>}</button></div></aside></div>}
  </div>;
}

function PageHead({ ar, title, text, onRefresh, loading }) { return <div className="admin-page-head"><div><span>{ar ? 'إدارة العلاقات' : 'CUSTOMER MANAGEMENT'}</span><h2>{title}</h2><p>{text}</p></div><button className="admin-secondary-button" onClick={onRefresh}><RefreshCw className={loading ? 'spin' : ''} size={16}/>{ar ? 'تحديث' : 'Refresh'}</button></div>; }
function Summary({ icon: Icon, label, value }) { return <div className="admin-summary-item"><span><Icon size={18}/></span><div><strong>{value}</strong><small>{label}</small></div></div>; }
function Detail({ label, value }) { return <div><span>{label}</span><strong>{value || '—'}</strong></div>; }
