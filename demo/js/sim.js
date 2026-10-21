/* Демо «Добыча астероида» — модель мира.
   Ни DOM, ни canvas: только числа, чтобы модель можно было прогнать в Node.

   Два кадра, и это главное решение демо:
   - локальный (в нём живут корабль и астероид) — поступательный, оси не вращаются,
     начало координат едет вместе с точкой орбиты. На дистанции в километры
     кривизна орбиты не видна, поэтому астероид здесь идёт по прямой с постоянной
     скоростью, а не по дуге;
   - гелиоцентрический (только для схемы орбиты) — астероид на окружности
     радиусом 2,4 а.е. вокруг Солнца.

   «Орбита астероида» в игре — это коорбитальная точка в 34 м над причалом:
   настоящая гравитационная орбита вокруг 50-метрового камня невозможна
   (вторая космическая на его поверхности — сантиметры в секунду), поэтому
   корабль уравнивает скорость с астероидом и висит рядом, а потом идёт на стыковку. */

(function (global) {
  'use strict';

  var TAU = Math.PI * 2;

  /* ---------- Векторная алгебра ---------- */

  function vec(x, y) { return { x: x, y: y }; }
  function add(a, b) { return vec(a.x + b.x, a.y + b.y); }
  function sub(a, b) { return vec(a.x - b.x, a.y - b.y); }
  function mul(a, k) { return vec(a.x * k, a.y * k); }
  function dot(a, b) { return a.x * b.x + a.y * b.y; }
  function len(a) { return Math.sqrt(a.x * a.x + a.y * a.y); }
  function unit(a) { var l = len(a) || 1; return vec(a.x / l, a.y / l); }
  function perp(a) { return vec(-a.y, a.x); }
  function fromAngle(a) { return vec(Math.cos(a), Math.sin(a)); }
  function dist(a, b) { return len(sub(a, b)); }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }

  function wrapAngle(a) {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  }

  /* Детерминированный генератор: форма и состав астероида не прыгают при перезапуске. */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Постоянные мира ---------- */

  var CFG = {
    orbitAU: 2.4,            // радиус орбиты, а.е.
    orbitDays: 1680,         // период обращения вокруг Солнца, сутки (≈4,6 года)
    orbitVisualRate: 0.012,  // рад/с — только для схемы, движение на ней ускорено
    asteroidSpeed: 22,       // м/с вдоль локального кадра: на карте это прямая
    asteroidDrift: -2.6,     // м/с поперёк, чтобы прямая не была строго горизонтальной

    shipMass: 38000,         // кг, сухой корабль
    holdMass: 60000,         // кг, полный трюм
    thrust: 220000,          // Н, главный двигатель (5,8 м/с² порожнего — ручная погоня за астероидом)
    rcs: 68000,              // Н, маневровые двигатели (1,8 м/с² борт)
    turnRate: 1.15,          // рад/с, скорость разворота на РСУ и стрелках
    nose: 9.5,               // м, от центра корабля до стыковочного узла

    mineRate: 1.3,           // т/с, темп бура
    standoff: 18,            // м, точка «орбиты» над причалом
    dockReach: 3.4,          // м, радиус захвата
    dockSpeed: 1.5,          // м/с, предел скорости сближения при захвате
    dockAngle: 0.4           // рад, предел рассогласования при захвате
  };

  /* Руды: имя и цвет для интерфейса. Набор — из data/store.js. */
  var ORES = [
    { name: 'Железная руда', color: '#75dfd2' },
    { name: 'Никелевая руда', color: '#aa88f6' },
    { name: 'Кобальтовая руда', color: '#bffcfc' },
    { name: 'Иридий', color: '#8fe6ff' },
    { name: 'Платина', color: '#c9b3ff' }
  ];

  /* ---------- Астероид ---------- */

  function makeAsteroid(name, x, y, radius, ore, r, orbitAngle) {
    var sides = 18;
    var shape = [];
    var i;
    for (i = 0; i < sides; i++) {
      shape.push({ a: i / sides * TAU, r: radius * (0.8 + r() * 0.28) });
    }
    var craters = [];
    for (i = 0; i < 7; i++) {
      craters.push({ a: r() * TAU, d: 0.1 + r() * 0.62, r: 0.07 + r() * 0.13 });
    }
    /* Состав: 2–3 фракции, доли в сумме 1. */
    var mix = [];
    var pool = ORES.slice();
    var parts = 2 + (r() < 0.5 ? 1 : 0);
    var left = 1;
    for (i = 0; i < parts; i++) {
      var share = i === parts - 1 ? left : left * (0.45 + r() * 0.25);
      var pick = pool.splice(Math.floor(r() * pool.length), 1)[0];
      mix.push({ name: pick.name, color: pick.color, share: share });
      left -= share;
    }
    return {
      id: name,
      p: vec(x, y),
      v: vec(CFG.asteroidSpeed, CFG.asteroidDrift),
      radius: radius,
      angle: r() * TAU,
      spin: (0.018 + r() * 0.014) * (r() < 0.5 ? -1 : 1),
      shape: shape,
      craters: craters,
      portAngle: r() * TAU,
      mix: mix,
      oreTotal: ore,
      oreLeft: ore,
      orbitAngle: orbitAngle
    };
  }

  /* Радиус поверхности в мировом направлении: полигон неровный, причал должен
     стоять на грунте, а не висеть в пустоте. */
  function surfaceRadius(ast, worldAngle) {
    var local = wrapAngle(worldAngle - ast.angle);
    if (local < 0) local += TAU;
    var step = TAU / ast.shape.length;
    var i = Math.floor(local / step) % ast.shape.length;
    var j = (i + 1) % ast.shape.length;
    var t = (local - i * step) / step;
    return ast.shape[i].r + (ast.shape[j].r - ast.shape[i].r) * t;
  }

  function portNormal(ast) {
    return fromAngle(ast.angle + ast.portAngle);
  }

  function portPos(ast) {
    var n = portNormal(ast);
    return add(ast.p, mul(n, surfaceRadius(ast, ast.angle + ast.portAngle) * 0.97));
  }

  /* Причал вращается вместе с астероидом: у точки есть своя скорость ω × r.
     Без неё автопилот «догонял» бы уплывающий причал рывками. */
  function portVel(ast) {
    var n = portNormal(ast);
    var r = surfaceRadius(ast, ast.angle + ast.portAngle) * 0.97;
    return add(ast.v, mul(perp(n), r * ast.spin));
  }

  /* ---------- Мир ---------- */

  function World(opts) {
    this.cfg = CFG;
    this.onEvent = (opts && opts.onEvent) || function () {};
    this.paused = false;
    this.reset();
  }

  World.prototype.reset = function () {
    this.time = 0;
    this.wave = 1;
    this.astSeq = 0;
    this.events = [];
    this.stats = { mined: 0, delivered: 0, dv: 0, docks: 0 };
    this.autopilot = false;   // по умолчанию корабль ведёт пилот; Space — автопилот
    this.lights = false;      // прожекторы, клавиша H
    this.ship = {
      p: vec(0, 0),
      v: vec(0, 0),
      angle: 0.15,
      mass: CFG.shipMass,
      cargo: 0,
      cargoMix: {},
      input: { main: 0, strafe: 0, turn: 0 }
    };
    this.asteroids = [];
    this.spawnWave();
    this.target = this.pickTarget();
    this.docked = false;
    this.dockedTo = null;
    this.returning = false;
    this.departTimer = 0;
    this.dockCooldown = 0;
    this.mineTimer = 0;
    this.guideStage = 'intercept';
    this.stageTimer = 0;
    this.phase = 'intercept';
    this.trail = [];
    this.trailTimer = 0;
    this.orbitPhase = -0.9;
    this.emit('ПОЛЕ · 2,4 а.е. от Солнца, три цели', 'info');
    if (this.target) this.emit('ЦЕЛЬ · ' + this.target.id, 'ok');
  };

  World.prototype.emit = function (text, kind) {
    this.events.push({ t: this.time, text: text, kind: kind || 'info' });
    if (this.events.length > 40) this.events.shift();
    this.onEvent(text, kind || 'info');
  };

  World.prototype.spawnWave = function () {
    var base = this.ship ? this.ship.p : vec(0, 0);
    var r = rng(977 + this.wave * 131);
    for (var i = 0; i < 3; i++) {
      var along = 260 + i * 420 + r() * 100;
      var side = (r() - 0.5) * 340;
      var radius = 38 + r() * 30;
      var ore = 16 + r() * 8;
      this.astSeq += 1;
      var name = 'A-' + (100 + this.astSeq * 37 % 900);
      this.asteroids.push(makeAsteroid(
        name,
        base.x + along,
        base.y + side,
        radius,
        ore,
        r,
        this.orbitPhase + i * 0.06
      ));
    }
  };

  World.prototype.pickTarget = function () {
    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < this.asteroids.length; i++) {
      var a = this.asteroids[i];
      if (a.oreLeft <= 0.05) continue;
      var d = dist(a.p, this.ship.p);
      if (d < bestDist) { bestDist = d; best = a; }
    }
    return best;
  };

  World.prototype.mainAccel = function () {
    var m = Math.max(CFG.shipMass, this.ship.mass);
    return CFG.thrust / m;
  };

  World.prototype.rcsAccel = function () {
    var m = Math.max(CFG.shipMass, this.ship.mass);
    return CFG.rcs / m;
  };

  /* ---------- Автопилот ----------
     Три стадии: сближение → выход на орбиту (уравнивание скорости) → подход к причалу.
     Управление — по рассогласованию скоростей: желаемая скорость считается
     из вектора на цель с ограничением, которое падает у цели, поэтому корабль
     сам тормозит заранее, а не пролетает мимо. */

  World.prototype.guide = function (dt) {
    var ship = this.ship;
    var ast = this.target;
    var input = ship.input;
    input.main = 0;
    input.strafe = 0;
    input.turn = 0;
    if (!ast) { this.phase = 'idle'; return; }

    var port = portPos(ast);
    var normal = portNormal(ast);
    var portV = portVel(ast);
    var stand = add(port, mul(normal, CFG.standoff));
    var dock = add(port, mul(normal, CFG.nose + 0.6));
    var vRel = sub(ship.v, portV);
    var aim;
    var cap;

    if (this.guideStage === 'intercept') {
      aim = sub(stand, ship.p);
      var dStand = len(aim);
      /* Предел скорости сближения: постоянная времени 8 с плюс тормозной путь.
         Оба ограничения вместе дают мягкий заход без пролёта мимо точки. */
      cap = Math.min(32, dStand / 8, Math.sqrt(2 * this.mainAccel() * 0.5 * dStand) * 0.8);
      if (dStand < 10) cap = Math.min(cap, 1.4);
      this.phase = 'intercept';
      if (dStand < 5 && len(vRel) < 3.0) {
        this.guideStage = 'hold';
        this.stageTimer = 0;
        this.emit('ОРБИТА · скорость уравнена, дистанция ' + Math.round(dStand) + ' м', 'ok');
      }
    } else if (this.guideStage === 'hold') {
      this.stageTimer += dt;
      aim = sub(stand, ship.p);
      cap = 0.7;
      this.phase = 'hold';
      if (len(aim) > 14) {
        this.guideStage = 'intercept';
      } else if (this.stageTimer > 2.4) {
        this.guideStage = 'final';
        this.emit('ПОДХОД · причал ' + ast.id, 'info');
      }
    } else {
      aim = sub(dock, ship.p);
      cap = Math.min(1.3, 0.15 + len(aim) * 0.5);
      this.phase = 'final';
      /* Сорваться обратно в сближение может только далёкий заход; сама точка
         стыковки на 22 м ближе точки орбиты, и мерить надо именно причал. */
      if (dist(ship.p, port) > 42) this.guideStage = 'intercept';
    }

    var dAim = Math.max(len(aim), 1e-4);
    /* Желаемая скорость — скорость причала плюс скорость сближения:
       предел cap относится именно к сближению, иначе на догоне быстрого
       астероида корабль тормозил бы до его же скорости и не догнал. */
    var vDes = add(portV, mul(unit(aim), Math.min(cap, dAim * 0.9)));
    /* vDes — абсолютная скорость, значит и вычитать надо скорость корабля,
       а не скорость относительно причала. */
    var aCmd = mul(sub(vDes, ship.v), 0.9);

    /* Грунт: если автопилот заходит не с той стороны, сначала отводим корабль. */
    var away = sub(ship.p, ast.p);
    var dCenter = len(away);
    var surf = surfaceRadius(ast, Math.atan2(away.y, away.x));
    if (dCenter < surf + 10) {
      aCmd = add(aCmd, mul(unit(away), (surf + 10 - dCenter) * 1.6));
    }

    var heading = fromAngle(ship.angle);
    var right = perp(heading);
    var aMain = this.mainAccel();
    var aRcs = this.rcsAccel();

    /* Нос всегда смотрит на причал: так работают и реверс на торможении,
       и боковые РСУ, и выравнивание перед захватом. Тягу раскладываем
       на продольную и боковую уже после этого. */
    var toPort = sub(port, ship.p);
    var want = Math.atan2(toPort.y, toPort.x);
    var err = wrapAngle(want - ship.angle);
    input.turn = clamp(err * 2.4, -1, 1) * CFG.turnRate;

    var fwd = dot(aCmd, heading);
    var lat = dot(aCmd, right);
    input.main = clamp(fwd / aMain, -0.5, 1);
    input.strafe = clamp(lat / aRcs, -1, 1);
  };

  /* ---------- Стыковка и добыча ---------- */

  World.prototype.checkDock = function () {
    var ast = this.target;
    if (!ast || this.dockCooldown > 0) return;
    var normal = portNormal(ast);
    var dock = add(portPos(ast), mul(normal, CFG.nose + 0.6));
    var e = sub(dock, this.ship.p);
    var vRel = sub(this.ship.v, portVel(ast));
    var want = Math.atan2(-normal.y, -normal.x);
    var align = Math.abs(wrapAngle(this.ship.angle - want));
    if (len(e) < CFG.dockReach && len(vRel) < CFG.dockSpeed && align < CFG.dockAngle) {
      this.dock();
    }
  };

  World.prototype.dock = function () {
    var ast = this.target;
    var port = portPos(ast);
    var normal = portNormal(ast);
    this.docked = true;
    this.dockedTo = ast;
    this.departTimer = 0;
    this.mineTimer = 0;
    this.stats.docks += 1;
    this.ship.p = add(port, mul(normal, CFG.nose + 0.6));
    this.ship.v = portVel(ast);
    this.ship.angle = Math.atan2(-normal.y, -normal.x);
    this.phase = 'mining';
    this.emit('СТЫКОВКА · ' + ast.id + ', захват причала', 'ok');
  };

  World.prototype.undock = function (reason, returning) {
    if (!this.docked) return;
    var ast = this.target;
    var normal = portNormal(ast);
    this.docked = false;
    this.dockedTo = null;
    this.ship.p = add(this.ship.p, mul(normal, 2.2));
    this.ship.v = add(portVel(ast), mul(normal, 0.9));
    this.guideStage = 'intercept';
    this.stageTimer = 0;
    this.departTimer = 2.4;
    this.dockCooldown = 2.6;
    this.returning = !!returning;
    this.phase = 'depart';
    /* Отработанный астероид больше не цель: иначе автопилот развернётся
       и снова пойдёт на опустевший причал. */
    if (!returning && ast.oreLeft <= 0.05) this.target = null;
    this.emit(reason, 'warn');
    if (!returning) this.emit('РАССТЫКОВКА · отход от причала', 'info');
  };

  World.prototype.mine = function (dt) {
    var ast = this.target;
    if (!ast) return;
    var free = CFG.holdMass / 1000 - this.ship.cargo;
    var take = Math.min(CFG.mineRate * dt, ast.oreLeft, Math.max(0, free));
    if (take > 0) {
      ast.oreLeft -= take;
      this.ship.cargo += take;
      this.stats.mined += take;
      for (var i = 0; i < ast.mix.length; i++) {
        var m = ast.mix[i];
        this.ship.cargoMix[m.name] = (this.ship.cargoMix[m.name] || 0) + take * m.share;
      }
    }
    this.phase = 'mining';

    if (free - take <= 0.001) {
      this.mineTimer += dt;
      if (this.mineTimer > 1.0) this.undock('ТРЮМ ПОЛОН · руда к отправке', true);
    } else {
      this.mineTimer = 0;
    }
    if (ast.oreLeft <= 0.05 && this.docked) {
      this.undock('АСТЕРОИД ОТРАБОТАН · ' + ast.id, this.ship.cargo >= CFG.holdMass / 1000 - 0.5);
    }
  };

  World.prototype.deliver = function () {
    var load = this.ship.cargo;
    if (load > 0.01) {
      this.stats.delivered += load;
      this.emit('БАЗА · руда сдана, ' + load.toFixed(1) + ' т', 'ok');
    }
    this.ship.cargo = 0;
    this.ship.cargoMix = {};
    this.returning = false;
    this.wave += 1;
    this.spawnWave();
    this.target = this.pickTarget();
    this.guideStage = 'intercept';
    this.stageTimer = 0;
    this.phase = 'intercept';
    this.emit('НОВАЯ ВОЛНА · три астероида впереди', 'info');
  };

  World.prototype.nextTarget = function () {
    var next = this.pickTarget();
    if (!next) {
      this.wave += 1;
      this.spawnWave();
      this.emit('НОВАЯ ВОЛНА · три астероида впереди', 'info');
      next = this.pickTarget();
    }
    this.target = next;
    this.guideStage = 'intercept';
    this.stageTimer = 0;
    this.phase = 'intercept';
    if (next) this.emit('НОВАЯ ЦЕЛЬ · ' + next.id, 'info');
  };

  /* Мягкий контакт с грунтом: выталкиваем и гасим нормальную скорость,
     чтобы корабль не проваливался внутрь камня. */
  World.prototype.avoidGround = function () {
    var ast = this.target;
    if (!ast) return;
    var away = sub(this.ship.p, ast.p);
    var d = len(away);
    var surf = surfaceRadius(ast, Math.atan2(away.y, away.x));
    if (d < surf + 4) {
      var n = unit(away);
      this.ship.p = add(ast.p, mul(n, surf + 4));
      var vn = dot(this.ship.v, n);
      if (vn < 0) this.ship.v = sub(this.ship.v, mul(n, vn));
    }
  };

  /* Старые отработанные камни уезжают далеко позади — держим список коротким. */
  World.prototype.dropLostRocks = function () {
    var ship = this.ship;
    this.asteroids = this.asteroids.filter(function (a) {
      return a.oreLeft > 0.05 || dist(a.p, ship.p) < 30000;
    });
  };

  /* ---------- Подсказки пилоту ----------
     Считает ту же математику, что и guide(), но ничего не исполняет:
     результат идёт на панель «Манёвр» — какие двигатели жать и куда поворачивать.
     Стадия определяется по геометрии на лету, без внутреннего состояния. */

  World.prototype.advice = function () {
    var ast = this.target;
    if (this.docked || !ast) {
      return { mode: this.docked ? 'mining' : 'idle', main: 0, strafe: 0, turn: 0 };
    }
    var ship = this.ship;
    var port = portPos(ast);
    var normal = portNormal(ast);
    var portV = portVel(ast);
    var stand = add(port, mul(normal, CFG.standoff));
    var dock = add(port, mul(normal, CFG.nose + 0.6));
    var vRel = sub(ship.v, portV);
    var dStand = dist(ship.p, stand);
    var aim, cap, mode;

    if (dStand > 26) {
      aim = sub(stand, ship.p);
      cap = Math.min(30, dStand / 8, Math.sqrt(2 * this.mainAccel() * 0.5 * dStand) * 0.8);
      mode = 'intercept';
    } else if (len(vRel) > 2.2 || dStand > 10) {
      aim = sub(stand, ship.p);
      cap = 0.8;
      mode = 'hold';
    } else {
      aim = sub(dock, ship.p);
      cap = Math.min(1.2, 0.15 + len(aim) * 0.5);
      mode = 'final';
    }

    var dAim = Math.max(len(aim), 1e-4);
    var vDes = add(portV, mul(unit(aim), Math.min(cap, dAim * 0.9)));
    var aCmd = mul(sub(vDes, ship.v), 0.9);

    /* не советуем лететь сквозь камень */
    var away = sub(ship.p, ast.p);
    var dCenter = len(away);
    var surf = surfaceRadius(ast, Math.atan2(away.y, away.x));
    if (dCenter < surf + 10) {
      aCmd = add(aCmd, mul(unit(away), (surf + 10 - dCenter) * 1.6));
    }

    var heading = fromAngle(ship.angle);
    var right = perp(heading);
    var toPort = sub(port, ship.p);
    var yawErr = wrapAngle(Math.atan2(toPort.y, toPort.x) - ship.angle);

    return {
      mode: mode,
      main: clamp(dot(aCmd, heading) / this.mainAccel(), -0.6, 1),
      strafe: clamp(dot(aCmd, right) / this.rcsAccel(), -1, 1),
      turn: clamp(yawErr * 2.4, -1, 1),
      yawErr: yawErr,
      dPort: dist(ship.p, port),
      closing: dot(vRel, unit(toPort)),
      vRel: len(vRel)
    };
  };

  /* ---------- Шаг мира ---------- */

  World.prototype.step = function (dt) {
    if (this.paused || dt <= 0) return;
    this.time += dt;
    this.orbitPhase += dt * CFG.orbitVisualRate;

    var ship = this.ship;
    ship.mass = CFG.shipMass + ship.cargo * 1000;

    for (var i = 0; i < this.asteroids.length; i++) {
      var a = this.asteroids[i];
      a.p = add(a.p, mul(a.v, dt));
      a.angle += a.spin * dt;
    }
    this.dropLostRocks();

    if (this.docked && this.target) {
      var port = portPos(this.target);
      var n = portNormal(this.target);
      ship.p = add(port, mul(n, CFG.nose + 0.6));
      ship.v = portVel(this.target);
      ship.angle = Math.atan2(-n.y, -n.x);
      ship.input.main = 0;
      ship.input.strafe = 0;
      ship.input.turn = 0;
      this.mine(dt);
    } else {
      if (this.dockCooldown > 0) this.dockCooldown -= dt;
      if (this.departTimer > 0) {
        this.departTimer -= dt;
        if (this.departTimer <= 0) {
          if (this.returning) this.deliver();
          else this.nextTarget();
        }
      }

      if (this.autopilot && this.target && !this.returning) {
        this.guide(dt);
      } else if (!this.autopilot) {
        this.phase = 'manual';
      }

      var heading = fromAngle(ship.angle);
      var right = perp(heading);
      var acc = add(
        mul(heading, ship.input.main * this.mainAccel()),
        mul(right, ship.input.strafe * this.rcsAccel())
      );
      ship.v = add(ship.v, mul(acc, dt));
      ship.p = add(ship.p, mul(ship.v, dt));
      ship.angle = wrapAngle(ship.angle + ship.input.turn * dt);
      this.stats.dv += len(acc) * dt;
      this.avoidGround();
      /* захват причала работает и вручную: автопилот лишь один из способов подлёта */
      if (!this.returning) this.checkDock();
    }

    this.trailTimer += dt;
    if (this.trailTimer > 0.25) {
      this.trailTimer = 0;
      this.trail.push(vec(ship.p.x, ship.p.y));
      if (this.trail.length > 260) this.trail.shift();
    }
  };

  /* Ручное управление: приложение выставляет input, шаг его применяет. */
  World.prototype.setManual = function (main, strafe, turn) {
    var input = this.ship.input;
    input.main = clamp(main, -1, 1);
    input.strafe = clamp(strafe, -1, 1);
    input.turn = turn ? clamp(turn, -1, 1) * CFG.turnRate : 0;
  };

  global.Sim = {
    World: World,
    CFG: CFG,
    ORES: ORES,
    vec: vec,
    add: add,
    sub: sub,
    mul: mul,
    dot: dot,
    len: len,
    unit: unit,
    perp: perp,
    fromAngle: fromAngle,
    dist: dist,
    clamp: clamp,
    wrapAngle: wrapAngle,
    surfaceRadius: surfaceRadius,
    portPos: portPos,
    portNormal: portNormal,
    portVel: portVel
  };
})(typeof window !== 'undefined' ? window : globalThis);
