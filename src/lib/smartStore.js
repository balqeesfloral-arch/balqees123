import { resolveProductPrice } from './storePricing';

export const SMART_STORE_OCCASIONS = Object.freeze({
  ramadan: { ar: 'رمضان', en: 'Ramadan', words: ['ramadan','رمضان'] },
  eid_fitr: { ar: 'عيد الفطر', en: 'Eid al-Fitr', words: ['eid fitr','fitr','عيد الفطر','فطر'] },
  eid_adha: { ar: 'عيد الأضحى', en: 'Eid al-Adha', words: ['eid adha','adha','عيد الاضحى','عيد الأضحى','اضحى','أضحى'] },
  hajj: { ar: 'الحج', en: 'Hajj', words: ['hajj','حج','الحج'] },
  wedding: { ar: 'زواج', en: 'Wedding', words: ['wedding','marriage','زواج','عرس','عروس','عريس'] },
  malka: { ar: 'مَلْكة', en: 'Malka', words: ['malka','nikah','ملكة','ملكه','عقد قران','عقد القران'] },
  engagement: { ar: 'خطبة', en: 'Engagement', words: ['engagement','خطبة','خطبه'] },
  return_from_travel: { ar: 'قدوم من سفر', en: 'Return from travel', words: ['return from travel','welcome back','travel','arrival','قدوم من سفر','عودة من سفر','عوده من سفر','ترحيب'] },
  usual_gift: { ar: 'هدية', en: 'Gift', words: ['gift','present','هدية','هديه','شكر','زيارة','زياره','ضيافة','ضيافه'] },
  new_baby: { ar: 'مولود جديد', en: 'New baby', words: ['new baby','newborn','baby','مولود','مواليد'] },
  graduation: { ar: 'تخرج', en: 'Graduation', words: ['graduation','graduate','تخرج','خريج','ماجستير','بكالوريوس','دكتوراه','ثانوي'] },
  party: { ar: 'حفلة', en: 'Party', words: ['party','celebration','حفلة','حفله','احتفال'] },
});

export const SMART_BUDGET_BANDS = Object.freeze([
  { key: 'under_150', ar: 'أقل من 150', en: 'Under 150', min: 0, max: 150 },
  { key: '150_250', ar: '150–250', en: '150–250', min: 150, max: 250 },
  { key: '250_350', ar: '250–350', en: '250–350', min: 250, max: 350 },
  { key: '350_500', ar: '350–500', en: '350–500', min: 350, max: 500 },
  { key: '500_plus', ar: '500+', en: '500+', min: 500, max: Infinity },
]);

export const SMART_STORE_STYLES = Object.freeze([
  { key: 'soft', ar: 'ناعم', en: 'Soft', words: ['soft','gentle','pastel','ناعم','هادئ','هادي','باستيل'] },
  { key: 'luxury', ar: 'فاخر', en: 'Luxury', words: ['luxury','luxurious','premium','elegant','فاخر','فخم','راقي'] },
  { key: 'simple', ar: 'بسيط', en: 'Simple', words: ['simple','minimal','clean','بسيط','مينيمال'] },
  { key: 'bold', ar: 'جريء', en: 'Bold', words: ['bold','dramatic','جريء','جريئ','قوي'] },
  { key: 'white', ar: 'أبيض', en: 'White', words: ['white','ivory','ابيض','أبيض','اوف وايت','أوف وايت'] },
  { key: 'red', ar: 'أحمر', en: 'Red', words: ['red','crimson','احمر','أحمر'] },
]);

const TYPE_WORDS = Object.freeze({
  bouquet: ['bouquet','flowers','flower','rose','roses','باقة','باقه','ورد','زهور'],
  gift: ['gift','present','هدية','هديه','هدية رئيسية','بوكس','box'],
  combo: ['bouquet gift','flowers gift','باقة وهدية','باقه وهديه','باقة + هدية','ورد وهدية','ورد وهديه'],
});

const SERVICE_WORDS = ['service','maintenance','landscape','garden','vase','planter','pot','تنسيق حدائق','صيانة','حديقة','حدائق','فازة','فازه','مركن','مراكن'];

