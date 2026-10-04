import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpLeft, ExternalLink, LoaderCircle, ShieldCheck, ShoppingBag } from 'lucide-react';
import { useSystemSettings } from '../lib/systemSettings';
import { logAdminAction } from './adminUtils';

export default function AdminStoreStatus({ lang, published = null }) {
  const ar = lang === 'ar';
  const { settings, loading, error: settingsError, saveSetting } = useSystemSettings();
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const store = settings.store;
  async function toggle() {
    if (saving || loading || settingsError) return;
    if (store.enabled && !window.confirm(ar ? 'إيقاف المتجر مؤقتًا؟ لن يتمكن العملاء من إتمام طلب جديد حتى إعادة التفعيل.' : 'Temporarily close the store? New checkout will be unavailable until reopened.')) return;
    setSaving(true);
    setFeedback(null);
    try {
      const { error } = await saveSetting('store', { ...store, enabled: !store.enabled });
      if (error) throw error;
      await logAdminAction('update_store_availability', 'system_setting', 'store', { enabled: !store.enabled });
      setFeedback({ type: 'success', text: ar ? 'تم حفظ حالة المتجر وتطبيقها.' : 'Store availability saved and applied.' });
    } catch {
      setFeedback({ type: 'error', text: ar ? 'تعذر حفظ حالة المتجر. حاول مجددًا.' : 'Could not save store availability. Please retry.' });
    } finally { setSaving(false); }
  }
  return <section className="admin-store-control admin-panel">
    <div className="admin-store-control-copy"><span className="admin-store-control-icon"><ShoppingBag size={25}/></span><div><small>{ar ? 'حالة المتجر' : 'STORE AVAILABILITY'}</small><h3>{loading ? (ar ? 'جاري المزامنة…' : 'Syncing…') : settingsError ? (ar ? 'تعذر التحقق من حالة المتجر' : 'Store status unavailable') : store.enabled ? (ar ? 'متجر بلقيس يستقبل الطلبات' : 'Balqees store is accepting orders') : (ar ? 'المتجر متوقف مؤقتًا' : 'Store is temporarily closed')}</h3><p>{published === null ? (ar ? 'راجع المنتجات والأسعار قبل النشر.' : 'Review products and pricing before publishing.') : (ar ? `${published} منتج منشور · الأسعار والمخزون من الكتالوج المركزي` : `${published} published products · Centralized pricing and stock`)}</p></div></div>
    <div className="admin-store-control-actions"><Link className="admin-secondary-button" to="/store" target="_blank" rel="noreferrer"><ExternalLink size={16}/>{ar ? 'معاينة المتجر' : 'Preview store'}</Link><Link className="admin-secondary-button" to="/admin/settings?tab=store">{ar ? 'سياسات المتجر' : 'Store policies'}<ArrowUpLeft size={15}/></Link><button className={store.enabled ? 'admin-secondary-button' : 'admin-primary-button'} onClick={toggle} disabled={saving || loading || !!settingsError}>{saving ? <LoaderCircle className="spin" size={16}/> : <ShieldCheck size={16}/>} {store.enabled ? (ar ? 'إيقاف مؤقت' : 'Close store') : (ar ? 'تفعيل المتجر' : 'Open store')}</button></div>
    {feedback && <div className={`admin-feedback ${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.text}</div>}
  </section>;
}
