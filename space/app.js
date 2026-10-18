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

// --- Стили карты -------------------------------------------------------------------
// Планеты — прозрачная заливка: тело читается только по обводке, одинаковой
// у всех; сквозь него видно звёздное небо. Солнце — жёлтая заливка.
const COLORS = {
    sun: '#ffd75e',
    sunStroke: '#ffffff',
    planetStroke: '#efefef',
    moon: '#a8a8a8',
    moonStroke: '#d6d6d6',
    base: '#00ffff', // функциональный маркер базы, не декор
    danger: '#ff5f7a', // удаление базы: имя и полоска прогресса (общий красный проекта)
    tooltip: '#ffffff',
    tooltipShadow: 'rgba(0,0,0,0.6)',
    orbitPlanet: 'rgba(120,140,200,0.6)',
    orbitMoon: 'rgba(150,160,180,0.6)',
    orbitSelected: 'rgba(122,236,224,0.8)' // орбита выбранного кликом тела (акцент hangar)
};

// Толщина обводок в пикселях экрана (делим на zoom при отрисовке).
// Солнце — самая толстая, у планет обводка одинаковая у всех (заливки нет),
// луны — самые тонкие.
const STROKE = {
    sun: 2.5,
    planet: 2,
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
// rings — рисовать кольца (Сатурн). type оставлен для совместимости.
const planets = [
    { name: 'Mercury', color: '#b5b5b5', r: 4,  dist: 70,  period: 87.969,   l0: 252.251, type: 'rocky' },
    { name: 'Venus',   color: '#e8cda0', r: 7,  dist: 110, period: 224.701,  l0: 181.980, type: 'rocky' },
    { name: 'Earth',   color: '#4488ff', r: 8,  dist: 160, period: 365.256,  l0: 100.464, type: 'earth' },
    { name: 'Mars',    color: '#c1440e', r: 5,  dist: 220, period: 686.980,  l0: 355.453, type: 'rocky' },
    { name: 'Jupiter', color: '#c88b3a', r: 22, dist: 380, period: 4332.589, l0: 34.396,  type: 'gas' },
    { name: 'Saturn',  color: '#e8d191', r: 18, dist: 520, period: 10759.22, l0: 49.954,  type: 'gas', rings: true },
    { name: 'Uranus',  color: '#7de8e8', r: 12, dist: 660, period: 30685.4,  l0: 313.238, type: 'ice' },
    { name: 'Neptune', color: '#3f54ba', r: 12, dist: 780, period: 60189.0,  l0: 304.880, type: 'ice' }
];

// Луна Земли: сидерический период 27.32 суток.
const moonDist = 22;          // радиус орбиты Луны от Земли
const moonPeriod = 27.321661; // суток
const moonL0 = 218.32;        // средняя долгота на J2000, градусы
// Базы игрока: на радиусе baseOrbitRadius виток занимает basePeriod суток,
// дальше период растёт по закону Кеплера (bases.js); на этом же радиусе
// рождается стартовая база LUNA-ORBIT.
const baseOrbitRadius = 10;
const basePeriod = 1;         // суток на виток (на радиусе baseOrbitRadius)

/**
 * Радиус орбиты i-й луны планеты на карте (единицы мира): главная луна на
 * p.r + 12, дальше шаг 7 — тем же порядком луны раскрываются при зуме.
 * Общий источник для render.js (отрисовка), ui.js (карточка) и bases.js
 * (коридор радиусов орбит баз: база не должна пересекать луну).
 */
function moonOrbitRadius(p, i) {
    return p.r + 12 + i * 7;
}

// Главные луны других планет: период (сутки), радиус отрисовки r, цвет c,
// стартовая фаза phase (градусы, произвольная). Порядок = порядок раскрытия
// при зуме (см. scene.js visibleCount): первыми показываются главные луны,
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
// Энке и Хейла—Боппа — у перигелия. shower — связанный метеорный поток,
// src — источник (oort — облако Оорта, kuiper — пояс Койпера),
// tailK — множитель длины хвоста (0.75–1.0, у крупных больше).
const comets = [
    { n: '1P/Halley',        ru: 'Галлея',         a: 17.834, e: 0.9671, peri: 111.3, m0: 234, dia: 11, shower: 'Ориониды · Эта-Аквариды', src: 'oort',   tailK: 1.0 },
    { n: '2P/Encke',         ru: 'Энке',           a: 2.2151, e: 0.8483, peri: 187.6, m0: 323, dia: 4.8, shower: 'Тауриды',                src: 'kuiper', tailK: 0.75 },
    { n: '109P/Swift-Tuttle', ru: 'Свифта—Таттла', a: 26.09,  e: 0.9633, peri: 113.4, m0: 289, dia: 26, shower: 'Персеиды',               src: 'oort',   tailK: 1.0 },
    { n: 'C/1995 O1',        ru: 'Хейла—Боппа',    a: 186.0,  e: 0.9951, peri: 130.6, m0: 0,   dia: 60, shower: null,                     src: 'oort',   tailK: 0.9 }
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

    // --- Звёздные базы ------------------------------------------------------------
    // Режим выбора орбиты: {kind:'planet'|'moon', planet, moon, snap, moveId?};
    // snap — снимок соседей на старте режима, moveId — переносимая база.
    baseMode: null,
    baseRadius: 60,     // текущий радиус выбираемой орбиты, единицы мира

    // --- Полёт камеры ------------------------------------------------------------
    fly: null,          // твин полёта к строке блока «Малые тела» (ui.js)

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
// scene.js — генерация фона сцены (звёзды) и правила показа тел при масштабе:
// сколько тел семейства помещается при текущем зуме (visibleCount) и как не
// поместившиеся схлопываются в маркер-представителя (groupPlan — общий
// механизм: луны планет и семейства малых тел сейчас, планеты на масштабе
// системы и звёздные системы — далее). Малые тела (пояс астероидов, ОЗА,
// троянцы, кометы, дальние пояса) живут в отдельном модуле smallbodies.js.
// Позиции тел здесь не считаются — это делает render.js каждый кадр из simDays.
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
 * Сколько тел семейства показывать при текущем зуме — общая шкала лун планет
 * и семейств малых тел (крупнейшие тела пояса, ОЗА по классам, троянцы L4/L5,
 * кометы). Логарифмическая: 1 тело при zoom=1, далее +1 за каждый множитель
 * ZOOM_STEP (~1.4); к MAX_ZOOM показываются все тела списка. Вызывающий берёт
 * из своего списка ровно столько. Полностью семейства не скрываются: ниже
 * zoom=1 шкала даёт 0, но механизм группировки (groupPlan) всё равно оставляет
 * тело-представителя.
 * @returns {number}
 */
function visibleCount() {
    if (state.zoom < 1.0) return 0;
    const ZOOM_STEP = 1.4;
    return 1 + Math.floor(Math.log(state.zoom) / Math.log(ZOOM_STEP));
}

/**
 * Универсальная группировка небесных тел при отдалении — один механизм для
 * лун планет и семейств малых тел (сейчас), а в дальнейшем — планет на
 * масштабе системы и звёздных систем.
 *
 * Точками рисуются первые fit тел списка, но не меньше одного: последнее
 * показанное тело остаётся представителем. Хвост списка — оно же плюс все
 * скрытые — схлопывается в группу при представителе и подписывается двумя
 * строками:
 *   • первая — имена тел группы через запятую (nameOf);
 *   • вторая — базы, привязанные к телам группы: имена собираются из baseOf
 *     каждого тела, тоже через запятую (тел без баз вторую строку не дают
 *     вовсе).
 *
 * Тела — любые записи в своём порядке показа; чем именно к телу привязаны
 * базы, знает вызывающий (baseOf): у лун — hostKind 'moon' и имя луны, у
 * планет — hostKind 'planet'. У малых тел баз пока нет — baseOf им не
 * передают, и вторая строка подписи не появляется.
 *
 * @param {Array}   items  тела в порядке показа (порядок и fit решает вызов)
 * @param {number}  fit    сколько тел помещается при текущем масштабе
 * @param {Object} [opts]
 * @param {Function} [opts.nameOf] имя тела для подписи (по умолчанию m.n || m.name)
 * @param {Function} [opts.baseOf] базы игрока на теле: массив записей bases
 *                                 (по умолчанию тело считается чистым)
 * @returns {{shown: Array, group: ?Object}}
 *   shown — тела, рисуемые отдельными точками: { m — тело, i — его индекс };
 *   group — null, если видны все тела; иначе:
 *     at        — индекс представителя в shown (последнее показанное тело);
 *     items     — тела группы: представитель первым, затем скрытые;
 *     bases     — базы, привязанные к телам группы (для маркеров);
 *     label     — первая строка подписи: имена тел через запятую;
 *     baseLabel — вторая строка подписи: имена баз через запятую
 *                 (null, если привязанных баз нет).
 */
function groupPlan(items, fit, opts = {}) {
    const total = items.length;
    if (total === 0) return { shown: [], group: null };

    const nameOf = opts.nameOf || (m => m.n || m.name);
    const baseOf = opts.baseOf || (() => []);

    // ни одно тело не скрывается полностью: последнее показанное остаётся
    // представителем группы, даже когда масштаб даёт fit = 0
    const shownCount = Math.max(1, Math.min(fit, total));
    const shown = items.slice(0, shownCount).map((m, i) => ({ m, i }));
    if (shownCount >= total) return { shown, group: null };

    const members = items.slice(shownCount - 1);   // представитель + скрытые
    const bases = [];
    members.forEach(m => baseOf(m).forEach(b => bases.push(b)));

    return {
        shown,
        group: {
            at: shownCount - 1,
            items: members,
            bases,
            label: members.map(nameOf).join(', '),
            baseLabel: bases.length ? bases.map(b => b.name).join(', ') : null
        }
    };
}

// ===== smallbodies.js =====
// =============================================================================
// smallbodies.js — малые тела Солнечной системы отдельным слоем мира:
// главный пояс (частицы + крупнейшие тела + щели Кирквуда), околоземные
// астероиды (Атон/Аполлон/Амур), троянцы Юпитера (L4/L5), кометы, пояс
// Койпера и облако Оорта.
//
// Именованные тела семейств (крупнейшие тела пояса, ОЗА по классам, троянцы
// L4/L5, кометы) группируются при отдалении общим механизмом scene.js
// groupPlan: помещается visibleCount() тел семейства, хвост схлопывается в
// тело-представителя с подписью в две строки (см. drawSmallBodies).
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
    ru: b.ru,
    note: b.type === 'dwarf' ? 'Карликовая планета' : 'Крупный астероид',
    a: b.a, e: b.e, peri: b.peri, m0: b.m0, dia: b.dia,
    T: periodFromA(b.a),
    r: b.type === 'dwarf' ? 3.2 : 2.6,
    x: 0, y: 0,
    orbit: orbitEllipse(b.a, b.e, b.peri)
}));

// --- Околоземные астероиды (ОЗА) ----------------------------------------------
/**
 * Точки орбиты для подсветки (hover/выбор): маппинг а.е.→единицы нелинеен,
 * поэтому «эллипс по (a, e)» верен лишь в линейных зонах шкалы. Надёжнее
 * сэмплировать положения по тем же элементам, что и движение.
 * @returns {number[]} плоский массив x0, y0, x1, y1, … (мир, замкнутая петля)
 */
function orbitPoly(a, e, peri, T) {
    const pts = [];
    for (let k = 0; k <= 96; k++) {
        const pos = keplerPos(a, e, peri, 0, T, k * T / 96);
        pts.push(pos.x, pos.y);
    }
    return pts;
}

/** Малое тело карты: общие поля для hover и карточек (элементы, орбита, тип). */
function smallBody(id, kind, name, src, r, extra) {
    const T = periodFromA(src.a);
    return Object.assign({
        id, kind, name,
        a: src.a, e: src.e, peri: src.peri, m0: src.m0, dia: src.dia,
        T,
        q: src.a * (1 - src.e), Q: src.a * (1 + src.e),
        r, x: 0, y: 0,
        orbit: orbitEllipse(src.a, src.e, src.peri),
        poly: orbitPoly(src.a, src.e, src.peri, T)
    }, extra || {});
}

// Реальные элементы — из data.js; шесть безымянных досыпаны по границам групп:
// амур — перигелий между орбитами Земли и Марса; аполлон — пересекает орбиту
// Земли, a > 1; атон — пересекает, a < 1. Орбиты заметно эллиптические.
const NEA_SEED = 20261018;
const neaRng = makeRng(NEA_SEED);

const neaBodies = neas.map(n =>
    smallBody('nea-' + n.n, 'nea', n.ru + ' / ' + n.n, n, 1.6, { group: n.group, ru: n.ru }));

for (let i = 0; i < 6; i++) {
    const group = ['amor', 'apollo', 'aten'][i % 3];
    let q, Q;
    if (group === 'amor') {
        q = 1.05 + neaRng() * 0.35;                        // 1.05–1.40: орбиту Земли не пересекает
        Q = 1.7 + neaRng() * 1.6;
    } else if (group === 'apollo') {
        q = 0.30 + neaRng() * 0.65;
        Q = (2.02 - q) + neaRng() * (3.7 - (2.02 - q));    // a > 1 а.е.
    } else {
        const aAten = 0.85 + neaRng() * 0.14;              // a < 1 а.е.
        q = 0.35 + neaRng() * (Math.min(0.85, 2 * aAten - 1.06) - 0.35);
        Q = 2 * aAten - q;                                 // афелий выше орбиты Земли
    }
    const a = (q + Q) / 2, e = (Q - q) / (Q + q);
    neaBodies.push(smallBody('nea-gen-' + i, 'nea', null,
        { a, e, peri: neaRng() * 360, m0: neaRng() * 360 }, 1.2, { group }));
}

