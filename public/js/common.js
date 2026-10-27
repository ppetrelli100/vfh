// Shared by every page: data loading, header, formatting.
// The ranking engine (engine.js) is loaded with a plain <script> tag and exposes FHEngine.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmtPct = (p) => (p === null || p === undefined ? '–' : p >= 1 ? '1.000' : p.toFixed(3).replace(/^0/, ''));
export const fmtInt = (n) => (n === null || n === undefined ? '–' : Math.round(n).toLocaleString('en-US'));
export const fmtDate = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
export const fmtDateLong = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '');
export const record = (r) => `${r.w}-${r.l}-${r.t}`;
export const gameUrl = (team) => `/games.html?team=${encodeURIComponent(team)}`;

export async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON error page */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } },
};
export { store };
// The season a person picks is remembered for this tab only, so a fresh visit opens the current season.
const pickedSeason = {
  get() { try { return sessionStorage.getItem('vfh.season'); } catch (e) { return null; } },
  set(v) { try { sessionStorage.setItem('vfh.season', v); } catch (e) { /* storage unavailable */ } },
  del() { try { sessionStorage.removeItem('vfh.season'); } catch (e) { /* storage unavailable */ } },
};

/** Update one query-string value without reloading. */
export function setParam(key, value) {
  const u = new URL(location.href);
  if (value === null || value === '' || value === undefined) u.searchParams.delete(key); else u.searchParams.set(key, value);
  history.replaceState(null, '', u);
}
export const getParam = (key) => new URLSearchParams(location.search).get(key);

export const classesOf = (schools) =>
  [...new Map(schools.map((s) => [s.cls, s.classNum])).entries()].sort((a, b) => a[1] - b[1]).map((x) => x[0]);

/** The playoff page is "Playoff picture" until Nov 15 of the season's year, then "Playoffs". */
export function playoffLabel(season) {
  const y = Number(((season && (season.id || season.label)) || '').match(/\d{4}/)?.[0]) || new Date().getFullYear();
  return new Date() >= new Date(y, 10, 15) ? 'Playoffs' : 'Playoff picture';
}

