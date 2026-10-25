import { boot, api, esc, fmtDate, schoolOptions, store } from './common.js';

const S = await boot('admin', { allowEmpty: true });
const app = document.getElementById('app');

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
      <div id="editing" class="editing" hidden></div>
      <div class="teams">
        <div class="field"><label for="date">Game date</label><input type="date" id="date" required><div class="err" id="err-date"></div></div>
        <div class="field"><label for="status">Result</label>
          <select id="status"><option value="final">Final score</option><option value="forfeit">Forfeit</option><option value="cancelled">Cancelled</option></select>
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
        <div class="field"><label for="gtype">Game type</label>
          <select id="gtype"><option value="regular">Regular season</option><option value="league">League game</option><option value="tournament">Tournament</option><option value="playoff">Playoff</option></select></div>
        <div class="field"><label for="note">Note (optional)</label><input type="text" id="note" maxlength="120" placeholder="For example, played at a neutral site"></div>
      </div>
      <div id="dup" class="alert" hidden></div>
      <div class="actions">
        <button type="submit" class="btn" id="save">Save game</button>
        <button type="button" class="btn ghost" id="cancel-edit" hidden>Cancel changes</button>
        <span class="status" id="msg" role="status"></span>
      </div>
    </form>

    <h2>Recent games</h2>
    <div class="scroll"><table class="tbl" id="recent"></table></div>` : ''}

    <details class="tools"${hasSeason ? '' : ' open'}>
      <summary>Season tools</summary>
      <div class="panel form-grid">
        <div>
          <h3 style="margin:0 0 4px">Load the Fall 2024 season</h3>
          <p class="hint" style="margin:0 0 10px">Adds the 74 schools and 591 games from the season spreadsheet. If a Fall 2024 season is already here, its games and school list are replaced.</p>
          <div class="actions"><button type="button" class="btn ghost" id="load-test">Load Fall 2024 season</button><span class="status" id="load-msg" role="status"></span></div>
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
  if (hasSeason) wireForm($);
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

function wireForm($) {
  const form = $('form');
  const byId = Object.fromEntries(S.schools.map((s) => [String(s.id), s]));
  const touched = new Set();
  let editingId = null, busy = false;
  const FIELDS = { date: 'date', home: 'home', away: 'away', homeScore: 'hs', awayScore: 'as', winner: 'winner-wrap', status: 'status' };

  $('date').value = store.get('vfh.lastDate') || localToday();

  const read = () => ({
    season: S.season.id, date: $('date').value, homeId: $('home').value, awayId: $('away').value,
    status: $('status').value, homeScore: $('hs').value, awayScore: $('as').value,
    winner: (form.querySelector('input[name="winner"]:checked') || {}).value || '',
    overtime: $('ot').checked, gameType: $('gtype').value, note: $('note').value.trim(),
  });

  function validate(v) {
    const e = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) e.date = 'Enter the game date.';
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
    [...$('away').options].forEach((o) => { o.disabled = !!o.value && o.value === $('home').value; });
    [...$('home').options].forEach((o) => { o.disabled = !!o.value && o.value === $('away').value; });
  }

  function say(text, kind) { const m = $('msg'); m.textContent = text; m.className = `status${kind ? ' ' + kind : ''}`; }
  const hideDup = () => { $('dup').hidden = true; };

  form.addEventListener('input', (e) => {
    hideDup();
    const map = { date: 'date', home: 'home', away: 'away', hs: 'homeScore', as: 'awayScore', status: 'status' };
    if (map[e.target.id]) touched.add(map[e.target.id]);
    if (e.target.name === 'winner') touched.add('winner');
    if (e.target.id === 'home' && $('away').value === $('home').value) $('away').value = '';
    if (e.target.id === 'home' || e.target.id === 'away') { touched.add('home'); if ($('home').value && $('away').value) touched.add('away'); }
    syncLayout(); refreshErrors();
  });

  function clearForm({ keepDate = true } = {}) {
    $('home').value = ''; $('away').value = ''; $('hs').value = ''; $('as').value = '';
    $('ot').checked = false; $('note').value = ''; $('gtype').value = 'regular'; $('status').value = 'final';
    form.querySelectorAll('input[name="winner"]').forEach((r) => { r.checked = false; });
    if (!keepDate) $('date').value = localToday();
    touched.clear(); syncLayout(); show({}); hideDup();
  }

  function endEdit() {
    editingId = null; $('editing').hidden = true; $('cancel-edit').hidden = true; $('save').textContent = 'Save game';
  }

  function standing(name) {
    const r = S.ranked.R[name];
    return r && r.gp ? `${name} is ${r.w}-${r.l}-${r.t}, ${ord(r.rank_spPerGame)} in Class ${r.cls}` : '';
  }

  async function refresh() {
    const data = await api(`/api/data?season=${encodeURIComponent(S.season.id)}`);
    S.games = data.games; S.schools = data.schools;
    S.ranked = FHEngine.rank(S.schools, S.games);
    drawRecent();
  }

  async function save(force) {
    ['date', 'home', 'away', 'homeScore', 'awayScore', 'winner', 'status'].forEach((k) => touched.add(k));
    const v = read(), errs = validate(v);
    show(errs);
    const first = Object.keys(errs)[0];
    if (first) { const el = $(FIELDS[first]); (el.focus ? el : el.querySelector('input')).focus(); say('Fix the highlighted fields to save.', 'bad'); return; }
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
      else if (g.status === 'forfeit') text = `Saved: ${g.homeScore > g.awayScore ? g.home : g.away} won by forfeit on ${fmtDate(g.date)}, recorded as 1–0.`;
      else text = `Saved: ${g.home} ${g.homeScore}, ${g.away} ${g.awayScore} on ${fmtDate(g.date)}${g.overtime ? ' (overtime)' : ''}.`;
      const st = g.status === 'cancelled' ? '' : ` ${standing(g.home)}. ${standing(g.away)}.`;
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
        const map = { home: 'home', away: 'away', date: 'date', homeScore: 'homeScore', awayScore: 'awayScore', winner: 'winner', status: 'status' };
        const errs2 = {}; Object.keys(e.data.fields).forEach((k) => { if (map[k]) { errs2[map[k]] = e.data.fields[k]; touched.add(map[k]); } });
        show(errs2); say(e.message, 'bad');
      } else if (e.status === 401) {
        say('Your sign-in has expired. Reload this page to sign in again.', 'bad');
      } else say(e.message, 'bad');
    } finally { busy = false; $('save').disabled = false; }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); save(false); });
  $('cancel-edit').addEventListener('click', () => { endEdit(); clearForm(); say(''); });

  function startEdit(id) {
    const g = S.games.find((x) => x.id === id);
    if (!g) return;
    editingId = id; clearForm();
    $('date').value = g.date; $('home').value = String(g.homeId); $('away').value = String(g.awayId);
    $('status').value = g.status === 'scheduled' ? 'cancelled' : g.status;
    $('hs').value = g.homeScore ?? ''; $('as').value = g.awayScore ?? '';
    $('ot').checked = !!g.overtime; $('gtype').value = g.gameType || 'regular'; $('note').value = g.note || '';
    if (g.status === 'forfeit') {
      const r = form.querySelector(`input[name="winner"][value="${g.homeScore > g.awayScore ? 'home' : 'away'}"]`);
      if (r) r.checked = true;
    }
    syncLayout();
    $('editing').hidden = false;
    $('editing').textContent = `Editing: ${g.home} vs ${g.away}, ${fmtDate(g.date)}. Save changes or cancel.`;
    $('cancel-edit').hidden = false; $('save').textContent = 'Save changes';
    say('');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('home').focus();
  }

  function drawRecent() {
    const list = S.games.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)) || b.id - a.id).slice(0, 12);
    $('recent').innerHTML = `
      <thead><tr><th class="l">Date</th><th class="l">Home</th><th>Score</th><th class="l">Away</th><th></th></tr></thead>
      <tbody>${list.map((g) => `<tr>
        <td class="l">${esc(fmtDate(g.date))}</td>
        <td class="name">${esc(g.home)}</td>
        <td>${g.status === 'cancelled' ? '<span class="tag off">Cancelled</span>' : g.homeScore === null ? '' : `${g.homeScore}–${g.awayScore}`}${g.status === 'forfeit' ? '<span class="tag">Forfeit</span>' : ''}${g.overtime ? '<span class="tag">OT</span>' : ''}</td>
        <td class="name">${esc(g.away)}</td>
        <td><button type="button" class="btn small ghost" data-edit="${g.id}">Edit</button>
            <button type="button" class="btn small ghost" data-del="${g.id}">Delete</button></td></tr>`).join('')}</tbody>`;
    if (!list.length) $('recent').innerHTML = '<tbody><tr><td class="empty"><strong>No games yet</strong>Saved games appear here.</td></tr></tbody>';
  }

  $('recent').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.edit) return startEdit(Number(b.dataset.edit));
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
