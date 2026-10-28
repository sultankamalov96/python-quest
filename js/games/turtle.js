/* Игра «Черепашка-художник».
   TurtleSim — модель черепашки и сравнение рисунков (без DOM): используется игрой и tests.html.
   Координаты: центр холста (0, 0), ось y вверх, угол 0° — вправо, left() — против часовой. */
const TurtleSim = (function () {
  'use strict';
  const COLORS = {
    red: '#e53935', blue: '#1e66f5', green: '#2e9e44', orange: '#f59e0b', purple: '#8e44ad',
    black: '#222222', yellow: '#eab308', pink: '#ec4899', brown: '#8d5524', gray: '#888888', cyan: '#06b6d4'
  };
  const MAX_ACTIONS = 4000;

  function create(start) {
    start = start || {};
    return { x: start.x || 0, y: start.y || 0, h: start.h || 0, pen: true, color: 'black', segs: [], actions: [] };
  }

  function builtins(T) {
    const act = a => {
      if (T.actions.length >= MAX_ACTIONS) throw new Error(t('turtle.1'));
      T.actions.push(a);
    };
    const one = (name, args, example) => {
      if (args.length !== 1) throw new Error(name + t('turtle.2') + name + '(' + example + ')');
      const v = args[0];
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(name + t('turtle.3') + name + '(' + example + ')');
      return v;
    };
    const none = (name, args) => { if (args.length) throw new Error(name + t('robot.2')); };
    function move(d) {
      const r = T.h * Math.PI / 180;
      const nx = T.x + d * Math.cos(r), ny = T.y + d * Math.sin(r);
      const s = { x1: T.x, y1: T.y, x2: nx, y2: ny, color: T.color };
      act({ t: 'move', s, pen: T.pen });
      if (T.pen && d !== 0) T.segs.push(s);
      T.x = nx; T.y = ny;
    }
    function turn(a) {
      act({ t: 'turn', from: T.h, to: T.h + a });
      T.h += a;
    }
    return {
      forward(...a) { move(one('forward', a, 100)); },
      back(...a) { move(-one('back', a, 100)); },
      left(...a) { turn(one('left', a, 90)); },
      right(...a) { turn(-one('right', a, 90)); },
      color(...a) {
        if (a.length !== 1 || typeof a[0] !== 'string') throw new Error(t('turtle.4'));
        const c = a[0].trim().toLowerCase();
        if (!COLORS[c] && !/^#[0-9a-f]{6}$/.test(c)) throw new Error(t('turtle.5') + a[0] + t('turtle.6') + Object.keys(COLORS).join(', '));
        T.color = c;
        act({ t: 'color', c });
      },
      pen_up(...a) { none('pen_up', a); T.pen = false; act({ t: 'pen', on: false }); },
      pen_down(...a) { none('pen_down', a); T.pen = true; act({ t: 'pen', on: true }); }
    };
  }

  // Выполнить программу: действия черепашки получают номер строки, на которой произошли
  function execute(code, start) {
    const T = create(start);
    let error = null, mark = 0;
    const g = Py.steps(code, { builtins: builtins(T), snap: false });
    try {
      for (const st of g) {
        for (let i = mark; i < T.actions.length; i++) T.actions[i].line = st.line;
        mark = T.actions.length;
      }
    } catch (e) {
      error = e;
      for (let i = mark; i < T.actions.length; i++) T.actions[i].line = e.line;
    }
    return { T, error };
  }

  function bbox(segs) {
    if (!segs.length) return { x1: 0, y1: 0, x2: 0, y2: 0 };
    const xs = segs.flatMap(s => [s.x1, s.x2]), ys = segs.flatMap(s => [s.y1, s.y2]);
    return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
  }

  // Старт уровня выбирается так, чтобы образец оказался в центре холста
  const startCache = new WeakMap();
  function levelStart(level) {
    if (startCache.has(level)) return startCache.get(level);
    const b = bbox(execute(level.solution, { h: level.h || 0 }).T.segs);
    const st = { x: Math.round(-(b.x1 + b.x2) / 2), y: Math.round(-(b.y1 + b.y2) / 2), h: level.h || 0 };
    startCache.set(level, st);
    return st;
  }

  function samples(segs, step) {
    const pts = [];
    for (const s of segs) {
      const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
      const n = Math.max(1, Math.ceil(len / step));
      for (let i = 0; i <= n; i++) pts.push({ x: s.x1 + (s.x2 - s.x1) * i / n, y: s.y1 + (s.y2 - s.y1) * i / n, color: s.color });
    }
    return pts;
  }

  function dist(p, s) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    const l2 = dx * dx + dy * dy;
    let k = l2 ? ((p.x - s.x1) * dx + (p.y - s.y1) * dy) / l2 : 0;
    k = Math.max(0, Math.min(1, k));
    return Math.hypot(p.x - (s.x1 + k * dx), p.y - (s.y1 + k * dy));
  }

  // Сравнение рисунков: каждая точка образца должна быть покрыта нарисованным отрезком (и наоборот)
  function compare(drawn, ref, opts) {
    opts = opts || {};
    const tol = opts.tol || 4;
    const sameColor = (a, b) => !opts.colors || a === b;
    const refPts = samples(ref, 4), drawnPts = samples(drawn, 4);
    const missing = refPts.filter(p => !drawn.some(s => sameColor(s.color, p.color) && dist(p, s) <= tol));
    const extra = drawnPts.filter(p => !ref.some(s => dist(p, s) <= tol));
    // «не тот цвет»: линия на месте есть, но другого цвета
    const wrongColor = opts.colors ? missing.filter(p => drawn.some(s => dist(p, s) <= tol)) : [];
    // допуск только на округление: пара точек, а не целый пропущенный отрезок
    const ok = drawn.length > 0 && missing.length <= 2 && extra.length <= 2;
    return { ok, missing, extra, wrongColor };
  }

  const countLines = code => code.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length;

  return { COLORS, execute, levelStart, bbox, compare, countLines, builtins, create };
})();

