/* Игра «Микромышь»: мышь ищет путь к центру лабиринта, которого не видит.
   Как на соревнованиях — два забега: в первом мышь исследует лабиринт, во втором,
   помня найденные стены, должна дойти до центра кратчайшим путём.
   MouseSim — модель (без DOM): используется игрой, турниром и tests.html.
   Стены клетки — битовая маска: 1 — север, 2 — восток, 4 — юг, 8 — запад.
   Направления в командах — числа 0 (север), 1 (восток), 2 (юг), 3 (запад). */
const MouseSim = (function () {
  'use strict';
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  const BIT = [1, 2, 4, 8];
  const OPP = d => (d + 2) % 4;

  // Генератор случайных чисел с зерном — чтобы лабиринт уровня всегда был одинаковым
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

  // Цель — центр: 2×2 клетки при чётном размере, одна клетка — при нечётном
  function goalCells(n) {
    const a = Math.floor((n - 1) / 2), b = Math.floor(n / 2);
    const out = [];
    for (let y = a; y <= b; y++) for (let x = a; x <= b; x++) out.push([x, y]);
    return out;
  }

  // Лабиринт n×n: сначала без колец (обход в глубину), потом убираем loops стен — появляются кольца.
  // Внутри центра 2×2 стен нет, вход в центр — один (как на настоящих соревнованиях), если entrances = 1.
  function generate(n, seed, loops) {
    const r = rng(seed);
    const walls = Array.from({ length: n }, () => Array(n).fill(15));
    const open = (x, y, d) => {
      walls[y][x] &= ~BIT[d];
      walls[y + DY[d]][x + DX[d]] &= ~BIT[OPP(d)];
    };
    const goal = goalCells(n);
    const inGoal = (x, y) => goal.some(g => g[0] === x && g[1] === y);
    // центр — одна «комната»: открываем стены между клетками цели и считаем её посещённой целиком
    const seen = Array.from({ length: n }, () => Array(n).fill(false));
    goal.forEach(([x, y]) => {
      seen[y][x] = true;
      for (let d = 0; d < 4; d++) { const nx = x + DX[d], ny = y + DY[d]; if (inGoal(nx, ny)) walls[y][x] &= ~BIT[d]; }
    });
    // лабиринт растёт от старта; в центр ведёт один проход
    const stack = [[0, n - 1]];
    seen[n - 1][0] = true;
    let entered = false;
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const nb = [];
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d], ny = cy + DY[d];
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        if (inGoal(nx, ny)) { if (!entered) nb.push([nx, ny, d, true]); continue; }
        if (!seen[ny][nx]) nb.push([nx, ny, d, false]);
      }
      if (!nb.length) { stack.pop(); continue; }
      const [nx, ny, d, toGoal] = nb[Math.floor(r() * nb.length)];
      open(cx, cy, d);
      if (toGoal) { entered = true; continue; }
      seen[ny][nx] = true;
      stack.push([nx, ny]);
    }
    // кольца: убираем случайные внутренние стены (не трогая центр)
    let tries = 0, removed = 0;
    while (removed < (loops || 0) && tries++ < 2000) {
      const x = Math.floor(r() * n), y = Math.floor(r() * n), d = Math.floor(r() * 4);
      const nx = x + DX[d], ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= n || ny >= n || !(walls[y][x] & BIT[d])) continue;
      if (inGoal(x, y) || inGoal(nx, ny)) continue;
      open(x, y, d);
      removed++;
    }
    return { n, walls, goal, start: [0, n - 1], dir: 0 };
  }

  const hasWall = (m, x, y, d) => !!(m.walls[y][x] & BIT[d]);
  const isGoal = (m, x, y) => m.goal.some(g => g[0] === x && g[1] === y);

  // Кратчайший путь от старта до центра (поиск в ширину) — список клеток
  function shortestPath(m) {
    const prev = Array.from({ length: m.n }, () => Array(m.n).fill(null));
    const [sx, sy] = m.start;
    const q = [[sx, sy]];
    prev[sy][sx] = [sx, sy];
    while (q.length) {
      const [x, y] = q.shift();
      if (isGoal(m, x, y)) {
        const path = [[x, y]];
        let c = [x, y];
        while (c[0] !== sx || c[1] !== sy) { c = prev[c[1]][c[0]]; path.unshift(c); }
        return path;
      }
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (!hasWall(m, x, y, d) && !prev[ny][nx]) { prev[ny][nx] = [x, y]; q.push([nx, ny]); }
      }
    }
    return null;
  }

  // Мир мыши. known — стены, которые мышь уже видела (переносятся во второй забег), fog: false — видно всё сразу.
  function world(m, fog) {
    const n = m.n;
    const W = {
      m, n, fog: fog !== false,
      known: Array.from({ length: n }, () => Array(n).fill(0)),
      seen: Array.from({ length: n }, () => Array(n).fill(false)),
      labels: null, run: 0
    };
    // внешняя рамка известна всегда
    for (let i = 0; i < n; i++) {
      W.known[0][i] |= 1; W.known[n - 1][i] |= 4; W.known[i][0] |= 8; W.known[i][n - 1] |= 2;
    }
    if (!W.fog) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { W.known[y][x] = m.walls[y][x]; W.seen[y][x] = true; }
    startRun(W, 1);
    return W;
  }

  // Новый забег: мышь на старте, счётчики заново, а память о стенах остаётся
  function startRun(W, run) {
    W.run = run;
    [W.x, W.y] = W.m.start;
    W.dir = W.m.dir;
    W.moves = 0;
    W.turns = 0;
    W.path = [[W.x, W.y]];
    W.visits = Array.from({ length: W.n }, () => Array(W.n).fill(0));
    W.crash = false;
    look(W);
  }

  // мышь видит стены вокруг своей клетки
  function look(W) {
    const { x, y } = W;
    W.seen[y][x] = true;
    W.visits[y][x]++;
    for (let d = 0; d < 4; d++) {
      if (!hasWall(W.m, x, y, d)) continue;
      W.known[y][x] |= BIT[d];
      const nx = x + DX[d], ny = y + DY[d];
      if (nx >= 0 && ny >= 0 && nx < W.n && ny < W.n) W.known[ny][nx] |= BIT[OPP(d)];
    }
  }

  const atGoal = W => isGoal(W.m, W.x, W.y);
  const MAX_MOVES = n => n * n * 10;
  const inside = (W, x, y) => x >= 0 && y >= 0 && x < W.n && y < W.n;

  function argNone(name, a) { if (a.length) throw new Error(t('mouse.e.noArgs', { f: name })); }
  function argInt(name, v, lo, hi, example) {
    if (!Number.isInteger(v) || v < lo || v > hi) throw new Error(t('mouse.e.int', { f: name, lo, hi, ex: example }));
    return v;
  }

  // Команды и датчики мыши для интерпретатора. onAct(тип) — при каждом действии (для анимации).
  function builtins(W, onAct) {
    const act = k => { if (onAct) onAct(k); };
    const turn = k => { W.dir = (W.dir + k) % 4; W.turns++; act('turn'); };
    const sideWall = k => hasWall(W.m, W.x, W.y, (W.dir + k) % 4);
    const sideVisits = k => {
      const d = (W.dir + k) % 4;
      if (hasWall(W.m, W.x, W.y, d)) return -1;
      return W.visits[W.y + DY[d]][W.x + DX[d]];
    };
    return {
      forward(...a) {
        if (a.length > 1) throw new Error(t('mouse.e.forward'));
        const steps = a.length ? argInt('forward', a[0], 1, W.n, '3') : 1;
        for (let k = 0; k < steps; k++) {
          if (hasWall(W.m, W.x, W.y, W.dir)) { W.crash = true; act('crash'); throw new Error(t('mouse.e.crash')); }
          // мышь, которая ходит по кругу, останавливаем: в лабиринте n×n хватает и 10·n² шагов
          if (W.moves >= MAX_MOVES(W.n)) throw new Error(t('mouse.e.loop', { n: MAX_MOVES(W.n) }));
          W.x += DX[W.dir]; W.y += DY[W.dir]; W.moves++;
          W.path.push([W.x, W.y]);
          look(W);
          act('move');
        }
      },
      left(...a) { argNone('left', a); turn(3); },
      right(...a) { argNone('right', a); turn(1); },
      back(...a) { argNone('back', a); turn(2); },
      // повернуться в сторону света d (0 — север, 1 — восток, 2 — юг, 3 — запад)
      turn_to(...a) {
        if (a.length !== 1) throw new Error(t('mouse.e.turnTo'));
        const d = argInt('turn_to', a[0], 0, 3, '1');
        const k = (d - W.dir + 4) % 4;
        if (k === 1) turn(1); else if (k === 2) turn(2); else if (k === 3) turn(3);
      },
      wall_front(...a) { argNone('wall_front', a); return sideWall(0); },
      wall_left(...a) { argNone('wall_left', a); return sideWall(3); },
      wall_right(...a) { argNone('wall_right', a); return sideWall(1); },
      visits_front(...a) { argNone('visits_front', a); return sideVisits(0); },
      visits_left(...a) { argNone('visits_left', a); return sideVisits(3); },
      visits_right(...a) { argNone('visits_right', a); return sideVisits(1); },
      at_goal(...a) { argNone('at_goal', a); return atGoal(W); },
      x(...a) { argNone('x', a); return W.x; },
      y(...a) { argNone('y', a); return W.y; },
      facing(...a) { argNone('facing', a); return W.dir; },
      size(...a) { argNone('size', a); return W.n; },
      is_goal(...a) {
        if (a.length !== 2) throw new Error(t('mouse.e.xy', { f: 'is_goal' }));
        return isGoal(W.m, argInt('is_goal', a[0], 0, W.n - 1, '3'), argInt('is_goal', a[1], 0, W.n - 1, '3'));
      },
      // стена у клетки (x, y) со стороны d — только та, которую мышь уже видела. Неизвестное считается проходом.
      wall(...a) {
        if (a.length !== 3) throw new Error(t('mouse.e.wall'));
        const x = argInt('wall', a[0], 0, W.n - 1, '3'), y = argInt('wall', a[1], 0, W.n - 1, '3'), d = argInt('wall', a[2], 0, 3, '1');
        return !!(W.known[y][x] & BIT[d]);
      },
      // показать числа на клетках: show(dist), где dist — список строк лабиринта
      show(...a) {
        const g = a[0];
        if (a.length !== 1 || !Array.isArray(g)) throw new Error(t('mouse.e.show'));
        W.labels = g.map(row => (Array.isArray(row) ? row.map(v => (v === null || v === undefined ? '' : String(v))) : []));
        act('show');
      }
    };
  }

  function countLines(code) {
    return code.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length;
  }

  // Цели уровня → звёзды. goals: ['goal', 'lines', 'explore', 'shortest', 'shortest1', 'faster'] — первая всегда 'goal'.
  // shortest — второй забег кратчайший, shortest1 — уже первый (когда лабиринт виден целиком).
  function goalsMet(level, res) {
    const best = res.shortest;
    return level.goals.map(g => {
      if (g === 'goal') return !!res.run1.win;
      if (g === 'lines') return !!res.run1.win && res.lines <= level.maxLines;
      if (g === 'explore') return !!res.run1.win && res.run1.moves <= exploreLimit(level, best);
      if (g === 'shortest') return !!(res.run2 && res.run2.win && res.run2.moves === best);
      if (g === 'shortest1') return !!res.run1.win && res.run1.moves === best;
      if (g === 'faster') return !!(res.run2 && res.run2.win && res.run2.moves < res.run1.moves);
      return false;
    });
  }
  // предел шагов первого забега: число или во сколько раз длиннее кратчайшего пути
  const exploreLimit = (level, best) => (level.explore ? level.explore : Math.ceil(best * (level.exploreK || 3)));

  const mazeFor = (level, seed) => generate(level.size, level.random ? (seed === undefined ? undefined : seed) : level.seed, level.loops || 0);

  // Полный прогон двух забегов без анимации — для tests.html и турнира
  function run(level, code, seed, maxSteps) {
    const m = mazeFor(level, seed);
    const W = world(m, level.fog);
    const best = shortestPath(m).length - 1;
    const once = () => {
      const r = Py.run(code, { builtins: builtins(W), maxSteps: maxSteps || STEPS });
      return { ok: r.ok, error: r.error, win: r.ok && atGoal(W), moves: W.moves, path: W.path.slice() };
    };
    const run1 = once();
    let run2 = null;
    if (run1.win) { startRun(W, 2); run2 = once(); }
    const res = { run1, run2, shortest: best, lines: countLines(code), maze: m };
    res.met = goalsMet(level, res);
    res.stars = res.met.filter(Boolean).length;
    return res;
  }

  // Мыши думают дольше робота (волновой алгоритм на каждом шаге), поэтому и лимит шагов больше
  const STEPS = 2000000;

  return { generate, goalCells, shortestPath, world, startRun, builtins, atGoal, hasWall, isGoal, countLines, goalsMet, exploreLimit, mazeFor, run, rng, inside, DX, DY, BIT, STEPS };
})();

