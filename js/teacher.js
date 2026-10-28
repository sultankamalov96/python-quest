/* Режим учителя: все ответы, фильтры, настройки игр, проектор, печать.
   TaskView — как показать задачу без ответа (проектор, печать) и её ответ. */
const TaskView = (function () {
  'use strict';
  const LETTERS = t('teacher.1');
  const code = src => h('div', { html: Highlight.code(src) });

  // Перемешивание с зерном: на проекторе и в распечатке порядок строк всегда одинаковый
  function seeded(arr, key) {
    let a = 0;
    for (const ch of key) a = (a * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => { a = (a * 1103515245 + 12345) >>> 0; return a / 4294967296; };
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }

  const fix = (task, f) => {
    const line = task.code.split('\n')[task.data.line - 1];
    return task.data.raw || /^\s/.test(f) ? f : line.match(/^\s*/)[0] + f;
  };

  // ---------------------------------------------------------------- задание (без ответа)
  function body(task, mode) {
    const d = task.data || {};
    const parts = [];
    switch (task.type) {
      case 'output':
        parts.push(code(task.code));
        if ((task.inputs || []).length) parts.push(h('p', null, t('teacher.2'), h('code', null, task.inputs.join(', '))));
        if (mode === 'print') parts.push(h('div', { class: 'pr-answer-box' }, t('teacher.3')));
        break;
      case 'parsons':
      case 'flow': {
        if (task.type === 'flow') parts.push(h('div', { class: 'tv-chart', html: Flowchart.svg(d.chart) }));
        const all = d.lines.map(l => l.trim()).concat((d.distractors || []).map(l => l.trim()));
        const lines = seeded(all, task.id);
        parts.push(h('div', { class: 'tv-strips' }, lines.map(l => h('div', { class: 'tv-strip', html: (mode === 'print' ? '<span class="tv-cut">✂</span>' : '') + Highlight.line(l) }))));
        if (d.distractors && d.distractors.length) parts.push(h('p', { class: 'muted' }, t('teacher.4')));
        break;
      }
      case 'blanks': {
        parts.push(h('div', { html: Highlight.code(task.code).replace(/___(\d+)___/g, '<span class="tv-blank">  $1  </span>') }));
        parts.push(h('div', { class: 'tv-bank' }, h('b', null, t('teacher.5')), seeded(d.bank, task.id).map(b => h('code', { class: 'tv-tile' }, b))));
        break;
      }
      case 'bug':
        parts.push(code(task.code));
        parts.push(h('p', null, t('teacher.6')));
        parts.push(h('ol', { class: 'tv-fixes', type: 'A' }, d.fixes.map(f => h('li', null, h('code', null, d.raw ? fix(task, f) : fix(task, f).trim())))));
        if (mode === 'print') parts.push(h('div', { class: 'pr-answer-line' }, t('teacher.7')));
        break;
      case 'maze':
        parts.push(code(task.code));
        parts.push(h('p', null, t('teacher.8'), h('b', null, d.goal), t('teacher.9'), h('code', null, d.inputLabels.join(', '))));
        if (mode === 'print') parts.push(h('div', { class: 'pr-answer-line' }, d.inputLabels.map(l => l + ' = ______').join('     ')));
        break;
      case 'match': {
        const right = seeded(d.pairs.map(p => p[1]), task.id);
        parts.push(h('div', { class: 'tv-match' },
          h('div', null, d.pairs.map((p, i) => h('div', { class: 'tv-mcard' }, h('b', null, (i + 1) + '. '), h('code', { html: p[0].split('\n').map(Highlight.line).join('<br>') })))),
          h('div', null, right.map((r, i) => h('div', { class: 'tv-mcard' }, h('b', null, LETTERS[i] + ') '), h('code', null, r))))));
        if (mode === 'print') parts.push(h('div', { class: 'pr-answer-line' }, d.pairs.map((_, i) => (i + 1) + ' — ___').join('    ')));
        break;
      }
    }
    return parts;
  }

  // ---------------------------------------------------------------- ответ
  function answer(task) {
    const d = task.data || {};
    const parts = [];
    switch (task.type) {
      case 'output': {
        const r = Py.run(task.code, { inputs: task.inputs || [] });
        parts.push(h('pre', { class: 'tr-out' }, r.output || t('teacher.10')));
        break;
      }
      case 'parsons':
      case 'flow':
        parts.push(code(d.lines.join('\n')));
        if (d.distractors && d.distractors.length) parts.push(h('p', null, t('teacher.11'), d.distractors.map(x => h('code', null, x.trim())), ' '));
        break;
      case 'blanks':
        parts.push(code(task.code.replace(/___(\d+)___/g, (m, n) => d.answers[n][0])));
        parts.push(h('p', null, Object.keys(d.answers).map(n => n + ' → ' + d.answers[n].join(t('teacher.12'))).join(';  ')));
        break;
      case 'bug':
        parts.push(h('p', null, t('teacher.13') + d.line + t('teacher.14') + 'ABCD'[d.correct] + ': ', h('code', null, fix(task, d.fixes[d.correct]))));
        break;
      case 'maze':
        parts.push(h('p', null, t('teacher.15') + d.solutions.map(s => d.inputLabels.map((l, i) => l + ' = ' + s[i]).join(', ')).join(t('teacher.16'))));
        break;
      case 'match': {
        const right = seeded(d.pairs.map(p => p[1]), task.id);
        parts.push(h('p', null, d.pairs.map((p, i) => (i + 1) + ' — ' + LETTERS[right.indexOf(p[1])] + ' (' + p[1] + ')').join(';  ')));
        break;
      }
    }
    if (task.explain) parts.push(h('p', { class: 'tv-explain', html: t('teacher.17') + rich(task.explain) }));
    return h('div', { class: 'tv-answer' }, parts);
  }

  function meta(task) {
    return Puzzles.ICONS[task.type] + ' ' + t('type.' + task.type) + t('teacher.18') + task.topic + ' · ' + '★'.repeat(task.level);
  }

  return { body, answer, meta, seeded };
})();

const Teacher = (function () {
  'use strict';
  const filters = { topic: 0, type: 'all', level: 0 };
  let projBefore = null;   // был ли включён проектор до входа в показ задач
  let selected = new Set();
  try { selected = new Set(JSON.parse(sessionStorage.getItem('pyquest.print') || '[]')); } catch (e) { /* ignore */ }
  const saveSel = () => { try { sessionStorage.setItem('pyquest.print', JSON.stringify(Array.from(selected))); } catch (e) { /* ignore */ } };
  const filtered = () => TASKS.filter(x => (!filters.topic || x.topic === filters.topic) && (filters.type === 'all' || x.type === filters.type) && (!filters.level || x.level === filters.level));

  function guard() {
    if (App.teacher) return true;
    App.openTeacher();
    App.go('#/');
    return false;
  }

  // ---------------------------------------------------------------- панель учителя
  function render(v) {
    if (!guard()) return;
    const proj = document.documentElement.classList.contains('projector');
    const S = App.teacherSettings;
    const toggle = (label, key) => h('label', { class: 'tc-toggle' },
      h('input', { type: 'checkbox', checked: S[key] || null, onchange: e => { S[key] = e.target.checked; App.saveTeacherSettings(); } }), label);

    const list = h('div', { class: 'tch-list' });
    const fbox = h('div', { class: 'filters' });
    const counter = h('span', { class: 'muted' });

    v.append(
      h('div', { class: 'page-head' }, h('h1', null, t('teacher.19')),
        h('p', { class: 'lead' }, t('teacher.20'))),
      h('div', { class: 'tch-grid' },
        h('section', { class: 'panel' }, h('h2', null, t('teacher.21')),
          h('div', { class: 'tch-col' },
            h('button', { class: 'btn', onclick: () => { App.setProjector(!proj); App.route(); } }, (proj ? '✔ ' : '') + t('teacher.22')),
            toggle(t('teacher.23'), 'noTimer'),
            h('p', { class: 'muted small' }, t('teacher.24')),
            h('button', { class: 'btn danger', onclick: App.resetProgress }, t('teacher.25')),
            h('button', { class: 'btn', onclick: () => { App.setTeacher(false); App.go('#/'); } }, t('teacher.exit')))),
        h('section', { class: 'panel' }, h('h2', null, t('teacher.26')),
          h('div', { class: 'tch-games' }, Games.ORDER.map(id => h('a', { class: 'chip', href: '#/game/' + id }, Games.ICONS[id] + ' ' + t('game.' + id))))),
        h('section', { class: 'panel' }, h('h2', null, t('teacher.27')),
          h('p', null, t('teacher.28'), h('b', { class: 'tch-word' }, CONFIG.questWord), h('span', { class: 'muted small' }, t('teacher.29'))),
          h('p', { class: 'muted' }, t('teacher.30') + Quest.doneCount() + t('teacher.31')),
          h('button', { class: 'btn', onclick: () => { Quest.reset(); FX.toast(t('teacher.questRestarted'), '🗝️'); App.route(); } }, t('teacher.32')))),
      h('section', { class: 'panel' },
        h('h2', null, t('teacher.33')),
        fbox,
        h('div', { class: 'row wrap tch-actions' },
          counter,
          h('button', { class: 'btn small', onclick: () => { filtered().forEach(x => selected.add(x.id)); saveSel(); draw(); } }, t('teacher.34')),
          h('button', { class: 'btn small', onclick: () => { selected.clear(); saveSel(); draw(); } }, t('teacher.35')),
          h('button', { class: 'btn small primary', onclick: () => { if (!selected.size) filtered().forEach(x => selected.add(x.id)); saveSel(); App.go('#/print'); } }, t('teacher.36')),
          h('button', { class: 'btn small', onclick: () => { const f = filtered(); if (f.length) App.go('#/present/' + f[0].id); } }, t('teacher.37'))),
        list));

    function chips(items, key) {
      return h('div', { class: 'chips' }, items.map(([val, label]) =>
        h('button', { class: 'chip' + (filters[key] === val ? ' on' : ''), onclick: () => { filters[key] = val; draw(); } }, label)));
    }

    function draw() {
      fbox.innerHTML = '';
      fbox.append(
        chips([[0, t('teacher.38')]].concat(TOPICS.map(n => [n, n + '. ' + t('topic.' + n)])), 'topic'),
        chips([['all', t('teacher.39')]].concat(Puzzles.ORDER.map(x => [x, Puzzles.ICONS[x] + ' ' + t('type.' + x)])), 'type'),
        chips([[0, t('teacher.40')], [1, '★'], [2, '★★'], [3, '★★★']], 'level'));
      const f = filtered();
      counter.textContent = t('teacher.41') + f.length + t('teacher.42') + selected.size;
      list.innerHTML = '';
      if (!f.length) list.append(h('p', { class: 'muted' }, t('teacher.43')));
      f.forEach(task => {
        const cb = h('input', { type: 'checkbox', checked: selected.has(task.id) || null, 'aria-label': t('teacher.44'), onchange: e => {
          if (e.target.checked) selected.add(task.id); else selected.delete(task.id);
          saveSel();
          counter.textContent = t('teacher.41') + f.length + t('teacher.42') + selected.size;
        } });
        let open = false;
        const detail = h('div', { class: 'tch-detail' });
        const row = h('div', { class: 'tch-row' },
          h('div', { class: 'tch-row-head' },
            cb,
            h('button', { class: 'tch-title', onclick: () => {
              open = !open;
              detail.innerHTML = '';
              if (open) detail.append(h('p', { html: rich(task.story) }), ...TaskView.body(task, 'screen'), h('h4', null, t('teacher.45')), TaskView.answer(task));
              row.classList.toggle('open', open);
            } }, h('b', null, task.title), h('small', null, TaskView.meta(task))),
            h('a', { class: 'btn small ghost', href: '#/present/' + task.id, title: t('teacher.46') }, '📽'),
            h('a', { class: 'btn small ghost', href: '#/task/' + task.id, title: t('teacher.47') }, '▶')),
          detail);
        list.append(row);
      });
    }
    draw();
  }

  // ---------------------------------------------------------------- проектор: одна задача на экран
  function present(v, id) {
    if (!guard()) return;
    const f = filtered();
    const seq = f.some(x => x.id === id) ? f : TASKS;
    const i = seq.findIndex(x => x.id === id);
    const task = seq[i];
    if (!task) { v.append(h('p', null, t('task.notfound'))); return; }
    if (projBefore === null) projBefore = document.documentElement.classList.contains('projector');
    document.documentElement.classList.add('projector');
    v.classList.add('present-view');
    let shown = false;
    const ans = h('div', { class: 'pv-answer', hidden: true }, TaskView.answer(task));
    const btn = h('button', { class: 'btn primary pv-show', onclick: toggle }, t('teacher.48'));
    function toggle() {
      shown = !shown;
      ans.hidden = !shown;
      btn.textContent = shown ? t('teacher.49') : t('teacher.48');
      if (shown) ans.scrollIntoView({ behavior: FX.reduced() ? 'auto' : 'smooth', block: 'nearest' });
    }
    const go = k => { const n = seq[i + k]; if (n) App.go('#/present/' + n.id); };
    v.append(
      h('div', { class: 'pv-bar' },
        h('a', { class: 'btn small', href: '#/teacher' }, t('teacher.50')),
        h('span', { class: 'muted' }, (i + 1) + ' / ' + seq.length + ' · ' + TaskView.meta(task)),
        h('span', { class: 'pv-nav' },
          h('button', { class: 'btn small', disabled: i === 0 || null, onclick: () => go(-1) }, t('teacher.51')),
          h('button', { class: 'btn small', disabled: i === seq.length - 1 || null, onclick: () => go(1) }, t('teacher.52')))),
      h('h1', null, task.title),
      h('p', { class: 'story', html: rich(task.story) }),
      h('div', { class: 'pv-body' }, TaskView.body(task, 'screen')),
      h('div', { class: 'row' }, btn, h('span', { class: 'muted small' }, t('teacher.53'))),
      ans);
    const onKey = e => {
      if (document.querySelector('.modal-back')) return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ' || e.key === 'Enter') { if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') { e.preventDefault(); toggle(); } }
      else if (e.key === 'Escape') App.go('#/teacher');
    };
    document.addEventListener('keydown', onKey);
    App.onLeave(() => {
      document.removeEventListener('keydown', onKey);
      if (location.hash.startsWith('#/present/')) return;
      if (!projBefore) document.documentElement.classList.remove('projector');
      projBefore = null;
    });
  }

  // ---------------------------------------------------------------- печать
  function print(v) {
    if (!guard()) return;
    const tasks = TASKS.filter(x => selected.has(x.id));
    v.classList.add('print-view');
    if (!tasks.length) {
      v.append(h('p', null, t('teacher.54'), h('a', { href: '#/teacher' }, t('teacher.55'))));
      return;
    }
    v.append(
      h('div', { class: 'no-print pr-bar' },
        h('a', { class: 'btn', href: '#/teacher' }, t('teacher.51')),
        h('button', { class: 'btn primary', onclick: () => window.print() }, t('teacher.56')),
        h('span', { class: 'muted' }, t('teacher.57') + tasks.length + t('teacher.58'))),
      h('div', { class: 'pr-sheet' },
        h('div', { class: 'pr-head' }, h('b', null, t('teacher.59')), h('span', null, t('teacher.60'))),
        tasks.map((task, k) => h('article', { class: 'pr-task' },
          h('h3', null, (k + 1) + '. ' + task.title),
          h('p', { class: 'pr-meta' }, TaskView.meta(task)),
          h('p', { html: rich(task.story) }),
          TaskView.body(task, 'print')))),
      h('div', { class: 'pr-sheet pr-answers' },
        h('h2', null, t('teacher.61')),
        tasks.map((task, k) => h('article', { class: 'pr-task' }, h('h3', null, (k + 1) + '. ' + task.title), TaskView.answer(task)))));
  }

  return { render, present, print };
})();
