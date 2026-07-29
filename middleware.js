import { next } from '@vercel/edge';
export const config = { matcher: '/:path*' };

function b64urlBytes(bytes) { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function verify(token, secret) {
  if (!token || token.indexOf('.') < 0) return null;
  const [p, sig] = token.split('.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(p));
  const expected = b64urlBytes(new Uint8Array(mac));
  if (expected.length !== sig.length) return null;
  let diff = 0; for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return null;
  try { const payload = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/'))); if (payload.x < Math.floor(Date.now() / 1000)) return null; return payload; } catch (e) { return null; }
}
export default async function middleware(request) {
  const p = new URL(request.url).pathname;
  // always-public: the login page + the auth endpoints themselves
  if (p === '/login.html' || p.startsWith('/api/login') || p.startsWith('/api/callback') || p.startsWith('/api/logout')) return next();
  const cid = process.env.GOOGLE_CLIENT_ID, ssec = process.env.SESSION_SECRET;
  // fail-open until Google login is configured -> no downtime during setup
  if (!cid || !ssec) return next();
  const m = (request.headers.get('cookie') || '').match(/(?:^|;\s*)mm_sess=([^;]+)/);
  const sess = m ? decodeURIComponent(m[1]) : null;
  if (sess && await verify(sess, ssec)) return next();
  return Response.redirect(new URL('/login.html', request.url).toString(), 302);
}
