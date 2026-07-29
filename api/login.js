const crypto = require('crypto');
module.exports = (req, res) => {
  const cid = process.env.GOOGLE_CLIENT_ID;
  if (!cid) return res.status(503).send('Login is not configured yet.');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const redirectUri = `${proto}://${host}/api/callback`;
  const state = crypto.randomBytes(16).toString('hex');
  res.setHeader('Set-Cookie', `mm_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
  const params = new URLSearchParams({
    client_id: cid,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    hd: process.env.ALLOWED_DOMAIN || 'mosaicwellness.in',
    prompt: 'select_account',
    access_type: 'online',
  });
  res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  res.end();
};
