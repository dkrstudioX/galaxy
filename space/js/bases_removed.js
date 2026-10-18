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
export const basesRemoved = loadRemoved();

/**
 * Перенести запись базы в архив: полная копия со статусом 'removed'.
 * Зовёт bases.js, когда у базы вышел таймер удаления.
 * @param {Object} rec запись базы
 */
export function archiveBase(rec) {
    basesRemoved.push({
        ...rec,
        status: 'removed',
        removedAt: rec.removedAt || new Date().toISOString()
    });
    saveRemoved();
}
