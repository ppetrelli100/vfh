// GET /api/data?season=fall-2024
// Everything the public pages need in one call: the seasons list, that season's schools (with
// class and league) and every game. The ranking and seeding math runs in the browser from this.

import { getDb, handle, json, HttpError } from '../_lib/db.js';
import { GAME_SELECT } from '../_lib/games.js';

export const onRequestGet = handle(async ({ env, request }) => {
  const db = await getDb(env);
  const seasons = (await db.prepare('SELECT id, label, is_current AS isCurrent, playoff_pool AS playoffPool, bracket_lock AS bracketLock FROM seasons ORDER BY id DESC').all()).results;
  if (!seasons.length) return json({ seasons: [], season: null, schools: [], games: [] });

  const wanted = new URL(request.url).searchParams.get('season');
  const season = wanted ? seasons.find((s) => s.id === wanted) : seasons.find((s) => s.isCurrent) || seasons[0];
  if (!season) throw new HttpError(404, 'That season does not exist.');

  const schools = (await db.prepare(
    `SELECT s.id, s.name, ss.class AS cls, ss.class_num AS classNum, ss.league, ss.division,
           ss.playoff_out AS playoffOut, ss.playoff_note AS playoffNote
       FROM season_schools ss JOIN schools s ON s.id = ss.school_id
      WHERE ss.season_id = ? ORDER BY ss.rowid`).bind(season.id).all()).results;
  try { season.bracketLock = season.bracketLock ? JSON.parse(season.bracketLock) : null; } catch (e) { season.bracketLock = null; }
  const games = (await db.prepare(`${GAME_SELECT} WHERE g.season_id = ? ORDER BY g.game_date, g.id`).bind(season.id).all()).results;
  return json({ seasons, season, schools, games });
});
