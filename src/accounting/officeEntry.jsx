import { createRoot } from 'react-dom/client';
import AccountingConsole from './AccountingConsole';

async function request(action,input={}) {
  let response;
  try{response=await fetch('/api/portal',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({action,input}),signal:AbortSignal.timeout(65000)});}
  catch{throw new Error('تعذر الاتصال بالمكتب. حدّث حالة العملية قبل المحاولة مجددًا.');}
  const body=await response.json().catch(()=>null);
  if(!response.ok||!body?.ok)throw new Error(body?.error||'لم يُفعّل الربط بعد.');
  return body.data;
}
createRoot(document.getElementById('root')).render(<main className="acct-office-shell"><a href="/" className="acct-office-back">← العودة إلى مكتب بلقيس</a><AccountingConsole request={request} lang="ar" officeMode/></main>);