// ======================================================================= игра
if (typeof Games !== 'undefined') Games.register('turtle', {
  levels: true,
  sandbox: true,
  tutorial: [
    { title: t('turtle.7'), text: t('turtle.8'), code: 'forward(100)\nleft(90)\nforward(100)' },
    { title: t('turtle.9'), text: t('turtle.10'), code: 'color("blue")\nforward(50)\npen_up()\nforward(20)\npen_down()\nforward(50)' },
    { title: t('turtle.11'), text: t('turtle.12'), code: 'for i in range(4):\n    forward(100)\n    left(90)' },
    { title: t('turtle.13'), text: t('turtle.14') }
  ],

  mount(host, ctx) {
    const sandbox = ctx.level === 0;
    const L = ctx.levelData || { title: t('turtle.15'), hint: t('turtle.16'), solution: '', maxLines: 0 };
    const g = Progress.game('turtle');
    g.code = g.code || {};
    const SIZE = 400;
    const PX = [70, 150, 300, 650, 2500], DEG = [150, 300, 600, 1300, 5000];
    let speed = Math.min(5, Math.max(1, +(g.speed || CONFIG.defaultSpeed)));
    const start = sandbox ? { x: 0, y: 0, h: 0 } : TurtleSim.levelStart(L);
    const ref = sandbox ? [] : TurtleSim.execute(L.solution, start).T.segs;
    let failedChecks = 0, raf = 0, anim = null, paused = false, lastResult = null, marks = null;
    let turtle = { x: start.x, y: start.y, h: start.h, pen: true, color: 'black' }, done = [];

    // ---------------- разметка
    const canvas = h('canvas', { class: 'tt-canvas', width: SIZE * 2, height: SIZE * 2, role: 'img', 'aria-label': t('turtle.17') });
    const status = h('div', { class: 'rb-status', 'aria-live': 'polite' });
    const goals = h('ul', { class: 'rb-goals' });
    const edHost = h('div', { class: 'rb-editor' });
    const palette = h('div', { class: 'rb-palette' });
    const btn = (label, cls, fn) => h('button', { class: 'btn ' + cls, onclick: fn }, label);
    const runBtn = btn(t('turtle.18'), 'primary', run);
    const stopBtn = btn(t('robot.16'), '', stop);
    const clearBtn = btn(t('turtle.19'), '', () => { stop(); resetCanvas(); });
    const speedIn = h('input', { type: 'range', min: '1', max: '5', value: String(speed), 'aria-label': t('robot.18') });
    speedIn.addEventListener('input', () => { speed = +speedIn.value; g.speed = speed; Progress.save(); });

    host.append(h('div', { class: 'rb-layout' },
      h('div', { class: 'rb-left' },
        h('div', { class: 'rb-level-head' }, h('b', null, sandbox ? t('turtle.20') : t('robot.19') + ctx.level + t('app.1') + ctx.levelCount + ': ' + L.title)),
        h('div', { class: 'tt-frame' }, canvas),
        sandbox ? null : h('p', { class: 'muted small tt-legend' }, t('turtle.21')),
        status, sandbox ? null : goals),
      h('div', { class: 'rb-right' },
        h('p', { class: 'rb-task', html: rich(L.hint) }),
        palette, edHost,
        h('div', { class: 'rb-controls' }, runBtn, stopBtn, clearBtn,
          h('label', { class: 'rb-speed' }, '🐢', speedIn, '🐇')),
        h('div', { class: 'row wrap' },
          btn(t('turtle.22'), 'small ghost', savePNG),
          sandbox ? null : (ctx.level > 1 ? btn(t('robot.20') + (ctx.level - 1), 'small ghost', () => ctx.goLevel(ctx.level - 1)) : null),
          btn(t('robot.21'), 'small ghost', ctx.levels),
          ctx.teacher && !sandbox ? btn(t('robot.22'), 'small ghost', () => editor.setValue(L.solution)) : null))));

    const key = sandbox ? 'sandbox' : ctx.level;
    const editor = Editor.create(edHost, {
      value: g.code[key] !== undefined ? g.code[key] : (sandbox ? 'for i in range(36):\n    forward(150)\n    left(170)\n' : t('turtle.23')),
      onChange(v) { g.code[key] = v; Progress.save(); drawGoals(); }
    });
    const cmds = ['forward(100)', 'back(50)', 'left(90)', 'right(90)', 'color("red")', 'pen_up()', 'pen_down()', 'for i in range(4):'];
    (L.allowed || cmds).forEach(c => palette.append(h('button', { class: 'chip code-chip', onclick: () => editor.insertCommand(c) }, c)));

    // ---------------- рисование
    const cx = canvas.getContext('2d');
    const toCanvas = (x, y) => [(SIZE / 2 + x) * 2, (SIZE / 2 - y) * 2];
    const colorOf = c => TurtleSim.COLORS[c] || c;

    function line(s, color, width, dash) {
      cx.beginPath();
      cx.setLineDash(dash || []);
      cx.strokeStyle = color;
      cx.lineWidth = width;
      cx.lineCap = 'round';
      cx.moveTo(...toCanvas(s.x1, s.y1));
      cx.lineTo(...toCanvas(s.x2, s.y2));
      cx.stroke();
      cx.setLineDash([]);
    }

    function render(partial) {
      cx.clearRect(0, 0, canvas.width, canvas.height);
      cx.fillStyle = '#ffffff';
      cx.fillRect(0, 0, canvas.width, canvas.height);
      // сетка
      cx.strokeStyle = '#eef0f6';
      cx.lineWidth = 1;
      for (let i = 0; i <= SIZE; i += 25) {
        cx.beginPath(); cx.moveTo(i * 2, 0); cx.lineTo(i * 2, SIZE * 2); cx.stroke();
        cx.beginPath(); cx.moveTo(0, i * 2); cx.lineTo(SIZE * 2, i * 2); cx.stroke();
      }
      ref.forEach(s => line(s, L.colors ? colorOf(s.color) + '66' : '#b8bccb', 7, [10, 10]));
      done.forEach(s => line(s, colorOf(s.color), 5));
      if (partial) line(partial, colorOf(partial.color), 5);
      if (marks) {
        marks.missing.filter(p => !marks.wrongColor.includes(p)).forEach(p => dot(p, '#e53935'));
        marks.extra.forEach(p => dot(p, '#f59e0b'));
        marks.wrongColor.forEach((p, i) => { if (i % 6 === 0) ring(p, colorOf(p.color)); });
      }
      drawTurtle();
    }

    function dot(p, c) {
      const [x, y] = toCanvas(p.x, p.y);
      cx.fillStyle = c;
      cx.beginPath(); cx.arc(x, y, 5, 0, Math.PI * 2); cx.fill();
    }

    // кольцо цветом, который должен быть у линии
    function ring(p, c) {
      const [x, y] = toCanvas(p.x, p.y);
      cx.lineWidth = 4;
      cx.strokeStyle = '#ffffff';
      cx.beginPath(); cx.arc(x, y, 9, 0, Math.PI * 2); cx.stroke();
      cx.lineWidth = 3;
      cx.strokeStyle = c;
      cx.beginPath(); cx.arc(x, y, 9, 0, Math.PI * 2); cx.stroke();
    }

    function drawTurtle() {
      const [x, y] = toCanvas(turtle.x, turtle.y);
      cx.save();
      cx.translate(x, y);
      cx.rotate(-turtle.h * Math.PI / 180);
      cx.fillStyle = '#2e9e44';
      cx.strokeStyle = '#14532d';
      cx.lineWidth = 3;
      cx.beginPath();
      cx.moveTo(26, 0); cx.lineTo(-16, 16); cx.lineTo(-8, 0); cx.lineTo(-16, -16); cx.closePath();
      cx.fill(); cx.stroke();
      if (!turtle.pen) { cx.fillStyle = '#ffffff'; cx.beginPath(); cx.arc(-4, 0, 5, 0, Math.PI * 2); cx.fill(); }
      cx.restore();
    }

    function resetCanvas() {
      turtle = { x: start.x, y: start.y, h: start.h, pen: true, color: 'black' };
      done = [];
      marks = null;
      editor.setActive(0);
      editor.setError(0);
      setStatus('');
      render();
    }

    function setStatus(msg, kind) {
      status.className = 'rb-status' + (kind ? ' ' + kind : '');
      status.innerHTML = msg ? rich(msg) : '';
    }

    function drawGoals() {
      if (sandbox) return;
      const lines = TurtleSim.countLines(editor.getValue());
      goals.innerHTML = '';
      [
        [t('turtle.24'), lastResult === true],
        [t('robot.26') + L.maxLines + t('robot.27') + lines + ')', lines > 0 && lines <= L.maxLines],
        [t('turtle.25'), failedChecks === 0 && lastResult === true]
      ].forEach(([txt, ok]) => goals.append(h('li', { class: ok ? 'ok' : '' }, (ok ? '★ ' : '☆ ') + txt)));
    }

    // ---------------- запуск: сначала выполняем программу, потом анимируем действия
    function run() {
      if (paused) return;
      stop();
      const err = Py.check(editor.getValue());
      if (err) { editor.setError(err.line); setStatus('⚠ ' + err.msg, 'bad'); Sound.play('bad'); return; }
      resetCanvas();
      const res = TurtleSim.execute(editor.getValue(), start);
      anim = { list: res.T.actions, i: 0, t: 0, error: res.error, segs: res.T.segs };
      editor.setReadOnly(true);
      runBtn.disabled = true;
      raf = requestAnimationFrame(frame);
    }

    let lastTs = 0;
    function frame(ts) {
      if (!anim) return;
      const dt = lastTs ? Math.min(60, ts - lastTs) : 16;
      lastTs = ts;
      if (!paused) {
        let budget = dt;
        while (budget > 0 && anim && anim.i < anim.list.length) {
          const a = anim.list[anim.i];
          editor.setActive(a.line || 0);
          const dur = a.t === 'move' ? Math.hypot(a.s.x2 - a.s.x1, a.s.y2 - a.s.y1) / PX[speed - 1] * 1000
            : a.t === 'turn' ? Math.abs(a.to - a.from) / DEG[speed - 1] * 1000 : 0;
          const need = dur - anim.t;
          if (budget >= need) {
            budget -= need;
            apply(a, 1);
            anim.i++;
            anim.t = 0;
          } else {
            anim.t += budget;
            apply(a, anim.t / dur);
            budget = 0;
          }
        }
        if (anim && anim.i >= anim.list.length) { finish(); return; }
      }
      raf = requestAnimationFrame(frame);
    }

    function apply(a, k) {
      if (a.t === 'move') {
        const x = a.s.x1 + (a.s.x2 - a.s.x1) * k, y = a.s.y1 + (a.s.y2 - a.s.y1) * k;
        turtle.x = x; turtle.y = y;
        if (k >= 1) { if (a.pen && (a.s.x1 !== a.s.x2 || a.s.y1 !== a.s.y2)) done.push(a.s); render(); }
        else render(a.pen ? { x1: a.s.x1, y1: a.s.y1, x2: x, y2: y, color: a.s.color } : null);
      } else if (a.t === 'turn') {
        turtle.h = a.from + (a.to - a.from) * k;
        render();
      } else if (a.t === 'pen') { turtle.pen = a.on; render(); }
      else if (a.t === 'color') turtle.color = a.c;
    }

    function finish() {
      const a = anim;
      anim = null;
      lastTs = 0;
      editor.setReadOnly(false);
      runBtn.disabled = false;
      editor.setActive(0);
      if (a.error) {
        if (a.error.line) editor.setError(a.error.line);
        setStatus('⚠ ' + a.error.message, 'bad');
        Sound.play('bad');
        return;
      }
      if (sandbox) { setStatus(t('turtle.26'), 'ok'); return; }
      check(a.segs);
    }

    function check(segs) {
      const r = TurtleSim.compare(segs, ref, { colors: !!L.colors, tol: 4 });
      lastResult = r.ok;
      if (!r.ok) {
        failedChecks++;
        marks = r;
        render();
        const parts = [];
        if (r.missing.length > r.wrongColor.length) parts.push(t('turtle.27'));
        if (r.wrongColor.length) parts.push(t('turtle.28'));
        if (r.extra.length) parts.push(t('turtle.29'));
        setStatus(t('turtle.30') + parts.join('; ') + '.', 'bad');
        Sound.play('bad');
        drawGoals();
        return;
      }
      drawGoals();
      const lines = TurtleSim.countLines(editor.getValue());
      const stars = 1 + (lines <= L.maxLines ? 1 : 0) + (failedChecks === 0 ? 1 : 0);
      const gain = ctx.finishLevel(stars, stars * 50);
      setStatus(t('turtle.31'), 'ok');
      Sound.play('level');
      FX.confetti();
      const last = ctx.level >= ctx.levelCount;
      ctx.modal({
        title: t('turtle.32'),
        body: h('div', { class: 'rb-win' },
          h('div', { class: 'rb-win-stars', html: starsHTML(stars) }),
          h('p', null, gain ? '+' + gain + t('robot.31') : t('robot.32')),
          stars < 3 ? h('p', { class: 'muted' }, lines > L.maxLines ? t('turtle.33') : t('turtle.34')) : null),
        actions: [
          { label: t('robot.35') },
          last ? { label: t('robot.21'), primary: true, onclick: ctx.levels } : { label: t('robot.36'), primary: true, onclick: () => ctx.goLevel(ctx.level + 1) }
        ]
      });
    }

    function stop() {
      cancelAnimationFrame(raf);
      if (anim) {
        // мгновенно дорисовываем то, что уже выполнено, и останавливаемся
        anim = null;
        setStatus(t('turtle.35'));
      }
      lastTs = 0;
      editor.setReadOnly(false);
      runBtn.disabled = false;
      editor.setActive(0);
    }

    // PNG: только рисунок ученика на белом фоне
    function savePNG() {
      const out = document.createElement('canvas');
      out.width = SIZE * 2; out.height = SIZE * 2;
      const o = out.getContext('2d');
      o.fillStyle = '#ffffff';
      o.fillRect(0, 0, out.width, out.height);
      o.lineCap = 'round';
      o.lineWidth = 5;
      done.forEach(s => {
        o.strokeStyle = colorOf(s.color);
        o.beginPath(); o.moveTo(...toCanvas(s.x1, s.y1)); o.lineTo(...toCanvas(s.x2, s.y2)); o.stroke();
      });
      out.toBlob(b => {
        if (!b) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = 'cherepashka-' + (sandbox ? 'pesochnica' : 'uroven-' + ctx.level) + '.png';
        document.body.append(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      }, 'image/png');
    }

    resetCanvas();
    drawGoals();

    return {
      pause() { paused = true; },
      resume() { paused = false; lastTs = 0; },
      destroy() { cancelAnimationFrame(raf); anim = null; }
    };
  }
});
