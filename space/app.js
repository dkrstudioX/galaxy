// СГЕНЕРИРОВАНО build.py — не редактировать вручную, править js/*.js и пересобрать.
// Без модулей, чтобы страница открывалась как file:// без сервера.

// ===== config.js =====
// =============================================================================
// config.js — все константы приложения в одном месте.
// Ничего не вычисляет и ничего не импортирует: чистые числа и настройки.
// =============================================================================

// --- Симуляционное время ------------------------------------------------------
// Эпоха J2000 (2000-01-01 12:00 UTC). simDays — сутки, прошедшие с этой эпохи,
// дробные. От этого же значения считаются углы планет, поэтому счётчик дней
// и движение по орбитам всегда согласованы: угол = L0 + 360° * simDays / период.
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const MS_PER_DAY = 86400000;

// --- Зум -----------------------------------------------------------------------
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 20;

// --- Скорость симуляции ----------------------------------------------------------
// 1x = реальное время (1 секунда экрана = 1 секунда симуляции).
// «Быстрее»/«Медленнее» меняют множитель с шагом x2 / :2, «Нормально» возвращает 1x.
const MIN_SPEED = 1 / 1024;
const MAX_SPEED = 1048576; // хватает, чтобы при 1x увидеть движение планет

// --- Солнце ----------------------------------------------------------------------
const SUN_R = 22; // радиус отрисовки солнца (условные единицы мира)

// --- Стили монохромной карты -------------------------------------------------------
// Карта намеренно монохромная: тела различаются только яркостью и толщиной обводки.
const COLORS = {
    sun: '#eeeeee',
    sunStroke: '#ffffff',
    planet: '#c9c9c9',
    planetStroke: '#efefef',
    moon: '#a8a8a8',
    moonStroke: '#d6d6d6',
    base: '#00ffff', // функциональный маркер базы, не декор
    tooltip: '#ffffff',
    tooltipShadow: 'rgba(0,0,0,0.6)',
    orbitPlanet: 'rgba(120,140,200,0.6)',
    orbitMoon: 'rgba(150,160,180,0.6)'
};

// Толщина обводок в пикселях экрана (делим на zoom при отрисовке).
// Солнце — самая толстая, планеты тоньше, луны — самые тонкие.
const STROKE = {
    sun: 2.5,
    planet: 1.2,
    moon: 0.7
};

// ===== math.js =====
// =============================================================================
// math.js — чистые функции: астрономическая математика и форматирование.
// Не знают ни о канвасе, ни о состоянии — легко тестировать и переиспользовать.
// =============================================================================



/**
 * Угол тела на круговой орбите из симуляционного времени.
 * Формула средней долготы: L = L0 + 360° * t / T, против часовой стрелки
 * (как видно с севера эклиптики).
 * @param {number} l0     средняя долгота на J2000, градусы
 * @param {number} period сидерический период, сутки
 * @param {number} t      симуляционное время, сутки от J2000
 * @returns {number} угол в радианах
 */
function orbitAngle(l0, period, t) {
    return (l0 + 360 * t / period) * Math.PI / 180;
}

/**
 * Симуляционные сутки -> строка даты «YYYY-MM-DD HH:MM» (UTC).
 * @param {number} t сутки от J2000
 */
function formatSimDate(t) {
    const d = new Date(J2000_MS + t * MS_PER_DAY);
    const p = n => String(n).padStart(2, '0');
    return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) +
           ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
}

/** Ограничить значение диапазоном [min, max]. */
function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

/**
 * Экранные координаты -> мировые (учитывает камеру и зум).
 * @returns {{x: number, y: number}}
 */
function screenToWorld(sx, sy, state) {
    return {
        x: state.camX + (sx - state.W / 2) / state.zoom,
        y: state.camY + (sy - state.H / 2) / state.zoom
    };
}

// ===== data.js =====
// =============================================================================
// data.js — астрономические данные: планеты, луны, база.
// Только данные, никакой логики. Периоды сидерические (сутки), долготы L0
// средние на эпоху J2000 (градусы) — отсюда реалистичные взаимные положения.
// =============================================================================

