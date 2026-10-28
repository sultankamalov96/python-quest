/* Пазл «Соедини пары»: слева код, справа результат. Клик-клик или перетаскивание линии.
   data: { pairs: [[left, right], ...], kind: 'range'|'expr'|'code'|'filter', vars } */
Puzzles.register('match', {
  mount(host, task, ctx) {
    const d = task.data;
    const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#06b6d4', '#ef4444', '#8b5cf6'];
    const links = new Map();      // индекс слева → индекс справа
    let sel = null, done = false, temp = null;

    const card = (side, text, i) => h('button', { class: 'mt-card mt-' + side, type: 'button', 'data-side': side, 'data-i': i, html: '<code>' + text.split('\n').map(Highlight.line).join('<br>') + '</code>' });
    const left = shuffle(d.pairs.map((p, i) => card('l', p[0], i)));
    const right = shuffle(d.pairs.map((p, i) => card('r', p[1], i)));
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'mt-lines');
    const board = h('div', { class: 'mt-board' }, svg, h('div', { class: 'mt-col' }, left), h('div', { class: 'mt-col' }, right));
    const checkBtn = h('button', { class: 'btn primary', onclick: check }, '✔ ' + t('task.check'));
    host.append(h('p', { class: 'muted' }, t('match.1')),
      board, h('div', { class: 'row' }, checkBtn));

    const cards = left.concat(right);
    const find = (side, i) => cards.find(c => c.dataset.side === side && +c.dataset.i === i);

    cards.forEach(c => {
      c.addEventListener('pointerdown', e => startDrag(c, e));
      c.addEventListener('click', () => clickCard(c));
    });

    function clickCard(c) {
      if (done || c._dragged) { c._dragged = false; return; }
      const side = c.dataset.side, i = +c.dataset.i;
      if (!sel) {
        if (isLinked(side, i)) { unlink(side, i); return; }
        select(c);
        return;
      }
      if (sel === c) { select(null); return; }
      if (sel.dataset.side === side) { select(c); return; }
      connect(sel, c);
    }

    function select(c) {
      if (sel) sel.classList.remove('sel');
      sel = c;
      if (c) c.classList.add('sel');
    }

    const isLinked = (side, i) => side === 'l' ? links.has(i) : Array.from(links.values()).includes(i);

    function unlink(side, i) {
      if (side === 'l') links.delete(i);
      else for (const [k, v] of links) if (v === i) links.delete(k);
      reset();
    }

    function connect(a, b) {
      const l = a.dataset.side === 'l' ? a : b, r = l === a ? b : a;
      const li = +l.dataset.i, ri = +r.dataset.i;
      links.delete(li);
      for (const [k, v] of links) if (v === ri) links.delete(k);
      links.set(li, ri);
      select(null);
      Sound.play('click');
      reset();
    }

    function reset() {
      cards.forEach(c => c.classList.remove('ok', 'bad'));
      ctx.setStatus('');
      draw();
    }

    function anchor(c, side) {
      const br = board.getBoundingClientRect(), r = c.getBoundingClientRect();
      return [side === 'l' ? r.right - br.left : r.left - br.left, r.top + r.height / 2 - br.top];
    }

    function draw(marks) {
      const br = board.getBoundingClientRect();
      svg.setAttribute('viewBox', '0 0 ' + br.width + ' ' + br.height);
      let s = '', n = 0;
      const order = left.map(c => +c.dataset.i);
      for (const li of order) {
        if (!links.has(li)) continue;
        const ri = links.get(li);
        const [x1, y1] = anchor(find('l', li), 'l'), [x2, y2] = anchor(find('r', ri), 'r');
        const col = marks ? (marks[li] ? 'var(--ok)' : 'var(--bad)') : COLORS[n++ % COLORS.length];
        s += '<path d="M' + x1 + ',' + y1 + ' C' + (x1 + x2) / 2 + ',' + y1 + ' ' + (x1 + x2) / 2 + ',' + y2 + ' ' + x2 + ',' + y2 + '" stroke="' + col + '" stroke-width="3" fill="none" stroke-linecap="round"/>' +
          '<circle cx="' + x1 + '" cy="' + y1 + '" r="5" fill="' + col + '"/><circle cx="' + x2 + '" cy="' + y2 + '" r="5" fill="' + col + '"/>';
      }
      if (temp) s += '<line x1="' + temp[0] + '" y1="' + temp[1] + '" x2="' + temp[2] + '" y2="' + temp[3] + '" stroke="var(--primary)" stroke-width="3" stroke-dasharray="6 5"/>';
      svg.innerHTML = s;
      cards.forEach(c => c.classList.toggle('linked', isLinked(c.dataset.side, +c.dataset.i)));
    }

    // Перетаскивание линии от карточки к карточке
    function startDrag(c, e) {
      if (done || e.button > 0) return;
      const sx = e.clientX, sy = e.clientY;
      let moving = false;
      const move = ev => {
        if (!moving && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) return;
        moving = true;
        ev.preventDefault();
        const br = board.getBoundingClientRect();
        const [ax, ay] = anchor(c, c.dataset.side);
        temp = [ax, ay, ev.clientX - br.left, ev.clientY - br.top];
        draw();
      };
      const up = ev => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        if (!moving) return;
        c._dragged = true;
        setTimeout(() => { c._dragged = false; }, 50);
        temp = null;
        const target = DnD.at(ev.clientX, ev.clientY);
        const other = target && target.closest('.mt-card');
        if (other && other.dataset.side !== c.dataset.side && board.contains(other)) connect(c, other);
        else draw();
      };
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    }

    function check() {
      if (links.size < d.pairs.length) { ctx.setStatus(t('match.2') + (d.pairs.length - links.size) + ').', 'bad'); return; }
      const marks = {};
      let wrong = 0;
      for (const [li, ri] of links) {
        marks[li] = li === ri;
        find('l', li).classList.toggle('ok', li === ri);
        find('l', li).classList.toggle('bad', li !== ri);
        find('r', ri).classList.toggle('ok', li === ri);
        find('r', ri).classList.toggle('bad', li !== ri);
        if (li !== ri) wrong++;
      }
      draw(marks);
      if (wrong) return ctx.onWrong(t('match.3') + wrong + t('match.4'));
      done = true;
      checkBtn.disabled = true;
      ctx.onCorrect();
    }

    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    requestAnimationFrame(() => draw());

    return {
      reveal() {
        links.clear();
        d.pairs.forEach((_, i) => links.set(i, i));
        reset();
        ctx.setStatus(t('parsons.22'), 'ok');
      },
      destroy() { window.removeEventListener('resize', onResize); }
    };
  }
});
