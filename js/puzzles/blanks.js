/* Пазл «Заполни пропуски»: плитки из банка перетаскиваются в пропуски ___1___.
   data: { answers: {1: ['while'], …}, bank: [...] } */
Puzzles.register('blanks', {
  mount(host, task, ctx) {
    const d = task.data;
    let selected = null, done = false;

    const html = Highlight.code(task.code).replace(/___(\d+)___/g, t('blanks.1'));
    const codeBox = h('div', { class: 'bl-code', html });
    const bank = h('div', { class: 'bl-bank', 'data-bank': '1' });
    const checkBtn = h('button', { class: 'btn primary', onclick: check }, '✔ ' + t('task.check'));
    host.append(
      h('p', { class: 'muted' }, t('blanks.2')),
      codeBox, h('h4', null, t('blanks.3')), bank, h('div', { class: 'row' }, checkBtn));

    const slots = $$('.slot', codeBox);

    function tile(text) {
      const el = h('button', { class: 'tile', type: 'button' }, text);
      DnD.drag(el, {
        enabled: () => !done,
        start: () => select(null),
        drop(ev) {
          const target = DnD.at(ev.clientX, ev.clientY);
          const slot = target && target.closest('.slot');
          if (slot) put(el, slot);
          else if (target && target.closest('[data-bank]')) toBank(el);
        },
        tap: () => {
          if (done) return;
          if (el.parentNode.classList.contains('slot')) toBank(el);
          else select(selected === el ? null : el);
        }
      });
      return el;
    }

    function select(el) {
      if (selected) selected.classList.remove('sel');
      selected = el;
      if (el) el.classList.add('sel');
      slots.forEach(s => s.classList.toggle('waiting', !!el && !s.firstChild));
    }

    function put(el, slot) {
      const old = slot.querySelector('.tile');
      if (old && old !== el) toBank(old);
      slot.append(el);
      slot.classList.add('filled');
      slot.classList.remove('ok', 'bad');
      select(null);
      ctx.setStatus('');
      Sound.play('click');
    }

    function toBank(el) {
      const slot = el.parentNode;
      bank.append(el);
      if (slot.classList.contains('slot')) slot.classList.remove('filled', 'ok', 'bad');
      select(null);
    }

    slots.forEach(s => {
      s.addEventListener('click', () => { if (selected && !done) put(selected, s); });
      s.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && selected) { e.preventDefault(); put(selected, s); } });
    });
    shuffle(d.bank).forEach(x => bank.append(tile(x)));

    function check() {
      const empty = slots.filter(s => !s.querySelector('.tile'));
      if (empty.length) { ctx.setStatus(t('blanks.4') + empty.length + ').', 'bad'); return; }
      let wrong = 0;
      slots.forEach(s => {
        const ok = (d.answers[s.dataset.slot] || []).includes(s.querySelector('.tile').textContent);
        s.classList.toggle('ok', ok);
        s.classList.toggle('bad', !ok);
        if (!ok) wrong++;
      });
      if (wrong) return ctx.onWrong(t('blanks.5') + wrong + t('blanks.6'));
      done = true;
      checkBtn.disabled = true;
      ctx.onCorrect();
    }

    return {
      reveal() {
        slots.forEach(s => {
          const want = d.answers[s.dataset.slot][0];
          const cur = s.querySelector('.tile');
          if (cur && cur.textContent === want) return;
          const free = $$('.tile', bank).find(x => x.textContent === want);
          if (free) put(free, s);
        });
        ctx.setStatus(t('parsons.22'), 'ok');
      }
    };
  }
});
