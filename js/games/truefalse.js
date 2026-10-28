/* Игра «Истина или Ложь» — скоростная аркада на логические условия.
   TrueFalseGen — генератор условий (без DOM), используется игрой и tests.html.
   Этапы: 0 — сравнения, 1 — and / or, 2 — not, 3 — скобки и приоритет. */
const TrueFalseGen = (function () {
  'use strict';
  const NAMES = ['x', 'y', 'n', 'age', 'score', 'hp', 'coins', 'temp'];
  const OPS = ['>', '<', '>=', '<=', '==', '!='];

  const pickR = (r, arr) => arr[Math.floor(r() * arr.length)];
  const intR = (r, a, b) => a + Math.floor(r() * (b - a + 1));

  // Одно сравнение. Число справа часто «на границе», чтобы ловить путаницу > и >=
  function atom(r, name, val) {
    if (r() < 0.3) {
      const m = pickR(r, [2, 3, 5]);
      const rem = r() < 0.6 ? 0 : intR(r, 1, m - 1);
      return name + ' % ' + m + ' ' + (r() < 0.75 ? '==' : '!=') + ' ' + rem;
    }
    const rhs = Math.max(0, val + pickR(r, [-3, -1, 0, 0, 1, 2]));
    return name + ' ' + pickR(r, OPS) + ' ' + rhs;
  }

  const SHAPES = [
    ['A'],
    ['A and B', 'A or B'],
    ['not A', 'not A and B', 'A and not B', 'not A or B'],
    ['(A or B) and C', 'A or B and C', 'not (A and B)', '(A and B) or C', 'A and (B or C)', 'not (A or B)']
  ];

  function make(stage, r) {
    const names = [];
    while (names.length < (stage === 0 ? 1 : r() < 0.5 ? 1 : 2)) {
      const n = pickR(r, NAMES);
      if (!names.includes(n)) names.push(n);
    }
    const vars = {};
    names.forEach(n => { vars[n] = intR(r, 0, 20); });
    const shape = pickR(r, SHAPES[Math.min(stage, 3)]);
    const atoms = [];
    const expr = shape.replace(/[ABC]/g, () => {
      const n = pickR(r, names);
      const a = atom(r, n, vars[n]);
      atoms.push(a);
      return a;
    });
    Object.keys(vars).forEach(n => { if (!atoms.some(a => a.startsWith(n + ' '))) delete vars[n]; });
    const answer = Py.truthy(Py.evalExpr(expr, vars));
    // Объяснение: подставляем значение каждого сравнения
    let i = 0;
    const subst = shape.replace(/[ABC]/g, () => (Py.truthy(Py.evalExpr(atoms[i++], vars)) ? 'True' : 'False'));
    let explain = atoms.length > 1 || shape.includes('not') ? subst + ' → ' + (answer ? 'True' : 'False') : expr + ' → ' + (answer ? 'True' : 'False');
    if (shape === 'A or B and C') explain += t('tf.1');
    return { vars, expr, answer, explain, stage };
  }

  // Ответы True и False выпадают примерно поровну
  function gen(stage, r) {
    r = r || Math.random;
    const want = r() < 0.5;
    let q = make(stage, r);
    for (let k = 0; k < 20 && q.answer !== want; k++) q = make(stage, r);
    return q;
  }

  const stageFor = answered => (answered < 8 ? 0 : answered < 18 ? 1 : answered < 30 ? 2 : 3);

  return { gen, stageFor };
})();

