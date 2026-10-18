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
    orbitMoon: 'rgba(150,160,180,0.6)',
    orbitSelected: 'rgba(122,236,224,0.8)' // орбита выбранного кликом тела (акцент hangar)
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
// Плюс маппинг астрономических единиц в условные (якоря AU_ANCHORS из data.js)
// и решение уравнения Кеплера для эллиптических орбит малых тел.
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

/** mulberry32 — маленький сидированный ПСЧ (сид -> функция [0..1)). */
function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Астрономические единицы -> условные единицы карты: кусочно-линейно по
 * якорям AU_ANCHORS (орбиты планет, границы пояса, дальние зоны). За
 * последним якорем — линейное продолжение последнего отрезка.
 * @param {number} au расстояние, а.е.
 */
function auToDist(au) {
    const A = AU_ANCHORS;
    if (au <= A[0][0]) {
        const k = (A[1][1] - A[0][1]) / (A[1][0] - A[0][0]);
        return Math.max(0, A[0][1] + (au - A[0][0]) * k);
    }
    for (let i = 1; i < A.length; i++) {
        if (au <= A[i][0]) {
            const [a0, d0] = A[i - 1], [a1, d1] = A[i];
            return d0 + (d1 - d0) * (au - a0) / (a1 - a0);
        }
    }
    const [a0, d0] = A[A.length - 2], [a1, d1] = A[A.length - 1];
    return d1 + (au - a1) * (d1 - d0) / (a1 - a0);
}

/** Период обращения по третьему закону Кеплера (a в а.е.), сутки. */
function periodFromA(a) {
    return 365.256 * Math.pow(a, 1.5);
}

/**
 * Позиция тела на эллиптической орбите из симуляционного времени: средняя
 * аномалия -> уравнение Кеплера (итерации Ньютона) -> истинная аномалия.
 * Правило знаков как у планет (y вниз, движение против часовой с севера
 * эклиптики). При e = 0 совпадает с orbitAngle (m0 + peri = средняя долгота).
 * @param {number} a    большая полуось, а.е.
 * @param {number} e    эксцентриситет (0..0.99)
 * @param {number} peri долгота перигелия, градусы
 * @param {number} m0   средняя аномалия на J2000, градусы
 * @param {number} T    период, сутки
 * @param {number} t    симуляционное время, сутки от J2000
 * @returns {{x: number, y: number, rAu: number}} единицы мира + радиус, а.е.
 */
function keplerPos(a, e, peri, m0, T, t) {
    let turns = (m0 / 360 + t / T) % 1;
    if (turns < 0) turns += 1;
    const M = turns * 2 * Math.PI;

    // стартовое приближение для высоких эксцентриситетов, затем итерации Ньютона
    let E = M + e * Math.sin(M);
    for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));

    const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    const rAu = a * (1 - e * Math.cos(E));
    const th = nu + peri * Math.PI / 180;
    const r = auToDist(rAu);
    return { x: Math.cos(th) * r, y: -Math.sin(th) * r, rAu };
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

/* ---------- Малые тела (карта: smallbodies.js) ---------- */

// Отображение астрономических единиц в условные единицы карты: кусочно-линейные
// якоря — орбиты планет, границы главного пояса, дальние зоны. Пояс остаётся
// на прежних радиусах 270–350 (якоря 2.2 и 3.5 а.е. подобраны под него).
// Дальше 50 а.е. шкала сильно сжата (math.js auToDist продолжает линейно).
const AU_ANCHORS = [
    [0.387, 70], [0.723, 110], [1.0, 160], [1.524, 220],
    [2.2, 270], [3.5, 350], [5.203, 380], [9.537, 520],
    [19.19, 660], [30.07, 780], [40, 890], [50, 1000]
];

// Крупнейшие тела главного пояса: Церера (карликовая планета), Веста, Паллада,
// Гигея. a — а.е., e — эксцентриситет, peri — долгота перигелия (град.),
// m0 — средняя аномалия на J2000 (град., произвольная фаза карты),
// dia — диаметр (км). Период считается по третьему закону Кеплера.
const beltNotables = [
    { n: 'Ceres',  ru: 'Церера',  a: 2.7675, e: 0.0785, peri: 73.6,  m0: 95,  dia: 939, type: 'dwarf' },
    { n: 'Vesta',  ru: 'Веста',   a: 2.3615, e: 0.0887, peri: 151.2, m0: 210, dia: 525 },
    { n: 'Pallas', ru: 'Паллада', a: 2.7727, e: 0.2313, peri: 310.0, m0: 42,  dia: 512 },
    { n: 'Hygiea', ru: 'Гигея',   a: 3.1395, e: 0.1067, peri: 313.2, m0: 152, dia: 434 }
];

// Околоземные астероиды (реальные элементы; m0 — произвольная фаза карты).
// Группы: amor — перигелий между орбитами Земли и Марса, орбиту Земли не
// пересекают; apollo — пересекают орбиту Земли, a > 1 а.е.; aten — пересекают,
// a < 1 а.е. Тутатис — «переходный»: афелий 4.1 а.е. — заходит в пояс.
const neas = [
    { n: 'Eros',      ru: 'Эрос',      group: 'amor',   a: 1.4582, e: 0.2226, peri: 178.9, m0: 250, dia: 16.8 },
    { n: 'Amor',      ru: 'Амур',      group: 'amor',   a: 1.9197, e: 0.4351, peri: 26.7,  m0: 120, dia: 1.0 },
    { n: 'Ganymed',   ru: 'Ганимед',   group: 'amor',   a: 2.6632, e: 0.5339, peri: 132.4, m0: 300, dia: 35 },
    { n: 'Apollo',    ru: 'Аполлон',   group: 'apollo', a: 1.4704, e: 0.5599, peri: 285.7, m0: 60,  dia: 1.5 },
    { n: 'Bennu',     ru: 'Бенну',     group: 'apollo', a: 1.1264, e: 0.2038, peri: 66.2,  m0: 101, dia: 0.49 },
    { n: 'Itokawa',   ru: 'Итокава',   group: 'apollo', a: 1.3241, e: 0.2801, peri: 162.8, m0: 312, dia: 0.33 },
    { n: 'Toutatis',  ru: 'Тутатис',   group: 'apollo', a: 2.5344, e: 0.6299, peri: 278.8, m0: 190, dia: 4.5 },
    { n: 'Didymos',   ru: 'Дидим',     group: 'apollo', a: 1.6444, e: 0.3835, peri: 319.3, m0: 340, dia: 0.78 },
    { n: 'Icarus',    ru: 'Икар',      group: 'apollo', a: 1.0780, e: 0.8265, peri: 31.5,  m0: 210, dia: 1.4 },
    { n: 'Nereus',    ru: 'Нерей',     group: 'apollo', a: 1.4892, e: 0.3603, peri: 158.0, m0: 15,  dia: 0.33 },
    { n: 'Aten',      ru: 'Атон',      group: 'aten',   a: 0.9668, e: 0.1826, peri: 147.5, m0: 280, dia: 1.1 },
    { n: 'Apophis',   ru: 'Апофис',    group: 'aten',   a: 0.9224, e: 0.1914, peri: 126.4, m0: 60,  dia: 0.37 },
    { n: 'Ra-Shalom', ru: 'Ра-Шалом',  group: 'aten',   a: 0.8322, e: 0.4364, peri: 356.0, m0: 130, dia: 2.3 },
    { n: 'Cruithne',  ru: 'Круитни',   group: 'aten',   a: 0.9978, e: 0.5148, peri: 12.0,  m0: 220, dia: 5 }
];

