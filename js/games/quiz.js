/* Игра «Кто хочет стать программистом?» — 15 вопросов, несгораемые уровни 5 и 10.
   Подсказки: 50/50, «Запустить код», «Помощь класса» (учитель вводит проценты). */
const QuizGame = {
  PRIZES: [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000],
  SAFE: [5, 10],

  // 15 вопросов: по 3 случайных с каждого уровня сложности, варианты перемешаны
  pick(bank) {
    const shuffle = arr => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    };
    const out = [];
    for (let tier = 1; tier <= 5; tier++) {
      shuffle(bank.filter(q => q.tier === tier)).slice(0, 3).forEach(q => {
        const order = shuffle([0, 1, 2, 3]);
        out.push(Object.assign({}, q, { options: order.map(i => q.options[i]), answer: order.indexOf(q.answer) }));
      });
    }
    return out;
  }
};

if (typeof Games !== 'undefined') Games.register('quiz', {
  tutorial: [
    { title: t('game.quiz'), text: t('quiz.1') },
    { title: t('quiz.2'), text: t('quiz.3') },
    { title: t('quiz.4'), text: t('quiz.5') }
  ],

  stars(records) {
    const r = records.quiz || 0;
    return r >= 15 ? 3 : r >= 10 ? 2 : r >= 5 ? 1 : 0;
  },

  mount(host, ctx) {
    const P = QuizGame.PRIZES;
    const fmt = n => n.toLocaleString('ru-RU') + t('quiz.6');
    const LET = ['A', 'B', 'C', 'D'];
    let qs = [], n = 0, sel = -1, state = 'start', used = {}, hidden = [], revealTimer = null;

    const ladder = h('ol', { class: 'qz-ladder', reversed: true });
    const main = h('div', { class: 'qz-main' });
    host.append(h('div', { class: 'qz-layout' }, main, ladder));

    function safeSum() {
      const s = QuizGame.SAFE.filter(k => k <= n).pop();
      return s ? P[s - 1] : 0;
    }

    function drawLadder() {
      ladder.innerHTML = '';
      for (let i = P.length - 1; i >= 0; i--) {
        ladder.append(h('li', { class: (i === n && state === 'play' ? 'cur ' : '') + (i < n ? 'done ' : '') + (QuizGame.SAFE.includes(i + 1) ? 'safe' : '') },
          h('span', null, i + 1), h('b', null, fmt(P[i]))));
      }
    }

    function start() {
      qs = QuizGame.pick(QUIZ);
      n = 0; used = {}; state = 'play';
      ask();
    }

    function showStart() {
      main.innerHTML = '';
      main.append(h('div', { class: 'tf-panel qz-start' },
        h('div', { class: 'tf-big' }, '💰'),
        h('h2', null, t('game.quiz')),
        h('p', null, t('quiz.7')),
        h('p', { class: 'muted' }, t('quiz.8') + (Progress.state.records.quiz || 0) + t('quiz.9')),
        h('button', { class: 'btn primary', onclick: start }, t('quiz.10'))));
      drawLadder();
    }

    function ask() {
      sel = -1;
      hidden = [];
      const q = qs[n];
      main.innerHTML = '';
      const life = (key, icon, label, fn, disabled) => h('button', {
        class: 'btn qz-life' + (used[key] ? ' used' : ''), disabled: used[key] || disabled || null,
        title: label, onclick: () => { used[key] = true; fn(); drawLife(); }
      }, icon, h('small', null, label));
      const lifeBox = h('div', { class: 'qz-lifes' });
      const drawLife = () => {
        lifeBox.innerHTML = '';
        lifeBox.append(
          life('fifty', '✂️', '50/50', fifty),
          life('run', '▶️', t('quiz.11'), runCode, !q.code),
          life('class', '🙋', t('quiz.12'), askClass));
      };
      drawLife();
      const extra = h('div', { class: 'qz-extra' });
      const opts = h('div', { class: 'qz-options' }, q.options.map((o, i) => {
        const multi = o.includes('\n');
        return h('button', { class: 'qz-opt' + (multi ? ' multi' : ''), 'data-i': i, onclick: () => choose(i) },
          h('span', { class: 'qz-let' }, LET[i] + ':'),
          h('span', { class: 'qz-text', html: multi || /[()=<>%"]/.test(o) ? '<code>' + o.split('\n').map(Highlight.line).join('<br>') + '</code>' : Highlight.esc(o) }));
      }));
      const confirm = h('button', { class: 'btn primary qz-final', disabled: true, onclick: final }, t('quiz.13'));
      main.append(...[
        h('div', { class: 'qz-head' },
          h('span', null, t('quest.30'), h('b', null, n + 1), t('quiz.14'), h('b', null, fmt(P[n]))),
          h('button', { class: 'btn small ghost', onclick: walkAway, disabled: n === 0 || null }, t('quiz.15') + (n ? fmt(P[n - 1]) : ''))),
        lifeBox,
        h('div', { class: 'qz-q' }, q.q),
        q.code ? h('div', { html: Highlight.code(q.code) }) : null,
        extra, opts, h('div', { class: 'row' }, confirm)].filter(Boolean));
      main._opts = opts;
      main._confirm = confirm;
      main._extra = extra;
      drawLadder();
    }

    function choose(i) {
      if (state !== 'play' || hidden.includes(i) || main._opts.querySelector('.right')) return;
      sel = i;
      $$('.qz-opt', main._opts).forEach(b => b.classList.toggle('sel', +b.dataset.i === i));
      main._confirm.disabled = false;
      Sound.play('click');
    }

    function fifty() {
      const q = qs[n];
      hidden = shuffle([0, 1, 2, 3].filter(i => i !== q.answer)).slice(0, 2);
      hidden.forEach(i => {
        const b = $('.qz-opt[data-i="' + i + '"]', main._opts);
        b.classList.add('hidden');
        b.disabled = true;
      });
      if (hidden.includes(sel)) { sel = -1; main._confirm.disabled = true; }
      Sound.play('hint');
    }

    function runCode() {
      const q = qs[n];
      const r = Py.run(q.code, { inputs: q.inputs || [] });
      main._extra.append(h('div', { class: 'qz-run' }, h('b', null, t('quiz.16')),
        h('pre', { class: 'tr-out' }, r.ok ? (r.output || t('maze.7')) : '⚠ ' + r.error)));
      Sound.play('hint');
    }

    function askClass() {
      const inputs = LET.map((l, i) => h('label', { class: 'qz-vote' + (hidden.includes(i) ? ' off' : '') }, h('b', null, l), h('input', {
        class: 'input', type: 'number', min: '0', max: '100', inputmode: 'numeric', value: '', disabled: hidden.includes(i) || null, 'aria-label': t('quiz.17') + l
      }), '%'));
      ctx.modal({
        title: t('quiz.18'),
        body: h('div', null, h('p', { class: 'muted' }, t('quiz.19')), h('div', { class: 'qz-votes' }, inputs)),
        actions: [{ label: t('quiz.20'), primary: true, onclick: () => {
          const vals = inputs.map(l => Math.max(0, Math.min(100, +l.querySelector('input').value || 0)));
          const max = Math.max(1, ...vals);
          main._extra.append(h('div', { class: 'qz-chart' }, vals.map((v, i) => h('div', { class: 'qz-bar' },
            h('span', { class: 'qz-bar-fill', style: { height: (v / max * 100) + '%' } }),
            h('b', null, v + '%'), h('span', null, LET[i])))));
        } }]
      });
    }

    function final() {
      if (sel < 0 || state !== 'play') return;
      state = 'reveal';
      main._confirm.disabled = true;
      $$('.qz-opt', main._opts).forEach(b => { b.disabled = true; });
      const q = qs[n];
      Sound.play('tick');
      revealTimer = setTimeout(() => {
        const right = $('.qz-opt[data-i="' + q.answer + '"]', main._opts);
        right.classList.add('right');
        const ok = sel === q.answer;
        if (!ok) $('.qz-opt[data-i="' + sel + '"]', main._opts).classList.add('wrong');
        main._extra.append(h('div', { class: 'qz-explain ' + (ok ? 'ok' : 'bad') }, (ok ? t('quest.23') : t('quest.24')) + q.explain));
        if (ok) {
          Sound.play(n === 14 ? 'win' : 'ok');
          n++;
          drawLadder();
          if (n === 15) return setTimeout(() => finish(true, P[14]), 1200);
          state = 'play';
          const next = h('button', { class: 'btn primary qz-final', onclick: ask }, t('quiz.21'));
          main._confirm.replaceWith(next);
          main._confirm = next;
          next.focus();
          if (QuizGame.SAFE.includes(n)) FX.toast(t('quiz.safeSum') + fmt(P[n - 1]), '🔒');
        } else {
          Sound.play('lose');
          setTimeout(() => finish(false, safeSum()), 2200);
        }
      }, 1300);
    }

    function walkAway() {
      if (state !== 'play' || n === 0) return;
      finish(false, P[n - 1], true);
    }

    function finish(won, sum, walked) {
      state = 'over';
      clearTimeout(revealTimer);
      const isRecord = ctx.record('quiz', n);
      ctx.addPoints(n * 10 + (won ? 50 : 0));
      if (won) FX.confetti();
      main.innerHTML = '';
      main.append(h('div', { class: 'tf-panel qz-start' },
        h('div', { class: 'tf-big' }, won ? '🏆' : walked ? '💼' : '🎓'),
        h('h2', null, won ? t('quiz.22') : walked ? t('quiz.23') : t('game.over')),
        h('p', { class: 'qz-sum' }, fmt(sum)),
        h('p', null, t('quest.25') + n + t('quiz.24') + (n * 10 + (won ? 50 : 0)) + t('robot.31')),
        isRecord && n ? h('p', { class: 'tf-record' }, '🏆 ' + t('game.newrecord')) : null,
        h('div', { class: 'row', style: { justifyContent: 'center' } },
          h('button', { class: 'btn', onclick: ctx.exit }, t('game.tolist')),
          h('button', { class: 'btn primary', onclick: start }, '↺ ' + t('game.playagain')))));
      drawLadder();
    }

    function onKey(e) {
      if (document.querySelector('.modal-back') || e.target.tagName === 'INPUT') return;
      const k = e.key.toUpperCase();
      const i = 'ABCD'.indexOf(k) >= 0 ? 'ABCD'.indexOf(k) : '1234'.indexOf(k);
      if (state === 'play' && i >= 0 && main._opts) choose(i);
      else if (e.key === 'Enter' && state === 'play' && main._confirm && !main._confirm.disabled && e.target.tagName !== 'BUTTON') { e.preventDefault(); main._confirm.click(); }
    }
    document.addEventListener('keydown', onKey);

    showStart();

    return { destroy() { clearTimeout(revealTimer); document.removeEventListener('keydown', onKey); } };
  }
});
