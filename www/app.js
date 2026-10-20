const VERSION = '1.1.0';
const KEY = 'simple-todo.tasks';
const THEME_KEY = 'simple-todo.theme';

const list = document.getElementById('list');
const form = document.getElementById('form');
const input = document.getElementById('input');
const empty = document.getElementById('empty');
const count = document.getElementById('count');

let tasks = load();

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(tasks));
}

const CHECK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L19 7"/></svg>';
const TRASH = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>';

function render() {
  list.innerHTML = '';
  for (const t of tasks) {
    const li = document.createElement('li');
    li.className = 'item' + (t.done ? ' done' : '');
    li.innerHTML = `<button class="check" aria-label="Complete">${CHECK}</button><span class="text"></span><button class="del" aria-label="Delete">${TRASH}</button>`;
    li.querySelector('.text').textContent = t.text;
    li.querySelector('.check').onclick = () => { t.done = !t.done; save(); render(); };
    li.querySelector('.del').onclick = () => askDelete(t, li);
    list.appendChild(li);
  }
  const left = tasks.filter(t => !t.done).length;
  count.textContent = tasks.length ? `${left} of ${tasks.length} left` : '';
  empty.classList.toggle('show', tasks.length === 0);
}

const modal = document.getElementById('modal');
let pending = null;
function askDelete(t, li) {
  pending = { t, li };
  document.getElementById('modal-text').textContent = '“' + t.text + '” will be removed.';
  modal.classList.add('show');
}
function closeModal() { modal.classList.remove('show'); pending = null; }
document.getElementById('cancel').onclick = closeModal;
modal.onclick = e => { if (e.target === modal) closeModal(); };
document.getElementById('confirm').onclick = () => {
  const { t, li } = pending;
  closeModal();
  li.classList.add('removing');
  setTimeout(() => { tasks = tasks.filter(x => x !== t); save(); render(); }, 180);
};

form.onsubmit = e => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  tasks.unshift({ text, done: false });
  input.value = '';
  save();
  render();
};

// Theme: follow the phone setting until the user taps the toggle
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}
const saved = localStorage.getItem(THEME_KEY);
const media = matchMedia('(prefers-color-scheme: dark)');
applyTheme(saved || (media.matches ? 'dark' : 'light'));
media.onchange = e => { if (!localStorage.getItem(THEME_KEY)) applyTheme(e.matches ? 'dark' : 'light'); };
document.getElementById('theme').onclick = () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
};

document.getElementById('date').textContent =
  new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

document.getElementById('version').textContent = 'Simple Todo · v' + VERSION;

render();