// Именованные троянцы Юпитера: camp 4 — L4 (впереди Юпитера), 5 — L5 (позади);
// dAng — смещение от центра облака (град.), dR — от радиуса орбиты Юпитера (ед.).
const trojanNames = [
    { n: 'Achilles',  ru: 'Ахиллес',   camp: 4, dAng: -3.2, dR: 6 },
    { n: 'Agamemnon', ru: 'Агамемнон', camp: 4, dAng: 4.1,  dR: -5 },
    { n: 'Hektor',    ru: 'Гектор',    camp: 5, dAng: -2.4, dR: 4 },
    { n: 'Patroclus', ru: 'Патрокл',   camp: 5, dAng: 3.6,  dR: -7 }
];

// Кометы: реальные элементы. m0 подобраны так, чтобы сейчас (2026) кометы были
// в интересной части орбиты: Галлея и Свифта—Таттла — в поясе на подходе,
// Энке и Хейла—Боппа — у перигелия. shower — связанный метеорный поток.
const comets = [
    { n: '1P/Halley',        ru: 'Галлея',         a: 17.834, e: 0.9671, peri: 111.3, m0: 234, dia: 11, shower: 'Ориониды · Эта-Аквариды' },
    { n: '2P/Encke',         ru: 'Энке',           a: 2.2151, e: 0.8483, peri: 187.6, m0: 323, dia: 4.8, shower: 'Тауриды' },
    { n: '109P/Swift-Tuttle', ru: 'Свифта—Таттла', a: 26.09,  e: 0.9633, peri: 113.4, m0: 289, dia: 26, shower: 'Персеиды' },
    { n: 'C/1995 O1',        ru: 'Хейла—Боппа',    a: 186.0,  e: 0.9951, peri: 130.6, m0: 0,   dia: 60, shower: null }
];

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

    // --- Выбор и hover ----------------------------------------------------------
    hoverTargets: null, // тела текущего кадра (заполняет main.js), для клика
    selected: null,     // выбранный объект: {kind:'sun'|'planet'|'moon', p, m}

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
// scene.js — генерация фона сцены (звёзды) и правило раскрытия лун.
// Малые тела (пояс астероидов, ОЗА, троянцы, кометы, дальние пояса) живут в
// отдельном модуле smallbodies.js. Позиции тел здесь не считаются — это
// делает render.js каждый кадр из simDays.
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

// ===== smallbodies.js =====
// =============================================================================
// smallbodies.js — малые тела Солнечной системы отдельным слоем мира:
// главный пояс (частицы + крупнейшие тела + щели Кирквуда), околоземные
// астероиды (Атон/Аполлон/Амур), троянцы Юпитера (L4/L5), кометы, пояс
// Койпера и облако Оорта.
//
// Каждое тело — сущность со своим типом (kind) и id: в будущем появится
// добыча/уничтожение астероидов, поэтому генерация выполняется при каждом
// запуске и детерминирована (сидированный ПСЧ) — пояс стабилен между
// загрузками, а уничтоженные можно будет исключать по id.
//
// Позиции считаются каждый кадр из общего simDays — как у планет. Элементы
// орбит реальные (a, e, долгота перигелия), карта — 2D-плоскость эклиптики.
// =============================================================================






// --- Главный пояс: закон Кеплера от якорей Марс → Юпитер ---------------------
const MARS = planets.find(p => p.name === 'Mars');
const JUPITER = planets.find(p => p.name === 'Jupiter');
const KEPLER_EXP = Math.log(JUPITER.period / MARS.period) / Math.log(JUPITER.dist / MARS.dist);

/** Период обращения астероида на расстоянии d (условные единицы), сутки. */
function beltPeriod(d) {
    return MARS.period * Math.pow(d / MARS.dist, KEPLER_EXP);
}

// --- Главный пояс: частицы ----------------------------------------------------
const BELT_MIN = 270, BELT_MAX = 350;    // прежние границы (≈ 2.2–3.5 а.е.)
const BELT_COUNT = 400;
const BELT_SEED = 20261018;

// Щели Кирквуда — резонансы с Юпитером 2.50 / 2.82 / 2.95 / 3.27 а.е.:
// [радиус (а.е.), глубина провала, ширина (ед.)]. Плотность частиц в щели падает.
const BELT_GAPS = [
    [2.50, 0.85, 3.6],
    [2.82, 0.80, 3.0],
    [2.95, 0.80, 3.0],
    [3.27, 0.70, 3.2]
].map(([au, depth, w]) => ({ r: auToDist(au), depth, w }));

/** Плотность пояса в точке d — произведение провалов около резонансов. */
function beltDensity(d) {
    let p = 1;
    for (const g of BELT_GAPS) p *= 1 - g.depth * Math.exp(-Math.pow((d - g.r) / g.w, 2));
    return p;
}

// Частицы пояса. Генерация детерминированная и происходит при каждом запуске:
// пояс есть всегда, элементы адресуемы по id (задел под добычу/уничтожение).
const beltRng = makeRng(BELT_SEED);
const asteroids = [];
for (let i = 0; i < BELT_COUNT; i++) {
    let d = BELT_MIN;
    for (let tries = 0; tries < 40; tries++) {
        d = BELT_MIN + beltRng() * (BELT_MAX - BELT_MIN);
        if (beltRng() < beltDensity(d)) break;
    }
    asteroids.push({
        id: 'belt-' + i,
        kind: 'asteroid',
        d,
        l0: beltRng() * 360,                                   // стартовая долгота
        period: beltPeriod(d) * (0.98 + beltRng() * 0.04),     // лёгкий разброс периодов
        s: 0.5 + beltRng() * 1.5                               // размер, пиксели мира
    });
}

