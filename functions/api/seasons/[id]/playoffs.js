// PUT /api/seasons/:id/playoffs - mark a school as not playing in the playoffs (or put it back).
// Body: { name, out: true|false, note? }. The school stays in the rankings and its games still
// count for everyone else; it is only left out of the playoff seeding and bracket.
// Administrators only. Every change is written to the audit log.
import { getDb, handle, json, HttpError } from '../../../_lib/db.js';
import { requireAdmin } from '../../../_lib/auth.js';

export const onRequestPut = handle(async ({ env, request, params }) => {
  const admin = await requireAdmin(request, env);
  const db = await getDb(env);
  const sid = String(params.id || '');
  if (!(await db.prepare('SELECT 1 FROM seasons WHERE id = ?').bind(sid).first())) throw new HttpError(404, 'That season no longer exists. Reload the page.');
  const body = await request.json().catch(() => { throw new HttpError(400, 'The request was not valid JSON.'); });
  const name = String(body.name || '').trim();
  if (!name) throw new HttpError(422, 'Choose a school.');
  const row = await db.prepare(
    `SELECT ss.school_id AS id, ss.class AS cls, ss.playoff_out AS out, ss.playoff_note AS note
       FROM season_schools ss JOIN schools s ON s.id = ss.school_id WHERE ss.season_id = ? AND s.name = ?`).bind(sid, name).first();
  if (!row) throw new HttpError(404, `${name} is not in this season.`);
  const out = body.out ? 1 : 0;
  const note = out ? (String(body.note || '').trim().slice(0, 120) || null) : null;
  await db.prepare('UPDATE season_schools SET playoff_out = ?, playoff_note = ? WHERE season_id = ? AND school_id = ?').bind(out, note, sid, row.id).run();
  await db.prepare('INSERT INTO audit_log (action, actor, before_json, after_json) VALUES (?, ?, ?, ?)')
    .bind('playoffs', admin.email, JSON.stringify({ season: sid, name, out: !!row.out, note: row.note || null }),
      JSON.stringify({ season: sid, name, out: !!out, note })).run();
  return json({ name, out: !!out, note });
});
