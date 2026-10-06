import crypto from 'node:crypto';

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}
function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
export function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return raw.split(';').reduce((out, part) => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    return out;
  }, {});
}
export function createSession(email) {
  const secret = process.env.BALQEES_API_SECRET;
  if (!secret) throw new Error('BALQEES_API_SECRET is missing');
  const payload = b64url(JSON.stringify({
    email: String(email || '').toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + (12 * 60 * 60)
  }));
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
export function verifySession(req) {
  try {
    const secret = process.env.BALQEES_API_SECRET;
    if (!secret) return null;
    const token = parseCookies(req).balqees_session;
    if (!token || !token.includes('.')) return null;
    const [payload, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    if (!safeEqual(sig, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.email || !data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    const allowed = String(process.env.BALQEES_ALLOWED_EMAIL || '').trim().toLowerCase();
    if (!allowed || data.email.toLowerCase() !== allowed) return null;
    return { email: data.email };
  } catch {
    return null;
  }
}
export function sessionCookie(token) {
  return `balqees_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${12*60*60}`;
}
export function clearSessionCookie() {
  return 'balqees_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}
export async function verifyGoogleCredential(credential) {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  const allowed = String(process.env.BALQEES_ALLOWED_EMAIL || '').trim().toLowerCase();
  if (!clientId || !allowed) throw new Error('إعدادات تسجيل الدخول غير مكتملة.');

  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
  if (!r.ok) throw new Error('تعذر التحقق من رمز Google.');
  const p = await r.json();

  const issuerOk = p.iss === 'accounts.google.com' || p.iss === 'https://accounts.google.com';
  const expOk = Number(p.exp || 0) > Math.floor(Date.now()/1000);
  const email = String(p.email || '').toLowerCase();
  const verified = String(p.email_verified) === 'true' || p.email_verified === true;

  if (!issuerOk || !expOk || p.aud !== clientId || !verified) {
    throw new Error('رمز تسجيل الدخول غير صالح.');
  }
  if (email !== allowed) {
    throw new Error('هذا الحساب غير مصرح له بالدخول إلى مكتب بلقيس.');
  }
  return { email, name: p.name || '', picture: p.picture || '' };
}
