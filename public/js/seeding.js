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
    <p class="lede">The 12 teams in each class with the most Saylor points per game are compared in pairs on seven measures. The top eight seeds make the playoffs.</p>
    <div class="toolbar"><div class="seg" id="classes" role="group" aria-label="Class"></div></div>
    <div id="out"></div>`;

  // Teams level on pairings won and on points per game cannot be separated by the measures.
  const tieNote = (res) => {
    const groups = {};
    for (const t of res.table) if (t.tie && t.pos <= 8 + 1) (groups[`${t.seed}|${t.spPerGame}`] = groups[`${t.seed}|${t.spPerGame}`] || []).push(t);
    const parts = Object.values(groups).map((g) => `${g.map((t) => esc(t.name)).join(' and ')} are level on pairings won and on points per game, so their order here is provisional until the tie is broken.`);
    return parts.length ? `<br>${parts.join(' ')}` : '';
  };

  function draw() {
    const res = FHSeeding.seed(S.ranked.rows, S.ranked.rec, S.games, cls);
    const out = document.getElementById('out');
    if (res.top12.length < 2) {
      out.innerHTML = '<div class="scroll"><div class="empty"><strong>Not enough games yet</strong>Seeds appear once teams in this class have played.</div></div>';
      return;
    }
    if (!pair || !res.top12.includes(pair[0]) || !res.top12.includes(pair[1])) pair = [res.table[0].name, (res.table[1] || res.table[0]).name];

    const side = (x) => x.name
      ? `<div class="side"><span class="seedno">${x.seed}</span><span class="tn">${logo(x.name, 26)}${nm(x.name)}</span></div>`
      : `<div class="side"><span class="seedno">${x.seed}</span><span>To be decided</span></div>`;

    out.innerHTML = `
      <section class="pitch" aria-labelledby="pm">
        <h2 id="pm">Class ${esc(cls)} playoff matchups</h2>
        <p>Based on games through the latest saved score. The seeds change as results come in.</p>
        <div class="matchups">${res.bracket.map((m) => `<div class="match">${side(m.high)}${side(m.low)}</div>`).join('')}</div>
      </section>

      <h2>Seeding</h2>
      <div class="scroll"><table class="tbl c">
        <thead><tr><th>Seed</th><th class="l">School</th><th>Pairings won</th><th>Saylor points per game</th><th class="hide-sm">Saylor points per game rank</th></tr></thead>
        <tbody>${res.table.map((t) => `<tr${t.pos === 8 ? ' class="cut"' : ''}${t.pos > 8 ? ' style="opacity:.72"' : ''}>
          <td class="pos">${t.pos}</td>
          <td class="name" style="white-space:nowrap"><a class="tn" href="${gameUrl(t.name)}">${logo(t.name)}${nm(t.name)}</a>${t.tie ? ' <span class="tag" title="Level with another team on pairings won and points per game">tie</span>' : ''}</td>
          <td class="key">${t.total}<span class="rk">of ${res.top12.length - 1}</span></td>
          <td>${fmtInt(t.spPerGame)}</td>
          <td class="hide-sm">${t.spRank}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="hint" style="margin-top:8px">Seeds 9 to 12 are shown for reference. The line marks the playoff cut.${tieNote(res)}</p>

      <h2>Pairwise comparison</h2>
      <p class="hint" style="margin-top:0">Each team is compared with every other team in the top 12. A 1 means the team in that row won the pairing against the team in that column. Select any cell to see the comparison below.</p>
      <div class="scroll"><table class="pw" id="mx"></table></div>

      <h2>Compare two teams</h2>
      <div id="cmp" class="cmp-wrap"></div>
      <details class="how">
        <summary>The seven measures</summary>
        <p>For each pairing, each team is awarded a point on every measure where its figure is strictly higher than the other team's. Win percentage, points per game, in-class win percentage and the two .500+ records compare each team's season totals. Head to head compares wins in the games the two teams played. Mutual opponents compares each team's win percentage in games against opponents both have played.</p>
        <p>The team with more measure points wins the pairing. If the measure points are equal, the team with more Saylor points per game wins it. A team's seed order follows the number of pairings it won, and points per game breaks ties between teams that won the same number.</p>
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
      }).join('')}<td class="tot">${res.total[i]}</td><td class="tot">${res.table.find((t) => t.name === res.top12[i]).pos}</td></tr>`).join('')}</tbody>`;
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
    return `<h3 id="h2h" class="sub">Head to head</h3>` + (games.length
      ? `<div class="scroll"><table class="tbl sm"><tbody>${rows}</tbody></table></div>`
      : `<p class="hint">${nm(A)} and ${nm(B)} have not played each other this season.</p>`);
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
    const sel = (id, v) => `<select id="${id}">${res.table.map((t) => `<option value="${esc(t.name)}"${t.name === v ? ' selected' : ''}>${t.pos}. ${esc(t.name)}</option>`).join('')}</select>`;
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
        spPerGame: [fmtInt(rA.spPerGame), fmtInt(rB.spPerGame)],
        inWinPct: [fmtPct(rA.inWinPct), fmtPct(rB.inWinPct)],
        gt500In: [rA.gt500In, rB.gt500In],
        gt500Out: [rA.gt500Out, rB.gt500Out],
        h2h: [`${h2hA} ${h2hA === 1 ? 'win' : 'wins'}`, `${h2hB} ${h2hB === 1 ? 'win' : 'wins'}`],
        mutual: [mo.mutual.length ? fmtPct(mo.team) : '–', mo.mutual.length ? fmtPct(mo.other) : '–'],
      };
      const verdict = d.sum > d.sumOpp ? `${A} wins the pairing, ${d.sum} measures to ${d.sumOpp}.`
        : d.sum < d.sumOpp ? `${B} wins the pairing, ${d.sumOpp} measures to ${d.sum}.`
        : `The teams are level at ${d.sum} measures each, so points per game decides it: ${d.win ? A : B} wins the pairing.`;
      const spOf = (n) => res.table.find((t) => t.name === n).spPerGame, verdictTie = d.sum === d.sumOpp && spOf(A) === spOf(B);
      el.innerHTML = `
        <div class="toolbar"><label>Team${sel('ca', A)}</label><label>Compared with${sel('cb', B)}</label></div>
        <div class="scroll"><table class="tbl cmp">
          <thead><tr><th class="l">Measure</th><th><a class="tn c" href="${gameUrl(A)}" title="See ${esc(A)}'s games">${logo(A)}${nm(A)}</a></th><th><a class="tn c" href="${gameUrl(B)}" title="See ${esc(B)}'s games">${logo(B)}${nm(B)}</a></th></tr></thead>
          <tbody>${CRITERIA.map(([k, label]) => `<tr><td class="l">${rowLink(k, label)}</td>
            <td class="${d[k] ? 'win' : ''}">${val[k][0]}</td><td class="${d[k + '_opp'] ? 'win' : ''}">${val[k][1]}</td></tr>`).join('')}
          <tr><td class="l key">Measures won</td><td class="key">${d.sum}</td><td class="key">${d.sumOpp}</td></tr></tbody>
        </table></div>
        <p class="verdict">${esc(verdictTie ? `The teams are level at ${d.sum} measures each and have identical points per game, so neither wins the pairing.` : verdict)}</p>
        ${h2hSection(A, B)}
        ${mutualSection(A, B, mo.mutual)}`;
    }
    const swap = () => { pair = [document.getElementById('ca').value, document.getElementById('cb').value]; draw(); };
    document.getElementById('ca').addEventListener('change', swap);
    document.getElementById('cb').addEventListener('change', swap);
  }

  classPicker(document.getElementById('classes'), classes, counts, cls, (c) => { cls = c; pair = null; setParam('class', c); draw(); });
  draw();
}
