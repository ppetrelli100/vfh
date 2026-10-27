// PUT /api/seasons/:id/schools - change which schools are in a season and their classes.
// Classes change from year to year and each season keeps its own copy, so this only touches
// the season named in the URL. Body: { changes: [{ name, cls?, league?, remove? }] }.
//   - a school already in the season: its class and/or league is updated, or it is taken out
//     (refused while that season has games for it);
//   - a school not yet in the season: it is added (a class is required; a brand-new school
//     name is created).
// Administrators only. What changed is written to the audit log.
import { getDb, handle, json, HttpError } from '../../../_lib/db.js';
import { requireAdmin } from '../../../_lib/auth.js';

const CLASS_NUM = { A: 1, B: 2, C: 3 };   // the Saylor point rules are defined for classes A, B and C

export const onRequestPut = handle(async ({ env, request, params }) => {
  const admin = await requireAdmin(request, env);
  const db = await getDb(env);
  const sid = String(params.id || '');
  if (!(await db.prepare('SELECT 1 FROM seasons WHERE id = ?').bind(sid).first())) throw new HttpError(404, 'That season no longer exists. Reload the page.');
  const body = await request.json().catch(() => { throw new HttpError(400, 'The request was not valid JSON.'); });
  const changes = Array.isArray(body.changes) ? body.changes : [];
  if (!changes.length) throw new HttpError(422, 'There are no changes to save.');
  if (changes.length > 200) throw new HttpError(422, 'Too many changes at once.');

  const cur = new Map((await db.prepare(
    `SELECT s.id, s.name, ss.class AS cls, ss.league FROM season_schools ss JOIN schools s ON s.id = ss.school_id WHERE ss.season_id = ?`).bind(sid).all())
    .results.map((r) => [r.name, r]));
  const gameCount = async (schoolId) => (await db.prepare('SELECT COUNT(*) AS n FROM games WHERE season_id = ? AND (home_id = ? OR away_id = ?)').bind(sid, schoolId, schoolId).first()).n;

  const stmts = [], log = [];
  const seen = new Set();
  for (const c of changes) {
    const name = String(c.name || '').trim();
    if (!name || name.length > 60) throw new HttpError(422, 'Every change needs a school name.');
    if (seen.has(name)) throw new HttpError(422, `${name} appears twice in the changes.`);
    seen.add(name);
    const league = c.league === undefined ? undefined : (String(c.league || '').trim().slice(0, 40) || null);
    const cls = c.cls === undefined ? undefined : String(c.cls).trim().toUpperCase();
    if (cls !== undefined && !CLASS_NUM[cls]) throw new HttpError(422, `${name}: class must be A, B or C.`);
    const existing = cur.get(name);
    if (existing) {
      if (c.remove) {
        const n = await gameCount(existing.id);
        if (n) throw new HttpError(409, `${name} has ${n} game${n === 1 ? '' : 's'} in this season, so it can't be taken out. Remove or move those games first.`);
        stmts.push(db.prepare('DELETE FROM season_schools WHERE season_id = ? AND school_id = ?').bind(sid, existing.id));
        log.push({ name, removed: true, was: existing.cls });
        continue;
      }
      const newCls = cls ?? existing.cls, newLeague = league === undefined ? existing.league : league;
      if (newCls === existing.cls && newLeague === existing.league) continue;
      stmts.push(db.prepare('UPDATE season_schools SET class = ?, class_num = ?, league = ? WHERE season_id = ? AND school_id = ?')
        .bind(newCls, CLASS_NUM[newCls], newLeague, sid, existing.id));
      log.push({ name, cls: [existing.cls, newCls], league: [existing.league, newLeague] });
    } else {
      if (c.remove) continue;
      if (!cls) throw new HttpError(422, `${name} is not in this season yet, so choose a class for it.`);
      await db.prepare('INSERT INTO schools (name) VALUES (?) ON CONFLICT(name) DO NOTHING').bind(name).run();
      const sch = await db.prepare('SELECT id FROM schools WHERE name = ?').bind(name).first();
      stmts.push(db.prepare('INSERT OR REPLACE INTO season_schools (season_id, school_id, class, class_num, league) VALUES (?, ?, ?, ?, ?)')
        .bind(sid, sch.id, cls, CLASS_NUM[cls], league ?? null));
      log.push({ name, added: true, cls });
    }
  }
  if (stmts.length) await db.batch(stmts);
  await db.prepare('INSERT INTO audit_log (action, actor, after_json) VALUES (?, ?, ?)')
    .bind('classes', admin.email, JSON.stringify({ season: sid, changes: log })).run();
  return json({ changed: log.length });
});