// Планеты. r и dist — условные единицы мира (не в масштабе, но порядок верный).
// hasBase — вокруг этой планеты крутится Луна с игровой базой (Земля).
// rings — рисовать кольца (Сатурн). type оставлен для совместимости.
const planets = [
    { name: 'Mercury', color: '#b5b5b5', r: 4,  dist: 70,  period: 87.969,   l0: 252.251, type: 'rocky' },
    { name: 'Venus',   color: '#e8cda0', r: 7,  dist: 110, period: 224.701,  l0: 181.980, type: 'rocky' },
    { name: 'Earth',   color: '#4488ff', r: 8,  dist: 160, period: 365.256,  l0: 100.464, type: 'earth', hasBase: true },
    { name: 'Mars',    color: '#c1440e', r: 5,  dist: 220, period: 686.980,  l0: 355.453, type: 'rocky' },
    { name: 'Jupiter', color: '#c88b3a', r: 22, dist: 380, period: 4332.589, l0: 34.396,  type: 'gas' },
    { name: 'Saturn',  color: '#e8d191', r: 18, dist: 520, period: 10759.22, l0: 49.954,  type: 'gas', rings: true },
    { name: 'Uranus',  color: '#7de8e8', r: 12, dist: 660, period: 30685.4,  l0: 313.238, type: 'ice' },
    { name: 'Neptune', color: '#3f54ba', r: 12, dist: 780, period: 60189.0,  l0: 304.880, type: 'ice' }
];

// Луна Земли: сидерический период 27.32 суток. База делает виток за условные 1 сутки.
const moonDist = 22;          // радиус орбиты Луны от Земли
const moonPeriod = 27.321661; // суток
const moonL0 = 218.32;        // средняя долгота на J2000, градусы
const baseOrbitRadius = 10;   // радиус орбиты базы вокруг Луны
const basePeriod = 1;         // суток на виток

// Главные луны других планет: период (сутки), радиус отрисовки r, цвет c,
// стартовая фаза phase (градусы, произвольная). Порядок = порядок раскрытия
// при зуме (см. scene.js visibleMoons): первыми показываются главные луны,
// при росте зума добавляются всё более мелкие/дальних.
const moonsByPlanet = {
    Mars: [
        { n: 'Phobos',   period: 0.3189, r: 1.5, c: '#9c8f84', phase: 40 },
        { n: 'Deimos',   period: 1.2624, r: 1.3, c: '#b3a89e', phase: 150 }
    ],
    Jupiter: [
        { n: 'Io',       period: 1.769,  r: 2.3, c: '#d8c26a', phase: 70 },
        { n: 'Europa',   period: 3.551,  r: 2.0, c: '#cbb8a0', phase: 190 },
        { n: 'Ganymede', period: 7.155,  r: 2.7, c: '#9a8f85', phase: 300 },
        { n: 'Callisto', period: 16.689, r: 2.5, c: '#7d746c', phase: 20 },
        { n: 'Amalthea', period: 0.498,  r: 1.2, c: '#b06a4a', phase: 130 },
        { n: 'Himalia',  period: 250.6,  r: 1.2, c: '#8a8078', phase: 45 }
    ],
    Saturn: [
        { n: 'Mimas',    period: 0.942,  r: 1.5, c: '#b8bcc2', phase: 110 },
        { n: 'Enceladus',period: 1.370,  r: 1.7, c: '#d9dee3', phase: 250 },
        { n: 'Rhea',     period: 4.518,  r: 1.9, c: '#a8adb5', phase: 330 },
        { n: 'Titan',    period: 15.945, r: 2.9, c: '#c79b5a', phase: 80 },
        { n: 'Dione',    period: 2.737,  r: 1.6, c: '#c2c7cd', phase: 15 },
        { n: 'Tethys',   period: 1.888,  r: 1.6, c: '#ccd1d6', phase: 200 },
        { n: 'Iapetus',  period: 79.32,  r: 1.7, c: '#8f8478', phase: 300 }
    ],
    Uranus: [
        { n: 'Miranda',  period: 1.413,  r: 1.4, c: '#a9b3b8', phase: 210 },
        { n: 'Ariel',    period: 2.520,  r: 1.7, c: '#b6c0c4', phase: 20 },
        { n: 'Umbriel',  period: 4.144,  r: 1.5, c: '#7e888d', phase: 95 },
        { n: 'Titania',  period: 8.706,  r: 2.1, c: '#9aa5ab', phase: 140 },
        { n: 'Oberon',   period: 13.463, r: 2.0, c: '#8b969c', phase: 260 },
        { n: 'Puck',     period: 0.762,  r: 1.1, c: '#9c9a94', phase: 175 }
    ],
    Neptune: [
        { n: 'Proteus',  period: 1.122,  r: 1.5, c: '#8f9aa3', phase: 310 },
        { n: 'Triton',   period: 5.877,  r: 2.3, c: '#c3cdd4', phase: 100 },
        { n: 'Nereid',   period: 360.1,  r: 1.2, c: '#9aa2ab', phase: 220 }
    ]
};

