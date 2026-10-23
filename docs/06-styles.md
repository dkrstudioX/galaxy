# Стилизация — Общий стиль проекта

## Обзор

Все модули (space, hangar, admin, demo) используют единый стиль:
тёмная тема, стеклянные панели, бирюзово-фиолетовые акценты.
Шрифты Manrope (текст) и IBM Plex Mono (служебные подписи).

## Цветовая палитра

### Основные цвета

```css
/* Фон */
--bg: #06040e;              /* Основной тёмный фон */
--bg-panel: rgba(15, 12, 30, 0.8);  /* Фон панелей */

/* Акценты */
--accent-teal: #75dfd2;     /* Бирюзовый */
--accent-purple: #aa88f6;   /* Фиолетовый */
--accent-cyan: #bffcfc;     /* Голубой */
--accent-holo: #7fe8ff;     /* Голографический (hangar) */
--accent-purple-admin: #a855f7;  /* Фиолетовый (admin) */
--accent-cyan-admin: #37c9ee;    /* Голубой (admin) */

/* Ошибки / опасности */
--danger: #ff5f7a;          /* Красный */
--danger-rgba: rgba(255, 95, 122, 0.15);

/* Успех */
--success: #5fe8a0;         /* Зелёный */

/* Текст */
--text: #e0e0e8;            /* Основной текст */
--text-muted: #8888a0;      /* Приглушённый текст */
--text-bright: #ffffff;     /* Яркий текст (тултипы) */
```

### Палитра планет (space)

```javascript
// config.js
COLORS: {
  sun: '#ffcc33',
  mercury: '#a0a0a0',
  venus: '#e8cda0',
  earth: '#4488cc',
  mars: '#cc5533',
  jupiter: '#ddaa77',
  saturn: '#ddcc88',
  uranus: '#88ccdd',
  neptune: '#4466cc',
  orbit: 'rgba(150, 190, 255, 0.25)',
  star: '#ffffff',
  base: '#75dfd2'
}
```

## Шрифты

```css
/* Подключение */
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

/* Использование */
body {
  font-family: 'Manrope', sans-serif;
}

.service-label,
.eyebrow,
.panel-head span {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
}
```

## Glass Panels (Стеклянные панели)

### Базовый паттерн

```css
.glass {
  background: linear-gradient(
    135deg,
    rgba(20, 15, 40, 0.75),
    rgba(10, 8, 20, 0.85)
  );
  backdrop-filter: blur(16px) saturate(1.6);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
  border: 1px solid rgba(150, 190, 255, 0.17);
  border-radius: 4px;
}
```

### Варианты

```css
/* Прозрачнее */
.glass-light {
  background: rgba(15, 12, 30, 0.5);
  backdrop-filter: blur(12px) saturate(1.4);
  border-color: rgba(150, 190, 255, 0.12);
}

/* Плотнее */
.glass-heavy {
  background: rgba(10, 8, 25, 0.9);
  backdrop-filter: blur(20px) saturate(1.8);
  border-color: rgba(150, 190, 255, 0.25);
}

/* С акцентом */
.glass-accent {
  border-color: rgba(127, 232, 255, 0.25);
  box-shadow: 0 0 20px rgba(127, 232, 255, 0.08);
}
```

## Скругления

Минимальные, без "пузырей":

```css
/* Стандарт */
border-radius: 4px;

/* Минимальный */
border-radius: 0px;

/* Небольшой */
border-radius: 6px;

/* Кнопки */
border-radius: 4px;

/* Карточки статистики */
border-radius: 8px;

/* Модалки */
border-radius: 8px;
```

## Модальные окна

### Ангар: `.slot-modal` + `.slot-dialog`

```html
<div class="slot-modal">
  <div class="slot-dialog">
    <span class="eyebrow">EQUIPMENT</span>
    <h2 class="dialog-title">Weapon Slot 01</h2>
    <div class="dialog-body">
      <!-- содержимое -->
    </div>
    <button class="dialog-close">×</button>
  </div>
</div>
```

```css
.slot-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.slot-dialog {
  background: linear-gradient(135deg, rgba(20, 15, 40, 0.95), rgba(10, 8, 20, 0.98));
  border: 1px solid rgba(150, 190, 255, 0.2);
  border-radius: 6px;
  padding: 24px;
  max-width: 480px;
  width: 90%;
  position: relative;
}

.dialog-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 28px;
  height: 28px;
  background: rgba(255, 95, 122, 0.1);
  border: 1px solid rgba(255, 95, 122, 0.3);
  border-radius: 4px;
  color: #ff5f7a;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### Админка: `.overlay` + `.modal`

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s;
}

.modal {
  background: var(--bg-panel);
  border: 1px solid rgba(168, 85, 247, 0.2);
  border-radius: 8px;
  padding: 24px;
  max-width: 600px;
  width: 90%;
  max-height: 85vh;
  overflow-y: auto;
  animation: slideUp 0.3s;
}
```

### Карта: `.dlg-*`

```css
.dlg-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dlg {
  background: linear-gradient(135deg, rgba(15, 12, 30, 0.95), rgba(8, 6, 20, 0.98));
  border: 1px solid rgba(150, 190, 255, 0.2);
  border-radius: 6px;
  padding: 20px;
  min-width: 320px;
  max-width: 420px;
}

.dlg-title {
  font-family: 'Manrope', sans-serif;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-bright);
  margin: 0 0 12px;
}

.dlg-body {
  font-size: 14px;
  color: var(--text);
  margin-bottom: 16px;
}
```

## Анимации

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes twinkle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
```

## Утилитарные классы

```css
/* Текст */
.text-muted { color: var(--text-muted); }
.text-bright { color: var(--text-bright); }
.text-teal { color: var(--accent-teal); }
.text-purple { color: var(--accent-purple); }
.text-danger { color: var(--danger); }

/* Выравнивание */
.text-center { text-align: center; }
.text-right { text-align: right; }

/* Интервалы */
.mt-8 { margin-top: 8px; }
.mt-12 { margin-top: 12px; }
.mt-16 { margin-top: 16px; }
.mb-8 { margin-bottom: 8px; }
.mb-12 { margin-bottom: 12px; }
.mb-16 { margin-bottom: 16px; }

/* Flex */
.flex { display: flex; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }
.gap-8 { gap: 8px; }
.gap-12 { gap: 12px; }
```

## Адаптивность

```css
/* Breakpoints */
@media (max-width: 1400px) { /* Средние экраны */ }
@media (max-width: 1200px) { /* Планшеты */ }
@media (max-width: 800px)  { /* Мобильные */ }
@media (max-width: 480px)  { /* Маленькие мобильные */ }
```

## Специфичные паттерны по модулям

### Space
- Canvas-first: весь рендер на `<canvas id="c">`
- Боковая панель поверх canvas
- Тултипы без рамки (белый текст с тенью)
- .tree для навигации по телам

### Hangar
- 4-колоночная сетка
- Scanline overlay эффект
- Ship glyph SVG (wireframe)
- .slot-tip для тултипов слотов
- .slot-modal для модалок

### Admin
- Sidebar + main layout
- Stat cards с hover lift
- Dense tables с hover highlights
- Form inputs с glow на focus
- .toast для уведомлений

### Demo
- HUD panels поверх canvas
- Resource chips
- Cockpit view (3D)
- Minimal UI (только нужное)
