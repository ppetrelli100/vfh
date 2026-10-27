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
      <div class="teams">
        <div class="field"><label for="division">Division</label>
          <input type="hidden" id="division" value="">
          <div class="choice" id="division-btns" role="group" aria-label="Division">${['D1/2', 'D3', 'D4', 'Crossover'].map((d) => `<button type="button" class="chip" data-v="${d}" aria-pressed="false">${d}</button>`).join('')}</div>
          <div class="err" id="err-division"></div></div>
        <div class="field"><label for="note">Note (optional)</label><input type="text" id="note" maxlength="120" placeholder="For example, played at a neutral site"></div>
      </div>
      <div id="dup" class="alert" hidden></div>
      <div class="actions">
        <button type="submit" class="btn" id="save">Save game</button>
        <button type="button" class="btn ghost" id="cancel-edit" hidden>Cancel changes</button>
        <span class="status" id="msg" role="status"></span>
        <div class="reset-wrap" id="reset-wrap" hidden><button type="button" class="btn reset" id="reset-game">Reset this game</button><small>Admin only</small></div>
      </div>
    </form>

    <h2>Games</h2>
    <p class="hint" style="margin:0 0 8px">Pick a game to enter or change its score. The list opens at today's games; scroll up for earlier ones and down for later ones.</p>
    <div class="scroll games-list" id="glist"><table class="tbl" id="recent"></table></div>` : ''}

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
    </details>`;

  wireTools($);
  if (hasSeason) { wireForm($); wireClasses($); }
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
        id: $('ns-id').value.trim(), label: $('ns-label').value.trim(), copyFrom: $('ns-copy').value || null, isCurrent: $('ns-current').checked } });
      msg.className = 'status ok'; msg.textContent = `Created ${r.season.label}.`;
      store.set('vfh.season', r.season.id);
      setTimeout(() => { location.href = `/admin.html?season=${encodeURIComponent(r.season.id)}`; }, 700);
    } catch (e) { msg.className = 'status bad'; msg.textContent = e.message; }
  });
}

