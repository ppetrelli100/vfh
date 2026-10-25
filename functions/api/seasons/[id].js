// DELETE /api/seasons/:id - remove a whole season (its games and its school list) - administrators only.
// The schools themselves are shared between seasons, so they stay. A summary goes in the audit log.
import { getDb, handle, json, HttpError } from '../../_lib/db.js';
import { requireAdmin } from '../../_lib/auth.js';

export const onRequestDelete = handle(async ({ env, request, params }) => {
  const admin = await requireAdmin(request, env);
  const db = await getDb(env);
  const id = String(params.id || '');
  const season = await db.prepare('SELECT id, label, is_current AS isCurrent FROM seasons WHERE id = ?').bind(id).first();
  if (!season) throw new HttpError(404, 'That season no longer exists. Reload the page.');
  const games = (await db.prepare('SELECT COUNT(*) AS n FROM games WHERE season_id = ?').bind(id).first()).n;
  const stmts = [
    db.prepare('DELETE FROM games WHERE season_id = ?').bind(id),
    db.prepare('DELETE FROM season_schools WHERE season_id = ?').bind(id),
    db.prepare('DELETE FROM seasons WHERE id = ?').bind(id),
  ];
  // If the current season was removed, the newest remaining one takes its place.
  if (season.isCurrent) {
    stmts.push(db.prepare('UPDATE seasons SET is_current = 1 WHERE id = (SELECT id FROM seasons ORDER BY created_at DESC, rowid DESC LIMIT 1)'));
  }
  await db.batch(stmts);
  await db.prepare('INSERT INTO audit_log (action, actor, before_json) VALUES (?, ?, ?)')
    .bind('season-delete', admin.email, JSON.stringify({ ...season, games })).run();
  return json({ deleted: id, games });
});
