# NEPSAC Field Hockey (vfh)

Rankings, game log and playoff seeding for varsity field hockey, with an administrator page for entering scores.

- Cloudflare Pages (static site in `public/`) + Pages Functions (`functions/`) + D1 database bound as `DB`.
- Rankings and seeding are computed in the browser by `public/js/engine.js` and `public/js/seeding-engine.js`.
- `/admin*` is protected by Cloudflare Access; the API also verifies the Access token (`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, optional `ADMIN_EMAILS`).
- Forfeits count as a 1-0 win for the non-forfeiting team.

Local: `npm install`, `npm test`, `npm run dev` (set `DEV_ADMIN_EMAIL` in `.dev.vars` to use /admin.html locally).
