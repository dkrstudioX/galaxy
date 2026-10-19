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

import { state } from './state.js';
import { screenToWorld } from './math.js';
import { COLORS, SUN_R, ISO_K, LIFT } from './config.js';
import { planets, moonsByPlanet, moonDist, baseOrbitRadius, basePeriod, moonOrbitRadius } from './data.js';
import { BASE_NAMES } from './bases_name.js';
import { archiveBase } from './bases_removed.js';
import { placeLabel } from './scene.js';
import { orbitEllipsePath, rawAngle } from './iso.js';
import { diamond, glow } from './paint.js';

const STORAGE_KEY = 'galaxy_space_bases_v1';
const NAMES_KEY = 'galaxy_space_base_names_v1';   // реестр имён новых баз

// Абсолютный потолок радиуса орбиты базы (единицы мира): дальше она теряется
// на фоне системы. Нижняя граница и потолок по соседям — в baseRadiusRange().
export const BASE_MAX_R = 300;

// Запас между орбитой базы и поверхностью тел: хозяина и соседей (единицы мира).
const BASE_CLEAR = 4;

// Минимальный зазор между орбитами двух баз одного хозяина: кольца не
// сливаются в одно. Если коридор уже забит и свободного места нет (у лун места
// мало), база встаёт в точку с наибольшим зазором — см. fitRadius.
const BASE_SAME_GAP = 3;

// Сколько реального времени база «разбирается» после нажатия «Удалить базу».
export const BASE_REMOVAL_MS = 4000;

// Невидимая «панель» подписи базы на карте: одна ширина на все базы, экранные
// пиксели (сама панель не рисуется — ни фона, ни рамки). Имя длиннее панели
// подрезается с «…», при наведении на базу едет бегущей строкой, а полоска
// разбора при удалении тянется во всю панель.
const BASE_LABEL_W = 96;

// Бегущая строка подписи: id базы -> момент начала наведения (performance.now),
// пока курсор на базе. Чисто экранная память — в хранилище не попадает.
const labelScrollFrom = new Map();

/** Период обращения базы на радиусе r: как у Луны, дальше — по Кеплеру. */
export function basePeriodAt(r) {
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
export function baseRadiusRange(host) {
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
export const bases = loadBases();

/** Ключ хоста: 'planet:Mars' или 'moon:Mars:Фобос / Phobos'. */
export function hostKey(kind, planet, moon) {
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
export function fitBaseRadius(r, host, exceptId) {
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
export function baseNamesRegistry() {
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
export function createBase(host, r, ang) {
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
export function moveBase(rec, host, r, ang) {
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
export function removalProgress(rec) {
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
export function startBaseRemoval(rec) {
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
export function updateBaseRemovals() {
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
export function basesAt(kind, planet, moon) {
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
export function drawBases(ctx, hostPos, quietIds) {
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
