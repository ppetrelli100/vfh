// PUT /api/seasons/:id/pool - choose which teams the Playoffs page compares.
// Body: { pool: 'top12' | 'all500' }. 'top12' compares the 12 teams in each class with the most Saylor points per
// game (the default); 'all500' compares every team with a .500 record overall or in class. Everyone who opens the
// Playoffs page sees the setting. Administrators only; every change goes in the audit log.
import { getDb, handle, json, HttpError } from '../../../_lib/db.js';
import { requireAdmin } from '../../../_lib/auth.js';

export const onRequestPut = handle(async ({ env, request, params }) => {
  const admin = await requireAdmin(request, env);
  const db = await getDb(env);
  const sid = String(params.id || '');
  const row = await db.prepare('SELECT playoff_pool AS pool FROM seasons WHERE id = ?').bind(sid).first();
  if (!row) throw new HttpError(404, 'That season no longer exists. Reload the page.');
  const body = await request.json().catch(() => { throw new HttpError(400, 'The request was not valid JSON.'); });
  const pool = body.pool;
  if (pool !== 'top12' && pool !== 'all500') throw new HttpError(422, 'Choose Top 12 or All .500+ teams.');
  if (pool !== row.pool) {
    await db.prepare('UPDATE seasons SET playoff_pool = ? WHERE id = ?').bind(pool, sid).run();
    await db.prepare('INSERT INTO audit_log (action, actor, before_json, after_json) VALUES (?, ?, ?, ?)')
      .bind('playoff-pool', admin.email, JSON.stringify({ season: sid, pool: row.pool }), JSON.stringify({ season: sid, pool })).run();
  }
  return json({ pool });
});
