/* Пазл «Найди баг»: клик по строке с ошибкой, затем выбор исправления.
   data: { line, fixes, correct, tests, raw }
   Исправление без отступа получает отступ исходной строки.
   raw: true — варианты записаны с точным отступом (для багов в отступах). */
Puzzles.register('bug', {
  mount(host, task, ctx) {
    const d = task.data;
    const lines = task.code.split('\n');
    let phase = 'line', done = false;

    const fixText = f => (d.raw || /^\s/.test(f) ? f : lines[d.line - 1].match(/^\s*/)[0] + f);
    const codeBox = h('div', { class: 'bug-code', html: Highlight.code(task.code) });
    const fixesBox = h('div', { class: 'bug-fixes' });
    const prompt = h('p', { class: 'bug-prompt' }, t('bug.1'));
    host.append(prompt, codeBox, fixesBox);

    $$('.code-line', codeBox).forEach(el => {
      el.classList.add('clickable');
      el.tabIndex = 0;
      const pickLine = () => {
        if (done || phase !== 'line') return;
        const n = +el.dataset.line;
        if (n === d.line) {
          el.classList.add('picked');
          phase = 'fix';
          ctx.setStatus(t('bug.2') + n + t('bug.3'), 'ok');
          Sound.play('click');
          showFixes(el);
        } else {
          el.classList.add('nope');
          setTimeout(() => el.classList.remove('nope'), 700);
          ctx.onWrong(t('teacher.13') + n + t('bug.4'));
        }
      };
      el.addEventListener('click', pickLine);
      el.addEventListener('keydown', e => { if (e.key === 'Enter') pickLine(); });
    });

    function showFixes(lineEl) {
      prompt.textContent = t('bug.5') + d.line + '?';
      fixesBox.append(...d.fixes.map((f, i) => {
        // при raw отступ — часть ответа, поэтому показываем его
        const b = h('button', { class: 'bug-fix', html: '<code>' + Highlight.line(d.raw ? fixText(f) : fixText(f).trim()) + '</code>' });
        b.addEventListener('click', () => {
          if (done) return;
          if (i === d.correct) {
            done = true;
            b.classList.add('ok');
            $('.lc', lineEl).innerHTML = Highlight.line(fixText(f));
            lineEl.classList.add('fixed');
            ctx.onCorrect(resultNote(fixText(f)));
          } else {
            b.classList.add('bad');
            b.disabled = true;
            ctx.onWrong(t('bug.6'));
          }
        });
        return b;
      }));
    }

    // Покажем, как исправленный код отработал на тестовых входах
    function resultNote(fixed) {
      if (!d.tests || !d.tests.length) return '';
      const code = lines.map((l, i) => (i === d.line - 1 ? fixed : l)).join('\n');
      return d.tests.map(tc => {
        const r = Py.run(code, { inputs: tc.inputs || [] });
        const out = r.output.replace(/\n$/, '').replace(/\n/g, ' ⏎ ');
        return (tc.inputs && tc.inputs.length ? t('bug.7') + tc.inputs.join(', ') + ' → ' : t('bug.8')) + '`' + out + '`';
      }).join('\n');
    }

    return {
      reveal() {
        const el = $('.code-line[data-line="' + d.line + '"]', codeBox);
        el.classList.add('picked');
        ctx.setStatus(t('bug.9') + d.line + t('bug.10') + fixText(d.fixes[d.correct]).trim(), 'ok');
      }
    };
  }
});
