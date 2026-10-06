// Persist only opaque identifiers/hashes, never a customer's financial fields.
const memoryIds = new Map();
export function requestIdentity(key) {
  const storageKey = `balqees-accounting-v1:${key}`;
  let id=memoryIds.get(storageKey);
  try { id=sessionStorage.getItem(storageKey)||id; } catch { /* Private browsing. */ }
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) {
    id=crypto.randomUUID();
    try { sessionStorage.setItem(storageKey,id); } catch { /* The current request still has one stable ID. */ }
  }
  memoryIds.set(storageKey,id);
  return {id,clear(){memoryIds.delete(storageKey);try{sessionStorage.removeItem(storageKey);}catch{/* No persistent storage. */}}};
}
export async function requestFingerprint(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function documentUpload(file) {
  if (!file || !['application/pdf','image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('اختر مستند PDF أو صورة PNG أو JPG أو WebP.');
  if (file.size > 3*1024*1024 || !file.size) throw new Error('الحد الأقصى للمستند 3 ميجابايت.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return {name:file.name,type:file.type,base64:btoa(binary),digest:await requestFingerprint(bytes)};
}