/** Дескриптор эллипса орбиты для hover/выбора: центр, полуоси, поворот. */
function orbitEllipse(aAu, e, periDeg) {
    const A = auToDist(aAu);
    const p = periDeg * Math.PI / 180;
    return {
        cx: -A * e * Math.cos(p),          // центр — от солнца в сторону, обратную перигелию
        cy: A * e * Math.sin(p),
        a: A,
        b: A * Math.sqrt(1 - e * e),
        rot: -p
    };
}

// --- Главный пояс: крупнейшие тела ---------------------------------------------
// Церера (карликовая планета), Веста, Паллада, Гигея — заметнее частиц пояса
// (ярче, крупнее, с обводкой) и выбираются кликом, как планеты.
const notables = beltNotables.map(b => ({
    id: 'notable-' + b.n,
    kind: 'asteroid',
    name: b.ru + ' / ' + b.n,
    note: b.type === 'dwarf' ? 'Карликовая планета' : 'Крупный астероид',
    a: b.a, e: b.e, peri: b.peri, m0: b.m0, dia: b.dia,
    T: periodFromA(b.a),
    r: b.type === 'dwarf' ? 3.2 : 2.6,
    x: 0, y: 0,
    orbit: orbitEllipse(b.a, b.e, b.peri)
}));

/**
 * Нарисовать малые тела в мировой системе координат (вызывается из render.js
 * после звёзд). Возвращает hoverTargets именованных тел.
 * @returns {Array} цели для hover/выбора
 */
function drawSmallBodies(ctx) {
    const { simDays, zoom } = state;
    const targets = [];

    // Частицы пояса
    ctx.fillStyle = '#6e6e6e';
    asteroids.forEach(a => {
        const ang = orbitAngle(a.l0, a.period, simDays);
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * a.d, -Math.sin(ang) * a.d, a.s, 0, Math.PI * 2);
        ctx.fill();
    });

    // Крупнейшие тела пояса — заметные точки с обводкой, выбираются
    notables.forEach(b => {
        const pos = keplerPos(b.a, b.e, b.peri, b.m0, b.T, simDays);
        b.x = pos.x;
        b.y = pos.y;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = '#cfcfcf';
        ctx.fill();
        ctx.strokeStyle = '#efefef';
        ctx.lineWidth = STROKE.moon / zoom;
        ctx.stroke();

        targets.push({ kind: 'asteroid', name: b.name, x: pos.x, y: pos.y, r: b.r, moons: [], small: b });
    });

    return targets;
}

// ===== sky.js =====
// =============================================================================
// sky.js — задний план карты: Млечный Путь, галактика Андромеды, туманности
// и звёзды нашей галактики.
//
// Полностью отдельный слой, не связанный с игрой (солнце, планеты, луны, база, пояс
// астероидов, симуляция времени): рисуется в экранных координатах.
// Глубокое небо собирается один раз в offscreen-canvas с запасом по краям
// (overscan) и блитится со смещением и масштабом: при панорамировании небо
// «отстаёт» от мира (параллакс с насыщением), при зуме слегка «наезжает».
// Содержимое кэша при этом не пересобирается — только положение блита.
// Звёзды галактики — два бесконечных тайлящихся слоя с собственным параллаксом
// и мерцанием, рисуются каждый кадр поверх кэша.
//
// Геометрия: полоса Млечного Пути наклонена к плоскости карты (эклиптике)
// на ~60° — как наклон галактической плоскости к эклиптике в реальности.
// Положения объектов задаются в координатах полосы: u — вдоль оси (-1..1),
// v — поперёк, в долях длины L = hypot(W, H) — размера экрана.
// =============================================================================




const BAND_ANGLE_DEG = 60;   // наклон полосы к горизонтали экрана
const SEED = 20261018;       // сид: рисунок неба стабилен между загрузками

// --- Реакция на камеру (глубокое небо) ----------------------------------------
// Небо смещается в ту же сторону, что мир на экране, но всего на ~4% —
// классический параллакс, «фон отстаёт». Ограничение насыщением: панорама
// бесконечная, а кэш конечный — так края экрана никогда не оголяются, и небо
// ведёт себя как бесконечно далёкое. Зум слегка «наезжает» на небо.
const PARALLAX_K = 0.04;     // доля смещения камеры, пока смещение мало
const MAX_SHIFT = 0.05;      // предельное смещение (доля размера экрана по оси)
const SIGN = -1;             // знак: небо едет туда же, куда мир при росте camX
const ZOOM_K = 0.03;         // реакция на зум: столько на каждое удвоение
const MIN_SCALE = 0.94;      // пределы масштаба неба в блите
const MAX_SCALE = 1.15;
const OVERSCAN = 0.10;       // запас кэша по краям (доля размера экрана)

// --- Звёзды галактики -----------------------------------------------------------
// Два бесконечных слоя (тайл размером с экран, обёртка mod): у каждого свой
// параллакс k — какую долю экранного пути мира проходит слой (мир = 1.0,
// глубокое небо ≈ 0.04). Дальние звёзды почти стоят, средние заметно плывут.
const STAR_SEED = 20261018;  // сид слоёв звёзд
const GALAXY_LAYERS = [
    { k: 0.10, count: 700, size: [0.5, 1.0], alpha: [0.18, 0.55], twSpeed: 1.3, twAmp: 0.25 },
    { k: 0.35, count: 450, size: [0.6, 1.2], alpha: [0.28, 0.70], twSpeed: 1.8, twAmp: 0.35 }
];
const BRIGHT_STARS = 14;     // ярких звёзд в полосе (без имён)

const rng = makeRng(SEED);
const rnd = (a, b) => a + (b - a) * rng();

// --- Данные неба (генерируются один раз) ---------------------------------------

// Широкое свечение полосы.
const skyGlow = [];
for (let i = 0; i < 56; i++) {
    skyGlow.push({
        u: rnd(-1.05, 1.05),
        v: rnd(-0.05, 0.05),
        r: rnd(0.04, 0.09),
        a: rnd(0.015, 0.038),
        warm: rng() < 0.35            // тёплые тона ближе к центру Галактики
    });
}

// Яркое ядро полосы.
const skyCore = [];
for (let i = 0; i < 70; i++) {
    skyCore.push({ u: rnd(-1, 1), v: rnd(-0.018, 0.018), r: rnd(0.015, 0.035), a: rnd(0.026, 0.056) });
}

// Тёмная пылевая полоса вдоль оси — рисуется поверх свечения.
const skyDust = [];
for (let i = 0; i < 40; i++) {
    skyDust.push({
        u: rnd(-1, 1),
        v: (0.004 + rng() * 0.03) * (rng() < 0.7 ? 1 : -1),
        r: rnd(0.02, 0.05),
        a: rnd(0.14, 0.30)
    });
}

