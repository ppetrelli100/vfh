import { logo, nm, boot, esc, fmtPct, fmtInt, gameUrl, classesOf, classPicker, getParam, setParam } from './common.js';

const S = await boot('playoffs');
if (S) {
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
    <h1>Playoffs</h1>
    <p class="lede">The 12 teams in each class with the most Saylor points per game are compared in pairs on seven measures. The top eight seeds make the playoffs.</p>
    <div class="toolbar"><div class="seg" id="classes" role="group" aria-label="Class"></div></div>
    <div id="out"></div>`;

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

      <h2>Seed order</h2>
      <div class="scroll"><table class="tbl c">
        <thead><tr><th>Seed</th><th class="l">School</th><th>Pairings won</th><th>Saylor points per game</th><th class="hide-sm">Saylor points per game rank</th></tr></thead>
        <tbody>${res.table.map((t) => `<tr${t.seed === 8 ? ' class="cut"' : ''}${t.seed > 8 ? ' style="opacity:.72"' : ''}>
          <td class="pos">${t.seed}</td>
          <td class="name"><a class="tn" href="${gameUrl(t.name)}">${logo(t.name)}${nm(t.name)}</a></td>
          <td class="key">${t.total}<span class="rk">of ${res.top12.length - 1}</span></td>
          <td>${fmtInt(t.spPerGame)}</td>
          <td class="hide-sm">${t.spRank}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="hint" style="margin-top:8px">Seeds 9 to 12 are shown for reference. The line marks the playoff cut.</p>

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
      }).join('')}<td class="tot">${res.total[i]}</td><td class="tot">${res.finalRank[i]}</td></tr>`).join('')}</tbody>`;
    mx.querySelectorAll('td[data-a]').forEach((td) => {
      const go = () => { pair = [td.dataset.a, td.dataset.b]; draw(); };
      td.addEventListener('click', go);
      td.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    drawCompare(res);
  }

  function drawCompare(res) {
    const [A, B] = pair;
    const iA = res.top12.indexOf(A), iB = res.top12.indexOf(B);
    const sel = (id, v) => `<select id="${id}">${res.table.map((t) => `<option value="${esc(t.name)}"${t.name === v ? ' selected' : ''}>${t.seed}. ${esc(t.name)}</option>`).join('')}</select>`;
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
      el.innerHTML = `
        <div class="toolbar"><label>Team${sel('ca', A)}</label><label>Compared with${sel('cb', B)}</label></div>
        <div class="scroll"><table class="tbl cmp">
          <thead><tr><th class="l">Measure</th><th><span class="tn c">${logo(A)}${nm(A)}</span></th><th><span class="tn c">${logo(B)}${nm(B)}</span></th></tr></thead>
          <tbody>${CRITERIA.map(([k, label]) => `<tr><td class="l">${label}</td>
            <td class="${d[k] ? 'win' : ''}">${val[k][0]}</td><td class="${d[k + '_opp'] ? 'win' : ''}">${val[k][1]}</td></tr>`).join('')}
          <tr><td class="l key">Measures won</td><td class="key">${d.sum}</td><td class="key">${d.sumOpp}</td></tr></tbody>
        </table></div>
        <p class="verdict">${esc(verdict)}</p>`;
    }
    const swap = () => { pair = [document.getElementById('ca').value, document.getElementById('cb').value]; draw(); };
    document.getElementById('ca').addEventListener('change', swap);
    document.getElementById('cb').addEventListener('change', swap);
  }

  classPicker(document.getElementById('classes'), classes, counts, cls, (c) => { cls = c; pair = null; setParam('class', c); draw(); });
  draw();
}
