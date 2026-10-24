# Основное правило оформления игры (HTML/CSS)

> **Статус: действует.** 24.10.2026.
>
> **Область действия — только HTML/CSS-интерфейс:** портал `index.html`,
> `admin/`, `space/`, `hangar/`, `demo/`. Unity-проект `GalaxyHangar/`
> этим правилом не регулируется.
>
> **Эталон — правая колонка карты `space/`:** блоки «01 Солнечная система»,
> «02 Объект», «03 Малые тела», карточка выбранного объекта и нижняя панель
> скорости с кнопками-табами «Медленнее / Нормально / Быстрее».
> Исходные значения — `space/css/style.css`. Если `docs/06-styles.md`
> расходится с этим файлом, верен этот файл.

---

## 1. Характер стиля

Интерфейс — это приборная панель корабля, а не сайт.

- Тёмный космический фон, поверх него — полупрозрачное «стекло».
- Свет и цвет работают как акценты: тонкие кромки, подсветка, маркеры.
  Заливных ярких плоскостей нет.
- Плотная, но спокойная сетка: строки низкие, отступы небольшие,
  информация читается сверху вниз.
- Скругления минимальные. Острые углы — норма, «пузыри» — нет.
- Движение только как отклик: hover, выбор, раскрытие. Без пружин,
  параллакса и декоративных анимаций в UI.

Три обязательных признака «стекла»:

1. полупрозрачный градиент с еле заметным фиолетовым уходом;
2. световая кромка сверху и угловой акцент справа сверху;
3. тонкая рамка `1px` холодного голубого оттенка.

---

## 2. Токены

Значения ниже — канонические. Новые оттенки не вводятся: если нужен
другой тон, используется существующий с другой прозрачностью.

### Фон и текст

| Токен | Значение | Где |
|---|---|---|
| Фон страницы | `#05070d` | `body` |
| Основной текст | `#dce8e8` | значения, имена |
| Мягкий текст | `#9fb3b3` | вторичные строки списка |
| Приглушённый текст | `#637a7a` | подписи, счётчики, caret |
| Тихий текст | `#7d9a9a` | пустые состояния, пояснения |
| Тусклый текст | `#5d7575` | метаданные строк |
| Текст диалога | `#8fa6a6` | тело модального окна |

### Акценты

| Токен | Значение | Где |
|---|---|---|
| Бирюза | `#75dfd2` | общий бирюзовый акцент |
| Бирюза яркая | `#bffcfc` | активные кнопки, значения-акценты |
| Бирюза базы | `#35e8d8` | маркеры баз, кнопка создания |
| Фиолет | `#aa88f6` | общий фиолетовый акцент |
| Фиолет мягкий | `#9c7ee1` | тип объекта, eyebrow |
| Фиолет подпись | `#b89cff` | номер блока, подзаголовки |
| Фиолет рамка | `#574580` | рамка номера блока |
| Опасность | `#ff5f7a` | удаление, ошибки, разбор базы |
| Предупреждение | `#ffd79a` | метеоритные строки, режим выбора |
| Предупреждение тусклое | `#b9946a` | подписи метеоритных строк |

### Рамки и стекло

| Токен | Значение |
|---|---|
| Рамка панели | `rgba(150, 190, 255, .17)` |
| Рамка активного элемента | `rgba(150, 190, 255, .20)` |
| Разделитель строки | `rgba(120, 160, 170, .10)` |
| Разделитель шапки | `rgba(150, 180, 255, .13)` |
| Слабая рамка контрола | `rgba(120, 160, 170, .18)` |
| Верхний блик стекла | `rgba(255, 255, 255, .055)` → `.015` → фиолет `.05` |
| Тень панели | `0 18px 50px rgba(2, 4, 12, .45)` |
| Свечение панели | `0 0 44px rgba(124, 58, 237, .08)` |
| Внутренняя кромка | `inset 0 1px 0 rgba(255, 255, 255, .15)` |
| Внутреннее свечение | `inset 0 0 50px rgba(90, 220, 200, .03)` |

Готовый набор для нового модуля (значения обязаны совпадать):

