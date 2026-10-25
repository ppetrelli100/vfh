// POST /api/games - add a game (administrators only).
import { getDb, handle, json, HttpError } from '../../_lib/db.js';
import { requireAdmin } from '../../_lib/auth.js';
import { validateGame, GAME_SELECT } from '../../_lib/games.js';

export const onRequestPost = handle(async ({ env, request }) => {
  const admin = await requireAdmin(request, env);
  const db = await getDb(env);
  const body = await request.json().catch(() => { throw new HttpError(400, 'The request was not valid JSON.'); });

  const seasonId = String(body.season || '');
  const season = await db.prepare('SELECT id FROM seasons WHERE id = ?').bind(seasonId).first();
  if (!season) throw new HttpError(422, 'Choose a season first.', { fields: { season: 'Choose a season.' } });

  const g = await validateGame(db, body, { seasonId });
  const res = await db.prepare(
    `INSERT INTO games (season_id, game_date, home_id, away_id, home_score, away_score, status, overtime, game_type, division, note, created_by, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
    .bind(g.seasonId, g.date, g.homeId, g.awayId, g.homeScore, g.awayScore, g.status, g.overtime, g.gameType, g.division, g.note, admin.email, admin.email).run();
  const id = res.meta.last_row_id;
  const saved = await db.prepare(`${GAME_SELECT} WHERE g.id = ?`).bind(id).first();
  await db.prepare('INSERT INTO audit_log (game_id, action, actor, after_json) VALUES (?, ?, ?, ?)')
    .bind(id, 'create', admin.email, JSON.stringify(saved)).run();
  return json({ game: saved }, 201);
});
