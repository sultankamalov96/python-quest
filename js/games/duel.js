/* Игра «Дуэль на проекторе»: две команды, одинаковые задачи, кто быстрее.
   Команда 1 — клавиши A S D F, команда 2 — J K L ; (по физическим клавишам, раскладка не важна).
   DuelGen — генератор заданий из уже проверенных источников: TrueFalseGen, CountGen, QUIZ, TASKS. */
const DuelGen = (function () {
  'use strict';
  const rnd = n => Math.floor(Math.random() * n);
  const mix = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const withAnswer = (opts, right) => {
    const o = mix(opts);
    return { options: o, answer: o.indexOf(right) };
  };

  const MAKERS = {
    tf() {
      const q = TrueFalseGen.gen(rnd(4));
      return Object.assign({
        type: 'tf', title: t('duel.1'),
        code: Object.keys(q.vars).map(k => k + ' = ' + q.vars[k]).join('\n') + '\nprint(' + q.expr + ')',
        explain: q.explain, key: 'tf' + q.expr
      }, { options: ['True', 'False'], answer: q.answer ? 0 : 1 });
    },
    count() {
      const g = CountGen.gen(2 + rnd(8));
      const a = Number(g.answer);
      const pool = [a + 1, a - 1, a + 2, a - 2, a + 3, a * 2].filter(x => x !== a && (g.kind === 'last' || x >= 0));
      const opts = [a].concat(mix(Array.from(new Set(pool))).slice(0, 3)).map(String);
      return Object.assign({ type: 'count', title: g.question, code: g.code, explain: t('count.20') + g.output.join(' · '), key: 'c' + g.code }, withAnswer(opts, String(a)));
    },
    output(used) {
      const bank = QUIZ.filter(q => q.code && q.check === 'output' && q.tier <= 4 && !used.has('o' + q.code));
      if (!bank.length) return null;
      const q = bank[rnd(bank.length)];
      return Object.assign({ type: 'output', title: q.q, code: q.code, explain: q.explain, key: 'o' + q.code }, withAnswer(q.options, q.options[q.answer]));
    },
    bug(used) {
      const bank = (typeof TASKS !== 'undefined' ? TASKS : []).filter(x => x.type === 'bug' && !used.has('b' + x.id));
      if (!bank.length) return null;
      const task = bank[rnd(bank.length)];
      const n = task.code.split('\n').length;
      const others = mix(Array.from({ length: n }, (_, i) => i + 1).filter(x => x !== task.data.line)).slice(0, 3);
      const opts = [task.data.line].concat(others).map(x => t('teacher.13') + x);
      return Object.assign({ type: 'bug', title: t('duel.2') + task.story, code: task.code, explain: task.explain, key: 'b' + task.id }, withAnswer(opts, t('teacher.13') + task.data.line));
    }
  };

  const ORDER = ['tf', 'count', 'output', 'bug', 'tf', 'output', 'count', 'bug', 'output', 'count'];

  function round(i, used) {
    const types = [ORDER[i % ORDER.length]].concat(['output', 'count', 'tf']);
    for (const ty of types) {
      for (let k = 0; k < 20; k++) {
        const q = MAKERS[ty](used);
        if (q && !used.has(q.key)) { used.add(q.key); return q; }
      }
    }
    return MAKERS.tf(used);
  }

  return { round, MAKERS };
})();

