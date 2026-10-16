import { useMemo, useState } from "react";

type IconName =
  | "station"
  | "info"
  | "store"
  | "grid"
  | "weapon"
  | "shield"
  | "resource"
  | "ship"
  | "hangar"
  | "chevron"
  | "minus"
  | "plus"
  | "arrowRight"
  | "arrowLeft"
  | "credits";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    station: (
      <>
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
        <circle cx="12" cy="12" r="5" />
        <path d="m8.5 8.5 7 7m0-7-7 7" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7h.01" />
      </>
    ),
    store: (
      <>
        <path d="M4 9h16l-1-5H5L4 9Z" />
        <path d="M6 9v11h12V9M9 20v-6h6v6" />
      </>
    ),
    grid: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </>
    ),
    weapon: (
      <>
        <path d="m5 19 4-4m2-2 8-8v5l-8 8H6v-5l8-8h5" />
        <path d="m14 10 3 3" />
      </>
    ),
    shield: <path d="M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6l-7-3Z" />,
    resource: (
      <>
        <path d="m12 3 7 4v10l-7 4-7-4V7l7-4Z" />
        <path d="m5 7 7 4 7-4M12 11v10" />
      </>
    ),
    ship: (
      <>
        <path d="m12 3 5 7-1 8-4-2-4 2-1-8 5-7Z" />
        <path d="M10 12h4M12 3v7" />
      </>
    ),
    hangar: (
      <>
        <path d="M3 20V9l9-6 9 6v11M7 20v-8h10v8" />
        <path d="M9 16h6M9 12h6" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    minus: <path d="M6 12h12" />,
    plus: <path d="M12 6v12M6 12h12" />,
    arrowRight: <path d="M5 12h14m-5-5 5 5-5 5" />,
    arrowLeft: <path d="M19 12H5m5-5-5 5 5 5" />,
    credits: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M15 9.5c-.6-1-1.5-1.5-3-1.5-2 0-3 1-3 2.2 0 3.1 6 1 6 4 0 1.2-1 2.3-3 2.3-1.5 0-2.6-.5-3.2-1.5M12 6v2m0 8.5V19" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    >
      {paths[name]}
    </svg>
  );
}

type Category = "all" | "weapon" | "shield" | "resource" | "ship";

type Item = {
  id: number;
  name: string;
  category: Exclude<Category, "all">;
  rarity: string;
  stats: string;
  price: number;
  stock: number;
};

const shopItems: Item[] = [
  { id: 1, name: "Импульсный М-4", category: "weapon", rarity: "Редкое", stats: "Урон 48 · 2.4 выстр./с", price: 2450, stock: 8 },
  { id: 2, name: "Рельсотрон «Копьё»", category: "weapon", rarity: "Эпическое", stats: "Урон 118 · Пробитие +24%", price: 5200, stock: 3 },
  { id: 3, name: "Барьер VX-8", category: "shield", rarity: "Редкое", stats: "Щит 620 · Реген. 18/с", price: 3180, stock: 5 },
  { id: 4, name: "Фазовый контур", category: "shield", rarity: "Обычное", stats: "Щит 340 · Реген. 12/с", price: 1700, stock: 12 },
  { id: 5, name: "Кристаллы ксенона", category: "resource", rarity: "Ресурс", stats: "Топливо · 20 ед.", price: 380, stock: 64 },
  { id: 6, name: "Сплав «Титан-X»", category: "resource", rarity: "Ресурс", stats: "Материал · 10 ед.", price: 260, stock: 42 },
  { id: 7, name: "Перехватчик K-12", category: "ship", rarity: "Эпическое", stats: "Класс: штурмовой", price: 28400, stock: 1 },
];

const initialCargo: Item[] = [
  { id: 101, name: "Лазерный излучатель", category: "weapon", rarity: "Улучшенное", stats: "Урон 34 · 3.1 выстр./с", price: 1220, stock: 2 },
  { id: 102, name: "Щит «Эгида»", category: "shield", rarity: "Редкое", stats: "Щит 480 · Реген. 15/с", price: 1850, stock: 1 },
  { id: 103, name: "Плазменные ячейки", category: "resource", rarity: "Ресурс", stats: "Боезапас · 8 ед.", price: 190, stock: 16 },
];

