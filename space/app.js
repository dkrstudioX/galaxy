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
const SUN_R = 22; // радиус ядра солнца (условные единицы мира)

// --- Изометрия -------------------------------------------------------------------
// Референсы карты — диметрия 2:1: плоскость эклиптики сжимается по вертикали
// вдвое. Все позиции тел, камеры и hover-целей живут в «виде» (view): y уже
// умножен на ISO_K. Физика (орбиты, коридоры баз) остаётся в raw-координатах.
const ISO_K = 0.5;

// Высота над плоскостью эклиптики в той же ортогональной проекции:
// если плоскость сжата как sin(26.57°) = 0.5, то вертикаль — cos(26.57°).
// Так наклонные орбиты (inc/node) получают реальный экранный наклон, а не
// декоративный подъём.
const ISO_Z = 0.866;

// Высота маркера базы над полом — в экранных пикселях (делится на zoom).
const LIFT = {
    base: 10
};

// --- Стили карты -------------------------------------------------------------------
// Солнце, планеты и луны — сферы: радиальный градиент с бликом в верхней левой
// части и тёмным краем. Тени — эллипсы на полу. Плоских обводок больше нет.
const COLORS = {
    sun: '#ffd75e',
    sunCore: '#fffef7',
    sunMid: '#ffe7a3',
    sunEdge: '#ff9d3c',
    sunOuter: '#ff7a18',
    planetStroke: '#efefef',
    moon: '#a8a8a8',
    moonStroke: '#d6d6d6',
    base: '#35e8d8', // цвет базы с референса map4/map5/map6
    danger: '#ff5f7a', // удаление базы: имя и полоска прогресса (общий красный проекта)
    tooltip: '#ffffff',
    tooltipShadow: 'rgba(0,0,0,0.6)',
    orbitPlanet: 'rgba(120,140,200,0.6)',
    orbitMoon: 'rgba(150,160,180,0.6)',
    orbitSelected: 'rgba(122,236,224,0.8)', // орбита выбранного кликом тела (акцент hangar)
    cometIon: '#bff6ff',
    cometDust: '#ffe7a3',
    cometComa: '#dff8ff',
    starHalo: 'rgba(255,157,60,0.18)'
};

// Толщина обводок в пикселях экрана (делим на zoom при отрисовке).
// Оставлено для тонкого rim сфер и мелких тел.
const STROKE = {
    sun: 2.5,
    planet: 0.6,
    moon: 0.45
};

// Тень на полу: смещение вниз и пропорции эллипса.
const SHADOW = {
    alpha: 0.34,
    dy: 0.65,       // доля радиуса тела
    rx: 1.0,        // доля радиуса по горизонтали
    ry: 0.32        // доля радиуса по вертикали
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
 * @param {Function} [mapDist] перевод радиуса в единицы карты; по умолчанию
 *        а.е. -> условные единицы (auToDist). Для планет с уже сжатым
 *        радиусом p.dist передаётся тождественная функция.
 * @returns {{x: number, y: number, rAu: number}} единицы мира + радиус, а.е.
 */
function keplerPos(a, e, peri, m0, T, t, mapDist = auToDist) {
    let turns = (m0 / 360 + t / T) % 1;
    if (turns < 0) turns += 1;
    const M = turns * 2 * Math.PI;

    // стартовое приближение для высоких эксцентриситетов, затем итерации Ньютона
    let E = M + e * Math.sin(M);
    for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));

    const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    const rAu = a * (1 - e * Math.cos(E));
    const th = nu + peri * Math.PI / 180;
    const r = mapDist(rAu);
    return { x: Math.cos(th) * r, y: -Math.sin(th) * r, rAu };
}

/** Градусы -> радианы для орбитальных элементов. */
const ORBIT_RAD = Math.PI / 180;

/**
 * Точка на орбите с наклонением. lon — долгота в плоскости эклиптики
 * (радианы), inc — наклонение, node — долгота восходящего узла (градусы).
 * Возвращает уже 3D-точку: x, y (вниз), z (высота над эклиптикой).
 */
function orbitPoint3(radius, lon, incDeg = 0, nodeDeg = 0) {
    const inc = incDeg * ORBIT_RAD;
    const node = nodeDeg * ORBIT_RAD;
    const u = lon - node;                 // аргумент широты от узла
    const cu = Math.cos(u), su = Math.sin(u);
    const ci = Math.cos(inc), si = Math.sin(inc);
    const co = Math.cos(node), so = Math.sin(node);

    // Поворот орбитальной плоскости: Rz(node) * Rx(inc) * Rz(-node),
    // затем перевод в экранные «y вниз».
    return {
        x: radius * (co * cu - so * su * ci),
        y: -radius * (so * cu + co * su * ci),
        z: radius * su * si
    };
}

/**
 * Позиция тела на наклонной орбите: те же элементы, что у keplerPos, плюс
 * реальные inc/node. Плоский случай (inc = node = 0) совпадает с keplerPos.
 * @returns {{x: number, y: number, z: number, rAu: number}}
 */
function keplerPos3(a, e, peri, m0, T, t, mapDist = auToDist, inc = 0, node = 0) {
    const flat = keplerPos(a, e, peri, m0, T, t, mapDist);
    const r = Math.hypot(flat.x, flat.y);
    const lon = Math.atan2(-flat.y, flat.x);
    return Object.assign(orbitPoint3(r, lon, inc, node), { rAu: flat.rAu });
}

/**
 * Замкнутая полилиния орбиты по элементам: плоский массив x0, y0, x1, y1…
 * (сырые единицы карты). Нужна для эллиптических орбит, где descriptor
 * {a,b,rot} после проекции уже неудобен.
 * @param {Function} [mapDist] как у keplerPos
 */
function keplerPoly(a, e, peri, m0, T, steps = 128, mapDist = auToDist) {
    const pts = [];
    for (let k = 0; k <= steps; k++) {
        const pos = keplerPos(a, e, peri, m0, T, k * T / steps, mapDist);
        pts.push(pos.x, pos.y);
    }
    return pts;
}

/**
 * То же, но с наклонением: x0,y0,z0,x1,y1,z1… (сырые единицы карты).
 * @param {Function} [mapDist] как у keplerPos
 */
function keplerPoly3(a, e, peri, m0, T, steps = 128, mapDist = auToDist, inc = 0, node = 0) {
    const pts = [];
    for (let k = 0; k <= steps; k++) {
        const pos = keplerPos3(a, e, peri, m0, T, k * T / steps, mapDist, inc, node);
        pts.push(pos.x, pos.y, pos.z);
    }
    return pts;
}

// ===== data.js =====
// =============================================================================
// data.js — астрономические данные: планеты, луны, база.
// Только данные, никакой логики. Периоды сидерические (сутки), долготы L0
// средние на эпоху J2000 (градусы) — отсюда реалистичные взаимные положения.
// =============================================================================

// Планеты. r и dist — условные единицы мира (dist — сжатая большая полуось,
// порядок и относительные расстояния верные). l0 — средняя долгота на J2000,
// e — реальный эксцентриситет, peri — долгота перигелия, inc/node — реальное
// наклонение и долгота восходящего узла к плоскости эклиптики (J2000).
// Позиция считается уравнением Кеплера (math.js keplerPos3), поэтому форма,
// наклон и скорость движения соответствуют реальным элементам.
// rings — рисовать кольца (Сатурн). type оставлен для совместимости.
// ru — русское имя для подписей на карте и в карточках (ui.js).
const planets = [
    { name: 'Mercury', ru: 'Меркурий', color: '#b5b5b5', r: 4,  dist: 70,  period: 87.969,   l0: 252.251, e: 0.205636, peri: 77.458,  inc: 7.005,  node: 48.331,  type: 'rocky' },
    { name: 'Venus',   ru: 'Венера',   color: '#e8cda0', r: 7,  dist: 110, period: 224.701,  l0: 181.980, e: 0.006777, peri: 131.602, inc: 3.395,  node: 76.680,  type: 'rocky' },
    { name: 'Earth',   ru: 'Земля',    color: '#4488ff', r: 8,  dist: 160, period: 365.256,  l0: 100.464, e: 0.016711, peri: 102.938, inc: 0.000,  node: 0.000,   type: 'earth' },
    { name: 'Mars',    ru: 'Марс',     color: '#c1440e', r: 5,  dist: 220, period: 686.980,  l0: 355.453, e: 0.093394, peri: 336.041, inc: 1.850,  node: 49.579,  type: 'rocky' },
    { name: 'Jupiter', ru: 'Юпитер',   color: '#c88b3a', r: 22, dist: 380, period: 4332.589, l0: 34.396,  e: 0.048386, peri: 14.728,  inc: 1.304,  node: 100.464, type: 'gas' },
    { name: 'Saturn',  ru: 'Сатурн',   color: '#e8d191', r: 18, dist: 520, period: 10759.22, l0: 49.954,  e: 0.053862, peri: 92.599,  inc: 2.488,  node: 113.665, type: 'gas', rings: true },
    { name: 'Uranus',  ru: 'Уран',     color: '#7de8e8', r: 12, dist: 660, period: 30685.4,  l0: 313.238, e: 0.047257, peri: 170.954, inc: 0.773,  node: 74.006,  type: 'ice' },
    { name: 'Neptune', ru: 'Нептун',   color: '#3f54ba', r: 12, dist: 780, period: 60189.0,  l0: 304.880, e: 0.008590, peri: 44.965,  inc: 1.770,  node: 131.784, type: 'ice' }
];

/** Средняя аномалия планеты на J2000: L0 − долгота перигелия. */
function planetM0(p) {
    return p.l0 - p.peri;
}

// Луна Земли: сидерический период 27.32 суток.
const moonDist = 22;          // радиус орбиты Луны от Земли
const moonPeriod = 27.321661; // суток
const moonL0 = 218.32;        // средняя долгота на J2000, градусы
const moonInc = 5.145;        // наклонение к эклиптике, градусы
const moonNode = 125.08;      // долгота восходящего узла, градусы
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
    const list = moonsByPlanet[p.name] || [];
    const m = list[i];
    if (!m || !m.a) return p.r + 12 + i * 7;

    // Реальные большие полуоси лун сжаты логарифмически, как и вся карта:
    // порядок и относительный размах сохранены, но Ио и Гималия не разлетаются
    // на сотни единиц. Внутренняя луна — p.r + 12, внешняя — p.r + 40.
    const amin = Math.min(...list.map(x => x.a));
    const amax = Math.max(...list.map(x => x.a));
    const t = Math.log(m.a / amin + 1) / Math.log(amax / amin + 1);
    return p.r + 12 + t * 28;
}