// Данные для боковой панели «ЛУНЫ СИСТЕМЫ»: имя + период для показа.
const moonTree = {
    Mercury: [],
    Venus:   [],
    Earth:   [['Луна / Moon', '27.32 d']],
    Mars:    [['Phobos', '0.32 d'], ['Deimos', '1.26 d']],
    Jupiter: [['Io', '1.77 d'], ['Europa', '3.55 d'], ['Ganymede', '7.15 d'], ['Callisto', '16.69 d']],
    Saturn:  [['Mimas', '0.94 d'], ['Enceladus', '1.37 d'], ['Rhea', '4.52 d'], ['Titan', '15.95 d']],
    Uranus:  [['Miranda', '1.41 d'], ['Ariel', '2.52 d'], ['Titania', '8.71 d'], ['Oberon', '13.46 d']],
    Neptune: [['Proteus', '1.12 d'], ['Triton', '5.88 d']]
};

// Известное общее число лун у каждой планеты (для счётчика «☾ N» в панели).
const moonTotals = { Mercury: 0, Venus: 0, Earth: 1, Mars: 2, Jupiter: 95, Saturn: 146, Uranus: 28, Neptune: 16 };

// ===== state.js =====
// =============================================================================
// state.js — единое изменяемое состояние приложения.
// Один мутируемый объект вместо пачки глобальных let: модули импортируют
// state и читают/пишут поля. Живые биндинги не нужны, всё явно.
// =============================================================================



const state = {
    // --- Камера -----------------------------------------------------------
    camX: 0,        // центр экрана в мировых координатах
    camY: 0,
    zoom: 1,        // 1.0 = весь внутренний пояс виден целиком

    // --- Время --------------------------------------------------------------
    // старт симуляции с реальной текущей даты
    simDays: (Date.now() - J2000_MS) / MS_PER_DAY,
    startSimDays: (Date.now() - J2000_MS) / MS_PER_DAY,
    timeScale: 1,   // множитель скорости симуляции
    time: 0,        // «экранное» время в секундах (для мерцаний/пульсов)

    // --- Мышь (для hover-подсказок) -------------------------------------------
    mouseX: -1,     // -1 = курсора нет на канвасе
    mouseY: -1,

    // --- Канвас ---------------------------------------------------------------
    W: 0,           // размеры канваса в пикселях (обновляет resize())
    H: 0
};

// Пересчитать размеры канваса под окно. Вызывается на старте и при resize.
function resize(canvas) {
    state.W = canvas.width = window.innerWidth;
    state.H = canvas.height = window.innerHeight;
}

// ===== scene.js =====
// =============================================================================
// scene.js — генерация фона сцены (звёзды, астероиды) и правило раскрытия лун.
// Позиции тел планет здесь не считаются — это делает render.js каждый кадр.
// =============================================================================



// --- Звёзды фона --------------------------------------------------------------
// 400 точек, разбросанных по большому квадрату вокруг солнца. Мерцают синусом
// с индивидуальной фазой b (см. render.js).
const stars = [];
for (let i = 0; i < 400; i++) {
    stars.push({
        x: (Math.random() - 0.5) * 4000,
        y: (Math.random() - 0.5) * 4000,
        s: Math.random() * 1.5,   // размер в пикселях мира
        b: Math.random()          // фаза мерцания
    });
}

// --- Пояс астероидов ------------------------------------------------------------
// Кольцо точек между орбитами Марса (dist 220) и Юпитера (dist 380).
const asteroids = [];
for (let i = 0; i < 400; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 270 + Math.random() * 80;
    asteroids.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, s: 0.5 + Math.random() * 1.5 });
}

/**
 * Сколько лун планеты показывать при текущем зуме (Земля с Луной — отдельный
 * случай hasBase). Логарифмическая шкала: 1 луна при zoom=1, далее +1 за каждый
 * множитель MOON_ZOOM_STEP (~1.4). К MAX_ZOOM показываются все луны участка.
 * Вызывающий код дополнительно ограничивает количеством лун конкретной планеты.
 * @returns {number}
 */
