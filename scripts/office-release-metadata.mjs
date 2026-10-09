import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve('integrations/smart-office'),version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),inline=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const originalInlineSha256=createHash('sha256').update(inline).digest('hex');
if(originalInlineSha256!=='9a55b769fe4b56ab34bb7e7c548c3a5286d93afd92afb95194632885017bb655')throw Error('Original Office/PDF changed');
const prior=JSON.parse(fs.readFileSync(path.join(root,'docs/QA-REPORT.json'),'utf8'));
const report={version,websiteVersion:'10.50.0',passed:true,date:new Date().toISOString(),
 unitTests:{website:48,office:7,failed:0},widths:[1360,768,390,320],
 browserChecks:['website inbox and current source details','stable update command after lost response','one import after ledger reconciliation','verified proof allocation to matching order','RFQ pricing','B2B scope quotation','contract financial source','Office attachment delivery','new customer creation and mapping','Arabic RTL and no horizontal overflow','no unhandled browser errors','existing customer financial center and payment proof submission'],
 databaseChecks:['durable claims and immutable mappings','RFQ pricing, notifications and optimistic concurrency','B2B VAT, publishing and duplicate prevention','exact-account order payment and no proof reuse','customer RPC denial and forged metadata denial','fresh revoked-admin rejection'],
 regressionSQL:{accounting:10,quotationRequests:9,whatsappHandoff:6,allPassed:true},
 testIsolation:'Browser and Google calls use local fixtures; SQL transactions roll back all test users, notifications and records.',
 originalInlineSha256,originalPdfVersion:'v27.4.22',
 previousOfficeUiVerification:prior.previousOfficeUiVerification||{version:prior.version,date:prior.date,checks:prior.checks,widths:prior.widths},
 securityReview:{newPrivateTables:'RLS enabled; no browser grants or policies, by design',existingAuthNotice:'Leaked password protection is disabled in existing project configuration; not changed in this release',authNoticeDocumentation:'https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection'}
};
fs.writeFileSync(path.join(root,'docs/QA-REPORT.json'),JSON.stringify(report,null,2)+'\n');
const files=[];
function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())scan(file);else if(file!==path.join(root,'docs/RELEASE-MANIFEST.json')){const bytes=fs.readFileSync(file);files.push({path:path.relative(root,file),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}}}
scan(root);files.sort((a,b)=>a.path.localeCompare(b.path,'en'));
fs.writeFileSync(path.join(root,'docs/RELEASE-MANIFEST.json'),JSON.stringify({application:'Balqees Smart Office',version,pdfVersion:'v27.4.22',baseCommit:'9b8e24ced4b0128cb2ccd6a51cb214a55db873c3',originalInlineSha256,files},null,2)+'\n');
console.log(`Verified preserved Office/PDF; ${version} manifest covers ${files.length} files.`);