// ======================================================================= поле
// Поле лабиринта: клетки (туман, центр, след), стены — рамками клеток, числа из show(), мыши, пунктир кратчайшего пути.
function MouseBoard(n) {
  const el = h('div', { class: 'mo-board' });
  el.style.setProperty('--n', n);   // размер сетки для CSS
  const cells = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const c = h('div', { class: 'mo-cell' }, h('span', { class: 'mo-label' }));
    cells.push(c);
    el.append(c);
  }
  const overlay = h('div', { class: 'mo-overlay' });
  el.append(overlay);
  const mice = [];

  // W — мир мыши, opts: { reveal — показать все стены бледно, all — видно всё (турнир), trail — след забега }
  function draw(W, opts) {
    opts = opts || {};
    const m = W.m;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const c = cells[y * n + x], k = W.known[y][x], real = m.walls[y][x];
      const cls = ['mo-cell'];
      if (!opts.all && !W.seen[y][x]) cls.push('fog');
      if (MouseSim.isGoal(m, x, y)) cls.push('goal');
      if (x === m.start[0] && y === m.start[1]) cls.push('start');
      ['n', 'e', 's', 'w'].forEach((side, d) => {
        const bit = MouseSim.BIT[d];
        if (opts.all ? real & bit : k & bit) cls.push('w' + side);
        else if (opts.reveal && real & bit) cls.push('g' + side);
      });
      c.className = cls.join(' ');
      const lab = W.labels && W.labels[y] && W.labels[y][x] !== undefined ? W.labels[y][x] : '';
      c.firstChild.textContent = lab === '-1' ? '' : lab;
    }
    if (opts.trail) trail(W.path, 'mo-trail');
  }

  // линия через центры клеток (след мыши или кратчайший путь)
  function line(path, cls) {
    const pts = path.map(([x, y]) => (x + 0.5) + ',' + (y + 0.5)).join(' ');
    return '<polyline class="' + cls + '" points="' + pts + '" />';
  }
  function trail(path, cls) { setLines([[path, cls]]); }
  function setLines(list) {
    overlay.innerHTML = '<svg viewBox="0 0 ' + n + ' ' + n + '" preserveAspectRatio="none" aria-hidden="true">' +
      list.filter(([p]) => p && p.length > 1).map(([p, c]) => line(p, c)).join('') + '</svg>';
  }

  // мышь № i (в турнире их несколько, у каждой свой цвет)
  function mouse(i, color) {
    if (!mice[i]) {
      const m = h('div', { class: 'mo-mouse' }, h('span', { class: 'mo-face' }, '🐭'), h('span', { class: 'mo-arrow' }));
      if (color) { m.style.setProperty('--mc', color); m.classList.add('colored'); }
      m.angle = 0;
      mice[i] = m;
      el.append(m);
    }
    return mice[i];
  }
  const ANG = [0, 90, 180, 270];
  function place(i, W, instant, dur, shift) {
    const m = mouse(i);
    m.classList.toggle('instant', !!instant);
    const diff = ((ANG[W.dir] - m.angle) % 360 + 540) % 360 - 180;
    m.angle += diff;
    const off = shift || 0;
    m.style.left = ((W.x + off) * 100 / n) + '%';
    m.style.top = ((W.y + off) * 100 / n) + '%';
    m.style.setProperty('--ang', m.angle + 'deg');
    m.style.setProperty('--dur', (dur || 250) + 'ms');
    m.classList.toggle('crash', !!W.crash);
  }
  function removeMice() { mice.forEach(m => m && m.remove()); mice.length = 0; }

  return { el, draw, place, mouse, setLines, removeMice };
}