// --- Троянцы Юпитера (L4/L5) ----------------------------------------------------
// Два облака точек на 60° впереди и позади Юпитера вдоль его орбиты (60 и 40
// точек) с медленной либрацией ±5° за ~150 лет; точки движутся синхронно с
// Юпитером. Именованные (Ахиллес, Гектор…) — заметнее и выбираются.
const TROJAN_SEED = 20261018;
const TROJAN_LIB_PERIOD = 54786;   // период либрации, сутки (~150 лет)
const TROJAN_LIB_AMP = 5;          // амплитуда либрации, градусы
const trojanRng = makeRng(TROJAN_SEED);

const trojanClouds = [
    { camp: 4, points: [] },     // L4 — впереди Юпитера
    { camp: 5, points: [] }      // L5 — позади
];
trojanClouds.forEach((c, ci) => {
    const n = ci === 0 ? 60 : 40;
    for (let i = 0; i < n; i++) {
        c.points.push({
            id: 'trojan-' + c.camp + '-' + i,
            dAng: (trojanRng() - 0.5) * 16,   // ±8° вокруг центра облака
            dR: (trojanRng() - 0.5) * 28,     // ±14 ед. поперёк орбиты
            s: 0.7 + trojanRng() * 0.6
        });
    }
});

/** Либрация облака L4/L5 вокруг точки ±60°, градусы. */
function trojanLib(t, camp) {
    return TROJAN_LIB_AMP * Math.sin(2 * Math.PI * t / TROJAN_LIB_PERIOD + (camp === 4 ? 0 : 2.1));
}

const trojanBodies = trojanNames.map(t => ({
    id: 'trojan-' + t.n,
    kind: 'trojan',
    name: t.ru + ' / ' + t.n,
    ru: t.ru,
    camp: t.camp, dAng: t.dAng, dR: t.dR,
    r: 2.2, x: 0, y: 0,
    orbit: { cx: 0, cy: 0, r: JUPITER.dist }
}));

// --- Пояс Койпера и облако Оорта ------------------------------------------------
// Разреженная пыль без имён (не выбирается). Койпер — 30–50 а.е. в радиусах
// карты (auToDist), Оорт — сфера 1300–1800 единиц. Точки рисуются
// прямоугольниками (дешевле дуг) с минимальным экранным размером 1.1 px;
// точки вне кадра отбрасываются по полудиагонали, полоса — целиком.
const DUST_SEED = 20261018;
const dustRng = makeRng(DUST_SEED);

/** Собрать кольцо пыли: мировые позиции, границы радиусов и группы по цвету. */
function makeDustRing(list) {
    let rMin = Infinity, rMax = 0;
    const map = new Map();
    for (const p of list) {
        p.x = Math.cos(p.ang) * p.r;
        p.y = -Math.sin(p.ang) * p.r;
        if (p.r < rMin) rMin = p.r;
        if (p.r > rMax) rMax = p.r;
        let g = map.get(p.col);
        if (!g) { g = { col: p.col, points: [] }; map.set(p.col, g); }
        g.points.push(p);
    }
    return { rMin, rMax, groups: [...map.values()] };
}

const kuiperDust = makeDustRing(Array.from({ length: 600 }, () => {
    const al = 0.22 + dustRng() * 0.23;
    return {
        ang: dustRng() * Math.PI * 2,
        r: auToDist(30 + dustRng() * 20),              // 30–50 а.е.
        s: 0.8 + dustRng() * 1.0,
        col: 'rgba(150,150,150,' + al.toFixed(2) + ')'
    };
}));

const oortDust = makeDustRing(Array.from({ length: 350 }, () => {
    const al = 0.16 + dustRng() * 0.18;
    return {
        ang: dustRng() * Math.PI * 2,
        r: 1300 + dustRng() * 500,                     // 1300–1800 ед.
        s: 0.8 + dustRng() * 1.0,
        col: 'rgba(150,150,150,' + al.toFixed(2) + ')'
    };
}));

/** Нарисовать кольцо пыли: полоса или точка вне кадра — пропускаются; fillStyle
 *  переключается по цветовым группам (иначе на 950 точек — 950 переключений). */
function drawDustRing(ctx, ring, zoom) {
    const half = Math.hypot(state.W, state.H) / 2 / zoom + 2;
    const camD = Math.hypot(state.camX, state.camY);
    if (camD + half < ring.rMin || camD - half > ring.rMax) return;  // вся полоса вне кадра

    const minS = 1.1 / zoom;
    const h2 = half * half;
    for (const g of ring.groups) {
        ctx.fillStyle = g.col;
        for (const p of g.points) {
            if ((p.x - state.camX) ** 2 + (p.y - state.camY) ** 2 > h2) continue;
            const s = Math.max(p.s, minS);
            ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        }
    }
}

// --- Кометы ---------------------------------------------------------------------
// Ядро, кома и хвост, направленный от Солнца. Длина хвоста — в экранных
// пикселях: (26 + 46·pf)·tailK / zoom, где pf = q/r — близость к перигелию.
const cometBodies = comets.map(c =>
    smallBody('comet-' + c.n, 'comet', c.ru + ' / ' + c.n, c, 1.4,
        { shower: c.shower, src: c.src, tailK: c.tailK, ru: c.ru }));

/**
 * Нарисовать малые тела в мировой системе координат (вызывается из render.js
 * после звёзд). Именованные тела семейств группируются при отдалении тем же
 * механизмом, что луны планет (scene.js groupPlan, шкала visibleCount):
 * показанные тела — точки и hover-цели, хвост семейства схлопывается в
 * тело-представителя, и подпись группы уходит в groups — render.js рисует её
 * общей drawGroupLabel. Безымянные досыпанные ОЗА — вне групп: их не выбирают.
 * @returns {{targets: Array, groups: Array}} targets — hover-цели (как раньше);
 *   groups — { x, y, group } подписи групп у тел-представителей
 */
function drawSmallBodies(ctx) {
    const { simDays, zoom } = state;
    const targets = [];
    const groups = [];
    const fit = visibleCount();

    /** Хвост семейства (если не поместился) — подписью у тела-представителя. */
    function pushGroup(plan) {
        if (!plan.group) return;
        const rep = plan.shown[plan.group.at].m;
        groups.push({ x: rep.x, y: rep.y, group: plan.group });
    }

    // Дальняя пыль фоном: пояс Койпера и облако Оорта (под всеми телами)
    drawDustRing(ctx, kuiperDust, zoom);
    drawDustRing(ctx, oortDust, zoom);

    // Частицы пояса
    ctx.fillStyle = '#6e6e6e';
    asteroids.forEach(a => {
        const ang = orbitAngle(a.l0, a.period, simDays);
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * a.d, -Math.sin(ang) * a.d, a.s, 0, Math.PI * 2);
        ctx.fill();
    });

    // Крупнейшие тела пояса — заметные точки с обводкой, выбираются
    const notablePlan = groupPlan(notables, fit, { nameOf: m => m.ru });
    notablePlan.shown.forEach(({ m: b }) => {
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
    pushGroup(notablePlan);

    // ОЗА: сначала позиции всех тел, затем безымянные — тусклые точки всегда
    // (в группы не входят, их не выбирают), именованные — по классам
    // (amor/apollo/aten): у каждого класса своё число показанных и своя группа
    neaBodies.forEach(b => {
        const pos = keplerPos(b.a, b.e, b.peri, b.m0, b.T, simDays);
        b.x = pos.x;
        b.y = pos.y;
    });

    ctx.fillStyle = '#8a8a8a';
    neaBodies.forEach(b => {
        if (b.name) return;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
    });

    ['amor', 'apollo', 'aten'].forEach(g => {
        const plan = groupPlan(neaBodies.filter(b => b.name && b.group === g), fit,
            { nameOf: m => m.ru });
        plan.shown.forEach(({ m: b }) => {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fillStyle = '#d8d8d8';
            ctx.fill();
            ctx.strokeStyle = '#f0f0f0';
            ctx.lineWidth = STROKE.moon / zoom;
            ctx.stroke();
            targets.push({ kind: 'nea', name: b.name, x: b.x, y: b.y, r: b.r, moons: [], small: b });
        });
        pushGroup(plan);
    });

    // Троянцы: два облака точек, синхронных с Юпитером (плюс либрация)
    const jupAng = orbitAngle(JUPITER.l0, JUPITER.period, simDays);
    ctx.fillStyle = '#808080';
    trojanClouds.forEach(c => {
        const base = jupAng + c.camp * Math.PI / 3 + trojanLib(simDays, c.camp) * Math.PI / 180;
        c.points.forEach(p => {
            const ang = base + p.dAng * Math.PI / 180;
            const rr = JUPITER.dist + p.dR;
            ctx.beginPath();
            ctx.arc(Math.cos(ang) * rr, -Math.sin(ang) * rr, p.s, 0, Math.PI * 2);
            ctx.fill();
        });
    });

    // Именованные троянцы — заметные точки с обводкой, выбираются; позиции
    // всех, затем группировка по облакам (L4 и L5 — отдельные семейства)
    trojanBodies.forEach(b => {
        const ang = jupAng + b.camp * Math.PI / 3 + (b.dAng + trojanLib(simDays, b.camp)) * Math.PI / 180;
        const rr = JUPITER.dist + b.dR;
        b.x = Math.cos(ang) * rr;
        b.y = -Math.sin(ang) * rr;
    });

    [4, 5].forEach(camp => {
        const plan = groupPlan(trojanBodies.filter(b => b.camp === camp), fit,
            { nameOf: m => m.ru });
        plan.shown.forEach(({ m: b }) => {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fillStyle = '#cfcfcf';
            ctx.fill();
            ctx.strokeStyle = '#efefef';
            ctx.lineWidth = STROKE.moon / zoom;
            ctx.stroke();

            targets.push({ kind: 'trojan', name: b.name, x: b.x, y: b.y, r: b.r, moons: [], small: b });
        });
        pushGroup(plan);
    });

    // Кометы: ядро, кома и хвост, направленный от Солнца. Показанные — по
    // общему плану; скрытые группой не рисуются, их имена уходят в подпись
    // представителя (как и у остальных семейств)
    const cometPlan = groupPlan(cometBodies, fit, { nameOf: m => m.ru });
    cometPlan.shown.forEach(({ m: b }) => {
        const pos = keplerPos(b.a, b.e, b.peri, b.m0, b.T, simDays);
        b.x = pos.x;
        b.y = pos.y;

        const pf = clamp(b.q / Math.max(pos.rAu, 0.001), 0, 1);  // близость к перигелию
        const len = (26 + 46 * pf) * b.tailK / zoom;             // хвост в пикселях экрана
        const d = Math.hypot(pos.x, pos.y) || 1;
        const dx = pos.x / d, dy = pos.y / d;                    // от Солнца

        // хвост: сужающийся треугольник вдоль антисолнечного луча
        const w0 = 1.6 / zoom;
        const tipX = pos.x + dx * len, tipY = pos.y + dy * len;
        const grad = ctx.createLinearGradient(pos.x, pos.y, tipX, tipY);
        grad.addColorStop(0, 'rgba(230,230,230,0.42)');
        grad.addColorStop(0.55, 'rgba(225,225,225,0.15)');
        grad.addColorStop(1, 'rgba(220,220,220,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(pos.x - dy * w0, pos.y + dx * w0);
        ctx.lineTo(pos.x + dy * w0, pos.y - dx * w0);
        ctx.lineTo(tipX, tipY);
        ctx.closePath();
        ctx.fill();

        // кома — радиальное свечение вокруг ядра
        const comaR = 9 / zoom;
        const coma = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, comaR);
        coma.addColorStop(0, 'rgba(235,235,235,0.5)');
        coma.addColorStop(0.5, 'rgba(220,220,220,0.16)');
        coma.addColorStop(1, 'rgba(220,220,220,0)');
        ctx.fillStyle = coma;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, comaR, 0, Math.PI * 2);
        ctx.fill();

        // ядро
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = '#f0f0f0';
        ctx.fill();

        targets.push({ kind: 'comet', name: b.name, x: pos.x, y: pos.y, r: b.r, moons: [], small: b });
    });
    pushGroup(cometPlan);

    return { targets, groups };
}

// ===== bases_name.js =====
// =============================================================================
// bases_name.js — имена новых баз игрока: список для случайного выбора.
//
// При создании базы bases.js берёт отсюда случайное название (индекс в этом
// массиве — «id имени», хранится в записи базы). Если название уже выпадало,
// к нему дописывается номер («Красная луна - 2») по счётчику реестра имён —
// отдельного ключа localStorage «galaxy_space_base_names_v1» (bases.js).
// =============================================================================