// Звёздная пыль внутри полосы: треугольное распределение по v — гуще к оси.
const skyStars = [];
for (let i = 0; i < 900; i++) {
    skyStars.push({
        u: rnd(-1.08, 1.08),
        v: (rng() + rng() + rng() - 1.5) / 1.5 * 0.07,
        s: rnd(0.4, 1.4),
        a: rnd(0.12, 0.55),
        tint: rng()
    });
}

// Яркие звёзды полосы — заметные точки с маленьким ореолом (безымянные).
const brightStars = [];
for (let i = 0; i < BRIGHT_STARS; i++) {
    brightStars.push({
        u: rnd(-0.9, 0.9),
        v: rnd(-0.05, 0.05),
        r: rnd(0.8, 1.4),     // размер ядра, px
        halo: rnd(4, 7),      // радиус ореола, px
        tint: rng()
    });
}

// Туманности — цветные пятна внутри полосы (условные Орион, Киль и т.п.).
const NEBULA_COLORS = [
    [90, 220, 210], [170, 120, 240], [240, 120, 170], [240, 175, 110], [120, 170, 255]
];
const skyNebulae = [];
for (let i = 0; i < 5; i++) {
    skyNebulae.push({
        u: rnd(-0.75, 0.75), v: rnd(-0.04, 0.04),
        r: rnd(0.010, 0.024), a: rnd(0.06, 0.10),
        col: NEBULA_COLORS[i]
    });
}

// Галактика Андромеды (M31) — отдельное пятно в стороне от полосы.
const skyM31 = { u: rnd(0.05, 0.15), v: -0.24, len: 0.035, skew: rnd(-0.25, 0.25) };

// Магеллановы облака — два компактных спутника у края полосы.
const skyMagellanic = [
    { u: -0.40, v: 0.100, r: 0.018, a: 0.05 },
    { u: -0.50, v: 0.115, r: 0.011, a: 0.04 }
];

// Слои звёзд галактики: позиции в долях экрана [0..1) — тайл всегда
// соответствует текущему размеру окна, при resize узор перекладывается.
const starRng = makeRng(STAR_SEED);
const galaxyLayers = GALAXY_LAYERS.map(cfg => {
    const stars = [];
    for (let i = 0; i < cfg.count; i++) {
        stars.push({
            x: starRng(),
            y: starRng(),
            s: cfg.size[0] + (cfg.size[1] - cfg.size[0]) * starRng(),
            a: cfg.alpha[0] + (cfg.alpha[1] - cfg.alpha[0]) * starRng(),
            ph: starRng() * Math.PI * 2,
            tint: starRng()
        });
    }
    return { k: cfg.k, twSpeed: cfg.twSpeed, twAmp: cfg.twAmp, stars };
});

// --- Отрисовка ------------------------------------------------------------------

let skyCanvas = null;
let skyW = 0, skyH = 0;

/** Экранная точка по координатам полосы: центр (cx, cy), масштаб L. */
function bandPoint(u, v, cx, cy, L) {
    const a = BAND_ANGLE_DEG * Math.PI / 180;
    return {
        x: cx + Math.cos(a) * u * L / 2 - Math.sin(a) * v * L,
        y: cy + Math.sin(a) * u * L / 2 + Math.cos(a) * v * L
    };
}

/** Смещение неба от камеры: доля PARALLAX_K с насыщением на MAX_SHIFT. */
function skyShift() {
    const maxX = MAX_SHIFT * state.W, maxY = MAX_SHIFT * state.H;
    return {
        x: SIGN * maxX * Math.tanh(PARALLAX_K * state.camX / maxX),
        y: SIGN * maxY * Math.tanh(PARALLAX_K * state.camY / maxY)
    };
}

/** Масштаб неба от зума: каждое удвоение добавляет ZOOM_K, с ограничением. */
function skyScale() {
    let s = Math.pow(2, ZOOM_K * Math.log2(state.zoom));
    if (s < MIN_SCALE) s = MIN_SCALE;
    if (s > MAX_SCALE) s = MAX_SCALE;
    return s;
}

/** Нарисовать дальний фон в экранных координатах (вызывается из render.js). */
function drawSky(ctx) {
    if (!skyCanvas || skyW !== state.W || skyH !== state.H) buildSky();

    // Блит кэша со смещением/масштабом. Запас OVERSCAN заведомо больше
    // максимального смещения (MAX_SHIFT) и разницы масштаба (MIN_SCALE),
    // поэтому экран всегда накрыт целиком — пустых полос у краёв не бывает.
    const scale = skyScale();
    const sh = skyShift();
    const bw = skyCanvas.width * scale, bh = skyCanvas.height * scale;
    ctx.drawImage(skyCanvas, (state.W - bw) / 2 + sh.x, (state.H - bh) / 2 + sh.y, bw, bh);

    drawGalaxyStars(ctx);
}

/**
 * Звёзды галактики: бесконечные слои с параллаксом и мерцанием.
 * Тайл размером с экран, обёртка mod + копии у краёв — панорама не ограничена.
 */
function drawGalaxyStars(ctx) {
    const { W, H, camX, camY, zoom, time } = state;
    galaxyLayers.forEach(layer => {
        // экранный путь слоя — доля k от пути мира (мир панорамируется 1:1 к курсору)
        const ox = -camX * layer.k * zoom;
        const oy = -camY * layer.k * zoom;
        layer.stars.forEach(s => {
            const px0 = ((s.x * W + ox) % W + W) % W;
            const py0 = ((s.y * H + oy) % H + H) % H;
            const tw = 1 - layer.twAmp * (0.5 + 0.5 * Math.sin(time * layer.twSpeed + s.ph));
            const col = s.tint < 0.08 ? '255,210,170' : (s.tint > 0.92 ? '170,200,255' : '255,255,255');
            ctx.fillStyle = 'rgba(' + col + ',' + (s.a * tw).toFixed(3) + ')';
            for (let i = -1; i <= 1; i++) {
                const px = px0 + i * W;
                if (px < -2 || px > W + 2) continue;
                for (let j = -1; j <= 1; j++) {
                    const py = py0 + j * H;
                    if (py < -2 || py > H + 2) continue;
                    ctx.fillRect(px, py, s.s, s.s);
                }
            }
        });
    });
}