// Главные луны других планет: период (сутки), реальная большая полуось a (км),
// радиус отрисовки r, цвет c, стартовая фаза phase (градусы, произвольная).
// inc/node — наклонение и узел орбиты луны относительно эклиптики (J2000):
// у регулярных лун это плоскость экватора планеты (поэтому у Урана ~98°,
// у Сатурна ~26.7°), у нерегулярных — собственное наклонение.
// moonOrbitRadius ставит луны по реальному a (логарифмическое сжатие), поэтому
// порядок списка не важен; что показано при текущем зуме, решает слипание тел
// по экранному расстоянию (scene.js clusterBodies).
const moonsByPlanet = {
    Mars: [
        { n: 'Phobos',   period: 0.3189, a: 9376,     r: 1.5, c: '#9c8f84', phase: 40,  inc: 26.04, node: 125.08 },
        { n: 'Deimos',   period: 1.2624, a: 23463,    r: 1.3, c: '#b3a89e', phase: 150, inc: 26.58, node: 125.08 }
    ],
    Jupiter: [
        { n: 'Io',       period: 1.769,  a: 421700,   r: 2.3, c: '#d8c26a', phase: 70,  inc: 0.04,  node: 100.46 },
        { n: 'Europa',   period: 3.551,  a: 671034,   r: 2.0, c: '#cbb8a0', phase: 190, inc: 0.47,  node: 100.46 },
        { n: 'Ganymede', period: 7.155,  a: 1070412,  r: 2.7, c: '#9a8f85', phase: 300, inc: 0.20,  node: 100.46 },
        { n: 'Callisto', period: 16.689, a: 1882709,  r: 2.5, c: '#7d746c', phase: 20,  inc: 0.19,  node: 100.46 },
        { n: 'Amalthea', period: 0.498,  a: 181365,   r: 1.2, c: '#b06a4a', phase: 130, inc: 0.38,  node: 100.46 },
        { n: 'Himalia',  period: 250.6,  a: 11460000, r: 1.2, c: '#8a8078', phase: 45,  inc: 27.50, node: 40.00 }
    ],
    Saturn: [
        { n: 'Mimas',    period: 0.942,  a: 185539,   r: 1.5, c: '#b8bcc2', phase: 110, inc: 26.73, node: 113.67 },
        { n: 'Enceladus',period: 1.370,  a: 238037,   r: 1.7, c: '#d9dee3', phase: 250, inc: 26.73, node: 113.67 },
        { n: 'Rhea',     period: 4.518,  a: 527108,   r: 1.9, c: '#a8adb5', phase: 330, inc: 26.73, node: 113.67 },
        { n: 'Titan',    period: 15.945, a: 1221870,  r: 2.9, c: '#c79b5a', phase: 80,  inc: 26.73, node: 113.67 },
        { n: 'Dione',    period: 2.737,  a: 377396,   r: 1.6, c: '#c2c7cd', phase: 15,  inc: 26.73, node: 113.67 },
        { n: 'Tethys',   period: 1.888,  a: 294619,   r: 1.6, c: '#ccd1d6', phase: 200, inc: 26.73, node: 113.67 },
        { n: 'Iapetus',  period: 79.32,  a: 3560820,  r: 1.7, c: '#8f8478', phase: 300, inc: 15.47, node: 80.00 }
    ],
    Uranus: [
        { n: 'Miranda',  period: 1.413,  a: 129390,   r: 1.4, c: '#a9b3b8', phase: 210, inc: 97.77, node: 74.01 },
        { n: 'Ariel',    period: 2.520,  a: 190900,   r: 1.7, c: '#b6c0c4', phase: 20,  inc: 97.77, node: 74.01 },
        { n: 'Umbriel',  period: 4.144,  a: 266000,   r: 1.5, c: '#7e888d', phase: 95,  inc: 97.77, node: 74.01 },
        { n: 'Titania',  period: 8.706,  a: 436300,   r: 2.1, c: '#9aa5ab', phase: 140, inc: 97.77, node: 74.01 },
        { n: 'Oberon',   period: 13.463, a: 583500,   r: 2.0, c: '#8b969c', phase: 260, inc: 97.77, node: 74.01 },
        { n: 'Puck',     period: 0.762,  a: 86004,    r: 1.1, c: '#9c9a94', phase: 175, inc: 97.77, node: 74.01 }
    ],
    Neptune: [
        { n: 'Proteus',  period: 1.122,  r: 1.5, c: '#8f9aa3', phase: 310, inc: 28.32,  node: 131.78 },
        { n: 'Triton',   period: 5.877,  r: 2.3, c: '#c3cdd4', phase: 100, inc: 156.88, node: 177.40 },
        { n: 'Nereid',   period: 360.1,  r: 1.2, c: '#9aa2ab', phase: 220, inc: 35.00,  node: 131.78 }
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
    { n: 'Ceres',  ru: 'Церера',  a: 2.7675, e: 0.0785, peri: 73.6,  m0: 95,  dia: 939, inc: 10.59, node: 80.3,  type: 'dwarf' },
    { n: 'Vesta',  ru: 'Веста',   a: 2.3615, e: 0.0887, peri: 151.2, m0: 210, dia: 525, inc: 7.14,  node: 103.8 },
    { n: 'Pallas', ru: 'Паллада', a: 2.7727, e: 0.2313, peri: 310.0, m0: 42,  dia: 512, inc: 34.84, node: 173.0 },
    { n: 'Hygiea', ru: 'Гигея',   a: 3.1395, e: 0.1067, peri: 313.2, m0: 152, dia: 434, inc: 3.83,  node: 283.2 }
];

// Околоземные астероиды (реальные элементы; m0 — произвольная фаза карты).
// Группы: amor — перигелий между орбитами Земли и Марса, орбиту Земли не
// пересекают; apollo — пересекают орбиту Земли, a > 1 а.е.; aten — пересекают,
// a < 1 а.е. Тутатис — «переходный»: афелий 4.1 а.е. — заходит в пояс.
const neas = [
    { n: 'Eros',      ru: 'Эрос',      group: 'amor',   a: 1.4582, e: 0.2226, peri: 178.9, m0: 250, dia: 16.8, inc: 10.83, node: 304.3 },
    { n: 'Amor',      ru: 'Амур',      group: 'amor',   a: 1.9197, e: 0.4351, peri: 26.7,  m0: 120, dia: 1.0,  inc: 11.00, node: 171.3 },
    { n: 'Ganymed',   ru: 'Ганимед',   group: 'amor',   a: 2.6632, e: 0.5339, peri: 132.4, m0: 300, dia: 35,   inc: 26.70, node: 215.5 },
    { n: 'Apollo',    ru: 'Аполлон',   group: 'apollo', a: 1.4704, e: 0.5599, peri: 285.7, m0: 60,  dia: 1.5,  inc: 6.35,  node: 35.5  },
    { n: 'Bennu',     ru: 'Бенну',     group: 'apollo', a: 1.1264, e: 0.2038, peri: 66.2,  m0: 101, dia: 0.49, inc: 6.00,  node: 2.0   },
    { n: 'Itokawa',   ru: 'Итокава',   group: 'apollo', a: 1.3241, e: 0.2801, peri: 162.8, m0: 312, dia: 0.33, inc: 1.62,  node: 69.1  },
    { n: 'Toutatis',  ru: 'Тутатис',   group: 'apollo', a: 2.5344, e: 0.6299, peri: 278.8, m0: 190, dia: 4.5,  inc: 0.45,  node: 124.3 },
    { n: 'Didymos',   ru: 'Дидим',     group: 'apollo', a: 1.6444, e: 0.3835, peri: 319.3, m0: 340, dia: 0.78, inc: 3.40,  node: 73.0  },
    { n: 'Icarus',    ru: 'Икар',      group: 'apollo', a: 1.0780, e: 0.8265, peri: 31.5,  m0: 210, dia: 1.4,  inc: 22.80, node: 88.0  },
    { n: 'Nereus',    ru: 'Нерей',     group: 'apollo', a: 1.4892, e: 0.3603, peri: 158.0, m0: 15,  dia: 0.33, inc: 1.43,  node: 159.5 },
    { n: 'Aten',      ru: 'Атон',      group: 'aten',   a: 0.9668, e: 0.1826, peri: 147.5, m0: 280, dia: 1.1,  inc: 6.40,  node: 122.9 },
    { n: 'Apophis',   ru: 'Апофис',    group: 'aten',   a: 0.9224, e: 0.1914, peri: 126.4, m0: 60,  dia: 0.37, inc: 3.34,  node: 204.4 },
    { n: 'Ra-Shalom', ru: 'Ра-Шалом',  group: 'aten',   a: 0.8322, e: 0.4364, peri: 356.0, m0: 130, dia: 2.3,  inc: 2.50,  node: 169.9 },
    { n: 'Cruithne',  ru: 'Круитни',   group: 'aten',   a: 0.9978, e: 0.5148, peri: 12.0,  m0: 220, dia: 5,    inc: 19.80, node: 126.2 }
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
// inc/node — реальное наклонение и долгота узла: по ним комета поднимается
// над плоскостью карты и её орбита действительно наклонена к эклиптике.
const comets = [
    { n: '1P/Halley',        ru: 'Галлея',         a: 17.834, e: 0.9671, peri: 111.3, m0: 234, dia: 11, inc: 162.26, node: 58.42,  shower: 'Ориониды · Эта-Аквариды', src: 'oort',   tailK: 1.0 },
    { n: '2P/Encke',         ru: 'Энке',           a: 2.2151, e: 0.8483, peri: 187.6, m0: 323, dia: 4.8, inc: 11.78,  node: 334.57, shower: 'Тауриды',                src: 'kuiper', tailK: 0.75 },
    { n: '109P/Swift-Tuttle', ru: 'Свифта—Таттла', a: 26.09,  e: 0.9633, peri: 113.4, m0: 289, dia: 26, inc: 113.45, node: 139.40, shower: 'Персеиды',               src: 'oort',   tailK: 1.0 },
    { n: 'C/1995 O1',        ru: 'Хейла—Боппа',    a: 186.0,  e: 0.9951, peri: 130.6, m0: 0,   dia: 60, inc: 89.43,  node: 282.47, shower: null,                     src: 'oort',   tailK: 0.9 }
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

// ===== iso.js =====
// =============================================================================
// iso.js — проекция карты в диметрию 2:1.
//
// Мир (raw) — плоскость эклиптики: окружности, радиусы, коридоры баз.
// Вид (view) — та же плоскость, сжатая по вертикали: y *= ISO_K.
// Высота z над эклиптикой проецируется отдельно: y -= z * ISO_Z. Это даёт
// реальный наклон орбит по inc/node, а не только декоративный подъём.
// Вся отрисовка, камера, hover-цели и подписи живут в view; физика — в raw.
//
// Здесь только чистые функции: без canvas, состояния и данных.
// =============================================================================



/**
 * 3D-точка эклиптики (x, y, z) -> view.
 * x — долгота, y — поперечная ось (вниз), z — высота над плоскостью.
 */
function project3(x, y, z = 0) {
    return { x, y: y * ISO_K - z * ISO_Z };
}

/** raw -> view для плоской орбиты (z = 0). */
function view(x, y) {
    return project3(x, y, 0);
}

/** raw-y -> view-y. */
function viewY(y) {
    return y * ISO_K;
}

/** view-y -> raw-y (обратный перевод для физики базы). */
function unviewY(y) {
    return y / ISO_K;
}

/**
 * Точка на круговой орбите вокруг центра: угол против часовой, y — вниз.
 * Центр и результат — в view-координатах.
 */
function orbitPoint(cx, cy, r, ang) {
    return {
        x: cx + Math.cos(ang) * r,
        y: cy - Math.sin(ang) * r * ISO_K
    };
}

/**
 * Начать путь эллипса орбиты вокруг центра (view).
 * У круговой орбиты радиуса r на карте rx = r, ry = r * ISO_K.
 */
function orbitEllipsePath(ctx, cx, cy, r, rot = 0) {
    ctx.ellipse(cx, cy, Math.abs(r), Math.abs(r) * ISO_K, rot, 0, Math.PI * 2);
}

/** Плоский массив x0,y0,x1,y1… из raw -> view. */
function viewPoly(poly) {
    const out = new Array(poly.length);
    for (let i = 0; i < poly.length; i += 2) {
        out[i] = poly[i];
        out[i + 1] = poly[i + 1] * ISO_K;
    }
    return out;
}

/** Плоский массив x0,y0,z0,x1,y1,z1… из raw -> view x/y. */
function view3Poly(poly) {
    const out = [];
    for (let i = 0; i < poly.length; i += 3) {
        const v = project3(poly[i], poly[i + 1], poly[i + 2]);
        out.push(v.x, v.y);
    }
    return out;
}

/** Расстояние в raw-единицах по смещению в view. */
function rawDist(dx, dy) {
    return Math.hypot(dx, dy / ISO_K);
}

/** Угол орбиты (как в orbitAngle) по смещению в view. */
function rawAngle(dx, dy) {
    return Math.atan2(-(dy / ISO_K), dx);
}

/** Пиксели экрана -> мировые единицы view (для теней/ножек/хвостов). */
function px(pxValue, zoom) {
    return pxValue / zoom;
}

// ===== paint.js =====
// =============================================================================
// paint.js — «живопись» карты: сферы, тени, свечения, ромб базы, камни.
// Все функции рисуют в текущей (мировой/view) системе координат. Размеры в
// world-единицах; экранные пиксели делятся на zoom вызывающим кодом.
// =============================================================================




const rgbCache = new Map();

/** '#rgb' / '#rrggbb' -> {r,g,b}; неизвестное — серый. */
function parseColor(color) {
    if (rgbCache.has(color)) return rgbCache.get(color);
    let out = { r: 200, g: 200, b: 200 };
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color).trim());
    if (m) {
        let h = m[1];
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        out = {
            r: parseInt(h.slice(0, 2), 16),
            g: parseInt(h.slice(2, 4), 16),
            b: parseInt(h.slice(4, 6), 16)
        };
    }
    rgbCache.set(color, out);
    return out;
}

/** Цвет с прозрачностью: hex -> rgba(...). */
function alpha(color, a) {
    const c = parseColor(color);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
}

/** Смешать два цвета: k=0 — color, k=1 — target. */
function mix(color, target, k) {
    const a = parseColor(color), b = parseColor(target);
    const f = (x, y) => Math.round(x + (y - x) * k);
    return 'rgb(' + f(a.r, b.r) + ',' + f(a.g, b.g) + ',' + f(a.b, b.b) + ')';
}

/**
 * Сфера с бликом в верхней левой части и тёмным краем.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x,y,r  view-координаты и радиус, world-единицы
 * @param {string} color  основной цвет тела
 * @param {{zoom?: number, rim?: boolean, rimAlpha?: number}} [opts]
 */
function sphere(ctx, x, y, r, color, opts = {}) {
    if (!(r > 0)) return;
    const hi = mix(color, '#ffffff', 0.58);
    const lo = mix(color, '#000000', 0.78);
    const g = ctx.createRadialGradient(
        x - r * 0.33, y - r * 0.33, Math.max(0.05, r * 0.06),
        x, y, r * 1.18
    );
    g.addColorStop(0, hi);
    g.addColorStop(0.42, color);
    g.addColorStop(0.78, mix(color, '#000000', 0.42));
    g.addColorStop(1, lo);

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    if (opts.rim !== false) {
        const z = opts.zoom || 1;
        ctx.strokeStyle = 'rgba(255,255,255,' + (opts.rimAlpha ?? 0.15) + ')';
        ctx.lineWidth = 0.55 / z;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
    }
}

/**
 * Мягкая тень-эллипс на полу под телом.
 * @param {number} alphaOpacity 0..1
 */
function shadow(ctx, x, y, r, zoom, alphaOpacity = SHADOW.alpha) {
    if (!(r > 0)) return;
    const rx = Math.max(r * SHADOW.rx, 1.2 / zoom);
    const dy = r * SHADOW.dy + 1.5 / zoom;
    ctx.save();
    ctx.translate(x, y + dy);
    ctx.scale(1, SHADOW.ry);
    const g = ctx.createRadialGradient(0, 0, rx * 0.08, 0, 0, rx);
    g.addColorStop(0, 'rgba(0,0,0,' + alphaOpacity + ')');
    g.addColorStop(0.55, 'rgba(0,0,0,' + alphaOpacity * 0.55 + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

/** Радиальное свечение вокруг точки (ореол, блик базы). */
function glow(ctx, x, y, r, color, alphaValue = 0.5) {
    if (!(r > 0)) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, alpha(color, alphaValue));
    g.addColorStop(0.45, alpha(color, alphaValue * 0.35));
    g.addColorStop(1, alpha(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
}

/** Солнечная сфера: белое ядро -> жёлтый -> оранжевый край. Без пульсации. */
function sunSphere(ctx, x, y, r) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, '#fffef7');
    g.addColorStop(0.4, '#ffe7a3');
    g.addColorStop(0.74, '#ff9d3c');
    g.addColorStop(1, '#ff7a18');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
}

/** Ромб базы: квадрат, повёрнутый на 45°. size — сторона квадрата до поворота. */
function diamond(ctx, x, y, size, stroke, fill, zoom) {
    const s = Math.max(size, 1 / zoom);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = fill;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2 / zoom;
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.restore();
}

/** Детерминированный хеш строки для формы камня. */
function hashSeed(seed) {
    let h = 2166136261;
    const s = String(seed);
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/**
 * Неровный камень: многоугольник с детерминированной формой.
 * @param {string} seed id тела — форма не дрожит между кадрами
 */
function rock(ctx, x, y, r, seed, color = '#b9a88f', zoom = 1) {
    if (!(r > 0)) return;
    const rng = makeRng(hashSeed(seed));
    const n = 9;
    const pts = [];
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.16;
        const rr = r * (0.78 + rng() * 0.36);
        pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }

    const hi = mix(color, '#fff3dc', 0.55);
    const lo = mix(color, '#120c08', 0.75);
    const g = ctx.createRadialGradient(x - r * 0.32, y - r * 0.32, r * 0.08, x, y, r * 1.2);
    g.addColorStop(0, hi);
    g.addColorStop(0.5, color);
    g.addColorStop(1, lo);

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 0.5 / zoom;
    ctx.stroke();
}

// ===== scene.js =====
// =============================================================================
// scene.js — генерация фона сцены (звёзды) и правила показа тел при масштабе:
// тела слипаются по ЭКРАННОМУ расстоянию (clusterBodies, порог MERGE_PX) — одно
// правило вместо прежних семейств (луны планеты, семейства малых тел), а
// подписи кадра раскладываются без наложений (placeLabel). Малые тела (пояс
// астероидов, ОЗА, троянцы, кометы, дальние пояса) живут в отдельном модуле
// smallbodies.js. Позиции тел здесь не считаются — это делает render.js
// каждый кадр из simDays.
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

// --- Слипание тел на карте: по экранному расстоянию ---------------------------

/**
 * Порог слипания тел — в ЭКРАННЫХ пикселях, поэтому он сам меняется с
 * масштабом: при большом зуме тела разъезжаются и раскрываются, при малом
 * схлопываются. 50 px — примерно ширина подписи: тела ближе уже не подписать
 * каждое по отдельности.
 */
const MERGE_PX = 50;

/**
 * Сгруппировать тела кадра по экранному расстоянию — одно правило для лун,
 * планет и малых тел вместо прежних семейств. Тело встаёт в группу ближайшего
 * уже поставленного представителя, если их точки ближе MERGE_PX; иначе само
 * становится представителем. Кто представитель, решает порядок списка:
 * вызывающий подаёт тела по важности (планеты-якоря, затем луны и малые тела —
 * крупные раньше), поэтому представителем группы становится самое важное её
 * тело.
 *
 * Якоря (anchor: планеты и солнце) в чужую группу не входят никогда: иначе их
 * точки мерцали бы, входя и выходя из групп по мере обхода орбит.
 *
 * Группируются только тела одной системы (system: имя планеты у планеты и её
 * лун, null у малых тел). Иначе луна у Земли могла «прилипнуть» к пролетавшему
 * астероиду и потерять подпись/выбор, а малые тела — к чужой планете.
 *
 * @param {Array} bodies тела кадра с мировыми x, y: { anchor, system, x, y, ... }
 * @param {number} zoom
 * @returns {Array} группы { rep, members }: members включает представителя
 *                  (members[0] === rep), остальные тела группы скрыты — их
 *                  точки не рисуются, а имена уходят в подпись группы
 */
function clusterBodies(bodies, zoom) {
    const lim = MERGE_PX / zoom;
    const lim2 = lim * lim;
    const groups = [];

    bodies.forEach(b => {
        if (!b.anchor) {
            let host = null, best = Infinity;
            for (const g of groups) {
                if ((g.rep.system || null) !== (b.system || null)) continue;
                const dx = b.x - g.rep.x, dy = b.y - g.rep.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < best) { best = d2; host = g; }
            }
            if (host && best <= lim2) {
                host.members.push(b);
                return;
            }
        }
        groups.push({ rep: b, members: [b] });
    });

    return groups;
}

// --- Раскладка подписей: без наложений ----------------------------------------

// Коробки уже поставленных подписей кадра (мировые единицы). Подпись перед
// отрисовкой спрашивает место: если её коробка пересекается с чужой, подпись
// сдвигается по вертикали шагами в строку — так подписи не наезжают друг на
// друга. Порядок постановки = порядок отрисовки: сначала подписи групп тел,
// затем подписи баз (у базы подпись привязана к маркеру — ей сдвиг заметнее).
const labelBoxes = [];

/** Начать раскладку подписей кадра — render.js вызывает в начале кадра. */
function resetLabels() {
    labelBoxes.length = 0;
}

/**
 * Подобрать сдвиг подписи по вертикали, чтобы она не пересекалась с уже
 * поставленными: 0, вверх на строку, вниз на строку, вверх на две… Если места
 * нет — подпись остаётся на месте (лучше наложение, чем пропавшая подпись).
 * @param {number} x    левый край коробки
 * @param {number} yTop верх коробки
 * @param {number} w    ширина коробки
 * @param {number} h    высота коробки
 * @returns {number} сдвиг по y (мировые единицы) — прибавить к желаемой позиции
 */
function placeLabel(x, yTop, w, h) {
    const step = h + 2 / state.zoom;
    for (let k = 0; k < 16; k++) {
        const off = Math.ceil(k / 2) * step * (k % 2 ? -1 : 1);
        const box = { x, y: yTop + off, w, h };
        if (!labelBoxes.some(b => cross(b, box))) {
            labelBoxes.push(box);
            return off;
        }
    }
    labelBoxes.push({ x, y: yTop, w, h });
    return 0;
}

/** Пересекаются ли коробки подписей. */
function cross(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w &&
           a.y < b.y + b.h && b.y < a.y + a.h;
}

// ===== smallbodies.js =====
// =============================================================================
// smallbodies.js — малые тела Солнечной системы отдельным слоем мира:
// главный пояс (частицы + крупнейшие тела + щели Кирквуда), околоземные
// астероиды (Атон/Аполлон/Амур), троянцы Юпитера (L4/L5), кометы, пояс
// Койпера и облако Оорта.
//
// Карта — диметрия 2:1 (iso.js): все позиции здесь уже в view-координатах
// (y сжат вдвое). Орбитальные элементы — реальные; движение считается из
// общего simDays через Кеплер. Кометы дополнительно поднимаются над полом
// по наклонению inc/node — стилизованная 3D-орбита, как на референсах.
//
// Именованные тела (крупнейшие тела пояса, именованные ОЗА, троянцы L4/L5,
// кометы) слипаются по экранному расстоянию общим правилом scene.js
// clusterBodies: smallBodyList() отдаёт их позиции в кадр, а render.js
// рисует только показанных представителей через drawSmallBody. Пыль и
// частицы пояса остаются в слое пола (drawSmallBodiesFloor).
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
const BELT_MID = (BELT_MIN + BELT_MAX) / 2;

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

/** Дескриптор эллипса орбиты для карточек/совместимости: центр, полуоси, поворот. */
function orbitEllipse(aAu, e, periDeg) {
    const A = auToDist(aAu);
    const p = periDeg * Math.PI / 180;
    return {
        cx: -A * e * Math.cos(p),
        cy: A * e * Math.sin(p),
        a: A,
        b: A * Math.sqrt(1 - e * e),
        rot: -p
    };
}

/**
 * Точки орбиты для hover/выбора: маппинг а.е.→единицы нелинеен, поэтому
 * «эллипс по (a, e)» верен лишь в линейных зонах шкалы. Сэмплируем положения
 * по тем же элементам, что и движение, и сразу переводим в view.
 * @returns {number[]} плоский массив x0, y0, x1, y1, … (view, замкнутая петля)
 */
function orbitPoly(a, e, peri, T, inc = 0, node = 0) {
    const pts = [];
    for (let k = 0; k <= 128; k++) {
        const pos = keplerPos3(a, e, peri, 0, T, k * T / 128, auToDist, inc, node);
        const v = project3(pos.x, pos.y, pos.z);
        pts.push(v.x, v.y);
    }
    return pts;
}

/** Круговая орбита в view с наклонением inc/node (для троянцев). */
function circlePoly(r, inc = 0, node = 0) {
    const pts = [];
    for (let k = 0; k <= 128; k++) {
        const lon = k / 128 * Math.PI * 2;
        const pos = orbitPoint3(r, lon, inc, node);
        const v = project3(pos.x, pos.y, pos.z);
        pts.push(v.x, v.y);
    }
    return pts;
}

// --- Главный пояс: крупнейшие тела ---------------------------------------------
// Церера (карликовая планета), Веста, Паллада, Гигея — заметнее частиц пояса
// (ярче, крупнее, с обводкой) и выбираются кликом, как планеты.
const notables = beltNotables.map(b => {
    const T = periodFromA(b.a);
    return {
        id: 'notable-' + b.n,
        kind: 'asteroid',
        name: b.ru + ' / ' + b.n,
        ru: b.ru,
        note: b.type === 'dwarf' ? 'Карликовая планета' : 'Крупный астероид',
        a: b.a, e: b.e, peri: b.peri, m0: b.m0, dia: b.dia,
        inc: b.inc, node: b.node,
        T,
        r: b.type === 'dwarf' ? 3.2 : 2.6,
        x: 0, y: 0,
        orbit: orbitEllipse(b.a, b.e, b.peri),
        poly: orbitPoly(b.a, b.e, b.peri, T, b.inc, b.node)
    };
});

// --- Околоземные астероиды (ОЗА) ----------------------------------------------

/** Малое тело карты: общие поля для hover и карточек (элементы, орбита, тип). */
function smallBody(id, kind, name, src, r, extra) {
    const T = periodFromA(src.a);
    const inc = src.inc ?? 0;
    const node = src.node ?? 0;
    return Object.assign({
        id, kind, name,
        a: src.a, e: src.e, peri: src.peri, m0: src.m0, dia: src.dia,
        inc, node,
        T,
        q: src.a * (1 - src.e), Q: src.a * (1 + src.e),
        r, x: 0, y: 0,
        orbit: orbitEllipse(src.a, src.e, src.peri),
        poly: orbitPoly(src.a, src.e, src.peri, T, inc, node)
    }, extra || {});
}

const NEA_SEED = 20261018;
const neaRng = makeRng(NEA_SEED);

const neaBodies = neas.map(n =>
    smallBody('nea-' + n.n, 'nea', n.ru + ' / ' + n.n, n, 1.6, { group: n.group, ru: n.ru }));

for (let i = 0; i < 6; i++) {
    const group = ['amor', 'apollo', 'aten'][i % 3];
    let q, Q;
    if (group === 'amor') {
        q = 1.05 + neaRng() * 0.35;
        Q = 1.7 + neaRng() * 1.6;
    } else if (group === 'apollo') {
        q = 0.30 + neaRng() * 0.65;
        Q = (2.02 - q) + neaRng() * (3.7 - (2.02 - q));
    } else {
        const aAten = 0.85 + neaRng() * 0.14;
        q = 0.35 + neaRng() * (Math.min(0.85, 2 * aAten - 1.06) - 0.35);
        Q = 2 * aAten - q;
    }
    const a = (q + Q) / 2, e = (Q - q) / (Q + q);
    neaBodies.push(smallBody('nea-gen-' + i, 'nea', null,
        {
            a, e, peri: neaRng() * 360, m0: neaRng() * 360,
            inc: 0.5 + neaRng() * 24, node: neaRng() * 360
        }, 1.2, { group }));
}

// --- Троянцы Юпитера (L4/L5) ----------------------------------------------------
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
            dAng: (trojanRng() - 0.5) * 16,
            dR: (trojanRng() - 0.5) * 28,
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
    inc: JUPITER.inc, node: JUPITER.node,
    orbit: { cx: 0, cy: 0, r: JUPITER.dist },
    poly: circlePoly(JUPITER.dist, JUPITER.inc, JUPITER.node)
}));

