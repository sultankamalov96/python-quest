/* Прогресс ученика: очки, звёзды, достижения, рекорды.
   Хранится в localStorage; если он недоступен — работает в памяти. */
const Progress = (function () {
  'use strict';
  const KEY = 'pyquest.v1';
  let storageOk = true;
  const listeners = [];

  function blank() {
    return {
      v: 1,
      name: '',
      theme: 'auto',
      muted: false,
      tasks: {},        // id → { pts, hints, wrong, type, topic, at }
      games: {},        // id → { pts, levels: { n: { stars, pts } }, seen }
      records: {},      // truefalse, count, memory, quiz …
      stats: {},        // счётчики событий: bugs, tracerPerfect, duels …
      ach: {},          // id → дата получения
      streak: 0,
      quest: { done: [] }
    };
  }

  let s = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      return Object.assign(blank(), JSON.parse(raw));
    } catch (e) {
      storageOk = false;
      return blank();
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(s)); }
    catch (e) { storageOk = false; }
    listeners.forEach(fn => fn(s));
  }

  // ---------------------------------------------------------------- очки
  function puzzlePoints() {
    return Object.values(s.tasks).reduce((a, x) => a + (x.pts || 0), 0);
  }
  function gamePoints() {
    return Object.values(s.games).reduce((a, g) => a + (g.pts || 0), 0);
  }
  const total = () => puzzlePoints() + gamePoints();

  function taskPoints(hints, wrong) {
    const p = CONFIG.points;
    return Math.max(p.min, p.task - p.hint * hints - p.wrong * wrong);
  }

  // Вызывается, когда ученик решил задачу. Возвращает { pts, first }.
  function taskSolved(task, hints, wrong) {
    if (wrong === 0) s.streak++;
    const first = !s.tasks[task.id];
    let pts = 0;
    if (first) {
      pts = taskPoints(hints, wrong);
      s.tasks[task.id] = { pts, hints, wrong, type: task.type, topic: task.topic, at: Date.now() };
      if (task.type === 'bug') bump('bugs');
    }
    save();
    checkAchievements();
    return { pts, first };
  }

  // Бонус за задачу (например, второй путь в «Лабиринте») — начисляется один раз
  function taskBonus(id, n) {
    const rec = s.tasks[id];
    if (!rec || rec.bonus) return 0;
    rec.bonus = n;
    rec.pts += n;
    save();
    checkAchievements();
    return n;
  }

  function taskWrong() {
    s.streak = 0;
    save();
  }

  // ---------------------------------------------------------------- игры
  function game(id) {
    if (!s.games[id]) s.games[id] = { pts: 0, levels: {}, seen: false };
    return s.games[id];
  }

  function addGamePoints(id, n) {
    game(id).pts += Math.max(0, Math.round(n));
    save();
    checkAchievements();
  }

  // Уровень пройден: звёзды и очки сохраняются по лучшему результату
  function levelDone(id, level, stars, pts) {
    const g = game(id);
    const old = g.levels[level] || { stars: 0, pts: 0 };
    const gain = Math.max(0, (pts || 0) - old.pts);
    g.levels[level] = { stars: Math.max(old.stars, stars), pts: Math.max(old.pts, pts || 0) };
    g.pts += gain;
    save();
    checkAchievements();
    return gain;
  }

  // Рекорд: lower = true, если лучше меньшее значение (ходы в мемори)
  function record(key, value, lower) {
    const old = s.records[key];
    const better = old === undefined || (lower ? value < old : value > old);
    if (better) { s.records[key] = value; save(); checkAchievements(); }
    return better;
  }

  function bump(stat, n) {
    s.stats[stat] = (s.stats[stat] || 0) + (n === undefined ? 1 : n);
    save();
    checkAchievements();
  }

  function seen(id) { return game(id).seen; }
  function markSeen(id) { game(id).seen = true; save(); }

  // ---------------------------------------------------------------- звёзды
  function topicStars(topic) {
    const all = TASKS.filter(x => x.topic === topic);
    if (!all.length) return 0;
    const done = all.filter(x => s.tasks[x.id]).length / all.length;
    return done >= 1 ? 3 : done >= 0.6 ? 2 : done >= 0.25 ? 1 : 0;
  }

  function levelCount(id) {
    const L = typeof LEVELS !== 'undefined' && LEVELS[id];
    return Array.isArray(L) ? L.length : 0;
  }

  // Звёзды игры: у игр с уровнями — по доле набранных звёзд уровней,
  // у аркад — по порогам рекорда (пороги задаёт игра через Games)
  function gameStars(id) {
    const n = levelCount(id);
    const g = s.games[id];
    if (!g) return 0;
    if (n) {
      const got = Object.values(g.levels).reduce((a, l) => a + l.stars, 0) / (n * 3);
      return got >= 0.95 ? 3 : got >= 0.6 ? 2 : got > 0 ? 1 : 0;
    }
    const def = typeof Games !== 'undefined' && Games.get(id);
    if (def && def.stars) return def.stars(s.records, g);
    return 0;
  }

  function levelsDone(id) {
    const g = s.games[id];
    return g ? Object.keys(g.levels).length : 0;
  }

  // ---------------------------------------------------------------- достижения
  const solved = () => Object.values(s.tasks);
  const allLevels = id => levelCount(id) > 0 && levelsDone(id) >= levelCount(id);

  const ACHIEVEMENTS = [
    { id: 'first', icon: '🚀', test: () => solved().length >= 1 },
    { id: 'nohints', icon: '🧠', test: () => solved().filter(x => !x.hints).length >= 10 },
    { id: 'streak5', icon: '🔥', test: () => s.streak >= 5 },
    { id: 'streak10', icon: '☄️', test: () => s.streak >= 10 },
    { id: 'ifmaster', icon: '🔀', test: () => solved().filter(x => x.topic <= 4).length >= 15 },
    { id: 'loops', icon: '🔁', test: () => solved().filter(x => x.topic >= 5).length >= 15 },
    { id: 'bughunter', icon: '🐞', test: () => (s.stats.bugs || 0) >= 10 },
    { id: 'universal', icon: '🧩', test: () => new Set(solved().map(x => x.type)).size >= 7 },
    { id: 'robot', icon: '🤖', test: () => allLevels('robot') },
    { id: 'artist', icon: '🎨', test: () => allLevels('turtle') },
    { id: 'lightning', icon: '⚡', test: () => (s.records.truefalse || 0) >= 1000 },
    { id: 'counter', icon: '🧮', test: () => (s.records.count || 0) >= 10 },
    { id: 'cpu', icon: '💻', test: () => (s.stats.tracerPerfect || 0) >= 1 },
    { id: 'memory', icon: '🃏', test: () => (s.records.memory === undefined ? 99 : s.records.memory) <= 14 },
    { id: 'millionaire', icon: '💰', test: () => (s.records.quiz || 0) >= 15 },
    { id: 'duel', icon: '⚔️', test: () => (s.stats.duels || 0) >= 1 },
    { id: 'sapper', icon: '💣', test: () => allLevels('minesweeper') },
    { id: 'merchant', icon: '🛒', test: () => allLevels('bazaar') },
    { id: 'quest', icon: '🗝️', test: () => !!s.stats.questDone },
    { id: 'p1000', icon: '🏅', test: () => total() >= 1000 },
    { id: 'p5000', icon: '👑', test: () => total() >= 5000 }
  ];

  function checkAchievements() {
    const fresh = [];
    for (const a of ACHIEVEMENTS) {
      if (s.ach[a.id]) continue;
      let ok = false;
      try { ok = a.test(); } catch (e) { ok = false; }
      if (ok) { s.ach[a.id] = Date.now(); fresh.push(a); }
    }
    if (fresh.length) {
      save();
      fresh.forEach(a => {
        if (typeof FX !== 'undefined') FX.toast(t('ach.unlocked') + ' ' + t('badge.' + a.id), a.icon);
        if (typeof Sound !== 'undefined') Sound.play('win');
      });
    }
    return fresh;
  }

  // ---------------------------------------------------------------- квест
  function questDone(i) {
    if (!s.quest.done.includes(i)) s.quest.done.push(i);
    save();
    checkAchievements();
  }

  function reset() {
    const keep = { name: s.name, theme: s.theme, muted: s.muted };
    s = Object.assign(blank(), keep);
    save();
  }

  return {
    get state() { return s; },
    save, reset, onChange: fn => listeners.push(fn),
    get storageOk() { return storageOk; },
    puzzlePoints, gamePoints, total, taskPoints,
    taskSolved, taskWrong, taskBonus,
    game, addGamePoints, levelDone, record, bump, seen, markSeen, levelsDone, levelCount,
    topicStars, gameStars,
    ACHIEVEMENTS, checkAchievements,
    questDone
  };
})();