if (typeof Games !== 'undefined') Games.register('duel', {
  tutorial: [
    { title: t('game.duel'), text: t('duel.3') },
    { title: t('tf.4'), text: t('duel.4') },
    { title: t('duel.5'), text: t('duel.6') }
  ],

  stars(records, g) { return g && g.pts > 0 ? 3 : 0; },

  mount(host, ctx) {
    const ROUNDS = 10, BLOCK = 3000, ROUND_TIME = 40000;
    const KEYS = [['KeyA', 'KeyS', 'KeyD', 'KeyF'], ['KeyJ', 'KeyK', 'KeyL', 'Semicolon']];
    const LABEL = [['A', 'S', 'D', 'F'], ['J', 'K', 'L', ';']];
    const g = Progress.game('duel');
    let names = g.names || [t('duel.7'), t('duel.8')];
    let score = [0, 0], r = 0, cur = null, state = 'setup', used = new Set();
    let blockedUntil = [0, 0], wrongOpts = [new Set(), new Set()], left = ROUND_TIME, raf = 0, last = 0, paused = false, nextTimer = null;

    const root = h('div', { class: 'du-root' });
    host.append(root);

    function setup() {
      state = 'setup';
      root.innerHTML = '';
      const inp = i => h('input', { class: 'input du-name', value: names[i], maxlength: '20', 'aria-label': t('duel.9') + (i + 1) });
      const i1 = inp(0), i2 = inp(1);
      root.append(h('div', { class: 'tf-panel du-setup' },
        h('div', { class: 'tf-big' }, '⚔️'),
        h('h2', null, t('game.duel')),
        h('div', { class: 'du-names' },
          h('label', { class: 'du-team t0' }, h('b', null, t('duel.10')), i1),
          h('label', { class: 'du-team t1' }, h('b', null, t('duel.11')), i2)),
        h('p', { class: 'muted' }, ROUNDS + t('duel.12')),
        h('button', { class: 'btn primary', onclick: () => {
          names = [i1.value.trim() || t('duel.7'), i2.value.trim() || t('duel.8')];
          g.names = names;
          Progress.save();
          start();
        } }, t('duel.13'))));
    }

    function start() {
      score = [0, 0]; r = 0; used = new Set();
      state = 'play';
      cancelAnimationFrame(raf);
      last = 0;
      raf = requestAnimationFrame(frame);
      ask();
    }

    function ask() {
      cur = DuelGen.round(r, used);
      blockedUntil = [0, 0];
      wrongOpts = [new Set(), new Set()];
      left = ROUND_TIME;
      state = 'play';
      draw();
    }

    function draw(winner) {
      root.innerHTML = '';
      const timerBar = h('div', { class: 'ct-timer du-timer' }, h('span'));
      root.append(...[
        h('div', { class: 'du-score' },
          h('div', { class: 'du-s t0' + (winner === 0 ? ' won' : '') }, h('span', null, names[0]), h('b', null, score[0])),
          h('div', { class: 'du-round' }, t('duel.14') + Math.min(r + 1, ROUNDS) + ' / ' + ROUNDS),
          h('div', { class: 'du-s t1' + (winner === 1 ? ' won' : '') }, h('b', null, score[1]), h('span', null, names[1]))),
        ctx.settings.noTimer ? null : timerBar,
        h('div', { class: 'du-question' },
          h('div', { class: 'du-title' }, cur.title),
          h('div', { html: Highlight.code(cur.code) })),
        h('div', { class: 'du-halves' }, [0, 1].map(team => half(team, winner)))].filter(Boolean));
      root._timer = timerBar.firstChild;
      if (winner !== undefined) {
        root.append(h('div', { class: 'du-result' },
          winner === null ? t('duel.15') : '🏆 ' + names[winner] + ' +1! ',
          h('span', { class: 'muted' }, cur.explain || ''),
          h('button', { class: 'btn primary', onclick: next }, r + 1 < ROUNDS ? t('duel.16') : t('count.27'))));
      }
    }

    function half(team, winner) {
      const blocked = blockedUntil[team] > performance.now();
      return h('div', { class: 'du-half t' + team + (blocked ? ' blocked' : '') },
        h('div', { class: 'du-half-name' }, names[team]),
        h('div', { class: 'du-opts' + (cur.options.length === 2 ? ' two' : '') }, cur.options.map((o, i) => {
          let cls = 'du-opt';
          if (wrongOpts[team].has(i)) cls += ' wrong';
          if (winner !== undefined && i === cur.answer) cls += ' right';
          return h('button', { class: cls, disabled: winner !== undefined || null, onclick: () => answer(team, i) },
            h('kbd', null, LABEL[team][i]), h('span', null, o));
        })),
        blocked ? h('div', { class: 'du-block', 'data-team': team }, '⛔ ', h('span', null, Math.ceil((blockedUntil[team] - performance.now()) / 1000))) : null);
    }

    function answer(team, i) {
      if (state !== 'play' || paused || i >= cur.options.length) return;
      if (blockedUntil[team] > performance.now() || wrongOpts[team].has(i)) return;
      if (i === cur.answer) {
        score[team]++;
        state = 'result';
        Sound.play('win');
        draw(team);
        scheduleNext();
      } else {
        wrongOpts[team].add(i);
        blockedUntil[team] = performance.now() + BLOCK;
        Sound.play('bad');
        draw();
        FX.shake(root.querySelector('.du-half.t' + team));
      }
    }

    function scheduleNext() {
      clearTimeout(nextTimer);
      if (!ctx.settings.noTimer) nextTimer = setTimeout(() => { if (!paused && state === 'result') next(); }, 4500);
    }

    function next() {
      if (state !== 'result') return;
      clearTimeout(nextTimer);
      r++;
      if (r >= ROUNDS) finish();
      else ask();
    }

    function frame(ts) {
      if (!last) last = ts;
      const dt = Math.min(100, ts - last);
      last = ts;
      if (state === 'play' && !paused) {
        if (!ctx.settings.noTimer) {
          left -= dt;
          if (root._timer) {
            root._timer.style.width = Math.max(0, left / ROUND_TIME * 100) + '%';
            root._timer.parentNode.classList.toggle('low', left < 10000);
          }
          if (left <= 0) { state = 'result'; Sound.play('lose'); draw(null); scheduleNext(); }
        }
        // обновляем счётчики блокировки
        $$('.du-block', root).forEach(b => {
          const ms = blockedUntil[+b.dataset.team] - performance.now();
          if (ms <= 0) draw();
          else b.lastChild.textContent = Math.ceil(ms / 1000);
        });
      }
      raf = requestAnimationFrame(frame);
    }

    function finish() {
      state = 'over';
      cancelAnimationFrame(raf);
      ctx.bump('duels');
      ctx.addPoints(30);
      const w = score[0] === score[1] ? null : score[0] > score[1] ? 0 : 1;
      Sound.play('win');
      FX.confetti();
      root.innerHTML = '';
      root.append(h('div', { class: 'tf-panel du-final' },
        h('div', { class: 'tf-big' }, w === null ? '🤝' : '🏆'),
        h('h2', null, w === null ? t('duel.17') : t('duel.18') + names[w] + '»!'),
        h('div', { class: 'du-final-score' },
          h('div', { class: 'du-s t0' + (w === 0 ? ' won' : '') }, h('span', null, names[0]), h('b', null, score[0])),
          h('div', { class: 'du-s t1' + (w === 1 ? ' won' : '') }, h('b', null, score[1]), h('span', null, names[1]))),
        h('div', { class: 'row', style: { justifyContent: 'center' } },
          h('button', { class: 'btn', onclick: setup }, t('duel.19')),
          h('button', { class: 'btn primary', onclick: start }, t('duel.20')))));
    }

    function onKey(e) {
      if (document.querySelector('.modal-back') || e.target.tagName === 'INPUT') return;
      for (let team = 0; team < 2; team++) {
        const i = KEYS[team].indexOf(e.code);
        if (i >= 0) { e.preventDefault(); answer(team, i); return; }
      }
      if (e.key === 'Enter' && state === 'result' && e.target.tagName !== 'BUTTON') { e.preventDefault(); next(); }
    }
    document.addEventListener('keydown', onKey);

    setup();

    return {
      pause() { paused = true; clearTimeout(nextTimer); },
      resume() {
        paused = false;
        last = 0;
        if (state === 'result') scheduleNext();
      },
      destroy() { cancelAnimationFrame(raf); clearTimeout(nextTimer); document.removeEventListener('keydown', onKey); }
    };
  }
});
