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

  // Настройки теста: сохранённые учителем на этом устройстве (или полученные по ссылке),
  // иначе — из самого теста (data/exams.js), иначе — из config.js
  function settings(id) {
    let own = {};
    try { own = (JSON.parse(localStorage.getItem(SKEY) || '{}'))[id] || {}; } catch (e) { own = {}; }
    const ex = EXAMS[id], n = ex.questions.length;
    const pick = k => (own[k] !== undefined ? own[k] : ex[k] !== undefined ? ex[k] : cfg()[k]);
    const count = Math.round(Number(pick('count')));
    const time = Math.round(Number(pick('time')));
    return { count: Math.min(n, Math.max(1, count || 1)), time: Math.min(300, Math.max(0, time || 0)) };
  }
  function saveSettings(id, st) {
    try {
      const all = JSON.parse(localStorage.getItem(SKEY) || '{}');
      all[id] = { count: st.count, time: st.time };
      localStorage.setItem(SKEY, JSON.stringify(all));
    } catch (e) { /* без сохранения */ }
  }

  // Подпись ссылки: если ученик изменит в ней число вопросов, время, PIN или адрес для результатов, ссылка перестанет действовать
  function sign(id, count, time, p, pa, r) {
    let x = 5381;
    for (const ch of id + ':' + count + ':' + time + (p ? ':' + p + ':' + pa : '') + (r ? ':' + r : '') + ':' + CONFIG.teacherPin) x = ((x * 33) ^ ch.charCodeAt(0)) >>> 0;
    return x.toString(36);
  }
  // В ссылку попадают настройки теста, новый PIN, если учитель сменил его в режиме учителя,
  // и адрес Google Таблицы для результатов, если он задан в режиме учителя, а не в config.js
  function link(id) {
    const st = settings(id), pin = Pin.current(), r = EXAMS[id].results ? Results.linkUrl() : '';
    const p = pin ? '&p=' + pin.h + '&pa=' + pin.at : '';
    return location.href.split('#')[0] + '#/tests/' + id + '?n=' + st.count + '&t=' + st.time + p + (r ? '&r=' + encodeURIComponent(r) : '') +
      '&k=' + sign(id, st.count, st.time, pin && pin.h, pin && pin.at, r);
  }
  // Ссылка только сохраняет настройки и открывает список тестов — ученик сам нажимает «Начать»
  function applyLink(id, q) {
    const count = +q.get('n'), time = +q.get('t'), p = q.get('p'), pa = q.get('pa'), r = q.get('r');
    if (q.get('k') === sign(id, count, time, p, pa, r)) {
      saveSettings(id, { count, time });
      if (p && Pin.accept(p, +pa)) FX.toast(t('pin.received'), '🔑');
      if (r) Results.setUrl(r);
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
  // Тест с баллами (points в data/exams.js) вместо оценки: доля верных ответов от points, с точностью 0,1
  const pointsOf = (id, right, total) => Math.round(right / total * EXAMS[id].points * 10) / 10;
  const num = x => x.toLocaleString('ru-RU');

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
    return pickIndexes(bank, settings(id).count).map(src => {
      const order = mix([0, 1, 2, 3]);
      return { src, order, answer: order.indexOf(0) };
    });
  }
  const question = (id, item) => EXAMS[id].questions[item.src];

  // Какие вопросы попадут в попытку. Если у вопросов есть темы (topic), берём из всех тем поровну —
  // по очереди по одному из каждой темы, — а потом перемешиваем.
  function pickIndexes(bank, count) {
    const all = mix(bank.map((_, i) => i));
    if (!bank.some(q => q.topic)) return all.slice(0, count);
    const groups = {};
    all.forEach(i => { const tp = bank[i].topic || ''; (groups[tp] = groups[tp] || []).push(i); });
    const queues = mix(Object.values(groups));
    const out = [];
    while (out.length < count && queues.some(g => g.length)) queues.forEach(g => { if (g.length && out.length < count) out.push(g.shift()); });
    return mix(out);
  }

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
    if (finishFn) return finishFn('teacher');
    const a = stored();
    if (!a) return;
    a.forceFinish = true;
    save(a);
    App.go('#/tests/' + a.id);
  }

  const gradeText = g => t('exam.grade' + g);

  // Картинка к вопросу и вариант-картинка с подписью (js/pictures.js)
  const qPic = q => (q.img ? h('div', { class: 'ex-pic', html: Pictures.svg(q.img) }) : null);
  const optNode = (q, text, small) => (q.pics
    ? h('span', { class: 'ex-picopt' + (small ? ' small' : ''), html: Pictures.svg(text) + '<span>' + Highlight.esc(Pictures.label(text)) + '</span>' })
    : h('code', null, text));
  const passedCount = () => Object.keys(EXAMS).filter(id => store()[id]).length;

  // ---------------------------------------------------------------- список тестов
  function list(v) {
    const saved = (() => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; } })();
    const g = cfg().grades;
    v.append(
      h('div', { class: 'page-head' }, h('h1', null, '📝 ' + t('exam.title')),
        h('p', { class: 'lead' }, t('exam.lead2'))),
      Object.keys(EXAMS).some(id => Vis.open('test:' + id)) ? null : h('p', { class: 'empty muted' }, '🙈 ' + t('vis.nothing')),
      h('div', { class: 'ex-cards' }, Object.keys(EXAMS).filter(id => Vis.open('test:' + id)).map(id => {
        const ex = EXAMS[id], rec = store()[id], cont = saved && saved.id === id;
        const meta = h('p', { class: 'ex-meta' }, metaText(id));
        return h('div', { class: 'ex-card' + (Vis.isHidden('test:' + id) ? ' vis-off' : '') },
          h('div', { class: 'ex-card-head' }, h('span', { class: 'ex-icon' }, ex.icon), h('div', null, h('h2', null, ex.title, ex.badge ? h('span', { class: 'ex-badge' }, ex.badge) : null, Vis.mark('test:' + id)), h('p', { class: 'muted' }, ex.subtitle))),
          meta,
          rec
            ? h('div', { class: 'ex-best' }, ex.points ? null : h('span', { class: 'ex-grade small g' + rec.bestGrade }, rec.bestGrade),
              h('span', null, (ex.points ? t('exam.bestPts', { p: num(rec.bestPoints || 0), m: ex.points }) : t('exam.best', { p: rec.best })) + ' · ' + t('exam.attempts', { n: rec.attempts })))
            : h('div', { class: 'ex-best muted' }, t('exam.notyet')),
          h('div', { class: 'row wrap' },
            h('a', { class: 'btn primary', href: '#/tests/' + id }, cont ? '▶ ' + t('exam.continue') : '▶ ' + t('exam.start')),
            App.teacher ? h('a', { class: 'btn small ghost', href: '#/tests/' + id + '/all' }, '👁 ' + t('exam.all')) : null,
            App.teacher ? h('a', { class: 'btn small ghost', href: '#/tests/' + id + '/print' }, '🖨 ' + t('exam.printVariant')) : null,
            App.teacher && ex.results ? h('a', { class: 'btn small ghost', href: '#/results' }, '📊 ' + t('res.title')) : null),
          App.teacher ? settingsPanel(id, meta) : null);
      })),
      h('p', { class: 'muted small' }, t('exam.scale', { a: g[5], b: g[4], c: g[3] })));
  }

  // ---------------------------------------------------------------- прохождение
  function run(v, id, student) {
    if (!EXAMS[id]) return App.go('#/tests');
    if (App.query.has('k')) return applyLink(id, App.query);
    let a = load(id);
    // тест с результатами для учителя: перед началом ученик пишет имя и класс
    if (!a && EXAMS[id].results && !student) return Results.studentForm(v, EXAMS[id], metaText(id), st => { v.innerHTML = ''; run(v, id, st); });
    if (!a) { a = { id, qs: build(id), answers: [], cur: 0, start: Date.now(), exits: 0, limit: settings(id).time, student: student || null }; save(a); }
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
        Lock.watchesExams() ? h('p', { class: 'ex-lock-note' }, '🔒 ' + t('lock.examNote'))
          // учитель видит, почему блокировка не срабатывает, и может проверить её как ученик
          : App.teacher && (CONFIG.lock || 'exam') !== 'off'
            ? h('p', { class: 'ex-lock-note teacher' }, '🎓 ' + t('lock.teacherOff') + ' ',
              h('button', { class: 'btn small', onclick: () => { App.setTeacher(false); App.route(); } }, t('lock.teacherExit')))
            : '');

      map.innerHTML = '';
      a.qs.forEach((_, i) => map.append(h('button', {
        class: 'ex-dot' + (i === a.cur ? ' cur' : '') + (a.answers[i] !== undefined && a.answers[i] !== null ? ' done' : ''),
        'aria-label': t('exam.qn', { n: i + 1, total: N }), onclick: () => goTo(i)
      }, i + 1)));

      const item = a.qs[a.cur], q = question(id, item);
      card.innerHTML = '';
      card.append(...[
        h('div', { class: 'ex-qtext', html: rich(q.q) }),
        qPic(q),
        q.code ? h('div', { html: Highlight.code(q.code) }) : null,
        q.inputs && q.inputs.length ? h('p', { class: 'muted' }, '⌨ ' + t('exam.inputs') + ' ', h('code', null, q.inputs.join(', '))) : null,
        h('div', { class: 'ex-options' + (q.pics ? ' pics' : ''), role: 'radiogroup' }, item.order.map((oi, k) => {
          const text = q.options[oi];
          const isCode = /[()=<>%"'\[\]*]|^-?\d/.test(text) && !/[а-яё]{4,}/i.test(text);
          return h('button', {
            class: 'ex-opt' + (q.pics ? ' pic' : '') + (a.answers[a.cur] === k ? ' sel' : ''), role: 'radio', 'aria-checked': a.answers[a.cur] === k ? 'true' : 'false',
            'aria-label': q.pics ? LET[k] + ') ' + Pictures.label(text) : null,
            onclick: () => choose(k)
          }, h('span', { class: 'ex-let' }, LET[k]),
            q.pics ? optNode(q, text) : h('span', { class: 'ex-otext', html: isCode ? '<code>' + Highlight.esc(text) + '</code>' : Highlight.esc(text) }));
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
      if (expired === 'teacher') a.byTeacher = true;
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
      if (ex.points) rec.bestPoints = Math.max(rec.bestPoints || 0, pointsOf(id, right, N));
      rec.last = { pct, grade: g, at: Date.now(), exits: a.exits || 0 };
      store()[id] = rec;
      Progress.levelDone('exams', id, g - 2, right * 5);
      App.updateScore();
      if (ex.results) a.sending = Results.record(resultRecord(id, a, right, pct, g));
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
    if (a.forceFinish) return finish('teacher');
    if (a.limit && left() <= 0) return finish(true);
    draw();
    if (a.limit) { tick(); timer = setInterval(tick, 1000); }
  }

  // Запись для учителя (js/results.js): кто, когда, сколько верно и по каким темам
  function resultRecord(id, a, right, pct, g) {
    const ex = EXAMS[id], by = {};
    a.qs.forEach((item, i) => {
      const tp = question(id, item).topic || '';
      const o = by[tp] = by[tp] || [0, 0];
      o[1]++;
      if (a.answers[i] === item.answer) o[0]++;
    });
    const order = Object.keys(EXAMS);
    const topics = Object.keys(by).filter(Boolean).sort((x, y) => order.indexOf(x) - order.indexOf(y))
      .map(tp => (EXAMS[tp] ? EXAMS[tp].title : tp) + ' ' + by[tp][0] + '/' + by[tp][1]).join('; ');
    const note = [a.expired ? t('res.noteTime') : '', a.byTeacher ? t('res.noteTeacher') : ''].filter(Boolean).join(', ');
    return {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), at: Date.now(),
      name: a.student ? a.student.name : Progress.state.name || '', cls: a.student ? a.student.cls : '',
      test: id, title: ex.title,
      points: ex.points ? pointsOf(id, right, a.qs.length) : '', maxPoints: ex.points || '',
      right, total: a.qs.length, pct, grade: ex.points ? '' : g, topics,
      minutes: Math.max(1, Math.round((Date.now() - a.start) / 60000)), exits: a.exits || 0, note
    };
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
        ex.points ? h('div', { class: 'ex-grade pts g' + g }, num(pointsOf(id, right, N))) : h('div', { class: 'ex-grade g' + g }, g),
        h('div', null,
          h('h1', null, ex.points ? t('exam.pointsOf', { p: num(pointsOf(id, right, N)), m: ex.points }) : gradeText(g)),
          h('p', { class: 'ex-score' }, t('exam.score', { r: right, n: N, p: pct })),
          h('p', { class: 'muted' }, ex.icon + ' ' + ex.title + ' · ' + (a.student ? a.student.name + ', ' + a.student.cls : Progress.state.name || '') + ' · ' + new Date().toLocaleDateString('ru-RU') + ' · ' + t('exam.time', { m: mins }) + (a.limit ? ' ' + t('exam.of', { m: a.limit }) : '')),
          a.expired ? h('p', { class: 'ex-exits' }, '⏱ ' + t('exam.timeUp')) : null,
          newBest ? h('p', { class: 'tf-record' }, '🏆 ' + t('exam.newBest')) : null,
          a.exits ? h('p', { class: 'ex-exits' }, '⚠ ' + t('lock.exits', { n: a.exits })) : null,
          a.sending ? Results.statusNode(a.sending) : null)),
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
          qPic(q),
          q.code ? h('div', { html: Highlight.code(q.code) }) : null,
          h('ul', { class: 'ex-ans' }, item.order.map((oi, k) => {
            const cls = k === item.answer ? 'right' : k === mine ? 'wrong' : '';
            return h('li', { class: cls }, h('b', null, LET[k] + ') '), optNode(q, q.options[oi], true),
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
        qPic(q),
        q.code ? h('div', { html: Highlight.code(q.code) }) : null,
        h('ul', { class: 'ex-ans' + (q.pics ? ' pics' : '') }, q.options.map((o, k) => h('li', { class: k === 0 ? 'right' : '' }, optNode(q, o, true), k === 0 ? h('span', { class: 'ex-tag' }, ' ✔') : null))),
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
            qPic(q),
            q.code ? h('div', { html: Highlight.code(q.code) }) : null,
            q.inputs && q.inputs.length ? h('p', null, t('exam.inputs') + ' ', h('code', null, q.inputs.join(', '))) : null,
            h('div', { class: 'pr-opts' + (q.pics ? ' pics' : '') }, item.order.map((oi, k) => h('span', null, '☐ ' + LET[k] + ') ', optNode(q, q.options[oi], true)))));
        })),
      h('div', { class: 'pr-sheet pr-answers' },
        h('h2', null, t('exam.key') + ' · ' + ex.title + ' · ' + t('exam.variant', { n: variant })),
        h('p', { class: 'ex-key' }, qs.map((item, i) => (i + 1) + ' — ' + LET[item.answer]).join(',   ')),
        h('p', { class: 'muted' }, ex.points ? t('exam.pointsScale', { m: ex.points }) : t('exam.scale', { a: cfg().grades[5], b: cfg().grades[4], c: cfg().grades[3] }))));
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

  return { list, run, all, printVariant, summary, passedCount, grade, active, noteExit, forceFinish, settings, sign, pickIndexes };
})();
