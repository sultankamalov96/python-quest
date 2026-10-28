/* Игра «Сапёр-логика»: отметить флажками клетки, где условие истинно.
   MineSim — поле и проверка (без DOM): используется игрой и tests.html.
   Правило — код Python, который ставит mine = True; выполняется интерпретатором для каждой клетки. */
const MineSim = (function () {
  'use strict';
  const SIZE = 6;

  function isMine(level, vars) {
    const r = Py.run('mine = False\n' + level.rule, { vars, maxSteps: 200 });
    if (!r.ok) throw new Error(r.error);
    return r.vars.mine === 'True';
  }

  function board(level, rand) {
    rand = rand || Math.random;
    const [a, b] = level.range || [1, 30];
    let cells = [];
    for (let k = 0; k < 100; k++) {
      cells = [];
      for (let row = 0; row < SIZE; row++) for (let col = 0; col < SIZE; col++) {
        const n = a + Math.floor(rand() * (b - a + 1));
        cells.push({ row, col, n, mine: isMine(level, { n, row, col }) });
      }
      const mines = cells.filter(c => c.mine).length;
      if (mines >= 5 && mines <= 22) break;
    }
    return cells;
  }

  // Разбить условие на части по and / or верхнего уровня (вне скобок)
  function parts(expr) {
    const out = [];
    let depth = 0, last = 0;
    for (let i = 0; i < expr.length; i++) {
      const c = expr[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (depth === 0) {
        const m = /^\s+(and|or)\s+/.exec(expr.slice(i));
        if (m) { out.push(expr.slice(last, i).trim()); last = i + m[0].length; i = last - 1; }
      }
    }
    out.push(expr.slice(last).trim());
    return out.filter(Boolean);
  }

  // Объяснение для клетки: значение каждого условия правила
  function explain(level, vars) {
    const lines = [];
    level.rule.split('\n').forEach((l, i) => {
      const m = l.match(/^\s*(if|elif)\s+(.+):\s*(#.*)?$/);
      if (!m) return;
      const expr = m[2];
      const val = Py.truthy(Py.evalExpr(expr, vars));
      const ps = parts(expr);
      const detail = ps.length > 1 ? ps.map(p => p + ' → ' + (Py.truthy(Py.evalExpr(p, vars)) ? 'True' : 'False')).join(';  ') : '';
      lines.push(t('mines.1') + (i + 1) + ': ' + expr + ' → ' + (val ? 'True' : 'False') + (detail ? '  (' + detail + ')' : ''));
    });
    return lines;
  }

  return { isMine, board, explain, parts, SIZE };
})();

if (typeof Games !== 'undefined') Games.register('minesweeper', {
  levels: true,
  tutorial: [
    { title: t('game.minesweeper'), text: t('mines.2'), code: t('mines.3') },
    { title: t('mines.4'), text: t('mines.5') },
    { title: t('mines.6'), text: t('mines.7') }
  ],

  mount(host, ctx) {
    const L = ctx.levelData;
    const usesRC = /\b(row|col)\b/.test(L.rule);
    let cells = [], attempts = 0, done = false;

    const ruleBox = h('div', { class: 'ms-rule', html: Highlight.code(L.rule, { numbers: L.rule.includes('\n') }) });
    const grid = h('div', { class: 'ms-grid' + (usesRC ? ' rc' : '') });
    const info = h('div', { class: 'ms-info' });
    const explainBox = h('div', { class: 'ms-explain', 'aria-live': 'polite' });
    const checkBtn = h('button', { class: 'btn primary', onclick: check }, t('mines.8'));
    host.append(
      h('div', { class: 'rb-level-head' }, h('b', null, t('robot.19') + ctx.level + t('app.1') + ctx.levelCount + ': ' + L.title)),
      h('p', { class: 'rb-task', html: rich(L.hint) }),
      h('div', { class: 'ms-layout' },
        h('div', null, ruleBox, info, grid),
        h('div', { class: 'ms-side' },
          h('div', { class: 'row wrap' }, checkBtn,
            h('button', { class: 'btn', onclick: clearFlags }, t('mines.9')),
            h('button', { class: 'btn ghost', onclick: newBoard }, t('mines.10'))),
          explainBox,
          h('div', { class: 'row wrap' },
            ctx.level > 1 ? h('button', { class: 'btn small ghost', onclick: () => ctx.goLevel(ctx.level - 1) }, t('robot.20') + (ctx.level - 1)) : null,
            h('button', { class: 'btn small ghost', onclick: ctx.levels }, t('robot.21')),
            ctx.teacher ? h('button', { class: 'btn small ghost', onclick: showMines }, t('mines.11')) : null))));

    function newBoard() {
      cells = MineSim.board(L);
      attempts = 0;
      done = false;
      checkBtn.disabled = false;
      explainBox.innerHTML = '';
      draw();
    }

    function draw() {
      grid.innerHTML = '';
      if (usesRC) {
        grid.append(h('span', { class: 'ms-axis corner' }, 'row\\col'));
        for (let c = 0; c < 6; c++) grid.append(h('span', { class: 'ms-axis' }, c));
      }
      cells.forEach(cell => {
        if (usesRC && cell.col === 0) grid.append(h('span', { class: 'ms-axis' }, cell.row));
        cell.el = h('button', {
          class: 'ms-cell' + (cell.flag ? ' flag' : '') + (cell.state ? ' ' + cell.state : ''),
          'aria-label': t('mines.12') + cell.row + ', ' + cell.col + ': ' + cell.n + (cell.flag ? t('mines.13') : ''),
          onclick: () => clickCell(cell)
        }, h('span', { class: 'ms-n' }, cell.n), cell.flag ? h('span', { class: 'ms-flag' }, '🚩') : null,
          cell.state === 'boom' ? h('span', { class: 'ms-boom' }, '💥') : null);
        grid.append(cell.el);
      });
      const flags = cells.filter(c => c.flag).length, mines = cells.filter(c => c.mine).length;
      info.innerHTML = '';
      info.append(...[h('span', null, t('mines.14'), h('b', null, mines)), h('span', null, t('mines.15'), h('b', null, flags)), attempts ? h('span', { class: 'muted' }, t('mines.16') + attempts) : null].filter(Boolean));
    }

    function clickCell(cell) {
      if (done) return;
      if (cell.state === 'boom' || cell.state === 'ok') {
        showExplain(cell);
        if (cell.state === 'ok') return;
      }
      cell.flag = !cell.flag;
      cell.state = null;
      Sound.play('click');
      draw();
    }

    function clearFlags() {
      if (done) return;
      cells.forEach(c => { c.flag = false; c.state = null; });
      explainBox.innerHTML = '';
      draw();
    }

    function vars(c) { return { n: c.n, row: c.row, col: c.col }; }

    function showExplain(cell) {
      const v = usesRC ? 'n = ' + cell.n + ', row = ' + cell.row + ', col = ' + cell.col : 'n = ' + cell.n;
      const verdict = cell.mine ? t('mines.17') : t('mines.18');
      const why = cell.mine && !cell.flag ? t('mines.19') : !cell.mine && cell.flag ? t('mines.20') : '';
      explainBox.innerHTML = '';
      explainBox.append(h('div', { class: 'ms-card' + (why ? ' bad' : '') },
        h('b', null, (why ? '💥 ' + why + ' ' : '') + v),
        MineSim.explain(L, vars(cell)).map(l => h('code', { class: 'ms-line' }, l)),
        h('div', null, '→ ' + verdict)));
      cells.forEach(c => c.el && c.el.classList.toggle('focus', c === cell));
    }

    function check() {
      if (done) return;
      attempts++;
      const bad = [];
      cells.forEach(c => {
        if (c.mine !== !!c.flag) { c.state = 'boom'; bad.push(c); }
        else c.state = c.mine ? 'ok' : null;
      });
      draw();
      if (bad.length) {
        Sound.play('boom');
        FX.shake(grid);
        const missed = bad.filter(c => c.mine).length, extra = bad.length - missed;
        explainBox.innerHTML = '';
        explainBox.append(h('p', { class: 'bad-text' }, t('mines.21') + (missed ? t('mines.22') + missed + '. ' : '') + (extra ? t('mines.23') + extra + '. ' : '') + t('mines.24')));
        showExplainAppend(bad[0]);
        return;
      }
      done = true;
      checkBtn.disabled = true;
      const stars = attempts === 1 ? 3 : attempts === 2 ? 2 : 1;
      const gain = ctx.finishLevel(stars, stars * 50);
      Sound.play('level');
      FX.confetti();
      cells.forEach(c => { if (c.mine) c.state = 'ok'; });
      draw();
      const last = ctx.level >= ctx.levelCount;
      ctx.modal({
        title: t('mines.25'),
        body: h('div', { class: 'rb-win' },
          h('div', { class: 'rb-win-stars', html: starsHTML(stars) }),
          h('p', null, attempts === 1 ? t('mines.26') : t('mines.16') + attempts),
          h('p', null, gain ? '+' + gain + t('robot.31') : t('tracer.22'))),
        actions: [
          { label: t('mines.27'), onclick: newBoard },
          last ? { label: t('robot.21'), primary: true, onclick: ctx.levels } : { label: t('robot.36'), primary: true, onclick: () => ctx.goLevel(ctx.level + 1) }
        ]
      });
    }

    function showExplainAppend(cell) {
      const keep = explainBox.firstChild;
      showExplain(cell);
      explainBox.prepend(keep);
    }

    function showMines() {
      cells.forEach(c => { c.flag = c.mine; c.state = null; });
      draw();
      explainBox.innerHTML = t('mines.28');
    }

    newBoard();
    return {};
  }
});
