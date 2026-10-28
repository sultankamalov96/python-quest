/* Пазл «Лабиринт» (обратная задача): подобрать входные данные, чтобы дойти до цели.
   data: { inputLabels, goal: '💎', avoid: ['👹', '💀'], ways: 2, solutions: [[...], ...] }
   Путь программы анимированно подсвечивается. Бонус — за второй, другой путь к цели. */
Puzzles.register('maze', {
  mount(host, task, ctx) {
    const d = task.data;
    const BONUS = 50;
    const found = [];           // «подписи» найденных путей к цели
    let timers = [], running = false;

    const codeBox = h('div', { class: 'mz-code', html: Highlight.code(task.code) });
    const fields = d.inputLabels.map(lbl => h('input', { class: 'input mz-input', type: 'text', inputmode: 'numeric', autocomplete: 'off', 'aria-label': lbl }));
    const runBtn = h('button', { class: 'btn primary', onclick: run }, t('maze.1'));
    const ending = h('div', { class: 'mz-ending', 'aria-live': 'polite' });
    const goals = h('div', { class: 'mz-goals' });
    host.append(
      h('p', { class: 'muted' }, t('maze.2') + d.goal + t('maze.3') +
        (d.ways > 1 ? t('maze.4') + d.ways + t('maze.5') : '')),
      h('div', { class: 'mz-layout' },
        codeBox,
        h('div', { class: 'mz-panel' },
          h('div', { class: 'mz-fields' }, fields.map((f, i) => h('label', null, h('code', null, d.inputLabels[i] + ' = '), f))),
          runBtn, ending, goals)));
    fields.forEach(f => f.addEventListener('keydown', e => { if (e.key === 'Enter') run(); }));

    function clearPath() {
      timers.forEach(clearTimeout);
      timers = [];
      $$('.code-line', codeBox).forEach(l => l.classList.remove('active', 'visited'));
    }

    function run() {
      if (running) return;
      const inputs = fields.map(f => f.value.trim());
      if (inputs.some(v => v === '')) { ctx.setStatus(t('maze.6'), 'bad'); return; }
      clearPath();
      ending.innerHTML = '';
      const r = Py.run(task.code, { inputs, trace: true });
      const lines = r.trace.map(s => s.line);
      const sig = Array.from(new Set(lines)).sort((a, b) => a - b).join(',');
      const delay = FX.reduced() ? 0 : 280;
      running = true;
      runBtn.disabled = true;
      lines.forEach((ln, k) => {
        timers.push(setTimeout(() => {
          $$('.code-line', codeBox).forEach(l => {
            const n = +l.dataset.line;
            if (n === ln) l.classList.add('active', 'visited');
            else l.classList.remove('active');
          });
          Sound.play('step');
        }, k * delay));
      });
      timers.push(setTimeout(() => finish(r, sig), lines.length * delay + 100));
    }

    function finish(r, sig) {
      running = false;
      runBtn.disabled = false;
      if (!r.ok) {
        ending.append(h('div', { class: 'mz-end err' }, '⚠ ' + r.error));
        return;
      }
      const out = r.output.trim();
      const win = out.includes(d.goal) && !(d.avoid || []).some(a => out.includes(a));
      ending.append(h('div', { class: 'mz-end' + (win ? ' win' : ' lose') }, h('span', { class: 'mz-big' }, out || t('maze.7'))));
      if (!win) {
        ctx.setStatus(t('maze.8'), 'bad');
        Sound.play('bad');
        return;
      }
      if (!found.length) {
        found.push(sig);
        ctx.onCorrect(d.ways > 1 ? t('maze.9') + BONUS + t('maze.10') : '');
        drawGoals();
        return;
      }
      if (found.includes(sig)) {
        ctx.setStatus(t('maze.11'), 'bad');
        return;
      }
      found.push(sig);
      drawGoals();
      const pts = Progress.taskBonus(task.id, BONUS);
      Sound.play('win');
      FX.confetti();
      App.updateScore();
      ctx.setStatus(t('maze.12') + (pts ? t('maze.13') + pts + t('maze.14') : ''), 'ok');
    }

    function drawGoals() {
      if (!(d.ways > 1)) return;
      goals.innerHTML = '';
      for (let i = 0; i < d.ways; i++) goals.append(h('span', { class: 'mz-way' + (i < found.length ? ' on' : '') }, i < found.length ? d.goal : '?'));
    }

    return {
      reveal() {
        ctx.setStatus(t('maze.15') + d.solutions.map(s => s.join(t('maze.16'))).join('; '), 'ok');
        d.solutions[0].forEach((v, i) => { fields[i].value = v; });
      },
      destroy: clearPath
    };
  }
});