function visibleMoons() {
    if (state.zoom < 1.0) return 0;
    const MOON_ZOOM_STEP = 1.4;
    return 1 + Math.floor(Math.log(state.zoom) / Math.log(MOON_ZOOM_STEP));
}

// ===== render.js =====
// =============================================================================
// render.js — отрисовка сцены на канвас: фон, солнце, планеты, луны, база.
// Монохромный стиль: все тела — плоские круги, различаются яркостью заливки
// и толщиной обводки (солнце > планеты > луны). Орбит на карте нет — их рисует
// hover.js только при наведении.
//
// Возвращает массив hoverTargets — позиции всех тел для hit-теста наведения.
// =============================================================================







/**
 * Нарисовать один кадр мира в мировой системе координат (save/restore внутри).
 * @param {CanvasRenderingContext2D} ctx
 * @returns {Array} hoverTargets для hover.js
 */
function renderScene(ctx) {
    const { zoom, simDays, time } = state;
    const hoverTargets = [];

    // Мировая система координат: центр экрана -> камера -> зум.
    ctx.save();
    ctx.translate(state.W / 2, state.H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-state.camX, -state.camY);

    drawStars(ctx, time);
    drawGrid(ctx);
    drawAsteroids(ctx);

    // Солнце — первая hover-цель (проверяется последней, т.к. планеты поверх)
    drawSun(ctx);
    hoverTargets.push({ kind: 'sun', name: 'Солнце / Sun', x: 0, y: 0, r: SUN_R, moons: [] });

    // === ПЛАНЕТЫ ===
    planets.forEach(p => {
        // Угол строго из simDays: движение по орбите и счётчик дней — один таймер.
        // y с минусом: против часовой, как видно с севера эклиптики.
        const ang = orbitAngle(p.l0, p.period, simDays);
        const x = Math.cos(ang) * p.dist;
        const y = -Math.sin(ang) * p.dist;

        if (p.rings) drawRings(ctx, x, y, p);

        drawPlanetBody(ctx, x, y, p.r);

        const moonHits = drawPlanetMoons(ctx, x, y, p);

        // Луна Земли + орбитальная база — особый случай (hasBase у Земли)
        if (p.hasBase) {
            const hit = drawEarthMoonAndBase(ctx, x, y);
            if (hit) moonHits.push(hit);
        }

        hoverTargets.push({ kind: 'planet', p, x, y, moons: moonHits });
    });

    ctx.restore();
    return hoverTargets;
}

// --- Фон -----------------------------------------------------------------------

/** Звёзды: мерцание синусом с индивидуальной фазой каждой звезды. */
function drawStars(ctx, time) {
    stars.forEach(s => {
        const twinkle = 0.5 + 0.5 * Math.sin(time * 2 + s.b * 10);
        ctx.fillStyle = `rgba(255,255,255,${0.3 + twinkle * 0.7})`;
        ctx.fillRect(s.x, s.y, s.s, s.s);
    });
}

/** Едва заметная полярная сетка из 20 колец радиусами 50..1000. */
function drawGrid(ctx) {
    ctx.strokeStyle = '#0f0f1a';
    ctx.lineWidth = 1 / state.zoom;
    for (let i = 1; i <= 20; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, i * 50, 0, Math.PI * 2);
        ctx.stroke();
    }
}

/** Пояс астероидов между Марсом и Юпитером. */
function drawAsteroids(ctx) {
    ctx.fillStyle = '#666';
    asteroids.forEach(a => {
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.s, 0, Math.PI * 2);
        ctx.fill();
    });
}

// --- Тела ----------------------------------------------------------------------

/** Солнце: плоский круг с самой толстой обводкой. */
function drawSun(ctx) {
    const z = state.zoom;
    ctx.fillStyle = COLORS.sun;
    circle(ctx, 0, 0, SUN_R);
    ctx.fill();

    ctx.strokeStyle = COLORS.sunStroke;
    ctx.lineWidth = STROKE.sun / z;
    circle(ctx, 0, 0, SUN_R);
    ctx.stroke();
}

