/* Игра «Мемори»: найти пары «код — результат».
   MemoryGen — генератор пар (без DOM), используется игрой и tests.html. */
const MemoryGen = (function () {
  'use strict';
  const rI = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const rP = (r, arr) => arr[Math.floor(r() * arr.length)];
  const flat = out => out.trim().split(/\s+/).join(' ');

  // Логика: равносильные условия (eq — то же на Python, для проверки в tests.html)
  const LOGIC = [
    ['not x > 5', 'x <= 5'],
    ['not (x < 3 or x > 7)', 'x >= 3 and x <= 7'],
    ['not (x > 0 and x < 5)', 'x <= 0 or x >= 5'],
    ['not x != 4', 'x == 4'],
    ['x > 2 and x > 6', 'x > 6'],
    ['x > 2 or x > 6', 'x > 2'],
    ['x < 3 and x > 8', t('memory.1'), 'False'],
    ['x < 8 or x > 3', t('memory.2'), 'True'],
    ['not (x == 1 or x == 2)', 'x != 1 and x != 2'],
    ['x >= 10 and x <= 10', 'x == 10'],
    ['x % 2 == 0', t('memory.3'), 'x % 2 != 1'],
    ['not x % 2 == 0', t('memory.4'), 'x % 2 == 1'],
    ['not (x >= 0)', 'x < 0'],
    ['x > 5 and not x > 9', '5 < x <= 9']
  ];

  const GEN = {
    range(r) {
      const k = rI(r, 0, 3);
      let a, b, s, src;
      if (k === 0) { b = rI(r, 2, 6); src = 'range(' + b + ')'; }
      else if (k === 1) { a = rI(r, 1, 6); b = a + rI(r, 2, 5); src = 'range(' + a + ', ' + b + ')'; }
      else if (k === 2) { a = rI(r, 0, 4); s = rI(r, 2, 4); b = a + s * rI(r, 2, 4) - rI(r, 0, 1); src = 'range(' + a + ', ' + b + ', ' + s + ')'; }
      else { a = rI(r, 6, 10); s = rI(r, 1, 3); b = a - s * rI(r, 2, 4) - rI(r, 0, 1); src = 'range(' + a + ', ' + b + ', -' + s + ')'; }
      const items = Py.evalExpr('list(' + src + ')');
      if (!items.length || items.length > 6) return null;
      return [src, items.join(' ')];
    },
    if(r) {
      const a = rI(r, 2, 7), b = a + rI(r, 2, 4), k = rI(r, 2, 5);
      const cond = rP(r, [
        'n % ' + k + ' == 0', 'n > ' + a + ' and n < ' + b, 'n < ' + a + ' or n > ' + b, 'not n > ' + a,
        'n % 2 == 1 and n > ' + a, 'n == ' + a + ' or n == ' + b, 'not n % ' + k + ' == 0 and n < ' + a
      ]);
      const xs = [];
      for (let n = 1; n <= 10; n++) if (Py.truthy(Py.evalExpr(cond, { n }))) xs.push(n);
      if (!xs.length || xs.length > 6) return null;
      return [cond, 'n: ' + xs.join(' ')];
    },
    while(r) {
      const kind = rI(r, 0, 3);
      let code;
      if (kind === 0) code = 'n = ' + rI(r, 0, 3) + '\nwhile n < ' + rI(r, 8, 20) + ':\n    n += ' + rI(r, 3, 6) + '\nprint(n)';
      else if (kind === 1) code = 'n = ' + rI(r, 10, 20) + '\nwhile n > 0:\n    n -= ' + rI(r, 3, 6) + '\nprint(n)';
      else if (kind === 2) code = 'n = 1\nc = 0\nwhile n < ' + rI(r, 10, 100) + ':\n    n *= 2\n    c += 1\nprint(c)';
      else code = 'n = ' + rI(r, 1, 3) + '\nwhile n < ' + rI(r, 20, 60) + ':\n    n *= 3\nprint(n)';
      const res = Py.run(code);
      return res.ok ? [code, flat(res.output)] : null;
    },
    logic(r, used) {
      const free = LOGIC.filter(p => !used.has(p[0]));
      if (!free.length) return null;
      const p = rP(r, free);
      return [p[0], p[1]];
    }
  };

  function pairs(set, n, r) {
    r = r || Math.random;
    const out = [], usedA = new Set(), usedB = new Set();
    for (let k = 0; out.length < n && k < 500; k++) {
      const p = GEN[set](r, usedA);
      if (!p || usedA.has(p[0]) || usedB.has(p[1])) continue;
      usedA.add(p[0]);
      usedB.add(p[1]);
      out.push({ a: p[0], b: p[1] });
    }
    return out;
  }

  return { pairs, LOGIC, SETS: Object.keys(GEN) };
})();