```css
:root {
    --bg: #05070d;
    --text: #dce8e8;
    --text-soft: #9fb3b3;
    --text-muted: #637a7a;
    --text-dim: #7d9a9a;
    --accent: #75dfd2;
    --accent-bright: #bffcfc;
    --purple: #aa88f6;
    --purple-soft: #9c7ee1;
    --purple-label: #b89cff;
    --danger: #ff5f7a;
    --warning: #ffd79a;
    --line: rgba(150, 190, 255, .17);
    --line-active: rgba(150, 190, 255, .20);
    --line-row: rgba(120, 160, 170, .10);
}
```

---

## 3. Типографика

Два шрифта, без исключений:

- **Manrope** — имена, заголовки, текст карточек;
- **IBM Plex Mono** — все служебные подписи, значения, счётчики, кнопки.

```css
@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Manrope:wght@400;500;600;700&display=swap");
```

| Роль | Шрифт | space | hangar | Регистр / трекинг |
|---|---|---|---|---|
| Заголовок блока | Manrope | 12 px / 600 | 13 px / 600 | ВЕРХНИЙ, `.09em` |
| Имя объекта в карточке | Manrope | 14 px / 600 | 15 px / 600 | как есть, `.02em` |
| Имя в списке / карточке | Manrope | 12 px / 600 | 13 px / 600 | как есть |
| Имя в дереве (луны, малые тела) | IBM Plex Mono | 12 px / 400 | 13 px / 400 | как есть |
| Значение свойства | IBM Plex Mono | 12 px / 400 | 13 px / 400 | как есть |
| Ключ свойства | IBM Plex Mono | 10 px / 500 | 11 px / 500 | ВЕРХНИЙ, `.12em` |
| Тип объекта (eyebrow) | IBM Plex Mono | 9 px / 500 | 10 px / 500 | ВЕРХНИЙ, `.19em` |
| Номер блока | IBM Plex Mono | 10 px / 500 | 11 px / 500 | как есть |
| Подпись блока (`PLANETS`) | IBM Plex Mono | 10 px / 400 | 11 px / 400 | ВЕРХНИЙ |
| Кнопка-таб | IBM Plex Mono | 9 px / 500 | 10 px / 500 | ВЕРХНИЙ, `.08em` |
| Обычная кнопка | IBM Plex Mono | 10 px / 500 | 11 px / 500 | ВЕРХНИЙ, `.12em` |
| Строка ввода | IBM Plex Mono | 11 px / 400 | 12 px / 400 | как есть |

Правило шкалы: **`space/` — базовая шкала, `hangar/` — та же шкала плюс
`1 px` к каждой роли.** Это единственное отличие типографики ангара;
цвета, стекло, отступы и геометрия у обоих модулей общие.

Правила:

- меньше `9 px` не опускаемся (в ангаре — меньше `10 px`);
- ВЕРХНИЙ РЕГИСТР — только у служебных подписей и кнопок, не у имён;
- трекинг `.08–.19em` — только у моноширинных подписей;
- числа, даты, единицы измерения — всегда IBM Plex Mono;
- третий шрифт не подключаем.

---

## 4. Сетка и размеры

| Элемент | Значение |
|---|---|
| Правая колонка | ширина `288px`, `top/right: 14px`, `gap: 10px` |
| Высота колонки | `max-height: calc(100vh - 28px)` |
| Шапка блока | `44px`, отступы `0 14px` |
| Тело дерева | `padding: 7px` |
| Тело карточки объекта | `padding: 12px 14px 14px` |
| Тело табов | `padding: 8px`, `gap: 6px` |
| Строка планеты | `min-height: 34px`, `padding: 4px 8px` |
| Строка луны | `min-height: 26px`, `padding: 3px 8px` |
| Строка свойства | `min-height: 28px`, `padding: 3px 0` |
| Строка списка | `padding: 7px 2px` |
| Нижняя панель | ширина `288px`, `bottom: 18px`, по центру |
| Радиусы | панели `0`, кнопки/поля `4px`, строки `5–6px` |
| Рамки | `1px`; угловой акцент — `2px` |

Радиус больше `6px` допускается только у пунктирного пустого состояния
(`8px`). Крупные «карточки» и мягкие пилюли запрещены.

---

## 5. Стеклянная панель

Любой самостоятельный блок интерфейса — это `.panel-block.glass`
с шапкой `.panel-head` и телом `.panel-body`. Вложенных стеклянных панелей
нет: внутри — строки, разделители и секции.

### Разметка

