// Validation for a game entered on the admin page. The same rules run on the server no matter
// what the page does, so bad data can't get in by any route.

import { HttpError } from './db.js';

export const STATUSES = ['final', 'forfeit', 'cancelled', 'scheduled'];
export const DIVISIONS = ['D1/2', 'D3', 'D4', 'Crossover'];
export const GAME_TYPES = ['regular', 'league', 'tournament', 'playoff'];

const clean = (v, max = 120) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};
const toInt = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};
const validDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/**
 * Check a game and return the clean values to store.
 * Throws HttpError(422, ..., { fields }) with a message per field, or 409 for a likely duplicate.
 */
export async function validateGame(db, body, { seasonId, selfId = 0 }) {
  const fields = {};
  const status = body.status || 'final';
  const homeId = toInt(body.homeId), awayId = toInt(body.awayId);

  if (!STATUSES.includes(status)) fields.status = 'Choose Final, Forfeit, Cancelled or Not played yet.';
  if (!DIVISIONS.includes(body.division)) fields.division = 'Choose the division.';
  if (!validDate(body.date)) fields.date = 'Enter the game date.';
  if (!homeId) fields.home = 'Choose the home team.';
  if (!awayId) fields.away = 'Choose the away team.';
  if (homeId && awayId && homeId === awayId) fields.away = 'A team cannot play itself.';

  if (homeId && awayId && homeId !== awayId) {
    const { results } = await db
      .prepare('SELECT school_id FROM season_schools WHERE season_id = ? AND school_id IN (?, ?)')
      .bind(seasonId, homeId, awayId).all();
    const have = new Set(results.map((r) => r.school_id));
    if (!have.has(homeId)) fields.home = 'This team is not in this season.';
    if (!have.has(awayId)) fields.away = 'This team is not in this season.';
  }

  let homeScore = null, awayScore = null;
  if (status === 'final') {
    homeScore = toInt(body.homeScore);
    awayScore = toInt(body.awayScore);
    const bad = (n) => n === null || Number.isNaN(n) || n < 0 || n > 99;
    if (bad(homeScore)) fields.homeScore = 'Enter a score from 0 to 99.';
    if (bad(awayScore)) fields.awayScore = 'Enter a score from 0 to 99.';
  } else if (status === 'forfeit') {
    // A forfeit is recorded as a 1-0 win for the team that did not forfeit.
    if (body.winner !== 'home' && body.winner !== 'away') fields.winner = 'Choose which team won the forfeit.';
    else { homeScore = body.winner === 'home' ? 1 : 0; awayScore = body.winner === 'home' ? 0 : 1; }
  }

  // A score can't be entered for a game that hasn't happened yet (judged on New England's calendar).
  if ((status === 'final' || status === 'forfeit') && validDate(body.date) && !fields.date) {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    if (body.date > today) fields.date = 'This game is in the future. Scores can be entered on or after the game date.';
  }

  if (Object.keys(fields).length) throw new HttpError(422, 'Fix the highlighted fields.', { fields });

  if (!body.force) {
    const dup = await db
      .prepare(`SELECT g.id, h.name AS home, a.name AS away, g.home_score AS homeScore, g.away_score AS awayScore, g.status
                FROM games g JOIN schools h ON h.id = g.home_id JOIN schools a ON a.id = g.away_id
                WHERE g.season_id = ? AND g.game_date = ? AND g.id != ?
                  AND ((g.home_id = ? AND g.away_id = ?) OR (g.home_id = ? AND g.away_id = ?))`)
      .bind(seasonId, body.date, selfId, homeId, awayId, awayId, homeId).first();
    if (dup) {
      throw new HttpError(409, 'These two teams already have a game saved on this date.', { duplicate: dup });
    }
  }

  const gameType = GAME_TYPES.includes(body.gameType) ? body.gameType : 'regular';
  return {
    seasonId, date: body.date, homeId, awayId, status, homeScore, awayScore,
    overtime: status === 'final' && body.overtime ? 1 : 0,
    gameType, division: body.division, note: clean(body.note),
  };
}

/** Same shape the page and the ranking engine read. */
export const GAME_SELECT = `SELECT g.id, g.season_id AS season, g.game_date AS date, g.home_id AS homeId, g.away_id AS awayId,
  h.name AS home, a.name AS away, g.home_score AS homeScore, g.away_score AS awayScore, g.status, g.overtime,
  g.game_type AS gameType, g.division, g.note, g.updated_at AS updatedAt, g.created_at AS createdAt
  FROM games g JOIN schools h ON h.id = g.home_id JOIN schools a ON a.id = g.away_id`;
