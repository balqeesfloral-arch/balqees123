import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpLeft, ExternalLink, Search, ShieldCheck } from 'lucide-react';
import { CONNECTED_PAGES, PAGE_GROUPS, matchesPage } from '../adminNavigation';

export default function AdminPageHub({ lang }) {
  const ar = lang === 'ar';
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const rows = useMemo(() => CONNECTED_PAGES.filter(item => (group === 'all' || item.group === group) && matchesPage(item, query)), [group, query]);
  return <div className="admin-page admin-page-hub">
    <div className="admin-page-head"><div><span>BALQEES · CONNECTED WORKSPACE</span><h2>{ar ? 'كل صفحات بلقيس، من مكان واحد' : 'Every Balqees page, in one place'}</h2><p>{ar ? 'انتقل إلى إدارة كل تجربة، أو افتح معاينة الصفحات العامة مباشرة.' : 'Open the administration behind each experience, or preview public pages directly.'}</p></div><span className="admin-hub-total">{CONNECTED_PAGES.length}<small>{ar ? 'وجهة مرتبطة' : 'connected destinations'}</small></span></div>
    <section className="admin-panel admin-hub-toolbar"><label className="admin-search-field"><Search size={18}/><input aria-label={ar ? 'ابحث في الصفحات' : 'Search pages'} placeholder={ar ? 'اسم الصفحة أو المسار…' : 'Page name or route…'} value={query} onChange={e => setQuery(e.target.value)}/></label><div className="admin-hub-filters">{[{ id: 'all', ar: 'الكل', en: 'All' }, ...PAGE_GROUPS].map(item => <button key={item.id} className={group === item.id ? 'active' : ''} onClick={() => setGroup(item.id)}>{ar ? item.ar : item.en}</button>)}</div></section>
    <div className="admin-hub-security"><ShieldCheck size={16}/><span>{ar ? 'بيانات العملاء محمية بصلاحيات حساباتهم. إدارة البوابات تتم من أقسام المدير المرتبطة بها.' : 'Customer data remains protected by account permissions. Manage portals through their linked admin modules.'}</span></div>
    {PAGE_GROUPS.map(section => {
      const items = rows.filter(item => item.group === section.id);
      if (!items.length) return null;
      return <section key={section.id} className="admin-hub-section"><header><h3>{ar ? section.ar : section.en}</h3><span>{items.length}</span></header><div className="admin-hub-grid">{items.map(item => {
        const Icon = item.icon;
        return <article className="admin-hub-card" key={`${item.group}-${item.path}`}><span className="admin-hub-icon"><Icon size={22}/></span><h4>{ar ? item.ar : item.en}</h4><code dir="ltr">{item.path}</code><footer><Link to={item.manage}>{ar ? 'فتح الإدارة' : 'Open management'}<ArrowUpLeft size={15}/></Link>{item.preview && <Link to={item.path} target="_blank" rel="noreferrer" aria-label={`${ar ? 'معاينة' : 'Preview'} ${ar ? item.ar : item.en}`}><ExternalLink size={16}/><span>{ar ? 'معاينة' : 'Preview'}</span></Link>}</footer></article>;
      })}</div></section>;
    })}
    {!rows.length && <div className="admin-empty-inline">{ar ? 'لا توجد صفحات مطابقة للبحث.' : 'No pages match your search.'}</div>}
  </div>;
}
