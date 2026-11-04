/* PIN учителя. По умолчанию — CONFIG.teacherPin (data/config.js).
   Учитель может сменить PIN в режиме учителя: новый PIN хранится на устройстве не сам, а его отпечатком,
   и передаётся на устройства учеников через ссылку на тест (там тоже только отпечаток).
   Это защита от случайного входа, а не от взлома: код сайта открыт. */
const Pin = (function () {
  'use strict';
  const KEY = 'pyquest.pin';

  const hash = s => {
    let x = 5381;
    for (const ch of 'pyquest-pin:' + s) x = ((x * 33) ^ ch.charCodeAt(0)) >>> 0;
    return x.toString(36);
  };

  function stored() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  function store(v) {
    try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch (e) { /* только на время вкладки */ }
  }

  // Подходит ли введённый PIN: сменённый на этом устройстве, а если его нет — из config.js
  function check(pin) {
    const s = stored();
    return s ? hash(String(pin)) === s.h : String(pin) === String(CONFIG.teacherPin);
  }

  // Сменить PIN: нужен текущий PIN, новый — от 4 до 8 цифр. Возвращает текст ошибки или ''.
  function change(oldPin, newPin, repeat) {
    if (!check(oldPin)) return t('pin.errOld');
    if (!/^\d{4,8}$/.test(newPin)) return t('pin.errFormat');
    if (newPin !== repeat) return t('pin.errRepeat');
    store({ h: hash(newPin), at: Date.now() });
    return '';
  }

  function reset() { store(null); }

  // Для ссылки на тест: отпечаток PIN и время смены (null — если PIN не меняли в интерфейсе)
  const current = () => stored();

  // PIN, полученный по ссылке учителя: принимаем, если он новее того, что уже есть на устройстве
  function accept(h, at) {
    const s = stored();
    if (!h || !(at > 0) || (s && s.at >= at)) return false;
    store({ h, at });
    return true;
  }

  return { check, change, reset, current, accept, isCustom: () => !!stored() };
})();