/** Планета: плоский серый круг, обводка тоньше солнечной. */
function drawPlanetBody(ctx, x, y, r) {
    const z = state.zoom;
    ctx.fillStyle = COLORS.planet;
    circle(ctx, x, y, r);
    ctx.fill();

    ctx.strokeStyle = COLORS.planetStroke;
    ctx.lineWidth = STROKE.planet / z;
    circle(ctx, x, y, r);
    ctx.stroke();
}

/** Кольца Сатурна: два сплюснутых эллипса под наклоном. */
function drawRings(ctx, x, y, p) {
    const z = state.zoom;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.4);
    ctx.scale(1, 0.3);

    ctx.strokeStyle = 'rgba(200,200,200,0.35)';
    ctx.lineWidth = 4 / z;
    circle(ctx, 0, 0, p.r * 2.2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(220,220,220,0.5)';
    ctx.lineWidth = 3 / z;
    circle(ctx, 0, 0, p.r * 1.7);
    ctx.stroke();

    ctx.restore();
}

/** Луна: плоский серый круг с самой тонкой обводкой. */
function drawMoonBody(ctx, x, y, r) {
    const z = state.zoom;
    ctx.fillStyle = COLORS.moon;
    circle(ctx, x, y, r);
    ctx.fill();

    ctx.strokeStyle = COLORS.moonStroke;
    ctx.lineWidth = STROKE.moon / z;
    circle(ctx, x, y, r);
    ctx.stroke();
}

/**
 * Луны планеты из moonsByPlanet. Количество растёт с зумом (visibleMoons),
 * радиус орбиты каждой следующей луны дальше от планеты.
 * @returns {Array} хиты для hover: { m, md, mx, my }
 */
function drawPlanetMoons(ctx, x, y, p) {
    const { simDays } = state;
    const pmoons = moonsByPlanet[p.name] || [];
    const shown = Math.min(visibleMoons(), pmoons.length);
    const hits = [];

    for (let i = 0; i < shown; i++) {
        const m = pmoons[i];
        const md = p.r + 12 + i * 7; // радиус орбиты луны от планеты
        const mAng = orbitAngle(m.phase, m.period, simDays);
        const mx = x + Math.cos(mAng) * md;
        const my = y - Math.sin(mAng) * md;

        drawMoonBody(ctx, mx, my, m.r);
        hits.push({ m, md, mx, my });
    }
    return hits;
}

/**
 * Луна Земли + орбитальная база игрока. База — циановый маркер с пульсом
 * и подписью BASE; её орбита вокруг Луны показывается всегда (это не орбиты
 * планет, которые скрыты до наведения).
 * @returns {{m, md, mx, my}} хит Луны для hover
 */
function drawEarthMoonAndBase(ctx, x, y) {
    const { zoom: z, simDays, time } = state;

    const mAng = orbitAngle(moonL0, moonPeriod, simDays);
    const mx = x + Math.cos(mAng) * moonDist;
    const my = y - Math.sin(mAng) * moonDist;

    drawMoonBody(ctx, mx, my, 3);

    // орбита базы вокруг Луны — мелкий пунктир
    const bAng = orbitAngle(0, basePeriod, simDays);
    const bx = mx + Math.cos(bAng) * baseOrbitRadius;
    const by = my - Math.sin(bAng) * baseOrbitRadius;

    ctx.strokeStyle = '#00ffff44';
    ctx.lineWidth = 0.5 / z;
    ctx.setLineDash([1 / z, 1 / z]);
    circle(ctx, mx, my, baseOrbitRadius);
    ctx.stroke();
    ctx.setLineDash([]);

    // маркер базы: свечение, квадрат, пульсирующее кольцо, подпись
    const bs = 4 / z;

    const baseGlow = ctx.createRadialGradient(bx, by, 0, bx, by, bs * 2);
    baseGlow.addColorStop(0, 'rgba(0,255,255,0.6)');
    baseGlow.addColorStop(1, 'rgba(0,255,255,0)');
    ctx.fillStyle = baseGlow;
    circle(ctx, bx, by, bs * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.base;
    ctx.fillRect(bx - bs / 2, by - bs / 2, bs, bs);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1 / z;
    ctx.strokeRect(bx - bs / 2, by - bs / 2, bs, bs);

    const pulse = (Math.sin(time * 4) + 1) * 0.5;
    ctx.strokeStyle = `rgba(0,255,255,${0.5 - pulse * 0.5})`;
    ctx.lineWidth = 1 / z;
    circle(ctx, bx, by, bs + pulse * 4);
    ctx.stroke();

    ctx.fillStyle = COLORS.base;
    ctx.font = `bold ${Math.max(9, 10 / z)}px monospace`;
    ctx.fillText('BASE', bx + bs + 3 / z, by - 3 / z);

    return { m: { n: 'Луна / Moon', r: 3 }, md: moonDist, mx, my };
}

/** Начать путь-окружность (без fill/stroke — их выбирает вызывающий). */
function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
}

