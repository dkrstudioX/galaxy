// СГЕНЕРИРОВАНО build.py — не редактировать вручную, править js/*.js и пересобрать.
// Без модулей, чтобы страница открывалась как file:// без сервера.

// ===== units.js =====
// =============================================================================
// units.js — единый масштаб карты: астрономические единицы, километры и
// мировые единицы (wu). Единственный источник перевода, чтобы расстояния и
// радиусы тел считались по одной линейной шкале.
//
// 1 а.е. = 1000 wu. Тогда 1 км = 1000 / 149 597 870.7 = 6.684587e-6 wu.
// =============================================================================

const AU_KM = 149597870.7;
const AU_WU = 1000;
const KM_WU = AU_WU / AU_KM;

/** Астрономические единицы -> мировые единицы. */
const au = v => v * AU_WU;

/** Километры -> мировые единицы. */
const km = v => v * KM_WU;

/** Мировые единицы -> километры. */
const wuToKm = v => v / KM_WU;

/** Мировые единицы -> астрономические единицы. */
const wuToAu = v => v / AU_WU;

// ===== config.js =====
// =============================================================================
// config.js — все константы приложения в одном месте.
// Импортирует только перевод единиц (units.js), чтобы радиус Солнца был
// задан в километрах и попал в общий реальный масштаб карты.
// =============================================================================



// --- Симуляционное время ------------------------------------------------------
// Эпоха J2000 (2000-01-01 12:00 UTC). simDays — сутки, прошедшие с этой эпохи,
// дробные. От этого же значения считаются углы планет, поэтому счётчик дней
// и движение по орбитам всегда согласованы: угол = L0 + 360° * simDays / период.
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const MS_PER_DAY = 86400000;

// --- Зум -----------------------------------------------------------------------
// 1e-6 px/wu — внешний край облака Оорта (100 000 а.е. = 1e8 wu) занимает
// около 100 px; 10000 px/wu — Земля 426 px, Луна 116 px, Церера 31 px.
const MIN_ZOOM = 1e-6;
const MAX_ZOOM = 10000;

// --- LOD -----------------------------------------------------------------------
// Тело рисуется настоящей сферой, когда его экранный радиус не меньше
// TRUE_MIN_PX. Иначе — маркер видимости: полое кольцо фиксированного
// экранного размера. Размеры — радиусы в пикселях экрана.
const TRUE_MIN_PX = 1.25;
const MARKER_PX = { sun: 3.0, planet: 2.6, moon: 2.0, small: 1.6 };

// --- Звёздные базы -------------------------------------------------------------
// Орбита базы — 3 радиуса хозяина; коридоры и зазоры — доли радиуса хозяина.
// Базы разрешены только на телах с радиусом не меньше 50 км.
const BASE_ORBIT_K = 3;
const BASE_CLEAR_K = 0.4;
const BASE_MOON_CLEAR_K = 0.1;   // запас вокруг орбиты луны (доля hostR)
const BASE_SAME_GAP_K = 0.25;
const BASE_MIN_HOST_KM = 50;


// --- Скорость симуляции ----------------------------------------------------------
// 1x = реальное время (1 секунда экрана = 1 секунда симуляции).
// «Быстрее»/«Медленнее» меняют множитель с шагом x2 / :2, «Нормально» возвращает 1x.
const MIN_SPEED = 1 / 1024;
const MAX_SPEED = 1048576; // хватает, чтобы при 1x увидеть движение планет

// --- Солнце ----------------------------------------------------------------------
// Радиус ядра Солнца — реальные 696 340 км в общем масштабе карты.
const SUN_R = km(696340);

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
// Единый линейный масштаб (units.js): а.е. -> wu, км -> wu, без «сжатых» шкал.
// Здесь же решение уравнения Кеплера и форматтеры масштаба/углов.
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
 * Астрономические единицы -> мировые единицы карты: единая линейная шкала
 * (1 а.е. = 1000 wu). Никаких якорей и кусочного сжатия.
 * @param {number} v расстояние, а.е.
 */
function auToDist(v) {
    return au(v);
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

// --- Форматирование реального масштаба ----------------------------------------

/**
 * Зум, при котором радиус rWu вписан в меньшую сторону экрана с запасом pad.
 * @param {number} rWu радиус в мировых единицах
 * @param {number} W ширина канваса, px
 * @param {number} H высота канваса, px
 * @param {number} [pad=1.05] запас 5 %
 */
function fitZoom(rWu, W, H, pad = 1.05) {
    const side = Math.min(W || 900, H || 900);
    const z = side / 2 / Math.max(rWu * pad, 1e-12);
    return clamp(z, MIN_ZOOM, MAX_ZOOM);
}

/** Километры в компактной записи: 1 737, 12.4, 0.00074. */
function fmtKm(v, digits = 1) {
    if (v == null || !isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(2) + ' млн';
    if (a >= 1e3) return Math.round(v).toLocaleString('ru-RU');
    if (a >= 100) return v.toFixed(0);
    if (a >= 1) return v.toFixed(digits);
    return Number(v.toPrecision(3)).toString();
}

/** Астрономические единицы в компактной записи. */
function fmtAu(v, digits = 3) {
    if (v == null || !isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a >= 1000) return Math.round(v).toLocaleString('ru-RU');
    if (a >= 100) return v.toFixed(1);
    if (a >= 1) return v.toFixed(digits);
    if (a >= 0.01) return v.toFixed(4);
    if (a >= 0.001) return v.toFixed(5);
    return v.toExponential(2);
}

/** «1 px = N км» или «1 px = N а.е.» для HUD. */
function fmtScale(zoom) {
    const wuPerPx = 1 / zoom;
    const kmPerPx = wuToKm(wuPerPx);
    return kmPerPx >= AU_KM * 0.1
        ? fmtAu(wuToAu(wuPerPx)) + ' а.е.'
        : fmtKm(kmPerPx) + ' км';
}

/** «N px/а.е.» для HUD. */
function fmtPxPerAu(zoom) {
    const v = zoom * AU_WU;
    if (v >= 100) return Math.round(v).toLocaleString('ru-RU');
    if (v >= 1) return v.toFixed(1);
    if (v >= 0.01) return v.toFixed(3);
    return v.toExponential(2);
}

/** Угловой диаметр тела: радиус и расстояние в км -> угловые секунды. */
function angularArcsec(radiusKm, distanceKm) {
    if (!(distanceKm > 0) || !(radiusKm > 0)) return null;
    return 2 * Math.atan(radiusKm / distanceKm) * 206264.806247;
}

/** Угловой размер в угловых секундах/минутах/градусах. */
function fmtArcsec(v) {
    if (v == null || !isFinite(v)) return '—';
    if (v >= 3600) return (v / 3600).toFixed(2) + '°';
    if (v >= 60) return (v / 60).toFixed(2) + '′';
    if (v >= 1) return v.toFixed(1) + '″';
    return v.toFixed(3) + '″';
}

// Круглые значения для линейки масштаба.
const KM_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000,
    10000, 20000, 50000, 100000, 200000, 500000, 1e6, 2e6, 5e6, 1e7, 2e7, 5e7, 1e8, 2e8, 5e8, 1e9];
const AU_STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50,
    100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];

/** Ближайшее круглое значение из списка. */
function nearestStep(steps, target) {
    return steps.reduce((best, x) =>
        Math.abs(x - target) < Math.abs(best - target) ? x : best, steps[0]);
}

/**
 * Линейка масштаба: круглое расстояние, которое занимает около targetPx.
 * @returns {{wu: number, px: number, label: string}}
 */
function niceScale(zoom, targetPx = 120) {
    const wuTarget = targetPx / zoom;
    const auTarget = wuToAu(wuTarget);
    if (auTarget >= 0.05) {
        const v = nearestStep(AU_STEPS, auTarget);
        return { wu: au(v), px: au(v) * zoom, label: fmtAu(v) + ' а.е.' };
    }
    const v = nearestStep(KM_STEPS, wuToKm(wuTarget));
    return { wu: km(v), px: km(v) * zoom, label: fmtKm(v) + ' км' };
}

