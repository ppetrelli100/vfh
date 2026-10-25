const E = require('../public/js/engine.js'), S = require('../public/js/seeding-engine.js');
const schools = require('./fixtures/schools.json'), games = require('./fixtures/games.json'), K = require('./fixtures/seeding_sheet_C.json');
const { rows, rec } = E.rank(schools, games);

function run(opts, label) {
  const r = S.seed(rows, rec, games, 'C', opts);
  let bad = [];
  const eqList = (a, b, what) => { if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(what); };
  eqList(r.top12, K.top12, 'top12 list');
  const names = r.top12;
  // per-criterion matrices vs sheet (compare 1/0 cells)
  const m = { winPct: K.winPct, spPerGame: K.spPG, inWinPct: K.inClass, gt500In: K.gt500In, gt500Out: K.gt500Out, h2h: K.h2h, mutual: K.mo };
  for (const c of r.crit) {
    let diffs = [];
    for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
      if (i === j) continue;
      const mine = r.detail[i][j][c], sheet = m[c][i][j];
      if (Number(sheet) !== mine) diffs.push(`${names[i]} vs ${names[j]}: sheet ${sheet}, mine ${mine}`);
    }
    if (diffs.length) bad.push(`criterion ${c}: ${diffs.length} diffs e.g. ${diffs.slice(0, 3).join(' | ')}`);
  }
  for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) if (i !== j && Number(K.pairwise[i][j]) !== r.detail[i][j].win) bad.push(`pair ${names[i]}>${names[j]}`);
  eqList(r.total, K.total, 'totals');
  eqList(r.finalRank, K.finalRank, 'final ranks');
  console.log(label, bad.length ? 'MISMATCHES:\n  ' + bad.join('\n  ') : 'ALL MATCH (12 teams, 7 criteria, 132 pairs, totals, ranks)');
  return r;
}
const r = run({}, '[played games only]');
run({ countUnplayed: true }, '[count unplayed rows in mutual-opponent calc]');
console.log('\nSeeds:', r.table.map((x) => `${x.seed}. ${x.name} (${x.total})`).join('; '));
console.log('Bracket:', r.bracket.map((b) => `${b.high.seed} ${b.high.name} v ${b.low.seed} ${b.low.name}`).join('; '));
console.log('Sheet bracket: 1 New Hampton v 8 Portsmouth Abbey; 4 Frederick Gunn v 5 Pingree; 3 King v 6 Newton CDS; 2 Greens Farms v 7 Winsor');
