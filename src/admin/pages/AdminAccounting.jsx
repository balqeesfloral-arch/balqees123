import { useCallback, useState } from 'react';
import AccountingConsole from '../../accounting/AccountingConsole';
import { officeRequest } from '../../accounting/officeClient';
import useAdminLiveRefresh from '../useAdminLiveRefresh';
const TABLES=['accounting_links','accounting_payments','accounting_statements','accounting_documents','orders','quote_requests','organization_service_requests','quotations','contracts'];
export default function AdminAccounting({lang}) {
  const [revision,setRevision]=useState(0);
  const refresh=useCallback(()=>setRevision(n=>n+1),[]);
  useAdminLiveRefresh(refresh,TABLES);
  return <AccountingConsole request={officeRequest} lang={lang} revision={revision}/>;
}
