/* Логика интерфейса: роутинг по #hash, экраны, оболочки для пазлов и игр. */

// ------------------------------------------------------------------ утилиты DOM
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const k of Object.keys(props)) {
      const v = props[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : String(kid));
  }
  return el;
}
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

// Текст с `кодом` и переносами строк → безопасный HTML
function rich(text) {
  return Highlight.esc(String(text || ''))
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>');
}

function starsHTML(n, max) {
  max = max || 3;
  let s = '';
  for (let i = 1; i <= max; i++) s += '<span class="star' + (i <= n ? ' on' : '') + '">★</span>';
  return '<span class="stars" aria-label="' + n + t('app.1') + max + '">' + s + '</span>';
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ------------------------------------------------------------------ реестры модулей
const Puzzles = {
  types: {},
  ORDER: ['parsons', 'blanks', 'output', 'bug', 'maze', 'match', 'flow'],
  ICONS: { parsons: '🧩', blanks: '✏️', output: '🖨️', bug: '🐞', maze: '🗺️', match: '🔗', flow: '🔷' },
  register(id, def) { this.types[id] = def; },
  get(id) { return this.types[id]; }
};

const Games = {
  list: {},
  ORDER: ['robot', 'turtle', 'truefalse', 'count', 'tracer', 'memory', 'quiz', 'duel', 'minesweeper', 'bazaar'],
  ICONS: { robot: '🤖', turtle: '🐢', truefalse: '⚖️', count: '🔢', tracer: '💻', memory: '🃏', quiz: '💰', duel: '⚔️', minesweeper: '💣', bazaar: '🛒' },
  register(id, def) { this.list[id] = def; },
  get(id) { return this.list[id]; }
};

const TOPICS = [1, 2, 3, 4, 5, 6, 7, 8];

// ------------------------------------------------------------------ приложение
const App = (function () {
  'use strict';
  const view = () => $('#view');
  let leaveFns = [];
  let teacher = false;
  let teacherSettings = { noTimer: false };

  try {
    teacher = sessionStorage.getItem('pyquest.teacher') === '1';
    Object.assign(teacherSettings, JSON.parse(sessionStorage.getItem('pyquest.tsettings') || '{}'));
    if (sessionStorage.getItem('pyquest.projector') === '1') document.documentElement.classList.add('projector');
  } catch (e) { /* без sessionStorage режимы просто не запоминаются */ }

  function setTeacher(on) {
    teacher = on;
    try { sessionStorage.setItem('pyquest.teacher', on ? '1' : '0'); } catch (e) { /* ignore */ }
    document.documentElement.classList.toggle('teacher', on);
  }

  function setProjector(on) {
    document.documentElement.classList.toggle('projector', on);
    try { sessionStorage.setItem('pyquest.projector', on ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  function saveTeacherSettings() {
    try { sessionStorage.setItem('pyquest.tsettings', JSON.stringify(teacherSettings)); } catch (e) { /* ignore */ }
  }

  function onLeave(fn) { leaveFns.push(fn); }

  function go(hash) {
    if (location.hash === hash) route();
    else location.hash = hash;
  }

  // ---------------------------------------------------------------- роутер
  const ROUTES = [
    [/^\/?$/, renderHome],
    [/^\/puzzles$/, renderTopics],
    [/^\/puzzles\/(\d+)$/, m => renderTopic(+m[1])],
    [/^\/task\/([\w-]+)$/, m => renderTask(m[1])],
    [/^\/games$/, renderGames],
    [/^\/game\/(\w+)$/, m => renderGame(m[1], null)],
    [/^\/game\/(\w+)\/(\d+)$/, m => renderGame(m[1], +m[2])],
    [/^\/quest$/, () => Quest.render(view())],
    [/^\/quest\/(\d+)$/, m => Quest.station(view(), +m[1])],
    [/^\/present\/([\w-]+)$/, m => Teacher.present(view(), m[1])],
    [/^\/print$/, () => Teacher.print(view())],
    [/^\/achievements$/, renderAchievements],
    [/^\/teacher$/, () => Teacher.render(view())]
  ];

  function route() {
    leaveFns.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
    leaveFns = [];
    const path = decodeURIComponent(location.hash.replace(/^#/, ''));
    const v = view();
    v.innerHTML = '';
    v.className = 'view';
    window.scrollTo(0, 0);
    const section = path.split('/')[1] || '';
    $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.section === section ||
      (a.dataset.section === 'puzzles' && section === 'task') || (a.dataset.section === 'games' && section === 'game')));
    for (const [re, fn] of ROUTES) {
      const m = path.match(re);
      if (m) {
        try { fn(m); } catch (e) { console.error(e); v.append(h('p', { class: 'error-box' }, String(e.message || e))); }
        updateScore();
        return;
      }
    }
    v.append(h('div', { class: 'empty' }, h('h1', null, t('common.notfound')), h('a', { class: 'btn', href: '#/' }, t('common.tohome'))));
  }

  // ---------------------------------------------------------------- шапка и подвал
  function updateScore() {
    const el = $('#score');
    if (el) el.textContent = Progress.total();
  }

  const THEMES = ['auto', 'light', 'dark'];
  const THEME_ICON = { auto: '🌓', light: '☀️', dark: '🌙' };

  function applyTheme() {
    const th = Progress.state.theme || 'auto';
    if (th === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = th;
    const b = $('#themeBtn');
    if (b) { b.textContent = THEME_ICON[th]; b.title = t('theme.' + th); b.setAttribute('aria-label', t('theme.' + th)); }
  }

  function applySound() {
    const b = $('#soundBtn');
    if (!b) return;
    const on = !Progress.state.muted;
    b.textContent = on ? '🔊' : '🔇';
    b.title = on ? t('sound.on') : t('sound.off');
    b.setAttribute('aria-label', b.title);
  }

  function buildChrome() {
    document.title = t('app.title') + ' — ' + t('app.subtitle');
    const nav = [
      ['puzzles', '🧩', t('nav.puzzles')],
      ['games', '🎮', t('nav.games')],
      ['quest', '🗝️', t('nav.quest')],
      ['achievements', '🏆', t('nav.achievements')]
    ];
    const header = h('header', { class: 'topbar' },
      h('a', { class: 'brand', href: '#/' }, h('span', { class: 'brand-logo' }, 'py'), h('span', { class: 'brand-text' }, h('b', null, t('app.title')), h('small', null, t('app.subtitle')))),
      h('nav', { class: 'nav' }, nav.map(([id, icon, label]) =>
        h('a', { href: '#/' + id, 'data-section': id }, h('span', { class: 'nav-icon' }, icon), h('span', { class: 'nav-label' }, label)))),
      h('div', { class: 'top-actions' },
        h('a', { class: 'score-pill', href: '#/achievements', title: t('score') }, '⭐ ', h('span', { id: 'score' }, '0')),
        h('button', { class: 'icon-btn', id: 'soundBtn', onclick: () => { Sound.toggle(); applySound(); } }),
        h('button', { class: 'icon-btn', id: 'themeBtn', onclick: () => {
          const i = THEMES.indexOf(Progress.state.theme || 'auto');
          Progress.state.theme = THEMES[(i + 1) % THEMES.length];
          Progress.save();
          applyTheme();
        } })
      )
    );
    const footer = h('footer', { class: 'footer' },
      h('span', { class: 'muted' }, '🐍 ' + t('footer.offline')),
      h('span', { class: 'footer-actions' },
        h('button', { class: 'link-btn', onclick: askName }, t('name.change')),
        h('button', { class: 'link-btn', onclick: openTeacher }, '🎓 ' + t('footer.teacher')))
    );
    document.body.prepend(header);
    document.body.append(footer);
    if (!Progress.storageOk) FX.toast(t('common.storage'), '⚠️');
    applyTheme();
    applySound();
    document.documentElement.classList.toggle('teacher', teacher);
  }

  // ---------------------------------------------------------------- модальные окна
  function modal(opts) {
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); if (opts.onClose) opts.onClose(); };
    const onKey = e => { if (e.key === 'Escape' && opts.dismiss !== false) close(); };
    const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || '' },
      opts.title ? h('h2', null, opts.title) : null,
      opts.body || null,
      opts.actions ? h('div', { class: 'modal-actions' }, opts.actions.map(a =>
        h('button', { class: 'btn' + (a.primary ? ' primary' : ''), onclick: () => { if (a.onclick && a.onclick() === false) return; close(); } }, a.label))) : null
    );
    const back = h('div', { class: 'modal-back', onclick: e => { if (e.target === back && opts.dismiss !== false) close(); } }, box);
    document.body.append(back);
    document.addEventListener('keydown', onKey);
    const f = box.querySelector('input, button.primary, button');
    if (f) setTimeout(() => f.focus(), 30);
    return { close, box };
  }

  function askName(first) {
    const input = h('input', { type: 'text', class: 'input', maxlength: '24', placeholder: t('name.placeholder'), value: Progress.state.name || '' });
    const save = () => {
      Progress.state.name = input.value.trim() || t('app.2');
      Progress.save();
      if (location.hash === '' || location.hash === '#/') route();
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { save(); m.close(); } });
    const m = modal({
      title: t('name.title'),
      dismiss: first !== true,
      body: h('div', null, h('p', { class: 'muted' }, t('name.lead')), input),
      actions: [{ label: t('name.save'), primary: true, onclick: save }]
    });
  }

  function openTeacher() {
    if (teacher) return go('#/teacher');
    const input = h('input', { type: 'password', inputmode: 'numeric', class: 'input', autocomplete: 'off', placeholder: 'PIN' });
    const msg = h('p', { class: 'bad-text' });
    const tryPin = () => {
      if (input.value === String(CONFIG.teacherPin)) { setTeacher(true); go('#/teacher'); return true; }
      msg.textContent = t('teacher.pin.wrong');
      FX.shake(input);
      Sound.play('bad');
      return false;
    };
    const m = modal({
      title: t('teacher.pin'),
      body: h('div', null, input, msg),
      actions: [{ label: t('common.cancel') }, { label: t('teacher.enter'), primary: true, onclick: tryPin }]
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && tryPin()) m.close(); });
  }

  // ---------------------------------------------------------------- главная
  function renderHome() {
    const s = Progress.state;
    const solved = TASKS.filter(x => s.tasks[x.id]).length;
    const word = String(CONFIG.questWord);
    const letters = typeof Quest !== 'undefined' ? Quest.openLetters() : 0;
    const card = (href, cls, icon, title, desc, meta) =>
      h('a', { class: 'home-card ' + cls, href }, h('span', { class: 'home-icon' }, icon),
        h('span', { class: 'home-title' }, title), h('span', { class: 'home-desc' }, desc), h('span', { class: 'home-meta' }, meta));
    view().append(
      h('section', { class: 'hero' },
        h('h1', null, t('home.hello', { name: s.name || '👋' })),
        h('p', { class: 'lead' }, t('home.lead'))),
      h('div', { class: 'home-grid' },
        card('#/puzzles', 'c-puzzles', '🧩', t('home.puzzles'), t('home.puzzles.desc'), t('home.solved', { n: solved, total: TASKS.length })),
        card('#/games', 'c-games', '🎮', t('home.games'), t('home.games.desc'), t('home.games.count', { n: Games.ORDER.length })),
        card('#/quest', 'c-quest', '🗝️', t('home.quest'), t('home.quest.desc'), t('home.quest.letters', { n: letters, total: word.length })),
        card('#/achievements', 'c-ach', '🏆', t('home.achievements'), t('home.achievements.desc'),
          t('home.badges', { n: Object.keys(s.ach).length, total: Progress.ACHIEVEMENTS.length }))
      )
    );
  }

  // ---------------------------------------------------------------- пазлы
  function renderTopics() {
    const s = Progress.state;
    view().append(
      h('div', { class: 'page-head' }, h('h1', null, t('puzzles.title')), h('p', { class: 'lead' }, t('puzzles.lead'))),
      h('div', { class: 'topic-grid' }, TOPICS.map(n => {
        const all = TASKS.filter(x => x.topic === n);
        const done = all.filter(x => s.tasks[x.id]).length;
        return h('a', { class: 'topic-card', href: '#/puzzles/' + n },
          h('span', { class: 'topic-num' }, n),
          h('span', { class: 'topic-name' }, t('topic.' + n)),
          h('span', { class: 'topic-meta', html: starsHTML(Progress.topicStars(n)) + ' <span>' + done + ' / ' + all.length + '</span>' }),
          h('span', { class: 'bar' }, h('span', { style: { width: (all.length ? done / all.length * 100 : 0) + '%' } })));
      }))
    );
  }

  const filters = { type: 'all', level: 0 };

  function renderTopic(topic) {
    const v = view();
    const list = h('div', { class: 'task-list' });
    const chips = (items, key) => h('div', { class: 'chips' }, items.map(([val, label]) =>
      h('button', { class: 'chip' + (filters[key] === val ? ' on' : ''), onclick: () => { filters[key] = val; renderTopicInto(); } }, label)));
    const head = h('div', { class: 'page-head' },
      h('a', { class: 'back', href: '#/puzzles' }, '← ' + t('puzzles.title')),
      h('h1', null, topic + '. ' + t('topic.' + topic)),
      h('div', { class: 'topic-head-stars', html: starsHTML(Progress.topicStars(topic)) }));
    const fbox = h('div', { class: 'filters' });
    v.append(head, fbox, list);

    function renderTopicInto() {
      fbox.innerHTML = '';
      fbox.append(
        chips([['all', t('puzzles.all')]].concat(Puzzles.ORDER.map(x => [x, Puzzles.ICONS[x] + ' ' + t('type.' + x)])), 'type'),
        chips([[0, t('puzzles.all')], [1, '★'], [2, '★★'], [3, '★★★']], 'level'));
      list.innerHTML = '';
      const tasks = TASKS.filter(x => x.topic === topic && (filters.type === 'all' || x.type === filters.type) && (!filters.level || x.level === filters.level));
      if (!tasks.length) list.append(h('p', { class: 'empty muted' }, t('puzzles.empty')));
      for (const task of tasks) {
        const done = Progress.state.tasks[task.id];
        list.append(h('a', { class: 'task-row' + (done ? ' done' : ''), href: '#/task/' + task.id },
          h('span', { class: 'task-icon', title: t('type.' + task.type) }, Puzzles.ICONS[task.type]),
          h('span', { class: 'task-name' }, h('b', null, task.title), h('small', null, t('type.' + task.type))),
          h('span', { html: starsHTML(task.level) }),
          h('span', { class: 'task-done' }, done ? '✔' : '')));
      }
    }
    renderTopicInto();
  }

  function nextTask(task) {
    const ordered = TOPICS.flatMap(n => TASKS.filter(x => x.topic === n));
    const i = ordered.indexOf(task);
    const rest = ordered.slice(i + 1).concat(ordered.slice(0, i));
    return rest.find(x => !Progress.state.tasks[x.id]) || ordered[i + 1] || null;
  }

  function renderTask(id) {
    const v = view();
    const task = TASKS.find(x => x.id === id);
    if (!task) { v.append(h('p', { class: 'empty' }, t('task.notfound'))); return; }
    const def = Puzzles.get(task.type);
    let hints = 0, wrong = 0, done = false, inst = null;

    const host = h('div', { class: 'puzzle-host' });
    const status = h('div', { class: 'status', 'aria-live': 'polite' });
    const hintsBox = h('div', { class: 'hints' });
    const result = h('div', { class: 'result' });
    const hintBtn = h('button', { class: 'btn ghost', onclick: showHint });
    const answerBtn = h('button', { class: 'btn ghost teacher-only', onclick: () => inst && inst.reveal && inst.reveal() }, '👁 ' + t('task.answer'));

    function updateHintBtn() {
      const left = (task.hints || []).length - hints;
      hintBtn.disabled = left <= 0 || done;
      hintBtn.innerHTML = '💡 ' + (left > 0 ? t('task.hint') + ' <small>' + t('task.hint.cost', { n: CONFIG.points.hint }) + '</small>' : t('task.nohints'));
    }

    function showHint() {
      if (hints >= (task.hints || []).length) return;
      hintsBox.append(h('div', { class: 'hint', html: '<b>' + t('task.hint.n', { n: hints + 1 }) + ':</b> ' + rich(task.hints[hints]) }));
      hints++;
      Sound.play('hint');
      updateHintBtn();
    }

    const ctx = {
      task,
      teacher,
      host,
      setStatus(msg, kind) {
        status.className = 'status' + (kind ? ' ' + kind : '');
        status.innerHTML = msg ? rich(msg) : '';
      },
      onWrong(msg) {
        if (done) return;
        wrong++;
        Progress.taskWrong();
        Sound.play('bad');
        FX.shake(host);
        ctx.setStatus((msg || t('task.wrong')) + '  ' + t('task.attempts', { n: wrong }), 'bad');
      },
      onCorrect(msg) {
        if (done) return;
        done = true;
        const r = Progress.taskSolved(task, hints, wrong);
        Quest.onTaskSolved(task.id);
        Sound.play('ok');
        FX.confetti();
        ctx.setStatus('', '');
        updateHintBtn();
        updateScore();
        const nt = nextTask(task);
        result.innerHTML = '';
        result.append(h('div', { class: 'result-card' },
          h('div', { class: 'result-head' }, '🎉 ' + t('task.correct') + ' ', r.first ? h('span', { class: 'earned' }, t('task.earned', { n: r.pts })) : null),
          msg ? h('p', { html: rich(msg) }) : null,
          !r.first ? h('p', { class: 'muted' }, t('task.already')) : null,
          task.explain ? h('div', { class: 'explain' }, h('b', null, t('task.explain') + ': '), h('span', { html: rich(task.explain) })) : null,
          h('div', { class: 'row' },
            h('button', { class: 'btn', onclick: () => route() }, '↺ ' + t('task.again')),
            nt ? h('a', { class: 'btn primary', href: '#/task/' + nt.id }, t('task.next')) : null)));
        result.scrollIntoView({ behavior: FX.reduced() ? 'auto' : 'smooth', block: 'nearest' });
      }
    };

    const solvedBefore = Progress.state.tasks[task.id];
    v.classList.add('task-view');
    v.append(...[
      Quest.banner('task', task.id),
      h('div', { class: 'task-head' },
        h('a', { class: 'back', href: '#/puzzles/' + task.topic }, '← ' + t('topic.' + task.topic)),
        h('div', { class: 'task-tags' },
          h('span', { class: 'tag' }, Puzzles.ICONS[task.type] + ' ' + t('type.' + task.type)),
          h('span', { class: 'tag', html: starsHTML(task.level) }),
          solvedBefore ? h('span', { class: 'tag ok' }, '✔ ' + t('task.solved')) : null),
        h('h1', null, task.title),
        task.story ? h('p', { class: 'story', html: rich(task.story) }) : null),
      host, status,
      h('div', { class: 'task-bar' }, hintBtn, answerBtn),
      hintsBox, result
    ].filter(Boolean));
    updateHintBtn();

    if (!def) { host.append(h('p', { class: 'empty muted' }, t('puzzles.notype'))); return; }
    inst = def.mount(host, task, ctx) || {};
    onLeave(() => inst.destroy && inst.destroy());
  }

  // ---------------------------------------------------------------- игры
  function renderGames() {
    view().append(
      h('div', { class: 'page-head' }, h('h1', null, t('games.title')), h('p', { class: 'lead' }, t('games.lead'))),
      h('div', { class: 'game-grid' }, Games.ORDER.map(id => {
        const ready = !!Games.get(id);
        const n = Progress.levelCount(id);
        return h('a', { class: 'game-card' + (ready ? '' : ' soon'), href: '#/game/' + id },
          h('span', { class: 'game-icon' }, Games.ICONS[id]),
          h('span', { class: 'game-title' }, t('game.' + id)),
          h('span', { class: 'game-desc' }, t('game.' + id + '.desc')),
          h('span', { class: 'game-meta', html: ready ? starsHTML(Progress.gameStars(id)) + (n ? ' <span>' + Progress.levelsDone(id) + ' / ' + n + '</span>' : '') : '<span class="soon-tag">' + t('games.soon') + '</span>' }));
      }))
    );
  }

  function levelUnlocked(id, n) {
    if (teacher || n === 1) return true;
    // уровень текущей станции квеста открыт, даже если предыдущие не пройдены
    const qa = Progress.state.quest && Progress.state.quest.active;
    if (qa && qa.kind === 'game' && qa.id === id && qa.level === n) return true;
    const g = Progress.state.games[id];
    return !!(g && g.levels[n - 1]);
  }

  function renderLevelPicker(id, def) {
    const levels = LEVELS[id] || [];
    const g = Progress.state.games[id] || { levels: {} };
    view().append(...[
      gameTop(id, null, null),
      def.sandbox ? h('a', { class: 'btn sandbox-btn', href: '#/game/' + id + '/0' }, t('app.3')) : null,
      h('div', { class: 'level-grid' }, levels.map((L, i) => {
        const n = i + 1;
        const open = levelUnlocked(id, n);
        const st = g.levels[n] ? g.levels[n].stars : 0;
        return h(open ? 'a' : 'span', { class: 'level-tile' + (open ? '' : ' locked') + (g.levels[n] ? ' done' : ''), href: open ? '#/game/' + id + '/' + n : null, title: open ? L.title : t('game.locked') },
          h('span', { class: 'level-num' }, open ? n : '🔒'),
          h('span', { class: 'level-name' }, L.title || ''),
          h('span', { html: starsHTML(st) }));
      }))
    ].filter(Boolean));
  }

  function gameTop(id, onPause, onHelp) {
    return h('div', { class: 'game-top' },
      h('a', { class: 'back', href: '#/games' }, '← ' + t('nav.games')),
      h('h1', null, Games.ICONS[id] + ' ' + t('game.' + id)),
      h('div', { class: 'game-top-actions' },
        onHelp ? h('button', { class: 'btn small ghost', onclick: onHelp }, '❓ ' + t('game.tutorial.again')) : null,
        onPause ? h('button', { class: 'btn small', onclick: onPause }, '⏸ ' + t('game.pause')) : null,
        h('a', { class: 'btn small', href: '#/games' }, '✕ ' + t('game.exit'))));
  }

  function showTutorial(id, def, done) {
    const slides = def.tutorial || [];
    if (!slides.length) return done();
    let i = 0;
    const body = h('div', { class: 'tutorial' });
    let m;
    const draw = () => {
      const s = slides[i];
      body.innerHTML = '';
      body.append(...[
        h('div', { class: 'tut-dots' }, slides.map((_, k) => h('span', { class: k === i ? 'on' : '' }))),
        h('h3', null, s.title),
        h('p', { html: rich(s.text) }),
        s.code ? h('div', { html: Highlight.code(s.code) }) : null,
        h('div', { class: 'modal-actions' },
          h('button', { class: 'btn ghost', onclick: () => { m.close(); } }, t('game.tutorial.skip')),
          h('button', { class: 'btn primary', onclick: () => { if (++i < slides.length) draw(); else m.close(); } },
            i < slides.length - 1 ? t('game.tutorial.next') : t('game.tutorial.start')))].filter(Boolean));
    };
    m = modal({ title: Games.ICONS[id] + ' ' + t('game.' + id), body, onClose: () => { Progress.markSeen(id); done(); } });
    draw();
  }

  function renderGame(id, level) {
    const v = view();
    const def = Games.get(id);
    if (!def) {
      v.append(gameTop(id), h('div', { class: 'empty' }, h('p', { class: 'muted' }, t('game.notready'))));
      return;
    }
    if (def.levels && level === null) return renderLevelPicker(id, def);
    const sandbox = def.sandbox && level === 0;
    if (def.levels && !sandbox && (!LEVELS[id] || !LEVELS[id][level - 1] || !levelUnlocked(id, level))) return go('#/game/' + id);

    let inst = null, paused = false, pauseBox = null;
    const host = h('div', { class: 'game-host game-' + id });

    function pause() {
      if (paused || !inst) return;
      paused = true;
      if (inst.pause) inst.pause();
      pauseBox = modal({
        title: '⏸ ' + t('game.paused'),
        onClose: resume,
        actions: [{ label: '✕ ' + t('game.exit'), onclick: () => go('#/games') }, { label: '▶ ' + t('game.resume'), primary: true }]
      });
    }
    function resume() {
      if (!paused) return;
      paused = false;
      pauseBox = null;
      if (inst && inst.resume) inst.resume();
    }
    const help = () => { if (inst && inst.pause) inst.pause(); showTutorial(id, def, () => { if (inst && inst.resume && !paused) inst.resume(); }); };

    v.classList.add('game-view');
    v.append(...[Quest.banner('game', id, level), gameTop(id, def.noPause ? null : pause, def.tutorial ? help : null), host].filter(Boolean));

    const onKey = e => {
      if (e.key === 'Escape' && !document.querySelector('.modal-back') && !def.noPause) { e.preventDefault(); pause(); }
    };
    document.addEventListener('keydown', onKey);
    onLeave(() => {
      document.removeEventListener('keydown', onKey);
      if (pauseBox) { paused = false; pauseBox.close(); }
      if (inst && inst.destroy) inst.destroy();
    });

    const ctx = {
      id, level, teacher,
      levelData: def.levels && !sandbox ? LEVELS[id][level - 1] : null,
      levelCount: def.levels ? LEVELS[id].length : 0,
      settings: teacherSettings,
      host,
      get paused() { return paused; },
      finishLevel(stars, pts) {
        const gain = Progress.levelDone(id, level, stars, pts);
        updateScore();
        Quest.onLevelDone(id, level);
        return gain;
      },
      addPoints(n) { Progress.addGamePoints(id, n); updateScore(); },
      record(key, val, lower) { return Progress.record(key, val, lower); },
      bump(stat, n) { Progress.bump(stat, n); },
      goLevel(n) { go('#/game/' + id + '/' + n); },
      levels() { go('#/game/' + id); },
      exit() { go('#/games'); },
      modal
    };

    const start = () => { inst = def.mount(host, ctx) || {}; };
    if (!Progress.seen(id) && def.tutorial) showTutorial(id, def, start);
    else start();
  }

  // ---------------------------------------------------------------- достижения
  function renderAchievements() {
    const s = Progress.state;
    const stat = (label, val) => h('div', { class: 'stat' }, h('b', null, val), h('span', null, label));
    const recKeys = ['truefalse', 'count', 'memory', 'quiz'].filter(k => s.records[k] !== undefined);
    view().append(
      h('div', { class: 'page-head' }, h('h1', null, t('ach.title')), h('p', { class: 'lead' }, s.name || '')),
      h('div', { class: 'stats' },
        stat(t('ach.points.total'), Progress.total()),
        stat(t('ach.points.puzzles'), Progress.puzzlePoints()),
        stat(t('ach.points.games'), Progress.gamePoints())),
      h('div', { class: 'two-col' },
        h('section', { class: 'panel' }, h('h2', null, t('ach.topics')),
          h('ul', { class: 'star-list' }, TOPICS.map(n => h('li', null, h('span', null, n + '. ' + t('topic.' + n)), h('span', { html: starsHTML(Progress.topicStars(n)) }))))),
        h('section', { class: 'panel' }, h('h2', null, t('ach.games')),
          h('ul', { class: 'star-list' }, Games.ORDER.map(id => h('li', null, h('span', null, Games.ICONS[id] + ' ' + t('game.' + id)), h('span', { html: starsHTML(Progress.gameStars(id)) })))))),
      h('section', { class: 'panel' }, h('h2', null, t('ach.badges') + ' — ' + Object.keys(s.ach).length + ' / ' + Progress.ACHIEVEMENTS.length),
        h('div', { class: 'badges' }, Progress.ACHIEVEMENTS.map(a => {
          const got = s.ach[a.id];
          return h('div', { class: 'badge' + (got ? ' got' : ''), title: got ? new Date(got).toLocaleDateString('ru-RU') : t('ach.locked') },
            h('span', { class: 'badge-icon' }, a.icon), h('b', null, t('badge.' + a.id)), h('small', null, t('badge.' + a.id + '.desc')));
        }))),
      h('section', { class: 'panel' }, h('h2', null, t('ach.records')),
        recKeys.length ? h('ul', { class: 'star-list' }, recKeys.map(k => h('li', null, h('span', null, t('record.' + k)), h('b', null, s.records[k]))))
          : h('p', { class: 'muted' }, t('ach.norecords')))
    );
  }

  function resetProgress() {
    modal({
      title: t('teacher.reset'),
      body: h('p', null, t('teacher.reset.confirm')),
      actions: [{ label: t('common.cancel') }, { label: t('common.yes'), primary: true, onclick: () => { Progress.reset(); updateScore(); FX.toast(t('teacher.reset.done'), '🗑'); } }]
    });
  }

  // ---------------------------------------------------------------- старт
  function init() {
    buildChrome();
    window.addEventListener('hashchange', route);
    Progress.onChange(updateScore);
    route();
    if (!Progress.state.name) askName(true);
  }

  return {
    init, go, route, onLeave, modal, updateScore,
    get teacher() { return teacher; },
    setTeacher, setProjector, resetProgress, openTeacher,
    get teacherSettings() { return teacherSettings; },
    saveTeacherSettings, view,
    renderGame, renderTask
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
