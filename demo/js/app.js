/* Демо «Добыча астероида» — связка модели, вида из кабины и приборных панелей.
   Здесь только ввод, часы и HUD; физика — в sim.js, картинка — в view.js.
   Управление: WASD — маневровые двигатели, мышь (захват по клику) — поворот,
   H — прожекторы, U — отстыковка, Space — автопилот. */

(function () {
  'use strict';

  var S = window.Sim;
  var CFG = S.CFG;

  var canvas = document.getElementById('scene');
  var view = new View(canvas, document.getElementById('map'));
  var world = new S.World({ onEvent: function () { hudDirty = true; } });

  var els = {
    phase: document.getElementById('phase'),
    phaseBox: document.getElementById('phaseBox'),
    clock: document.getElementById('clock'),
    apChip: document.getElementById('apChip'),
    lightChip: document.getElementById('lightChip'),
    warpChip: document.getElementById('warpChip'),
    apBtn: document.getElementById('apBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    resetBtn: document.getElementById('resetBtn'),
    targetTag: document.getElementById('targetTag'),
    tgtLeft: document.getElementById('tgtLeft'),
    tgtSpin: document.getElementById('tgtSpin'),
    oreBar: document.getElementById('oreBar'),
    oreMix: document.getElementById('oreMix'),
    speed: document.getElementById('speed'),
    close: document.getElementById('close'),
    dist: document.getElementById('dist'),
    mass: document.getElementById('mass'),
    dv: document.getElementById('dv'),
    hold: document.getElementById('hold'),
    holdBar: document.getElementById('holdBar'),
    holdMix: document.getElementById('holdMix'),
    adviceMode: document.getElementById('adviceMode'),
    axMainFwd: document.getElementById('axMainFwd'),
    axMainRev: document.getElementById('axMainRev'),
    axLatLeft: document.getElementById('axLatLeft'),
    axLatRight: document.getElementById('axLatRight'),
    axYawLeft: document.getElementById('axYawLeft'),
    axYawRight: document.getElementById('axYawRight'),
    advClose: document.getElementById('advClose'),
    advRel: document.getElementById('advRel'),
    pause: document.getElementById('pauseCard'),
    overlay: document.getElementById('overlay'),
    log: document.getElementById('log')
  };

  var PHASES = {
    intercept: ['Сближение', 'intercept'],
    hold: ['Выход на орбиту', 'hold'],
    final: ['Подход к причалу', 'final'],
    mining: ['Добыча', 'mining'],
    depart: ['Расстыковка', 'depart'],
    manual: ['Ручное управление', 'manual'],
    idle: ['Ожидание', 'idle']
  };
  var PHASE_EXTRA = { returning: ['Курс на базу', 'depart'] };

  var MOUSE_SENS = 0.0021;   // рад на пиксель — скорость поворота мышью

  var timeScale = 2;
  var hudDirty = true;
  var hudTimer = 0;
  var logCount = -1;
  var lastTargetId = null;
  var lastMixKey = '';
  var keys = Object.create(null);
  var started = false;

  var MANUAL_KEYS = {
    KeyW: 1, KeyS: 1, KeyA: 1, KeyD: 1,
    ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1
  };

  /* ---------- Ввод ---------- */

  window.addEventListener('keydown', function (e) {
    if (!started) {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        begin();
      }
      return;
    }
    if (e.repeat) {
      if (MANUAL_KEYS[e.code]) keys[e.code] = true;
      return;
    }
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        toggleAutopilot();
        return;
      case 'KeyP': togglePause(); return;
      case 'KeyR': reset(); return;
      case 'KeyH': toggleLights(); return;
      case 'KeyU':
        if (world.docked) {
          world.undock('РАССТЫКОВКА · по команде пилота',
            world.ship.cargo >= CFG.holdMass / 1000 - 0.5);
        }
        return;
      case 'Digit1': setTime(1); return;
      case 'Digit2': setTime(2); return;
      case 'Digit3': setTime(4); return;
      case 'Escape':
        if (!locked()) {
          if (world.paused) resume();
          else pauseGame();
        }
        return;
    }
    if (MANUAL_KEYS[e.code]) {
      keys[e.code] = true;
      e.preventDefault();
      if (world.autopilot) {
        world.autopilot = false;
        world.setManual(0, 0, 0);
        log('РУЧНОЕ УПРАВЛЕНИЕ · автопилот выключен', 'warn');
      }
    }
  });

  window.addEventListener('keyup', function (e) {
    if (MANUAL_KEYS[e.code]) keys[e.code] = false;
  });

  /* мышь: горизонталь — рыскание корабля, вертикаль — наклон камеры */
  document.addEventListener('mousemove', function (e) {
    if (!started || world.paused || world.autopilot || world.docked) return;
    if (document.pointerLockElement !== canvas) return;
    var dx = Math.max(-60, Math.min(60, e.movementX || 0));
    var dy = Math.max(-60, Math.min(60, e.movementY || 0));
    world.ship.angle = S.wrapAngle(world.ship.angle + dx * MOUSE_SENS);
    view.steer(dy);
  });

  canvas.addEventListener('click', function () {
    if (started && !world.paused && !locked()) tryLock();
  });

  document.addEventListener('pointerlockchange', function () {
    if (!locked() && started && !world.paused) pauseGame();
  });

  function locked() {
    return document.pointerLockElement === canvas;
  }

  function tryLock() {
    try {
      var p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(function () {});
    } catch (err) { /* без захвата мыши останутся стрелки поворота */ }
  }

  /* ---------- Кнопки и оверлеи ---------- */

  els.apBtn.addEventListener('click', function () { toggleAutopilot(); els.apBtn.blur(); });
  els.pauseBtn.addEventListener('click', function () { togglePause(); els.pauseBtn.blur(); });
  els.resetBtn.addEventListener('click', function () { reset(); els.resetBtn.blur(); });
  document.getElementById('startBtn').addEventListener('click', begin);
  document.getElementById('resumeBtn').addEventListener('click', resume);

  function begin() {
    started = true;
    world.paused = false;
    els.overlay.hidden = true;
    hudDirty = true;
    tryLock();
  }

  function pauseGame() {
    if (!started || world.paused) return;
    world.paused = true;
    if (locked()) document.exitPointerLock();
    els.overlay.hidden = false;
    els.pause.hidden = false;
    els.pauseBtn.textContent = 'Продолжить';
    hudDirty = true;
  }

  function resume() {
    els.overlay.hidden = true;
    els.pause.hidden = true;
    world.paused = false;
    els.pauseBtn.textContent = 'Пауза';
    hudDirty = true;
    tryLock();
  }

  function togglePause() {
    if (world.paused) resume();
    else pauseGame();
  }

  function toggleAutopilot() {
    world.autopilot = !world.autopilot;
    world.setManual(0, 0, 0);
    if (world.autopilot) log('АВТОПИЛОТ · включён, ведёт корабль к причалу', 'ok');
    else log('АВТОПИЛОТ · выключен, управление ручное', 'warn');
    hudDirty = true;
  }

  function toggleLights() {
    world.lights = !world.lights;
    log('ПРОЖЕКТОРЫ · ' + (world.lights ? 'ВКЛ' : 'ВЫКЛ'), 'info');
    hudDirty = true;
  }

  function reset() {
    world.reset();
    world.paused = !started;
    view.camReady = false;
    view.pitch = 0;
    view.pitchTarget = 0;
    logCount = -1;
    lastTargetId = null;
    lastMixKey = '';
    hudDirty = true;
  }

  function setTime(v) {
    timeScale = v;
    hudDirty = true;
  }

  function log(text, kind) {
    world.emit(text, kind);
    hudDirty = true;
  }

  /* ---------- Ручное управление ---------- */

  function applyKeys() {
    if (world.autopilot || world.docked) return;
    var main = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    var strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    var turn = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
    world.setManual(main, strafe, turn);
  }

  /* ---------- HUD ---------- */

  function fmtClock(sec) {
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return 'T+ ' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function num(v, d) {
    return v.toFixed(d).replace('.', ',');
  }

  function tons(v) {
    return num(v, v >= 100 ? 0 : 1) + ' т';
  }

  function phaseOf() {
    if (world.docked) return 'mining';
    if (!world.autopilot) return 'manual';
    if (world.returning && world.phase === 'depart') return 'returning';
    return world.phase || 'idle';
  }

  function updateHud() {
    var ast = world.target;
    var ship = world.ship;
    var key = phaseOf();
    var pair = PHASES[key] || PHASE_EXTRA[key] || PHASES.idle;
    els.phase.textContent = pair[0].toUpperCase();
    els.phaseBox.setAttribute('data-phase', pair[1]);
    els.clock.textContent = fmtClock(world.time);

    if (ast) {
      var dPort = S.dist(ship.p, S.portPos(ast));
      var vRel = S.sub(ship.v, S.portVel(ast));
      var toPort = S.unit(S.sub(S.portPos(ast), ship.p));
      var closing = S.dot(vRel, toPort);
      els.targetTag.textContent = ast.id;
      els.tgtLeft.textContent = num(ast.oreLeft, 1) + ' / ' + num(ast.oreTotal, 1) + ' т';
      els.oreBar.style.width = Math.max(0, Math.min(100, ast.oreLeft / ast.oreTotal * 100)) + '%';
      els.tgtSpin.textContent = num(Math.abs(ast.spin) * 180 / Math.PI, 1) + ' °/с';
      els.dist.textContent = window.View.fmtMeters(dPort);
      els.close.textContent = (closing >= 0 ? '+' : '−') + num(Math.abs(closing), 1) + ' м/с';
      els.close.style.color = dPort < 90 && closing > 3 ? '#ff5f7a' : '';
      if (lastTargetId !== ast.id) {
        lastTargetId = ast.id;
        renderOreMix(ast);
      }
    } else {
      els.targetTag.textContent = '—';
      els.tgtLeft.textContent = '—';
      els.tgtSpin.textContent = '—';
      els.oreBar.style.width = '0%';
      els.dist.textContent = '—';
      els.close.textContent = '—';
      if (lastTargetId !== null) {
        lastTargetId = null;
        els.oreMix.innerHTML = '<li class="empty">Цель обработана</li>';
      }
    }

    els.speed.textContent = num(S.len(ship.v), 1) + ' м/с';
    els.mass.textContent = tons(ship.mass / 1000);
    els.dv.textContent = Math.round(world.stats.dv) + ' м/с';
    els.hold.textContent = num(ship.cargo, 1) + ' / ' + num(CFG.holdMass / 1000, 0) + ' т';
    els.holdBar.style.width = Math.min(100, ship.cargo / (CFG.holdMass / 1000) * 100) + '%';
    renderHoldMix();

    /* панель «Манёвр»: стрелки повторяют расчёт автопилота из advice() */
    var ad = world.advice();
    var modeNames = {
      intercept: 'СБЛИЖЕНИЕ',
      hold: 'ВЫХОД НА ОРБИТУ',
      final: 'ПОДХОД',
      mining: 'ДОБЫЧА · U — ОТСТЫКОВКА',
      idle: 'ОЖИДАНИЕ'
    };
    els.adviceMode.textContent = modeNames[ad.mode] || 'РУЧНОЙ ПОЛЁТ';
    els.adviceMode.classList.toggle('mining', ad.mode === 'mining');
    var active = ad.mode !== 'mining' && ad.mode !== 'idle';
    els.axMainFwd.classList.toggle('on', active && ad.main > 0.25);
    els.axMainRev.classList.toggle('on', active && ad.main < -0.25);
    els.axLatLeft.classList.toggle('on', active && ad.strafe < -0.25);
    els.axLatRight.classList.toggle('on', active && ad.strafe > 0.25);
    /* yawErr > 0 — цель правее носа: крутим вправо */
    els.axYawRight.classList.toggle('on', active && ad.turn > 0.3);
    els.axYawLeft.classList.toggle('on', active && ad.turn < -0.3);
    els.advClose.textContent = ast
      ? 'V сбл ' + (ad.closing >= 0 ? '+' : '−') + num(Math.abs(ad.closing), 1) + ' м/с'
      : '—';
    els.advRel.textContent = ast ? 'V отн ' + num(ad.vRel, 1) + ' м/с' : '—';

    els.apChip.textContent = 'АВТОПИЛОТ · ' + (world.autopilot ? 'ВКЛ' : 'ВЫКЛ');
    els.apBtn.classList.toggle('is-on', world.autopilot);
    els.lightChip.textContent = 'ПРОЖЕКТОРЫ · ' + (world.lights ? 'ВКЛ' : 'ВЫКЛ');
    els.warpChip.textContent = 'ВРЕМЯ ×' + timeScale;

    renderLog();
  }

  function renderOreMix(ast) {
    var html = '';
    for (var i = 0; i < ast.mix.length; i++) {
      var m = ast.mix[i];
      html += '<li><i style="background:' + m.color + '"></i>' + m.name +
        '<b>' + Math.round(m.share * 100) + '%</b></li>';
    }
    els.oreMix.innerHTML = html;
  }

  function renderHoldMix() {
    var mix = world.ship.cargoMix;
    var parts = [];
    var total = 0;
    var key = '';
    for (var name in mix) {
      if (!Object.prototype.hasOwnProperty.call(mix, name)) continue;
      total += mix[name];
      key += name + ':' + Math.round(mix[name] / 5) + ';';
    }
    if (key === lastMixKey) return;
    lastMixKey = key;
    if (!total) {
      els.holdMix.innerHTML = '<span class="muted">пусто</span>';
      return;
    }
    var names = Object.keys(mix).sort(function (a, b) { return mix[b] - mix[a]; }).slice(0, 3);
    for (var i = 0; i < names.length; i++) {
      var share = mix[names[i]] / total;
      parts.push('<span>' + names[i] + ' · ' + Math.round(share * 100) + '%</span>');
    }
    els.holdMix.innerHTML = parts.join('<i class="dot">·</i>');
  }

  function renderLog() {
    if (world.events.length === logCount) return;
    logCount = world.events.length;
    var list = world.events.slice(-6).reverse();
    var html = '';
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      html += '<li class="' + e.kind + '"><time>' + fmtClock(e.t).replace('T+ ', '') + '</time>' +
        '<span>' + e.text + '</span></li>';
    }
    els.log.innerHTML = html;
  }

  /* ---------- Цикл ---------- */

  var last = performance.now();
  var acc = 0;

  function frame(now) {
    var dt = Math.min(0.06, (now - last) / 1000);
    last = now;

    if (!world.paused) {
      acc += dt * timeScale;
      var guard = 0;
      while (acc > 1e-4 && guard < 24) {
        var h = Math.min(acc, 1 / 120);
        applyKeys();
        world.step(h);
        acc -= h;
        guard++;
      }
      if (guard >= 24) acc = 0;
    }

    view.render(world, dt);

    hudTimer += dt;
    if (hudDirty || hudTimer > 0.12) {
      hudTimer = 0;
      hudDirty = false;
      updateHud();
    }

    requestAnimationFrame(frame);
  }

  /* ---------- Отладка: окно для автопроверки в браузере ---------- */

  window.__demo = {
    world: world,
    view: view,
    begin: begin,
    key: function (code, down) { keys[code] = !!down; },
    lights: toggleLights,
    dock: function () { if (world.target) world.dock(); },
    teleport: function (d) {
      var ast = world.target;
      if (!ast) return;
      var n = S.portNormal(ast);
      world.ship.p = S.add(S.portPos(ast), S.mul(n, d || 120));
      world.ship.v = S.portVel(ast);
      world.ship.angle = Math.atan2(-n.y, -n.x);
      view.camReady = false;
    }
  };

  world.paused = true;
  setTime(timeScale);
  updateHud();
  requestAnimationFrame(frame);
})();