// ===== hover.js =====
// =============================================================================
// hover.js — наведение курсора: hit-тест по телам, орбита наведённого тела
// и текстовая подсказка с названием (просто текст без рамки).
// Вызывается из main.js ПОСЛЕ renderScene и уже вне мирового transform.
// =============================================================================





/** Минимальный радиус попадания в пикселях экрана — чтобы легко попадать в мелкие луны. */
const MIN_HIT_MOON_PX = 6;
const MIN_HIT_PLANET_PX = 8;

/**
 * Найти тело под курсором и нарисовать его орбиту + подсказку.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} hoverTargets — результат renderScene() этого кадра
 */
function drawHover(ctx, hoverTargets) {
    const { mouseX, mouseY } = state;
    if (mouseX < 0) return;

    const hover = hitTest(hoverTargets, mouseX, mouseY);
    if (!hover) return;

    // орбита наведённого тела (у солнца орбиты нет)
    if (hover.orbit) {
        drawOrbitOverlay(ctx, hover);
    }
    drawTooltip(ctx, hover.name, mouseX, mouseY);
}

/**
 * Hit-тест: перебираем цели с конца (планеты добавлены после солнца, луны
 * проверяются первыми — они мельче и лежат поверх).
 * @returns {?{kind: string, name: string, orbit: ?{cx, cy, r}}}
 */
function hitTest(hoverTargets, mouseX, mouseY) {
    const w = screenToWorld(mouseX, mouseY, state);

    for (let i = hoverTargets.length - 1; i >= 0; i--) {
        const t = hoverTargets[i];

        for (let j = t.moons.length - 1; j >= 0; j--) {
            const mh = t.moons[j];
            const hitR = Math.max(mh.m.r, MIN_HIT_MOON_PX / state.zoom);
            if ((w.x - mh.mx) ** 2 + (w.y - mh.my) ** 2 <= hitR * hitR) {
                // луна: орбита вокруг своей планеты
                return { kind: 'moon', name: mh.m.n, orbit: { cx: t.x, cy: t.y, r: mh.md } };
            }
        }

        const name = t.name || t.p.name;
        const bodyR = t.r || t.p.r;
        const hitR = Math.max(bodyR, MIN_HIT_PLANET_PX / state.zoom);
        if ((w.x - t.x) ** 2 + (w.y - t.y) ** 2 <= hitR * hitR) {
            // планета: орбита вокруг солнца; у самого солнца орбиты нет
            const orbit = t.kind === 'sun' ? null : { cx: 0, cy: 0, r: t.p.dist };
            return { kind: t.kind, name, orbit };
        }
    }
    return null;
}