// ======================================================================= игра
if (typeof Games !== 'undefined') Games.register('mouse', {
  levels: true,
  sandbox: true,
  sandboxLabel: () => '🏁 ' + t('mouse.tour.title'),
  tutorial: [
    { title: t('mouse.tut1.title'), text: t('mouse.tut1') },
    { title: t('mouse.tut2.title'), text: t('mouse.tut2'), code: 'while not at_goal():\n    if not wall_right():\n        right()\n        forward()\n    elif not wall_front():\n        forward()\n    else:\n        left()' },
    { title: t('mouse.tut3.title'), text: t('mouse.tut3') },
    { title: t('stars'), text: t('mouse.tut4') }
  ],

  mount(host, ctx) {
    return ctx.level === 0 ? mouseTournament(host, ctx) : mouseLevel(host, ctx);
  }
});

const MOUSE_SPEED = [700, 450, 280, 160, 70];

// Текст и выполнение цели уровня (для списка звёзд)
function mouseGoalText(g, L, st) {
  if (g === 'goal') return '🧀 ' + t('mouse.g.goal');
  if (g === 'lines') return '📏 ' + t('mouse.g.lines', { n: L.maxLines, cur: st.lines });
  if (g === 'explore') return '🔍 ' + t('mouse.g.explore', { n: MouseSim.exploreLimit(L, st.shortest) }) + (st.run1 ? ' (' + st.run1 + ')' : '');
  if (g === 'shortest') return '⚡ ' + t('mouse.g.shortest', { n: st.shortest });
  if (g === 'shortest1') return '⚡ ' + t('mouse.g.shortest1', { n: st.shortest });
  return g;
}

