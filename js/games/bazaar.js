/* Игра «Магазин на базаре»: ученик пишет код кассира, 10 покупателей проверяют его.
   BazaarSim — покупатели и проверка (без DOM): используется игрой и tests.html.
   Переменные покупателя передаются в программу; ответ — то, что напечатал print(). */
const BazaarSim = (function () {
  'use strict';
  // дни недели — данные (их сравнивают эталонные решения), поэтому не переводятся
  const DAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];

  // spec переменной: [мин, макс, шаг] — число; 'day' — день недели; 'number' — номер покупателя
  function value(spec, edges, i, r) {
    if (spec === 'day') return DAYS[Math.floor(r() * DAYS.length)];
    if (spec === 'number') return i + 1;
    if (edges && edges.length && r() < 0.3) return edges[Math.floor(r() * edges.length)];
    const [a, b, step] = spec;
    const s = step || 1;
    return a + s * Math.floor(r() * (Math.floor((b - a) / s) + 1));
  }

  function customers(level, r) {
    r = r || Math.random;
    return Array.from({ length: 10 }, (_, i) => {
      const v = {};
      for (const k of Object.keys(level.vars)) v[k] = value(level.vars[k], (level.edges || {})[k], i, r);
      return v;
    });
  }

  function serve(code, vars) {
    const res = Py.run(code, { vars, maxSteps: 2000 });
    return { ok: res.ok, output: res.output.replace(/\n+$/, ''), error: res.error };
  }

  function check(level, code, vars) {
    const exp = serve(level.solution, vars);
    const got = serve(code, vars);
    return { ok: got.ok && Py.sameOutput(got.output, exp.output), got, expected: exp.output };
  }

  return { customers, serve, check, DAYS };
})();

