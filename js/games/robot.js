/* Игра «Робот на клетчатом поле».
   RobotSim — модель мира (без DOM): используется игрой и tests.html.
   Карта: # стена, . пусто, R робот, $ монета, O яма, F финиш, P клетку нужно закрасить,
   K ключ, D закрытая дверь. Край поля — тоже стена. */
const RobotSim = (function () {
  'use strict';
  const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  const ORDER = ['N', 'E', 'S', 'W'];
  const SIZE = 8;

  // Генератор случайных чисел с зерном — чтобы тесты были воспроизводимыми
  function rng(seed) {
    let a = (seed === undefined ? Math.floor(Math.random() * 2 ** 31) : seed) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));

  function world(map, dir) {
    const grid = map.map(row => row.split(''));
    let x = 0, y = 0, coins = 0;
    const targets = new Set();   // клетки, которые нужно закрасить
    grid.forEach((row, j) => row.forEach((c, i) => {
      if (c === 'R') { x = i; y = j; row[i] = '.'; }
      if (c === '$') coins++;
      if (c === 'P') { targets.add(i + ',' + j); row[i] = '.'; }
    }));
    return { grid, x, y, dir: dir || 'E', coins, taken: 0, moves: 0, startX: x, startY: y, targets, painted: new Set(), keys: 0 };
  }

  function cell(W, x, y) {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return '#';
    return W.grid[y][x];
  }

  function ahead(W) {
    const [dx, dy] = DIRS[W.dir];
    return [W.x + dx, W.y + dy];
  }

  const noArgs = (name, args) => {
    if (args.length) throw new Error(t('robot.1') + name + t('robot.2'));
  };
  const turnOf = (dir, k) => ORDER[(ORDER.indexOf(dir) + k) % 4];
  // клетка слева или справа от робота (k = 3 — налево, 1 — направо)
  const side = (W, k) => { const [dx, dy] = DIRS[turnOf(W.dir, k)]; return cell(W, W.x + dx, W.y + dy); };
  const allPainted = W => Array.from(W.targets).every(k => W.painted.has(k));

  // Команды и датчики робота для интерпретатора. onAct(тип) вызывается при каждом действии.
  function builtins(W, onAct) {
    const act = k => { if (onAct) onAct(k); };
    return {
      // forward() — шаг, forward(3) — три шага подряд
      forward(...a) {
        if (a.length > 1 || (a.length === 1 && !(Number.isInteger(a[0]) && a[0] >= 1 && a[0] <= SIZE))) throw new Error(t('robot.38'));
        const n = a.length ? a[0] : 1;
        for (let k = 0; k < n; k++) {
          const [nx, ny] = ahead(W);
          const c = cell(W, nx, ny);
          if (c === '#') { W.crash = true; act('crash'); throw new Error(t('robot.3')); }
          if (c === 'D') { W.crash = true; act('crash'); throw new Error(t('robot.39')); }
          W.x = nx; W.y = ny; W.moves++;
          if (c === 'O') { W.fell = true; act('fall'); throw new Error(t('robot.4')); }
        }
        act('move');
      },
      left(...a) { noArgs('left', a); W.dir = turnOf(W.dir, 3); act('turn'); },
      right(...a) { noArgs('right', a); W.dir = turnOf(W.dir, 1); act('turn'); },
      // взять монету или ключ
      take(...a) {
        noArgs('take', a);
        const c = cell(W, W.x, W.y);
        if (c !== '$' && c !== 'K') throw new Error(t('robot.5'));
        W.grid[W.y][W.x] = '.';
        if (c === '$') { W.taken++; act('coin'); } else { W.keys++; act('key'); }
      },
      paint(...a) { noArgs('paint', a); W.painted.add(W.x + ',' + W.y); act('paint'); },
      // открыть дверь впереди — нужен ключ
      open(...a) {
        noArgs('open', a);
        const [nx, ny] = ahead(W);
        if (cell(W, nx, ny) !== 'D') throw new Error(t('robot.40'));
        if (!W.keys) throw new Error(t('robot.41'));
        W.keys--;
        W.grid[ny][nx] = '.';
        act('door');
      },
      wall_ahead(...a) { noArgs('wall_ahead', a); return cell(W, ...ahead(W)) === '#'; },
      wall_left(...a) { noArgs('wall_left', a); return side(W, 3) === '#'; },
      wall_right(...a) { noArgs('wall_right', a); return side(W, 1) === '#'; },
      hole_ahead(...a) { noArgs('hole_ahead', a); return cell(W, ...ahead(W)) === 'O'; },
      door_ahead(...a) { noArgs('door_ahead', a); return cell(W, ...ahead(W)) === 'D'; },
      coin_here(...a) { noArgs('coin_here', a); return cell(W, W.x, W.y) === '$'; },
      key_here(...a) { noArgs('key_here', a); return cell(W, W.x, W.y) === 'K'; },
      need_paint(...a) { noArgs('need_paint', a); const k = W.x + ',' + W.y; return W.targets.has(k) && !W.painted.has(k); },
      at_finish(...a) { noArgs('at_finish', a); return cell(W, W.x, W.y) === 'F'; }
    };
  }

  const atFinish = W => cell(W, W.x, W.y) === 'F';
  // уровень пройден: робот на флажке и все отмеченные клетки закрашены
  const won = W => atFinish(W) && allPainted(W);

  function countLines(code) {
    return code.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length;
  }

  function stars(W, level, code) {
    if (!won(W)) return 0;
    let s = 1;
    if (W.taken === W.coins) s++;
    if (!level.maxLines || countLines(code) <= level.maxLines) s++;
    return s;
  }

  // ---------------------------------------------------------------- случайные карты
  const blank = ch => Array.from({ length: SIZE }, () => Array(SIZE).fill(ch));
  const toMap = g => g.map(r => r.join(''));
  const dirTo = (a, b) => (b[0] > a[0] ? 'E' : b[0] < a[0] ? 'W' : b[1] > a[1] ? 'S' : 'N');

  // Прямой коридор случайной длины со случайными монетами
  function genCorridor(r) {
    const g = blank('#');
    const vertical = r() < 0.5;
    const len = ri(r, 4, 8);
    const fixed = ri(r, 0, SIZE - 1), start = ri(r, 0, SIZE - len);
    const cells = [];
    for (let k = 0; k < len; k++) cells.push(vertical ? [fixed, start + k] : [start + k, fixed]);
    if (r() < 0.5) cells.reverse();
    cells.forEach(([x, y], k) => { g[y][x] = k === 0 ? 'R' : k === len - 1 ? 'F' : r() < 0.45 ? '$' : '.'; });
    return { map: toMap(g), dir: dirTo(cells[0], cells[1]) };
  }

  // Извилистая дорожка: повороты то налево, то направо
  function genSnake(r) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const path = [[ri(r, 0, SIZE - 1), ri(r, 0, SIZE - 1)]];
      const inPath = (x, y) => path.some(p => p[0] === x && p[1] === y);
      let dir = ORDER[ri(r, 0, 3)], turns = 0;
      const free = (x, y, from) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && !inPath(x, y) &&
        Object.values(DIRS).every(([dx, dy]) => {
          const nx = x + dx, ny = y + dy;
          return (nx === from[0] && ny === from[1]) || !inPath(nx, ny);
        });
      const step = d => {
        const last = path[path.length - 1];
        const n = [last[0] + DIRS[d][0], last[1] + DIRS[d][1]];
        if (!free(n[0], n[1], last)) return false;
        path.push(n);
        return true;
      };
      for (let seg = 0; seg < 12; seg++) {
        const len = ri(r, 2, 4);
        let moved = 0;
        while (moved < len && step(dir)) moved++;
        if (moved === 0 && seg > 0) break;
        const i = ORDER.indexOf(dir);
        const opts = r() < 0.5 ? [1, 3] : [3, 1];
        const last = path[path.length - 1];
        const next = opts.map(k => ORDER[(i + k) % 4]).find(d => free(last[0] + DIRS[d][0], last[1] + DIRS[d][1], last));
        if (!next) break;
        // поворачиваем, только если после поворота можно сделать хотя бы шаг
        if (!step(next)) break;
        dir = next;
        turns++;
      }
      if (path.length >= 11 && turns >= 3) {
        const g = blank('#');
        path.forEach(([x, y], k) => { g[y][x] = k === 0 ? 'R' : k === path.length - 1 ? 'F' : '.'; });
        return { map: toMap(g), dir: dirTo(path[0], path[1]) };
      }
    }
    return genCorridor(r);
  }

  // Две полосы с ямами: при яме нужно перестроиться в другую полосу (нужна переменная!)
  function genLanes(r) {
    const g = blank('#');
    for (let x = 0; x < SIZE; x++) { g[3][x] = '.'; g[4][x] = '.'; }
    g[3][0] = 'R';
    g[3][7] = 'F';
    g[4][7] = 'F';
    // ямы не стоят в соседних столбцах — иначе перестроиться было бы некуда
    const xs = [[1, 3, 5], [1, 3, 6], [1, 4, 6], [2, 4, 6], [2, 5], [1, 4], [3, 6]][Math.floor(r() * 7)];
    let lanes;
    do { lanes = xs.map(() => (r() < 0.5 ? 3 : 4)); } while (!lanes.includes(3) || !lanes.includes(4));
    xs.forEach((x, k) => { g[lanes[k]][x] = 'O'; });
    return { map: toMap(g), dir: 'E' };
  }

  // Идеальный лабиринт 4×4 комнаты — проходится правилом «правой руки»
  function genMaze(r) {
    const g = blank('#');
    const N = 4, seen = new Set();
    const stack = [[0, 0]];
    seen.add('0,0');
    g[0][0] = '.';
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const nb = Object.values(DIRS).map(([dx, dy]) => [cx + dx, cy + dy, dx, dy])
        .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < N && ny < N && !seen.has(nx + ',' + ny));
      if (!nb.length) { stack.pop(); continue; }
      const [nx, ny, dx, dy] = nb[Math.floor(r() * nb.length)];
      g[cy * 2 + dy][cx * 2 + dx] = '.';
      g[ny * 2][nx * 2] = '.';
      seen.add(nx + ',' + ny);
      stack.push([nx, ny]);
    }
    const corners = [[6, 6], [6, 0], [0, 6]];
    const [fx, fy] = corners[Math.floor(r() * corners.length)];
    g[fy][fx] = 'F';
    g[0][0] = 'R';
    const dir = g[0][1] === '.' ? 'E' : 'S';
    return { map: toMap(g), dir };
  }

  // Извилистая тропа, на которой нужно закрасить случайные клетки и собрать монеты
  function genPaint(r) {
    const m = genSnake(r);
    const g = m.map.map(row => row.split(''));
    let painted = 0;
    g.forEach(row => row.forEach((c, i) => {
      if (c !== '.') return;
      const v = r();
      if (v < 0.35) { row[i] = 'P'; painted++; } else if (v < 0.55) row[i] = '$';
    }));
    if (!painted) g.some(row => row.some((c, i) => (c === '.' || c === '$') && (row[i] = 'P')));
    return { map: toMap(g), dir: m.dir };
  }

  // Коридор с дверями: перед каждой дверью где-то лежит ключ
  function genDoors(r) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const c = genCorridor(r);
      const g = c.map.map(row => row.split(''));
      const path = [];
      let x = 0, y = 0;
      g.forEach((row, j) => row.forEach((ch, i) => { if (ch === 'R') { x = i; y = j; } }));
      const [dx, dy] = DIRS[c.dir];
      while (g[y] && g[y][x] && g[y][x] !== '#') { path.push([x, y]); if (g[y][x] === 'F') break; x += dx; y += dy; }
      if (path.length < 6) continue;
      const inner = path.slice(1, -1);
      inner.forEach(([i, j]) => { g[j][i] = r() < 0.3 ? '$' : '.'; });
      // 1–2 двери, ключ — на одной из клеток до двери
      const doors = r() < 0.5 || inner.length < 5 ? 1 : 2;
      let from = 0, ok = true;
      for (let d = 0; d < doors; d++) {
        const lo = from + 1, hi = inner.length - 1 - (doors - 1 - d) * 2;
        if (hi < lo) { ok = false; break; }
        const di = ri(r, lo, hi), ki = ri(r, from, di - 1);
        g[inner[di][1]][inner[di][0]] = 'D';
        g[inner[ki][1]][inner[ki][0]] = 'K';
        from = di + 1;
      }
      if (ok) return { map: toMap(g), dir: c.dir };
    }
    return { map: ['........', '........', '........', 'RK.D...F', '........', '........', '........', '........'], dir: 'E' };
  }

  const GENERATORS = { corridor: genCorridor, snake: genSnake, lanes: genLanes, maze: genMaze, paint: genPaint, doors: genDoors };

  // Карта уровня: фиксированная или новая случайная
  function mapFor(level, seed) {
    if (level.random) return GENERATORS[level.random](rng(seed));
    return { map: level.map, dir: level.dir };
  }

  // Полный прогон без анимации — для tests.html
  function run(level, code, seed) {
    const m = mapFor(level, seed);
    const W = world(m.map, m.dir);
    const r = Py.run(code, { builtins: builtins(W) });
    return { ok: r.ok, error: r.error, win: r.ok && won(W), stars: r.ok ? stars(W, level, code) : 0, world: W, map: m.map };
  }

  return { world, builtins, cell, atFinish, won, allPainted, stars, countLines, mapFor, run, rng, SIZE, DIRS };
})();

