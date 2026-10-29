/* Блокировка при уходе с сайта: если ученик переключился на другую вкладку, окно или приложение,
   сайт закрывается экраном блокировки, который снимает только учитель (PIN из data/config.js).
   Режим — CONFIG.lock: 'exam' (только во время теста), 'always' (всегда), 'off' (выключено).
   Блокировка хранится в localStorage — её не снять перезагрузкой или закрытием вкладки. */
const Lock = (function () {
  'use strict';
  const KEY = 'pyquest.lock';
  let memory = null;    // если localStorage недоступен
  let screen = null;

  const mode = () => (typeof CONFIG !== 'undefined' && CONFIG.lock) || 'exam';

  function get() {
    try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : memory; }
    catch (e) { return memory; }
  }
  function set(v) {
    memory = v;
    try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); }
    catch (e) { /* остаётся в памяти */ }
  }

  const isLocked = () => !!get();
  const watchesExams = () => !App.teacher && mode() !== 'off';

  function watching() {
    if (App.teacher || mode() === 'off') return false;
    if (mode() === 'always') return true;
    return !!Exam.active();
  }

  function trigger(reason) {
    if (isLocked() || !watching()) return;
    const ex = Exam.active();
    if (ex) Exam.noteExit();
    set({ at: Date.now(), reason, exam: ex ? ex.id : null });
    show();
  }

  // ---------------------------------------------------------------- экран блокировки
  function show() {
    const L = get();
    if (!L) return;
    if (screen) screen.remove();
    const ex = L.exam && EXAMS[L.exam];
    const time = new Date(L.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const pin = h('input', { type: 'password', inputmode: 'numeric', class: 'input lock-pin', autocomplete: 'off', placeholder: t('lock.pin'), 'aria-label': t('lock.pin') });
    const msg = h('p', { class: 'bad-text' });

    const unlock = action => {
      if (pin.value !== String(CONFIG.teacherPin)) {
        msg.textContent = t('teacher.pin.wrong');
        pin.value = '';
        FX.shake(pin);
        Sound.play('bad');
        return;
      }
      set(null);
      screen.remove();
      screen = null;
      Sound.play('ok');
      if (action === 'finish') Exam.forceFinish();
      else FX.toast(t('lock.unlocked'), '🔓');
    };

    const examActive = !!Exam.active();
    screen = h('div', { class: 'lock-screen', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': t('lock.title') },
      h('div', { class: 'lock-box' },
        h('div', { class: 'lock-icon' }, '🔒'),
        h('h1', null, t('lock.title')),
        h('p', { class: 'lock-why' }, t(ex ? 'lock.whyExam' : 'lock.why', { time, test: ex ? ex.title : '' })),
        h('p', { class: 'lock-call' }, '🙋 ' + t('lock.call')),
        h('div', { class: 'lock-form' }, pin, msg,
          h('div', { class: 'lock-actions' },
            h('button', { class: 'btn primary', onclick: () => unlock('continue') }, '🔓 ' + t(examActive ? 'lock.continue' : 'lock.unlock')),
            examActive ? h('button', { class: 'btn', onclick: () => unlock('finish') }, '✔ ' + t('lock.finish')) : null))));
    pin.addEventListener('keydown', e => { if (e.key === 'Enter') unlock('continue'); });
    document.body.append(screen);
    Sound.play('bad');
    setTimeout(() => pin.focus(), 50);
  }

  function init() {
    // переключение вкладки, сворачивание, переход в другое приложение на телефоне
    document.addEventListener('visibilitychange', () => { if (document.hidden) trigger('tab'); });
    // переключение на другое окно, когда браузер остаётся на экране
    window.addEventListener('blur', () => setTimeout(() => { if (!document.hasFocus()) trigger('window'); }, 300));
    // блокировка переживает перезагрузку и закрытие вкладки
    if (isLocked()) show();
    // клавиши не должны действовать под экраном блокировки
    document.addEventListener('keydown', e => {
      if (screen && !screen.contains(e.target)) { e.stopPropagation(); e.preventDefault(); }
    }, true);
  }

  document.addEventListener('DOMContentLoaded', init);

  return { isLocked, watchesExams, trigger };
})();
