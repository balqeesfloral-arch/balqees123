export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') return res.status(405).json({ ok:false });
  const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
  return res.status(200).json({ googleClientId });
}
