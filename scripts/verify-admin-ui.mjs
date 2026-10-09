// Isolated UI fixtures: all Auth/REST traffic goes to a fictitious Supabase host.
// Live Supabase permissions and atomic saves are verified separately in SQL.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { ADMIN_NAV, CONNECTED_PAGES } from '../src/admin/adminNavigation.js';

const origin = 'http://127.0.0.1:5189';
const api = 'https://balqees-ui-test.supabase.co';
const userId = '00000000-0000-4000-8000-000000000010';
const p1 = '00000000-0000-4000-8000-000000000001';
const p2 = '00000000-0000-4000-8000-000000000002';
const orderId = '00000000-0000-4000-8000-000000000020';
const created = '2026-10-01T10:00:00Z';
const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'admin@example.test', app_metadata: { role: 'admin' }, user_metadata: { full_name: 'مدير بلقيس' }, factors: [], created_at: created };
const base = { category_id: null, name_en: 'Test bouquet', short_description_ar: '', description_ar: '', description_en: '', base_price: 220, sale_price: null, price_on_request: false, stock_mode: 'made_to_order', stock_quantity: 0, min_order_quantity: 1, max_order_quantity: null, unit_ar: 'قطعة', unit_en: 'piece', gallery: [], tags: [], is_active: true, is_featured: false, exclude_auto_pricing: false, visibility: 'public', created_at: created, updated_at: created };
const fixtures = {
  quote_requests: [],
  products: [
    { ...base, id: p1, sku: 'TEST-1', slug: 'test-white-bouquet', name_ar: 'باقة اختبار بيضاء', image_url: '/assets/home/floral-signature.webp' },
    { ...base, id: p2, sku: 'TEST-2', slug: 'test-plant', name_ar: 'نبتة اختبار', image_url: null, visibility: 'draft', stock_mode: 'tracked', stock_quantity: 0 },
  ],
  product_costs: [{ product_id: p1, cost_price: 90, target_margin_percent: 35, low_stock_threshold: 3 }],
  product_categories: [], price_rules: [],
  customer_profiles: [{ id: userId, full_name: 'مدير بلقيس', email: 'admin@example.test', account_type: 'company', created_at: created }],
  admin_user_state: [{ user_id: userId, status: 'active' }],
  orders: [{ id: orderId, order_number: 87, user_id: userId, organization_id: null, status: 'pending', payment_status: 'unpaid', total: 220, subtotal: 220, vat_total: 0, discount_total: 0, created_at: created }],
  system_settings: [
    { key: 'store', is_public: true, value: { enabled: true, guestBrowse: true, guestCart: true, showPrices: true, pricesIncludeVat: true, vatRate: 15, currency: 'SAR', allowCoupons: true, minimumOrder: 0, paymentMethod: 'cash_on_delivery', codReviewAbove: 1000 }, updated_at: created },
    { key: 'admin_ui', is_public: false, value: { sidebar: 'expanded', fontScale: 1 }, updated_at: created },
  ],
};
let saveCount = 0;
let failureTable = '';
let rejectSave = false;
let rejectQuote = false, quoteSubmissions = 0;
let whatsappDraftOpens=0;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5189', '--strictPort'], { env: { ...process.env, VITE_PUBLIC_SITE_URL:origin, VITE_SUPABASE_URL: api, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_ui_fixture' }, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', value => { serverLog += value; });
server.stderr.on('data', value => { serverLog += value; });
let browser;
const screenshots = path.resolve('preview/admin');
fs.mkdirSync(screenshots, { recursive: true });
const errors = [];