function renderChrome(active, data, me) {
  const items = [['playoffs', 'Playoffs', '/'], ['rankings', 'Rankings', '/rankings.html'], ['games', 'Games', '/games.html']];
  const signedIn = me.admin || active === 'admin';
  const seasons = data.seasons || [];
  document.getElementById('chrome').innerHTML = `
    <div class="nav">
      <a class="nav-logo" href="/"><img class="logo" src="/img/nepsac-logo.png" alt="" width="26" height="27">NEPSAC Field Hockey</a>
      <span class="nav-sep">|</span>
      <nav class="nav-links" aria-label="Main">${items.map(([k, label, href]) =>
        `<a href="${href}"${k === active ? ' class="here" aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
      <a class="admin-link${active === 'admin' ? ' here' : ''}" href="/admin.html"${active === 'admin' ? ' aria-current="page"' : ''}>${signedIn
        ? '<span class="full">Enter scores</span><span class="abbr">Scores</span>'
        : '<span class="full">Administrator sign in</span><span class="abbr">Sign in</span>'}</a>
      ${seasons.length ? `<label class="season"><span class="sr">Season</span>
        <select id="season-pick">${seasons.map((s) =>
          `<option value="${esc(s.id)}"${data.season && s.id === data.season.id ? ' selected' : ''}>${esc(s.label)}</option>`).join('')}</select></label>` : ''}
    </div>`;
  const pick = document.getElementById('season-pick');
  if (pick) pick.addEventListener('change', () => {
    pickedSeason.set(pick.value);
    const u = new URL(location.href);
    u.searchParams.set('season', pick.value);
    location.href = u;
  });
  if (!document.querySelector('.foot')) {
    const f = document.createElement('footer');
    f.className = 'wrap foot';
    f.innerHTML = 'Rankings and playoff seeds are worked out from the saved scores each time a page loads. <a href="/admin.html">Administrator sign-in</a>';
    document.body.appendChild(f);
  }
}

// Shorter spellings for long school names, shown on phones only (the full name is used everywhere else).
const ABBR = {
  'Ethel Walker School': 'Ethel Walker', 'Lexington Christian': 'Lexington Chr', 'Mount Saint Charles': 'Mt St Charles',
  'Greenwich Academy': 'Greenwich Acad', 'Kingswood Oxford': 'Kingswood', 'Lawrence Academy': 'Lawrence Acad',
  'Portsmouth Abbey': 'Portsmouth Ab', 'Wilbraham Monson': 'Wilbraham', 'Frederick Gunn': 'Fred Gunn',
  'Kimball Union': 'Kimball Un',
  // names as spelled in the coach's score sheet (Fall 2026)
  'Wilbraham & Monson': 'Wilbraham', 'Mt. St. Charles': 'Mt St Charles', 'Dexter Southfield': 'Dexter',
  "Governor's Academy": "Governor's", 'Greens Farms Academy': 'Greens Farms', 'Marianapolis Prep': 'Marianapolis',
};
/** School name as HTML: full name, plus the short one for small screens when there is one. */
export const nm = (name) => (ABBR[name]
  ? `<span class="nm"><span class="full">${esc(name)}</span><span class="abbr">${esc(ABBR[name])}</span></span>`
  : `<span class="nm">${esc(name)}</span>`);

let LOGOS = {};
/** Small school logo for a team name, or an empty spacer of the same size so names line up. */
export const logo = (name, size = 22) => {
  const f = LOGOS[name];
  return f ? `<img class="tl" src="/logos/${encodeURIComponent(f)}" alt="" width="${size}" height="${size}" loading="lazy">`
           : `<span class="tl blank" style="width:${size}px;height:${size}px" aria-hidden="true"></span>`;
};
async function loadLogos() {
  try { LOGOS = await (await fetch('/logos/index.json')).json(); } catch (e) { LOGOS = {}; }
}

const problem = (title, text) => `<div class="scroll"><div class="empty"><strong>${esc(title)}</strong>${text}</div></div>`;
export const emptySeason = () => problem('No season has been set up yet', 'An administrator can load one from the <a href="/admin.html">Enter scores</a> page.');

/**
 * Load the season, draw the header, and compute rankings.
 * Returns { season, seasons, schools, games, me, ranked } (ranked = FHEngine.rank output),
 * or null after showing a message when there is nothing to show.
 */
export async function boot(active, { allowEmpty = false } = {}) {
  const app = document.getElementById('app');
  const want = getParam('season') || pickedSeason.get() || '';
  let data;
  try {
    data = await api(`/api/data${want ? `?season=${encodeURIComponent(want)}` : ''}`);
  } catch (e) {
    if (e.status === 404 && want) { pickedSeason.del(); data = await api('/api/data'); }
    else {
      renderChrome(active, { seasons: [] }, { admin: false });
      app.innerHTML = problem('The page could not load its data', esc(e.message));
      return null;
    }
  }
  let me = { admin: false };
  try { me = await api('/api/me'); } catch (e) { /* signed out */ }
  if (data.season) pickedSeason.set(data.season.id);
  await loadLogos();
  renderChrome(active, data, me);
  if (!data.season) {
    if (allowEmpty) return { ...data, me, ranked: null };
    app.innerHTML = emptySeason();
    return null;
  }
  return { ...data, me, ranked: FHEngine.rank(data.schools, data.games) };
}

/** Segmented class picker. onPick(cls) is called on change. */
export function classPicker(el, classes, counts, current, onPick) {
  el.innerHTML = classes.map((c) =>
    `<button type="button" data-c="${esc(c)}" aria-pressed="${c === current}">Class ${esc(c)}<span class="n">${counts[c] || 0}</span></button>`).join('');
  el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    el.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    onPick(b.dataset.c);
  }));
}

/** Option list of schools grouped by class, A to Z inside each class. */
export function schoolOptions(schools, selected, { blank } = {}) {
  const groups = classesOf(schools).map((c) => {
    const list = schools.filter((s) => s.cls === c).sort((a, b) => a.name.localeCompare(b.name));
    return `<optgroup label="Class ${esc(c)}">${list.map((s) =>
      `<option value="${esc(s.id ?? s.name)}"${String(s.id ?? s.name) === String(selected) ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</optgroup>`;
  });
  return (blank ? `<option value="">${esc(blank)}</option>` : '') + groups.join('');
}