// ----------------------------------------------------------------- уровень
function mouseLevel(host, ctx) {
  const L = ctx.levelData;
  const g = Progress.game('mouse');
  g.code = g.code || {};
  let speed = Math.min(5, Math.max(1, +(g.speed || CONFIG.defaultSpeed)));
  let maze, W, board, best, gen = null, timer = null, running = false, lastAct = null, res = null, reveal = false, finished = false;
  let pending = null, cleanup = null;   // отложенное продолжение (пауза его запоминает) и уборка при выходе
  const later = (fn, ms) => { pending = fn; timer = setTimeout(() => { pending = null; timer = null; fn(); }, ms); };

  const status = h('div', { class: 'rb-status', 'aria-live': 'polite' });
  const runBadge = h('span', { class: 'mo-run' });
  const goals = h('ul', { class: 'rb-goals' });
  const boardBox = h('div', { class: 'mo-board-box' });
  const right = h('div', { class: 'rb-right' }, h('p', { class: 'rb-task', html: rich(L.hint) }));
  const btn = (label, cls, fn) => h('button', { class: 'btn ' + cls, onclick: fn }, label);

  host.append(h('div', { class: 'rb-layout mo-layout' },
    h('div', { class: 'rb-left' },
      h('div', { class: 'rb-level-head' }, h('b', null, t('robot.19') + ctx.level + t('app.1') + ctx.levelCount + ': ' + L.title), ' ', runBadge),
      boardBox, status, goals),
    right));

  // ---------------- лабиринт и мир
  function newMaze() {
    maze = MouseSim.mazeFor(L);
    best = MouseSim.shortestPath(maze).length - 1;
    W = MouseSim.world(maze, L.fog);
    if (!board || board.n !== maze.n) {
      board = MouseBoard(maze.n);
      board.n = maze.n;
      boardBox.innerHTML = '';
      boardBox.append(board.el);
    }
    board.removeMice();
    res = { run1: null, run2: null };
    redraw(true);
  }
  function redraw(instant) {
    board.draw(W, { reveal, trail: true });
    board.place(0, W, instant, Math.min(MOUSE_SPEED[speed - 1], 400));
    runBadge.textContent = W.run === 2 ? '⚡ ' + t('mouse.run2') : '🔍 ' + t('mouse.run1');
    runBadge.className = 'mo-run r' + W.run;
    drawGoals();
  }
  function drawGoals(met) {
    const st = { lines: editor ? MouseSim.countLines(editor.getValue()) : 0, shortest: best, run1: res && res.run1 ? res.run1.moves : 0 };
    goals.innerHTML = '';
    L.goals.forEach((gl, i) => {
      const ok = met ? met[i] : gl === 'lines' && st.lines > 0 && st.lines <= L.maxLines;
      goals.append(h('li', { class: ok ? 'ok' : '' }, (ok ? '★ ' : '☆ ') + mouseGoalText(gl, L, st)));
    });
    goals.append(h('li', { class: 'muted mo-steps' }, t('mouse.steps', { a: res && res.run1 ? res.run1.moves : W.run === 1 ? W.moves : '—', b: res && res.run2 ? res.run2.moves : W.run === 2 ? W.moves : '—', c: best })));
  }
  function setStatus(msg, kind) {
    status.className = 'rb-status' + (kind ? ' ' + kind : '');
    status.innerHTML = msg ? rich(msg) : '';
  }

  // ---------------- конец забега и уровня
  function endRun() {
    const r = { win: MouseSim.atGoal(W), moves: W.moves, path: W.path.slice() };
    if (W.run === 1) {
      res.run1 = r;
      if (!r.win) return lose(t('mouse.notGoal'));
      setStatus('✔ ' + t('mouse.run1done', { n: r.moves }), 'ok');
      Sound.play('ok');
      return 'next';
    }
    res.run2 = r;
    if (!r.win) return lose(t('mouse.notGoal'));
    win();
    return 'done';
  }
  function lose(msg) {
    finished = true;
    setStatus('⚠ ' + msg, 'bad');
    Sound.play('bad');
    FX.shake(board.el);
    return 'lose';
  }
  function win() {
    finished = true;
    const full = { run1: res.run1, run2: res.run2, shortest: best, lines: editor ? MouseSim.countLines(editor.getValue()) : 0 };
    const met = MouseSim.goalsMet(L, full);
    const stars = met.filter(Boolean).length;
    drawGoals(met);
    // пунктир кратчайшего пути поверх следа второго забега
    board.draw(W, { reveal: true, all: true });
    board.setLines([[res.run1.path, 'mo-trail r1'], [res.run2.path, 'mo-trail'], [MouseSim.shortestPath(maze), 'mo-best']]);
    const gain = ctx.finishLevel(stars, stars * 60);
    Sound.play('level');
    FX.confetti();
    const last = ctx.level >= ctx.levelCount;
    const missedShort = L.goals.includes('shortest') && !met[L.goals.indexOf('shortest')];
    ctx.modal({
      title: t('mouse.win'),
      body: h('div', { class: 'rb-win' },
        h('div', { class: 'rb-win-stars', html: starsHTML(stars) }),
        h('p', null, t('mouse.winSteps', { a: res.run1.moves, b: res.run2.moves, c: best })),
        h('p', null, gain ? '+' + gain + t('robot.31') : t('robot.32')),
        missedShort ? h('p', { class: 'muted' }, L.random ? t('mouse.missRandom') : t('mouse.missShort')) : null,
        h('p', { class: 'muted small' }, t('mouse.legend'))),
      actions: [
        { label: t('robot.35') },
        last ? { label: t('robot.21'), primary: true, onclick: ctx.levels } : { label: t('robot.36'), primary: true, onclick: () => ctx.goLevel(ctx.level + 1) }
      ]
    });
  }

  let editor = null;
  if (L.manual) manualControls(); else codeControls();

  // ---------------- ручное управление (разминка)
  function manualControls() {
    const act = fn => () => {
      if (finished || ctx.paused) return;
      try { fn(); } catch (e) { setStatus('⚠ ' + e.message, 'bad'); Sound.play('boom'); FX.shake(board.el); W.crash = false; redraw(); return; }
      Sound.play('step');
      redraw();
      if (MouseSim.atGoal(W)) {
        const r = endRun();
        if (r === 'next') later(() => { MouseSim.startRun(W, 2); setStatus(t('mouse.manualRun2')); redraw(true); }, 700);
      }
    };
    const cmd = name => act(() => MouseSim.builtins(W)[name]());
    const pad = h('div', { class: 'mo-pad' },
      h('span'), btn('⬆', 'mo-key', cmd('forward')), h('span'),
      btn('⬅', 'mo-key', cmd('left')), btn('⬇', 'mo-key', cmd('back')), btn('➡', 'mo-key', cmd('right')));
    right.append(h('p', { class: 'muted' }, t('mouse.manualHelp')), pad,
      h('div', { class: 'row wrap' },
        btn('↺ ' + t('mouse.restart'), '', () => { finished = false; newMaze(); setStatus(''); }),
        ctx.level < ctx.levelCount ? btn(t('robot.36'), 'small ghost', () => ctx.goLevel(ctx.level + 1)) : null,
        btn(t('robot.21'), 'small ghost', ctx.levels)));
    const keys = { ArrowUp: 'forward', ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'back' };
    const onKey = e => {
      if (!keys[e.key] || document.querySelector('.modal-back') || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      e.preventDefault();
      cmd(keys[e.key])();
    };
    document.addEventListener('keydown', onKey);
    cleanup = () => document.removeEventListener('keydown', onKey);
  }

  // ---------------- программа
  function codeControls() {
    const palette = h('div', { class: 'rb-palette' });
    const edHost = h('div', { class: 'rb-editor' });
    const runBtn = btn(t('robot.14'), 'primary', () => start(false));
    const stepBtn = btn(t('robot.15'), '', () => start(true));
    const stopBtn = btn(t('robot.16'), '', stop);
    const resetBtn = btn(t('robot.17'), '', () => reset());
    const speedIn = h('input', { type: 'range', min: '1', max: '5', value: String(speed), 'aria-label': t('robot.18') });
    speedIn.addEventListener('input', () => { speed = +speedIn.value; g.speed = speed; Progress.save(); });
    const copyBtn = btn('📋 ' + t('mouse.copy'), 'small ghost', () => {
      const text = editor.getValue();
      const done = () => FX.toast(t('mouse.copied'), '📋');
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => {}); else done();
    });
    right.append(palette, edHost,
      h('div', { class: 'rb-controls' }, runBtn, stepBtn, stopBtn, resetBtn, h('label', { class: 'rb-speed' }, '🐢', speedIn, '🐇')),
      h('div', { class: 'row wrap' },
        ctx.level > 1 ? btn(t('robot.20') + (ctx.level - 1), 'small ghost', () => ctx.goLevel(ctx.level - 1)) : null,
        btn(t('robot.21'), 'small ghost', ctx.levels),
        copyBtn,
        ctx.teacher ? btn(t('robot.22'), 'small ghost', () => editor.setValue(L.solution)) : null,
        ctx.teacher ? btn('🗺 ' + t('mouse.reveal'), 'small ghost', () => { reveal = !reveal; redraw(true); }) : null));

    editor = Editor.create(edHost, {
      value: g.code[ctx.level] !== undefined ? g.code[ctx.level] : (L.starter || t('mouse.starter')),
      onChange(v) { g.code[ctx.level] = v; Progress.save(); if (!running) reset(true); else drawGoals(); }
    });
    (L.allowed || []).forEach(c => palette.append(h('button', { class: 'chip code-chip', onclick: () => editor.insertCommand(c) }, c)));

    function setRunning(v) {
      running = v;
      editor.setReadOnly(v);
      runBtn.disabled = v && !!timer;
    }

    function compile() {
      const err = Py.check(editor.getValue());
      if (err) {
        editor.setError(err.line);
        setStatus('⚠ ' + err.msg, 'bad');
        Sound.play('bad');
        return false;
      }
      return true;
    }
    function newGen() {
      gen = Py.steps(editor.getValue(), { maxSteps: MouseSim.STEPS, snap: false, builtins: MouseSim.builtins(W, k => { lastAct = k; }) });
    }

    function start(stepMode) {
      if (ctx.paused) return;
      if (!gen) {
        if (!compile()) return;
        if (finished || L.random || W.moves || W.run === 2) newMaze();
        finished = false;
        newGen();
        setStatus('');
      }
      clearTimeout(timer);
      timer = null;
      pending = null;
      setRunning(true);
      if (!stepMode) runBtn.disabled = true;
      tick(stepMode);
    }

    // До следующего действия мыши: вычисления (волна!) идут без пауз, анимируются только шаги и повороты
    function tick(single) {
      timer = null;
      if (!gen) return;
      lastAct = null;
      let r = null, n = 0;
      try {
        do { r = gen.next(); n++; } while (!r.done && !lastAct && n < 30000);
      } catch (e) { return fail(e); }
      if (!r.done) editor.setActive(r.value.line);
      if (lastAct) { redraw(false); if (lastAct === 'move') Sound.play('step'); }
      if (r.done) return runFinished();
      if (single && lastAct && lastAct !== 'show') { runBtn.disabled = false; return; }
      const d = MOUSE_SPEED[speed - 1];
      later(() => tick(single), lastAct && lastAct !== 'show' ? d : 0);
    }

    function runFinished() {
      gen = null;
      editor.setActive(0);
      const r = endRun();
      if (r === 'next') {
        // второй забег той же программой — мышь помнит найденные стены
        later(() => {
          MouseSim.startRun(W, 2);
          W.labels = null;
          redraw(true);
          newGen();
          later(() => tick(false), 400);
        }, 900);
        return;
      }
      setRunning(false);
    }

    function fail(e) {
      gen = null;
      finished = true;
      setRunning(false);
      redraw(false);
      editor.setActive(0);
      if (e.line) editor.setError(e.line);
      setStatus('⚠ ' + e.message, 'bad');
      Sound.play(W.crash ? 'boom' : 'bad');
      FX.shake(board.el);
    }

    function stop() {
      clearTimeout(timer);
      timer = null;
      pending = null;
      if (gen) { gen = null; finished = true; setStatus(t('robot.37')); }
      setRunning(false);
      editor.setActive(0);
    }

    function reset(keepMaze) {
      clearTimeout(timer);
      timer = null;
      pending = null;
      gen = null;
      finished = false;
      editor.setActive(0);
      editor.setError(0);
      setRunning(false);
      if (keepMaze && maze && !L.random) { W = MouseSim.world(maze, L.fog); board.removeMice(); res = { run1: null, run2: null }; redraw(true); }
      else newMaze();
      setStatus(L.random ? t('robot.28') : '');
    }
  }

  newMaze();
  if (L.random) setStatus(t('robot.28'));

  return {
    pause() { clearTimeout(timer); timer = null; },
    resume() { if (pending) { const fn = pending; pending = null; fn(); } },
    destroy() { clearTimeout(timer); timer = null; pending = null; gen = null; if (cleanup) cleanup(); }
  };
}

