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

import { au, km } from './units.js';
import { moonCatalog } from './moons_data.js';

// Планеты. radiusKm/aAu оставлены для карточек и JSON: r и dist — уже
// пересчитанные мировые единицы.
export const planets = [
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
export function planetM0(p) {
    return p.l0 - p.peri;
}

// Луна Земли: значения остаются экспортами для баз и старых карточек, но
// рисуется она из общего каталога — отдельного блока в render.js больше нет.
export const moonDist = km(384400);        // большая полуось Луны, wu
export const moonPeriod = 27.321661;       // сидерический период, сутки

// Базы игрока: период задаётся в bases.js относительно 3R хозяина (один виток
// в сутки на стартовой орбите). Здесь остаётся только опорное значение.
export const basePeriod = 1;

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
export const moonsByPlanet = {};
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
export function moonOrbitRadius(p, i) {
    const list = moonsByPlanet[p.name] || [];
    const m = list[i];
    return m ? km(m.a) : p.r * 2;
}

/** Группы лун для дерева: крупные (rad ≥ 100 км) первыми, затем остальные. */
export const moonTree = {};
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
export const moonTotals = {
    Mercury: 0, Venus: 0, Earth: 1, Mars: 2,
    Jupiter: 115, Saturn: 292, Uranus: 30, Neptune: 16
};

/* ---------- Малые тела (карта: smallbodies.js) ---------- */

// Крупнейшие тела главного пояса: Церера (карликовая планета), Веста, Паллада,
// Гигея. a — а.е., e — эксцентриситет, peri — долгота перигелия (град.),
// m0 — средняя аномалия на J2000 (град., произвольная фаза карты),
// dia — диаметр (км). Период считается по третьему закону Кеплера.
export const beltNotables = [
    { n: 'Ceres',  ru: 'Церера',  a: 2.7675, e: 0.0785, peri: 73.6,  m0: 95,  dia: 939, inc: 10.59, node: 80.3,  type: 'dwarf' },
    { n: 'Vesta',  ru: 'Веста',   a: 2.3615, e: 0.0887, peri: 151.2, m0: 210, dia: 525, inc: 7.14,  node: 103.8 },
    { n: 'Pallas', ru: 'Паллада', a: 2.7727, e: 0.2313, peri: 310.0, m0: 42,  dia: 512, inc: 34.84, node: 173.0 },
    { n: 'Hygiea', ru: 'Гигея',   a: 3.1395, e: 0.1067, peri: 313.2, m0: 152, dia: 434, inc: 3.83,  node: 283.2 }
];

// Околоземные астероиды (реальные элементы; m0 — произвольная фаза карты).
// Группы: amor — перигелий между орбитами Земли и Марса, орбиту Земли не
// пересекают; apollo — пересекают орбиту Земли, a > 1 а.е.; aten — пересекают,
// a < 1 а.е. Тутатис — «переходный»: афелий 4.1 а.е. — заходит в пояс.
export const neas = [
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
export const trojanNames = [
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
export const comets = [
    { n: '1P/Halley',        ru: 'Галлея',         a: 17.834, e: 0.9671, peri: 111.3, m0: 234, dia: 11, inc: 162.26, node: 58.42,  shower: 'Ориониды · Эта-Аквариды', src: 'oort',   tailK: 1.0 },
    { n: '2P/Encke',         ru: 'Энке',           a: 2.2151, e: 0.8483, peri: 187.6, m0: 323, dia: 4.8, inc: 11.78,  node: 334.57, shower: 'Тауриды',                src: 'kuiper', tailK: 0.75 },
    { n: '109P/Swift-Tuttle', ru: 'Свифта—Таттла', a: 26.09,  e: 0.9633, peri: 113.4, m0: 289, dia: 26, inc: 113.45, node: 139.40, shower: 'Персеиды',               src: 'oort',   tailK: 1.0 },
    { n: 'C/1995 O1',        ru: 'Хейла—Боппа',    a: 186.0,  e: 0.9951, peri: 130.6, m0: 0,   dia: 60, inc: 89.43,  node: 282.47, shower: null,                     src: 'oort',   tailK: 0.9 }
];
