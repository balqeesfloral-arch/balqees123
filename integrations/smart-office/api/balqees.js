
import { verifySession } from '../lib/auth.js';
import {
  getInitialData, health, getBootstrap, getLookups, refreshDashboard, listEntity, searchRecords,
  saveRecord, deleteRecord, saveCompanySettings, getWeeklyReport, getReport, createBackup, getQuotationData, getLetterData
} from '../lib/balqees-db.js';
import { QuoteError } from '../assets/quotation-model.js';
import { LetterError } from '../assets/letter-model.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const user = verifySession(req);
  if (!user) return res.status(401).json({ ok:false, error:'يجب تسجيل الدخول إلى مكتب بلقيس أولاً.' });
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method not allowed' });

  try {
    const body=req.body||{};
    const action=String(body.action||'');
    const args=Array.isArray(body.args)?body.args:[];

    let data;
    switch(action){
      case 'getInitialData': data=await getInitialData(user.email); break;
      case 'health': data=await health(); break;
      case 'getBootstrap': data=await getBootstrap(user.email); break;
      case 'getLookups': data=await getLookups(); break;
      case 'refreshDashboard': data=await refreshDashboard(); break;
      case 'listEntity': data=await listEntity(args[0],args[1]||{}); break;
      case 'searchRecords': data=await searchRecords(args[0]||{}); break;
      case 'getQuotationData': data=await getQuotationData(args[0]||''); break;
      case 'getLetterData': data=await getLetterData(args[0]||''); break;
      case 'saveRecord': data=await saveRecord(user.email,args[0],args[1]||{}); break;
      case 'deleteRecord': data=await deleteRecord(user.email,args[0],args[1],args[2]); break;
      case 'saveCompanySettings': data=await saveCompanySettings(user.email,args[0]||{}); break;
      case 'getWeeklyReport': data=await getWeeklyReport(args[0],args[1]); break;
      case 'getReport': data=await getReport(args[0],args[1]||{}); break;
      case 'createBackup': data=await createBackup(user.email); break;
      default: return res.status(400).json({ok:false,error:'أمر غير معروف: '+action});
    }
    return res.status(200).json({ok:true,data});
  } catch (e) {
    console.error('Balqees API', e);
    return res.status(e instanceof QuoteError||e instanceof LetterError?(['QUOTE_CONFLICT','LETTER_CONFLICT'].includes(e.code)?409:400):500).json({ok:false,code:e.code||'OFFICE_ERROR',error:e&&e.message?e.message:'حدث خطأ في قاعدة البيانات.'});
  }
}