function filterRows(rows, params) {
  return rows.filter(row => [...params].every(([key, value]) => {
    if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
    if (value.startsWith('neq.')) return String(row[key]) !== value.slice(4);
    if (value.startsWith('lte.')) return Number(row[key]) <= Number(value.slice(4));
    if (value === 'is.null') return row[key] == null;
    if (value.startsWith('in.(')) return value.slice(4, -1).replaceAll('"', '').split(',').includes(String(row[key]));
    return true;
  }));
}
async function contextFor({ role = 'admin', claimedRole = role, blocked = false, mfa = false, signedIn = role!=='guest' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
  const claims = { sub: userId, role: 'authenticated', aal: 'aal1', amr: [{ method: 'password', timestamp: 1 }], exp: Math.floor(Date.now() / 1000) + 7200, app_metadata: { role: claimedRole } };
  const token = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify(claims)).toString('base64url'), 'fixture'].join('.');
  await context.route(`${api}/**`, async route => {
    const request = route.request(), url = new URL(request.url());
    const response = (body, status = 200, headers = {}) => route.fulfill({ status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Range', ...headers }, body: request.method() === 'HEAD' ? '' : JSON.stringify(body) });
    if (url.pathname.startsWith('/auth/')) {
      const authUser={ ...user, app_metadata: { role }, factors: mfa ? [{ factor_type: 'totp', status: 'verified' }] : [] };
      return response(url.pathname.endsWith('/token')?{access_token:token,refresh_token:'fixture',token_type:'bearer',expires_in:7200,user:authUser}:authUser);
    }
    const table = url.pathname.split('/').at(-1);
    if (url.pathname.includes('/rpc/')) {
      if(table==='submit_quote_request') {
        quoteSubmissions++;
        if(rejectQuote)return response({code:'PGRST000',message:'Fixture outage'},503);
        const body=request.postDataJSON().p_request;
        const existing=fixtures.quote_requests.find(r=>r.request_token===body.request_token);
        if(existing)return response(existing);
        const row={...body,id:crypto.randomUUID(),user_id:userId,request_number:fixtures.quote_requests.length+1,status:'submitted',created_at:created,updated_at:created,product_snapshot:body.items.map(item=>({...fixtures.products.find(p=>p.id===item.product_id),product_id:item.product_id,quantity:item.quantity}))};
        fixtures.quote_requests.unshift(row);await new Promise(resolve=>setTimeout(resolve,100));return response(row);
      }
      if(table==='admin_review_quote_request') {
        const body=request.postDataJSON(),row=fixtures.quote_requests.find(r=>r.id===body.p_id);
        Object.assign(row,{status:body.p_status,admin_reply:body.p_reply,quote_amount:body.p_amount,quote_valid_until:body.p_valid_until,updated_at:new Date().toISOString()});return response(row);
      }
      if(table==='preview_customer_cart') {
        const body=request.postDataJSON();const items=body.p_items.map(item=>({...item,unit_price:fixtures.products.find(p=>p.id===item.product_id)?.price_on_request?null:100,line_total:100}));
        return response({items,has_quote_items:items.some(item=>fixtures.products.find(p=>p.id===item.product_id)?.price_on_request),subtotal:100,total:100,vat_total:0,discount_total:0});
      }
      if (table === 'admin_save_product') {
        if (rejectSave) return response({ code: '23505', message: 'duplicate slug' }, 409);
        const body = request.postDataJSON();
        const id = body.p_id || crypto.randomUUID();
        const product = { ...base, ...body.p_product, id };
        fixtures.products = [...fixtures.products.filter(row => row.id !== id), product];
        fixtures.product_costs = [...fixtures.product_costs.filter(row => row.product_id !== id), { ...body.p_cost, product_id: id }];
        saveCount++;
        return response(product);
      }
      if (table === 'admin_get_notification_operations_v1') return response({ notifications: [], deliveries: [], metrics: {} });
      return response([]);
    }
    if (failureTable === table) return response({ code: 'PGRST000', message: 'Fixture outage' }, 503);
    if (table === 'admin_user_state') { const state = { user_id: userId, status: blocked ? 'blocked' : 'active' }; return response(request.headers().accept?.includes('object') ? state : [state]); }
    if(table==='customer_profiles'&&role==='customer') {
      const profile={...fixtures.customer_profiles[0],account_type:'individual',full_name:'عميل بلقيس',phone:'0500000000'};
      return response(request.headers().accept?.includes('object')?profile:[profile]);
    }
    if (request.method() === 'POST' && table === 'system_settings') {
      const body = request.postDataJSON();
      fixtures.system_settings = [...fixtures.system_settings.filter(row => row.key !== body.key), body];
      return response(body);
    }
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON();
      const targets = filterRows(fixtures[table] || [], url.searchParams);
      targets.forEach(row => Object.assign(row, body));
      return response(request.headers().accept?.includes('object') ? targets[0] || null : targets);
    }
    if (request.method() === 'DELETE') {
      const targets = filterRows(fixtures[table] || [], url.searchParams);
      fixtures[table] = (fixtures[table] || []).filter(row => !targets.includes(row));
      return response(request.headers().accept?.includes('object') ? targets[0] || null : targets);
    }
    if (request.method() === 'POST') return response(request.headers().accept?.includes('object') ? request.postDataJSON() : []);
    const rows = filterRows(fixtures[table] || [], url.searchParams);
    const count = rows.length;
    const limited = url.searchParams.has('limit') ? rows.slice(0, Number(url.searchParams.get('limit'))) : rows;
    return response(request.headers().accept?.includes('object') ? limited[0] || null : limited, 200, { 'Content-Range': `${count ? '0-' + (count - 1) : '*'}/${count}` });
  });
  await context.route('https://balqees-smart-office.vercel.app/api/portal', route => route.fulfill({status:503,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'},body:JSON.stringify({ok:false,error:'ربط المكتب بالموقع لم يُفعّل بعد.'})}));
  await context.route('https://wa.me/**',route=>{whatsappDraftOpens++;return route.fulfill({contentType:'text/html',body:'<main>Isolated WhatsApp draft fixture</main>'});});
  await context.routeWebSocket(`${api.replace('https', 'wss')}/**`, socket => {
    socket.onMessage(message => {
      const [join, ref, topic, event] = JSON.parse(String(message));
      socket.send(JSON.stringify([join, ref, topic, 'phx_reply', { status: 'ok', response: event === 'phx_join' ? { postgres_changes: [] } : {} }]));
    });
  });
  if (signedIn) {
    await context.addInitScript(({ token, user, role, mfa }) => {
      if (location.protocol !== 'http:') return;
      localStorage.setItem('balqees-lang', 'ar');
      localStorage.setItem('sb-balqees-ui-test-auth-token', JSON.stringify({ access_token: token, refresh_token: 'fixture', token_type: 'bearer', expires_in: 7200, expires_at: Math.floor(Date.now() / 1000) + 7200, user: { ...user, app_metadata: { role }, factors: mfa ? [{ factor_type: 'totp', status: 'verified' }] : [] } }));
    }, { token, user, role: claimedRole, mfa });
  }
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return { context, page };
}
async function open(page, route = '/admin') {
  await page.goto(origin + route);
  await page.locator('.admin-app').waitFor({ timeout: 15000 });
  await page.waitForTimeout(180);
  assert.equal(await page.locator('.admin-recovery').count(), 0, `${route} entered recovery`);
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* wait for server */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, serverLog);
  browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || undefined, headless: true, args: process.env.CHROME_EXECUTABLE ? ['--no-sandbox', '--no-zygote', '--single-process', '--disable-dev-shm-usage'] : [] });
  const { context, page } = await contextFor();
  await open(page);
  await page.getByText('متصل ببيانات النظام', { exact: true }).waitFor();
  assert.equal(await page.locator('.admin-stat-card').filter({ hasText: 'منتجات منشورة' }).locator('strong').innerText(), '١');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1050 });
    await page.waitForTimeout(100);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Dashboard overflow at ${width}px`);
    await page.screenshot({ path: path.join(screenshots, `dashboard-${width}.png`), fullPage: true });
  }
  await page.getByRole('button', { name: 'فتح قائمة الإدارة' }).click();
  await page.locator('.admin-sidebar.mobile-open').waitFor();
  await page.getByRole('link', { name: 'مركز الصفحات', exact: true }).click();
  await page.locator('.admin-sidebar.mobile-open').waitFor({ state: 'detached' });
  await page.setViewportSize({ width: 1440, height: 1050 });
  assert.equal(await page.locator('.admin-hub-card').count(), CONNECTED_PAGES.length);
  await page.getByRole('textbox', { name: 'ابحث في الصفحات' }).fill('المستندات');
  assert.ok(await page.locator('.admin-hub-card').count() > 0);
  await page.getByRole('textbox', { name: 'ابحث في الصفحات' }).fill('');
  await page.screenshot({ path: path.join(screenshots, 'page-hub.png'), fullPage: true });

  for (const item of ADMIN_NAV) await open(page, item.path);
  console.log(`PASS: ${ADMIN_NAV.length} admin routes and ${CONNECTED_PAGES.length} connected pages`);
  await open(page, '/admin');
  await page.getByRole('link', { name: 'إضافة منتج', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'إضافة منتج', exact: true });
  await dialog.waitFor();
  await dialog.getByLabel('اسم المنتج بالعربية', { exact: true }).fill('منتج اختبار جديد');
  await dialog.getByLabel('اسم المنتج بالإنجليزية', { exact: true }).fill('New test product');
  await dialog.getByLabel('سعر البيع الأساسي', { exact: false }).fill('200');
  rejectSave = true;
  await dialog.getByRole('button', { name: 'حفظ المنتج', exact: true }).click();
  await dialog.getByText(/مستخدم بالفعل/).waitFor();
  assert.equal(saveCount, 0);
  rejectSave = false;
  await dialog.getByRole('button', { name: 'حفظ المنتج', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(saveCount, 1);
  await page.locator('tr').filter({ hasText: 'منتج اختبار جديد' }).getByRole('button', { name: 'نشر المنتج', exact: true }).click();
  assert.ok(fixtures.products.find(row => row.name_ar === 'منتج اختبار جديد')?.visibility === 'public');
  console.log('PASS: add-product task, failed-save recovery and publishing');
  await open(page,'/admin/catalog?new=product');
  const unpricedDialog=page.getByRole('dialog',{name:'إضافة منتج',exact:true});await unpricedDialog.waitFor();
  await unpricedDialog.getByLabel('اسم المنتج بالعربية',{exact:true}).fill('شجرة اختبار بعرض سعر');
  await unpricedDialog.getByLabel('اسم المنتج بالإنجليزية',{exact:true}).fill('QA quotation tree');
  await unpricedDialog.locator('.admin-pricing-choice button').filter({hasText:'طلب عرض سعر'}).click();
  assert.equal(await unpricedDialog.getByLabel('سعر البيع الأساسي',{exact:false}).isDisabled(),true);
  assert.equal(await unpricedDialog.locator('.profit-preview').count(),0);
  await unpricedDialog.getByRole('button',{name:'حفظ المنتج',exact:true}).click();await unpricedDialog.waitFor({state:'hidden'});
  const quoteProduct=fixtures.products.find(p=>p.name_ar==='شجرة اختبار بعرض سعر');
  assert.ok(quoteProduct.price_on_request);assert.equal(quoteProduct.base_price,null);
  console.log('PASS: quotation pricing mode saves without a selling price or phantom profit');

  await open(page, '/admin/catalog?edit=' + p1);
  await page.getByRole('dialog', { name: 'تعديل المنتج' }).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  await open(page, '/admin/orders?order=' + orderId);
  await page.locator('.admin-order-center-drawer').waitFor();
  await open(page, '/admin/settings?tab=store');
  assert.ok((await page.locator('.settings-v2-shell').innerText()).includes('ضريبة'));
  await open(page, '/admin');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'إيقاف مؤقت', exact: true }).click();
  await page.getByRole('heading', { name: 'المتجر متوقف مؤقتًا', exact: true }).waitFor();
  assert.equal(fixtures.system_settings.find(row => row.key === 'store').value.codReviewAbove, 1000);
  await page.getByRole('button', { name: 'تفعيل المتجر', exact: true }).click();
  await page.getByRole('heading', { name: 'متجر بلقيس يستقبل الطلبات', exact: true }).waitFor();
  console.log('PASS: product/order deep links, settings tabs and store availability');

  failureTable = 'products';
  await page.getByRole('button', { name: 'تحديث', exact: true }).click();
  await page.getByText('بعض البيانات غير متاحة', { exact: true }).waitFor();
  assert.equal(await page.locator('.admin-stat-card').filter({ hasText: 'منتجات منشورة' }).locator('strong').innerText(), '—');
  failureTable = '';
  await page.getByRole('button', { name: 'تحديث', exact: true }).click();
  await page.getByText('متصل ببيانات النظام', { exact: true }).waitFor();
  console.log('PASS: outages display unavailable values and recover after retry');
  assert.deepEqual(errors, []);
  await context.close();

  for (const options of [{ role: 'guest' }, { role: 'customer' }, { role: 'customer', claimedRole: 'admin' }, { role: 'admin', blocked: true }, { role: 'admin', mfa: true }]) {
    await browser.close();
    browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || undefined, headless: true, args: process.env.CHROME_EXECUTABLE ? ['--no-sandbox', '--no-zygote', '--single-process', '--disable-dev-shm-usage'] : [] });
    const scenario = await contextFor(options);
    await scenario.page.goto(origin + '/admin');
    if (!options.mfa) await scenario.page.locator('.admin-gate-screen').waitFor();
    await scenario.page.waitForTimeout(500);
    assert.equal(await scenario.page.locator('.admin-app').count(), 0, `Unauthorized scenario ${JSON.stringify(options)}`);
    await scenario.context.close();
  }
  console.log('PASS: guest, customer, spoofed metadata, blocked administrator and MFA gates');
  assert.deepEqual(errors, []);
  await browser.close();
  browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || undefined, headless: true, args: process.env.CHROME_EXECUTABLE ? ['--no-sandbox', '--no-zygote', '--single-process', '--disable-dev-shm-usage'] : [] });
  const guest = await contextFor({ role: 'guest' });
  await guest.page.goto(origin + '/store');
  await guest.page.locator('.store-grid').waitFor();
  await guest.page.getByRole('button', { name: 'إضافة', exact: true }).first().click();
  await guest.page.locator('.store-cart-drawer').waitFor();
  await guest.page.goto(origin + '/store/test-white-bouquet');
  await guest.page.getByRole('heading', { name: 'باقة اختبار بيضاء', exact: true }).waitFor();
  fixtures.system_settings.find(row => row.key === 'store').value.enabled = false;
  await guest.page.reload();
  await guest.page.getByRole('heading', { name: 'المتجر متوقف مؤقتًا', exact: true }).waitFor();
  fixtures.system_settings.find(row => row.key === 'store').value.enabled = true;
  await guest.context.close();
  assert.deepEqual(errors, []);
  console.log('PASS: guest storefront, cart, product details and closed-store policy');
  await browser.close();
  browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||undefined,headless:true,args:process.env.CHROME_EXECUTABLE?['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage']:[]});
  const quoteGuest=await contextFor({role:'guest'});
  await quoteGuest.page.goto(origin+'/services');
  await quoteGuest.page.locator('.services-contract-grid a').filter({hasText:'عقد الورد الأسبوعي'}).click();
  await quoteGuest.page.locator('.rfq-form').waitFor();
  assert.match(quoteGuest.page.url(),/service=weekly_flowers/);
  await quoteGuest.page.getByLabel('المدينة والموقع',{exact:true}).fill('مكة — موقع اختبار');
  await quoteGuest.page.getByRole('link',{name:'تسجيل الدخول لإرسال الطلب',exact:true}).waitFor();
  const loginLink=await quoteGuest.page.getByRole('link',{name:'تسجيل الدخول لإرسال الطلب',exact:true}).getAttribute('href');
  assert.equal(new URL(loginLink,origin).searchParams.get('next'),'/request-quote?service=weekly_flowers');
  assert.equal(quoteSubmissions,0);
  await quoteGuest.context.close();await browser.close();
  browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||undefined,headless:true,args:process.env.CHROME_EXECUTABLE?['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage']:[]});
  const customer=await contextFor({role:'customer'});
  await customer.page.goto(origin+'/account?next='+encodeURIComponent('/request-quote?service=weekly_flowers'));
  await customer.page.locator('.rfq-form').waitFor();
  await customer.page.getByLabel('المدينة والموقع',{exact:true}).fill('مكة — استقبال المنشأة');
  await customer.page.getByLabel('تفاصيل الاحتياج',{exact:true}).fill('عقد ورد أسبوعي لثلاث فازات في استقبال المنشأة لمدة ستة أشهر.');
  await customer.page.getByLabel('مدة العقد بالأشهر (اختياري)',{exact:true}).fill('6');
  await customer.page.getByLabel('اسم جهة التواصل',{exact:true}).fill('عميل بلقيس');
  await customer.page.getByLabel('رقم الجوال',{exact:true}).fill('0500000000');
  for(const width of [1440,390,320]){
    await customer.page.setViewportSize({width,height:1050});
    assert.ok(await customer.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`RFQ form overflow at ${width}px`);
    await customer.page.screenshot({path:path.join(screenshots,`quotation-form-${width}.png`),fullPage:true});
  }
  await customer.page.setViewportSize({width:1440,height:1050});
  rejectQuote=true;
  await customer.page.getByRole('button',{name:'إرسال طلب عرض السعر',exact:true}).click();await customer.page.locator('.rfq-error').waitFor();
  rejectQuote=false;const before=quoteSubmissions;
  await customer.page.locator('.rfq-form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
  await customer.page.getByRole('heading',{name:'وصل طلبك إلى إدارة بلقيس',exact:true}).waitFor();
  assert.equal(quoteSubmissions,before+1);assert.equal(fixtures.quote_requests[0].service_type,'weekly_flowers');
  const rfqId=fixtures.quote_requests[0].id;
  const serviceDraft=new URL(await customer.page.locator('.rfq-success .rfq-whatsapp-button').getAttribute('href')).searchParams.get('text');
  assert.ok(serviceDraft.includes('عقد الورد الأسبوعي'));assert.ok(serviceDraft.includes('6 شهر'));assert.ok(serviceDraft.includes('/admin/quote-requests?request='+rfqId));
  assert.equal(whatsappDraftOpens,0,'Saving a request must not open or send WhatsApp');
  await customer.page.goto(origin+'/request-quote?product='+p1+'&quantity=2');
  await customer.page.locator('.rfq-products article').waitFor();
  await customer.page.getByLabel('المدينة والموقع',{exact:true}).fill('مكة');
  await customer.page.getByLabel('تفاصيل الاحتياج',{exact:true}).fill('أرغب في عرض سعر للكميات المختارة مع التوريد للموقع.');
  await customer.page.getByLabel('رقم الجوال',{exact:true}).fill('0500000000');
  await customer.page.getByRole('button',{name:'إرسال طلب عرض السعر',exact:true}).click();
  await customer.page.getByRole('heading',{name:'وصل طلبك إلى إدارة بلقيس',exact:true}).waitFor();
  assert.equal(fixtures.quote_requests[0].items[0].quantity,2);
  fixtures.products.find(p=>p.id===p1).price_on_request=true;
  quoteProduct.visibility='public';
  await customer.page.evaluate(({userId,p1,p2})=>localStorage.setItem('balqees-store-cart-v1:'+userId,JSON.stringify([{product_id:p1,quantity:2},{product_id:p2,quantity:3}])),{userId,p1,p2:quoteProduct.id});
  await customer.page.goto(origin+'/account/cart');
  await customer.page.getByRole('button',{name:'متابعة لطلب التسعير',exact:true}).waitFor();
  await customer.page.getByRole('button',{name:'متابعة لطلب التسعير',exact:true}).click();
  await customer.page.locator('.rfq-form').waitFor();assert.match(customer.page.url(),/request-quote\?source=cart/);
  assert.equal(await customer.page.locator('.rfq-form .rfq-products article').count(),2);
  await customer.page.getByLabel('المدينة والموقع',{exact:true}).fill('مكة — طلب منتجات كامل');
  await customer.page.getByLabel('تفاصيل الاحتياج',{exact:true}).fill('تسعير كل المنتجات المختارة مع التوريد للموقع.');
  await customer.page.getByLabel('رقم الجوال',{exact:true}).fill('0500000000');
  await customer.page.getByRole('button',{name:'إرسال طلب عرض السعر',exact:true}).click();
  await customer.page.locator('.rfq-success .rfq-whatsapp-button').waitFor();
  const cartRfq=fixtures.quote_requests[0];
  assert.equal(cartRfq.product_snapshot.length,2);
  const cartDraft=new URL(await customer.page.locator('.rfq-success .rfq-whatsapp-button').getAttribute('href')).searchParams.get('text');
  assert.ok(cartDraft.includes('باقة اختبار بيضاء [TEST-1] — 2 قطعة'));
  assert.ok(cartDraft.includes('شجرة اختبار بعرض سعر')&&cartDraft.includes('— 3 قطعة'));
  for(const width of [1440,390,320]){
    await customer.page.setViewportSize({width,height:1050});
    assert.ok(await customer.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`WhatsApp handoff overflow at ${width}px`);
    await customer.page.screenshot({path:path.join(screenshots,`quotation-whatsapp-${width}.png`),fullPage:true});
  }
  const popupPromise=customer.context.waitForEvent('page');
  await customer.page.locator('.rfq-success .rfq-whatsapp-button').click();
  const popup=await popupPromise;await popup.waitForLoadState();
  assert.equal(new URL(popup.url()).searchParams.get('text'),cartDraft);
  assert.equal(whatsappDraftOpens,1);assert.equal(cartRfq.status,'submitted');
  await popup.close();
  await customer.page.reload();
  await customer.page.locator(`#rfq-${cartRfq.id} .rfq-whatsapp-button`).waitFor();
  assert.equal(new URL(await customer.page.locator(`#rfq-${cartRfq.id} .rfq-whatsapp-button`).getAttribute('href')).searchParams.get('text'),cartDraft);
  await customer.context.close();await browser.close();
  browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||undefined,headless:true,args:process.env.CHROME_EXECUTABLE?['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage']:[]});
  const reviewer=await contextFor();await open(reviewer.page,'/admin/quote-requests?request='+rfqId);
  await reviewer.page.locator('.admin-rfq-detail form').waitFor();
  await reviewer.page.getByRole('button',{name:'تسجيل عرض السعر',exact:true}).click();
  assert.equal(await reviewer.page.getByLabel('إجمالي عرض السعر (ر.س)',{exact:true}).evaluate(el=>el===document.activeElement),true);
  await reviewer.page.getByLabel('الرد للعميل ونطاق العرض',{exact:true}).fill('عرض عقد الورد الأسبوعي يشمل ثلاث فازات وزيارات التوريد والضريبة.');
  await reviewer.page.getByLabel('إجمالي عرض السعر (ر.س)',{exact:true}).fill('1500');
  await reviewer.page.getByRole('button',{name:'حفظ وإشعار العميل',exact:true}).click();
  await reviewer.page.getByText('تم حفظ الرد وإرسال إشعار إلى حساب العميل.',{exact:true}).waitFor();
  assert.equal(fixtures.quote_requests.find(r=>r.id===rfqId).status,'quoted');
  for(const width of [1440,390,320]){
    await reviewer.page.setViewportSize({width,height:1050});
    assert.ok(await reviewer.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Admin RFQ overflow at ${width}px`);
    await reviewer.page.screenshot({path:path.join(screenshots,`quotation-admin-${width}.png`),fullPage:true});
  }
  // A link to a saved request remains useful after it leaves the recent list.
  const actualRequests=[...fixtures.quote_requests];
  fixtures.quote_requests=[...Array.from({length:260},(_,i)=>({...actualRequests[0],id:crypto.randomUUID(),request_number:1000+i,status:'submitted',admin_reply:null,quote_amount:null})),...actualRequests];
  await reviewer.page.goto(origin+'/account?next='+encodeURIComponent('/admin/quote-requests?request='+rfqId));
  await reviewer.page.locator('.admin-rfq-detail form').waitFor();
  assert.match(reviewer.page.url(),new RegExp('request='+rfqId));
  assert.equal(await reviewer.page.getByLabel('إجمالي عرض السعر (ر.س)',{exact:true}).inputValue(),'1500');
  await reviewer.page.goto(origin+'/admin/quote-requests?request='+crypto.randomUUID());
  await reviewer.page.getByText('لم نعثر على هذا الطلب. تحقق من الرابط أو اختر طلبًا من القائمة.',{exact:true}).waitFor();
  assert.equal(await reviewer.page.locator('.admin-rfq-detail form').count(),0);
  await reviewer.context.close();assert.deepEqual(errors,[]);
  await browser.close();browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||undefined,headless:true,args:process.env.CHROME_EXECUTABLE?['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage']:[]});
  const freshSales=await contextFor({role:'admin',signedIn:false});
  await freshSales.page.goto(origin+'/admin/quote-requests?request='+rfqId);
  const salesLogin=freshSales.page.getByRole('link',{name:'تسجيل دخول المدير',exact:true});await salesLogin.waitFor();
  assert.equal(new URL(await salesLogin.getAttribute('href'),origin).searchParams.get('next'),'/admin/quote-requests?request='+rfqId);
  await salesLogin.click();
  await freshSales.page.getByPlaceholder('name@company.com',{exact:true}).fill('admin@example.test');
  await freshSales.page.locator('input[autocomplete="current-password"]').fill('Local-fixture-123!');
  await freshSales.page.locator('.auth-form button[type="submit"]').click();
  await freshSales.page.locator('.admin-rfq-detail form').waitFor();
  assert.match(freshSales.page.url(),new RegExp('request='+rfqId));
  await freshSales.context.close();
  await browser.close();browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||undefined,headless:true,args:process.env.CHROME_EXECUTABLE?['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage']:[]});
  const quotationCustomer=await contextFor({role:'customer'});
  await quotationCustomer.page.goto(origin+'/request-quote?request='+rfqId);
  await quotationCustomer.page.locator(`#rfq-${rfqId} .rfq-reply b`).waitFor();
  assert.match(await quotationCustomer.page.locator(`#rfq-${rfqId} .rfq-reply b`).innerText(),/١٬٥٠٠|1,500|1500/);
  await quotationCustomer.context.close();
  await browser.close();browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||undefined,headless:true,args:process.env.CHROME_EXECUTABLE?['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage']:[]});
  const mfaSales=await contextFor({role:'admin',mfa:true});
  await mfaSales.page.goto(origin+'/admin/quote-requests?request='+rfqId);
  await mfaSales.page.waitForURL(url=>url.pathname==='/account');
  assert.equal(new URL(mfaSales.page.url()).searchParams.get('next'),'/admin/quote-requests?request='+rfqId);
  assert.equal(await mfaSales.page.locator('.admin-app').count(),0);
  await mfaSales.context.close();assert.deepEqual(errors,[]);
  console.log('PASS: saved WhatsApp drafts, full quote-only cart, manual handoff without status change, history retry, protected pricing link, guest sign-in/MFA return, old-request deep links and customer quotation; RTL at 320/390/1440px');
  console.log('Admin UI verification passed; screenshots are in preview/admin.');
} finally {
  await browser?.close();
  server.kill();
}
