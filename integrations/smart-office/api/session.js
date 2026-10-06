import { verifySession } from '../lib/auth.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') return res.status(405).json({ authenticated:false });
  const user = verifySession(req);
  if (!user) return res.status(401).json({ authenticated:false });
  return res.status(200).json({ authenticated:true, user });
}
