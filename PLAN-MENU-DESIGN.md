# Galaxy — новый дизайн меню на Portal-страницах

Дата: 15.10.2026. Статус: **выполнен** (коммит `feat: redesign portal menu as large portal cards`).
Область: `index.html`, `game.html`, `css/portal.css`.
Направление: **крупные карточки-порталы** в стиле лобби Fortnite/UE5 (по выбору заказчика).

## 1. Текущее состояние

- `index.html` и `game.html` используют одни и те же классы `portal.css`:
  `.portal-menu` (вертикальный grid, gap 14px) + два `.menu-btn` в стеке.
- Кнопка уже неплохо оформлена (стекло, левая акцентная полоска при ховере,
  стрелка), но это «список ссылок», а не «вход в модуль»: два одинаковых
  горизонтальных бара малой выразительности, обе одинакового размера и цвета.
- Проверено grep'ом: классы `.menu-btn/.menu-icon/.menu-name/.menu-hint/.menu-arrow`
  используются **только** в этих двух HTML-файлах. Внешних потребителей нет —
  старые классы можно удалять без фолбэков.
- `admin.html` использует отдельный `css/styles.css` и не затрагивается.

## 2. Концепция: два больших портала

Вместо стека кнопок — сетка из двух крупных карточек («порталов»), по одному
на каждый модуль системы. Каждая карточка — самостоятельный визуальный объект:
с собственным акцентным цветом, крупной иконкой-бейджем, заголовком, описанием
и призывом к действию.

Схема (десктоп, ширина панели ~920px):

```
┌─────────────────────────────────  glass-panel  ─────────────────────────────────┐
│  eyebrow · GALAXY · подзаголовок (как сейчас)                                  │
│                                                                                 │
│  ┌── portal-card (accent: cyan) ────┐   ┌── portal-card (accent: violet/pink) ─┐ │
│  │  ┌────────┐                       │   │  ┌────────┐                          │ │
│  │  │ ⚙ ico  │   АДМИНКА             │   │  │ ▶ ico  │   НОВАЯ ИГРА            │ │
│  │  └────────┘                       │   │  └────────┘                          │ │
│  │  Корабли, товары, категории,      │   │  Запуск новой партии                │ │
│  │  свойства и слоты                 │   │                                      │ │
│  │                                   │   │  ┌ badge «в разработке» ┐            │ │
│  │  ОТКРЫТЬ →                        │   │  ОТКРЫТЬ →                          │ │
│  └───────────────────────────────────┘   └──────────────────────────────────────┘ │
│  footer со статусом (как сейчас)                                                  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

Ключевые отличия от текущего вида:
1. **Размер и иерархия.** Карточка ~200px высотой, иконка-бейдж 56px,
   заголовок 20px/800. Модуль читается как «раздел», а не как строка списка.
2. **Индивидуальный акцент.** У каждой карточки свой цвет свечения:
   админка — cyan (`--cyan`), игра — violet→pink градиент. Задаётся одним
   CSS-переменным `--accent`/`--accent-2` на модификаторе `.card--admin` /
   `.card--game`, дальше весь ховер-стиль общий.
3. **Богатый ховер.** Градиентная рамка по периметру (та же mask-technique,
   что у `.glass-panel::before`), подъём `translateY(-4px)`, двойное свечение
   (тень + рамка), свечение иконки, выезд стрелки в CTA.
4. **Стагgered-появление.** Карточки въезжают по очереди (0s / .08s задержка)
   поверх уже существующего `rise`-анимации панели.
5. **Статус-бейдж.** На карточке игры — маленький бейдж «в разработке»
   (опциональный элемент, `.card-badge`), согласуется с текстом страницы game.

## 3. Изменения по файлам

### 3.1 `css/portal.css`

1. `.glass-panel`: `width: min(680px, 100%)` → `min(920px, 100%)` — места под
   две карточки.
2. Заменить блок «Меню» (строки 307–389) на новый компонент (~строки на 40
   больше):
   ```css
   .portal-menu {
     display: grid;
     grid-template-columns: repeat(2, 1fr); /* до 640px — 1 колонка */
     gap: 20px;
   }

   .portal-card {
     --accent: var(--cyan);
     --accent-2: var(--violet);
     position: relative;
     display: flex;
     flex-direction: column;
     align-items: flex-start;
     gap: 14px;
     min-height: 200px;
     padding: 26px 24px 22px;
     border-radius: 16px;
     border: 1px solid rgba(160, 190, 255, 0.18);
     background: linear-gradient(160deg, rgba(255,255,255,0.06), rgba(80,60,160,0.04) 60%, rgba(255,255,255,0.02));
     backdrop-filter: blur(12px) saturate(1.5);
     color: var(--text);
     text-decoration: none;
     overflow: hidden;
     animation: rise 0.45s ease both;
     transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
   }
   .portal-card:nth-child(2) { animation-delay: .08s; }        /* стаггер */
   .portal-card--game { --accent: var(--violet); --accent-2: var(--pink); }

   /* Градиентная рамка при ховере — mask-trick, как у .glass-panel::before */
   .portal-card::before { content: ""; position: absolute; inset: 0; border-radius: 16px;
     padding: 1px; background: linear-gradient(140deg, var(--accent), var(--accent-2));
     /* mask: content-box xor — как в существующем коде */
     opacity: 0; transition: opacity .18s ease; pointer-events: none; }

   .portal-card:hover { transform: translateY(-4px);
     border-color: transparent;
     box-shadow: 0 16px 44px rgba(40, 20, 90, .45), 0 0 34px color-mix(in srgb, var(--accent) 30%, transparent); }
   .portal-card:hover::before { opacity: 1; }
   .portal-card:focus-visible { outline: 2px solid rgba(160,140,255,.7); outline-offset: 3px; }

   .card-icon { width: 56px; height: 56px; border-radius: 14px;
     display: grid; place-items: center; color: var(--accent);
     border: 1px solid rgba(140,180,255,.2); background: rgba(8,10,26,.45);
     transition: color .18s ease, box-shadow .18s ease; }
   .portal-card:hover .card-icon { color: #bfefff;
     box-shadow: inset 0 0 16px color-mix(in srgb, var(--accent) 25%, transparent),
                 0 0 16px color-mix(in srgb, var(--accent) 30%, transparent); }

   .card-body { flex: 1; }
   .card-title { display: block; font-size: 20px; font-weight: 800; letter-spacing: .06em; }
   .card-desc  { display: block; margin-top: 6px; font-size: 13px; color: var(--muted); }
   .card-badge { display: inline-block; margin-top: 10px; padding: 3px 10px;
     font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase;
     border: 1px solid rgba(236,72,153,.45); border-radius: 999px; color: var(--pink); }

   .card-cta { font-size: 12px; font-weight: 700; letter-spacing: .18em;
     text-transform: uppercase; color: var(--muted); }
   .portal-card:hover .card-cta { color: var(--accent); }
   .card-arrow { display: inline-block; transition: transform .18s ease; }
   .portal-card:hover .card-arrow { transform: translateX(5px); }
   ```
   `color-mix` — поддержка во всех актуальных браузерах; проект открывается
   локально в Chromium — риска нет. Если нужна консервативная альтернатива —
   захардкоженные rgba на модификаторах.
3. Удалить ставшие ненужными `.menu-btn`, `.menu-icon`, `.menu-name`,
   `.menu-hint`, `.menu-arrow` и `.panel-center .menu-btn`.
4. Медиазапрос ≤560px (или поднять порог до 640px): одна колонка, карточка
   горизонтальной (иконка слева, текст справа), `min-height` убрать,
   `padding: 18px`.
5. Дописать новые классы в список `prefers-reduced-motion` (заменить
   `.menu-btn` на `.portal-card`).

### 3.2 `index.html`

Заменить содержимое `<nav class="portal-menu">` (строки 33–61) на две карточки.
SVG-иконки переносить из текущей разметки без изменений:

```html
<nav class="portal-menu">
  <a class="portal-card portal-card--admin" href="admin.html">
    <span class="card-icon" aria-hidden="true"><svg …gear…></svg></span>
    <span class="card-body">
      <span class="card-title">Админка</span>
      <span class="card-desc">Корабли, товары, категории, свойства и слоты</span>
    </span>
    <span class="card-cta">Открыть <span class="card-arrow" aria-hidden="true">→</span></span>
  </a>

  <a class="portal-card portal-card--game" href="game.html">
    <span class="card-icon" aria-hidden="true"><svg …play…></svg></span>
    <span class="card-body">
      <span class="card-title">Новая игра</span>
      <span class="card-desc">Запуск новой партии</span>
      <span class="card-badge">в разработке</span>
    </span>
    <span class="card-cta">Открыть <span class="card-arrow" aria-hidden="true">→</span></span>
  </a>