/** Собрать слой неба в offscreen-canvas с запасом по краям. */
function buildSky() {
    const W = state.W, H = state.H;
    const BW = Math.round(W * (1 + 2 * OVERSCAN));   // кэш с запасом
    const BH = Math.round(H * (1 + 2 * OVERSCAN));
    skyW = W;
    skyH = H;
    skyCanvas = document.createElement('canvas');
    skyCanvas.width = BW;
    skyCanvas.height = BH;
    const g = skyCanvas.getContext('2d');

    // Масштаб объектов — от размера ЭКРАНА (вид не меняется из-за запаса),
    // центр — центр кэша (при блите он совпадает с центром экрана).
    const L = Math.hypot(W, H);
    const cx = BW / 2, cy = BH / 2;
    const pt = (u, v) => bandPoint(u, v, cx, cy, L);

    // Мягкое пятно: радиальный градиент от центра к полностью прозрачному краю.
    const blob = (x, y, r, col, alpha) => {
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + alpha + ')');
        grad.addColorStop(1, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0)');
        g.fillStyle = grad;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
    };

    // Небо — светящиеся слои: складываются аддитивно.
    g.globalCompositeOperation = 'lighter';

    skyGlow.forEach(c => {
        const p = pt(c.u, c.v);
        blob(p.x, p.y, c.r * L, c.warm ? [235, 225, 215] : [175, 195, 235], c.a);
    });
    skyCore.forEach(c => {
        const p = pt(c.u, c.v);
        blob(p.x, p.y, c.r * L, [240, 244, 255], c.a);
    });
    skyStars.forEach(s => {
        const p = pt(s.u, s.v);
        const col = s.tint < 0.10 ? '255,205,165' : (s.tint > 0.92 ? '180,210,255' : '255,255,255');
        g.fillStyle = 'rgba(' + col + ',' + s.a + ')';
        g.fillRect(p.x, p.y, s.s, s.s);
    });

    // Яркие звёзды полосы: мягкий ореол + яркое ядро.
    brightStars.forEach(bs => {
        const p = pt(bs.u, bs.v);
        const col = bs.tint < 0.15 ? [255, 220, 180] : (bs.tint > 0.85 ? [190, 215, 255] : [245, 248, 255]);
        blob(p.x, p.y, bs.halo, col, 0.35);
        g.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0.9)';
        g.fillRect(p.x - bs.r / 2, p.y - bs.r / 2, bs.r, bs.r);
    });

    skyNebulae.forEach(n => {
        // Три смещённых пятна — у туманности неровная форма.
        for (let k = 0; k < 3; k++) {
            const p = pt(n.u + (k - 1) * n.r * 0.8, n.v + (k - 1) * n.r * 0.6);
            blob(p.x, p.y, n.r * L * (1 - k * 0.15), n.col, n.a * (1 - k * 0.25));
        }
    });

    // Андромеда: вытянутое наклонное свечение + яркое ядро.
    {
        const p = pt(skyM31.u, skyM31.v);
        const len = skyM31.len * L;
        g.save();
        g.translate(p.x, p.y);
        g.rotate((BAND_ANGLE_DEG + 25) * Math.PI / 180 + skyM31.skew);
        g.scale(1, 0.32);
        blob(0, 0, len, [205, 215, 250], 0.09);
        g.restore();
        blob(p.x, p.y, len * 0.22, [235, 240, 255], 0.07);
    }

    // Магеллановы облака — небольшие неровные спутники у края полосы.
    skyMagellanic.forEach(m => {
        for (let k = 0; k < 3; k++) {
            const p = pt(m.u + (k - 1) * m.r * 0.6, m.v + (k - 1) * m.r * 0.45);
            blob(p.x, p.y, m.r * L * (1 - k * 0.2), [200, 210, 235], m.a);
        }
    });

    // Пылевая полоса — тёмные пятна поверх свечения (обычная композиция).
    g.globalCompositeOperation = 'source-over';
    skyDust.forEach(d => {
        const p = pt(d.u, d.v);
        blob(p.x, p.y, d.r * L, [4, 4, 9], d.a);
    });
}

// ===== render.js =====
// =============================================================================
// render.js — отрисовка сцены на канвас: фон, малые тела (smallbodies.js),
// солнце, планеты, луны, база.
// Монохромный стиль: все тела — плоские круги, различаются яркостью заливки
// и толщиной обводки (солнце > планеты > луны). Орбит на карте нет — их рисует
// hover.js только при наведении. Дальний фон (небо) — отдельный слой sky.js.
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

    // Дальний фон — отдельный слой sky.js, в экранных координатах:
    // камера и зум на небо не влияют (оно бесконечно далеко).
    drawSky(ctx);

    // Мировая система координат: центр экрана -> камера -> зум.
    ctx.save();
    ctx.translate(state.W / 2, state.H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-state.camX, -state.camY);

    drawStars(ctx, time);

    // Малые тела (пояс, ОЗА, троянцы, кометы, дальние пояса) — отдельный слой
    // smallbodies.js: частицы рисует сам, именованные тела отдаёт как hover-цели.
    hoverTargets.push(...drawSmallBodies(ctx));

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
        let baseHit = null;
        if (p.hasBase) {
            const hit = drawEarthMoonAndBase(ctx, x, y);
            if (hit) {
                moonHits.push(hit.moon);
                // База — отдельная цель выбора, как планета или луна.
                baseHit = {
                    kind: 'base',
                    name: 'База LUNA-ORBIT',
                    x: hit.base.bx, y: hit.base.by, r: hit.base.r,
                    orbitCx: hit.moon.mx, orbitCy: hit.moon.my, orbitR: baseOrbitRadius,
                    p, moons: []
                };
            }
        }

        hoverTargets.push({ kind: 'planet', p, x, y, moons: moonHits });
        // база добавляется после планеты: рисуется поверх и проверяется первой
        if (baseHit) hoverTargets.push(baseHit);
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
 * @returns {{moon: {m, md, mx, my}, base: {bx, by, r}}} хиты Луны и базы
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

    return {
        moon: { m: { n: 'Луна / Moon', r: 3, period: moonPeriod }, md: moonDist, mx, my },
        base: { bx, by, r: bs }
    };
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
// Здесь же — орбита и маркер ВЫБРАННОГО объекта (клик) и экспорт findBodyAt
// для обработчика клика в input.js.
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

    const hover = findBodyAt(hoverTargets, mouseX, mouseY);
    if (!hover) return;

    // орбита наведённого тела (у солнца орбиты нет)
    if (hover.orbit) {
        drawOrbitOverlay(ctx, hover, COLORS.orbitPlanet);
    }
    drawTooltip(ctx, hover.name, mouseX, mouseY);
}

/**
 * Нарисовать орбиту выбранного кликом тела — пунктир держится, пока объект выбран.
 * @param {CanvasRenderingContext2D} ctx
 * @param {?{kind: string, p: object, m: object}} sel — текущий выбор (state.selected)
 * @param {Array} hoverTargets — результат renderScene() этого кадра
 */
