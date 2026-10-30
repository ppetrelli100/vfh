import { logo, nm, boot, esc, fmtPct, fmtInt, fmtDate, record, gameUrl, classesOf, classPicker, getParam, setParam } from './common.js';

const S = await boot('rankings');
if (S) {
  const classes = classesOf(S.schools);
  const counts = Object.fromEntries(classes.map((c) => [c, S.schools.filter((s) => s.cls === c).length]));
  let cls = classes.includes(getParam('class')) || getParam('class') === 'all' ? getParam('class') : classes[0];
  let sortKey = 'spPerGame', sortDir = 'desc';
  // A link such as /rankings.html?class=A&sort=inWinPct opens the table sorted by that measure.
  { const k = getParam('sort'); if (k && k !== 'record') { sortKey = k; sortDir = k === 'name' ? 'asc' : 'desc'; } }


  // rank key is the engine's rank_<metric>; value formatter is the cell text
  // Division is geographic and comes from the schools list; it only filters the view and never changes the math.
  const divOf = Object.fromEntries(S.schools.map((x) => [x.name, x.division || '']));
  const divisions = ['D1/2', 'D3', 'D4'].filter((d) => S.schools.some((x) => x.division === d));
  let div = divisions.includes(getParam('division')) ? getParam('division') : '';
  if (div && !getParam('class')) cls = 'all';
  // When the list mixes classes or is limited to a division, Rank is the position on the list by Saylor points per game
  // (schools level on points share a place); otherwise it is the school's rank in its class.
  let viewRanks = null;
  const placeRanks = (rows) => {
    const sorted = rows.filter((r) => r.gp).sort((a, b) => b.spPerGame - a.spPerGame);
    const m = new Map(); let last = 0;
    sorted.forEach((r, i) => { if (!i || sorted[i - 1].spPerGame !== r.spPerGame) last = i + 1; m.set(r.name, last); });
    return m;
  };
  const ALL_COLS = [
    { key: 'rank', label: 'Rank', cls: 'rnk', cell: (r) => (r.gp ? (viewRanks ? viewRanks.get(r.name) : r.rank_spPerGame) : '–'), nosort: true },
    { key: 'name', label: 'School', cls: 'name' },
    { key: 'cls', label: 'Class', cls: '', cell: (r) => r.cls, onlyAll: true },
    { key: 'record', label: 'Record', cls: '', cell: (r) => record(r), nosort: true },
    { key: 'winPct', label: 'Win %', cls: '', cell: (r) => fmtPct(r.winPct), rank: 'rank_winPct' },
    { key: 'spPerGame', label: 'Saylor points per game', cls: 'key', cell: (r) => fmtInt(r.spPerGame), rank: 'rank_spPerGame' },
    { key: 'sp', label: 'Saylor points total', cls: 'hide-sm', cell: (r) => fmtInt(r.sp), rank: 'rank_sp' },
    { key: 'inWinPct', label: 'In-class win %', cls: 'hide-sm', cell: (r) => fmtPct(r.inWinPct), rank: 'rank_inWinPct' },
    { key: 'gt500In', label: 'vs .500+ in class', cls: 'hide-sm', cell: (r) => r.gt500In, rank: 'rank_gt500In' },
    { key: 'gt500Out', label: 'vs .500+ other classes', cls: 'hide-sm', cell: (r) => r.gt500Out, rank: 'rank_gt500Out' },
  ];

  const app = document.getElementById('app');
  app.innerHTML = `
    <h1>Rankings</h1>
    <p class="lede" id="lede">Current ranking within class by Saylor points per game.</p>
    <div class="toolbar"><div class="seg" id="classes" role="group" aria-label="Class"></div></div>
    ${divisions.length ? '<div class="toolbar"><div class="seg" id="divs" role="group" aria-label="Division"></div></div>' : ''}
    <div class="scroll"><table class="tbl c" id="tbl"></table></div>
    <details class="how">
      <summary>How the points work</summary>
      <p>Every game earns both teams Saylor points. Find your team's class and the result on the left, then the opponent's class and win percentage across the top.</p>
      ${pointsTable()}
      <p>An opponent's win percentage that falls exactly on a boundary (for example .750) counts in the higher band. Saylor points per game is a team's total divided by its games played, and it sets the order. The small grey number beside a figure is the team's rank in its class for that measure. The two .500+ columns score results against teams with a win percentage above .500: 2 points for a win and 1 for a tie, doubled when a team beats the same opponent twice.</p>
    </details>`;

  // The Saylor points table, built from the same formula the rankings use (so it cannot drift).
  function pointsTable() {
    const classes = [['A', 1], ['B', 2], ['C', 3]], bands = ['75–100%', '50–75%', '25–50%', '0–25%'];
    const pts = (me, opp, q, o) => 1250 + (me - 2) * 50 + (opp - 2) * -200 + (q - 4) * 100 + (o === 'L' ? -700 : o === 'T' ? -300 : 0);
    const head1 = classes.map(([c]) => `<th colspan="4" class="grp gr">Opponent Class ${c}</th>`).join('');
    const head2 = classes.map(() => bands.map((b, k) => `<th${k === 3 ? ' class="gr"' : ''}>${b}</th>`).join('')).join('');
    const body = classes.map(([mc, me]) => [['W', 'Win'], ['T', 'Tie'], ['L', 'Loss']].map(([o, label], i) =>
      `<tr${i === 2 ? ' class="end"' : ''}>${i === 0 ? `<th rowspan="3" class="yc">Class ${mc}</th>` : ''}<th class="res">${label}</th>${
        classes.map(([, opp]) => [4, 3, 2, 1].map((q, j) => `<td${j === 3 ? ' class="gr"' : ''}>${fmtInt(pts(me, opp, q, o))}</td>`).join('')).join('')}</tr>`).join('')).join('');
    return `<div class="scroll"><table class="tbl pts"><thead><tr><th colspan="2" rowspan="2" class="corner">Your team</th>${head1}</tr><tr>${head2}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  const cmp = (a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (av === null || av === undefined) return bv === null || bv === undefined ? 0 : 1;
    if (bv === null || bv === undefined) return -1;
    const d = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
    return sortDir === 'desc' ? -d : d;
  };

  function draw() {
    const inView = S.ranked.rows.filter((r) => (cls === 'all' || r.cls === cls) && (!div || divOf[r.name] === div));
    viewRanks = cls === 'all' || div ? placeRanks(inView) : null;
    const rows = inView.slice().sort(cmp);
    document.getElementById('lede').textContent = div
      ? `Current ranking within division ${div}${cls === 'all' ? '' : `, Class ${cls} only`}, by Saylor points per game.`
      : 'Current ranking within class by Saylor points per game.';
    const COLS = ALL_COLS.filter((c) => !c.onlyAll || cls === 'all');
    if (!COLS.some((c) => c.key === sortKey && !c.nosort)) { sortKey = 'spPerGame'; sortDir = 'desc'; }
    const head = COLS.map((c, i) => {
      const sorted = c.key === sortKey;
      const sortable = !c.nosort;
      return `<th scope="col" class="${c.cls.replace('name', 'l')}"${sorted ? ` aria-sort="${sortDir === 'desc' ? 'descending' : 'ascending'}"` : ''}>${
        sortable ? `<button type="button" data-i="${i}">${esc(c.label)}</button>` : esc(c.label)}</th>`;
    }).join('');
    document.getElementById('tbl').innerHTML = `
      <thead><tr>${head}</tr></thead>
      <tbody>${rows.map((r) => `<tr>
        ${COLS.map((c) => {
          if (c.key === 'name') return `<td class="name"><a class="tn" href="${gameUrl(r.name)}">${logo(r.name)}${nm(r.name)}</a></td>`;
          const rk = c.rank && r.gp ? `<span class="rk">${r[c.rank]}</span>` : '';
          return `<td class="${c.cls}">${c.cell(r)}${rk}</td>`;
        }).join('')}
      </tr>`).join('')}</tbody>`;
    document.querySelectorAll('#tbl th button').forEach((b) => b.addEventListener('click', () => {
      const c = ALL_COLS.filter((q) => !q.onlyAll || cls === 'all')[Number(b.dataset.i)];
      if (c.key === sortKey) sortDir = sortDir === 'desc' ? 'asc' : 'desc';
      else { sortKey = c.key; sortDir = c.key === 'name' || c.rankCol ? 'asc' : 'desc'; }
      draw();
    }));
  }

  if (divisions.length) {
    const el = document.getElementById('divs'), n = (d) => S.schools.filter((x) => x.division === d).length;
    el.innerHTML = [['', 'All divisions', S.schools.length], ...divisions.map((d) => [d, d, n(d)])].map(([v, label, c]) =>
      `<button type="button" data-d="${esc(v)}" aria-pressed="${v === div}">${esc(label)}<span class="n">${c}</span></button>`).join('');
    el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      div = b.dataset.d; setParam('division', div);
      if (div && cls !== 'all') {   // a division spans classes, so show them all (pick a class again to narrow)
        cls = 'all'; setParam('class', 'all');
        document.querySelectorAll('#classes button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.c === 'all')));
      }
      el.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      draw();
    }));
  }
  classPicker(document.getElementById('classes'), classes, counts, cls, (c) => { cls = c; setParam('class', c); draw(); }, { all: true });
  draw();
}
