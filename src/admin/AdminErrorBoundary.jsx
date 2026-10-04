import { Component } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ShieldAlert } from 'lucide-react';

export default class AdminErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    const ar = this.props.lang === 'ar';
    return <section className="admin-panel admin-recovery" role="alert">
      <ShieldAlert size={30}/><h2>{ar ? 'تعذر فتح هذا القسم' : 'This section could not open'}</h2>
      <p>{ar ? 'أعد تحميل الصفحة أو انتقل إلى لوحة القيادة لمتابعة العمل.' : 'Reload this page or return to the dashboard to continue.'}</p>
      <div><button className="admin-primary-button" onClick={() => window.location.reload()}><RefreshCw size={16}/>{ar ? 'إعادة تحميل' : 'Reload'}</button><Link className="admin-secondary-button" to="/admin">{ar ? 'لوحة القيادة' : 'Dashboard'}</Link></div>
    </section>;
  }
}