if (typeof Games !== 'undefined') Games.register('memory', {
  tutorial: [
    { title: t('game.memory'), text: t('memory.5'), code: 'range(2, 9, 3)   ↔   2 5 8' },
    { title: t('memory.6'), text: t('memory.7') },
    { title: t('memory.8'), text: t('memory.9') }
  ],

  stars(records, g) {
    const m = records.memory;
    if (m !== undefined && m <= 14) return 3;
    if (m !== undefined && m <= 20) return 2;
    return g && g.pts > 0 ? 1 : 0;
  },

  mount(host, ctx) {
    const SETS = {
      range: ['🔢 range()', t('memory.10')],
      if: [t('memory.11'), t('memory.12')],
      while: [t('memory.13'), t('memory.14')],
      logic: [t('memory.15'), t('memory.16')]
    };
    const g = Progress.game('memory');
    let set = g.lastSet || 'range', size = g.lastSize || 12;
    let cards = [], open = [], matched = 0, moves = 0, time = 0, timer = null, lock = false, paused = false, state = 'menu';

    const hud = h('div', { class: 'tf-hud' });
    const board = h('div', { class: 'mm-board' });
    host.append(hud, board);

    function drawHud() {
      hud.innerHTML = '';
      if (state === 'menu') return;
      hud.append(...[
        h('span', null, SETS[set][0]),
        h('span', null, t('memory.17'), h('b', null, moves)),
        ctx.settings.noTimer ? null : h('span', null, '⏱ ', h('b', null, fmt(time))),
        h('span', null, t('memory.18'), h('b', null, matched + ' / ' + size / 2)),
        size === 16 ? h('span', { class: 'muted' }, t('game.record', { n: Progress.state.records.memory !== undefined ? Progress.state.records.memory + t('memory.19') : '—' })) : null].filter(Boolean));
    }

    const fmt = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

    function menu() {
      state = 'menu';
      stopTimer();
      board.className = 'mm-board';
      board.innerHTML = '';
      const choice = (obj, cur, onPick) => h('div', { class: 'chips mm-choice' }, Object.keys(obj).map(k =>
        h('button', { class: 'chip' + (String(k) === String(cur) ? ' on' : ''), onclick: () => { onPick(k); menu(); } }, obj[k])));
      board.append(h('div', { class: 'tf-panel mm-menu' },
        h('div', { class: 'tf-big' }, '🃏'),
        h('h2', null, t('game.memory')),
        h('p', null, h('b', null, t('memory.20'))),
        choice(Object.fromEntries(Object.keys(SETS).map(k => [k, SETS[k][0]])), set, k => { set = k; }),
        h('p', { class: 'muted' }, SETS[set][1]),
        h('p', null, h('b', null, t('memory.21'))),
        choice({ 12: t('memory.22'), 16: t('memory.23') }, size, k => { size = +k; }),
        h('button', { class: 'btn primary', onclick: start }, t('tf.14'))));
      drawHud();
    }

    function start() {
      g.lastSet = set;
      g.lastSize = size;
      Progress.save();
      const ps = MemoryGen.pairs(set, size / 2);
      cards = shuffle(ps.flatMap((p, i) => [{ pair: i, side: 'a', text: p.a }, { pair: i, side: 'b', text: p.b }]));
      open = []; matched = 0; moves = 0; time = 0; lock = false;
      state = 'play';
      board.innerHTML = '';
      board.className = 'mm-board grid-' + size;
      cards.forEach((c, i) => {
        const face = c.side === 'a'
          ? '<code>' + c.text.split('\n').map(Highlight.line).join('<br>') + '</code>'
          : '<span class="mm-result">' + Highlight.esc(c.text) + '</span>';
        c.el = h('button', { class: 'mm-card', 'aria-label': t('memory.24') + (i + 1), onclick: () => flip(c) },
          h('span', { class: 'mm-inner' },
            h('span', { class: 'mm-back' }, 'py'),
            h('span', { class: 'mm-face mm-' + c.side, html: face })));
        board.append(c.el);
      });
      stopTimer();
      timer = setInterval(() => { if (!paused && state === 'play') { time++; drawHud(); } }, 1000);
      drawHud();
    }

    function flip(c) {
      if (state !== 'play' || lock || paused || c.done || open.includes(c)) return;
      c.el.classList.add('open');
      c.el.setAttribute('aria-label', c.text);
      open.push(c);
      Sound.play('flip');
      if (open.length < 2) return;
      moves++;
      const [x, y] = open;
      if (x.pair === y.pair && x.side !== y.side) {
        x.done = y.done = true;
        setTimeout(() => { x.el.classList.add('done'); y.el.classList.add('done'); }, 250);
        open = [];
        matched++;
        Sound.play('ok');
        if (matched === size / 2) setTimeout(finish, 600);
      } else {
        lock = true;
        setTimeout(() => {
          x.el.classList.remove('open');
          y.el.classList.remove('open');
          open = [];
          lock = false;
        }, 1100);
      }
      drawHud();
    }

    function finish() {
      state = 'over';
      stopTimer();
      const pairsN = size / 2;
      const pts = Math.max(20, (size === 16 ? 160 : 100) - (moves - pairsN) * 5);
      ctx.addPoints(pts);
      let isRecord = false;
      if (size === 16) isRecord = ctx.record('memory', moves, true);
      Sound.play('win');
      FX.confetti();
      drawHud();
      ctx.modal({
        title: t('memory.25'),
        body: h('div', { class: 'rb-win' },
          h('div', { class: 'tf-big' }, moves + t('memory.19')),
          ctx.settings.noTimer ? null : h('p', null, t('memory.26') + fmt(time)),
          isRecord ? h('p', { class: 'tf-record' }, '🏆 ' + t('game.newrecord')) : null,
          h('p', null, '+' + pts + t('robot.31')),
          h('p', { class: 'muted' }, t('memory.27') + pairsN + t('memory.28'))),
        actions: [{ label: t('memory.29'), onclick: menu }, { label: t('quest.34'), primary: true, onclick: start }]
      });
    }

    function stopTimer() { clearInterval(timer); timer = null; }

    menu();

    return {
      pause() { paused = true; },
      resume() { paused = false; },
      destroy: stopTimer
    };
  }
});