</nav>
```

Тексты ссылок, href и иконки не менять — это только визуал.

### 3.3 `game.html`

Та же замена для двух кнопок (строки 32–62): карточки «На главную»
(акцент по умолчанию — cyan) и «Открыть админку» (cyan; violet оставляем
у админки на index, чтобы цвета не перепутались со смыслом). Бейдж на этой
странице не нужен — заголовок страницы уже сообщает статус.

### 3.4 Проверка (чек-лист)

- [ ] Десктоп ≥1024px: две карточки в ряд, панель ~920px, отступы ровные.
- [ ] Ховер каждой карточки: подъём, градиентная рамка, свечение иконки,
      выезд стрелки; у админки — cyan, у игры — violet/pink.
- [ ] Клавиатура: Tab до обеих карточек, видимый focus-visible, Enter работает.
- [ ] ≤640px: одна колонка, карточки горизонтальные, без горизонтального скролла.
- [ ] `prefers-reduced-motion`: анимации появления/ховера отключены.
- [ ] `game.html`: центрированная панель (`panel-center`) не разъехалась.
- [ ] grep по репо: не осталось ссылок на `menu-btn`, `menu-icon` и т.д.
- [ ] Ссылки ведут в admin.html / game.html / index.html как раньше.

### 3.5 Коммит

Один коммит: `feat: redesign portal menu as large portal cards`
(все три файла — одна тема, разрывать нельзя: `portal.css` общий).

## 4. Оценка

~40–60 минут: CSS-компонент — основная работа, разметка — правки по 15 строк
в каждый HTML. Риск низкий: внешних потребителей классов нет, функциональность
(ссылки, тексты, иконки) не меняется.
