/* Игра «Сколько раз?» — быстрый счёт циклов.
   CountGen — генератор вопросов (без DOM), используется игрой и tests.html.
   Ответ всегда вычисляет интерпретатор. */
const CountGen = (function () {
  'use strict';
  const rI = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const rP = (r, arr) => arr[Math.floor(r() * arr.length)];

  // Шаблоны по сложности: каждый возвращает код с print в теле цикла
  const TEMPLATES = [
    // 0 — for и range
    [
      r => 'for i in range(' + rI(r, 3, 12) + '):\n    print(i)',
      r => { const a = rI(r, 1, 6); return 'for i in range(' + a + ', ' + (a + rI(r, 2, 9)) + '):\n    print(i)'; },
      r => { const a = rI(r, 0, 5), s = rI(r, 2, 4); return 'for i in range(' + a + ', ' + (a + rI(r, 6, 16)) + ', ' + s + '):\n    print(i)'; },
      r => 'for ch in "' + rP(r, ['python', t('count.1'), t('count.2'), t('count.3'), t('count.4'), t('count.5')]) + '":\n    print(ch)'
    ],
    // 1 — отрицательный шаг и while
    [
      r => { const a = rI(r, 8, 15), s = rI(r, 1, 3); return 'for i in range(' + a + ', ' + rI(r, 0, 4) + ', -' + s + '):\n    print(i)'; },
      r => { const s = rI(r, 2, 5); return 'n = ' + rI(r, 0, 3) + '\nwhile n < ' + rI(r, 10, 20) + ':\n    n += ' + s + '\n    print(n)'; },
      r => { const s = rI(r, 2, 4); return 'energy = ' + rI(r, 10, 20) + '\nwhile energy > 0:\n    energy -= ' + s + '\n    print(energy)'; },
      r => 'n = ' + rP(r, [32, 64, 100, 81, 50]) + '\nwhile n > 1:\n    n //= ' + rP(r, [2, 3]) + '\n    print(n)'
    ],
    // 2 — вложенные циклы
    [
      r => 'for i in range(' + rI(r, 2, 4) + '):\n    for j in range(' + rI(r, 2, 5) + '):\n        print(i, j)',
      r => 'for i in range(1, ' + rI(r, 3, 6) + '):\n    for j in range(i):\n        print(i * j)',
      r => 'for i in range(' + rI(r, 2, 4) + t('count.6') + rI(r, 2, 3) + '):\n        print(j)'
    ],
    // 3 — break и continue, условия в цикле
    [
      r => { const k = rI(r, 2, 4); return 'for i in range(1, ' + rI(r, 8, 14) + '):\n    if i % ' + k + ' == 0:\n        continue\n    print(i)'; },
      r => 'for i in range(' + rI(r, 10, 20) + '):\n    if i * i > ' + rI(r, 10, 40) + ':\n        break\n    print(i)',
      r => 'n = 0\nwhile True:\n    n += ' + rI(r, 2, 4) + '\n    if n > ' + rI(r, 9, 18) + ':\n        break\n    print(n)',
      r => { const k = rI(r, 3, 5); return 'for i in range(' + rI(r, 10, 16) + '):\n    if i % ' + k + ' == 0:\n        print(i)'; }
    ]
  ];

  const levelFor = q => (q < 3 ? 0 : q < 6 ? 1 : q < 8 ? 2 : 3);

  function gen(qIndex, r) {
    r = r || Math.random;
    const lvl = levelFor(qIndex);
    for (let k = 0; k < 50; k++) {
      const code = rP(r, TEMPLATES[lvl])(r);
      const res = Py.run(code);
      if (!res.ok) continue;
      const lines = res.output.replace(/\n$/, '').split('\n').filter(l => l !== '');
      if (!lines.length || lines.length > 30) continue;
      const last = lines[lines.length - 1];
      // «последнее число» спрашиваем, только если печатается одно число
      const askLast = /^-?\d+$/.test(last) && r() < 0.45;
      return {
        code, level: lvl,
        kind: askLast ? 'last' : 'count',
        question: askLast ? t('count.7') : t('count.8'),
        answer: askLast ? last : String(lines.length),
        output: lines
      };
    }
    return gen(qIndex, Math.random);
  }

  return { gen, levelFor };
})();

