# Слой данных — `data/store.js`

## Обзор

`data/store.js` — центральный репозиторий данных всего проекта. Все модули
(админка, ангар, карта) используют этот модуль для чтения и записи данных.

### Хранение

- **Механизм**: `localStorage`
- **Ключ**: `galaxy_admin_db_v1`
- **Формат**: один JSON-объект, сериализованный в строку
- **Версионирование**: номер версии в ключе — при изменении схемы данных
  меняется ключ (например, `galaxy_admin_db_v2`)

### Структура данных

```json
{
  "props": {
    "id": {
      "id": "prop_mass",
      "name": "mass",
      "value": 10,
      "unit": "kg"
    }
  },
  "slots": {
    "id": {
      "id": "slot_weapon_01",
      "name": "Weapon Slot 01",
      "slotId": "weapon",
      "icon": "weapon"
    }
  },
  "categories": {
    "id": {
      "id": "cat_ships",
      "name": "Ships",
      "type": "ships",
      "parent": null,
      "icon": "ship",
      "order": 0
    }
  },
  "objects": {
    "id": {
      "id": "obj_freighter",
      "name": "Freighter X1",
      "categoryId": "cat_ships",
      "price": 500000,
      "mass": 1000,
      "icon": "ship",
      "slots": [...],
      "holds": [...],
      "prop_2": [...]
    }
  },
  "users_ships": {
    "shipId": {
      "id": "ship_abc123",
      "objectId": "obj_freighter",
      "slots": [...],
      "holds": [...],
      "credits": 3500000
    }
  }
}
```

### Коллекции

| Коллекция | Назначение |
|-----------|-----------|
| `props` | Свойства/атрибуты (mass, speed, power и т.д.) |
| `slots` | Точки крепления оборудования на корабле |
| `categories` | Категории объектов (древовидная структура) |
| `objects` | Объекты: корабли, оборудование, ресурсы |
| `users_ships` | Корабли пользователя с заполненными слотами и трюмами |

## API Store

### Загрузка и сохранение

```javascript
Store.ensure()   // Загружает данные из localStorage, инициализирует пустые коллекции
Store.persist()  // Сериализует данные и записывает в localStorage
```

`Store.ensure()` вызывается при старте каждого модуля. Если данные в
localStorage отсутствуют — создаёт пустые коллекции.

### Базовый CRUD

```javascript
Store.all(collectionName)        // Все записи коллекции (объект {id: record})
Store.byId(collectionName, id)   // Запись по ID (null если не найдена)
Store.insert(collectionName, obj)// Вставка новой записи (генерирует id)
Store.patch(collectionName, id, partialObj)  // Частичное обновление
Store.drop(collectionName, id)   // Удаление записи
```

### Экономика

```javascript
Store.buyForShip(shipId, objectId, qty)
// Покупка: оборудование → слот → трюм; ресурсы → первый совместимый контейнер
// Возвращает { ok: true } или { ok: false, reason: "..." }

Store.sellCargo(shipId, objectId, qty)
// Продажа единицы груза из корабля

Store.sellEntry(shipId, entryId)
// Продажа объекта из users_ships (груз или оборудование)

Store.sellShip(shipId)
// Полная продажа корабля со всем снаряжением и грузом
// Возвращает { ok: true, value: number } — общая стоимость

Store.buyShip(shipId, objectId)
// Покупка нового корабля пользователю

Store.creditsOfShip(shipId)
// Получение баланса кредитов корабля
```

### Массы и ёмкости

```javascript
Store.shipMass(shipId)
// Рекурсивная масса корабля: корпус + оборудование + груз
// Ресурсы имеют массу 1 кг за единицу; оборудование — по свойству mass

Store.holdFree(shipId, holdIndex)
// Свободное место в трюме (масса)

Store.containerFree(shipId, containerIndex)
// Свободное место в контейнере (prop_2 — список совместимых материалов)

Store.massValue(obj)
// Масса одного объекта (из props или 1 кг для ресурсов)

Store.cargoUnitsOf(shipId, mass)
// Сколько единиц объекта помещается в свободное место
```

### Каталог и категории

```javascript
Store.catalogGroups()
// Возвращает { equipment: [...], resources: [...], ships: [...] }
// Три корневые группы каталога

Store.ensureCatalogGroups()
// Идемпотентная миграция: создаёт 3 корневые группы если нет

Store.categoryTree()
// Полное дерево категорий {id: {children: [...]}}

Store.categoryChain(catId)
// Массив ID от корня до категории (включая саму категорию)

Store.categoryDescendants(catId)
// Все подкатегории (рекурсивно)

Store.chainProps(catId)
// Все свойства, унаследованные от родительских категорий

Store.inheritedProps(catId)
// Свойства, которые объект получает от своей категории и предков
```

### Импорт / Экспорт

```javascript
Store.exportJSON()
// Сериализация всех данных в JSON-строку (для бэкапа)

Store.importJSON(jsonString)
// Загрузка данных из JSON-строки (полная замена)

Store.loadDemo()
// Загрузка демо-данных (тестовые корабли, объекты, ресурсы)
```

## Санитизация

`Store.sanitize(data)` — нормализация данных при загрузке:

- Преобразует устаревшие форматы (legacy migration)
- Конвертирует cargo slots в holds
- Удаляет битые ссылки на несуществующие объекты
- Приводит структуру к актуальной схеме

## Правила мира (из RULES.md)

### Масса
- Рассчитывается рекурсивно: корпус + оборудование + груз
- Ресурсы: 1 единица = 1 кг (без свойства mass)
- Оборудование: масса берётся из свойства `mass` в props

### prop_2
- Список материалов, которые контейнер может принимать
- Формат: массив имён ресурсов `["iron", "gold", "platinum"]`
- При покупке ресурсы помещаются в первый контейнер с совпадающим prop_2

### Слоты
- Точки крепления для ровно одного предмета
- Тип слота определяется `slotId` (weapon, shield, engine и т.д.)

### Трюмы (holds)
- Грузовые отсеки с массовой ёмкостью
- Фиксированы для каждого корабля

### Контейнеры
- Оборудование с свойством "Capacity" (ёмкость) и prop_2 (материалы)

### Покупка
1. Оборудование → сначала в слот, затем в трюм
2. Ресурсы → в первый совместимый контейнер (prop_2 match)

## Ключи localStorage

| Ключ | Содержимое |
|------|-----------|
| `galaxy_admin_db_v1` | Основной репозиторий данных (Store) |
| `galaxy_space_bases_v1` | Звёздные базы игрока (space module) |
| `galaxy_space_bases_removed_v1` | Архив удалённых баз (space module) |
