import { createRoot } from 'react-dom/client';
import AccountingConsole from '../src/accounting/AccountingConsole';
import AccountingPortal from '../src/accounting/AccountingPortal';
import { officeRequest } from '../src/accounting/officeClient';
const params=new URLSearchParams(location.search);
createRoot(document.getElementById('root')).render(params.get('mode')==='customer'
  ? <AccountingPortal lang="ar" userId="10000000-0000-4000-8000-000000000003"/>
  : <AccountingConsole request={officeRequest} lang="ar"/>);
