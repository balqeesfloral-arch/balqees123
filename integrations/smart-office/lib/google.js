
import crypto from 'node:crypto';

let tokenCache = { token: '', expiresAt: 0 };

function serviceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON غير موجود في Vercel.');
  try {
    let value = JSON.parse(raw);
    if (typeof value === 'string') value = JSON.parse(value);
    if (!value.client_email || !value.private_key) throw new Error('missing fields');
    return value;
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON غير صالح.');
  }
}

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

export async function getGoogleAccessToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 300000) {
    return tokenCache.token;
  }

  const sa = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive'
    ].join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));

  const unsigned = `${header}.${payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(sa.private_key).toString('base64url');
  const assertion = `${unsigned}.${signature}`;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  });

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) {
    throw new Error(`تعذر مصادقة حساب الخدمة مع Google (${data.error_description || data.error || r.status}).`);
  }

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000
  };
  return tokenCache.token;
}

async function googleFetch(url, options = {}) {
  const token = await getGoogleAccessToken();
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  const r = await fetch(url, { ...options, headers });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!r.ok) {
    const msg = data?.error?.message || data?.error_description || data?.raw || `HTTP ${r.status}`;
    throw new Error(`Google API: ${msg}`);
  }
  return data;
}

function sheetId() {
  const id = String(process.env.BALQEES_SPREADSHEET_ID || '').trim();
  if (!id) throw new Error('BALQEES_SPREADSHEET_ID غير موجود في Vercel.');
  return id;
}
function qRange(sheetName, a1 = 'A:ZZ') {
  return `'${String(sheetName).replaceAll("'", "''")}'!${a1}`;
}
function encodeRange(sheetName, a1 = 'A:ZZ') {
  return encodeURIComponent(qRange(sheetName, a1));
}

export async function batchGetSheets(sheetNames) {
  const id = sheetId();
  const qs = new URLSearchParams();
  for (const name of sheetNames) qs.append('ranges', qRange(name, 'A:ZZ'));
  qs.set('majorDimension', 'ROWS');
  qs.set('valueRenderOption', 'UNFORMATTED_VALUE');
  qs.set('dateTimeRenderOption', 'SERIAL_NUMBER');

  const data = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values:batchGet?${qs.toString()}`
  );

  const out = {};
  (data.valueRanges || []).forEach((vr, i) => {
    out[sheetNames[i]] = vr.values || [];
  });
  sheetNames.forEach(n => { if (!(n in out)) out[n] = []; });
  return out;
}

export async function getSheetValues(sheetName) {
  const id = sheetId();
  const data = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${encodeRange(sheetName)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`
  );
  return data.values || [];
}

export async function updateRow(sheetName, rowNumber, values) {
  const id = sheetId();
  const endCol = columnName(Math.max(1, values.length));
  const range = `${qRange(sheetName, `A${rowNumber}:${endCol}${rowNumber}`)}`;
  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ range, majorDimension: 'ROWS', values: [values] })
    }
  );
}

export async function appendRow(sheetName, values) {
  const id = sheetId();
  const range = qRange(sheetName, 'A:ZZ');
  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ range, majorDimension: 'ROWS', values: [values] })
    }
  );
}

export async function batchUpdateRows(updates) {
  if (!updates.length) return;
  const id = sheetId();
  const data = updates.map(u => {
    const endCol = columnName(Math.max(1, u.values.length));
    const range = qRange(u.sheet, `A${u.row}:${endCol}${u.row}`);
    return { range, majorDimension: 'ROWS', values: [u.values] };
  });
  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values:batchUpdate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'RAW', data })
    }
  );
}

export async function createDriveFolder(name, parentId) {
  if (!parentId) return '';
  try {
    const data = await googleFetch(
      'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId]
        })
      }
    );
    return data.id || '';
  } catch {
    return '';
  }
}

export async function uploadDriveFile({ name, mimeType, dataBase64, parentId }) {
  if (!dataBase64 || !parentId) return '';
  const bytes = Buffer.from(String(dataBase64).replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (bytes.length > 4 * 1024 * 1024) {
    throw new Error('حجم المرفق كبير. الحد الحالي للمرفق الواحد 4MB.');
  }

  const boundary = `balqees_${crypto.randomBytes(12).toString('hex')}`;
  const metadata = JSON.stringify({
    name: String(name || 'file').replace(/[\\/:*?"<>|]/g, '_').slice(-140),
    parents: [parentId]
  });

  const head1 = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--`);
  const body = Buffer.concat([head1, bytes, tail]);

  const data = await googleFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body
    }
  );
  return data.id || '';
}

export async function copyDriveFile(fileId, name, parentId) {
  const data = await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/copy?supportsAllDrives=true&fields=id,name,webViewLink`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parents: parentId ? [parentId] : undefined })
    }
  );
  return data;
}

// Only called after the ledger record and its client ID have been checked.
export async function readDriveAttachment(fileId) {
  if (!/^[a-zA-Z0-9_-]{10,160}$/.test(String(fileId))) throw new Error('Drive file reference invalid');
  const meta=await googleFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=id,name,mimeType,size,trashed`);
  if(meta.trashed||!['application/pdf','image/png','image/jpeg','image/webp'].includes(meta.mimeType)||Number(meta.size)>3*1024*1024)throw new Error('Attachment format or size unsupported');
  const token=await getGoogleAccessToken();
  const res=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(18000)});
  if(!res.ok)throw new Error('Drive attachment unavailable');
  const reader=res.body.getReader(),chunks=[];let size=0;
  try {
    while(true){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>3*1024*1024){await reader.cancel();throw new Error('Drive attachment too large');}chunks.push(Buffer.from(value));}
  } finally {reader.releaseLock();}
  return {name:meta.name,type:meta.mimeType,base64:Buffer.concat(chunks).toString('base64')};
}

export function columnName(n) {
  let s = '';
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}