// --- Пояс Койпера и облако Оорта ------------------------------------------------
const DUST_SEED = 20261018;
const dustRng = makeRng(DUST_SEED);

/** Собрать кольцо пыли: view-позиции, границы raw-радиусов и группы по цвету. */
function makeDustRing(list) {
    let rMin = Infinity, rMax = 0;
    const map = new Map();
    for (const p of list) {
        p.x = Math.cos(p.ang) * p.r;
        p.y = -Math.sin(p.ang) * p.r * ISO_K;
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
        r: auToDist(30 + dustRng() * 20),
        s: 0.8 + dustRng() * 1.0,
        col: 'rgba(150,150,150,' + al.toFixed(2) + ')'
    };
}));

const oortDust = makeDustRing(Array.from({ length: 350 }, () => {
    const al = 0.16 + dustRng() * 0.18;
    return {
        ang: dustRng() * Math.PI * 2,
        r: 1300 + dustRng() * 500,
        s: 0.8 + dustRng() * 1.0,
        col: 'rgba(150,150,150,' + al.toFixed(2) + ')'
    };
}));

/** Границы областей в view-единицах — для подсветки выбранного пояса/облака. */
const REGION_BOUNDS = {
    belt: { rMin: BELT_MIN, rMax: BELT_MAX },
    kuiper: { rMin: kuiperDust.rMin, rMax: kuiperDust.rMax },
    oort: { rMin: oortDust.rMin, rMax: oortDust.rMax }
};

