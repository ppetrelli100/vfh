import { logo, boot, esc, fmtPct, fmtInt, fmtDate, record, gameUrl, classesOf, classPicker, getParam, setParam } from './common.js';

const S = await boot('rankings');
if (S) {
  const classes = classesOf(S.schools);
  const counts = Object.fromEntries(classes.map((c) => [c, S.schools.filter((s) => s.cls === c).length]));
  let cls = classes.includes(getParam('class')) ? getParam('class') : classes[0];
  let sortKey = 'spPerGame', sortDir = 'desc';

  const played = FHEngine.playedGames(S.games);
  const lastDate = played.reduce((m, g) => (g.date > m ? g.date : m), '');

  // rank key is the engine's rank_<metric>; value formatter is the cell text
  const COLS = [
    { key: 'rank_spPerGame', label: 'Rank', cls: 'l', rankCol: true },
    { key: 'name', label: 'School', cls: 'name' },
    { key: 'league', label: 'League', cls: 'l hide-sm' },
    { key: 'record', label: 'Record', cls: '', cell: (r) => record(r), nosort: true },
    { key: 'winPct', label: 'Win %', cls: '', cell: (r) => fmtPct(r.winPct), rank: 'rank_winPct' },
    { key: 'spPerGame', label: 'Saylor points per game', cls: 'key', cell: (r) => fmtInt(r.spPerGame), rank: 'rank_spPerGame' },
    { key: 'sp', label: 'Saylor points total', cls: 'hide-sm', cell: (r) => fmtInt(r.sp), rank: 'rank_sp' },
    { key: 'inWinPct', label: 'In-class win %', cls: '', cell: (r) => fmtPct(r.inWinPct), rank: 'rank_inWinPct' },
    { key: 'gt500In', label: 'vs .500+ in class', cls: 'hide-sm', cell: (r) => r.gt500In, rank: 'rank_gt500In' },
    { key: 'gt500Out', label: 'vs .500+ other classes', cls: 'hide-sm', cell: (r) => r.gt500Out, rank: 'rank_gt500Out' },
  ];

  const app = document.getElementById('app');
  app.innerHTML = `
    <h1>Rankings</h1>
    <p class="lede">${esc(S.season.label)}. Teams are ranked within their class by Saylor points per game.
      ${played.length} games played${lastDate ? `, scores through ${esc(fmtDate(lastDate))}` : ''}.</p>
    <div class="toolbar"><div class="seg" id="classes" role="group" aria-label="Class"></div></div>
    <div class="scroll"><table class="tbl" id="tbl"></table></div>
    <details class="how">
      <summary>How the points work</summary>
      <p>Every game earns both teams Saylor points. A game starts at 1,250 points, then:</p>
      <ul>
        <li>Class A teams give up 50 points and Class C teams gain 50, compared with Class B.</li>
        <li>Playing a Class A opponent adds 200 points. Playing a Class C opponent takes away 200.</li>
        <li>Each step down in the opponent's win-percentage quartile takes away 100 points (top quartile 0, bottom quartile −300).</li>
        <li>A loss takes away 700 points. A tie takes away 300.</li>
      </ul>
      <p>Saylor points per game is a team's total divided by its games played, and it sets the order. The small grey number beside a figure is the team's rank in its class for that measure. The two .500+ columns score results against teams with a win percentage above .500: 2 points for a win and 1 for a tie, doubled when a team beats the same opponent twice.</p>
    </details>`;

  const cmp = (a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (av === null || av === undefined) return bv === null || bv === undefined ? 0 : 1;
    if (bv === null || bv === undefined) return -1;
    const d = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
    return sortDir === 'desc' ? -d : d;
  };

  function draw() {
    const rows = S.ranked.rows.filter((r) => r.cls === cls).sort(cmp);
    const head = COLS.map((c, i) => {
      const sorted = c.key === sortKey;
      const sortable = c.key !== 'league' && !c.nosort;
      return `<th scope="col" class="${c.cls.replace('name', 'l')}"${sorted ? ` aria-sort="${sortDir === 'desc' ? 'descending' : 'ascending'}"` : ''}>${
        sortable ? `<button type="button" data-i="${i}">${esc(c.label)}</button>` : esc(c.label)}</th>`;
    }).join('');
    document.getElementById('tbl').innerHTML = `
      <thead><tr>${head}</tr></thead>
      <tbody>${rows.map((r) => `<tr>
        ${COLS.map((c) => {
          if (c.rankCol) return `<td class="pos">${r.gp ? r.rank_spPerGame : '–'}</td>`;
          if (c.key === 'name') return `<td class="name"><a class="tn" href="${gameUrl(r.name)}">${logo(r.name)}<span>${esc(r.name)}</span></a></td>`;
          if (c.key === 'league') return `<td class="l hide-sm muted">${esc(r.league || '')}</td>`;
          const rk = c.rank && r.gp ? `<span class="rk">${r[c.rank]}</span>` : '';
          return `<td class="${c.cls}">${c.cell(r)}${rk}</td>`;
        }).join('')}
      </tr>`).join('')}</tbody>`;
    document.querySelectorAll('#tbl th button').forEach((b) => b.addEventListener('click', () => {
      const c = COLS[Number(b.dataset.i)];
      if (c.key === sortKey) sortDir = sortDir === 'desc' ? 'asc' : 'desc';
      else { sortKey = c.key; sortDir = c.key === 'name' || c.rankCol ? 'asc' : 'desc'; }
      draw();
    }));
  }

  classPicker(document.getElementById('classes'), classes, counts, cls, (c) => { cls = c; setParam('class', c); draw(); });
  draw();
}
