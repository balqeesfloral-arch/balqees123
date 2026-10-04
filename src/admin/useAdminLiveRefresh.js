export { default } from '../lib/useLiveDataRefresh';

export function notifyAdminChange(table) {
  window.dispatchEvent(new CustomEvent('balqees:admin-data-updated', { detail: { table } }));
}
