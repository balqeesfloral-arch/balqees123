import { useEffect, useMemo, useRef } from 'react';
import { Printer, X } from 'lucide-react';
import { statementDocument } from './statementDocument';

export default function StatementPreview({report,onClose,lang='ar'}) {
  const dialog = useRef(null),frame = useRef(null),ar = lang === 'ar';
  const html = useMemo(()=>statementDocument(report),[report]);
  useEffect(()=>{const node=dialog.current;node.showModal();return()=>node.close();},[]);
  return <dialog ref={dialog} className="acct-dialog acct-statement" dir={ar?'rtl':'ltr'} onCancel={onClose} onClick={e=>{if(e.target===dialog.current)onClose();}} aria-label={ar?'معاينة كشف الحساب':'Statement preview'}>
    <header><div><small>{report.statementNo}</small><h2>{report.client?.name}</h2></div><div className="acct-actions"><button onClick={()=>frame.current?.contentWindow?.print()}><Printer size={17}/>{ar?'طباعة / حفظ PDF':'Print / Save PDF'}</button><button aria-label={ar?'إغلاق المعاينة':'Close preview'} onClick={onClose}><X size={18}/></button></div></header>
    <iframe ref={frame} title={ar?'كشف حساب العميل':'Client statement'} srcDoc={html} sandbox="allow-same-origin allow-modals"/>
  </dialog>;
}