/** Пунктирная орбита наведённого тела в мировой системе координат. */
function drawOrbitOverlay(ctx, hover) {
    const { zoom, camX, camY, W, H } = state;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    ctx.strokeStyle = hover.kind === 'planet' ? COLORS.orbitPlanet : COLORS.orbitMoon;
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.beginPath();
    ctx.arc(hover.orbit.cx, hover.orbit.cy, hover.orbit.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
}

/** Подсказка у курсора: белый текст с тенью смещённой на 1px, без рамки. */
function drawTooltip(ctx, name, mouseX, mouseY) {
    const { W } = state;

    ctx.font = '12px monospace';
    const tw = ctx.measureText(name).width;
    const tx = Math.min(mouseX + 14, W - tw - 20); // не выезжать за правый край
    const ty = Math.max(mouseY - 24, 8);           // не выезжать за верх

    ctx.fillStyle = COLORS.tooltipShadow;
    ctx.fillText(name, tx + 1, ty + 11);
    ctx.fillStyle = COLORS.tooltip;
    ctx.fillText(name, tx, ty + 10);
}

// ===== input.js =====
// =============================================================================
// input.js — всё пользовательское управление: тач, колесо мыши, панорамирование
// правой кнопкой, позиция курсора для hover, кнопки скорости времени.
// Только меняет state, ничего не рисует.
// =============================================================================





/** Прицепить все обработчики ввода к канвасу и кнопкам. Вызывается один раз. */
function initInput(canvas, ui) {
    // === ТАЧ: перетаскивание одним пальцем, pinch-зум двумя ===
    let touch1 = null, touch2 = null;
    let lastDist = 0, lastZoom = 1;
    let isDragging = false, dragStartX = 0, dragStartY = 0, camStartX = 0, camStartY = 0;

    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        const touches = e.touches;
        if (touches.length === 1) {
            touch1 = touches[0];
            isDragging = true;
            dragStartX = touch1.clientX;
            dragStartY = touch1.clientY;
            camStartX = state.camX;
            camStartY = state.camY;
        } else if (touches.length === 2) {
            touch1 = touches[0]; touch2 = touches[1];
            isDragging = false;
            const dx = touch2.clientX - touch1.clientX;
            const dy = touch2.clientY - touch1.clientY;
            lastDist = Math.sqrt(dx * dx + dy * dy);
            lastZoom = state.zoom;
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        const touches = e.touches;
        if (touches.length === 1 && isDragging) {
            const t = touches[0];
            state.camX = camStartX + (t.clientX - dragStartX) / state.zoom;
            state.camY = camStartY + (t.clientY - dragStartY) / state.zoom;
        } else if (touches.length === 2) {
            const t1 = touches[0], t2 = touches[1];
            const dx = t2.clientX - t1.clientX;
            const dy = t2.clientY - t1.clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            state.zoom = clamp(lastZoom * (dist / lastDist), MIN_ZOOM, MAX_ZOOM);
        }
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
        if (e.touches.length < 2) touch2 = null;
        if (e.touches.length === 0) { touch1 = null; isDragging = false; }
    });

    // === КОЛЕСО МЫШИ: зум ===
    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        state.zoom = clamp(state.zoom * (e.deltaY > 0 ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM);
    }, { passive: false });

    // === ПАНОРАМИРОВАНИЕ ПРАВОЙ КНОПКОЙ ===
    // Удерживайте правую кнопку — карта следует за курсором (удобно на большом зуме).
    let mouseDragging = false, mouseStartX = 0, mouseStartY = 0, camStartMX = 0, camStartMY = 0;

    canvas.addEventListener('mousedown', e => {
        if (e.button !== 2) return;
        mouseDragging = true;
        mouseStartX = e.clientX;
        mouseStartY = e.clientY;
        camStartMX = state.camX;
        camStartMY = state.camY;
        canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', e => {
        // позиция курсора нужна и без зажатой кнопки — для hover-подсказок
        state.mouseX = e.clientX;
        state.mouseY = e.clientY;
        if (!mouseDragging) return;
        state.camX = camStartMX + (e.clientX - mouseStartX) / state.zoom;
        state.camY = camStartMY + (e.clientY - mouseStartY) / state.zoom;
    });

    canvas.addEventListener('mouseleave', () => {
        state.mouseX = -1;
        state.mouseY = -1;
    });

    window.addEventListener('mouseup', e => {
        if (e.button !== 2) return;
        mouseDragging = false;
        canvas.style.cursor = '';
    });

    // отключаем системное контекстное меню, чтобы правая кнопка работала как панорамирование
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // === КНОПКИ СКОРОСТИ ВРЕМЕНИ ===
    // «Быстрее» удваивает скорость, «Медленнее» делит пополам, «Нормально» = реальное время.
    ui.slowBtn.addEventListener('click', () => {
        state.timeScale = Math.max(MIN_SPEED, state.timeScale / 2);
        updateSpeedUI(ui);
    });

    ui.fastBtn.addEventListener('click', () => {
        state.timeScale = Math.min(MAX_SPEED, state.timeScale * 2);
        updateSpeedUI(ui);
    });

    ui.normalBtn.addEventListener('click', () => {
        state.timeScale = 1;
        updateSpeedUI(ui);
    });

    updateSpeedUI(ui);
}

/** Подсветить активную кнопку и обновить надпись скорости в HUD. */
function updateSpeedUI(ui) {
    ui.normalBtn.classList.toggle('active', state.timeScale === 1);
    const speedEl = document.getElementById('speed');
    speedEl.textContent = (Math.round(state.timeScale * 10000) / 10000) + 'x';
}