// ----------------------------------------------------------------- турнир (для проектора)
// Учитель вставляет программы учеников (кнопка «Скопировать программу» в уровне), все мыши бегут
// по одному лабиринту одновременно: сначала разведка, потом забег на скорость. Побеждает самый короткий второй забег.
function mouseTournament(host, ctx) {
  const KEY = 'pyquest.mouseTour';
  const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
  const g = Progress.game('mouse');
  let S;
  try { S = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { S = null; }
  if (!S || !Array.isArray(S.players)) {
    const own = g.code && (g.code[10] || g.code[9] || g.code[8]);
    S = { size: 8, loops: 3, seed: 1 + Math.floor(Math.random() * 100000), players: [{ name: Progress.state.name || t('mouse.tour.player', { n: 1 }), code: own || '' }] };
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* без сохранения */ } };
  let maze, board, racers = [], timer = null, pending = null, speed = 4;
  const later = (fn, ms) => { pending = fn; timer = setTimeout(() => { pending = null; timer = null; fn(); }, ms); };

  const boardBox = h('div', { class: 'mo-board-box' });
  const table = h('div', { class: 'mo-results' });
  const list = h('div', { class: 'mo-players' });
  const status = h('p', { class: 'muted', 'aria-live': 'polite' });
  const sel = (key, vals, label) => {
    const s = h('select', { class: 'input', 'aria-label': label, onchange: e => { S[key] = +e.target.value; save(); newMaze(); } },
      vals.map(([v, txt]) => h('option', { value: String(v) }, txt)));
    s.value = String(S[key]);
    return h('label', { class: 'mo-opt' }, label, s);
  };
  const startBtn = h('button', { class: 'btn primary', onclick: start }, '▶ ' + t('mouse.tour.start'));
  const speedIn = h('input', { type: 'range', min: '1', max: '5', value: String(speed), 'aria-label': t('robot.18') });
  speedIn.addEventListener('input', () => { speed = +speedIn.value; });

  host.append(h('div', { class: 'rb-layout mo-layout mo-tour' },
    h('div', { class: 'rb-left' }, boardBox, status, table),
    h('div', { class: 'rb-right' },
      h('p', { class: 'rb-task' }, t('mouse.tour.lead')),
      h('div', { class: 'row wrap mo-opts' },
        sel('size', [[6, '6 × 6'], [8, '8 × 8']], t('mouse.tour.size')),
        sel('loops', [[0, t('mouse.tour.loops0')], [3, t('mouse.tour.loops3')], [6, t('mouse.tour.loops6')]], t('mouse.tour.loops')),
        h('button', { class: 'btn', onclick: () => { S.seed = 1 + Math.floor(Math.random() * 100000); save(); newMaze(); } }, '🎲 ' + t('mouse.tour.newMaze'))),
      list,
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn small', onclick: () => { if (S.players.length < COLORS.length) { S.players.push({ name: t('mouse.tour.player', { n: S.players.length + 1 }), code: '' }); save(); drawPlayers(); } } }, '＋ ' + t('mouse.tour.add'))),
      h('div', { class: 'rb-controls' }, startBtn, h('button', { class: 'btn', onclick: stop }, t('robot.16')), h('label', { class: 'rb-speed' }, '🐢', speedIn, '🐇')),
      h('div', { class: 'row wrap' }, h('button', { class: 'btn small ghost', onclick: ctx.levels }, t('robot.21'))))));

  function drawPlayers() {
    list.innerHTML = '';
    S.players.forEach((p, i) => {
      const name = h('input', { class: 'input', value: p.name, maxlength: '30', 'aria-label': t('mouse.tour.name'), oninput: e => { p.name = e.target.value; save(); } });
      const code = h('textarea', { class: 'input mo-code', rows: '5', spellcheck: 'false', placeholder: t('mouse.tour.paste'), 'aria-label': t('mouse.tour.code'), oninput: e => { p.code = e.target.value; save(); } });
      code.value = p.code;
      list.append(h('div', { class: 'mo-player' },
        h('div', { class: 'row mo-player-head' },
          h('span', { class: 'mo-dot', style: { background: COLORS[i] } }), name,
          S.players.length > 1 ? h('button', { class: 'btn small ghost', title: t('mouse.tour.remove'), onclick: () => { S.players.splice(i, 1); save(); drawPlayers(); } }, '✕') : null),
        code));
    });
  }

  function newMaze() {
    stop();
    maze = MouseSim.generate(S.size, S.seed, S.loops);
    board = MouseBoard(maze.n);
    boardBox.innerHTML = '';
    boardBox.append(board.el);
    board.draw(MouseSim.world(maze, false), { all: true });
    racers = [];
    table.innerHTML = '';
    status.textContent = t('mouse.tour.mazeInfo', { n: MouseSim.shortestPath(maze).length - 1 });
  }

  function start() {
    stop();
    newMaze();
    racers = S.players.map((p, i) => {
      const r = { p, i, W: MouseSim.world(maze, true), state: 'run1', m1: null, m2: null, err: '' };
      const bad = Py.check(p.code || '');
      if (!p.code.trim() || bad) { r.state = 'error'; r.err = !p.code.trim() ? t('mouse.tour.empty') : bad.msg; }
      else newGen(r);
      board.mouse(i, COLORS[i]);
      board.place(i, r.W, true, 0, shift(i));
      return r;
    });
    startBtn.disabled = true;
    drawTable();
    later(tick, 300);
  }
  const shift = i => (i % 3 - 1) * 0.14;
  function newGen(r) {
    r.gen = Py.steps(r.p.code, { maxSteps: MouseSim.STEPS, snap: false, builtins: MouseSim.builtins(r.W, k => { r.act = k; }) });
  }

  // каждая мышь делает по одному действию за такт
  function tick() {
    let moved = false;
    racers.forEach(r => {
      if (r.state !== 'run1' && r.state !== 'run2') return;
      r.act = null;
      let res = null, n = 0;
      try {
        do { res = r.gen.next(); n++; } while (!res.done && (!r.act || r.act === 'show') && n < 30000);
      } catch (e) { r.state = 'error'; r.err = e.message; return; }
      if (r.act) moved = true;
      if (!res.done) return;
      const ok = MouseSim.atGoal(r.W);
      if (r.state === 'run1') { r.m1 = r.W.moves; r.state = ok ? 'wait' : 'lost'; }
      else { r.m2 = r.W.moves; r.state = ok ? 'done' : 'lost'; }
    });
    // все закончили разведку — второй забег
    if (!racers.some(r => r.state === 'run1') && racers.some(r => r.state === 'wait')) {
      racers.forEach(r => { if (r.state === 'wait') { MouseSim.startRun(r.W, 2); r.state = 'run2'; newGen(r); } });
      status.textContent = '⚡ ' + t('mouse.run2');
    }
    racers.forEach(r => board.place(r.i, r.W, false, Math.min(MOUSE_SPEED[speed - 1], 400), shift(r.i)));
    if (moved) Sound.play('step');
    drawTable();
    if (racers.some(r => r.state === 'run1' || r.state === 'run2')) later(tick, moved ? MOUSE_SPEED[speed - 1] : 0);
    else finish();
  }

  function finish() {
    startBtn.disabled = false;
    const best = MouseSim.shortestPath(maze);
    board.setLines([[best, 'mo-best']]);
    status.textContent = '🏁 ' + t('mouse.tour.done', { n: best.length - 1 });
    Sound.play('level');
    if (racers.some(r => r.state === 'done')) FX.confetti();
  }

  function drawTable() {
    const rank = r => (r.state === 'done' ? r.m2 : r.state === 'run2' || r.state === 'wait' ? 1000 + (r.m1 || 0) : r.state === 'run1' ? 2000 : 3000 + (r.m1 || 0));
    const rows = racers.slice().sort((a, b) => rank(a) - rank(b) || (a.m1 || 0) - (b.m1 || 0));
    const stateText = r => ({ run1: '🔍 ' + t('mouse.run1'), wait: '⏳', run2: '⚡ ' + t('mouse.run2'), done: '✔', lost: '✘ ' + t('mouse.tour.lost'), error: '⚠ ' + r.err })[r.state];
    table.innerHTML = '';
    table.append(h('table', { class: 'res-table' },
      h('thead', null, h('tr', null, ['#', t('mouse.tour.name'), t('mouse.run1'), t('mouse.run2'), ''].map(x => h('th', null, x)))),
      h('tbody', null, rows.map((r, k) => h('tr', null,
        h('td', null, r.state === 'done' ? (k === 0 ? '🥇' : k === 1 ? '🥈' : k === 2 ? '🥉' : k + 1) : '—'),
        h('td', null, h('span', { class: 'mo-dot', style: { background: COLORS[r.i] } }), ' ', h('b', null, r.p.name)),
        h('td', null, r.m1 !== null ? r.m1 : r.state === 'run1' ? r.W.moves : '—'),
        h('td', null, r.m2 !== null ? r.m2 : r.state === 'run2' ? r.W.moves : '—'),
        h('td', { class: 'small' + (r.state === 'error' || r.state === 'lost' ? ' bad-text' : '') }, stateText(r)))))));
  }

  function stop() {
    clearTimeout(timer);
    timer = null;
    pending = null;
    startBtn.disabled = false;
    racers.forEach(r => { if (r.state === 'run1' || r.state === 'run2') { r.state = 'error'; r.err = t('robot.37'); } });
  }

  drawPlayers();
  newMaze();
  return {
    pause() { clearTimeout(timer); timer = null; },
    resume() { if (pending) { const fn = pending; pending = null; fn(); } },
    destroy() { clearTimeout(timer); timer = null; pending = null; }
  };
}
