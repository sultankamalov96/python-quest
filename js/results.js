/* Результаты тестов для учителя (тесты с results: true в data/exams.js).
   Сайт статический, поэтому результаты собираются в Google Таблице учителя: в таблицу добавляется
   скрипт (SCRIPT ниже), он принимает результаты от учеников и отдаёт их учителю по секретному ключу.
   Адрес скрипта — CONFIG.results.url или сохранённый учителем в режиме учителя (уходит ученикам в ссылке на тест).
   Каждый результат сначала пишется в журнал на устройстве и в очередь отправки: без интернета он уйдёт позже. */
const Results = (function () {
  'use strict';
  const K = { url: 'pyquest.resultsUrl', key: 'pyquest.resultsKey', journal: 'pyquest.results', outbox: 'pyquest.outbox', cls: 'pyquest.class' };
  let flushing = null;

  const read = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* только в памяти */ } };

  // ---------------------------------------------------------------- адрес и ключ
  // Принимаем только адрес веб-приложения Google Apps Script — чтобы результаты не ушли на чужой сайт
  // Нужен именно URL веб-приложения: https://script.google.com/macros/s/…/exec
  // (у школьного аккаунта Google Workspace — https://script.google.com/a/macros/домен/s/…/exec)
  const validUrl = u => /^https:\/\/script\.google\.com\/(a\/macros\/[\w.\-]+|macros)\/s\/[\w\-]{20,}\/exec$/.test(String(u || '').trim());
  // Почему адрес не подходит — чтобы учитель понял, что скопировал не то
  function urlProblem(u) {
    u = String(u || '').trim();
    if (/\/dev$/.test(u)) return t('res.errUrlDev');
    if (/script\.google\.com\/(home|d\/)/.test(u)) return t('res.errUrlEditor');
    if (/docs\.google\.com\/spreadsheets/.test(u)) return t('res.errUrlSheet');
    return t('res.errUrl');
  }
  const configUrl = () => (typeof CONFIG !== 'undefined' && CONFIG.results && CONFIG.results.url) || '';
  const url = () => read(K.url, '') || configUrl();
  function setUrl(u) {
    u = String(u || '').trim();
    if (u && !validUrl(u)) return false;
    if (!u || u === configUrl()) { try { localStorage.removeItem(K.url); } catch (e) { /* ignore */ } } else write(K.url, u);
    if (u) flush();
    return true;
  }
  // для ссылки на тест: адрес, если он не тот, что в config.js
  const linkUrl = () => { const u = read(K.url, ''); return u && u !== configUrl() ? u : ''; };
  const key = () => read(K.key, '');
  const setKey = k => write(K.key, String(k || '').trim());
  const newKey = () => Array.from({ length: 12 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');

  // ---------------------------------------------------------------- отправка
  const journal = () => read(K.journal, []);
  const outbox = () => read(K.outbox, []);
  const pending = () => outbox().length;

  // Результат теста: в журнал устройства и в очередь отправки. Ответ: 'sent' | 'queued' | 'local'
  function record(rec) {
    write(K.journal, journal().concat(rec).slice(-1000));
    if (!url()) return Promise.resolve('local');
    write(K.outbox, outbox().concat(rec));
    return flush().then(() => (outbox().some(x => x.id === rec.id) ? 'queued' : 'sent'));
  }

  // Ответ скрипта Google браузер не показывает (mode: 'no-cors'), поэтому повторная отправка безопасна:
  // скрипт не добавляет результат с тем же id второй раз.
  function flush() {
    if (flushing) return flushing;
    if (!url() || !pending()) return Promise.resolve();
    flushing = (async () => {
      for (const rec of outbox()) {
        try {
          await fetch(url(), { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(rec) });
          write(K.outbox, outbox().filter(x => x.id !== rec.id));
        } catch (e) { break; }   // нет интернета — попробуем позже
      }
    })().finally(() => { flushing = null; });
    return flushing;
  }

  // Для учителя: все результаты из таблицы
  async function fetchAll() {
    if (!url()) throw new Error(t('res.errNoUrl'));
    if (!key()) throw new Error(t('res.errNoKey'));
    let j;
    try {
      const r = await fetch(url() + (url().indexOf('?') < 0 ? '?' : '&') + 'key=' + encodeURIComponent(key()), { cache: 'no-store' });
      j = await r.json();
    } catch (e) {
      // Google отвечает, но не результатами (обычно — страницей входа): значит, у веб-приложения закрыт доступ
      if (/\/a\/macros\//.test(url())) throw new Error(t('res.errDomain'));
      const reachable = await fetch(url(), { mode: 'no-cors', cache: 'no-store' }).then(() => true, () => false);
      throw new Error(t(reachable ? 'res.errAccess' : 'res.errNet'));
    }
    if (!j || !j.ok) throw new Error(j && j.error === 'key' ? t('res.errKey') : t('res.errAccess'));
    return j;
  }

  // ---------------------------------------------------------------- ученик: имя и класс перед тестом
  function studentForm(v, ex, meta, start) {
    v.classList.add('exam-view');
    const name = h('input', { class: 'input', autocomplete: 'off', maxlength: '60', placeholder: t('res.namePh'), 'aria-label': t('res.name') });
    const cls = h('input', { class: 'input', autocomplete: 'off', maxlength: '10', placeholder: t('res.classPh'), 'aria-label': t('res.class'), value: read(K.cls, '') });
    const msg = h('p', { class: 'bad-text small', 'aria-live': 'polite' });
    const go = () => {
      const n = name.value.trim().replace(/\s+/g, ' '), c = cls.value.trim().toUpperCase().replace(/\s+/g, '');
      if (n.replace(/[^a-zа-яёөүң]/gi, '').length < 3) { msg.textContent = t('res.errName'); FX.shake(name); name.focus(); return; }
      if (!c) { msg.textContent = t('res.errClass'); FX.shake(cls); cls.focus(); return; }
      write(K.cls, c);
      start({ name: n, cls: c });
    };
    [name, cls].forEach(f => f.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }));
    v.append(
      h('a', { class: 'back', href: '#/tests' }, '← ' + t('exam.title')),
      h('section', { class: 'panel res-student' },
        h('h1', null, ex.icon + ' ' + ex.title),
        h('p', { class: 'ex-meta' }, meta),
        h('label', null, t('res.name'), name),
        h('label', null, t('res.class'), cls),
        msg,
        h('button', { class: 'btn primary', onclick: go }, '▶ ' + t('exam.start')),
        h('p', { class: 'muted small' }, '📤 ' + t(url() ? 'res.studentNote' : 'res.studentNoteLocal'))));
    setTimeout(() => name.focus(), 50);
  }

  // Строка на странице результата: отправлен ли результат учителю
  function statusNode(promise) {
    const el = h('p', { class: 'res-send muted' }, '⏳ ' + t('res.sending'));
    const show = st => {
      el.className = 'res-send ' + (st === 'sent' ? 'ok-text' : 'muted');
      el.textContent = st === 'sent' ? '📤 ' + t('res.sent') : st === 'queued' ? '⏳ ' + t('res.queued') : '💾 ' + t('res.local');
    };
    promise.then(show, () => show('queued'));
    return el;
  }

  // ---------------------------------------------------------------- учитель: настройки
  function panel() {
    const urlIn = h('input', { class: 'input', value: url(), placeholder: 'https://script.google.com/macros/s/…/exec', 'aria-label': t('res.url') });
    const keyIn = h('input', { class: 'input', value: key(), autocomplete: 'off', 'aria-label': t('res.key') });
    const msg = h('p', { class: 'small', 'aria-live': 'polite' });
    const statusEl = h('p', { class: 'muted small' }, url() ? t('res.statusOn') : t('res.statusOff'));
    const say = (ok, text) => { msg.className = (ok ? 'ok-text' : 'bad-text') + ' small'; msg.textContent = text; };
    const save = () => {
      if (!keyIn.value.trim()) keyIn.value = newKey();
      setKey(keyIn.value);
      if (!setUrl(urlIn.value)) { say(false, urlProblem(urlIn.value)); FX.shake(urlIn); return false; }
      say(true, t('res.savedSettings'));
      statusEl.textContent = url() ? t('res.statusOn') : t('res.statusOff');
      return true;
    };
    const check = async () => {
      if (!save()) return;
      say(true, '⏳ ' + t('res.checking'));
      try { const j = await fetchAll(); say(true, '✔ ' + t('res.checkOk', { n: j.rows.length })); Sound.play('ok'); }
      catch (e) { say(false, e.message); Sound.play('bad'); }
    };
    const copyScript = () => {
      if (!keyIn.value.trim()) keyIn.value = newKey();
      setKey(keyIn.value);
      const text = SCRIPT.replace('__KEY__', key().replace(/[\\']/g, ''));
      const done = () => FX.toast(t('res.scriptCopied'), '📋');
      const fallback = () => { const ta = h('textarea', { class: 'input' }); ta.value = text; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    };
    return h('section', { class: 'panel res-panel' }, h('h2', null, '📊 ' + t('res.title')),
      h('div', { class: 'tch-col' },
        statusEl,
        h('a', { class: 'btn primary', href: '#/results' }, '📊 ' + t('res.open')),
        h('details', { class: 'ex-settings' },
          h('summary', null, '⚙️ ' + t('res.setup')),
          h('ol', { class: 'res-steps small' },
            h('li', null, t('res.step1')),
            h('li', null, t('res.step2'), ' ', h('button', { class: 'btn small', onclick: copyScript }, '📋 ' + t('res.copyScript'))),
            h('li', null, t('res.step3')),
            h('li', null, t('res.step4')),
            h('li', null, t('res.step5'))),
          h('label', null, t('res.key'), keyIn),
          h('label', null, t('res.url'), urlIn),
          h('div', { class: 'row wrap' },
            h('button', { class: 'btn small primary', onclick: save }, '💾 ' + t('exam.save')),
            h('button', { class: 'btn small', onclick: check }, '🔌 ' + t('res.check'))),
          msg,
          h('p', { class: 'muted small' }, t('res.linkNote')))));
  }

  // ---------------------------------------------------------------- учитель: таблица результатов
  const F = { test: '', cls: '', q: '' };
  function page(v) {
    if (!App.teacher) { App.openTeacher(); return App.go('#/tests'); }
    const status = h('p', { class: 'muted' });
    const box = h('div');
    let rows = [], sheet = '';
    v.append(
      h('a', { class: 'back no-print', href: '#/teacher' }, '← ' + t('res.toTeacher')),
      h('div', { class: 'page-head' }, h('h1', null, '📊 ' + t('res.title')), status),
      box);

    const hasPoints = r => r.maxPoints !== '' && r.maxPoints !== undefined && r.maxPoints !== null && +r.maxPoints > 0;
    const num = x => x.toLocaleString('ru-RU');
    const fmt = ms => { const d = new Date(ms); return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); };
    const out = new Set(outbox().map(x => x.id));
    const filtered = () => rows.filter(r => (!F.test || r.title === F.test) && (!F.cls || r.cls === F.cls) && (!F.q || String(r.name).toLowerCase().indexOf(F.q.toLowerCase()) >= 0));

    async function load() {
      status.textContent = '⏳ ' + t('res.loading');
      const local = journal().map(r => Object.assign({ local: true }, r));
      let remote = [], err = '';
      if (url() && key()) {
        try { const j = await fetchAll(); remote = j.rows; sheet = j.sheet || ''; } catch (e) { err = e.message; }
      }
      const seen = new Set(remote.map(r => r.id));
      rows = remote.concat(local.filter(r => !seen.has(r.id))).sort((a, b) => b.at - a.at);
      status.textContent = err ? '⚠ ' + err + ' ' + t('res.onlyLocal')
        : url() && key() ? t('res.fromSheet', { n: remote.length }) : t('res.onlyLocalSetup');
      status.className = err ? 'bad-text' : 'muted';
      draw();
    }

    function draw() {
      const opts = (vals, all) => [h('option', { value: '' }, all)].concat(vals.map(x => h('option', { value: x }, x)));
      const uniq = f => Array.from(new Set(rows.map(f).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'ru', { numeric: true }));
      const sel = (key, vals, all) => {
        const s = h('select', { class: 'input', 'aria-label': all, onchange: e => { F[key] = e.target.value; draw(); } }, opts(vals, all));
        s.value = F[key];
        return s;
      };
      const search = h('input', { class: 'input', type: 'search', placeholder: t('res.search'), value: F.q, 'aria-label': t('res.search') });
      search.addEventListener('input', () => { F.q = search.value; drawTable(); });
      const tableBox = h('div', { class: 'res-table-wrap' });
      const summary = h('p', { class: 'res-summary' });

      function drawTable() {
        const list = filtered();
        // тесты с баллами — средний балл, тесты с оценкой — средняя оценка и сколько каких оценок
        const pts = list.filter(r => hasPoints(r)), grd = list.filter(r => !hasPoints(r) && +r.grade);
        const avg = (rs, f) => num(Math.round(rs.reduce((s, r) => s + f(r), 0) / rs.length * 10) / 10);
        const maxes = Array.from(new Set(pts.map(r => +r.maxPoints)));
        summary.innerHTML = '';
        summary.append(t('res.count', { n: list.length }),
          pts.length ? ' · ' + t('res.avgPts', { a: avg(pts, r => +r.points), m: maxes.length === 1 ? maxes[0] : '…' }) : '',
          grd.length ? ' · ' + t('res.avg', { a: avg(grd, r => +r.grade) }) + ' · ' : '',
          ...(grd.length ? [5, 4, 3, 2].map(g => h('span', { class: 'res-g g' + g }, g + ': ' + grd.filter(r => +r.grade === g).length)) : []));
        tableBox.innerHTML = '';
        if (!list.length) { tableBox.append(h('p', { class: 'muted res-empty' }, t('res.empty'))); return; }
        tableBox.append(h('table', { class: 'res-table' },
          h('thead', null, h('tr', null, ['res.colDate', 'res.colName', 'res.colClass', 'res.colTest', 'res.colGrade', 'res.colScore', 'res.colTopics', 'res.colTime', 'res.colExits'].map(k => h('th', null, t(k))))),
          h('tbody', null, list.map(r => h('tr', null,
            h('td', { class: 'nowrap' }, fmt(r.at), r.local ? h('span', { title: out.has(r.id) ? t('res.notSent') : t('res.localOnly') }, out.has(r.id) ? ' ⏳' : ' 📱') : null),
            h('td', null, h('b', null, r.name)),
            h('td', null, r.cls),
            h('td', null, r.title),
            h('td', { class: 'nowrap' }, hasPoints(r)
              ? h('span', { class: 'ex-grade small pts g' + Exam.grade(+r.pct) }, num(+r.points) + ' / ' + r.maxPoints)
              : h('span', { class: 'ex-grade small g' + r.grade }, r.grade)),
            h('td', { class: 'nowrap' }, r.right + '/' + r.total + ' (' + r.pct + '%)'),
            h('td', { class: 'small' }, r.topics),
            h('td', { class: 'nowrap' }, t('exam.minutes', { m: r.minutes })),
            h('td', null, +r.exits ? h('span', { class: 'bad-text' }, '⚠ ' + r.exits) : '0', r.note ? h('div', { class: 'small muted' }, r.note) : null))))));
      }

      box.innerHTML = '';
      box.append(
        h('div', { class: 'row wrap res-bar no-print' },
          sel('test', uniq(r => r.title), t('res.allTests')),
          sel('cls', uniq(r => r.cls), t('res.allClasses')),
          search),
        h('div', { class: 'row wrap no-print' },
          h('button', { class: 'btn small', onclick: load }, '↻ ' + t('res.reload')),
          h('button', { class: 'btn small', onclick: () => csv() }, '⬇ ' + t('res.csv')),
          h('button', { class: 'btn small', onclick: () => window.print() }, '🖨 ' + t('exam.print')),
          sheet ? h('a', { class: 'btn small', href: sheet, target: '_blank', rel: 'noopener' }, '📗 ' + t('res.sheet')) : null),
        summary, tableBox);
      drawTable();
    }

    // Таблица для Excel: точка с запятой и BOM, чтобы русские буквы открылись правильно
    function csv() {
      const list = filtered();
      const cell = x => { let s = String(x === undefined || x === null ? '' : x); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
      const head = ['res.colDate', 'res.colName', 'res.colClass', 'res.colTest', 'res.colPoints', 'res.colMax', 'res.colGradeOnly', 'res.colRight', 'res.colTotal', 'res.colPct', 'res.colTopics', 'res.colTime', 'res.colExits', 'res.colNote'].map(k => t(k));
      const lines = [head].concat(list.map(r => [fmt(r.at), r.name, r.cls, r.title, hasPoints(r) ? num(+r.points) : '', hasPoints(r) ? r.maxPoints : '', hasPoints(r) ? '' : r.grade, r.right, r.total, r.pct, r.topics, r.minutes, r.exits, r.note]));
      const blob = new Blob(['﻿' + lines.map(l => l.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const a = h('a', { href: URL.createObjectURL(blob), download: 'результаты-' + new Date().toISOString().slice(0, 10) + '.csv' });
      document.body.append(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }

    load();
  }

  // ---------------------------------------------------------------- скрипт для Google Таблицы
  // Учитель копирует его в режиме учителя (ключ подставляется сам) и вставляет в Расширения → Apps Script.
  const SCRIPT = `// Python-квест: результаты тестов приходят в эту таблицу (лист «Результаты»).
// Ключ учителя: нужен, чтобы смотреть результаты на сайте. Ученики его не знают.
const KEY = '__KEY__';
const SHEET = 'Результаты';
const HEAD = ['Дата', 'Ученик', 'Класс', 'Тест', 'Баллы', 'Из', 'Верно', 'Всего', 'Процент', 'Оценка', 'По темам', 'Минут', 'Уходов с сайта', 'Примечание', 'id', 'Код теста'];
const ID = 15;   // столбец id

// Эту функцию можно запустить кнопкой «Выполнить»: она создаст лист «Результаты» и попросит разрешения Google.
// doPost и doGet вручную запускать не нужно — их вызывает сайт.
function setup() {
  table();
  Logger.log('Готово: лист «' + SHEET + '» создан. Теперь сделайте развёртывание как веб-приложение.');
}

// Ученик закончил тест — сайт присылает результат
function doPost(e) {
  if (!e || !e.postData) return reply({ ok: false, error: 'Эту функцию вызывает сайт. Для проверки запустите setup.' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const r = JSON.parse(e.postData.contents);
    if (!r || !r.id) return reply({ ok: false, error: 'data' });
    const sh = table();
    const n = sh.getLastRow() - 1;
    const ids = n > 0 ? sh.getRange(2, ID, n, 1).getValues().map(x => String(x[0])) : [];
    // тот же результат мог прийти второй раз (повторная отправка) — не дублируем
    if (ids.indexOf(String(r.id)) < 0) {
      sh.appendRow([new Date(Number(r.at) || Date.now()), text(r.name, 80), text(r.cls, 20), text(r.title, 100),
        opt(r.points), opt(r.maxPoints), num(r.right), num(r.total), num(r.pct), opt(r.grade), text(r.topics, 300),
        num(r.minutes), num(r.exits), text(r.note, 100), text(r.id, 40), text(r.test, 40)]);
    }
    return reply({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

// Учитель открыл результаты на сайте — отдаём их, только если ключ верный
function doGet(e) {
  if (!e || !e.parameter || !e.parameter.key || e.parameter.key !== KEY) return reply({ ok: false, error: 'key' });
  const sh = table();
  const n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, n, HEAD.length).getValues() : [];
  return reply({ ok: true, sheet: SpreadsheetApp.getActiveSpreadsheet().getUrl(), rows: rows.map(r => ({
    at: r[0] instanceof Date ? r[0].getTime() : Number(r[0]) || 0, name: String(r[1]), cls: String(r[2]), title: String(r[3]),
    points: r[4], maxPoints: r[5], right: r[6], total: r[7], pct: r[8], grade: r[9], topics: String(r[10]), minutes: r[11],
    exits: r[12], note: String(r[13]), id: String(r[14]), test: String(r[15]) })) });
}

function table() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  // лист от прошлой версии скрипта (другие столбцы) — откладываем его, чтобы данные не перепутались
  if (sh && sh.getLastRow() > 0 && sh.getRange(1, 1, 1, HEAD.length).getValues()[0].join('|') !== HEAD.join('|')) {
    sh.setName(SHEET + ' (старый ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM HH:mm') + ')');
    sh = null;
  }
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(HEAD);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEAD.length).setFontWeight('bold');
  }
  return sh;
}

// текст из сайта не должен стать формулой в таблице
function text(v, max) {
  const s = String(v === undefined || v === null ? '' : v).slice(0, max);
  return /^[=+\\-@]/.test(s) ? "'" + s : s;
}
function num(v) { return Number(v) || 0; }
function opt(v) { return v === '' || v === undefined || v === null ? '' : Number(v) || 0; }
function reply(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
`;

  document.addEventListener('DOMContentLoaded', () => { flush(); setInterval(flush, 120000); });
  window.addEventListener('online', () => flush());

  return { record, flush, pending, url, setUrl, validUrl, linkUrl, key, setKey, studentForm, statusNode, panel, page, SCRIPT };
})();
