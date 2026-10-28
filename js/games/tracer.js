/* Игра «Ты — компьютер» (трассировка).
   TracerSim — строит эталонную таблицу (без DOM): используется игрой и tests.html.
   Строка таблицы — значения переменных в конце каждого прохода главного цикла. */
const TracerSim = (function () {
  'use strict';
  const indent = l => l.match(/^ */)[0].length;

  // Главный цикл — первая строка с for/while; тело — следующие строки с бо́льшим отступом
  function loopInfo(code) {
    const lines = code.split('\n');
    const head = lines.findIndex(l => /^\s*(for|while)\b/.test(l));
    const body = new Set();
    if (head < 0) return { head: 0, body };
    for (let i = head + 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      if (indent(lines[i]) <= indent(lines[head])) break;
      body.add(i + 1);
    }
    return { head: head + 1, body };
  }

  function rows(code, vars, inputs) {
    const info = loopInfo(code);
    const r = Py.run(code, { trace: true, inputs: inputs || [] });
    const out = [];
    let cur = null;
    for (const st of r.trace) {
      if (st.line === info.head) {
        if (cur && cur.last) out.push(cur.last);
        cur = { last: null };
      } else if (info.body.has(st.line)) {
        if (cur) cur.last = st.vars;
      } else if (cur) {
        if (cur.last) out.push(cur.last);
        cur = null;
      }
    }
    if (cur && cur.last) out.push(cur.last);
    return { ok: r.ok, error: r.error, rows: out.map(v => vars.map(n => (n in v ? v[n] : ''))), info };
  }

  // Ответ ученика совпадает с эталоном? Числа сравниваем по значению, строки — с кавычками или без
  function same(given, expected) {
    const g = String(given).trim();
    if (g === expected) return true;
    if (g !== '' && !isNaN(Number(g)) && !isNaN(Number(expected))) return Number(g) === Number(expected);
    const unq = expected.replace(/^'(.*)'$/, '$1');
    return unq !== expected && (g === unq || g === '"' + unq + '"');
  }

  return { rows, same, loopInfo };
})();