const BASE_NAMES = [
    'Красная луна',
    'Тихая гавань',
    'Полярная звезда',
    'Лунный свет',
    'Звёздный мост',
    'Ночной дозор',
    'Северное сияние',
    'Чёрная бездна',
    'Белый карлик',
    'Синий гигант',
    'Красный карлик',
    'Железный ветер',
    'Солнечный парус',
    'Ледяная комета',
    'Огненный шар',
    'Млечный путь',
    'Туманность Андромеды',
    'Пояс Ориона',
    'Лунная тень',
    'Звёздная пыль',
    'Кольца Сатурна',
    'Утренняя заря',
    'Дальний рубеж',
    'Тихий океан',
    'Стальная орбита',
    'Серебряный луч',
    'Золотая игла',
    'Ледяной щит',
    'Огненный хребет',
    'Кристальный грот',
    'Тёмная сторона',
    'Обратный отсчёт',
    'Первый рассвет',
    'Последний рубеж',
    'Алмазный дождь',
    'Металлический шторм',
    'Кислородный сад',
    'Зелёная долина',
    'Красная пустыня',
    'Голубая лагуна',
    'Стеклянный купол',
    'Купол надежды',
    'Восход Земли',
    'Голубая планета',
    'Пыльный шторм',
    'Солнечный ветер',
    'Магнитный полюс',
    'Радиационный пояс',
    'Внешний рубеж',
    'Внутренний круг',
    'Гравитационный колодец',
    'Точка Лагранжа',
    'Пояс Кларка',
    'Синхронная орбита',
    'Галактический маяк',
    'Маяк надежды',
    'Дальний маяк',
    'Синий лёд',
    'Белая ночь',
    'Полярный день',
    'Траектория света',
    'Искра жизни',
    'Орбитальный причал',
    'Свободный порт',
    'Синий поток',
    'Железный лес',
    'Магнитная буря',
    'Ионный след',
    'Плазменный факел',
    'Фотонный луч',
    'Кварцевый берег',
    'Янтарная заря',
    'Изумрудный остров',
    'Обсидиановая крепость',
    'Титановая воля',
    'Звёздный ковчег',
    'Северный ковчег',
    'Вечный странник',
    'Комета удачи',
    'Кратер Армстронга',
    'Море Спокойствия',
    'Океан Бурь',
    'Море Дождей',
    'Море Ясности',
    'Вершина Олимпа',
    'Ледяное эхо',
    'Ветер пустоты',
    'Космическая тишина',
    'За гранью',
    'Край тьмы',
    'Око бури',
    'Ядро галактики',
    'Рукав Ориона',
    'Свет Веги',
    'Врата Центавра',
    'Путь домой',
    'Порт мечты',
    'Зов звёзд',
    'Эхо вселенной',
    'Тихий причал'
];

// ===== bases_removed.js =====
// =============================================================================
// bases_removed.js — архив удалённых баз игрока.
//
// Когда удаление базы (bases.js, статус 'removing') доходит до конца, её
// запись целиком переезжает сюда: копия с отметкой «status: 'removed'» и
// датой removedAt. В хранилище баз (galaxy_space_bases_v1) остаётся
// запись-надгробие с тем же статусом — «где была информация о базе, отметка,
// что она удалена»; на карте такие базы не рисуются, в списках не
// показываются.
//
// Архив — свой ключ localStorage («galaxy_space_bases_removed_v1»); данные
// админки/ангара не задействованы.
// =============================================================================

const REMOVED_KEY = 'galaxy_space_bases_removed_v1';

/** Прочитать архив удалённых баз; битые данные не роняют карту. */
function loadRemoved() {
    try {
        const raw = localStorage.getItem(REMOVED_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr.filter(b => b && b.id && b.planet) : [];
    } catch (e) {
        return [];
    }
}

/** Записать архив удалённых баз (ключ отдельный от хранилища баз). */
function saveRemoved() {
    try {
        localStorage.setItem(REMOVED_KEY, JSON.stringify(basesRemoved));
    } catch (e) { /* нет доступа/переполнено — архив не сохранится */ }
}

/** Удалённые базы — полные копии записей на момент конца удаления. */
const basesRemoved = loadRemoved();

/**
 * Перенести запись базы в архив: полная копия со статусом 'removed'.
 * Зовёт bases.js, когда у базы вышел таймер удаления.
 * @param {Object} rec запись базы
 */
function archiveBase(rec) {
    basesRemoved.push({
        ...rec,
        status: 'removed',
        removedAt: rec.removedAt || new Date().toISOString()
    });
    saveRemoved();
}

// ===== bases.js =====
// =============================================================================
// bases.js — звёздные базы игрока: хранилище, создание и отрисовка.
//
// База прикреплена к планете или луне и летает по круговой орбите вокруг неё.
// Новые базы создаются прямо на карте: кнопка «Создать базу» в карточке
// планеты/луны включает режим выбора орбиты — радиус берётся от курсора,
// клик подтверждает (input.js). У созданной базы в карточке есть кнопка
// «Переместить базу» — тот же режим; клик переносит запись на выбранную
// орбиту (хост при этом выбирается по правилу ближайшего тела). Второй
// кнопкой — «Удалить базу»: база уходит в статус 'removing' на
// BASE_REMOVAL_MS реального времени — ей нельзя пользоваться (перенос и
// повторное удаление недоступны), а на карте и в карточке висит таймер
// до конца разбора. Потом запись получает статус 'removed' (надгробие в
// хранилище) и целиком переезжает в архив bases_removed.js — с орбиты база
// исчезает. При переносе
// база встаёт со стороны курсора: направление от центра хозяина к курсору
// становится её положением на орбите и в превью, и в записи (phase0); новая
// база тоже появляется с этой стороны, а не в случайной точке. Радиус орбиты
// зажат в коридор baseRadiusRange: от поверхности хозяина до ближайшей чужой
// «полосы» — дисков Солнца и соседних планет (база у Меркурия не дотянется до
// орбиты Венеры) и соседних тел (лун планеты или планеты и лун-соседей у базы
// на луне); так орбита базы не пересекает ни тела, ни их орбиты. Вдобавок
// орбита разводится с другими базами того же хозяина (BASE_SAME_GAP): кольца
// баз не сливаются (fitBaseRadius). Стартовая база LUNA-ORBIT, которую
// render.js раньше рисовал жёстко у Луны Земли, при загрузке становится
// обычной записью механизма. Период
// обращения — как у Луны: одни сутки на радиусе
// baseOrbitRadius, дальше по закону Кеплера.
//
// Хранение — ОТДЕЛЬНЫЙ ключ localStorage («galaxy_space_bases_v1»): данные
// админки/ангара (window.Store) не задействованы. Пока это только создание
// и отображение; корабли и экономика — позже.
//
// Имя новой базы — случайное из BASE_NAMES (bases_name.js); в записи базы
// хранятся id имени, текст и счётчик использований. Повтор выпадения получает
// суффикс («Красная луна - 2»). Сколько раз имя выпадало и где стоят названные
// им базы, помнит реестр имён — ещё один отдельный ключ localStorage
// («galaxy_space_base_names_v1»); с записями он синхронизируется при загрузке.
//
// Рисуется из render.js в мировой системе координат; позиции хост-тел
// (планет/лун) передаются картой hostPos после их отрисовки. Подпись базы на
// видимой луне — в две строки: сверху имя спутника, снизу имя базы (та же
// связка «тело над базой», что в подписи группы лун; у скрытой зумом луны имя
// спутника несёт подпись группы, и своя подпись базы гасится).
// =============================================================================








const STORAGE_KEY = 'galaxy_space_bases_v1';
const NAMES_KEY = 'galaxy_space_base_names_v1';   // реестр имён новых баз

// Абсолютный потолок радиуса орбиты базы (единицы мира): дальше она теряется
// на фоне системы. Нижняя граница и потолок по соседям — в baseRadiusRange().
const BASE_MAX_R = 300;

// Запас между орбитой базы и поверхностью тел: хозяина и соседей (единицы мира).
const BASE_CLEAR = 4;

// Минимальный зазор между орбитами двух баз одного хозяина: кольца не
// сливаются в одно. Если коридор уже забит и свободного места нет (у лун места
// мало), база встаёт в точку с наибольшим зазором — см. fitRadius.
const BASE_SAME_GAP = 3;

// Сколько реального времени база «разбирается» после нажатия «Удалить базу».
const BASE_REMOVAL_MS = 4000;

// Невидимая «панель» подписи базы на карте: одна ширина на все базы, экранные
// пиксели (сама панель не рисуется — ни фона, ни рамки). Имя длиннее панели
// подрезается с «…», при наведении на базу едет бегущей строкой, а полоска
// разбора при удалении тянется во всю панель.
const BASE_LABEL_W = 96;

// Бегущая строка подписи: id базы -> момент начала наведения (performance.now),
// пока курсор на базе. Чисто экранная память — в хранилище не попадает.
const labelScrollFrom = new Map();

/** Период обращения базы на радиусе r: как у Луны, дальше — по Кеплеру. */
function basePeriodAt(r) {
    return basePeriod * Math.pow(r / baseOrbitRadius, 1.5);
}

/**
 * Допустимый коридор радиуса орбиты базы вокруг хозяина: от поверхности
 * хозяина до ближайшей чужой «полосы» — так орбита базы не пересекает ни
 * небесные тела, ни их орбиты:
 *   • Солнце — диск звезды;
 *   • другие планеты — полосы, которые заметают их диски: база у Меркурия
 *     не дотянется до орбиты Венеры, база у Венеры — до Меркурия и Земли;
 *   • луны — у базы на планете все её луны (даже невидимые при текущем
 *     зуме), у базы на луне — планета под ней и соседние луны той же планеты.
 * Для базы на луне полосы Солнца и планет сдвинуты на радиус орбиты луны
 * (md): база ходит вокруг луны и не выходит за её окрестность. Если сосед
 * слишком близко и коридор вырождается, хозяин приоритетнее: max = min
 * (база прижата к поверхности хозяина; запас BASE_CLEAR съедается).
 * @param {{kind: string, planet: string, moon: ?string}} host
 * @returns {{min: number, max: number}} границы радиуса, единицы мира
 */
function baseRadiusRange(host) {
    const p = planets.find(q => q.name === host.planet);
    if (!p) return { min: BASE_CLEAR, max: BASE_MAX_R };

    // md — радиус орбиты хозяина-луны вокруг планеты (0 — база у планеты):
    // на столько отодвинуто «кольцо» базы и на столько же экранируются
    // внешние полосы (Солнце и другие планеты).
    let md = 0;
    let min, max = BASE_MAX_R;

    if (host.kind === 'moon') {
        const list = moonsByPlanet[host.planet] || [];
        const idx = list.findIndex(m => m.n === host.moon);
        // Луна Земли рисуется отдельным блоком (render.js): своя дистанция и радиус
        const mr = idx >= 0 ? list[idx].r : 3;
        md = idx >= 0 ? moonOrbitRadius(p, idx) : moonDist;
        min = mr + BASE_CLEAR;
        max = Math.min(max, md - p.r - BASE_CLEAR);   // диск планеты под луной
        list.forEach((m, i) => {                       // соседние луны: их диски на своих кольцах
            if (i === idx) return;
            max = Math.min(max, Math.abs(moonOrbitRadius(p, i) - md) - m.r - BASE_CLEAR);
        });
    } else {
        min = p.r + BASE_CLEAR;
        (moonsByPlanet[p.name] || []).forEach((m, i) => {   // свои луны: все кольца, даже невидимые
            max = Math.min(max, moonOrbitRadius(p, i) - m.r - BASE_CLEAR);
        });
        if (p.name === 'Earth') max = Math.min(max, moonDist - 3 - BASE_CLEAR); // Луна Земли (r=3, render.js)
    }

    // Солнце и другие планеты: расстояние от Солнца до базы лежит в
    // [p.dist − md − R, p.dist + md + R] — берём у каждой полосы ближний край.
    max = Math.min(max, p.dist - md - SUN_R - BASE_CLEAR);
    planets.forEach(q => {
        if (q === p) return;
        max = Math.min(max, Math.abs(q.dist - p.dist) - q.r - md - BASE_CLEAR);
    });

    return { min, max: Math.max(min, max) };
}

/** Прочитать базы из localStorage; битые данные не роняют карту. */
function loadBases() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr)
            ? arr.filter(b => b && b.id && b.planet && b.orbitRadius > 0)
                 .map(b => ({ status: 'active', ...b }))   // старые записи — активные
            : [];
    } catch (e) {
        return [];
    }
}

/** Записать базы в localStorage (ключ отдельный от данных проекта). */
function saveBases() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bases));
    } catch (e) { /* нет доступа/переполнено — базы просто не сохранятся */ }
}

/** Записи баз + позиции x/y, обновляемые каждый кадр при отрисовке. */
const bases = loadBases();

/** Ключ хоста: 'planet:Mars' или 'moon:Mars:Фобос / Phobos'. */
function hostKey(kind, planet, moon) {
    return kind === 'planet' ? 'planet:' + planet : 'moon:' + planet + ':' + moon;
}

/**
 * Свободный радиус орбиты с учётом баз того же хозяина: из коридора
 * baseRadiusRange исключаются «полосы» rb ± BASE_SAME_GAP вокруг орбит
 * соседних баз, берётся ближайшая к желаемой свободная точка. Если коридор
 * слишком узкий и свободного места нет (у лун места мало), выбирается точка с
 * наибольшим зазором от чужих орбит — кольца баз не сливаются, пока это
 * геометрически возможно.
 * @param {number} r желаемый радиус
 * @param {{kind: string, planet: string, moon: ?string}} host
 * @param {Array<number>} blocked радиусы орбит других баз хозяина
 * @returns {number} радиус, округлённый до десятых (как все орбиты баз)
 */
