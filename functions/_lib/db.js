// Database access, schema bootstrap and small response helpers shared by every API route.

import { DIVISIONS_2026 } from './divisions2026.js';

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

/** Wrap a route handler so thrown HttpErrors become clean JSON errors. */
export const handle = (fn) => async (ctx) => {
  try {
    return await fn(ctx);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, ...(e.extra || {}) }, e.status);
    console.error(e);
    return json({ error: 'Something went wrong on the server. Try again.' }, 500);
  }
};

// One statement per entry (D1 batches prepared statements). Creating tables on first use
// means there is no separate migration step to run by hand.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS seasons (id TEXT PRIMARY KEY, label TEXT NOT NULL, is_current INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS schools (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, match_regex TEXT)`,
  `CREATE TABLE IF NOT EXISTS season_schools (season_id TEXT NOT NULL, school_id INTEGER NOT NULL, class TEXT NOT NULL, class_num INTEGER NOT NULL, league TEXT, PRIMARY KEY (season_id, school_id))`,
  `CREATE TABLE IF NOT EXISTS games (id INTEGER PRIMARY KEY AUTOINCREMENT, season_id TEXT NOT NULL, game_date TEXT NOT NULL, home_id INTEGER NOT NULL, away_id INTEGER NOT NULL, home_score INTEGER, away_score INTEGER, status TEXT NOT NULL DEFAULT 'final' CHECK (status IN ('final','forfeit','cancelled','scheduled')), overtime INTEGER NOT NULL DEFAULT 0, game_type TEXT NOT NULL DEFAULT 'regular', division TEXT, note TEXT, created_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_by TEXT, updated_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_games_season ON games (season_id, game_date)`,
  `CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, game_id INTEGER, action TEXT NOT NULL, actor TEXT, at TEXT DEFAULT CURRENT_TIMESTAMP, before_json TEXT, after_json TEXT)`,
];

let schemaReady = false;

export async function getDb(env) {
  if (!env.DB) {
    throw new HttpError(500, 'The database is not connected yet. In Cloudflare, bind a D1 database to this project with the variable name DB.');
  }
  if (!schemaReady) {
    await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
    // Each school's division (geographic, shown for ranking within a division; never used in the math).
    // Added after launch, so add the column once and fill it from the 2026 list.
    const cols = (await env.DB.prepare('PRAGMA table_info(season_schools)').all()).results;
    if (!cols.some((c) => c.name === 'division')) {
      await env.DB.prepare('ALTER TABLE season_schools ADD COLUMN division TEXT').run();
      await batchInChunks(env.DB, Object.entries(DIVISIONS_2026).map(([name, d]) =>
        env.DB.prepare('UPDATE season_schools SET division = ? WHERE division IS NULL AND school_id = (SELECT id FROM schools WHERE name = ?)').bind(d, name)));
    }
    schemaReady = true;
  }
  return env.DB;
}

/** Run prepared statements in chunks (D1 limits how many go in one batch). */
export async function batchInChunks(db, statements, size = 40) {
  for (let i = 0; i < statements.length; i += size) {
    await db.batch(statements.slice(i, i + size));
  }
}
