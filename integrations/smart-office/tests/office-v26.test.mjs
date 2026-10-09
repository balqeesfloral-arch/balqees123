import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {normalizeSearch,csvCell,buildCsv,compareValues} from '../assets/office-tools.js';
import {prepareSearch,searchOfficeRows} from '../lib/office-search.js';

test('Arabic names, diacritics and both Arabic numeral sets match consistently',()=>{
  assert.equal(normalizeSearch(' مُؤَسَّسَة بَلْقِيس ١٢۳۴ '),'موسسه بلقيس 1234');
  assert.equal(normalizeSearch('أَحْــمَد الْوَاحَة'),'احمد الواحه');
});

test('CSV preserves multiline text and quotes, includes Arabic headings and neutralizes formulas',()=>{
  assert.equal(csvCell(' \t=HYPERLINK("x")'),'"\' \t=HYPERLINK(""x"")"');
  assert.equal(csvCell('line 1\n"line 2"'),'"line 1\n""line 2"""');
  assert.equal(csvCell(-20),'"-20"');
  const csv=buildCsv([['name','العميل'],['amount','المبلغ']],[{name:'@SUM(1+1)',amount:10}]);
  assert.ok(csv.startsWith('\uFEFF"العميل","المبلغ"\r\n'));
  assert.ok(csv.includes('"\'@SUM(1+1)","10"'));
});

test('table sorting handles numbers and missing values in either direction',()=>{
  assert.ok(compareValues(9,10,false,true)<0);
  assert.ok(compareValues('١٠','2',true,false)<0);
  assert.equal(compareValues('',10,false,true),1);
  assert.equal(compareValues('',10,true,true),1);
});

test('global search finds old records beyond the table limit and excludes deleted entries',()=>{
  const rows=Array.from({length:1005},(_,i)=>({id:'client-'+i,name:'عميل '+i,client_no:'C-'+i,created_at:'2026-10-09'}));
  rows[1004].name='أحمد الواحة';rows[1004].phone='0501234567';
  rows.push({id:'deleted',name:'أحمد الواحة',deleted_at:'2026-10-01'});
  const result=searchOfficeRows({clients:rows},prepareSearch({query:'احمد واحة'}));
  assert.equal(result.scanned,1005);assert.equal(result.matched,1);assert.equal(result.items[0].id,'client-1004');
  assert.equal(searchOfficeRows({clients:rows},prepareSearch({query:'٠٥٠١٢٣٤٥٦٧'})).matched,1);
});

test('result limits retain the total and section scope; exact references rank first',()=>{
  const rows={clients:Array.from({length:70},(_,i)=>({id:'c-'+i,name:'بلقيس '+i,client_no:'C-'+i})),
    quotes:[{id:'q-1',quote_no:'بلقيس',client_name:'الواحة',description:'عرض ورد',updated_at:'2020-01-01'}]};
  const all=searchOfficeRows(rows,prepareSearch({query:'بلقيس',limit:999}));
  assert.equal(all.items.length,50);assert.equal(all.matched,71);assert.equal(all.items[0].id,'q-1');
  const scoped=searchOfficeRows(rows,prepareSearch({query:'بلقيس',entity:'quotes'}));
  assert.equal(scoped.matched,1);
  assert.throws(()=>prepareSearch({query:'بلقيس',entity:'__proto__'}),/غير معروف/);
  assert.equal(prepareSearch({query:'  ا ',limit:0}).terms.length,0);
});

test('protected search API reads all sheets once and uses current related names',async()=>{
  const savedFetch=globalThis.fetch;
  const names=['BALQEES_API_SECRET','BALQEES_ALLOWED_EMAIL','BALQEES_SPREADSHEET_ID','GOOGLE_SERVICE_ACCOUNT_JSON'];
  const saved=Object.fromEntries(names.map(key=>[key,process.env[key]]));
  const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
  Object.assign(process.env,{BALQEES_API_SECRET:'office-v26-test-fixture-only',BALQEES_ALLOWED_EMAIL:'office@example.test',
    BALQEES_SPREADSHEET_ID:'office-v26-test-sheet',GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({client_email:'service@example.test',private_key:privateKey})});
  let reads=0,tokens=0;
  const sheets={
    'العملاء':[['id','name','client_no'],['c-1','حديقة الواحة','C-1']],
    'المستحقات':[['id','client_id','client_name','invoice_no','receivable_no','invoice_total'],['r-1','c-1','اسم قديم','INV-900','R-900',1000]]
  };
  globalThis.fetch=async url=>{
    if(String(url)==='https://oauth2.googleapis.com/token'){tokens++;return Response.json({access_token:'mock-token',expires_in:3600});}
    const parsed=new URL(url);assert.equal(parsed.hostname,'sheets.googleapis.com');reads++;
    assert.equal(parsed.pathname,'/v4/spreadsheets/office-v26-test-sheet/values:batchGet');
    const ranges=parsed.searchParams.getAll('ranges');assert.equal(ranges.length,12);
    return Response.json({valueRanges:ranges.map(range=>({values:sheets[range.match(/^'(.*)'!/)[1]]||[]}))});
  };
  try{
    const {default:handler}=await import('../api/balqees.js');
    const {createSession}=await import('../lib/auth.js');
    function response(){return {headers:{},code:200,setHeader(key,value){this.headers[key]=value;},status(value){this.code=value;return this;},json(value){this.body=value;return this;}};}
    const denied=response();await handler({method:'POST',headers:{},body:{action:'searchRecords',args:[{query:'الواحة'}]}},denied);
    assert.equal(denied.code,401);assert.equal(reads,0);assert.equal(tokens,0);
    const cookie='balqees_session='+createSession('office@example.test');
    const wrongMethod=response();await handler({method:'GET',headers:{cookie},body:{}},wrongMethod);assert.equal(wrongMethod.code,405);
    const short=response();await handler({method:'POST',headers:{cookie},body:{action:'searchRecords',args:[{query:'ا'}]}},short);assert.equal(reads,0);
    const result=response();await handler({method:'POST',headers:{cookie},body:{action:'searchRecords',args:[{query:'واحة'}]}},result);
    assert.equal(result.code,200);assert.equal(result.headers['Cache-Control'],'no-store, max-age=0');
    assert.equal(result.body.data.matched,2);assert.equal(reads,1);assert.equal(tokens,1);
    assert.equal(result.body.data.items.find(item=>item.id==='r-1').title,'حديقة الواحة');
    assert.equal(result.body.data.items.find(item=>item.id==='r-1').invoice_total,undefined);
  }finally{
    globalThis.fetch=savedFetch;
    for(const key of names){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}
  }
});

test('original office/PDF code and embedded brand assets stay byte-identical to the tested base',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const original=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.equal(createHash('sha256').update(original).digest('hex'),'9a55b769fe4b56ab34bb7e7c548c3a5286d93afd92afb95194632885017bb655');
  assert.match(html,/<meta name="application-version" content="26\.3\.0">/);
});