function drawSelection(ctx, sel, hoverTargets) {
    if (!sel) return;

    const target = hoverTargets.find(t =>
        sel.kind === 'sun' ? t.kind === 'sun' :
        sel.kind === 'base' ? t.kind === 'base' :
        sel.small ? t.small === sel.small : t.p === sel.p);
    if (!target) return; // тело ещё не в кадре (луна скрыта зумом и т.п.)

    if (sel.kind === 'sun') return; // у солнца орбиты нет

    let orbit = null;
    if (sel.small) {
        // малое тело: эллипс по собственным элементам орбиты (a, e, перигелий)
        orbit = sel.small.orbit;
    } else if (sel.kind === 'planet') {
        orbit = { cx: 0, cy: 0, r: target.p.dist };
    } else if (sel.kind === 'base') {
        // база летает вокруг Луны Земли — орбита от Луны, не от солнца
        orbit = { cx: target.orbitCx, cy: target.orbitCy, r: target.orbitR };
    } else {
        // луна ищется по имени: объекты лун в кадре и в дереве — разные ссылки
        const mh = target.moons.find(x => x.m.n === sel.m.n);
        if (!mh) return;
        orbit = { cx: target.x, cy: target.y, r: mh.md };
    }
    drawOrbitOverlay(ctx, { kind: sel.kind, orbit }, COLORS.orbitSelected);
}

/**
 * Hit-тест: перебираем цели с конца (планеты добавлены после солнца, луны
 * проверяются первыми — они мельче и лежат поверх).
 * Экспортируется для выбора объекта по клику (input.js).
 * @returns {?{kind: string, name: string, orbit: ?{cx, cy, r}, p: object, m: object}}
 */
function findBodyAt(hoverTargets, mouseX, mouseY) {
    const w = screenToWorld(mouseX, mouseY, state);

    for (let i = hoverTargets.length - 1; i >= 0; i--) {
        const t = hoverTargets[i];

        for (let j = t.moons.length - 1; j >= 0; j--) {
            const mh = t.moons[j];
            const hitR = Math.max(mh.m.r, MIN_HIT_MOON_PX / state.zoom);
            if ((w.x - mh.mx) ** 2 + (w.y - mh.my) ** 2 <= hitR * hitR) {
                // луна: орбита вокруг своей планеты
                return { kind: 'moon', name: mh.m.n, orbit: { cx: t.x, cy: t.y, r: mh.md }, p: t.p, m: mh.m };
            }
        }

        // база: орбита вокруг Луны Земли, радиус попадания как у лун
        if (t.kind === 'base') {
            const hitR = Math.max(t.r, MIN_HIT_MOON_PX / state.zoom);
            if ((w.x - t.x) ** 2 + (w.y - t.y) ** 2 <= hitR * hitR) {
                return { kind: 'base', name: t.name, orbit: { cx: t.orbitCx, cy: t.orbitCy, r: t.orbitR }, p: t.p, m: null };
            }
            continue;
        }

        const name = t.name || (t.p ? t.p.name : '');
        const bodyR = t.r || (t.p ? t.p.r : 0);
        const hitR = Math.max(bodyR, MIN_HIT_PLANET_PX / state.zoom);
        if ((w.x - t.x) ** 2 + (w.y - t.y) ** 2 <= hitR * hitR) {
            // орбита: у малых тел — из их элементов (эллипс), у планет — вокруг
            // солнца; у самого солнца орбиты нет
            let orbit = null;
            if (t.small) orbit = t.small.orbit;
            else if (t.kind !== 'sun') orbit = { cx: 0, cy: 0, r: t.p.dist };
            return { kind: t.kind, name, orbit, p: t.p || null, m: null, small: t.small || null };
        }
    }
    return null;
}

