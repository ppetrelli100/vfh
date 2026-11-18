import { boot, api, esc, fmtDate, schoolOptions, store, logo } from './common.js';

const S = await boot('admin', { allowEmpty: true });
const app = document.getElementById('app');
const isAdmin = !!S && (S.me.role ? S.me.role === 'admin' : !!S.me.admin);   // coaches, once they exist, never see the reset

const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'}`;
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function main() {
  if (!S.me.admin) {
    app.innerHTML = `<h1>Enter scores</h1>
      <div class="panel"><strong>Administrator sign-in needed</strong>
        <p class="muted" style="margin:6px 0 0">Scores can only be added or changed by a signed-in league administrator. If you have just signed in, reload this page. If it still shows this message, ask the site owner to add your email address.</p></div>`;
    return;
  }
  const $ = (id) => document.getElementById(id);
  const hasSeason = !!S.season;

  app.innerHTML = `
    <h1>Enter scores</h1>
    <p class="lede">${hasSeason ? `Adding results to ${esc(S.season.label)}. Rankings and playoff seeds update as soon as a game is saved.` : 'No season has been set up yet. Load the Fall 2024 season or start a new one below.'}
      <span class="muted">Signed in as ${esc(S.me.email)}.</span></p>
    ${hasSeason ? `
    <form id="form" class="panel form-grid" novalidate>
      <div id="mu" class="mu" hidden></div>
      <div id="editing" class="editing" hidden></div>
      <div class="teams">
        <div class="field"><label for="date">Game date</label><input type="date" id="date" required><div class="err" id="err-date"></div></div>
        <div class="field"><label for="status">Result</label>
          <select id="status"><option value="final">Final score</option><option value="forfeit">Forfeit</option><option value="cancelled">Cancelled</option><option value="scheduled">Not played yet (needs a score)</option></select>
          <div class="err" id="err-status"></div></div>
      </div>
      <div class="teams">
        <div class="field"><label for="home">Home team</label>
          <select id="home">${schoolOptions(S.schools, '', { blank: 'Choose a team' })}</select><div class="err" id="err-home"></div></div>
        <div class="field"><label for="away">Away team</label>
          <select id="away">${schoolOptions(S.schools, '', { blank: 'Choose a team' })}</select><div class="err" id="err-away"></div></div>
      </div>
      <div class="teams" id="scores">
        <div class="field"><label for="hs">Home score</label><input type="number" id="hs" class="score" min="0" max="99" step="1" inputmode="numeric"><div class="err" id="err-homeScore"></div></div>
        <div class="field"><label for="as">Away score</label><input type="number" id="as" class="score" min="0" max="99" step="1" inputmode="numeric"><div class="err" id="err-awayScore"></div></div>
      </div>
      <div class="field" id="winner-wrap" hidden>
        <span class="lab">Who won the forfeit?</span>
        <div class="checks">
          <label><input type="radio" name="winner" value="home"> <span id="w-home">Home team</span></label>
          <label><input type="radio" name="winner" value="away"> <span id="w-away">Away team</span></label>
        </div>
        <div class="hint">A forfeit is recorded as a 1–0 win for the team that did not forfeit.</div>
        <div class="err" id="err-winner"></div>
      </div>
      <div class="checks" id="ot-wrap"><label><input type="checkbox" id="ot"> Decided in overtime</label></div>
      <div class="checks" id="pl-wrap"><label><input type="checkbox" id="pl"> Playoff game</label><span class="hint" id="pl-hint" style="margin-left:8px"></span></div>
      <div id="pl-decided" hidden>
        <div class="field"><label for="dec">How was it decided?</label>
          <select id="dec"><option value="0">Regulation</option><option value="1">Overtime</option><option value="2">Second overtime</option><option value="so">Shootout</option></select></div>
        <div class="field" id="so-wrap" hidden>
          <span class="lab">Who won the shootout?</span>
          <div class="checks">
            <label><input type="radio" name="sowin" value="home"> <span id="so-home">Home team</span></label>
            <label><input type="radio" name="sowin" value="away"> <span id="so-away">Away team</span></label>
          </div>
          <div class="hint">Enter the score after overtime (level). The shootout winner advances. Playoff games do not count in rankings or seeding.</div>
          <div class="err" id="err-soWinner"></div>
        </div>
      </div>
      <div class="teams stack">
        <div class="field"><label for="division">Division</label>
          <input type="hidden" id="division" value="">
          <div class="choice" id="division-btns" role="group" aria-label="Division">${['D1/2', 'D3', 'D4', 'Crossover'].map((d) => `<button type="button" class="chip" data-v="${d}" aria-pressed="false">${d}</button>`).join('')}</div>
          <div class="hint" id="div-hint"></div><div class="err" id="err-division"></div></div>
        <div class="field"><label for="note">Note (optional)</label><input type="text" id="note" maxlength="120" placeholder="For example, played at a neutral site"></div>
      </div>
      <div id="third" class="alert" hidden></div>
      <div id="dup" class="alert" hidden></div>
      <div class="actions">
        <button type="submit" class="btn" id="save">Save game</button>
        <button type="button" class="btn ghost" id="cancel-edit" hidden>Cancel changes</button>
        <span class="status" id="msg" role="status"></span>
        <div class="reset-wrap" id="reset-wrap" hidden><button type="button" class="btn reset" id="reset-game"><span id="reset-label">Reset this game</span><small>Admin only</small></button></div>
      </div>
    </form>

    <h2>Games</h2>
    <p class="hint" style="margin:0 0 8px">Tap a game to enter or change its score. Opens at today's games; scroll for earlier or later ones.</p>
    <div class="toolbar gfilter" id="gfilter">
      <label>Team<select id="f-team">${schoolOptions(S.schools, '', { blank: 'All teams' })}</select></label>
      <label>Date<input type="date" id="f-date"></label>
      <button type="button" class="btn ghost" id="f-reset" disabled>Reset filters</button>
      <span class="hint" id="f-count"></span>
    </div>
    <div class="scroll games-list" id="glist"><table class="tbl" id="recent"></table></div>` : ''}

    ${hasSeason ? `<details class="tools" id="po-wrap">
      <summary>Playoff settings</summary>
      <div class="panel">
        <h3 style="margin:0 0 4px">Teams compared</h3>
        <p class="hint" style="margin:0 0 8px">Sets what everyone sees on the Playoffs page for <strong>${esc(S.season.label)}</strong>. Top 12 compares the 12 teams in each class with the most Saylor points per game. All .500+ teams compares every team with a .500 record overall or in class, which gets long early in the season. Saves right away.</p>
        <div class="seg" id="po-pool" role="group" aria-label="Teams compared">
          <button type="button" data-v="top12" aria-pressed="false">Top 12</button>
          <button type="button" data-v="all500" aria-pressed="false">All .500+ teams</button></div>
        <div class="status" id="po-pool-msg" role="status" style="margin-top:6px"></div>
        <h3 style="margin:18px 0 4px">Lock the bracket</h3>
        <p class="hint" style="margin:0 0 8px">When the regular season is over, lock the seeds. The Playoffs page then shows the eight seeds in each class as they are now, and they stop changing. Enter playoff games on this page with <strong>Playoff game</strong> checked; the scores appear on the bracket and the winners move on. Unlocking goes back to live seeds.</p>
        <div class="seg" id="po-lock" role="group" aria-label="Seeds">
          <button type="button" data-v="off" aria-pressed="true">Unlocked</button>
          <button type="button" data-v="on" aria-pressed="false">Locked</button></div>
        <div class="status" id="po-lock-msg" role="status" style="margin-top:6px"></div>
        <div class="hint" id="po-lock-state" style="margin-top:6px"></div>
        <h3 style="margin:18px 0 4px">Exclude from playoffs</h3>
        <p class="hint" style="margin:0 0 10px">A school listed here stays in the rankings and its games still count for everyone else, but it is left out of the playoff picture for <strong>${esc(S.season.label)}</strong>. The next team in its class takes its place in the pool. Changes save right away.</p>
        <div class="teams">
          <div class="field"><label for="po-school">School</label><select id="po-school"></select></div>
          <div class="field"><label for="po-note">Reason (optional)</label><input type="text" id="po-note" maxlength="120" placeholder="For example, injuries"></div>
        </div>
        <div class="actions" style="margin-top:8px"><button type="button" class="btn ghost" id="po-add">Exclude from playoffs</button><span class="status" id="po-msg" role="status"></span></div>
        <h3 style="margin:18px 0 4px">Currently excluded</h3>
        <div class="scroll"><table class="tbl" id="po-tbl"></table></div>
      </div>
    </details>` : ''}

    ${hasSeason ? `<details class="tools" id="sc-wrap">
      <summary>Schools and classes</summary>
      <div class="panel">
        <p class="hint" style="margin:0 0 10px">Classes belong to a season. Changes here apply to <strong>${esc(S.season.label)}</strong> only, and the rankings, points and seeds update as soon as you save.</p>
        <div class="scroll"><table class="tbl" id="sc-tbl"></table></div>
        <div class="actions" style="margin-top:10px"><button type="button" class="btn" id="sc-save" disabled>Save changes</button>
          <button type="button" class="btn ghost" id="sc-reset" disabled>Undo changes</button><span class="status" id="sc-msg" role="status"></span></div>
        <h3 style="margin:18px 0 4px">Paste a list</h3>
        <p class="hint" style="margin:0 0 8px">One school per line, with the class (A, B or C) at the end. Tabs or commas both work, so a column copied from a spreadsheet is fine. Lines are matched to the school names in the table; nothing is saved until you press Save changes.</p>
        <textarea id="sc-paste" rows="5" placeholder="Phillips Andover&#9;Andover&#9;A"></textarea>
        <div class="actions" style="margin-top:8px"><button type="button" class="btn ghost" id="sc-apply">Apply list to the table</button><span class="status" id="sc-paste-msg" role="status"></span></div>
        <h3 style="margin:18px 0 4px">Add a school to this season</h3>
        <div class="teams">
          <div class="field"><label for="sc-new-name">School name</label><input type="text" id="sc-new-name" maxlength="60" placeholder="Name as it should appear"></div>
          <div class="field"><label for="sc-new-cls">Class</label><select id="sc-new-cls"><option>A</option><option>B</option><option>C</option></select></div>
        </div>
        <div class="actions" style="margin-top:8px"><button type="button" class="btn ghost" id="sc-add">Add school</button><span class="status" id="sc-add-msg" role="status"></span></div>
      </div>
    </details>` : ''}

    <details class="tools"${hasSeason ? '' : ' open'}>
      <summary>Season tools</summary>
      <div class="panel form-grid">
        <div>
          <h3 style="margin:0 0 4px">Load the Fall 2024 season</h3>
          <p class="hint" style="margin:0 0 10px">Adds the 74 schools and 591 games from the season spreadsheet. If a Fall 2024 season is already here, its games and school list are replaced.</p>
          <div class="actions"><button type="button" class="btn ghost" id="load-test">Load Fall 2024 season</button><span class="status" id="load-msg" role="status"></span></div>
        </div>
        <div>
          <h3 style="margin:0 0 4px">Create the Fall 2026 season</h3>
          <p class="hint" style="margin:0 0 10px">Adds a Fall 2026 season with the 73 schools in their Fall 2026 classes and the 588 games from the coach's scoreboard (scores through Oct 26, plus the schedule to Nov 14). It becomes the current season; Fall 2024 is left as it is. You can adjust any class afterwards under Schools and classes.</p>
          <div class="actions"><button type="button" class="btn ghost" id="load-26"${S.seasons.some((x) => x.id === 'fall-2026') ? ' disabled' : ''}>Create Fall 2026 season</button><span class="status" id="load26-msg" role="status">${S.seasons.some((x) => x.id === 'fall-2026') ? 'Already created.' : ''}</span></div>
        </div>
        <div>
          <h3 style="margin:0 0 4px">Start a new season</h3>
          <div class="teams">
            <div class="field"><label for="ns-id">Season id</label><input type="text" id="ns-id" placeholder="2026" maxlength="20"></div>
            <div class="field"><label for="ns-label">Season name</label><input type="text" id="ns-label" placeholder="2026 season"></div>
          </div>
          <div class="checks" style="margin-top:8px">
            <label><select id="ns-copy"><option value="">Start with no schools</option>${S.seasons.map((s) => `<option value="${esc(s.id)}">Copy schools and classes from ${esc(s.label)}</option>`).join('')}</select></label>
            <label><input type="checkbox" id="ns-games"> Also copy that season's games (for a practice season)</label>
            <label><input type="checkbox" id="ns-current" checked> Make it the current season</label>
          </div>
          <div class="actions" style="margin-top:10px"><button type="button" class="btn ghost" id="ns-go">Create season</button><span class="status" id="ns-msg" role="status"></span></div>
        </div>
        <div>
          <h3 style="margin:0 0 4px">Remove a season</h3>
          <p class="hint" style="margin:0 0 10px">Deletes the season with all of its games and its school list. This can't be undone.</p>
          <div class="field"><label for="rm-pick">Season</label><select id="rm-pick">${S.seasons.map((s) => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('')}</select></div>
          <div class="actions" style="margin-top:10px"><button type="button" class="btn ghost" id="rm-go">Remove season</button><span class="status" id="rm-msg" role="status"></span></div>
        </div>
      </div>
    </details>

    <details class="tools" id="log-wrap">
      <summary>Change log</summary>
      <p class="hint" style="margin:0 0 8px">Every score added, changed or deleted, newest first, with who entered it.</p>
      <div class="scroll games-list" id="log-box"><table class="tbl" id="log-tbl"><tbody><tr><td class="empty">Open to load.</td></tr></tbody></table></div>
    </details>`;

  wireTools($);
  wireLog($);
  if (hasSeason) { wireForm($); wirePlayoffs($); wireClasses($); }
}

