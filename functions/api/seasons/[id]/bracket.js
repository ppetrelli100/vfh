// PUT /api/seasons/:id/bracket - lock or unlock the playoff seeds.
// Body: { locked: { A: [names in seed order, up to 8], B: [...], C: [...] } } to lock, or { locked: null } to unlock.
// Once locked, the Playoffs page shows these seeds and playoff games fill in the bracket; seeds stop moving with
// later score changes. Administrators only; every change goes in the audit log.
import { getDb, handle, json, HttpError } from '../../../_lib/db.js';
import { requireAdmin } from '../../../_lib/auth.js';

export const onRequestPut = handle(async ({ env, request, params }) => {
  const admin = await requireAdmin(request, env);
  const db = await getDb(env);
  const sid = String(params.id || '');
  const row = await db.prepare('SELECT bracket_lock AS lock FROM seasons WHERE id = ?').bind(sid).first();
  if (!row) throw new HttpError(404, 'That season no longer exists. Reload the page.');
  const body = await request.json().catch(() => { throw new HttpError(400, 'The request was not valid JSON.'); });
  let value = null;
  if (body.locked !== null && body.locked !== undefined) {
    const names = new Set((await db.prepare('SELECT s.name FROM season_schools ss JOIN schools s ON s.id = ss.school_id WHERE ss.season_id = ?').bind(sid).all()).results.map((r) => r.name));
    const out = {};
    for (const [cls, list] of Object.entries(body.locked)) {
      if (!Array.isArray(list) || list.length > 8) throw new HttpError(422, 'Each class needs a list of up to 8 schools.');
      const clean = list.map((n) => (n === null ? null : String(n)));
      if (clean.some((n) => n !== null && !names.has(n)) || new Set(clean.filter(Boolean)).size !== clean.filter(Boolean).length) throw new HttpError(422, 'The seeds include a school that is not in this season, or one twice.');
      out[String(cls).slice(0, 4)] = clean;
    }
    value = JSON.stringify(out);
  }
  if (value !== row.lock) {
    await db.prepare('UPDATE seasons SET bracket_lock = ? WHERE id = ?').bind(value, sid).run();
    await db.prepare('INSERT INTO audit_log (action, actor, before_json, after_json) VALUES (?, ?, ?, ?)')
      .bind('playoff-lock', admin.email, JSON.stringify({ season: sid, locked: row.lock ? JSON.parse(row.lock) : null }), JSON.stringify({ season: sid, locked: value ? JSON.parse(value) : null })).run();
  }
  return json({ locked: value ? JSON.parse(value) : null });
});