```html
<div class="panel-block glass">
    <div class="panel-head" title="Свернуть / развернуть">
        <div><span>01</span><strong>Солнечная система</strong></div>
        <small>PLANETS</small>
        <span class="caret">▼</span>
    </div>
    <div class="panel-body">
        <!-- строки -->
    </div>
</div>
```

- Номер в шапке — `01`, `02`, `03`, `04`; он же порядок блоков.
- `small` — короткая английская категория: `PLANETS`, `SELECTION`,
  `SMALL BODIES`, `TIME`.
- Клик по шапке сворачивает тело: класс `.collapsed` на `.panel-block`.
- Caret поворачивается на `-90deg` в свёрнутом состоянии.

### CSS

```css
.glass {
    position: relative;
    border: 1px solid rgba(150, 190, 255, .17);
    background:
        linear-gradient(150deg,
            rgba(255, 255, 255, .055) 0%,
            rgba(255, 255, 255, .015) 42%,
            rgba(120, 90, 200, .05) 100%);
    -webkit-backdrop-filter: blur(20px) saturate(1.6);
    backdrop-filter: blur(20px) saturate(1.6);
    box-shadow:
        0 18px 50px rgba(2, 4, 12, .45),
        0 0 44px rgba(124, 58, 237, .08),
        inset 0 1px 0 rgba(255, 255, 255, .15),
        inset 0 0 50px rgba(90, 220, 200, .03);
}

/* верхняя световая кромка */
.glass::before {
    content: "";
    position: absolute; top: 0; left: 7%; right: 7%; height: 1px;
    background: linear-gradient(90deg,
        transparent,
        rgba(122, 236, 224, .55),
        rgba(169, 133, 245, .55),
        transparent);
    pointer-events: none;
}

/* угловой акцент справа сверху */
.glass::after {
    content: "";
    position: absolute; top: 6px; right: 6px; width: 13px; height: 13px;
    border-top: 2px solid rgba(122, 236, 224, .75);
    border-right: 2px solid rgba(122, 236, 224, .75);
    filter: drop-shadow(0 0 4px rgba(87, 216, 195, .55));
    pointer-events: none;
}

.panel-block { display: flex; flex-direction: column; min-height: 0; }
.panel-block.hidden { display: none; }

.panel-head {
    flex: none;
    height: 44px;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 14px;
    cursor: pointer; user-select: none;
    border-bottom: 1px solid rgba(150, 180, 255, .13);
    background: linear-gradient(90deg,
        rgba(11, 28, 29, .30),
        rgba(28, 21, 47, .30));
}
.panel-head div { display: flex; align-items: center; gap: 10px; }
.panel-head div span {
    color: #b89cff;
    font: 500 10px "IBM Plex Mono", monospace;
    padding: 3px 5px;
    border: 1px solid #574580;
}
.panel-head strong {
    font-size: 12px; font-weight: 600;
    text-transform: uppercase; letter-spacing: .09em;
}
.panel-head small {
    color: #637a7a;
    font: 10px "IBM Plex Mono", monospace;
    text-transform: uppercase;
}
.panel-head .caret {
    color: #637a7a; font-size: 10px;
    transition: transform .15s ease;
}
.panel-block.collapsed .panel-head { border-bottom-color: transparent; }
.panel-block.collapsed .panel-body { display: none; }
.panel-block.collapsed .caret { transform: rotate(-90deg); }

.panel-block .panel-body {
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(120, 160, 170, .35) transparent;
}
```

Скроллбар: ширина `8px`, ползунок `rgba(120, 160, 170, .35)`,
радиус `4px`, трек прозрачный.

---

## 6. Строки списков и дерева

Общий принцип: строка — это одна строка, а не карточка. Разделитель —
тонкая линия снизу, hover — только фон, выбранное — фон + рамка + слабое
свечение.

```css
/* планета в дереве */
.tree .planet > .node {
    display: flex; align-items: center; gap: 8px;
    min-height: 34px; padding: 4px 8px; border-radius: 6px;
    cursor: pointer; user-select: none;
    border: 1px solid transparent;
    border-bottom-color: rgba(120, 160, 170, .10);
    transition: background .14s ease;
}
.tree .planet > .node:hover { background: rgba(122, 236, 224, .06); }

/* луна / малое тело */
.tree .loot li {
    min-height: 26px; padding: 3px 8px; border-radius: 5px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 8px; cursor: pointer;
    color: #9fb3b3;
    font: 12px "IBM Plex Mono", monospace;
}
.tree .loot li:hover { background: rgba(122, 236, 224, .06); }
.tree .loot li i { font-style: normal; color: #637a7a; font-size: 10px; }

/* выбранное состояние — и в дереве, и на карте */
.tree .sel > .node,
.tree li.sel {
    background: rgba(122, 236, 224, .10) !important;
    border-color: rgba(122, 236, 224, .35) !important;
    box-shadow: 0 0 12px rgba(87, 216, 195, .15);
}
```