// ===== moons_data.js =====
// СГЕНЕРИРОВАНО build-moons.py — не редактировать вручную.
// Источники: JPL SSD (элементы и физические параметры), Wikipedia
// «List of natural satellites» (радиусы для остальных лун).
// Плутон и его луны не входят: Плутона нет на карте.
const moonCatalog = [
    { planet: "Earth", n: "Moon", ru: "Луна", a: 384400.0, e: 0.0554, peri: 83.23, m0: 135.27, inc: 5.16, node: 125.08, period: 27.322, rad: 1737.4, frame: "ecliptic" },
    { planet: "Mars", n: "Phobos", ru: "Фобос", a: 9375.0, e: 0.015, peri: 25.5, m0: 189.7, inc: 26.29, node: 169.2, period: 0.3187, rad: 11.08, frame: "laplace" },
    { planet: "Mars", n: "Deimos", ru: "Деймос", a: 23457.0, e: 0.0, peri: 54.3, m0: 205.0, inc: 26.99, node: 54.3, period: 1.2625, rad: 6.2, frame: "laplace" },
    { planet: "Jupiter", n: "Metis", ru: "Метида", a: 128000.0, e: 0.0, peri: 0.0, m0: 166.0, inc: 3.13, node: 0.0, period: 0.294779, rad: 21.5, frame: "laplace" },
    { planet: "Jupiter", n: "Adrastea", ru: "Адрастея", a: 129000.0, e: 0.0, peri: 0.0, m0: 214.5, inc: 3.13, node: 0.0, period: 0.29826, rad: 8.2, frame: "laplace" },
    { planet: "Jupiter", n: "Amalthea", ru: "Амальтея", a: 181400.0, e: 0.003, peri: 103.0, m0: 310.6, inc: 3.53, node: 282.9, period: 0.499918, rad: 83.5, frame: "laplace" },
    { planet: "Jupiter", n: "Thebe", ru: "Фива", a: 221900.0, e: 0.018, peri: 7.0, m0: 182.1, inc: 4.23, node: 340.4, period: 0.676105, rad: 49.3, frame: "laplace" },
    { planet: "Jupiter", n: "Io", ru: "Ио", a: 421800.0, e: 0.004, peri: 49.1, m0: 330.9, inc: 3.13, node: 0.0, period: 1.762732, rad: 1821.49, frame: "laplace" },
    { planet: "Jupiter", n: "Europa", ru: "Европа", a: 671100.0, e: 0.009, peri: 229.0, m0: 345.4, inc: 3.63, node: 184.0, period: 3.525463, rad: 1560.8, frame: "laplace" },
    { planet: "Jupiter", n: "Ganymede", ru: "Ганимед", a: 1070400.0, e: 0.001, peri: 256.8, m0: 324.8, inc: 3.33, node: 58.5, period: 7.155588, rad: 2631.2, frame: "laplace" },
    { planet: "Jupiter", n: "Callisto", ru: "Каллисто", a: 1882700.0, e: 0.007, peri: 352.9, m0: 87.4, inc: 3.43, node: 309.1, period: 16.69044, rad: 2410.3, frame: "laplace" },
    { planet: "Jupiter", n: "Themisto", ru: "", a: 7397000.0, e: 0.257, peri: 79.0, m0: 289.1, inc: 44.3, node: 202.7, period: 129.9681, rad: 4.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2011_J_4", ru: "", a: 11104600.0, e: 0.128, peri: 28.6, m0: 314.6, inc: 28.5, node: 342.4, period: 239.0521, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "Leda", ru: "Леда", a: 11145200.0, e: 0.162, peri: 128.2, m0: 232.6, inc: 28.2, node: 216.9, period: 240.3264, rad: 10.75, frame: "ecliptic" },
    { planet: "Jupiter", n: "Ersa", ru: "", a: 11399400.0, e: 0.117, peri: 54.4, m0: 270.8, inc: 29.0, node: 113.7, period: 248.6153, rad: 1.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2018_J_2", ru: "", a: 11419700.0, e: 0.152, peri: 20.4, m0: 115.5, inc: 28.3, node: 91.8, period: 249.275, rad: 1.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "Himalia", ru: "Гималия", a: 11439000.0, e: 0.16, peri: 25.3, m0: 78.3, inc: 28.4, node: 64.2, period: 249.909, rad: 85.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "Pandia", ru: "", a: 11479600.0, e: 0.178, peri: 78.5, m0: 158.5, inc: 28.9, node: 249.8, period: 251.2319, rad: 1.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "Lysithea", ru: "Лиситея", a: 11699100.0, e: 0.117, peri: 57.5, m0: 328.5, inc: 27.7, node: 9.2, period: 258.5035, rad: 21.1, frame: "ecliptic" },
    { planet: "Jupiter", n: "Elara", ru: "Элара", a: 11710700.0, e: 0.212, peri: 242.7, m0: 346.9, inc: 27.8, node: 112.8, period: 258.8861, rad: 39.95, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2011_J_3", ru: "", a: 11716800.0, e: 0.192, peri: 258.0, m0: 359.4, inc: 27.6, node: 123.3, period: 259.0875, rad: 1.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2017_J_17", ru: "", a: 11776100.0, e: 0.164, peri: 57.4, m0: 244.5, inc: 29.0, node: 322.4, period: 261.066, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "Dia", ru: "", a: 12257900.0, e: 0.232, peri: 98.0, m0: 320.9, inc: 29.1, node: 293.9, period: 277.2472, rad: 2.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2018_J_4", ru: "", a: 16328500.0, e: 0.177, peri: 337.1, m0: 138.3, inc: 50.2, node: 52.1, period: 426.2646, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "Carpo", ru: "", a: 17039500.0, e: 0.415, peri: 142.6, m0: 336.6, inc: 53.3, node: 52.1, period: 454.4, rad: 1.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "Valetudo", ru: "", a: 18690100.0, e: 0.217, peri: 247.5, m0: 90.5, inc: 34.5, node: 291.2, period: 522.0743, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "Euporie", ru: "", a: 19261900.0, e: 0.148, peri: 172.9, m0: 56.4, inc: 145.5, node: 63.4, period: 546.1778, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2003_J_18", ru: "", a: 20332800.0, e: 0.102, peri: 253.0, m0: 252.5, inc: 145.7, node: 166.8, period: 592.3333, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "Eupheme", ru: "", a: 20763400.0, e: 0.234, peri: 301.1, m0: 339.8, inc: 147.9, node: 227.5, period: 611.316, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2021_J_3", ru: "", a: 20776600.0, e: 0.239, peri: 0.3, m0: 167.9, inc: 147.9, node: 141.7, period: 611.8736, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2010_J_2", ru: "", a: 20786900.0, e: 0.244, peri: 26.1, m0: 292.5, inc: 148.0, node: 357.3, period: 612.3507, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2016_J_1", ru: "", a: 20796700.0, e: 0.245, peri: 186.2, m0: 215.3, inc: 145.1, node: 247.7, period: 612.7812, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "Mneme", ru: "", a: 20815800.0, e: 0.24, peri: 51.0, m0: 236.1, inc: 147.8, node: 0.9, period: 613.6104, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "Euanthe", ru: "", a: 20822900.0, e: 0.243, peri: 217.6, m0: 353.5, inc: 148.1, node: 265.2, period: 613.9278, rad: 1.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2003_J_16", ru: "", a: 20877500.0, e: 0.238, peri: 60.9, m0: 298.2, inc: 147.8, node: 5.3, period: 616.3444, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "Harpalyke", ru: "", a: 20887500.0, e: 0.239, peri: 139.9, m0: 255.4, inc: 147.8, node: 35.6, period: 616.7833, rad: 2.2, frame: "ecliptic" },
    { planet: "Jupiter", n: "Orthosie", ru: "", a: 20897800.0, e: 0.294, peri: 97.1, m0: 161.1, inc: 144.2, node: 212.4, period: 617.2347, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "Helike", ru: "", a: 20911400.0, e: 0.155, peri: 39.7, m0: 45.8, inc: 154.4, node: 94.6, period: 617.8625, rad: 2.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2021_J_2", ru: "", a: 20926600.0, e: 0.242, peri: 295.4, m0: 110.8, inc: 148.1, node: 269.5, period: 618.5028, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "Praxidike", ru: "", a: 20931100.0, e: 0.245, peri: 103.8, m0: 128.0, inc: 148.2, node: 281.3, period: 618.7229, rad: 3.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2017_J_3", ru: "", a: 20936500.0, e: 0.238, peri: 133.6, m0: 235.4, inc: 147.9, node: 27.9, period: 618.9653, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2021_J_1", ru: "", a: 20954700.0, e: 0.228, peri: 261.7, m0: 129.1, inc: 150.5, node: 241.1, period: 619.7687, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2003_J_12", ru: "", a: 20959300.0, e: 0.235, peri: 120.2, m0: 160.7, inc: 150.0, node: 54.1, period: 619.9611, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2017_J_7", ru: "", a: 20960400.0, e: 0.235, peri: 193.6, m0: 353.0, inc: 147.4, node: 264.9, period: 620.0167, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "Thelxinoe", ru: "", a: 20972300.0, e: 0.229, peri: 121.9, m0: 275.1, inc: 150.7, node: 174.9, period: 620.5458, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "Thyone", ru: "", a: 20972700.0, e: 0.235, peri: 345.9, m0: 242.5, inc: 147.6, node: 240.8, period: 620.5875, rad: 2.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2021_J_8", ru: "", a: 20978900.0, e: 0.243, peri: 166.6, m0: 85.0, inc: 147.1, node: 132.0, period: 620.8486, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2003_J_2", ru: "", a: 20992900.0, e: 0.225, peri: 159.0, m0: 42.3, inc: 150.1, node: 348.4, period: 621.4715, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2022_J_3", ru: "", a: 21015100.0, e: 0.248, peri: 224.7, m0: 271.7, inc: 148.1, node: 233.1, period: 622.4361, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "Ananke", ru: "Ананке", a: 21029500.0, e: 0.238, peri: 92.5, m0: 271.7, inc: 147.6, node: 13.7, period: 623.1097, rad: 14.55, frame: "ecliptic" },
    { planet: "Jupiter", n: "Iocaste", ru: "", a: 21062300.0, e: 0.223, peri: 0.3, m0: 182.0, inc: 148.7, node: 268.9, period: 624.5479, rad: 2.6, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2017_J_10", ru: "", a: 21075800.0, e: 0.209, peri: 164.9, m0: 157.7, inc: 145.1, node: 329.6, period: 625.1493, rad: 2.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "Hermippe", ru: "", a: 21103600.0, e: 0.22, peri: 247.5, m0: 158.6, inc: 150.2, node: 330.3, period: 626.3799, rad: 2.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2010_J_6", ru: "", a: 21489800.0, e: 0.297, peri: 352.3, m0: 87.8, inc: 149.9, node: 279.1, period: 643.6715, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2017_J_9", ru: "", a: 21764200.0, e: 0.197, peri: 161.7, m0: 243.3, inc: 155.4, node: 245.3, period: 656.0479, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "Philophrosyn", ru: "", a: 22600200.0, e: 0.221, peri: 235.2, m0: 88.9, inc: 146.1, node: 234.3, period: 694.2042, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2016_J_3", ru: "", a: 22719300.0, e: 0.251, peri: 131.5, m0: 59.1, inc: 164.6, node: 36.8, period: 699.7583, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2022_J_1", ru: "", a: 22744700.0, e: 0.257, peri: 183.3, m0: 42.2, inc: 164.5, node: 310.9, period: 700.9333, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2010_J_4", ru: "", a: 22793400.0, e: 0.278, peri: 309.4, m0: 80.4, inc: 164.6, node: 147.5, period: 703.1938, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2017_J_8", ru: "", a: 22819600.0, e: 0.259, peri: 67.8, m0: 349.4, inc: 164.8, node: 97.3, period: 704.4181, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "Pasithee", ru: "", a: 22840800.0, e: 0.274, peri: 165.9, m0: 237.8, inc: 164.5, node: 318.0, period: 705.409, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2017_J_13", ru: "", a: 22842700.0, e: 0.277, peri: 94.1, m0: 26.8, inc: 164.5, node: 115.9, period: 705.4972, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2021_J_6", ru: "", a: 22870400.0, e: 0.271, peri: 233.4, m0: 208.5, inc: 164.9, node: 87.2, period: 706.7653, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2003_J_24", ru: "", a: 22882400.0, e: 0.263, peri: 292.8, m0: 121.6, inc: 164.6, node: 208.7, period: 707.3347, rad: 1.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "Eurydome", ru: "", a: 22894500.0, e: 0.287, peri: 161.1, m0: 281.8, inc: 148.9, node: 297.7, period: 707.8569, rad: 1.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2011_J_2", ru: "", a: 22903400.0, e: 0.358, peri: 287.8, m0: 297.6, inc: 151.7, node: 24.9, period: 708.2931, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2003_J_4", ru: "", a: 22922300.0, e: 0.327, peri: 24.2, m0: 216.5, inc: 148.3, node: 175.4, period: 709.1229, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2017_J_18", ru: "", a: 22923800.0, e: 0.254, peri: 278.7, m0: 40.6, inc: 164.9, node: 39.9, period: 709.2396, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "Chaldene", ru: "", a: 22926300.0, e: 0.261, peri: 6.1, m0: 275.3, inc: 164.7, node: 134.5, period: 709.3625, rad: 1.9, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2017_J_2", ru: "", a: 22949600.0, e: 0.27, peri: 152.4, m0: 278.2, inc: 164.5, node: 359.4, period: 710.4208, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "Isonoe", ru: "", a: 22976300.0, e: 0.249, peri: 265.1, m0: 116.3, inc: 164.9, node: 134.1, period: 711.6604, rad: 1.9, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2017_J_11", ru: "", a: 22991300.0, e: 0.268, peri: 160.4, m0: 236.9, inc: 164.8, node: 134.9, period: 712.3826, rad: 2.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2017_J_16", ru: "", a: 23007800.0, e: 0.268, peri: 183.3, m0: 148.8, inc: 164.7, node: 4.7, period: 713.1292, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "Kallichore", ru: "", a: 23017100.0, e: 0.253, peri: 16.5, m0: 66.8, inc: 164.7, node: 23.9, period: 713.5931, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2021_J_4", ru: "", a: 23019700.0, e: 0.265, peri: 270.4, m0: 218.9, inc: 164.6, node: 129.9, period: 713.7056, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "Erinome", ru: "", a: 23027200.0, e: 0.272, peri: 311.1, m0: 273.1, inc: 164.3, node: 311.2, period: 714.0542, rad: 1.6, frame: "ecliptic" },
    { planet: "Jupiter", n: "Kale", ru: "", a: 23047800.0, e: 0.262, peri: 125.9, m0: 175.9, inc: 164.6, node: 56.7, period: 715.016, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "Eirene", ru: "", a: 23051300.0, e: 0.263, peri: 266.4, m0: 336.7, inc: 164.7, node: 180.0, period: 715.191, rad: 2.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "Aitne", ru: "", a: 23059400.0, e: 0.273, peri: 70.6, m0: 120.6, inc: 164.5, node: 358.4, period: 715.5396, rad: 1.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "Eukelade", ru: "", a: 23062400.0, e: 0.274, peri: 130.5, m0: 234.2, inc: 164.7, node: 200.4, period: 715.6868, rad: 2.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2022_J_2", ru: "", a: 23073400.0, e: 0.263, peri: 44.7, m0: 98.9, inc: 164.7, node: 47.7, period: 716.2104, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "Arche", ru: "", a: 23093200.0, e: 0.263, peri: 145.8, m0: 34.0, inc: 164.5, node: 333.3, period: 717.1056, rad: 1.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "Taygete", ru: "", a: 23103400.0, e: 0.257, peri: 148.5, m0: 116.5, inc: 164.7, node: 300.8, period: 717.5917, rad: 2.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2016_J_4", ru: "", a: 23113900.0, e: 0.294, peri: 92.6, m0: 217.5, inc: 147.1, node: 203.2, period: 718.0382, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2011_J_1", ru: "", a: 23120800.0, e: 0.269, peri: 303.9, m0: 225.4, inc: 164.7, node: 253.5, period: 718.4153, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "Carme", ru: "Карме", a: 23139200.0, e: 0.261, peri: 122.0, m0: 259.5, inc: 164.6, node: 115.5, period: 719.2806, rad: 23.3, frame: "ecliptic" },
    { planet: "Jupiter", n: "Herse", ru: "", a: 23146700.0, e: 0.258, peri: 283.6, m0: 123.1, inc: 164.4, node: 299.5, period: 719.6264, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2003_J_19", ru: "", a: 23153100.0, e: 0.264, peri: 208.7, m0: 196.9, inc: 164.6, node: 21.9, period: 719.9222, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2017_J_15", ru: "", a: 23170300.0, e: 0.232, peri: 2.2, m0: 324.6, inc: 149.2, node: 304.1, period: 720.6535, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2010_J_1", ru: "", a: 23185600.0, e: 0.256, peri: 100.3, m0: 183.4, inc: 164.5, node: 284.7, period: 721.4257, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2003_J_9", ru: "", a: 23195100.0, e: 0.268, peri: 334.7, m0: 359.8, inc: 164.7, node: 46.3, period: 721.8792, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2017_J_5", ru: "", a: 23202000.0, e: 0.261, peri: 334.8, m0: 69.3, inc: 164.7, node: 42.3, period: 722.1972, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2011_J_6", ru: "", a: 23238700.0, e: 0.261, peri: 162.1, m0: 54.2, inc: 164.9, node: 310.6, period: 723.934, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2017_J_6", ru: "", a: 23251200.0, e: 0.333, peri: 328.3, m0: 146.0, inc: 149.6, node: 312.8, period: 724.4688, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2018_J_5", ru: "", a: 23269900.0, e: 0.261, peri: 121.8, m0: 82.9, inc: 164.9, node: 189.4, period: 725.3785, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2017_J_12", ru: "", a: 23270500.0, e: 0.257, peri: 207.4, m0: 273.2, inc: 164.8, node: 236.7, period: 725.3986, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "Kalyke", ru: "", a: 23298000.0, e: 0.261, peri: 278.2, m0: 224.9, inc: 164.7, node: 37.7, period: 726.7007, rad: 3.45, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2021_J_7", ru: "", a: 23305900.0, e: 0.253, peri: 299.8, m0: 293.4, inc: 149.4, node: 286.5, period: 727.0104, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "Hegemone", ru: "", a: 23342600.0, e: 0.357, peri: 143.7, m0: 241.1, inc: 152.5, node: 311.5, period: 728.7743, rad: 1.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2003_J_10", ru: "", a: 23384400.0, e: 0.257, peri: 343.3, m0: 272.8, inc: 164.6, node: 155.7, period: 730.7375, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2018_J_3", ru: "", a: 23400200.0, e: 0.268, peri: 313.2, m0: 279.0, inc: 164.9, node: 135.7, period: 731.4875, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2017_J_14", ru: "", a: 23412500.0, e: 0.436, peri: 84.4, m0: 100.3, inc: 142.7, node: 294.2, period: 732.0424, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2021_J_5", ru: "", a: 23414600.0, e: 0.272, peri: 67.8, m0: 236.5, inc: 164.9, node: 154.4, period: 732.1528, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2024_J_1", ru: "", a: 23462100.0, e: 0.273, peri: 21.2, m0: 147.7, inc: 164.7, node: 272.4, period: 734.3764, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "Pasiphae", ru: "Пасифе", a: 23463200.0, e: 0.412, peri: 128.5, m0: 279.3, inc: 148.3, node: 315.7, period: 734.4215, rad: 28.9, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2011_J_5", ru: "", a: 23527800.0, e: 0.251, peri: 134.2, m0: 66.6, inc: 164.6, node: 43.7, period: 737.4646, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "Sponde", ru: "", a: 23538700.0, e: 0.323, peri: 165.9, m0: 177.4, inc: 149.4, node: 109.3, period: 737.9542, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2010_J_5", ru: "", a: 23581000.0, e: 0.257, peri: 219.9, m0: 233.7, inc: 164.6, node: 309.5, period: 739.9875, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "Magaclite", ru: "", a: 23640100.0, e: 0.421, peri: 242.1, m0: 116.1, inc: 149.9, node: 292.2, period: 742.7715, rad: 2.7, frame: "ecliptic" },
    { planet: "Jupiter", n: "Cyllene", ru: "", a: 23650000.0, e: 0.421, peri: 68.2, m0: 153.3, inc: 146.8, node: 253.6, period: 743.2062, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "Sinope", ru: "Синоне", a: 23679300.0, e: 0.262, peri: 302.3, m0: 157.4, inc: 157.3, node: 308.0, period: 744.5951, rad: 17.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2017_J_1", ru: "", a: 23739600.0, e: 0.321, peri: 326.5, m0: 250.1, inc: 145.6, node: 251.8, period: 747.4382, rad: 2.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "Aoede", ru: "", a: 23773100.0, e: 0.437, peri: 199.6, m0: 207.6, inc: 155.7, node: 156.5, period: 749.0708, rad: 2.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "Autonoe", ru: "", a: 23785200.0, e: 0.326, peri: 326.0, m0: 134.0, inc: 150.7, node: 264.8, period: 749.6097, rad: 2.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "Callirrhoe", ru: "", a: 23789400.0, e: 0.29, peri: 291.7, m0: 117.9, inc: 144.9, node: 278.2, period: 749.791, rad: 4.8, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2003_J_23", ru: "", a: 23824000.0, e: 0.306, peri: 287.5, m0: 140.6, inc: 144.4, node: 30.9, period: 751.3993, rad: 1.0, frame: "ecliptic" },
    { planet: "Jupiter", n: "S2010_J_3", ru: "", a: 23862900.0, e: 0.313, peri: 342.6, m0: 40.1, inc: 148.3, node: 312.4, period: 753.2771, rad: 0.5, frame: "ecliptic" },
    { planet: "Jupiter", n: "Kore", ru: "", a: 24203300.0, e: 0.338, peri: 99.5, m0: 40.6, inc: 141.7, node: 324.2, period: 769.4229, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2009_S_2", ru: "", a: 117061.0, e: 0.0, peri: 0.0, m0: 293.4, inc: 26.73, node: 0.0, period: 0.473026, rad: 1.5, frame: "equatorial" },
    { planet: "Saturn", n: "Pan", ru: "Пан", a: 133600.0, e: 0.0, peri: 0.0, m0: 146.6, inc: 26.73, node: 0.0, period: 0.575051, rad: 14.0, frame: "laplace" },
    { planet: "Saturn", n: "Daphnis", ru: "Дафнис", a: 136500.0, e: 0.0, peri: 0.0, m0: 153.6, inc: 26.73, node: 0.0, period: 0.59408, rad: 3.8, frame: "laplace" },
    { planet: "Saturn", n: "Atlas", ru: "Атлас", a: 137700.0, e: 0.001, peri: 82.3, m0: 289.1, inc: 26.73, node: 0.0, period: 0.604602, rad: 15.1, frame: "laplace" },
    { planet: "Saturn", n: "Prometheus", ru: "Прометей", a: 139400.0, e: 0.002, peri: 341.9, m0: 135.4, inc: 26.73, node: 0.0, period: 0.615878, rad: 43.1, frame: "laplace" },
    { planet: "Saturn", n: "Pandora", ru: "Пандора", a: 141700.0, e: 0.004, peri: 217.9, m0: 123.9, inc: 26.73, node: 0.0, period: 0.631369, rad: 40.6, frame: "laplace" },
    { planet: "Saturn", n: "Epimetheus", ru: "Эпиметей", a: 151400.0, e: 0.02, peri: 286.1, m0: 197.2, inc: 27.03, node: 189.8, period: 0.697012, rad: 58.2, frame: "laplace" },
    { planet: "Saturn", n: "Janus", ru: "Янус", a: 151500.0, e: 0.007, peri: 171.0, m0: 111.7, inc: 26.93, node: 159.9, period: 0.697353, rad: 89.2, frame: "laplace" },
    { planet: "Saturn", n: "Aegaeon", ru: "Эгеон", a: 167500.0, e: 0.0, peri: 0.0, m0: 4.4, inc: 26.73, node: 0.0, period: 0.808115, rad: 0.33, frame: "laplace" },
    { planet: "Saturn", n: "Mimas", ru: "Мимас", a: 186000.0, e: 0.02, peri: 226.6, m0: 275.3, inc: 28.33, node: 66.2, period: 0.942422, rad: 198.2, frame: "laplace" },
    { planet: "Saturn", n: "Methone", ru: "Метона", a: 194700.0, e: 0.002, peri: 315.5, m0: 0.0, inc: 26.73, node: 0.0, period: 1.009549, rad: 1.45, frame: "laplace" },
    { planet: "Saturn", n: "Anthe", ru: "Анфа", a: 198100.0, e: 0.002, peri: 293.4, m0: 351.4, inc: 26.73, node: 0.0, period: 1.038898, rad: 0.9, frame: "laplace" },
    { planet: "Saturn", n: "Pallene", ru: "Паллена", a: 212300.0, e: 0.004, peri: 139.2, m0: 2.0, inc: 26.93, node: 304.3, period: 1.156059, rad: 2.22, frame: "laplace" },
    { planet: "Saturn", n: "Enceladus", ru: "Энцелад", a: 238400.0, e: 0.005, peri: 119.5, m0: 57.0, inc: 26.73, node: 0.0, period: 1.370218, rad: 252.1, frame: "laplace" },
    { planet: "Saturn", n: "Tethys", ru: "Тефия", a: 295000.0, e: 0.001, peri: 248.3, m0: 0.0, inc: 27.83, node: 273.0, period: 1.887802, rad: 531.1, frame: "laplace" },
    { planet: "Saturn", n: "Telesto", ru: "Телесто", a: 295000.0, e: 0.001, peri: 308.3, m0: 0.0, inc: 27.93, node: 242.1, period: 1.887802, rad: 12.4, frame: "laplace" },
    { planet: "Saturn", n: "Calypso", ru: "Калипсо", a: 295000.0, e: 0.001, peri: 188.2, m0: 0.0, inc: 28.23, node: 326.6, period: 1.887803, rad: 10.7, frame: "laplace" },
    { planet: "Saturn", n: "Helene", ru: "Елена", a: 377600.0, e: 0.007, peri: 95.1, m0: 295.5, inc: 26.93, node: 260.8, period: 2.736916, rad: 18.0, frame: "laplace" },
    { planet: "Saturn", n: "Polydeuces", ru: "Полидевк", a: 377600.0, e: 0.019, peri: 261.6, m0: 359.0, inc: 26.93, node: 167.5, period: 2.736916, rad: 1.3, frame: "laplace" },
    { planet: "Saturn", n: "Dione", ru: "Диона", a: 377700.0, e: 0.002, peri: 116.0, m0: 212.0, inc: 26.73, node: 0.0, period: 2.736916, rad: 561.4, frame: "laplace" },
    { planet: "Saturn", n: "Rhea", ru: "Рея", a: 527200.0, e: 0.001, peri: 178.0, m0: 31.5, inc: 27.03, node: 133.7, period: 4.517503, rad: 763.5, frame: "laplace" },
    { planet: "Saturn", n: "Titan", ru: "Титан", a: 1221900.0, e: 0.029, peri: 156.9, m0: 11.7, inc: 27.03, node: 78.6, period: 15.945448, rad: 2574.76, frame: "laplace" },
    { planet: "Saturn", n: "Hyperion", ru: "Гиперион", a: 1481500.0, e: 0.105, peri: 301.1, m0: 122.9, inc: 27.33, node: 87.1, period: 21.276658, rad: 135.0, frame: "laplace" },
    { planet: "Saturn", n: "Iapetus", ru: "Япет", a: 3561700.0, e: 0.028, peri: 341.0, m0: 74.8, inc: 34.33, node: 86.5, period: 79.331002, rad: 734.3, frame: "laplace" },
    { planet: "Saturn", n: "S2023_S_1", ru: "", a: 11205400.0, e: 0.386, peri: 96.4, m0: 263.4, inc: 48.8, node: 159.6, period: 442.8632, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_1", ru: "", a: 11245400.0, e: 0.383, peri: 272.2, m0: 36.5, inc: 49.5, node: 185.6, period: 445.1701, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_54", ru: "", a: 11277500.0, e: 0.373, peri: 188.6, m0: 69.3, inc: 48.1, node: 80.2, period: 447.141, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_56", ru: "", a: 11287500.0, e: 0.358, peri: 0.8, m0: 341.9, inc: 45.4, node: 271.0, period: 447.7458, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_55", ru: "", a: 11294700.0, e: 0.26, peri: 276.6, m0: 59.6, inc: 48.9, node: 196.6, period: 448.1618, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_11", ru: "", a: 11295600.0, e: 0.372, peri: 204.6, m0: 95.9, inc: 48.2, node: 94.2, period: 448.2111, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_22", ru: "", a: 11305100.0, e: 0.369, peri: 121.6, m0: 223.0, inc: 47.3, node: 21.1, period: 448.775, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_49", ru: "", a: 11305900.0, e: 0.373, peri: 220.1, m0: 313.4, inc: 48.0, node: 121.9, period: 448.8382, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "Kiviuq", ru: "", a: 11307400.0, e: 0.275, peri: 84.5, m0: 183.2, inc: 48.0, node: 352.7, period: 448.9076, rad: 8.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_2", ru: "", a: 11309900.0, e: 0.339, peri: 11.1, m0: 257.2, inc: 45.7, node: 253.8, period: 449.0535, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_23", ru: "", a: 11310200.0, e: 0.255, peri: 77.8, m0: 1.0, inc: 48.7, node: 356.3, period: 449.0806, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_12", ru: "", a: 11314500.0, e: 0.26, peri: 151.7, m0: 350.8, inc: 50.8, node: 70.5, period: 449.3271, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2005_S_4", ru: "", a: 11324500.0, e: 0.315, peri: 276.5, m0: 247.1, inc: 48.0, node: 169.4, period: 449.925, rad: 2.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_25", ru: "", a: 11329400.0, e: 0.271, peri: 287.6, m0: 358.9, inc: 48.1, node: 213.7, period: 450.2181, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_1", ru: "", a: 11338600.0, e: 0.337, peri: 234.9, m0: 2.1, inc: 48.2, node: 161.7, period: 450.7722, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "Ijiraq", ru: "", a: 11344700.0, e: 0.293, peri: 221.1, m0: 83.4, inc: 49.2, node: 152.5, period: 451.1201, rad: 6.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_48", ru: "", a: 11355100.0, e: 0.373, peri: 8.4, m0: 21.9, inc: 45.9, node: 253.5, period: 451.7528, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_24", ru: "", a: 11360500.0, e: 0.345, peri: 280.0, m0: 79.3, inc: 46.7, node: 205.3, period: 452.0743, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2007_S_10", ru: "", a: 11364900.0, e: 0.367, peri: 21.3, m0: 23.6, inc: 45.8, node: 287.1, period: 452.3576, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_26", ru: "", a: 11390900.0, e: 0.365, peri: 231.0, m0: 164.1, inc: 48.1, node: 119.7, period: 453.8882, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_13", ru: "", a: 11415600.0, e: 0.373, peri: 138.0, m0: 230.4, inc: 48.0, node: 41.6, period: 455.3875, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_50", ru: "", a: 11656500.0, e: 0.263, peri: 355.3, m0: 79.8, inc: 166.1, node: 29.0, period: 469.8201, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_6", ru: "", a: 11953100.0, e: 0.336, peri: 158.1, m0: 133.4, inc: 47.4, node: 54.4, period: 487.909, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_7", ru: "", a: 12133700.0, e: 0.284, peri: 32.2, m0: 102.3, inc: 44.7, node: 289.7, period: 499.0097, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_38", ru: "", a: 12823500.0, e: 0.909, peri: 304.6, m0: 244.7, inc: 149.2, node: 63.4, period: 546.3146, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "Phoebe", ru: "Феба", a: 12929400.0, e: 0.164, peri: 73.0, m0: 308.0, inc: 148.47, node: 192.7, period: 550.30391, rad: 106.5, frame: "laplace" },
    { planet: "Saturn", n: "S2023_S_9", ru: "", a: 13167500.0, e: 0.141, peri: 174.6, m0: 285.2, inc: 172.2, node: 324.8, period: 564.1139, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2006_S_20", ru: "", a: 13193700.0, e: 0.206, peri: 138.3, m0: 153.1, inc: 173.1, node: 60.9, period: 565.7889, rad: 2.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_56", ru: "", a: 13670200.0, e: 0.339, peri: 79.6, m0: 165.7, inc: 161.6, node: 343.2, period: 596.6938, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_8", ru: "", a: 14018800.0, e: 0.122, peri: 158.9, m0: 149.6, inc: 166.9, node: 240.1, period: 619.691, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_62", ru: "", a: 14025900.0, e: 0.467, peri: 202.4, m0: 241.3, inc: 155.6, node: 355.8, period: 620.1486, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_11", ru: "", a: 14046100.0, e: 0.3, peri: 269.1, m0: 334.2, inc: 170.9, node: 193.0, period: 621.4931, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2006_S_9", ru: "", a: 14406700.0, e: 0.249, peri: 17.9, m0: 65.2, inc: 173.0, node: 36.0, period: 645.5771, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2006_S_21", ru: "", a: 14976500.0, e: 0.204, peri: 125.7, m0: 40.7, inc: 169.8, node: 328.3, period: 684.2764, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "Paaliaq", ru: "", a: 14997700.0, e: 0.378, peri: 230.8, m0: 318.2, inc: 48.5, node: 353.2, period: 685.7153, rad: 14.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2006_S_22", ru: "", a: 15109500.0, e: 0.246, peri: 302.8, m0: 254.1, inc: 172.0, node: 231.1, period: 693.4146, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_13", ru: "", a: 15193000.0, e: 0.179, peri: 241.7, m0: 173.9, inc: 168.5, node: 134.2, period: 699.1799, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_10", ru: "", a: 15500200.0, e: 0.302, peri: 72.8, m0: 70.9, inc: 163.0, node: 308.1, period: 720.4931, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "Skathi", ru: "", a: 15575400.0, e: 0.281, peri: 126.4, m0: 269.3, inc: 151.6, node: 284.1, period: 725.7313, rad: 4.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_12", ru: "", a: 15805900.0, e: 0.601, peri: 123.5, m0: 339.7, inc: 168.8, node: 301.0, period: 741.9167, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2007_S_5", ru: "", a: 15835600.0, e: 0.104, peri: 173.3, m0: 23.2, inc: 158.4, node: 128.9, period: 744.0056, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2007_S_7", ru: "", a: 15931600.0, e: 0.217, peri: 153.4, m0: 63.4, inc: 169.3, node: 3.8, period: 750.7958, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2007_S_2", ru: "", a: 15939100.0, e: 0.232, peri: 153.7, m0: 10.0, inc: 174.0, node: 107.3, period: 751.3306, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_37", ru: "", a: 15956300.0, e: 0.448, peri: 207.7, m0: 187.6, inc: 158.2, node: 135.3, period: 752.5465, rad: 4.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_47", ru: "", a: 16050700.0, e: 0.291, peri: 230.2, m0: 25.2, inc: 160.9, node: 294.8, period: 759.2201, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_40", ru: "", a: 16075600.0, e: 0.297, peri: 165.4, m0: 291.4, inc: 169.2, node: 37.9, period: 760.9993, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_14", ru: "", a: 16186200.0, e: 0.313, peri: 50.1, m0: 209.3, inc: 161.7, node: 355.4, period: 768.8625, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_27", ru: "", a: 16267000.0, e: 0.42, peri: 212.3, m0: 152.1, inc: 162.1, node: 115.1, period: 774.6333, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "Albiorix", ru: "", a: 16329200.0, e: 0.482, peri: 173.9, m0: 155.0, inc: 36.8, node: 111.1, period: 779.0701, rad: 14.3, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_2", ru: "", a: 16560300.0, e: 0.279, peri: 198.5, m0: 185.1, inc: 173.3, node: 95.3, period: 795.6722, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_15", ru: "", a: 16729200.0, e: 0.462, peri: 254.0, m0: 141.7, inc: 37.1, node: 338.2, period: 807.8243, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_14", ru: "", a: 16853000.0, e: 0.497, peri: 283.1, m0: 62.7, inc: 171.6, node: 291.7, period: 816.8618, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_55", ru: "", a: 16875100.0, e: 0.491, peri: 251.9, m0: 68.8, inc: 35.9, node: 191.1, period: 818.5125, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_16", ru: "", a: 16963400.0, e: 0.405, peri: 341.7, m0: 185.2, inc: 167.3, node: 268.6, period: 824.9229, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_16", ru: "", a: 17005300.0, e: 0.27, peri: 27.5, m0: 80.0, inc: 162.6, node: 270.6, period: 827.9111, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "Bebhionn", ru: "", a: 17027300.0, e: 0.459, peri: 202.8, m0: 128.4, inc: 38.6, node: 197.7, period: 829.6437, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2007_S_8", ru: "", a: 17048900.0, e: 0.49, peri: 100.9, m0: 6.3, inc: 36.2, node: 202.2, period: 831.2111, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_29", ru: "", a: 17063900.0, e: 0.485, peri: 107.4, m0: 244.1, inc: 38.6, node: 157.9, period: 832.2736, rad: 4.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_3", ru: "", a: 17077400.0, e: 0.248, peri: 13.1, m0: 150.3, inc: 166.9, node: 243.9, period: 833.1917, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_17", ru: "", a: 17094200.0, e: 0.378, peri: 138.1, m0: 359.0, inc: 148.9, node: 210.9, period: 834.4472, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_53", ru: "", a: 17181100.0, e: 0.103, peri: 9.6, m0: 179.0, inc: 171.2, node: 314.6, period: 840.8181, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_58", ru: "", a: 17206000.0, e: 0.093, peri: 189.9, m0: 175.6, inc: 169.6, node: 119.3, period: 842.6812, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_20", ru: "", a: 17261000.0, e: 0.442, peri: 74.8, m0: 200.6, inc: 136.5, node: 112.7, period: 846.7653, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_29", ru: "", a: 17353900.0, e: 0.441, peri: 279.6, m0: 133.8, inc: 37.7, node: 306.9, period: 853.6229, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_18", ru: "", a: 17381700.0, e: 0.448, peri: 358.1, m0: 169.7, inc: 36.7, node: 78.1, period: 855.6535, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_17", ru: "", a: 17385300.0, e: 0.498, peri: 127.4, m0: 128.1, inc: 35.9, node: 240.7, period: 855.9354, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_7", ru: "", a: 17394000.0, e: 0.5, peri: 114.5, m0: 215.8, inc: 161.4, node: 175.7, period: 856.534, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2007_S_11", ru: "", a: 17434400.0, e: 0.499, peri: 42.8, m0: 233.9, inc: 35.5, node: 53.9, period: 859.5264, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_54", ru: "", a: 17485100.0, e: 0.48, peri: 181.2, m0: 48.2, inc: 37.8, node: 120.8, period: 863.3486, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_60", ru: "", a: 17493700.0, e: 0.206, peri: 339.4, m0: 93.9, inc: 170.7, node: 81.3, period: 863.9632, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_28", ru: "", a: 17496000.0, e: 0.199, peri: 3.9, m0: 307.9, inc: 158.4, node: 268.3, period: 864.0938, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_31", ru: "", a: 17497100.0, e: 0.159, peri: 336.4, m0: 261.8, inc: 48.0, node: 82.5, period: 863.9229, rad: 4.0, frame: "ecliptic" },
    { planet: "Saturn", n: "Erriapus", ru: "", a: 17506900.0, e: 0.475, peri: 66.0, m0: 14.3, inc: 37.1, node: 146.2, period: 864.9236, rad: 5.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_19", ru: "", a: 17590300.0, e: 0.092, peri: 255.5, m0: 325.5, inc: 48.2, node: 50.1, period: 870.9229, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "Skoll", ru: "", a: 17623400.0, e: 0.463, peri: 120.1, m0: 181.2, inc: 159.4, node: 294.0, period: 873.5736, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_3", ru: "", a: 17646400.0, e: 0.178, peri: 357.7, m0: 272.6, inc: 46.9, node: 93.7, period: 875.0007, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_30", ru: "", a: 17709900.0, e: 0.107, peri: 2.1, m0: 187.8, inc: 168.3, node: 356.8, period: 879.9708, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_19", ru: "", a: 17726700.0, e: 0.159, peri: 121.6, m0: 80.4, inc: 48.1, node: 56.1, period: 881.0431, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_31", ru: "", a: 17739100.0, e: 0.488, peri: 211.5, m0: 35.2, inc: 39.8, node: 173.7, period: 882.241, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "Tarqeq", ru: "", a: 17751000.0, e: 0.144, peri: 165.5, m0: 292.8, inc: 48.7, node: 93.3, period: 882.8514, rad: 3.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_21", ru: "", a: 17755400.0, e: 0.077, peri: 106.1, m0: 38.7, inc: 157.3, node: 124.2, period: 883.3083, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_4", ru: "", a: 17764600.0, e: 0.276, peri: 273.9, m0: 123.9, inc: 170.0, node: 264.4, period: 884.1111, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_18", ru: "", a: 17777900.0, e: 0.18, peri: 9.9, m0: 218.7, inc: 168.9, node: 204.0, period: 885.1153, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_14", ru: "", a: 17852800.0, e: 0.172, peri: 92.8, m0: 240.9, inc: 46.2, node: 149.6, period: 890.5868, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_2", ru: "", a: 17869000.0, e: 0.152, peri: 226.9, m0: 19.2, inc: 170.7, node: 96.2, period: 891.8576, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "Siarnaq", ru: "", a: 17881100.0, e: 0.308, peri: 132.4, m0: 62.7, inc: 47.8, node: 64.0, period: 892.6799, rad: 19.65, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_4", ru: "", a: 17951900.0, e: 0.408, peri: 188.4, m0: 217.8, inc: 170.1, node: 301.4, period: 898.0889, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_32", ru: "", a: 17960500.0, e: 0.276, peri: 139.5, m0: 20.1, inc: 46.2, node: 218.1, period: 898.7083, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_20", ru: "", a: 17997300.0, e: 0.133, peri: 323.4, m0: 330.0, inc: 169.8, node: 92.9, period: 901.525, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_3", ru: "", a: 18056800.0, e: 0.142, peri: 174.4, m0: 135.8, inc: 46.0, node: 216.8, period: 905.841, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_61", ru: "", a: 18067700.0, e: 0.557, peri: 341.4, m0: 75.3, inc: 158.0, node: 303.7, period: 906.8486, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_41", ru: "", a: 18095400.0, e: 0.301, peri: 276.2, m0: 343.6, inc: 165.7, node: 43.6, period: 908.8924, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2005_S_6", ru: "", a: 18107300.0, e: 0.084, peri: 243.9, m0: 163.4, inc: 47.7, node: 166.5, period: 909.5785, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_57", ru: "", a: 18150500.0, e: 0.263, peri: 100.0, m0: 202.7, inc: 167.9, node: 39.1, period: 913.0736, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_6", ru: "", a: 18205600.0, e: 0.12, peri: 81.1, m0: 185.7, inc: 46.4, node: 154.2, period: 917.1056, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2006_S_24", ru: "", a: 18210700.0, e: 0.352, peri: 244.6, m0: 10.3, inc: 165.9, node: 204.8, period: 917.559, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "Tarvos", ru: "", a: 18216600.0, e: 0.522, peri: 18.6, m0: 64.5, inc: 37.8, node: 95.7, period: 917.984, rad: 7.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_4", ru: "", a: 18236400.0, e: 0.496, peri: 225.5, m0: 178.7, inc: 40.1, node: 67.8, period: 919.5174, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_30", ru: "", a: 18238300.0, e: 0.493, peri: 81.3, m0: 2.7, inc: 142.4, node: 250.0, period: 919.7139, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_42", ru: "", a: 18240700.0, e: 0.158, peri: 111.1, m0: 325.2, inc: 165.7, node: 3.9, period: 919.8847, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_15", ru: "", a: 18241300.0, e: 0.549, peri: 39.8, m0: 159.7, inc: 161.9, node: 276.6, period: 919.9347, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_58", ru: "", a: 18254500.0, e: 0.249, peri: 44.5, m0: 180.1, inc: 45.7, node: 284.5, period: 920.8035, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2006_S_23", ru: "", a: 18269700.0, e: 0.19, peri: 329.6, m0: 309.9, inc: 43.8, node: 257.1, period: 921.8632, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "Hyrrokkin", ru: "", a: 18340900.0, e: 0.336, peri: 305.0, m0: 214.8, inc: 149.9, node: 40.2, period: 927.4569, rad: 4.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_24", ru: "", a: 18351800.0, e: 0.374, peri: 321.1, m0: 54.4, inc: 169.7, node: 1.4, period: 928.2451, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "Greip", ru: "", a: 18380000.0, e: 0.317, peri: 122.0, m0: 355.9, inc: 174.2, node: 335.8, period: 930.4389, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_5", ru: "", a: 18391000.0, e: 0.22, peri: 140.6, m0: 232.0, inc: 48.2, node: 214.9, period: 931.1889, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_34", ru: "", a: 18446800.0, e: 0.536, peri: 36.1, m0: 78.5, inc: 37.6, node: 169.4, period: 935.4472, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_13", ru: "", a: 18453700.0, e: 0.265, peri: 213.2, m0: 51.9, inc: 169.0, node: 217.8, period: 936.0889, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_63", ru: "", a: 18482600.0, e: 0.266, peri: 41.7, m0: 225.6, inc: 165.0, node: 101.8, period: 938.2549, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2005_S_7", ru: "", a: 18502500.0, e: 0.565, peri: 42.5, m0: 181.1, inc: 34.6, node: 269.8, period: 939.7451, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2007_S_6", ru: "", a: 18545000.0, e: 0.168, peri: 343.3, m0: 347.8, inc: 166.5, node: 324.1, period: 942.9785, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_35", ru: "", a: 18557800.0, e: 0.577, peri: 244.4, m0: 259.0, inc: 157.3, node: 63.3, period: 943.9993, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2006_S_25", ru: "", a: 18572400.0, e: 0.303, peri: 47.5, m0: 348.5, inc: 158.8, node: 277.4, period: 945.0681, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_22", ru: "", a: 18577500.0, e: 0.182, peri: 28.3, m0: 4.2, inc: 47.5, node: 121.8, period: 945.3701, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "Mundilfari", ru: "", a: 18588200.0, e: 0.211, peri: 24.6, m0: 299.0, inc: 167.1, node: 79.2, period: 946.2903, rad: 3.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2006_S_26", ru: "", a: 18619300.0, e: 0.248, peri: 150.3, m0: 201.0, inc: 171.9, node: 147.8, period: 948.6722, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_33", ru: "", a: 18696100.0, e: 0.289, peri: 233.3, m0: 245.6, inc: 170.4, node: 186.4, period: 954.534, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2006_S_1", ru: "", a: 18746300.0, e: 0.105, peri: 133.3, m0: 86.3, inc: 156.1, node: 333.6, period: 958.3236, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_23", ru: "", a: 18783700.0, e: 0.35, peri: 278.2, m0: 81.8, inc: 164.8, node: 187.0, period: 961.2236, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_21", ru: "", a: 18862100.0, e: 0.307, peri: 156.3, m0: 95.5, inc: 169.9, node: 328.3, period: 967.2604, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_46", ru: "", a: 18892100.0, e: 0.207, peri: 294.6, m0: 16.0, inc: 167.3, node: 323.4, period: 969.5965, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_43", ru: "", a: 18935700.0, e: 0.432, peri: 65.9, m0: 14.5, inc: 171.1, node: 191.9, period: 972.8528, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2006_S_10", ru: "", a: 18979900.0, e: 0.151, peri: 70.5, m0: 173.5, inc: 161.6, node: 350.8, period: 976.3438, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_5", ru: "", a: 19090100.0, e: 0.216, peri: 232.6, m0: 59.4, inc: 158.8, node: 271.1, period: 984.8722, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_25", ru: "", a: 19136600.0, e: 0.281, peri: 150.4, m0: 186.2, inc: 166.4, node: 216.6, period: 988.5278, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_59", ru: "", a: 19170700.0, e: 0.262, peri: 347.3, m0: 282.6, inc: 167.3, node: 125.2, period: 991.1819, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2006_S_27", ru: "", a: 19205700.0, e: 0.14, peri: 95.3, m0: 6.1, inc: 170.5, node: 3.7, period: 993.7889, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "Gridr", ru: "", a: 19250600.0, e: 0.187, peri: 242.2, m0: 197.0, inc: 163.9, node: 330.8, period: 997.3319, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "Bergelmir", ru: "", a: 19268100.0, e: 0.145, peri: 341.8, m0: 255.7, inc: 158.8, node: 207.9, period: 998.6187, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "Jarnsaxa", ru: "", a: 19273500.0, e: 0.218, peri: 238.4, m0: 175.5, inc: 163.0, node: 9.2, period: 999.1271, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "Narvi", ru: "", a: 19285000.0, e: 0.441, peri: 356.9, m0: 111.5, inc: 142.2, node: 179.0, period: 999.9417, rad: 3.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_44", ru: "", a: 19292400.0, e: 0.434, peri: 346.2, m0: 232.9, inc: 167.4, node: 179.9, period: 1000.4722, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "Suttungr", ru: "", a: 19391900.0, e: 0.116, peri: 318.2, m0: 171.0, inc: 175.7, node: 253.2, period: 1008.2451, rad: 3.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_22", ru: "", a: 19443000.0, e: 0.059, peri: 309.8, m0: 128.8, inc: 161.3, node: 271.4, period: 1012.241, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_44", ru: "", a: 19515400.0, e: 0.129, peri: 215.9, m0: 292.8, inc: 167.7, node: 39.5, period: 1017.9146, rad: 2.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_60", ru: "", a: 19517000.0, e: 0.28, peri: 226.0, m0: 357.6, inc: 173.8, node: 321.7, period: 1018.1285, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2006_S_12", ru: "", a: 19570300.0, e: 0.542, peri: 233.2, m0: 249.6, inc: 38.6, node: 155.1, period: 1022.2868, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2007_S_3", ru: "", a: 19614400.0, e: 0.15, peri: 62.4, m0: 304.5, inc: 173.8, node: 99.3, period: 1025.6986, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_45", ru: "", a: 19693700.0, e: 0.551, peri: 296.6, m0: 75.7, inc: 154.0, node: 306.0, period: 1031.8604, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "Hati", ru: "", a: 19695000.0, e: 0.372, peri: 326.7, m0: 270.6, inc: 165.4, node: 316.3, period: 1032.0236, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_17", ru: "", a: 19699000.0, e: 0.162, peri: 197.0, m0: 227.6, inc: 167.9, node: 12.5, period: 1032.3694, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2006_S_11", ru: "", a: 19711900.0, e: 0.143, peri: 54.3, m0: 353.1, inc: 174.1, node: 254.4, period: 1033.3521, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_12", ru: "", a: 19801000.0, e: 0.337, peri: 34.1, m0: 10.9, inc: 164.7, node: 306.0, period: 1040.3896, rad: 2.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_23", ru: "", a: 19801500.0, e: 0.089, peri: 215.1, m0: 65.1, inc: 165.0, node: 153.6, period: 1040.3757, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_27", ru: "", a: 19820100.0, e: 0.652, peri: 63.6, m0: 91.2, inc: 151.1, node: 306.6, period: 1041.8521, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "Eggther", ru: "", a: 19844600.0, e: 0.157, peri: 214.6, m0: 111.7, inc: 165.0, node: 84.5, period: 1043.8035, rad: 6.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_28", ru: "", a: 19881000.0, e: 0.575, peri: 61.9, m0: 189.6, inc: 168.7, node: 59.6, period: 1046.5556, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_37", ru: "", a: 19889800.0, e: 0.215, peri: 304.6, m0: 244.7, inc: 172.3, node: 63.4, period: 1047.3903, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_26", ru: "", a: 19894300.0, e: 0.306, peri: 255.6, m0: 132.2, inc: 163.9, node: 147.4, period: 1047.7618, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_36", ru: "", a: 19903200.0, e: 0.161, peri: 271.5, m0: 145.8, inc: 166.9, node: 353.4, period: 1048.4188, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2006_S_13", ru: "", a: 19953300.0, e: 0.313, peri: 299.1, m0: 248.5, inc: 162.0, node: 44.4, period: 1052.316, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_37", ru: "", a: 19996900.0, e: 0.404, peri: 268.7, m0: 135.8, inc: 149.9, node: 273.4, period: 1055.7771, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_48", ru: "", a: 20029200.0, e: 0.022, peri: 86.9, m0: 315.6, inc: 169.7, node: 338.7, period: 1058.3493, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_29", ru: "", a: 20042400.0, e: 0.141, peri: 274.4, m0: 162.8, inc: 172.2, node: 227.4, period: 1059.4208, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_59", ru: "", a: 20064000.0, e: 0.467, peri: 348.4, m0: 66.5, inc: 169.5, node: 337.9, period: 1061.041, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2007_S_9", ru: "", a: 20174600.0, e: 0.36, peri: 34.7, m0: 240.3, inc: 159.3, node: 269.4, period: 1069.8069, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_7", ru: "", a: 20185100.0, e: 0.233, peri: 232.9, m0: 336.0, inc: 174.2, node: 226.6, period: 1070.8007, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_8", ru: "", a: 20287400.0, e: 0.311, peri: 313.2, m0: 31.8, inc: 172.8, node: 168.6, period: 1078.8604, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "Farbauti", ru: "", a: 20290700.0, e: 0.249, peri: 121.6, m0: 9.0, inc: 156.2, node: 138.0, period: 1079.1243, rad: 2.5, frame: "ecliptic" },
    { planet: "Saturn", n: "Thrymr", ru: "", a: 20330500.0, e: 0.467, peri: 339.5, m0: 216.2, inc: 175.0, node: 247.3, period: 1082.2292, rad: 3.5, frame: "ecliptic" },
    { planet: "Saturn", n: "Bestla", ru: "", a: 20337800.0, e: 0.486, peri: 8.6, m0: 33.1, inc: 138.3, node: 283.0, period: 1082.9444, rad: 3.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_9", ru: "", a: 20359700.0, e: 0.433, peri: 70.6, m0: 244.7, inc: 159.5, node: 114.2, period: 1084.6194, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_32", ru: "", a: 20454400.0, e: 0.037, peri: 285.5, m0: 30.0, inc: 169.8, node: 195.2, period: 1092.2417, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_46", ru: "", a: 20513800.0, e: 0.249, peri: 219.2, m0: 209.2, inc: 177.2, node: 281.1, period: 1096.9882, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_57", ru: "", a: 20536100.0, e: 0.245, peri: 269.8, m0: 318.0, inc: 168.0, node: 86.3, period: 1098.8285, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "Angrboda", ru: "", a: 20591500.0, e: 0.216, peri: 23.3, m0: 263.0, inc: 177.7, node: 279.1, period: 1103.1986, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_24", ru: "", a: 20618300.0, e: 0.23, peri: 157.0, m0: 301.4, inc: 159.6, node: 42.2, period: 1105.4083, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_11", ru: "", a: 20664200.0, e: 0.513, peri: 355.8, m0: 190.5, inc: 144.6, node: 327.6, period: 1109.1097, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "Aegir", ru: "", a: 20664400.0, e: 0.255, peri: 66.6, m0: 23.5, inc: 166.1, node: 181.9, period: 1109.1278, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_10", ru: "", a: 20700300.0, e: 0.248, peri: 267.6, m0: 149.5, inc: 163.9, node: 274.7, period: 1111.9924, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "Beli", ru: "", a: 20703700.0, e: 0.087, peri: 162.2, m0: 191.7, inc: 158.9, node: 258.7, period: 1112.2687, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_31", ru: "", a: 20729200.0, e: 0.182, peri: 142.0, m0: 308.7, inc: 163.0, node: 261.1, period: 1114.2889, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_25", ru: "", a: 20763700.0, e: 0.316, peri: 211.2, m0: 318.1, inc: 171.8, node: 242.2, period: 1117.0889, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_34", ru: "", a: 20803900.0, e: 0.57, peri: 218.5, m0: 293.6, inc: 168.4, node: 303.0, period: 1120.3833, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_39", ru: "", a: 20824500.0, e: 0.124, peri: 110.2, m0: 345.1, inc: 164.8, node: 118.3, period: 1121.9938, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_12", ru: "", a: 20895000.0, e: 0.476, peri: 204.9, m0: 221.1, inc: 167.1, node: 324.7, period: 1127.5993, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "Gerd", ru: "", a: 20947500.0, e: 0.517, peri: 207.6, m0: 49.5, inc: 174.4, node: 260.4, period: 1131.9062, rad: 4.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_13", ru: "", a: 20964500.0, e: 0.318, peri: 162.3, m0: 138.5, inc: 177.3, node: 302.5, period: 1133.2653, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_61", ru: "", a: 20986900.0, e: 0.466, peri: 216.8, m0: 175.6, inc: 168.4, node: 176.4, period: 1135.0646, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2006_S_14", ru: "", a: 21062300.0, e: 0.06, peri: 50.5, m0: 264.7, inc: 166.7, node: 274.4, period: 1141.2708, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_40", ru: "", a: 21065100.0, e: 0.342, peri: 246.1, m0: 3.6, inc: 169.6, node: 271.4, period: 1141.4813, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "Gunnlod", ru: "", a: 21141800.0, e: 0.251, peri: 318.0, m0: 311.4, inc: 160.4, node: 293.3, period: 1147.7354, rad: 4.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_15", ru: "", a: 21191100.0, e: 0.257, peri: 39.9, m0: 302.9, inc: 157.8, node: 22.0, period: 1151.6611, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_6", ru: "", a: 21253300.0, e: 0.48, peri: 34.9, m0: 271.2, inc: 166.9, node: 7.0, period: 1156.8111, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_26", ru: "", a: 21264400.0, e: 0.273, peri: 35.9, m0: 141.3, inc: 163.2, node: 252.9, period: 1157.766, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_41", ru: "", a: 21286400.0, e: 0.279, peri: 330.2, m0: 29.1, inc: 172.1, node: 7.2, period: 1159.516, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_7", ru: "", a: 21327600.0, e: 0.511, peri: 18.7, m0: 116.9, inc: 164.8, node: 323.8, period: 1162.9264, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2006_S_3", ru: "", a: 21353100.0, e: 0.432, peri: 44.9, m0: 125.3, inc: 156.1, node: 213.3, period: 1165.0194, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2005_S_5", ru: "", a: 21364900.0, e: 0.588, peri: 9.3, m0: 9.9, inc: 169.5, node: 84.7, period: 1165.9562, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_47", ru: "", a: 21397400.0, e: 0.564, peri: 357.0, m0: 283.9, inc: 146.1, node: 351.6, period: 1168.5778, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "Skrymir", ru: "", a: 21447400.0, e: 0.437, peri: 245.8, m0: 68.9, inc: 175.6, node: 177.7, period: 1172.7215, rad: 4.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_33", ru: "", a: 21621900.0, e: 0.665, peri: 107.9, m0: 49.1, inc: 155.8, node: 209.3, period: 1187.0667, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2006_S_16", ru: "", a: 21721200.0, e: 0.204, peri: 88.3, m0: 62.5, inc: 164.1, node: 165.4, period: 1195.1285, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_49", ru: "", a: 21766500.0, e: 0.026, peri: 304.5, m0: 82.5, inc: 171.7, node: 193.8, period: 1198.9896, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_30", ru: "", a: 21790700.0, e: 0.601, peri: 124.4, m0: 60.3, inc: 154.2, node: 132.1, period: 1201.0187, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2006_S_15", ru: "", a: 21799600.0, e: 0.117, peri: 237.0, m0: 313.6, inc: 161.1, node: 12.2, period: 1201.6924, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_27", ru: "", a: 21802300.0, e: 0.255, peri: 279.1, m0: 32.0, inc: 145.3, node: 324.5, period: 1202.016, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_42", ru: "", a: 21837000.0, e: 0.059, peri: 28.3, m0: 315.9, inc: 166.7, node: 355.1, period: 1204.8146, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_28", ru: "", a: 21865900.0, e: 0.159, peri: 320.7, m0: 95.8, inc: 167.9, node: 128.8, period: 1207.1833, rad: 4.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_32", ru: "", a: 21884100.0, e: 0.502, peri: 189.8, m0: 88.9, inc: 169.1, node: 351.6, period: 1208.8486, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2006_S_28", ru: "", a: 21955100.0, e: 0.21, peri: 35.0, m0: 98.4, inc: 172.9, node: 152.8, period: 1214.5257, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_8", ru: "", a: 21967200.0, e: 0.252, peri: 86.8, m0: 181.2, inc: 161.8, node: 41.8, period: 1215.6063, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_28", ru: "", a: 21993700.0, e: 0.474, peri: 287.6, m0: 2.2, inc: 160.1, node: 60.9, period: 1217.8104, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "Alvaldi", ru: "", a: 21993800.0, e: 0.238, peri: 149.9, m0: 38.3, inc: 177.4, node: 321.8, period: 1217.8042, rad: 6.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_38", ru: "", a: 21998400.0, e: 0.399, peri: 160.3, m0: 138.3, inc: 163.0, node: 216.6, period: 1218.2743, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "Kari", ru: "", a: 22032100.0, e: 0.469, peri: 88.5, m0: 83.1, inc: 153.0, node: 288.3, period: 1220.9757, rad: 3.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_48", ru: "", a: 22137400.0, e: 0.374, peri: 121.3, m0: 195.0, inc: 161.9, node: 194.7, period: 1229.8632, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_36", ru: "", a: 22230600.0, e: 0.359, peri: 122.1, m0: 312.2, inc: 166.3, node: 325.1, period: 1237.6104, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "Geirrod", ru: "", a: 22259400.0, e: 0.539, peri: 117.5, m0: 202.2, inc: 154.4, node: 127.9, period: 1240.0465, rad: 4.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_35", ru: "", a: 22269700.0, e: 0.151, peri: 146.4, m0: 92.9, inc: 168.5, node: 340.9, period: 1240.7618, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_29", ru: "", a: 22301400.0, e: 0.047, peri: 194.6, m0: 115.9, inc: 169.1, node: 255.9, period: 1243.4493, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "Fenrir", ru: "", a: 22330800.0, e: 0.137, peri: 349.1, m0: 38.6, inc: 164.5, node: 234.6, period: 1245.9215, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_50", ru: "", a: 22345000.0, e: 0.45, peri: 13.7, m0: 71.5, inc: 164.0, node: 175.9, period: 1247.1917, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2006_S_17", ru: "", a: 22384200.0, e: 0.425, peri: 63.5, m0: 206.6, inc: 168.7, node: 274.1, period: 1250.4639, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_49", ru: "", a: 22399400.0, e: 0.453, peri: 60.2, m0: 19.2, inc: 159.8, node: 221.2, period: 1251.6847, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_34", ru: "", a: 22435600.0, e: 0.154, peri: 170.5, m0: 116.4, inc: 160.6, node: 7.7, period: 1254.6069, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_31", ru: "", a: 22457300.0, e: 0.238, peri: 344.3, m0: 0.1, inc: 163.8, node: 148.1, period: 1256.5035, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_52", ru: "", a: 22528000.0, e: 0.124, peri: 131.5, m0: 267.3, inc: 146.2, node: 42.8, period: 1262.3438, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_43", ru: "", a: 22563900.0, e: 0.264, peri: 105.3, m0: 92.7, inc: 170.3, node: 247.3, period: 1265.5667, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_17", ru: "", a: 22722700.0, e: 0.546, peri: 82.3, m0: 40.5, inc: 155.5, node: 125.3, period: 1278.9618, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "Surtur", ru: "", a: 22748000.0, e: 0.448, peri: 209.7, m0: 9.9, inc: 168.4, node: 255.3, period: 1281.1396, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2006_S_18", ru: "", a: 22760600.0, e: 0.131, peri: 110.1, m0: 14.5, inc: 169.5, node: 47.6, period: 1282.0917, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_36", ru: "", a: 22806200.0, e: 0.336, peri: 166.6, m0: 216.1, inc: 168.8, node: 26.9, period: 1286.0292, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "Loge", ru: "", a: 22919200.0, e: 0.191, peri: 353.5, m0: 32.1, inc: 168.1, node: 333.0, period: 1295.5243, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_33", ru: "", a: 22922500.0, e: 0.555, peri: 166.0, m0: 165.2, inc: 162.8, node: 161.7, period: 1295.85, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "Ymir", ru: "", a: 22955600.0, e: 0.338, peri: 249.8, m0: 167.5, inc: 172.3, node: 204.5, period: 1298.6819, rad: 11.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_35", ru: "", a: 23030300.0, e: 0.225, peri: 4.5, m0: 98.0, inc: 174.9, node: 344.7, period: 1304.9653, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_19", ru: "", a: 23044400.0, e: 0.458, peri: 194.1, m0: 335.8, inc: 151.8, node: 248.3, period: 1306.1604, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_18", ru: "", a: 23139500.0, e: 0.509, peri: 175.1, m0: 340.4, inc: 154.6, node: 230.6, period: 1314.2674, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_21", ru: "", a: 23160900.0, e: 0.394, peri: 287.2, m0: 198.7, inc: 153.2, node: 112.3, period: 1316.1167, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_39", ru: "", a: 23192400.0, e: 0.1, peri: 32.2, m0: 83.8, inc: 165.9, node: 168.9, period: 1318.7417, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_16", ru: "", a: 23265200.0, e: 0.25, peri: 127.3, m0: 351.8, inc: 162.0, node: 206.7, period: 1324.9458, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_53", ru: "", a: 23279800.0, e: 0.24, peri: 140.0, m0: 37.3, inc: 162.6, node: 215.7, period: 1326.184, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_24", ru: "", a: 23338200.0, e: 0.071, peri: 332.4, m0: 122.1, inc: 37.4, node: 354.0, period: 1331.3222, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_36", ru: "", a: 23390800.0, e: 0.625, peri: 66.1, m0: 132.0, inc: 153.3, node: 212.7, period: 1335.8042, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_51", ru: "", a: 23431500.0, e: 0.191, peri: 156.9, m0: 310.9, inc: 163.3, node: 213.5, period: 1339.2104, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_45", ru: "", a: 23438400.0, e: 0.633, peri: 76.3, m0: 336.8, inc: 157.4, node: 102.2, period: 1339.8472, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_45", ru: "", a: 23507700.0, e: 0.199, peri: 18.8, m0: 190.2, inc: 172.8, node: 183.1, period: 1345.7917, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "Thiazzi", ru: "", a: 23577500.0, e: 0.511, peri: 16.3, m0: 334.7, inc: 158.8, node: 73.1, period: 1351.8319, rad: 4.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_38", ru: "", a: 23583900.0, e: 0.513, peri: 170.3, m0: 99.4, inc: 159.7, node: 284.0, period: 1352.4347, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_20", ru: "", a: 23677900.0, e: 0.354, peri: 15.2, m0: 281.1, inc: 156.0, node: 176.6, period: 1360.4674, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_37", ru: "", a: 23751800.0, e: 0.344, peri: 236.8, m0: 182.3, inc: 174.8, node: 25.1, period: 1366.8215, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_39", ru: "", a: 23784500.0, e: 0.098, peri: 240.1, m0: 92.5, inc: 174.5, node: 273.1, period: 1369.6437, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_40", ru: "", a: 23785900.0, e: 0.412, peri: 349.9, m0: 64.0, inc: 167.3, node: 250.5, period: 1369.7562, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2006_S_19", ru: "", a: 23800500.0, e: 0.467, peri: 300.3, m0: 195.9, inc: 175.5, node: 281.1, period: 1371.0201, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_40", ru: "", a: 24087800.0, e: 0.088, peri: 286.8, m0: 347.6, inc: 161.8, node: 44.4, period: 1395.8771, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_42", ru: "", a: 24111600.0, e: 0.121, peri: 42.7, m0: 351.4, inc: 163.2, node: 318.2, period: 1397.975, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_34", ru: "", a: 24145800.0, e: 0.279, peri: 287.1, m0: 160.0, inc: 168.3, node: 292.6, period: 1400.9299, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_39", ru: "", a: 24262400.0, e: 0.305, peri: 347.7, m0: 165.2, inc: 160.1, node: 318.8, period: 1411.1451, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_41", ru: "", a: 24493600.0, e: 0.257, peri: 51.4, m0: 320.7, inc: 157.1, node: 11.4, period: 1431.2979, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_46", ru: "", a: 24708900.0, e: 0.336, peri: 47.2, m0: 230.0, inc: 143.2, node: 306.8, period: 1450.2715, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "Fornjot", ru: "", a: 24936800.0, e: 0.213, peri: 231.2, m0: 53.5, inc: 170.0, node: 269.3, period: 1470.3618, rad: 3.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_47", ru: "", a: 25102300.0, e: 0.101, peri: 105.7, m0: 97.5, inc: 162.5, node: 208.4, period: 1485.0417, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_51", ru: "", a: 25207100.0, e: 0.201, peri: 7.1, m0: 85.1, inc: 171.2, node: 293.7, period: 1494.4076, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2006_S_29", ru: "", a: 25212100.0, e: 0.239, peri: 23.8, m0: 101.5, inc: 156.2, node: 82.4, period: 1494.7833, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_10", ru: "", a: 25315300.0, e: 0.296, peri: 97.1, m0: 158.8, inc: 165.6, node: 243.6, period: 1503.9681, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_42", ru: "", a: 25329400.0, e: 0.506, peri: 74.5, m0: 278.4, inc: 157.5, node: 15.4, period: 1505.3118, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_9", ru: "", a: 25408700.0, e: 0.531, peri: 186.0, m0: 46.4, inc: 161.4, node: 15.0, period: 1512.384, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2023_S_5", ru: "", a: 25583500.0, e: 0.599, peri: 329.9, m0: 334.2, inc: 168.8, node: 235.0, period: 1528.0368, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_41", ru: "", a: 25876400.0, e: 0.402, peri: 253.2, m0: 63.1, inc: 160.2, node: 28.3, period: 1554.3993, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_26", ru: "", a: 26097500.0, e: 0.147, peri: 117.2, m0: 193.6, inc: 172.9, node: 328.8, period: 1574.2535, rad: 4.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_21", ru: "", a: 26439500.0, e: 0.155, peri: 359.5, m0: 346.4, inc: 171.9, node: 342.8, period: 1605.2799, rad: 2.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2004_S_52", ru: "", a: 26446400.0, e: 0.291, peri: 137.3, m0: 333.0, inc: 165.4, node: 204.7, period: 1605.8868, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_43", ru: "", a: 26657400.0, e: 0.203, peri: 325.7, m0: 252.6, inc: 164.6, node: 68.7, period: 1625.2931, rad: 1.0, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_43", ru: "", a: 26664100.0, e: 0.277, peri: 224.2, m0: 306.2, inc: 165.3, node: 116.0, period: 1625.9, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2019_S_44", ru: "", a: 26796900.0, e: 0.512, peri: 195.7, m0: 330.6, inc: 172.6, node: 223.0, period: 1638.1104, rad: 1.5, frame: "ecliptic" },
    { planet: "Saturn", n: "S2020_S_44", ru: "", a: 27259400.0, e: 0.199, peri: 311.8, m0: 318.0, inc: 168.5, node: 28.0, period: 1680.641, rad: 1.0, frame: "ecliptic" },
    { planet: "Uranus", n: "Cordelia", ru: "Корделия", a: 49755.0, e: 0.0, peri: 1.1, m0: 287.4, inc: 97.97, node: 1.1, period: 0.3347, rad: 20.1, frame: "laplace" },
    { planet: "Uranus", n: "Ophelia", ru: "Офелия", a: 53765.0, e: 0.011, peri: 170.9, m0: 213.4, inc: 97.97, node: 151.6, period: 0.3764, rad: 21.4, frame: "laplace" },
    { planet: "Uranus", n: "S2025_U_1", ru: "", a: 57844.0, e: 0.039, peri: 24.7, m0: 275.6, inc: 101.77, node: 70.8, period: 0.4201, rad: 4.0, frame: "laplace" },
    { planet: "Uranus", n: "Bianca", ru: "Бианка", a: 59170.0, e: 0.006, peri: 240.5, m0: 109.1, inc: 100.07, node: 272.5, period: 0.4347, rad: 25.7, frame: "laplace" },
    { planet: "Uranus", n: "Cressida", ru: "Крессида", a: 61770.0, e: 0.004, peri: 36.1, m0: 0.5, inc: 99.57, node: 308.2, period: 0.4639, rad: 39.8, frame: "laplace" },
    { planet: "Uranus", n: "Desdemona", ru: "Дездемона", a: 62663.0, e: 0.007, peri: 60.9, m0: 230.0, inc: 100.87, node: 283.9, period: 0.4736, rad: 32.0, frame: "laplace" },
    { planet: "Uranus", n: "Juliet", ru: "Джульетта", a: 64362.0, e: 0.006, peri: 55.9, m0: 319.8, inc: 100.77, node: 141.0, period: 0.4931, rad: 46.8, frame: "laplace" },
    { planet: "Uranus", n: "Portia", ru: "Порция", a: 66101.0, e: 0.004, peri: 178.3, m0: 310.1, inc: 100.47, node: 146.7, period: 0.5132, rad: 67.6, frame: "laplace" },
    { planet: "Uranus", n: "Rosalind", ru: "Розалинда", a: 69930.0, e: 0.003, peri: 201.8, m0: 287.7, inc: 99.47, node: 330.0, period: 0.5583, rad: 36.0, frame: "laplace" },
    { planet: "Uranus", n: "Cupid", ru: "Купидон", a: 74396.0, e: 0.007, peri: 199.1, m0: 3.3, inc: 99.77, node: 31.1, period: 0.6125, rad: 9.0, frame: "laplace" },
    { planet: "Uranus", n: "Belinda", ru: "Белинда", a: 75258.0, e: 0.002, peri: 154.8, m0: 226.4, inc: 99.17, node: 96.2, period: 0.6236, rad: 40.3, frame: "laplace" },
    { planet: "Uranus", n: "Perdita", ru: "Пердита", a: 76418.0, e: 0.005, peri: 207.3, m0: 168.0, inc: 99.37, node: 270.4, period: 0.6382, rad: 15.0, frame: "laplace" },
    { planet: "Uranus", n: "Puck", ru: "Пак", a: 86004.0, e: 0.0, peri: 216.1, m0: 50.1, inc: 98.07, node: 216.1, period: 0.761833, rad: 81.0, frame: "equatorial" },
    { planet: "Uranus", n: "Puck", ru: "Пак", a: 86007.0, e: 0.009, peri: 88.2, m0: 264.1, inc: 98.87, node: 111.2, period: 0.7618, rad: 81.0, frame: "laplace" },
    { planet: "Uranus", n: "Mab", ru: "Маб", a: 97737.0, e: 0.006, peri: 266.4, m0: 250.8, inc: 99.57, node: 307.8, period: 0.9229, rad: 12.0, frame: "laplace" },
    { planet: "Uranus", n: "Miranda", ru: "Миранда", a: 129846.0, e: 0.001, peri: 255.7, m0: 73.0, inc: 102.17, node: 100.9, period: 1.413479, rad: 235.8, frame: "equatorial" },
    { planet: "Uranus", n: "Ariel", ru: "Ариэль", a: 190929.0, e: 0.001, peri: 9.6, m0: 193.5, inc: 97.77, node: 0.0, period: 2.520379, rad: 578.9, frame: "equatorial" },
    { planet: "Uranus", n: "Umbriel", ru: "Умбриэль", a: 265986.0, e: 0.004, peri: 358.2, m0: 253.0, inc: 97.87, node: 174.8, period: 4.144177, rad: 584.7, frame: "equatorial" },
    { planet: "Uranus", n: "Titania", ru: "Титания", a: 436298.0, e: 0.002, peri: 213.5, m0: 68.1, inc: 97.87, node: 29.5, period: 8.705869, rad: 788.9, frame: "equatorial" },
    { planet: "Uranus", n: "Oberon", ru: "Оберон", a: 583511.0, e: 0.002, peri: 209.0, m0: 143.6, inc: 97.87, node: 76.8, period: 13.463237, rad: 761.4, frame: "equatorial" },
    { planet: "Uranus", n: "Francisco", ru: "Франциско", a: 4275700.0, e: 0.144, peri: 239.5, m0: 288.4, inc: 146.8, node: 101.9, period: 267.0, rad: 11.0, frame: "ecliptic" },
    { planet: "Uranus", n: "Caliban", ru: "Калибан", a: 7167000.0, e: 0.2, peri: 164.6, m0: 241.2, inc: 141.4, node: 174.9, period: 580.0, rad: 36.4, frame: "ecliptic" },
    { planet: "Uranus", n: "Stephano", ru: "Стефано", a: 7951400.0, e: 0.235, peri: 210.4, m0: 164.4, inc: 143.6, node: 193.3, period: 677.0, rad: 16.0, frame: "ecliptic" },
    { planet: "Uranus", n: "S2023_U1", ru: "", a: 7976600.0, e: 0.25, peri: 58.9, m0: 101.8, inc: 143.9, node: 260.2, period: 681.0, rad: 4.0, frame: "ecliptic" },
    { planet: "Uranus", n: "Trinculo", ru: "Тринкуло", a: 8502600.0, e: 0.22, peri: 358.7, m0: 55.6, inc: 167.1, node: 196.5, period: 749.0, rad: 9.5, frame: "ecliptic" },
    { planet: "Uranus", n: "Sycorax", ru: "Скоракса", a: 12193200.0, e: 0.52, peri: 292.5, m0: 332.1, inc: 157.0, node: 267.1, period: 1286.0, rad: 93.0, frame: "ecliptic" },
    { planet: "Uranus", n: "Margaret", ru: "Маргарита", a: 14425000.0, e: 0.642, peri: 91.6, m0: 115.9, inc: 60.5, node: 0.9, period: 1655.0, rad: 10.0, frame: "ecliptic" },
    { planet: "Uranus", n: "Prospero", ru: "Просперо", a: 16221000.0, e: 0.441, peri: 144.9, m0: 197.6, inc: 149.4, node: 324.5, period: 1974.0, rad: 25.0, frame: "ecliptic" },
    { planet: "Uranus", n: "Setebos", ru: "Сетебос", a: 17519800.0, e: 0.579, peri: 240.8, m0: 148.0, inc: 153.9, node: 244.7, period: 2215.0, rad: 24.0, frame: "ecliptic" },
    { planet: "Uranus", n: "Ferdinand", ru: "Фердинанд", a: 20421400.0, e: 0.395, peri: 30.8, m0: 172.3, inc: 169.2, node: 223.9, period: 2788.0, rad: 10.0, frame: "ecliptic" },
    { planet: "Neptune", n: "Naiad", ru: "Наяда", a: 48300.0, e: 0.001, peri: 183.2, m0: 6.1, inc: 33.02, node: 38.7, period: 0.2951, rad: 29.0, frame: "equatorial" },
    { planet: "Neptune", n: "Thalassa", ru: "Таласья", a: 50100.0, e: 0.001, peri: 348.3, m0: 3.0, inc: 28.52, node: 124.7, period: 0.3118, rad: 40.0, frame: "equatorial" },
    { planet: "Neptune", n: "Despina", ru: "Деспина", a: 52600.0, e: 0.001, peri: 182.1, m0: 354.1, inc: 28.32, node: 0.0, period: 0.3347, rad: 74.0, frame: "equatorial" },
    { planet: "Neptune", n: "Galatea", ru: "Галатея", a: 62000.0, e: 0.001, peri: 113.9, m0: 12.0, inc: 28.32, node: 0.0, period: 0.4292, rad: 79.0, frame: "equatorial" },
    { planet: "Neptune", n: "Larissa", ru: "Ларисса", a: 73600.0, e: 0.001, peri: 179.4, m0: 215.1, inc: 28.52, node: 317.4, period: 0.5549, rad: 96.0, frame: "equatorial" },
    { planet: "Neptune", n: "Hippocamp", ru: "Гиппокамп", a: 105300.0, e: 0.001, peri: 327.3, m0: 322.3, inc: 28.62, node: 4.0, period: 0.9507, rad: 17.4, frame: "equatorial" },
    { planet: "Neptune", n: "Proteus", ru: "Протей", a: 117700.0, e: 0.001, peri: 352.7, m0: 297.4, inc: 28.92, node: 355.5, period: 1.1229, rad: 208.0, frame: "equatorial" },
    { planet: "Neptune", n: "Triton", ru: "Тритон", a: 354800.0, e: 0.0, peri: 177.7, m0: 63.0, inc: 128.98, node: 177.7, period: 5.8792, rad: 1352.6, frame: "equatorial" },
    { planet: "Neptune", n: "Nereid", ru: "Нереида", a: 5513900.0, e: 0.751, peri: 256.3, m0: 318.5, inc: 5.1, node: 319.5, period: 360.133039, rad: 170.0, frame: "ecliptic" },
    { planet: "Neptune", n: "Halimede", ru: "Галимеда", a: 16590500.0, e: 0.521, peri: 356.4, m0: 135.8, inc: 119.6, node: 198.5, period: 1879.0, rad: 31.0, frame: "ecliptic" },
    { planet: "Neptune", n: "Sao", ru: "Сао", a: 22239900.0, e: 0.296, peri: 135.3, m0: 178.5, inc: 50.2, node: 41.8, period: 2919.0, rad: 22.0, frame: "ecliptic" },
    { planet: "Neptune", n: "S2002_N5", ru: "", a: 23414700.0, e: 0.433, peri: 317.4, m0: 303.2, inc: 46.3, node: 258.3, period: 3151.0, rad: 19.0, frame: "ecliptic" },
    { planet: "Neptune", n: "Laomedeia", ru: "Лаомедея", a: 23499900.0, e: 0.419, peri: 203.8, m0: 248.1, inc: 36.9, node: 57.6, period: 3168.0, rad: 21.0, frame: "ecliptic" },
    { planet: "Neptune", n: "Psamathe", ru: "Псамафа", a: 47646600.0, e: 0.413, peri: 91.1, m0: 183.2, inc: 127.8, node: 302.9, period: 9149.0, rad: 20.0, frame: "ecliptic" },
    { planet: "Neptune", n: "Neso", ru: "Несо", a: 49897800.0, e: 0.455, peri: 145.2, m0: 13.8, inc: 128.4, node: 55.4, period: 9805.0, rad: 30.0, frame: "ecliptic" },
    { planet: "Neptune", n: "S2021_N1", ru: "", a: 50700200.0, e: 0.503, peri: 349.3, m0: 237.1, inc: 135.2, node: 258.9, period: 10043.0, rad: 12.5, frame: "ecliptic" },
];

// ===== data.js =====
// =============================================================================
// data.js — астрономические данные: планеты, луны, малые тела.
// Только данные, никакой логики. Периоды сидерические (сутки), долготы L0
// средние на эпоху J2000 (градусы). Все радиусы и расстояния — в мировых
// единицах (wu) по единому масштабу units.js: 1 а.е. = 1000 wu.
//
// Планеты: r = km(радиус), dist = au(большая полуось). l0 пересчитаны на
// J2000 так, чтобы на эпоху 2026-10-23 эклиптические долготы были
// симметричны: 0°, 45°, 90°, … 315° (см. plans/space-real-scale.md).
// e, peri, inc, node — реальные элементы; положение считается уравнением
// Кеплера (math.js keplerPos3).
//
// Луны: полный каталог moons_data.js (456 спутников шести планет), собранный
// из JPL SSD и Wikipedia. r = km(rad), a — километры, moonOrbitRadius
// переводит их в wu без сжатия.
// =============================================================================




// Планеты. radiusKm/aAu оставлены для карточек и JSON: r и dist — уже
// пересчитанные мировые единицы.
const planets = [
    { name: 'Mercury', ru: 'Меркурий', color: '#b5b5b5', r: km(2439.7),  dist: au(0.387098), radiusKm: 2439.7,  aAu: 0.387098, period: 87.969,   l0: 271.670338, e: 0.205636, peri: 77.458,  inc: 7.005,  node: 48.331,  type: 'rocky' },
    { name: 'Venus',   ru: 'Венера',   color: '#e8cda0', r: km(6051.8),  dist: au(0.723332), radiusKm: 6051.8,  aAu: 0.723332, period: 224.701,  l0: 198.483416, e: 0.006777, peri: 131.602, inc: 3.395,  node: 76.680,  type: 'rocky' },
    { name: 'Earth',   ru: 'Земля',    color: '#4488ff', r: km(6371.0),  dist: au(1.000000), radiusKm: 6371.0,  aAu: 1.000000, period: 365.256,  l0: 159.822344, e: 0.016711, peri: 102.938, inc: 0.000,  node: 0.000,   type: 'earth' },
    { name: 'Mars',    ru: 'Марс',     color: '#c1440e', r: km(3389.5),  dist: au(1.523679), radiusKm: 3389.5,  aAu: 1.523679, period: 686.980,  l0: 39.827744,  e: 0.093394, peri: 336.041, inc: 1.850,  node: 49.579,  type: 'rocky' },
    { name: 'Jupiter', ru: 'Юпитер',   color: '#c88b3a', r: km(69911),   dist: au(5.20260),  radiusKm: 69911,   aAu: 5.20260,  period: 4332.589, l0: 84.954805,  e: 0.048386, peri: 14.728,  inc: 1.304,  node: 100.464, type: 'gas' },
    { name: 'Saturn',  ru: 'Сатурн',   color: '#e8d191', r: km(58232),   dist: au(9.55491),  radiusKm: 58232,   aAu: 9.55491,  period: 10759.22, l0: 252.676195, e: 0.053862, peri: 92.599,  inc: 2.488,  node: 113.665, type: 'gas', rings: true },
    { name: 'Uranus',  ru: 'Уран',     color: '#7de8e8', r: km(25362),   dist: au(19.21845), radiusKm: 25362,   aAu: 19.21845, period: 30685.4,  l0: 149.751982, e: 0.047257, peri: 170.954, inc: 0.773,  node: 74.006,  type: 'ice' },
    { name: 'Neptune', ru: 'Нептун',   color: '#3f54ba', r: km(24622),   dist: au(30.11039), radiusKm: 24622,   aAu: 30.11039, period: 60189.0,  l0: 257.421335, e: 0.008590, peri: 44.965,  inc: 1.770,  node: 131.784, type: 'ice' }
];

/** Средняя аномалия планеты на J2000: L0 − долгота перигелия. */
function planetM0(p) {
    return p.l0 - p.peri;
}

// Луна Земли: значения остаются экспортами для баз и старых карточек, но
// рисуется она из общего каталога — отдельного блока в render.js больше нет.
const moonDist = km(384400);        // большая полуось Луны, wu
const moonPeriod = 27.321661;       // сидерический период, сутки

// Базы игрока: период задаётся в bases.js относительно 3R хозяина (один виток
// в сутки на стартовой орбите). Здесь остаётся только опорное значение.
const basePeriod = 1;

// Цвета известных лун: остальные получают нейтральный оттенок из палитры.
const MOON_COLORS = {
    Moon: '#c9cfd8',
    Phobos: '#9c8f84', Deimos: '#b3a89e',
    Io: '#d8c26a', Europa: '#cbb8a0', Ganymede: '#9a8f85', Callisto: '#7d746c',
    Amalthea: '#b06a4a', Himalia: '#8a8078', Elara: '#9a948c',
    Mimas: '#b8bcc2', Enceladus: '#d9dee3', Tethys: '#ccd1d6', Dione: '#c2c7cd',
    Rhea: '#a8adb5', Titan: '#c79b5a', Hyperion: '#a99a82', Iapetus: '#8f8478',
    Phoebe: '#7d7568', Janus: '#b9b4a9', Epimetheus: '#b0aba1',
    Miranda: '#a9b3b8', Ariel: '#b6c0c4', Umbriel: '#7e888d', Titania: '#9aa5ab',
    Oberon: '#8b969c', Puck: '#9c9a94',
    Proteus: '#8f9aa3', Triton: '#c3cdd4', Nereid: '#9aa2ab'
};
const MOON_PALETTE = ['#a8adb5', '#9c8f84', '#8a8078', '#b3a89e', '#8f9aa3', '#a99f93'];

// moonsByPlanet — та же структура, что была у ручного списка, но собрана из
// каталога: n, ru, period, a (км), r (wu), c, e, peri, m0, inc, node, rad (км).
const moonsByPlanet = {};
planets.forEach(p => { moonsByPlanet[p.name] = []; });
moonCatalog.forEach((m, i) => {
    const list = moonsByPlanet[m.planet];
    if (!list) return;
    list.push({
        n: m.n,
        ru: m.ru || '',
        period: m.period,
        a: m.a,
        r: km(m.rad),
        rad: m.rad,
        c: MOON_COLORS[m.n] || MOON_PALETTE[i % MOON_PALETTE.length],
        e: m.e,
        peri: m.peri,
        m0: m.m0,
        inc: m.inc,
        node: m.node,
        frame: m.frame
    });
});

/** Радиус орбиты i-й луны планеты в мировых единицах: без сжатия, km(a). */
function moonOrbitRadius(p, i) {
    const list = moonsByPlanet[p.name] || [];
    const m = list[i];
    return m ? km(m.a) : p.r * 2;
}

/** Группы лун для дерева: крупные (rad ≥ 100 км) первыми, затем остальные. */
const moonTree = {};
planets.forEach(p => {
    const list = (moonsByPlanet[p.name] || []).slice().sort((a, b) => {
        const major = (b.rad >= 100) - (a.rad >= 100);
        return major || (a.a - b.a);
    });
    moonTree[p.name] = list.map(m => ({
        n: m.n,
        ru: m.ru,
        label: m.ru ? m.ru + ' / ' + m.n : m.n,
        period: m.period,
        rad: m.rad,
        major: m.rad >= 100
    }));
});

// Известное общее число лун у каждой планеты (JPL, октябрь 2026).
const moonTotals = {
    Mercury: 0, Venus: 0, Earth: 1, Mars: 2,
    Jupiter: 115, Saturn: 292, Uranus: 30, Neptune: 16
};

/* ---------- Малые тела (карта: smallbodies.js) ---------- */

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
// dAng — смещение от центра облака (град.), dR — от радиуса орбиты Юпитера
// (wu). dia — реальный диаметр (км), нужен для LOD и карточки.
const trojanNames = [
    { n: 'Achilles',  ru: 'Ахиллес',   camp: 4, dAng: -3.2, dR: 6, dia: 135 },
    { n: 'Agamemnon', ru: 'Агамемнон', camp: 4, dAng: 4.1,  dR: -5, dia: 167 },
    { n: 'Hektor',    ru: 'Гектор',    camp: 5, dAng: -2.4, dR: 4, dia: 225 },
    { n: 'Patroclus', ru: 'Патрокл',   camp: 5, dAng: 3.6,  dR: -7, dia: 140 }
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
    zoom: 0.28,     // стартовый вид — орбита Марса; точное значение ставит main.js

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
    selected: null,     // выбранный объект: {kind:'sun'|'planet'|'moon'|'group'|..., p, m, group}
    // Позиции тел текущего кадра для карточек и дерева (заполняет render.js):
    // планета -> {x, y, floorY, rawX, rawY}, 'планета:луна' -> {x, y, floorY}.
    planetPositions: new Map(),
    moonPositions: new Map(),

    // --- Звёздные базы ------------------------------------------------------------
    // Режим выбора орбиты: {kind:'planet'|'moon', planet, moon, snap, moveId?};
    // snap — снимок соседей на старте режима, moveId — переносимая база.
    baseMode: null,
    baseRadius: 0.1,    // текущий радиус выбираемой орбиты, единицы мира

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
        x - r * 0.33, y - r * 0.33, Math.max(r * 0.06, 1e-9),
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
// scene.js — правила показа тел при масштабе и раскладка подписей.
//
// Группировка: тело входит в группу более массивного соседа, если их центры
// ближе GROUP_PX экранных пикселей. Правило одно для всей карты:
//   • Солнце собирает планеты (на видах Койпера/Оорта — принудительно);
//   • планета собирает свои луны;
//   • крупное малое тело собирает мелкие малые тела.
// Якоря-исключения не нужны: представителем группы всегда становится более
// массивное тело, поэтому подпись и выбор остаются у главного объекта.
//
// Подписи раскладываются без наложений (placeLabel). Позиции тел здесь не
// считаются — это делает render.js каждый кадр из simDays.
// =============================================================================



/** Порог группировки — в ЭКРАННЫХ пикселях (маркеры ближе уже не подписать). */
const GROUP_PX = 28;

/**
 * Сгруппировать тела кадра по экранному расстоянию.
 * @param {Array} bodies тела с x, y, kind, p, mass; отсортированы по массе
 *                (сначала Солнце, затем планеты, луны, малые тела)
 * @param {number} zoom
 * @returns {Array} группы { rep, members } (members[0] === rep)
 */
function groupBodies(bodies, zoom) {
    const lim = GROUP_PX / zoom;
    const lim2 = lim * lim;
    const groups = [];
    const forceSolar = zoom < 0.01;

    bodies.forEach(b => {
        // На дальних видах планетная система — одна группа «Солнечная система».
        if (forceSolar && b.kind === 'planet') {
            const sun = groups.find(g => g.rep.kind === 'sun');
            if (sun) { sun.members.push(b); return; }
        }

        let host = null, best = Infinity;
        for (const g of groups) {
            if (!canJoin(g.rep, b)) continue;
            const dx = b.x - g.rep.x, dy = b.y - g.rep.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < best) { best = d2; host = g; }
        }
        if (host && best <= lim2) {
            host.members.push(b);
            return;
        }
        groups.push({ rep: b, members: [b] });
    });

    return groups;
}

/** Может ли тело b войти в группу представителя rep. */
function canJoin(rep, b) {
    if (rep === b) return false;
    if (rep.kind === 'sun') return b.kind === 'planet';
    if (rep.kind === 'planet') return b.kind === 'moon' && b.p === rep.p;
    if (rep.kind === 'small') return b.kind === 'small';
    return false;
}

// --- Раскладка подписей: без наложений ----------------------------------------

// Коробки уже поставленных подписей кадра (мировые единицы). Подпись перед
// отрисовкой спрашивает место: если её коробка пересекается с чужой, подпись
// сдвигается по вертикали шагами в строку — так подписи не наезжают друг на
// друга. Порядок постановки = порядок отрисовки: сначала подписи групп тел,
// затем подписи баз.
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
// Единый реальный масштаб (units.js): 1 а.е. = 1000 wu. Пояс — 2200–3500 wu,
// Койпер — 30 000–50 000 wu, Оорт — 2e6…1e8 wu. Радиусы тел — настоящие
// (km(dia / 2)), поэтому у мелких тел на карте работает тот же LOD, что у
// планет: сфера при rPx ≥ TRUE_MIN_PX, иначе полое кольцо-маркер.
//
// Карта — диметрия 2:1 (iso.js): все позиции здесь уже в view-координатах
// (y сжат вдвое). Орбитальные элементы — реальные; движение считается из
// общего simDays через Кеплер. Кометы дополнительно поднимаются над полом
// по наклонению inc/node — стилизованная 3D-орбита, как на референсах.
//
// Именованные тела (крупнейшие тела пояса, именованные ОЗА, троянцы L4/L5,
// кометы) группируются общим правилом scene.js groupBodies: smallBodyList()
// отдаёт их позиции в кадр, а render.js рисует только представителей через
// drawSmallBody. Пыль и частицы пояса остаются в слое пола
// (drawSmallBodiesFloor).
// =============================================================================









// --- Главный пояс: закон Кеплера от якорей Марс → Юпитер ---------------------
const MARS = planets.find(p => p.name === 'Mars');
const JUPITER = planets.find(p => p.name === 'Jupiter');
const KEPLER_EXP = Math.log(JUPITER.period / MARS.period) / Math.log(JUPITER.dist / MARS.dist);

/** Период обращения астероида на расстоянии d (wu), сутки. */
function beltPeriod(d) {
    return MARS.period * Math.pow(d / MARS.dist, KEPLER_EXP);
}

/** Фактическая эклиптическая долгота Юпитера (рад) — от неё строятся троянцы. */
function jupiterLongitude(t) {
    const pos = keplerPos3(JUPITER.dist, JUPITER.e, JUPITER.peri, planetM0(JUPITER),
        JUPITER.period, t, v => v, JUPITER.inc, JUPITER.node);
    return Math.atan2(-pos.y, pos.x);
}

// --- Главный пояс: частицы ----------------------------------------------------
const BELT_MIN = auToDist(2.2);          // 2200 wu
const BELT_MAX = auToDist(3.5);          // 3500 wu
const BELT_COUNT = 400;
const BELT_SEED = 20261018;
const BELT_MID = (BELT_MIN + BELT_MAX) / 2;

// Щели Кирквуда — резонансы с Юпитером 2.50 / 2.82 / 2.95 / 3.27 а.е.:
// [радиус (а.е.), глубина провала, ширина (а.е.)]. Плотность частиц падает.
const BELT_GAPS = [
    [2.50, 0.85, 0.04],
    [2.82, 0.80, 0.035],
    [2.95, 0.80, 0.035],
    [3.27, 0.70, 0.04]
].map(([au, depth, w]) => ({ r: auToDist(au), depth, w: auToDist(w) }));

/** Плотность пояса в точке d — произведение провалов около резонансов. */
function beltDensity(d) {
    let p = 1;
    for (const g of BELT_GAPS) p *= 1 - g.depth * Math.exp(-Math.pow((d - g.r) / g.w, 2));
    return p;
}

// Частицы пояса. Генерация детерминированная и происходит при каждом запуске:
// пояс есть всегда, элементы адресуемы по id (задел под добычу/уничтожение).
// s — размер частицы в ЭКРАННЫХ пикселях (делится на zoom при отрисовке).
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
        s: 0.5 + beltRng() * 1.3                               // размер, пиксели экрана
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
 * Точки орбиты для hover/выбора: сэмплируем положения по тем же элементам,
 * что и движение, и сразу переводим в view.
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
// Церера (карликовая планета), Веста, Паллада, Гигея — реальные радиусы
// km(dia / 2). На MAX_ZOOM Церера — диск ~31 px, Веста и Паллада ~17 px.
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
        r: km(b.dia / 2),
        x: 0, y: 0,
        orbit: orbitEllipse(b.a, b.e, b.peri),
        poly: orbitPoly(b.a, b.e, b.peri, T, b.inc, b.node)
    };
});

// --- Околоземные астероиды (ОЗА) ----------------------------------------------

/**
 * Малое тело карты: общие поля для hover и карточек (элементы, орбита, тип).
 * r — настоящий радиус km(dia / 2); у безымянных досыпанных ОЗА диаметра нет,
 * они остаются точками слоя пола.
 */
function smallBody(id, kind, name, src, extra) {
    const T = periodFromA(src.a);
    const inc = src.inc ?? 0;
    const node = src.node ?? 0;
    return Object.assign({
        id, kind, name,
        a: src.a, e: src.e, peri: src.peri, m0: src.m0, dia: src.dia,
        inc, node,
        T,
        q: src.a * (1 - src.e), Q: src.a * (1 + src.e),
        r: src.dia ? km(src.dia / 2) : km(0.5),
        x: 0, y: 0,
        orbit: orbitEllipse(src.a, src.e, src.peri),
        poly: orbitPoly(src.a, src.e, src.peri, T, inc, node)
    }, extra || {});
}

const NEA_SEED = 20261018;
const neaRng = makeRng(NEA_SEED);

const neaBodies = neas.map(n =>
    smallBody('nea-' + n.n, 'nea', n.ru + ' / ' + n.n, n, { group: n.group, ru: n.ru }));

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
        }, { group }));
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
    dia: t.dia,
    r: km(t.dia / 2),
    x: 0, y: 0,
    a: JUPITER.dist / 1000,
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

// Койпер: 30–50 а.е. = 30 000–50 000 wu. s — размер точки в пикселях экрана.
const kuiperDust = makeDustRing(Array.from({ length: 600 }, () => {
    const al = 0.22 + dustRng() * 0.23;
    return {
        ang: dustRng() * Math.PI * 2,
        r: auToDist(30 + dustRng() * 20),
        s: 0.8 + dustRng() * 1.0,
        col: 'rgba(150,150,150,' + al.toFixed(2) + ')'
    };
}));

// Оорт: 2 000–100 000 а.е. = 2e6…1e8 wu. Квадрат радиуса сгущает точки к
// внутреннему краю — так облако читается и на общем плане.
const oortDust = makeDustRing(Array.from({ length: 350 }, () => {
    const al = 0.16 + dustRng() * 0.18;
    const k = dustRng();
    return {
        ang: dustRng() * Math.PI * 2,
        r: auToDist(2000 + k * k * 98000),
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

/** Экранный радиус кольца: средний между внутренним и внешним краем. */
function ringScreenR(ring, zoom) {
    return (ring.rMin + ring.rMax) / 2 * zoom;
}

/**
 * Нарисовать кольцо пыли: точки вне кадра пропускаются. Кольцо рисуется,
 * только когда его радиус на экране ≥ 40 px; иначе остаётся подсказка-круг
 * (drawLayerHint) без частиц.
 */
function drawDustRing(ctx, ring, zoom) {
    if (ringScreenR(ring, zoom) < 40) return;

    const half = Math.hypot(state.W, state.H) / 2 / zoom + 2;
    // rMin/rMax — в raw, камера — в view: сравниваем в raw-единицах
    const camD = Math.hypot(state.camX, state.camY / ISO_K);
    if (camD + half < ring.rMin || camD - half > ring.rMax) return;

    const h2 = half * half;
    const dot = 1 / zoom;
    for (const g of ring.groups) {
        ctx.fillStyle = g.col;
        for (const p of g.points) {
            if ((p.x - state.camX) ** 2 + (p.y - state.camY) ** 2 > h2) continue;
            const s = p.s * dot;
            ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        }
    }
}

/**
 * Тонкая окружность-подсказка слоя, когда частицы уже не читаются:
 * 4–40 px на экране. Ниже 4 px слой неотличим от точки — не рисуем.
 */
function drawLayerHint(ctx, rWu, zoom, color) {
    const rPx = rWu * zoom;
    if (rPx < 4 || rPx >= 40) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    orbitEllipsePath(ctx, 0, 0, rWu);
    ctx.stroke();
    ctx.restore();
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
    const b = smallBody('comet-' + c.n, 'comet', c.ru + ' / ' + c.n, c,
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
    b.rawX = pos.x;
    b.rawY = pos.y;
    b.rawZ = pos.z;
    b.rAu = pos.rAu;
}

/**
 * Позиции всех именованных малых тел кадра — для общего правила группировки
 * (scene.js groupBodies): крупнейшие тела пояса, именованные ОЗА, троянцы и
 * кометы. Безымянные (частицы пояса, досыпанные ОЗА, облака троянцев, пыль
 * дальних поясов) сюда не входят: их не выбирают и в подписи они не попадают.
 * @returns {Array} записи { id, kind, small, r, x, y, rx, ry, rz, rAu, label }
 */
function smallBodyList() {
    const { simDays } = state;
    const jupLon = jupiterLongitude(simDays);
    const list = [];

    function add(b, kind) {
        list.push({
            id: b.id, kind, small: b, r: b.r, x: b.x, y: b.y,
            z: b.z || 0, floorY: b.floorY ?? b.y,
            rx: b.rawX, ry: b.rawY, rz: b.rawZ, rAu: b.rAu,
            label: b.ru || b.name
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
        b.rawX = pos.x;
        b.rawY = pos.y;
        b.rawZ = pos.z;
        b.rAu = pos.rAu;
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
        b.rawX = pos.x;
        b.rawY = pos.y;
        b.rawZ = pos.z;
        b.rAu = pos.rAu;
        if (b.name) add(b, 'nea');
    });

    trojanBodies.forEach(b => {
        // Центр облака — от фактической долготы Юпитера, а не от средней L0:
        // иначе на уравнение центра облако сдвигается с планеты.
        const ang = jupLon + b.camp * Math.PI / 3
            + (b.dAng + trojanLib(simDays, b.camp)) * RAD;
        const rr = JUPITER.dist + b.dR;
        const pos = orbitPoint3(rr, ang, JUPITER.inc, JUPITER.node);
        const v = project3(pos.x, pos.y, pos.z);
        b.x = v.x;
        b.y = v.y;
        b.z = pos.z;
        b.floorY = pos.y * ISO_K;
        b.rawX = pos.x;
        b.rawY = pos.y;
        b.rawZ = pos.z;
        b.rAu = rr / 1000;
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

    // Подсказки слоёв, которые на этом зуме уже схлопнулись в точку.
    drawLayerHint(ctx, BELT_MID, zoom, 'rgba(110,110,110,0.20)');
    drawLayerHint(ctx, (kuiperDust.rMin + kuiperDust.rMax) / 2, zoom, 'rgba(150,150,150,0.16)');
    drawLayerHint(ctx, (oortDust.rMin + oortDust.rMax) / 2, zoom, 'rgba(150,150,150,0.12)');

    // Полоса пояса — «гравий» на полу, эллипс 2:1.
    if (BELT_MID * zoom >= 40) {
        ctx.save();
        ctx.strokeStyle = 'rgba(58,66,82,0.10)';
        ctx.lineWidth = 10 / zoom;
        ctx.beginPath();
        orbitEllipsePath(ctx, 0, 0, BELT_MID);
        ctx.stroke();
        ctx.restore();

        // Частицы пояса: экранный размер и culling по камере.
        const half = Math.hypot(state.W, state.H) / 2 / zoom + 4 / zoom;
        const dot = 1 / zoom;
        ctx.fillStyle = '#6e6e6e';
        asteroids.forEach(a => {
            const ang = orbitAngle(a.l0, a.period, simDays);
            const x = Math.cos(ang) * a.d;
            const y = -Math.sin(ang) * a.d * ISO_K;
            if (Math.abs(x - state.camX) > half || Math.abs(y - state.camY) > half) return;
            const s = a.s * dot;
            ctx.beginPath();
            ctx.arc(x, y, Math.max(s, 0.4 * dot), 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // Безымянные досыпанные ОЗА — тусклые точки всегда.
    ctx.fillStyle = '#8a8a8a';
    neaBodies.forEach(b => {
        if (b.name) return;
        ctx.beginPath();
        ctx.arc(b.x, b.y, Math.max(0.5 / zoom, 0.4 / zoom), 0, Math.PI * 2);
        ctx.fill();
    });

    // Троянцы: два облака точек, синхронных с Юпитером (плюс либрация).
    const jupLon = jupiterLongitude(simDays);
    ctx.fillStyle = '#808080';
    trojanClouds.forEach(c => {
        const base = jupLon + c.camp * Math.PI / 3 + trojanLib(simDays, c.camp) * RAD;
        c.points.forEach(p => {
            const ang = base + p.dAng * RAD;
            const rr = JUPITER.dist + p.dR;
            ctx.beginPath();
            ctx.arc(Math.cos(ang) * rr, -Math.sin(ang) * rr * ISO_K,
                Math.max(p.s / zoom, 0.4 / zoom), 0, Math.PI * 2);
            ctx.fill();
        });
    });
}

/**
 * Нарисовать одно показанное именованное малое тело в общем слое тел.
 * LOD общий с планетами: настоящий камень/сфера при rPx ≥ TRUE_MIN_PX,
 * иначе полое кольцо-маркер фиксированного экранного размера.
 * @returns {?Object} hover-цель { kind, name, x, y, floorY, r, moons, small }
 */
function drawSmallBody(ctx, b) {
    const zoom = state.zoom;

    if (b.kind === 'comet') return drawComet(ctx, b);

    const rPx = b.r * zoom;
    if (rPx >= TRUE_MIN_PX) {
        // Камни пояса/ОЗА/троянцев: неровная форма, детерминированная id.
        rock(ctx, b.x, b.y, b.r, b.id, '#b9a88f', zoom);
    } else {
        ctx.strokeStyle = b.kind === 'trojan' ? '#cfcfcf' : '#d8d8d8';
        ctx.lineWidth = 1.1 / zoom;
        ctx.beginPath();
        ctx.arc(b.x, b.y, MARKER_PX.small / zoom, 0, Math.PI * 2);
        ctx.stroke();
    }

    return {
        kind: b.kind, name: b.name, x: b.x, y: b.y,
        floorY: b.floorY ?? b.y,
        r: Math.max(b.r, MARKER_PX.small / zoom),
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

    // Ядро — настоящая сфера или маркер видимости (ядро кометы — километры).
    if (b.r * zoom >= TRUE_MIN_PX) {
        sphere(ctx, b.x, b.y, b.r, '#ffffff', { zoom, rim: false });
    } else {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2 / zoom;
        ctx.beginPath();
        ctx.arc(b.x, b.y, MARKER_PX.small / zoom, 0, Math.PI * 2);
        ctx.stroke();
    }

    return {
        kind: 'comet', name: b.name, x: b.x, y: b.y,
        floorY: b.floorY ?? b.y,
        r: Math.max(b.r, MARKER_PX.small / zoom),
        moons: [], small: b
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
// орбиты Венеры) и соседних тел (крупных лун планеты или планеты и лун-соседей
// у базы на луне); так орбита базы не пересекает ни тела, ни их орбиты. Все
// границы — доли радиуса хозяина (BASE_CLEAR_K, BASE_SAME_GAP_K), поэтому
// правило одинаково работает и для Земли, и для Фобоса. Вдобавок орбита
// разводится с другими базами того же хозяина: кольца баз не сливаются
// (fitBaseRadius). Стартовая база LUNA-ORBIT, которую render.js раньше рисовал
// жёстко у Луны Земли, при загрузке становится обычной записью механизма.
//
// Период обращения — игровой, не астрономический: один виток в сутки на
// стартовом радиусе BASE_ORBIT_K * hostR (3 радиуса хозяина), дальше r^1.5.
// Базы создаются только на телах с радиусом ≥ 50 км (BASE_MIN_HOST_KM): у
// мелкой луны орбита базы была бы меньше пикселя даже на MAX_ZOOM.
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

// Версия шкалы баз в localStorage. Записи без scale: 2 хранят радиусы в
// старой сжатой шкале — их радиус сбрасывается на 3R хозяина (см. migrateScale2).
const STORAGE_SCALE = 2;

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

/** Радиус хозяина в мировых единицах (0 — хозяин не найден). */
function hostRadius(host) {
    const p = planets.find(q => q.name === host.planet);
    if (!p) return 0;
    if (host.kind === 'moon') {
        const m = (moonsByPlanet[host.planet] || []).find(x => x.n === host.moon);
        return m ? m.r : 0;
    }
    return p.r;
}

/** Можно ли строить базу у этого тела: радиус не меньше BASE_MIN_HOST_KM. */
function canHostBase(host) {
    const r = hostRadius(host);
    return r > 0 && wuToKm(r) >= BASE_MIN_HOST_KM;
}

/** Период обращения базы на радиусе r: один виток в сутки на 3R хозяина. */
function basePeriodAt(r, hostR) {
    const r0 = BASE_ORBIT_K * hostR;
    if (!(r0 > 0)) return basePeriod;
    return basePeriod * Math.pow(r / r0, 1.5);
}

/** Округление радиусов орбит: 4 значащие цифры (у мелких лун иначе ноль). */
function round4(v) {
    return Number(v.toPrecision(4));
}

/**
 * Допустимый коридор радиуса орбиты базы вокруг хозяина: от поверхности
 * хозяина до ближайшей чужой «полосы» — так орбита базы не пересекает ни
 * небесные тела, ни их орбиты:
 *   • Солнце — диск звезды;
 *   • другие планеты — полосы, которые заметают их диски: база у Меркурия
 *     не дотянется до орбиты Венеры, база у Венеры — до Меркурия и Земли;
 *   • луны — у базы на луне планета под ней и соседние крупные луны той же
 *     планеты.
 * У базы на планете орбиты крупных лун не обрывают коридор: они запретные
 * полосы внутри него (moonBands + fitRadius). Иначе 3R Юпитера (1.40 wu) не
 * влезает внутрь орбиты Амальтеи (1.21 wu) и стартовый радиус пришлось бы
 * прижимать к планете. Коридор — это диапазон, а база стоит на одном радиусе:
 * полосы гарантируют, что она не встанет на радиус луны.
 * Верхний потолок — 8 радиусов хозяина. Для базы на луне полосы Солнца и
 * планет сдвинуты на радиус орбиты луны (md): база ходит вокруг луны и не
 * выходит за её окрестность. Если сосед слишком близко и коридор вырождается,
 * хозяин приоритетнее: max = min (база прижата к поверхности хозяина; запас
 * BASE_CLEAR_K съедается).
 * @param {{kind: string, planet: string, moon: ?string}} host
 * @returns {{min: number, max: number}} границы радиуса, единицы мира
 */
function baseRadiusRange(host) {
    const p = planets.find(q => q.name === host.planet);
    const hostR = hostRadius(host);
    if (!p || !(hostR > 0)) return { min: 0, max: 0 };

    const clear = hostR * BASE_CLEAR_K;
    const min = hostR * (1 + BASE_CLEAR_K);
    let max = hostR * 8;               // потолок: база не теряется у хозяина

    // md — радиус орбиты хозяина-луны вокруг планеты (0 — база у планеты):
    // на столько отодвинуто «кольцо» базы и на столько же экранируются
    // внешние полосы (Солнце и другие планеты).
    let md = 0;

    if (host.kind === 'moon') {
        const list = moonsByPlanet[host.planet] || [];
        const idx = list.findIndex(m => m.n === host.moon);
        md = idx >= 0 ? moonOrbitRadius(p, idx) : 0;
        max = Math.min(max, md - p.r - clear);   // диск планеты под луной
        list.forEach((m, i) => {                  // соседние крупные луны
            if (i === idx || m.rad < BASE_MIN_HOST_KM) return;
            const d = Math.abs(moonOrbitRadius(p, i) - md) - m.r - clear;
            if (d > 0) max = Math.min(max, d);
        });
    }

    // Солнце и другие планеты: расстояние от Солнца до базы лежит в
    // [p.dist − md − R, p.dist + md + R] — берём у каждой полосы ближний край.
    max = Math.min(max, p.dist - md - SUN_R - clear);
    planets.forEach(q => {
        if (q === p) return;
        max = Math.min(max, Math.abs(q.dist - p.dist) - q.r - md - clear);
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
 * Свободный радиус орбиты с учётом соседей хозяина: из коридора
 * baseRadiusRange исключаются «полосы» вокруг орбит соседних баз
 * (half = BASE_SAME_GAP_K * hostR) и вокруг орбит крупных лун (half = радиус
 * луны + BASE_CLEAR_K * hostR), берётся ближайшая к желаемой свободная точка.
 * Полосы лун нужны, потому что коридор у планеты не обрывается на первой луне:
 * база может стоять на 3R (Юпитер — внутри орбиты Амальтеи), но не на самой
 * орбите луны. Если коридор слишком узкий и свободного места нет (у лун места
 * мало), выбирается точка с наибольшим зазором от чужих орбит — кольца не
 * сливаются, пока это геометрически возможно.
 * @param {number} r желаемый радиус
 * @param {{kind: string, planet: string, moon: ?string}} host
 * @param {Array<number>} blocked радиусы орбит других баз хозяина
 * @returns {number} радиус, округлённый до 4 значащих цифр
 */
function fitRadius(r, host, blocked) {
    const { min, max } = baseRadiusRange(host);
    const hostR = hostRadius(host);
    const gap = hostR * BASE_SAME_GAP_K;
    // Полосы соседних баз и крупных лун — один список {center, half}.
    const bars = blocked.map(b => ({ center: b, half: gap }))
        .concat(moonBands(host));
    const want = Math.min(Math.max(r, min), max);
    if (!bars.length) return round4(want);
    const clampIn = x => Math.min(Math.max(x, min), max);
    const free = x => bars.every(b => Math.abs(x - b.center) >= b.half - 1e-6);
    const cands = [min, max, want];
    bars.forEach(b => cands.push(b.center - b.half, b.center + b.half));
    const ok = cands.map(clampIn).filter(free);
    let best;
    if (ok.length) {
        best = ok[0];
        ok.forEach(x => { if (Math.abs(x - want) < Math.abs(best - want)) best = x; });
    } else {
        // Свободного места нет: кандидаты «наименее тесно» — середины между
        // полосами соседей и краями коридора; берём точку с максимальным
        // зазором, при равенстве — ближайшую к желаемой.
        const gapAt = x => Math.min(...bars.map(b => Math.abs(x - b.center) - b.half));
        const edges = [min,
            ...bars.filter(b => b.center > min && b.center < max)
                    .map(b => b.center).sort((a, b) => a - b),
            max];
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
    return round4(best);
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
 * Запретные полосы орбит крупных лун вокруг планеты-хозяина: { center, half }.
 * База стоит на фиксированном радиусе, поэтому может находиться между
 * орбитами лун, но не на самой орбите (там её кольцо совпало бы с диском луны
 * в любой фазе). Для базы на луне полосы уже учтены в baseRadiusRange (max),
 * здесь они не нужны.
 * @param {{kind: string, planet: string, moon: ?string}} host
 * @returns {Array<{center: number, half: number}>}
 */
function moonBands(host) {
    if (host.kind !== 'planet') return [];
    const p = planets.find(q => q.name === host.planet);
    if (!p) return [];
    const clear = hostRadius(host) * BASE_MOON_CLEAR_K;
    const out = [];
    (moonsByPlanet[p.name] || []).forEach((m, i) => {
        if (m.rad < BASE_MIN_HOST_KM) return;
        out.push({ center: moonOrbitRadius(p, i), half: m.r + clear });
    });
    return out;
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
    const host = { kind: 'moon', planet: 'Earth', moon: 'Moon' };
    const hostR = hostRadius(host);
    const orbitRadius = BASE_ORBIT_K * hostR;
    bases.push({
        id: 'base-luna-orbit',
        name: 'LUNA-ORBIT',
        status: 'active',
        hostKind: 'moon',
        planet: 'Earth',
        moon: 'Moon',
        scale: STORAGE_SCALE,
        orbitRadius,
        period: basePeriodAt(orbitRadius, hostR),
        phase0: 0,
        created: new Date().toISOString(),
        fleet: true
    });
    saveBases();
})();

/**
 * Миграция шкалы: записи без scale: 2 хранят радиус в старой сжатой системе
 * координат, где он несопоставим с реальными радиусами тел. Такой радиус
 * сбрасывается на стартовый (3R хозяина), период пересчитывается; id, имя,
 * статус, fleet и фаза сохраняются. Дальше normalizeBaseRadii вписывает базу
 * в коридор и разводит с соседями.
 */
(function migrateScale2() {
    let changed = false;
    bases.forEach(b => {
        if (b.scale === STORAGE_SCALE) return;
        // Старое имя Луны Земли — теперь в каталоге она называется Moon.
        if (b.moon === 'Луна / Moon') { b.moon = 'Moon'; changed = true; }
        const host = { kind: b.hostKind, planet: b.planet, moon: b.moon || null };
        const hostR = hostRadius(host);
        if (hostR > 0) {
            b.orbitRadius = BASE_ORBIT_K * hostR;
            b.period = basePeriodAt(b.orbitRadius, hostR);
        }
        b.scale = STORAGE_SCALE;
        changed = true;
    });
    if (changed) saveBases();
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
        b.period = basePeriodAt(r, hostRadius(host));
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
    if (!canHostBase(host)) return null;   // тело меньше 50 км — база не поместится
    const orbitRadius = fitBaseRadius(r, host, null);
    const period = basePeriodAt(orbitRadius, hostRadius(host));
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
        scale: STORAGE_SCALE,
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
    if (!canHostBase(host)) return rec;        // тело меньше 50 км — базу не поставить
    rec.hostKind = host.kind;
    rec.planet = host.planet;
    rec.moon = host.moon || null;
    rec.orbitRadius = fitBaseRadius(r, host, rec.id);
    rec.period = basePeriodAt(rec.orbitRadius, hostRadius(host));
    rec.scale = STORAGE_SCALE;
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
        const period = moving
            ? basePeriodAt(orbitR, hostRadius({ kind: mode.kind, planet: mode.planet, moon: mode.moon }))
            : b.period;
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

    const l1 = 'Орбита: ' + fmtKm(wuToKm(r)) + ' км';
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
//   небо -> экранное гало звезды -> пол/пыль/пояс -> тени -> тела по глубине
//   -> подписи -> базы.
//
// Реальный масштаб: у тел настоящие радиусы (wu), поэтому на общем плане они
// меньше пикселя. LOD: экранный радиус >= TRUE_MIN_PX — настоящая сфера,
// иначе — полое кольцо-маркер фиксированного экранного размера. Близкие тела
// (< GROUP_PX) собираются в группу более массивного соседа; у группы своё
// кольцо, подпись «Имя · N» и список тел в карточке.
//
// Возвращает массив hoverTargets — цели наведения и клика.
// =============================================================================













/** Орбиты планет: реальные элементы, считаются один раз (форма не меняется). */
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
 * Локальная орбита луны в view-координатах (смещение от планеты). Кэшируется
 * на объекте луны: форма орбиты от времени не зависит, каждый кадр достаточно
 * прибавить позицию планеты.
 */
function moonOrbitLocal(m) {
    if (!m._orbitLocal) {
        const md = km(m.a);
        const raw = keplerPoly3(md, m.e, m.peri, 0, m.period, 96, v => v, m.inc, m.node);
        const pts = new Array(raw.length / 3 * 2);
        for (let i = 0, j = 0; i < raw.length; i += 3, j += 2) {
            const v = project3(raw[i], raw[i + 1], raw[i + 2]);
            pts[j] = v.x;
            pts[j + 1] = v.y;
        }
        m._orbitLocal = pts;
    }
    return m._orbitLocal;
}

/** Абсолютная орбита луны в view: локальная полилиния + позиция планеты. */
function moonOrbitAbs(m, px, py) {
    const local = moonOrbitLocal(m);
    const out = new Array(local.length);
    for (let i = 0; i < local.length; i += 2) {
        out[i] = local[i] + px;
        out[i + 1] = local[i + 1] + py;
    }
    return out;
}

/** Точка на экране в пределах кадра с запасом margin (px). */
function onScreen(x, y, margin = 40) {
    const sx = state.W / 2 + (x - state.camX) * state.zoom;
    const sy = state.H / 2 + (y - state.camY) * state.zoom;
    return sx >= -margin && sx <= state.W + margin &&
           sy >= -margin && sy <= state.H + margin;
}

/** Нарисовать один кадр мира в мировой системе координат (save/restore внутри). */
function renderScene(ctx) {
    const { zoom, simDays } = state;
    const hoverTargets = [];

    // Дальний фон — отдельный слой sky.js, в экранных координатах.
    drawSky(ctx);

    // Экранное гало Солнца: на общем плане звезда должна быть видна, даже
    // когда её настоящий диск меньше пикселя.
    drawSunScreenGlow(ctx);

    resetLabels();

    // Мировая система координат: центр экрана -> камера -> зум.
    ctx.save();
    ctx.translate(state.W / 2, state.H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-state.camX, -state.camY);

    // === ПОЗИЦИИ ТЕЛ КАДРА ===
    const planetRaw = new Map();
    const planetPos = new Map();
    state.planetPositions.clear();

    planets.forEach(p => {
        const raw = planetRawPos(p, simDays);
        const v = project3(raw.x, raw.y, raw.z);
        const pos = {
            x: v.x, y: v.y, z: raw.z, floorY: raw.y * ISO_K,
            rawX: raw.x, rawY: raw.y, rawZ: raw.z, r: p.r
        };
        planetRaw.set(p, raw);
        planetPos.set(p, pos);
        state.planetPositions.set(p.name, pos);
    });

    // === ТЕЛА: солнце, планеты, видимые луны, малые тела ===
    const bodies = [];
    bodies.push({
        kind: 'sun', x: 0, y: 0, z: 0, floorY: 0, r: SUN_R, mass: SUN_R,
        label: 'Солнце / Sun', p: null, m: null, small: null, bases: []
    });

    planets.forEach(p => {
        const pos = planetPos.get(p);
        bodies.push({
            kind: 'planet', p, x: pos.x, y: pos.y, z: pos.z, floorY: pos.floorY,
            r: p.r, mass: p.r, label: p.ru || p.name,
            orbit: PLANET_ORBITS.get(p),
            bases: basesAt('planet', p.name, null)
        });
    });

    state.moonPositions.clear();
    planets.forEach(p => {
        const o = planetRaw.get(p);
        const pv = planetPos.get(p);
        const list = moonsByPlanet[p.name] || [];
        for (let i = 0; i < list.length; i++) {
            const m = list[i];
            const md = moonOrbitRadius(p, i);
            // Орбита меньше 2 px — луна в кадр не попадает (иначе 456 лун
            // считались бы вхолостую). Планета за кадром — тоже пропуск.
            if (md * zoom < 2) continue;
            const margin = md * zoom + 40;
            const psx = state.W / 2 + (pv.x - state.camX) * zoom;
            const psy = state.H / 2 + (pv.y - state.camY) * zoom;
            if (psx < -margin || psx > state.W + margin ||
                psy < -margin || psy > state.H + margin) continue;

            const off = keplerPos3(md, m.e, m.peri, m.m0, m.period, simDays,
                v => v, m.inc, m.node);
            const wx = o.x + off.x, wy = o.y + off.y, wz = o.z + off.z;
            const v = project3(wx, wy, wz);
            if (!onScreen(v.x, v.y, 24)) continue;

            state.moonPositions.set(p.name + ':' + m.n, {
                x: v.x, y: v.y, floorY: wy * ISO_K,
                rawX: wx, rawY: wy, rawZ: wz, r: m.r
            });
            bodies.push({
                kind: 'moon', p, m, x: v.x, y: v.y, z: wz, floorY: wy * ISO_K,
                r: m.r, mass: m.r,
                label: m.ru ? m.ru + ' / ' + m.n : m.n,
                orbitLocal: { px: pv.x, py: pv.y },
                bases: basesAt('moon', p.name, m.n)
            });
        }
    });

    // Малые тела: позиции уже в view (smallbodies.js). В кадр попадают только
    // те, чей центр виден; остальные не рисуются и не подписываются.
    const small = smallBodyList();
    small.forEach(s => {
        if (!onScreen(s.x, s.y, 40)) return;
        bodies.push({
            kind: 'small', id: s.id, small: s.small, x: s.x, y: s.y,
            z: s.z || 0, floorY: s.floorY ?? s.y,
            r: s.r, mass: s.r || 1e-9, label: s.label, bases: []
        });
    });

    // Порядок важности: сначала массивные тела. Представителем группы всегда
    // становится более массивное тело (Солнце -> планета -> луна/малое тело).
    bodies.sort((a, b) => b.mass - a.mass);
    const groups = groupBodiesLocal(bodies, zoom);

    // === HOST-ПОЗИЦИИ ДЛЯ БАЗ ===
    const hostPos = {};
    planetPos.forEach((pos, p) => { hostPos['planet:' + p.name] = { x: pos.x, y: pos.y }; });
    state.moonPositions.forEach((pos, key) => {
        const [pn, ...rest] = key.split(':');
        hostPos['moon:' + pn + ':' + rest.join(':')] = { x: pos.x, y: pos.y };
    });

    // Базы лун, попавших в группы: их имена уже в подписи группы.
    const quietIds = new Set();
    groups.forEach(g => {
        if (g.members.length < 2) return;
        g.members.forEach(m => {
            if (m !== g.rep) m.bases.forEach(b => quietIds.add(b.id));
        });
    });

    // === ПОЛ ===
    drawSmallBodiesFloor(ctx);
    drawFloorShadows(ctx, groups, planetPos, zoom);

    // === ТЕЛА ПО ГЛУБИНЕ ===
    const drawList = groups.map(g => ({
        x: g.rep.x, y: g.rep.y, r: g.rep.r, rep: g.rep, group: g
    }));
    drawList.sort((a, b) => (a.y - b.y) || (b.r - a.r));

    const smallTargets = new Map();
    drawList.forEach(item => {
        const rep = item.rep;
        if (rep.kind === 'sun') drawSunCore(ctx, zoom);
        else if (rep.kind === 'planet') drawPlanet(ctx, item.x, item.y, rep.p, zoom);
        else if (rep.kind === 'moon') drawMoonBody(ctx, item.x, item.y, rep.m, zoom);
        else if (rep.kind === 'small') {
            const t = drawSmallBody(ctx, rep.small);
            if (t) smallTargets.set(rep.small.id, t);
        }

        if (item.group.members.length > 1) drawGroupRing(ctx, item.group, zoom);
    });

    // === ПОДПИСИ ===
    groups.forEach(g => {
        const baseNames = [];
        g.members.forEach(m => m.bases.forEach(b => baseNames.push(b.name)));
        const label = groupLabel(g, zoom);
        const rep = g.rep;
        const offset = Math.max(rep.r, markerPx(rep.kind) / zoom) + 4 / zoom;
        drawGroupLabel(ctx, rep.x + offset, rep.y, {
            label,
            baseLabel: baseNames.length ? baseNames.join(', ') : null
        }, zoom);
    });

    // === БАЗЫ ===
    const baseTargets = drawBases(ctx, hostPos, quietIds);
    baseTargets.forEach(t => { t.p = planets.find(x => x.name === t.local.planet); });

    ctx.restore();

    // === HOVER-ЦЕЛИ ===
    // Сначала группы, затем одиночные тела, затем базы: findBodyAt идёт с
    // конца, поэтому база перехватывает клик у тела, а тело — у группы.
    groups.forEach(g => {
        if (g.members.length > 1) hoverTargets.push(groupTarget(g, zoom));
    });

    groups.forEach(g => {
        if (g.members.length > 1) return;
        const b = g.rep;
        if (b.kind === 'sun') {
            hoverTargets.push({ kind: 'sun', name: 'Солнце / Sun', x: 0, y: 0, r: SUN_R, floorY: 0, moons: [] });
        } else if (b.kind === 'planet') {
            hoverTargets.push({
                kind: 'planet', name: b.label, p: b.p, x: b.x, y: b.y,
                floorY: b.floorY, r: b.r, orbit: b.orbit, moons: []
            });
        } else if (b.kind === 'moon') {
            const orbit = moonOrbitAbs(b.m, b.orbitLocal.px, b.orbitLocal.py);
            hoverTargets.push({
                kind: 'moon', name: b.label, p: b.p, m: b.m, x: b.x, y: b.y,
                floorY: b.floorY, r: b.r, orbit: { poly: orbit }, moons: []
            });
        } else if (b.kind === 'small') {
            const t = smallTargets.get(b.small.id);
            if (t) hoverTargets.push(t);
        }
    });

    baseTargets.forEach(t => hoverTargets.push(t));

    return hoverTargets;
}

// --- Группировка (локальная обёртка над scene.js) ------------------------------

function groupBodiesLocal(bodies, zoom) {
    // Импорт scene.js уже даёт groupBodies, но здесь важна сортировка по массе:
    // Солнце всегда первое, поэтому группы собираются вокруг него.
    return groupBodies(bodies, zoom);
}

// --- Экранные размеры и маркеры -------------------------------------------------

/** Радиус маркера тела в экранных пикселях. */
function markerPx(kind) {
    if (kind === 'sun') return MARKER_PX.sun;
    if (kind === 'planet') return MARKER_PX.planet;
    if (kind === 'moon') return MARKER_PX.moon;
    return MARKER_PX.small;
}

/** Полое кольцо-маркер: размер фиксирован на экране, позиция — реальная. */
function drawMarker(ctx, x, y, rPx, color, zoom, width = 1.2) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width / zoom;
    ctx.beginPath();
    ctx.arc(x, y, rPx / zoom, 0, Math.PI * 2);
    ctx.stroke();
}

/** Экранное гало Солнца и световое пятно на полу — до мирового transform. */
function drawSunScreenGlow(ctx) {
    const { W, H, zoom, camX, camY } = state;
    const sx = W / 2 + (0 - camX) * zoom;
    const sy = H / 2 + (0 - camY) * zoom;
    const r = Math.max(SUN_R * zoom * 5.2, 26);

    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    g.addColorStop(0, 'rgba(255,206,122,0.42)');
    g.addColorStop(0.35, 'rgba(255,157,60,0.20)');
    g.addColorStop(0.7, 'rgba(255,157,60,0.06)');
    g.addColorStop(1, 'rgba(255,157,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    // Световое пятно на полу — эллипс 2:1, тоже с экранным минимумом.
    const fr = Math.max(SUN_R * zoom * 7.5, 18);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, ISO_K);
    const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, fr);
    fg.addColorStop(0, 'rgba(255,206,122,0.20)');
    fg.addColorStop(0.55, 'rgba(255,157,60,0.055)');
    fg.addColorStop(1, 'rgba(255,157,60,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(0, 0, fr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// --- Тела ----------------------------------------------------------------------

/** Ядро Солнца: настоящая сфера или маркер видимости. */
function drawSunCore(ctx, zoom) {
    if (SUN_R * zoom >= TRUE_MIN_PX) sunSphere(ctx, 0, 0, SUN_R);
    else drawMarker(ctx, 0, 0, MARKER_PX.sun, '#ffce7a', zoom, 1.4);
}

/** Планета: сфера + кольца Сатурна; при малом экранном радиусе — маркер. */
function drawPlanet(ctx, x, y, p, zoom) {
    if (p.r * zoom < TRUE_MIN_PX) {
        drawMarker(ctx, x, y, MARKER_PX.planet, p.color, zoom, 1.3);
        return;
    }
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

/** Луна: маленькая сфера или маркер. */
function drawMoonBody(ctx, x, y, m, zoom) {
    if (m.r * zoom < TRUE_MIN_PX) {
        drawMarker(ctx, x, y, MARKER_PX.moon, m.c || COLORS.moon, zoom, 1.1);
        return;
    }
    sphere(ctx, x, y, m.r, m.c || COLORS.moon, { zoom, rimAlpha: 0.12 });
}

/** Тени на полу: планеты и показанные крупные тела. */
function drawFloorShadows(ctx, groups, planetPos, zoom) {
    planets.forEach(p => {
        const pos = planetPos.get(p);
        shadow(ctx, pos.x, pos.floorY, p.r, zoom);
    });
    groups.forEach(g => {
        if (g.members.length > 1) return;
        const rep = g.rep;
        if (rep.kind !== 'small' && rep.kind !== 'moon') return;
        if (rep.r * zoom < TRUE_MIN_PX) return;
        shadow(ctx, rep.x, rep.floorY ?? rep.y, rep.r, zoom);
    });
}

// --- Группы --------------------------------------------------------------------

/** Подпись группы: у Солнца — «Внутренние планеты» / «Солнечная система». */
function groupLabel(g, zoom) {
    const rep = g.rep;
    // Одиночное тело — это не группа: подпись без счётчика «· 1».
    if (g.members.length === 1) return rep.label;
    if (rep.kind === 'sun') {
        const ps = g.members.filter(m => m.kind === 'planet');
        if (!ps.length) return 'Солнце / Sun';
        if (ps.length === planets.length || zoom < 0.01) {
            return 'Солнечная система · ' + g.members.length;
        }
        const inner = ps.every(m => ['Mercury', 'Venus', 'Earth', 'Mars'].includes(m.p.name));
        if (inner) return 'Внутренние планеты · ' + ps.length;
        return 'Солнце · ' + g.members.length;
    }
    return rep.label + ' · ' + g.members.length;
}

/** Групповое кольцо: круг в экранных пикселях вокруг представителя. */
function drawGroupRing(ctx, g, zoom) {
    const ringPx = groupRingPx(g, zoom);
    const rep = g.rep;
    const color = rep.kind === 'sun' ? '#ffce7a'
        : rep.kind === 'planet' ? rep.p.color
        : rep.kind === 'moon' ? (rep.m.c || COLORS.moon)
        : '#cfcfcf';
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([3 / zoom, 3 / zoom]);
    ctx.beginPath();
    ctx.arc(rep.x, rep.y, ringPx / zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

/** Радиус группового кольца в пикселях: по самому дальнему участнику. */
function groupRingPx(g, zoom) {
    let max = 0;
    g.members.forEach(m => {
        const d = Math.hypot((m.x - g.rep.x) * zoom, (m.y - g.rep.y) * zoom);
        if (d > max) max = d;
    });
    return Math.max(8, max + 4);
}

/** Hover-цель группы: клик открывает список тел. */
function groupTarget(g, zoom) {
    return {
        kind: 'group',
        name: groupLabel(g, zoom),
        x: g.rep.x, y: g.rep.y, r: groupRingPx(g, zoom) / zoom,
        group: {
            label: groupLabel(g, zoom),
            repKind: g.rep.kind,
            members: g.members.map(b => ({
                kind: b.kind, label: b.label, p: b.p, m: b.m, small: b.small,
                x: b.x, y: b.y, floorY: b.floorY, r: b.r
            }))
        }
    };
}

// --- Подписи -------------------------------------------------------------------

/**
 * Подпись группы тел у её представителя: две строки, имя группы и базы на ней.
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
// hover.js — наведение курсора: hit-тест по телам, орбита наведённого тела,
// вертикальная проекция до эклиптики и текстовая подсказка с названием.
// Здесь же — орбита и маркер ВЫБРАННОГО объекта (клик) и экспорт findBodyAt
// для обработчика клика в input.js.
//
// Цели наведения — плоский массив (render.js): группы тел, одиночные тела
// (Солнце, планеты, луны, малые тела) и базы. У мелких тел hit-радиус не
// меньше MARKER_PX, поэтому маркер-кольцо всегда ловится курсором.
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

    // Орбита наведённой планеты/луны/малого тела/базы. У Солнца и комет её нет.
    // Вертикальная проекция рисуется только вместе с орбитой наведения.
    const isComet = hover.kind === 'comet' || (hover.small && hover.small.kind === 'comet');
    if (hover.orbit && !isComet) {
        drawDropLine(ctx, hover);
        drawOrbitOverlay(ctx, hover, '#ffffff', true);
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
    // Группа: это не тело, своей орбиты у неё нет.
    if (sel.kind === 'planet' || sel.kind === 'comet' || sel.kind === 'group' ||
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

    let target = null;
    if (sel.kind === 'sun') target = hoverTargets.find(t => t.kind === 'sun');
    else if (sel.kind === 'base') {
        target = hoverTargets.find(t =>
            t.kind === 'base' && (sel.local ? t.local === sel.local : !t.local));
    } else if (sel.small) {
        target = hoverTargets.find(t => t.small === sel.small);
    } else if (sel.kind === 'moon') {
        target = hoverTargets.find(t =>
            t.kind === 'moon' && t.p === sel.p && t.m && t.m.n === sel.m.n);
    }
    if (!target) return; // тело ещё не в кадре (луна скрыта зумом и т.п.)
    if (sel.kind === 'sun') return; // у солнца орбиты нет

    let orbit = null;
    if (sel.small) {
        // малое тело: орбита по сэмплированным элементам (poly), у троянцев — круг
        orbit = sel.small.poly ? { poly: sel.small.poly } : sel.small.orbit;
    } else if (sel.kind === 'base') {
        // база летает вокруг своего хозяина — орбита от его центра
        orbit = { cx: target.orbitCx, cy: target.orbitCy, r: target.orbitR };
    } else {
        // луна: орбита вокруг планеты (render.js кладёт её в target.orbit)
        orbit = target.orbit || { cx: target.x, cy: target.y, r: target.r };
    }
    drawOrbitOverlay(ctx, { kind: sel.kind, orbit }, COLORS.orbitSelected);
}

/**
 * Hit-тест: перебираем цели с конца (базы добавлены последними, затем тела,
 * затем группы) — мелкое тело перехватывает клик у группы.
 * Экспортируется для выбора объекта по клику (input.js).
 * @returns {?{kind: string, name: string, orbit: ?{cx, cy, r},
 *   x: number, y: number, floorY: number, p: object, m: object,
 *   small: object, group: object}}
 */
function findBodyAt(hoverTargets, mouseX, mouseY) {
    const w = screenToWorld(mouseX, mouseY, state);

    for (let i = hoverTargets.length - 1; i >= 0; i--) {
        const t = hoverTargets[i];
        const bodyR = t.r || (t.p ? t.p.r : 0);
        const minPx = (t.kind === 'moon' || t.kind === 'base')
            ? MIN_HIT_MOON_PX : MIN_HIT_PLANET_PX;
        const hitR = Math.max(bodyR, minPx / state.zoom);
        if ((w.x - t.x) ** 2 + (w.y - t.y) ** 2 > hitR * hitR) continue;

        // База: орбита вокруг хозяина, радиус попадания как у лун.
        if (t.kind === 'base') {
            return {
                kind: 'base', name: t.name,
                orbit: { cx: t.orbitCx, cy: t.orbitCy, r: t.orbitR },
                p: t.p, m: null, local: t.local || null
            };
        }

        // Группа тел: клик открывает список тел в карточке.
        if (t.kind === 'group') {
            return {
                kind: 'group', name: t.name, orbit: null,
                x: t.x, y: t.y, floorY: t.y, r: t.r,
                p: null, m: null, small: null, group: t.group
            };
        }

        // Тело: орбита из элементов (малые тела), у луны — вокруг планеты,
        // у планет — вокруг Солнца; у самого Солнца орбиты нет.
        let orbit = null;
        if (t.small) orbit = t.small.poly ? { poly: t.small.poly } : t.small.orbit;
        else if (t.kind === 'moon') orbit = t.orbit || null;
        else if (t.kind !== 'sun') orbit = t.orbit ? { poly: t.orbit } : { cx: 0, cy: 0, r: t.p.dist };

        return {
            kind: t.kind, name: t.name || (t.p ? t.p.name : ''),
            orbit,
            x: t.x, y: t.y, floorY: t.floorY, r: bodyR,
            p: t.p || null, m: t.m || null, small: t.small || null
        };
    }
    return null;
}

/**
 * Вертикальная линия от наведённого тела до его проекции на плоскость
 * эклиптики. Рисуется в экранных координатах: толщина и затухание не зависят
 * от зума.
 */
function drawDropLine(ctx, hover) {
    if (hover.floorY == null || hover.x == null || hover.y == null) return;

    const { W, H, zoom, camX, camY } = state;
    const x = W / 2 + (hover.x - camX) * zoom;
    const y = H / 2 + (hover.y - camY) * zoom;
    const floorY = H / 2 + (hover.floorY - camY) * zoom;
    const dir = Math.sign(floorY - y);
    if (!dir || Math.abs(floorY - y) < 1) return;

    // Как и прежние постоянные проекции, линия идёт от центра тела к полу:
    // у крупных планет радиус больше высоты над эклиптикой, и если обрезать
    // её по краю сферы, проекция исчезает совсем.
    const startY = y;

    const g = ctx.createLinearGradient(x, startY, x, floorY);
    g.addColorStop(0, 'rgba(255,255,255,0.02)');
    g.addColorStop(0.14, 'rgba(255,255,255,0.78)');
    g.addColorStop(0.74, 'rgba(255,255,255,0.42)');
    g.addColorStop(1, 'rgba(255,255,255,0.02)');

    ctx.save();
    ctx.setLineDash([]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, floorY);

    // Мягкое свечение и белое ядро: края линии уходят в прозрачность.
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = g;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
}

/**
 * Пунктирная орбита тела в мировой системе координат.
 * @param {boolean} cord — белая «шнурковая» обводка для орбиты наведения:
 *   толще в 3 раза, промежуток между пунктирами в 4 раза больше, мягкие края.
 */
function drawOrbitOverlay(ctx, hover, color, cord = false) {
    const { zoom, camX, camY, W, H } = state;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

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
    if (cord) {
        // Белый «шнурок»: широкая мягкая подложка + яркое ядро. Пунктир в
        // 3 раза толще прежнего, промежуток — в 4 раза больше.
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([4 / zoom, 16 / zoom]);
        const passes = [
            [10 / zoom, 'rgba(255,255,255,0.07)'],
            [6 / zoom, 'rgba(255,255,255,0.20)'],
            [3 / zoom, color]
        ];
        passes.forEach(([width, style]) => {
            ctx.lineWidth = width;
            ctx.strokeStyle = style;
            ctx.stroke();
        });
    } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1 / zoom;
        ctx.setLineDash([4 / zoom, 4 / zoom]);
        ctx.stroke();
    }
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
    // На дальних видах (Койпер/Оорт) шаг крупнее: иначе до нужного масштаба
    // приходится крутить колесо сотни раз.
    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        state.fly = null;   // ручной зум перебивает полёт камеры
        const step = state.zoom < 0.01 ? 1.25 : 1.1;
        zoomAt(e.clientX, e.clientY, state.zoom * (e.deltaY > 0 ? 1 / step : step));
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

/** Позиция хост-тела (планеты/луны) в мировых координатах из state (render.js). */
function hostPosOf(host) {
    if (host.kind === 'planet') {
        const p = state.planetPositions.get(host.planet);
        return p ? { x: p.x, y: p.y } : null;
    }
    const m = state.moonPositions.get(host.planet + ':' + host.moon);
    return m ? { x: m.x, y: m.y } : null;
}

/** Снимок соседей для режима базы: планеты и их видимые луны (позиции на момент снимка). */
function baseHosts() {
    const out = [];
    state.planetPositions.forEach((pos, name) => {
        out.push({ kind: 'planet', planet: name, moon: null, x: pos.x, y: pos.y });
    });
    state.moonPositions.forEach((pos, key) => {
        const [planet, ...rest] = key.split(':');
        out.push({ kind: 'moon', planet, moon: rest.join(':'), x: pos.x, y: pos.y });
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
    if (!rec) { refreshObjectCard(); return; }   // тело меньше 50 км — база не создаётся
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
// ui.js — DOM-интерфейс: HUD-показатели (масштаб/зум/скорость/дата), боковые
// блоки «СОЛНЕЧНАЯ СИСТЕМА» (дерево всех выбираемых тел: Солнце, планеты,
// группы лун с фильтром и малыми телами), «ОБЪЕКТ» (информация о выбранном;
// появляется только с выбором — шапка блока носит имя выбранного) и «МАЛЫЕ
// ТЕЛА» (группы малых тел: полёт камеры и выбор по клику).
//
// Реальный масштаб: карточки показывают радиус и диаметр в километрах,
// расстояния в а.е. и угловой размер в угловых секундах (пометка «в модели»);
// HUD — «1 px = N км» и «N px/а.е.» плюс линейка масштаба.
// Дерево лун ленивое: 456 строк не строятся одновременно — список планеты
// собирается при раскрытии, фильтр ищет по всем лунам, крупные показаны сразу.
// Выбор делается кликом по канвасу (selectBody вызывает input.js), по
// элементу дерева или по строке блока малых тел. Шапка каждого блока
// сворачивает его. Здесь же твин полёта камеры (flyToCamera/updateFlyTo),
// которым main.js двигает камеру, и модальный confirmDialog (общий стиль
// ангара: .slot-dialog). Работает с DOM, не с канвасом.
// =============================================================================









// Русские имена для блока «ОБЪЕКТ»: планеты хранят их в данных (data.js, поле
// ru), здесь только солнце — на карте оно не в списке планет.
const RU = { Sun: 'Солнце' };
planets.forEach(p => { RU[p.name] = p.ru || p.name; });
const TYPES = {
    rocky: 'Каменная планета', earth: 'Обитаемая планета',
    gas: 'Газовый гигант', ice: 'Ледяной гигант'
};

/** Порог «крупной» луны: такие показываются в дереве сразу и в фазе планеты. */
const MOON_MAJOR_KM = 100;

/** Планет с малым числом лун показываем целиком, даже если они мелкие. */
const MOON_ALL_LIMIT = 8;

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
        scaleEl: document.getElementById('scale'),
        pxauEl: document.getElementById('pxau'),
        speedEl: document.getElementById('speed'),
        daysEl: document.getElementById('days'),
        dateEl: document.getElementById('date'),
        barEl: document.querySelector('#scalebar .scale-line'),
        barLabelEl: document.querySelector('#scalebar .scale-label')
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

    // Масштаб: «1 px = N км» (на широких видах — а.е.) и «N px/а.е.».
    if (hud.scaleEl) hud.scaleEl.textContent = fmtScale(state.zoom);
    if (hud.pxauEl) hud.pxauEl.textContent = fmtPxPerAu(state.zoom);
    if (hud.zEl) hud.zEl.textContent = state.zoom >= 0.01
        ? (state.zoom >= 1 ? state.zoom.toFixed(2) : state.zoom.toFixed(3)) + 'x'
        : state.zoom.toExponential(2) + 'x';

    // Линейка масштаба: сегмент фиксированной экранной длины с подписью.
    if (hud.barEl && hud.barLabelEl) {
        const s = niceScale(state.zoom, 120);
        hud.barEl.style.width = Math.max(8, s.px).toFixed(1) + 'px';
        hud.barLabelEl.textContent = s.label;
    }
}

/* ---------- Дерево «01 Солнечная система»: все выбираемые тела ---------- */

/**
 * Масштаб вида для тела/области. У планет — вписать внешнюю крупную луну
 * (радиус ≥ 100 км) или 20R, при этом диск планеты не меньше 8 px. У лун —
 * 40 px на радиус. У малых тел — MAX_ZOOM: карточка + маркер, а Церера,
 * Веста и Паллада при этом видны диском.
 */
function viewZoomFor(kind, obj) {
    const W = state.W || 900, H = state.H || 900;
    if (kind === 'sun') return fitZoom(SUN_R * 1.3, W, H);
    if (kind === 'inner') return fitZoom(au(1.523679), W, H);
    if (kind === 'planets') return fitZoom(au(30.11039), W, H);
    if (kind === 'belt') return fitZoom(au(3.5), W, H);
    if (kind === 'kuiper') return fitZoom(au(50), W, H);
    if (kind === 'oort') return clamp(fitZoom(au(100000), W, H), MIN_ZOOM, MAX_ZOOM);

    if (kind === 'planet') {
        const p = obj && obj.p ? obj.p : obj;
        const list = moonsByPlanet[p.name] || [];
        const major = list.filter(m => m.rad >= MOON_MAJOR_KM);
        const rOuter = major.length
            ? km(Math.max(...major.map(m => m.a)))
            : p.r * 20;
        return clamp(Math.max(fitZoom(rOuter, W, H), 8 / p.r), MIN_ZOOM, MAX_ZOOM);
    }
    if (kind === 'moon') {
        const m = obj && obj.m ? obj.m : obj;
        return clamp(40 / m.r, 20, MAX_ZOOM);
    }
    return MAX_ZOOM;   // asteroid / nea / trojan / comet
}

// Описание областей: у них нет карточки тела, но есть выбор, подсветка и
// короткая карточка области. target — ключ для viewZoomFor.
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
        distance: '2 000–100 000 <em>а.е.</em>',
        map: '350 частиц на дальней границе карты',
        rowTail: 'до 100 000 а.е.',
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

/** Подпись луны: русское имя, если есть, иначе латиница. */
function moonLabel(m) {
    return m.ru ? m.ru + ' / ' + m.n : m.n;
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

/** Цель текущего кадра для планеты: её view-координаты. */
function planetTarget(p) {
    const pos = state.planetPositions.get(p.name);
    return pos ? { x: pos.x, y: pos.y } : null;
}

/** Цель текущего кадра для луны; при сбое — планета, вокруг которой она летит. */
function moonTarget(p, m) {
    const pos = state.moonPositions.get(p.name + ':' + m.n);
    if (pos) return { x: pos.x, y: pos.y };
    return planetTarget(p);
}

/** Навести камеру на тело: масштаб считает viewZoomFor. */
function focusBody(kind, obj) {
    const x = Number.isFinite(obj && obj.x) ? obj.x : 0;
    const y = Number.isFinite(obj && obj.y) ? obj.y : 0;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    flyToCamera(x, y, viewZoomFor(kind, obj), 0.8);
}

/** Навести камеру на пояс/облако: центр карты и масштаб области. */
function focusRegion(region) {
    flyToCamera(0, 0, viewZoomFor(region.target), 0.9);
}

/**
 * Список лун планеты для дерева: фильтр по имени (латиница/кириллица) или
 * крупные/все. Фильтр ищет по всему каталогу, даже если показаны не все.
 * Сравнение без разделителей: «S/2019 S 1», «S2019_S_1» и «s 2019 s 1» —
 * одно и то же имя (в каталоге JPL пробелы заменены подчёркиваниями).
 */
function moonRowsFor(p, query, showAll) {
    const all = moonTree[p.name] || [];
    const norm = s => String(s || '').toLowerCase().replace(/[\s/_-]+/g, '');
    const q = norm(query);
    if (q) {
        // Сначала точное совпадение имени: «S/2019 S 1» не должно тянуть
        // за собой S2019_S_10…S2019_S_19 по подстроке.
        const exact = all.filter(m => norm(m.n) === q || norm(m.ru) === q);
        if (exact.length) return exact;
        return all.filter(m => norm(m.n).includes(q) || norm(m.ru).includes(q));
    }
    if (showAll || all.length <= MOON_ALL_LIMIT) return all;
    return all.filter(m => m.major);
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
        const total = moonTotals[p.name] || 0;
        const li = document.createElement('li');
        li.className = 'planet';
        li.dataset.kind = 'planet';
        li.dataset.name = p.name;
        li.innerHTML =
            '<div class="node">' +
                '<span class="caret">▶</span>' +
                '<span class="dot" style="background:' + p.color + '"></span>' +
                '<span class="pname">' + p.name + '</span>' +
                '<span class="cnt">☾ ' + total + '</span>' +
            '</div>' +
            (total
                ? '<div class="moon-tools">' +
                    '<input class="moon-filter" type="search" placeholder="Фильтр лун" ' +
                        'aria-label="Фильтр лун ' + esc(p.name) + '">' +
                    '<button class="moon-more" type="button"></button>' +
                  '</div>'
                : '') +
            '<ul class="loot"></ul>';

        const ul = li.querySelector('.loot');
        const input = li.querySelector('.moon-filter');
        const more = li.querySelector('.moon-more');
        let showAll = false;

        const draw = () => {
            const rows = moonRowsFor(p, input ? input.value : '', showAll);
            const frag = document.createDocumentFragment();
            rows.forEach(m => {
                const el = document.createElement('li');
                el.dataset.kind = 'moon';
                el.dataset.name = m.n;
                el.dataset.planet = p.name;
                el.title = moonLabel(m);
                el.innerHTML = '<span class="mname">' + esc(m.ru || m.n) + '</span>' +
                    '<i>' + moonPeriodLabel(m.period) + '</i>';
                frag.appendChild(el);
            });
            ul.innerHTML = '';
            if (rows.length) {
                ul.appendChild(frag);
            } else {
                const empty = document.createElement('li');
                empty.className = 'moon-empty';
                empty.textContent = input && input.value.trim()
                    ? 'Ничего не найдено' : 'Крупных лун нет';
                ul.appendChild(empty);
            }
            if (more) {
                const canExpand = !input || !input.value.trim();
                more.hidden = !canExpand || total <= MOON_ALL_LIMIT;
                more.textContent = showAll ? 'Только крупные' : 'Показать все ' + total;
            }
        };

        li._drawMoons = draw;
        // Показать конкретную луну: снять фильтр и раскрыть весь список.
        li._showMoon = () => {
            showAll = true;
            if (input) input.value = '';
            draw();
        };
        if (input) input.addEventListener('input', draw);
        if (more) more.addEventListener('click', () => {
            showAll = !showAll;
            draw();
        });

        // клик по шапке планеты: выбрать планету; повторный — свернуть/раскрыть
        li.querySelector('.node').addEventListener('click', () => {
            li.classList.toggle('open');
            if (li.classList.contains('open') && !li.dataset.built) {
                li.dataset.built = '1';
                draw();
            }
            selectBody({ kind: 'planet', p });
            const t = planetTarget(p);
            if (t) focusBody('planet', { p, x: t.x, y: t.y });
        });

        // клик по луне — через делегирование: строки пересобираются фильтром
        ul.addEventListener('click', e => {
            const el = e.target.closest('li[data-kind="moon"]');
            if (!el) return;
            const planet = planets.find(x => x.name === el.dataset.planet);
            const m = moonFromTree(planet, el.dataset.name);
            if (!m) return;
            selectBody({ kind: 'moon', p: planet, m });
            const t = moonTarget(planet, m);
            if (t) focusBody('moon', { m, x: t.x, y: t.y });
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

    // Пресеты камеры: «Внутренние», «Планеты», «Пояс», «Койпер», «Оорт», «Солнце».
    document.querySelectorAll('#presets [data-preset]').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.preset;
            flyToCamera(0, 0, viewZoomFor(key), 1.0);
        });
    });

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
    { name: 'Околоземные (ОЗА)',     note: 'пересекают орбиту Земли', to: 'Эрос' },
    { name: 'Троянцы Юпитера',       note: 'попутчики Юпитера',       to: 'Гектор' },
    { name: 'Кометы',                note: 'метеорные потоки',        to: 'Галлея' },
    { name: 'Пояс Койпера',          note: 'родина короткопериодических комет', region: REGION_INFO.kuiper },
    { name: 'Облако Оорта',          note: 'родина долгопериодических комет',   region: REGION_INFO.oort },
    { name: 'Марсианские метеориты', note: '≈300 найдено на Земле',   to: 'Mars', met: true },
    { name: 'Лунные метеориты',      note: '≈500 найдено на Земле',   to: 'Moon', met: true }
];

/** Цель текущего кадра для строки блока: представитель, Марс или Луна. */
function smallRowTarget(row) {
    const tg = state.hoverTargets || [];
    if (row.to === 'Mars') {
        const t = tg.find(t => t.kind === 'planet' && t.p.name === 'Mars');
        return t || null;
    }
    if (row.to === 'Moon') {
        const earth = planets.find(p => p.name === 'Earth');
        const m = (moonsByPlanet.Earth || []).find(x => x.n === 'Moon');
        const pos = state.moonPositions.get('Earth:Moon');
        if (!earth || !m || !pos) return null;
        return { kind: 'moon', name: 'Moon', x: pos.x, y: pos.y, p: earth, m };
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
    const t = smallRowTarget(row);
    if (!t) return;
    if (t.small) {
        selectBody({ kind: t.kind, name: t.name,
            orbit: t.small.poly ? { poly: t.small.poly } : t.small.orbit,
            p: null, m: null, small: t.small });
        flyToCamera(t.x, t.y, viewZoomFor(t.kind, t), 0.8);
    } else if (t.kind === 'moon') {
        selectBody({ kind: 'moon', p: t.p, m: t.m });
        flyToCamera(t.x, t.y, viewZoomFor('moon', t), 0.8);
    } else {
        selectBody({ kind: 'planet', p: t.p });
        flyToCamera(t.x, t.y, viewZoomFor('planet', t), 0.8);
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

/** Объект луны для выбора из дерева: луна из каталога moonsByPlanet. */
function moonFromTree(planet, name) {
    return (moonsByPlanet[planet.name] || []).find(m => m.n === name) || null;
}

/**
 * Выбрать объект (канвас или дерево): обновить state.selected, блок «Объект»
 * и подсветку в дереве. sel = null сбрасывает выбор.
 * Виды: {kind:'sun'|'planet'|'moon'|'small'|'region'|'base'|'group',
 *        p, m, small, region, group}.
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
        const rKm = wuToKm(SUN_R);
        html =
            '<div class="obj-title"><span class="dot" style="background:' + COLORS.sun + '"></span>' +
                '<strong>' + RU.Sun + ' / Sun</strong></div>' +
            '<div class="obj-kind">Звезда · G2V</div>' +
            '<div class="obj-rows">' +
                row('Радиус', fmtKm(rKm) + ' <em>км</em>') +
                row('Диаметр', fmtKm(rKm * 2) + ' <em>км</em>') +
                row('Масса', '1 M☉') +
                row('Угловой диаметр с Земли', fmtArcsec(angularArcsec(rKm, wuToKm(au(1)))) + ' <em>(в модели)</em>') +
            '</div>';
    } else if (sel.kind === 'planet') {
        const p = sel.p;
        const pos = state.planetPositions.get(p.name);
        const rAu = pos ? wuToAu(Math.hypot(pos.rawX, pos.rawY, pos.rawZ)) : p.aAu;
        html =
            '<div class="obj-title"><span class="dot" style="background:' + p.color + '"></span>' +
                '<strong>' + (RU[p.name] || p.name) + ' / ' + p.name + '</strong></div>' +
            '<div class="obj-kind">' + (TYPES[p.type] || 'Планета') + '</div>' +
            '<div class="obj-rows">' +
                row('Радиус', fmtKm(p.radiusKm) + ' <em>км</em>') +
                row('Диаметр', fmtKm(p.radiusKm * 2) + ' <em>км</em>') +
                row('Большая полуось', fmtAu(p.aAu) + ' <em>а.е.</em>') +
                row('Расстояние до Солнца', fmtAu(rAu) + ' <em>а.е.</em>') +
                angularFromEarthRow(p) +
                row('Период обращения', fmtPeriod(p.period)) +
                row('Наклонение / узел', p.inc.toFixed(2) + '° / ' + p.node.toFixed(1) + '°') +
                row('Известных лун', moonTotals[p.name]) +
                row('Крупных на карте', (moonsByPlanet[p.name] || []).filter(m => m.rad >= MOON_MAJOR_KM).length) +
                (p.name === 'Mars' ? row('Марсианские метеориты', '≈300 <em>на Земле</em>', 'met') : '') +
            '</div>' +
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
    } else if (sel.kind === 'group') {
        html = groupInfoHTML(sel.group);
    } else {
        const p = sel.p;
        const m = sel.m;
        const md = m.a != null ? m.a : wuToKm(moonOrbitRadius(p, 0));
        html =
            '<div class="obj-title"><span class="dot" style="background:' + (m.c || '#a8a8a8') + '"></span>' +
                '<strong>' + moonLabel(m) + '</strong></div>' +
            '<div class="obj-kind">Спутник · ' + (RU[p.name] || p.name) + '</div>' +
            '<div class="obj-rows">' +
                row('Планета', (RU[p.name] || p.name) + ' / ' + p.name) +
                row('Радиус', fmtKm(m.rad) + ' <em>км</em>') +
                row('Диаметр', fmtKm(m.rad * 2) + ' <em>км</em>') +
                row('Большая полуось', fmtKm(md) + ' <em>км</em> · ' + fmtAu(md / AU_KM) + ' <em>а.е.</em>') +
                (m.period ? row('Период обращения', fmtPeriod(m.period)) : '') +
                (m.e != null ? row('Эксцентриситет', m.e.toFixed(4)) : '') +
                (m.inc != null ? row('Наклонение', m.inc.toFixed(2) + '°') : '') +
                row('Угловой диаметр с планеты', fmtArcsec(angularArcsec(m.rad, md)) + ' <em>(в модели)</em>') +
                (p.name === 'Earth' && m.n === 'Moon' ? row('Лунные метеориты', '≈500 <em>на Земле</em>', 'met') : '') +
            '</div>' +
            basesSectionHTML('moon', p.name, m.n);
    }
    box.innerHTML = html;
    wireObjectCard(box);

    // Имя в шапке блока — как заголовок карточки (у базы — «База …», у планеты —
    // «Земля / Earth»): один источник текста, шапка и карточка не разойдутся.
    const title = box.querySelector('.obj-title strong');
    document.getElementById('objectName').textContent = title ? title.textContent : 'Объект';
}

/** Расстояние от тела до Земли в км по его raw-координатам (модель карты). */
function bodyDistanceKm(pos) {
    const e = state.planetPositions.get('Earth');
    if (!e || !pos) return null;
    return wuToKm(Math.hypot(pos.rawX - e.rawX, pos.rawY - e.rawY, pos.rawZ - e.rawZ));
}

/** Строка «угловой диаметр с Земли» для планеты; у Земли — с Солнца. */
function angularFromEarthRow(p) {
    const pos = state.planetPositions.get(p.name);
    if (p.name === 'Earth') {
        const rAu = pos ? wuToAu(Math.hypot(pos.rawX, pos.rawY, pos.rawZ)) : p.aAu;
        return row('Угловой диаметр', fmtArcsec(angularArcsec(p.radiusKm, wuToKm(au(rAu)))) +
            ' <em>(в модели, с Солнца)</em>');
    }
    const d = bodyDistanceKm(pos);
    if (!d) return row('Угловой диаметр с Земли', '—');
    return row('Угловой диаметр с Земли', fmtArcsec(angularArcsec(p.radiusKm, d)) + ' <em>(в модели)</em>');
}

/** Строка «угловой диаметр с Земли» для малого тела. */
function smallAngularRow(b) {
    if (!b.dia) return '';
    const pos = b.rawX != null ? { rawX: b.rawX, rawY: b.rawY, rawZ: b.rawZ } : null;
    const d = bodyDistanceKm(pos);
    return row('Угловой диаметр с Земли',
        (d ? fmtArcsec(angularArcsec(b.dia / 2, d)) : '—') + ' <em>(в модели)</em>');
}

const NEA_GROUPS = { amor: 'Амур', apollo: 'Аполлон', aten: 'Атон' };

/** Блок «Объект» для околоземного астероида. */
function neaInfoHTML(b) {
    const crosses = b.q < 1.017 && b.Q > 0.983;   // заходит внутрь орбиты Земли
    return '<div class="obj-title"><span class="dot" style="background:#d8d8d8"></span>' +
            '<strong>' + b.name + '</strong></div>' +
        '<div class="obj-kind">Околоземный астероид · группа «' + NEA_GROUPS[b.group] + '»</div>' +
        '<div class="obj-rows">' +
            row('Радиус', fmtKm(b.dia / 2) + ' <em>км</em>') +
            row('Диаметр', fmtKm(b.dia) + ' <em>км</em>') +
            row('Большая полуось', b.a.toFixed(3) + ' <em>а.е.</em>') +
            row('Эксцентриситет', b.e.toFixed(3)) +
            row('Период обращения', fmtPeriod(b.T)) +
            row('Перигелий / афелий', b.q.toFixed(3) + ' / ' + b.Q.toFixed(3) + ' <em>а.е.</em>') +
            row('Пересекает орбиту Земли', crosses ? 'да' : 'сближается') +
            smallAngularRow(b) +
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
            row('Радиус', fmtKm(b.dia / 2) + ' <em>км</em>') +
            row('Диаметр', fmtKm(b.dia) + ' <em>км</em>') +
            row('Орбита', 'как у Юпитера · ' + fmtAu(b.a) + ' <em>а.е.</em>') +
            row('Положение', b.camp === 4 ? 'опережает Юпитер на 60°' : 'отстаёт от Юпитера на 60°') +
            row('Период обращения', fmtPeriod(jupPeriod)) +
            row('Либрация', '±5° за ~150 лет') +
            smallAngularRow(b) +
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
            row('Радиус ядра', fmtKm(b.dia / 2) + ' <em>км</em>') +
            row('Диаметр ядра', fmtKm(b.dia) + ' <em>км</em>') +
            row('Большая полуось', b.a.toFixed(1) + ' <em>а.е.</em>') +
            row('Эксцентриситет', b.e.toFixed(4)) +
            row('Период обращения', fmtPeriod(b.T)) +
            row('Перигелий / афелий', b.q.toFixed(2) + ' / ' + b.Q.toFixed(1) + ' <em>а.е.</em>') +
            row('Источник', COMET_SRC[b.src] || '—') +
            (b.shower ? row('Метеорный поток', b.shower) : '') +
            smallAngularRow(b) +
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
        '<div class="obj-rows">' +
            row('Радиус', fmtKm(b.dia / 2) + ' <em>км</em>') +
            row('Диаметр', fmtKm(b.dia) + ' <em>км</em>') +
            row('Большая полуось', fmtAu(b.a) + ' <em>а.е.</em>') +
            row('Эксцентриситет', b.e) +
            row('Период обращения', fmtPeriod(b.T)) +
            row('Перигелий / афелий', (b.a * (1 - b.e)).toFixed(2) + ' / ' + (b.a * (1 + b.e)).toFixed(2) + ' <em>а.е.</em>') +
            smallAngularRow(b) +
        '</div>' +
        '<div class="obj-note">Пояс астероидов — главный источник метеоритов Земли</div>';
}

/**
 * Карточка группы тел: список участников (Солнце/планеты/луны/малые тела).
 * Клик по строке — полёт к телу и его выбор; так с общего плана можно
 * «разобрать» группу «Внутренние планеты · 4» или «Сатурн · 12».
 */
function groupInfoHTML(g) {
    const rows = g.members.map((b, i) => {
        const color = b.kind === 'sun' ? COLORS.sun
            : b.kind === 'planet' ? b.p.color
            : b.kind === 'moon' ? (b.m.c || '#a8a8a8')
            : '#cfcfcf';
        const kind = b.kind === 'sun' ? 'звезда'
            : b.kind === 'planet' ? 'планета'
            : b.kind === 'moon' ? 'луна'
            : 'малое тело';
        return '<div class="group-row" data-gi="' + i + '">' +
            '<span class="dot" style="background:' + color + '"></span>' +
            '<span class="gname">' + esc(b.label) + '</span>' +
            '<small>' + kind + '</small></div>';
    }).join('');
    return '<div class="obj-title"><span class="dot" style="background:' + COLORS.tooltip + '"></span>' +
            '<strong>' + esc(g.label) + '</strong></div>' +
        '<div class="obj-kind">Группа тел · ' + g.members.length + '</div>' +
        '<div class="group-list">' + rows + '</div>' +
        '<div class="obj-note">Тела ближе 28 px на экране собраны в группу — клик по строке летит к телу</div>';
}

/* ---------- Звёздные базы: секция в карточке, кнопка создания ---------- */

/** Секция «Звёздные базы» в карточке планеты/луны: список + кнопка создания. */
function basesSectionHTML(kind, planet, moon) {
    const rows = [];
    basesAt(kind, planet, moon).forEach(b => rows.push(baseRowHTML(b.id, b.name,
        'орбита ' + fmtKm(wuToKm(b.orbitRadius)) + ' км', b)));

    const active = state.baseMode && state.baseMode.kind === kind &&
        state.baseMode.planet === planet && (state.baseMode.moon || null) === (moon || null);

    const host = { kind, planet, moon: moon || null };
    const allowed = canHostBase(host);
    const list = rows.length
        ? '<div class="base-list">' + rows.join('') + '</div>'
        : '<div class="obj-note">' + (allowed
            ? 'Баз пока нет — создайте первую на орбите'
            : 'Тело слишком мало для базы (нужен радиус ≥ 50 км)') + '</div>';
    const btn = allowed
        ? '<button class="base-create' + (active ? ' active' : '') + '" id="baseCreateBtn"' +
            ' data-host-kind="' + kind + '" data-host-planet="' + planet + '" data-host-moon="' + (moon || '') + '">' +
            (active ? 'Отмена — выберите орбиту' : 'Создать базу') + '</button>'
        : '';

    return '<div class="obj-sub-title"><span>Звёздные базы</span>' +
            (rows.length ? '<small>' + rows.length + '</small>' : '') + '</div>' +
        list + btn;
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
        const m = (moonsByPlanet[rec.planet] || []).find(x => x.n === rec.moon);
        if (m) { selectBody({ kind: 'moon', name: rec.moon, p, m }); return; }
    }
    selectBody({ kind: 'planet', name: p.name, p, m: null });
}

/**
 * Оживить карточку после innerHTML: клики по строкам баз (выбор) и кнопка
 * «Создать базу» — включает режим выбора орбиты на карте (подтверждает клик,
 * отменяют Esc и правая кнопка; обработка — в input.js). У карточки базы —
 * «Войти на базу» (переход в интерьер базы, приложение ангара),
 * «Переместить базу» (тот же режим) и «Удалить базу» (запись убирается).
 * У группы тел — строки участников: полёт к телу и выбор.
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

    box.querySelectorAll('.group-row').forEach(el => {
        el.addEventListener('click', () => {
            const g = state.selected && state.selected.group;
            if (!g) return;
            const b = g.members[Number(el.dataset.gi)];
            if (!b) return;
            if (b.kind === 'sun') {
                selectBody({ kind: 'sun', name: 'Солнце / Sun' });
                flyToCamera(0, 0, viewZoomFor('sun'), 0.8);
            } else if (b.kind === 'planet') {
                selectBody({ kind: 'planet', p: b.p });
                flyToCamera(b.x, b.y, viewZoomFor('planet', { p: b.p }), 0.8);
            } else if (b.kind === 'moon') {
                selectBody({ kind: 'moon', p: b.p, m: b.m });
                flyToCamera(b.x, b.y, viewZoomFor('moon', { m: b.m }), 0.8);
            } else if (b.small) {
                selectBody({ kind: b.small.kind, name: b.label,
                    p: null, m: null, small: b.small });
                flyToCamera(b.x, b.y, MAX_ZOOM, 0.8);
            }
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
        if (state.baseMode) {
            // Стартовый радиус — 3 радиуса хозяина, дальше коридор и разведение.
            const r0 = BASE_ORBIT_K * hostRadius(state.baseMode);
            state.baseRadius = fitBaseRadius(r0, state.baseMode, null);
        }
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
        ? 'луна ' + moonHostLabel(b.planet, b.moon)
        : 'планета ' + (RU[b.planet] || b.planet);
    const removing = b.status === 'removing';   // идёт разбор: имя краснеет, под ним полоска прогресса, кнопки выключены
    const fleet = !!b.fleet;    // стартовая LUNA-ORBIT: в карточке — купленные корабли
    return '<div class="obj-title' + (removing ? ' danger' : '') + '"><span class="dot" style="background:' + COLORS.base + ';box-shadow:0 0 8px rgba(53,232,216,.6)"></span>' +
            '<strong>База ' + b.name + '</strong></div>' +
        (removing ? removalBarHTML(b) : '') +
        '<div class="obj-kind">Звёздная база · ' + host + '</div>' +
        '<div class="obj-rows">' +
            row('Радиус орбиты', fmtKm(wuToKm(b.orbitRadius)) + ' <em>км</em>') +
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

/** Русская подпись луны-хозяина базы: «Луна / Moon» → «Луна». */
function moonHostLabel(planet, name) {
    const m = (moonsByPlanet[planet] || []).find(x => x.n === name);
    return m && m.ru ? m.ru + ' / ' + m.n : (name || '—');
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

    // Группа тел: строки в дереве нет — подсвечивать нечего.
    if (sel.kind === 'group') return;

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
        // Луна могла быть не отрисована (крупные по умолчанию) — раскрываем все.
        if (!li.dataset.built && li._drawMoons) {
            li.dataset.built = '1';
            li._drawMoons();
        }
        let mEl = Array.from(li.querySelectorAll('.loot li'))
            .find(el => el.dataset.kind === 'moon' && el.dataset.name === sel.m.n);
        if (!mEl && li._showMoon) {
            li._showMoon();
            mEl = Array.from(li.querySelectorAll('.loot li'))
                .find(el => el.dataset.kind === 'moon' && el.dataset.name === sel.m.n);
        }
        if (mEl) {
            mEl.classList.add('sel');
            mEl.scrollIntoView({ block: 'nearest' });
        }
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
// Стартовый вид — «Внутренние»: вписываем орбиту Марса с запасом 5 %.
// Точное значение зависит от размера окна (0.28 при высоте 900 px).
state.zoom = fitZoom(au(1.523679), state.W, state.H);
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
