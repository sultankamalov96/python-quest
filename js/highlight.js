/* Простая подсветка синтаксиса Python.
   Highlight.line(text)  → HTML одной строки
   Highlight.code(text, {numbers, active}) → HTML блока с номерами строк */
const Highlight = (function () {
  'use strict';
  const KW = new Set(['if', 'elif', 'else', 'while', 'for', 'in', 'not', 'and', 'or', 'is', 'break',
    'continue', 'pass', 'def', 'return', 'import', 'from', 'class', 'lambda', 'try', 'except']);
  const CONST = new Set(['True', 'False', 'None']);
  const BUILTIN = new Set(['print', 'input', 'int', 'str', 'float', 'bool', 'len', 'abs', 'min', 'max',
    'range', 'round', 'sum', 'list', 'type']);
  // команды игр (робот, черепашка)
  const GAME = new Set(['forward', 'back', 'left', 'right', 'take', 'wall_ahead', 'coin_here', 'at_finish',
    'hole_ahead', 'color', 'pen_up', 'pen_down']);

  const RE = /(#.*$)|([fF]?"(?:[^"\\]|\\.)*"?|[fF]?'(?:[^'\\]|\\.)*'?)|(\b\d+\.?\d*(?:[eE][+-]?\d+)?\b)|([\p{L}_][\p{L}\p{N}_]*)|(___\d+___)|(==|!=|<=|>=|\*\*|\/\/|[+\-*/%<>=])/gu;

  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function line(text) {
    let out = '', last = 0;
    RE.lastIndex = 0;
    let m;
    while ((m = RE.exec(text))) {
      out += esc(text.slice(last, m.index));
      const [tok, com, s, num, name, blank, op] = m;
      if (com) out += '<span class="hl-com">' + esc(tok) + '</span>';
      else if (s) out += '<span class="hl-str">' + esc(tok) + '</span>';
      else if (num) out += '<span class="hl-num">' + esc(tok) + '</span>';
      else if (name) {
        const cls = KW.has(name) ? 'hl-kw' : CONST.has(name) ? 'hl-const' : BUILTIN.has(name) ? 'hl-bi' : GAME.has(name) ? 'hl-fn' : '';
        out += cls ? '<span class="' + cls + '">' + esc(tok) + '</span>' : esc(tok);
      } else if (blank) out += esc(tok);
      else if (op) out += '<span class="hl-op">' + esc(tok) + '</span>';
      last = m.index + tok.length;
    }
    return out + esc(text.slice(last));
  }

  function code(text, opts) {
    opts = opts || {};
    const lines = String(text).replace(/\r/g, '').split('\n');
    return '<pre class="code' + (opts.numbers === false ? '' : ' numbered') + '">' + lines.map((l, i) =>
      '<span class="code-line' + (opts.active === i + 1 ? ' active' : '') + '" data-line="' + (i + 1) + '">' +
      (opts.numbers === false ? '' : '<span class="ln">' + (i + 1) + '</span>') +
      '<span class="lc">' + (line(l) || ' ') + '</span></span>'
    ).join('') + '</pre>';
  }

  return { line, code, esc };
})();