if (typeof Games !== 'undefined') Games.register('count', {
  tutorial: [
    { title: t('game.count'), text: t('count.9'), code: 'for i in range(2, 9, 3):\n    print(i)' },
    { title: t('count.10'), text: t('count.11') },
    { title: t('count.12'), text: t('count.13') }
  ],

  stars(records) {
    const r = records.count || 0;
    return r >= 10 ? 3 : r >= 8 ? 2 : r >= 5 ? 1 : 0;
  },

  mount(host, ctx) {
    const TOTAL = 10, TIME = 15000;
    let state = 'start', q = 0, cur = null, left = TIME, raf = 0, last = 0, paused = false;
    let correct = 0, score = 0, log = [], nextTimer = null;

    const hud = h('div', { class: 'ct-hud' });
    const timerBar = h('div', { class: 'ct-timer' }, h('span'));
    const stage = h('div', { class: 'ct-stage' });
    host.append(hud, timerBar, stage);

    function drawHud() {
      hud.innerHTML = '';
      hud.append(
        h('span', null, t('quest.30'), h('b', null, Math.min(q + 1, TOTAL)), t('app.1') + TOTAL),
        h('span', null, t('count.14'), h('b', null, correct)),
        h('span', null, t('tf.11'), h('b', null, score)),
        h('span', { class: 'muted' }, t('game.record', { n: (Progress.state.records.count || 0) + '/10' })));
    }

    function showStart() {
      state = 'start';
      timerBar.style.visibility = 'hidden';
      stage.innerHTML = '';
      stage.append(h('div', { class: 'tf-panel ct-panel' },
        h('div', { class: 'tf-big' }, '🔢'),
        h('h2', null, t('game.count')),
        h('p', null, t('count.15')),
        ctx.settings.noTimer ? h('p', { class: 'muted' }, t('count.16')) : null,
        h('button', { class: 'btn primary', onclick: startRound }, t('count.17')),
        h('p', { class: 'muted small' }, t('count.18'))));
    }

    function startRound() {
      q = 0; correct = 0; score = 0; log = [];
      ask();
      cancelAnimationFrame(raf);
      last = 0;
      raf = requestAnimationFrame(frame);
    }

    function ask() {
      state = 'ask';
      cur = CountGen.gen(q);
      left = TIME;
      timerBar.style.visibility = ctx.settings.noTimer ? 'hidden' : '';
      const input = h('input', { class: 'input ct-input', type: 'text', inputmode: 'numeric', autocomplete: 'off', 'aria-label': t('quest.26') });
      const keypad = h('div', { class: 'ct-keypad' },
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '−', '0', '⌫'].map(k => h('button', { class: 'btn ct-key', type: 'button', onclick: () => {
          if (k === '⌫') input.value = input.value.slice(0, -1);
          else if (k === '−') input.value = input.value.startsWith('-') ? input.value.slice(1) : '-' + input.value;
          else input.value += k;
          input.focus();
        } }, k)));
      stage.innerHTML = '';
      stage.append(h('div', { class: 'ct-question' },
        h('div', { class: 'ct-code', html: Highlight.code(cur.code) }),
        h('div', { class: 'ct-side' },
          h('p', { class: 'ct-ask' }, cur.question),
          h('div', { class: 'ct-answer-row' }, input, h('button', { class: 'btn primary', onclick: () => submit(input.value) }, 'OK')),
          keypad)));
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(input.value); } });
      setTimeout(() => input.focus(), 30);
      drawHud();
    }

    function frame(ts) {
      if (!last) last = ts;
      const dt = Math.min(100, ts - last);
      last = ts;
      if (state === 'ask' && !paused && !ctx.settings.noTimer) {
        left -= dt;
        const p = Math.max(0, left / TIME);
        timerBar.firstChild.style.width = (p * 100) + '%';
        timerBar.classList.toggle('low', left < 5000);
        if (left <= 0) submit(null);
      }
      raf = requestAnimationFrame(frame);
    }

    function submit(val) {
      if (state !== 'ask' || paused) return;
      const v = val === null ? null : String(val).trim().replace('−', '-');
      if (v === '') return;
      state = 'result';
      const ok = v !== null && Number(v) === Number(cur.answer);
      const bonus = ok && !ctx.settings.noTimer ? Math.ceil(left / 1000) : 0;
      if (ok) { correct++; score += 10 + bonus; Sound.play('ok'); }
      else Sound.play('bad');
      log.push({ cur, given: v, ok });
      const explain = cur.kind === 'count'
        ? t('count.19') + cur.answer + ' ' + times(+cur.answer) + ': ' + cur.output.join(' · ')
        : t('count.20') + cur.output.join(' · ') + t('count.21') + cur.answer;
      const side = stage.querySelector('.ct-side');
      side.innerHTML = '';
      side.append(
        h('div', { class: 'ct-result ' + (ok ? 'ok' : 'bad') },
          h('b', null, ok ? t('count.22') + (10 + bonus) : v === null ? t('count.23') : t('count.24') + v),
          h('div', null, t('count.25'), h('b', null, cur.answer)),
          h('div', { class: 'ct-explain' }, explain)),
        h('button', { class: 'btn primary', onclick: next }, q + 1 < TOTAL ? t('count.26') : t('count.27')));
      if (!ok) FX.shake(side);
      side.querySelector('button').focus();
      drawHud();
      clearTimeout(nextTimer);
      nextTimer = setTimeout(() => { if (!paused && state === 'result') next(); }, ok ? 2200 : 5000);
    }

    function next() {
      if (state !== 'result') return;
      clearTimeout(nextTimer);
      q++;
      if (q >= TOTAL) finish();
      else ask();
    }

    function times(n) {
      const d = n % 10, dd = n % 100;
      return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? t('count.28') : t('count.29');
    }

    function finish() {
      state = 'over';
      timerBar.style.visibility = 'hidden';
      const isRecord = ctx.record('count', correct);
      if (score) ctx.addPoints(score);
      Sound.play(correct >= 8 ? 'win' : 'lose');
      if (correct === TOTAL) FX.confetti();
      stage.innerHTML = '';
      stage.append(h('div', { class: 'tf-panel ct-panel' },
        h('h2', null, t('count.30')),
        h('div', { class: 'tf-big' }, correct + ' / ' + TOTAL),
        isRecord && correct ? h('p', { class: 'tf-record' }, '🏆 ' + t('game.newrecord')) : null,
        h('p', null, '+' + score + t('robot.31')),
        h('div', { class: 'ct-log' }, log.map((l, i) => h('div', { class: 'ct-log-row ' + (l.ok ? 'ok' : 'bad') },
          h('span', null, (l.ok ? '✔ ' : '✘ ') + (i + 1) + '. ' + (l.cur.kind === 'count' ? t('count.31') : t('count.32'))),
          h('span', null, t('count.33') + l.cur.answer + (l.ok ? '' : t('count.34') + (l.given === null ? '—' : l.given)))))),
        h('div', { class: 'row', style: { justifyContent: 'center' } },
          h('button', { class: 'btn', onclick: ctx.exit }, t('game.tolist')),
          h('button', { class: 'btn primary', onclick: startRound }, '↺ ' + t('game.playagain')))));
      drawHud();
    }

    function onKey(e) {
      if (document.querySelector('.modal-back')) return;
      if (e.key === 'Enter' && (state === 'start' || state === 'over') && e.target.tagName !== 'BUTTON') { e.preventDefault(); startRound(); }
      else if (state === 'ask' && /^[0-9-]$/.test(e.key) && e.target.tagName !== 'INPUT') {
        const inp = stage.querySelector('.ct-input');
        if (inp) { inp.focus(); }
      }
    }
    document.addEventListener('keydown', onKey);

    drawHud();
    showStart();

    return {
      pause() { paused = true; clearTimeout(nextTimer); },
      resume() { paused = false; last = 0; if (state === 'result') nextTimer = setTimeout(next, 1500); },
      destroy() { cancelAnimationFrame(raf); clearTimeout(nextTimer); document.removeEventListener('keydown', onKey); }
    };
  }
});
