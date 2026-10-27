/* Playoff seeding — replaces the Seeding tab.
 * For one class: take the top 12 by Saylor points/game, compare every pair of teams on
 * 7 criteria (each criterion: strictly better = 1, else 0). The team with the higher
 * criteria total wins the pair (1 pt); if the totals are equal, the better points/game wins.
 * A team's pair points across the other 11 teams = its total; highest total = #1 seed.
 * Ties on total are broken by points/game. Top 8 make the playoffs: 1v8, 4v5, 3v6, 2v7.
 */
(function (root) {
  'use strict';
  const E = (typeof require !== 'undefined') ? require('./engine.js') : root.FHEngine;

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
    const T = top12(rows, cls, opts.size);
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
      d.win = sum > sumC ? 1 : sum < sumC ? 0 : (R.spPerGame > C.spPerGame ? 1 : 0);
      return d;
    }));
    const total = detail.map((row) => row.reduce((s, d) => s + (d ? d.win : 0), 0));
    // Tie-break: if a total is duplicated, add points/game/100000. The sheet only looks for
    // duplicates among the first 8 rows (a quirk kept unless opts.fixDupeRange).
    const dupeRange = opts.fixDupeRange ? n : Math.min(8, n);
    const adj = total.map((t, i) => (total.slice(0, dupeRange).filter((x) => x === t).length > 1 ? T[i].spPerGame / 100000 : 0));
    const H = total.map((t, i) => t + adj[i]);
    const finalRank = H.map((h) => H.filter((x) => x > h).length + 1);
    const table = T.map((r, i) => ({ name: r.name, spRank: i + 1, spPerGame: r.spPerGame, total: total[i], seed: finalRank[i] }))
      .sort((a, b) => a.seed - b.seed || a.spRank - b.spRank);
    // pos = place in the order shown. Teams level on pairings won and on points per game share
    // `seed` and are flagged `tie`; the bracket fills slots by place so no team drops out of it.
    table.forEach((x, i) => { x.pos = i + 1; x.tie = table.some((o) => o !== x && o.seed === x.seed && o.spPerGame === x.spPerGame); });
    const by = (s) => (table[s - 1] || {}).name || null;
    const bracket = [[1, 8], [4, 5], [3, 6], [2, 7]].map(([a, b]) => ({ high: { seed: a, name: by(a) }, low: { seed: b, name: by(b) } }));
    return { cls, top12: T.map((r) => r.name), crit, detail, total, finalRank, table, bracket };
  }

  const api = { seed, top12, mutualWinPct };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FHSeeding = api;
})(typeof self !== 'undefined' ? self : this);
