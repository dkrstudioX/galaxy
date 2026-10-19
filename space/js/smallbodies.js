// =============================================================================
// smallbodies.js — малые тела Солнечной системы отдельным слоем мира:
// главный пояс (частицы + крупнейшие тела + щели Кирквуда), околоземные
// астероиды (Атон/Аполлон/Амур), троянцы Юпитера (L4/L5), кометы, пояс
// Койпера и облако Оорта.
//
// Именованные тела (крупнейшие тела пояса, именованные ОЗА, троянцы L4/L5,
// кометы) слипаются по экранному расстоянию общим правилом scene.js
// clusterBodies: smallBodyList() отдаёт их позиции в кадр, а drawSmallBodies
// рисует точками только показанные (id — в наборе shown); имена слипшихся
// уходят в подпись группы у тела-представителя (её рисует render.js общей
// drawGroupLabel). Безымянные досыпанные ОЗА, частицы пояса, облака троянцев и
// пыль дальних поясов в правило не входят: их не выбирают.
//
// Каждое тело — сущность со своим типом (kind) и id: в будущем появится
// добыча/уничтожение астероидов, поэтому генерация выполняется при каждом
// запуске и детерминирована (сидированный ПСЧ) — пояс стабилен между
// загрузками, а уничтоженные можно будет исключать по id.
//
// Позиции считаются каждый кадр из общего simDays — как у планет. Элементы
// орбит реальные (a, e, долгота перигелия), карта — 2D-плоскость эклиптики.
// =============================================================================

