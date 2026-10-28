/* Пазл «Блок-схема → код»: рядом с SVG-схемой собрать строки кода.
   data: { chart, lines, distractors, check, tests } */
Puzzles.register('flow', {
  mount: (host, task, ctx) => ParsonsBoard(host, task, ctx, { side: Flowchart.svg(task.data.chart) })
});