export function normalizeSmartText(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}+\-\s]/gu, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function productSearchText(product, category) {
  return normalizeSmartText([
    product?.name_ar, product?.name_en,
    product?.short_description_ar, product?.short_description_en,
    product?.description_ar, product?.description_en,
    category?.name_ar, category?.name_en,
    ...(Array.isArray(product?.tags) ? product.tags : []),
  ].filter(Boolean).join(' '));
}

function hasAny(text, words = []) {
  const normalized = normalizeSmartText(text);
  return words.some(word => normalized.includes(normalizeSmartText(word)));
}

export function productKind(product, category) {
  const text = productSearchText(product, category);
  const bouquet = hasAny(text, TYPE_WORDS.bouquet);
  const gift = hasAny(text, TYPE_WORDS.gift);
  if (hasAny(text, TYPE_WORDS.combo) || (bouquet && gift)) return 'combo';
  if (bouquet) return 'bouquet';
  if (gift) return 'gift';
  return 'other';
}

export function isGiftAssistantProduct(product, category) {
  const text = productSearchText(product, category);
  return !SERVICE_WORDS.some(word => text.includes(normalizeSmartText(word))) && ['bouquet','gift','combo'].includes(productKind(product, category));
}

export function productAvailability(product) {
  if (!product?.is_active || product?.visibility !== 'public') return 'unavailable';
  if (product.stock_mode === 'tracked' || product.stock_mode === 'stock' || product.stock_mode === 'inventory') {
    return Number(product.stock_quantity || 0) > 0 ? 'ready' : 'unavailable';
  }
  if (product.stock_mode === 'made_to_order') return 'made_to_order';
  return 'available';
}

export function extractSmartSearchIntent(rawQuery = '') {
  const text = normalizeSmartText(rawQuery);
  const intent = {
    raw: rawQuery,
    text,
    occasion: null,
    kind: null,
    style: null,
    excludeStyles: [],
    budgetMax: null,
    budgetMin: null,
    offersOnly: false,
    availability: null,
    freeTerms: [],
  };
  if (!text) return intent;

  Object.entries(SMART_STORE_OCCASIONS).some(([key, meta]) => {
    if (hasAny(text, meta.words)) { intent.occasion = key; return true; }
    return false;
  });

  if (hasAny(text, TYPE_WORDS.combo)) intent.kind = 'combo';
  else if (hasAny(text, TYPE_WORDS.bouquet)) intent.kind = 'bouquet';
  else if (hasAny(text, TYPE_WORDS.gift)) intent.kind = 'gift';

  for (const style of SMART_STORE_STYLES) {
    const matchedWord = style.words.find(word => text.includes(normalizeSmartText(word)));
    if (!matchedWord) continue;
    const negative = new RegExp(`(?:ما ابغا|ما ابي|بدون|لا اريد|لا ابغا|no|without)\\s+[^ ]*${normalizeSmartText(matchedWord).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`);
    if (negative.test(text)) intent.excludeStyles.push(style.key);
    else if (!intent.style) intent.style = style.key;
  }

  const numbers = [...text.matchAll(/(?:^|\s)(\d{2,6})(?:\s|$)/g)].map(match => Number(match[1])).filter(Number.isFinite);
  const firstNumber = numbers[0];
  if (firstNumber) {
    if (/(اقل من|تحت|حد اقصي|حد اقصى|under|max|up to)/.test(text)) intent.budgetMax = firstNumber;
    else if (/(فوق|اكثر من|اكثر|above|over|min)/.test(text)) intent.budgetMin = firstNumber;
    else if (/(ميزانيتي|ميزانيه|حدود|حوالي|تقريب|budget|around|about)/.test(text)) intent.budgetMax = firstNumber;
  }
  intent.offersOnly = /(عرض|عروض|خصم|تخفيض|offer|sale|discount)/.test(text);
  if (/(جاهز|متوفر الان|متوفر الآن|ready|in stock)/.test(text)) intent.availability = 'ready';
  if (/(حسب الطلب|يصنع|تجهيز|made to order)/.test(text)) intent.availability = 'made_to_order';

  const stop = new Set([
    'ابغا','ابي','اريد','شي','شيء','حاجه','حاجة','لي','من','في','على','و','او','تقريبا','تقريب','حدود','ميزانيتي','تحت','اقل','اكثر','فوق','بدون','ما','لا',
    'i','want','need','a','an','the','for','with','or','around','about','budget','under','over','without','no',
  ]);
  intent.freeTerms = text.split(' ').filter(token => token.length > 1 && !stop.has(token) && !/^\d+$/.test(token));
  return intent;
}