/** Нарисовать кольцо пыли: точки вне кадра пропускаются. */
function drawDustRing(ctx, ring, zoom) {
    const half = Math.hypot(state.W, state.H) / 2 / zoom + 2;
    // rMin/rMax — в raw, камера — в view: сравниваем в raw-единицах
    const camD = Math.hypot(state.camX, state.camY / ISO_K);
    if (camD + half < ring.rMin || camD - half > ring.rMax) return;

    const h2 = half * half;
    for (const g of ring.groups) {
        ctx.fillStyle = g.col;
        for (const p of g.points) {
            if ((p.x - state.camX) ** 2 + (p.y - state.camY) ** 2 > h2) continue;
            ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
        }
    }
}

// --- Кометы ---------------------------------------------------------------------
// Ядро, кома и хвост, направленный от Солнца. Орбита действительно наклонена
// к эклиптике по реальным inc/node: положение считается в 3D и проецируется
// через project3, поэтому комета висит над полом на своей высоте z.

const RAD = Math.PI / 180;

/** Замкнутый путь кометы в view — с той же высотой, что и у тела. */
function cometOrbitPoly(b) {
    const pts = [];
    for (let k = 0; k <= 160; k++) {
        const pos = keplerPos3(b.a, b.e, b.peri, 0, b.T, k * b.T / 160,
            auToDist, b.inc, b.node);
        const v = project3(pos.x, pos.y, pos.z);
        pts.push(v.x, v.y);
    }
    return pts;
}

const cometBodies = comets.map(c => {
    const b = smallBody('comet-' + c.n, 'comet', c.ru + ' / ' + c.n, c, 1.4,
        { shower: c.shower, src: c.src, tailK: c.tailK, ru: c.ru, inc: c.inc, node: c.node });
    b.poly = cometOrbitPoly(b);
    return b;
});

/** Обновить позицию кометы из simDays: view-точка с высотой + точка на полу. */
function updateComet(b, t) {
    const pos = keplerPos3(b.a, b.e, b.peri, b.m0, b.T, t, auToDist, b.inc, b.node);
    const v = project3(pos.x, pos.y, pos.z);
    b.x = v.x;
    b.y = v.y;
    b.fx = pos.x;
    b.fy = pos.y * ISO_K;
    b.floorY = b.fy;
    b.z = pos.z;
    b.rAu = pos.rAu;
}

/**
 * Позиции всех именованных малых тел кадра — для общего правила слипания
 * (scene.js clusterBodies): крупнейшие тела пояса, именованные ОЗА, троянцы и
 * кометы. Безымянные (частицы пояса, досыпанные ОЗА, облака троянцев, пыль
 * дальних поясов) сюда не входят: их не выбирают и в подписи они не попадают.
 * @returns {Array} записи { id, kind, small, r, x, y, label } — view-координаты
 */
function smallBodyList() {
    const { simDays } = state;
    const jupAng = orbitAngle(JUPITER.l0, JUPITER.period, simDays);
    const list = [];

    function add(b, kind) {
        list.push({
            id: b.id, kind, small: b, r: b.r, x: b.x, y: b.y,
            z: b.z || 0, floorY: b.floorY ?? b.y, label: b.ru || b.name
        });
    }

    notables.forEach(b => {
        const pos = keplerPos3(b.a, b.e, b.peri, b.m0, b.T, simDays,
            auToDist, b.inc, b.node);
        const v = project3(pos.x, pos.y, pos.z);
        b.x = v.x;
        b.y = v.y;
        b.z = pos.z;
        b.floorY = pos.y * ISO_K;
        add(b, 'asteroid');
    });

    neaBodies.forEach(b => {
        const pos = keplerPos3(b.a, b.e, b.peri, b.m0, b.T, simDays,
            auToDist, b.inc, b.node);
        const v = project3(pos.x, pos.y, pos.z);
        b.x = v.x;
        b.y = v.y;
        b.z = pos.z;
        b.floorY = pos.y * ISO_K;
        b.rAu = pos.rAu;
        if (b.name) add(b, 'nea');
    });

    trojanBodies.forEach(b => {
        const ang = jupAng + b.camp * Math.PI / 3
            + (b.dAng + trojanLib(simDays, b.camp)) * RAD;
        const rr = JUPITER.dist + b.dR;
        const pos = orbitPoint3(rr, ang, JUPITER.inc, JUPITER.node);
        const v = project3(pos.x, pos.y, pos.z);
        b.x = v.x;
        b.y = v.y;
        b.z = pos.z;
        b.floorY = pos.y * ISO_K;
        add(b, 'trojan');
    });

    cometBodies.forEach(b => {
        updateComet(b, simDays);
        add(b, 'comet');
    });

    return list;
}

/**
 * Слой пола: пыль Койпера/Оорта, полоса и частицы главного пояса, облака
 * троянцев. Hover-целей не даёт: именованные тела рисует drawSmallBody в
 * общем слое тел. Пути комет не рисуются.
 */
function drawSmallBodiesFloor(ctx) {
    const { simDays, zoom } = state;

    // Дальняя пыль фоном: пояс Койпера и облако Оорта.
    drawDustRing(ctx, kuiperDust, zoom);
    drawDustRing(ctx, oortDust, zoom);

    // Полоса пояса — «гравий» на полу, эллипс 2:1.
    ctx.save();
    ctx.strokeStyle = 'rgba(58,66,82,0.10)';
    ctx.lineWidth = 10 / zoom;
    ctx.beginPath();
    orbitEllipsePath(ctx, 0, 0, BELT_MID);
    ctx.stroke();
    ctx.restore();

    // Частицы пояса.
    ctx.fillStyle = '#6e6e6e';
    asteroids.forEach(a => {
        const ang = orbitAngle(a.l0, a.period, simDays);
        const x = Math.cos(ang) * a.d;
        const y = -Math.sin(ang) * a.d * ISO_K;
        ctx.beginPath();
        ctx.arc(x, y, a.s, 0, Math.PI * 2);
        ctx.fill();
    });

    // Безымянные досыпанные ОЗА — тусклые точки всегда.
    ctx.fillStyle = '#8a8a8a';
    neaBodies.forEach(b => {
        if (b.name) return;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
    });

    // Троянцы: два облака точек, синхронных с Юпитером (плюс либрация).
    const jupAng = orbitAngle(JUPITER.l0, JUPITER.period, simDays);
    ctx.fillStyle = '#808080';
    trojanClouds.forEach(c => {
        const base = jupAng + c.camp * Math.PI / 3 + trojanLib(simDays, c.camp) * RAD;
        c.points.forEach(p => {
            const ang = base + p.dAng * RAD;
            const rr = JUPITER.dist + p.dR;
            ctx.beginPath();
            ctx.arc(Math.cos(ang) * rr, -Math.sin(ang) * rr * ISO_K, p.s, 0, Math.PI * 2);
            ctx.fill();
        });
    });
}

/**
 * Нарисовать одно показанное именованное малое тело в общем слое тел.
 * @returns {?Object} hover-цель { kind, name, x, y, r, moons, small }
 */
function drawSmallBody(ctx, b) {
    const zoom = state.zoom;

    if (b.kind === 'comet') return drawComet(ctx, b);

    // Камни пояса/ОЗА/троянцев: неровная форма, детерминированная id.
    if (b.r >= 1.4) {
        rock(ctx, b.x, b.y, b.r, b.id, '#b9a88f', zoom);
    } else {
        ctx.fillStyle = '#d8d8d8';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
    }

    return {
        kind: b.kind, name: b.name, x: b.x, y: b.y, r: b.r,
        moons: [], small: b
    };
}