// ===== ui.js =====
// =============================================================================
// ui.js — DOM-интерфейс: HUD-показатели (зум/скорость/дата) и боковая панель
// «ЛУНЫ СИСТЕМЫ» с деревом планет. Работает с DOM, не с канвасом.
// =============================================================================





/** Собрать ссылки на элементы HUD. Вызывается один раз в main.js. */
function getHudElements() {
    return {
        zEl: document.getElementById('z'),
        speedEl: document.getElementById('speed'),
        daysEl: document.getElementById('days'),
        dateEl: document.getElementById('date')
    };
}

/** Собрать ссылки на кнопки скорости. */
function getSpeedButtons() {
    return {
        slowBtn: document.getElementById('slowBtn'),
        normalBtn: document.getElementById('normalBtn'),
        fastBtn: document.getElementById('fastBtn')
    };
}

/** Обновить HUD-показатели (каждый кадр из main.js). */
function updateHud(hud) {
    // Счётчик дней привязан к орбитальному движению: тот же simDays,
    // что задаёт углы планет. Показывает время, прошедшее с загрузки страницы.
    hud.daysEl.textContent = (state.simDays - state.startSimDays).toFixed(4);
    hud.dateEl.textContent = formatSimDate(state.simDays);
    hud.zEl.textContent = state.zoom.toFixed(2) + 'x';
}

/** Построить дерево «планета → главные луны» и логику сворачивания панели. */
function buildSidePanel() {
    const treeEl = document.getElementById('lootTree');

    planets.forEach(p => {
        const li = document.createElement('li');
        li.className = 'planet';
        const moons = moonTree[p.name] || [];
        li.innerHTML =
            '<div class="node">' +
                '<span class="caret">▶</span>' +
                '<span class="dot" style="background:' + p.color + '"></span>' +
                '<span class="pname">' + p.name + '</span>' +
                '<span class="cnt">☾ ' + moonTotals[p.name] + '</span>' +
            '</div>' +
            '<ul class="loot">' +
                moons.map(([n, t]) => '<li>' + n + '<i>' + t + '</i></li>').join('') +
            '</ul>';
        li.querySelector('.node').addEventListener('click', () => li.classList.toggle('open'));
        treeEl.appendChild(li);
    });

    // Кнопка сворачивания панели целиком
    const sidePanel = document.getElementById('sidePanel');
    const panelToggle = document.getElementById('panelToggle');
    panelToggle.addEventListener('click', () => {
        sidePanel.classList.toggle('collapsed');
        panelToggle.textContent = sidePanel.classList.contains('collapsed') ? '◀' : '▶';
        panelToggle.title = sidePanel.classList.contains('collapsed') ? 'Развернуть' : 'Свернуть';
    });
}

// ===== main.js =====
// =============================================================================
// main.js — точка входа. Подготавливает канвас, ввод и панель, запускает
// главный цикл requestAnimationFrame, который каждый кадр:
//   1) двигает симуляционное время,
//   2) рисует мир (render.js),
//   3) рисует hover-подсказки поверх (hover.js),
//   4) обновляет HUD (ui.js).
// =============================================================================








// --- Инициализация --------------------------------------------------------------
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const hud = getHudElements();

resize(canvas);
window.addEventListener('resize', () => resize(canvas));

initInput(canvas, getSpeedButtons());
buildSidePanel();

// --- Главный цикл -----------------------------------------------------------------
let lastFrame = performance.now();

function frame() {
    //
    // dt в секундах реального времени; симуляция продвигается на dt * timeScale.
    // Потолок 0.1 сек защищает от прыжка после сворачивания вкладки.
    const nowMs = performance.now();
    const dt = Math.min(0.1, (nowMs - lastFrame) / 1000);
    lastFrame = nowMs;

    state.simDays += dt / MS_PER_DAY * 1000 * state.timeScale; // dt(сек) -> сутки
    state.time += dt * state.timeScale;

    // фон: очищаем весь канвас в экранных координатах
    ctx.fillStyle = '#020205';
    ctx.fillRect(0, 0, state.W, state.H);

    // мир (в мировой системе координат) + сбор тел для наведения
    const hoverTargets = renderScene(ctx);

    // подсказки и орбиты поверх мира, уже в экранных координатах
    drawHover(ctx, hoverTargets);

    updateHud(hud);

    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
