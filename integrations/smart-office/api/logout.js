import { clearSessionCookie } from '../lib/auth.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'POST') return res.status(405).json({ ok:false });
  res.setHeader('Set-Cookie', clearSessionCookie());
  return res.status(200).json({ ok:true });
}
