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
    const filled = day.items.filter((x) => x.t.trim()).length;
    $('#status').textContent = filled === 0 ? 'Name your three to plant today’s seed.' : STATUS[n];
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
  $('#winGarden').addEventListener('click', () => closeWin(() => { resetGardenSel(); setTab('garden'); }));
  $('#winBack').addEventListener('click', () => closeWin());

  /* ───────── Garden ───────── */
  const CANOPY = 'M-40 8 C-50 -8 -40 -28 -22 -28 C-20 -46 0 -54 14 -44 C30 -52 48 -38 44 -20 C58 -10 54 12 38 16 C36 32 14 38 2 28 C-10 38 -32 34 -32 20 C-44 20 -46 12 -40 8Z';
  const CANOPY_B = 'M-36 4 C-44 -14 -30 -32 -14 -30 C-8 -48 16 -50 24 -36 C42 -40 52 -20 42 -8 C54 4 46 22 30 22 C24 36 4 38 -4 28 C-18 36 -38 26 -34 14 C-42 12 -42 6 -36 4Z';
  const HILITE = 'M-30 -6 C-34 -20 -22 -30 -10 -26 C-6 -38 10 -42 18 -34 C8 -30 -2 -22 -6 -12 C-14 -14 -24 -10 -30 -6Z';
  const PINE = 'M0 -72 L16 -44 L8 -44 L26 -14 L14 -14 L34 18 L-34 18 L-14 -14 L-26 -14 L-8 -44 L-16 -44 Z';
  const leafTree = (x, y, s, canopy, hl) => `<g transform="translate(${x} ${y}) scale(${s})"><path class="t-trunk" stroke-width="${(3.4 / s).toFixed(1)}" d="M0 62 V14 M0 36 L-12 22"/><path class="t-dark" d="${canopy}"/>${hl ? `<path class="t-light" d="${HILITE}"/>` : ''}</g>`;
  const pine = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path class="t-trunk" stroke-width="${(3.4 / s).toFixed(1)}" d="M0 16 V32"/><path class="t-dark" stroke-linejoin="round" d="${PINE}"/></g>`;
  const ICONS = {
    sprout: '<path class="t-trunk" stroke-width="3" d="M28 46 V30"/><path class="t-dark" d="M28 38 C20 38 16 34 15 28 C22 28 26 32 28 38Z"/><path class="t-light" d="M28 33 C35 33 39 29 40 23 C33 23 29 27 28 33Z"/>',
    sapling: '<path class="t-trunk" stroke-width="3" d="M28 48 V18"/><path class="t-dark" d="M28 40 C19 40 15 35 14 29 C22 29 26 34 28 40Z"/><path class="t-light" d="M28 32 C37 32 41 27 42 21 C34 21 30 26 28 32Z"/><path class="t-dark" d="M28 22 C22 21 19 16 19 11 C25 12 28 16 28 22Z"/>',
    tree: leafTree(28, 27, 0.42, CANOPY, true),
    grove: leafTree(20, 30, 0.3, CANOPY, false) + leafTree(37, 34, 0.24, CANOPY_B, false),
    forest: pine(18, 38, 0.36) + pine(37, 36, 0.44),
    old: pine(44, 40, 0.3) + leafTree(25, 26, 0.48, CANOPY, true)
  };
  const STAGES = [['Sprout', 1, 'sprout'], ['Sapling', 7, 'sapling'], ['Tree', 30, 'tree'], ['Grove', 100, 'grove'], ['Forest', 200, 'forest'], ['Old growth', 365, 'old']];
  const plural = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;

  let selKey, viewMonth;
  function resetGardenSel() { selKey = todayKey; const t = fromKey(todayKey); viewMonth = new Date(t.getFullYear(), t.getMonth(), 1); }
  resetGardenSel();
  $('#monthPrev').addEventListener('click', () => { viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1); renderGarden(); });
  $('#monthNext').addEventListener('click', () => { viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1); renderGarden(); });
  $('#toHistory').addEventListener('click', () => $('#historyHead').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }));
  function renderGarden() {
    const s = stats();
    const t = fromKey(todayKey);
    const lastDay = isWon(state.days[todayKey]) ? t : addDays(t, -1);
    const streakStart = addDays(lastDay, -(s.cur - 1));
    let cur = -1;
    STAGES.forEach(([, th], i) => { if (s.cur >= th) cur = i; });

    // streak card
    $('#streakN').textContent = s.cur;
    $('#streakSub').textContent = cur < 0 ? 'Win today to plant a sprout' : `${s.cur === 1 ? 'day' : 'days'} · you’re a ${STAGES[cur][0]}`;
    const art = $('#streakArt');
    art.innerHTML = ICONS[STAGES[Math.max(cur, 0)][2]];
    art.classList.toggle('locked', cur < 0);

    // path
    const short = (d) => fmt(d, { month: 'short', day: 'numeric' }).toUpperCase();
    $('#path').innerHTML = STAGES.map(([name, th, icon], i) => {
      const state_ = i < cur ? 'reached' : i === cur ? 'current' : 'locked';
      let meta;
      if (state_ === 'locked') { const when = addDays(lastDay, th - s.cur); meta = keyOf(when) === todayKey ? 'TODAY' : short(when); }
      else if (state_ === 'reached') meta = '✓ ' + short(addDays(streakStart, th - 1));
      else meta = 'YOU’RE HERE';
      let progress = '';
      if (state_ === 'current') {
        const next = STAGES[i + 1];
        progress = next
          ? `<div class="stage-progress"><i style="--p:${Math.round(((s.cur - th) / (next[1] - th)) * 100)}%"></i><span>${next[1] - s.cur} TO ${next[0].toUpperCase()}</span></div>`
          : '<div class="stage-progress"><i style="--p:100%"></i><span>THE TOP. KEEP GOING.</span></div>';
      }
      const label = `${name}, ${plural(th)}: ${state_ === 'reached' ? 'reached' : state_ === 'current' ? 'your current stage' : 'reached on ' + meta.toLowerCase()}`;
      return `<li class="stage ${state_}" aria-label="${label}"><div class="stage-row"><svg class="stage-icon" viewBox="0 0 56 56" aria-hidden="true">${ICONS[icon]}</svg><div class="stage-name"><b>${name}</b><span>${plural(th)}</span></div><span class="stage-meta">${meta}</span></div>${progress}</li>`;
    }).join('');

    // history stats
    $('#histStats').textContent = `${s.total} WON · BEST ${s.best}`;

    // month calendar
    const y = viewMonth.getFullYear(), m = viewMonth.getMonth();
    const first = new Date(y, m, 1), daysIn = new Date(y, m + 1, 0).getDate(), lead = (first.getDay() + 6) % 7;
    $('#monthName').textContent = fmt(first, { month: 'long', year: 'numeric' });
    $('#monthWeek').innerHTML = [0, 1, 2, 3, 4, 5, 6].map((k) => `<span>${fmt(addDays(new Date(2024, 0, 1), k), { weekday: 'narrow' })}</span>`).join('');
    const grid = $('#monthGrid'); grid.innerHTML = '';
    for (let i = 0; i < lead; i++) { const b = document.createElement('span'); b.className = 'day blank'; grid.appendChild(b); }
    let won = 0, past = 0;
    for (let d = 1; d <= daysIn; d++) {
      const date = new Date(y, m, d), key = keyOf(date), k = doneCount(state.days[key]);
      const b = document.createElement('button');
      b.textContent = d;
      if (date > t) { b.className = 'day future'; b.disabled = true; b.setAttribute('aria-label', `${fmt(date, { month: 'long', day: 'numeric' })}: upcoming`); }
      else {
        if (date < t || k === 3) { past++; if (k === 3) won++; }
        b.className = 'day' + (k === 3 ? ' won' : k > 0 ? ` p${k}` : '') + (key === todayKey ? ' today' : '');
        if (k === 1 || k === 2) b.style.setProperty('--p', `${Math.round((k / 3) * 100)}%`);
        b.setAttribute('aria-pressed', String(key === selKey));
        b.setAttribute('aria-label', `${key === todayKey ? 'Today' : fmt(date, { weekday: 'long', month: 'long', day: 'numeric' })}: ${k === 3 ? 'day won' : k + ' of 3'}`);
        b.addEventListener('click', () => { selKey = key; renderGarden(); });
      }
      grid.appendChild(b);
    }
    $('#monthStat').textContent = past ? `${won} OF ${past} WON` : 'NOTHING YET';
    const firstKey = Object.keys(state.days).sort()[0];
    const firstMonth = firstKey ? new Date(fromKey(firstKey).getFullYear(), fromKey(firstKey).getMonth(), 1) : first;
    $('#monthPrev').disabled = first <= firstMonth;
    $('#monthNext').disabled = y === t.getFullYear() && m === t.getMonth();

    // selected day
    const sd = fromKey(selKey), sday = state.days[selKey], sk = doneCount(sday);
    $('#selTitle').textContent = selKey === todayKey ? 'Today' : selKey === keyOf(addDays(t, -1)) ? 'Yesterday' : fmt(sd, { weekday: 'short', month: 'short', day: 'numeric' });
    const chip = $('#selChip');
    chip.textContent = sk === 3 ? 'DAY WON' : `${sk} OF 3`;
    chip.classList.toggle('won', sk === 3);
    const ul = $('#selList'); ul.innerHTML = '';
    const named = sday ? sday.items.filter((x) => x.t.trim()) : [];
    if (!named.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = selKey === todayKey ? 'Nothing named yet today.' : 'Nothing planted that day.'; ul.appendChild(li); }
    named.forEach((x) => { const li = document.createElement('li'); if (x.d) li.className = 'd'; li.innerHTML = '<i></i><span></span>'; li.lastChild.textContent = x.t; ul.appendChild(li); });
  }

  /* ───────── Profile ───────── */
  const LEAF = 'M8 13 C4 11 3 7 4 3 C8 4 11 7 8 13Z';
  const SUN = 'M8 4.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z';
  const FLAME = 'M8 1.5c1 2.5 4 4 4 7.5a4 4 0 0 1-8 0c0-1.6.8-2.7 1.8-3.6C6 7 7 7.5 7.5 6 7.8 4.6 7.6 3 8 1.5z';
  function renderProfile() {
    const name = state.name || '';
    const initials = name.trim().split(/\s+/).map((w) => w[0] || '').join('').slice(0, 2).toUpperCase();
    if (initials) $('#avatar').textContent = initials;
    else $('#avatar').innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${LEAF}"/></svg>`;
    const ni = $('#nameInput'); if (document.activeElement !== ni) ni.value = name;
    const s = stats();
    const first = Object.keys(state.days).sort()[0];
    $('#whoSub').textContent = first ? `Growing since ${fmt(fromKey(first), { month: 'long', year: 'numeric' })} · ${s.total} days won` : 'Your garden starts today';
    $('#weekCount').textContent = `${Math.min(s.week, 5)} / 5 DAYS`;
    $('#weekBars').innerHTML = [0, 1, 2, 3, 4].map((k) => `<i class="${k < s.week ? 'on' : ''}"></i>`).join('');
    $('#weekHint').textContent = s.week >= 5 ? 'Goal reached this week. Nice.' : `${5 - s.week} more ${5 - s.week === 1 ? 'day' : 'days'} won to hit your goal this week.`;
    const badges = [
      ['First leaf', s.anyDone, LEAF, ''], ['First day won', s.total >= 1, SUN, ''], ['7-day streak', s.best >= 7, FLAME, `${s.best}/7`],
      ['Full week', s.week >= 5, SUN, `${s.week}/5`], ['30 days won', s.total >= 30, SUN, `${s.total}/30`], ['100 days won', s.total >= 100, SUN, `${s.total}/100`]
    ];
    $('#badgeCount').textContent = `${badges.filter((b) => b[1]).length} / ${badges.length}`;
    $('#badges').innerHTML = badges.map(([n, got, icon, prog]) => `<div class="badge${got ? ' got' : ''}"><b><svg viewBox="0 0 16 16" aria-hidden="true"><path d="${icon}"/></svg></b>${n}${got ? '' : (prog ? `<em>${prog}</em>` : '') + '<span class="sr-only"> (locked)</span>'}</div>`).join('');
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

  /* hide the floating nav while typing so the keyboard doesn't push it over the inputs */
  const app = $('.app');
  document.addEventListener('focusin', (e) => { if (e.target.matches('input')) app.classList.add('typing'); });
  document.addEventListener('focusout', (e) => { if (e.target.matches('input')) setTimeout(() => { if (!document.activeElement?.matches('input')) app.classList.remove('typing'); }, 0); });

  /* tap the sun on a won day to replay the sunrise */
  $('#sun').addEventListener('click', () => {
    if (!isWon(today())) return;
    renderToday({ celebrate: true }); chimeWin(); buzz(14);
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
    if (k !== todayKey) { todayKey = k; resetGardenSel(); setTab(tab); }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });
  setInterval(checkDay, 30e3);

  /* ───────── Sample data for screenshots: open with ?demo ───────── */
  if ((window.GROW_DEMO || /[?&]demo/.test(location.search)) && !Object.keys(state.days).length) {
    const sets = [['Ship the onboarding redesign', 'Call Dad back', '30 minutes of reading'], ['Write the quarterly memo', 'Gym: legs day', 'Inbox to zero'], ['Review three pull requests', 'Plan the weekend trip', 'Stretch before bed']];
    const pattern = [3, 3, 2, 3, 0, 3, 1, 3, 3, 2, 3, 3, 3, 3, 3, 2, 3, 3, 1, 3, 3, 3, 0, 3, 3, 3, 3, 2, 3, 3];
    const t = fromKey(todayKey);
    pattern.forEach((n, i) => { state.days[keyOf(addDays(t, i - pattern.length))] = { items: sets[i % 3].map((x, j) => ({ t: x, d: j < n })) }; });
    const sm = location.search.match(/streak=(\d+)/); if (sm) for (let i = 1; i <= +sm[1]; i++) state.days[keyOf(addDays(t, -i))] = { items: sets[i % 3].map((x) => ({ t: x, d: true })) };
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