if (typeof Games !== 'undefined') Games.register('tracer', {
  levels: true,
  tutorial: [
    { title: t('game.tracer'), text: t('tracer.1'), code: 's = 0\nfor i in range(1, 4):\n    s += i' },
    { title: t('tracer.2'), text: t('tracer.3') },
    { title: t('tracer.4'), text: t('tracer.5') }
  ],

  mount(host, ctx) {
    const L = ctx.levelData;
    const T = TracerSim.rows(L.code, L.vars);
    const codeLines = L.code.split('\n');
    let errors = 0, filled = 0, finished = false, traceInst = null;
    const total = T.rows.length * L.vars.length;

    const codeBox = h('div', { class: 'tr-code-box', html: Highlight.code(L.code) });
    const table = h('table', { class: 'tc-table' });
    const hint = h('div', { class: 'tc-hint', 'aria-live': 'polite' });
    const progress = h('div', { class: 'tc-progress' });
    const after = h('div');
    host.append(...[
      h('div', { class: 'rb-level-head' }, h('b', null, t('robot.19') + ctx.level + t('app.1') + ctx.levelCount + ': ' + L.title)),
      L.story ? h('p', { class: 'rb-task', html: rich(L.story) }) : null,
      h('div', { class: 'tc-layout' },
        h('div', null, codeBox, h('p', { class: 'muted small' }, t('tracer.6'))),
        h('div', null, progress, h('div', { class: 'tc-table-wrap' }, table), hint,
          h('div', { class: 'row wrap' },
            ctx.level > 1 ? h('button', { class: 'btn small ghost', onclick: () => ctx.goLevel(ctx.level - 1) }, t('robot.20') + (ctx.level - 1)) : null,
            h('button', { class: 'btn small ghost', onclick: ctx.levels }, t('robot.21')),
            ctx.teacher ? h('button', { class: 'btn small ghost', onclick: reveal }, t('tracer.7')) : null))),
      after].filter(Boolean));

    const headLine = $('.code-line[data-line="' + T.info.head + '"]', codeBox);
    if (headLine) headLine.classList.add('tc-loop');

    // ---------------- таблица
    const cells = [];
    table.append(h('thead', null, h('tr', null, h('th', null, t('tracer.8')), L.vars.map(v => h('th', null, h('code', null, v))))));
    const tbody = h('tbody');
    T.rows.forEach((row, r) => {
      tbody.append(h('tr', null, h('td', { class: 'tc-n' }, r + 1), row.map((val, c) => {
        const inp = h('input', { class: 'tc-cell', type: 'text', inputmode: 'text', autocomplete: 'off', spellcheck: 'false', 'aria-label': t('tracer.9') + (r + 1) + ', ' + L.vars[c] });
        inp.dataset.r = r;
        inp.dataset.c = c;
        cells.push(inp);
        inp.addEventListener('keydown', e => {
          if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); check(inp, true); }
        });
        inp.addEventListener('blur', () => { if (inp.value.trim() && !inp.classList.contains('ok')) check(inp, false); });
        inp.addEventListener('input', () => inp.classList.remove('bad'));
        return h('td', null, inp);
      })));
    });
    table.append(tbody);
    drawProgress();
    setTimeout(() => cells[0] && cells[0].focus(), 50);

    function drawProgress() {
      progress.innerHTML = '';
      progress.append(
        h('span', null, t('tracer.10'), h('b', null, filled + ' / ' + total)),
        h('span', { class: errors ? 'bad-text' : 'muted' }, t('tracer.11') + errors));
    }

    function check(inp, move) {
      if (finished || inp.classList.contains('ok')) { if (move) focusNext(inp); return; }
      const r = +inp.dataset.r, c = +inp.dataset.c;
      const v = inp.value.trim();
      if (!v) { if (move) focusNext(inp); return; }
      const expected = T.rows[r][c];
      if (TracerSim.same(v, expected)) {
        inp.classList.add('ok');
        inp.readOnly = true;
        filled++;
        hint.innerHTML = '';
        Sound.play('tick');
        drawProgress();
        if (filled === total) return win();
        if (move) focusNext(inp);
      } else {
        inp.classList.add('bad');
        errors++;
        Sound.play('bad');
        FX.shake(inp);
        showHint(r, c, v);
        drawProgress();
        inp.select();
      }
    }

    function focusNext(inp) {
      const i = cells.indexOf(inp);
      const next = cells.slice(i + 1).concat(cells.slice(0, i)).find(x => !x.classList.contains('ok'));
      if (next) next.focus();
    }

    // Подсказка: строка, где меняется переменная; если она внутри if — проверь условие
    function showHint(r, c, given) {
      const v = L.vars[c];
      const re = new RegExp('^\\s*(?:for\\s+' + v + '\\b|(?:[\\w\\s,]*,\\s*)?' + v + '\\s*(?:,[\\w\\s,]*)?(?:=|\\+=|-=|\\*=|//=|%=|/=)(?!=))');
      const idx = codeLines.findIndex((l, i) => (i + 1 === T.info.head || T.info.body.has(i + 1)) && re.test(l));
      let msg = '', mark = idx;
      if (idx >= 0) {
        // ищем ближайший if выше строки с присваиванием, внутри цикла
        let cond = -1;
        for (let k = idx - 1; k >= T.info.head; k--) {
          if (/^\s*(if|elif|else)\b/.test(codeLines[k]) && codeLines[k].match(/^ */)[0].length < codeLines[idx].match(/^ */)[0].length) { cond = k; break; }
        }
        const prev = r > 0 ? T.rows[r - 1][c] : null;
        if (cond >= 0 && prev !== null && (T.rows[r][c] === prev || TracerSim.same(given, prev))) {
          msg = t('tracer.12') + (cond + 1) + ': `' + codeLines[cond].trim() + t('tracer.13');
          mark = cond;
        } else if (/^\s*for\b/.test(codeLines[idx])) {
          msg = t('tracer.14') + (idx + 1) + t('tracer.15') + codeLines[idx].trim().replace(/:$/, '') + '`?';
        } else {
          msg = t('tracer.14') + (idx + 1) + ': `' + codeLines[idx].trim() + '`' + (r > 0 ? t('tracer.16') + v + ' = ' + T.rows[r - 1][c] + '.' : t('tracer.17'));
        }
      } else msg = t('tracer.18');
      hint.innerHTML = '💡 ' + rich(msg);
      $$('.code-line', codeBox).forEach(l => l.classList.toggle('active', mark >= 0 && +l.dataset.line === mark + 1));
    }

    function win() {
      finished = true;
      $$('.code-line', codeBox).forEach(l => l.classList.remove('active'));
      const stars = errors === 0 ? 3 : errors <= 2 ? 2 : 1;
      if (errors === 0) ctx.bump('tracerPerfect');
      const gain = ctx.finishLevel(stars, stars * 50);
      Sound.play('level');
      FX.confetti();
      hint.innerHTML = '';
      after.innerHTML = '';
      after.append(h('div', { class: 'row' }, h('button', { class: 'btn', onclick: showTrace }, t('tracer.19'))));
      const last = ctx.level >= ctx.levelCount;
      ctx.modal({
        title: t('tracer.20'),
        body: h('div', { class: 'rb-win' },
          h('div', { class: 'rb-win-stars', html: starsHTML(stars) }),
          h('p', null, errors ? t('tracer.11') + errors + '. ' : t('tracer.21')),
          h('p', null, gain ? '+' + gain + t('robot.31') : t('tracer.22'))),
        actions: [
          { label: t('robot.35') },
          last ? { label: t('robot.21'), primary: true, onclick: ctx.levels } : { label: t('robot.36'), primary: true, onclick: () => ctx.goLevel(ctx.level + 1) }
        ]
      });
    }

    function showTrace() {
      if (traceInst) return;
      traceInst = Trace.mount(after, L.code);
    }

    function reveal() {
      cells.forEach(inp => { if (!inp.classList.contains('ok')) inp.value = T.rows[+inp.dataset.r][+inp.dataset.c]; });
      hint.innerHTML = t('tracer.23');
    }

    return { destroy() { if (traceInst) traceInst.destroy(); } };
  }
});
