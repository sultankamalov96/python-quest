/* Пазл «Собери код» (Parsons). Доска используется и в «Блок-схема → код».
   data: { lines, distractors, check: 'run'|'order', alt, tests } */
function ParsonsBoard(host, task, ctx, opts) {
  'use strict';
  opts = opts || {};
  const d = task.data;
  const indentOf = src => Math.round((src.length - src.trimStart().length) / 4);
  const items = d.lines.map((src, i) => ({ id: 'l' + i, text: src.trim(), indent: indentOf(src), real: true }))
    .concat((d.distractors || []).map((src, i) => ({ id: 'd' + i, text: src.trim(), indent: 0, real: false })));
  const byId = {};
  items.forEach(it => { byId[it.id] = it; });
  const hasTrash = items.some(it => !it.real);
  const correctCode = d.lines.join('\n');

  const zone = (name, empty) => h('div', { class: 'pl-zone pl-' + name, 'data-zone': name, 'data-empty': empty });
  const bank = zone('bank', t('parsons.1'));
  const code = zone('code', t('parsons.2'));
  const trash = hasTrash ? zone('trash', t('parsons.3')) : null;

  const board = h('div', { class: 'pl-board' + (opts.side ? ' with-side' : '') },
    opts.side ? h('div', { class: 'pl-side', html: opts.side }) : null,
    h('div', { class: 'pl-cols' },
      h('div', { class: 'pl-col' }, h('h4', null, t('parsons.4')), bank,
        trash ? h('h4', null, t('parsons.5')) : null, trash),
      h('div', { class: 'pl-col' }, h('h4', null, t('parsons.6')), code)));
  const checkBtn = h('button', { class: 'btn primary', onclick: check }, '✔ ' + t('task.check'));
  host.append(
    h('p', { class: 'muted pl-help' }, t('parsons.7') +
      (hasTrash ? t('parsons.8') : '')),
    board, h('div', { class: 'row' }, checkBtn));

  const sort = DnD.sortable({
    root: board, item: '.pl-line', indentZones: ['code'], indentPx: 30,
    onChange: clearMarks,
    onTap(el) {
      const z = el.parentNode.dataset.zone;
      if (z === 'code') bank.append(el);
      else code.append(el);
      sort.setIndent(el, 0);
      clearMarks();
    }
  });

  function lineEl(it) {
    const el = h('div', { class: 'pl-line', 'data-id': it.id },
      h('button', { class: 'pl-ind', 'aria-label': t('parsons.9'), onclick: () => shift(el, -1) }, '←'),
      h('code', { class: 'pl-text', html: Highlight.line(it.text) }),
      h('button', { class: 'pl-ind', 'aria-label': t('parsons.10'), onclick: () => shift(el, 1) }, '→'),
      hasTrash ? h('button', { class: 'pl-del', title: t('parsons.11'), 'aria-label': t('parsons.12'), onclick: () => { trash.append(el); clearMarks(); } }, '🗑') : null);
    sort.setIndent(el, 0);
    sort.add(el);
    return el;
  }

  function shift(el, delta) {
    sort.setIndent(el, Math.max(0, Math.min(4, (+el.dataset.indent || 0) + delta)));
    clearMarks();
  }

  // перемешиваем так, чтобы порядок не совпал с правильным
  let order = shuffle(items);
  for (let k = 0; k < 5 && order.every((it, i) => it === items[i]); k++) order = shuffle(items);
  order.forEach(it => bank.append(lineEl(it)));

  function clearMarks() {
    $$('.pl-line', board).forEach(el => el.classList.remove('ok', 'bad'));
    ctx.setStatus('');
  }

  function current() {
    return $$('.pl-line', code).map(el => ({ it: byId[el.dataset.id], indent: +el.dataset.indent || 0, el }));
  }

  function buildCode(list) {
    return list.map(x => '    '.repeat(x.indent) + x.it.text).join('\n');
  }

  function check() {
    clearMarks();
    if (bank.children.length) {
      ctx.setStatus(hasTrash ? t('parsons.13') : t('parsons.14'), 'bad');
      return;
    }
    const list = current();
    const trap = list.find(x => !x.it.real);
    if (trap) {
      trap.el.classList.add('bad');
      return ctx.onWrong(t('parsons.15'));
    }
    const src = buildCode(list);
    if (d.check === 'run') {
      const syntax = Py.check(src);
      if (syntax) return ctx.onWrong(syntax.msg);
      for (const tc of d.tests && d.tests.length ? d.tests : [{ inputs: [] }]) {
        const inputs = tc.inputs || [];
        const exp = Py.run(correctCode, { inputs });
        const got = Py.run(src, { inputs });
        const when = inputs.length ? t('parsons.16') + inputs.join(', ') + ' ' : '';
        if (!got.ok) return ctx.onWrong(when + t('parsons.17') + got.error);
        if (!Py.sameOutput(got.output, exp.output)) {
          return ctx.onWrong(when + t('parsons.18') + oneLine(got.output) + t('parsons.19') + oneLine(exp.output) + '».');
        }
      }
    } else {
      const ids = list.map(x => x.it.id), ind = list.map(x => x.indent);
      const orders = [d.lines.map((_, i) => i)].concat(d.alt || []);
      const sameOrder = orders.some(o => o.every((li, k) => ids[k] === 'l' + li) && o.length === ids.length);
      if (!sameOrder) return ctx.onWrong(t('parsons.20'));
      const okIndent = list.every(x => x.indent === x.it.indent);
      if (!okIndent) {
        list.forEach(x => { if (x.indent !== x.it.indent) x.el.classList.add('bad'); });
        return ctx.onWrong(t('parsons.21'));
      }
    }
    list.forEach(x => x.el.classList.add('ok'));
    sort.lock(true);
    checkBtn.disabled = true;
    ctx.onCorrect();
  }

  const oneLine = s => (s.replace(/\n+$/, '').replace(/\n/g, ' ⏎ ') || t('teacher.10'));

  return {
    reveal() {
      items.forEach(it => {
        const el = $('.pl-line[data-id="' + it.id + '"]', board);
        if (it.real) { code.append(el); sort.setIndent(el, it.indent); } else (trash || bank).append(el);
      });
      ctx.setStatus(t('parsons.22'), 'ok');
    }
  };
}

Puzzles.register('parsons', { mount: (host, task, ctx) => ParsonsBoard(host, task, ctx) });
