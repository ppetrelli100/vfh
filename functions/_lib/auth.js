// Admin check. Writes are allowed only for a person who signed in through Cloudflare Access.
//
// Cloudflare Access puts a signed token (a JWT) in the CF_Authorization cookie, and in the
// Cf-Access-Jwt-Assertion header for requests that pass through an Access-protected path.
// We verify the signature, audience and expiry ourselves, so protecting just /admin* in Access
// is enough: the API calls the admin page makes carry the same cookie.
//
// Environment variables (Cloudflare dashboard > the Pages project > Settings > Variables):
//   ACCESS_TEAM_DOMAIN  e.g. yourteam.cloudflareaccess.com
//   ACCESS_AUD          the Application Audience (AUD) tag of the Access application
//   ADMIN_EMAILS        optional, comma-separated allow-list (extra safety on top of the Access policy)
// If the first two are not set, nobody is an admin (fails closed).

import { HttpError } from './db.js';

let certCache = { at: 0, keys: null };

const b64urlToBytes = (s) => {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  s += '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const b64urlToJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

function readToken(request) {
  const h = request.headers.get('Cf-Access-Jwt-Assertion');
  if (h) return h;
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return m ? m[1] : null;
}

async function getKeys(team) {
  if (certCache.keys && Date.now() - certCache.at < 3600_000) return certCache.keys;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error('Could not load Access signing keys');
  const { keys } = await res.json();
  certCache = { at: Date.now(), keys };
  return keys;
}

/** Returns { email } for a verified admin, or null. */
export async function getAdmin(request, env) {
  // Local development only: wrangler dev serves on localhost, which a deployed site never does.
  if (env.DEV_ADMIN_EMAIL && new URL(request.url).hostname === 'localhost') {
    return { email: env.DEV_ADMIN_EMAIL };
  }
  const team = env.ACCESS_TEAM_DOMAIN, aud = env.ACCESS_AUD;
  if (!team || !aud) return null;
  const token = readToken(request);
  if (!token) return null;
  try {
    const [h, p, s] = token.split('.');
    const header = b64urlToJson(h), payload = b64urlToJson(p);
    const jwk = (await getKeys(team)).find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`));
    if (!ok) return null;
    const audOk = Array.isArray(payload.aud) ? payload.aud.includes(aud) : payload.aud === aud;
    if (!audOk || payload.iss !== `https://${team}` || payload.exp * 1000 < Date.now()) return null;
    const email = String(payload.email || '').toLowerCase();
    if (!email) return null;
    if (env.ADMIN_EMAILS) {
      const allowed = env.ADMIN_EMAILS.toLowerCase().split(',').map((x) => x.trim()).filter(Boolean);
      if (!allowed.includes(email)) return null;
    }
    return { email };
  } catch (e) {
    console.error('Access token check failed', e);
    return null;
  }
}

export async function requireAdmin(request, env) {
  const admin = await getAdmin(request, env);
  if (!admin) throw new HttpError(401, 'Sign in as an administrator to change scores.');
  return admin;
}
