/* Режим «Квест»: 8 станций (пазлы, мини-раунды и уровни игр вперемешку).
   Каждая пройденная станция открывает часть кодового слова из data/config.js. */
const Quest = (function () {
  'use strict';
  const STATIONS = [
    { icon: '🖨️', title: t('type.output'), kind: 'task', pick: x => x.type === 'output' && x.topic <= 2 },
    { icon: '⚖️', title: t('quest.1'), kind: 'tf' },
    { icon: '🤖', title: t('quest.2'), kind: 'game', game: 'robot', level: 5 },
    { icon: '🐞', title: t('type.bug'), kind: 'task', pick: x => x.type === 'bug' },
    { icon: '🔢', title: t('quest.3'), kind: 'count' },
    { icon: '🐢', title: t('quest.4'), kind: 'game', game: 'turtle', level: 3 },
    { icon: '🧩', title: t('type.parsons'), kind: 'task', pick: x => (x.type === 'parsons' || x.type === 'flow') && x.topic >= 5 && x.topic <= 8 },
    { icon: '💣', title: t('quest.5'), kind: 'game', game: 'minesweeper', level: 4 }
  ];

  function st() {
    const s = Progress.state;
    if (!s.quest) s.quest = {};
    s.quest.done = s.quest.done || [];
    s.quest.tasks = s.quest.tasks || {};
    return s.quest;
  }

  // Буквы слова делятся между 8 станциями (если букв не 8 — поровну)
  function chunk(i) {
    const w = Array.from(String(CONFIG.questWord));
    return w.slice(Math.floor(i * w.length / 8), Math.floor((i + 1) * w.length / 8)).join('');
  }
  const isDone = i => st().done.includes(i);
  const doneCount = () => st().done.length;
  const openLetters = () => st().done.reduce((a, i) => a + Array.from(chunk(i)).length, 0);
  const unlocked = i => App.teacher || i === 0 || isDone(i - 1);

  function taskFor(i) {
    const q = st();
    if (q.tasks[i] && TASKS.some(x => x.id === q.tasks[i])) return q.tasks[i];
    const pool = TASKS.filter(STATIONS[i].pick);
    const fresh = pool.filter(x => !Progress.state.tasks[x.id]);
    const pickFrom = fresh.length ? fresh : pool;
    q.tasks[i] = pickFrom[Math.floor(Math.random() * pickFrom.length)].id;
    Progress.save();
    return q.tasks[i];
  }

  function start(i) {
    if (!unlocked(i)) return;
    const S = STATIONS[i];
    const q = st();
    if (S.kind === 'task') { q.active = { i, kind: 'task', id: taskFor(i) }; Progress.save(); App.go('#/task/' + q.active.id); }
    else if (S.kind === 'game') { q.active = { i, kind: 'game', id: S.game, level: S.level }; Progress.save(); App.go('#/game/' + S.game + '/' + S.level); }
    else { q.active = { i, kind: S.kind }; Progress.save(); App.go('#/quest/' + i); }
  }

  function complete(i) {
    const q = st();
    q.active = null;
    if (!isDone(i)) Progress.questDone(i);
    else Progress.save();
    FX.toast(t('quest.stationN') + (i + 1) + t('quest.6') + chunk(i) + '»', '🗝️');
    if (doneCount() === 8 && !Progress.state.stats.questDone) Progress.bump('questDone');
    const b = document.querySelector('.quest-banner');
    if (b) {
      b.classList.add('done');
      b.innerHTML = '';
      b.append(h('span', null, t('quest.7') + (i + 1) + t('quest.8'), h('b', null, '«' + chunk(i) + '»')),
        h('a', { class: 'btn small primary', href: '#/quest' }, i < 7 ? t('quest.9') : t('quest.10')));
    }
  }

  function onTaskSolved(id) {
    const a = st().active;
    if (a && a.kind === 'task' && a.id === id) complete(a.i);
  }

  function onLevelDone(game, level) {
    const a = st().active;
    if (a && a.kind === 'game' && a.id === game && a.level === level) complete(a.i);
  }

  function banner(kind, id, level) {
    const a = st().active;
    if (!a || a.kind !== kind || a.id !== id || (kind === 'game' && a.level !== level)) return null;
    return h('div', { class: 'quest-banner' },
      h('span', null, t('quest.11') + (a.i + 1) + ': ' + STATIONS[a.i].title + t('quest.12')),
      h('a', { class: 'btn small', href: '#/quest' }, t('quest.13')));
  }

  function reset() {
    const q = st();
    q.done = [];
    q.tasks = {};
    q.active = null;
    Progress.save();
  }

  // ---------------------------------------------------------------- страница квеста
  function render(v) {
    const all = doneCount() === 8;
    v.append(...[
      h('div', { class: 'page-head' }, h('h1', null, t('teacher.27')), h('p', { class: 'lead' }, t('quest.14'))),
      h('div', { class: 'quest-word' + (all ? ' complete' : '') }, STATIONS.map((_, i) =>
        Array.from(chunk(i)).map(ch => h('span', { class: 'letter' + (isDone(i) ? ' open' : '') }, isDone(i) ? ch : '?')))),
      all ? h('div', { class: 'quest-final' }, h('h2', null, t('quest.15')), h('p', null, t('quest.16'), h('b', null, CONFIG.questWord))) : null,
      h('div', { class: 'quest-stations' }, STATIONS.map((S, i) => {
        const done = isDone(i), open = unlocked(i);
        return h('div', { class: 'quest-st' + (done ? ' done' : '') + (open ? '' : ' locked') },
          h('span', { class: 'quest-n' }, done ? '✔' : open ? i + 1 : '🔒'),
          h('span', { class: 'quest-icon' }, S.icon),
          h('span', { class: 'quest-title' }, h('b', null, t('quest.17') + (i + 1)), h('small', null, S.title)),
          h('span', { class: 'quest-letter' }, done ? chunk(i) : '?'),
          open ? h('button', { class: 'btn small' + (done ? '' : ' primary'), onclick: () => start(i) }, done ? t('game.playagain') : t('quest.start')) : h('span', { class: 'muted small' }, t('quest.locked')));
      })),
      h('div', { class: 'row' }, h('button', { class: 'btn ghost small', onclick: () => { reset(); App.route(); } }, t('teacher.32')))].filter(Boolean));
    if (all) FX.confetti();
  }

  // ---------------------------------------------------------------- мини-раунды
  function station(v, i) {
    const S = STATIONS[i];
    if (!S || !unlocked(i)) return App.go('#/quest');
    if (S.kind === 'task' || S.kind === 'game') return start(i);
    st().active = { i, kind: S.kind };
    Progress.save();
    const box = h('div', { class: 'quest-mini' });
    v.append(
      h('div', { class: 'quest-banner' }, h('span', null, t('quest.11') + (i + 1) + ': ' + S.title), h('a', { class: 'btn small', href: '#/quest' }, t('quest.13'))),
      box);
    if (S.kind === 'tf') miniTF(box, i);
    else miniCount(box, i);
  }

  function miniTF(box, i) {
    const N = 5, NEED = 4;
    let k = 0, right = 0, q = null;
    const next = () => {
      if (k >= N) return finish();
      q = TrueFalseGen.gen(k < 2 ? 0 : 1);
      box.innerHTML = '';
      box.append(h('div', { class: 'panel' },
        h('p', { class: 'muted' }, t('quest.18') + (k + 1) + t('app.1') + N + t('quest.19') + right + t('quest.20') + NEED + ')'),
        h('div', { html: Highlight.code(Object.keys(q.vars).map(n => n + ' = ' + q.vars[n]).join('\n'), { numbers: false }) }),
        h('div', { class: 'tf-cond' }, h('span', { html: Highlight.line(q.expr) })),
        h('div', { class: 'tf-buttons' },
          h('button', { class: 'btn tf-btn tf-yes', onclick: () => answer(true) }, t('quest.21')),
          h('button', { class: 'btn tf-btn tf-no', onclick: () => answer(false) }, t('quest.22')))));
    };
    const answer = v => {
      const ok = v === q.answer;
      if (ok) right++;
      Sound.play(ok ? 'ok' : 'bad');
      box.querySelector('.panel').append(h('p', { class: ok ? 'qz-explain ok' : 'qz-explain bad' }, (ok ? t('quest.23') : t('quest.24')) + q.explain));
      $$('.tf-btn', box).forEach(b => { b.disabled = true; });
      k++;
      setTimeout(next, ok ? 900 : 2200);
    };
    const finish = () => result(box, i, right >= NEED, t('quest.25') + right + t('app.1') + N, () => miniTF(box, i));
    next();
  }

  function miniCount(box, i) {
    const N = 3, NEED = 2;
    let k = 0, right = 0;
    const next = () => {
      if (k >= N) return result(box, i, right >= NEED, t('quest.25') + right + t('app.1') + N, () => miniCount(box, i));
      const q = CountGen.gen(2 + k * 2);
      const inp = h('input', { class: 'input ct-input', type: 'text', inputmode: 'numeric', autocomplete: 'off', 'aria-label': t('quest.26') });
      const submit = () => {
        if (!inp.value.trim()) return;
        const ok = Number(inp.value.trim().replace('−', '-')) === Number(q.answer);
        if (ok) right++;
        Sound.play(ok ? 'ok' : 'bad');
        inp.disabled = true;
        box.querySelector('.panel').append(h('p', { class: ok ? 'qz-explain ok' : 'qz-explain bad' }, (ok ? t('quest.27') : t('quest.28') + q.answer) + t('quest.29') + q.output.join(' · ')));
        k++;
        setTimeout(next, ok ? 1200 : 2600);
      };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
      box.innerHTML = '';
      box.append(h('div', { class: 'panel' },
        h('p', { class: 'muted' }, t('quest.30') + (k + 1) + t('app.1') + N + t('quest.19') + right + t('quest.20') + NEED + ')'),
        h('div', { html: Highlight.code(q.code) }),
        h('p', { class: 'ct-ask' }, q.question),
        h('div', { class: 'ct-answer-row' }, inp, h('button', { class: 'btn primary', onclick: submit }, 'OK'))));
      setTimeout(() => inp.focus(), 30);
    };
    next();
  }

  function result(box, i, ok, text, retry) {
    box.innerHTML = '';
    if (ok) {
      complete(i);
      Sound.play('win');
      FX.confetti();
    } else Sound.play('lose');
    box.append(h('div', { class: 'tf-panel' },
      h('div', { class: 'tf-big' }, ok ? '🗝️' : '😕'),
      h('h2', null, ok ? t('quest.31') : t('quest.32')),
      h('p', null, text),
      ok ? h('p', null, t('quest.33'), h('b', null, '«' + chunk(i) + '»')) : null,
      h('div', { class: 'row', style: { justifyContent: 'center' } },
        ok ? null : h('button', { class: 'btn', onclick: retry }, t('quest.34')),
        h('a', { class: 'btn primary', href: '#/quest' }, t('quest.35')))));
  }

  return { render, station, banner, onTaskSolved, onLevelDone, openLetters, doneCount, reset, STATIONS, chunk };
})();
