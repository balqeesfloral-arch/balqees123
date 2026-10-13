import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {QUOTATION_EDITION} from '../integrations/smart-office/assets/quotation-model.js';
import {LETTER_EDITION} from '../integrations/smart-office/assets/letter-model.js';
const root=path.resolve('integrations/smart-office'),version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),inline=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const originalInlineSha256=createHash('sha256').update(inline).digest('hex');
if(originalInlineSha256!=='9a55b769fe4b56ab34bb7e7c548c3a5286d93afd92afb95194632885017bb655')throw Error('Original Office/PDF changed');
const prior=JSON.parse(fs.readFileSync(path.join(root,'docs/QA-REPORT.json'),'utf8'));
const quotation=JSON.parse(fs.readFileSync(path.join(root,`docs/QUOTATION-QA-v${QUOTATION_EDITION}.json`),'utf8'));
if(!quotation.passed||quotation.unitTests.failed||!quotation.visualReview.allPagesInspected)throw Error('Quotation verification incomplete');
const letter=JSON.parse(fs.readFileSync(path.join(root,`docs/LETTER-QA-v${LETTER_EDITION}.json`),'utf8'));
if(!letter.passed||letter.unitTests.failed||!letter.visualReview.allPagesInspected)throw Error('Letter verification incomplete');
const report={version,quotationEdition:QUOTATION_EDITION,letterEdition:LETTER_EDITION,websiteVersion:'10.50.0',passed:true,date:letter.date,
 unitTests:letter.unitTests,widths:[1440,1360,768,390,320],
 browserChecks:[...new Set([...prior.browserChecks,...quotation.browserChecks,...letter.browserChecks])],
 previousDatabaseVerification:prior.previousDatabaseVerification||{date:prior.date,checks:prior.databaseChecks,regressionSQL:prior.regressionSQL},
 supabaseChangesThisEdition:false,
 googleSheetsSchemaChange:'Adds one letter_details_json column to the existing letters sheet on first composed save.',
 testIsolation:'All letter, quotation, accounting and website-link browser/API checks use local fixtures. No live customer writes or outbound messages. Supabase verification belongs to the dated prior release, not this letter edition.',
 quotationVerification:`docs/QUOTATION-QA-v${QUOTATION_EDITION}.json`,
 letterVerification:`docs/LETTER-QA-v${LETTER_EDITION}.json`,
 originalInlineSha256,originalPdfVersion:'v27.4.22',
 previousOfficeUiVerification:prior.previousOfficeUiVerification||{version:prior.version,date:prior.date,checks:prior.checks,widths:prior.widths},
 securityReview:prior.securityReview
};
fs.writeFileSync(path.join(root,'docs/QA-REPORT.json'),JSON.stringify(report,null,2)+'\n');
const files=[];
function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())scan(file);else if(file!==path.join(root,'docs/RELEASE-MANIFEST.json')){const bytes=fs.readFileSync(file);files.push({path:path.relative(root,file),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}}}
scan(root);files.sort((a,b)=>a.path.localeCompare(b.path,'en'));
const baseCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
fs.writeFileSync(path.join(root,'docs/RELEASE-MANIFEST.json'),JSON.stringify({application:'Balqees Smart Office',version,quotationEdition:QUOTATION_EDITION,letterEdition:LETTER_EDITION,pdfVersion:'v27.4.22',baseCommit,originalInlineSha256,files},null,2)+'\n');
console.log(`Verified preserved Office/PDF; ${version} manifest covers ${files.length} files.`);
