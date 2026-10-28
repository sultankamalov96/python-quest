/* Визуальные эффекты: конфетти, тряска, всплывающие сообщения.
   При prefers-reduced-motion анимации заменяются спокойными вариантами. */
const FX = (function () {
  'use strict';
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function confetti() {
    if (reduced()) return;
    const cv = document.createElement('canvas');
    cv.className = 'fx-confetti';
    document.body.appendChild(cv);
    const dpr = window.devicePixelRatio || 1;
    const W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
    const c = cv.getContext('2d');
    const colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899'];
    const parts = Array.from({ length: 110 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3,
      y: H * 0.35,
      vx: (Math.random() - 0.5) * 16 * dpr,
      vy: (-Math.random() * 14 - 4) * dpr,
      r: (Math.random() * 5 + 3) * dpr,
      a: Math.random() * Math.PI,
      va: (Math.random() - 0.5) * 0.4,
      col: colors[Math.floor(Math.random() * colors.length)]
    }));
    let frame = 0;
    (function tick() {
      c.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vy += 0.45 * dpr; p.vx *= 0.99;
        p.x += p.vx; p.y += p.vy; p.a += p.va;
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.a);
        c.fillStyle = p.col;
        c.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        c.restore();
      }
      if (++frame < 110) requestAnimationFrame(tick);
      else cv.remove();
    })();
  }

  function shake(el) {
    if (!el) return;
    el.classList.remove('fx-shake', 'fx-flash');
    void el.offsetWidth;
    el.classList.add(reduced() ? 'fx-flash' : 'fx-shake');
    setTimeout(() => el.classList.remove('fx-shake', 'fx-flash'), 600);
  }

  let toastBox = null;
  function toast(text, icon) {
    if (!toastBox) {
      toastBox = document.createElement('div');
      toastBox.className = 'toasts';
      toastBox.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastBox);
    }
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = (icon ? '<span class="toast-icon">' + icon + '</span>' : '') + '<span></span>';
    el.lastChild.textContent = text;
    toastBox.appendChild(el);
    setTimeout(() => el.classList.add('out'), 3200);
    setTimeout(() => el.remove(), 3700);
  }

  return { confetti, shake, toast, reduced };
})();