if (typeof Games !== 'undefined') Games.register('truefalse', {
  tutorial: [
    { title: t('tf.2'), text: t('tf.3'), code: 'x = 7\nx > 5 and x % 2 == 0' },
    { title: t('tf.4'), text: t('tf.5') },
    { title: t('tf.6'), text: t('tf.7') }
  ],

  stars(records) {
    const r = records.truefalse || 0;
    return r >= 1500 ? 3 : r >= 700 ? 2 : r >= 300 ? 1 : 0;
  },

  mount(host, ctx) {
    const STAGE_NAMES = [t('tf.8'), 'and / or', 'not', t('tf.9')];
    let state = 'start', raf = 0, last = 0, paused = false;
    let lives, score, combo, answered, prog, lock, cur, mistakes, stage;

    const hud = h('div', { class: 'tf-hud' });
    const arena = h('div', { class: 'tf-arena' });
    const card = h('div', { class: 'tf-card' });
    const flash = h('div', { class: 'tf-flash' });
    const yesBtn = h('button', { class: 'btn tf-btn tf-yes', onclick: () => answer(true) }, t('quest.21'), h('small', null, '←'));
    const noBtn = h('button', { class: 'btn tf-btn tf-no', onclick: () => answer(false) }, t('quest.22'), h('small', null, '→'));
    const overlay = h('div', { class: 'tf-overlay' });
    arena.append(h('div', { class: 'tf-danger' }), card, flash, overlay);
    host.append(hud, arena, h('div', { class: 'tf-buttons' }, yesBtn, noBtn));

    const fallTime = () => (ctx.settings.noTimer ? Infinity : Math.max(2600, 9000 * Math.pow(0.95, answered)));
    const mult = () => Math.min(5, 1 + Math.floor(combo / 5));

    function drawHud() {
      hud.innerHTML = '';
      hud.append(
        h('span', { class: 'tf-lives', 'aria-label': t('tf.10') + lives }, '❤️'.repeat(Math.max(0, lives)) + '🤍'.repeat(Math.max(0, 3 - lives))),
        h('span', null, t('tf.11'), h('b', null, score)),
        h('span', { class: 'tf-mult' + (mult() > 1 ? ' hot' : '') }, '×' + mult()),
        h('span', { class: 'muted' }, STAGE_NAMES[stage]),
        h('span', { class: 'muted' }, t('game.record', { n: Progress.state.records.truefalse || 0 })));
    }

    function showStart() {
      state = 'start';
      card.style.display = 'none';
      overlay.innerHTML = '';
      overlay.append(h('div', { class: 'tf-panel' },
        h('div', { class: 'tf-big' }, '⚖️'),
        h('h2', null, t('game.truefalse')),
        h('p', null, t('tf.12'), h('b', null, Progress.state.records.truefalse || 0)),
        ctx.settings.noTimer ? h('p', { class: 'muted' }, t('tf.13')) : null,
        h('button', { class: 'btn primary', onclick: startGame }, t('tf.14')),
        h('p', { class: 'muted small' }, t('tf.15'))));
      overlay.style.display = '';
    }

    function startGame() {
      lives = 3; score = 0; combo = 0; answered = 0; mistakes = []; stage = 0; lock = 0;
      overlay.style.display = 'none';
      state = 'play';
      drawHud();
      next();
      last = 0;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    }

    function next() {
      const s = TrueFalseGen.stageFor(answered);
      if (s !== stage) {
        stage = s;
        showFlash(t('tf.16') + STAGE_NAMES[stage] + '!', 'info');
        Sound.play('level');
      }
      cur = TrueFalseGen.gen(stage);
      prog = 0;
      card.className = 'tf-card';
      card.style.display = '';
      card.innerHTML = Highlight.code(Object.keys(cur.vars).map(k => k + ' = ' + cur.vars[k]).join('\n'), { numbers: false }) +
        '<div class="tf-cond">' + Highlight.line(cur.expr) + '</div>';
      place();
      drawHud();
    }

    function place() {
      const max = arena.clientHeight - card.offsetHeight - 12;
      // top, а не transform: transform занят анимацией тряски
      card.style.top = (6 + Math.max(0, Math.min(1, prog)) * Math.max(0, max)) + 'px';
    }

    function frame(ts) {
      if (!last) last = ts;
      const dt = Math.min(100, ts - last);
      last = ts;
      if (state === 'play' && !paused) {
        if (lock > 0) {
          lock -= dt;
          if (lock <= 0) { if (lives <= 0) return gameOver(); next(); }
        } else {
          prog += dt / fallTime();
          place();
          if (prog >= 1) miss();
        }
      }
      raf = requestAnimationFrame(frame);
    }

    function showFlash(text, kind) {
      flash.className = 'tf-flash show ' + (kind || '');
      flash.textContent = text;
      clearTimeout(showFlash.t);
      showFlash.t = setTimeout(() => { flash.className = 'tf-flash'; }, 1400);
    }

    function answer(v) {
      if (state === 'start') return startGame();
      if (state !== 'play' || paused || lock > 0) return;
      if (v === cur.answer) {
        combo++;
        answered++;
        const pts = 10 * mult();
        score += pts;
        card.classList.add('ok');
        showFlash('+' + pts + (mult() > 1 ? t('tf.17') + mult() : ''), 'ok');
        Sound.play(combo % 5 === 0 ? 'coin' : 'ok');
        lock = 280;
      } else {
        lose(t('tf.18') + cur.explain);
      }
      drawHud();
    }

    function miss() { lose(t('tf.19') + cur.explain); }

    function lose(msg) {
      lives--;
      combo = 0;
      mistakes.push(cur);
      card.classList.add('bad');
      card.insertAdjacentHTML('beforeend', '<div class="tf-explain">' + Highlight.esc(msg) + '</div>');
      Sound.play('bad');
      FX.shake(card);
      lock = 2200;
      drawHud();
    }

    function gameOver() {
      state = 'over';
      card.style.display = 'none';
      const isRecord = ctx.record('truefalse', score);
      const pts = Math.round(score / 10);
      if (pts) ctx.addPoints(pts);
      Sound.play(isRecord && score > 0 ? 'win' : 'lose');
      if (isRecord && score > 0) FX.confetti();
      overlay.innerHTML = '';
      overlay.append(h('div', { class: 'tf-panel' },
        h('h2', null, t('game.over')),
        h('div', { class: 'tf-big' }, score),
        isRecord && score > 0 ? h('p', { class: 'tf-record' }, '🏆 ' + t('game.newrecord')) : h('p', { class: 'muted' }, t('game.record', { n: Progress.state.records.truefalse || 0 })),
        h('p', null, t('quest.25') + answered + (pts ? ' · +' + pts + t('robot.31') : '')),
        mistakes.length ? h('div', { class: 'tf-mistakes' }, h('b', null, t('tf.20')),
          mistakes.slice(-3).map(m => h('div', { class: 'tf-mistake' },
            h('code', null, Object.keys(m.vars).map(k => k + ' = ' + m.vars[k]).join(', ') + ':  ' + m.expr),
            h('div', null, m.explain)))) : null,
        h('div', { class: 'row', style: { justifyContent: 'center' } },
          h('button', { class: 'btn', onclick: ctx.exit }, t('game.tolist')),
          h('button', { class: 'btn primary', onclick: startGame }, '↺ ' + t('game.playagain')))));
      overlay.style.display = '';
      drawHud();
    }

    function onKey(e) {
      if (document.querySelector('.modal-back')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); answer(true); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); answer(false); }
      else if ((e.key === ' ' || e.key === 'Enter') && state !== 'play' && e.target.tagName !== 'BUTTON') { e.preventDefault(); startGame(); }
    }
    document.addEventListener('keydown', onKey);
    const onResize = () => { if (state === 'play') place(); };
    window.addEventListener('resize', onResize);

    lives = 3; score = 0; combo = 0; answered = 0; stage = 0;
    drawHud();
    showStart();

    return {
      pause() { paused = true; },
      resume() { paused = false; last = 0; },
      destroy() {
        cancelAnimationFrame(raf);
        clearTimeout(showFlash.t);
        document.removeEventListener('keydown', onKey);
        window.removeEventListener('resize', onResize);
      }
    };
  }
});