export function budgetBandMatch(price, key) {
  if (price === null || price === undefined || !key || key === 'all') return true;
  const band = SMART_BUDGET_BANDS.find(item => item.key === key);
  if (!band) return true;
  return Number(price) >= band.min && Number(price) <= band.max;
}

export function productMatchesOccasion(product, category, occasionKey) {
  if (!occasionKey || occasionKey === 'all') return true;
  const meta = SMART_STORE_OCCASIONS[occasionKey];
  if (!meta) return true;
  return hasAny(productSearchText(product, category), meta.words);
}

export function productMatchesStyle(product, category, styleKey) {
  if (!styleKey || styleKey === 'all') return true;
  const style = SMART_STORE_STYLES.find(item => item.key === styleKey);
  if (!style) return true;
  return hasAny(productSearchText(product, category), style.words);
}

export function productIsOnOffer(product, rules = []) {
  const pricing = resolveProductPrice(product, rules);
  return !!pricing.onSale || !!pricing.rule;
}

export function scoreProductForIntent(product, category, rules, intent = {}) {
  const text = productSearchText(product, category);
  const pricing = resolveProductPrice(product, rules);
  const price = pricing.effective;
  let score = 0;
  if (intent.occasion) {
    const meta = SMART_STORE_OCCASIONS[intent.occasion];
    meta?.words?.forEach(word => { if (text.includes(normalizeSmartText(word))) score += 12; });
  }
  if (intent.kind) {
    const kind = productKind(product, category);
    if (kind === intent.kind) score += 11;
    else if (intent.kind === 'combo' && (kind === 'bouquet' || kind === 'gift')) score += 3;
  }
  if (intent.style && productMatchesStyle(product, category, intent.style)) score += 8;
  (intent.excludeStyles || []).forEach(style => { if (productMatchesStyle(product, category, style)) score -= 30; });
  if (Number.isFinite(Number(intent.budgetMax)) && price !== null && price !== undefined) {
    const max = Number(intent.budgetMax);
    if (Number(price) <= max) score += 8 + Math.max(0, 4 - Math.abs(max - Number(price)) / Math.max(max,1) * 4);
    else score -= 16;
  }
  if (Number.isFinite(Number(intent.budgetMin)) && price !== null && price !== undefined) {
    if (Number(price) >= Number(intent.budgetMin)) score += 5; else score -= 9;
  }
  if (intent.offersOnly && productIsOnOffer(product, rules)) score += 10;
  if (intent.availability && productAvailability(product) === intent.availability) score += 7;
  for (const term of intent.freeTerms || []) if (text.includes(term)) score += 2.5;
  return score;
}

function addWeight(map, key, amount) {
  if (!key) return;
  map.set(String(key), (map.get(String(key)) || 0) + amount);
}

function weightedMedian(values = []) {
  const rows = values.filter(x => Number.isFinite(x.value) && x.value > 0 && x.weight > 0).sort((a,b)=>a.value-b.value);
  const total = rows.reduce((sum,x)=>sum+x.weight,0);
  if (!total) return null;
  let running = 0;
  for (const row of rows) { running += row.weight; if (running >= total/2) return row.value; }
  return rows.at(-1)?.value ?? null;
}