function fitRadius(r, host, blocked) {
    const { min, max } = baseRadiusRange(host);
    const want = Math.min(Math.max(r, min), max);
    if (!blocked.length) return Math.round(want * 10) / 10;
    const clampIn = x => Math.min(Math.max(x, min), max);
    const free = x => blocked.every(b => Math.abs(x - b) >= BASE_SAME_GAP - 1e-6);
    const cands = [min, max, want];
    blocked.forEach(b => cands.push(b - BASE_SAME_GAP, b + BASE_SAME_GAP));
    const ok = cands.map(clampIn).filter(free);
    let best;
    if (ok.length) {
        best = ok[0];
        ok.forEach(x => { if (Math.abs(x - want) < Math.abs(best - want)) best = x; });
    } else {
        // Свободного места нет: кандидаты «наименее тесно» — середины между
        // полосами соседей и краями коридора; берём точку с максимальным
        // зазором, при равенстве — ближайшую к желаемой.
        const gapAt = x => Math.min(...blocked.map(b => Math.abs(x - b)));
        const edges = [min, ...blocked.filter(b => b > min && b < max).sort((a, b) => a - b), max];
        const mids = edges.slice(1).map((e, i) => (edges[i] + e) / 2);
        best = want;
        let bg = gapAt(want);
        [...cands, ...mids].forEach(v => {
            const x = clampIn(v), g = gapAt(x);
            if (g > bg + 1e-6 ||
                (Math.abs(g - bg) <= 1e-6 && Math.abs(x - want) < Math.abs(best - want))) {
                best = x;
                bg = g;
            }
        });
    }
    return Math.round(best * 10) / 10;
}

/** Радиусы орбит остальных баз того же хозяина (без exceptId). */
function occupiedRadii(host, exceptId) {
    const key = hostKey(host.kind, host.planet, host.moon || null);
    return bases
        .filter(b => b.status !== 'removed' && b.id !== exceptId &&
            hostKey(b.hostKind, b.planet, b.moon || null) === key)
        .map(b => b.orbitRadius);
}

/**
 * Радиус орбиты базы при создании и переносе: коридор хозяина плюс разведение
 * с другими базами того же хозяина (fitRadius). Переносимая база сама себя не
 * стесняет — exceptId исключается.
 */
function fitBaseRadius(r, host, exceptId) {
    return fitRadius(r, host, occupiedRadii(host, exceptId || null));
}

/**
 * Легаси-база «LUNA-ORBIT»: исторически рисовалась в render.js жёстко (маркер
 * с подписью BASE на орбите у Луны Земли) и не подчинялась механизму. При
 * первом запуске она становится обычной записью: участвует в разведении
 * орбит, переносится и удаляется, а корабли из ангара (флаг fleet) — в её
 * карточке. Если запись уже есть (в том числе надгробие после удаления) —
 * ничего не создаём.
 */
(function migrateLegacyLunaOrbit() {
    if (bases.some(b => b.id === 'base-luna-orbit')) return;
    bases.push({
        id: 'base-luna-orbit',
        name: 'LUNA-ORBIT',
        status: 'active',
        hostKind: 'moon',
        planet: 'Earth',
        moon: 'Луна / Moon',
        orbitRadius: baseOrbitRadius,
        period: basePeriodAt(baseOrbitRadius),
        phase0: 0,
        created: new Date().toISOString(),
        fleet: true
    });
    saveBases();
})();

/**
 * Привести радиусы загруженных баз к коридору хозяина (baseRadiusRange) и
 * развести орбиты баз одного хозяина (fitRadius): базы, созданные до
 * появления полос и разведения, могли пересекать чужие орбиты или слипаться.
 * Базы обрабатываются в порядке массива — каждая считается с уже принятыми,
 * поэтому результат стабилен (повторная загрузка ничего не двигает), а период
 * пересчитывается под новый радиус. Надгробия (`removed`) не трогаем — их
 * место уже история. Если что-то поменялось, хранилище сразу перезаписывается.
 */
(function normalizeBaseRadii() {
    let changed = false;
    const accepted = new Map();   // hostKey -> радиусы уже принятых баз
    bases.forEach(b => {
        if (b.status === 'removed') return;
        const host = { kind: b.hostKind, planet: b.planet, moon: b.moon || null };
        const key = hostKey(host.kind, host.planet, host.moon);
        let list = accepted.get(key);
        if (!list) accepted.set(key, list = []);
        const r = fitRadius(b.orbitRadius, host, list);
        list.push(r);
        if (r === b.orbitRadius) return;
        b.orbitRadius = r;
        b.period = basePeriodAt(r);
        changed = true;
    });
    if (changed) saveBases();
})();

// --- Реестр имён баз (отдельный ключ localStorage) --------------------------
// По индексу имени в BASE_NAMES: сколько раз оно выпадало (count — для
// суффикса « - N») и какие базы им названы, с местом (kind/planet/moon) и
// статусом (active/removing/removed — запись остаётся и после удаления).

/** Прочитать реестр имён; битые данные не роняют карту. */
function loadNameRegistry() {
    try {
        const raw = localStorage.getItem(NAMES_KEY);
        const obj = raw ? JSON.parse(raw) : null;
        if (obj && obj.names && typeof obj.names === 'object') return obj;
    } catch (e) { /* битый реестр — начнём заново */ }
    return { v: 1, names: {} };
}

/** Записать реестр имён в localStorage (ключ отдельный от баз). */
function saveNameRegistry() {
    try {
        localStorage.setItem(NAMES_KEY, JSON.stringify(nameRegistry));
    } catch (e) { /* нет доступа/переполнено — не сохранится */ }
}

/** Реестр: { v, names: { '<id имени>': { id, name, count, bases: [...] } } }. */
let nameRegistry = loadNameRegistry();

/**
 * Синхронизировать реестр с загруженными базами: счётчики использований не
 * теряем (берём максимум из реестра и записей), места баз поправляем, записи
 * о пропавших базах убираем.
 */
function syncNameRegistry() {
    let dirty = false;
    bases.forEach(b => {
        if (typeof b.nameId !== 'number') return;   // старые BASE-N — вне реестра
        let reg = nameRegistry.names[b.nameId];
        if (!reg) {
            reg = nameRegistry.names[b.nameId] = { id: b.nameId, name: BASE_NAMES[b.nameId] || b.name, count: 0, bases: [] };
            dirty = true;
        }
        if (b.nameCount > reg.count) { reg.count = b.nameCount; dirty = true; }
        const place = reg.bases.find(x => x.baseId === b.id);
        if (!place) {
            reg.bases.push({ baseId: b.id, name: b.name, kind: b.hostKind, planet: b.planet, moon: b.moon || null, status: b.status });
            dirty = true;
        } else if (place.status !== b.status || place.kind !== b.hostKind || place.planet !== b.planet || (place.moon || null) !== (b.moon || null)) {
            place.status = b.status;
            place.kind = b.hostKind;
            place.planet = b.planet;
            place.moon = b.moon || null;
            dirty = true;
        }
    });
    Object.keys(nameRegistry.names).forEach(k => {
        const reg = nameRegistry.names[k];
        const keep = reg.bases.filter(x => bases.some(b => b.id === x.baseId));
        if (keep.length !== reg.bases.length) { reg.bases = keep; dirty = true; }
    });
    if (dirty) saveNameRegistry();
}
syncNameRegistry();

/** Реестр имён — для отладки и тестов (живой объект). */
function baseNamesRegistry() {
    return nameRegistry;
}

/**
 * Взять случайное имя для новой базы. Повтор выпадения увеличивает счётчик
 * реестра и получает суффикс: «Красная луна», «Красная луна - 2», « - 3»…
 * @returns {{nameId: number, name: string, nameCount: number}}
 */
function takeBaseName() {
    const id = Math.floor(Math.random() * BASE_NAMES.length);
    let reg = nameRegistry.names[id];
    if (!reg) reg = nameRegistry.names[id] = { id, name: BASE_NAMES[id], count: 0, bases: [] };
    reg.count += 1;
    return { nameId: id, name: reg.count > 1 ? reg.name + ' - ' + reg.count : reg.name, nameCount: reg.count };
}

/** Дописать в реестр, что за база создана и где она стоит. */
function registerBasePlace(rec) {
    const reg = nameRegistry.names[rec.nameId];
    if (!reg) return;
    reg.bases.push({ baseId: rec.id, name: rec.name, kind: rec.hostKind, planet: rec.planet, moon: rec.moon || null, status: rec.status });
}

/** Обновить в реестре место базы после переноса. */
function updateBasePlace(rec) {
    Object.keys(nameRegistry.names).forEach(k => {
        const place = nameRegistry.names[k].bases.find(x => x.baseId === rec.id);
        if (!place) return;
        place.kind = rec.hostKind;
        place.planet = rec.planet;
        place.moon = rec.moon || null;
    });
}

/**
 * Фаза базы (phase0) так, чтобы прямо сейчас (state.simDays) она стояла на
 * направлении ang от центра хоста: phase0 = ang − 2π·t/период. null — угол не
 * задан (курсор в самом центре тела): создание берёт случайную точку, перенос
 * оставляет прежнюю сторону орбиты.
 */
function phaseFor(ang, period) {
    if (typeof ang !== 'number' || !isFinite(ang)) return null;
    const twoPi = Math.PI * 2;
    return ((ang - twoPi * state.simDays / period) % twoPi + twoPi) % twoPi;
}

/** Пометить место базы в реестре ('removing'/'removed') — запись остаётся. */
function markBasePlaceStatus(rec, status) {
    Object.keys(nameRegistry.names).forEach(k => {
        nameRegistry.names[k].bases.forEach(place => {
            if (place.baseId === rec.id) place.status = status;
        });
    });
}

/** Счётчик для уникальных id: базы могут создаваться в одну миллисекунду. */
let baseSeq = 0;

/**
 * Создать базу на орбите радиуса r у планеты/луны; запись сразу пишется в
 * localStorage. Имя выбирается случайно из BASE_NAMES (bases_name.js), повтор
 * получает суффикс « - 2». Карточку/список обновляет вызывающий код (input.js).
 * @param {{kind: string, planet: string, moon: ?string}} host
 * @param {number} r радиус орбиты, единицы мира (коридор хоста + разведение
 *   с другими его базами — fitBaseRadius)
 * @param {?number} ang угол от центра хоста к курсору (радианы): база появится
 *   с этой стороны; не задан — случайная точка орбиты
 */
function createBase(host, r, ang) {
    const orbitRadius = fitBaseRadius(r, host, null);
    const period = basePeriodAt(orbitRadius);
    const phase = phaseFor(ang, period);
    const { nameId, name, nameCount } = takeBaseName();
    const rec = {
        id: 'base-' + Date.now().toString(36) + '-' + (++baseSeq).toString(36),
        name,
        nameId,
        nameCount,
        status: 'active',
        hostKind: host.kind,
        planet: host.planet,
        moon: host.moon || null,
        orbitRadius,
        period,
        phase0: phase === null ? Math.random() * Math.PI * 2 : phase,
        created: new Date().toISOString()
    };
    bases.push(rec);
    registerBasePlace(rec);   // реестр: какое имя и где стоит
    saveBases();
    saveNameRegistry();
    return rec;
}

/**
 * Переместить созданную базу на орбиту радиуса r у планеты/луны (хост выбирает
 * режим на карте, в том числе по правилу ближайшего тела). База встаёт со
 * стороны курсора: направление ang от центра хоста становится её положением на
 * орбите. Период пересчитывается, запись сразу пишется в localStorage;
 * карточку обновляет вызывающий код (input.js).
 * @param {Object} rec запись базы
 * @param {{kind: string, planet: string, moon: ?string}} host
 * @param {number} r радиус орбиты, единицы мира (коридор хоста + разведение
 *   с другими его базами, сама переносимая база не мешает)
 * @param {?number} ang угол от центра хоста к курсору (радианы); не задан —
 *   сторона орбиты у базы сохраняется
 */
function moveBase(rec, host, r, ang) {
    if (rec.status !== 'active') return rec;   // удаляемую базу не трогаем
    rec.hostKind = host.kind;
    rec.planet = host.planet;
    rec.moon = host.moon || null;
    rec.orbitRadius = fitBaseRadius(r, host, rec.id);
    rec.period = basePeriodAt(rec.orbitRadius);
    const phase = phaseFor(ang, rec.period);
    if (phase !== null) rec.phase0 = phase;
    updateBasePlace(rec);   // реестр имён: база теперь стоит в другом месте
    saveBases();
    saveNameRegistry();
    return rec;
}

/** Прогресс разбора удаляемой базы: 0 — только начали, 1 — время вышло. */
function removalProgress(rec) {
    return Math.max(0, Math.min(1, 1 - (rec.removeEndsAt - Date.now()) / BASE_REMOVAL_MS));
}

