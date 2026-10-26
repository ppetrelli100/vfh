import { logo, nm, boot, esc, fmtPct, fmtInt, fmtDate, record, gameUrl, getParam, setParam, schoolOptions, classesOf } from './common.js';

const S = await boot('games');
if (S) {
  const app = document.getElementById('app');
  const byName = Object.fromEntries(S.schools.map((s) => [s.name, s]));
  const classes = classesOf(S.schools);
  let team = byName[getParam('team')] ? getParam('team') : '';
  let cls = classes.includes(getParam('class')) ? getParam('class') : '';

  app.innerHTML = `
    <h1 id="title">Games</h1>
    <p class="lede" id="lede"></p>
    <div class="toolbar">
      <label>Team<select id="team"><option value="">All teams</option>${schoolOptions(S.schools.map((s) => ({ ...s, id: s.name })), team)}</select></label>
      <label id="cls-wrap">Class<select id="cls"><option value="">All classes</option>${classes.map((c) =>
        `<option value="${esc(c)}"${c === cls ? ' selected' : ''}>Class ${esc(c)}</option>`).join('')}</select></label>
    </div>
    <div id="summary"></div>
    <div class="scroll"><table class="tbl" id="tbl"></table></div>`;

  const tags = (g) => {
    const out = [];
    if (g.status === 'cancelled') out.push('<span class="tag off">Cancelled</span>');
    else if (g.status === 'scheduled') out.push('<span class="tag">Scheduled</span>');
    else if (g.status === 'forfeit') out.push('<span class="tag">Forfeit</span>');
    if (g.overtime) out.push('<span class="tag">OT</span>');
    return out.join('');
  };
  const noteText = (g) => {
    const n = (g.note || '').trim();
    return n && !['ot', 'cancelled', 'forfeit'].includes(n.toLowerCase()) ? esc(n) : '';
  };
  const hasScore = (g) => g.homeScore !== null && g.awayScore !== null && g.status !== 'cancelled' && g.status !== 'scheduled';

  function drawAll() {
    const list = S.games.filter((g) => !cls || byName[g.home]?.cls === cls || byName[g.away]?.cls === cls).slice().reverse();
    document.getElementById('lede').textContent = `${list.length} games in ${S.season.label}${cls ? `, Class ${cls}` : ''}. Pick a team to see its schedule and how each game scored.`;
    document.getElementById('summary').innerHTML = '';
    document.getElementById('tbl').innerHTML = `
      <thead><tr><th class="l">Date</th><th style="text-align:center">Matchup</th><th class="l hide-sm">Notes</th></tr></thead>
      <tbody>${list.map((g) => {
        const hw = hasScore(g) && g.homeScore > g.awayScore, aw = hasScore(g) && g.awayScore > g.homeScore;
        const off = g.status === 'cancelled' ? ' struck' : '';
        const hs = hasScore(g) ? g.homeScore : '–', as = hasScore(g) ? g.awayScore : '–';
        return `<tr>
          <td class="l">${esc(fmtDate(g.date))}</td>
          <td class="matchup-cell"><div class="matchup">
            <a class="side home${hw ? ' w' : ''}${off}" href="${gameUrl(g.home)}">${nm(g.home)}${logo(g.home, 18)}</a>
            <span class="score-both">${hs}–${as}${tags(g)}</span>
            <span class="score home">${hs}</span><span class="vs">vs</span><span class="score away">${as}</span>
            <a class="side away${aw ? ' w' : ''}${off}" href="${gameUrl(g.away)}">${logo(g.away, 18)}${nm(g.away)}</a>
          </div></td>
          <td class="l hide-sm muted">${tags(g).replace('tag"', 'tag first"')}${noteText(g)}</td></tr>`;
      }).join('')}</tbody>`;
    if (!list.length) document.getElementById('tbl').innerHTML = '<tbody><tr><td class="empty">No games yet.</td></tr></tbody>';
  }

  function drawTeam() {
    const R = S.ranked.R[team];
    const log = FHEngine.teamGames(S.schools, S.games, team).reverse();
    const pts = log.reduce((s, x) => s + (x.saylor || 0), 0);
    document.getElementById('lede').innerHTML = `Class ${esc(R.cls)}${R.league ? `, ${esc(R.league)}` : ''}. <a href="/games.html">All games</a>`;
    document.getElementById('summary').innerHTML = `
      <div class="stats">
        <div class="stat"><b>${record(R)}</b><span>Record</span></div>
        <div class="stat"><b>${fmtPct(R.winPct)}</b><span>Win %</span></div>
        <div class="stat"><b>${fmtInt(R.spPerGame)}</b><span>Saylor points per game${R.gp ? `, ${R.rank_spPerGame}${ord(R.rank_spPerGame)} in Class ${esc(R.cls)}` : ''}</span></div>
        <div class="stat"><b>${R.inW}-${R.inL}-${R.inT}</b><span>In class</span></div>
      </div>`;
    document.getElementById('tbl').innerHTML = `
      <thead><tr><th class="l">Date</th><th class="l">Site</th><th class="l">Opponent</th><th>Result</th>
        <th class="hide-sm">Opponent class</th><th class="hide-sm">Opponent win %</th><th>Saylor points</th></tr></thead>
      <tbody>${log.map((x) => `<tr>
        <td class="l">${esc(fmtDate(x.date))}</td>
        <td class="l muted"><span class="nm"><span class="full">${x.home ? 'Home' : 'Away'}</span><span class="abbr">${x.home ? 'H' : 'A'}</span></span></td>
        <td class="name${x.status === 'cancelled' ? ' struck' : ''}"><a class="tn" href="${gameUrl(x.opp)}">${logo(x.opp)}${nm(x.opp)}</a></td>
        <td>${x.result ? `<span class="result-${x.result}">${x.result}</span> ${x.my}–${x.th}` : ''}${tags(x)}</td>
        <td class="hide-sm">${esc(x.oppClass || '')}</td>
        <td class="hide-sm">${fmtPct(x.oppWinPct)}</td>
        <td>${x.saylor === null ? '' : fmtInt(x.saylor)}</td></tr>`).join('')}
      ${log.length ? `<tr><td class="l key" colspan="4">Total, ${R.gp} games</td><td class="hide-sm"></td><td class="hide-sm"></td><td class="key">${fmtInt(pts)}</td></tr>` : ''}</tbody>`;
    if (!log.length) document.getElementById('tbl').innerHTML = '<tbody><tr><td class="empty">No games for this team yet.</td></tr></tbody>';
  }

  const ord = (n) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');

  function draw() {
    document.getElementById('title').innerHTML = team ? `<span class="tn">${logo(team, 40)}<span>${esc(team)}</span></span>` : 'Games';
    document.getElementById('cls-wrap').hidden = !!team;
    if (team) drawTeam(); else drawAll();
  }
  document.getElementById('team').addEventListener('change', (e) => { team = e.target.value; setParam('team', team); draw(); });
  document.getElementById('cls').addEventListener('change', (e) => { cls = e.target.value; setParam('class', cls); draw(); });
  draw();
}
