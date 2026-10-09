import { PortalError } from './portal-domain.js';

export function createPortalStore(env = process.env, fetcher = fetch) {
  const base = String(env.BALQEES_PORTAL_URL || '').replace(/\/$/, '');
  const key = env.BALQEES_PORTAL_SECRET_KEY || '';
  const publicKey = env.BALQEES_PORTAL_PUBLISHABLE_KEY || '';
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base) || !key || key.startsWith('sb_publishable_') || !/^(sb_publishable_|eyJ)/.test(publicKey)) {
    throw new PortalError('NOT_CONFIGURED', 'ربط المكتب بالموقع لم يُفعّل بعد. يلزم إكمال إعداد الاتصال في المكتب.', 503);
  }
  // User verification runs in the authenticated user's context with a public
  // apikey; privileged operations use a completely separate service context.
  const headers = token => ({apikey:token ? publicKey : key, ...(token || key.startsWith('eyJ') ? {Authorization:`Bearer ${token || key}`} : {})});
  async function request(path, options = {}, token) {
    const response = await fetcher(`${base}${path}`, {...options, headers:{...headers(token),...options.headers}, signal:AbortSignal.timeout(18000)});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const known = {
        ACCOUNTING_MAPPING_IMMUTABLE:'هذا العميل مرتبط بحساب آخر. راجع الربط قبل أي إرسال.',
        ACCOUNTING_TARGET_REQUIRED:'اختر حسابًا واحدًا للعميل.',
        PAYMENT_IMPORT_CHANGED:'تغيّرت حالة الإيصال. حدّث القائمة قبل المتابعة.',
        PAYMENT_REASON_REQUIRED:'اكتب سبب عدم الاعتماد (3 أحرف على الأقل).',
        ACCOUNTING_LINK_INACTIVE:'ربط هذا العميل غير نشط.',
        PAYMENT_REJECTED:'الإيصال غير معتمد ولا يمكن تسجيله.',
        ACCOUNTING_REQUEST_REUSED:'مرجع الإرسال مستخدم لعملية أخرى.',
        OFFICE_SOURCE_CHANGED:'تغيّرت بيانات الطلب. افتح أحدث تفاصيله قبل المتابعة. إذا بدأ الاستيراد، طابق سجل المكتب أولًا.',
        OFFICE_IMPORT_BUSY:'عملية أخرى تسجل هذا الطلب. انتظر اكتمالها ثم حدّث حالة الاستيراد.',
        OFFICE_IMPORT_CHANGED:'تغيّرت حالة الاستيراد. حدّث الوارد وطابق السجل الموجود.',
        OFFICE_MAPPING_IMMUTABLE:'هذا الطلب مستورد لحساب آخر. لا يمكن إعادة تعيين هويته.',
        OFFICE_MAPPING_INVALID:'هوية عميل المكتب لا تطابق حساب الطلب.',
        OFFICE_COMMAND_REUSED:'مرجع التحديث مستخدم لبيانات مختلفة. راجع التحديث المحفوظ.',
        OFFICE_SOURCE_CLOSED:'الطلب مغلق أو ملغى أو مسودة. راجع حالته في الموقع.',
        OFFICE_QUOTATION_EXISTS:'يوجد عرض منشور لهذا الطلب. راجعه أو أنشئ نسخة معدلة من صفحة عروض المنشآت.',
        REQUEST_CLOSED:'الطلب مغلق. راجع الرد المحفوظ في الموقع.',
        COD_CONFIRMATION_REQUIRED:'يجب تأكيد طلب الدفع عند الاستلام من العميل قبل بدء التنفيذ.',
        COD_RECIPIENT_CONFIRMATION_REQUIRED:'يجب تأكيد الدفع عند الاستلام من المستلم أولًا.',
        RECIPIENT_COD_CONFIRMATION_REQUIRED:'يجب تأكيد الدفع عند الاستلام من المستلم أولًا.',
        COD_REVIEW_REQUIRED:'طلب الدفع عند الاستلام يحتاج اعتماد المراجعة من إدارة الموقع.',
        COD_PAYMENT_REQUIRED_BEFORE_DELIVERY:'يجب تأكيد السداد قبل إغلاق تسليم طلب الدفع عند الاستلام.',
        PAYMENT_REQUIRED_BEFORE_DELIVERY:'يجب تأكيد السداد قبل إغلاق تسليم الطلب.',
        QUOTE_AMOUNT_REQUIRED:'أدخل إجمالي عرض السعر أكبر من صفر.',
        REPLY_REQUIRED:'اكتب ردًا للعميل.',
        INVALID_STATUS:'حالة الطلب غير صالحة.',
        OFFICE_QUOTE_INVALID:'راجع الإجمالي ونسبة الضريبة وصلاحية العرض ونطاقه.',
        OFFICE_PAYMENT_MISMATCH:'الإيصال لا يطابق عميل الطلب وإجماليه. السداد الجزئي يحتاج مراجعة الحساب.',
        OFFICE_PAYMENT_INVALID:'هذا السداد أو الطلب غير متاح للاعتماد. حدّث الحالة قبل المتابعة.',
        OFFICE_PAYMENT_ALLOCATED:'هذا الإيصال معتمد لطلب آخر. لا يمكن استخدام السداد مرتين.',
      };
      const code = Object.keys(known).find(k => String(data.message).includes(k));
      if (response.status === 401 || response.status === 403 || String(data.message).includes('ACCOUNTING_ADMIN_REQUIRED')) {
        throw new PortalError('FORBIDDEN','الدخول بصلاحية المدير والتحقق الثنائي عند تفعيله مطلوبان.',403);
      }
      if (data.code === '23505') throw new PortalError('ALREADY_LINKED','الحساب مرتبط مسبقًا. حدّث القائمة وراجع الربط.',409);
      throw new PortalError(code || 'PORTAL_UNAVAILABLE', known[code] || 'تعذر إكمال الاتصال بالموقع. أعد التحقق من حالة العملية قبل المحاولة.', code ? 409 : 502);
    }
    return data;
  }
  const rpc = (name, args = {}, token) => request(`/rest/v1/rpc/${name}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)},token);
  const select = (table, filters = {}) => request(`/rest/v1/${table}?${new URLSearchParams(filters)}`);
  return {
    rpc, select,
    async authenticate(token) { const actor = await rpc('accounting_admin_access',{},token); return `site:${actor.user_id}`; },
    async one(table,id) { const rows = await select(table,{id:`eq.${id}`,select:'*',limit:'1'}); return rows[0] || null; },
    async upload(path, file) {
      const url = `${base}/storage/v1/object/accounting-documents/${path}`;
      const response = await fetcher(url,{method:'POST',headers:{...headers(),'Content-Type':file.type,'x-upsert':'false'},body:file.bytes,signal:AbortSignal.timeout(18000)});
      if (response.ok) return;
      if ([400,409].includes(response.status)) {
        const old = await fetcher(url,{headers:headers(),signal:AbortSignal.timeout(18000)});
        if (old.ok && Buffer.from(await old.arrayBuffer()).equals(file.bytes)) return;
      }
      throw new PortalError('UPLOAD_FAILED','تعذر رفع المستند أو أن مرجع الرفع مستخدم لملف مختلف.',409);
    },
    async proof(path) {
      const response = await fetcher(`${base}/storage/v1/object/accounting-proofs/${path}`,{headers:headers(),signal:AbortSignal.timeout(18000)});
      if (!response.ok) throw new PortalError('PROOF_UNAVAILABLE','تعذر قراءة إيصال السداد. لم يتم تسجيل الحوالة.',502);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 10485760) throw new PortalError('PROOF_SIZE','حجم إيصال السداد أكبر من الحد المسموح.');
      return {name:path.split('/').pop(),mimeType:response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream',dataBase64:bytes.toString('base64')};
    },
    async signed(bucket,path) {
      const data = await request(`/storage/v1/object/sign/${bucket}/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn:120})});
      const signed = data.signedURL || data.signedUrl;
      if (!signed?.startsWith('/object/sign/')) throw new PortalError('FILE_UNAVAILABLE','تعذر فتح المستند.',502);
      return `${base}/storage/v1${signed}`;
    },
  };
}
