/* Генерация SVG блок-схем из описания в tasks.js.
   Узлы: {t:'start'} {t:'end'} {t:'io', text} {t:'act', text}
         {t:'if', text, yes:[...], no:[...]}
         {t:'while', text, body:[...]}  {t:'for', text, body:[...]}
   Flowchart.svg(chart) → строка SVG */
const Flowchart = (function () {
  'use strict';
  const CH = 8.2;        // ширина символа моноширинного шрифта 13px
  const GAP = 26;        // вертикальный промежуток между блоками
  const H = 40;          // высота простого блока
  const DH = 60;         // высота ромба
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tw = s => String(s).length * CH;

  const line = (x1, y1, x2, y2, arrow) =>
    '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" class="fc-edge"' + (arrow ? ' marker-end="url(#fc-arrow)"' : '') + '/>';
  const poly = (pts, arrow) =>
    '<polyline points="' + pts.map(p => p.join(',')).join(' ') + '" class="fc-edge" fill="none"' + (arrow ? ' marker-end="url(#fc-arrow)"' : '') + '/>';
  const label = (x, y, s, anchor) => '<text x="' + x + '" y="' + y + '" class="fc-label" text-anchor="' + (anchor || 'middle') + '">' + esc(s) + '</text>';
  const text = (x, y, s) => '<text x="' + x + '" y="' + y + '" class="fc-text" text-anchor="middle" dominant-baseline="central">' + esc(s) + '</text>';
  const LH = 16;         // межстрочный интервал в ромбе

  // Длинное условие переносим по and / or, чтобы схема не становилась мелкой
  function wrap(s, max) {
    max = max || 24;
    if (s.length <= max) return [s];
    const parts = s.split(/(?= and | or )/);
    const lines = [];
    for (const p of parts) {
      const last = lines[lines.length - 1];
      if (last !== undefined && (last + p).length <= max) lines[lines.length - 1] = last + p;
      else lines.push(p.trim());
    }
    return lines;
  }
  const lines = (x, y, ls) => ls.map((l, i) => text(x, y + (i - (ls.length - 1) / 2) * LH, l)).join('');
  // ромб сужается к вершинам, поэтому многострочному тексту нужен запас по ширине и высоте
  const condSize = (ls, pad) => ({ w: Math.max(120, Math.max(...ls.map(tw)) + pad + (ls.length - 1) * 50), h: DH + (ls.length - 1) * (LH + 8) });

  // Каждый блок: { w, h, cx, draw(ox, oy) → svg }. Вход сверху (cx, 0), выход снизу (cx, h).
  function simple(node) {
    const label0 = node.t === 'start' ? t('flow.1') : node.t === 'end' ? t('flow.2') : node.text;
    const w = Math.max(node.t === 'start' || node.t === 'end' ? 100 : 110, tw(label0) + (node.t === 'io' ? 50 : 30));
    return {
      w, h: H, cx: w / 2,
      draw(ox, oy) {
        let shape;
        if (node.t === 'start' || node.t === 'end') {
          shape = '<rect x="' + ox + '" y="' + oy + '" width="' + w + '" height="' + H + '" rx="20" class="fc-term"/>';
        } else if (node.t === 'io') {
          const k = 14;
          shape = '<polygon points="' + [[ox + k, oy], [ox + w, oy], [ox + w - k, oy + H], [ox, oy + H]].map(p => p.join(',')).join(' ') + '" class="fc-io"/>';
        } else {
          shape = '<rect x="' + ox + '" y="' + oy + '" width="' + w + '" height="' + H + '" rx="6" class="fc-act"/>';
        }
        return shape + text(ox + w / 2, oy + H / 2, label0);
      }
    };
  }

  function diamond(ox, oy, w, ls, hex, dh) {
    const cx = ox + w / 2, cy = oy + dh / 2;
    const pts = hex
      ? [[ox, cy], [ox + 16, oy], [ox + w - 16, oy], [ox + w, cy], [ox + w - 16, oy + dh], [ox + 16, oy + dh]]
      : [[cx, oy], [ox + w, cy], [cx, oy + dh], [ox, cy]];
    return '<polygon points="' + pts.map(p => p.join(',')).join(' ') + '" class="' + (hex ? 'fc-loop' : 'fc-cond') + '"/>' + lines(cx, cy, ls);
  }

  function seq(nodes) {
    const blocks = (nodes || []).map(block);
    if (!blocks.length) return { w: 0, h: 0, cx: 0, draw: () => '' };
    const L = Math.max(...blocks.map(b => b.cx));
    const R = Math.max(...blocks.map(b => b.w - b.cx));
    const h = blocks.reduce((a, b) => a + b.h, 0) + GAP * (blocks.length - 1);
    return {
      w: L + R, h, cx: L,
      draw(ox, oy) {
        let s = '', y = oy;
        blocks.forEach((b, i) => {
          if (i) { s += line(ox + L, y - GAP, ox + L, y, true); }
          s += b.draw(ox + L - b.cx, y);
          y += b.h + GAP;
        });
        return s;
      }
    };
  }

  function ifBlock(node) {
    const ls = wrap(node.text);
    const { w: dw, h: DHH } = condSize(ls, 60);
    const yes = seq(node.yes), no = seq(node.no);
    const half = Math.max(dw / 2 + 24, (yes.w - yes.cx + no.cx + 30) / 2);
    const left = Math.max(dw / 2, half + yes.cx);
    const right = Math.max(dw / 2, half + (no.w - no.cx));
    const branchTop = DHH + GAP;
    const mergeY = branchTop + Math.max(yes.h, no.h, 10) + GAP;
    return {
      w: left + right, h: mergeY, cx: left,
      draw(ox, oy) {
        const cx = ox + left, xl = cx - half, xr = cx + half, my = oy + DHH / 2;
        let s = diamond(cx - dw / 2, oy, dw, ls, false, DHH);
        // ветка «да» — слева, «нет» — справа
        if (yes.h) {
          s += poly([[cx - dw / 2, my], [xl, my], [xl, oy + branchTop]], true);
          s += yes.draw(xl - yes.cx, oy + branchTop);
          s += line(xl, oy + branchTop + yes.h, xl, oy + mergeY);
        } else s += poly([[cx - dw / 2, my], [xl, my], [xl, oy + mergeY]]);
        if (no.h) {
          s += poly([[cx + dw / 2, my], [xr, my], [xr, oy + branchTop]], true);
          s += no.draw(xr - no.cx, oy + branchTop);
          s += line(xr, oy + branchTop + no.h, xr, oy + mergeY);
        } else s += poly([[cx + dw / 2, my], [xr, my], [xr, oy + mergeY]]);
        s += poly([[xl, oy + mergeY], [xr, oy + mergeY]]);
        s += '<circle cx="' + cx + '" cy="' + (oy + mergeY) + '" r="3.5" class="fc-dot"/>';
        s += label(cx - dw / 2 - 6, my - 6, t('flow.3'), 'end') + label(cx + dw / 2 + 6, my - 6, t('flow.4'), 'start');
        return s;
      }
    };
  }

  function loopBlock(node) {
    const hex = node.t === 'for';
    const ls = wrap(node.text);
    const { w: dw0, h: DHH } = condSize(ls, hex ? 50 : 60);
    const dw = Math.max(130, dw0);
    const body = seq(node.body);
    const top = 16;                         // место для возвратной стрелки над ромбом
    const bodyTop = top + DHH + GAP;
    const bodyBottom = bodyTop + body.h;
    const laneL = Math.max(dw / 2, body.cx) + 26;
    const laneR = Math.max(dw / 2, body.w - body.cx) + 26;
    const h = bodyBottom + GAP + 18;
    return {
      w: laneL + laneR + 10, h, cx: laneL + 5,
      draw(ox, oy) {
        const cx = ox + laneL + 5, my = oy + top + DHH / 2;
        let s = line(cx, oy, cx, oy + top, true);
        s += diamond(cx - dw / 2, oy + top, dw, ls, hex, DHH);
        s += line(cx, oy + top + DHH, cx, oy + bodyTop, true);
        s += body.draw(cx - body.cx, oy + bodyTop);
        // возврат к условию
        s += poly([[cx, oy + bodyBottom], [cx, oy + bodyBottom + 12], [cx - laneL, oy + bodyBottom + 12], [cx - laneL, oy + 6], [cx - 4, oy + 6]], true);
        // выход из цикла
        s += poly([[cx + dw / 2, my], [cx + laneR, my], [cx + laneR, oy + h - 8], [cx, oy + h - 8], [cx, oy + h]]);
        s += label(cx + 6, oy + top + DHH + 16, hex ? t('flow.5') : t('flow.3'), 'start');
        s += label(cx + dw / 2 + 6, my - 6, hex ? t('flow.6') : t('flow.4'), 'start');
        return s;
      }
    };
  }

  function block(node) {
    if (node.t === 'if') return ifBlock(node);
    if (node.t === 'while' || node.t === 'for') return loopBlock(node);
    return simple(node);
  }

  function svg(chart) {
    const b = seq(chart);
    const pad = 12, W = b.w + pad * 2, Hh = b.h + pad * 2;
    return '<svg class="flowchart" viewBox="0 0 ' + W + ' ' + Hh + '" width="' + W + t('flow.7') +
      '<defs><marker id="fc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M0,0 L10,5 L0,10 z" class="fc-arrowhead"/></marker></defs>' +
      b.draw(pad, pad) + '</svg>';
  }

  return { svg };
})();
