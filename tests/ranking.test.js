const E=require('../public/js/engine.js');
const schools=require('./fixtures/schools.json'), games=require('./fixtures/games.json'), sheet=require('./fixtures/ranking_sheet.json');
const {rows}=E.rank(schools,games);
const mine=Object.fromEntries(rows.map(r=>[r.name,r]));
const cols=[['w','w'],['l','l'],['t','t'],['winPct','winPct'],['rank_winPct','rank_winPct'],['sp','sp'],['rank_sp','rank_sp'],['spPerGame','spPerGame'],['inWinPct','inWinPct'],['rank_inWinPct','rank_inWinPct'],['gt500In','gt500In'],['rank_gt500In','rank_gt500In'],['gt500Out','gt500Out'],['rank_gt500Out','rank_gt500Out']];
const bad={};let n=0;
for(const s of sheet){const m=mine[s.name];if(!m){console.log('missing',s.name);continue}
 for(const [a,b] of cols){const x=s[a],y=m[b];n++;
  const xe=(x===null||x===''||x===undefined),ye=(y===null||y===undefined);
  const ok=(xe&&ye)||(!xe&&!ye&&Math.abs(Number(x)-Number(y))<1e-6);
  if(!ok){(bad[a]=bad[a]||[]).push([s.name,x,y])}}}
console.log('cells compared',n,'mismatching columns:',Object.keys(bad).length?Object.keys(bad):'NONE');
for(const k in bad){console.log(k,bad[k].length,'e.g.',JSON.stringify(bad[k].slice(0,6)))}
