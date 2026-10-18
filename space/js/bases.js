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
// зажат в коридор baseRadiusRange: от поверхности хозяина до поверхности
// ближайшего соседа (луны планеты или планеты луны) — орбита не пересекает
// небесные тела. Период обращения — как у Луны: одни сутки на радиусе
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
// (планет/лун) передаются картой hostPos после их отрисовки.
// =============================================================================

import { state } from './state.js';
import { screenToWorld } from './math.js';
import { COLORS } from './config.js';
import { planets, moonsByPlanet, moonDist, baseOrbitRadius, basePeriod, moonOrbitRadius } from './data.js';
import { BASE_NAMES } from './bases_name.js';
import { archiveBase } from './bases_removed.js';

const STORAGE_KEY = 'galaxy_space_bases_v1';
const NAMES_KEY = 'galaxy_space_base_names_v1';   // реестр имён новых баз

// Абсолютный потолок радиуса орбиты базы (единицы мира): дальше она теряется
// на фоне системы. Нижняя граница и потолок по соседям — в baseRadiusRange().
export const BASE_MAX_R = 300;

// Запас между орбитой базы и поверхностью тел: хозяина и соседей (единицы мира).
const BASE_CLEAR = 4;

// Сколько реального времени база «разбирается» после нажатия «Удалить базу».
export const BASE_REMOVAL_MS = 30000;

/** Период обращения базы на радиусе r: как у Луны, дальше — по Кеплеру. */
export function basePeriodAt(r) {
    return basePeriod * Math.pow(r / baseOrbitRadius, 1.5);
}

/**
 * Допустимый коридор радиуса орбиты для хоста: от поверхности хозяина до
 * поверхности ближайшего соседа — лун у планеты (все их орбиты-кольца, даже
 * невидимые при текущем зуме) или самой планеты у луны. Так орбита базы
 * никогда не пересекает небесные тела, а не только «не налезает на хозяина».
 * @param {{kind: string, planet: string, moon: ?string}} host
 * @returns {{min: number, max: number}} границы радиуса, единицы мира
 */
export function baseRadiusRange(host) {
    const p = planets.find(q => q.name === host.planet);
    if (!p) return { min: BASE_CLEAR, max: BASE_MAX_R };

    if (host.kind === 'moon') {
        const list = moonsByPlanet[host.planet] || [];
        const idx = list.findIndex(m => m.n === host.moon);
        // Луна Земли рисуется отдельным блоком (render.js): своя дистанция и радиус
        const mr = idx >= 0 ? list[idx].r : 3;
        const md = idx >= 0 ? moonOrbitRadius(p, idx) : moonDist;
        const min = mr + BASE_CLEAR;
        return { min, max: Math.max(min, Math.min(BASE_MAX_R, md - p.r - BASE_CLEAR)) };
    }

    let max = BASE_MAX_R;
    (moonsByPlanet[p.name] || []).forEach((m, i) => {
        max = Math.min(max, moonOrbitRadius(p, i) - m.r - BASE_CLEAR);
    });
    if (p.name === 'Earth') max = Math.min(max, moonDist - 3 - BASE_CLEAR); // Луна Земли (r=3, render.js)
    const min = p.r + BASE_CLEAR;
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

/** Радиус орбиты: округлён до десятых и зажат в коридор хоста (baseRadiusRange). */
function radiusOf(r, host) {
    const { min, max } = baseRadiusRange(host);
    return Math.round(Math.min(Math.max(r, min), max) * 10) / 10;
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
 * @param {number} r радиус орбиты, единицы мира (клампится в коридор хоста)
 * @param {?number} ang угол от центра хоста к курсору (радианы): база появится
 *   с этой стороны; не задан — случайная точка орбиты
 */
export function createBase(host, r, ang) {
    const orbitRadius = radiusOf(r, host);
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
 * @param {number} r радиус орбиты, единицы мира (клампится)
 * @param {?number} ang угол от центра хоста к курсору (радианы); не задан —
 *   сторона орбиты у базы сохраняется
 */
export function moveBase(rec, host, r, ang) {
    if (rec.status !== 'active') return rec;   // удаляемую базу не трогаем
    rec.hostKind = host.kind;
    rec.planet = host.planet;
    rec.moon = host.moon || null;
    rec.orbitRadius = radiusOf(r, host);
    rec.period = basePeriodAt(rec.orbitRadius);
    const phase = phaseFor(ang, rec.period);
    if (phase !== null) rec.phase0 = phase;
    updateBasePlace(rec);   // реестр имён: база теперь стоит в другом месте
    saveBases();
    saveNameRegistry();
    return rec;
}

/** Сколько секунд осталось до конца удаления базы (0 — уже пора). */
export function removalSecondsLeft(rec) {
    return Math.max(0, Math.ceil((rec.removeEndsAt - Date.now()) / 1000));
}

/**
 * Начать удаление базы: статус 'removing', таймер removeEndsAt (реальное
 * время, BASE_REMOVAL_MS). Пока идёт разбор, базой нельзя пользоваться —
 * перенос и повторное удаление недоступны, а на карте и в карточке висит
 * таймер. Завершает удаление updateBaseRemovals() в кадре (main.js).
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
 * @param {Object} hostPos 'planet:Mars' / 'moon:Earth:Луна / Moon' -> {x, y}
 * @returns {Array} hoverTargets баз
 */
export function drawBases(ctx, hostPos) {
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

        drawBaseMarker(ctx, hp, b, zoom, time, orbitR);
        targets.push({
            kind: 'base', name: b.name, x: b.x, y: b.y, r: 4 / zoom,
            orbitCx: hp.x, orbitCy: hp.y, orbitR,
            local: b, moons: []
        });
    });

    if (state.baseMode) drawBasePreview(ctx, hostPos);
    return targets;
}

/** Маркер базы: орбита вокруг хоста, свечение, квадрат, пульс и подпись. */
function drawBaseMarker(ctx, hp, b, zoom, time, orbitR) {
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

    ctx.fillStyle = COLORS.base;
    ctx.font = `bold ${Math.max(9, 10 / zoom)}px monospace`;
    // у удаляемой базы в подписи тикает таймер до конца разбора
    const label = b.status === 'removing'
        ? b.name + ' · демонтаж ' + removalSecondsLeft(b) + ' с'
        : b.name;
    ctx.fillText(label, b.x + bs + 3 / zoom, b.y - 3 / zoom);
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