Правила:

- имя в списках и карточках — Manrope 600 12 px; в дереве луны и малые
  тела набраны IBM Plex Mono 12 px; метаданные — IBM Plex Mono 10 px;
- длинные имена обрезаются `text-overflow: ellipsis`, а не переносятся;
- счётчик (`292`, `456`) прижат вправо и приглушён;
- маркеры: `☾` — луна, `✦` — малое тело, цветная точка — планета/база;
- эмодзи вместо маркеров не используем;
- hover не двигает строку и не меняет её размеры.

---

## 7. Кнопки-табы

Таб — это равноправная кнопка в ряду, одна из которых активна.
Эталон — панель «04 Скорость»: «Медленнее / Нормально / Быстрее».

**Активная кнопка — 1:1 с `.moon-more`** («Показать все N»):
24 px, рамка `rgba(150, 190, 255, .20)`, фон `rgba(122, 236, 224, .05)`,
цвет `#bffcfc`, радиус 4 px, IBM Plex Mono 9 px, ВЕРХНИЙ РЕГИСТР,
трекинг `.08em`.
**Неактивная** — та же геометрия, но приглушённая: прозрачный фон,
рамка `rgba(120, 160, 170, .18)`, цвет `#637a7a`.

```html
<div class="panel-block glass">
    <div class="panel-head" title="Свернуть / развернуть">
        <div><span>04</span><strong>Скорость</strong></div>
        <small>TIME</small>
        <span class="caret">▼</span>
    </div>
    <div class="panel-body tabs">
        <button class="tab" type="button">Медленнее</button>
        <button class="tab active" type="button">Нормально</button>
        <button class="tab" type="button">Быстрее</button>
    </div>
</div>
```

```css
.tabs { display: flex; gap: 6px; padding: 8px; }

.tab {
    flex: 1 1 0; min-width: 0;
    height: 24px; padding: 0 8px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid rgba(120, 160, 170, .18);
    border-radius: 4px;
    background: transparent;
    color: #637a7a;
    cursor: pointer; white-space: nowrap;
    font: 500 9px "IBM Plex Mono", monospace;
    text-transform: uppercase; letter-spacing: .08em;
    transition: color .14s ease, background .14s ease, border-color .14s ease;
}
.tab:hover {
    color: #9fb3b3;
    background: rgba(122, 236, 224, .06);
}
.tab.active {
    color: #bffcfc;
    background: rgba(122, 236, 224, .05);
    border-color: rgba(150, 190, 255, .20);
}
.tab.active:hover { background: rgba(122, 236, 224, .12); }
```

Правила:

- активное состояние — только рамка, фон и цвет; **без градиента,
  без тени, без жирного шрифта**;
- все табы одной высоты и делят ширину поровну;
- ряд табов живёт внутри `.panel-body`, а не отдельной плашкой;
- переключение — класс `.active`, ровно один активный;
- подпись короткая, одно слово или два; ВЕРХНИЙ РЕГИСТР задаётся CSS.

В `space/` эта же геометрия реализована как `#controls .btn`; при переносе
в другой модуль используем классы `.tabs` / `.tab`.

---

## 8. Карточка объекта

Карточка — это шапка с именем, тип и список свойств. Никаких вложенных
панелей и больших отступов.

```html
<div class="obj-title">
    <span class="dot" style="background:#cc5533"></span>
    <strong>Марс</strong>
</div>
<div class="obj-kind">Планета</div>
<div class="obj-rows">
    <div class="obj-row"><span class="k">Радиус</span><span class="v">3 389,5 км</span></div>
    <div class="obj-row"><span class="k">Орбита</span><span class="v">1,524 а.е.</span></div>
</div>
```