/** Комета: ножка, тень, два хвоста от Солнца, кома и ядро. */
function drawComet(ctx, b) {
    const zoom = state.zoom;
    const pf = clamp(b.q / Math.max(b.rAu, 0.001), 0, 1);
    // Хвост растёт с зумом, но не остаётся гигантским при общем плане:
    // world-длина ~ 1/√zoom, экранная ~ √zoom.
    const len = (85 + 95 * pf) * b.tailK / Math.sqrt(zoom);

    // Направление от Солнца с учётом высоты: хвост уходит вверх-в сторону.
    const dx = b.x, dy = b.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    const px = -uy, py = ux;

    const tipX = b.x + ux * len;
    const tipY = b.y + uy * len;

    // Ножка к полу и тень.
    ctx.strokeStyle = 'rgba(127,216,255,0.30)';
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.fx, b.fy);
    ctx.stroke();

    ctx.fillStyle = 'rgba(127,216,255,0.18)';
    ctx.beginPath();
    ctx.ellipse(b.fx, b.fy, 7 / zoom, 2.6 / zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    // Пылевой хвост — шире и чуть изогнут.
    const wd = 4.6 / Math.sqrt(zoom);
    const midX = b.x + ux * len * 0.55 + px * 7 / zoom;
    const midY = b.y + uy * len * 0.55 + py * 7 / zoom;
    let g = ctx.createLinearGradient(b.x, b.y, tipX, tipY);
    g.addColorStop(0, 'rgba(255,231,163,0.60)');
    g.addColorStop(0.6, 'rgba(255,231,163,0.20)');
    g.addColorStop(1, 'rgba(255,231,163,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(b.x + px * wd, b.y + py * wd);
    ctx.quadraticCurveTo(midX + px * wd * 1.7, midY + py * wd * 1.7, tipX, tipY);
    ctx.quadraticCurveTo(midX - px * wd * 0.9, midY - py * wd * 0.9, b.x - px * wd, b.y - py * wd);
    ctx.closePath();
    ctx.fill();

    // Ионный хвост — узкий, почти прямой, голубой.
    const wi = 2.1 / Math.sqrt(zoom);
    const ionTipX = b.x + ux * len * 1.12;
    const ionTipY = b.y + uy * len * 1.12;
    g = ctx.createLinearGradient(b.x, b.y, ionTipX, ionTipY);
    g.addColorStop(0, 'rgba(191,246,255,0.85)');
    g.addColorStop(0.55, 'rgba(191,246,255,0.24)');
    g.addColorStop(1, 'rgba(191,246,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(b.x + px * wi, b.y + py * wi);
    ctx.lineTo(ionTipX, ionTipY);
    ctx.lineTo(b.x - px * wi, b.y - py * wi);
    ctx.closePath();
    ctx.fill();

    // Кома — радиальное свечение вокруг ядра.
    const comaR = 12 / Math.sqrt(zoom);
    const coma = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, comaR);
    coma.addColorStop(0, 'rgba(255,255,255,0.95)');
    coma.addColorStop(0.35, 'rgba(223,248,255,0.42)');
    coma.addColorStop(0.7, 'rgba(127,216,255,0.14)');
    coma.addColorStop(1, 'rgba(127,216,255,0)');
    ctx.fillStyle = coma;
    ctx.beginPath();
    ctx.arc(b.x, b.y, comaR, 0, Math.PI * 2);
    ctx.fill();

    // Ядро — белая сфера (минимальный экранный размер, чтобы не пропадало).
    sphere(ctx, b.x, b.y, Math.max(b.r, 2.4 / zoom), '#ffffff', { zoom, rim: false });

    return {
        kind: 'comet', name: b.name, x: b.x, y: b.y,
        r: Math.max(b.r, 3 / zoom), moons: [], small: b
    };
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

        // Точка на полу — по эллипсу 2:1; маркер приподнят над ней, как на
        // референсах (ромб с ножкой и тенью).
        const ex = hp.x + Math.cos(ang) * orbitR;
        const ey = hp.y - Math.sin(ang) * orbitR * ISO_K;
        b.fx = ex;
        b.fy = ey;
        b.x = ex;
        b.y = ey - LIFT.base / zoom;

        // Имя спутника-хозяина для подписи: у переноса — хост режима, иначе
        // запись базы (у базы на планете строки нет).
        const hostMoon = (moving ? mode.kind : b.hostKind) === 'moon'
            ? (moving ? mode.moon : b.moon) || null : null;
        drawBaseMarker(ctx, hp, b, zoom, time, orbitR, quietIds && quietIds.has(b.id), hostMoon);
        targets.push({
            kind: 'base', name: b.name, x: b.x, y: b.y, r: 6 / zoom,
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
    // Орбита базы — эллипс 2:1 вокруг хост-тела (view).
    ctx.strokeStyle = 'rgba(53,232,216,0.27)';
    ctx.lineWidth = 0.5 / zoom;
    ctx.setLineDash([1 / zoom, 1 / zoom]);
    ctx.beginPath();
    orbitEllipsePath(ctx, hp.x, hp.y, orbitR);
    ctx.stroke();
    ctx.setLineDash([]);

    const bs = 4 / zoom;          // половина ромба / радиус пульса
    const ds = 8 / zoom;          // сторона квадрата до поворота на 45°

    // Ножка от маркера к полу и мягкая тень в точке орбиты.
    ctx.strokeStyle = 'rgba(53,232,216,0.34)';
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + ds * 0.55);
    ctx.lineTo(b.fx, b.fy);
    ctx.stroke();

    ctx.fillStyle = 'rgba(53,232,216,0.18)';
    ctx.beginPath();
    ctx.ellipse(b.fx, b.fy, 6 / zoom, 2.2 / zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    glow(ctx, b.x, b.y, bs * 2.6, COLORS.base, 0.55);

    // Ромб с тёмной заливкой и бирюзовой обводкой — как на референсах.
    diamond(ctx, b.x, b.y, ds, COLORS.base, '#05060c', zoom);

    ctx.fillStyle = COLORS.base;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 1.2 / zoom, 0, Math.PI * 2);
    ctx.fill();

    const pulse = (Math.sin(time * 4) + 1) * 0.5;
    ctx.strokeStyle = `rgba(53,232,216,${0.5 - pulse * 0.5})`;
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    ctx.arc(b.x, b.y, bs + pulse * 4 / zoom, 0, Math.PI * 2);
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

    // Место подписи подбирает раскладка кадра (scene.js placeLabel): если подпись
    // налезает на соседнюю — подпись группы или другой базы, — она сдвигается по
    // вертикали вместе со строкой спутника и полоской разбора.
    ctx.font = `600 ${fontPx}px "Manrope", sans-serif`;
    let shift = 0;
    if (!quiet) {
        let mt = 0;
        if (moonLine) {
            ctx.font = `${fontPx}px monospace`;
            mt = Math.min(ctx.measureText(moonLine).width, pw);
            ctx.font = `600 ${fontPx}px "Manrope", sans-serif`;
        }
        const w = Math.min(pw, Math.max(ctx.measureText(b.name).width, mt)) + 2 / zoom;
        const room = moonLine ? 12 / zoom : 0;   // строка спутника — в той же коробке
        shift = placeLabel(lx, ly - fontPx * 1.3 - room, w, fontPx * 1.6 + room);
    }
    const ny = ly + shift;                     // базовая линия имени базы
    const mly = ny - 12 / zoom;                // строка спутника — выше имени

    if (moonLine) {
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
        // База группы тел: имя не подписываем — оно стоит второй строкой
        // подписи группы (render.js drawGroupLabel).
        labelScrollFrom.delete(b.id);
    } else {
        const tw = ctx.measureText(b.name).width;
        const overflow = tw > pw;
        const scrolling = overflow && labelHovered(b, lx, ny, pw, bs, moonLine ? 12 / zoom : 0);
        const nowMs = performance.now();
        if (scrolling) {
            if (!labelScrollFrom.has(b.id)) labelScrollFrom.set(b.id, nowMs);
        } else {
            labelScrollFrom.delete(b.id);
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(lx, ny - fontPx * 1.25, pw, fontPx * 1.6);
        ctx.clip();
        if (scrolling) {
            // бегущая строка: имя уходит влево, следом въезжает его же копия
            const gap = 40 / zoom, cycle = tw + gap;
            const off = ((nowMs - labelScrollFrom.get(b.id)) / 1000) * 28 / zoom % cycle;
            ctx.fillText(b.name, lx - off, ny);
            ctx.fillText(b.name, lx - off + cycle, ny);
        } else {
            ctx.fillText(overflow ? cutForPanel(ctx, b.name, pw) : b.name, lx, ny);
        }
        ctx.restore();
    }

    if (removing) {
        // полоска разбора — во всю панель, заполняется справа налево
        const bh = 3 / zoom, by = ny + 4 / zoom;
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

    ctx.strokeStyle = 'rgba(53,232,216,0.55)';
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.beginPath();
    orbitEllipsePath(ctx, hp.x, hp.y, r);
    ctx.stroke();
    ctx.setLineDash([]);

    const w = screenToWorld(state.mouseX, state.mouseY, state);
    // луч — направление будущего положения базы: угол в raw-плоскости от
    // центра хоста к курсору (mode.ang; до первого движения — по позиции мыши).
    const ang = typeof mode.ang === 'number'
        ? mode.ang : rawAngle(w.x - hp.x, w.y - hp.y);
    const ux = Math.cos(ang);
    const uy = -Math.sin(ang);

    ctx.strokeStyle = 'rgba(53,232,216,0.25)';
    ctx.lineWidth = 0.5 / zoom;
    ctx.beginPath();
    ctx.moveTo(hp.x, hp.y);
    ctx.lineTo(hp.x + ux * r, hp.y + uy * r * ISO_K);
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
// render.js — отрисовка сцены на канвас: фон, пол, малые тела, солнце,
// планеты, луны и звёздные базы.
//
// Карта — диметрия 2:1 (iso.js): мир-эклиптика сжимается по y, поэтому орбиты
// становятся эллипсами, а сферы остаются круглыми. Слои кадра:
//   небо -> световое пятно/ореол звезды -> постоянные орбиты -> пыль/пояс/
//   пути комет -> тени на полу -> тела по глубине (view.y) -> базы -> подписи.
//
// Тела слипаются по ЭКРАННОМУ расстоянию (scene.js clusterBodies): что ближе
// порога — в одну группу с общей подписью; планеты и солнце — якоря.
// Подписи раскладываются без наложений (scene.js placeLabel).
//
// Возвращает массив hoverTargets — позиции всех тел для hit-теста наведения.
// =============================================================================












/**
 * Луна Земли — такая же запись тела, как луны планет: своя дистанция
 * (moonDist), радиус (3) и период. В moonsByPlanet её нет.
 */
const EARTH_MOON = { n: 'Луна / Moon', r: 3, period: moonPeriod, c: '#c9cfd8' };

/**
 * Орбиты планет — реальные элементы (эксцентриситет и перигелий из data.js).
 * Считаются один раз: форма орбиты от времени не зависит. Хранятся сразу в
 * view-координатах — по ним рисуется орбита при наведении на планету.
 */
const PLANET_ORBITS = new Map();
planets.forEach(p => {
    const raw = keplerPoly3(p.dist, p.e, p.peri, 0, p.period, 160, v => v, p.inc, p.node);
    PLANET_ORBITS.set(p, view3Poly(raw));
});

/** Позиция планеты на орбите: Кеплер с эксцентриситетом и наклоном. */
function planetRawPos(p, t) {
    return keplerPos3(p.dist, p.e, p.peri, planetM0(p), p.period, t, v => v, p.inc, p.node);
}

/**
 * Замкнутая орбита луны вокруг планеты: круг в наклонённой плоскости
 * (inc/node), спроецированный в view. Точки уже абсолютные (центр — планета).
 */
function moonOrbitPoly(planetRaw, radius, inc, node, steps = 96) {
    const pts = [];
    for (let k = 0; k <= steps; k++) {
        const ang = k / steps * Math.PI * 2;
        const off = orbitPoint3(radius, ang, inc, node);
        const v = project3(planetRaw.x + off.x, planetRaw.y + off.y, planetRaw.z + off.z);
        pts.push(v.x, v.y);
    }
    return pts;
}

/**
 * Нарисовать один кадр мира в мировой системе координат (save/restore внутри).
 * @param {CanvasRenderingContext2D} ctx
 * @returns {Array} hoverTargets для hover.js
 */
function renderScene(ctx) {
    const { zoom, simDays, time } = state;
    const hoverTargets = [];

    // Дальний фон — отдельный слой sky.js, в экранных координатах.
    drawSky(ctx);

    // Раскладка подписей кадра — заново.
    resetLabels();

    // Мировая система координат: центр экрана -> камера -> зум.
    ctx.save();
    ctx.translate(state.W / 2, state.H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-state.camX, -state.camY);

    drawStars(ctx, time);

    // === ТЕЛА КАДРА: позиции в view, затем слипание по экранному расстоянию ===
    // Планеты храним в raw (для лун и наклонных орбит) и в view (для отрисовки).
    const planetRaw = new Map();
    const planetPos = new Map();
    planets.forEach(p => {
        const raw = planetRawPos(p, simDays);
        const v = project3(raw.x, raw.y, raw.z);
        planetRaw.set(p, raw);
        planetPos.set(p, { x: v.x, y: v.y, z: raw.z, floorY: raw.y * ISO_K });
    });

    const bodies = [];

    // Планеты — якоря: видны всегда и в чужую группу не входят.
    planets.forEach(p => {
        const { x, y, z, floorY } = planetPos.get(p);
        bodies.push({
            anchor: true, system: p.name, kind: 'planet', p, x, y, z, floorY, r: p.r,
            label: p.ru || p.name,
            bases: basesAt('planet', p.name, null)
        });
    });

    // Луны планет и Луна Земли — круговые орбиты вокруг планеты, наклонённые
    // по реальным inc/node (плоскость экватора планеты). Периоды реальные,
    // расстояния сжаты той же шкалой, что и вся карта.
    planets.forEach(p => {
        const o = planetRaw.get(p);
        (moonsByPlanet[p.name] || []).forEach((m, i) => {
            const md = moonOrbitRadius(p, i);
            const mAng = orbitAngle(m.phase, m.period, simDays);
            const off = orbitPoint3(md, mAng, m.inc, m.node);
            const wx = o.x + off.x, wy = o.y + off.y, wz = o.z + off.z;
            const v = project3(wx, wy, wz);
            // Луны — якоря: реальные спутники не должны пропадать в группе
            // с планетой или астероидом, иначе их нельзя навести/выбрать.
            bodies.push({
                anchor: true, system: p.name, kind: 'moon', p, m, md,
                x: v.x, y: v.y, z: wz, floorY: wy * ISO_K,
                orbitPoly: moonOrbitPoly(o, md, m.inc, m.node),
                label: m.n,
                bases: basesAt('moon', p.name, m.n)
            });
        });

        if (p.name === 'Earth') {
            const mAng = orbitAngle(moonL0, moonPeriod, simDays);
            const off = orbitPoint3(moonDist, mAng, moonInc, moonNode);
            const wx = o.x + off.x, wy = o.y + off.y, wz = o.z + off.z;
            const v = project3(wx, wy, wz);
            bodies.push({
                anchor: true, system: p.name, kind: 'moon', p, m: EARTH_MOON, md: moonDist,
                x: v.x, y: v.y, z: wz, floorY: wy * ISO_K,
                orbitPoly: moonOrbitPoly(o, moonDist, moonInc, moonNode),
                label: EARTH_MOON.n,
                bases: basesAt('moon', p.name, EARTH_MOON.n)
            });
        }
    });

    // Малые тела: позиции уже в view (smallbodies.js).
    const small = smallBodyList();
    small.forEach(s => {
        bodies.push({
            // Кометы — якоря: пользователь просил показать все кометы, а не
            // только представителей групп. Остальные малые тела слипаются.
            anchor: s.kind === 'comet',
            system: null,
            kind: 'small', id: s.id, small: s.small, r: s.r,
            x: s.x, y: s.y, z: s.z || 0, floorY: s.floorY ?? s.y,
            label: s.label, bases: []
        });
    });

    // Порядок важности: якоря первыми, дальше крупные раньше мелких.
    const ordered = bodies.slice().sort((a, b) => (b.anchor - a.anchor) || (b.r - a.r));
    const groups = clusterBodies(ordered, zoom);

    // === ЧТО ПОКАЗАНО КАДРА ===
    const hostPos = {};             // view-позиции хост-тел для баз
    const quietIds = new Set();     // базы групп: маркеры без имён
    const shownSmall = new Set();   // id показанных малых тел
    const moonHits = new Map();     // планета -> [{ m, md, mx, my, orbitPoly }]

    bodies.forEach(b => {
        if (b.kind === 'planet') hostPos['planet:' + b.p.name] = { x: b.x, y: b.y };
        if (b.kind === 'moon') hostPos['moon:' + b.p.name + ':' + b.m.n] = { x: b.x, y: b.y };
    });

    groups.forEach(g => {
        const rep = g.rep;
        if (rep.kind === 'moon') {
            if (!moonHits.has(rep.p)) moonHits.set(rep.p, []);
            moonHits.get(rep.p).push({
                m: rep.m, md: rep.md, mx: rep.x, my: rep.y, orbitPoly: rep.orbitPoly
            });
        }
        if (rep.kind === 'small') shownSmall.add(rep.id);

        if (g.members.length < 2) return;

        g.members.forEach(m => {
            if (m.kind === 'moon' && m !== rep)
                hostPos['moon:' + m.p.name + ':' + m.m.n] = { x: rep.x, y: rep.y };
            m.bases.forEach(b => quietIds.add(b.id));
        });
    });

    // === ПОЛ ===
    // Световое пятно и ореол звезды — до тел; пыль и пояса — на полу.
    // Орбиты планет здесь не рисуются: они появляются только при наведении.
    drawStarFloor(ctx);
    drawSmallBodiesFloor(ctx);
    drawStarHalo(ctx);

    // Тени на полу — отдельным проходом, до всех сфер.
    drawFloorShadows(ctx, groups, planetPos, zoom);

    // === ТЕЛА ПО ГЛУБИНЕ ===
    // Дальние (меньший view.y) — раньше; звезда участвует в сортировке.
    const drawList = [];
    planets.forEach(p => {
        const { x, y } = planetPos.get(p);
        drawList.push({ kind: 'planet', x, y, r: p.r, p });
    });
    groups.forEach(g => {
        const rep = g.rep;
        if (rep.kind === 'moon' || rep.kind === 'small') {
            drawList.push({ kind: rep.kind, x: rep.x, y: rep.y, r: rep.r, rep });
        }
    });
    drawList.push({ kind: 'sun', x: 0, y: 0, r: SUN_R });

    drawList.sort((a, b) => (a.y - b.y) || (b.r - a.r));

    const smallTargets = new Map();
    drawList.forEach(item => {
        if (item.kind === 'planet') {
            drawPlanet(ctx, item.x, item.y, item.p, zoom);
        } else if (item.kind === 'moon') {
            drawMoonBody(ctx, item.x, item.y, item.rep.m.r, item.rep.m.c, zoom);
        } else if (item.kind === 'small') {
            const t = drawSmallBody(ctx, item.rep.small);
            if (t) smallTargets.set(item.rep.small.id, t);
        } else if (item.kind === 'sun') {
            drawSunCore(ctx);
        }
    });

    // Проекции — поверх сфер: у крупных планет радиус больше высоты над полом,
    // иначе линия целиком пряталась бы за телом (видна была бы только у Меркурия).
    drawProjectionLines(ctx, groups, planetPos, zoom);

    // Подписи групп: имена тел через запятую, затем базы на них. Подписаны все
    // показанные тела — планеты, одиночные луны и малые тела: имя видно всегда,
    // а не только при наведении (подсказка при наведении остаётся).
    groups.forEach(g => {
        const baseNames = [];
        g.members.forEach(m => m.bases.forEach(b => baseNames.push(b.name)));
        drawGroupLabel(ctx, g.rep.x, g.rep.y, {
            label: g.members.map(m => m.label).join(', '),
            baseLabel: baseNames.length ? baseNames.join(', ') : null
        }, zoom);
    });

    // Солнце — тоже подпись всегда.
    drawSunLabel(ctx, zoom);

    // Звёздные базы (bases.js): маркеры, орбиты и превью выбора орбиты.
    const baseTargets = drawBases(ctx, hostPos, quietIds);
    baseTargets.forEach(t => { t.p = planets.find(x => x.name === t.local.planet); });

    ctx.restore();

    // === HOVER-ЦЕЛИ ===
    // Порядок прежний и не зависит от порядка отрисовки: малые тела -> солнце
    // -> планеты (с лунами) -> базы. findBodyAt идёт с конца.
    small.forEach(s => {
        if (!shownSmall.has(s.id)) return;
        const t = smallTargets.get(s.id);
        if (t) hoverTargets.push(t);
    });
    hoverTargets.push({ kind: 'sun', name: 'Солнце / Sun', x: 0, y: 0, r: SUN_R, moons: [] });
    planets.forEach(p => {
        const { x, y } = planetPos.get(p);
        hoverTargets.push({
            kind: 'planet', p, x, y, moons: moonHits.get(p) || [],
            orbit: PLANET_ORBITS.get(p)
        });
    });
    baseTargets.forEach(t => hoverTargets.push(t));

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

/** Световое пятно на полу под звездой (эллипс 2:1). */
function drawStarFloor(ctx) {
    ctx.save();
    ctx.scale(1, ISO_K);
    const r = SUN_R * 7.5;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, 'rgba(255,206,122,0.22)');
    g.addColorStop(0.55, 'rgba(255,157,60,0.06)');
    g.addColorStop(1, 'rgba(255,157,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

/** Большой ореол звезды — над полом, под телами. */
function drawStarHalo(ctx) {
    glow(ctx, 0, 0, SUN_R * 5.2, '#ff9d3c', 0.34);
    glow(ctx, 0, 0, SUN_R * 2.6, '#ffd27a', 0.28);
}

/** Тени на полу: планеты; показанные луны; показанные малые тела.
 *  Наклонные орбиты поднимают тело над эклиптикой — тень остаётся на полу
 *  (floorY), поэтому видно высоту. */
function drawFloorShadows(ctx, groups, planetPos, zoom) {
    planets.forEach(p => {
        const { x, floorY } = planetPos.get(p);
        shadow(ctx, x, floorY, p.r, zoom);
    });
    groups.forEach(g => {
        const rep = g.rep;
        const fy = rep.floorY ?? rep.y;
        if (rep.kind === 'moon' && rep.m.r >= 1.5) shadow(ctx, rep.x, fy, rep.m.r, zoom);
        if (rep.kind === 'small' && rep.r >= 1.5) shadow(ctx, rep.x, fy, rep.r, zoom);
    });
}

/**
 * Вертикальные линии от тел до их проекции на плоскость эклиптики. Это тот
 * же приём, что у кометы (drawComet рисует свою ножку сам), но для планет,
 * лун и остальных показанных малых тел. Рисуется поверх сфер: иначе у планет
 * с радиусом больше высоты над полом линия полностью скрыта телом. Фон —
 * пыль и безымянные частицы — линий не получает: это не выбираемые тела.
 */
function drawProjectionLines(ctx, groups, planetPos, zoom) {
    const minH = 1 / zoom;
    ctx.save();
    ctx.strokeStyle = 'rgba(127,216,255,0.45)';
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();

    planets.forEach(p => {
        const pos = planetPos.get(p);
        projectionLine(ctx, pos.x, pos.y, pos.floorY, minH);
    });

    groups.forEach(g => {
        const rep = g.rep;
        if (rep.kind !== 'moon' && rep.kind !== 'small') return;
        // У кометы уже есть собственная ножка и тень — не дублируем.
        if (rep.kind === 'small' && rep.small && rep.small.kind === 'comet') return;
        const fy = rep.floorY ?? rep.y;
        projectionLine(ctx, rep.x, rep.y, fy, minH);
    });

    ctx.stroke();
    ctx.restore();
}

/** Одна вертикальная линия; слишком короткую (меньше пикселя) не рисуем. */
function projectionLine(ctx, x, y, floorY, minH) {
    if (Math.abs(y - floorY) < minH) return;
    ctx.moveTo(x, y);
    ctx.lineTo(x, floorY);
}

// --- Тела ----------------------------------------------------------------------

/** Ядро солнца — сфера; ореол и пятно света нарисованы в слое пола. */
function drawSunCore(ctx) {
    sunSphere(ctx, 0, 0, SUN_R);
}

/** Подпись Солнца — постоянная, как у остальных тел. */
function drawSunLabel(ctx, zoom) {
    drawGroupLabel(ctx, SUN_R * 0.6, 0, { label: 'Солнце / Sun', baseLabel: null }, zoom);
}

/** Планета: сфера + кольца Сатурна (задняя половина до сферы, передняя после). */
function drawPlanet(ctx, x, y, p, zoom) {
    if (p.rings) drawRingHalf(ctx, x, y, p, true, zoom);
    sphere(ctx, x, y, p.r, p.color, { zoom });
    if (p.rings) drawRingHalf(ctx, x, y, p, false, zoom);
}

/** Половина кольца Сатурна: back — дальняя (верхняя), иначе передняя. */
function drawRingHalf(ctx, x, y, p, back, zoom) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.4);
    ctx.scale(1, 0.3);

    const a0 = back ? Math.PI : 0;
    const a1 = back ? Math.PI * 2 : Math.PI;

    ctx.strokeStyle = 'rgba(200,200,200,0.30)';
    ctx.lineWidth = 4 / zoom;
    ctx.beginPath();
    ctx.arc(0, 0, p.r * 2.2, a0, a1);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(220,220,220,0.46)';
    ctx.lineWidth = 3 / zoom;
    ctx.beginPath();
    ctx.arc(0, 0, p.r * 1.7, a0, a1);
    ctx.stroke();

    ctx.restore();
}

/** Луна: маленькая сфера; тень нарисована в слое пола. */
function drawMoonBody(ctx, x, y, r, color, zoom) {
    sphere(ctx, x, y, r, color || COLORS.moon, { zoom, rimAlpha: 0.12 });
}

/**
 * Подпись группы тел у её представителя (scene.js clusterBodies) — общая для
 * всех тел: две строки, имена тел группы и базы на них.
 */
function drawGroupLabel(ctx, mx, my, group, zoom) {
    const lines = [{ text: group.label, color: COLORS.tooltip }];
    if (group.baseLabel) lines.push({ text: group.baseLabel, color: COLORS.base });

    ctx.font = `${10 / zoom}px monospace`;
    const lx = mx + 6 / zoom;
    const lh = 12 / zoom;
    const top = my - 14 / zoom;
    const w = Math.max(...lines.map(l => ctx.measureText(l.text).width));
    const h = (lines.length - 1) * lh + 14 / zoom;
    const off = placeLabel(lx, top, w, h);

    lines.forEach((l, i) => {
        groupLine(ctx, l.text, lx, top + off + 10 / zoom + i * lh, l.color, zoom);
    });
}

/** Строка подписи группы: тень со сдвигом в 1 px, затем текст в цвете. */
function groupLine(ctx, text, x, y, color, zoom) {
    ctx.fillStyle = COLORS.tooltipShadow;
    ctx.fillText(text, x + 1 / zoom, y + 1 / zoom);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
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
 * Найти тело под курсором и нарисовать его орбиту (если есть) + подсказку.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} hoverTargets — результат renderScene() этого кадра
 */
function drawHover(ctx, hoverTargets) {
    const { mouseX, mouseY } = state;
    if (mouseX < 0) return;

    const hover = findBodyAt(hoverTargets, mouseX, mouseY);
    if (!hover) return;

    // орбита наведённой планеты/луны/базы; у солнца и комет орбиты нет
    const isComet = hover.kind === 'comet' || (hover.small && hover.small.kind === 'comet');
    if (hover.orbit && !isComet) {
        drawOrbitOverlay(ctx, hover, COLORS.orbitPlanet);
    }
    drawTooltip(ctx, hover.name, mouseX, mouseY);
}

/**
 * Нарисовать орбиту выбранного кликом тела: пунктир держится для лун, баз и
 * областей. У планет орбита видна только при наведении, у комет не рисуется.
 * @param {CanvasRenderingContext2D} ctx
 * @param {?{kind: string, p: object, m: object}} sel — текущий выбор (state.selected)
 * @param {Array} hoverTargets — результат renderScene() этого кадра
 */
function drawSelection(ctx, sel, hoverTargets) {
    if (!sel) return;

    // Планета: орбита только в hover. Комета: орбита не показывается вовсе.
    if (sel.kind === 'planet' || sel.kind === 'comet' ||
        (sel.small && sel.small.kind === 'comet')) return;

    // У области нет тела и орбиты — показываем её границы пунктиром, иначе
    // разреженная пыль Койпера/Оорта почти не читается на общем плане.
    if (sel.kind === 'region') {
        const bounds = REGION_BOUNDS[sel.region.key];
        if (!bounds) return;
        [bounds.rMin, bounds.rMax].forEach(r => {
            drawOrbitOverlay(ctx, { kind: 'region', orbit: { cx: 0, cy: 0, r } },
                'rgba(127,216,255,0.32)');
        });
        return;
    }

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
    } else if (sel.kind === 'base') {
        // база летает вокруг Луны Земли — орбита от Луны, не от солнца
        orbit = { cx: target.orbitCx, cy: target.orbitCy, r: target.orbitR };
    } else {
        // луна ищется по имени: объекты лун в кадре и в дереве — разные ссылки
        const mh = target.moons.find(x => x.m.n === sel.m.n);
        if (!mh) return;
        orbit = mh.orbitPoly
            ? { poly: mh.orbitPoly }
            : { cx: target.x, cy: target.y, r: mh.md };
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
                // луна: наклонная орбита вокруг своей планеты
                return {
                    kind: 'moon', name: mh.m.n,
                    orbit: mh.orbitPoly ? { poly: mh.orbitPoly } : { cx: t.x, cy: t.y, r: mh.md },
                    p: t.p, m: mh.m
                };
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
            else if (t.kind !== 'sun') orbit = t.orbit ? { poly: t.orbit } : { cx: 0, cy: 0, r: t.p.dist };
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
        // сэмплированная петля (малые тела, кометы, планеты): эллипс по (a,e)
        // неверен после нелинейного сжатия шкалы и наклонной орбиты кометы
        const p = hover.orbit.poly;
        ctx.moveTo(p[0], p[1]);
        for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
        ctx.closePath();
    } else if (hover.orbit.rot !== undefined) {
        // запасной путь для старого эллипса: сэмплируем в raw и проецируем,
        // иначе наклонный эллипс после сжатия по y не совпадёт с орбитой
        const o = hover.orbit;
        const cr = Math.cos(o.rot), sr = Math.sin(o.rot);
        for (let i = 0; i <= 96; i++) {
            const t = i / 96 * Math.PI * 2;
            const ex = Math.cos(t) * o.a, ey = Math.sin(t) * o.b;
            const x = o.cx + ex * cr - ey * sr;
            const y = o.cy + ex * sr + ey * cr;
            if (i === 0) ctx.moveTo(x, y * ISO_K);
            else ctx.lineTo(x, y * ISO_K);
        }
    } else {
        orbitEllipsePath(ctx, hover.orbit.cx, hover.orbit.cy, hover.orbit.r);
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
    // Экран/view сжат по y: расстояние и угол базы живут в raw-плоскости.
    const d = hp ? rawDist(w.x - hp.x, w.y - hp.y)
                 : rawDist(w.x - best.x, w.y - best.y);
    state.baseRadius = fitBaseRadius(d, state.baseMode, state.baseMode.moveId || null);
    // Сторона орбиты — направление от центра хозяина к курсору: перенос
    // поставит базу с этой стороны, создание появится тут же (mode.ang).
    if (hp) {
        const dx = w.x - hp.x, dy = w.y - hp.y;
        if (rawDist(dx, dy) > 1e-6) state.baseMode.ang = rawAngle(dx, dy);
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
// «СОЛНЕЧНАЯ СИСТЕМА» (дерево всех выбираемых тел: Солнце, планеты, луны и
// малые тела), «ОБЪЕКТ» (информация о выбранном; появляется только с выбором —
// шапка блока носит имя выбранного) и «МАЛЫЕ ТЕЛА» (группы малых тел: полёт
// камеры и выбор по клику).
// Выбор делается кликом по канвасу (selectBody вызывает input.js), по
// элементу дерева или по строке блока малых тел. Шапка каждого блока
// сворачивает его — отдельных кнопок «скрыть/показать» нет. Здесь же твин
// полёта камеры (flyToCamera/updateFlyTo), которым main.js двигает камеру,
// и модальный confirmDialog (общий стиль ангара: .slot-dialog).
// Работает с DOM, не с канвасом.
// =============================================================================








// Русские имена для блока «ОБЪЕКТ»: планеты хранят их в данных (data.js, поле
// ru), здесь только солнце — на карте оно не в списке планет.
const RU = { Sun: 'Солнце' };
planets.forEach(p => { RU[p.name] = p.ru || p.name; });
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

/* ---------- Дерево «01 Солнечная система»: все выбираемые тела ---------- */

// Таблица камеры: что должно оказаться в центре экрана и с каким масштабом.
// У планет, лун и малых тел координаты меняются со временем, поэтому здесь
// задан только масштаб, а x/y берутся из текущего кадра. У поясов и облака
// координаты статические — центр карты.
const VIEW_TARGETS = {
    sun:      { x: 0, y: 0, zoom: 1.8 },
    planet:   { zoom: 3.2 },
    moon:     { zoom: 12 },
    asteroid: { zoom: 5 },
    nea:      { zoom: 5 },
    trojan:   { zoom: 4 },
    comet:    { zoom: 4 },
    belt:     { x: 0, y: 0, zoom: 0.72 },
    kuiper:   { x: 0, y: 0, zoom: 0.38 },
    oort:     { x: 0, y: 0, zoom: 0.30 }
};

// Описание областей: у них нет карточки тела, но есть выбор, подсветка и
// короткая карточка области. target — ключ в VIEW_TARGETS.
const REGION_INFO = {
    belt: {
        key: 'belt', target: 'belt', title: 'Пояс астероидов',
        kindLabel: 'пояс астероидов', color: '#b9a88f',
        distance: '2.2–3.5 <em>а.е.</em>',
        map: 'кольцо частиц между Марсом и Юпитером',
        rowTail: '4 тела',
        note: '99% метеоритов Земли — из главного пояса'
    },
    kuiper: {
        key: 'kuiper', target: 'kuiper', title: 'Пояс Койпера',
        kindLabel: 'пояс Койпера', color: '#8ea4b8',
        distance: '30–50 <em>а.е.</em>',
        map: '600 частиц пыли за Нептуном',
        rowTail: '30–50 а.е.',
        note: 'Родина короткопериодических комет'
    },
    oort: {
        key: 'oort', target: 'oort', title: 'Облако Оорта',
        kindLabel: 'облако Оорта', color: '#7f92a8',
        distance: '1300–1800 <em>ед. карты</em>',
        map: '350 частиц на дальней границе карты',
        rowTail: '1300–1800 ед.',
        note: 'Родина долгопериодических комет'
    }
};

// Группы малых тел в дереве. В список попадают только именованные тела: у
// безымянных частиц пояса/облаков нет карточки и выбора на карте.
const TREE_SMALL_GROUPS = [
    { key: 'belt',   title: 'Пояс астероидов',  color: '#b9a88f', items: notables, region: REGION_INFO.belt },
    { key: 'nea',    title: 'Околоземные',      color: '#d8d8d8', items: neaBodies.filter(b => b.name) },
    { key: 'trojan', title: 'Троянцы Юпитера',  color: '#cfcfcf', items: trojanBodies },
    { key: 'comet',  title: 'Кометы',           color: '#bff6ff', items: cometBodies }
];

// Пояс Койпера и облако Оорта — не группы с телами, а отдельные области.
const TREE_REGION_ROWS = [REGION_INFO.kuiper, REGION_INFO.oort];

/** Экранировать текст для HTML-шаблона дерева. */
function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Строки лун планеты: у Земли — псевдо-луна, у остальных — все из data.js. */
function moonRowsFor(p) {
    if (p.name === 'Earth') return [{ n: 'Луна / Moon', period: moonPeriod }];
    return moonsByPlanet[p.name] || [];
}

function moonPeriodLabel(days) {
    if (days == null) return '';
    return (days < 100 ? days.toFixed(2) : days.toFixed(1)) + ' d';
}

function smallKindLabel(b) {
    if (b.kind === 'asteroid') return 'пояс';
    if (b.kind === 'nea') return 'ОЗА';
    if (b.kind === 'trojan') return b.camp === 4 ? 'L4' : 'L5';
    if (b.kind === 'comet') return 'комета';
    return '';
}

/** Цель текущего кадра для планеты: её view-координаты и луны. */
function planetTarget(p) {
    return (state.hoverTargets || []).find(t => t.kind === 'planet' && t.p === p) || null;
}

/** Цель текущего кадра для луны; при сбое — планета, вокруг которой она летит. */
function moonTarget(p, m) {
    const pt = planetTarget(p);
    if (!pt) return null;
    const mh = pt.moons.find(x => x.m.n === m.n);
    return mh ? { x: mh.mx, y: mh.my } : { x: pt.x, y: pt.y };
}

/** Навести камеру на тело по таблице VIEW_TARGETS. */
function focusBody(kind, obj) {
    const t = VIEW_TARGETS[kind];
    if (!t) return;
    const x = Number.isFinite(obj && obj.x) ? obj.x : t.x;
    const y = Number.isFinite(obj && obj.y) ? obj.y : t.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    flyToCamera(x, y, t.zoom, 0.8);
}

/** Навести камеру на пояс/облако: координаты и масштаб — из таблицы. */
function focusRegion(region) {
    const t = VIEW_TARGETS[region.target];
    if (!t) return;
    flyToCamera(t.x, t.y, t.zoom, 0.9);
}

/** Построить дерево «планета → луны», блок «Объект» и сворачивание блоков. */
function buildSidePanel() {
    const treeEl = document.getElementById('lootTree');

    // Солнце — первая строка: на карте оно выбирается, значит должно быть и здесь.
    const sunLi = document.createElement('li');
    sunLi.className = 'planet leaf';
    sunLi.dataset.kind = 'sun';
    sunLi.dataset.name = 'Sun';
    sunLi.innerHTML =
        '<div class="node">' +
            '<span class="dot" style="background:' + COLORS.sun + '"></span>' +
            '<span class="pname">' + RU.Sun + ' / Sun</span>' +
        '</div>';
    sunLi.querySelector('.node').addEventListener('click', () => {
        selectBody({ kind: 'sun', name: 'Солнце / Sun' });
        focusBody('sun');
    });
    treeEl.appendChild(sunLi);

    planets.forEach(p => {
        const li = document.createElement('li');
        li.className = 'planet';
        li.dataset.kind = 'planet';
        li.dataset.name = p.name;
        const moons = moonRowsFor(p);
        li.innerHTML =
            '<div class="node">' +
                '<span class="caret">▶</span>' +
                '<span class="dot" style="background:' + p.color + '"></span>' +
                '<span class="pname">' + p.name + '</span>' +
                '<span class="cnt">☾ ' + moonTotals[p.name] + '</span>' +
            '</div>' +
            '<ul class="loot">' +
                moons.map(m =>
                    '<li data-kind="moon" data-name="' + esc(m.n) + '" data-planet="' + esc(p.name) + '">' +
                    esc(m.n) + '<i>' + moonPeriodLabel(m.period) + '</i></li>').join('') +
            '</ul>';
        // клик по шапке планеты: выбрать планету; клик по карет-зоне — только раскрыть
        li.querySelector('.node').addEventListener('click', e => {
            li.classList.toggle('open');
            selectBody({ kind: 'planet', p });
            const t = planetTarget(p);
            if (t) focusBody('planet', t);
        });
        li.querySelectorAll('.loot li').forEach(mEl => {
            mEl.addEventListener('click', () => {
                const pName = mEl.dataset.planet;
                const planet = planets.find(x => x.name === pName);
                const m = moonFromTree(planet, mEl.dataset.name);
                selectBody({ kind: 'moon', p: planet, m });
                const t = moonTarget(planet, m);
                if (t) focusBody('moon', t);
            });
        });
        treeEl.appendChild(li);
    });

    // Малые тела — четыре раскрывающиеся группы после планет. У пояса
    // астероидов шапка ещё и выбирает весь пояс: клик показывает кольцо и
    // раскрывает четыре крупных тела. У остальных групп шапка только раскрывает.
    TREE_SMALL_GROUPS.forEach(group => {
        if (!group.items.length) return;
        const li = document.createElement('li');
        li.className = 'planet small-group';
        li.dataset.kind = 'small-group';
        li.dataset.name = group.key;
        if (group.region) li.dataset.region = group.region.key;
        li.innerHTML =
            '<div class="node">' +
                '<span class="caret">▶</span>' +
                '<span class="dot" style="background:' + group.color + '"></span>' +
                '<span class="pname">' + group.title + '</span>' +
                '<span class="cnt">' + group.items.length + '</span>' +
            '</div>' +
            '<ul class="loot small-loot">' +
                group.items.map((b, i) =>
                    '<li data-kind="small" data-id="' + esc(b.id) + '" data-index="' + i + '"' +
                        ' title="' + esc(b.name || b.ru) + '">' +
                        '<span class="sname">' + esc(b.ru || b.name) + '</span>' +
                        '<i>' + smallKindLabel(b) + '</i></li>').join('') +
            '</ul>';
        li.querySelector('.node').addEventListener('click', () => {
            li.classList.toggle('open');
            if (group.region) {
                selectBody({ kind: 'region', region: group.region });
                focusRegion(group.region);
            }
        });
        li.querySelectorAll('.loot li').forEach(el => {
            el.addEventListener('click', () => {
                const b = group.items[Number(el.dataset.index)];
                selectBody({ kind: b.kind, name: b.name,
                    orbit: b.poly ? { poly: b.poly } : b.orbit,
                    p: null, m: null, small: b });
                focusBody(b.kind, b);
            });
        });
        treeEl.appendChild(li);
    });

    // Области без отдельных тел: пояс Койпера и облако Оорта. Клик выбирает
    // область и показывает её кольцо целиком.
    TREE_REGION_ROWS.forEach(region => {
        const li = document.createElement('li');
        li.className = 'planet leaf region-row';
        li.dataset.kind = 'region';
        li.dataset.region = region.key;
        li.title = region.note;
        li.innerHTML =
            '<div class="node">' +
                '<span class="dot" style="background:' + region.color + '"></span>' +
                '<span class="pname">' + region.title + '</span>' +
                '<span class="cnt">' + region.rowTail + '</span>' +
            '</div>';
        li.querySelector('.node').addEventListener('click', () => {
            selectBody({ kind: 'region', region });
            focusRegion(region);
        });
        treeEl.appendChild(li);
    });

    // Блок «03 Малые тела»: статические строки-группы, клик — полёт и выбор.
    buildSmallBodiesBlock();

    // Шапки блоков сворачивают своё тело: отдельные кнопки «скрыть/показать» не нужны.
    document.querySelectorAll('#sidePanel .panel-head').forEach(head => {
        head.addEventListener('click', () => head.parentElement.classList.toggle('collapsed'));
    });

    // Блок «02 Объект» появляется только с выбором: на старте его нет вовсе.
    renderObjectInfo();
}

/* ---------- Блок «03 Малые тела»: группы-источники метеоритов Земли ---------- */

// Строки блока. У групп-представителей клик — полёт камеры и выбор тела;
// у Койпера и Оорта клик выбирает область и показывает кольцо; строки
// метеоритов (met) ведут к Марсу и Луне и подсвечены отдельным типом.
const SMALL_ROWS = [
    { name: 'Пояс астероидов',       note: '99% метеоритов Земли',    region: REGION_INFO.belt },
    { name: 'Околоземные (ОЗА)',     note: 'пересекают орбиту Земли', to: 'Эрос',   z: 4 },
    { name: 'Троянцы Юпитера',       note: 'попутчики Юпитера',       to: 'Гектор', z: 4 },
    { name: 'Кометы',                note: 'метеорные потоки',        to: 'Галлея', z: 3.5 },
    { name: 'Пояс Койпера',          note: 'родина короткопериодических комет', region: REGION_INFO.kuiper },
    { name: 'Облако Оорта',          note: 'родина долгопериодических комет',   region: REGION_INFO.oort },
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

/** Клик по строке блока: полёт камеры и выбор (Койпер/Оорт — выбор области). */
function onSmallRowClick(row) {
    if (row.region) {
        selectBody({ kind: 'region', region: row.region });
        focusRegion(row.region);
        return;
    }
    if (row.cam) {   // резерв для будущих строк-областей без карточки
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
 * Виды: {kind:'sun'|'planet'|'moon'|'small'|'region'|'base', p, m, small, region}.
 */
function selectBody(sel) {
    state.selected = sel;
    renderObjectInfo();
    highlightTree();
}

/** Заполнить блок «Объект» данными выбранного тела. Без выбора блока нет вовсе,
 *  а его шапка носит имя выбранного — то же, что заголовок карточки. */
function renderObjectInfo() {
    const box = document.getElementById('objectInfo');
    const sel = state.selected;

    document.getElementById('objectBlock').classList.toggle('hidden', !sel);

    if (!sel) {
        box.innerHTML = '<div class="obj-empty">Кликните по солнцу, планете, луне, области или базе на карте</div>';
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
    } else if (sel.kind === 'region') {
        html = regionInfoHTML(sel.region);
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

    // Имя в шапке блока — как заголовок карточки (у базы — «База …», у планеты —
    // «Земля / Earth»): один источник текста, шапка и карточка не разойдутся.
    const title = box.querySelector('.obj-title strong');
    document.getElementById('objectName').textContent = title ? title.textContent : 'Объект';
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

/** Короткая карточка области: пояс астероидов, пояс Койпера, облако Оорта. */
function regionInfoHTML(region) {
    return '<div class="obj-title"><span class="dot" style="background:' + region.color + '"></span>' +
            '<strong>' + region.title + '</strong></div>' +
        '<div class="obj-kind">Область · ' + region.kindLabel + '</div>' +
        '<div class="obj-rows">' +
            row('Расстояние', region.distance) +
            row('На карте', region.map) +
        '</div>' +
        '<div class="obj-note">' + region.note + '</div>';
}

/** Блок «Объект» для малого тела главного пояса (Церера, Веста, Паллада, Гигея). */
function asteroidInfoHTML(b) {
    return '<div class="obj-title"><span class="dot" style="background:#cfcfcf"></span>' +
            '<strong>' + b.name + '</strong></div>' +
        '<div class="obj-kind">' + b.note + ' · Пояс астероидов</div>' +
        row('Большая полуось', b.a + ' <em>а.е.</em>') +
        row('Эксцентриситет', b.e) +
        row('Период обращения', fmtPeriod(b.T)) +
        row('Перигелий / афелий', (b.a * (1 - b.e)).toFixed(2) + ' / ' + (b.a * (1 + b.e)).toFixed(2) + ' <em>а.е.</em>') +
        row('Диаметр', fmtRu(b.dia) + ' <em>км</em>') +
        '<div class="obj-note">Пояс астероидов — главный источник метеоритов Земли</div>';
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

/** Кнопка «Войти на базу»: переход в интерьер базы (приложение ангара). */
function enterBaseButtonHTML(b) {
    const off = b.status !== 'active' ? ' disabled' : '';   // разбираемую не открываем
    return '<button class="base-create" id="baseEnterBtn"' +
        ' data-enter-id="' + b.id + '"' + off + '>Войти на базу</button>';
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
 * «Войти на базу» (переход в интерьер базы, приложение ангара),
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

    const enterBtn = box.querySelector('#baseEnterBtn');
    if (enterBtn) enterBtn.addEventListener('click', () => {
        const rec = bases.find(b => b.id === enterBtn.dataset.enterId);
        if (!rec || rec.status !== 'active') return;   // разбираемую не открываем
        // Интерьер базы — приложение ангара (орбитальная звёздная база); имя базы
        // уходит в адрес, чтобы станция знала, на какую базу вошёл игрок.
        window.location.href = '../hangar/index.html?base=' + encodeURIComponent(rec.name);
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
    return '<div class="obj-title' + (removing ? ' danger' : '') + '"><span class="dot" style="background:' + COLORS.base + ';box-shadow:0 0 8px rgba(53,232,216,.6)"></span>' +
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
        enterBaseButtonHTML(b) +
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

/** Подсветить выбранный объект в дереве и раскрыть его группу. */
function highlightTree() {
    const sel = state.selected;
    document.querySelectorAll('#lootTree .sel').forEach(el => el.classList.remove('sel'));

    if (!sel) return;
    const tree = document.getElementById('lootTree');

    if (sel.kind === 'sun') {
        const sunLi = tree.querySelector('li[data-kind="sun"]');
        if (sunLi) sunLi.classList.add('sel');
        return;
    }

    // Область: пояс астероидов — шапка группы, Койпер/Оорт — отдельные строки.
    if (sel.kind === 'region') {
        const regionLi = tree.querySelector('li[data-region="' + sel.region.key + '"]');
        if (regionLi) regionLi.classList.add('sel');
        return;
    }

    // Малые тела: строка в одной из четырёх групп; группу раскрываем.
    if (sel.small) {
        const smallLi = Array.from(tree.querySelectorAll('li[data-kind="small"]'))
            .find(el => el.dataset.id === sel.small.id);
        if (!smallLi) return;
        const group = smallLi.closest('.small-group');
        if (group) group.classList.add('open');
        smallLi.classList.add('sel');
        return;
    }

    if (!sel.p) return;
    const li = Array.from(tree.children).find(el => el.dataset.name === sel.p.name);
    if (!li) return;
    li.classList.add('open');

    if (sel.kind === 'base') return; // у базы нет строки в дереве — раскрываем только планету

    if (sel.kind === 'planet') {
        li.classList.add('sel');
    } else if (sel.m) {
        const mEl = Array.from(li.querySelectorAll('.loot li'))
            .find(el => el.dataset.kind === 'moon' && el.dataset.name === sel.m.n);
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
    ctx.fillStyle = '#05060c';
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
