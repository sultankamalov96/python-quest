#!/usr/bin/env node
/* Проверка теста по Dart настоящим Dart SDK:  node tools/check_dart.js
   Для каждого вопроса с кодом программа запускается, и её вывод сравнивается с первым (верным) вариантом.
   check: 'output' — вывод в одну строку, 'count' — число выведенных строк, 'error' — программа не должна запуститься. */
const fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const ctx = {};
vm.createContext(ctx);
// const EXAMS из data/exams.js не попадает в ctx сам — возвращаем его последним выражением
const EXAMS = vm.runInContext(
  fs.readFileSync(path.join(root, 'data/exams.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'data/exams_dart.js'), 'utf8') + '\nEXAMS;', ctx);

if (spawnSync('dart', ['--version']).error) { console.error('Не найден Dart SDK: установите его с https://dart.dev/get-dart'); process.exit(2); }
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dartcheck-'));
const flat = s => s.trim().split(/\s+/).join(' ');
let bad = 0, checked = 0;

for (const [id, ex] of Object.entries(EXAMS)) {
  const qs = ex.questions.filter(q => q.lang === 'dart');
  if (!qs.length) continue;
  console.log(`\n${ex.title}: вопросов ${ex.questions.length} (нужно ${ex.expected}), с кодом ${qs.length}`);
  if (ex.questions.length !== ex.expected) { bad++; console.log('  ✗ число вопросов не совпадает с expected'); }
  const keys = ex.questions.map(q => q.q + '|' + (q.code || '') + '|' + q.options[0]);
  if (new Set(keys).size !== keys.length) { bad++; console.log('  ✗ есть повторяющиеся вопросы'); }
  ex.questions.forEach((q, i) => {
    const errs = [];
    if (!q.q || !q.explain || !q.topic) errs.push('нужны q, explain и topic');
    if (!Array.isArray(q.options) || q.options.length !== 4 || new Set(q.options).size !== 4) errs.push('нужно 4 разных варианта');
    if (q.code) {
      const file = path.join(dir, `q${i}.dart`);
      fs.writeFileSync(file, q.code);
      const r = spawnSync('dart', ['run', file], { encoding: 'utf8', timeout: 60000 });
      const ok = r.status === 0;
      if (q.check === 'error') { if (ok) errs.push('программа должна завершаться ошибкой, а она вывела: ' + flat(r.stdout)); }
      else if (!ok) errs.push('программа не запускается:\n' + r.stderr.trim());
      else if (q.check) {
        const got = q.check === 'count' ? String(r.stdout.replace(/\n$/, '').split('\n').length) : flat(r.stdout);
        if (got !== q.options[0]) errs.push(`верный (первый) вариант «${q.options[0]}», а Dart выводит «${got}»`);
        q.options.slice(1).forEach(o => { if (o === got) errs.push('неверный вариант совпадает с ответом: ' + o); });
      } else errs.push('у вопроса с кодом нет check');
      checked++;
    }
    if (errs.length) { bad++; console.log(`  ✗ ${i + 1}. ${q.q}\n${q.code || ''}\n    ${errs.join('\n    ')}`); }
  });
}
fs.rmSync(dir, { recursive: true, force: true });
console.log(`\nПроверено запуском Dart: ${checked}. ${bad ? 'Ошибок: ' + bad : 'Все ответы верны.'}`);
process.exit(bad ? 1 : 0);
