/* Мини-редактор кода: textarea поверх подсвеченного <pre>.
   Tab — 4 пробела, Shift+Tab — убрать отступ, Enter сохраняет отступ, после «:» — +4 пробела,
   Backspace в начале строки удаляет отступ целиком (4 пробела).
   Editor.create(host, {value, onChange}) → {getValue, setValue, setActive, setError, setReadOnly, insertCommand, focus} */
const Editor = (function () {
  'use strict';
  const IND = '    ';

  function create(host, opts) {
    opts = opts || {};
    let active = 0, errLine = 0;

    const gutter = h('div', { class: 'ed-gutter', 'aria-hidden': 'true' });
    const pre = h('pre', { class: 'ed-pre', 'aria-hidden': 'true' });
    const ta = h('textarea', {
      class: 'ed-ta', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off',
      autocorrect: 'off', wrap: 'off', 'aria-label': t('editor.1')
    });
    const wrap = h('div', { class: 'ed' }, gutter, h('div', { class: 'ed-scroll' }, h('div', { class: 'ed-stack' }, pre, ta)));
    host.append(wrap);
    ta.value = opts.value || '';

    function render() {
      const lines = ta.value.split('\n');
      pre.innerHTML = lines.map((l, i) =>
        '<div class="ed-line' + (i + 1 === active ? ' active' : '') + (i + 1 === errLine ? ' err' : '') + '">' + (Highlight.line(l) || ' ') + '</div>').join('');
      gutter.innerHTML = lines.map((_, i) => '<div class="' + (i + 1 === active ? 'active' : '') + (i + 1 === errLine ? ' err' : '') + '">' + (i + 1) + '</div>').join('');
    }

    function changed() {
      errLine = 0;
      render();
      if (opts.onChange) opts.onChange(ta.value);
    }

    // Вставка с сохранением истории отмены (Ctrl+Z), где браузер это умеет
    function insert(text) {
      ta.focus();
      let ok = false;
      try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
      if (!ok) {
        ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
        changed();
      }
    }

    const lineStart = pos => ta.value.lastIndexOf('\n', pos - 1) + 1;
    const indentOf = line => line.match(/^ */)[0];

    function selectedLines() {
      const s = lineStart(ta.selectionStart);
      let e = ta.value.indexOf('\n', ta.selectionEnd - (ta.selectionEnd > ta.selectionStart && ta.value[ta.selectionEnd - 1] === '\n' ? 1 : 0));
      if (e < 0) e = ta.value.length;
      return [s, e];
    }

    function shiftLines(dir) {
      const [s, e] = selectedLines();
      const block = ta.value.slice(s, e);
      const out = block.split('\n').map(l => (dir > 0 ? IND + l : l.replace(/^ {1,4}/, ''))).join('\n');
      ta.setSelectionRange(s, e);
      insert(out);
      ta.setSelectionRange(s, s + out.length);
    }

    ta.addEventListener('keydown', e => {
      if (ta.readOnly) return;
      const v = ta.value, pos = ta.selectionStart, sel = ta.selectionEnd !== pos;
      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) shiftLines(-1);
        else if (sel && v.slice(pos, ta.selectionEnd).includes('\n')) shiftLines(1);
        else insert(IND);
      } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const before = v.slice(lineStart(pos), pos);
        let ind = indentOf(before);
        if (/:\s*(#.*)?$/.test(before)) ind += IND;
        insert('\n' + ind);
      } else if (e.key === 'Backspace' && !sel) {
        const before = v.slice(lineStart(pos), pos);
        if (before.length && /^ +$/.test(before)) {
          e.preventDefault();
          const n = before.length % 4 || 4;
          ta.setSelectionRange(pos - n, pos);
          insert('');
        }
      }
    });
    ta.addEventListener('input', changed);
    render();

    return {
      el: wrap,
      textarea: ta,
      getValue: () => ta.value,
      setValue(v) { ta.value = v; changed(); },
      setActive(n) { active = n || 0; render(); },
      setError(n) { errLine = n || 0; render(); },
      setReadOnly(v) { ta.readOnly = !!v; wrap.classList.toggle('ro', !!v); },
      focus() { ta.focus(); },
      // Вставить команду с кнопки-палитры: в пустую строку или новой строкой ниже
      insertCommand(cmd) {
        if (ta.readOnly) return;
        ta.focus();
        const v = ta.value;
        const pos = ta.selectionStart;
        const s = lineStart(pos);
        let e2 = v.indexOf('\n', pos);
        if (e2 < 0) e2 = v.length;
        const line = v.slice(s, e2);
        if (!line.trim()) {
          ta.setSelectionRange(s, e2);
          insert((line || (s > 0 ? indentAfter(v.slice(lineStart(s - 1), s - 1)) : '')) + cmd);
        } else {
          ta.setSelectionRange(e2, e2);
          insert('\n' + indentAfter(line) + cmd);
        }
      }
    };

    function indentAfter(line) {
      return indentOf(line) + (/:\s*(#.*)?$/.test(line) ? IND : '');
    }
  }

  return { create };
})();
