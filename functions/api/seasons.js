// POST /api/seasons - start a new season, optionally copying last season's schools and classes.
// Class assignments often change year to year, so each season keeps its own copy.
import { getDb, handle, json, HttpError } from '../_lib/db.js';
import { requireAdmin } from '../_lib/auth.js';

export const onRequestPost = handle(async ({ env, request }) => {
  const admin = await requireAdmin(request, env);
  const db = await getDb(env);
  const body = await request.json().catch(() => { throw new HttpError(400, 'The request was not valid JSON.'); });
  const id = String(body.id || '').trim(), label = String(body.label || '').trim();
  if (!/^[\w-]{2,20}$/.test(id)) throw new HttpError(422, 'Use a short season id such as 2026.');
  if (!label) throw new HttpError(422, 'Give the season a name, for example "2026 season".');
  if (await db.prepare('SELECT 1 FROM seasons WHERE id = ?').bind(id).first()) throw new HttpError(409, `Season ${id} already exists.`);

  const stmts = [db.prepare('INSERT INTO seasons (id, label, is_current) VALUES (?, ?, 0)').bind(id, label)];
  if (body.copyFrom) {
    stmts.push(db.prepare('INSERT INTO season_schools (season_id, school_id, class, class_num, league) SELECT ?, school_id, class, class_num, league FROM season_schools WHERE season_id = ? ORDER BY rowid')
      .bind(id, String(body.copyFrom)));
  }
  if (body.isCurrent) stmts.push(db.prepare('UPDATE seasons SET is_current = CASE WHEN id = ? THEN 1 ELSE 0 END').bind(id));
  await db.batch(stmts);
  await db.prepare('INSERT INTO audit_log (action, actor, after_json) VALUES (?, ?, ?)')
    .bind('season', admin.email, JSON.stringify({ id, label, copyFrom: body.copyFrom || null })).run();
  return json({ season: { id, label } }, 201);
});
