// =============================================================================
// sky.js — дальний фон карты: Млечный Путь, галактика Андромеды, туманности.
//
// Полностью отдельный слой, не связанный с игрой (солнце, планеты, луны, база, пояс
// астероидов, симуляция времени): рисуется в экранных координатах, камера и
// зум на него не влияют — как бесконечно далёкое небо. Собирается один раз
// в offscreen-canvas и кэшируется; на кадр остаётся одна drawImage.
//
// Геометрия: полоса Млечного Пути наклонена к плоскости карты (эклиптике)
// на ~60° — как наклон галактической плоскости к эклиптике в реальности.
// Положения объектов задаются в координатах полосы: u — вдоль оси (-1..1),
// v — поперёк, в долях длины L = hypot(W, H).
// =============================================================================

import { state } from './state.js';

const BAND_ANGLE_DEG = 60;   // наклон полосы к горизонтали экрана
const SEED = 20261018;       // сид: рисунок неба стабилен между загрузками

// mulberry32 — маленький сидированный ПСЧ.
function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

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
for (let i = 0; i < 520; i++) {
    skyStars.push({
        u: rnd(-1.08, 1.08),
        v: (rng() + rng() + rng() - 1.5) / 1.5 * 0.07,
        s: rnd(0.4, 1.2),
        a: rnd(0.12, 0.5),
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

// --- Отрисовка ------------------------------------------------------------------

let skyCanvas = null;
let skyW = 0, skyH = 0;

/** Экранная точка по координатам полосы (u вдоль, v поперёк, доли L). */
function bandPoint(u, v, W, H) {
    const a = BAND_ANGLE_DEG * Math.PI / 180;
    const L = Math.hypot(W, H);
    return {
        x: W / 2 + Math.cos(a) * u * L / 2 - Math.sin(a) * v * L,
        y: H / 2 + Math.sin(a) * u * L / 2 + Math.cos(a) * v * L
    };
}

/** Нарисовать дальний фон в экранных координатах (вызывается из render.js). */
export function drawSky(ctx) {
    if (!skyCanvas || skyW !== state.W || skyH !== state.H) buildSky();
    ctx.drawImage(skyCanvas, 0, 0);
}

/** Собрать слой неба в offscreen-canvas текущего размера окна. */
function buildSky() {
    const W = state.W, H = state.H;
    const L = Math.hypot(W, H);
    skyW = W;
    skyH = H;
    skyCanvas = document.createElement('canvas');
    skyCanvas.width = W;
    skyCanvas.height = H;
    const g = skyCanvas.getContext('2d');
    const pt = (u, v) => bandPoint(u, v, W, H);

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
