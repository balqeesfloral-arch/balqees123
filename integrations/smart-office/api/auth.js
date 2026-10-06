import { createSession, sessionCookie, verifyGoogleCredential } from '../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method not allowed' });
  try {
    const credential = req.body && req.body.credential;
    if (!credential) return res.status(400).json({ ok:false, error:'بيانات تسجيل الدخول غير مكتملة.' });
    const user = await verifyGoogleCredential(credential);
    const token = createSession(user.email);
    res.setHeader('Set-Cookie', sessionCookie(token));
    return res.status(200).json({ ok:true, user:{ email:user.email, name:user.name } });
  } catch (e) {
    return res.status(401).json({ ok:false, error:e && e.message ? e.message : 'تم رفض تسجيل الدخول.' });
  }
}