const categories: { id: Category; label: string; icon: IconName }[] = [
  { id: "all", label: "Все", icon: "grid" },
  { id: "weapon", label: "Оружие", icon: "weapon" },
  { id: "shield", label: "Щиты", icon: "shield" },
  { id: "resource", label: "Ресурсы", icon: "resource" },
  { id: "ship", label: "Корабли", icon: "ship" },
];

const ships = [
  { name: "Asterion", className: "Фрегат", level: "MK.IV", active: true },
  { name: "Kestrel", className: "Перехватчик", level: "MK.II", active: false },
  { name: "Nomad", className: "Грузовой", level: "MK.I", active: false },
];

const hangarResources = [
  {
    id: 201,
    name: "Плазменные ячейки",
    description: "Стабилизированные энергетические элементы для импульсных систем вооружения.",
    stats: "Энергия 80 МДж · Стабильность 96%",
  },
  {
    id: 202,
    name: "Кристаллы ксенона",
    description: "Очищенное топливо для маршевых двигателей и систем сверхсветового перехода.",
    stats: "Чистота 99.4% · Класс топлива A",
  },
  {
    id: 203,
    name: "Сплав «Титан-X»",
    description: "Лёгкий композит для ремонта корпуса и усиления внешней брони.",
    stats: "Прочность 840 МПа · Масса 12 кг",
  },
  {
    id: 204,
    name: "Наноремкомплект",
    description: "Автономный ремонтный модуль для восстановления обшивки в полевых условиях.",
    stats: "Ремонт +320 · Цикл 18 сек.",
  },
];

const purchasedEquipment: Item[] = [
  { id: 301, name: "Импульсный М-4", category: "weapon", rarity: "Редкое", stats: "Урон 48 · 2.4 выстр./с", price: 2450, stock: 2 },
  { id: 302, name: "Щит «Эгида»", category: "shield", rarity: "Редкое", stats: "Щит 480 · Реген. 15/с", price: 1850, stock: 1 },
  { id: 303, name: "Фазовый контур", category: "shield", rarity: "Обычное", stats: "Щит 340 · Реген. 12/с", price: 1700, stock: 1 },
  { id: 304, name: "Лазерный излучатель", category: "weapon", rarity: "Улучшенное", stats: "Урон 34 · 3.1 выстр./с", price: 1220, stock: 2 },
  { id: 305, name: "Рельсотрон «Копьё»", category: "weapon", rarity: "Эпическое", stats: "Урон 118 · Пробитие +24%", price: 5200, stock: 1 },
];