/**
 * Начать удаление базы: статус 'removing', таймер removeEndsAt (реальное
 * время, BASE_REMOVAL_MS). Пока идёт разбор, базой нельзя пользоваться —
 * перенос и повторное удаление недоступны, а имя базы на карте и в карточке
 * краснеет и под ним идёт полоска прогресса разбора. Завершает удаление
 * updateBaseRemovals() в кадре (main.js).
 * @param {Object} rec запись базы
 * @returns {boolean} запустилось ли удаление
 */
function startBaseRemoval(rec) {
    if (rec.status !== 'active') return false;
    rec.status = 'removing';
    rec.removeEndsAt = Date.now() + BASE_REMOVAL_MS;
    markBasePlaceStatus(rec, 'removing');
    saveBases();
    saveNameRegistry();
    return true;
}

/**
 * Кадр: завершить удаление баз с вышедшим таймером. Запись получает статус
 * 'removed' (надгробие в хранилище баз — отметка, что база удалена) и
 * целиком переезжает в архив bases_removed.js; место в реестре имён тоже
 * помечается 'removed' (счётчик использований имени остаётся).
 */
function updateBaseRemovals() {
    let changed = false;
    bases.forEach(b => {
        if (b.status !== 'removing' || Date.now() < b.removeEndsAt) return;
        b.status = 'removed';
        b.removedAt = new Date().toISOString();
        delete b.removeEndsAt;
        archiveBase(b);   // информация о базе переезжает в bases_removed
        markBasePlaceStatus(b, 'removed');
        changed = true;
    });
    if (changed) {
        saveBases();
        saveNameRegistry();
    }
}

/** Базы на данном хосте — для списка в карточке планеты/луны. */
function basesAt(kind, planet, moon) {
    return bases.filter(b => b.status !== 'removed' &&
        b.hostKind === kind && b.planet === planet && (b.moon || null) === (moon || null));
}

/**
 * Отрисовать все базы (орбита-пунктир, свечение, квадрат, пульс, подпись) и
 * превью выбираемой орбиты, если включён режим создания.
 * @param {Object} hostPos   'planet:Mars' / 'moon:Earth:Луна / Moon' -> {x, y}
 * @param {Set}   [quietIds] базы лунных групп (render.js): им рисуется только
 *                           маркер — имена стоят в подписи группы
 * @returns {Array} hoverTargets баз
 */
function drawBases(ctx, hostPos, quietIds) {
    const { simDays, zoom, time } = state;
    const targets = [];

    bases.forEach(b => {
        if (b.status === 'removed') return;   // надгробие — с орбиты уже убрана
        const mode = state.baseMode;
        // База в режиме переноса рисуется сразу по превью: хост режима и
        // текущий радиус выбора (до подтверждения запись не меняется).
        const moving = mode && mode.moveId === b.id;
        const hk = moving ? hostKey(mode.kind, mode.planet, mode.moon)
                          : hostKey(b.hostKind, b.planet, b.moon);
        const hp = hostPos[hk];
        if (!hp) return;   // хост не в кадре (например, луна скрыта зумом)
        const orbitR = moving ? state.baseRadius : b.orbitRadius;
        const period = moving ? basePeriodAt(orbitR) : b.period;
        // Перенос рисуется со стороны курсора (mode.ang считает input.js по
        // позиции над картой) — база встанет туда же после подтверждения.
        let ang = b.phase0 + 2 * Math.PI * simDays / period;
        if (moving && typeof mode.ang === 'number') ang = mode.ang;
        b.x = hp.x + Math.cos(ang) * orbitR;
        b.y = hp.y - Math.sin(ang) * orbitR;

        // Имя спутника-хозяина для подписи: у переноса — хост режима, иначе
        // запись базы (у базы на планете строки нет).
        const hostMoon = (moving ? mode.kind : b.hostKind) === 'moon'
            ? (moving ? mode.moon : b.moon) || null : null;
        drawBaseMarker(ctx, hp, b, zoom, time, orbitR, quietIds && quietIds.has(b.id), hostMoon);
        targets.push({
            kind: 'base', name: b.name, x: b.x, y: b.y, r: 4 / zoom,
            orbitCx: hp.x, orbitCy: hp.y, orbitR,
            local: b, moons: []
        });
    });

    if (state.baseMode) drawBasePreview(ctx, hostPos);
    return targets;
}

/** Маркер базы: орбита вокруг хоста, свечение, квадрат, пульс и подпись.
 *  quiet — имя не рисуется: база лунной группы, её имя — в подписи группы.
 *  hostMoon — имя спутника-хозяина (база на видимой луне): рисуется строкой
 *  выше имени базы — подпись читается связкой «спутник над базой», как строки
 *  подписи группы лун. */
