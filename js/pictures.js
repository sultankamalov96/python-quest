/* Картинки для тестов — векторные рисунки (SVG), работают без интернета.
   Pictures.svg('monitor') → строка SVG, Pictures.label('monitor') → подпись «Монитор». */
const Pictures = (function () {
  'use strict';
  const DARK = '#2f3545', MID = '#6b7280', LIGHT = '#d9dde7', BLUE = '#4aa3ff', SCREEN = '#7cc4ff';

  const keys = (x0, y0, cols, rows, w, h, gap, fill) => {
    let s = '';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      s += '<rect x="' + (x0 + c * (w + gap)) + '" y="' + (y0 + r * (h + gap)) + '" width="' + w + '" height="' + h + '" rx="1.5" fill="' + fill + '"/>';
    }
    return s;
  };

  // Сочетание клавиш: две клавиши со знаком «+» между ними
  const keycap = (x, text) => '<rect x="' + x + '" y="36" width="62" height="54" rx="9" fill="' + MID + '"/><rect x="' + x + '" y="32" width="62" height="50" rx="9" fill="#fff" stroke="' + DARK + '" stroke-width="2.5"/>' +
    '<text x="' + (x + 31) + '" y="65" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="21" fill="' + DARK + '">' + text + '</text>';
  const combo = (a, b) => [a + ' + ' + b, keycap(6, a) + '<text x="80" y="66" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="24" fill="' + DARK + '">+</text>' + keycap(92, b)];

  const ART = {
    monitor: ['Монитор',
      '<rect x="22" y="12" width="116" height="76" rx="6" fill="' + DARK + '"/><rect x="30" y="19" width="100" height="61" rx="2" fill="' + SCREEN + '"/>' +
      '<path d="M30 70 L58 46 L74 60 L92 40 L130 72 L130 80 L30 80Z" fill="#5fb85f"/><circle cx="52" cy="34" r="7" fill="#ffd54a"/>' +
      '<rect x="72" y="88" width="16" height="14" fill="' + MID + '"/><rect x="50" y="101" width="60" height="7" rx="3.5" fill="' + DARK + '"/>'],
    keyboard: ['Клавиатура',
      '<rect x="10" y="34" width="140" height="56" rx="7" fill="' + DARK + '"/>' + keys(17, 41, 12, 3, 8.5, 9, 2.6, LIGHT) +
      '<rect x="42" y="75" width="76" height="9" rx="1.5" fill="' + LIGHT + '"/>'],
    mouse: ['Мышь',
      '<path d="M80 30 C 80 14, 96 10, 104 2" stroke="' + MID + '" stroke-width="3" fill="none"/>' +
      '<rect x="56" y="30" width="48" height="76" rx="24" fill="' + LIGHT + '" stroke="' + DARK + '" stroke-width="3"/>' +
      '<line x1="80" y1="31" x2="80" y2="62" stroke="' + DARK + '" stroke-width="3"/><line x1="57" y1="62" x2="103" y2="62" stroke="' + DARK + '" stroke-width="3"/>' +
      '<rect x="76" y="40" width="8" height="14" rx="4" fill="' + DARK + '"/>'],
    printer: ['Принтер',
      '<rect x="46" y="10" width="68" height="34" fill="#fff" stroke="' + MID + '" stroke-width="2"/>' +
      '<rect x="20" y="38" width="120" height="44" rx="6" fill="' + DARK + '"/><rect x="34" y="50" width="92" height="6" rx="3" fill="#111"/>' +
      '<circle cx="124" cy="68" r="4" fill="#5fe08a"/>' +
      '<path d="M44 76 L116 76 L122 110 L38 110Z" fill="#fff" stroke="' + MID + '" stroke-width="2"/>' +
      '<line x1="52" y1="88" x2="108" y2="88" stroke="' + LIGHT + '" stroke-width="3"/><line x1="52" y1="97" x2="98" y2="97" stroke="' + LIGHT + '" stroke-width="3"/>'],
    scanner: ['Сканер',
      '<path d="M18 58 L142 58 L136 30 L24 30Z" fill="' + MID + '"/>' +
      '<rect x="14" y="58" width="132" height="34" rx="6" fill="' + DARK + '"/><rect x="24" y="64" width="112" height="8" rx="2" fill="' + SCREEN + '"/>' +
      '<rect x="28" y="64" width="18" height="8" fill="#fffbcc"/><circle cx="132" cy="84" r="3.5" fill="#5fe08a"/>'],
    sysunit: ['Системный блок',
      '<rect x="52" y="6" width="56" height="108" rx="6" fill="' + DARK + '"/><rect x="60" y="16" width="40" height="8" rx="2" fill="' + MID + '"/>' +
      '<rect x="60" y="30" width="40" height="5" rx="2" fill="' + MID + '"/><circle cx="80" cy="54" r="7" fill="none" stroke="#5fe08a" stroke-width="3"/>' +
      '<line x1="80" y1="46" x2="80" y2="54" stroke="#5fe08a" stroke-width="3"/>' + keys(62, 78, 6, 4, 3, 3, 3.4, MID)],
    flash: ['Флешка',
      '<rect x="98" y="46" width="34" height="28" rx="2" fill="#c8ccd6" stroke="' + MID + '" stroke-width="2"/><rect x="108" y="53" width="7" height="6" fill="' + MID + '"/><rect x="120" y="53" width="7" height="6" fill="' + MID + '"/>' +
      '<rect x="26" y="40" width="76" height="40" rx="9" fill="#ef5b5b"/><circle cx="40" cy="60" r="6" fill="#fff"/><rect x="56" y="54" width="34" height="12" rx="3" fill="#ffffff55"/>'],
    headphones: ['Наушники',
      '<path d="M34 76 C 34 22, 126 22, 126 76" stroke="' + DARK + '" stroke-width="9" fill="none" stroke-linecap="round"/>' +
      '<rect x="22" y="66" width="28" height="42" rx="12" fill="' + BLUE + '"/><rect x="110" y="66" width="28" height="42" rx="12" fill="' + BLUE + '"/>'],
    speakers: ['Колонки',
      '<rect x="20" y="16" width="52" height="92" rx="6" fill="' + DARK + '"/><circle cx="46" cy="44" r="11" fill="' + MID + '"/><circle cx="46" cy="80" r="17" fill="' + MID + '"/><circle cx="46" cy="80" r="7" fill="' + DARK + '"/>' +
      '<rect x="88" y="16" width="52" height="92" rx="6" fill="' + DARK + '"/><circle cx="114" cy="44" r="11" fill="' + MID + '"/><circle cx="114" cy="80" r="17" fill="' + MID + '"/><circle cx="114" cy="80" r="7" fill="' + DARK + '"/>'],
    microphone: ['Микрофон',
      '<rect x="62" y="8" width="36" height="60" rx="18" fill="' + MID + '"/>' + keys(68, 16, 4, 6, 3, 3, 4.8, DARK) +
      '<path d="M50 50 C 50 86, 110 86, 110 50" stroke="' + DARK + '" stroke-width="5" fill="none"/>' +
      '<rect x="77" y="82" width="6" height="22" fill="' + DARK + '"/><rect x="56" y="104" width="48" height="7" rx="3.5" fill="' + DARK + '"/>'],
    projector: ['Проектор',
      '<path d="M48 54 L150 22 L150 104 L48 72Z" fill="#fff6b0" opacity=".9"/>' +
      '<rect x="8" y="46" width="62" height="38" rx="6" fill="' + DARK + '"/><circle cx="56" cy="64" r="12" fill="' + SCREEN + '" stroke="' + LIGHT + '" stroke-width="3"/>' +
      '<rect x="16" y="54" width="20" height="4" rx="2" fill="' + MID + '"/><rect x="16" y="62" width="20" height="4" rx="2" fill="' + MID + '"/>'],
    laptop: ['Ноутбук',
      '<rect x="32" y="16" width="96" height="64" rx="5" fill="' + DARK + '"/><rect x="39" y="22" width="82" height="52" rx="2" fill="' + SCREEN + '"/>' +
      '<path d="M14 84 L146 84 L136 102 L24 102Z" fill="' + MID + '"/>' + keys(36, 87, 14, 1, 5, 3, 1.9, LIGHT) +
      '<rect x="68" y="94" width="24" height="5" rx="2" fill="' + LIGHT + '"/>'],
    processor: ['Процессор',
      (() => { let s = ''; for (let i = 0; i < 7; i++) { const p = 38 + i * 13; s += '<rect x="' + p + '" y="14" width="5" height="12" fill="#c9a14a"/><rect x="' + p + '" y="94" width="5" height="12" fill="#c9a14a"/><rect x="38" y="' + (p - 10) + '" width="12" height="5" fill="#c9a14a"/><rect x="110" y="' + (p - 10) + '" width="12" height="5" fill="#c9a14a"/>'; } return s; })() +
      '<rect x="48" y="24" width="64" height="72" rx="5" fill="' + DARK + '"/><rect x="60" y="38" width="40" height="44" rx="3" fill="' + MID + '"/>' +
      '<text x="80" y="66" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="14" fill="#fff">CPU</text>'],
    webcam: ['Веб-камера',
      '<circle cx="80" cy="48" r="32" fill="' + DARK + '"/><circle cx="80" cy="48" r="17" fill="' + MID + '"/><circle cx="80" cy="48" r="9" fill="' + BLUE + '"/><circle cx="76" cy="44" r="3" fill="#fff"/>' +
      '<circle cx="104" cy="28" r="3" fill="#ff5b5b"/><path d="M66 78 L94 78 L102 104 L58 104Z" fill="' + MID + '"/>'],
    eye: ['Глаз',
      '<path d="M14 60 C 46 18, 114 18, 146 60 C 114 102, 46 102, 14 60Z" fill="#fff" stroke="' + DARK + '" stroke-width="4"/>' +
      '<circle cx="80" cy="60" r="24" fill="#3f8ed8"/><circle cx="80" cy="60" r="11" fill="#111"/><circle cx="73" cy="53" r="5" fill="#fff"/>'],
    ear: ['Ухо',
      '<path d="M96 104 C 70 112, 62 90, 66 78 C 70 66, 52 60, 50 44 C 48 22, 70 8, 92 10 C 118 12, 128 34, 120 56 C 114 72, 104 76, 104 88 C 104 96, 102 102, 96 104Z" fill="#f2c4a0" stroke="#b07a55" stroke-width="4"/>' +
      '<path d="M76 46 C 76 30, 104 28, 106 46 C 108 60, 92 62, 92 74" stroke="#b07a55" stroke-width="4" fill="none" stroke-linecap="round"/>'],
    nose: ['Нос',
      '<path d="M86 10 C 84 40, 78 60, 64 82 C 58 92, 66 100, 78 98 C 84 104, 96 104, 102 96 C 112 98, 116 88, 108 80 C 98 62, 94 40, 92 10Z" fill="#f2c4a0" stroke="#b07a55" stroke-width="4" stroke-linejoin="round"/>' +
      '<ellipse cx="76" cy="90" rx="6" ry="3.5" fill="#b07a55"/><ellipse cx="104" cy="90" rx="6" ry="3.5" fill="#b07a55"/>'],
    hand: ['Рука',
      '<g fill="#f2c4a0" stroke="#b07a55" stroke-width="3">' +
      '<rect x="48" y="58" width="64" height="54" rx="16"/><rect x="50" y="22" width="14" height="48" rx="7"/><rect x="66" y="12" width="14" height="56" rx="7"/>' +
      '<rect x="82" y="16" width="14" height="52" rx="7"/><rect x="98" y="26" width="13" height="44" rx="6.5"/><rect x="24" y="62" width="34" height="14" rx="7" transform="rotate(-35 41 69)"/></g>'],
    traffic: ['Светофор',
      '<rect x="76" y="98" width="8" height="18" fill="' + MID + '"/><rect x="56" y="4" width="48" height="96" rx="10" fill="' + DARK + '"/>' +
      '<circle cx="80" cy="24" r="11" fill="#ff4d4d"/><circle cx="80" cy="52" r="11" fill="#5a4a1a"/><circle cx="80" cy="80" r="11" fill="#1f4d2b"/>'],
    byte: ['Байт',
      (() => { const bits = '10110010'; let s = ''; for (let i = 0; i < 8; i++) { const x = 12 + i * 17.5; s += '<rect x="' + x + '" y="34" width="15" height="24" rx="3" fill="' + (bits[i] === '1' ? BLUE : LIGHT) + '"/><text x="' + (x + 7.5) + '" y="51" text-anchor="middle" font-family="monospace" font-weight="700" font-size="14" fill="' + DARK + '">' + bits[i] + '</text>'; } return s; })() +
      '<path d="M12 66 C 12 74, 80 70, 80 80 C 80 70, 150 74, 150 66" stroke="' + DARK + '" stroke-width="2.5" fill="none"/>' +
      '<text x="80" y="100" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="14" fill="' + DARK + '">8 ячеек = ?</text>'],
    notes: ['Ноты',
      '<g stroke="' + DARK + '" stroke-width="2">' + [36, 48, 60, 72, 84].map(y => '<line x1="10" y1="' + y + '" x2="150" y2="' + y + '"/>').join('') + '</g>' +
      '<g fill="' + DARK + '"><ellipse cx="44" cy="78" rx="9" ry="6.5" transform="rotate(-20 44 78)"/><rect x="51" y="28" width="3" height="50"/>' +
      '<ellipse cx="84" cy="66" rx="9" ry="6.5" transform="rotate(-20 84 66)"/><rect x="91" y="18" width="3" height="48"/>' +
      '<ellipse cx="120" cy="54" rx="9" ry="6.5" transform="rotate(-20 120 54)"/><rect x="127" y="12" width="3" height="42"/><path d="M94 18 L130 12 L130 20 L94 26Z"/></g>'],
    // ---- файлы и папки
    folder: ['Папка',
      '<path d="M16 28 L62 28 L72 38 L144 38 L144 100 L16 100Z" fill="#f5b83d"/><path d="M16 46 L144 46 L144 100 L16 100Z" fill="#ffcf5c"/>'],
    filetext: ['Текстовый документ',
      '<path d="M46 8 L102 8 L122 28 L122 112 L46 112Z" fill="#fff" stroke="' + MID + '" stroke-width="3"/><path d="M102 8 L102 28 L122 28" fill="' + LIGHT + '" stroke="' + MID + '" stroke-width="3"/>' +
      [44, 56, 68, 80, 92].map(y => '<line x1="58" y1="' + y + '" x2="' + (y === 92 ? 92 : 110) + '" y2="' + y + '" stroke="' + BLUE + '" stroke-width="4" stroke-linecap="round"/>').join('')],
    fileimage: ['Рисунок (картинка)',
      '<path d="M46 8 L102 8 L122 28 L122 112 L46 112Z" fill="#fff" stroke="' + MID + '" stroke-width="3"/><path d="M102 8 L102 28 L122 28" fill="' + LIGHT + '" stroke="' + MID + '" stroke-width="3"/>' +
      '<rect x="56" y="40" width="56" height="52" rx="3" fill="' + SCREEN + '"/><path d="M56 92 L74 66 L86 80 L96 70 L112 92Z" fill="#5fb85f"/><circle cx="70" cy="54" r="6" fill="#ffd54a"/>'],
    filemusic: ['Музыка (звук)',
      '<path d="M46 8 L102 8 L122 28 L122 112 L46 112Z" fill="#fff" stroke="' + MID + '" stroke-width="3"/><path d="M102 8 L102 28 L122 28" fill="' + LIGHT + '" stroke="' + MID + '" stroke-width="3"/>' +
      '<g fill="#a855f7"><ellipse cx="72" cy="88" rx="9" ry="7"/><ellipse cx="100" cy="80" rx="9" ry="7"/><rect x="78" y="42" width="4" height="46"/><rect x="106" y="36" width="4" height="44"/><path d="M78 42 L110 36 L110 46 L78 52Z"/></g>'],
    // ---- рабочий стол и окна
    desktop: ['Рабочий стол',
      '<rect x="8" y="8" width="144" height="98" rx="4" fill="#3a7bd5"/><path d="M8 80 C 50 60, 90 96, 152 70 L152 98 L8 98Z" fill="#5aa0ef"/>' +
      '<rect x="18" y="18" width="16" height="13" rx="2" fill="#ffcf5c"/><rect x="18" y="40" width="14" height="16" rx="1" fill="#fff"/><rect x="18" y="64" width="16" height="13" rx="2" fill="#c8ccd6"/>' +
      '<rect x="8" y="98" width="144" height="14" fill="' + DARK + '"/><rect x="12" y="101" width="9" height="8" rx="1" fill="#4aa3ff"/><rect x="26" y="101" width="18" height="8" rx="1" fill="' + MID + '"/><rect x="48" y="101" width="18" height="8" rx="1" fill="' + MID + '"/><text x="146" y="108" text-anchor="end" font-family="sans-serif" font-size="7" fill="#fff">10:30</text>'],
    window: ['Окно',
      '<rect x="10" y="12" width="140" height="96" rx="5" fill="#fff" stroke="' + MID + '" stroke-width="3"/><rect x="10" y="12" width="140" height="20" rx="5" fill="' + LIGHT + '"/>' +
      '<rect x="10" y="26" width="140" height="6" fill="' + LIGHT + '"/><text x="18" y="27" font-family="sans-serif" font-size="9" fill="' + DARK + '">Документ</text>' +
      '<text x="104" y="28" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="14" fill="' + DARK + '">–</text>' +
      '<rect x="114" y="18" width="9" height="8" fill="none" stroke="' + DARK + '" stroke-width="1.6"/>' +
      '<rect x="128" y="14" width="18" height="16" rx="2" fill="#e5484d"/><text x="137" y="27" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="12" fill="#fff">✕</text>' +
      [46, 58, 70, 82].map(y => '<line x1="22" y1="' + y + '" x2="' + (y === 82 ? 90 : 136) + '" y2="' + y + '" stroke="' + LIGHT + '" stroke-width="5" stroke-linecap="round"/>').join('')],
    trash: ['Корзина',
      '<rect x="52" y="20" width="56" height="8" rx="3" fill="' + MID + '"/><rect x="70" y="12" width="20" height="8" rx="3" fill="' + MID + '"/>' +
      '<path d="M56 32 L104 32 L98 108 L62 108Z" fill="#c8ccd6" stroke="' + MID + '" stroke-width="3"/>' +
      '<line x1="70" y1="44" x2="72" y2="98" stroke="' + MID + '" stroke-width="3"/><line x1="80" y1="44" x2="80" y2="98" stroke="' + MID + '" stroke-width="3"/><line x1="90" y1="44" x2="88" y2="98" stroke="' + MID + '" stroke-width="3"/>'],
    // ---- безопасность
    padlock: ['Замок (пароль)',
      '<path d="M56 54 L56 38 C 56 14, 104 14, 104 38 L104 54" stroke="' + MID + '" stroke-width="10" fill="none"/>' +
      '<rect x="40" y="52" width="80" height="58" rx="8" fill="#f5b83d"/><circle cx="80" cy="76" r="8" fill="' + DARK + '"/><rect x="77" y="80" width="6" height="16" rx="2" fill="' + DARK + '"/>'],
    virus: ['Компьютерный вирус',
      '<g stroke="#4caf50" stroke-width="5" stroke-linecap="round">' + [0, 45, 90, 135, 180, 225, 270, 315].map(a => { const r = a * Math.PI / 180; return '<line x1="80" y1="60" x2="' + (80 + 46 * Math.cos(r)).toFixed(1) + '" y2="' + (60 + 46 * Math.sin(r)).toFixed(1) + '"/>'; }).join('') + '</g>' +
      [0, 45, 90, 135, 180, 225, 270, 315].map(a => { const r = a * Math.PI / 180; return '<circle cx="' + (80 + 48 * Math.cos(r)).toFixed(1) + '" cy="' + (60 + 48 * Math.sin(r)).toFixed(1) + '" r="6" fill="#2e7d32"/>'; }).join('') +
      '<circle cx="80" cy="60" r="30" fill="#66bb6a"/><circle cx="70" cy="54" r="5" fill="#1b3d1d"/><circle cx="90" cy="54" r="5" fill="#1b3d1d"/><path d="M68 72 Q 80 64, 92 72" stroke="#1b3d1d" stroke-width="4" fill="none" stroke-linecap="round"/>'],
    shield: ['Антивирус',
      '<path d="M80 8 L130 26 C 130 70, 110 98, 80 112 C 50 98, 30 70, 30 26Z" fill="#2563eb"/><path d="M80 18 L120 32 C 120 68, 104 90, 80 102Z" fill="#3b82f6"/>' +
      '<path d="M58 60 L74 76 L104 44" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'],
    email: ['Электронное письмо',
      '<rect x="16" y="26" width="128" height="80" rx="6" fill="#fff" stroke="' + MID + '" stroke-width="3"/><path d="M18 30 L80 74 L142 30" stroke="' + MID + '" stroke-width="3" fill="none"/>' +
      '<circle cx="132" cy="28" r="13" fill="#e5484d"/><text x="132" y="33" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="14" fill="#fff">@</text>'],
    // ---- кодирование
    binary: ['Двоичный код',
      '<rect x="8" y="16" width="144" height="88" rx="8" fill="' + DARK + '"/>' +
      ['01001011', '10110100', '01101001', '11010010'].map((row, i) => '<text x="80" y="' + (40 + i * 19) + '" text-anchor="middle" font-family="monospace" font-weight="700" font-size="17" fill="#5fe08a" letter-spacing="2">' + row + '</text>').join('')],
    morse: ['Азбука Морзе',
      '<rect x="8" y="30" width="144" height="60" rx="8" fill="#fff8e1" stroke="#e0c070" stroke-width="2"/>' +
      (() => { const code = '.-/-.../.--'; let x = 17, s = ''; for (const c of code) { if (c === '.') { s += '<circle cx="' + (x + 3.5) + '" cy="60" r="3.8" fill="' + DARK + '"/>'; x += 10; } else if (c === '-') { s += '<rect x="' + x + '" y="56" width="11" height="8" rx="4" fill="' + DARK + '"/>'; x += 15; } else x += 9; } return s; })()],
    barcode: ['Штрих-код',
      '<rect x="14" y="14" width="132" height="92" rx="6" fill="#fff" stroke="' + LIGHT + '" stroke-width="2"/>' +
      (() => { const w = [3, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 2]; let x = 26, s = ''; w.forEach((k, i) => { if (i % 2 === 0) s += '<rect x="' + x + '" y="24" width="' + k * 2 + '" height="58" fill="#111"/>'; x += k * 2 + 1; }); return s; })() +
      '<text x="80" y="98" text-anchor="middle" font-family="monospace" font-size="11" fill="#111" letter-spacing="2">4 600123 45678</text>'],
    // ---- виды информации
    tongue: ['Язык',
      '<path d="M20 44 Q 80 20, 140 44 Q 128 104, 80 108 Q 32 104, 20 44Z" fill="#7a2b34"/><path d="M24 44 Q 80 26, 136 44 L 132 54 Q 80 40, 28 54Z" fill="#fff"/>' +
      '<path d="M50 62 Q 80 50, 110 62 Q 110 100, 80 102 Q 50 100, 50 62Z" fill="#ef7f8f"/><line x1="80" y1="60" x2="80" y2="90" stroke="#c9566a" stroke-width="3" stroke-linecap="round"/>'],
    book: ['Книга',
      '<path d="M80 26 C 62 14, 34 14, 14 22 L 14 100 C 34 92, 62 92, 80 104Z" fill="#fff" stroke="' + DARK + '" stroke-width="3"/><path d="M80 26 C 98 14, 126 14, 146 22 L 146 100 C 126 92, 98 92, 80 104Z" fill="#fff" stroke="' + DARK + '" stroke-width="3"/>' +
      [36, 48, 60, 72].map(y => '<line x1="26" y1="' + y + '" x2="68" y2="' + (y + 3) + '" stroke="' + MID + '" stroke-width="3"/><line x1="92" y1="' + (y + 3) + '" x2="134" y2="' + y + '" stroke="' + MID + '" stroke-width="3"/>').join('')],
    painting: ['Картина',
      '<rect x="18" y="12" width="124" height="96" rx="3" fill="#b5793a"/><rect x="28" y="22" width="104" height="76" fill="' + SCREEN + '"/>' +
      '<path d="M28 84 L60 52 L80 72 L100 48 L132 84 L132 98 L28 98Z" fill="#5fb85f"/><circle cx="108" cy="38" r="9" fill="#ffd54a"/>'],
    // ---- сочетания клавиш
    ctrlC: combo('Ctrl', 'C'),
    ctrlV: combo('Ctrl', 'V'),
    ctrlX: combo('Ctrl', 'X'),
    ctrlZ: combo('Ctrl', 'Z'),
    ctrlA: combo('Ctrl', 'A'),
    ctrlS: combo('Ctrl', 'S'),
    ctrlP: combo('Ctrl', 'P'),
    altF4: combo('Alt', 'F4'),
    altTab: combo('Alt', 'Tab'),
    shiftA: combo('Shift', 'А')
  };

  function svg(key) {
    const a = ART[key];
    if (!a) return '';
    return '<svg class="pic-svg" viewBox="0 0 160 120" role="img" aria-label="' + a[0] + '" xmlns="http://www.w3.org/2000/svg">' + a[1] + '</svg>';
  }

  return { svg, label: key => (ART[key] ? ART[key][0] : key), has: key => !!ART[key], keys: () => Object.keys(ART) };
})();
