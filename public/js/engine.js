/* Field hockey ranking engine — replaces the Grid tab of the Google Sheets model.
 * Pure functions, no DOM, no I/O: usable in Node (tests) and in the browser.
 *
 * Input:
 *   schools: [{name, cls:'A', classNum:1, league}]
 *   games:   [{date, home, away, homeScore, awayScore, note}]  (names already standardized)
 * Output of rank(): per-school rows equivalent to the sheet's Ranking tab.
 */
(function (root) {
  'use strict';

  // A game is out of the math if its status says so (the web app) or its note says
  // "cancelled" (rows imported from the old sheet, which had no status column).
  // Forfeits need no special case: they are stored as 1-0 results.
  const isCancelled = (g) => g.status === 'cancelled' || g.status === 'scheduled' ||
    String(g.note || '').trim().toLowerCase() === 'cancelled';
  const num = (x) => (x === null || x === undefined || x === '' ? null : Number(x));

  // A game counts as played when both teams are known and both scores are numbers
  // (a cancelled game is never counted as a tie; the sheet only guards the Ties matrix,
  // and cancelled rows carry no scores, so excluding them everywhere is equivalent).
  function playedGames(games) {
    return games.filter((g) => g.home && g.away && g.home !== g.away && !isCancelled(g) &&
      num(g.homeScore) !== null && num(g.awayScore) !== null);
  }

  /** Build pairwise W/L/T counts: rec[a][b] = {w,l,t} from a's point of view. */
  function buildRecords(schools, games) {
    const rec = {};
    for (const s of schools) rec[s.name] = {};
    const get = (a, b) => (rec[a][b] = rec[a][b] || { w: 0, l: 0, t: 0 });
    for (const g of playedGames(games)) {
      if (!rec[g.home] || !rec[g.away]) continue; // unknown school: ignored, as in the sheet
      const h = num(g.homeScore), a = num(g.awayScore);
      if (h > a) { get(g.home, g.away).w++; get(g.away, g.home).l++; }
      else if (h < a) { get(g.home, g.away).l++; get(g.away, g.home).w++; }
      else { get(g.home, g.away).t++; get(g.away, g.home).t++; }
    }
    return rec;
  }

  const winPct = (w, l, t) => { const gp = w + l + t; return gp ? (w + 0.5 * t) / gp : null; };
  const quartile = (p) => (p === null ? null : Math.min(4, Math.trunc(p * 4) + 1));

  /** Competition ranking within a group, higher value = better (COUNTIFS ">"+1). */
  function rankWithin(rows, key, groupKey) {
    for (const r of rows) {
      r['rank_' + key] = rows.filter((o) => o[groupKey] === r[groupKey] && o[key] !== null && r[key] !== null && o[key] > r[key]).length + 1;
    }
  }

  function rank(schools, games, opts) {
    opts = opts || {};
    const rec = buildRecords(schools, games);
    const byName = Object.fromEntries(schools.map((s) => [s.name, s]));
    const rows = schools.map((s) => {
      let w = 0, l = 0, t = 0;
      for (const b in rec[s.name]) { w += rec[s.name][b].w; l += rec[s.name][b].l; t += rec[s.name][b].t; }
      const pct = winPct(w, l, t);
      return { name: s.name, cls: s.cls, classNum: s.classNum, league: s.league, w, l, t, gp: w + l + t, winPct: pct, qrtl: quartile(pct) };
    });
    const R = Object.fromEntries(rows.map((r) => [r.name, r]));

    // --- Saylor points: every game is worth a base value set by the two classes and the
    // opponent's win-% quartile; losses and ties subtract a penalty.
    //   1250 + (ownClass-2)*50 + (oppClass-2)*(-200) + (oppQuartile-4)*100  [-700 loss | -300 tie]
    const base = (me, opp) => 1250 + (me.classNum - 2) * 50 + (opp.classNum - 2) * -200 + (opp.qrtl - 4) * 100;
    for (const r of rows) { r.sp = 0; r.inW = 0; r.inL = 0; r.inT = 0; r.gt500In = 0; r.gt500Out = 0; }
    for (const r of rows) {
      for (const bn in rec[r.name]) {
        const o = R[bn], x = rec[r.name][bn];
        const b = base(r, o);
        r.sp += x.w * b + x.l * (b - 700) + x.t * (b - 300);
        if (o.classNum === r.classNum) { r.inW += x.w; r.inL += x.l; r.inT += x.t; }
      }
      r.spPerGame = r.gp ? r.sp / r.gp : null;
      r.inGp = r.inW + r.inL + r.inT;
      r.inWinPct = winPct(r.inW, r.inL, r.inT);
    }

    // --- ".500 and above" records: results against opponents whose overall win % is .500 or higher
    // (the written NEPSAC selection rules say ".500 and above"; the sheet used strictly above).
    // The sheet scores a pair's wins as 2 pts/win (4 for exactly two wins), 1 pt/tie.
    // Faithful quirk: a pair with 3+ results scores 0 (see opts.fixPairCap).
    const winPts = (n) => (n === 2 ? 4 : n === 1 ? 2 : (opts.fixPairCap ? 2 * n : 0));
    const tiePts = (n) => (n === 2 ? 2 : n === 1 ? 1 : (opts.fixPairCap ? n : 0));
    for (const r of rows) {
      for (const bn in rec[r.name]) {
        const o = R[bn], x = rec[r.name][bn];
        if (!(o.winPct >= 0.5)) continue;
        const pts = winPts(x.w) + tiePts(x.t);
        if (o.classNum === r.classNum) r.gt500In += pts; else r.gt500Out += pts;
      }
    }

    // --- Ranks within class (competition ranking). Note: the sheet's SP/game rank has an
    // off-by-one row bug; this is the intended ranking.
    const rk = (key) => rankWithin(rows, key, 'cls');
    ['winPct', 'sp', 'spPerGame', 'inWinPct', 'gt500In', 'gt500Out'].forEach(rk);
    return { rows, rec, R };
  }

  /** Per-team game log (the sheet's Team tab). */
  function teamGames(schools, games, team) {
    const { R } = rank(schools, games);
    const out = [];
    for (const g of games) {
      if (g.home !== team && g.away !== team) continue;
      const isHome = g.home === team;
      const opp = isHome ? g.away : g.home;
      const my = num(isHome ? g.homeScore : g.awayScore), th = num(isHome ? g.awayScore : g.homeScore);
      const cancelled = isCancelled(g);
      let result = '', pts = null;
      if (!cancelled && my !== null && th !== null && R[team] && R[opp]) {
        result = my > th ? 'W' : my < th ? 'L' : 'T';
        const b = 1250 + (R[team].classNum - 2) * 50 + (R[opp].classNum - 2) * -200 + (R[opp].qrtl - 4) * 100;
        pts = b + (result === 'L' ? -700 : result === 'T' ? -300 : 0);
      }
      out.push({ id: g.id, date: g.date, opp, home: isHome, my, th, result, status: g.status || 'final', overtime: !!g.overtime, note: g.note || '', oppClass: R[opp] && R[opp].cls, oppWinPct: R[opp] && R[opp].winPct, oppQrtl: R[opp] && R[opp].qrtl, saylor: pts });
    }
    return out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  const api = { rank, teamGames, buildRecords, playedGames, winPct, quartile };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FHEngine = api;
})(typeof self !== 'undefined' ? self : this);
