// GET /api/audit - the change log (administrators only). Newest first.
import { getDb, handle, json } from '../_lib/db.js';
import { requireAdmin } from '../_lib/auth.js';

export const onRequestGet = handle(async ({ env, request }) => {
  await requireAdmin(request, env);
  const db = await getDb(env);
  const limit = Math.min(500, Math.max(1, Number(new URL(request.url).searchParams.get('limit')) || 200));
  const { results } = await db.prepare(
    'SELECT id, game_id AS gameId, action, actor, at, before_json AS beforeJson, after_json AS afterJson FROM audit_log ORDER BY id DESC LIMIT ?')
    .bind(limit).all();
  const parse = (t) => { try { return t ? JSON.parse(t) : null; } catch (e) { return null; } };
  return json({ entries: results.map((r) => ({ id: r.id, gameId: r.gameId, action: r.action, actor: r.actor, at: r.at, before: parse(r.beforeJson), after: parse(r.afterJson) })) });
});
