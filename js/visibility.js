/* Что видят ученики: учитель скрывает разделы, тесты, игры и темы пазлов.
   Ключи: 'section:games', 'test:final', 'game:robot', 'topic:3'. Скрытые ключи — список hidden и время изменения at.
   Ученикам настройки приходят из Google Таблицы учителя (если она подключена, см. js/results.js) или по ссылке учителя.
   Учитель видит всё, а скрытое помечено «скрыто». Это не защита: кто очистит данные браузера, увидит всё. */
const Vis = (function () {
  'use strict';
  const KEY = 'pyquest.vis';
  const SECTIONS = ['puzzles', 'games', 'tests', 'quest', 'achievements'];
  const SECTION_ICON = { puzzles: '🧩', games: '🎮', tests: '📝', quest: '🗝️', achievements: '🏆' };

  function state() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && Array.isArray(s.hidden)) return s; } catch (e) { /* ниже — по умолчанию */ }
    return { hidden: (CONFIG.hidden || []).slice(), at: 0 };
  }
  function store(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* только до перезагрузки */ } }

  const isHidden = key => state().hidden.indexOf(key) >= 0;
  // открыто ли ученику (учителю открыто всё)
  const open = key => App.teacher || !isHidden(key);

  // Можно ли ученику на этот адрес. Станция квеста открывает свою задачу или игру, даже если они скрыты.
  function blocked(path) {
    if (App.teacher) return false;
    const p = path.split('/').filter(Boolean);
    const qa = Progress.state.quest && Progress.state.quest.active;
    const ex = typeof Exam !== 'undefined' && Exam.active();
    const sec = { task: 'puzzles', game: 'games' }[p[0]] || p[0];
    const questItem = qa && (p[0] === 'task' || p[0] === 'game') && qa.id === p[1];
    const ownTest = ex && p[0] === 'tests' && ex.id === p[1];   // начатый тест можно закончить
    if (SECTIONS.indexOf(sec) >= 0 && isHidden('section:' + sec) && !questItem && !ownTest) return true;
    if (p[0] === 'puzzles' && p[1]) return isHidden('topic:' + p[1]);
    if (p[0] === 'task') {
      const task = TASKS.find(x => x.id === p[1]);
      return !!task && isHidden('topic:' + task.topic) && !(qa && qa.id === p[1]);
    }
    if (p[0] === 'game' && p[1]) return isHidden('game:' + p[1]) && !(qa && qa.id === p[1]);
    if (p[0] === 'tests' && p[1]) return isHidden('test:' + p[1]) && !ownTest;
    return false;
  }

  // Меню: скрытые разделы ученик не видит, учитель видит приглушёнными
  function applyNav() {
    $$('.nav a').forEach(a => {
      const off = isHidden('section:' + a.dataset.section);
      a.hidden = off && !App.teacher;
      a.classList.toggle('vis-off', off && App.teacher);
    });
  }

  // Новые настройки: обновить меню, а если ученик сейчас на скрытой странице — отправить на главную
  function changed() {
    applyNav();
    const path = decodeURIComponent(location.hash.replace(/^#/, '')).split('?')[0];
    if (blocked(path)) { FX.toast(t('vis.closed'), '🙈'); App.go('#/'); }
    else if (/^\/?$|^\/(puzzles|games|tests)$/.test(path)) App.route();   // списки перерисовать (без потери работы)
  }

  function accept(s) {
    if (!s || !Array.isArray(s.hidden) || !(+s.at > state().at)) return false;
    store({ hidden: s.hidden.map(String), at: +s.at });
    changed();
    return true;
  }

  // ---------------------------------------------------------------- Google Таблица
  function pull() {
    const u = Results.url();
    if (!u || App.teacher) return Promise.resolve();
    return fetch(u + (u.indexOf('?') < 0 ? '?' : '&') + 'action=visibility', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (j && j.ok) accept(j); }, () => { /* нет интернета — остаются прежние */ });
  }

  // Учитель сохранил: на устройство и в таблицу. Ответ: 'sent' | 'local' | текст ошибки
  async function save(hidden) {
    const s = { hidden: hidden.slice(), at: Date.now() };
    store(s);
    applyNav();
    const u = Results.url(), key = Results.key();
    if (!u || !key) return 'local';
    try {
      await fetch(u, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'visibility', key, hidden: s.hidden, at: s.at }) });
      // ответ на POST не виден — проверяем, что таблица отдаёт уже новые настройки
      const j = await fetch(u + (u.indexOf('?') < 0 ? '?' : '&') + 'action=visibility', { cache: 'no-store' }).then(r => r.json());
      if (j && j.ok && +j.at === s.at) return 'sent';
      // старый скрипт не знает action=visibility и просит ключ
      return t(j && (j.ok || j.error === 'key') ? 'vis.errOldScript' : 'vis.errSheet');
    } catch (e) { return t('vis.errSheet'); }
  }

  // ---------------------------------------------------------------- ссылка для учеников (без Google Таблицы)
  function sign(h, at, r) {
    let x = 5381;
    for (const ch of 'vis:' + h + ':' + at + (r ? ':' + r : '') + ':' + CONFIG.teacherPin) x = ((x * 33) ^ ch.charCodeAt(0)) >>> 0;
    return x.toString(36);
  }
  // В ссылку попадает и адрес Google Таблицы (если он задан в режиме учителя, а не в config.js):
  // открыв её один раз, ученик дальше получает настройки сам и отправляет результаты тестов.
  function link() {
    const s = state(), hs = s.hidden.join(','), r = Results.linkUrl();
    return location.href.split('#')[0] + '#/v?h=' + encodeURIComponent(hs) + '&at=' + s.at +
      (r ? '&r=' + encodeURIComponent(r) : '') + '&k=' + sign(hs, s.at, r);
  }
  function applyLink() {
    const q = App.query, hs = q.get('h') || '', at = +q.get('at'), r = q.get('r');
    if (q.get('k') !== sign(hs, at, r)) FX.toast(t('exam.linkBroken'), '⚠️');
    else {
      if (r) Results.setUrl(r);
      if (accept({ hidden: hs ? hs.split(',') : [], at }) || state().at === at) FX.toast(t('vis.received'), '👁');
      pull();
    }
    App.go('#/');
  }

  // ---------------------------------------------------------------- учитель: панель
  function panel() {
    const hidden = new Set(state().hidden);
    const groups = [
      ['vis.sections', SECTIONS.map(id => ['section:' + id, SECTION_ICON[id] + ' ' + t('nav.' + id)])],
      ['vis.tests', Object.keys(EXAMS).map(id => ['test:' + id, EXAMS[id].icon + ' ' + EXAMS[id].title + (EXAMS[id].badge && EXAMS[id].title.toLowerCase().indexOf(EXAMS[id].badge) < 0 ? ' (' + EXAMS[id].badge + ')' : '')])],
      ['vis.games', Games.ORDER.map(id => ['game:' + id, Games.ICONS[id] + ' ' + t('game.' + id)])],
      ['vis.topics', TOPICS.map(n => ['topic:' + n, n + '. ' + t('topic.' + n)])]
    ];
    const msg = h('p', { class: 'small', 'aria-live': 'polite' });
    const linkBox = h('div', { class: 'ex-link' });
    const boxes = [];
    const saveBtn = h('button', { class: 'btn primary', onclick: () => doSave() }, '💾 ' + t('vis.save'));
    // галочки и «Показать все / Скрыть все» действуют только после «Сохранить»
    function dirty() {
      saveBtn.classList.add('vis-dirty');
      msg.className = 'warn-text small';
      msg.textContent = '⚠ ' + t('vis.unsaved');
      linkBox.innerHTML = '';
    }
    const groupNode = ([title, items]) => {
      const own = items.map(([key, label]) => {
        const cb = h('input', { type: 'checkbox', checked: hidden.has(key) ? null : true, onchange: dirty });
        boxes.push([key, cb]);
        return h('label', { class: 'vis-item' }, cb, h('span', null, label));
      });
      const all = on => () => { own.forEach(l => { l.querySelector('input').checked = on; }); dirty(); };
      return h('fieldset', { class: 'vis-group' },
        h('legend', null, t(title)),
        h('div', { class: 'row wrap vis-quick' },
          h('button', { class: 'btn small ghost', type: 'button', onclick: all(true) }, t('vis.showAll')),
          h('button', { class: 'btn small ghost', type: 'button', onclick: all(false) }, t('vis.hideAll'))),
        h('div', { class: 'vis-items' }, own));
    };
    const doSave = async () => {
      saveBtn.classList.remove('vis-dirty');
      msg.className = 'muted small';
      msg.textContent = '⏳ ' + t('vis.saving');
      linkBox.innerHTML = '';
      const res = await save(boxes.filter(([, cb]) => !cb.checked).map(([key]) => key));
      if (res === 'sent') { msg.className = 'ok-text small'; msg.textContent = '✔ ' + t('vis.sent'); Sound.play('ok'); }
      else {
        msg.className = (res === 'local' ? 'muted' : 'bad-text') + ' small';
        msg.textContent = (res === 'local' ? t('vis.local') : '⚠ ' + res + ' ' + t('vis.useLink'));
        showLink();
      }
    };
    const showLink = () => {
      const url = link();
      const field = h('input', { class: 'input', readonly: true, value: url, 'aria-label': t('vis.link'), onclick: e => e.target.select() });
      linkBox.innerHTML = '';
      linkBox.append(field, h('button', { class: 'btn small', onclick: () => {
        field.select();
        const done = () => FX.toast(t('exam.copied'), '📋');
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => { document.execCommand('copy'); done(); });
        else { document.execCommand('copy'); done(); }
      } }, '📋 ' + t('exam.copy')),
      location.protocol === 'file:' ? h('p', { class: 'bad-text small' }, '⚠ ' + t('exam.linkLocal')) : '');
    };
    const sheetOn = !!(Results.url() && Results.key());
    return h('section', { class: 'panel vis-panel' }, h('h2', null, '👁 ' + t('vis.title')),
      h('p', { class: 'muted small' }, t('vis.lead')),
      h('p', { class: 'vis-status small ' + (sheetOn ? 'ok' : 'warn') }, sheetOn ? '✔ ' + t('vis.howSheet') : '⚠ ' + t('vis.howLink')),
      h('div', { class: 'vis-groups' }, groups.map(groupNode)),
      h('div', { class: 'row wrap' },
        saveBtn,
        h('button', { class: 'btn', onclick: showLink }, '🔗 ' + t('vis.link')),
        h('button', { class: 'btn ghost', onclick: () => { App.setTeacher(false); FX.toast(t('vis.asStudentToast'), '👀'); App.go('#/'); } }, '👀 ' + t('vis.asStudent'))),
      msg, linkBox,
      sheetOn && !configured() ? h('p', { class: 'muted small' }, t('vis.studentsNeedUrl')) : null);
  }

  // адрес таблицы записан в config.js — тогда он есть у всех учеников без ссылок
  const configured = () => !!(CONFIG.results && CONFIG.results.url);

  // Отметка «скрыто» для учителя на карточках
  const mark = key => (App.teacher && isHidden(key) ? h('span', { class: 'vis-tag' }, '🙈 ' + t('vis.hiddenTag')) : null);

  document.addEventListener('DOMContentLoaded', () => {
    applyNav();
    pull();
    setInterval(pull, 60000);
    window.addEventListener('focus', () => pull());
  });

  return { open, isHidden, blocked, applyNav, mark, panel, pull, save, link, applyLink, state };
})();