/** Пунктирная орбита тела в мировой системе координат. */
function drawOrbitOverlay(ctx, hover, color) {
    const { zoom, camX, camY, W, H } = state;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.beginPath();
    if (hover.orbit.rot !== undefined) {
        // эллипс малого тела: центр, полуоси, поворот (мировые единицы)
        ctx.ellipse(hover.orbit.cx, hover.orbit.cy, hover.orbit.a, hover.orbit.b, hover.orbit.rot, 0, Math.PI * 2);
    } else {
        ctx.arc(hover.orbit.cx, hover.orbit.cy, hover.orbit.r, 0, Math.PI * 2);
    }
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
// input.js — всё пользовательское управление: тач (перетаскивание, pinch),
// колесо мыши (зум к точке под курсором), панорамирование правой кнопкой,
// позиция курсора для hover (над выбираемыми объектами — курсор-указатель),
// кнопки скорости времени.
// Только меняет state и курсор канваса, ничего не рисует.
// =============================================================================







/**
 * Зум к точке экрана: мировая точка под (ax, ay) остаётся под ней после
 * смены масштаба — колесо приближает карту туда, где курсор, pinch — к
 * середине между пальцами. Если зум упёрся в предел, камера не сдвигается.
 */
function zoomAt(ax, ay, target) {
    const z0 = state.zoom;
    const z1 = clamp(target, MIN_ZOOM, MAX_ZOOM);
    if (z1 === z0) return;
    const k = 1 / z0 - 1 / z1;   // так cam сдвигается ровно под точку (ax, ay)
    state.camX += (ax - state.W / 2) * k;
    state.camY += (ay - state.H / 2) * k;
    state.zoom = z1;
}

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
            // зум к середине между пальцами
            zoomAt((t1.clientX + t2.clientX) / 2, (t1.clientY + t2.clientY) / 2,
                   lastZoom * (dist / lastDist));
        }
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
        if (e.touches.length < 2) touch2 = null;
        if (e.touches.length === 0) { touch1 = null; isDragging = false; }
    });

    // === КОЛЕСО МЫШИ: зум к точке под курсором ===
    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        zoomAt(e.clientX, e.clientY, state.zoom * (e.deltaY > 0 ? 0.9 : 1.1));
    }, { passive: false });

    // === ПАНОРАМИРОВАНИЕ ПРАВОЙ КНОПКОЙ ===
    // Удерживайте правую кнопку — карта следует за курсором (удобно на большом зуме).
    let mouseDragging = false, mouseStartX = 0, mouseStartY = 0, camStartMX = 0, camStartMY = 0;

    // Левый клик без перетаскивания выбирает тело: солнце / планету / луну.
    let downX = 0, downY = 0;
    canvas.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        downX = e.clientX;
        downY = e.clientY;
    });
    canvas.addEventListener('mouseup', e => {
        if (e.button !== 0) return;
        const moved = Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY);
        if (moved > 5 || !state.hoverTargets) return; // это было перетаскивание
        selectBody(findBodyAt(state.hoverTargets, e.clientX, e.clientY));
    });

    canvas.addEventListener('mousedown', e => {
        if (e.button !== 2) return;
        mouseDragging = true;
        mouseStartX = e.clientX;
        mouseStartY = e.clientY;
        camStartMX = state.camX;
        camStartMY = state.camY;
        canvas.style.cursor = 'grabbing';
    });

    // Курсор-указатель над выбираемыми объектами — те же цели, что выбираются
    // кликом (hoverTargets из render.js): солнце, планеты, луны, база.
    const updateCursor = (x, y) => {
        canvas.style.cursor = (state.hoverTargets && findBodyAt(state.hoverTargets, x, y)) ? 'pointer' : '';
    };

    window.addEventListener('mousemove', e => {
        // позиция курсора нужна и без зажатой кнопки — для hover-подсказок
        state.mouseX = e.clientX;
        state.mouseY = e.clientY;
        if (mouseDragging) {     // тянем карту — курсор остаётся «grabbing»
            state.camX = camStartMX + (e.clientX - mouseStartX) / state.zoom;
            state.camY = camStartMY + (e.clientY - mouseStartY) / state.zoom;
            return;
        }
        updateCursor(e.clientX, e.clientY);
    });

    canvas.addEventListener('mouseleave', () => {
        state.mouseX = -1;
        state.mouseY = -1;
        if (!mouseDragging) canvas.style.cursor = '';
    });

    window.addEventListener('mouseup', e => {
        if (e.button !== 2) return;
        mouseDragging = false;
        updateCursor(e.clientX, e.clientY);
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
// ui.js — DOM-интерфейс: HUD-показатели (зум/скорость/дата), боковые блоки
// «КАРТА СИСТЕМЫ» (дерево планет/лун) и «ОБЪЕКТ» (информация о выбранном).
// Выбор делается кликом по канвасу (selectBody вызывает input.js) или по
// элементу дерева. Шапка каждого блока сворачивает его — отдельных кнопок
// «скрыть/показать» нет. Работает с DOM, не с канвасом.
// =============================================================================






// Русские названия и подписи классов для блока «ОБЪЕКТ».
const RU = {
    Sun: 'Солнце', Mercury: 'Меркурий', Venus: 'Венера', Earth: 'Земля', Mars: 'Марс',
    Jupiter: 'Юпитер', Saturn: 'Сатурн', Uranus: 'Уран', Neptune: 'Нептун'
};
const TYPES = {
    rocky: 'Каменная планета', earth: 'Обитаемая планета',
    gas: 'Газовый гигант', ice: 'Ледяной гигант'
};

function fmtPeriod(days) {
    const d = Math.round(days * 100) / 100;
    return days >= 365.25
        ? d + ' сут (' + (days / 365.256).toFixed(2) + ' лет)'
        : d + ' сут';
}

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

/** Построить дерево «планета → луны», блок «Объект» и сворачивание блоков. */
function buildSidePanel() {
    const treeEl = document.getElementById('lootTree');

    planets.forEach(p => {
        const li = document.createElement('li');
        li.className = 'planet';
        li.dataset.kind = 'planet';
        li.dataset.name = p.name;
        const moons = moonTree[p.name] || [];
        li.innerHTML =
            '<div class="node">' +
                '<span class="caret">▶</span>' +
                '<span class="dot" style="background:' + p.color + '"></span>' +
                '<span class="pname">' + p.name + '</span>' +
                '<span class="cnt">☾ ' + moonTotals[p.name] + '</span>' +
            '</div>' +
            '<ul class="loot">' +
                moons.map(([n, t]) =>
                    '<li data-kind="moon" data-name="' + n + '" data-planet="' + p.name + '">' +
                    n + '<i>' + t + '</i></li>').join('') +
            '</ul>';
        // клик по шапке планеты: выбрать планету; клик по карет-зоне — только раскрыть
        li.querySelector('.node').addEventListener('click', e => {
            li.classList.toggle('open');
            selectBody({ kind: 'planet', p });
        });
        li.querySelectorAll('.loot li').forEach(mEl => {
            mEl.addEventListener('click', () => {
                const pName = mEl.dataset.planet;
                const planet = planets.find(x => x.name === pName);
                const m = moonFromTree(planet, mEl.dataset.name);
                selectBody({ kind: 'moon', p: planet, m });
            });
        });
        treeEl.appendChild(li);
    });

    // Солнце в дереве нет — выбирается только кликом по канвасу.

    // Шапки блоков сворачивают своё тело: отдельные кнопки «скрыть/показать» не нужны.
    document.querySelectorAll('#sidePanel .panel-head').forEach(head => {
        head.addEventListener('click', () => head.parentElement.classList.toggle('collapsed'));
    });
}

/**
 * Объект луны для выбора из дерева: настоящая луна из moonsByPlanet либо
 (у Земли) псевдо-луна, которую рисует render.js.
 */
function moonFromTree(planet, name) {
    const real = (moonsByPlanet[planet.name] || []).find(m => m.n === name);
    if (real) return real;
    return { n: name, period: planet.hasBase ? 27.321661 : 0, r: 3 };
}

/**
 * Выбрать объект (канвас или дерево): обновить state.selected, блок «Объект»
 * и подсветку в дереве. sel = null сбрасывает выбор.
 * Виды: {kind:'sun'|'planet'|'moon'|'base', p, m}.
 */
function selectBody(sel) {
    state.selected = sel;
    renderObjectInfo();
    highlightTree();
}

/** Заполнить блок «Объект» данными выбранного тела. */
function renderObjectInfo() {
    const box = document.getElementById('objectInfo');
    const sel = state.selected;

    if (!sel) {
        box.innerHTML = '<div class="obj-empty">Кликните по солнцу, планете, луне или базе на карте</div>';
        return;
    }

    let html = '';
    if (sel.kind === 'sun') {
        html =
            '<div class="obj-title"><span class="dot" style="background:#eeeeee"></span>' +
                '<strong>' + RU.Sun + ' / Sun</strong></div>' +
            '<div class="obj-kind">Звезда · G2V</div>' +
            row('Радиус отрисовки', SUN_R + ' <em>ед.</em>');
    } else if (sel.kind === 'planet') {
        const p = sel.p;
        const orbitR = Math.round(p.dist * 10) / 10;
        const mapMoons = moonsByPlanet[p.name] || [];
        html =
            '<div class="obj-title"><span class="dot" style="background:' + p.color + '"></span>' +
                '<strong>' + (RU[p.name] || p.name) + ' / ' + p.name + '</strong></div>' +
            '<div class="obj-kind">' + (TYPES[p.type] || 'Планета') + '</div>' +
            row('Период обращения', fmtPeriod(p.period)) +
            row('Радиус орбиты', orbitR + ' <em>ед.</em>') +
            row('Известных лун', moonTotals[p.name]) +
            row('На карте (крупные)', mapMoons.length);
    } else if (sel.kind === 'asteroid') {
        html = asteroidInfoHTML(sel.small);
    } else if (sel.kind === 'base') {
        html = baseInfoHTML();
    } else {
        const p = sel.p;
        const m = sel.m;
        const idx = (moonsByPlanet[p.name] || []).findIndex(x => x.n === m.n);
        const md = idx >= 0 ? p.r + 12 + idx * 7 : moonDist;
        html =
            '<div class="obj-title"><span class="dot" style="background:' + (m.c || '#a8a8a8') + '"></span>' +
                '<strong>' + m.n + '</strong></div>' +
            '<div class="obj-kind">Спутник · ' + (RU[p.name] || p.name) + '</div>' +
            row('Планета', (RU[p.name] || p.name) + ' / ' + p.name) +
            (m.period ? row('Период обращения', fmtPeriod(m.period)) : '') +
            row('Радиус орбиты', Math.round(md * 10) / 10 + ' <em>ед.</em>') +
            (p.hasBase && m.n.indexOf('Луна') === 0 ? row('На орбите', 'База LUNA-ORBIT') : '');
    }
    box.innerHTML = html;
}

/** Блок «Объект» для малого тела главного пояса (Церера, Веста, Паллада, Гигея). */
function asteroidInfoHTML(b) {
    return '<div class="obj-title"><span class="dot" style="background:#cfcfcf"></span>' +
            '<strong>' + b.name + '</strong></div>' +
        '<div class="obj-kind">' + b.note + ' · Главный пояс</div>' +
        row('Большая полуось', b.a + ' <em>а.е.</em>') +
        row('Эксцентриситет', b.e) +
        row('Период обращения', fmtPeriod(b.T)) +
        row('Перигелий / афелий', (b.a * (1 - b.e)).toFixed(2) + ' / ' + (b.a * (1 + b.e)).toFixed(2) + ' <em>а.е.</em>') +
        row('Диаметр', fmtRu(b.dia) + ' <em>км</em>') +
        '<div class="obj-note">Главный пояс — главный источник метеоритов Земли</div>';
}

function row(k, v) {
    return '<div class="obj-row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
}

/* ---------- База: купленные корабли из data/store.js ---------- */

/**
 * Блок «Объект» для базы: параметры орбиты и список купленных кораблей
 * в формате списка «В продаже» из ангара (имя, масса, категория, цена).
 * Данные — общие с админкой и ангаром (window.Store, ключ galaxy_admin_db_v1).
 */
function baseInfoHTML() {
    const ships = readUserShips();

    let html =
        '<div class="obj-title"><span class="dot" style="background:' + COLORS.base + ';box-shadow:0 0 8px rgba(0,255,255,.6)"></span>' +
            '<strong>База LUNA-ORBIT</strong></div>' +
        '<div class="obj-kind">Орбитальная база · Луна</div>' +
        '<div class="obj-rows">' +
            row('Луна', 'Луна / Moon') +
            row('Радиус орбиты', baseOrbitRadius + ' <em>ед.</em>') +
            (ships.length ? row('Куплено кораблей', ships.length) : '') +
        '</div>';

    html += '<div class="obj-sub-title"><span>Купленные корабли</span>' +
        (ships.length ? '<small>' + ships.length + ' ' + pluralRu(ships.length, ['позиция', 'позиции', 'позиций']) + '</small>' : '') +
        '</div>';

    if (!window.Store) {
        html += '<div class="obj-note">Данные админки недоступны — проверьте подключение data/store.js</div>';
    } else if (!ships.length) {
        html += '<div class="obj-note">Купленных кораблей пока нет — оформите покупку в ангаре</div>';
    } else {
        html += '<div class="ship-list">' + ships.map(shipRowHTML).join('') + '</div>';
    }
    return html;
}

/**
 * Строка купленного корабля — как строка «В продаже» в ангаре:
 * иконка, имя, «Масса N кг», категория и цена покупки.
 */
function shipRowHTML(rec) {
    let obj = null, cat = null, mass = 0;
    try {
        obj = Store.byId('objects', rec.shipId);
        cat = Store.byId('categories', rec.categoryId) ||
            (obj ? Store.byId('categories', obj.categoryId) : null);
        mass = Store.massOf(obj);
    } catch (e) { /* база повреждена — покажем запись без деталей */ }

    const price = parseFloat(String(rec.price || '').replace(',', '.'));
    const iconKey = (obj && obj.icon) || (cat && window.Icons ? Icons.forCategory(cat.name) : 'ship');
    const iconSVG = window.Icons ? Icons.svg(iconKey, 18) : '';

    return '<div class="ship-row">' +
        '<span class="ship-icon">' + iconSVG + '</span>' +
        '<span class="ship-copy"><strong>' + rec.name + '</strong>' +
            '<span>' + (mass ? 'Масса ' + fmtRu(mass) + ' кг' : 'Масса не задана') + '</span></span>' +
        '<span class="ship-meta"><small>' + (cat ? cat.name : '—') + '</small>' +
            (price > 0 ? '<b>' + fmtRu(price) + ' ¤</b>' : '') + '</span>' +
        '</div>';
}

/** Купленные корабли из общего хранилища; пусто, если база недоступна. */
function readUserShips() {
    try {
        const ships = window.Store && Store.userShips();
        return Array.isArray(ships) ? ships : [];
    } catch (e) {
        return [];
    }
}

function fmtRu(n) { return n.toLocaleString('ru-RU'); }

function pluralRu(n, forms) {
    const d = n % 10, dd = n % 100;
    if (d === 1 && dd !== 11) return forms[0];
    if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return forms[1];
    return forms[2];
}

/** Подсветить выбранный объект в дереве и раскрыть его планету. */
function highlightTree() {
    const sel = state.selected;
    document.querySelectorAll('#lootTree .sel').forEach(el => el.classList.remove('sel'));

    if (!sel || sel.kind === 'sun' || !sel.p) return; // у малых тел строки в дереве нет

    const tree = document.getElementById('lootTree');
    const li = Array.from(tree.children).find(el => el.dataset.name === sel.p.name);
    if (!li) return;
    li.classList.add('open');

    if (sel.kind === 'base') return; // у базы нет строки в дереве — раскрываем только Землю

    if (sel.kind === 'planet') {
        li.classList.add('sel');
    } else {
        const mEl = li.querySelector('.loot li[data-name="' + sel.m.n + '"]');
        if (mEl) mEl.classList.add('sel');
    }
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
    state.hoverTargets = hoverTargets; // для выбора по клику (input.js)

    // подсказки и орбиты поверх мира, уже в экранных координатах
    drawHover(ctx, hoverTargets);
    drawSelection(ctx, state.selected, hoverTargets);

    updateHud(hud);

    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
