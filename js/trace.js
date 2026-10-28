/* Пошаговое выполнение: подсветка строки, таблица переменных, вывод.
   Trace.mount(host, code, {inputs}) → { destroy } */
const Trace = (function () {
  'use strict';

  function mount(host, code, opts) {
    opts = opts || {};
    const r = Py.run(code, { inputs: opts.inputs || [], trace: true, builtins: opts.builtins });
    const steps = r.trace;
    const names = [];
    steps.forEach(s => Object.keys(s.vars).forEach(k => { if (!names.includes(k)) names.push(k); }));
    let i = 0, timer = null;

    const codeBox = h('div', { class: 'tr-code', html: Highlight.code(code) });
    const counter = h('span', { class: 'tr-counter' });
    const btn = (label, title, fn) => h('button', { class: 'btn small', title, 'aria-label': title, onclick: fn }, label);
    const playBtn = btn(t('trace.1'), t('trace.2'), toggleAuto);
    const table = h('table', { class: 'tr-table' });
    const tableWrap = h('div', { class: 'tr-table-wrap' }, table);
    const out = h('pre', { class: 'tr-out' });
    const err = r.ok ? null : h('div', { class: 'tr-err' }, '⚠ ' + r.error);

    const box = h('div', { class: 'trace' },
      h('div', { class: 'tr-controls' },
        btn('⏮', t('trace.3'), () => go(0)),
        btn('◀', t('trace.4'), () => go(i - 1)),
        counter,
        btn('▶', t('trace.5'), () => go(i + 1)),
        btn('⏭', t('trace.6'), () => go(steps.length - 1)),
        playBtn),
      h('div', { class: 'tr-grid' },
        codeBox,
        h('div', { class: 'tr-side' }, h('b', null, t('trace.7')), out)),
      h('b', null, t('trace.8')),
      tableWrap, err);
    host.append(box);

    function toggleAuto() {
      if (timer) { stop(); return; }
      if (i >= steps.length - 1) go(0);
      playBtn.textContent = t('trace.9');
      timer = setInterval(() => { if (i >= steps.length - 1) stop(); else go(i + 1); }, 700);
    }
    function stop() { clearInterval(timer); timer = null; playBtn.textContent = t('trace.1'); }

    function go(n) {
      if (!steps.length) { counter.textContent = '0 / 0'; return; }
      i = Math.max(0, Math.min(steps.length - 1, n));
      const s = steps[i];
      counter.textContent = t('trace.10') + (i + 1) + ' / ' + steps.length;
      $$('.code-line', codeBox).forEach(l => l.classList.toggle('active', +l.dataset.line === s.line));
      out.textContent = s.out || ' ';
      let html = t('trace.11') + names.map(n => '<th>' + Highlight.esc(n) + '</th>').join('') + '</tr></thead><tbody>';
      for (let k = 0; k <= i; k++) {
        const st = steps[k], prev = k ? steps[k - 1].vars : {};
        html += '<tr' + (k === i ? ' class="cur"' : '') + '><td>' + (k + 1) + '</td><td>' + st.line + '</td>' +
          names.map(n => {
            const v = st.vars[n];
            const chg = v !== undefined && v !== prev[n];
            return '<td' + (chg ? ' class="chg"' : '') + '>' + (v === undefined ? '' : Highlight.esc(v)) + '</td>';
          }).join('') + '</tr>';
      }
      table.innerHTML = html + '</tbody>';
      const cur = table.querySelector('tr.cur');
      if (cur) tableWrap.scrollTop = cur.offsetTop - tableWrap.clientHeight + cur.offsetHeight + 8;
    }
    go(0);

    return { destroy() { stop(); box.remove(); } };
  }

  return { mount };
})();
