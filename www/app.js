/* Grow — three priorities a day. Finish all three and the plant reaches the sun. */
(() => {
  'use strict';
  const KEY = 'grow.v1';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const PH = ['The one that moves the needle', 'The one you keep putting off', 'The one just for you'];
  const STATUS = ['Three to reach the sun.', 'First leaf. Keep going.', 'One more to reach the sun.', 'Sunlit. Day won.'];
  const DEFAULTS = { theme: 'auto', sound: true, haptics: true, carry: true, morning: false, time: '08:00', evening: false };

  /* ───────── Storage ───────── */
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.days) return s; } catch (e) {}
    return { days: {}, name: '', settings: {}, carryDismissed: {} };
  }
  let state = load();
  state.settings = Object.assign({}, DEFAULTS, state.settings);
  state.carryDismissed = state.carryDismissed || {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };

  const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  let todayKey = keyOf(new Date());
  const blank = () => ({ items: [0, 1, 2].map(() => ({ t: '', d: false })) });
  const today = () => state.days[todayKey] || blank();
  const ensureToday = () => (state.days[todayKey] ||= blank());
  const doneCount = (day) => (day ? day.items.filter((x) => x.d && x.t.trim()).length : 0);
  const isWon = (day) => doneCount(day) === 3;
  const fmt = (d, o) => d.toLocaleDateString(undefined, o);

  /* ───────── Theme ───────── */
  const mq = matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    const t = state.settings.theme;
    const dark = t === 'dark' || (t === 'auto' && mq.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('meta[name="theme-color"]').setAttribute('content', dark ? '#0E1611' : '#E9EDE4');
    $$('#themes button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.theme === t)));
    $('#themeHint').textContent = t === 'auto' ? `Auto follows your phone. Right now it is ${dark ? 'dark' : 'light'}.` : 'Applies everywhere in the app.';
  }
  mq.addEventListener?.('change', applyTheme);

  /* ───────── Sound & haptics ───────── */
  let actx;
  function tone(freq, when = 0, dur = 1, gain = 0.1) {
    if (!state.settings.sound) return;
    try {
      actx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const t0 = actx.currentTime + when, o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) {}
  }
  const NOTES = [392, 493.88, 587.33];
  const chimeWin = () => [392, 493.88, 587.33, 783.99].forEach((f, i) => tone(f, 0.15 + i * 0.12, 2.2, 0.08));
  const buzz = (p) => { if (state.settings.haptics && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} };

  /* ───────── Reminders (Capacitor Local Notifications on Android) ───────── */
  const LN = () => window.Capacitor?.Plugins?.LocalNotifications;
  async function syncReminders(fromUser) {
    const ln = LN();
    if (!ln) { if (fromUser && (state.settings.morning || state.settings.evening)) toast('Reminders work in the Android app'); return; }
    try {
      await ln.cancel({ notifications: [{ id: 1 }, { id: 2 }] }).catch(() => {});
      if (!state.settings.morning && !state.settings.evening) return;
      const perm = await ln.requestPermissions();
      if (perm.display !== 'granted') { toast('Allow notifications to get reminders'); return; }
      const list = [];
      if (state.settings.morning) {
        const [h, m] = state.settings.time.split(':').map(Number);
        list.push({ id: 1, title: 'Name your three', body: 'What would make today a win?', schedule: { on: { hour: h, minute: m }, allowWhileIdle: true } });
      }
      if (state.settings.evening) list.push({ id: 2, title: 'How did your three go?', body: 'Tick off what you finished.', schedule: { on: { hour: 20, minute: 30 }, allowWhileIdle: true } });
      await ln.schedule({ notifications: list });
    } catch (e) {}
  }

  /* ───────── Toast ───────── */
  let toastT, undoFn = null;
  function toast(msg, undo) {
    const t = $('#toast');
    $('#toastMsg').textContent = msg;
    undoFn = undo || null;
    t.classList.toggle('no-undo', !undo);
    t.hidden = true; void t.offsetWidth; t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(hideToast, undo ? 3200 : 2200);
  }
  function hideToast() { $('#toast').hidden = true; undoFn = null; }
  $('#toastUndo').addEventListener('click', () => { const f = undoFn; hideToast(); f && f(); });

  /* ───────── Today ───────── */
  const pris = $('#pris');
  function buildPris() {
    pris.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const li = document.createElement('li');
      li.className = 'pri'; li.dataset.i = i;
      li.innerHTML = `
        <button class="check" aria-pressed="false"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5"/></svg></button>
        <div class="pri-body">
          <label class="pri-label" for="pri${i}"></label>
          <input class="pri-input" id="pri${i}" maxlength="60" enterkeyhint="done" autocomplete="off" placeholder="${PH[i]}">
        </div>`;
      pris.appendChild(li);
    }
  }

  let lastN = -1;
  function renderToday(opts = {}) {
    const day = today();
    const n = doneCount(day);
    const nextIdx = day.items.findIndex((x) => !x.d && x.t.trim());
    $$('.pri', pris).forEach((li, i) => {
      const x = day.items[i], empty = !x.t.trim(), done = x.d && !empty;
      li.classList.toggle('done', done);
      li.classList.toggle('next', i === nextIdx);
      const btn = $('.check', li);
      btn.disabled = empty;
      btn.setAttribute('aria-pressed', String(done));
      btn.setAttribute('aria-label', (done ? 'Mark not done: ' : 'Mark done: ') + (x.t || 'empty priority'));
      $('.pri-label', li).textContent = (i === nextIdx ? 'Up next · ' : '') + 'Priority ' + (i + 1);
      const inp = $('.pri-input', li);
      if (document.activeElement !== inp) inp.value = x.t;
    });
    $$('.leaf').forEach((l) => l.classList.toggle('on', n > +l.dataset.k));
    const card = $('#plantCard'); card.classList.toggle('won', n === 3);
    const sun = $('#sun');
    if (n === 3) {
      if (opts.celebrate) { sun.setAttribute('class', 'sun sun-off'); void sun.getBoundingClientRect(); sun.setAttribute('class', 'sun sun-on'); }
      else if (!sun.classList.contains('sun-on')) sun.setAttribute('class', 'sun sun-set');
    } else sun.setAttribute('class', 'sun sun-off');
    $('#plantSvg').setAttribute('aria-label', `Plant with ${n} of 3 leaves${n === 3 ? ', reaching the sun' : ''}`);
    const c = $('#count');
    if (c.textContent !== String(n)) { c.textContent = n; if (lastN >= 0 && !reduced) { c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); } }
    lastN = n;
    $('#status').textContent = STATUS[n];
    const filled = day.items.filter((x) => x.t.trim()).length;
    $('#remaining').textContent = n === 3 ? 'ALL DONE' : filled < 3 ? `${3 - filled} TO NAME` : `${3 - n} LEFT`;
    renderCarry();
  }

  pris.addEventListener('click', (e) => {
    const btn = e.target.closest('.check'); if (!btn) return;
    toggle(+btn.closest('.pri').dataset.i);
  });
  pris.addEventListener('input', (e) => {
    if (!e.target.classList.contains('pri-input')) return;
    const i = +e.target.closest('.pri').dataset.i, d = ensureToday();
    d.items[i].t = e.target.value;
    if (!e.target.value.trim()) d.items[i].d = false;
    save(); renderToday();
  });
  pris.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.classList.contains('pri-input')) return;
    e.preventDefault();
    const i = +e.target.closest('.pri').dataset.i, items = today().items;
    for (let k = i + 1; k < 3; k++) if (!items[k].t.trim()) { $(`#pri${k}`).focus(); return; }
    e.target.blur();
  });
  pris.addEventListener('focusout', (e) => {
    if (!e.target.classList.contains('pri-input')) return;
    const i = +e.target.closest('.pri').dataset.i, d = state.days[todayKey];
    if (d) { d.items[i].t = d.items[i].t.replace(/\s+/g, ' ').trim(); save(); }
    renderToday();
  });

  function toggle(i) {
    const d = ensureToday(), x = d.items[i];
    if (!x.t.trim()) return;
    const before = JSON.parse(JSON.stringify(d.items));
    x.d = !x.d;
    const n = doneCount(d);
    save();
    if (x.d) {
      tone(NOTES[n - 1], 0, 1.2, 0.1); buzz(n === 3 ? [16, 60, 30] : 14);
      if (n < 3) toast(n === 1 ? 'First leaf grown' : `Leaf grown · ${n} of 3`, () => { d.items = before; save(); renderToday(); });
      else hideToast();
    } else { buzz(6); hideToast(); }
    renderToday({ celebrate: x.d && n === 3 });
    if (x.d && n === 3) setTimeout(showWin, reduced ? 100 : 1000);
  }

  /* carry over */
  function carryCandidates() {
    if (!state.settings.carry || state.carryDismissed[todayKey]) return [];
    if (today().items.some((x) => x.t.trim())) return [];
    const prev = Object.keys(state.days).filter((k) => k < todayKey).sort().pop();
    if (!prev || fromKey(prev) < addDays(fromKey(todayKey), -3)) return [];
    return state.days[prev].items.filter((x) => x.t.trim() && !x.d);
  }
  function renderCarry() {
    const c = carryCandidates();
    $('#carry').hidden = !c.length;
    if (c.length) $('#carrySub').textContent = c.map((x) => x.t).join(' · ');
  }
  $('#carryYes').addEventListener('click', () => {
    const c = carryCandidates(), d = ensureToday();
    c.forEach((x, i) => (d.items[i] = { t: x.t, d: false }));
    save(); renderToday(); toast(`Carried over ${c.length}`);
  });
  $('#carryNo').addEventListener('click', () => { state.carryDismissed[todayKey] = 1; save(); renderCarry(); });

  /* ───────── Streaks & stats ───────── */
  function stats() {
    let cur = 0, d = fromKey(todayKey);
    if (!isWon(state.days[todayKey])) d = addDays(d, -1);
    while (isWon(state.days[keyOf(d)])) { cur++; d = addDays(d, -1); }
    const won = Object.keys(state.days).filter((k) => isWon(state.days[k])).sort();
    let best = 0, run = 0, prev = null;
    won.forEach((k) => { run = prev && keyOf(addDays(fromKey(prev), 1)) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; });
    const t = fromKey(todayKey), monday = addDays(t, -((t.getDay() + 6) % 7));
    let week = 0;
    for (let k = 0; k < 7; k++) if (isWon(state.days[keyOf(addDays(monday, k))])) week++;
    const anyDone = Object.values(state.days).some((x) => doneCount(x) > 0);
    return { cur, best, total: won.length, week, anyDone };
  }

  /* ───────── Win ───────── */
  function showWin() {
    if (!isWon(today())) return;
    const s = stats();
    $('#winDate').textContent = `${fmt(new Date(), { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()} · 3 OF 3`;
    $('#winSub').textContent = s.cur > 1 ? `Your plant reached the sun. That’s ${s.cur} days in a row.` : 'Your plant reached the sun. First day of a new streak.';
    const w = $('#win'); w.classList.remove('out'); w.hidden = false;
    chimeWin();
    setTimeout(() => $('#winGarden').focus(), 300);
  }
  function closeWin(then) {
    const w = $('#win'); w.classList.add('out');
    setTimeout(() => { w.hidden = true; then && then(); }, 330);
  }
  $('#winGarden').addEventListener('click', () => closeWin(() => { selDay = 13; setTab('garden'); }));
  $('#winBack').addEventListener('click', () => closeWin());

  /* ───────── Garden ───────── */
  let selDay = 13;
  function renderGarden() {
    const s = stats();
    $('#stats').innerHTML = `
      <div class="stat hero"><p class="mono">STREAK</p><p class="stat-n">${s.cur}<small> ${s.cur === 1 ? 'day' : 'days'}</small></p></div>
      <div class="stat"><p class="mono">DAYS WON</p><p class="stat-n">${s.total}</p></div>
      <div class="stat"><p class="mono">BEST RUN</p><p class="stat-n">${s.best}</p></div>`;
    const g = $('#garden'); g.innerHTML = '';
    const t = fromKey(todayKey);
    for (let i = 0; i < 14; i++) {
      const d = addDays(t, i - 13), day = state.days[keyOf(d)], k = doneCount(day);
      const b = document.createElement('button');
      b.className = 'cell' + (i === 13 ? ' today' : '');
      b.setAttribute('aria-pressed', String(i === selDay));
      b.setAttribute('aria-label', `${i === 13 ? 'Today' : fmt(d, { weekday: 'long', month: 'short', day: 'numeric' })}: ${k === 3 ? 'day won' : k + ' of 3'}`);
      b.innerHTML = `<svg viewBox="0 0 40 48" aria-hidden="true">
          <circle class="c-sun" cx="27" cy="12" r="6" opacity="${k >= 3 ? 1 : 0}"/>
          <path class="c-stem" d="M20 40 V16" opacity="${k > 0 ? 1 : 0}"/>
          <path class="c-a" d="M20 32 C13 32 9 28 8 23 C14 23 18 26 20 32Z" opacity="${k >= 1 ? 1 : 0}"/>
          <path class="c-b" d="M20 26 C27 26 31 22 32 17 C26 17 22 20 20 26Z" opacity="${k >= 2 ? 1 : 0}"/>
          <path class="c-top" d="M20 19 C15 18 13 15 13 11 C17 12 19 15 20 19Z" opacity="${k >= 3 ? 1 : 0}"/>
          <rect class="c-pot" x="12" y="40" width="16" height="6" rx="2"/>
        </svg><span>${fmt(d, { weekday: 'narrow' })}</span>`;
      b.addEventListener('click', () => { selDay = i; renderGarden(); });
      g.appendChild(b);
    }
    const sd = addDays(t, selDay - 13), sday = state.days[keyOf(sd)], sk = doneCount(sday);
    $('#selTitle').textContent = selDay === 13 ? 'Today' : selDay === 12 ? 'Yesterday' : fmt(sd, { weekday: 'short', month: 'short', day: 'numeric' });
    const chip = $('#selChip');
    chip.textContent = sk === 3 ? 'DAY WON' : `${sk} OF 3`;
    chip.classList.toggle('won', sk === 3);
    const ul = $('#selList'); ul.innerHTML = '';
    const named = sday ? sday.items.filter((x) => x.t.trim()) : [];
    if (!named.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = selDay === 13 ? 'Nothing named yet today.' : 'Nothing planted that day.'; ul.appendChild(li); }
    named.forEach((x) => { const li = document.createElement('li'); if (x.d) li.className = 'd'; li.innerHTML = '<i></i><span></span>'; li.lastChild.textContent = x.t; ul.appendChild(li); });
  }

  /* ───────── Profile ───────── */
  const LEAF = 'M8 13 C4 11 3 7 4 3 C8 4 11 7 8 13Z';
  const SUN = 'M8 4.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z';
  const FLAME = 'M8 1.5c1 2.5 4 4 4 7.5a4 4 0 0 1-8 0c0-1.6.8-2.7 1.8-3.6C6 7 7 7.5 7.5 6 7.8 4.6 7.6 3 8 1.5z';
  function renderProfile() {
    const name = state.name || '';
    const initials = (name.trim().split(/\s+/).map((w) => w[0] || '').join('').slice(0, 2) || 'G').toUpperCase();
    $('#avatar').textContent = initials;
    const ni = $('#nameInput'); if (document.activeElement !== ni) ni.value = name;
    const s = stats();
    const first = Object.keys(state.days).sort()[0];
    $('#whoSub').textContent = first ? `Growing since ${fmt(fromKey(first), { month: 'long', year: 'numeric' })} · ${s.total} days won` : 'Your garden starts today';
    $('#weekCount').textContent = `${Math.min(s.week, 5)} / 5 DAYS`;
    $('#weekBars').innerHTML = [0, 1, 2, 3, 4].map((k) => `<i class="${k < s.week ? 'on' : ''}"></i>`).join('');
    $('#weekHint').textContent = s.week >= 5 ? 'Goal reached this week. Nice.' : `${5 - s.week} more ${5 - s.week === 1 ? 'day' : 'days'} won to hit your goal this week.`;
    const badges = [
      ['First leaf', s.anyDone, LEAF], ['First day won', s.total >= 1, SUN], ['7-day streak', s.best >= 7, FLAME],
      ['Full week', s.week >= 5, SUN], ['30 days won', s.total >= 30, SUN], ['100 days won', s.total >= 100, SUN]
    ];
    $('#badgeCount').textContent = `${badges.filter((b) => b[1]).length} / ${badges.length}`;
    $('#badges').innerHTML = badges.map(([n, got, icon]) => `<div class="badge${got ? ' got' : ''}"><b><svg viewBox="0 0 16 16" aria-hidden="true"><path d="${icon}"/></svg></b>${n}${got ? '' : '<span class="sr-only"> (locked)</span>'}</div>`).join('');
    $$('.switch').forEach((sw) => sw.setAttribute('aria-checked', String(!!state.settings[sw.dataset.key])));
    $('#times').hidden = !state.settings.morning;
    $$('#times button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.time === state.settings.time)));
    applyTheme();
  }
  $('#nameInput').addEventListener('input', (e) => { state.name = e.target.value; save(); renderProfile(); });
  function setProfileTab(t) {
    $('#tabOverview').setAttribute('aria-selected', String(t === 'overview'));
    $('#tabSettings').setAttribute('aria-selected', String(t === 'settings'));
    $('#overview').hidden = t !== 'overview';
    $('#settings').hidden = t !== 'settings';
  }
  $('#tabOverview').addEventListener('click', () => setProfileTab('overview'));
  $('#tabSettings').addEventListener('click', () => setProfileTab('settings'));
  $('#themes').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; state.settings.theme = b.dataset.theme; save(); applyTheme(); });
  $$('.switch').forEach((sw) => sw.addEventListener('click', () => {
    const k = sw.dataset.key; state.settings[k] = !state.settings[k]; save(); renderProfile();
    if (k === 'haptics' && state.settings.haptics) buzz(12);
    if (k === 'sound' && state.settings.sound) tone(587.33, 0, 0.8, 0.08);
    if (k === 'carry') renderCarry();
    if (k === 'morning' || k === 'evening') syncReminders(true);
  }));
  $('#times').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; state.settings.time = b.dataset.time; save(); renderProfile(); syncReminders(true); });
  $('#exportBtn').addEventListener('click', async () => {
    const text = JSON.stringify(state, null, 2);
    try { await navigator.clipboard.writeText(text); toast('History copied to clipboard'); }
    catch (e) { toast('Could not copy on this device'); }
  });
  let clearArmed = 0;
  $('#clearBtn').addEventListener('click', (e) => {
    const b = e.currentTarget;
    if (Date.now() - clearArmed > 3000) { clearArmed = Date.now(); b.textContent = 'Tap again to clear today'; setTimeout(() => (b.textContent = 'Clear today'), 3000); return; }
    clearArmed = 0; b.textContent = 'Clear today';
    delete state.days[todayKey]; save(); renderToday(); setTab('today'); toast('Today cleared');
  });

  /* ───────── Navigation ───────── */
  let tab = 'today';
  function setTab(t) {
    tab = t;
    $$('#nav button').forEach((b) => (b.dataset.tab === t ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    ['today', 'garden', 'profile'].forEach((v) => ($(`#view-${v}`).hidden = v !== t));
    $('#topLabel').textContent = t === 'profile' ? 'PROFILE' : fmt(fromKey(todayKey), { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase().replace(',', ' ·');
    if (t === 'garden') renderGarden();
    if (t === 'profile') renderProfile();
    if (t === 'today') renderToday();
    $('#main').scrollTop = 0;
  }
  $('#nav').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setTab(b.dataset.tab); });

  // Android back button: close the win screen, otherwise go back to Today
  window.Capacitor?.Plugins?.App?.addListener?.('backButton', () => {
    if (!$('#win').hidden) closeWin(); else if (tab !== 'today') setTab('today'); else window.Capacitor.Plugins.App.exitApp?.();
  });

  /* ───────── Day rollover ───────── */
  function checkDay() {
    const k = keyOf(new Date());
    if (k !== todayKey) { todayKey = k; selDay = 13; setTab(tab); }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });
  setInterval(checkDay, 30e3);

  /* ───────── Sample data for screenshots: open with ?demo ───────── */
  if ((window.GROW_DEMO || /[?&]demo/.test(location.search)) && !Object.keys(state.days).length) {
    const sets = [['Ship the onboarding redesign', 'Call Dad back', '30 minutes of reading'], ['Write the quarterly memo', 'Gym: legs day', 'Inbox to zero'], ['Review three pull requests', 'Plan the weekend trip', 'Stretch before bed']];
    const pattern = [3, 3, 2, 3, 0, 3, 1, 3, 3, 2, 3, 3, 3, 3, 3, 2, 3, 3, 1, 3, 3, 3, 0, 3, 3, 3, 3, 2, 3, 3];
    const t = fromKey(todayKey);
    pattern.forEach((n, i) => { state.days[keyOf(addDays(t, i - pattern.length))] = { items: sets[i % 3].map((x, j) => ({ t: x, d: j < n })) }; });
    const m = location.search.match(/demo=(\d)/), n = m ? +m[1] : 1;
    state.days[todayKey] = { items: ['Send five outreach emails', 'Finish a focused work session', 'Get outside for a walk'].map((x, j) => ({ t: x, d: j < n })) };
    state.name = 'Alex Rivera';
    if (/dark/.test(location.search)) state.settings.theme = 'dark';
  }

  /* ───────── Boot ───────── */
  applyTheme();
  buildPris();
  setTab(/[?&]tab=(garden|profile)/.test(location.search) ? location.search.match(/tab=(\w+)/)[1] : 'today');
  if (/[?&]settings/.test(location.search)) setProfileTab('settings');
  if (/[?&]win/.test(location.search)) setTimeout(showWin, 300);
  syncReminders(false);
})();