function wireLog($) {
  const wrap = $('log-wrap'), tbl = $('log-tbl');
  const fmtAt = (at) => { const d = new Date(String(at).replace(' ', 'T') + 'Z'); return isNaN(d) ? at : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
  const score = (g) => g.status === 'scheduled' ? 'needs score' : g.status === 'cancelled' ? 'cancelled' : `${g.homeScore}–${g.awayScore}${g.status === 'forfeit' ? ' forfeit' : ''}${g.overtime ? ' OT' : ''}`;
  const label = (g) => `${fmtDate(g.date)}, ${g.home} vs ${g.away}`;
  const what = (e) => {
    const b = e.before, a = e.after;
    if (e.gameId && e.action === 'create' && a) return `Added ${label(a)}: ${score(a)}`;
    if (e.gameId && e.action === 'delete' && b) return `Deleted ${label(b)} (was ${score(b)})`;
    if (e.gameId && e.action === 'update' && a && b) {
      const ch = [];
      if (score(a) !== score(b)) {
        if (b.status === 'scheduled') ch.push(a.status === 'cancelled' ? 'marked cancelled' : `score entered: ${score(a)}`);
        else if (a.status === 'scheduled') ch.push(`reset to needs score (was ${score(b)})`);
        else ch.push(`score ${score(b)} → ${score(a)}`);
      }
      if (a.date !== b.date) ch.push(`date ${fmtDate(b.date)} → ${fmtDate(a.date)}`);
      if (a.home !== b.home || a.away !== b.away) ch.push(`teams ${b.home} vs ${b.away} → ${a.home} vs ${a.away}`);
      if ((a.division || '') !== (b.division || '')) ch.push(`division ${b.division || 'none'} → ${a.division || 'none'}`);
      if ((a.note || '') !== (b.note || '')) ch.push('note changed');
      return `${label(a)}: ${ch.join('; ') || 'saved with no changes'}`;
    }
    const x = a || b || {};
    const sname = (id) => { const f = S.seasons.find((q) => q.id === id); return `'${f ? f.label : id}'`; };
    if (e.action === 'import') return `Imported season ${sname(x.season)} from spreadsheet: ${x.games} games, ${x.schools} schools${x.replace ? ' (replaced the existing games)' : ''}`;
    if (e.action === 'season-delete') return `Deleted season '${x.label || x.id}' (${x.games} games)`;
    if (e.action === 'season') return `Created season '${x.label || x.id}'${x.copyFrom ? `, copied schools${x.copyGames ? ' and games' : ''} from ${sname(x.copyFrom)}` : ''}`;
    if (e.action === 'playoff-pool') return `Set the ${sname(x.season)} playoff pool to ${x.pool === 'all500' ? 'all teams with .500 or better' : 'the top 12'}`;
    if (e.action === 'playoff-lock') return x.locked ? `Locked the ${sname(x.season)} playoff seeds` : `Unlocked the ${sname(x.season)} playoff seeds`;
    if (e.action === 'playoffs') return `${x.out ? 'Took' : 'Put'} ${x.name} ${x.out ? 'out of' : 'back in'} the ${sname(x.season)} playoffs${x.out && x.note ? ` (${x.note})` : ''}`;
    if (e.action === 'classes') return `Changed school classes in ${sname(x.season)}${Array.isArray(x.changes) ? `: ${x.changes.length} change${x.changes.length === 1 ? '' : 's'}` : ''}`;
    return e.action.replace(/[_-]/g, ' ');
  };
  let loaded = false;
  async function load() {
    try {
      const r = await api('/api/audit?limit=300');
      tbl.innerHTML = `<thead><tr><th class="l">When</th><th class="l">Who entered</th><th class="l">What</th></tr></thead><tbody>${
        r.entries.map((e) => `<tr><td class="l" style="white-space:nowrap">${esc(fmtAt(e.at))}</td><td class="l">${esc((e.actor || '').split('@')[0])}</td><td class="l" style="white-space:normal">${esc(what(e))}</td></tr>`).join('')
        || '<tr><td class="empty">Nothing logged yet.</td></tr>'}</tbody>`;
      loaded = true;
    } catch (err) { tbl.innerHTML = `<tbody><tr><td class="empty">Could not load the change log: ${esc(err.message || err)}</td></tr></tbody>`; }
  }
  wrap.addEventListener('toggle', () => { if (wrap.open) load(); });
}

function wireTools($) {
  const loadBtn = $('load-test'), loadMsg = $('load-msg');
  let armed = null;
  loadBtn.addEventListener('click', async () => {
    if (!armed) {
      loadBtn.textContent = 'Click again to confirm';
      armed = setTimeout(() => { armed = null; loadBtn.textContent = 'Load Fall 2024 season'; }, 5000);
      return;
    }
    clearTimeout(armed); armed = null; loadBtn.disabled = true; loadBtn.textContent = 'Loading…';
    try {
      const seed = await (await fetch('/seed/fall-2024.json')).json();
      const r = await api('/api/import', { method: 'POST', body: { ...seed, replace: true } });
      loadMsg.className = 'status ok'; loadMsg.textContent = `Loaded ${r.games} games for ${r.schools} schools.`;
      store.set('vfh.season', 'fall-2024');
      setTimeout(() => { location.href = '/admin.html?season=fall-2024'; }, 700);
    } catch (e) {
      loadMsg.className = 'status bad'; loadMsg.textContent = e.message;
      loadBtn.disabled = false; loadBtn.textContent = 'Load Fall 2024 season';
    }
  });
  const b26 = $('load-26'), m26 = $('load26-msg');
  b26.addEventListener('click', async () => {
    b26.disabled = true; b26.textContent = 'Creating…';
    try {
      const seed = await (await fetch('/seed/fall-2026.json')).json();
      const r = await api('/api/import', { method: 'POST', body: seed });
      m26.className = 'status ok'; m26.textContent = `Created Fall 2026 with ${r.schools} schools.`;
      store.set('vfh.season', 'fall-2026');
      setTimeout(() => { location.href = '/admin.html?season=fall-2026'; }, 700);
    } catch (e) { m26.className = 'status bad'; m26.textContent = e.message; b26.disabled = false; b26.textContent = 'Create Fall 2026 season'; }
  });
  const rmBtn = $('rm-go'), rmMsg = $('rm-msg'), rmPick = $('rm-pick');
  let rmArmed = null;
  const rmReset = () => { clearTimeout(rmArmed); rmArmed = null; rmBtn.textContent = 'Remove season'; };
  if (!rmPick.options.length) rmBtn.disabled = true;
  rmPick.addEventListener('change', () => { rmReset(); rmMsg.textContent = ''; });
  rmBtn.addEventListener('click', async () => {
    if (!rmArmed) {
      rmBtn.textContent = `Click again to remove ${rmPick.options[rmPick.selectedIndex].text}`;
      rmArmed = setTimeout(rmReset, 6000);
      return;
    }
    const id = rmPick.value;
    rmReset(); rmBtn.disabled = true;
    try {
      const r = await api(`/api/seasons/${encodeURIComponent(id)}`, { method: 'DELETE' });
      rmMsg.className = 'status ok'; rmMsg.textContent = `Removed the season and its ${r.games} games.`;
      if (store.get('vfh.season') === id) store.del('vfh.season');
      setTimeout(() => { location.href = '/admin.html'; }, 900);
    } catch (e) { rmMsg.className = 'status bad'; rmMsg.textContent = e.message; rmBtn.disabled = false; }
  });
  $('ns-go').addEventListener('click', async () => {
    const msg = $('ns-msg');
    try {
      const r = await api('/api/seasons', { method: 'POST', body: {
        id: $('ns-id').value.trim(), label: $('ns-label').value.trim(), copyFrom: $('ns-copy').value || null, copyGames: $('ns-games').checked, isCurrent: $('ns-current').checked } });
      msg.className = 'status ok'; msg.textContent = `Created ${r.season.label}.`;
      store.set('vfh.season', r.season.id);
      setTimeout(() => { location.href = `/admin.html?season=${encodeURIComponent(r.season.id)}`; }, 700);
    } catch (e) { msg.className = 'status bad'; msg.textContent = e.message; }
  });
}

// Schools-and-classes editor: edit classes in a table, or paste a list, then save in one go.
function wirePlayoffs($) {
  const tbl = $('po-tbl'); if (!tbl) return;
  const pm = $('po-pool-msg');
  const showPool = (v) => document.querySelectorAll('#po-pool button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
  showPool(S.season.playoffPool === 'all500' ? 'all500' : 'top12');
  document.querySelectorAll('#po-pool button').forEach((b) => b.addEventListener('click', async () => {
    pm.className = 'status'; pm.textContent = 'Saving...';
    try {
      await api(`/api/seasons/${encodeURIComponent(S.season.id)}/pool`, { method: 'PUT', body: { pool: b.dataset.v } });
      S.season.playoffPool = b.dataset.v; showPool(b.dataset.v);
      pm.className = 'status ok'; pm.textContent = b.dataset.v === 'all500' ? 'The Playoffs page now compares all teams with .500 or better.' : 'The Playoffs page now compares the top 12 in each class.';
    } catch (e) { pm.className = 'status bad'; pm.textContent = e.message; }
  }));
  // Lock or unlock the seeds. The seeds are worked out here, from the same data and settings the Playoffs page uses.
  const lm = $('po-lock-msg');
  const lockState = () => {
    const L = S.season.bracketLock;
    document.querySelectorAll('#po-lock button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.v === 'on') === !!L)));
    $('po-lock-state').innerHTML = L ? `Locked. ${Object.keys(L).sort().map((c) => `Class ${esc(c)}: ${L[c].filter(Boolean).length} seeds`).join('; ')}. The Playoffs page shows these seeds.` : 'Not locked. The Playoffs page shows live seeds.';
    document.getElementById('pl')?.dispatchEvent(new Event('input', { bubbles: true }));
  };
  lockState();
  // Save, then read the season back from the server and show what it really holds, so the page never claims a lock it does not have.
  async function putLock(locked) {
    lm.className = 'status'; lm.textContent = 'Saving...';
    try {
      await api(`/api/seasons/${encodeURIComponent(S.season.id)}/bracket`, { method: 'PUT', body: { locked } });
      const data = await api(`/api/data?season=${encodeURIComponent(S.season.id)}&v=${Date.now()}`);
      S.season.bracketLock = data.season.bracketLock || null; lockState();
      const ok = !!S.season.bracketLock === !!locked;
      lm.className = `status ${ok ? 'ok' : 'bad'}`;
      lm.textContent = ok ? (locked ? 'Seeds locked.' : 'Seeds unlocked.') : `The server did not keep that change: it still shows the seeds as ${S.season.bracketLock ? 'locked' : 'unlocked'}. Reload the page and try again.`;
    } catch (e) { lm.className = 'status bad'; lm.textContent = e.message; }
  }
  document.querySelectorAll('#po-lock button').forEach((b) => b.addEventListener('click', () => {
    const on = b.dataset.v === 'on';
    if (on === !!S.season.bracketLock) return;
    if (!on) { if (window.confirm('Unlock the seeds? The bracket goes back to live seeds, but saved playoff games are kept.')) putLock(null); return; }
    const locked = {};
    const excluded = S.schools.filter((x) => x.playoffOut).map((x) => x.name);
    for (const c of [...new Set(S.schools.map((x) => x.cls))].sort()) {
      const res = FHSeeding.seed(S.ranked.rows, S.ranked.rec, S.games, c, { ...(S.season.playoffPool === 'all500' ? { poolRequires500: true, size: 999 } : {}), excluded });
      const seeds = Array(8).fill(null);
      res.table.forEach((t) => { if (t.bseed) seeds[t.bseed - 1] = t.name; });
      if (seeds.some(Boolean)) locked[c] = seeds;
    }
    putLock(locked);
  }));
  const msg = $('po-msg');
  const state = new Map(S.schools.map((x) => [x.name, { cls: x.cls, out: !!x.playoffOut, note: x.playoffNote || '' }]));
  function draw() {
    const rows = [...state].filter(([, v]) => v.out).sort((a, b) => a[1].cls.localeCompare(b[1].cls) || a[0].localeCompare(b[0]));
    tbl.innerHTML = rows.length
      ? `<thead><tr><th class="l">School</th><th>Class</th><th class="l">Reason</th><th></th></tr></thead><tbody>${rows.map(([n, v]) => `<tr><td class="l name">${esc(n)}</td><td>${esc(v.cls)}</td><td class="l">${esc(v.note) || '<span class="muted">none</span>'}</td><td><button type="button" class="btn ghost" data-back="${esc(n)}">Put back</button></td></tr>`).join('')}</tbody>`
      : '<tbody><tr><td class="l muted">No schools are excluded.</td></tr></tbody>';
    const avail = S.schools.filter((x) => !state.get(x.name).out).slice().sort((a, b) => a.name.localeCompare(b.name));
    $('po-school').innerHTML = `<option value="">Choose a school</option>${avail.map((x) => `<option value="${esc(x.name)}">${esc(x.name)} (${esc(x.cls)})</option>`).join('')}`;
  }
  async function save(name, out, note) {
    msg.className = 'status'; msg.textContent = 'Saving...';
    try {
      await api(`/api/seasons/${encodeURIComponent(S.season.id)}/playoffs`, { method: 'PUT', body: { name, out, note } });
      state.set(name, { ...state.get(name), out, note: out ? note : '' });
      msg.className = 'status ok'; msg.textContent = out ? `${name} is out of the playoffs.` : `${name} is back in.`;
      draw();
    } catch (e) { msg.className = 'status bad'; msg.textContent = e.message; }
  }
  $('po-add').addEventListener('click', () => {
    const n = $('po-school').value;
    if (!n) { msg.className = 'status bad'; msg.textContent = 'Choose a school.'; return; }
    const note = $('po-note').value.trim(); $('po-note').value = '';
    save(n, true, note);
  });
  tbl.addEventListener('click', (e) => { const b = e.target.closest('[data-back]'); if (b) save(b.dataset.back, false, ''); });
  draw();
}

function wireClasses($) {
  const tbl = $('sc-tbl'); if (!tbl) return;
  const orig = new Map(S.schools.map((x) => [x.name, { cls: x.cls, division: x.division || '' }]));
  const cur = new Map([...orig].map(([k, v]) => [k, { ...v, remove: false }]));
  const added = new Set();            // names added in this edit
  const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9]/g, '');
  const msg = $('sc-msg');
  const dirty = () => [...cur].filter(([k, v]) => added.has(k) || v.remove || v.cls !== orig.get(k)?.cls || v.division !== orig.get(k)?.division);
  function draw() {
    const names = [...cur.keys()].sort((a, b) => a.localeCompare(b));
    tbl.innerHTML = `<thead><tr><th class="l">School</th><th>Class</th><th>Division</th><th>Take out</th></tr></thead><tbody>${names.map((n) => {
      const v = cur.get(n), o = orig.get(n), ch = added.has(n) || v.remove || v.cls !== o?.cls || v.division !== o?.division;
      return `<tr class="${ch ? 'chg' : ''}${v.remove ? ' struck' : ''}"><td class="l name">${esc(n)}${added.has(n) ? ' <span class="tag">new</span>' : ''}</td>
        <td><select data-n="${esc(n)}" data-f="cls" aria-label="Class for ${esc(n)}">${['A', 'B', 'C'].map((c) => `<option${c === v.cls ? ' selected' : ''}>${c}</option>`).join('')}</select>
          ${o && o.cls !== v.cls ? `<span class="muted"> was ${o.cls}</span>` : ''}</td>
        <td><select data-n="${esc(n)}" data-f="division" aria-label="Division for ${esc(n)}">${['', 'D1/2', 'D3', 'D4'].map((d) => `<option value="${d}"${d === v.division ? ' selected' : ''}>${d || 'none'}</option>`).join('')}</select>
          ${o && o.division !== v.division ? `<span class="muted"> was ${o.division || 'none'}</span>` : ''}</td>
        <td><input type="checkbox" data-n="${esc(n)}" data-f="remove"${v.remove ? ' checked' : ''} aria-label="Take ${esc(n)} out of this season"></td></tr>`;
    }).join('')}</tbody>`;
    const n = dirty().length;
    $('sc-save').disabled = !n; $('sc-reset').disabled = !n;
    $('sc-save').textContent = n ? `Save ${n} change${n === 1 ? '' : 's'}` : 'Save changes';
  }
  tbl.addEventListener('change', (e) => {
    const t = e.target, n = t.dataset.n; if (!n) return;
    const v = cur.get(n);
    if (t.dataset.f === 'remove') v.remove = t.checked; else v[t.dataset.f] = t.value.trim();
    msg.textContent = ''; draw();
  });
  $('sc-reset').addEventListener('click', () => {
    for (const k of [...cur.keys()]) { if (added.has(k)) cur.delete(k); else cur.set(k, { ...orig.get(k), remove: false }); }
    added.clear(); msg.textContent = ''; draw();
  });
  $('sc-add').addEventListener('click', () => {
    const name = $('sc-new-name').value.trim(), m = $('sc-add-msg');
    if (!name) { m.className = 'status bad'; m.textContent = 'Type the school name.'; return; }
    if ([...cur.keys()].some((k) => norm(k) === norm(name))) { m.className = 'status bad'; m.textContent = `${name} is already in this season.`; return; }
    cur.set(name, { cls: $('sc-new-cls').value, division: '', remove: false }); added.add(name);
    $('sc-new-name').value = ''; m.className = 'status ok'; m.textContent = 'Added to the table. Press Save changes.'; draw();
  });
  // Pasted list: match each line to one school, by name (ignoring punctuation and case; a short
  // form such as "Choate RH" or "Newton CD" matches "Choate" or "Newton CDS" when it is unambiguous).
  $('sc-apply').addEventListener('click', () => {
    const m = $('sc-paste-msg'), lines = $('sc-paste').value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const names = [...cur.keys()].filter((k) => !cur.get(k).remove), ln = new Map(names.map((k) => [norm(k), k]));
    const find = (tok) => {
      const t = norm(tok); if (!t) return null;
      if (ln.has(t)) return [ln.get(t)];
      return names.filter((k) => { const x = norm(k); return x.length >= 4 && t.length >= 4 && (t.startsWith(x) || x.startsWith(t)); });
    };
    let applied = 0; const bad = [];
    for (const line of lines) {
      const parts = line.split(/\t|,/).map((x) => x.trim()).filter(Boolean);
      const cls = (parts.pop() || '').toUpperCase();
      if (!/^[ABC]$/.test(cls) || !parts.length) { bad.push(`${line} (needs a class A, B or C at the end)`); continue; }
      let hit = null;
      for (const tok of parts.slice().reverse()) { const f = find(tok); if (f && f.length === 1) { hit = f[0]; break; } }
      if (!hit) { bad.push(`${parts.join(' / ')} (no single matching school)`); continue; }
      cur.get(hit).cls = cls; applied++;
    }
    m.className = bad.length ? 'status bad' : 'status ok';
    m.textContent = `${applied} of ${lines.length} lines applied.${bad.length ? ` Not matched: ${bad.slice(0, 6).join('; ')}${bad.length > 6 ? `; and ${bad.length - 6} more` : ''}.` : ' Press Save changes to keep them.'}`;
    draw();
  });
  $('sc-save').addEventListener('click', async () => {
    const changes = dirty().map(([k, v]) => ({ name: k, cls: v.cls, division: v.division, remove: v.remove }));
    $('sc-save').disabled = true;
    try {
      const r = await api(`/api/seasons/${encodeURIComponent(S.season.id)}/schools`, { method: 'PUT', body: { changes } });
      msg.className = 'status ok'; msg.textContent = `Saved ${r.changed} change${r.changed === 1 ? '' : 's'}.`;
      setTimeout(() => location.reload(), 600);
    } catch (e) { msg.className = 'status bad'; msg.textContent = e.message; $('sc-save').disabled = false; }
  });
  draw();
}

function wireForm($) {
  const form = $('form');
  const byId = Object.fromEntries(S.schools.map((s) => [String(s.id), s]));
  const touched = new Set();
  let editingId = null, busy = false;
  const FIELDS = { division: 'division-btns', date: 'date', home: 'home', away: 'away', homeScore: 'hs', awayScore: 'as', winner: 'winner-wrap', status: 'status', soWinner: 'so-wrap' };

  $('date').value = store.get('vfh.lastDate') || localToday();

  const read = () => ({
    season: S.season.id, date: $('date').value, homeId: $('home').value, awayId: $('away').value,
    status: $('status').value, homeScore: $('hs').value, awayScore: $('as').value,
    winner: (form.querySelector('input[name="winner"]:checked') || {}).value || '',
    overtime: $('pl').checked ? ($('dec').value === 'so' ? 2 : Number($('dec').value)) : $('ot').checked,
    gameType: $('pl').checked ? 'playoff' : 'regular',
    soWinner: $('pl').checked && $('dec').value === 'so' ? ((form.querySelector('input[name="sowin"]:checked') || {}).value || '') : '',
    division: $('division').value, note: $('note').value.trim(),
  });

  function validate(v) {
    const e = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) e.date = 'Enter the game date.';
    if (!v.division) e.division = 'Choose the division.';
    if (!v.homeId) e.home = 'Choose the home team.';
    if (!v.awayId) e.away = 'Choose the away team.';
    if (v.homeId && v.homeId === v.awayId) e.away = 'A team cannot play itself.';
    if (v.status === 'final') {
      const ok = (s) => /^\d{1,2}$/.test(String(s));
      if (!ok(v.homeScore)) e.homeScore = 'Enter a score from 0 to 99.';
      if (!ok(v.awayScore)) e.awayScore = 'Enter a score from 0 to 99.';
    }
    if (v.gameType === 'playoff') {
      if (v.status !== 'final') e.status = 'A playoff game needs a final score.';
      else if (/^\d{1,2}$/.test(String(v.homeScore)) && /^\d{1,2}$/.test(String(v.awayScore))) {
        const level = Number(v.homeScore) === Number(v.awayScore);
        if (v.soWinner && !level) e.soWinner = 'The scores are not level, so there is no shootout.';
        else if (v.overtime === 2 && $('dec').value === 'so' && !v.soWinner) e.soWinner = 'Choose who won the shootout.';
        else if (level && !v.soWinner) e.soWinner = 'A playoff game cannot end level. Choose Shootout and who won it.';
      }
    }
    if (v.status === 'forfeit' && !v.winner) e.winner = 'Choose which team won the forfeit.';
    return e;
  }

  function show(errs) {
    for (const [k, ctl] of Object.entries(FIELDS)) {
      const on = touched.has(k) && errs[k];
      $(`err-${k}`).textContent = on ? errs[k] : '';
      const el = $(ctl);
      if (el.classList) el.classList.toggle('invalid', !!on);
    }
  }
  const refreshErrors = () => show(validate(read()));

  function syncLayout() {
    thirdHint();
    const future = !!$('date').value && $('date').value > localToday();   // a game that hasn't happened can't have a score
    [...$('status').options].forEach((o) => { o.disabled = future && (o.value === 'final' || o.value === 'forfeit'); });
    if (future && ($('status').value === 'final' || $('status').value === 'forfeit')) $('status').value = 'scheduled';
    const st = $('status').value, v = read();
    $('scores').hidden = st !== 'final';
    const locked = !!(S.season.bracketLock && Object.keys(S.season.bracketLock).length);
    const editingPlayoff = editingId && (S.allGames.find((x) => x.id === editingId) || {}).gameType === 'playoff';
    $('pl').disabled = !locked && !editingPlayoff;
    if ($('pl').disabled) $('pl').checked = false;
    $('pl-wrap').classList.toggle('off', $('pl').disabled);
    $('pl-hint').textContent = $('pl').disabled ? 'Available after you lock the seeds in Playoff settings.' : '';
    const playoff = $('pl').checked;
    $('ot-wrap').hidden = st !== 'final' || playoff;
    $('pl-decided').hidden = st !== 'final' || !playoff;
    $('so-wrap').hidden = !(playoff && $('dec').value === 'so');
    $('so-home').textContent = byId[v.homeId] ? byId[v.homeId].name : 'Home team';
    $('so-away').textContent = byId[v.awayId] ? byId[v.awayId].name : 'Away team';
    $('winner-wrap').hidden = st !== 'forfeit';
    $('w-home').textContent = byId[v.homeId] ? byId[v.homeId].name : 'Home team';
    $('w-away').textContent = byId[v.awayId] ? byId[v.awayId].name : 'Away team';
    document.querySelectorAll('#division-btns .chip').forEach((b) => { const on = b.dataset.v === $('division').value; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    const hT = byId[v.homeId], aT = byId[v.awayId];
    $('mu').hidden = !hT && !aT;
    $('mu').innerHTML = `<span class="mt home">${hT ? `${esc(hT.name)}${logo(hT.name, 40)}` : '<span class="muted">Home team</span>'}</span><span class="vs">vs</span><span class="mt away">${aT ? `${logo(aT.name, 40)}${esc(aT.name)}` : '<span class="muted">Away team</span>'}</span>`;
    [...$('away').options].forEach((o) => { o.disabled = !!o.value && o.value === $('home').value; });
    [...$('home').options].forEach((o) => { o.disabled = !!o.value && o.value === $('away').value; });
  }

  function say(text, kind) { const m = $('msg'); m.textContent = text; m.className = `status${kind ? ' ' + kind : ''}`; }
  const hideDup = () => { $('dup').hidden = true; };

  $('division-btns').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    $('division').value = $('division').value === b.dataset.v ? '' : b.dataset.v;   // click again to un-select
    touched.add('division'); autoDiv = false; $('div-hint').textContent = ''; hideDup(); syncLayout(); refreshErrors();
  });

  form.addEventListener('input', (e) => {
    hideDup();
    const map = { date: 'date', home: 'home', away: 'away', hs: 'homeScore', as: 'awayScore', status: 'status', division: 'division', dec: 'soWinner' };
    if (map[e.target.id]) touched.add(map[e.target.id]);
    if (e.target.name === 'winner') touched.add('winner');
    if (e.target.name === 'sowin' || e.target.id === 'pl') touched.add('soWinner');
    if (e.target.id === 'home' && $('away').value === $('home').value) $('away').value = '';
    if (e.target.id === 'home' || e.target.id === 'away') { touched.add('home'); if ($('home').value && $('away').value) touched.add('away'); suggestDivision(); }
    syncLayout(); refreshErrors();
  });

  // The division is suggested from the two schools (same division -> that division, otherwise Crossover)
  // until the person picks one themselves. It is only a suggestion: the buttons still work as before.
  let autoDiv = true;

  // Only the first two games between two schools count. Say so before saving a third one; it is still saved.
  function thirdHint() {
    const h = $('home').value, a = $('away').value, d = $('date').value, el = $('third');
    if (!h || !a || !d || h === a) { el.hidden = true; return; }
    const prior = S.games.filter((g) => g.id !== editingId && g.status !== 'cancelled' && g.status !== 'scheduled' &&
      ((g.home === h && g.away === a) || (g.home === a && g.away === h)) && (g.date < d || (g.date === d && g.id < (editingId || Infinity)))).length;
    el.hidden = prior < 2;
    if (prior >= 2) el.innerHTML = `<strong>This would be their ${prior + 1}${prior + 1 === 3 ? 'rd' : 'th'} game this season.</strong> It can be saved, but it will show as "Not counted" and stay out of the records, rankings and seeds. Only the first two games between the same schools count.`;
  }
  for (const id of ['home', 'away', 'date']) document.addEventListener('change', (e) => { if (e.target.id === id) thirdHint(); });
  function suggestDivision() {
    if (!autoDiv) return;
    const h = byId[$('home').value], a = byId[$('away').value];
    if (!h || !a || !h.division || !a.division) return;
    $('division').value = h.division === a.division ? h.division : 'Crossover';
    $('div-hint').textContent = `Suggested from the schools (${h.division === a.division ? `both ${h.division}` : `${h.division} vs ${a.division}`}). Tap to change.`;
  }

  function clearForm({ keepDate = true } = {}) {
    autoDiv = true; $('div-hint').textContent = '';
    $('home').value = ''; $('away').value = ''; $('hs').value = ''; $('as').value = '';
    $('ot').checked = false; $('pl').checked = false; $('dec').value = '0'; form.querySelectorAll('input[name="sowin"]').forEach((x) => { x.checked = false; });
    $('note').value = ''; $('division').value = ''; $('status').value = 'final';
    form.querySelectorAll('input[name="winner"]').forEach((r) => { r.checked = false; });
    if (!keepDate) $('date').value = localToday();
    touched.clear(); syncLayout(); show({}); hideDup();
  }

  function endEdit() {
    editingId = null; $('reset-wrap').hidden = true; setTimeout(() => drawRecent(false), 0); $('editing').hidden = true; $('cancel-edit').hidden = true; $('save').textContent = 'Save game';
  }

  function standing(name) {
    const r = S.ranked.R[name];
    return r && r.gp ? `${name} is ${r.w}-${r.l}-${r.t}, ${ord(r.rank_spPerGame)} in Class ${r.cls}` : '';
  }

  async function refresh() {
    const data = await api(`/api/data?season=${encodeURIComponent(S.season.id)}`);
    S.allGames = data.games; S.games = data.games.filter((g) => g.gameType !== 'playoff'); S.playoffGames = data.games.filter((g) => g.gameType === 'playoff');
    S.schools = data.schools; S.season = data.season;
    S.ranked = FHEngine.rank(S.schools, S.games);
    drawRecent(false);
  }

  async function save(force) {
    ['date', 'home', 'away', 'homeScore', 'awayScore', 'winner', 'status', 'division', 'soWinner'].forEach((k) => touched.add(k));
    const v = read(), errs = validate(v);
    show(errs);
    const first = Object.keys(errs)[0];
    if (first) { const el = $(FIELDS[first]); (el.focus ? el : el.querySelector('input,button')).focus(); say('Fix the highlighted fields to save.', 'bad'); return; }
    if (busy) return;
    busy = true; $('save').disabled = true; say('Saving…');
    try {
      const body = { ...v, force: !!force };
      const res = editingId
        ? await api(`/api/games/${editingId}`, { method: 'PUT', body })
        : await api('/api/games', { method: 'POST', body });
      const g = res.game;
      store.set('vfh.lastDate', v.date);
      await refresh();
      let text;
      if (g.status === 'cancelled') text = `Saved ${g.home} vs ${g.away} on ${fmtDate(g.date)} as cancelled.`;
      else if (g.status === 'scheduled') text = `Saved ${g.home} vs ${g.away} on ${fmtDate(g.date)} as not played yet. It needs a score.`;
      else if (g.status === 'forfeit') text = `Saved: ${g.homeScore > g.awayScore ? g.home : g.away} won by forfeit on ${fmtDate(g.date)}, recorded as 1–0.`;
      else text = `Saved: ${g.home} ${g.homeScore}, ${g.away} ${g.awayScore} on ${fmtDate(g.date)}${g.soWinner ? ` (shootout: ${g.soWinner === 'home' ? g.home : g.away} advance${g.gameType === 'playoff' ? 's' : ''})` : g.overtime ? ' (overtime)' : ''}${g.gameType === 'playoff' ? ' Playoff game.' : '.'}`;
      const st = g.status === 'cancelled' || g.status === 'scheduled' ? '' : ` ${standing(g.home)}. ${standing(g.away)}.`;
      const wasEditing = !!editingId;
      endEdit(); clearForm();
      say((wasEditing ? text.replace('Saved:', 'Updated:') : text) + st, 'ok');
      $('home').focus();
    } catch (e) {
      if (e.status === 409 && e.data && e.data.duplicate) {
        const d = e.data.duplicate;
        $('dup').hidden = false;
        $('dup').innerHTML = `<strong>${esc(e.message)}</strong><br>Already saved: ${esc(d.home)} ${d.homeScore ?? ''}${d.homeScore !== null ? ',' : ''} ${esc(d.away)} ${d.awayScore ?? ''}.
          <div class="actions"><button type="button" class="btn small" id="dup-force">Save as a second game</button><button type="button" class="btn small ghost" id="dup-no">Don't save</button></div>`;
        $('dup-force').addEventListener('click', () => save(true));
        $('dup-no').addEventListener('click', hideDup);
        say('');
      } else if (e.status === 422 && e.data && e.data.fields) {
        const map = { home: 'home', away: 'away', date: 'date', homeScore: 'homeScore', awayScore: 'awayScore', winner: 'winner', status: 'status', division: 'division', soWinner: 'soWinner' };
        const errs2 = {}; Object.keys(e.data.fields).forEach((k) => { if (map[k]) { errs2[map[k]] = e.data.fields[k]; touched.add(map[k]); } });
        show(errs2); say(e.message, 'bad');
      } else if (e.status === 401) {
        say('Your sign-in has expired. Reload this page to sign in again.', 'bad');
      } else say(e.message, 'bad');
    } finally { busy = false; $('save').disabled = false; }
  }

  // Puts a game back to "needs a score": click once, then click again to confirm.
  let resetTimer = null;
  function resetArm(on) {
    clearTimeout(resetTimer); resetTimer = null;
    $('reset-label').textContent = on ? 'Click again to reset' : 'Reset this game';
    $('reset-game').classList.toggle('armed', on);
    if (on) resetTimer = setTimeout(() => resetArm(false), 4000);
  }
  $('reset-game').addEventListener('click', () => {
    if (!editingId) return;
    if (!resetTimer) return resetArm(true);
    resetArm(false);
    $('status').value = 'scheduled'; syncLayout();
    save(false);
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); save(false); });
  $('cancel-edit').addEventListener('click', () => { endEdit(); clearForm(); say(''); });

  function startEdit(id) {
    const g = S.allGames.find((x) => x.id === id);
    if (!g) return;
    editingId = id; clearForm(); autoDiv = false;   // an existing game keeps its own division
    $('date').value = g.date; $('home').value = String(g.homeId); $('away').value = String(g.awayId);
    const isFuture = g.date > localToday();
    $('status').value = g.status === 'scheduled' && !isFuture ? 'final' : g.status;
    $('hs').value = g.homeScore ?? ''; $('as').value = g.awayScore ?? '';
    const po = g.gameType === 'playoff';
    $('pl').checked = po; $('ot').checked = !po && !!g.overtime;
    $('dec').value = g.soWinner ? 'so' : String(po ? g.overtime || 0 : 0);
    if (g.soWinner) { const rr = form.querySelector(`input[name="sowin"][value="${g.soWinner}"]`); if (rr) rr.checked = true; }
    $('division').value = g.division || ''; $('note').value = g.note || '';
    if (g.status === 'forfeit') {
      const r = form.querySelector(`input[name="winner"][value="${g.homeScore > g.awayScore ? 'home' : 'away'}"]`);
      if (r) r.checked = true;
    }
    syncLayout();
    $('editing').hidden = false;
    const entering = g.status === 'scheduled' && !isFuture;
    $('editing').textContent = `${entering ? 'Entering the score' : isFuture ? 'Not played yet: change the date or cancel the game' : 'Editing'} · ${fmtDate(g.date)}. Save, or cancel.`;
    $('cancel-edit').hidden = false; $('save').textContent = entering ? 'Save score' : 'Save changes';
    $('reset-wrap').hidden = !isAdmin || g.status === 'scheduled'; resetArm(false);
    say(''); drawRecent(false);
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    (entering || g.status === 'final' ? $('hs') : $('home')).focus();
  }

  // Every game in date order, opened at today's games (or the most recent day with games).
  function drawRecent(focus = true) {
    const box = $('glist');
    const keep = box.scrollTop;
    const ft = $('f-team').value, fd = $('f-date').value, filtered = !!(ft || fd);
    const all = S.allGames.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id - b.id);
    const list = all.filter((g) => (!ft || String(g.homeId) === ft || String(g.awayId) === ft) && (!fd || g.date === fd));
    $('f-reset').disabled = !filtered;
    $('f-count').textContent = filtered ? `${list.length} of ${all.length} games` : '';
    const today = localToday();
    const past = list.filter((g) => g.date <= today);
    const focusDate = past.length ? past[past.length - 1].date : (list[0] || {}).date;
    const state = (g) => g.status === 'cancelled' ? '<span class="tag off">Cancelled</span>'
      : g.status === 'scheduled' ? (g.date <= today ? '<span class="tag need">Needs score</span>' : '<span class="tag sched">Scheduled</span>')
      : `${g.homeScore}–${g.awayScore}${g.status === 'forfeit' ? '<span class="tag">Forfeit</span>' : ''}${g.gameType === 'playoff' ? '<span class="tag">Playoff</span>' : ''}${g.soWinner ? '<span class="tag">SO</span>' : g.overtime ? `<span class="tag">${g.overtime > 1 ? '2OT' : 'OT'}</span>` : ''}`;
    let marked = false;
    $('recent').innerHTML = `
      <thead><tr><th class="l">Date</th><th class="l dk">Home</th><th class="mg l">Game</th><th>Score</th><th class="l dk">Away</th><th></th></tr></thead>
      <tbody>${list.map((g) => {
        const first = !marked && g.date === focusDate; if (first) marked = true;
        const future = g.status === 'scheduled' && g.date > today;   // not played yet: no score can be entered
        return `<tr${future ? '' : ` data-row="${g.id}"`} class="${future ? 'future' : 'pick'}${g.id === editingId ? ' sel' : ''}"${first ? ' id="focus-row"' : ''}>
        <td class="l">${esc(fmtDate(g.date))}${g.date === today ? ' <span class="tag today">Today</span>' : ''}</td>
        <td class="name dk"><span class="tn">${logo(g.home, 18)}${esc(g.home)}</span></td>
        <td class="name mg"><span class="tn">${logo(g.home, 16)}${esc(g.home)}</span><span class="tn">${logo(g.away, 16)}${esc(g.away)}</span></td>
        <td class="sc">${state(g)}</td>
        <td class="name dk"><span class="tn">${logo(g.away, 18)}${esc(g.away)}</span></td>
        <td class="acts">${future ? `<button type="button" class="btn small ghost" data-edit="${g.id}">Edit</button> ` : ''}<button type="button" class="btn small ghost del" data-del="${g.id}" aria-label="Delete game"><span class="dk">Delete</span><span class="mg">✕</span></button></td></tr>`;
      }).join('')}</tbody>`;
    if (!list.length) $('recent').innerHTML = filtered
      ? '<tbody><tr><td class="empty"><strong>No games match</strong>Change or reset the filters.</td></tr></tbody>'
      : '<tbody><tr><td class="empty"><strong>No games yet</strong>Saved games appear here.</td></tr></tbody>';
    if (focus && filtered) box.scrollTop = 0;
    else if (focus) {
      const row = $('focus-row');
      if (row) box.scrollTop = Math.max(0, row.offsetTop - box.querySelector('thead').offsetHeight - row.offsetHeight * 1.5);
    } else box.scrollTop = keep;
  }

  $('recent').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (b && b.dataset.edit) { startEdit(Number(b.dataset.edit)); return; }
    if (!b) { const tr = e.target.closest('tr[data-row]'); if (tr) startEdit(Number(tr.dataset.row)); return; }
    if (b.dataset.del) {
      if (b.dataset.armed !== '1') {
        b.dataset.armed = '1'; b.textContent = 'Confirm delete'; b.classList.add('danger'); b.classList.remove('ghost');
        setTimeout(() => { if (b.isConnected) { b.dataset.armed = ''; b.textContent = 'Delete'; b.classList.remove('danger'); b.classList.add('ghost'); } }, 4000);
        return;
      }
      try {
        await api(`/api/games/${b.dataset.del}`, { method: 'DELETE' });
        if (editingId === Number(b.dataset.del)) { endEdit(); clearForm(); }
        await refresh(); say('Game deleted.', 'ok');
      } catch (err) { say(err.message, 'bad'); }
    }
  });

  $('f-team').addEventListener('change', () => drawRecent());
  $('f-date').addEventListener('input', () => drawRecent());
  $('f-reset').addEventListener('click', () => { $('f-team').value = ''; $('f-date').value = ''; drawRecent(); });
  syncLayout(); drawRecent();
  const want = Number(new URLSearchParams(location.search).get('game'));
  if (want && S.allGames.some((g) => g.id === want)) startEdit(want);   // arrived from a game on the Games page
}

if (S) main();