// ======================================================================= игра
if (typeof Games !== 'undefined') Games.register('robot', {
  levels: true,
  tutorial: [
    { title: t('robot.6'), text: t('robot.7'), code: 'forward()\nforward()\nright()\nforward()' },
    { title: t('robot.8'), text: t('robot.9'), code: 'if coin_here():\n    take()' },
    { title: t('robot.10'), text: t('robot.11'), code: 'while not at_finish():\n    if wall_ahead():\n        right()\n    else:\n        forward()' },
    { title: t('robot.42'), text: t('robot.43'), code: 'forward(3)\nif need_paint():\n    paint()\nif door_ahead():\n    open()' },
    { title: t('stars'), text: t('robot.12') }
  ],

  mount(host, ctx) {
    const L = ctx.levelData;
    const g = Progress.game('robot');
    g.code = g.code || {};
    const SPEED = [900, 600, 380, 220, 110];
    let speed = Math.min(5, Math.max(1, +(g.speed || CONFIG.defaultSpeed)));
    let W = null, gen = null, timer = null, running = false, map = null, lastAct = null, finished = false;

    // ---------------- разметка
    const board = h('div', { class: 'rb-board', role: 'img', 'aria-label': t('robot.13') });
    const robotEl = h('div', { class: 'rb-robot' }, h('span', { class: 'rb-face' }, '🤖'), h('span', { class: 'rb-arrow' }));
    const status = h('div', { class: 'rb-status', 'aria-live': 'polite' });
    const edHost = h('div', { class: 'rb-editor' });
    const palette = h('div', { class: 'rb-palette' });
    const goals = h('ul', { class: 'rb-goals' });
    const btn = (label, cls, fn, title) => h('button', { class: 'btn ' + cls, onclick: fn, title: title || null }, label);
    const runBtn = btn(t('robot.14'), 'primary', () => start(false));
    const stepBtn = btn(t('robot.15'), '', () => start(true));
    const stopBtn = btn(t('robot.16'), '', stop);
    const resetBtn = btn(t('robot.17'), '', () => reset(true));
    const speedIn = h('input', { type: 'range', min: '1', max: '5', value: String(speed), 'aria-label': t('robot.18') });
    speedIn.addEventListener('input', () => { speed = +speedIn.value; g.speed = speed; Progress.save(); });

    host.append(h('div', { class: 'rb-layout' },
      h('div', { class: 'rb-left' },
        h('div', { class: 'rb-level-head' }, h('b', null, t('robot.19') + ctx.level + t('app.1') + ctx.levelCount + ': ' + L.title)),
        board, status, goals),
      h('div', { class: 'rb-right' },
        h('p', { class: 'rb-task', html: rich(L.hint) }),
        palette, edHost,
        h('div', { class: 'rb-controls' }, runBtn, stepBtn, stopBtn, resetBtn,
          h('label', { class: 'rb-speed' }, '🐢', speedIn, '🐇')),
        h('div', { class: 'row wrap' },
          ctx.level > 1 ? btn(t('robot.20') + (ctx.level - 1), 'small ghost', () => ctx.goLevel(ctx.level - 1)) : null,
          btn(t('robot.21'), 'small ghost', ctx.levels),
          ctx.teacher ? btn(t('robot.22'), 'small ghost', () => editor.setValue(L.solution)) : null))));

    const editor = Editor.create(edHost, {
      value: g.code[ctx.level] !== undefined ? g.code[ctx.level] : (L.starter || ''),
      onChange(v) { g.code[ctx.level] = v; Progress.save(); if (!running) reset(false); }
    });

    (L.allowed || []).forEach(cmd => palette.append(h('button', { class: 'chip code-chip', onclick: () => editor.insertCommand(cmd) }, cmd)));

    // ---------------- поле
    function newWorld(regenerate) {
      if (!map || regenerate) map = RobotSim.mapFor(L);
      W = RobotSim.world(map.map, map.dir);
    }

    function drawBoard() {
      board.innerHTML = '';
      W.grid.forEach((row, y) => row.forEach((c, x) => {
        const cls = c === '#' ? 'wall' : c === 'O' ? 'hole' : c === 'F' ? 'finish' : c === 'D' ? 'door' : '';
        const k = x + ',' + y;
        const paint = W.painted.has(k) ? ' painted' : W.targets.has(k) ? ' target' : '';
        board.append(h('div', { class: 'rb-cell ' + cls + paint + ((x + y) % 2 ? ' odd' : ''), 'data-xy': k },
          c === '$' ? h('span', { class: 'rb-coin' }, '🪙') : c === 'K' ? h('span', { class: 'rb-coin' }, '🔑') : c === 'D' ? '🚪' : c === 'F' ? '🚩' : c === 'O' ? '🕳️' : null));
      }));
      board.append(robotEl);
      placeRobot(true);
    }

    const ANG = { N: 0, E: 90, S: 180, W: 270 };
    let angle = 90;
    function placeRobot(instant) {
      robotEl.classList.toggle('instant', !!instant);
      const target = ANG[W.dir];
      let diff = ((target - angle) % 360 + 540) % 360 - 180;
      angle += diff;
      robotEl.style.left = (W.x * 12.5) + '%';
      robotEl.style.top = (W.y * 12.5) + '%';
      robotEl.style.setProperty('--ang', angle + 'deg');
      robotEl.style.setProperty('--dur', Math.min(SPEED[speed - 1], 450) + 'ms');
      robotEl.classList.toggle('crash', !!W.crash);
      robotEl.classList.toggle('fell', !!W.fell);
    }

    function drawGoals() {
      const lines = RobotSim.countLines(editor.getValue());
      const items = [
        [t('robot.23'), W && RobotSim.atFinish(W)],
        ...(W && W.targets.size ? [[t('robot.44', { n: Array.from(W.targets).filter(k => W.painted.has(k)).length, total: W.targets.size }), RobotSim.allPainted(W)]] : []),
        [W && W.coins ? t('robot.24') + (W ? W.taken : 0) + t('app.1') + W.coins + ')' : t('robot.25'), W && W.taken === W.coins],
        [t('robot.26') + L.maxLines + t('robot.27') + lines + ')', lines <= L.maxLines && lines > 0]
      ];
      goals.innerHTML = '';
      items.forEach(([txt, ok]) => goals.append(h('li', { class: ok ? 'ok' : '' }, (ok ? '★ ' : '☆ ') + txt)));
    }

    function setStatus(msg, kind) {
      status.className = 'rb-status' + (kind ? ' ' + kind : '');
      status.innerHTML = msg ? rich(msg) : '';
    }

    function setRunning(v) {
      running = v;
      editor.setReadOnly(v);
      runBtn.disabled = v && !!timer;
      resetBtn.disabled = false;
    }

    // ---------------- выполнение
    function reset(regenerate) {
      clearTimeout(timer);
      timer = null;
      gen = null;
      finished = false;
      newWorld(regenerate);
      drawBoard();
      editor.setActive(0);
      editor.setError(0);
      setRunning(false);
      drawGoals();
      setStatus(L.random ? t('robot.28') : '');
    }

    function compile() {
      const err = Py.check(editor.getValue());
      if (err) {
        editor.setError(err.line);
        setStatus('⚠ ' + err.msg, 'bad');
        Sound.play('bad');
        return false;
      }
      newWorld(!!L.random);
      drawBoard();
      gen = Py.steps(editor.getValue(), {
        maxSteps: CONFIG.maxSteps,
        snap: false,
        builtins: RobotSim.builtins(W, k => { lastAct = k; })
      });
      finished = false;
      return true;
    }

    function start(stepMode) {
      if (ctx.paused) return;
      // новая программа — новый запуск (и новая карта на случайных уровнях)
      if (!gen && !compile()) return;
      setStatus('');
      if (stepMode) {
        clearTimeout(timer);
        timer = null;
        setRunning(true);
        tick(true);
      } else {
        setRunning(true);
        runBtn.disabled = true;
        tick(false);
      }
    }

    function tick(single) {
      timer = null;
      if (!gen) return;
      lastAct = null;
      let r;
      try { r = gen.next(); }
      catch (e) { return fail(e); }
      if (r.done) return done();
      editor.setActive(r.value.line);
      placeRobot(false);
      if (lastAct === 'coin' || lastAct === 'key') { Sound.play('coin'); drawCoinTaken(); drawGoals(); }
      else if (lastAct === 'paint') { Sound.play('click'); drawCell(); drawGoals(); }
      else if (lastAct === 'door') { Sound.play('ok'); drawCell(true); }
      else if (lastAct === 'move') Sound.play('step');
      if (single) { runBtn.disabled = false; return; }
      const d = SPEED[speed - 1];
      timer = setTimeout(() => tick(false), lastAct ? d : Math.round(d / 4));
    }

    // клетка под роботом закрашена или дверь впереди открыта
    function drawCell(door) {
      const [x, y] = door ? [W.x + RobotSim.DIRS[W.dir][0], W.y + RobotSim.DIRS[W.dir][1]] : [W.x, W.y];
      const el = board.querySelector('[data-xy="' + x + ',' + y + '"]');
      if (!el) return;
      if (door) { el.classList.remove('door'); el.textContent = ''; }
      else { el.classList.remove('target'); el.classList.add('painted'); }
    }

    function drawCoinTaken() {
      const c = board.querySelector('[data-xy="' + W.x + ',' + W.y + '"] .rb-coin');
      if (c) { c.classList.add('gone'); setTimeout(() => c.remove(), 400); }
    }

    function fail(e) {
      placeRobot(false);
      gen = null;
      finished = true;
      setRunning(false);
      const line = e.line || null;
      editor.setActive(0);
      if (line) editor.setError(line);
      setStatus('⚠ ' + e.message, 'bad');
      Sound.play(W.crash || W.fell ? 'boom' : 'bad');
      FX.shake(board);
    }

    function done() {
      gen = null;
      finished = true;
      setRunning(false);
      editor.setActive(0);
      drawGoals();
      if (RobotSim.atFinish(W) && !RobotSim.allPainted(W)) {
        setStatus(t('robot.45'), 'bad');
        Sound.play('bad');
        return;
      }
      if (!RobotSim.atFinish(W)) {
        setStatus(t('robot.29'), 'bad');
        Sound.play('bad');
        return;
      }
      const st = RobotSim.stars(W, L, editor.getValue());
      const gain = ctx.finishLevel(st, st * 50);
      Sound.play('level');
      FX.confetti();
      const last = ctx.level >= ctx.levelCount;
      ctx.modal({
        title: t('robot.30'),
        body: h('div', { class: 'rb-win' },
          h('div', { class: 'rb-win-stars', html: starsHTML(st) }),
          h('p', null, gain ? '+' + gain + t('robot.31') : t('robot.32')),
          st < 3 ? h('p', { class: 'muted' }, t('robot.33')) : null,
          L.random ? h('p', { class: 'muted' }, t('robot.34')) : null),
        actions: [
          { label: t('robot.35') },
          last ? { label: t('robot.21'), primary: true, onclick: ctx.levels } : { label: t('robot.36'), primary: true, onclick: () => ctx.goLevel(ctx.level + 1) }
        ]
      });
    }

    function stop() {
      clearTimeout(timer);
      timer = null;
      if (gen) { gen = null; finished = true; setStatus(t('robot.37')); }
      setRunning(false);
      editor.setActive(0);
    }

    reset(true);

    return {
      pause() { if (timer) { clearTimeout(timer); timer = 'paused'; } },
      resume() { if (timer === 'paused') { timer = null; tick(false); } },
      destroy() { clearTimeout(timer); timer = null; gen = null; }
    };
  }
});