function drawBaseMarker(ctx, hp, b, zoom, time, orbitR, quiet, hostMoon) {
    ctx.strokeStyle = 'rgba(0,255,255,0.27)';
    ctx.lineWidth = 0.5 / zoom;
    ctx.setLineDash([1 / zoom, 1 / zoom]);
    ctx.beginPath();
    ctx.arc(hp.x, hp.y, orbitR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const bs = 4 / zoom;

    const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, bs * 2);
    glow.addColorStop(0, 'rgba(0,255,255,0.6)');
    glow.addColorStop(1, 'rgba(0,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(b.x, b.y, bs * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.base;
    ctx.fillRect(b.x - bs / 2, b.y - bs / 2, bs, bs);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1 / zoom;
    ctx.strokeRect(b.x - bs / 2, b.y - bs / 2, bs, bs);

    const pulse = (Math.sin(time * 4) + 1) * 0.5;
    ctx.strokeStyle = `rgba(0,255,255,${0.5 - pulse * 0.5})`;
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    ctx.arc(b.x, b.y, bs + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();

    // Подпись базы: имя — шрифт интерфейса (Manrope, как .b-name в списках),
    // кегль постоянный на экране (10 пикселей при любом зуме). Имя живёт в
    // границах невидимой панели BASE_LABEL_W: что не влезает — режется с «…»,
    // а при наведении на базу (маркер или саму панель) включается бегущая
    // строка — имя уезжает влево и его можно прочитать целиком.
    const pw = BASE_LABEL_W / zoom;            // ширина панели, мировые единицы
    const fontPx = 10 / zoom;                  // кегль: 10 экранных пикселей
    const lx = b.x + bs + 3 / zoom;            // левый край панели
    const ly = b.y - 3 / zoom;                 // базовая линия имени

    // База на видимой луне: над именем базы — имя спутника (той же связкой,
    // что строки подписи группы лун: сверху тело, снизу база). У базы скрытой
    // луны строки нет — имя спутника несёт подпись группы.
    const moonLine = !quiet && hostMoon ? hostMoon : null;
    if (moonLine) {
        const mly = ly - 12 / zoom;            // строка выше имени базы
        ctx.font = `${fontPx}px monospace`;    // как строки подписи группы
        const mt = ctx.measureText(moonLine).width > pw
            ? cutForPanel(ctx, moonLine, pw) : moonLine;
        ctx.fillStyle = COLORS.tooltipShadow;
        ctx.fillText(mt, lx + 1 / zoom, mly + 1 / zoom);
        ctx.fillStyle = COLORS.tooltip;
        ctx.fillText(mt, lx, mly);
    }

    ctx.font = `600 ${fontPx}px "Manrope", sans-serif`;

    const removing = b.status === 'removing';
    ctx.fillStyle = removing ? COLORS.danger : COLORS.base;

    if (quiet) {
        // База лунной группы: имя не подписываем — оно стоит второй строкой
        // подписи группы (scene.js groupPlan.baseLabel).
        labelScrollFrom.delete(b.id);
    } else {
        const tw = ctx.measureText(b.name).width;
        const overflow = tw > pw;
        const scrolling = overflow && labelHovered(b, lx, ly, pw, bs, moonLine ? 12 / zoom : 0);
        const nowMs = performance.now();
        if (scrolling) {
            if (!labelScrollFrom.has(b.id)) labelScrollFrom.set(b.id, nowMs);
        } else {
            labelScrollFrom.delete(b.id);
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(lx, ly - fontPx * 1.25, pw, fontPx * 1.6);
        ctx.clip();
        if (scrolling) {
            // бегущая строка: имя уходит влево, следом въезжает его же копия
            const gap = 40 / zoom, cycle = tw + gap;
            const off = ((nowMs - labelScrollFrom.get(b.id)) / 1000) * 28 / zoom % cycle;
            ctx.fillText(b.name, lx - off, ly);
            ctx.fillText(b.name, lx - off + cycle, ly);
        } else {
            ctx.fillText(overflow ? cutForPanel(ctx, b.name, pw) : b.name, lx, ly);
        }
        ctx.restore();
    }

    if (removing) {
        // полоска разбора — во всю панель, заполняется справа налево
        const bh = 3 / zoom, by = ly + 4 / zoom;
        const p = removalProgress(b);
        ctx.fillStyle = 'rgba(255, 95, 122, 0.22)';
        ctx.fillRect(lx, by, pw, bh);
        ctx.fillStyle = COLORS.danger;
        ctx.fillRect(lx + pw * (1 - p), by, pw * p, bh);
    }
}

/** Наведён ли курсор на базу: её маркер, имя или невидимая панель подписи.
 *  extraTop — высота строки-спутника над именем: панель ховера растёт вверх
 *  вместе с подписью (наведение на строку спутника тоже включает бегущую строку). */
function labelHovered(b, lx, ly, pw, bs, extraTop) {
    if (state.mouseX < 0) return false;
    const m = screenToWorld(state.mouseX, state.mouseY, state);
    const zoom = state.zoom;
    if (Math.hypot(m.x - b.x, m.y - b.y) <= bs + 6 / zoom) return true;
    const fontPx = 10 / zoom;
    return m.x >= lx && m.x <= lx + pw
        && m.y >= ly - fontPx * 1.3 - (extraTop || 0) && m.y <= ly + fontPx * 0.4;
}

/** Имя, вписанное в панель шириной pw: лишнее заменяется на «…». */
function cutForPanel(ctx, name, pw) {
    const ELL = '…';
    const ew = ctx.measureText(ELL).width;
    let lo = 0, hi = name.length;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (ctx.measureText(name.slice(0, mid)).width + ew <= pw) lo = mid;
        else hi = mid - 1;
    }
    return name.slice(0, lo).replace(/\s+$/, '') + ELL;
}

/** Превью режима «выбрать орбиту»: окружность радиуса, лучик и подсказка. */
function drawBasePreview(ctx, hostPos) {
    const mode = state.baseMode;
    const hp = hostPos[hostKey(mode.kind, mode.planet, mode.moon)];
    if (!hp || state.mouseX < 0) return;

    const { zoom } = state;
    const r = state.baseRadius;

    ctx.strokeStyle = 'rgba(0,255,255,0.55)';
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.beginPath();
    ctx.arc(hp.x, hp.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const w = screenToWorld(state.mouseX, state.mouseY, state);
    // луч — направление будущего положения базы: угол от центра хоста к
    // курсору (mode.ang; до первого движения над картой — по позиции мыши)
    let ux, uy;
    if (typeof mode.ang === 'number') {
        ux = Math.cos(mode.ang);
        uy = -Math.sin(mode.ang);
    } else {
        const dx = w.x - hp.x, dy = w.y - hp.y, d = Math.hypot(dx, dy) || 1;
        ux = dx / d;
        uy = dy / d;
    }

    ctx.strokeStyle = 'rgba(0,255,255,0.25)';
    ctx.lineWidth = 0.5 / zoom;
    ctx.beginPath();
    ctx.moveTo(hp.x, hp.y);
    ctx.lineTo(hp.x + ux * r, hp.y + uy * r);
    ctx.stroke();

    const l1 = 'Орбита: ' + Math.round(r) + ' ед.';
    const l2 = (mode.moveId ? 'клик — переместить базу' : 'клик — создать') + ' · Esc — отмена';
    ctx.font = `${11 / zoom}px monospace`;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(l1, w.x + 15 / zoom, w.y - 19 / zoom);
    ctx.fillText(l2, w.x + 15 / zoom, w.y - 4 / zoom);
    ctx.fillStyle = '#bffcfc';
    ctx.fillText(l1, w.x + 14 / zoom, w.y - 20 / zoom);
    ctx.fillStyle = 'rgba(191,252,252,0.75)';
    ctx.fillText(l2, w.x + 14 / zoom, w.y - 5 / zoom);
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
// солнце, планеты, луны (скрытые зумом — группой, scene.js groupPlan),
// звёздные базы.
// Стиль тел: у планет прозрачная заливка — тело читается только по обводке,
// одинаково толстой у всех; солнце — жёлтая заливка; луны — плоские серые
// круги. Орбит на карте нет — их рисует
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
    // smallbodies.js: точки показанных тел и частицы рисует сам, именованные
    // тела отдаёт как hover-цели, а сгруппированные хвосты семейств — как
    // подписи групп: рисуются общей drawGroupLabel, как у лун планет.
    const small = drawSmallBodies(ctx);
    hoverTargets.push(...small.targets);
    small.groups.forEach(g => drawGroupLabel(ctx, g.x, g.y, g.group, zoom, null));

    // Солнце — первая hover-цель (проверяется последней, т.к. планеты поверх)
    drawSun(ctx);
    hoverTargets.push({ kind: 'sun', name: 'Солнце / Sun', x: 0, y: 0, r: SUN_R, moons: [] });

    // === ПЛАНЕТЫ ===
    const hostPos = {};   // мировые позиции хост-тел для звёздных баз (ключи bases.js)
    const groupBaseIds = new Set();   // базы лунных групп: имена — в подписи группы
    planets.forEach(p => {
        // Угол строго из simDays: движение по орбите и счётчик дней — один таймер.
        // y с минусом: против часовой, как видно с севера эклиптики.
        const ang = orbitAngle(p.l0, p.period, simDays);
        const x = Math.cos(ang) * p.dist;
        const y = -Math.sin(ang) * p.dist;

        if (p.rings) drawRings(ctx, x, y, p);

        drawPlanetBody(ctx, x, y, p.r);

        const moonHits = drawPlanetMoons(ctx, x, y, p, hostPos, groupBaseIds);

        // Луна Земли — особый случай: своя дистанция и радиус, не в moonsByPlanet.
        // Базы на ней рисует общий слой баз (bases.js), как у остальных лун.
        if (p.name === 'Earth') {
            const hit = drawEarthMoon(ctx, x, y);
            if (hit) moonHits.push(hit.moon);
        }

        hoverTargets.push({ kind: 'planet', p, x, y, moons: moonHits });

        // позиции хост-тел для звёздных баз: планета и её луны (скрытые
        // луны группы встают в маркер-представителя — см. drawPlanetMoons)
        hostPos['planet:' + p.name] = { x, y };
        moonHits.forEach(h => { hostPos['moon:' + p.name + ':' + h.m.n] = { x: h.mx, y: h.my }; });
    });

    // Звёздные базы (bases.js): маркеры, орбиты и превью выбора орбиты;
    // базы лунных групп (groupBaseIds) — без имён: они в подписи группы
    drawBases(ctx, hostPos, groupBaseIds).forEach(t => {
        t.p = planets.find(x => x.name === t.local.planet);
        hoverTargets.push(t);
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

/** Солнце: жёлтая заливка и самая толстая обводка. */
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

/** Планета: прозрачная заливка — видна только обводка, у всех одна толщина. */
function drawPlanetBody(ctx, x, y, r) {
    const z = state.zoom;
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
 * Луны планеты — по плану группировки scene.js groupPlan. Показанные луны
 * рисуются точками и становятся hover-целями. Скрытые луны группы «встают»
 * в маркер-представитель: их хост-позиция для баз — позиция представителя
 * (bases.js рисует базы у группы), а у самого маркера — подпись группы в две
 * строки (луны, затем базы — drawGroupLabel). Имена баз группы у маркеров не
 * рисуются — их id собираются в groupBaseIds (drawBases гасит их подписи).
 * @param {Set} groupBaseIds  сюда складываются id баз групп (для bases.js)
 * @returns {Array} хиты для hover: { m, md, mx, my }
 */
function drawPlanetMoons(ctx, x, y, p, hostPos, groupBaseIds) {
    const { simDays, zoom } = state;
    // Группировка лун: помещается visibleCount() штук, базы игрока — те, что
    // стоят именно на луне (hostKind 'moon'); удалённые в подпись не берём.
    const plan = groupPlan(moonsByPlanet[p.name] || [], visibleCount(), {
        baseOf: m => bases.filter(b => b.status !== 'removed'
            && b.hostKind === 'moon' && b.planet === p.name && b.moon === m.n)
    });
    const hits = [];

    plan.shown.forEach(({ m, i }) => {
        const md = moonOrbitRadius(p, i); // радиус орбиты луны от планеты
        const mAng = orbitAngle(m.phase, m.period, simDays);
        const mx = x + Math.cos(mAng) * md;
        const my = y - Math.sin(mAng) * md;

        drawMoonBody(ctx, mx, my, m.r);
        hits.push({ m, md, mx, my });
    });

    if (plan.group) {
        const rep = hits[plan.group.at];   // маркер-представитель группы
        // Скрытые луны группы считаются стоящими в маркере: базы на них
        // рисуются у группы (bases.js по hostPos), а не пропадают из кадра.
        plan.group.items.forEach(m => {
            hostPos['moon:' + p.name + ':' + m.n] = { x: rep.mx, y: rep.my };
        });
        // Подпись группы: первая строка — луны, вторая — базы на них
        // (id баз группы уходят в groupBaseIds — bases.js нарисует их
        // маркеры без имён: имена уже стоят в подписи).
        drawGroupLabel(ctx, rep.mx, rep.my, plan.group, zoom, groupBaseIds);
    }
    return hits;
}

/**
 * Подпись группы тел у маркера-представителя (plan.group из scene.js
 * groupPlan) — общая для лун планет и семейств малых тел: две строки, имена
 * тел и базы на них. Стиль подсказки hover: тень 1 px, кегль постоянный на
 * экране (10 / zoom). Первая строка белая, вторая — цианом (цвет баз). Базы
 * группы складываются в quietIds: bases.js нарисует их маркеры без имён —
 * имена уже стоят в подписи (у малых тел баз пока нет, quietIds = null).
 */
function drawGroupLabel(ctx, mx, my, group, zoom, quietIds) {
    if (quietIds) group.bases.forEach(b => quietIds.add(b.id));
    ctx.font = `${10 / zoom}px monospace`;
    const lx = mx + 6 / zoom, ly = my - 4 / zoom;
    groupLine(ctx, group.label, lx, ly, COLORS.tooltip, zoom);
    if (group.baseLabel)
        groupLine(ctx, group.baseLabel, lx, ly + 12 / zoom, COLORS.base, zoom);
}

/** Строка подписи группы лун: тень со сдвигом в 1 px, затем текст в цвете. */
function groupLine(ctx, text, x, y, color, zoom) {
    ctx.fillStyle = COLORS.tooltipShadow;
    ctx.fillText(text, x + 1 / zoom, y + 1 / zoom);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}

/**
 * Луна Земли — отдельный блок рисования: у неё своя дистанция и радиус
 * (render.js), а не запись в moonsByPlanet. Базы на её орбите рисует общий
 * слой баз (bases.js), как и у остальных лун.
 * @returns {{moon: {m, md, mx, my}}} хит Луны для наведения и выбора
 */
function drawEarthMoon(ctx, x, y) {
    const { simDays } = state;

    const mAng = orbitAngle(moonL0, moonPeriod, simDays);
    const mx = x + Math.cos(mAng) * moonDist;
    const my = y - Math.sin(mAng) * moonDist;

    drawMoonBody(ctx, mx, my, 3);

    return { moon: { m: { n: 'Луна / Moon', r: 3, period: moonPeriod }, md: moonDist, mx, my } };
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
        sel.kind === 'base' ? (t.kind === 'base' && (sel.local ? t.local === sel.local : !t.local)) :
        sel.small ? t.small === sel.small : t.p === sel.p);
    if (!target) return; // тело ещё не в кадре (луна скрыта зумом и т.п.)

    if (sel.kind === 'sun') return; // у солнца орбиты нет

    let orbit = null;
    if (sel.small) {
        // малое тело: орбита по сэмплированным элементам (poly), у троянцев — круг
        orbit = sel.small.poly ? { poly: sel.small.poly } : sel.small.orbit;
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
                return { kind: 'base', name: t.name, orbit: { cx: t.orbitCx, cy: t.orbitCy, r: t.orbitR }, p: t.p, m: null, local: t.local || null };
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
            if (t.small) orbit = t.small.poly ? { poly: t.small.poly } : t.small.orbit;
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
    if (hover.orbit.poly) {
        // малое тело: сэмплированная петля — эллипс по (a, e) врёт вне линейных зон
        const p = hover.orbit.poly;
        ctx.moveTo(p[0], p[1]);
        for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    } else if (hover.orbit.rot !== undefined) {
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
        state.fly = null;   // тач-жест перебивает полёт камеры
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
        state.fly = null;   // ручной зум перебивает полёт камеры
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
        if (state.baseMode) { confirmBase(e.clientX, e.clientY); return; } // выбираем орбиту базы
        state.fly = null;   // клик по карте перебивает полёт камеры
        selectBody(findBodyAt(state.hoverTargets, e.clientX, e.clientY));
    });

    canvas.addEventListener('mousedown', e => {
        if (e.button !== 2) return;
        state.fly = null;                       // панорамирование перебивает полёт
        if (state.baseMode) cancelBaseMode();   // правая кнопка отменяет выбор орбиты
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
        if (state.baseMode) { canvas.style.cursor = 'crosshair'; return; } // выбираем орбиту
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
        // режим выбора орбиты базы: радиус следит за курсором (только над картой,
        // чтобы курсор над панелью не утаскивал орбиту к случайному телу)
        if (state.baseMode && e.target === canvas) updateBaseRadius(e.clientX, e.clientY);
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

    // Esc отменяет выбор орбиты базы
    window.addEventListener('keydown', e => {
        if (e.key === 'Escape' && state.baseMode) cancelBaseMode();
    });

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

/* ---------- Звёздные базы: режим выбора орбиты (кнопка в карточке) ---------- */

/** Позиция хост-тела (планеты/луны) в мировых координатах из целей кадра. */
function hostPosOf(host) {
    const tg = state.hoverTargets || [];
    const t = tg.find(t => t.kind === 'planet' && t.p.name === host.planet);
    if (!t) return null;
    if (host.kind === 'planet') return { x: t.x, y: t.y };
    const mh = t.moons.find(m => m.m.n === host.moon);
    return mh ? { x: mh.mx, y: mh.my } : null;
}

/** Снимок соседей для режима базы: планеты и их нарисованные луны (позиции — на момент снимка). */
function baseHosts() {
    const out = [];
    (state.hoverTargets || []).forEach(t => {
        if (t.kind !== 'planet') return;
        out.push({ kind: 'planet', planet: t.p.name, moon: null, x: t.x, y: t.y });
        t.moons.forEach(mh =>
            out.push({ kind: 'moon', planet: t.p.name, moon: mh.m.n, x: mh.mx, y: mh.my }));
    });
    return out;
}

/**
 * Радиус выбираемой орбиты: расстояние от курсора до ближайшего тела, затем
 * механизм баз — кламп в коридор хозяина и разведение с другими его базами
 * (fitBaseRadius): превью показывает ту же орбиту, на которую база встанет.
 * Правило ближайшего тела: как только точка орбиты уходит дальше половины пути
 * до другого тела (курсор ближе к нему, чем к исходному), орбита переезжает к
 * этому телу — база на Венере, уведённая к Земле, окажется у Земли.
 * Позиции соседей (планет и видимых лун) снимаются один раз при старте режима
 * (mode.snap) и на каждом движении мыши НЕ пересчитываются.
 */
function updateBaseRadius(x, y) {
    const mode = state.baseMode;
    if (!mode) return;
    if (!mode.snap) mode.snap = baseHosts();   // снимок соседей — один раз на режим
    const w = screenToWorld(x, y, state);
    let best = null, bd = Infinity;
    for (const h of mode.snap) {
        const d = Math.hypot(w.x - h.x, w.y - h.y);
        if (d < bd) { bd = d; best = h; }
    }
    if (!best) return;
    if (best.kind !== mode.kind || best.planet !== mode.planet || (best.moon || null) !== (mode.moon || null)) {
        // {...mode} сохраняет snap и moveId (перенос базы) при переезде хоста
        state.baseMode = { ...mode, kind: best.kind, planet: best.planet, moon: best.moon };
    }
    const hp = hostPosOf(state.baseMode);   // радиус — от живого положения хоста
    // Механизм баз: коридор «не пересекать тела» + разведение с другими базами
    // этого хозяина; переносимая база себе не мешает (moveId исключается).
    const d = hp ? Math.hypot(w.x - hp.x, w.y - hp.y) : bd;
    state.baseRadius = fitBaseRadius(d, state.baseMode, state.baseMode.moveId || null);
    // Сторона орбиты — направление от центра хозяина к курсору: перенос
    // поставит базу с этой стороны, создание появится тут же (mode.ang).
    if (hp) {
        const dx = w.x - hp.x, dy = w.y - hp.y;
        if (Math.hypot(dx, dy) > 1e-6) state.baseMode.ang = Math.atan2(-dy, dx);
    }
}

/** Клик в режиме выбора орбиты: создать базу или перенести существующую. */
function confirmBase(x, y) {
    if (!hostPosOf(state.baseMode)) return;   // хост не в кадре (луна скрыта зумом) — клик мимо
    updateBaseRadius(x, y);
    const mode = state.baseMode;   // хост мог только что переехать к ближайшему телу
    state.baseMode = null;
    if (mode.moveId) {             // перенос: та же запись на новой орбите
        const rec = bases.find(b => b.id === mode.moveId);
        if (!rec || rec.status !== 'active') { refreshObjectCard(); return; }   // удаляемую не трогаем
        moveBase(rec, mode, state.baseRadius, mode.ang);   // и со стороны курсора
        const p = planets.find(q => q.name === rec.planet);
        selectBody({ kind: 'base', name: rec.name, local: rec, p, m: null });
        return;
    }
    const rec = createBase(mode, state.baseRadius, mode.ang);
    const p = planets.find(q => q.name === rec.planet);
    selectBody({ kind: 'base', name: rec.name, local: rec, p, m: null });
}

/** Выйти из режима выбора орбиты (Esc или правая кнопка). */
function cancelBaseMode() {
    state.baseMode = null;
    refreshObjectCard();   // вернуть кнопке надпись «Создать базу»
}

// ===== ui.js =====
// =============================================================================
// ui.js — DOM-интерфейс: HUD-показатели (зум/скорость/дата), боковые блоки
// «СОЛНЕЧНАЯ СИСТЕМА» (дерево планет/лун), «ОБЪЕКТ» (информация о выбранном) и
// «МАЛЫЕ ТЕЛА» (группы малых тел: полёт камеры и выбор по клику).
// Выбор делается кликом по канвасу (selectBody вызывает input.js), по
// элементу дерева или по строке блока малых тел. Шапка каждого блока
// сворачивает его — отдельных кнопок «скрыть/показать» нет. Здесь же твин
// полёта камеры (flyToCamera/updateFlyTo), которым main.js двигает камеру,
// и модальный confirmDialog (общий стиль ангара: .slot-dialog).
// Работает с DOM, не с канвасом.
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

/** «4 секунды», «1 секунда», «5 секунд» — для текста диалога удаления. */
function fmtSecondsWord(n) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return n + ' секунда';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return n + ' секунды';
    return n + ' секунд';
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

    // Блок «03 Малые тела»: статические строки-группы, клик — полёт и выбор.
    buildSmallBodiesBlock();

    // Шапки блоков сворачивают своё тело: отдельные кнопки «скрыть/показать» не нужны.
    document.querySelectorAll('#sidePanel .panel-head').forEach(head => {
        head.addEventListener('click', () => head.parentElement.classList.toggle('collapsed'));
    });
}

/* ---------- Блок «03 Малые тела»: группы-источники метеоритов Земли ---------- */

// Строки блока. У групп-представителей клик — полёт камеры и выбор тела;
// у Койпера и Оорта выбора нет — камера просто показывает кольцо; строки
// метеоритов (met) ведут к Марсу и Луне и подсвечены отдельным типом.
const SMALL_ROWS = [
    { name: 'Главный пояс',          note: '99% метеоритов Земли',    to: 'Церера', z: 4 },
    { name: 'Околоземные (ОЗА)',     note: 'пересекают орбиту Земли', to: 'Эрос',   z: 4 },
    { name: 'Троянцы Юпитера',       note: 'попутчики Юпитера',       to: 'Гектор', z: 4 },
    { name: 'Кометы',                note: 'метеорные потоки',        to: 'Галлея', z: 3.5 },
    { name: 'Пояс Койпера',          note: 'родина короткопериодических комет', cam: [0, 0, 0.38] },
    { name: 'Облако Оорта',          note: 'родина долгопериодических комет',   cam: [0, 0, 0.3] },
    { name: 'Марсианские метеориты', note: '≈300 найдено на Земле',   to: 'Mars',   z: 5, met: true },
    { name: 'Лунные метеориты',      note: '≈500 найдено на Земле',   to: 'Луна',   z: 8, met: true }
];

/** Цель текущего кадра для строки блока: представитель, Марс или Луна. */
function smallRowTarget(row) {
    const tg = state.hoverTargets || [];
    if (row.to === 'Mars') return tg.find(t => t.kind === 'planet' && t.p.name === 'Mars') || null;
    if (row.to === 'Луна') {
        const earth = tg.find(t => t.kind === 'planet' && t.p.name === 'Earth');
        const mh = earth && earth.moons.find(x => x.m.n.indexOf('Луна') === 0);
        return mh ? { kind: 'moon', name: mh.m.n, x: mh.mx, y: mh.my, p: earth.p, m: mh.m } : null;
    }
    return tg.find(t => t.small && t.name.indexOf(row.to) === 0) || null;
}

/** Клик по строке блока: полёт камеры и выбор (Койпер/Оорт — только полёт). */
function onSmallRowClick(row) {
    if (row.cam) {   // выбора нет — просто показываем кольцо издалека
        flyToCamera(row.cam[0], row.cam[1], row.cam[2], 1.0);
        return;
    }
    const t = smallRowTarget(row);
    if (!t) return;
    flyToCamera(t.x, t.y, row.z, 0.8);
    if (t.small) {
        selectBody({ kind: t.kind, name: t.name,
            orbit: t.small.poly ? { poly: t.small.poly } : t.small.orbit,
            p: null, m: null, small: t.small });
    } else if (t.kind === 'moon') {
        selectBody({ kind: 'moon', p: t.p, m: t.m });
    } else {
        selectBody({ kind: 'planet', p: t.p });
    }
}

/** Собрать строки блока «03 Малые тела» (клики — полёт камеры + выбор). */
function buildSmallBodiesBlock() {
    const list = document.getElementById('smallList');
    if (!list) return;
    SMALL_ROWS.forEach(row => {
        const el = document.createElement('div');
        el.className = 'sb-row' + (row.met ? ' met' : '');
        el.title = row.note;
        el.innerHTML = '<span class="sb-name">' + row.name + '</span>' +
                       '<span class="sb-note">' + row.note + '</span>';
        el.addEventListener('click', () => onSmallRowClick(row));
        list.appendChild(el);
    });
}

/**
 * Плавно переместить камеру к точке карты (длительность — секунды реального
 * времени). Полёт продвигает updateFlyTo() из кадрового цикла; жест
 * пользователя (колесо, панорамирование, тач, клик) полёт отменяет (input.js).
 */
function flyToCamera(x, y, zoom, dur = 0.8) {
    state.fly = {
        t0: performance.now() / 1000,
        dur,
        from: { x: state.camX, y: state.camY, z: state.zoom },
        to: { x, y, z: clamp(zoom, MIN_ZOOM, MAX_ZOOM) }
    };
}

/** Продвинуть полёт камеры (каждый кадр из main.js до отрисовки мира). */
function updateFlyTo() {
    const f = state.fly;
    if (!f) return;
    const p = Math.min(1, (performance.now() / 1000 - f.t0) / f.dur);
    const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;  // easeInOutCubic
    state.camX = f.from.x + (f.to.x - f.from.x) * e;
    state.camY = f.from.y + (f.to.y - f.from.y) * e;
    state.zoom = f.from.z * Math.pow(f.to.z / f.from.z, e);   // зум — геометрически
    if (p >= 1) state.fly = null;
}

/**
 * Объект луны для выбора из дерева: настоящая луна из moonsByPlanet либо
 (у Земли) псевдо-луна, которую рисует render.js.
 */
function moonFromTree(planet, name) {
    const real = (moonsByPlanet[planet.name] || []).find(m => m.n === name);
    if (real) return real;
    // Луна Земли — псевдо-луна: отдельный блок рисования в render.js
    return { n: name, period: moonPeriod, r: 3 };
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
            '<div class="obj-title"><span class="dot" style="background:' + COLORS.sun + '"></span>' +
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
            row('На карте (крупные)', mapMoons.length) +
            (p.name === 'Mars' ? row('Марсианские метеориты', '≈300 <em>на Земле</em>', 'met') : '') +
            basesSectionHTML('planet', p.name, null);
    } else if (sel.kind === 'asteroid') {
        html = asteroidInfoHTML(sel.small);
    } else if (sel.kind === 'nea') {
        html = neaInfoHTML(sel.small);
    } else if (sel.kind === 'trojan') {
        html = trojanInfoHTML(sel.small);
    } else if (sel.kind === 'comet') {
        html = cometInfoHTML(sel.small);
    } else if (sel.kind === 'base') {
        html = sel.local ? newBaseInfoHTML(sel.local) : '';
    } else {
        const p = sel.p;
        const m = sel.m;
        const idx = (moonsByPlanet[p.name] || []).findIndex(x => x.n === m.n);
        const md = idx >= 0 ? moonOrbitRadius(p, idx) : moonDist;
        html =
            '<div class="obj-title"><span class="dot" style="background:' + (m.c || '#a8a8a8') + '"></span>' +
                '<strong>' + m.n + '</strong></div>' +
            '<div class="obj-kind">Спутник · ' + (RU[p.name] || p.name) + '</div>' +
            row('Планета', (RU[p.name] || p.name) + ' / ' + p.name) +
            (m.period ? row('Период обращения', fmtPeriod(m.period)) : '') +
            row('Радиус орбиты', Math.round(md * 10) / 10 + ' <em>ед.</em>') +
            (p.name === 'Earth' && m.n.indexOf('Луна') === 0 ? row('Лунные метеориты', '≈500 <em>на Земле</em>', 'met') : '') +
            basesSectionHTML('moon', p.name, m.n);
    }
    box.innerHTML = html;
    wireObjectCard(box);
}

const NEA_GROUPS = { amor: 'Амур', apollo: 'Аполлон', aten: 'Атон' };

/** Блок «Объект» для околоземного астероида. */
function neaInfoHTML(b) {
    const crosses = b.q < 1.017 && b.Q > 0.983;   // заходит внутрь орбиты Земли
    return '<div class="obj-title"><span class="dot" style="background:#d8d8d8"></span>' +
            '<strong>' + b.name + '</strong></div>' +
        '<div class="obj-kind">Околоземный астероид · группа «' + NEA_GROUPS[b.group] + '»</div>' +
        '<div class="obj-rows">' +
            row('Большая полуось', b.a.toFixed(3) + ' <em>а.е.</em>') +
            row('Эксцентриситет', b.e.toFixed(3)) +
            row('Период обращения', fmtPeriod(b.T)) +
            row('Перигелий / афелий', b.q.toFixed(3) + ' / ' + b.Q.toFixed(3) + ' <em>а.е.</em>') +
            row('Пересекает орбиту Земли', crosses ? 'да' : 'сближается') +
            row('Диаметр', (b.dia != null ? b.dia : '—') + ' <em>км</em>') +
        '</div>' +
        '<div class="obj-note">Околоземный объект — цель исследовательских миссий</div>';
}

/** Блок «Объект» для троянца Юпитера. */
function trojanInfoHTML(b) {
    const jupPeriod = planets.find(p => p.name === 'Jupiter').period;
    return '<div class="obj-title"><span class="dot" style="background:#cfcfcf"></span>' +
            '<strong>' + b.name + '</strong></div>' +
        '<div class="obj-kind">Троянец Юпитера · точка ' + (b.camp === 4 ? 'L4' : 'L5') + '</div>' +
        '<div class="obj-rows">' +
            row('Орбита', 'как у Юпитера · 5.2 <em>а.е.</em>') +
            row('Положение', b.camp === 4 ? 'опережает Юпитер на 60°' : 'отстаёт от Юпитера на 60°') +
            row('Период обращения', fmtPeriod(jupPeriod)) +
            row('Либрация', '±5° за ~150 лет') +
        '</div>' +
        '<div class="obj-note">Реликтовое вещество ранней Солнечной системы</div>';
}

const COMET_SRC = { oort: 'облако Оорта', kuiper: 'пояс Койпера' };

/** Блок «Объект» для кометы. */
function cometInfoHTML(b) {
    const years = b.T / 365.256;
    return '<div class="obj-title"><span class="dot" style="background:#f0f0f0"></span>' +
            '<strong>' + b.name + '</strong></div>' +
        '<div class="obj-kind">Комета · ' + (years < 200 ? 'короткопериодическая' : 'долгопериодическая') + '</div>' +
        '<div class="obj-rows">' +
            row('Большая полуось', b.a.toFixed(1) + ' <em>а.е.</em>') +
            row('Эксцентриситет', b.e.toFixed(4)) +
            row('Период обращения', fmtPeriod(b.T)) +
            row('Перигелий / афелий', b.q.toFixed(2) + ' / ' + b.Q.toFixed(1) + ' <em>а.е.</em>') +
            row('Источник', COMET_SRC[b.src] || '—') +
            (b.shower ? row('Метеорный поток', b.shower) : '') +
            row('Ядро', b.dia + ' <em>км</em>') +
        '</div>' +
        '<div class="obj-note">Хвост направлен от Солнца и ярче всего у перигелия</div>';
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

/* ---------- Звёздные базы: секция в карточке, кнопка создания ---------- */

/** Секция «Звёздные базы» в карточке планеты/луны: список + кнопка создания. */
function basesSectionHTML(kind, planet, moon) {
    const rows = [];
    basesAt(kind, planet, moon).forEach(b => rows.push(baseRowHTML(b.id, b.name,
        'орбита ' + Math.round(b.orbitRadius) + ' ед.', b)));

    const active = state.baseMode && state.baseMode.kind === kind &&
        state.baseMode.planet === planet && (state.baseMode.moon || null) === (moon || null);

    return '<div class="obj-sub-title"><span>Звёздные базы</span>' +
            (rows.length ? '<small>' + rows.length + '</small>' : '') + '</div>' +
        (rows.length
            ? '<div class="base-list">' + rows.join('') + '</div>'
            : '<div class="obj-note">Баз пока нет — создайте первую на орбите</div>') +
        '<button class="base-create' + (active ? ' active' : '') + '" id="baseCreateBtn"' +
            ' data-host-kind="' + kind + '" data-host-planet="' + planet + '" data-host-moon="' + (moon || '') + '">' +
            (active ? 'Отмена — выберите орбиту' : 'Создать базу') + '</button>';
}

/**
 * Строка базы в списке: имя и хвостик-подпись. У удаляемой базы (rec.status
 * 'removing') хвостик со временем заменяется красной полоской прогресса под
 * именем.
 */
function baseRowHTML(id, name, tail, rec) {
    const removing = rec && rec.status === 'removing' ? rec : null;
    return '<div class="base-row' + (removing ? ' removing' : '') + '" data-base="' + id + '">' +
        '<span class="b-dot"></span>' +
        '<span class="b-body"><span class="b-name">' + name + '</span>' +
            (removing ? removalBarHTML(removing) : '') + '</span>' +
        (removing ? '' : '<small>' + tail + '</small>') +
        '</div>';
}

/**
 * Красная полоска прогресса разбора под именем базы. Ширина растёт
 * CSS-анимацией на BASE_REMOVAL_MS; отрицательная задержка ставит её сразу
 * на текущий прогресс (карточка перерисовывается раз в секунду — полоска
 * между перерисовками не дёргается).
 */
function removalBarHTML(rec) {
    const elapsed = Math.round(removalProgress(rec) * BASE_REMOVAL_MS);
    return '<span class="rm-bar"><i style="animation-duration:' + BASE_REMOVAL_MS +
        'ms;animation-delay:-' + elapsed + 'ms"></i></span>';
}

/** Кнопка «Переместить базу» у созданной базы — в том же месте, что «Создать базу». */
function moveBaseButtonHTML(b) {
    const active = state.baseMode && state.baseMode.moveId === b.id;
    const off = b.status !== 'active' ? ' disabled' : '';   // удаляемую не переносим
    return '<button class="base-create' + (active ? ' active' : '') + '" id="baseMoveBtn"' +
        ' data-move-id="' + b.id + '"' + off + '>' +
        (active ? 'Отмена — выберите орбиту' : 'Переместить базу') + '</button>';
}

/** Кнопка «Удалить базу» — рядом с переносом, там же под описанием базы. */
function deleteBaseButtonHTML(b) {
    const off = b.status !== 'active' ? ' disabled' : '';   // повторно не удаляем
    return '<button class="base-create" id="baseDeleteBtn"' +
        ' data-delete-id="' + b.id + '"' + off + '>Удалить базу</button>';
}

/** Выбрать хозяина базы (планету или луну) — карточка с её списком баз. */
function selectBaseHost(rec) {
    const p = planets.find(q => q.name === rec.planet);
    if (!p) { selectBody(null); return; }
    if (rec.hostKind === 'moon') {
        // Луна Земли рисуется отдельным блоком (render.js) — как и там
        const m = (moonsByPlanet[rec.planet] || []).find(x => x.n === rec.moon) ||
            { n: rec.moon, r: 3, period: moonPeriod };
        selectBody({ kind: 'moon', name: rec.moon, p, m });
    } else {
        selectBody({ kind: 'planet', name: p.name, p, m: null });
    }
}

/**
 * Оживить карточку после innerHTML: клики по строкам баз (выбор) и кнопка
 * «Создать базу» — включает режим выбора орбиты на карте (подтверждает клик,
 * отменяют Esc и правая кнопка; обработка — в input.js). У карточки базы —
 * «Переместить базу» (тот же режим) и «Удалить базу» (запись убирается).
 */
function wireObjectCard(box) {
    box.querySelectorAll('.base-row').forEach(el => {
        el.addEventListener('click', () => {
            const id = el.dataset.base;
            const rec = bases.find(b => b.id === id);
            if (!rec) return;
            const p = planets.find(x => x.name === rec.planet);
            selectBody({ kind: 'base', name: rec.name, local: rec, p, m: null });
        });
    });

    const btn = box.querySelector('#baseCreateBtn');
    if (btn) btn.addEventListener('click', () => {
        const kind = btn.dataset.hostKind;
        const planet = btn.dataset.hostPlanet;
        const moon = btn.dataset.hostMoon || null;
        // Режим уже активен (хост мог переехать к ближайшему телу) — отменяем его,
        // иначе начинаем выбор орбиты у этой планеты/луны.
        state.baseMode = state.baseMode ? null : { kind, planet, moon };
        // Стартовый радиус 60 — но по механизму баз: коридор хоста плюс
        // разведение с другими его базами (fitBaseRadius).
        state.baseRadius = state.baseMode ? fitBaseRadius(60, state.baseMode, null) : 60;
        renderObjectInfo();   // надпись кнопки: «Создать базу» <-> «Отмена»
    });

    const mvBtn = box.querySelector('#baseMoveBtn');
    if (mvBtn) mvBtn.addEventListener('click', () => {
        // Тот же режим выбора орбиты, но запись не создаётся, а переносится:
        // клик по карте сменит хост (по правилу ближайшего тела) и радиус базы.
        if (state.baseMode) {
            state.baseMode = null;
        } else {
            const rec = bases.find(b => b.id === mvBtn.dataset.moveId);
            if (!rec || rec.status !== 'active') return;   // удаляемую не переносим
            state.baseMode = { kind: rec.hostKind, planet: rec.planet, moon: rec.moon || null, moveId: rec.id };
            // Стартуем с текущего радиуса базы — по механизму: коридор хоста и
            // разведение с другими базами (сама переносимая не мешает).
            state.baseRadius = fitBaseRadius(rec.orbitRadius, state.baseMode, rec.id);
        }
        renderObjectInfo();   // надпись кнопки: «Переместить базу» <-> «Отмена»
    });

    const delBtn = box.querySelector('#baseDeleteBtn');
    if (delBtn) delBtn.addEventListener('click', () => {
        const rec = bases.find(b => b.id === delBtn.dataset.deleteId);
        if (!rec || rec.status !== 'active') return;
        // Спрашиваем подтверждение в общем стиле ангара — сразу не удаляем.
        confirmDialog({
            eyebrow: 'Звёздная база',
            title: 'Удалить базу?',
            text: 'База <b>«' + rec.name + '»</b> будет разбираться ' +
                fmtSecondsWord(Math.round(BASE_REMOVAL_MS / 1000)) + ': ей нельзя будет пользоваться, ' +
                'затем она исчезнет с орбиты, а запись переедет в архив.',
            okLabel: 'Удалить',
            onOk: () => {
                // Если эта база как раз переносилась — сначала выходим из режима.
                if (state.baseMode && state.baseMode.moveId === rec.id) state.baseMode = null;
                if (!startBaseRemoval(rec)) return;
                renderObjectInfo();   // карточка покажет статус и таймер до конца разбора
            }
        });
    });
}

/** Перерисовать карточку выбранного объекта (зовёт input.js при отмене режима). */
function refreshObjectCard() {
    renderObjectInfo();
}

/* ---------- Диалог подтверждения (общий стиль ангара: .slot-dialog) ---------- */

let dialogEl = null;   // открытый оверлей: одновременно не больше одного

function closeDialog() {
    if (dialogEl && dialogEl.parentNode) dialogEl.parentNode.removeChild(dialogEl);
    dialogEl = null;
    document.removeEventListener('keydown', dialogKey, true);
}

/** Esc закрывает диалог и не доходит до карты — режим выбора орбиты остаётся. */
function dialogKey(e) {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    closeDialog();
}

/**
 * Модальное подтверждение в общем стиле (как .slot-modal/.slot-dialog в
 * ангаре): eyebrow, заголовок, текст и две кнопки — «Отмена» и действие
 * (opts.okLabel). Клик по фону, «×» и Esc закрывают без действия; кнопка
 * действия закрывает диалог и зовёт opts.onOk.
 * @param {{eyebrow?: string, title: string, text: string, okLabel: string, onOk: Function}} opts
 */
function confirmDialog(opts) {
    closeDialog();
    const ov = document.createElement('div');
    ov.className = 'dlg-overlay';
    ov.innerHTML =
        '<div class="dlg" role="dialog" aria-modal="true">' +
            '<div class="dlg-head"><div>' +
                (opts.eyebrow ? '<span class="dlg-eyebrow">' + opts.eyebrow + '</span>' : '') +
                '<h3>' + opts.title + '</h3></div>' +
            '<button class="dlg-close" aria-label="Закрыть">×</button></div>' +
            '<div class="dlg-text">' + opts.text + '</div>' +
            '<div class="dlg-foot">' +
                '<button class="dlg-btn" data-act="cancel">Отмена</button>' +
                '<button class="dlg-btn danger" data-act="ok">' + opts.okLabel + '</button>' +
            '</div>' +
        '</div>';
    ov.addEventListener('mousedown', e => { if (e.target === ov) closeDialog(); });   // клик по фону
    ov.querySelector('.dlg-close').addEventListener('click', closeDialog);
    ov.querySelector('[data-act="cancel"]').addEventListener('click', closeDialog);
    ov.querySelector('[data-act="ok"]').addEventListener('click', () => {
        closeDialog();
        if (opts.onOk) opts.onOk();
    });
    document.addEventListener('keydown', dialogKey, true);
    document.getElementById('modal-root').appendChild(ov);
    dialogEl = ov;
}

/* ---------- Удаление баз: секундный тик карточки ---------- */

let cardTickSec = -1;            // секунда последней перерисовки карточки
let cardTickHadRemoving = false; // была ли удаляемая база на прошлом тике

/**
 * Кадр (main.js): пока идёт удаление, раз в секунду обновлять открытую
 * карточку — в ней тикает таймер. Когда выбранная база доудалилась,
 * карточка сама переключается на её хозяина (планету или луну).
 */
function updateBaseTimerCard() {
    const sel = state.selected;
    if (sel && sel.local && sel.local.status === 'removed') {
        selectBaseHost(sel.local);
        return;
    }
    const removing = bases.some(b => b.status === 'removing');
    const relevant = sel && (sel.kind === 'base' || sel.kind === 'planet' || sel.kind === 'moon');
    if (!relevant) { cardTickHadRemoving = removing; return; }
    const wasRemoving = cardTickHadRemoving;
    cardTickHadRemoving = removing;
    if (!removing && !wasRemoving) return;      // ничего не удаляется — карточку не трогаем
    const s = Math.floor(Date.now() / 1000);
    if (removing && s === cardTickSec) return;  // идёт разбор: не чаще раза в секунду
    cardTickSec = s;
    renderObjectInfo();
}

/** Блок «Объект» для звездной базы, созданной игроком на карте. */
function newBaseInfoHTML(b) {
    const host = b.hostKind === 'moon'
        ? 'луна ' + b.moon
        : 'планета ' + (RU[b.planet] || b.planet);
    const removing = b.status === 'removing';   // идёт разбор: имя краснеет, под ним полоска прогресса, кнопки выключены
    const fleet = !!b.fleet;    // стартовая LUNA-ORBIT: в карточке — купленные корабли
    return '<div class="obj-title' + (removing ? ' danger' : '') + '"><span class="dot" style="background:' + COLORS.base + ';box-shadow:0 0 8px rgba(0,255,255,.6)"></span>' +
            '<strong>База ' + b.name + '</strong></div>' +
        (removing ? removalBarHTML(b) : '') +
        '<div class="obj-kind">Звёздная база · ' + host + '</div>' +
        '<div class="obj-rows">' +
            row('Радиус орбиты', b.orbitRadius + ' <em>ед.</em>') +
            row('Период обращения', fmtPeriod(b.period)) +
            row('Создана', (b.created || '').slice(0, 10)) +
            (removing ? row('Статус', 'удаляется') : '') +
        '</div>' +
        (removing
            ? '<div class="obj-note">База разбирается — перенос и повторное удаление недоступны</div>'
            : fleet ? '' : '<div class="obj-note">Новая база на орбите — корабли и постройки появятся позже</div>') +
        (fleet && !removing ? shipsSectionHTML() : '') +
        moveBaseButtonHTML(b) +
        deleteBaseButtonHTML(b);
}

function row(k, v, cls) {
    return '<div class="obj-row' + (cls ? ' ' + cls : '') + '"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
}

/* ---------- База: купленные корабли из data/store.js ---------- */

/**
 * Секция «Купленные корабли» для карточки базы: список в формате «В продаже»
 * из ангара (имя, масса, категория, цена). Данные — общие с админкой и ангаром
 * (window.Store, ключ galaxy_admin_db_v1). Показывается у базы игрока (флаг
 * fleet — стартовая LUNA-ORBIT).
 */
function shipsSectionHTML() {
    const ships = readUserShips();
    let html = '<div class="obj-sub-title"><span>Купленные корабли</span>' +
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
//   2) завершает удаления баз с вышедшим таймером и тикает карточку,
//   3) рисует мир (render.js),
//   4) рисует hover-подсказки поверх (hover.js),
//   5) обновляет HUD (ui.js).
// =============================================================================










// --- Инициализация --------------------------------------------------------------
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const hud = getHudElements();

resize(canvas);
window.addEventListener('resize', () => resize(canvas));

initInput(canvas, getSpeedButtons());
buildSidePanel();

// Canvas не подгружает веб-шрифты сам: если Manrope ещё не использовал ни один
// DOM-элемент, подписи баз на карте молча отрисуются fallback-шрифтом. Просим
// начертание заранее — уже загруженный шрифт следующего кадра подхватит сам.
if (document.fonts && document.fonts.load) document.fonts.load('600 12px "Manrope"');

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

    updateFlyTo();   // полёт камеры к строке блока «Малые тела» — до отрисовки мира
    updateBaseRemovals();    // удаления баз: завершить те, у кого вышел таймер
    updateBaseTimerCard();   // и обновить открытую карточку с таймером (раз в секунду)

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
