import { verifySession } from '../lib/auth.js';
import { createPortalStore } from '../lib/portal-store.js';
import { createPortalService } from '../lib/portal-service.js';
import { PortalError } from '../lib/portal-domain.js';
import { getPortalClients, getReport, getBootstrap, findPortalTransfer, preparePortalTransfer, appendPortalTransfer } from '../lib/balqees-db.js';

export const config = { maxDuration:60 };
const ledger = {
  clients:getPortalClients,statement:filters => getReport('client_statement',filters),
  company:async () => (await getBootstrap()).company,
  find:findPortalTransfer,prepare:preparePortalTransfer,append:appendPortalTransfer,
};
export function createHandler({makeStore = createPortalStore, officeSession = verifySession, accounting = ledger, env = process.env} = {}) {
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store, max-age=0');
    res.setHeader('Vary','Origin');
    const origins = new Set(['https://balqees123.vercel.app','https://balqeesfloral.vercel.app','https://balqees-smart-office.vercel.app',
      ...String(env.BALQEES_PORTAL_ORIGINS || '').split(',').map(s => s.trim()).filter(s => /^https:\/\/[^/]+$/.test(s)),
    ]);
    const origin = req.headers.origin;
    if (!origin || !origins.has(origin)) return res.status(403).json({ok:false,code:'ORIGIN_DENIED',error:'مصدر الطلب غير مصرح به.'});
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
    // Cross-site requests always use the site JWT, never Office cookies.
    if (origin === 'https://balqees-smart-office.vercel.app') res.setHeader('Access-Control-Allow-Credentials','true');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ok:false,error:'Method not allowed'});
    if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return res.status(415).json({ok:false,error:'JSON required'});
    try {
      if (!req.body || typeof req.body !== 'object' || Buffer.byteLength(JSON.stringify(req.body)) > 4300000) throw new PortalError('REQUEST_SIZE','حجم الطلب أكبر من الحد المسموح.',413);
      const bearer = /^Bearer (\S+)$/i.exec(req.headers.authorization || '')?.[1];
      const session = origin === 'https://balqees-smart-office.vercel.app' ? officeSession(req) : null;
      if (!bearer && !session) throw new PortalError('AUTH_REQUIRED','سجّل الدخول بحساب المدير أو حساب المكتب المصرح له.',401);
      const store = makeStore();
      const actor = bearer ? await store.authenticate(bearer) : `office:${session.email}`;
      const data = await createPortalService({store,ledger:accounting})(String(req.body.action || ''),req.body.input || {},actor);
      return res.status(200).json({ok:true,data});
    } catch (error) {
      // Do not expose Google responses, environment values or customer data.
      if (!(error instanceof PortalError)) console.error('Accounting bridge failure',error?.name || 'Error');
      return res.status(error instanceof PortalError ? error.status : 502).json({ok:false,
        code:error instanceof PortalError ? error.code : 'OFFICE_UNAVAILABLE',
        error:error instanceof PortalError ? error.message : 'تعذر إكمال الاتصال بالمكتب. حدّث حالة العملية قبل المحاولة مجددًا.'});
    }
  };
}
export default createHandler();
