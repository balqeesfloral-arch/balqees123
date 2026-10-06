import { supabase } from '../lib/supabase';
export const OFFICE_URL = 'https://balqees-smart-office.vercel.app';
export async function officeRequest(action,input={}) {
  const {data:{session},error} = await supabase.auth.getSession();
  if (error || !session) throw new Error('سجّل الدخول بحساب المدير لإدارة المحاسبة.');
  let response;
  try {
    response = await fetch(`${OFFICE_URL}/api/portal`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
      body:JSON.stringify({action,input}),credentials:'omit',signal:AbortSignal.timeout(65000)});
  } catch { throw new Error('تعذر الاتصال بربط المكتب. افتح المكتب للتحقق من تفعيل الربط ثم أعد المحاولة.'); }
  const body = await response.json().catch(()=>null);
  if (!response.ok || !body?.ok) throw new Error(body?.error || 'ربط المكتب بالموقع لم يُفعّل بعد.');
  return body.data;
}
