const rank = { product: 4, category: 3, tag: 2, all: 1 };

export function isRuleLive(rule, at = new Date()) {
  const t = at.getTime();
  return !!rule?.is_active && (!rule.starts_at || new Date(rule.starts_at).getTime() <= t) && (!rule.ends_at || new Date(rule.ends_at).getTime() >= t);
}

export function ruleMatchesProduct(rule, product) {
  if (!rule || !product) return false;
  if (rule.scope === 'all') return true;
  if (rule.scope === 'product') return (rule.target_ids || []).includes(product.id);
  if (rule.scope === 'category') return !!product.category_id && (rule.target_ids || []).includes(product.category_id);
  if (rule.scope === 'tag') return (product.tags || []).some(tag => (rule.target_tags || []).includes(tag));
  return false;
}

export function applyPricingRule(price, rule) {
  const p = Number(price || 0), v = Number(rule?.value || 0);
  if (!rule) return p;
  if (rule.rule_type === 'percent') return Math.max(0, p * (1 - Math.min(v, 100) / 100));
  if (rule.rule_type === 'fixed') return Math.max(0, p - v);
  return Math.max(0, v);
}

export function resolveProductPrice(product, rules = [], now = new Date()) {
  if (!product || product.price_on_request) return { regular: null, effective: null, source: 'request', rule: null, onSale: false };
  const regular = Number(product.base_price || 0);
  const time = now.getTime();
  const manualLive = product.sale_price !== null && product.sale_price !== undefined && product.sale_price !== ''
    && (!product.sale_starts_at || new Date(product.sale_starts_at).getTime() <= time)
    && (!product.sale_ends_at || new Date(product.sale_ends_at).getTime() >= time);

  if (manualLive) {
    return { regular, effective: Number(product.sale_price), source: 'manual', rule: null, onSale: Number(product.sale_price) < regular };
  }
  if (product.exclude_auto_pricing) return { regular, effective: regular, source: 'regular', rule: null, onSale: false };

  const rule = [...rules]
    .filter(r => isRuleLive(r, now) && ruleMatchesProduct(r, product))
    .sort((a,b) => (rank[b.scope] - rank[a.scope]) || (Number(b.priority || 0) - Number(a.priority || 0)) || (new Date(b.created_at) - new Date(a.created_at)))[0] || null;
  if (!rule) return { regular, effective: regular, source: 'regular', rule: null, onSale: false };
  const effective = Number(applyPricingRule(regular, rule).toFixed(2));
  return { regular, effective, source: 'rule', rule, onSale: effective < regular };
}

export function formatSar(value, lang = 'ar') {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-SA', { style:'currency', currency:'SAR', maximumFractionDigits:2 }).format(Number(value || 0));
}
