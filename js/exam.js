/* Тесты по темам с оценкой 2–5: список, прохождение, результат с разбором,
   а для учителя — все вопросы с ответами и печать бумажного варианта.
   Вопросы — в data/exams.js (первый вариант ответа — верный, в тесте варианты перемешиваются). */
const Exam = (function () {
  'use strict';
  const LET = ['А', 'Б', 'В', 'Г'];
  const KEY = 'pyquest.exam';
  let current = null;    // попытка, открытая на экране
  let finishFn = null;   // завершить открытую попытку (для учителя на экране блокировки)

  const cfg = () => Object.assign({ count: 20, time: 0, grades: { 5: 85, 4: 70, 3: 50 } }, CONFIG.exams || {});
  const SKEY = 'pyquest.examSettings';

  // Настройки теста: сохранённые учителем на этом устройстве (или полученные по ссылке), иначе — из config.js
  function settings(id) {
    let own = {};
    try { own = (JSON.parse(localStorage.getItem(SKEY) || '{}'))[id] || {}; } catch (e) { own = {}; }
    const n = EXAMS[id].questions.length;
    const count = Math.round(Number(own.count !== undefined ? own.count : cfg().count));
    const time = Math.round(Number(own.time !== undefined ? own.time : cfg().time));
    return { count: Math.min(n, Math.max(1, count || 1)), time: Math.min(300, Math.max(0, time || 0)) };
  }
  function saveSettings(id, st) {
    try {
      const all = JSON.parse(localStorage.getItem(SKEY) || '{}');
      all[id] = { count: st.count, time: st.time };
      localStorage.setItem(SKEY, JSON.stringify(all));
    } catch (e) { /* без сохранения */ }
  }

  // Подпись ссылки: если ученик изменит в ней число вопросов или время, ссылка перестанет действовать
  function sign(id, count, time) {
    let x = 5381;
    for (const ch of id + ':' + count + ':' + time + ':' + CONFIG.teacherPin) x = ((x * 33) ^ ch.charCodeAt(0)) >>> 0;
    return x.toString(36);
  }
  function link(id) {
    const st = settings(id);
    return location.href.split('#')[0] + '#/tests/' + id + '?n=' + st.count + '&t=' + st.time + '&k=' + sign(id, st.count, st.time);
  }
  // Ссылка только сохраняет настройки и открывает список тестов — ученик сам нажимает «Начать»
  function applyLink(id, q) {
    const count = +q.get('n'), time = +q.get('t');
    if (q.get('k') === sign(id, count, time)) {
      saveSettings(id, { count, time });
      // начатая, но ещё пустая попытка заменяется попыткой с новыми настройками
      const old = stored();
      if (old && old.id === id && !old.answers.some(x => x !== undefined && x !== null)) clear();
      FX.toast(t('exam.linkApplied', { n: count, m: time ? t('exam.minutes', { m: time }) : t('exam.noLimit') }), '⚙️');
    } else FX.toast(t('exam.linkBroken'), '⚠️');
    App.go('#/tests');
  }
  const fmtTime = st => (st.time ? t('exam.minutes', { m: st.time }) : t('exam.noLimit'));
  const metaText = id => '📋 ' + t('exam.metaQ', { k: settings(id).count, n: EXAMS[id].questions.length }) + ' · ⏱ ' + fmtTime(settings(id));
  const grade = pct => { const g = cfg().grades; return pct >= g[5] ? 5 : pct >= g[4] ? 4 : pct >= g[3] ? 3 : 2; };

  function store() {
    const s = Progress.state;
    if (!s.exams) s.exams = {};
    return s.exams;
  }

  function mix(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // Попытка: случайные вопросы, варианты перемешаны; answer — где теперь верный вариант
  function build(id) {
    const bank = EXAMS[id].questions;
    return mix(bank.map((_, i) => i)).slice(0, settings(id).count).map(src => {
      const order = mix([0, 1, 2, 3]);
      return { src, order, answer: order.indexOf(0) };
    });
  }
  const question = (id, item) => EXAMS[id].questions[item.src];

  // Начатая попытка переживает перезагрузку страницы
  function load(id) {
    try {
      const a = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      return a && a.id === id && a.qs.every(x => EXAMS[id].questions[x.src]) ? a : null;
    } catch (e) { return null; }
  }
  function save(a) { try { sessionStorage.setItem(KEY, JSON.stringify(a)); } catch (e) { /* без сохранения */ } }
  function clear() { try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
  function stored() { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }

  // ---------------------------------------------------------------- для блокировки (js/lock.js)
  // Идёт ли тест (открыт или начат и не завершён)
  const active = () => current || stored();
  // Ученик ушёл с сайта во время теста — запоминаем в попытке
  function noteExit() {
    const a = current || stored();
    if (!a) return;
    a.exits = (a.exits || 0) + 1;
    save(a);
  }
  // Учитель завершает тест с экрана блокировки
  function forceFinish() {
    if (finishFn) return finishFn();
    const a = stored();
    if (!a) return;
    a.forceFinish = true;
    save(a);
    App.go('#/tests/' + a.id);
  }

  const gradeText = g => t('exam.grade' + g);
  const passedCount = () => Object.keys(EXAMS).filter(id => store()[id]).length;

  // ---------------------------------------------------------------- список тестов
  function list(v) {
    const saved = (() => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; } })();
    const g = cfg().grades;
    v.append(
      h('div', { class: 'page-head' }, h('h1', null, '📝 ' + t('exam.title')),
        h('p', { class: 'lead' }, t('exam.lead2'))),
      h('div', { class: 'ex-cards' }, Object.keys(EXAMS).map(id => {
        const ex = EXAMS[id], rec = store()[id], cont = saved && saved.id === id;
        const meta = h('p', { class: 'ex-meta' }, metaText(id));
        return h('div', { class: 'ex-card' },
          h('div', { class: 'ex-card-head' }, h('span', { class: 'ex-icon' }, ex.icon), h('div', null, h('h2', null, ex.title), h('p', { class: 'muted' }, ex.subtitle))),
          meta,
          rec
            ? h('div', { class: 'ex-best' }, h('span', { class: 'ex-grade small g' + rec.bestGrade }, rec.bestGrade),
              h('span', null, t('exam.best', { p: rec.best }) + ' · ' + t('exam.attempts', { n: rec.attempts })))
            : h('div', { class: 'ex-best muted' }, t('exam.notyet')),
          h('div', { class: 'row wrap' },
            h('a', { class: 'btn primary', href: '#/tests/' + id }, cont ? '▶ ' + t('exam.continue') : '▶ ' + t('exam.start')),
            App.teacher ? h('a', { class: 'btn small ghost', href: '#/tests/' + id + '/all' }, '👁 ' + t('exam.all')) : null,
            App.teacher ? h('a', { class: 'btn small ghost', href: '#/tests/' + id + '/print' }, '🖨 ' + t('exam.printVariant')) : null),
          App.teacher ? settingsPanel(id, meta) : null);
      })),
      h('p', { class: 'muted small' }, t('exam.scale', { a: g[5], b: g[4], c: g[3] })));
  }

  // ---------------------------------------------------------------- прохождение
  function run(v, id) {
    if (!EXAMS[id]) return App.go('#/tests');
    if (App.query.has('k')) return applyLink(id, App.query);
    let a = load(id);
    if (!a) { a = { id, qs: build(id), answers: [], cur: 0, start: Date.now(), exits: 0, limit: settings(id).time }; save(a); }
    current = a;
    finishFn = finish;
    const ex = EXAMS[id];
    const N = a.qs.length;
    v.classList.add('exam-view');

    const head = h('div', { class: 'ex-head' });
    // таймер: время считается от начала попытки, поэтому не останавливается при блокировке или перезагрузке
    const timerEl = h('span', { class: 'ex-timer', 'aria-live': 'off' });
    let timer = null;
    const left = () => a.start + a.limit * 60000 - Date.now();
    function tick() {
      const ms = left();
      if (ms <= 0) { FX.toast(t('exam.timeUp'), '⏱'); return finish(true); }
      const s = Math.ceil(ms / 1000);
      timerEl.textContent = '⏱ ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      timerEl.classList.toggle('low', s <= 60);
    }
    const map = h('div', { class: 'ex-map', role: 'navigation', 'aria-label': t('exam.map') });
    const card = h('div', { class: 'ex-q' });
    const foot = h('div', { class: 'ex-foot' });
    v.append(head, map, card, foot);

    function draw() {
      const answered = a.answers.filter(x => x !== undefined && x !== null).length;
      head.innerHTML = '';
      head.append(
        h('a', { class: 'back', href: '#/tests' }, '← ' + t('exam.title')),
        h('div', { class: 'ex-head-row' },
          h('h1', null, ex.icon + ' ' + ex.title),
          h('button', { class: 'btn small', onclick: finishAsk }, '✔ ' + t('exam.finish'))),
        h('div', { class: 'ex-progress' },
          h('span', null, t('exam.qn', { n: a.cur + 1, total: N })),
          h('span', { class: 'muted' }, t('exam.answered', { n: answered, total: N })),
          a.limit ? timerEl : ''),
        h('div', { class: 'bar' }, h('span', { style: { width: (answered / N * 100) + '%' } })),
        Lock.watchesExams() ? h('p', { class: 'ex-lock-note' }, '🔒 ' + t('lock.examNote')) : '');

      map.innerHTML = '';
      a.qs.forEach((_, i) => map.append(h('button', {
        class: 'ex-dot' + (i === a.cur ? ' cur' : '') + (a.answers[i] !== undefined && a.answers[i] !== null ? ' done' : ''),
        'aria-label': t('exam.qn', { n: i + 1, total: N }), onclick: () => goTo(i)
      }, i + 1)));

      const item = a.qs[a.cur], q = question(id, item);
      card.innerHTML = '';
      card.append(...[
        h('div', { class: 'ex-qtext', html: rich(q.q) }),
        q.code ? h('div', { html: Highlight.code(q.code) }) : null,
        q.inputs && q.inputs.length ? h('p', { class: 'muted' }, '⌨ ' + t('exam.inputs') + ' ', h('code', null, q.inputs.join(', '))) : null,
        h('div', { class: 'ex-options', role: 'radiogroup' }, item.order.map((oi, k) => {
          const text = q.options[oi];
          const isCode = /[()=<>%"'\[\]*]|^-?\d/.test(text) && !/[а-яё]{4,}/i.test(text);
          return h('button', {
            class: 'ex-opt' + (a.answers[a.cur] === k ? ' sel' : ''), role: 'radio', 'aria-checked': a.answers[a.cur] === k ? 'true' : 'false',
            onclick: () => choose(k)
          }, h('span', { class: 'ex-let' }, LET[k]), h('span', { class: 'ex-otext', html: isCode ? '<code>' + Highlight.esc(text) + '</code>' : Highlight.esc(text) }));
        }))].filter(Boolean));

      foot.innerHTML = '';
      foot.append(
        h('button', { class: 'btn', disabled: a.cur === 0 || null, onclick: () => goTo(a.cur - 1) }, '← ' + t('exam.prev')),
        a.cur < N - 1
          ? h('button', { class: 'btn primary', onclick: () => goTo(a.cur + 1) }, t('exam.next') + ' →')
          : h('button', { class: 'btn primary', onclick: finishAsk }, '✔ ' + t('exam.finish')));
    }

    function choose(k) {
      if (Lock.isLocked()) return;
      a.answers[a.cur] = k;
      save(a);
      Sound.play('click');
      draw();
    }

    function goTo(i) {
      if (i < 0 || i >= N) return;
      a.cur = i;
      save(a);
      draw();
      window.scrollTo(0, 0);
    }

    function finishAsk() {
      const left = a.qs.filter((_, i) => a.answers[i] === undefined || a.answers[i] === null).length;
      if (!left) return finish();
      App.modal({
        title: t('exam.finishQ'),
        body: h('p', null, t('exam.left', { n: left })),
        actions: [{ label: t('exam.back') }, { label: t('exam.finish'), primary: true, onclick: finish }]
      });
    }

    function finish(expired) {
      clearInterval(timer);
      if (expired === true) a.expired = true;
      clear();
      current = null;
      finishFn = null;
      delete a.forceFinish;
      document.removeEventListener('keydown', onKey);
      const right = a.qs.filter((x, i) => a.answers[i] === x.answer).length;
      const pct = Math.round(right / N * 100);
      const g = grade(pct);
      const rec = store()[id] || { best: 0, bestGrade: 2, attempts: 0 };
      rec.attempts++;
      const record = pct > rec.best || rec.attempts === 1;
      rec.best = Math.max(rec.best, pct);
      rec.bestGrade = Math.max(rec.bestGrade, g);
      rec.last = { pct, grade: g, at: Date.now(), exits: a.exits || 0 };
      store()[id] = rec;
      Progress.levelDone('exams', id, g - 2, right * 5);
      App.updateScore();
      result(v, id, a, right, pct, g, record && rec.attempts > 1);
    }

    function onKey(e) {
      if (Lock.isLocked() || document.querySelector('.modal-back') || e.target.tagName === 'INPUT') return;
      const k = 'АБВГ'.indexOf(e.key.toUpperCase()) >= 0 ? 'АБВГ'.indexOf(e.key.toUpperCase()) : '1234'.indexOf(e.key);
      if (k >= 0) { e.preventDefault(); choose(k); }
      else if (e.key === 'ArrowRight' || (e.key === 'Enter' && e.target.tagName !== 'BUTTON')) { e.preventDefault(); goTo(a.cur + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(a.cur - 1); }
    }
    document.addEventListener('keydown', onKey);
    App.onLeave(() => { document.removeEventListener('keydown', onKey); clearInterval(timer); current = null; finishFn = null; });
    // учитель выбрал «завершить тест» на экране блокировки, когда ученик был на другой странице
    if (a.forceFinish) return finish();
    if (a.limit && left() <= 0) return finish(true);
    draw();
    if (a.limit) { tick(); timer = setInterval(tick, 1000); }
  }

  // ---------------------------------------------------------------- результат и разбор
  function result(v, id, a, right, pct, g, newBest) {
    const ex = EXAMS[id], N = a.qs.length;
    const mins = Math.max(1, Math.round((Date.now() - a.start) / 60000));
    v.innerHTML = '';
    v.classList.add('exam-view');
    Sound.play(g >= 4 ? 'win' : g === 3 ? 'ok' : 'lose');
    if (g === 5) FX.confetti();
    let onlyWrong = false;
    const reviewBox = h('div', { class: 'ex-review' });
    const filterBtn = h('button', { class: 'btn small', onclick: () => { onlyWrong = !onlyWrong; filterBtn.textContent = onlyWrong ? t('exam.showAll') : t('exam.onlyWrong'); review(); } }, t('exam.onlyWrong'));

    v.append(
      h('div', { class: 'ex-result' },
        h('div', { class: 'ex-grade g' + g }, g),
        h('div', null,
          h('h1', null, gradeText(g)),
          h('p', { class: 'ex-score' }, t('exam.score', { r: right, n: N, p: pct })),
          h('p', { class: 'muted' }, ex.icon + ' ' + ex.title + ' · ' + (Progress.state.name || '') + ' · ' + new Date().toLocaleDateString('ru-RU') + ' · ' + t('exam.time', { m: mins }) + (a.limit ? ' ' + t('exam.of', { m: a.limit }) : '')),
          a.expired ? h('p', { class: 'ex-exits' }, '⏱ ' + t('exam.timeUp')) : null,
          newBest ? h('p', { class: 'tf-record' }, '🏆 ' + t('exam.newBest')) : null,
          a.exits ? h('p', { class: 'ex-exits' }, '⚠ ' + t('lock.exits', { n: a.exits })) : null)),
      h('div', { class: 'row wrap no-print' },
        h('button', { class: 'btn primary', onclick: () => { clear(); App.route(); } }, '↺ ' + t('exam.again')),
        h('a', { class: 'btn', href: '#/tests' }, t('exam.toList')),
        h('button', { class: 'btn', onclick: () => window.print() }, '🖨 ' + t('exam.printResult')),
        filterBtn),
      h('h2', null, t('exam.review')),
      reviewBox);

    function review() {
      reviewBox.innerHTML = '';
      a.qs.forEach((item, i) => {
        const q = question(id, item), mine = a.answers[i], ok = mine === item.answer;
        if (onlyWrong && ok) return;
        reviewBox.append(h('article', { class: 'ex-item ' + (ok ? 'ok' : 'bad') },
          h('div', { class: 'ex-item-head' }, h('b', null, (ok ? '✔ ' : '✘ ') + (i + 1) + '.'), h('span', { html: rich(q.q) })),
          q.code ? h('div', { html: Highlight.code(q.code) }) : null,
          h('ul', { class: 'ex-ans' }, item.order.map((oi, k) => {
            const cls = k === item.answer ? 'right' : k === mine ? 'wrong' : '';
            return h('li', { class: cls }, h('b', null, LET[k] + ') '), h('code', null, q.options[oi]),
              k === item.answer ? h('span', { class: 'ex-tag' }, ' ✔ ' + t('exam.correct')) : null,
              k === mine && k !== item.answer ? h('span', { class: 'ex-tag' }, ' ✘ ' + t('exam.yours')) : null);
          })),
          mine === undefined || mine === null ? h('p', { class: 'bad-text' }, t('exam.noAnswer')) : null,
          h('p', { class: 'ex-explain', html: '💡 ' + rich(q.explain) })));
      });
      if (!reviewBox.children.length) reviewBox.append(h('p', { class: 'muted' }, t('exam.noMistakes')));
    }
    review();
    window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------- для учителя
  function teacherGuard() {
    if (App.teacher) return true;
    App.openTeacher();
    App.go('#/tests');
    return false;
  }

  function all(v, id) {
    if (!EXAMS[id] || !teacherGuard()) return;
    const ex = EXAMS[id];
    v.append(
      h('a', { class: 'back no-print', href: '#/tests' }, '← ' + t('exam.title')),
      h('h1', null, ex.icon + ' ' + ex.title + ' — ' + t('exam.allTitle', { n: ex.questions.length })),
      h('div', { class: 'row no-print' }, h('button', { class: 'btn', onclick: () => window.print() }, '🖨 ' + t('exam.printAll'))),
      h('div', { class: 'ex-review' }, ex.questions.map((q, i) => h('article', { class: 'ex-item' },
        h('div', { class: 'ex-item-head' }, h('b', null, (i + 1) + '.'), h('span', { html: rich(q.q) })),
        q.code ? h('div', { html: Highlight.code(q.code) }) : null,
        h('ul', { class: 'ex-ans' }, q.options.map((o, k) => h('li', { class: k === 0 ? 'right' : '' }, h('code', null, o), k === 0 ? h('span', { class: 'ex-tag' }, ' ✔') : null))),
        h('p', { class: 'ex-explain', html: '💡 ' + rich(q.explain) })))));
  }

  // Бумажный вариант: случайные вопросы и отдельный лист с ключом
  function printVariant(v, id) {
    if (!EXAMS[id] || !teacherGuard()) return;
    const ex = EXAMS[id], qs = build(id);
    const variant = 1 + Math.floor(Math.random() * 90);
    v.classList.add('print-view');
    v.append(
      h('div', { class: 'no-print pr-bar' },
        h('a', { class: 'btn', href: '#/tests' }, '← ' + t('exam.title')),
        h('button', { class: 'btn primary', onclick: () => window.print() }, '🖨 ' + t('exam.print')),
        h('button', { class: 'btn', onclick: () => App.route() }, '🎲 ' + t('exam.otherVariant')),
        h('span', { class: 'muted' }, t('exam.printNote'))),
      h('div', { class: 'pr-sheet' },
        h('div', { class: 'pr-head' }, h('b', null, ex.title + ' · ' + t('exam.variant', { n: variant })), h('span', null, t('exam.nameLine'))),
        qs.map((item, i) => {
          const q = question(id, item);
          return h('article', { class: 'pr-task' },
            h('p', null, h('b', null, (i + 1) + '. '), h('span', { html: rich(q.q) })),
            q.code ? h('div', { html: Highlight.code(q.code) }) : null,
            q.inputs && q.inputs.length ? h('p', null, t('exam.inputs') + ' ', h('code', null, q.inputs.join(', '))) : null,
            h('div', { class: 'pr-opts' }, item.order.map((oi, k) => h('span', null, '☐ ' + LET[k] + ') ', h('code', null, q.options[oi])))));
        })),
      h('div', { class: 'pr-sheet pr-answers' },
        h('h2', null, t('exam.key') + ' · ' + ex.title + ' · ' + t('exam.variant', { n: variant })),
        h('p', { class: 'ex-key' }, qs.map((item, i) => (i + 1) + ' — ' + LET[item.answer]).join(',   ')),
        h('p', { class: 'muted' }, t('exam.scale', { a: cfg().grades[5], b: cfg().grades[4], c: cfg().grades[3] }))));
  }

  // для страницы достижений
  function summary() {
    return Object.keys(EXAMS).map(id => ({ id, title: EXAMS[id].title, icon: EXAMS[id].icon, rec: store()[id] || null }));
  }

  // ---------------------------------------------------------------- настройки теста (для учителя)
  function settingsPanel(id, meta) {
    const st = settings(id), n = EXAMS[id].questions.length;
    const count = h('input', { type: 'number', class: 'input', min: '1', max: String(n), value: String(st.count), 'aria-label': t('exam.setCount') });
    const time = h('input', { type: 'number', class: 'input', min: '0', max: '300', value: String(st.time), 'aria-label': t('exam.setTime') });
    const linkBox = h('div', { class: 'ex-link' });
    const presets = (inp, vals) => h('div', { class: 'chips' }, vals.map(v => h('button', { class: 'chip', type: 'button', onclick: () => { inp.value = v; } }, v === 0 ? t('exam.noLimitShort') : String(v))));
    // сохранить и обновить надпись на карточке (без перерисовки страницы — чтобы не пропала ссылка)
    const apply = () => {
      const c = Math.min(n, Math.max(1, Math.round(+count.value) || 1));
      const m = Math.min(300, Math.max(0, Math.round(+time.value) || 0));
      count.value = c;
      time.value = m;
      saveSettings(id, { count: c, time: m });
      meta.textContent = metaText(id);
      FX.toast(t('exam.saved'), '⚙️');
    };
    const showLink = () => {
      apply();
      const url = link(id);
      const field = h('input', { class: 'input', readonly: true, value: url, 'aria-label': t('exam.link'), onclick: e => e.target.select() });
      linkBox.innerHTML = '';
      linkBox.append(field, h('button', { class: 'btn small', onclick: () => {
        field.select();
        const done = () => FX.toast(t('exam.copied'), '📋');
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => { document.execCommand('copy'); done(); });
        else { document.execCommand('copy'); done(); }
      } }, '📋 ' + t('exam.copy')), h('p', { class: 'muted small' }, t('exam.linkNote')),
        // сайт открыт с диска: такая ссылка работает только на этом компьютере
        location.protocol === 'file:' ? h('p', { class: 'bad-text small' }, '⚠ ' + t('exam.linkLocal')) : '');
    };
    return h('details', { class: 'ex-settings' },
      h('summary', null, '⚙️ ' + t('exam.settings')),
      h('label', null, t('exam.setCount') + ' (1–' + n + ')', count), presets(count, [10, 15, 20, 30, n]),
      h('label', null, t('exam.setTime'), time), presets(time, [0, 10, 15, 20, 30, 45]),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn small primary', onclick: apply }, '💾 ' + t('exam.save')),
        h('button', { class: 'btn small', onclick: showLink }, '🔗 ' + t('exam.link'))),
      linkBox);
  }

  return { list, run, all, printVariant, summary, passedCount, grade, active, noteExit, forceFinish, settings, sign };
})();