function ShipGlyph({ compact = false }: { compact?: boolean }) {
  return (
    <svg className={compact ? "ship-glyph compact" : "ship-glyph"} viewBox="0 0 220 100" fill="none">
      <path
        d="M12 52 56 40 88 14h45l17 24 58 14-58 12-20 24H88L57 65 12 52Z"
        fill="currentColor"
        opacity=".16"
      />
      <path d="M13 52h195M57 40l31 12-31 13M88 14l14 38-14 36M133 14l-13 38 10 36M150 38l-30 14 30 12" stroke="currentColor" />
      <path d="M94 42h30l7 10-8 10H94l-8-10 8-10Z" fill="currentColor" opacity=".45" />
      <path d="m45 45-20 7 20 7m114-16 33 9-33 8" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function ItemRow({
  item,
  selected,
  onSelect,
}: {
  item: Item;
  selected: boolean;
  onSelect: () => void;
}) {
  const iconName = item.category === "resource" ? "resource" : item.category;
  return (
    <button className={`item-row ${selected ? "selected" : ""}`} onClick={onSelect}>
      <span className={`item-icon ${item.category}`}>
        <Icon name={iconName} size={22} />
      </span>
      <span className="item-copy">
        <strong>{item.name}</strong>
        <span>{item.stats}</span>
      </span>
      <span className="item-meta">
        <small>{item.rarity}</small>
        <b>{item.price.toLocaleString("ru-RU")} ¤</b>
      </span>
      <span className="stock">×{item.stock}</span>
    </button>
  );
}

function ResourceRow({
  resource,
  quantity,
  selected,
  onSelect,
}: {
  resource: (typeof hangarResources)[number];
  quantity: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button className={`resource-row ${selected ? "selected" : ""}`} onClick={onSelect}>
      <span className="item-icon resource"><Icon name="resource" size={22} /></span>
      <span className="item-copy">
        <strong>{resource.name}</strong>
        <span>{resource.stats}</span>
      </span>
      <span className="resource-quantity">
        <b>{quantity}</b>
        <small>ед.</small>
      </span>
      <Icon name="chevron" size={15} />
    </button>
  );
}

function ShipDock() {
  return (
    <section className="ship-dock">
      <div className="ship-list">
        {ships.map((ship) => (
          <button className={`ship-card ${ship.active ? "active" : ""}`} key={ship.name}>
            <div className="ship-visual">
              <ShipGlyph compact />
              {ship.active && <span className="active-tag">Выбран</span>}
            </div>
            <div>
              <strong>{ship.name}</strong>
              <span>{ship.className}</span>
            </div>
            <small>{ship.level}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const [tab, setTab] = useState<"info" | "shop" | "hangar">("shop");
  const [category, setCategory] = useState<Category>("all");
  const [selectedShop, setSelectedShop] = useState(1);
  const [selectedCargo, setSelectedCargo] = useState(101);
  const [amount, setAmount] = useState(1);
  const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy");
  const [credits, setCredits] = useState(42860);
  const [notice, setNotice] = useState("Торговый терминал подключён");
  const [infoSection, setInfoSection] = useState<"properties" | "equipment" | "resources">("properties");
  const [selectedResource, setSelectedResource] = useState(201);
  const [transferMode, setTransferMode] = useState<"load" | "unload">("load");
  const [transferAmount, setTransferAmount] = useState(1);
  const [baseStock, setBaseStock] = useState<Record<number, number>>({
    201: 42, 202: 64, 203: 28, 204: 9,
  });
  const [shipStock, setShipStock] = useState<Record<number, number>>({
    201: 16, 202: 8, 203: 4, 204: 2,
  });

  const filteredItems = useMemo(
    () => shopItems.filter((item) => category === "all" || item.category === category),
    [category],
  );
  const currentShop = shopItems.find((item) => item.id === selectedShop) ?? filteredItems[0];
  const currentCargo = initialCargo.find((item) => item.id === selectedCargo) ?? initialCargo[0];
  const activeTradeItem = tradeMode === "buy" ? currentShop : currentCargo;
  const activeResource = hangarResources.find((item) => item.id === selectedResource) ?? hangarResources[0];

  const changeCategory = (next: Category) => {
    setCategory(next);
    const first = shopItems.find((item) => next === "all" || item.category === next);
    if (first) setSelectedShop(first.id);
    setTradeMode("buy");
    setAmount(1);
  };

  const transact = (mode: "buy" | "sell") => {
    const item = mode === "buy" ? currentShop : currentCargo;
    const delta = item.price * amount;
    if (mode === "buy" && delta > credits) {
      setNotice("Недостаточно кредитов для покупки");
      return;
    }
    setCredits((value) => value + (mode === "buy" ? -delta : Math.round(delta * 0.65)));
    setNotice(
      mode === "buy"
        ? `${item.name}: куплено ×${amount}`
        : `${item.name}: продано ×${amount}`,
    );
  };

  const transferResource = () => {
    const source = transferMode === "load" ? baseStock : shipStock;
    const available = source[selectedResource] ?? 0;
    const moved = Math.min(transferAmount, available);
    if (moved === 0) {
      setNotice("Недостаточно ресурса для перемещения");
      return;
    }
    const fromSetter = transferMode === "load" ? setBaseStock : setShipStock;
    const toSetter = transferMode === "load" ? setShipStock : setBaseStock;
    fromSetter((stock) => ({ ...stock, [selectedResource]: stock[selectedResource] - moved }));
    toSetter((stock) => ({ ...stock, [selectedResource]: (stock[selectedResource] ?? 0) + moved }));
    setNotice(
      `${activeResource.name}: ${transferMode === "load" ? "загружено" : "выгружено"} ×${moved}`,
    );
  };

  return (
    <main className="app-shell">
      <div className="scanline" />
      <div className="station-backdrop" aria-hidden="true">
        <div className="bay-window">
          <span className="planet" />
          <span className="stars stars-near" />
          <span className="stars stars-far" />
        </div>
        <div className="bay-beam beam-left" />
        <div className="bay-beam beam-right" />
        <div className="bay-ceiling" />
        <div className="bay-floor" />
        <div className="runway-lights">
          <i /><i /><i /><i /><i /><i />
        </div>
      </div>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Icon name="station" size={23} /></span>
          <div>
            <strong>HELIOS // 7</strong>
            <span>ОРБИТАЛЬНАЯ ЗВЁЗДНАЯ БАЗА</span>
          </div>
        </div>
        <div className="station-status">
          <span className="pulse" />
          СИСТЕМЫ В НОРМЕ
          <span className="divider" />
          СЕКТОР A-17
        </div>
        <div className="balance">
          <span><Icon name="credits" size={17} /></span>
          <div>
            <small>Баланс</small>
            <strong>{credits.toLocaleString("ru-RU")} <i>¤</i></strong>
          </div>
        </div>
      </header>

      <nav className="primary-tabs">
        <button className={tab === "info" ? "active" : ""} onClick={() => setTab("info")}>
          <Icon name="info" /> Информация о базе
        </button>
        <button className={tab === "shop" ? "active" : ""} onClick={() => setTab("shop")}>
          <Icon name="store" /> Магазин
        </button>
        <button className={tab === "hangar" ? "active" : ""} onClick={() => setTab("hangar")}>
          <Icon name="hangar" /> Ангар
        </button>
      </nav>

      <div className="content">
        {tab === "shop" ? (
          <section className="shop-view">
            <div className="section-title">
              <div>
                <span className="eyebrow">ТОРГОВЫЙ УЗЕЛ // 04</span>
                <h1>Снаряжение и снабжение</h1>
              </div>
              <div className="terminal-status"><span /> {notice}</div>
            </div>

            <div className="category-tabs">
              {categories.map((item) => (
                <button
                  className={category === item.id ? "active" : ""}
                  key={item.id}
                  onClick={() => changeCategory(item.id)}
                >
                  <Icon name={item.icon} size={17} />
                  {item.label}
                </button>
              ))}
            </div>

            <div className="market-grid">
              <div className="inventory-panel">
                <div className="panel-head">
                  <div><span>01</span><strong>В продаже</strong></div>
                  <small>{filteredItems.length} позиций</small>
                </div>
                <div className="item-list">
                  {filteredItems.map((item) => (
                    <ItemRow
                      item={item}
                      key={item.id}
                      selected={selectedShop === item.id}
                      onSelect={() => {
                        setSelectedShop(item.id);
                        setTradeMode("buy");
                        setAmount(1);
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="trade-console">
                <div className="trade-preview">
                  <span className={`trade-preview-icon ${activeTradeItem.category}`}>
                    <Icon
                      name={activeTradeItem.category === "resource" ? "resource" : activeTradeItem.category}
                      size={27}
                    />
                  </span>
                  <strong>{activeTradeItem.name}</strong>
                  <span className="trade-preview-stats">{activeTradeItem.stats}</span>
                  <span className="trade-preview-price">
                    {activeTradeItem.price.toLocaleString("ru-RU")} ¤
                    <small> / шт.</small>
                  </span>
                </div>
                <div className="amount-control">
                  <button aria-label="Уменьшить количество" onClick={() => setAmount(Math.max(1, amount - 1))}>
                    <Icon name="minus" />
                  </button>
                  <div><strong>{amount}</strong><span>КОЛ-ВО</span></div>
                  <button aria-label="Увеличить количество" onClick={() => setAmount(Math.min(99, amount + 1))}>
                    <Icon name="plus" />
                  </button>
                </div>
                <div className="trade-total">
                  <span>{tradeMode === "buy" ? "К покупке" : "К продаже"}</span>
                  <strong>
                    {(tradeMode === "buy"
                      ? currentShop.price * amount
                      : Math.round(currentCargo.price * amount * 0.65)
                    ).toLocaleString("ru-RU")} ¤
                  </strong>
                </div>
                <button
                  className={`trade-button ${tradeMode}`}
                  onClick={() => transact(tradeMode)}
                >
                  {tradeMode === "sell" && <Icon name="arrowLeft" />}
                  {tradeMode === "buy" ? "Купить" : "Продать"}
                  {tradeMode === "buy" && <Icon name="arrowRight" />}
                </button>
              </div>

              <div className="inventory-panel">
                <div className="panel-head">
                  <div><span>02</span><strong>На корабле</strong></div>
                  <small>19 / 24 слотов</small>
                </div>
                <div className="cargo-capacity"><span style={{ width: "79%" }} /></div>
                <div className="item-list">
                  {initialCargo.map((item) => (
                    <ItemRow
                      item={item}
                      key={item.id}
                      selected={selectedCargo === item.id}
                      onSelect={() => {
                        setSelectedCargo(item.id);
                        setTradeMode("sell");
                        setAmount(1);
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : tab === "hangar" ? (
          <section className="shop-view hangar-view">
            <div className="section-title">
              <div>
                <span className="eyebrow">ГРУЗОВОЙ ТЕРМИНАЛ // C-12</span>
                <h1>Ресурсы ангара</h1>
              </div>
              <div className="terminal-status"><span /> {notice}</div>
            </div>

            <div className="market-grid hangar-grid">
              <div className="inventory-panel">
                <div className="panel-head">
                  <div><span>01</span><strong>На базе</strong></div>
                  <small>Хранилище 68%</small>
                </div>
                <div className="cargo-capacity"><span style={{ width: "68%" }} /></div>
                <div className="item-list">
                  {hangarResources.map((resource) => (
                    <ResourceRow
                      key={resource.id}
                      resource={resource}
                      quantity={baseStock[resource.id] ?? 0}
                      selected={transferMode === "load" && selectedResource === resource.id}
                      onSelect={() => {
                        setSelectedResource(resource.id);
                        setTransferMode("load");
                        setTransferAmount(1);
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="trade-console hangar-console">
                <div className="trade-preview">
                  <span className="trade-preview-icon resource">
                    <Icon name="resource" size={29} />
                  </span>
                  <strong>{activeResource.name}</strong>
                  <p>{activeResource.description}</p>
                  <span className="trade-preview-stats">{activeResource.stats}</span>
                </div>
                <div className="transfer-route">
                  <span>{transferMode === "load" ? "БАЗА" : "КОРАБЛЬ"}</span>
                  <Icon name={transferMode === "load" ? "arrowRight" : "arrowLeft"} size={18} />
                  <span>{transferMode === "load" ? "КОРАБЛЬ" : "БАЗА"}</span>
                </div>
                <div className="amount-control">
                  <button
                    aria-label="Уменьшить количество"
                    onClick={() => setTransferAmount(Math.max(1, transferAmount - 1))}
                  >
                    <Icon name="minus" />
                  </button>
                  <div><strong>{transferAmount}</strong><span>КОЛ-ВО</span></div>
                  <button
                    aria-label="Увеличить количество"
                    onClick={() => setTransferAmount(Math.min(99, transferAmount + 1))}
                  >
                    <Icon name="plus" />
                  </button>
                </div>
                <button className={`trade-button ${transferMode === "load" ? "buy" : "sell"}`} onClick={transferResource}>
                  {transferMode === "unload" && <Icon name="arrowLeft" />}
                  {transferMode === "load" ? "Загрузить" : "Выгрузить"}
                  {transferMode === "load" && <Icon name="arrowRight" />}
                </button>
              </div>

              <div className="inventory-panel">
                <div className="panel-head">
                  <div><span>02</span><strong>На корабле</strong></div>
                  <small>Груз 19 / 24</small>
                </div>
                <div className="cargo-capacity"><span style={{ width: "79%" }} /></div>
                <div className="item-list">
                  {hangarResources.map((resource) => (
                    <ResourceRow
                      key={resource.id}
                      resource={resource}
                      quantity={shipStock[resource.id] ?? 0}
                      selected={transferMode === "unload" && selectedResource === resource.id}
                      onSelect={() => {
                        setSelectedResource(resource.id);
                        setTransferMode("unload");
                        setTransferAmount(1);
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="info-view">
            <div className="section-title">
              <div>
                <span className="eyebrow">АНГАР // СЕКТОР C</span>
                <h1>База «Helios VII»</h1>
              </div>
              <div className="terminal-status"><span /> Стыковка завершена</div>
            </div>

            <div className="info-tabs">
              <button
                className={infoSection === "properties" ? "active" : ""}
                onClick={() => setInfoSection("properties")}
              >
                <Icon name="ship" size={16} /> Свойства корабля
              </button>
              <button
                className={infoSection === "equipment" ? "active" : ""}
                onClick={() => setInfoSection("equipment")}
              >
                <Icon name="weapon" size={16} /> Купленное оборудование
              </button>
              <button
                className={infoSection === "resources" ? "active" : ""}
                onClick={() => setInfoSection("resources")}
              >
                <Icon name="resource" size={16} /> Ресурсы
              </button>
            </div>

            {infoSection === "properties" ? (
              <div className="info-grid">
                <div className="hero-ship">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <ShipGlyph />
                  <span className="axis-label left">КОРМA</span>
                  <span className="axis-label right">НОС</span>
                </div>
                <div className="ship-data">
                  <span className="eyebrow">ВЫБРАННЫЙ КОРАБЛЬ</span>
                  <h2>ASTERION <small>MK.IV</small></h2>
                  <p>Многоцелевой фрегат дальнего радиуса действия. Готов к вылету.</p>
                  <div className="stat-grid">
                    <div><span>Целостность</span><b>2 480</b><i><em style={{ width: "88%" }} /></i></div>
                    <div><span>Щиты</span><b>1 260</b><i><em style={{ width: "72%" }} /></i></div>
                    <div><span>Огневая мощь</span><b>786</b><i><em style={{ width: "64%" }} /></i></div>
                    <div><span>Манёвренность</span><b>82</b><i><em style={{ width: "82%" }} /></i></div>
                  </div>
                </div>
                <div className="base-data">
                  <div><span>Уровень базы</span><strong>07</strong></div>
                  <div><span>Репутация</span><strong>Доверие</strong></div>
                  <div><span>Техобслуживание</span><strong className="accent">Доступно</strong></div>
                  <div><span>До вылета</span><strong>00:12:44</strong></div>
                </div>
              </div>
            ) : infoSection === "equipment" ? (
              <div className="collection-panel">
                <div className="collection-head">
                  <div>
                    <span className="eyebrow">ИНВЕНТАРЬ ASTERION</span>
                    <h2>Купленное оборудование</h2>
                  </div>
                  <span>{purchasedEquipment.length} типов · 7 модулей</span>
                </div>
                <div className="collection-list">
                  {purchasedEquipment.map((item, index) => (
                    <div className="collection-row" key={item.id}>
                      <span className={`item-icon ${item.category}`}>
                        <Icon name={item.category} size={22} />
                      </span>
                      <div className="collection-copy">
                        <small>МОДУЛЬ // {String(index + 1).padStart(2, "0")}</small>
                        <strong>{item.name}</strong>
                        <span>{item.stats}</span>
                      </div>
                      <span className="equipment-rarity">{item.rarity}</span>
                      <div className="collection-count"><b>×{item.stock}</b><span>Куплено</span></div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="collection-panel">
                <div className="collection-head">
                  <div>
                    <span className="eyebrow">ГРУЗОВОЙ ОТСЕК ASTERION</span>
                    <h2>Ресурсы корабля</h2>
                  </div>
                  <span>19 / 24 грузовых слота</span>
                </div>
                <div className="resource-summary">
                  <div><span>Заполнение трюма</span><b>79%</b><i><em style={{ width: "79%" }} /></i></div>
                  <div><span>Общая масса</span><b>4 820 кг</b></div>
                  <div><span>Автономность</span><b>18 циклов</b></div>
                </div>
                <div className="collection-list">
                  {hangarResources.map((resource, index) => (
                    <div className="collection-row" key={resource.id}>
                      <span className="item-icon resource"><Icon name="resource" size={22} /></span>
                      <div className="collection-copy">
                        <small>РЕСУРС // {String(index + 1).padStart(2, "0")}</small>
                        <strong>{resource.name}</strong>
                        <span>{resource.stats}</span>
                      </div>
                      <span className="resource-description">{resource.description}</span>
                      <div className="collection-count"><b>{shipStock[resource.id] ?? 0}</b><span>Единиц</span></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
        <ShipDock />
      </div>
    </main>
  );
}
