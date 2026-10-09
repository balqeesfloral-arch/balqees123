import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const src=path.join(root,'src');
const exts=['','.js','.jsx','.mjs','.css','.json','.svg','.png','.jpg','.jpeg','.webp'];
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else files.push(p)}}
walk(src);
let checked=0;const missing=[];
const importRe=/(?:import\s+(?:[^'"()]+?\s+from\s+)?|import\s*\(|export\s+[^'"()]+?\s+from\s+)["'](\.[^"']+)["']/g;
for(const file of files.filter(f=>/\.(?:js|jsx|mjs)$/.test(f))){const text=fs.readFileSync(file,'utf8');for(const m of text.matchAll(importRe)){checked++;const base=path.resolve(path.dirname(file),m[1]);let ok=false;for(const ext of exts){const c=base+ext;if(fs.existsSync(c)&&fs.statSync(c).isFile()){ok=true;break}}if(!ok&&fs.existsSync(base)&&fs.statSync(base).isDirectory()){for(const n of ['index.js','index.jsx','index.mjs'])if(fs.existsSync(path.join(base,n))){ok=true;break}}if(!ok)missing.push(`${path.relative(root,file)} -> ${m[1]}`)}}
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const required=[
  'public/favicon.ico',
  'public/apple-touch-icon.png',
  'public/manifest.webmanifest',
  'public/icons/icon-192.png',
  'public/icons/icon-512.png',
  'public/icons/icon-maskable-512.png',
  'public/assets/brand/balqees-share.png',
  'SUPABASE-v10.44-PRODUCTION-HARDENING.sql'
];
for(const rel of required)if(!fs.existsSync(path.join(root,rel)))missing.push(`missing required file: ${rel}`);
if(pkg.version!=='10.50.0')missing.push(`package version is ${pkg.version}, expected 10.50.0`);
if(!html.includes('/favicon.ico'))missing.push('index.html does not declare /favicon.ico');
if(missing.length){console.error('Source verification FAILED');for(const x of missing)console.error(`- ${x}`);process.exit(1)}
console.log(`Source verification OK: ${checked} relative imports checked; ${files.length} source files scanned; version ${pkg.version}.`);
