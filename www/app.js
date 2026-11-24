/* Meridian — three priorities, one sun. */
(() => {
  'use strict';

  const KEY = 'meridian.v1';
  const ROMAN = ['I', 'II', 'III'];
  const PLACEHOLDERS = ['The one that moves the needle…', 'The one you keep postponing…', 'The one that is just for you…'];
  const STATUS = [
    'Before dawn. Three to win the day.',
    'First light. Keep going.',
    'Almost noon. One more.',
    'High noon. Day won.',
  ];
  const LEDE = [
    'Three priorities. Nothing more. Finish them and the sun reaches noon.',
    'The sun is up. Two more and it reaches noon.',
    'One left between you and noon.',
    'Noon reached. The rest of the day is yours.',
  ];
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ───────── Storage ───────── */
  const blankDay = () => ({ items: [0, 1, 2].map(() => ({ t: '', d: false })) });
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.days) return s; } catch (e) {}
    return { days: {}, settings: { theme: 'system', sound: true, haptics: true }, carryDismissed: {} };
  }
  let state = load();
  state.settings = Object.assign({ theme: 'system', sound: true, haptics: true }, state.settings);
  state.carryDismissed = state.carryDismissed || {};
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  let todayKey = keyOf(new Date());
  const today = () => state.days[todayKey] || blankDay();
  const ensureToday = () => (state.days[todayKey] ||= blankDay());
  const doneCount = (day) => day.items.filter((i) => i.d && i.t.trim()).length;
  const isWon = (day) => day && doneCount(day) === 3;

  /* ───────── Theme ───────── */
  function applyTheme() {
    const t = state.settings.theme;
    if (t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    $$('#themeSeg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.theme === t)));
  }

  /* ───────── Sound & haptics ───────── */
  let actx;
  function tone(freq, when = 0, dur = 1.2, gain = 0.12, type = 'sine') {
    if (!state.settings.sound) return;
    try {
      actx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const t0 = actx.currentTime + when;
      const o = actx.createOscillator(), g = actx.createGain(), o2 = actx.createOscillator(), g2 = actx.createGain();
      o.type = type; o.frequency.value = freq;
      o2.type = 'sine'; o2.frequency.value = freq * 2.001; g2.gain.value = 0.25;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(actx.destination);
      o.start(t0); o2.start(t0); o.stop(t0 + dur + 0.05); o2.stop(t0 + dur + 0.05);
    } catch (e) {}
  }
  const NOTES = [523.25, 659.25, 783.99]; // C5 E5 G5 — the day's chord, built one priority at a time
  const chimeCheck = (n) => tone(NOTES[Math.max(0, n - 1)], 0, 1.4, 0.13);
  const chimeUncheck = () => tone(392, 0, 0.35, 0.05, 'triangle');
  const chimeWin = () => [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.25 + i * 0.11, 2.6, 0.09));
  const buzz = (p) => { if (state.settings.haptics && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} };

  /* ───────── Sky ───────── */
  const svgNS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs, parent) => { const el = document.createElementNS(svgNS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); parent && parent.appendChild(el); return el; };
  const CX = 300, CY = 200, R = 165;
  const arcPoint = (p) => { const th = ((p <= 0 ? 186 : 180 - 90 * p) * Math.PI) / 180; return [CX + R * Math.cos(th), CY - R * Math.sin(th)]; };

  (function buildSky() {
    // hidden defs for the check seal
    const defs = mk('svg', { width: 0, height: 0, style: 'position:absolute', 'aria-hidden': 'true' }, document.body);
    defs.innerHTML = '<defs><radialGradient id="sealGrad" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#FFF3D6"/><stop offset=".4" stop-color="#FFD27A"/><stop offset="1" stop-color="#FF8F55"/></radialGradient></defs>';
    // stars — deterministic so they don't jump between renders
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const stars = $('#stars');
    for (let i = 0; i < 60; i++) {
      const c = mk('circle', { cx: (rnd() * 600).toFixed(1), cy: (rnd() * 170).toFixed(1), r: (rnd() * 1.1 + 0.35).toFixed(2) }, stars);
      c.style.setProperty('--d', (2 + rnd() * 3).toFixed(2) + 's'); c.style.animationDelay = (-rnd() * 4).toFixed(2) + 's';
    }
    // tick markers on the arc
    const ticks = $('#ticks');
    [1 / 3, 2 / 3, 1].forEach((p, i) => {
      const [x, y] = arcPoint(p);
      mk('circle', { cx: x, cy: y, r: 4, class: 'tick-dot', 'data-i': i }, ticks);
      const th = ((180 - 90 * p) * Math.PI) / 180;
      const lx = CX + (R + 22) * Math.cos(th), ly = CY - (R + 22) * Math.sin(th);
      const t = mk('text', { x: lx, y: ly + 5, 'text-anchor': 'middle', class: 'tick-label' }, ticks);
      t.textContent = ROMAN[i].toLowerCase();
    });
    // rays
    const rays = $('#rayLines');
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, long = i % 2 === 0;
      mk('line', { x1: Math.cos(a) * 28, y1: Math.sin(a) * 28, x2: Math.cos(a) * (long ? 46 : 38), y2: Math.sin(a) * (long ? 46 : 38), opacity: long ? 0.9 : 0.5 }, rays);
    }
  })();

  let shownP = -1, raf;
  function setSun(target, instant) {
    const sun = $('#sun'), trail = $('#trail');
    const draw = (p) => {
      const [x, y] = arcPoint(p);
      sun.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      trail.style.strokeDashoffset = String(1 - Math.max(0, p));
    };
    cancelAnimationFrame(raf);
    if (instant || reduced || shownP < 0) { shownP = target; draw(target); return; }
    const from = shownP, t0 = performance.now(), dur = 1300;
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      shownP = from + (target - from) * ease(t); draw(shownP);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  /* ───────── Today ───────── */
  const list = $('#priList');
  let editing = -1;

  function priHTML(i) {
    const angles = Array.from({ length: 8 }, (_, k) => `<i style="--a:${k * 45}deg"></i>`).join('');
    return `
      <span class="numeral" aria-hidden="true">${ROMAN[i].toLowerCase()}.</span>
      <div class="pri-body">
        <p class="pri-meta mono"><span>Priority ${ROMAN[i]}</span>
          <button class="focus-chip" data-act="focus" aria-label="Focus on priority ${i + 1}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>Focus</button>
        </p>
        <div class="pri-slot"></div>
      </div>
      <button class="seal" role="checkbox" aria-checked="false" data-act="toggle" aria-label="Mark priority ${i + 1} done">
        <svg viewBox="0 0 36 36" aria-hidden="true"><circle class="ring" cx="18" cy="18" r="16.5"/><circle class="fill" cx="18" cy="18" r="18"/><path class="tick" d="M11 18.5l4.6 4.5L25.5 13"/></svg>
        <span class="burst">${angles}</span>
      </button>`;
  }

  function buildList() {
    list.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const li = document.createElement('li');
      li.className = 'pri'; li.dataset.i = i; li.style.setProperty('--i', i);
      li.innerHTML = priHTML(i);
      list.appendChild(li);
    }
  }

  function renderSlot(li, i, item) {
    const slot = $('.pri-slot', li);
    const needInput = editing === i || !item.t.trim();
    const cur = slot.firstElementChild;
    if (needInput) {
      if (cur && cur.tagName === 'INPUT') return;
      slot.innerHTML = `<input class="pri-input" maxlength="90" enterkeyhint="done" aria-label="Priority ${i + 1}" placeholder="${PLACEHOLDERS[i]}">`;
      slot.firstElementChild.value = item.t;
    } else {
      if (cur && cur.tagName === 'SPAN' && cur.textContent === item.t) return;
      slot.innerHTML = '<span class="pri-title" data-act="edit" tabindex="0" role="button"></span>';
      slot.firstElementChild.textContent = item.t;
      slot.firstElementChild.setAttribute('aria-label', `${item.t}. Tap to edit`);
    }
  }

  function renderToday(opts = {}) {
    const day = today();
    const n = doneCount(day);
    $$('.pri', list).forEach((li, i) => {
      const item = day.items[i];
      const empty = !item.t.trim();
      li.classList.toggle('done', item.d && !empty);
      li.classList.toggle('empty', empty);
      li.classList.toggle('editing', editing === i);
      const seal = $('.seal', li);
      seal.disabled = empty;
      seal.setAttribute('aria-checked', String(item.d && !empty));
      renderSlot(li, i, item);
    });

    document.body.dataset.stage = n;
    $('#skyCard').dataset.stage = n;
    const cn = $('#countN');
    if (cn.textContent !== String(n)) { cn.textContent = n; if (!opts.silent) { cn.classList.remove('bump'); void cn.offsetWidth; cn.classList.add('bump'); } }
    $('#status').textContent = STATUS[n];
    $('#lede').textContent = LEDE[n];
    $$('#segments i').forEach((s, i) => s.classList.toggle('on', i < n));
    $$('.tick-dot').forEach((t, i) => t.classList.toggle('on', i < n));
    const rem = $('#remaining');
    const filled = day.items.filter((x) => x.t.trim()).length;
    rem.textContent = n === 3 ? 'All complete' : filled < 3 ? `${3 - filled} to name` : `${3 - n} remaining`;
    rem.classList.toggle('won', n === 3);
    setSun(n / 3, opts.instant);
    renderCarry();
  }

  function renderDate() {
    const d = new Date();
    const start = new Date(d.getFullYear(), 0, 0);
    const doy = Math.floor((d - start) / 864e5);
    const wk = d.toLocaleDateString(undefined, { weekday: 'long' });
    const md = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    $('#dateLine').textContent = `${wk} · ${md} · Day ${doy}`;
  }

  // carry over unfinished priorities from the previous recorded day
  function lastPrevDay() {
    const keys = Object.keys(state.days).filter((k) => k < todayKey).sort();
    return keys.length ? keys[keys.length - 1] : null;
  }
  function carryCandidates() {
    const t = today();
    if (t.items.some((x) => x.t.trim()) || state.carryDismissed[todayKey]) return [];
    const pk = lastPrevDay();
    if (!pk || fromKey(pk) < addDays(fromKey(todayKey), -3)) return [];
    return state.days[pk].items.filter((x) => x.t.trim() && !x.d);
  }
  function renderCarry() {
    const c = carryCandidates(), box = $('#carry');
    box.hidden = !c.length;
    if (c.length) $('#carrySub').textContent = c.map((x) => `“${x.t}”`).join(', ');
  }
  $('#carryYes').addEventListener('click', () => {
    const c = carryCandidates(); const d = ensureToday();
    c.slice(0, 3).forEach((x, i) => (d.items[i] = { t: x.t, d: false }));
    save(); renderToday(); toast(`Carried over ${c.length}`);
  });
  $('#carryNo').addEventListener('click', () => { state.carryDismissed[todayKey] = 1; save(); renderCarry(); });

  /* interactions */
  list.addEventListener('click', (e) => {
    const li = e.target.closest('.pri'); if (!li) return;
    const i = +li.dataset.i;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'toggle') toggle(i, li);
    else if (act === 'edit') startEdit(i);
    else if (act === 'focus') openFocus(i);
  });
  list.addEventListener('keydown', (e) => {
    if (e.target.classList.contains('pri-title') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); startEdit(+e.target.closest('.pri').dataset.i); }
    if (e.target.classList.contains('pri-input')) {
      if (e.key === 'Enter') { e.preventDefault(); const i = +e.target.closest('.pri').dataset.i; commit(i, e.target.value); focusNextEmpty(i); }
      if (e.key === 'Escape') { editing = -1; renderToday({ silent: true }); }
    }
  });
  list.addEventListener('focusout', (e) => {
    if (!e.target.classList.contains('pri-input')) return;
    const i = +e.target.closest('.pri').dataset.i;
    setTimeout(() => commit(i, e.target.value), 0);
  });

  function startEdit(i) {
    editing = i; renderToday({ silent: true });
    const inp = $(`.pri[data-i="${i}"] .pri-input`);
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  }
  function focusNextEmpty(i) {
    const items = today().items;
    for (let k = i + 1; k < 3; k++) if (!items[k].t.trim()) { $(`.pri[data-i="${k}"] .pri-input`)?.focus(); return; }
    document.activeElement?.blur();
  }
  function commit(i, val) {
    const t = val.replace(/\s+/g, ' ').trim();
    const cur = today().items[i];
    if (editing === i) editing = -1;
    if (t !== cur.t) {
      const d = ensureToday(); d.items[i].t = t; if (!t) d.items[i].d = false;
      const wasWon = !!d.wonAt; if (!isWon(d)) delete d.wonAt; if (wasWon && !d.wonAt) {}
      save();
    }
    if (document.activeElement?.classList.contains('pri-input') && document.activeElement.closest('.pri')?.dataset.i != i) {
      // another input is active — keep its DOM untouched
      const keep = +document.activeElement.closest('.pri').dataset.i; editing = keep;
    }
    renderToday({ silent: true });
  }

  function toggle(i, li) {
    const d = ensureToday(); const item = d.items[i];
    if (!item.t.trim()) return;
    item.d = !item.d;
    const n = doneCount(d);
    if (item.d) {
      li.classList.remove('pop'); void li.offsetWidth; li.classList.add('pop');
      chimeCheck(n); buzz(n === 3 ? [16, 60, 16, 60, 40] : 14);
    } else { chimeUncheck(); buzz(6); }
    let justWon = false;
    if (n === 3 && !d.wonAt) { d.wonAt = Date.now(); justWon = true; }
    if (n < 3) delete d.wonAt;
    save(); renderToday();
    announce(`${n} of 3 complete.${n === 3 ? ' Day won.' : ''}`);
    if (justWon) setTimeout(showWin, reduced ? 50 : 1250);
  }

  /* ───────── Win ───────── */
  function streakInfo() {
    let cur = 0; let d = fromKey(todayKey);
    if (!isWon(state.days[todayKey])) d = addDays(d, -1);
    while (isWon(state.days[keyOf(d)])) { cur++; d = addDays(d, -1); }
    const won = Object.keys(state.days).filter((k) => isWon(state.days[k])).sort();
    let best = 0, run = 0, prev = null;
    won.forEach((k) => { run = prev && keyOf(addDays(fromKey(prev), 1)) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; });
    return { cur, best, total: won.length };
  }

  let sparkStop;
  function showWin() {
    const w = $('#win');
    const d = new Date(); const s = streakInfo();
    $('#winDate').textContent = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    $('#winSub').textContent = s.cur > 1 ? `Three for three. That's ${s.cur} days in a row.` : 'Three for three. The sun is yours.';
    const wk = $('#winWeek'); wk.innerHTML = '';
    for (let k = 6; k >= 0; k--) {
      const dd = addDays(fromKey(todayKey), -k);
      const sp = document.createElement('span');
      sp.innerHTML = `<i class="${isWon(state.days[keyOf(dd)]) ? 'on' : ''}"></i>${dd.toLocaleDateString(undefined, { weekday: 'narrow' })}`;
      wk.appendChild(sp);
    }
    w.hidden = false; w.classList.remove('out');
    chimeWin();
    if (!reduced) sparkStop = sparks($('#sparks'));
    setTimeout(() => $('#winClose').focus(), 400);
  }
  function closeWin() {
    const w = $('#win'); if (w.hidden) return;
    w.classList.add('out');
    setTimeout(() => { w.hidden = true; sparkStop && sparkStop(); }, 480);
  }
  $('#winClose').addEventListener('click', closeWin);
  $('#win').addEventListener('click', (e) => { if (e.target.id === 'sparks' || e.target.classList.contains('win')) closeWin(); });

  function sparks(cv) {
    const ctx = cv.getContext('2d'); const dpr = Math.min(2, devicePixelRatio || 1);
    const W = (cv.width = innerWidth * dpr), H = (cv.height = innerHeight * dpr);
    const cols = ['#FFF6DE', '#FFE3A3', '#FFD27A', '#FFB36B', '#FF8F6B'];
    const P = [];
    const burst = (x, y, n, spd) => { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = (Math.random() * spd + spd * 0.25) * dpr; P.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2 * dpr, life: 1, decay: 0.006 + Math.random() * 0.01, r: (Math.random() * 2.4 + 0.8) * dpr, c: cols[(Math.random() * cols.length) | 0], star: Math.random() < 0.25 }); } };
    burst(W / 2, H * 0.58, 170, 9);
    let t = 0, id, alive = true;
    const star = (x, y, r) => { ctx.beginPath(); for (let k = 0; k < 8; k++) { const rr = k % 2 ? r * 0.35 : r * 2.4, a = (k * Math.PI) / 4; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); };
    const loop = () => {
      t++;
      if (t === 40) burst(W * 0.25, H * 0.45, 60, 6);
      if (t === 70) burst(W * 0.75, H * 0.4, 60, 6);
      if (t % 6 === 0 && t < 600) P.push({ x: Math.random() * W, y: H + 10, vx: (Math.random() - 0.5) * 0.4 * dpr, vy: -(Math.random() * 1.6 + 0.8) * dpr, life: 1, decay: 0.004, r: (Math.random() * 1.6 + 0.6) * dpr, c: cols[(Math.random() * 3) | 0], rise: 1 });
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i];
        p.x += p.vx; p.y += p.vy;
        if (!p.rise) { p.vy += 0.09 * dpr; p.vx *= 0.985; p.vy *= 0.985; }
        p.life -= p.decay;
        if (p.life <= 0) { P.splice(i, 1); continue; }
        ctx.globalAlpha = Math.min(1, p.life * 1.4); ctx.fillStyle = p.c;
        if (p.star) star(p.x, p.y, p.r); else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
      }
      if (alive) id = requestAnimationFrame(loop);
    };
    loop();
    return () => { alive = false; cancelAnimationFrame(id); ctx.clearRect(0, 0, W, H); };
  }

  /* ───────── Focus timer ───────── */
  let focus = { i: 0, min: 25, endAt: 0, left: 25 * 60e3, running: false }, focusTimer;
  (function buildDial() {
    const g = $('#dialTicks');
    for (let k = 0; k < 60; k++) {
      const a = (k / 60) * Math.PI * 2 - Math.PI / 2, major = k % 5 === 0, r1 = major ? 108 : 112, r2 = 118;
      mk('line', { x1: 150 + Math.cos(a) * r1, y1: 150 + Math.sin(a) * r1, x2: 150 + Math.cos(a) * r2, y2: 150 + Math.sin(a) * r2, class: 'dial-tick' + (major ? ' major' : '') }, g);
    }
  })();
  function openFocus(i) {
    const item = today().items[i]; if (!item.t.trim()) return;
    if (focus.i !== i || !focus.running) { focus = { i, min: focus.min, endAt: 0, left: focus.min * 60e3, running: false }; }
    $('#focusLabel').textContent = `Focus · Priority ${ROMAN[i]}`;
    $('#focusTitle').textContent = item.t;
    const f = $('#focus'); f.hidden = false; f.classList.remove('out');
    drawFocus(); setTimeout(() => $('#focusToggle').focus(), 200);
  }
  function closeFocus() { const f = $('#focus'); f.classList.add('out'); setTimeout(() => (f.hidden = true), 280); }
  function remaining() { return focus.running ? Math.max(0, focus.endAt - Date.now()) : focus.left; }
  function drawFocus() {
    const left = remaining(), total = focus.min * 60e3, p = 1 - left / total;
    const s = Math.ceil(left / 1000);
    $('#dialTime').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    $('#dialProg').style.strokeDashoffset = String(1 - p);
    const a = p * Math.PI * 2 - Math.PI / 2;
    $('#dialSun').setAttribute('transform', `translate(${150 + Math.cos(a) * 128} ${150 + Math.sin(a) * 128})`);
    $('#dialState').textContent = focus.running ? 'In the zone' : left === 0 ? 'Session complete' : left < total ? 'Paused' : 'Ready';
    $('#focusToggle').textContent = focus.running ? 'Pause' : left < total && left > 0 ? 'Resume' : left === 0 ? 'Again' : 'Begin';
    $('#durations').classList.toggle('locked', focus.running || (left < total && left > 0));
    $$('#durations button').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.min === focus.min)));
    if (focus.running && left === 0) {
      focus.running = false; focus.left = 0; clearInterval(focusTimer);
      [783.99, 987.77, 1174.66].forEach((f, k) => tone(f, k * 0.18, 1.8, 0.1)); buzz([30, 80, 30]);
      drawFocus();
    }
  }
  $('#focusToggle').addEventListener('click', () => {
    if (focus.running) { focus.left = remaining(); focus.running = false; clearInterval(focusTimer); }
    else {
      if (focus.left === 0) focus.left = focus.min * 60e3;
      focus.endAt = Date.now() + focus.left; focus.running = true;
      clearInterval(focusTimer); focusTimer = setInterval(drawFocus, 250);
      tone(523.25, 0, 0.6, 0.06);
    }
    drawFocus();
  });
  $('#focusReset').addEventListener('click', () => { clearInterval(focusTimer); focus.running = false; focus.left = focus.min * 60e3; drawFocus(); });
  $('#durations').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; focus.min = +b.dataset.min; focus.left = focus.min * 60e3; drawFocus(); });
  $('#focusDone').addEventListener('click', () => {
    clearInterval(focusTimer); focus.running = false; focus.left = focus.min * 60e3;
    closeFocus();
    const i = focus.i;
    if (!today().items[i].d) setTimeout(() => toggle(i, $(`.pri[data-i="${i}"]`)), 320);
  });
  $('#focusClose').addEventListener('click', closeFocus);

  /* ───────── History ───────── */
  function renderHistory() {
    const s = streakInfo();
    const tk = fromKey(todayKey);
    let won30 = 0, act30 = 0;
    for (let k = 0; k < 30; k++) { const d = state.days[keyOf(addDays(tk, -k))]; if (d && d.items.some((x) => x.t.trim())) { act30++; if (isWon(d)) won30++; } }
    const rate = act30 ? Math.round((won30 / act30) * 100) : 0;
    $('#stats').innerHTML = `
      <div class="stat hot"><p class="mono">Streak</p><p class="stat-n">${s.cur}<small>d</small></p><p class="stat-sub">${s.cur ? 'Keep the sun rising' : 'Win today to begin'}</p></div>
      <div class="stat"><p class="mono">Best run</p><p class="stat-n">${s.best}<small>d</small></p><p class="stat-sub">${s.total} days won, all time</p></div>
      <div class="stat"><p class="mono">Win rate</p><p class="stat-n">${rate}<small>%</small></p><p class="stat-sub">Last 30 days</p></div>`;

    // heatmap: 18 weeks, columns Monday-first
    const heat = $('#heat'); heat.innerHTML = '';
    const dow = (tk.getDay() + 6) % 7;
    const start = addDays(tk, -(17 * 7 + dow));
    let wonN = 0;
    for (let k = 0; k < 18 * 7; k++) {
      const d = addDays(start, k), key = keyOf(d), day = state.days[key];
      const i = document.createElement('i');
      i.style.setProperty('--w', Math.floor(k / 7));
      if (d > tk) i.className = 'hx';
      else {
        const n = day ? doneCount(day) : 0;
        i.className = n === 3 ? 'h3' : n === 2 ? 'h2' : n === 1 ? 'h1' : 'h0';
        if (n === 3) wonN++;
        if (key === todayKey) i.classList.add('today');
        i.title = `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${n}/3`;
      }
      heat.appendChild(i);
    }
    heat.setAttribute('aria-label', `${wonN} days won in the last eighteen weeks`);
    requestAnimationFrame(() => { const w = $('.heat-wrap'); w.scrollLeft = w.scrollWidth; });

    const days = $('#days'); days.innerHTML = '';
    const keys = Object.keys(state.days).filter((k) => k <= todayKey && state.days[k].items.some((x) => x.t.trim())).sort().reverse().slice(0, 10);
    $('#emptyDays').hidden = keys.length > 0;
    keys.forEach((k) => {
      const d = fromKey(k), day = state.days[k], n = doneCount(day);
      const li = document.createElement('li'); li.className = 'day';
      const label = k === todayKey ? 'Today' : k === keyOf(addDays(tk, -1)) ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'long' });
      const verdict = n === 3 ? 'Day won' : n === 0 ? 'Not started' : `${n} of 3`;
      li.innerHTML = `
        <button class="day-row" aria-expanded="false">
          <span class="day-date"><b>${d.getDate()}</b><span>${d.toLocaleDateString(undefined, { month: 'short' })}</span></span>
          <span class="day-name">${label}<small>${verdict}</small></span>
          <span class="pips" aria-hidden="true">${[0, 1, 2].map((j) => `<i class="${j < n ? 'on' : ''}"></i>`).join('')}</span>
          <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="day-items"><ol></ol></div>`;
      const ol = $('ol', li);
      day.items.forEach((x, j) => { if (!x.t.trim()) return; const it = document.createElement('li'); if (x.d) it.className = 'd'; it.innerHTML = `<b>${ROMAN[j].toLowerCase()}.</b><span></span>`; it.lastChild.textContent = x.t; ol.appendChild(it); });
      days.appendChild(li);
    });
  }
  $('#days').addEventListener('click', (e) => {
    const b = e.target.closest('.day-row'); if (!b) return;
    const li = b.parentElement; const open = li.classList.toggle('open'); b.setAttribute('aria-expanded', String(open));
  });

  /* ───────── Navigation ───────── */
  function setView(v) {
    $$('.seg button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === v)));
    $('#view-today').hidden = v !== 'today';
    $('#view-history').hidden = v !== 'history';
    if (v === 'history') renderHistory();
    movePill(); scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }
  function movePill() {
    const b = $('.seg button[aria-selected="true"]'), pill = $('.seg-pill');
    pill.style.width = b.offsetWidth + 'px'; pill.style.transform = `translateX(${b.offsetLeft - 4}px)`;
  }
  $$('.seg button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  $('.brand').addEventListener('click', (e) => { e.preventDefault(); setView('today'); });
  addEventListener('resize', movePill);

  /* ───────── Settings ───────── */
  const sw = (el, on) => el.setAttribute('aria-checked', String(on));
  function openSettings() { const s = $('#settings'); s.hidden = false; s.classList.remove('out'); sw($('#soundSw'), state.settings.sound); sw($('#hapticSw'), state.settings.haptics); applyTheme(); }
  function closeSettings() { const s = $('#settings'); s.classList.add('out'); setTimeout(() => (s.hidden = true), 240); }
  $('#settingsBtn').addEventListener('click', openSettings);
  $('#settingsClose').addEventListener('click', closeSettings);
  $('#settings').addEventListener('click', (e) => { if (e.target.id === 'settings') closeSettings(); });
  $('#themeSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; state.settings.theme = b.dataset.theme; save(); applyTheme(); });
  $('#soundSw').addEventListener('click', () => { state.settings.sound = !state.settings.sound; save(); sw($('#soundSw'), state.settings.sound); if (state.settings.sound) tone(659.25, 0, 0.6, 0.08); });
  $('#hapticSw').addEventListener('click', () => { state.settings.haptics = !state.settings.haptics; save(); sw($('#hapticSw'), state.settings.haptics); buzz(12); });
  $('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `meridian-${todayKey}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast('Exported');
  });
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('Clear today’s priorities?')) return;
    delete state.days[todayKey]; save(); editing = -1; renderToday(); closeSettings(); toast('Today cleared');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#win').hidden) closeWin(); else if (!$('#focus').hidden) closeFocus(); else if (!$('#settings').hidden) closeSettings();
  });

  /* ───────── Misc ───────── */
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }
  function announce(msg) { $('#live').textContent = msg; }

  // roll over at midnight / when returning to the app
  function checkDay() {
    const k = keyOf(new Date());
    if (k !== todayKey) { todayKey = k; editing = -1; renderDate(); renderToday({ instant: true }); if (!$('#view-history').hidden) renderHistory(); }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkDay(); if (focus.running) drawFocus(); } });
  setInterval(checkDay, 30e3);

  // ?demo — seeds a believable history (for screenshots / first look)
  if (/[?&]demo/.test(location.search) && !Object.keys(state.days).length) {
    const sample = [['Ship the onboarding redesign', 'Call mom back', '30 minutes of reading'], ['Write the quarterly memo', 'Gym — legs', 'Inbox to zero'], ['Review 3 pull requests', 'Plan the weekend trip', 'Stretch before bed']];
    const tk = fromKey(todayKey); let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 1; k < 110; k++) {
      const r = rnd(); if (k >= 6 && r < 0.12) continue;
      const n = k < 6 ? 3 : r < 0.55 ? 3 : r < 0.75 ? 2 : r < 0.9 ? 1 : 0;
      const s = sample[k % 3];
      state.days[keyOf(addDays(tk, -k))] = { items: s.map((t, j) => ({ t, d: j < n })) };
    }
    state.days[todayKey] = { items: [{ t: 'Send five outreach emails', d: /demo=[123]/.test(location.search) }, { t: 'Finish a focused work session', d: /demo=[23]/.test(location.search) }, { t: 'Get outside for a walk', d: /demo=3/.test(location.search) }] };
    if (/demo=3/.test(location.search)) state.days[todayKey].wonAt = Date.now();
  }

  /* ───────── Boot ───────── */
  applyTheme();
  renderDate();
  buildList();
  renderToday({ instant: true, silent: true });
  requestAnimationFrame(movePill);
  document.fonts && document.fonts.ready.then(movePill);
  if (/[?&]view=history/.test(location.search)) setView('history');
  if (/[?&]win/.test(location.search)) setTimeout(showWin, 300);
  if (/[?&]focus/.test(location.search)) setTimeout(() => openFocus(0), 300);
})();