// Schools-and-classes editor: edit classes in a table, or paste a list, then save in one go.
function wireClasses($) {
  const tbl = $('sc-tbl'); if (!tbl) return;
  const orig = new Map(S.schools.map((x) => [x.name, { cls: x.cls }]));
  const cur = new Map([...orig].map(([k, v]) => [k, { ...v, remove: false }]));
  const added = new Set();            // names added in this edit
  const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9]/g, '');
  const msg = $('sc-msg');
  const dirty = () => [...cur].filter(([k, v]) => added.has(k) || v.remove || v.cls !== orig.get(k)?.cls);
  function draw() {
    const names = [...cur.keys()].sort((a, b) => a.localeCompare(b));
    tbl.innerHTML = `<thead><tr><th class="l">School</th><th>Class</th><th>Take out</th></tr></thead><tbody>${names.map((n) => {
      const v = cur.get(n), o = orig.get(n), ch = added.has(n) || v.remove || v.cls !== o?.cls;
      return `<tr class="${ch ? 'chg' : ''}${v.remove ? ' struck' : ''}"><td class="l name">${esc(n)}${added.has(n) ? ' <span class="tag">new</span>' : ''}</td>
        <td><select data-n="${esc(n)}" data-f="cls" aria-label="Class for ${esc(n)}">${['A', 'B', 'C'].map((c) => `<option${c === v.cls ? ' selected' : ''}>${c}</option>`).join('')}</select>
          ${o && o.cls !== v.cls ? `<span class="muted"> was ${o.cls}</span>` : ''}</td>
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
    cur.set(name, { cls: $('sc-new-cls').value, remove: false }); added.add(name);
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
    const changes = dirty().map(([k, v]) => ({ name: k, cls: v.cls, remove: v.remove }));
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
  const FIELDS = { division: 'division-btns', date: 'date', home: 'home', away: 'away', homeScore: 'hs', awayScore: 'as', winner: 'winner-wrap', status: 'status' };

  $('date').value = store.get('vfh.lastDate') || localToday();

  const read = () => ({
    season: S.season.id, date: $('date').value, homeId: $('home').value, awayId: $('away').value,
    status: $('status').value, homeScore: $('hs').value, awayScore: $('as').value,
    winner: (form.querySelector('input[name="winner"]:checked') || {}).value || '',
    overtime: $('ot').checked, division: $('division').value, note: $('note').value.trim(),
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
    const st = $('status').value, v = read();
    $('scores').hidden = st !== 'final';
    $('ot-wrap').hidden = st !== 'final';
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
    touched.add('division'); hideDup(); syncLayout(); refreshErrors();
  });

  form.addEventListener('input', (e) => {
    hideDup();
    const map = { date: 'date', home: 'home', away: 'away', hs: 'homeScore', as: 'awayScore', status: 'status', division: 'division' };
    if (map[e.target.id]) touched.add(map[e.target.id]);
    if (e.target.name === 'winner') touched.add('winner');
    if (e.target.id === 'home' && $('away').value === $('home').value) $('away').value = '';
    if (e.target.id === 'home' || e.target.id === 'away') { touched.add('home'); if ($('home').value && $('away').value) touched.add('away'); }
    syncLayout(); refreshErrors();
  });

  function clearForm({ keepDate = true } = {}) {
    $('home').value = ''; $('away').value = ''; $('hs').value = ''; $('as').value = '';
    $('ot').checked = false; $('note').value = ''; $('division').value = ''; $('status').value = 'final';
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
    S.games = data.games; S.schools = data.schools;
    S.ranked = FHEngine.rank(S.schools, S.games);
    drawRecent(false);
  }

  async function save(force) {
    ['date', 'home', 'away', 'homeScore', 'awayScore', 'winner', 'status', 'division'].forEach((k) => touched.add(k));
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
      else text = `Saved: ${g.home} ${g.homeScore}, ${g.away} ${g.awayScore} on ${fmtDate(g.date)}${g.overtime ? ' (overtime)' : ''}.`;
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
        const map = { home: 'home', away: 'away', date: 'date', homeScore: 'homeScore', awayScore: 'awayScore', winner: 'winner', status: 'status', division: 'division' };
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
    $('reset-game').textContent = on ? 'Click again to reset' : 'Reset this game';
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
    const g = S.games.find((x) => x.id === id);
    if (!g) return;
    editingId = id; clearForm();
    $('date').value = g.date; $('home').value = String(g.homeId); $('away').value = String(g.awayId);
    $('status').value = g.status === 'scheduled' ? 'final' : g.status;
    $('hs').value = g.homeScore ?? ''; $('as').value = g.awayScore ?? '';
    $('ot').checked = !!g.overtime; $('division').value = g.division || ''; $('note').value = g.note || '';
    if (g.status === 'forfeit') {
      const r = form.querySelector(`input[name="winner"][value="${g.homeScore > g.awayScore ? 'home' : 'away'}"]`);
      if (r) r.checked = true;
    }
    syncLayout();
    $('editing').hidden = false;
    $('editing').textContent = `${g.status === 'scheduled' ? 'Entering the score for' : 'Editing'}: ${g.home} vs ${g.away}, ${fmtDate(g.date)}. Save, or cancel.`;
    $('cancel-edit').hidden = false; $('save').textContent = g.status === 'scheduled' ? 'Save score' : 'Save changes';
    $('reset-wrap').hidden = !isAdmin || g.status === 'scheduled'; resetArm(false);
    say(''); drawRecent(false);
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    (g.status === 'scheduled' || g.status === 'final' ? $('hs') : $('home')).focus();
  }

  // Every game in date order, opened at today's games (or the most recent day with games).
  function drawRecent(focus = true) {
    const box = $('glist');
    const keep = box.scrollTop;
    const list = S.games.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id - b.id);
    const today = localToday();
    const past = list.filter((g) => g.date <= today);
    const focusDate = past.length ? past[past.length - 1].date : (list[0] || {}).date;
    const state = (g) => g.status === 'cancelled' ? '<span class="tag off">Cancelled</span>'
      : g.status === 'scheduled' ? (g.date <= today ? '<span class="tag need">Needs score</span>' : '<span class="tag">Scheduled</span>')
      : `${g.homeScore}–${g.awayScore}${g.status === 'forfeit' ? '<span class="tag">Forfeit</span>' : ''}${g.overtime ? '<span class="tag">OT</span>' : ''}`;
    let marked = false;
    $('recent').innerHTML = `
      <thead><tr><th class="l">Date</th><th class="l">Home</th><th>Score</th><th class="l">Away</th><th></th></tr></thead>
      <tbody>${list.map((g) => {
        const first = !marked && g.date === focusDate; if (first) marked = true;
        return `<tr data-row="${g.id}" class="pick${g.id === editingId ? ' sel' : ''}"${first ? ' id="focus-row"' : ''}>
        <td class="l">${esc(fmtDate(g.date))}${g.date === today ? ' <span class="tag today">Today</span>' : ''}</td>
        <td class="name"><span class="tn">${logo(g.home, 18)}${esc(g.home)}</span></td>
        <td>${state(g)}</td>
        <td class="name"><span class="tn">${logo(g.away, 18)}${esc(g.away)}</span></td>
        <td><button type="button" class="btn small ghost" data-del="${g.id}">Delete</button></td></tr>`;
      }).join('')}</tbody>`;
    if (!list.length) $('recent').innerHTML = '<tbody><tr><td class="empty"><strong>No games yet</strong>Saved games appear here.</td></tr></tbody>';
    if (focus) {
      const row = $('focus-row');
      if (row) box.scrollTop = Math.max(0, row.offsetTop - box.querySelector('thead').offsetHeight - row.offsetHeight * 1.5);
    } else box.scrollTop = keep;
  }

  $('recent').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
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

  syncLayout(); drawRecent();
}

if (S) main();