```css
#objectInfo { padding: 12px 14px 14px; }

.obj-title { display: flex; align-items: center; gap: 9px; margin-bottom: 2px; }
.obj-title .dot {
    width: 11px; height: 11px; border-radius: 50%; flex: none;
    box-shadow: 0 0 8px rgba(255, 255, 255, .3);
}
.obj-title strong { font: 600 14px "Manrope", sans-serif; letter-spacing: .02em; }
.obj-title.danger strong { color: #ff5f7a; }

.obj-kind {
    color: #9c7ee1;
    font: 500 9px "IBM Plex Mono", monospace;
    letter-spacing: .19em; text-transform: uppercase;
    margin: 0 0 10px 20px;
}

.obj-rows { display: flex; flex-direction: column; }
.obj-row {
    display: flex; align-items: baseline; justify-content: space-between;
    gap: 10px;
    min-height: 28px; padding: 3px 0;
    border-bottom: 1px solid rgba(120, 160, 170, .10);
    font: 12px "IBM Plex Mono", monospace;
}
.obj-row:last-child { border-bottom: 0; }
.obj-row .k {
    color: #637a7a; font-size: 10px;
    text-transform: uppercase; letter-spacing: .12em;
}
.obj-row .v { color: #dce8e8; text-align: right; }
.obj-row .v em { font-style: normal; color: #637a7a; font-size: 10px; margin-left: 4px; }
```

- Ключ — слева, приглушённый, ВЕРХНИЙ РЕГИСТР; значение — справа,
  основным цветом.
- Единицы измерения — в `<em>` или отдельным `<small>`, приглушённо.
- Подзаголовок секции — `.obj-sub-title`: IBM Plex Mono 10 px,
  `#b89cff`, трекинг `.16em`, линия сверху.
- Пустое состояние — пунктирная рамка `rgba(150, 190, 255, .16)`,
  фон `rgba(9, 24, 25, .30)`, текст `#7d9a9a`, радиус 8 px.
- Опасные значения (разбор базы, ошибка) — `#ff5f7a`; предупреждения —
  `#ffd79a`.
- Цвет точки планеты приходит из данных и задаётся инлайново — это
  единственное исключение из запрета на инлайновые стили в карточке.

---

## 9. Поля и вторичные кнопки

Поле ввода — тёмное, с тонкой рамкой, без свечения в покое:

```css
.field {
    height: 24px; padding: 0 8px;
    border: 1px solid rgba(120, 160, 170, .18);
    border-radius: 4px;
    background: rgba(9, 24, 25, .50);
    color: #dce8e8;
    font: 11px "IBM Plex Mono", monospace;
    outline: none;
}
.field::placeholder { color: #637a7a; }
.field:focus { border-color: rgba(122, 236, 224, .40); }
```

Обычная кнопка действия (создать, подтвердить):

```css
.btn-action {
    padding: 9px 16px;
    border: 1px solid rgba(150, 190, 255, .25);
    background: rgba(122, 236, 224, .05);
    color: #bffcfc;
    cursor: pointer;
    font: 500 10px "IBM Plex Mono", monospace;
    text-transform: uppercase; letter-spacing: .12em;
    transition: background .14s ease, border-color .14s ease;
}
.btn-action:hover {
    background: rgba(122, 236, 224, .12);
    border-color: rgba(143, 245, 227, .45);
}
```

- Кнопка создания базы — крупнее (`padding: 9px 10px`, Manrope 600 11 px),
  бирюзовая рамка `rgba(53, 232, 216, .35)`.
- Опасное действие — красный `#ff5f7a`:
  фон `rgba(255, 95, 122, .14)`, рамка `rgba(255, 95, 122, .40)`,
  текст `#ffb3c1`.
- Недоступная кнопка — приглушённая рамка и текст, `opacity: .55`,
  курсор `default`.

---

## 10. Модальные окна

Единый паттерн: тёмный оверлей с blur, панель без скруглений, eyebrow,
заголовок, квадратная «×», ряд кнопок справа.

