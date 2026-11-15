/* Playoff seeding — replaces the Seeding tab.
 * For one class: take the top 12 by Saylor points/game, compare every pair of teams on
 * 7 criteria (each criterion: strictly better = 1, else 0). The team with the higher
 * criteria total wins the pair (1 pt); if the totals are equal, the better points/game wins.
 * A team's pair points across the other 11 teams = its total; highest total = #1 seed.
 * Ties on total are broken by head to head, then points/game, then in-class win %.
 * The bracket is the first 8 teams in that order that have a .500 record overall or in class
 * (.500 or better): 1v8, 4v5, 3v6, 2v7. Teams below .500 stay in the pool and in the comparisons but
 * cannot take a bracket slot. opts.poolRequires500 (off for 2026) also keeps them out of the pool of 12.
 * opts.excluded (names): teams that will not play in the playoffs. They are left out of the pool entirely,
 * so the next team in the class by points/game takes the 12th place. Their games still count in everyone's record.
 */
(function (root) {
  'use strict';
  const E = (typeof require !== 'undefined') ? require('./engine.js') : root.FHEngine;

  // .500 or better overall, or .500 or better in class. No games means no record, so it does not qualify.
  const meets500 = (r) => (r.winPct !== null && r.winPct !== undefined && r.winPct >= 0.5) ||
    (r.inWinPct !== null && r.inWinPct !== undefined && r.inWinPct >= 0.5);

  const num = (x) => (x === null || x === undefined || x === '' ? null : Number(x));

  function top12(rows, cls, n) {
    n = n || 12;
    return rows.filter((r) => r.cls === cls && r.spPerGame !== null)
      .map((r, i) => ({ r, i }))
      .sort((a, b) => b.r.spPerGame - a.r.spPerGame || a.i - b.i)   // stable, like QUERY ... ORDER BY DESC
      .slice(0, n).map((x) => x.r);
  }

  /** Mutual-opponent record: each team's win% against opponents both have played. */
  function mutualWinPct(games, team, other, opts) {
    const g = opts && opts.countUnplayed ? games.filter((x) => x.home && x.away)
      : E.playedGames(games);
    const oppsOf = (t) => new Set(g.filter((x) => x.home === t || x.away === t).map((x) => (x.home === t ? x.away : x.home)));
    const a = oppsOf(team), b = oppsOf(other);
    const mo = new Set([...a].filter((o) => b.has(o)));
    const pct = (t) => {
      let w = 0, tie = 0, gp = 0;
      for (const x of g) {
        if (x.home !== t && x.away !== t) continue;
        const opp = x.home === t ? x.away : x.home;
        if (!mo.has(opp)) continue;
        gp++;
        const my = num(x.home === t ? x.homeScore : x.awayScore) || 0, th = num(x.home === t ? x.awayScore : x.homeScore) || 0;
        if (my > th) w++; else if (my === th) tie++;
      }
      return gp ? (w + 0.5 * tie) / gp : 0;   // no mutual opponents -> 0 (sheet: IFERROR(...,0))
    };
    return { team: pct(team), other: pct(other), mutual: [...mo] };
  }

  function seed(rows, rec, games, cls, opts) {
    opts = opts || {};
    const skip = new Set(opts.excluded || []);
    const T = top12(rows.filter((r) => !skip.has(r.name) && (!opts.poolRequires500 || meets500(r))), cls, opts.size);
    const n = T.length;
    const gt = (a, b) => (a !== null && b !== null && a > b ? 1 : 0);
    const crit = ['winPct', 'spPerGame', 'inWinPct', 'gt500In', 'gt500Out', 'h2h', 'mutual'];
    const cell = (i, j, c) => {
      const R = T[i], C = T[j];
      switch (c) {
        case 'h2h': return ((rec[R.name][C.name] || { w: 0 }).w - (rec[C.name][R.name] || { w: 0 }).w) > 0 ? 1 : 0;
        case 'mutual': { const m = mutualWinPct(games, R.name, C.name, opts); return m.team > m.other ? 1 : 0; }
        default: return gt(R[c], C[c]);
      }
    };
    const detail = T.map((R, i) => T.map((C, j) => {
      if (i === j) return null;
      const d = {}; let sum = 0, sumC = 0;
      for (const c of crit) { d[c] = cell(i, j, c); d[c + '_opp'] = cell(j, i, c); sum += d[c]; sumC += d[c + '_opp']; }
      d.sum = sum; d.sumOpp = sumC;
      // Level on the measures: head-to-head decides it, then Saylor points per game, then in-class win percentage.
      const net = ((rec[R.name][C.name] || { w: 0 }).w) - ((rec[C.name][R.name] || { w: 0 }).w);
      d.h2hNet = net;
      if (sum !== sumC) { d.win = sum > sumC ? 1 : 0; d.by = 'measures'; }
      else if (net !== 0) { d.win = net > 0 ? 1 : 0; d.by = 'h2h'; }
      else if (R.spPerGame !== C.spPerGame) { d.win = R.spPerGame > C.spPerGame ? 1 : 0; d.by = 'sp'; }
      else if (R.inWinPct !== C.inWinPct && R.inWinPct !== null && C.inWinPct !== null) { d.win = R.inWinPct > C.inWinPct ? 1 : 0; d.by = 'inclass'; }
      else { d.win = 0; d.by = 'none'; }
      return d;
    }));
    const total = detail.map((row) => row.reduce((s, d) => s + (d ? d.win : 0), 0));
    // Seed order: pairings won; among teams level on that, head-to-head wins against each other
    // (just the teams in the tie), then Saylor points per game, then in-class win percentage.
    const h2hAmong = T.map((R, i) => T.reduce((s, C, j) => (j !== i && total[j] === total[i]
      ? s + (((rec[R.name][C.name] || { w: 0 }).w) - ((rec[C.name][R.name] || { w: 0 }).w)) : s), 0));
    const better = (i, j) => total[i] !== total[j] ? total[i] > total[j]
      : h2hAmong[i] !== h2hAmong[j] ? h2hAmong[i] > h2hAmong[j]
      : T[i].spPerGame !== T[j].spPerGame ? T[i].spPerGame > T[j].spPerGame
      : (T[i].inWinPct || 0) > (T[j].inWinPct || 0);
    const finalRank = T.map((_, i) => T.filter((__, j) => better(j, i)).length + 1);
    const table = T.map((r, i) => ({ name: r.name, spRank: i + 1, spPerGame: r.spPerGame, total: total[i], seed: finalRank[i] }))
      .sort((a, b) => a.seed - b.seed || a.spRank - b.spRank);
    // pos = place in the order shown. Teams level on pairings won and on points per game share
    // `seed` and are flagged `tie`; the bracket fills slots by place so no team drops out of it.
    table.forEach((x, i) => { x.pos = i + 1; x.tie = table.some((o) => o !== x && o.seed === x.seed); });
    // Bracket seeds go to the first 8 teams, in table order, that meet the .500 test.
    const rowOf = Object.fromEntries(rows.map((r) => [r.name, r]));
    let q = 0;
    table.forEach((x) => { x.eligible = meets500(rowOf[x.name]); x.bseed = x.eligible && q < 8 ? ++q : null; });
    const cutPos = table.reduce((m, x) => (x.bseed ? x.pos : m), 0);
    const by = (s) => (table.find((x) => x.bseed === s) || {}).name || null;
    const bracket = [[1, 8], [4, 5], [3, 6], [2, 7]].map(([a, b]) => ({ high: { seed: a, name: by(a) }, low: { seed: b, name: by(b) } }));
    return { cls, top12: T.map((r) => r.name), crit, detail, total, finalRank, table, bracket, cutPos };
  }

  /**
   * The playoff bracket from locked seeds and the playoff games played so far.
   * seeds: school names in seed order (seeds[0] is the 1 seed; missing = null). games: playoff games (any status).
   * Quarterfinals are 1v8, 4v5, 3v6, 2v7; the 1v8 winner meets the 4v5 winner, the 3v6 winner meets the 2v7 winner.
   * A game fills its slot when it was played between the two teams. A level score is settled by `soWinner` (shootout).
   * Returns { qf: [4], sf: [2], f: [1] }; each match is { a, b, game, winner } where a and b are { seed, name } and
   * winner is the winning side's name (null until decided). game: { aScore, bScore, overtime, so } from a's point of view.
   */
  function playoffBracket(seeds, games) {
    const played = (games || []).filter((g) => g.status === 'final' && g.homeScore !== null && g.awayScore !== null);
    const entrant = (seed) => ({ seed, name: (seeds && seeds[seed - 1]) || null });
    const play = (a, b) => {
      const out = { a, b, game: null, winner: null };
      if (!a || !b || !a.name || !b.name) return out;
      const g = played.filter((x) => (x.home === a.name && x.away === b.name) || (x.home === b.name && x.away === a.name))
        .sort((x, y) => String(x.date).localeCompare(String(y.date)) || x.id - y.id).pop();
      if (!g) return out;
      const aHome = g.home === a.name;
      const as = aHome ? g.homeScore : g.awayScore, bs = aHome ? g.awayScore : g.homeScore;
      const so = as === bs;
      const aWon = so ? (g.soWinner === (aHome ? 'home' : 'away')) : as > bs;
      if (so && !g.soWinner) return out;   // level with no shootout winner recorded: not a valid result
      out.game = { id: g.id, date: g.date, aScore: as, bScore: bs, overtime: g.overtime || 0, so };
      out.winner = aWon ? a.name : b.name;
      return out;
    };
    const win = (m) => (m.winner ? (m.winner === m.a.name ? m.a : m.b) : null);
    const qf = [[1, 8], [4, 5], [3, 6], [2, 7]].map(([x, y]) => play(entrant(x), entrant(y)));
    const sf = [play(win(qf[0]), win(qf[1])), play(win(qf[2]), win(qf[3]))];
    const f = [play(win(sf[0]), win(sf[1]))];
    return { qf, sf, f };
  }

  const api = { seed, top12, mutualWinPct, meets500, playoffBracket };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FHSeeding = api;
})(typeof self !== 'undefined' ? self : this);
