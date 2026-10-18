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

import { state } from './state.js';

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
export function drawSky(ctx) {
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
