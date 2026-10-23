# Портал — `index.html` + `css/portal.css`

## Обзор

Главная страница проекта — точка входа, ведущая на три раздела:
Админ-панель, Карта Солнечной системы, Ангар.

### Файлы

```
index.html              # HTML портала
css/portal.css          # Стили портала
```

## Структура

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Galaxy Admin Panel</title>
  <link rel="stylesheet" href="css/portal.css">
</head>
<body>
  <div class="nebula-layer nebula-back"></div>
  <div class="nebula-layer nebula-front"></div>
  <div class="stars-layer stars-layer-1"></div>
  <div class="stars-layer stars-layer-2"></div>
  <div class="stars-layer stars-layer-3"></div>
  <div class="asteroid asteroid-1"></div>
  <div class="asteroid asteroid-2"></div>
  <div class="asteroid asteroid-3"></div>

  <div class="portal-container">
    <h1 class="portal-title">Galaxy Admin Panel</h1>
    <div class="portal-cards">
      <a href="admin/admin.html" class="portal-card">
        <div class="card-icon">📊</div>
        <h2>Admin Panel</h2>
        <p>Управление данными проекта</p>
      </a>
      <a href="space/index.html" class="portal-card">
        <div class="card-icon">🌌</div>
        <h2>Solar System</h2>
        <p>Интерактивная карта</p>
      </a>
      <a href="hangar/index.html" class="portal-card">
        <div class="card-icon">🚀</div>
        <h2>Hangar</h2>
        <p>Магазин и управление кораблями</p>
      </a>
    </div>
  </div>
</body>
</html>
```

## Анимированный фон

### Слои туманности

Два слоя с blur и mix-blend-mode:

```css
.nebula-layer {
  position: fixed;
  inset: 0;
  background: radial-gradient(ellipse at 30% 40%,
    rgba(117, 223, 210, 0.15),
    transparent 60%);
  filter: blur(60px);
  mix-blend-mode: screen;
}

.nebula-back {
  animation: nebulaDrift 30s ease-in-out infinite alternate;
}

.nebula-front {
  background: radial-gradient(ellipse at 70% 60%,
    rgba(170, 136, 246, 0.12),
    transparent 55%);
  animation: nebulaDrift 25s ease-in-out infinite alternate-reverse;
}

@keyframes nebulaDrift {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(40px, -30px) scale(1.1); }
}
```

### Слои звёзд

Три слоя с разной плотностью и анимацией twinkle:

```css
.stars-layer {
  position: fixed;
  inset: 0;
  background-image:
    radial-gradient(1px 1px at 10px 15px, white, transparent),
    radial-gradient(1px 1px at 50px 80px, white, transparent),
    /* ... ещё точки ... */;
}

.stars-layer-1 {
  animation: twinkle 4s ease-in-out infinite;
}
.stars-layer-2 {
  animation: twinkle 6s ease-in-out infinite 1s;
}
.stars-layer-3 {
  animation: twinkle 8s ease-in-out infinite 2s;
}

@keyframes twinkle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

### Анимированные астероиды

CSS-анимированные частицы с clip-path polygon:

```css
.asteroid {
  position: fixed;
  width: 8px;
  height: 6px;
  background: #555;
  clip-path: polygon(
    0% 30%, 20% 0%, 80% 10%, 100% 50%,
    85% 100%, 20% 90%, 0% 70%
  );
  animation: asteroidFly 20s linear infinite;
}

@keyframes asteroidFly {
  0% { transform: translate(100vw, 10vh) rotate(0deg); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translate(-10vw, 80vh) rotate(360deg); opacity: 0; }
}
```

## Карточки порталов

```css
.portal-container {
  position: relative;
  z-index: 10;
  max-width: 960px;
  margin: 0 auto;
  padding: 40px 20px;
}

.portal-title {
  font-family: 'Manrope', sans-serif;
  font-size: 36px;
  font-weight: 700;
  color: white;
  text-align: center;
  margin-bottom: 40px;
  text-shadow: 0 0 30px rgba(117, 223, 210, 0.4);
}

.portal-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.portal-card {
  display: block;
  text-decoration: none;
  color: inherit;
  padding: 32px 24px;
  background: linear-gradient(
    135deg,
    rgba(20, 15, 40, 0.7),
    rgba(10, 8, 20, 0.85)
  );
  backdrop-filter: blur(16px) saturate(1.6);
  border: 1px solid rgba(150, 190, 255, 0.17);
  border-radius: 6px;
  transition: transform 0.3s, border-color 0.3s, box-shadow 0.3s;
  position: relative;
  overflow: hidden;
}

/* Верхний световой край */
.portal-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg,
    transparent,
    rgba(117, 223, 210, 0.6),
    transparent
  );
}

/* Угловой акцент */
.portal-card::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg,
    rgba(117, 223, 210, 0.15),
    transparent
  );
}

.portal-card:hover {
  transform: translateY(-4px);
  border-color: rgba(117, 223, 210, 0.4);
  box-shadow: 0 8px 32px rgba(117, 223, 210, 0.15);
}

.card-icon {
  font-size: 40px;
  margin-bottom: 16px;
}

.portal-card h2 {
  font-family: 'Manrope', sans-serif;
  font-size: 20px;
  font-weight: 600;
  color: white;
  margin: 0 0 8px;
}

.portal-card p {
  font-size: 14px;
  color: var(--text-muted);
  margin: 0;
}
```

## Адаптивность

```css
/* Планшеты */
@media (max-width: 800px) {
  .portal-cards {
    grid-template-columns: 1fr;
  }
  .portal-title {
    font-size: 28px;
  }
}

/* Мобильные */
@media (max-width: 480px) {
  .portal-container {
    padding: 24px 16px;
  }
  .portal-card {
    padding: 24px 16px;
  }
}
```

## Ссылки

| Карточка | URL | Описание |
|----------|-----|----------|
| Admin Panel | `admin/admin.html` | CRUD-редактор данных |
| Solar System | `space/index.html` | Интерактивная карта |
| Hangar | `hangar/index.html` | Магазин и управление |
