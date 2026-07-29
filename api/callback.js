const crypto = require('crypto');
function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function sign(obj, secret) { const p = b64url(JSON.stringify(obj)); const s = b64url(crypto.createHmac('sha256', secret).update(p).digest()); return p + '.' + s; }
function cookies(h) { const o = {}; (h || '').split(';').forEach((c) => { const i = c.indexOf('='); if (i > 0) o[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); }); return o; }
module.exports = async (req, res) => {
  const cid = process.env.GOOGLE_CLIENT_ID, csec = process.env.GOOGLE_CLIENT_SECRET, ssec = process.env.SESSION_SECRET;
  const domain = (process.env.ALLOWED_DOMAIN || 'mosaicwellness.in').toLowerCase();
  if (!cid || !csec || !ssec) return res.status(503).send('Login is not configured.');
  const url = new URL(req.url, 'https://x');
  const code = url.searchParams.get('code'), state = url.searchParams.get('state');
  const ck = cookies(req.headers.cookie);
  const redir = (q) => { res.writeHead(302, { Location: '/login.html' + q }); res.end(); };
  if (!code || !state || state !== ck.mm_oauth_state) return redir('?error=state');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const redirectUri = `${proto}://${host}/api/callback`;
  try {
    const tRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: cid, client_secret: csec, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    const tok = await tRes.json();
    if (!tok.id_token) return redir('?error=token');
    // id_token comes directly from Google's token endpoint over TLS -> decode payload
    const payload = JSON.parse(Buffer.from(tok.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    const email = (payload.email || '').toLowerCase();
    const ok = payload.email_verified && email.endsWith('@' + domain) && (payload.hd === domain || true);
    if (!ok) return redir('?error=domain');
    const maxAge = 7 * 24 * 3600;
    const sess = sign({ e: email, x: Math.floor(Date.now() / 1000) + maxAge }, ssec);
    res.setHeader('Set-Cookie', [
      `mm_sess=${sess}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
      `mm_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
    ]);
    res.writeHead(302, { Location: '/' });
    res.end();
  } catch (e) { return redir('?error=server'); }
};