export function buildTasteProfile({ products = [], categories = [], interests = [], favorites = [], cartItems = [], orders = [], personalized = true }) {
  const productById = new Map(products.map(product => [String(product.id), product]));
  const categoryById = new Map(categories.map(category => [String(category.id), category]));
  const productWeights = new Map();
  const categoryWeights = new Map();
  const tagWeights = new Map();
  const priceSignals = [];
  const viewCounts = new Map();

  if (!personalized) return { enabled:false, hasSignals:false, productWeights, categoryWeights, tagWeights, preferredPrice:null, recentViewIds:[] };

  const learn = (productId, weight, price = null) => {
    const product = productById.get(String(productId));
    if (!product) return;
    addWeight(productWeights, product.id, weight);
    addWeight(categoryWeights, product.category_id, weight * .72);
    (product.tags || []).forEach(tag => addWeight(tagWeights, normalizeSmartText(tag), weight * .48));
    const category = categoryById.get(String(product.category_id));
    if (category?.name_ar) addWeight(tagWeights, normalizeSmartText(category.name_ar), weight * .2);
    if (category?.name_en) addWeight(tagWeights, normalizeSmartText(category.name_en), weight * .2);
    if (price !== null && price !== undefined && Number(price) > 0) priceSignals.push({ value:Number(price), weight });
  };

  for (const order of orders) {
    if (!['delivered','completed'].includes(order.status)) continue;
    for (const item of order.order_items || []) learn(item.product_id, 12 * Math.min(Math.max(Number(item.quantity || 1),1),3), Number(item.unit_price || 0));
  }
  for (const item of cartItems || []) learn(item.product_id, 9, Number(item.unit_price_snapshot || 0));
  for (const favorite of favorites || []) learn(favorite.product_id, 7, Number(favorite.unit_price_snapshot || 0));

  for (const event of interests || []) {
    const id = event.product_id ? String(event.product_id) : null;
    if (event.event_type === 'view' && id) viewCounts.set(id,(viewCounts.get(id)||0)+1);
    const base = event.event_type === 'purchase' ? 12 : event.event_type === 'cart_add' ? 9 : event.event_type === 'favorite' ? 7 : event.event_type === 'search' ? 3 : event.event_type === 'view' ? 1.25 : 0;
    if (id && base) learn(id, base);
    if (event.category_id && base) addWeight(categoryWeights,event.category_id,base*.65);
    if (event.search_query && base) normalizeSmartText(event.search_query).split(' ').filter(x=>x.length>2).forEach(term=>addWeight(tagWeights,term,base*.28));
  }
  for (const [id,count] of viewCounts.entries()) if (count > 1) learn(id, Math.min(5,(count-1)*1.25));

  const recentViewIds = [];
  const cutoff = Date.now() - 7*24*60*60*1000;
  for (const event of interests) {
    if (event.event_type !== 'view' || !event.product_id || new Date(event.created_at).getTime() < cutoff) continue;
    const id = String(event.product_id); if (!recentViewIds.includes(id)) recentViewIds.push(id);
    if (recentViewIds.length >= 8) break;
  }

  return {
    enabled:true,
    hasSignals: productWeights.size > 0 || categoryWeights.size > 0 || tagWeights.size > 0,
    productWeights, categoryWeights, tagWeights,
    preferredPrice: weightedMedian(priceSignals),
    recentViewIds,
  };
}

export function tasteScore(product, category, rules, taste) {
  if (!taste?.enabled || !taste?.hasSignals) return 0;
  let score = (taste.productWeights.get(String(product.id)) || 0) * .35;
  score += (taste.categoryWeights.get(String(product.category_id)) || 0) * .52;
  const text = productSearchText(product, category);
  for (const [tag,weight] of taste.tagWeights.entries()) if (tag && text.includes(tag)) score += Math.min(8,weight*.45);
  const price = resolveProductPrice(product,rules).effective;
  if (taste.preferredPrice && price !== null && price !== undefined) {
    const delta = Math.abs(Number(price)-taste.preferredPrice) / Math.max(taste.preferredPrice,1);
    score += Math.max(0,5-delta*8);
  }
  return score;
}

export function occasionLabel(key, ar = true) {
  return SMART_STORE_OCCASIONS[key]?.[ar ? 'ar' : 'en'] || key || '';
}
