// POST /api/import - load a whole season (schools with classes, plus games) in one go.
// Used to load the 2025 test season from /seed/2025.json, and later to bring in any season
// kept elsewhere. With replace=true the season's existing games and school list are swapped out.
import { getDb, handle, json, HttpError, batchInChunks } from '../_lib/db.js';
import { requireAdmin } from '../_lib/auth.js';

function normalizeGame(g) {
  const note = g.note ? String(g.note) : '';
  let status = g.status;
  if (!status) status = /cancel/i.test(note) ? 'cancelled' : /forfeit/i.test(note) ? 'forfeit' : 'final';
  const hs = g.homeScore ?? null, as = g.awayScore ?? null;
  if (status === 'final' && (hs === null || as === null)) status = 'scheduled';
  let homeScore = hs, awayScore = as;
  if (status === 'cancelled' || status === 'scheduled') { homeScore = null; awayScore = null; }
  // Forfeits count as a 1-0 win for the team that did not forfeit.
  if (status === 'forfeit' && hs !== null && as !== null && hs !== as) { homeScore = hs > as ? 1 : 0; awayScore = hs > as ? 0 : 1; }
  const overtime = status === 'final' && (g.overtime ?? /\bOT\b/i.test(note)) ? 1 : 0;
  return { status, homeScore, awayScore, overtime };
}

export const onRequestPost = handle(async ({ env, request }) => {
  const admin = await requireAdmin(request, env);
  const db = await getDb(env);
  const body = await request.json().catch(() => { throw new HttpError(400, 'The request was not valid JSON.'); });
  const { season, schools, games, replace } = body;
  if (!season || !season.id || !season.label) throw new HttpError(422, 'The import needs a season with an id and a label.');
  if (!Array.isArray(schools) || !schools.length) throw new HttpError(422, 'The import needs a list of schools.');

  const stmts = [
    db.prepare('INSERT INTO seasons (id, label, is_current) VALUES (?, ?, 0) ON CONFLICT(id) DO UPDATE SET label = excluded.label').bind(season.id, season.label),
  ];
  if (season.isCurrent) stmts.push(db.prepare('UPDATE seasons SET is_current = CASE WHEN id = ? THEN 1 ELSE 0 END').bind(season.id));
  for (const s of schools) {
    stmts.push(db.prepare('INSERT INTO schools (name, match_regex) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET match_regex = COALESCE(excluded.match_regex, schools.match_regex)')
      .bind(s.name, s.matchRegex ?? null));
  }
  await batchInChunks(db, stmts);

  const ids = new Map((await db.prepare('SELECT id, name FROM schools').all()).results.map((r) => [r.name, r.id]));
  const next = [];
  if (replace) {
    next.push(db.prepare('DELETE FROM games WHERE season_id = ?').bind(season.id));
    next.push(db.prepare('DELETE FROM season_schools WHERE season_id = ?').bind(season.id));
  }
  for (const s of schools) {
    next.push(db.prepare('INSERT OR REPLACE INTO season_schools (season_id, school_id, class, class_num, league) VALUES (?, ?, ?, ?, ?)')
      .bind(season.id, ids.get(s.name), s.cls, s.classNum, s.league ?? null));
  }
  const unknown = new Set();
  for (const g of games || []) {
    const h = ids.get(g.home), a = ids.get(g.away);
    if (!h) unknown.add(g.home);
    if (!a) unknown.add(g.away);
    if (!h || !a) continue;
    const n = normalizeGame(g);
    next.push(db.prepare(
      `INSERT INTO games (season_id, game_date, home_id, away_id, home_score, away_score, status, overtime, game_type, division, note, created_by, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'regular', ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
      .bind(season.id, g.date, h, a, n.homeScore, n.awayScore, n.status, n.overtime, g.division ?? null, g.note ?? null, admin.email, admin.email));
  }
  if (unknown.size) throw new HttpError(422, `These team names are not in the school list: ${[...unknown].slice(0, 8).join(', ')}`);
  await batchInChunks(db, next);
  await db.prepare('INSERT INTO audit_log (action, actor, after_json) VALUES (?, ?, ?)')
    .bind('import', admin.email, JSON.stringify({ season: season.id, schools: schools.length, games: (games || []).length, replace: !!replace })).run();
  return json({ season: season.id, schools: schools.length, games: (games || []).length });
});
