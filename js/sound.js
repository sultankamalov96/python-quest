/* Звуки через Web Audio API — без звуковых файлов. Sound.play('ok') */
const Sound = (function () {
  'use strict';
  let ctx = null;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Одна нота: частота, начало (с), длительность (с), форма волны, громкость
  function tone(a, freq, at, dur, type, vol, slide) {
    const o = a.createOscillator();
    const g = a.createGain();
    const t0 = a.currentTime + at;
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function noise(a, at, dur, vol) {
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource();
    const g = a.createGain();
    g.gain.value = vol || 0.2;
    src.buffer = buf;
    src.connect(g).connect(a.destination);
    src.start(a.currentTime + at);
  }

  const SOUNDS = {
    click: a => tone(a, 660, 0, 0.05, 'triangle', 0.08),
    ok: a => { tone(a, 523, 0, 0.12, 'triangle'); tone(a, 784, 0.1, 0.18, 'triangle'); },
    bad: a => { tone(a, 220, 0, 0.18, 'sawtooth', 0.08, 150); },
    win: a => [523, 659, 784, 1047].forEach((f, i) => tone(a, f, i * 0.09, 0.2, 'triangle', 0.12)),
    lose: a => [392, 330, 262].forEach((f, i) => tone(a, f, i * 0.15, 0.25, 'triangle', 0.12)),
    coin: a => { tone(a, 988, 0, 0.07, 'square', 0.06); tone(a, 1319, 0.06, 0.15, 'square', 0.06); },
    step: a => tone(a, 330, 0, 0.04, 'sine', 0.06),
    tick: a => tone(a, 1200, 0, 0.03, 'square', 0.03),
    flip: a => tone(a, 500, 0, 0.06, 'triangle', 0.07, 800),
    boom: a => { noise(a, 0, 0.5, 0.25); tone(a, 120, 0, 0.4, 'sine', 0.2, 40); },
    hint: a => { tone(a, 880, 0, 0.08, 'sine', 0.08); tone(a, 1175, 0.08, 0.12, 'sine', 0.08); },
    level: a => [392, 523, 659, 784, 1047].forEach((f, i) => tone(a, f, i * 0.07, 0.15, 'square', 0.05))
  };

  function play(name) {
    if (Progress.state.muted) return;
    const a = ac();
    if (!a || !SOUNDS[name]) return;
    try { SOUNDS[name](a); } catch (e) { /* звук не обязателен */ }
  }

  function toggle() {
    Progress.state.muted = !Progress.state.muted;
    Progress.save();
    if (!Progress.state.muted) play('click');
    return !Progress.state.muted;
  }

  return { play, toggle };
})();
