/* =========================================================================
   Мини-интерпретатор подмножества Python для тренажёра.

   Py.run(code, opts)        — выполнить целиком → {ok, output, error, errorLine, steps, vars, trace}
   Py.steps(code, opts)      — генератор шагов: после каждой строки {line, vars, out}
   Py.evalExpr(expr, vars)   — вычислить одно выражение с заданными переменными
   Py.check(code)            — только проверка синтаксиса → null или {msg, line}

   opts:
     inputs    — массив значений для input()
     builtins  — свои функции игры: { forward(){...}, wall_ahead(){ return true } }
     maxSteps  — лимит шагов (по умолчанию 10000)
     trace     — для run(): собрать массив шагов со снимками переменных
   ========================================================================= */
(function (root) {
  'use strict';

  class PyError extends Error {
    constructor(msg, line) {
      super(line ? 'Строка ' + line + ': ' + msg : msg.charAt(0).toUpperCase() + msg.slice(1));
      this.msg = msg;
      this.line = line || null;
    }
  }

  // ---------------------------------------------------------------- значения
  // int → number, float → PyFloat, bool → boolean, None → null, str → string,
  // list → Array, tuple → PyTuple, range → PyRange, функция → PyFunc
  class PyFloat { constructor(v) { this.v = v; } }
  class PyTuple { constructor(items) { this.items = items; } }
  class PyFunc { constructor(name, fn, user) { this.name = name; this.fn = fn; this.user = user || null; } }
  class Ret { constructor(v) { this.v = v; } }   // результат return, всплывает через блоки и циклы
  class PyRange {
    constructor(start, stop, step) { this.start = start; this.stop = stop; this.step = step; }
    get length() {
      const n = this.step > 0 ? Math.ceil((this.stop - this.start) / this.step)
                              : Math.ceil((this.start - this.stop) / -this.step);
      return Math.max(0, n);
    }
    at(i) { return this.start + i * this.step; }
    *[Symbol.iterator]() { for (let i = 0, n = this.length; i < n; i++) yield this.at(i); }
  }

  const isFloat = v => v instanceof PyFloat;
  const isNum = v => typeof v === 'number' || typeof v === 'boolean' || v instanceof PyFloat;
  const isIntLike = v => typeof v === 'number' || typeof v === 'boolean';
  const numVal = v => (v instanceof PyFloat ? v.v : +v);
  const mkNum = (v, float) => (float ? new PyFloat(v) : v);

  function typeName(v) {
    if (v === null) return 'NoneType';
    if (typeof v === 'boolean') return 'bool';
    if (typeof v === 'number') return 'int';
    if (typeof v === 'string') return 'str';
    if (v instanceof PyFloat) return 'float';
    if (Array.isArray(v)) return 'list';
    if (v instanceof PyTuple) return 'tuple';
    if (v instanceof PyRange) return 'range';
    if (v instanceof PyFunc) return 'function';
    return 'object';
  }

  function fmtFloat(x) {
    if (Number.isNaN(x)) return 'nan';
    if (!Number.isFinite(x)) return x > 0 ? 'inf' : '-inf';
    if (Object.is(x, -0)) return '-0.0';
    const a = Math.abs(x);
    let s;
    if (a !== 0 && (a >= 1e16 || a < 1e-4)) s = x.toExponential();
    else if (Number.isInteger(x)) return x.toFixed(0) + '.0';
    else s = String(x);
    return s.replace(/e([+-])(\d)$/, 'e$10$2');
  }

  function reprStr(s) {
    const q = s.includes("'") && !s.includes('"') ? '"' : "'";
    let r = s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
    if (q === "'") r = r.replace(/'/g, "\\'");
    return q + r + q;
  }

  function repr(v) {
    if (v === null) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') return reprStr(v);
    if (v instanceof PyFloat) return fmtFloat(v.v);
    if (Array.isArray(v)) return '[' + v.map(repr).join(', ') + ']';
    if (v instanceof PyTuple) return '(' + v.items.map(repr).join(', ') + (v.items.length === 1 ? ',' : '') + ')';
    if (v instanceof PyRange) return 'range(' + v.start + ', ' + v.stop + (v.step !== 1 ? ', ' + v.step : '') + ')';
    if (v instanceof PyFunc) return '<функция ' + v.name + '>';
    return String(v);
  }

  const str = v => (typeof v === 'string' ? v : repr(v));

  function truthy(v) {
    if (v === null || v === false) return false;
    if (v === true) return true;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return v.length > 0;
    if (v instanceof PyFloat) return v.v !== 0;
    if (Array.isArray(v)) return v.length > 0;
    if (v instanceof PyTuple) return v.items.length > 0;
    if (v instanceof PyRange) return v.length > 0;
    return true;
  }

  function pyEq(a, b) {
    if (isNum(a) && isNum(b)) return numVal(a) === numVal(b);
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => pyEq(x, b[i]));
    if (a instanceof PyTuple && b instanceof PyTuple) return pyEq(a.items, b.items);
    return a === b;
  }

  // JS ↔ Python для подключаемых функций игр
  function toJS(v) {
    if (v instanceof PyFloat) return v.v;
    if (v instanceof PyTuple) return v.items.map(toJS);
    if (Array.isArray(v)) return v.map(toJS);
    return v;
  }
  function fromJS(v) {
    if (v === undefined || v === null) return null;
    if (typeof v === 'number') return Number.isInteger(v) ? v : new PyFloat(v);
    if (Array.isArray(v)) return v.map(fromJS);
    return v;
  }

  // ---------------------------------------------------------------- токенайзер
  const KEYWORDS = new Set(['if', 'elif', 'else', 'while', 'for', 'in', 'not', 'and', 'or', 'is',
    'True', 'False', 'None', 'break', 'continue', 'pass', 'def', 'return', 'global']);
  const UNSUPPORTED = new Set(['class', 'import', 'from', 'try', 'except', 'finally',
    'lambda', 'with', 'nonlocal', 'del', 'yield', 'async', 'await', 'raise', 'assert']);
  const OPS3 = ['//=', '**='];
  const OPS2 = ['**', '//', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%='];
  const OPS1 = '+-*/%<>=()[]{},:.;';
  const NAME_RE = /^[\p{L}_][\p{L}\p{N}_]*/u;
  const NUM_RE = /^(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?/;

  function tokenize(code, baseLine) {
    const lines = String(code).replace(/\r\n?/g, '\n').split('\n');
    const toks = [];
    const indents = [0];
    const parens = [];
    const off = (baseLine || 1) - 1;

    for (let li = 0; li < lines.length; li++) {
      const s = lines[li];
      const line = li + 1 + off;
      let i = 0;
      const before = toks.length;

      if (parens.length === 0) {
        let col = 0;
        while (i < s.length && (s[i] === ' ' || s[i] === '\t')) { col += s[i] === '\t' ? 4 : 1; i++; }
        if (i >= s.length || s[i] === '#') continue;
        const top = indents[indents.length - 1];
        if (col > top) {
          indents.push(col);
          toks.push({ t: 'indent', line });
        } else if (col < top) {
          while (col < indents[indents.length - 1]) { indents.pop(); toks.push({ t: 'dedent', line }); }
          if (col !== indents[indents.length - 1]) {
            throw new PyError('неверный отступ — строка не совпадает по отступу ни с одним блоком выше', line);
          }
        }
      }

      while (i < s.length) {
        const c = s[i];
        if (c === ' ' || c === '\t') { i++; continue; }
        if (c === '#') break;
        const rest = s.slice(i);

        let m = NUM_RE.exec(rest);
        if (m && /[\d.]/.test(c)) {
          if (NAME_RE.test(rest.slice(m[0].length))) {
            throw new PyError('имя переменной не может начинаться с цифры: «' + rest.match(/^[\w\p{L}]+/u)[0] + '»', line);
          }
          const f = m[0].includes('.') || /e/i.test(m[0]);
          toks.push({ t: 'num', v: Number(m[0]), f, line });
          i += m[0].length;
          continue;
        }

        const isF = (c === 'f' || c === 'F') && (s[i + 1] === '"' || s[i + 1] === "'");
        if (c === '"' || c === "'" || isF) {
          if (isF) i++;
          const q = s[i];
          if (s.slice(i, i + 3) === q + q + q) throw new PyError('тройные кавычки не поддерживаются — используйте обычные', line);
          let j = i + 1, v = '';
          while (j < s.length && s[j] !== q) {
            if (s[j] === '\\' && j + 1 < s.length) {
              const e = s[j + 1];
              v += e === 'n' ? '\n' : e === 't' ? '\t' : e === '\\' ? '\\' : e === "'" ? "'" : e === '"' ? '"' : '\\' + e;
              j += 2;
            } else v += s[j++];
          }
          if (j >= s.length) throw new PyError('строка не закрыта — не хватает кавычки ' + q, line);
          toks.push({ t: isF ? 'fstr' : 'str', v, line });
          i = j + 1;
          continue;
        }

        m = NAME_RE.exec(rest);
        if (m) {
          toks.push({ t: 'name', v: m[0], line });
          i += m[0].length;
          continue;
        }

        if (rest.startsWith('&&')) throw new PyError('в Python вместо && пишут and', line);
        if (rest.startsWith('||')) throw new PyError('в Python вместо || пишут or', line);
        if (c === '!' && s[i + 1] !== '=') throw new PyError('в Python вместо ! пишут not', line);

        const op = OPS3.find(o => rest.startsWith(o)) || OPS2.find(o => rest.startsWith(o)) || (OPS1.includes(c) ? c : null);
        if (!op) throw new PyError('непонятный символ «' + c + '»', line);
        if (op === '(' || op === '[' || op === '{') parens.push({ v: op, line });
        if (op === ')' || op === ']' || op === '}') {
          if (!parens.length) throw new PyError('лишняя закрывающая скобка «' + op + '»', line);
          parens.pop();
        }
        toks.push({ t: 'op', v: op, line });
        i += op.length;
      }

      if (parens.length === 0 && toks.length > before) toks.push({ t: 'nl', line });
    }

    if (parens.length) {
      const p = parens[parens.length - 1];
      throw new PyError('не закрыта скобка «' + p.v + '»', p.line);
    }
    const last = lines.length + off;
    while (indents.length > 1) { indents.pop(); toks.push({ t: 'dedent', line: last }); }
    toks.push({ t: 'eof', line: last });
    return toks;
  }

  // ---------------------------------------------------------------- парсер
  const CMP_OPS = new Set(['<', '>', '==', '!=', '<=', '>=']);
  const AUG_OPS = new Set(['+=', '-=', '*=', '/=', '//=', '%=', '**=']);

  class Parser {
    constructor(toks) { this.toks = toks; this.p = 0; this.loops = 0; this.funcs = 0; }
    peek(o) { return this.toks[Math.min(this.p + (o || 0), this.toks.length - 1)]; }
    next() { return this.toks[this.p++]; }
    isOp(v) { const t = this.peek(); return t.t === 'op' && t.v === v; }
    isKw(v) { const t = this.peek(); return t.t === 'name' && t.v === v; }
    err(msg, tok) { return new PyError(msg, (tok || this.peek()).line); }
    expectOp(v, msg) {
      if (!this.isOp(v)) throw this.err(msg || 'ожидалось «' + v + '»');
      return this.next();
    }

    file() {
      const body = [];
      while (this.peek().t !== 'eof') body.push(...this.stmt());
      return body;
    }

    stmt() {
      const t = this.peek();
      if (t.t === 'indent') throw this.err('неверный отступ — лишние пробелы в начале строки');
      if (t.t === 'name') {
        switch (t.v) {
          case 'if': return [this.ifStmt()];
          case 'while': return [this.whileStmt()];
          case 'for': return [this.forStmt()];
          case 'def': return [this.defStmt()];
          case 'elif':
          case 'else': throw this.err(t.v + ' без if — проверьте отступы');
        }
        if (UNSUPPORTED.has(t.v)) throw this.err('конструкция ' + t.v + ' не поддерживается в этом тренажёре');
      }
      return this.simpleLine();
    }

    simpleLine() {
      const stmts = [this.simple()];
      while (this.isOp(';')) {
        this.next();
        if (this.peek().t === 'nl') break;
        stmts.push(this.simple());
      }
      const t = this.peek();
      if (t.t !== 'nl' && t.t !== 'eof') {
        const s = stmts[stmts.length - 1];
        if (s.k === 'expr' && s.e.k === 'name' && s.e.v === 'print') throw this.err('print — это функция, нужны скобки: print(...)');
        if (t.t === 'name' && t.v === 'if') throw this.err('if должен стоять в начале строки');
        if (t.t === 'op' && t.v === ':') throw this.err('лишнее двоеточие — оно ставится только после if, elif, else, while, for, def');
        throw this.err('синтаксическая ошибка — непонятно, что значит «' + (t.v !== undefined ? t.v : '') + '»');
      }
      if (t.t === 'nl') this.next();
      return stmts;
    }

    simple() {
      const t = this.peek();
      if (t.t === 'name' && (t.v === 'pass' || t.v === 'break' || t.v === 'continue')) {
        this.next();
        if (t.v !== 'pass' && this.loops === 0) throw this.err(t.v + ' можно использовать только внутри цикла', t);
        return { k: t.v, line: t.line };
      }
      if (t.t === 'name' && t.v === 'return') {
        this.next();
        if (this.funcs === 0) throw this.err('return можно использовать только внутри функции (после def)', t);
        const n = this.peek();
        const value = n.t === 'nl' || n.t === 'eof' || (n.t === 'op' && n.v === ';') ? null : this.exprList();
        return { k: 'return', value, line: t.line };
      }
      if (t.t === 'name' && t.v === 'global') {
        this.next();
        const names = [];
        do {
          if (names.length) this.next();
          const n = this.peek();
          if (n.t !== 'name' || KEYWORDS.has(n.v)) throw this.err('после global нужно имя переменной: global score');
          names.push(this.next().v);
        } while (this.isOp(','));
        return { k: 'global', names, line: t.line };
      }
      const e = this.exprList();
      if (this.isOp('=')) {
        const parts = [e];
        while (this.isOp('=')) { this.next(); parts.push(this.exprList()); }
        const value = parts.pop();
        parts.forEach(p => this.checkTarget(p, true, t));
        return { k: 'assign', targets: parts, value, line: t.line };
      }
      const op = this.peek();
      if (op.t === 'op' && AUG_OPS.has(op.v)) {
        this.checkTarget(e, false, t);
        this.next();
        return { k: 'aug', op: op.v.slice(0, -1), target: e, value: this.expr(), line: t.line };
      }
      return { k: 'expr', e, line: t.line };
    }

    checkTarget(e, allowTuple, tok) {
      if (e.k === 'name' || e.k === 'index') return;
      if (allowTuple && e.k === 'tuple' && e.items.every(x => x.k === 'name' || x.k === 'index')) return;
      if (e.k === 'cmp' || e.k === 'call') throw this.err('слева от = должно быть имя переменной (для сравнения используйте ==)', tok);
      throw this.err('слева от = должно быть имя переменной', tok);
    }

    block(kw) {
      if (!this.isOp(':')) {
        const t = this.peek();
        if (t.t === 'nl' || t.t === 'eof') throw this.err('в конце строки с ' + kw + ' нужно двоеточие «:»');
        throw this.err('ожидалось двоеточие «:» после ' + kw);
      }
      const colon = this.next();
      if (this.peek().t === 'nl') {
        this.next();
        if (this.peek().t !== 'indent') {
          throw this.err('после строки с двоеточием нужен блок с отступом (4 пробела)', this.peek().t === 'eof' ? colon : this.peek());
        }
        this.next();
        const body = [];
        while (this.peek().t !== 'dedent' && this.peek().t !== 'eof') body.push(...this.stmt());
        if (this.peek().t === 'dedent') this.next();
        return body;
      }
      if (this.peek().t === 'eof') throw this.err('после двоеточия нужен блок команд', colon);
      return this.simpleLine();
    }

    cond(kw) {
      if (this.isOp(':')) throw this.err('после ' + kw + ' нужно условие');
      const e = this.expr();
      if (this.isOp('=')) throw this.err('для сравнения используйте ==, а не =');
      return e;
    }

    ifStmt() {
      const t = this.next();
      const branches = [{ cond: this.cond('if'), line: t.line }];
      branches[0].body = this.block('if');
      while (this.isKw('elif')) {
        const et = this.next();
        const b = { cond: this.cond('elif'), line: et.line };
        b.body = this.block('elif');
        branches.push(b);
      }
      let orelse = null;
      if (this.isKw('else')) {
        this.next();
        if (!this.isOp(':')) {
          if (this.isKw('if')) throw this.err('вместо «else if» в Python пишут elif');
          if (this.peek().t !== 'nl') throw this.err('после else условие не пишут — используйте elif или просто else:');
        }
        orelse = this.block('else');
      }
      return { k: 'if', branches, orelse, line: t.line };
    }

    whileStmt() {
      const t = this.next();
      const cond = this.cond('while');
      this.loops++;
      const body = this.block('while');
      this.loops--;
      return { k: 'while', cond, body, line: t.line };
    }

    forStmt() {
      const t = this.next();
      const v = this.peek();
      if (v.t !== 'name' || KEYWORDS.has(v.v)) throw this.err('после for нужно имя переменной: for i in range(5):');
      this.next();
      if (!this.isKw('in')) throw this.err('в цикле for нужно слово in: for ' + v.v + ' in range(...):');
      this.next();
      if (this.isOp(':')) throw this.err('после in нужно указать, по чему идёт цикл, например range(5)');
      const iter = this.expr();
      this.loops++;
      const body = this.block('for');
      this.loops--;
      return { k: 'for', target: v.v, iter, body, line: t.line };
    }

    defStmt() {
      const t = this.next();
      const n = this.peek();
      if (n.t !== 'name' || KEYWORDS.has(n.v)) throw this.err('после def нужно имя функции: def hello():');
      this.next();
      if (!this.isOp('(')) throw this.err('после имени функции нужны скобки: def ' + n.v + '():');
      const open = this.next();
      const params = [];
      while (!this.isOp(')')) {
        const p = this.peek();
        if (p.t !== 'name' || KEYWORDS.has(p.v)) throw this.err('в скобках после def перечисляют имена параметров через запятую');
        this.next();
        if (params.some(x => x.name === p.v)) throw this.err('параметр ' + p.v + ' повторяется', p);
        let def = null;
        if (this.isOp('=')) { this.next(); def = this.expr(); }
        else if (params.some(x => x.def)) throw this.err('параметры без значения по умолчанию пишутся раньше параметров со значением', p);
        params.push({ name: p.v, def });
        if (!this.isOp(',')) break;
        this.next();
      }
      this.expectOp(')', 'не хватает закрывающей скобки «)» (открыта в строке ' + open.line + ')');
      const loops = this.loops;
      this.loops = 0;
      this.funcs++;
      const body = this.block('def');
      this.funcs--;
      this.loops = loops;
      const globals = new Set(), locals = new Set(params.map(x => x.name));
      collectNames(body, locals, globals);
      for (const g of globals) {
        if (params.some(x => x.name === g)) throw new PyError('имя ' + g + ' — параметр функции, его нельзя объявить global', t.line);
        locals.delete(g);
      }
      return { k: 'def', name: n.v, params, body, locals, globals, line: t.line };
    }

    // ---- выражения
    exprList() {
      const e = this.expr();
      if (!this.isOp(',')) return e;
      const items = [e];
      while (this.isOp(',')) {
        this.next();
        const t = this.peek();
        if (t.t === 'nl' || t.t === 'eof' || (t.t === 'op' && (t.v === '=' || t.v === ')'))) break;
        items.push(this.expr());
      }
      return { k: 'tuple', items, line: e.line };
    }

    expr() {
      const a = this.orTest();
      if (this.isKw('if')) {
        this.next();
        const c = this.orTest();
        if (!this.isKw('else')) throw this.err('в выражении «a if условие else b» не хватает else');
        this.next();
        return { k: 'ifexp', c, a, b: this.expr(), line: a.line };
      }
      return a;
    }

    orTest() {
      let a = this.andTest();
      while (this.isKw('or')) { this.next(); a = { k: 'or', a, b: this.andTest(), line: a.line }; }
      return a;
    }

    andTest() {
      let a = this.notTest();
      while (this.isKw('and')) { this.next(); a = { k: 'and', a, b: this.notTest(), line: a.line }; }
      return a;
    }

    notTest() {
      if (this.isKw('not')) { const t = this.next(); return { k: 'not', e: this.notTest(), line: t.line }; }
      return this.comparison();
    }

    comparison() {
      const first = this.arith();
      const ops = [], rest = [];
      for (;;) {
        const t = this.peek();
        let op = null;
        if (t.t === 'op' && CMP_OPS.has(t.v)) { op = t.v; this.next(); }
        else if (t.t === 'name' && t.v === 'in') { op = 'in'; this.next(); }
        else if (t.t === 'name' && t.v === 'not' && this.peek(1).t === 'name' && this.peek(1).v === 'in') { op = 'not in'; this.next(); this.next(); }
        else if (t.t === 'name' && t.v === 'is') {
          this.next();
          if (this.isKw('not')) { this.next(); op = '!='; } else op = '==';
        } else break;
        ops.push(op);
        rest.push(this.arith());
      }
      return ops.length ? { k: 'cmp', first, ops, rest, line: first.line } : first;
    }

    arith() {
      let a = this.term();
      while (this.isOp('+') || this.isOp('-')) { const op = this.next().v; a = { k: 'bin', op, a, b: this.term(), line: a.line }; }
      return a;
    }

    term() {
      let a = this.factor();
      while (this.isOp('*') || this.isOp('/') || this.isOp('//') || this.isOp('%')) {
        const op = this.next().v;
        a = { k: 'bin', op, a, b: this.factor(), line: a.line };
      }
      return a;
    }

    factor() {
      if (this.isOp('-') || this.isOp('+')) {
        const t = this.next();
        return { k: t.v === '-' ? 'neg' : 'pos', e: this.factor(), line: t.line };
      }
      return this.power();
    }

    power() {
      const a = this.postfix();
      if (this.isOp('**')) { this.next(); return { k: 'bin', op: '**', a, b: this.factor(), line: a.line }; }
      return a;
    }

    postfix() {
      let e = this.atom();
      for (;;) {
        if (this.isOp('(')) {
          const open = this.next();
          const args = [], kw = [];
          while (!this.isOp(')')) {
            if (this.peek().t === 'name' && this.peek(1).t === 'op' && this.peek(1).v === '=') {
              const n = this.next().v; this.next();
              kw.push([n, this.expr()]);
            } else {
              if (kw.length) throw this.err('обычные аргументы пишутся до именованных (sep=, end=)');
              args.push(this.expr());
            }
            if (this.isOp('=')) throw this.err('для сравнения используйте ==, а не =');
            if (!this.isOp(',')) break;
            this.next();
          }
          this.expectOp(')', 'не хватает закрывающей скобки «)» (открыта в строке ' + open.line + ')');
          e = { k: 'call', fn: e, args, kw, line: e.line };
        } else if (this.isOp('[')) {
          this.next();
          let idx;
          const part = () => (this.isOp(':') || this.isOp(']') ? null : this.expr());
          const a = part();
          if (this.isOp(':')) {
            this.next();
            const b = part();
            let c = null;
            if (this.isOp(':')) { this.next(); c = part(); }
            idx = { k: 'slice', a, b, c };
          } else {
            if (!a) throw this.err('внутри [] нужен индекс');
            idx = a;
          }
          this.expectOp(']', 'не хватает закрывающей скобки «]»');
          e = { k: 'index', obj: e, idx, line: e.line };
        } else if (this.isOp('.')) {
          this.next();
          const n = this.peek();
          if (n.t !== 'name') throw this.err('после точки нужно имя метода');
          this.next();
          e = { k: 'attr', obj: e, name: n.v, line: e.line };
        } else return e;
      }
    }

    atom() {
      const t = this.peek();
      if (t.t === 'num') { this.next(); return { k: 'num', v: t.v, f: t.f, line: t.line }; }
      if (t.t === 'str' || t.t === 'fstr') {
        const parts = [];
        while (this.peek().t === 'str' || this.peek().t === 'fstr') {
          const s = this.next();
          if (s.t === 'str') parts.push(s.v);
          else parts.push(...parseFString(s.v, s.line));
        }
        if (parts.every(p => typeof p === 'string')) return { k: 'str', v: parts.join(''), line: t.line };
        return { k: 'fstr', parts, line: t.line };
      }
      if (t.t === 'name') {
        this.next();
        if (t.v === 'True') return { k: 'const', v: true, line: t.line };
        if (t.v === 'False') return { k: 'const', v: false, line: t.line };
        if (t.v === 'None') return { k: 'const', v: null, line: t.line };
        if (KEYWORDS.has(t.v) || UNSUPPORTED.has(t.v)) throw this.err('неожиданное слово «' + t.v + '» — проверьте запись выражения', t);
        return { k: 'name', v: t.v, line: t.line };
      }
      if (t.t === 'op' && t.v === '(') {
        this.next();
        if (this.isOp(')')) { this.next(); return { k: 'tuple', items: [], line: t.line }; }
        const e = this.expr();
        if (this.isOp('=')) throw this.err('для сравнения используйте ==, а не =');
        if (this.isOp(',')) {
          const items = [e];
          while (this.isOp(',')) { this.next(); if (this.isOp(')')) break; items.push(this.expr()); }
          this.expectOp(')', 'не хватает закрывающей скобки «)» (открыта в строке ' + t.line + ')');
          return { k: 'tuple', items, line: t.line };
        }
        this.expectOp(')', 'не хватает закрывающей скобки «)» (открыта в строке ' + t.line + ')');
        return e;
      }
      if (t.t === 'op' && t.v === '[') {
        this.next();
        const items = [];
        while (!this.isOp(']')) {
          items.push(this.expr());
          if (!this.isOp(',')) break;
          this.next();
        }
        this.expectOp(']', 'не хватает закрывающей скобки «]»');
        return { k: 'list', items, line: t.line };
      }
      if (t.t === 'nl' || t.t === 'eof') throw this.err('строка оборвалась — не хватает части выражения');
      if (t.t === 'indent' || t.t === 'dedent') throw this.err('неверный отступ');
      if (t.t === 'op' && t.v === '=') throw this.err('лишний знак = (для сравнения используйте ==)');
      throw this.err('неожиданный символ «' + t.v + '»');
    }
  }

  // Какие имена функция присваивает (они локальные) и какие объявлены global
  function collectNames(body, locals, globals) {
    const target = e => {
      if (e.k === 'name') locals.add(e.v);
      else if (e.k === 'tuple') e.items.forEach(target);
    };
    for (const s of body) {
      switch (s.k) {
        case 'assign': s.targets.forEach(target); break;
        case 'aug': target(s.target); break;
        case 'for': locals.add(s.target); collectNames(s.body, locals, globals); break;
        case 'while': collectNames(s.body, locals, globals); break;
        case 'if': s.branches.forEach(b => collectNames(b.body, locals, globals)); if (s.orelse) collectNames(s.orelse, locals, globals); break;
        case 'def': locals.add(s.name); break;
        case 'global': s.names.forEach(n => globals.add(n)); break;
      }
    }
  }

  function parseFString(s, line) {
    const parts = [];
    let buf = '', i = 0;
    while (i < s.length) {
      if (s[i] === '{' && s[i + 1] === '{') { buf += '{'; i += 2; continue; }
      if (s[i] === '}' && s[i + 1] === '}') { buf += '}'; i += 2; continue; }
      if (s[i] === '{') {
        let depth = 1, j = i + 1, colon = -1;
        while (j < s.length && depth) {
          if (s[j] === '{' || s[j] === '(' || s[j] === '[') depth++;
          else if (s[j] === '}' || s[j] === ')' || s[j] === ']') depth--;
          else if (s[j] === ':' && depth === 1) colon = j;
          if (depth) j++;
        }
        if (depth) throw new PyError('в f-строке не закрыта фигурная скобка {', line);
        const src = s.slice(i + 1, colon > -1 ? colon : j);
        const spec = colon > -1 ? s.slice(colon + 1, j) : '';
        if (buf) { parts.push(buf); buf = ''; }
        const p = new Parser(tokenize(src, line));
        const e = p.expr();
        parts.push({ e, spec });
        i = j + 1;
        continue;
      }
      buf += s[i++];
    }
    if (buf) parts.push(buf);
    return parts;
  }

  function parse(code) {
    return new Parser(tokenize(code)).file();
  }

  // ---------------------------------------------------------------- выполнение
  function makeCtx(opts) {
    opts = opts || {};
    const ctx = {
      vars: Object.create(null),
      builtins: Object.create(null),
      out: [],
      inputs: (opts.inputs || []).map(String),
      inputIdx: 0,
      steps: 0,
      maxSteps: opts.maxSteps || 10000,
      line: null,
      snap: opts.snap !== false,
      frame: null,      // текущий вызов функции: { def, depth }
      depth: 0,
      trace: opts.trace ? [] : null
    };
    ctx.globals = ctx.vars;
    Object.assign(ctx.builtins, BUILTINS);
    const user = opts.builtins || {};
    for (const name of Object.keys(user)) ctx.builtins[name] = wrapJS(name, user[name]);
    if (opts.vars) for (const k of Object.keys(opts.vars)) ctx.vars[k] = fromJS(opts.vars[k]);
    return ctx;
  }

  function wrapJS(name, fn) {
    return new PyFunc(name, (args, kw, ctx) => {
      if (Object.keys(kw).length) throw new PyError('функция ' + name + '() не принимает именованных аргументов', ctx.line);
      let r;
      try { r = fn.apply(null, args.map(toJS)); }
      catch (e) { throw e instanceof PyError ? e : new PyError(e.message, ctx.line); }
      return fromJS(r);
    });
  }

  // Снимок переменных: глобальные, а внутри функции поверх них — локальные. Функции не показываем.
  function snapshot(ctx) {
    const o = {};
    const add = scope => { for (const k of Object.keys(scope)) if (!(scope[k] instanceof PyFunc)) o[k] = repr(scope[k]); };
    add(ctx.globals);
    if (ctx.vars !== ctx.globals) add(ctx.vars);
    return o;
  }

  function step(ctx, line) {
    if (++ctx.steps > ctx.maxSteps) {
      throw new PyError('программа сделала больше ' + ctx.maxSteps + ' шагов — возможно, бесконечный цикл. Проверьте, меняется ли переменная в условии while', line);
    }
    const st = ctx.snap ? { line, vars: snapshot(ctx), out: ctx.out.join('') } : { line };
    if (ctx.trace) ctx.trace.push(st);
    return st;
  }

  function fail(ctx, msg) { return new PyError(msg, ctx.line); }

  function lookup(name, ctx, asFn) {
    if (name in ctx.vars) return ctx.vars[name];
    const fr = ctx.frame;
    if (fr && fr.def.locals.has(name)) {
      throw fail(ctx, 'переменная ' + name + ' используется в функции ' + fr.def.name + '() раньше, чем получила значение. ' +
        'Внутри функции она локальная, потому что ей присваивается значение. Чтобы менять глобальную переменную, напишите в начале функции: global ' + name);
    }
    if (name in ctx.globals) return ctx.globals[name];
    if (name in ctx.builtins) return ctx.builtins[name];
    const low = name.toLowerCase();
    if (low === 'true' || low === 'false' || low === 'none') {
      throw fail(ctx, 'пишите ' + low.charAt(0).toUpperCase() + low.slice(1) + ' с большой буквы');
    }
    const similar = Object.keys(ctx.builtins).find(b => b.toLowerCase() === low);
    if (similar) throw fail(ctx, (asFn ? 'функция ' : 'имя ') + name + ' не определено — может быть, ' + similar + '? Регистр букв важен');
    throw fail(ctx, asFn ? 'функция ' + name + ' не определена' : 'переменная ' + name + ' не определена');
  }

  function binop(op, a, b, ctx) {
    const ta = typeName(a), tb = typeName(b);
    const bad = () => {
      if (op === '+' && ((ta === 'str' && isNum(b)) || (isNum(a) && tb === 'str'))) {
        return fail(ctx, 'нельзя сложить ' + ta + ' и ' + tb + ' — строку и число не складывают. Используйте str() или int()');
      }
      return fail(ctx, 'операция ' + op + ' не работает для ' + ta + ' и ' + tb);
    };
    if (op === '+') {
      if (typeof a === 'string' && typeof b === 'string') return a + b;
      if (Array.isArray(a) && Array.isArray(b)) return a.concat(b);
      if (!isNum(a) || !isNum(b)) throw bad();
      return mkNum(numVal(a) + numVal(b), isFloat(a) || isFloat(b));
    }
    if (op === '*') {
      if (typeof a === 'string' && isIntLike(b)) return a.repeat(Math.max(0, +b));
      if (isIntLike(a) && typeof b === 'string') return b.repeat(Math.max(0, +a));
      if (Array.isArray(a) && isIntLike(b)) { let r = []; for (let i = 0; i < b; i++) r = r.concat(a); return r; }
    }
    if (!isNum(a) || !isNum(b)) throw bad();
    const x = numVal(a), y = numVal(b), f = isFloat(a) || isFloat(b);
    switch (op) {
      case '-': return mkNum(x - y, f);
      case '*': return mkNum(x * y, f);
      case '/':
        if (y === 0) throw fail(ctx, 'деление на ноль');
        return new PyFloat(x / y);
      case '//':
        if (y === 0) throw fail(ctx, 'деление на ноль');
        return mkNum(Math.floor(x / y), f);
      case '%':
        if (y === 0) throw fail(ctx, 'деление на ноль (остаток от деления на 0)');
        return mkNum(x - y * Math.floor(x / y), f);
      case '**':
        if (x === 0 && y < 0) throw fail(ctx, 'ноль нельзя возводить в отрицательную степень');
        if (!f && y >= 0) return Math.pow(x, y);
        return new PyFloat(Math.pow(x, y));
    }
    throw bad();
  }

  function contains(c, x, ctx) {
    if (typeof c === 'string') {
      if (typeof x !== 'string') throw fail(ctx, 'в строке можно искать только строку, а не ' + typeName(x));
      return c.includes(x);
    }
    if (Array.isArray(c)) return c.some(v => pyEq(v, x));
    if (c instanceof PyTuple) return c.items.some(v => pyEq(v, x));
    if (c instanceof PyRange) {
      if (!isNum(x) || !Number.isInteger(numVal(x))) return false;
      const v = numVal(x), r = c;
      const inside = r.step > 0 ? v >= r.start && v < r.stop : v <= r.start && v > r.stop;
      return inside && (v - r.start) % r.step === 0;
    }
    throw fail(ctx, 'оператор in не работает для ' + typeName(c));
  }

  function compare(op, a, b, ctx) {
    switch (op) {
      case '==': return pyEq(a, b);
      case '!=': return !pyEq(a, b);
      case 'in': return contains(b, a, ctx);
      case 'not in': return !contains(b, a, ctx);
    }
    let x, y;
    if (isNum(a) && isNum(b)) { x = numVal(a); y = numVal(b); }
    else if (typeof a === 'string' && typeof b === 'string') { x = a; y = b; }
    else {
      const ta = typeName(a), tb = typeName(b);
      let msg = 'нельзя сравнить ' + ta + ' и ' + tb + ' с помощью ' + op;
      if ((ta === 'str' && isNum(b)) || (isNum(a) && tb === 'str')) msg += ' — возможно, забыли int(input())';
      throw fail(ctx, msg);
    }
    switch (op) {
      case '<': return x < y;
      case '>': return x > y;
      case '<=': return x <= y;
      case '>=': return x >= y;
    }
  }

  function seqOf(v, ctx, forLoop) {
    if (typeof v === 'string') return Array.from(v);
    if (Array.isArray(v)) return v;
    if (v instanceof PyTuple) return v.items;
    if (v instanceof PyRange) return v;
    let msg = 'по объекту типа ' + typeName(v) + ' нельзя пройти циклом';
    if (forLoop && isNum(v)) msg += ' — может быть, нужно range(' + repr(v) + ')?';
    throw fail(ctx, msg);
  }

  function toIndex(i, len, ctx) {
    if (!isIntLike(i)) throw fail(ctx, 'индекс должен быть целым числом, а не ' + typeName(i));
    let n = +i;
    if (n < 0) n += len;
    if (n < 0 || n >= len) throw fail(ctx, 'индекс ' + i + ' вне диапазона (длина ' + len + ')');
    return n;
  }

  function sliceIdx(len, a, b, c, ctx) {
    const step = c === null ? 1 : +c;
    if (step === 0) throw fail(ctx, 'шаг среза не может быть 0');
    let start, stop;
    if (step > 0) {
      start = a === null ? 0 : a < 0 ? Math.max(0, len + a) : Math.min(a, len);
      stop = b === null ? len : b < 0 ? Math.max(0, len + b) : Math.min(b, len);
    } else {
      start = a === null ? len - 1 : a < 0 ? Math.max(-1, len + a) : Math.min(a, len - 1);
      stop = b === null ? -1 : b < 0 ? Math.max(-1, len + b) : Math.min(b, len - 1);
    }
    const r = [];
    for (let i = start; step > 0 ? i < stop : i > stop; i += step) r.push(i);
    return r;
  }

  function getIndex(obj, idxNode, ctx) {
    let items, kind;
    if (typeof obj === 'string') { items = Array.from(obj); kind = 'str'; }
    else if (Array.isArray(obj)) { items = obj; kind = 'list'; }
    else if (obj instanceof PyTuple) { items = obj.items; kind = 'tuple'; }
    else if (obj instanceof PyRange) { items = Array.from(obj); kind = 'list'; }
    else throw fail(ctx, 'у объекта типа ' + typeName(obj) + ' нельзя взять элемент по индексу');
    if (idxNode.k === 'slice') {
      const ev = n => {
        if (!n) return null;
        const v = evaluate(n, ctx);
        if (!isIntLike(v)) throw fail(ctx, 'границы среза должны быть целыми числами');
        return +v;
      };
      const r = sliceIdx(items.length, ev(idxNode.a), ev(idxNode.b), ev(idxNode.c), ctx).map(i => items[i]);
      return kind === 'str' ? r.join('') : kind === 'tuple' ? new PyTuple(r) : r;
    }
    return items[toIndex(evaluate(idxNode, ctx), items.length, ctx)];
  }

  function setVar(name, v, ctx) {
    if (ctx.frame && ctx.frame.def.globals.has(name)) ctx.globals[name] = v;
    else ctx.vars[name] = v;
  }

  function assign(t, v, ctx) {
    if (t.k === 'name') { setVar(t.v, v, ctx); return; }
    if (t.k === 'index') {
      const obj = evaluate(t.obj, ctx);
      if (!Array.isArray(obj)) throw fail(ctx, 'менять элементы можно только у списка, а не у ' + typeName(obj));
      if (t.idx.k === 'slice') throw fail(ctx, 'присваивание срезу не поддерживается');
      obj[toIndex(evaluate(t.idx, ctx), obj.length, ctx)] = v;
      return;
    }
    if (t.k === 'tuple') {
      const items = Array.from(seqOf(v, ctx));
      if (items.length !== t.items.length) {
        throw fail(ctx, 'количество переменных (' + t.items.length + ') не совпадает с количеством значений (' + items.length + ')');
      }
      t.items.forEach((x, i) => assign(x, items[i], ctx));
    }
  }

  function formatSpec(v, spec, ctx) {
    if (!spec) return str(v);
    let m = /^\.(\d+)f$/.exec(spec);
    if (m) {
      if (!isNum(v)) throw fail(ctx, 'формат .' + m[1] + 'f работает только с числами');
      return numVal(v).toFixed(+m[1]);
    }
    if (spec === 'd' && isIntLike(v)) return String(+v);
    m = /^([<>^])?(\d+)$/.exec(spec);
    if (m) {
      const s = str(v), w = +m[2], al = m[1] || (isNum(v) ? '>' : '<');
      if (s.length >= w) return s;
      const pad = w - s.length;
      if (al === '<') return s + ' '.repeat(pad);
      if (al === '>') return ' '.repeat(pad) + s;
      return ' '.repeat(Math.floor(pad / 2)) + s + ' '.repeat(Math.ceil(pad / 2));
    }
    return str(v);
  }

  function sortList(a, reverse, ctx) {
    a.sort((x, y) => (compare('<', x, y, ctx) ? -1 : compare('<', y, x, ctx) ? 1 : 0));
    if (reverse) a.reverse();
    return a;
  }

  function callMethod(obj, name, args, kw, ctx) {
    const need = n => {
      if (args.length !== n) throw fail(ctx, 'метод ' + name + '() ожидает ' + n + ' аргумент(а)');
    };
    const kws = Object.keys(kw);
    if (kws.length && !(Array.isArray(obj) && name === 'sort' && kws.every(k => k === 'reverse'))) {
      throw fail(ctx, 'метод ' + name + '() не принимает именованных аргументов');
    }
    if (typeof obj === 'string') {
      switch (name) {
        case 'upper': need(0); return obj.toUpperCase();
        case 'lower': need(0); return obj.toLowerCase();
        case 'strip': need(0); return obj.trim();
        case 'lstrip': need(0); return obj.replace(/^\s+/, '');
        case 'rstrip': need(0); return obj.replace(/\s+$/, '');
        case 'capitalize': need(0); return obj.charAt(0).toUpperCase() + obj.slice(1).toLowerCase();
        case 'title': need(0); return obj.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
        case 'isupper': need(0); return /\p{L}/u.test(obj) && obj === obj.toUpperCase();
        case 'islower': need(0); return /\p{L}/u.test(obj) && obj === obj.toLowerCase();
        case 'join': {
          need(1);
          const items = Array.from(seqOf(args[0], ctx));
          items.forEach(x => { if (typeof x !== 'string') throw fail(ctx, 'join() соединяет только строки, а в списке есть ' + typeName(x) + ' — используйте str()'); });
          return items.join(obj);
        }
        case 'isdigit': need(0); return obj.length > 0 && /^\d+$/.test(obj);
        case 'isalpha': need(0); return obj.length > 0 && /^\p{L}+$/u.test(obj);
        case 'replace': need(2); return obj.split(str(args[0])).join(str(args[1]));
        case 'count': need(1); return args[0] === '' ? obj.length + 1 : obj.split(str(args[0])).length - 1;
        case 'find': need(1); return obj.indexOf(str(args[0]));
        case 'startswith': need(1); return obj.startsWith(str(args[0]));
        case 'endswith': need(1); return obj.endsWith(str(args[0]));
        case 'split': return args.length ? obj.split(str(args[0])) : obj.trim().split(/\s+/).filter(Boolean);
      }
    }
    if (Array.isArray(obj)) {
      switch (name) {
        case 'append': need(1); obj.push(args[0]); return null;
        case 'extend': need(1); obj.push(...Array.from(seqOf(args[0], ctx))); return null;
        case 'insert': {
          need(2);
          if (!isIntLike(args[0])) throw fail(ctx, 'первый аргумент insert() — номер позиции (целое число)');
          let i = +args[0];
          if (i < 0) i = Math.max(0, obj.length + i);
          obj.splice(Math.min(i, obj.length), 0, args[1]);
          return null;
        }
        case 'remove': {
          need(1);
          const i = obj.findIndex(v => pyEq(v, args[0]));
          if (i < 0) throw fail(ctx, 'remove(): элемента ' + repr(args[0]) + ' нет в списке');
          obj.splice(i, 1);
          return null;
        }
        case 'reverse': need(0); obj.reverse(); return null;
        case 'sort': need(0); sortList(obj, truthy(kw.reverse === undefined ? false : kw.reverse), ctx); return null;
        case 'clear': need(0); obj.length = 0; return null;
        case 'pop':
          if (!obj.length) throw fail(ctx, 'нельзя взять элемент из пустого списка');
          return args.length ? obj.splice(toIndex(args[0], obj.length, ctx), 1)[0] : obj.pop();
        case 'count': need(1); return obj.filter(v => pyEq(v, args[0])).length;
        case 'index': {
          need(1);
          const i = obj.findIndex(v => pyEq(v, args[0]));
          if (i < 0) throw fail(ctx, repr(args[0]) + ' нет в списке');
          return i;
        }
      }
    }
    throw fail(ctx, 'у объекта типа ' + typeName(obj) + ' нет метода ' + name + '()');
  }

  function evaluate(n, ctx) {
    switch (n.k) {
      case 'num': return n.f ? new PyFloat(n.v) : n.v;
      case 'str': return n.v;
      case 'const': return n.v;
      case 'name': return lookup(n.v, ctx, false);
      case 'tuple': return new PyTuple(n.items.map(x => evaluate(x, ctx)));
      case 'list': return n.items.map(x => evaluate(x, ctx));
      case 'fstr': return n.parts.map(p => (typeof p === 'string' ? p : formatSpec(evaluate(p.e, ctx), p.spec, ctx))).join('');
      case 'or': { const a = evaluate(n.a, ctx); return truthy(a) ? a : evaluate(n.b, ctx); }
      case 'and': { const a = evaluate(n.a, ctx); return truthy(a) ? evaluate(n.b, ctx) : a; }
      case 'not': return !truthy(evaluate(n.e, ctx));
      case 'neg':
      case 'pos': {
        const v = evaluate(n.e, ctx);
        if (!isNum(v)) throw fail(ctx, 'унарный ' + (n.k === 'neg' ? 'минус' : 'плюс') + ' не работает для ' + typeName(v));
        return mkNum(n.k === 'neg' ? -numVal(v) : numVal(v), isFloat(v));
      }
      case 'bin': return binop(n.op, evaluate(n.a, ctx), evaluate(n.b, ctx), ctx);
      case 'cmp': {
        let left = evaluate(n.first, ctx);
        for (let i = 0; i < n.ops.length; i++) {
          const right = evaluate(n.rest[i], ctx);
          if (!compare(n.ops[i], left, right, ctx)) return false;
          left = right;
        }
        return true;
      }
      case 'ifexp': return truthy(evaluate(n.c, ctx)) ? evaluate(n.a, ctx) : evaluate(n.b, ctx);
      case 'index': return getIndex(evaluate(n.obj, ctx), n.idx, ctx);
      case 'attr': throw fail(ctx, 'обращение .' + n.name + ' без вызова не поддерживается');
      case 'call': {
        const c = prepCall(n, ctx);
        return c.obj !== undefined ? callMethod(c.obj, n.fn.name, c.args, c.kw, ctx) : c.f.fn(c.args, c.kw, ctx);
      }
    }
    throw fail(ctx, 'неизвестное выражение');
  }

  // Вычисляет вызываемое и аргументы: { f, args, kw } или { obj, args, kw } для метода
  function prepCall(n, ctx) {
    const kwOf = () => { const kw = {}; for (const [k, v] of n.kw) kw[k] = evaluate(v, ctx); return kw; };
    if (n.fn.k === 'attr') {
      const obj = evaluate(n.fn.obj, ctx);
      return { obj, args: n.args.map(x => evaluate(x, ctx)), kw: kwOf() };
    }
    const f = n.fn.k === 'name' ? lookup(n.fn.v, ctx, true) : evaluate(n.fn, ctx);
    if (!(f instanceof PyFunc)) {
      throw fail(ctx, (n.fn.k === 'name' ? n.fn.v + ' — это ' : '') + typeName(f) + ', а не функция, его нельзя вызвать со скобками ()');
    }
    return { f, args: n.args.map(x => evaluate(x, ctx)), kw: kwOf() };
  }

  // Выражение на верхнем уровне строки: вызов своей функции выполняется пошагово (yield*),
  // чтобы трассировка и игры видели строки внутри неё. Вложенные вызовы выполняются целиком.
  function* evalTop(e, ctx) {
    if (e.k === 'call' && e.fn.k !== 'attr') {
      const c = prepCall(e, ctx);
      if (c.f.user) return yield* invoke(c.f, c.args, c.kw, ctx);
      return c.f.fn(c.args, c.kw, ctx);
    }
    return evaluate(e, ctx);
  }

  const MAX_DEPTH = 200;

  function makeFunc(d, ctx) {
    const f = new PyFunc(d.name, (args, kw, cx) => {
      const g = invoke(f, args, kw, cx);
      let r;
      while (!(r = g.next()).done);
      return r.value;
    }, d);
    // значения по умолчанию вычисляются один раз — при def, как в Python
    f.defaults = d.params.map(p => (p.def ? evaluate(p.def, ctx) : undefined));
    return f;
  }

  function* invoke(f, args, kw, ctx) {
    const d = f.user, name = d.name, ps = d.params;
    if (args.length > ps.length) {
      throw fail(ctx, 'функция ' + name + '() принимает ' + ps.length + ' аргумент(а), а передано ' + args.length);
    }
    const local = Object.create(null);
    ps.forEach((p, i) => { if (i < args.length) local[p.name] = args[i]; });
    for (const k of Object.keys(kw)) {
      if (!ps.some(p => p.name === k)) throw fail(ctx, 'у функции ' + name + '() нет параметра ' + k);
      if (k in local) throw fail(ctx, 'параметр ' + k + ' функции ' + name + '() получил значение дважды');
      local[k] = kw[k];
    }
    ps.forEach((p, i) => {
      if (p.name in local) return;
      if (f.defaults[i] === undefined) throw fail(ctx, 'при вызове ' + name + '() не передан аргумент ' + p.name);
      local[p.name] = f.defaults[i];
    });
    if (ctx.depth >= MAX_DEPTH) {
      throw fail(ctx, 'слишком глубокая рекурсия (больше ' + MAX_DEPTH + ' вложенных вызовов) — проверьте, есть ли у функции ' + name + '() условие остановки');
    }
    const saved = { vars: ctx.vars, frame: ctx.frame, line: ctx.line };
    ctx.vars = local;
    ctx.frame = { def: d };
    ctx.depth++;
    let r;
    try {
      r = yield* execBlock(d.body, ctx);
    } finally {
      ctx.vars = saved.vars;
      ctx.frame = saved.frame;
      ctx.line = saved.line;
      ctx.depth--;
    }
    return r instanceof Ret ? r.v : null;
  }

  function* execBlock(body, ctx) {
    for (const s of body) {
      const r = yield* execStmt(s, ctx);
      if (r) return r;
    }
  }

  function* execStmt(s, ctx) {
    ctx.line = s.line;
    switch (s.k) {
      case 'expr':
        yield* evalTop(s.e, ctx);
        yield step(ctx, s.line);
        return;
      case 'assign': {
        const v = yield* evalTop(s.value, ctx);
        for (const t of s.targets) assign(t, v, ctx);
        yield step(ctx, s.line);
        return;
      }
      case 'aug': {
        const cur = s.target.k === 'name' ? lookup(s.target.v, ctx, false) : evaluate(s.target, ctx);
        assign(s.target, binop(s.op, cur, evaluate(s.value, ctx), ctx), ctx);
        yield step(ctx, s.line);
        return;
      }
      case 'pass':
      case 'global':
        yield step(ctx, s.line);
        return;
      case 'def':
        setVar(s.name, makeFunc(s, ctx), ctx);
        yield step(ctx, s.line);
        return;
      case 'return': {
        const v = s.value ? yield* evalTop(s.value, ctx) : null;
        yield step(ctx, s.line);
        return new Ret(v);
      }
      case 'break':
      case 'continue':
        yield step(ctx, s.line);
        return s.k;
      case 'if':
        for (const b of s.branches) {
          ctx.line = b.line;
          const c = truthy(evaluate(b.cond, ctx));
          yield step(ctx, b.line);
          if (c) return yield* execBlock(b.body, ctx);
        }
        if (s.orelse) return yield* execBlock(s.orelse, ctx);
        return;
      case 'while':
        for (;;) {
          ctx.line = s.line;
          const c = truthy(evaluate(s.cond, ctx));
          yield step(ctx, s.line);
          if (!c) return;
          const r = yield* execBlock(s.body, ctx);
          if (r === 'break') return;
          if (r instanceof Ret) return r;
        }
      case 'for': {
        const seq = seqOf(evaluate(s.iter, ctx), ctx, true);
        if (Array.isArray(seq)) {
          // список проходим «вживую», как в Python
          for (let i = 0; i < seq.length; i++) {
            setVar(s.target, seq[i], ctx);
            ctx.line = s.line;
            yield step(ctx, s.line);
            const r = yield* execBlock(s.body, ctx);
            if (r === 'break') return;
            if (r instanceof Ret) return r;
          }
        } else {
          for (const v of seq) {
            setVar(s.target, v, ctx);
            ctx.line = s.line;
            yield step(ctx, s.line);
            const r = yield* execBlock(s.body, ctx);
            if (r === 'break') return;
            if (r instanceof Ret) return r;
          }
        }
        return;
      }
    }
  }

  // ---------------------------------------------------------------- встроенные функции
  function noKw(name, kw, ctx) {
    const k = Object.keys(kw);
    if (k.length) throw fail(ctx, 'функция ' + name + '() не знает параметра ' + k[0]);
  }

  function argCount(name, args, min, max, ctx) {
    if (args.length < min || args.length > max) {
      const what = min === max ? String(min) : 'от ' + min + ' до ' + max;
      throw fail(ctx, 'функция ' + name + '() ожидает ' + what + ' аргумент(а), а получила ' + args.length);
    }
  }

  function minmax(name, args, ctx, sign) {
    let items = args;
    if (args.length === 1) items = Array.from(seqOf(args[0], ctx));
    if (!items.length) throw fail(ctx, name + '() от пустой последовательности');
    let best = items[0];
    for (const v of items.slice(1)) if (compare(sign, v, best, ctx)) best = v;
    return best;
  }

  function bankers(x) {
    const f = Math.floor(x), d = x - f;
    if (d > 0.5) return f + 1;
    if (d < 0.5) return f;
    return f % 2 === 0 ? f : f + 1;
  }

  const B = (name, fn) => new PyFunc(name, fn);
  const BUILTINS = {
    print: B('print', (args, kw, ctx) => {
      for (const k of Object.keys(kw)) if (k !== 'sep' && k !== 'end') throw fail(ctx, 'функция print() не знает параметра ' + k);
      const sep = kw.sep === undefined || kw.sep === null ? ' ' : kw.sep;
      const end = kw.end === undefined || kw.end === null ? '\n' : kw.end;
      if (typeof sep !== 'string' || typeof end !== 'string') throw fail(ctx, 'sep и end у print() должны быть строками');
      ctx.out.push(args.map(str).join(sep) + end);
      return null;
    }),
    input: B('input', (args, kw, ctx) => {
      noKw('input', kw, ctx);
      argCount('input', args, 0, 1, ctx);
      if (ctx.inputIdx >= ctx.inputs.length) throw fail(ctx, 'программе не хватило входных данных — input() вызван больше раз, чем дано значений');
      return ctx.inputs[ctx.inputIdx++];
    }),
    int: B('int', (args, kw, ctx) => {
      noKw('int', kw, ctx);
      argCount('int', args, 0, 1, ctx);
      if (!args.length) return 0;
      const v = args[0];
      if (typeof v === 'string') {
        const s = v.trim();
        if (!/^[+-]?\d+$/.test(s)) throw fail(ctx, 'int() не может превратить ' + reprStr(v) + ' в целое число');
        return parseInt(s, 10);
      }
      if (isNum(v)) return Math.trunc(numVal(v));
      throw fail(ctx, 'int() не может превратить ' + typeName(v) + ' в число');
    }),
    float: B('float', (args, kw, ctx) => {
      noKw('float', kw, ctx);
      argCount('float', args, 0, 1, ctx);
      if (!args.length) return new PyFloat(0);
      const v = args[0];
      if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/.test(s)) return new PyFloat(parseFloat(s));
        if (/^[+-]?inf(inity)?$/.test(s)) return new PyFloat(s[0] === '-' ? -Infinity : Infinity);
        throw fail(ctx, 'float() не может превратить ' + reprStr(v) + ' в число');
      }
      if (isNum(v)) return new PyFloat(numVal(v));
      throw fail(ctx, 'float() не может превратить ' + typeName(v) + ' в число');
    }),
    str: B('str', (args, kw, ctx) => { noKw('str', kw, ctx); argCount('str', args, 0, 1, ctx); return args.length ? str(args[0]) : ''; }),
    bool: B('bool', (args, kw, ctx) => { noKw('bool', kw, ctx); argCount('bool', args, 0, 1, ctx); return args.length ? truthy(args[0]) : false; }),
    len: B('len', (args, kw, ctx) => {
      noKw('len', kw, ctx);
      argCount('len', args, 1, 1, ctx);
      const v = args[0];
      if (typeof v === 'string') return Array.from(v).length;
      if (Array.isArray(v)) return v.length;
      if (v instanceof PyTuple) return v.items.length;
      if (v instanceof PyRange) return v.length;
      throw fail(ctx, 'у объекта типа ' + typeName(v) + ' нет длины');
    }),
    abs: B('abs', (args, kw, ctx) => {
      noKw('abs', kw, ctx);
      argCount('abs', args, 1, 1, ctx);
      if (!isNum(args[0])) throw fail(ctx, 'abs() работает только с числами');
      return mkNum(Math.abs(numVal(args[0])), isFloat(args[0]));
    }),
    min: B('min', (args, kw, ctx) => { noKw('min', kw, ctx); return minmax('min', args, ctx, '<'); }),
    max: B('max', (args, kw, ctx) => { noKw('max', kw, ctx); return minmax('max', args, ctx, '>'); }),
    sum: B('sum', (args, kw, ctx) => {
      noKw('sum', kw, ctx);
      argCount('sum', args, 1, 1, ctx);
      let s = 0;
      for (const v of seqOf(args[0], ctx)) s = binop('+', s, v, ctx);
      return s;
    }),
    round: B('round', (args, kw, ctx) => {
      noKw('round', kw, ctx);
      argCount('round', args, 1, 2, ctx);
      const v = args[0];
      if (!isNum(v)) throw fail(ctx, 'round() работает только с числами');
      if (args.length === 1 || args[1] === null) return isFloat(v) ? bankers(v.v) : +v;
      if (!isFloat(v)) return +v;
      return new PyFloat(Number(v.v.toFixed(Math.max(0, +args[1]))));
    }),
    range: B('range', (args, kw, ctx) => {
      noKw('range', kw, ctx);
      argCount('range', args, 1, 3, ctx);
      for (const a of args) if (!isIntLike(a)) throw fail(ctx, 'range() принимает только целые числа, а получила ' + typeName(a));
      const n = args.map(Number);
      const [start, stop, st] = n.length === 1 ? [0, n[0], 1] : n.length === 2 ? [n[0], n[1], 1] : n;
      if (st === 0) throw fail(ctx, 'шаг range() не может быть равен 0');
      return new PyRange(start, stop, st);
    }),
    list: B('list', (args, kw, ctx) => {
      noKw('list', kw, ctx);
      argCount('list', args, 0, 1, ctx);
      return args.length ? Array.from(seqOf(args[0], ctx)) : [];
    }),
    sorted: B('sorted', (args, kw, ctx) => {
      for (const k of Object.keys(kw)) if (k !== 'reverse') throw fail(ctx, 'функция sorted() не знает параметра ' + k);
      argCount('sorted', args, 1, 1, ctx);
      return sortList(Array.from(seqOf(args[0], ctx)), truthy(kw.reverse === undefined ? false : kw.reverse), ctx);
    }),
    reversed: B('reversed', (args, kw, ctx) => {
      noKw('reversed', kw, ctx);
      argCount('reversed', args, 1, 1, ctx);
      return Array.from(seqOf(args[0], ctx)).reverse();
    }),
    ord: B('ord', (args, kw, ctx) => {
      noKw('ord', kw, ctx);
      argCount('ord', args, 1, 1, ctx);
      if (typeof args[0] !== 'string' || Array.from(args[0]).length !== 1) throw fail(ctx, 'ord() ожидает строку из одного символа');
      return args[0].codePointAt(0);
    }),
    chr: B('chr', (args, kw, ctx) => {
      noKw('chr', kw, ctx);
      argCount('chr', args, 1, 1, ctx);
      if (!isIntLike(args[0]) || args[0] < 0 || args[0] > 0x10ffff) throw fail(ctx, 'chr() ожидает целое число — код символа');
      return String.fromCodePoint(+args[0]);
    }),
    type: B('type', (args, kw, ctx) => {
      noKw('type', kw, ctx);
      argCount('type', args, 1, 1, ctx);
      return "<class '" + typeName(args[0]) + "'>";
    })
  };

  // ---------------------------------------------------------------- публичный API
  function steps(code, opts) {
    const ctx = makeCtx(opts);
    function* gen() {
      const ast = parse(code);
      yield* execBlock(ast, ctx);
      return { output: ctx.out.join('') };
    }
    const g = gen();
    g.ctx = ctx;
    return g;
  }

  function run(code, opts) {
    opts = opts || {};
    const g = steps(code, Object.assign({}, opts, { snap: !!opts.trace }));
    const trace = g.ctx.trace || [];
    const result = (ok, err) => ({
      ok,
      output: g.ctx.out.join(''),
      error: err ? err.message : null,
      errorLine: err ? err.line : null,
      steps: g.ctx.steps,
      vars: snapshot(g.ctx),
      trace
    });
    try {
      let r;
      while (!(r = g.next()).done);
      return result(true, null);
    } catch (e) {
      return result(false, e instanceof PyError ? e : new PyError('внутренняя ошибка интерпретатора: ' + e.message));
    }
  }

  function evalExpr(expr, vars, opts) {
    const ctx = makeCtx(Object.assign({}, opts, { vars }));
    const p = new Parser(tokenize(expr));
    const e = p.expr();
    if (p.peek().t !== 'nl' && p.peek().t !== 'eof') throw p.err('лишние символы в конце выражения');
    return evaluate(e, ctx);
  }

  function check(code) {
    try { parse(code); return null; }
    catch (e) { return { msg: e.message, line: e.line }; }
  }

  root.Py = {
    run, steps, evalExpr, check, parse, tokenize,
    repr, str, truthy, typeName, toJS, fromJS,
    PyError, PyFloat, PyTuple, PyRange,
    // сравнить выводы без учёта пробелов в конце строк и пустых строк в конце
    sameOutput(a, b) {
      const norm = s => String(s).replace(/\r/g, '').split('\n').map(l => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');
      return norm(a) === norm(b);
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Py;
})(typeof window !== 'undefined' ? window : globalThis);
