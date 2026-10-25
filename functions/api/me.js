// GET /api/me - tells the page whether the visitor is a signed-in administrator.
import { handle, json } from '../_lib/db.js';
import { getAdmin } from '../_lib/auth.js';

export const onRequestGet = handle(async ({ env, request }) => {
  const admin = await getAdmin(request, env);
  return json({ admin: !!admin, email: admin ? admin.email : null });
});
