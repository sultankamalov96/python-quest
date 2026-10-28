/* Уровни игр. Формат описан в README.md.
   Эталонные решения (solution) проверяются в tests.html. */

// Кнопки-подсказки команд для редактора робота
const ROBOT_CMD = ['forward()', 'left()', 'right()', 'take()'];
const ROBOT_FOR = ROBOT_CMD.concat(['for i in range(3):']);
const ROBOT_IF = ROBOT_FOR.concat(['if coin_here():', 'if wall_ahead():', 'if hole_ahead():', 'else:']);
const ROBOT_WHILE = ROBOT_IF.concat(['while not at_finish():', 'while not wall_ahead():', 'not']);

const LEVELS = {
  /* ------------------------------------------------------------------ Магазин на базаре
     vars — данные покупателя: [мин, макс, шаг] — число, 'day' — день недели, 'number' — номер (1…10).
     edges — «пограничные» значения, которые иногда попадаются нарочно.
     solution — эталон: им считается ожидаемый чек для каждого покупателя. */
  bazaar: [
    { title: 'Первая покупка',
      req: 'Покупатель берёт `count` штук товара по цене `price` сом. Выведи, сколько он должен заплатить.',
      vars: { price: [20, 200, 10], count: [1, 9] },
      palette: ['print()', 'price * count'],
      starter: '# price — цена одной штуки, count — сколько штук\n# Выведи сумму к оплате\n',
      solution: 'print(price * count)' },
    { title: 'Скидка 10%',
      req: 'Если покупка (`total`) **от 1000 сом**, скидка 10%. Считай так: `total - total // 10`. Выведи итог.',
      vars: { total: [300, 2500, 10] }, edges: { total: [1000, 999, 1001] },
      palette: ['if total >= 1000:', 'total = total - total // 10', 'print(total)'],
      starter: '# total — сумма покупки\n',
      solution: 'if total >= 1000:\n    total = total - total // 10\nprint(total)' },
    { title: 'Две скидки',
      req: 'От 2000 сом — скидка 10% (`total // 10`), от 1000 сом — скидка 5% (`total // 20`). Скидки не складываются. Выведи итог. Подумай о порядке условий!',
      vars: { total: [300, 3500, 10] }, edges: { total: [1000, 2000, 1999, 999] },
      palette: ['if total >= 2000:', 'elif total >= 1000:', 'total -= total // 10', 'total -= total // 20', 'print(total)'],
      starter: '# total — сумма покупки\n',
      solution: 'if total >= 2000:\n    total -= total // 10\nelif total >= 1000:\n    total -= total // 20\nprint(total)' },
    { title: 'Базарный день',
      req: 'От 2000 сом — скидка 10%. А в выходные (`day` — «суббота» или «воскресенье») — ещё минус 100 сом после скидки. Выведи итог.',
      vars: { total: [500, 3000, 10], day: 'day' }, edges: { total: [2000, 1990] },
      palette: ['if total >= 2000:', 'if day == "суббота" or day == "воскресенье":', 'total -= 100', 'print(total)'],
      starter: '# total — сумма, day — день недели ("понедельник" … "воскресенье")\n',
      solution: 'if total >= 2000:\n    total -= total // 10\nif day == "суббота" or day == "воскресенье":\n    total -= 100\nprint(total)' },
    { title: 'Не больше пяти дынь',
      req: 'Дыни продаются не больше 5 штук в одни руки. Если покупатель просит больше (`count > 5`), продай 5. Выведи сначала количество, потом сумму (`price` за штуку) — двумя print.',
      vars: { price: [80, 250, 10], count: [1, 10] }, edges: { count: [5, 6] },
      palette: ['if count > 5:', 'count = 5', 'print(count)', 'print(count * price)'],
      starter: '# price — цена дыни, count — сколько просит покупатель\n',
      solution: 'if count > 5:\n    count = 5\nprint(count)\nprint(count * price)' },
    { title: 'Каждый третий — с подарком',
      req: 'Каждый третий покупатель (`number` делится на 3) получает подарок: сначала выведи `Подарок! 🎁`, потом сумму. От 1000 сом — скидка 10%.',
      vars: { total: [300, 2000, 10], number: 'number' }, edges: { total: [1000] },
      palette: ['if number % 3 == 0:', 'print("Подарок! 🎁")', 'if total >= 1000:', 'print(total)'],
      starter: '# total — сумма, number — номер покупателя в очереди (1…10)\n',
      solution: 'if number % 3 == 0:\n    print("Подарок! 🎁")\nif total >= 1000:\n    total -= total // 10\nprint(total)' },
    { title: 'Оптом дешевле',
      req: 'Цена яблок зависит от количества: 1–4 кг — 100 сом за кг, 5–9 кг — 90 сом, от 10 кг — 80 сом. Выведи сумму за `count` кг.',
      vars: { count: [1, 15] }, edges: { count: [4, 5, 9, 10] },
      palette: ['if count >= 10:', 'elif count >= 5:', 'else:', 'price = 100', 'print(count * price)'],
      starter: '# count — сколько килограммов\n',
      solution: 'if count >= 10:\n    price = 80\nelif count >= 5:\n    price = 90\nelse:\n    price = 100\nprint(count * price)' },
    { title: 'Главная касса базара',
      req: 'Всё вместе, строго по порядку:\n1) больше 10 штук не продаём (`count` → 10);\n2) сумма = `price * count`;\n3) от 2000 сом — скидка 10%;\n4) в субботу и воскресенье — ещё минус 100 сом, но итог не меньше 0;\n5) каждому третьему (`number`) сначала выведи `Подарок! 🎁`;\n6) выведи итог.',
      vars: { price: [50, 400, 10], count: [1, 14], day: 'day', number: 'number' }, edges: { count: [10, 11] },
      palette: ['if count > 10:', 'total = price * count', 'if total >= 2000:', 'if total < 0:', 'if number % 3 == 0:', 'print(total)'],
      starter: '# price, count, day, number — данные покупателя\n',
      solution: 'if count > 10:\n    count = 10\ntotal = price * count\nif total >= 2000:\n    total -= total // 10\nif day == "суббота" or day == "воскресенье":\n    total -= 100\n    if total < 0:\n        total = 0\nif number % 3 == 0:\n    print("Подарок! 🎁")\nprint(total)' }
  ],
  /* ------------------------------------------------------------------ Сапёр-логика
     rule — код Python: где он ставит mine = True, там мина. Переменные: n (число в клетке),
     row и col (номер строки и столбца, с нуля). range — диапазон чисел на поле. */
  minesweeper: [
    { title: 'Больше 15', range: [1, 30],
      hint: 'Мина — в каждой клетке, где число больше 15. Само 15 — не мина!',
      rule: 'if n > 15:\n    mine = True  # здесь мина' },
    { title: 'Чётные', range: [1, 30],
      hint: '`n % 2 == 0` — остаток от деления на 2 равен нулю, то есть число чётное.',
      rule: 'if n % 2 == 0:\n    mine = True  # здесь мина' },
    { title: 'Кратные трём', range: [1, 30],
      hint: 'Мина там, где число делится на 3 без остатка: 3, 6, 9…',
      rule: 'if n % 3 == 0:\n    mine = True  # здесь мина' },
    { title: 'И то, и другое (and)', range: [1, 30],
      hint: '`and` — должны выполняться оба условия сразу: число больше 10 И меньше 20.',
      rule: 'if n > 10 and n < 20:\n    mine = True  # здесь мина' },
    { title: 'Хотя бы одно (or)', range: [1, 30],
      hint: '`or` — достаточно одного условия: число делится на 3 ИЛИ больше 20.',
      rule: 'if n % 3 == 0 or n > 20:\n    mine = True  # здесь мина' },
    { title: 'Ловушка приоритета', range: [1, 30],
      hint: 'Внимание: `and` выполняется раньше `or`. Это то же самое, что `n < 5 or (n > 25 and n % 2 == 0)`.',
      rule: 'if n < 5 or n > 25 and n % 2 == 0:\n    mine = True  # здесь мина' },
    { title: 'Отрицание (not)', range: [1, 30],
      hint: '`not` переворачивает результат: мина там, где число НЕ чётное.',
      rule: 'if not n % 2 == 0:\n    mine = True  # здесь мина' },
    { title: 'not со скобками', range: [1, 30],
      hint: 'Сначала скобки: «число от 11 до 19». Потом not: мина везде, КРОМЕ этих чисел.',
      rule: 'if not (n > 10 and n < 20):\n    mine = True  # здесь мина' },
    { title: 'Вложенное условие', range: [1, 30],
      hint: 'Внутренний if проверяется, только если выполнено внешнее условие. Мина: больше 10 и нечётное.',
      rule: 'if n > 10:\n    if n % 2 == 1:\n        mine = True  # здесь мина' },
    { title: 'Вложенное с else', range: [1, 30],
      hint: 'Для чётных чисел мина, если число больше 15. Для нечётных — если меньше 8.',
      rule: 'if n % 2 == 0:\n    if n > 15:\n        mine = True  # здесь мина\nelse:\n    if n < 8:\n        mine = True  # здесь мина' },
    { title: 'Шахматная доска', range: [1, 20],
      hint: 'row — номер строки, col — номер столбца (с нуля). `(row + col) % 2 == 0` — «белые» клетки шахматной доски.',
      rule: 'if (row + col) % 2 == 0 and n > 10:\n    mine = True  # здесь мина' },
    { title: 'Под диагональю', range: [1, 30],
      hint: '`row > col` — клетки ниже главной диагонали. В них мина, если число чётное или больше 25.',
      rule: 'if row > col and (n % 2 == 0 or n > 25):\n    mine = True  # здесь мина' }
  ],
  /* ------------------------------------------------------------------ Ты — компьютер
     code — программа с циклом; vars — столбцы таблицы.
     Строки таблицы (значения в конце каждого прохода) вычисляет интерпретатор. */
  tracer: [
    { title: 'Сумма чисел', vars: ['i', 's'],
      story: 'Робот складывает числа от 1 до 4. Что у него в памяти после каждого прохода?',
      code: 's = 0\nfor i in range(1, 5):\n    s += i\nprint(s)' },
    { title: 'Удвоение', vars: ['k', 'x'],
      story: 'Бактерии в пробирке удваиваются каждый час.',
      code: 'x = 1\nfor k in range(5):\n    x = x * 2\nprint(x)' },
    { title: 'Энергия робота', vars: ['energy', 'steps'],
      story: 'Каждый шаг отнимает у робота 3 единицы энергии. Не забудь: while проверяет условие перед каждым проходом.',
      code: 'energy = 10\nsteps = 0\nwhile energy > 0:\n    energy -= 3\n    steps += 1\nprint(steps)' },
    { title: 'Цифры числа', vars: ['n', 's'],
      story: 'Программа складывает цифры числа 472. `n % 10` — последняя цифра, `n // 10` — число без последней цифры.',
      code: 'n = 472\ns = 0\nwhile n > 0:\n    s += n % 10\n    n //= 10\nprint(s)' },
    { title: 'Счётчик чётных', vars: ['i', 'c'],
      story: 'Счётчик увеличивается только для чётных чисел. Следи за условием!',
      code: 'c = 0\nfor i in range(1, 8):\n    if i % 2 == 0:\n        c += 1\nprint(c)' },
    { title: 'Самый тяжёлый рюкзак', vars: ['x', 'mx'],
      story: 'Ищем самый тяжёлый рюкзак (кг). mx меняется, только если нашёлся рюкзак тяжелее.',
      code: 'mx = 0\nfor x in [3, 8, 2, 9, 4]:\n    if x > mx:\n        mx = x\nprint(mx)' },
    { title: 'Кролики Фибоначчи', vars: ['i', 'a', 'b'],
      story: 'Каждое следующее число — сумма двух предыдущих. В строке `a, b = b, a + b` обе правые части считаются до присваивания!',
      code: 'a, b = 0, 1\nfor i in range(5):\n    a, b = b, a + b\nprint(a)' },
    { title: 'Копилка с break', vars: ['i', 's'],
      story: 'Копим монеты 1, 2, 3 … сом, пока в копилке не станет больше 10. break сразу останавливает цикл.',
      code: 's = 0\nfor i in range(1, 10):\n    s += i\n    if s > 10:\n        break\nprint(i, s)' },
    { title: 'Пропуск через continue', vars: ['i', 'p'],
      story: 'Произведение чисел от 1 до 6, но числа, кратные 3, пропускаются. continue переходит к следующему проходу — строка `p *= i` не выполняется.',
      code: 'p = 1\nfor i in range(1, 7):\n    if i % 3 == 0:\n        continue\n    p *= i\nprint(p)' },
    { title: 'Гипотеза Коллатца', vars: ['n', 'steps'],
      story: 'Если число чётное — делим пополам, иначе — умножаем на 3 и прибавляем 1. Повторяем, пока не получится 1.',
      code: 'n = 6\nsteps = 0\nwhile n != 1:\n    if n % 2 == 0:\n        n = n // 2\n    else:\n        n = 3 * n + 1\n    steps += 1\nprint(steps)' }
  ],
  /* ------------------------------------------------------------------ Черепашка
     solution — эталон: по нему рисуется образец; старт выбирается так, чтобы рисунок был в центре.
     colors: true — проверяется и цвет линий; maxLines — строк для звезды; h — начальный угол */
  turtle: [
    {
      title: 'Линия', maxLines: 1,
      hint: 'Проведи линию по образцу. `forward(150)` — проползти 150 шагов вперёд.',
      solution: 'forward(150)'
    },
    {
      title: 'Уголок', maxLines: 3,
      hint: 'Две линии по 100 шагов и поворот между ними. `left(90)` — налево на 90°.',
      solution: 'forward(100)\nleft(90)\nforward(100)'
    },
    {
      title: 'Квадрат', maxLines: 3,
      hint: 'У квадрата 4 одинаковые стороны (по 120) и 4 поворота по 90°. Повтори их в цикле `for`.',
      solution: 'for i in range(4):\n    forward(120)\n    left(90)'
    },
    {
      title: 'Треугольник', maxLines: 3,
      hint: 'Равносторонний треугольник: 3 стороны по 140. Поворот — не 60°, а 120° (внешний угол)!',
      solution: 'for i in range(3):\n    forward(140)\n    left(120)'
    },
    {
      title: 'Шестиугольник', maxLines: 3,
      hint: '6 сторон по 80. Сумма всех поворотов — 360°, значит один поворот 360 / 6.',
      solution: 'for i in range(6):\n    forward(80)\n    left(60)'
    },
    {
      title: 'Звезда', maxLines: 3,
      hint: 'Пятиконечная звезда: 5 линий по 160 и поворот направо на 144°.',
      solution: 'for i in range(5):\n    forward(160)\n    right(144)'
    },
    {
      title: 'Лесенка', maxLines: 5,
      hint: 'Ступенька: вперёд 30, налево, вперёд 30, направо. Ступенек 6.',
      solution: 'for i in range(6):\n    forward(30)\n    left(90)\n    forward(30)\n    right(90)'
    },
    {
      title: 'Пунктир', maxLines: 5,
      hint: 'Штрих 15 шагов, пробел 10 шагов — 10 раз. Для пробела подними перо `pen_up()`, потом опусти `pen_down()`.',
      solution: 'for i in range(10):\n    forward(15)\n    pen_up()\n    forward(10)\n    pen_down()'
    },
    {
      title: 'Цветной квадрат', maxLines: 7, colors: true,
      hint: 'Стороны квадрата (по 120) чередуются: красная, синяя, красная, синяя. Если i чётное — `color("red")`, иначе — `color("blue")`.',
      solution: 'for i in range(4):\n    if i % 2 == 0:\n        color("red")\n    else:\n        color("blue")\n    forward(120)\n    left(90)'
    },
    {
      title: 'Каждая чётная — красная', maxLines: 10, colors: true,
      hint: 'Зигзаг из 10 линий по 30. Линии с чётным i — красные и после них поворот налево, с нечётным — чёрные и поворот направо.',
      solution: 'for i in range(10):\n    if i % 2 == 0:\n        color("red")\n    else:\n        color("black")\n    forward(30)\n    if i % 2 == 0:\n        left(90)\n    else:\n        right(90)'
    },
    {
      title: 'Спираль', maxLines: 3,
      hint: 'Каждая следующая линия длиннее: 8, 16, 24 … 160. Длину можно вычислить из переменной цикла: `forward(i * 8)`.',
      solution: 'for i in range(1, 21):\n    forward(i * 8)\n    left(90)'
    },
    {
      title: 'Цветок из квадратов', maxLines: 5,
      hint: '8 квадратов со стороной 60. После каждого квадрата черепашка поворачивается на 45°. Цикл в цикле!',
      solution: 'for i in range(8):\n    for j in range(4):\n        forward(60)\n        left(90)\n    left(45)'
    },
    {
      title: 'Все многоугольники', maxLines: 4,
      hint: 'Треугольник, квадрат, … семиугольник — стороны по 50, все из одной точки. Внешний цикл по n от 3 до 7, поворот 360 / n.',
      solution: 'for n in range(3, 8):\n    for i in range(n):\n        forward(50)\n        left(360 / n)'
    },
    {
      title: 'Квадратная спираль (while)', maxLines: 5,
      hint: 'Длина начинается с 5 и растёт на 10, пока она меньше 150. Используй переменную и цикл `while`.',
      solution: 'length = 5\nwhile length < 150:\n    forward(length)\n    left(90)\n    length += 10'
    },
    {
      title: 'Звёздная гирлянда', maxLines: 11, colors: true,
      hint: '4 звезды (5 лучей по 50, поворот направо на 144°), цвета чередуются: оранжевая, фиолетовая… Между звёздами — 70 шагов без следа.',
      solution: 'for k in range(4):\n    if k % 2 == 0:\n        color("orange")\n    else:\n        color("purple")\n    for i in range(5):\n        forward(50)\n        right(144)\n    pen_up()\n    forward(70)\n    pen_down()'
    }
  ],
  /* ------------------------------------------------------------------ Робот
     map: 8 строк по 8 символов: # стена, . пусто, R робот, $ монета, O яма, F финиш
     dir: куда смотрит робот (N, E, S, W); maxLines — строк для третьей звезды
     random: 'corridor' | 'snake' | 'lanes' | 'maze' — карта генерируется при каждом запуске */
  robot: [
    {
      title: 'Первые шаги', dir: 'E', maxLines: 4, allowed: ROBOT_CMD,
      hint: 'Доведи робота до флажка. Команда `forward()` — один шаг вперёд.',
      starter: '# Напиши команды робота здесь\n',
      map: ['........', '........', '........', '.R...F..', '........', '........', '........', '........'],
      solution: 'forward()\nforward()\nforward()\nforward()'
    },
    {
      title: 'Поворот', dir: 'N', maxLines: 9, allowed: ROBOT_CMD,
      hint: 'Робот смотрит вверх. `right()` поворачивает его направо на месте (шаг не делается).',
      map: ['........', '........', '.....F..', '........', '........', '........', '.R......', '........'],
      solution: 'forward()\nforward()\nforward()\nforward()\nright()\nforward()\nforward()\nforward()\nforward()'
    },
    {
      title: 'Монетка', dir: 'E', maxLines: 6, allowed: ROBOT_CMD,
      hint: 'По дороге лежит монета 🪙. Встань на её клетку и выполни `take()`.',
      map: ['........', '........', '........', '........', '.R.$..F.', '........', '........', '........'],
      solution: 'forward()\nforward()\ntake()\nforward()\nforward()\nforward()'
    },
    {
      title: 'Обход стены', dir: 'E', maxLines: 10, allowed: ROBOT_CMD,
      hint: 'Стену не пройти насквозь — обойди её сверху. `left()` — поворот налево.',
      map: ['........', '........', '........', '........', '.R..#.F.', '....#...', '....#...', '....#...'],
      solution: 'forward()\nforward()\nleft()\nforward()\nright()\nforward()\nforward()\nforward()\nright()\nforward()'
    },
    {
      title: 'Длинный коридор', dir: 'E', maxLines: 2, allowed: ROBOT_FOR,
      hint: 'Семь раз `forward()`? Слишком длинно! Цикл `for i in range(7):` повторит команду 7 раз.',
      map: ['........', '........', '########', 'R......F', '########', '........', '........', '........'],
      solution: 'for i in range(7):\n    forward()'
    },
    {
      title: 'Лесенка', dir: 'E', maxLines: 5, allowed: ROBOT_FOR,
      hint: 'Каждая ступенька — это шаг вперёд, поворот налево, шаг, поворот направо. Повтори ступеньку в цикле.',
      map: ['#######.', '######F.', '#####...', '####....', '###.....', '##......', '#.......', 'R.......'],
      solution: 'for i in range(6):\n    forward()\n    left()\n    forward()\n    right()'
    },
    {
      title: 'Монеты в ряд', dir: 'E', maxLines: 4, allowed: ROBOT_FOR,
      hint: 'На каждой клетке монета. В теле цикла может быть несколько команд — и шаг, и `take()`.',
      map: ['........', '........', 'R$$$$$$F', '........', '........', '........', '........', '........'],
      solution: 'for i in range(6):\n    forward()\n    take()\nforward()'
    },
    {
      title: 'Квадрат', dir: 'E', maxLines: 7, allowed: ROBOT_FOR,
      hint: 'Три стороны квадрата по 5 шагов, в каждом углу монета. Цикл внутри цикла — отступ 8 пробелов.',
      map: ['........', '.R....$.', '..####..', '..####..', '.F####..', '..####..', '.$....$.', '........'],
      solution: 'for i in range(3):\n    for j in range(5):\n        forward()\n    take()\n    right()\nforward()\nforward()'
    },
    {
      title: 'Где монеты?', dir: 'E', maxLines: 4, allowed: ROBOT_IF,
      hint: 'Монеты лежат не везде. Датчик `coin_here()` отвечает True, если под роботом монета.',
      map: ['........', '........', '........', '........', 'R.$$.$.F', '........', '........', '........'],
      solution: 'for i in range(7):\n    forward()\n    if coin_here():\n        take()'
    },
    {
      title: 'Стена впереди', dir: 'E', maxLines: 5, allowed: ROBOT_IF,
      hint: 'Если впереди стена — поворачивай направо, иначе — шагай. 10 повторов хватит.',
      map: ['R.....#.', '........', '........', '........', '.....F..', '........', '........', '........'],
      solution: 'for i in range(10):\n    if wall_ahead():\n        right()\n    else:\n        forward()'
    },
    {
      title: 'Осторожно, ямы!', dir: 'E', maxLines: 6, allowed: ROBOT_IF,
      hint: 'Если впереди яма 🕳 — объезжай её: направо, шаг, налево. А потом в любом случае шаг вперёд.',
      map: ['........', '........', '........', 'R..O....', '......O.', '.......F', '........', '........'],
      solution: 'for i in range(7):\n    if hole_ahead():\n        right()\n        forward()\n        left()\n    forward()'
    },
    {
      title: 'По краю поля', dir: 'E', maxLines: 7, allowed: ROBOT_IF,
      hint: 'Два условия в одном цикле: сначала подбери монету, если она есть, потом решай — шагать или поворачивать. Хватит 15 повторов.',
      map: ['R..$....', '.######.', '.######$', '.######.', '.######.', '.######$', '.######.', '.......F'],
      solution: 'for i in range(15):\n    if coin_here():\n        take()\n    if wall_ahead():\n        right()\n    else:\n        forward()'
    },
    {
      title: 'Пока не финиш', dir: 'N', maxLines: 2, allowed: ROBOT_WHILE,
      hint: 'Не хочешь считать клетки? `while not at_finish():` повторяет тело, пока робот не на флажке.',
      map: ['..#F#...', '..#.#...', '..#.#...', '..#.#...', '..#.#...', '..#.#...', '..#.#...', '..#R#...'],
      solution: 'while not at_finish():\n    forward()'
    },
    {
      title: 'До стены и вверх', dir: 'E', maxLines: 5, allowed: ROBOT_WHILE,
      hint: 'Иди, пока впереди нет стены. Потом поверни налево и иди до флажка. Два цикла while подряд.',
      map: ['........', '....F...', '........', '........', '........', '........', 'R....#..', '........'],
      solution: 'while not wall_ahead():\n    forward()\nleft()\nwhile not at_finish():\n    forward()'
    },
    {
      title: 'Собери всё', dir: 'E', maxLines: 4, allowed: ROBOT_WHILE,
      hint: 'while и if вместе: иди до финиша и подбирай монеты по пути.',
      map: ['........', '........', '........', 'R$$.$$.F', '........', '........', '........', '........'],
      solution: 'while not at_finish():\n    forward()\n    if coin_here():\n        take()'
    },
    {
      title: 'Спираль', dir: 'E', maxLines: 7, allowed: ROBOT_WHILE,
      hint: 'Спираль закручивается вправо. Правило простое: монета — возьми, стена впереди — направо, иначе — шаг.',
      map: ['R..$....', '#######.', '...$..#.', '..#.....', '....F..$', '.#..$...', '.....#..', '...$....'],
      solution: 'while not at_finish():\n    if coin_here():\n        take()\n    if wall_ahead():\n        right()\n    else:\n        forward()'
    },
    {
      title: '🎲 Случайный коридор', maxLines: 4, allowed: ROBOT_WHILE, random: 'corridor',
      hint: 'Карта меняется при каждом запуске: длина коридора и монеты всегда разные. Программа должна работать на любой карте!',
      solution: 'while not at_finish():\n    forward()\n    if coin_here():\n        take()'
    },
    {
      title: '🎲 Извилистая тропа', maxLines: 8, allowed: ROBOT_WHILE, random: 'snake',
      hint: 'Тропа поворачивает то направо, то налево. Упёрся в стену — попробуй повернуть направо. Если и там стена — значит, нужно налево (два раза left() от правого поворота).',
      solution: 'while not at_finish():\n    if wall_ahead():\n        right()\n        if wall_ahead():\n            left()\n            left()\n    else:\n        forward()'
    },
    {
      title: '🎲 Две полосы', maxLines: 15, allowed: ROBOT_WHILE.concat(['lane = 0', 'if lane == 0:']), random: 'lanes',
      hint: 'Ямы на двух полосах. Перед ямой перестраивайся в другую полосу. Чтобы знать, где ты, заведи переменную `lane` (0 — верхняя, 1 — нижняя).',
      solution: 'lane = 0\nwhile not at_finish():\n    if hole_ahead():\n        if lane == 0:\n            right()\n            forward()\n            left()\n            lane = 1\n        else:\n            left()\n            forward()\n            right()\n            lane = 0\n    else:\n        forward()'
    },
    {
      title: '🎲 Настоящий лабиринт', maxLines: 5, allowed: ROBOT_WHILE.concat(['while wall_ahead():']), random: 'maze',
      hint: 'Правило правой руки: на каждом шаге поверни направо, а пока впереди стена — поворачивай налево. Потом шаг. Так проходится любой лабиринт без колец!',
      solution: 'while not at_finish():\n    right()\n    while wall_ahead():\n        left()\n    forward()'
    }
  ]
};
