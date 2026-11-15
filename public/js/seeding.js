import { playoffLabel, logo, nm, boot, esc, fmtPct, fmtInt, fmtDate, gameUrl, classesOf, classPicker, getParam, setParam } from './common.js';

const S = await boot('playoffs');
if (S) {
  document.title = `${playoffLabel(S.season)} - NEPSAC Field Hockey`;
  const app = document.getElementById('app');
  app.classList.add('narrow');
  const classes = classesOf(S.schools);
  const counts = Object.fromEntries(classes.map((c) => [c, S.schools.filter((s) => s.cls === c).length]));
  let cls = classes.includes(getParam('class')) ? getParam('class') : classes[0];
  let pair = null; // [teamA, teamB]
  let view = getParam('view') === 'bracket' ? 'bracket' : 'matchups'; // matchups card: first-round pairings, or the full bracket
  // The pool is a season setting that an administrator makes; everyone sees it. An administrator can preview the other
  // one by adding ?pool=500 or ?pool=12 to the address without changing the setting.
  const official = S.season.playoffPool === 'all500' ? 'all500' : 'top12';
  let pool = official;
  if (S.me && S.me.admin && ['500', '12'].includes(getParam('pool'))) pool = getParam('pool') === '500' ? 'all500' : 'top12';

  const CRITERIA = [
    ['winPct', 'Overall win %'],
    ['spPerGame', 'Saylor points per game'],
    ['inWinPct', 'In-class win %'],
    ['gt500In', 'Record vs .500+ teams in class'],
    ['gt500Out', 'Record vs .500+ teams in other classes'],
    ['h2h', 'Head to head'],
    ['mutual', 'Record vs mutual opponents'],
  ];

  app.innerHTML = `
    <h1>${esc(playoffLabel(S.season))}</h1>
    <p class="lede" id="lede"></p>
    <p class="hint" id="poolnote" style="margin-top:-6px" hidden></p>
    <div class="toolbar"><div class="seg" id="classes" role="group" aria-label="Class"></div></div>
    <div id="out"></div>`;

  const TIE_TIP = 'Level with another team on pairings won, head to head, points per game and in-class win percentage';
  // Whole numbers, unless the two round alike but differ: then add decimals (up to 4) until they show it.
  const spPair = (x, y) => {
    if (x === null || x === undefined || y === null || y === undefined) return [fmtInt(x), fmtInt(y)];
    let dp = 0;
    while (dp < 4 && x !== y && x.toFixed(dp) === y.toFixed(dp)) dp++;
    const f = (v) => v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
    return [f(x), f(y)];
  };
  const OFF_TIP = 'Needs a .500 record overall or in class to take a bracket spot';
  const tieOf = (res, name) => (res.table.find((t) => t.name === name) || {}).tie;
  // Teams level on pairings won and on points per game cannot be separated by the measures.
  const tieNote = (res) => {
    const groups = {};
    for (const t of res.table) if (t.tie && t.pos <= res.cutPos + 1) (groups[`${t.seed}|${t.spPerGame}`] = groups[`${t.seed}|${t.spPerGame}`] || []).push(t);
    const parts = Object.values(groups).map((g) => `${g.map((t) => esc(t.name)).join(' and ')} are level on pairings won, head to head, points per game and in-class win percentage, so their order here is provisional until the tie is broken.`);
    return parts.length ? `<br>${parts.join(' ')}` : '';
  };

  function draw() {
    const res = FHSeeding.seed(S.ranked.rows, S.ranked.rec, S.games, cls, { ...(pool === 'all500' ? { poolRequires500: true, size: 999 } : {}), excluded: S.schools.filter((s) => s.playoffOut).map((s) => s.name) });
    const outTeams = S.schools.filter((s) => s.playoffOut && s.cls === cls);
    const out = document.getElementById('out');
    document.getElementById('lede').textContent = pool === 'all500'
      ? 'Every team in each class with a .500 record or better overall or in class is compared in pairs on seven measures. The top eight seeds make the playoffs.'
      : 'The 12 teams in each class with the most Saylor points per game are compared in pairs on seven measures. The top eight seeds make the playoffs.';
    const pn = document.getElementById('poolnote');
    pn.hidden = false;
    pn.textContent = (pool === 'all500' ? `Pool: all teams with .500 or better overall or in class (${res.top12.length} in Class ${cls}).` : `Pool: the top 12 teams by Saylor points per game.`)
      + (pool !== official ? ` Preview only: the setting for everyone is ${official === 'all500' ? 'all .500+ teams' : 'the top 12'}.` : '');
    if (res.top12.length < 2) {
      out.innerHTML = '<div class="scroll"><div class="empty"><strong>Not enough games yet</strong>Seeds appear once teams in this class have played.</div></div>';
      return;
    }
    if (!pair || !res.top12.includes(pair[0]) || !res.top12.includes(pair[1])) pair = [res.table[0].name, (res.table[1] || res.table[0]).name];

    // Locked seeds (set by an administrator) replace the live ones, and playoff games fill in the bracket.
    const lock = (S.season.bracketLock || {})[cls] || null;
    const seedNames = lock || [];
    if (!lock) res.table.forEach((t) => { if (t.bseed) seedNames[t.bseed - 1] = t.name; });
    const pb = FHSeeding.playoffBracket(seedNames, lock ? S.playoffGames : []);
    const tbd = (t) => `<div class="side tbd"><span>${t}</span></div>`;
    const tag = (g, won) => (!g || !won ? '' : g.so ? '<span class="tag">SO</span>' : g.overtime ? `<span class="tag">${g.overtime > 1 ? '2OT' : 'OT'}</span>` : '');
    const entrant = (x, m, mine) => {
      const won = m.winner === x.name, lost = m.winner && !won;
      const tieMark = !lock && tieOf(res, x.name);
      const sc = m.game ? `<span class="gscore">${mine}</span>${tag(m.game, won)}` : '';
      return `<div class="side${won ? ' won' : lost ? ' lost' : ''}"><span class="seedno${tieMark ? ' tie' : ''}"${tieMark ? ` title="${TIE_TIP}"` : ''}>${x.seed}</span><span class="tn${tieMark ? ' tie' : ''}"${tieMark ? ` title="${TIE_TIP}"` : ''}>${logo(x.name, 26)}${nm(x.name)}</span>${sc}</div>`;
    };
    // One game card. `from` are the two games that feed it, for the "Winner of 1 v 8" labels.
    const card = (m, cls2, from) => {
      const row = (x, k) => (x && x.name ? entrant(x, m, k ? m.game && m.game.bScore : m.game && m.game.aScore)
        : from ? tbd(typeof from[k] === 'string' ? from[k] : `Winner of ${from[k].a.seed} v ${from[k].b.seed}`)
        : `<div class="side"><span class="seedno">${x.seed}</span><span>To be decided</span></div>`);
      return `<div class="match ${cls2}">${row(m.a, 0)}${row(m.b, 1)}</div>`;
    };
    const bracketHtml = () => `<div class="bk">
        <h3 class="hq">Quarterfinals</h3><h3 class="hs">Semifinals</h3><h3 class="hf">Final</h3>
        ${pb.qf.map((m, i) => card(m, `q q${i + 1}`)).join('')}
        ${card(pb.sf[0], 's s1', [pb.qf[0], pb.qf[1]])}${card(pb.sf[1], 's s2', [pb.qf[2], pb.qf[3]])}
        ${card(pb.f[0], 'f', ['Winner of top semifinal', 'Winner of bottom semifinal'])}
      </div>`;
    const matchupsHtml = () => `<div class="matchups">${pb.qf.map((m) => card(m, '')).join('')}</div>`;

    out.innerHTML = `
      <section class="pitch" aria-labelledby="pm">
        <div class="pitch-head">
          <h2 id="pm">Class ${esc(cls)} playoff ${view === 'bracket' ? 'bracket' : 'matchups'}</h2>
          <div class="seg seg-sm" id="viewseg" role="group" aria-label="View">
            <button type="button" data-v="matchups" aria-pressed="${view === 'matchups'}">Playoff matchups</button>
            <button type="button" data-v="bracket" aria-pressed="${view === 'bracket'}">Bracket view</button></div>
        </div>
        ${view === 'bracket' ? '' : `<p>${lock ? 'The seeds are locked. Scores of playoff games appear here as they are entered.' : 'Based on games through the latest saved score. The seeds change as results come in.'}</p>`}
        ${view === 'bracket' ? bracketHtml() : matchupsHtml()}
      </section>

      <h2>Seeding</h2>
      <div class="scroll"><table class="tbl c">
        <thead><tr><th>Seed</th><th class="l">School</th><th>Pairings won</th><th>Saylor points per game</th><th class="hide-sm">Saylor points per game rank</th></tr></thead>
        <tbody>${res.table.map((t) => `<tr${t.pos === res.cutPos ? ' class="cut"' : ''}${t.pos > res.cutPos || !t.eligible ? ' style="opacity:.72"' : ''}>
          <td class="pos${t.tie ? ' tie' : ''}"${t.tie ? ` title="${TIE_TIP}"` : ''}>${t.bseed || '&ndash;'}</td>
          <td class="name"><div style="display:flex;align-items:center;gap:2px"><a class="tn" href="${gameUrl(t.name)}">${logo(t.name)}${nm(t.name)}</a>${t.tie ? `<span class="tag tie" title="${TIE_TIP}">tie</span>` : ''}${t.eligible ? '' : `<span class="tag off" title="${OFF_TIP}">Below .500</span>`}</div></td>
          <td class="key${t.tie ? ' tie' : ''}"${t.tie ? ` title="${TIE_TIP}"` : ''}>${t.total}<span class="rk">of ${res.top12.length - 1}</span></td>
          <td>${fmtInt(t.spPerGame)}</td>
          <td class="hide-sm">${t.spRank}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="hint" style="margin-top:8px">The line marks the playoff cut. Teams below it are shown for reference. A team marked Below .500 has no .500 record overall or in class, so it stays in the comparisons but cannot take a bracket spot.${tieNote(res)}</p>
      ${outTeams.length ? `<p class="hint" style="margin-top:4px">Not playing in the playoffs: ${outTeams.map((t) => `${esc(t.name)}${t.playoffNote ? ` (${esc(t.playoffNote)})` : ''}`).join('; ')}. ${outTeams.length === 1 ? 'It is' : 'They are'} left out of the pool, and the next team in the class takes ${outTeams.length === 1 ? 'its' : 'their'} place.</p>` : ''}

      <h2>Pairwise comparison</h2>
      <p class="hint" style="margin-top:0">Each team is compared with every other team in the pool. A 1 means the team in that row won the pairing against the team in that column. Select any cell to see the comparison below.</p>
      <div class="scroll"><table class="pw" id="mx"></table></div>

      <h2>Compare two teams</h2>
      <div id="cmp" class="cmp-wrap"></div>
      <details class="how">
        <summary>The seven measures</summary>
        <p>For each pairing, each team is awarded a point on every measure where its figure is strictly higher than the other team's. Win percentage, points per game, in-class win percentage and the two .500+ records compare each team's season totals. Head to head compares wins in the games the two teams played. Mutual opponents compares each team's win percentage in games against opponents both have played.</p>
        <p>The team with more measure points wins the pairing. If the measure points are equal, the team that won head to head wins it. If that is level too, the team with more Saylor points per game wins it, then the team with the higher in-class win percentage. A team's seed order follows the number of pairings it won. Teams that won the same number are separated by head to head against each other, then by Saylor points per game, then by in-class win percentage.</p>
        <p>Bracket eligibility: the bracket is the first 8 teams in that order with a .500 record or better overall, or .500 or better in class. A team without one can still be in the pool and in every comparison, but it does not take a bracket spot, so the next team that qualifies moves up. A team that has told the league it will not play is left out of the pool altogether, and the next team in the class by Saylor points per game takes the 12th place.</p>
      </details>`;

    const mx = document.getElementById('mx');
    mx.innerHTML = `
      <thead><tr><th class="corner"></th>${res.top12.map((n) => `<th scope="col" class="cn"><span>${nm(n)}</span></th>`).join('')}
        <th class="tot">Total</th><th class="tot">Seed</th></tr></thead>
      <tbody>${res.top12.map((a, i) => `<tr><th scope="row" class="rn"><span class="tn">${logo(a, 18)}${nm(a)}</span></th>${res.top12.map((b, j) => {
        if (i === j) return '<td class="self"></td>';
        const w = res.detail[i][j].win;
        const sel = pair[0] === a && pair[1] === b;
        return `<td class="${w ? 'w' : 'l'}${sel ? ' sel' : ''}" data-a="${esc(a)}" data-b="${esc(b)}" tabindex="0" role="button" aria-label="${esc(a)} against ${esc(b)}: ${w ? 'won' : 'lost'}">${w ? '1' : '&ndash;'}</td>`;
      }).join('')}<td class="tot">${res.total[i]}</td><td class="tot">${res.table.find((t) => t.name === res.top12[i]).bseed || '&ndash;'}</td></tr>`).join('')}</tbody>`;
    mx.querySelectorAll('td[data-a]').forEach((td) => {
      const go = () => { pair = [td.dataset.a, td.dataset.b]; draw(); };
      td.addEventListener('click', go);
      td.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    drawCompare(res);
  }

  // Where each measure's underlying numbers live: the Rankings page, sorted by that measure.
  const RANK_KEY = { winPct: 'winPct', spPerGame: 'spPerGame', inWinPct: 'inWinPct', gt500In: 'gt500In', gt500Out: 'gt500Out' };
  function rowLink(k, label) {
    if (RANK_KEY[k]) return `<a class="lk" href="/rankings.html?class=${encodeURIComponent(cls)}&sort=${RANK_KEY[k]}" title="See this measure for every Class ${esc(cls)} team">${label}</a>`;
    return `<a class="lk" href="#${k === 'h2h' ? 'h2h' : 'mutual'}">${label}</a>`;
  }

  // Games these two teams played against each other.
  function h2hSection(A, B) {
    const games = FHEngine.playedGames(S.games).filter((g) => (g.home === A && g.away === B) || (g.home === B && g.away === A))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const rows = games.map((g) => {
      const hs = Number(g.homeScore), as = Number(g.awayScore);
      const w = hs > as ? g.home : hs < as ? g.away : null;
      return `<tr><td class="l">${esc(fmtDate(g.date))}</td>
        <td class="${w === g.home ? 'wn' : ''}">${nm(g.home)}</td><td class="sc">${hs}&ndash;${as}</td><td class="${w === g.away ? 'wn' : ''}">${nm(g.away)}</td>
        <td class="l muted">${w ? `${nm(w)} won` : 'Tie'}</td></tr>`;
    }).join('');
    const ahead = S.games.filter((g) => g.status === 'scheduled' && ((g.home === A && g.away === B) || (g.home === B && g.away === A)))
      .map((g) => fmtDate(g.date));
    const when = ahead.length ? ` They are scheduled to play ${games.length ? 'again ' : ''}on ${ahead.length > 1 ? `${ahead.slice(0, -1).join(', ')} and ${ahead[ahead.length - 1]}` : ahead[0]}.` : '';
    return `<h3 id="h2h" class="sub">Head to head</h3>` + (games.length
      ? `<div class="scroll"><table class="tbl sm"><tbody>${rows}</tbody></table></div>${when ? `<p class="hint">${esc(when.trim())}</p>` : ''}`
      : `<p class="hint">${nm(A)} and ${nm(B)} have not played each other ${ahead.length ? 'yet' : 'this season'}.${esc(when)}</p>`);
  }

  // Each team's results against the opponents both have played.
  function mutualSection(A, B, opps) {
    if (!opps.length) return `<h3 id="mutual" class="sub">Record vs mutual opponents</h3><p class="hint">These teams have no opponents in common yet.</p>`;
    const rec = (t, o) => (S.ranked.rec[t][o] || { w: 0, l: 0, t: 0 });
    const dash = (n) => (n ? n : '&ndash;');
    const list = opps.slice().sort((a, b) => a.localeCompare(b));
    const tot = { A: { w: 0, l: 0, t: 0 }, B: { w: 0, l: 0, t: 0 } };
    const cells = (r, k) => { tot[k].w += r.w; tot[k].l += r.l; tot[k].t += r.t; return `<td class="g">${dash(r.w)}</td><td>${dash(r.l)}</td><td>${dash(r.t)}</td>`; };
    const rows = list.map((o) => `<tr><td class="l"><a class="tn" href="${gameUrl(o)}">${logo(o, 18)}${nm(o)}</a></td>${cells(rec(A, o), 'A')}${cells(rec(B, o), 'B')}</tr>`).join('');
    const pct = (x) => fmtPct((x.w + 0.5 * x.t) / (x.w + x.l + x.t));
    return `<h3 id="mutual" class="sub">Record vs mutual opponents</h3>
      <div class="scroll"><table class="tbl sm mut">
        <thead><tr><th class="l" rowspan="2">Opponent</th><th colspan="3" class="grp">${nm(A)}</th><th colspan="3" class="grp">${nm(B)}</th></tr>
          <tr><th class="g">W</th><th>L</th><th>T</th><th class="g">W</th><th>L</th><th>T</th></tr></thead>
        <tbody>${rows}
          <tr class="tot"><td class="l">Total</td><td class="g">${tot.A.w}</td><td>${tot.A.l}</td><td>${tot.A.t}</td><td class="g">${tot.B.w}</td><td>${tot.B.l}</td><td>${tot.B.t}</td></tr>
          <tr class="tot"><td class="l">Win %</td><td colspan="3" class="g">${pct(tot.A)}</td><td colspan="3" class="g">${pct(tot.B)}</td></tr></tbody>
      </table></div>`;
  }

  function drawCompare(res) {
    const [A, B] = pair;
    const iA = res.top12.indexOf(A), iB = res.top12.indexOf(B);
    const sel = (id, v) => `<select id="${id}">${res.table.map((t) => `<option value="${esc(t.name)}"${t.name === v ? ' selected' : ''}>${t.bseed ? t.bseed + '. ' : ''}${esc(t.name)}</option>`).join('')}</select>`;
    const el = document.getElementById('cmp');
    if (iA === iB) {
      el.innerHTML = `<div class="toolbar"><label>Team<select id="ca">${res.table.map((t) => `<option${t.name === A ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
        <label>Compared with${sel('cb', B)}</label></div><p class="hint">Choose two different teams.</p>`;
    } else {
      const d = res.detail[iA][iB];
      const rA = S.ranked.R[A], rB = S.ranked.R[B];
      const h2hA = (S.ranked.rec[A][B] || { w: 0 }).w, h2hB = (S.ranked.rec[B][A] || { w: 0 }).w;
      const mo = FHSeeding.mutualWinPct(S.games, A, B);
      const val = {
        winPct: [fmtPct(rA.winPct), fmtPct(rB.winPct)],
        spPerGame: spPair(rA.spPerGame, rB.spPerGame),
        inWinPct: [fmtPct(rA.inWinPct), fmtPct(rB.inWinPct)],
        gt500In: [rA.gt500In, rB.gt500In],
        gt500Out: [rA.gt500Out, rB.gt500Out],
        h2h: [`${h2hA} ${h2hA === 1 ? 'win' : 'wins'}`, `${h2hB} ${h2hB === 1 ? 'win' : 'wins'}`],
        mutual: [mo.mutual.length ? fmtPct(mo.team) : '–', mo.mutual.length ? fmtPct(mo.other) : '–'],
      };
      const verdict = d.sum > d.sumOpp ? `${A} wins the pairing, ${d.sum} measures to ${d.sumOpp}.`
        : d.sum < d.sumOpp ? `${B} wins the pairing, ${d.sumOpp} measures to ${d.sum}.`
        : d.by === 'h2h' ? `The teams are level at ${d.sum} measures each, so head to head decides it: ${d.win ? A : B} wins the pairing.`
        : d.by === 'sp' ? `The teams are level at ${d.sum} measures each and level head to head, so Saylor points per game decides it: ${d.win ? A : B} wins the pairing.`
        : `The teams are level at ${d.sum} measures each, level head to head and on Saylor points per game, so in-class win percentage decides it: ${d.win ? A : B} wins the pairing.`;
      const verdictTie = d.by === 'none';
      el.innerHTML = `
        <div class="toolbar"><label>Team${sel('ca', A)}</label><label>Compared with${sel('cb', B)}</label></div>
        <div class="scroll"><table class="tbl cmp">
          <thead><tr><th class="l">Measure</th><th><a class="tn c" href="${gameUrl(A)}" title="See ${esc(A)}'s games">${logo(A)}${nm(A)}</a></th><th><a class="tn c" href="${gameUrl(B)}" title="See ${esc(B)}'s games">${logo(B)}${nm(B)}</a></th></tr></thead>
          <tbody>${CRITERIA.map(([k, label]) => `<tr><td class="l">${rowLink(k, label)}</td>
            <td class="${d[k] ? 'win' : ''}">${val[k][0]}</td><td class="${d[k + '_opp'] ? 'win' : ''}">${val[k][1]}</td></tr>`).join('')}
          <tr><td class="l key">Measures won</td><td class="key">${d.sum}</td><td class="key">${d.sumOpp}</td></tr></tbody>
        </table></div>
        <p class="verdict">${esc(verdictTie ? `The teams are level at ${d.sum} measures each and are level head to head, on points per game and on in-class win percentage, so neither wins the pairing.` : verdict)}</p>
        ${h2hSection(A, B)}
        ${mutualSection(A, B, mo.mutual)}`;
    }
    const swap = () => { pair = [document.getElementById('ca').value, document.getElementById('cb').value]; draw(); };
    document.getElementById('ca').addEventListener('change', swap);
    document.getElementById('cb').addEventListener('change', swap);
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('#viewseg button'); if (!b) return;
    view = b.dataset.v; setParam('view', view === 'bracket' ? 'bracket' : ''); draw();
  });
  classPicker(document.getElementById('classes'), classes, counts, cls, (c) => { cls = c; pair = null; setParam('class', c); draw(); });
  draw();
}
