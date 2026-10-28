/* Перетаскивание на Pointer Events — работает и мышью, и пальцем.
   DnD.drag(el, {start, move, drop, tap, ignore}) — базовое перетаскивание с «призраком»
   DnD.sortable({root, item, indentZones, indentPx, maxIndent, onChange, onTap}) — списки строк */
const DnD = (function () {
  'use strict';
  const THRESHOLD = 6;

  function at(x, y) { return document.elementFromPoint(x, y); }

  function autoScroll(y) {
    const edge = 60;
    if (y < edge) window.scrollBy(0, -12);
    else if (y > window.innerHeight - edge) window.scrollBy(0, 12);
  }

  function drag(el, o) {
    el.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      if (o.ignore && e.target.closest(o.ignore)) return;
      if (o.enabled && !o.enabled()) return;
      const sx = e.clientX, sy = e.clientY;
      const r = el.getBoundingClientRect();
      const offX = sx - r.left, offY = sy - r.top;
      let ghost = null, started = false;

      const move = ev => {
        if (!started) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < THRESHOLD) return;
          started = true;
          ghost = el.cloneNode(true);
          ghost.classList.add('dnd-ghost');
          ghost.style.width = r.width + 'px';
          document.body.append(ghost);
          document.body.classList.add('dnd-active');
          if (o.start) o.start(el, ev);
        }
        ev.preventDefault();
        ghost.style.transform = 'translate(' + (ev.clientX - offX) + 'px,' + (ev.clientY - offY) + 'px)';
        autoScroll(ev.clientY);
        if (o.move) o.move(ev, ev.clientX - offX, ev.clientY - offY);
      };
      const up = ev => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        if (!started) { if (ev.type === 'pointerup' && o.tap) o.tap(el, ev); return; }
        ghost.remove();
        document.body.classList.remove('dnd-active');
        if (o.drop) o.drop(ev, ev.type === 'pointercancel');
      };
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
  }

  // Сортируемые зоны: элементы-строки переносятся между контейнерами с [data-zone].
  // В зонах из indentZones горизонтальное положение задаёт отступ строки.
  function sortable(cfg) {
    const indentPx = cfg.indentPx || 32;
    const maxIndent = cfg.maxIndent === undefined ? 4 : cfg.maxIndent;
    let locked = false;

    function setIndent(item, n) {
      item.dataset.indent = n;
      item.style.setProperty('--ind', n);
    }

    function place(item, zone, y) {
      const kids = Array.from(zone.children).filter(c => c !== item && c.matches(cfg.item));
      const before = kids.find(c => { const r = c.getBoundingClientRect(); return y < r.top + r.height / 2; });
      if (before) zone.insertBefore(item, before);
      else zone.append(item);
    }

    function add(item) {
      drag(item, {
        ignore: 'button',
        enabled: () => !locked,
        start: () => item.classList.add('dnd-src'),
        move(ev, left) {
          const target = at(ev.clientX, ev.clientY);
          const zone = target && target.closest('[data-zone]');
          if (!zone || !cfg.root.contains(zone)) return;
          place(item, zone, ev.clientY);
          if (cfg.indentZones && cfg.indentZones.includes(zone.dataset.zone)) {
            const zr = zone.getBoundingClientRect();
            const pad = parseFloat(getComputedStyle(zone).paddingLeft) || 0;
            setIndent(item, Math.max(0, Math.min(maxIndent, Math.round((left - zr.left - pad) / indentPx))));
          } else setIndent(item, 0);
        },
        drop() {
          item.classList.remove('dnd-src');
          if (cfg.onChange) cfg.onChange(item);
        },
        tap: () => { if (!locked && cfg.onTap) cfg.onTap(item); }
      });
    }

    return { add, setIndent, lock(v) { locked = v; } };
  }

  return { drag, sortable, at };
})();
