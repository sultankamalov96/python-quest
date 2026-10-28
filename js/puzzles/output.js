/* Пазл «Что выведет программа?». Правильный ответ вычисляет интерпретатор.
   После первой проверки доступно пошаговое выполнение. */
Puzzles.register('output', {
  mount(host, task, ctx) {
    const inputs = task.inputs || [];
    const expected = Py.run(task.code, { inputs }).output;
    let traceInst = null;

    const answer = h('textarea', { class: 'input out-answer', rows: '4', spellcheck: 'false', autocomplete: 'off', placeholder: t('output.1') });
    const checkBtn = h('button', { class: 'btn primary', onclick: check }, '✔ ' + t('task.check'));
    const traceBtn = h('button', { class: 'btn', style: { display: 'none' }, onclick: showTrace }, t('output.2'));
    const traceHost = h('div');
    host.append(...[
      h('div', { html: Highlight.code(task.code) }),
      inputs.length ? h('p', { class: 'out-inputs' }, t('output.3'), h('code', null, inputs.join(', '))) : null,
      h('label', { class: 'out-label' }, t('output.4')), answer,
      h('div', { class: 'row wrap' }, checkBtn, traceBtn), traceHost].filter(Boolean));

    answer.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) check(); });

    function check() {
      const got = answer.value;
      if (!got.trim()) { ctx.setStatus(t('output.5'), 'bad'); return; }
      traceBtn.style.display = '';
      if (Py.sameOutput(got, expected)) {
        checkBtn.disabled = true;
        ctx.onCorrect();
        return;
      }
      const nGot = got.replace(/\s+$/, '').split('\n').length;
      const nExp = expected.replace(/\s+$/, '').split('\n').length;
      ctx.onWrong(nGot !== nExp ? t('output.6') + nGot + t('output.7') : null);
    }

    function showTrace() {
      if (traceInst) return;
      traceInst = Trace.mount(traceHost, task.code, { inputs });
      traceBtn.disabled = true;
    }

    return {
      reveal() { answer.value = expected.replace(/\n$/, ''); ctx.setStatus(t('parsons.22'), 'ok'); traceBtn.style.display = ''; },
      destroy() { if (traceInst) traceInst.destroy(); }
    };
  }
});