if (typeof Games !== 'undefined') Games.register('bazaar', {
  levels: true,
  tutorial: [
    { title: t('game.bazaar'), text: t('bazaar.8'), code: 'total = price * count\nprint(total)' },
    { title: t('bazaar.9'), text: t('bazaar.10') },
    { title: t('bazaar.11'), text: t('bazaar.12') }
  ],

  mount(host, ctx) {
    const L = ctx.levelData;
    const g = Progress.game('bazaar');
    g.code = g.code || {};
    const FACES = ['🧑', '👩', '👴', '👵', '🧔', '👧', '👦', '👨‍🌾', '👩‍🦳', '🧕'];
    const GOODS = [t('bazaar.13'), t('bazaar.14'), t('bazaar.15'), t('bazaar.16'), t('bazaar.17'), t('bazaar.18'), t('bazaar.19'), t('bazaar.20')];
    let attempts = 0, timers = [], running = false, fast = false;

    const edHost = h('div', { class: 'rb-editor' });
    const palette = h('div', { class: 'rb-palette' });
    const stage = h('div', { class: 'bz-stage' });
    const table = h('div', { class: 'bz-results' });
    const status = h('div', { class: 'rb-status', 'aria-live': 'polite' });
    const runBtn = h('button', { class: 'btn primary', onclick: run }, t('bazaar.21'));
    const fastBtn = h('button', { class: 'btn', onclick: () => { fast = true; } }, t('bazaar.22'));

    host.append(h('div', { class: 'rb-level-head' }, h('b', null, t('robot.19') + ctx.level + t('app.1') + ctx.levelCount + ': ' + L.title)),
      h('div', { class: 'bz-layout' },
        h('div', { class: 'bz-left' },
          h('div', { class: 'bz-req' }, h('b', null, t('bazaar.23')), h('div', { html: rich(L.req) })),
          h('div', { class: 'bz-vars' }, h('b', null, t('bazaar.24')), Object.keys(L.vars).map(k => h('code', null, k))),
          palette, edHost,
          h('div', { class: 'rb-controls' }, runBtn, fastBtn),
          status,
          h('div', { class: 'row wrap' },
            ctx.level > 1 ? h('button', { class: 'btn small ghost', onclick: () => ctx.goLevel(ctx.level - 1) }, t('robot.20') + (ctx.level - 1)) : null,
            h('button', { class: 'btn small ghost', onclick: ctx.levels }, t('robot.21')),
            ctx.teacher ? h('button', { class: 'btn small ghost', onclick: () => editor.setValue(L.solution) }, t('robot.22')) : null)),
        h('div', { class: 'bz-right' }, stage, table)));

    const editor = Editor.create(edHost, {
      value: g.code[ctx.level] !== undefined ? g.code[ctx.level] : L.starter,
      onChange(v) { g.code[ctx.level] = v; Progress.save(); }
    });
    (L.palette || []).forEach(c => palette.append(h('button', { class: 'chip code-chip', onclick: () => editor.insertCommand(c) }, c)));

    drawStage(null);

    function describe(v) {
      const parts = [];
      if ('count' in v && 'price' in v) parts.push(v.count + t('bazaar.25') + v.price + t('quiz.6'));
      else if ('count' in v) parts.push(v.count + t('bazaar.26'));
      if ('total' in v) parts.push(t('bazaar.27') + v.total + t('quiz.6'));
      if ('day' in v) parts.push(v.day);
      if ('number' in v) parts.push(t('bazaar.28') + v.number);
      return parts.join(' · ');
    }

    function drawStage(cust, state) {
      stage.innerHTML = '';
      stage.append(
        h('div', { class: 'bz-stall' }, h('span', { class: 'bz-awning' }), h('span', { class: 'bz-cashier' }, '🧑‍💼'), h('span', { class: 'bz-sign' }, t('bazaar.29'))),
        cust ? h('div', { class: 'bz-customer ' + (state || 'walk') },
          h('span', { class: 'bz-face' }, state === 'ok' ? '😊' : state === 'bad' ? '😠' : cust.face),
          h('div', { class: 'bz-bubble' + (state ? ' ' + state : '') }, cust.bubble)) : h('div', { class: 'bz-empty muted' }, t('bazaar.30')));
    }

    function clearTimers() { timers.forEach(clearTimeout); timers = []; }

    function run() {
      if (running) return;
      const syn = Py.check(editor.getValue());
      if (syn) { editor.setError(syn.line); setStatus('⚠ ' + syn.msg, 'bad'); Sound.play('bad'); return; }
      running = true;
      fast = false;
      runBtn.disabled = true;
      editor.setReadOnly(true);
      attempts++;
      setStatus('');
      table.innerHTML = '';
      const list = BazaarSim.customers(L);
      const rows = h('div', { class: 'bz-rows' });
      table.append(rows);
      let good = 0, i = 0;
      const step = () => {
        if (i >= list.length) return finish(good);
        const v = list[i];
        const res = BazaarSim.check(L, editor.getValue(), v);
        const cust = { face: FACES[i % FACES.length], bubble: GOODS[i % GOODS.length] + ': ' + describe(v) };
        drawStage(cust, null);
        Sound.play('step');
        const d = fast ? 120 : 900;
        timers.push(setTimeout(() => {
          const out = res.got.ok ? res.got.output : '⚠ ' + res.got.error;
          cust.bubble = res.ok ? t('bazaar.31') + oneLine(out) : t('bazaar.32') + oneLine(out) + t('bazaar.33') + oneLine(res.expected);
          drawStage(cust, res.ok ? 'ok' : 'bad');
          Sound.play(res.ok ? 'coin' : 'bad');
          if (res.ok) good++;
          rows.append(h('div', { class: 'bz-row ' + (res.ok ? 'ok' : 'bad') },
            h('span', null, (res.ok ? '😊 ' : '😠 ') + (i + 1) + '. ' + describe(v)),
            h('span', null, h('code', null, oneLine(out)), res.ok ? null : h('span', { class: 'bz-exp' }, t('bazaar.34'), h('code', null, oneLine(res.expected))))));
          if (!res.got.ok && res.got.error) {
            const m = res.got.error.match(/^Строка (\d+)/);
            if (m) editor.setError(+m[1]);
          }
          i++;
          timers.push(setTimeout(step, fast ? 120 : 900));
        }, d));
      };
      step();
    }

    const oneLine = s => String(s).replace(/\n/g, ' ⏎ ') || t('teacher.10');

    function finish(good) {
      running = false;
      runBtn.disabled = false;
      editor.setReadOnly(false);
      drawStage(null);
      if (good < 10) {
        setStatus(t('bazaar.35') + good + t('bazaar.36'), 'bad');
        Sound.play('lose');
        return;
      }
      setStatus(t('bazaar.37'), 'ok');
      const stars = attempts === 1 ? 3 : attempts === 2 ? 2 : 1;
      const gain = ctx.finishLevel(stars, stars * 50);
      Sound.play('level');
      FX.confetti();
      const last = ctx.level >= ctx.levelCount;
      ctx.modal({
        title: t('bazaar.38'),
        body: h('div', { class: 'rb-win' },
          h('div', { class: 'rb-win-stars', html: starsHTML(stars) }),
          h('p', null, attempts === 1 ? t('mines.26') : t('mines.16') + attempts),
          h('p', null, gain ? '+' + gain + t('robot.31') : t('tracer.22'))),
        actions: [
          { label: t('robot.35') },
          last ? { label: t('robot.21'), primary: true, onclick: ctx.levels } : { label: t('robot.36'), primary: true, onclick: () => ctx.goLevel(ctx.level + 1) }
        ]
      });
    }

    function setStatus(msg, kind) {
      status.className = 'rb-status' + (kind ? ' ' + kind : '');
      status.innerHTML = msg ? rich(msg) : '';
    }

    return {
      pause() { if (running) { clearTimers(); running = false; runBtn.disabled = false; editor.setReadOnly(false); setStatus(t('bazaar.39')); } },
      destroy: clearTimers
    };
  }
});