```css
.dlg-overlay {
    position: fixed; inset: 0; z-index: 90;
    display: grid; place-items: center; padding: 24px;
    background: rgba(3, 7, 12, .62);
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
}
.dlg {
    width: min(420px, 100%);
    padding: 18px 20px 20px;
    border: 1px solid rgba(150, 190, 255, .2);
    background: linear-gradient(150deg,
        rgba(10, 26, 30, .96),
        rgba(20, 14, 36, .96));
    box-shadow: 0 24px 60px rgba(2, 4, 12, .6);
}
.dlg-head {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 12px; margin-bottom: 12px;
}
.dlg-eyebrow {
    color: #9c7ee1;
    font: 500 10px "IBM Plex Mono", monospace;
    letter-spacing: .19em; text-transform: uppercase;
}
.dlg-head h3 { margin: 6px 0 0; font-size: 17px; font-weight: 500; color: #dce8e8; }
.dlg-close {
    width: 28px; height: 28px; flex: none;
    border: 1px solid rgba(150, 190, 255, .2);
    background: transparent; color: #cdd9dc;
    font-size: 17px; line-height: 1; cursor: pointer;
}
.dlg-close:hover { border-color: rgba(143, 245, 227, .45); }
.dlg-text { color: #8fa6a6; font-size: 12.5px; line-height: 1.55; }
.dlg-text b { color: #dce8e8; font-weight: 600; }
.dlg-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
```

В ангаре и админке классы могут называться иначе (`.slot-modal` /
`.slot-dialog`, `.overlay` / `.modal`). Их визуальные значения приводим
к эталону: оверлей `rgba(3, 7, 12, .62)` + blur `6px`, панель без радиуса,
eyebrow фиолетовый, «×» 28×28.

---

## 11. Движение

- Только короткие переходы: `.12s`, `.14s`, `.15s`, `ease`.
- Меняем `color`, `background`, `border-color`, `transform` (caret).
- Hover обязателен у любой интерактивной строки и кнопки.
- Нажатие не должно «прыгать»: без `scale`, `translate` и теней.
- Анимации `@keyframes` допустимы только для прогресса (разбор базы)
  и фоновых эффектов карты, не для появления панелей.
- `:focus-visible` — тонкая бирюзовая рамка
  `1px solid rgba(122, 236, 224, .55)` с отступом `2px`.

---

## 12. Запреты

- Свои палитры, шрифты, иконки-эмодзи.
- Градиентная заливка активной кнопки/таба (старый стиль скорости удалён).
- Скругления больше `6px` у панелей, кнопок и строк (кроме пунктирного
  пустого состояния — `8px`).
- Яркие заливные плоскости, неоновые тени, толстые рамки.
- Вложенные стеклянные панели и «карточки в карточках».
- Крупные отступы и воздух «как на лендинге»: интерфейс плотный.
- Текст меньше `9px` (в ангаре — меньше `10px`); трекинг у обычного текста.
- Анимации появления, пружины, параллакс в UI.
- Инлайновые стили, кроме динамических значений (ширина линейки масштаба,
  цвет точки планеты).
- Новые CSS-фреймворки и UI-киты.

---

## 13. Чек-лист нового экрана

- [ ] Фон `#05070d`, поверх — `.panel-block.glass`.
- [ ] У панели есть шапка 44 px с номером, заголовком, `small` и caret.
- [ ] Верхняя световая кромка и угловой акцент на месте.
- [ ] Ширина правой колонки 288 px, отступы 14 px, зазор 10 px.
- [ ] Только Manrope + IBM Plex Mono, размеры из таблицы.
- [ ] Цвета — из токенов, без новых оттенков.
- [ ] Строки с разделителем `rgba(120, 160, 170, .10)` и hover.
- [ ] Активный таб 1:1 с `.moon-more`, неактивные приглушены.
- [ ] Карточка: имя Manrope 600 14, тип — фиолетовый eyebrow 9 px,
      свойства — строки «ключ → значение».
- [ ] Модалка — оверлей с blur, панель без радиуса, квадратная «×».
- [ ] Проверено рядом с `space/`: элемент не выбивается из стиля.

---

## 14. Применение к модулям

| Модуль | Что делаем |
|---|---|
| `space/` | Эталон. Новые блоки — строго по этому файлу. |
| `hangar/` | Сохраняем сетку и сценарий, но панели, строки, кнопки и модалки приводим к токенам; шрифт — на 1 px крупнее, чем в `space/`. |
| `admin/` | Таблицы и формы — те же рамки, типографика, hover; плотные строки, без крупных карточек. |
| `demo/` | HUD-панели — стекло, моноширинные подписи, тонкие разделители. |
| `index.html` | Навигационные блоки — стекло + eyebrow + заголовок; без новых палитр. |
| `GalaxyHangar/` | Не регулируется: это Unity-проект. |

`docs/06-styles.md` остаётся справочником по модулям и историческим
вариантам. При расхождении с этим файлом действует `docs/STYLE.md`.
