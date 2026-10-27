// PUT /api/games/:id - change a game; DELETE /api/games/:id - remove it (administrators only).
// Every change is written to the audit log with the before and after values.
import { getDb, handle, json, HttpError } from '../../_lib/db.js';
import { requireAdmin } from '../../_lib/auth.js';
import { validateGame, GAME_SELECT } from '../../_lib/games.js';

async function loadGame(db, params) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) throw new HttpError(400, 'Invalid game id.');
  const existing = await db.prepare(`${GAME_SELECT} WHERE g.id = ?`).bind(id).first();
  if (!existing) throw new HttpError(404, 'That game no longer exists. Reload the page.');
  return existing;
}

export const onRequestPut = handle(async ({ env, request, params }) => {
  const admin = await requireAdmin(request, env);
  const db = await getDb(env);
  const before = await loadGame(db, params);
  const body = await request.json().catch(() => { throw new HttpError(400, 'The request was not valid JSON.'); });
  // Editing a game whose date and teams are unchanged (say, fixing a score in a doubleheader)
  // should not ask about duplicates again; only moving it onto an already-used slot should.
  const h = Number(body.homeId), a = Number(body.awayId);
  const sameSlot = body.date === before.date &&
    ((h === before.homeId && a === before.awayId) || (h === before.awayId && a === before.homeId));
  // The admin form has no division field, so an edit keeps the division the game already has.
  const g = await validateGame(db, { ...body, division: body.division === undefined ? before.division : body.division, force: body.force || sameSlot }, { seasonId: before.season, selfId: before.id });
  await db.prepare(
    `UPDATE games SET game_date = ?, home_id = ?, away_id = ?, home_score = ?, away_score = ?, status = ?, overtime = ?,
       game_type = ?, division = ?, note = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(g.date, g.homeId, g.awayId, g.homeScore, g.awayScore, g.status, g.overtime, g.gameType, g.division, g.note, admin.email, before.id).run();
  const after = await db.prepare(`${GAME_SELECT} WHERE g.id = ?`).bind(before.id).first();
  await db.prepare('INSERT INTO audit_log (game_id, action, actor, before_json, after_json) VALUES (?, ?, ?, ?, ?)')
    .bind(before.id, 'update', admin.email, JSON.stringify(before), JSON.stringify(after)).run();
  return json({ game: after });
});

export const onRequestDelete = handle(async ({ env, request, params }) => {
  const admin = await requireAdmin(request, env);
  const db = await getDb(env);
  const before = await loadGame(db, params);
  await db.prepare('DELETE FROM games WHERE id = ?').bind(before.id).run();
  await db.prepare('INSERT INTO audit_log (game_id, action, actor, before_json) VALUES (?, ?, ?, ?)')
    .bind(before.id, 'delete', admin.email, JSON.stringify(before)).run();
  return json({ deleted: before.id });
});