import { state } from './state.js';
import { makeRng, auToDist, keplerPos, periodFromA, orbitAngle, clamp } from './math.js';
import { planets, beltNotables, neas, trojanNames, comets } from './data.js';
import { STROKE } from './config.js';

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
export const asteroids = [];
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
export const notables = beltNotables.map(b => ({
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

export const neaBodies = neas.map(n =>
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

export const trojanClouds = [
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

export const trojanBodies = trojanNames.map(t => ({
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
export const cometBodies = comets.map(c =>
    smallBody('comet-' + c.n, 'comet', c.ru + ' / ' + c.n, c, 1.4,
        { shower: c.shower, src: c.src, tailK: c.tailK, ru: c.ru }));

/**
 * Позиции всех именованных малых тел кадра — для общего правила слипания
 * (scene.js clusterBodies): крупнейшие тела пояса, именованные ОЗА, троянцы и
 * кометы. Безымянные (частицы пояса, досыпанные ОЗА, облака троянцев, пыль
 * дальних поясов) сюда не входят: их не выбирают и в подписи они не попадают.
 * Движение — то же, что в drawSmallBodies: у троянцев синхронно с Юпитером
 * плюс либрация, у остальных — элементы Кеплера из data.js. Позиции кладутся в
 * сами записи тел (b.x, b.y) — ими же рисует drawSmallBodies.
 * @returns {Array} записи { id, kind, small, r, x, y, label } — label для подписи
 */
export function smallBodyList() {
    const { simDays } = state;
    const jupAng = orbitAngle(JUPITER.l0, JUPITER.period, simDays);
    const list = [];

    function add(b, kind) {
        list.push({ id: b.id, kind, small: b, r: b.r, x: b.x, y: b.y, label: b.ru || b.name });
    }

    notables.forEach(b => {
        const pos = keplerPos(b.a, b.e, b.peri, b.m0, b.T, simDays);
        b.x = pos.x;
        b.y = pos.y;
        add(b, 'asteroid');
    });

    neaBodies.forEach(b => {
        const pos = keplerPos(b.a, b.e, b.peri, b.m0, b.T, simDays);
        b.x = pos.x;
        b.y = pos.y;
        b.rAu = pos.rAu;   // кометам и ОЗА — для хвоста/подписи
        if (b.name) add(b, 'nea');
    });

    trojanBodies.forEach(b => {
        const ang = jupAng + b.camp * Math.PI / 3
            + (b.dAng + trojanLib(simDays, b.camp)) * Math.PI / 180;
        const rr = JUPITER.dist + b.dR;
        b.x = Math.cos(ang) * rr;
        b.y = -Math.sin(ang) * rr;
        add(b, 'trojan');
    });

    cometBodies.forEach(b => {
        const pos = keplerPos(b.a, b.e, b.peri, b.m0, b.T, simDays);
        b.x = pos.x;
        b.y = pos.y;
        b.rAu = pos.rAu;
        add(b, 'comet');
    });

    return list;
}

/**
 * Нарисовать малые тела в мировой системе координат (вызывается из render.js
 * после звёзд). Пыль и частицы пояса рисуются всегда, именованные тела —
 * только показанные общим правилом слипания (scene.js clusterBodies):
 * показанные становятся точками и hover-целями, а имена слипшихся уходят в
 * подпись группы у тела-представителя (её рисует render.js общей
 * drawGroupLabel). Позиции именованных тел считает smallBodyList — render.js
 * зовёт его в начале кадра, здесь они уже готовы.
 * @param {Set} shown id показанных именованных тел (представители групп)
 * @returns {Array} targets — hover-цели показанных тел
 */
export function drawSmallBodies(ctx, shown) {
    const { simDays, zoom } = state;
    const targets = [];
    const jupAng = orbitAngle(JUPITER.l0, JUPITER.period, simDays);

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
    notables.forEach(b => {
        if (!shown.has(b.id)) return;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = '#cfcfcf';
        ctx.fill();
        ctx.strokeStyle = '#efefef';
        ctx.lineWidth = STROKE.moon / zoom;
        ctx.stroke();

        targets.push({ kind: 'asteroid', name: b.name, x: b.x, y: b.y, r: b.r, moons: [], small: b });
    });

    // ОЗА: безымянные досыпанные — тусклые точки всегда (в правило слипания не
    // входят, их не выбирают), именованные — как остальные тела: точкой и
    // hover-целью только когда показаны (позиции посчитаны в smallBodyList)
    ctx.fillStyle = '#8a8a8a';
    neaBodies.forEach(b => {
        if (b.name) return;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
    });

    neaBodies.forEach(b => {
        if (!b.name || !shown.has(b.id)) return;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = '#d8d8d8';
        ctx.fill();
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = STROKE.moon / zoom;
        ctx.stroke();
        targets.push({ kind: 'nea', name: b.name, x: b.x, y: b.y, r: b.r, moons: [], small: b });
    });

    // Троянцы: два облака точек, синхронных с Юпитером (плюс либрация)
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
    // посчитаны в smallBodyList, рисуются только показанные
    trojanBodies.forEach(b => {
        if (!shown.has(b.id)) return;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = '#cfcfcf';
        ctx.fill();
        ctx.strokeStyle = '#efefef';
        ctx.lineWidth = STROKE.moon / zoom;
        ctx.stroke();

        targets.push({ kind: 'trojan', name: b.name, x: b.x, y: b.y, r: b.r, moons: [], small: b });
    });

    // Кометы: ядро, кома и хвост, направленный от Солнца. Рисуются только
    // показанные (позиции и rAu посчитаны в smallBodyList); хвост — в пикселях
    // экрана, поэтому его длина делится на зум.
    cometBodies.forEach(b => {
        if (!shown.has(b.id)) return;

        const pf = clamp(b.q / Math.max(b.rAu, 0.001), 0, 1);   // близость к перигелию
        const len = (26 + 46 * pf) * b.tailK / zoom;            // хвост в пикселях экрана
        const d = Math.hypot(b.x, b.y) || 1;
        const dx = b.x / d, dy = b.y / d;                       // от Солнца

        // хвост: сужающийся треугольник вдоль антисолнечного луча
        const w0 = 1.6 / zoom;
        const tipX = b.x + dx * len, tipY = b.y + dy * len;
        const grad = ctx.createLinearGradient(b.x, b.y, tipX, tipY);
        grad.addColorStop(0, 'rgba(230,230,230,0.42)');
        grad.addColorStop(0.55, 'rgba(225,225,225,0.15)');
        grad.addColorStop(1, 'rgba(220,220,220,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(b.x - dy * w0, b.y + dx * w0);
        ctx.lineTo(b.x + dy * w0, b.y - dx * w0);
        ctx.lineTo(tipX, tipY);
        ctx.closePath();
        ctx.fill();

        // кома — радиальное свечение вокруг ядра
        const comaR = 9 / zoom;
        const coma = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, comaR);
        coma.addColorStop(0, 'rgba(235,235,235,0.5)');
        coma.addColorStop(0.5, 'rgba(220,220,220,0.16)');
        coma.addColorStop(1, 'rgba(220,220,220,0)');
        ctx.fillStyle = coma;
        ctx.beginPath();
        ctx.arc(b.x, b.y, comaR, 0, Math.PI * 2);
        ctx.fill();

        // ядро
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = '#f0f0f0';
        ctx.fill();

        targets.push({ kind: 'comet', name: b.name, x: b.x, y: b.y, r: b.r, moons: [], small: b });
    });

    return targets;
}
