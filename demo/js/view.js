/* Демо «Добыча астероида» — вид из кабины, программный 3D на Canvas 2D.
   Без библиотек: перспективная проекция, отсечение задних граней и ближней
   плоскости, художник по глубине. Камера в носу корабля (10 м над плоскостью
   мира, мир плоский). Астероиды — меши: экватор меша совпадает с 2D-формой
   из модели, поэтому причал стоит точно на грунте. Кабина — 3D-рама,
   кэшируемая в offscreen-канву. */

(function (global) {
  'use strict';

  var S = global.Sim;
  var TAU = Math.PI * 2;

  var C = {
    teal: '#75dfd2',
    violet: '#aa88f6',
    ice: '#bffcfc',
    dim: 'rgba(126, 147, 147, .9)',
    danger: '#ff5f7a'
  };
  var MONO = '"IBM Plex Mono", Consolas, monospace';

  var FOV = 1.34;      // рад, ≈77°
  var CAM_H = 10;      // м, глаз над плоскостью мира
  var NOSE = 8.5;      // м, камера впереди центра корабля
  var NEAR = 0.6;      // м, ближняя плоскость отсечения

  /* Солнце в локальном кадре далеко слева-снизу: свет и блики считаем от него. */
  var SUN3 = (function () {
    var v = { x: -0.62, y: 0.78, z: 0.16 };
    var l = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    return { x: v.x / l, y: v.y / l, z: v.z / l };
  })();

  /* детерминированный «шум» по двум целым */
  function hash2(a, b) {
    var x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function hexRgb(h) {
    return {
      r: parseInt(h.slice(1, 3), 16),
      g: parseInt(h.slice(3, 5), 16),
      b: parseInt(h.slice(5, 7), 16)
    };
  }

  /* отсечение полигона (в координатах камеры) ближней плоскостью */
  function clipNear(pts) {
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i];
      var b = pts[(i + 1) % pts.length];
      var ain = a.z > NEAR;
      var bin = b.z > NEAR;
      if (ain) out.push(a);
      if (ain !== bin) {
        var t = (NEAR - a.z) / (b.z - a.z);
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NEAR });
      }
    }
    return out;
  }

  function View(canvas, mapCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mapCanvas = mapCanvas;
    this.mctx = mapCanvas ? mapCanvas.getContext('2d') : null;
    this.cam = { x: 0, y: 0 };
    this.camReady = false;
    this.pitch = 0;
    this.pitchTarget = 0;
    this.eyeH = CAM_H;  /* высота глаза: на причале опускается к грунту */
    this.shake = 0;
    this.stars = [];
    this.dust = [];
    this.flash = 0;
    this.wasDocked = false;
    this.time = 0;
    this._vx = [];
    this._vy = [];
    this._vz = [];
    this.cockpitCanvas = null;
    this.resize();
  }

  /* ---------- Размеры ---------- */

  View.prototype.resize = function () {
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    this.dpr = dpr;
    this.w = global.innerWidth;
    this.h = global.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.focal = (this.h / 2) / Math.tan(FOV / 2);

    if (this.mapCanvas) {
      this.mapW = this.mapCanvas.clientWidth || 246;
      this.mapH = this.mapCanvas.clientHeight || 150;
      this.mapCanvas.width = Math.round(this.mapW * dpr);
      this.mapCanvas.height = Math.round(this.mapH * dpr);
    }
    this.makeStars();
    this.dust = [];
    this.buildCockpit();
  };

  View.prototype.makeStars = function () {
    var r = 424243;
    var rnd = function () {
      r = (r * 16807) % 2147483647;
      return (r - 1) / 2147483646;
    };
    this.stars = [];
    for (var i = 0; i < 250; i++) {
      var z = rnd() * 2 - 1;
      var a = rnd() * TAU;
      var rr = Math.sqrt(Math.max(0, 1 - z * z));
      this.stars.push({
        x: Math.cos(a) * rr, y: Math.sin(a) * rr, z: z,
        s: rnd() < 0.85 ? 1 : 2,
        a: 0.12 + rnd() * 0.55,
        teal: rnd() < 0.16
      });
    }
  };

  /* ---------- Камера и проекция ---------- */

  View.prototype.basis = function (world) {
    var yaw = world.ship.angle;
    var p = this.pitch;
    var cf = Math.cos(p), sf = Math.sin(p);
    var cx = Math.cos(yaw), sx = Math.sin(yaw);
    return {
      f: { x: cx * cf, y: sx * cf, z: sf },
      r: { x: -sx, y: cx, z: 0 },
      u: { x: -sf * cx, y: -sf * sx, z: cf }
    };
  };

  /* точка плоскости мира (z = 0) */
  View.prototype.proj = function (p, B) {
    var dx = p.x - this.cam.x;
    var dy = p.y - this.cam.y;
    var dz = -this.eyeH;
    var cz = dx * B.f.x + dy * B.f.y + dz * B.f.z;
    return {
      x: this.w / 2 + this.focal * (dx * B.r.x + dy * B.r.y + dz * B.r.z) / cz,
      y: this.h / 2 - this.focal * (dx * B.u.x + dy * B.u.y + dz * B.u.z) / cz,
      cz: cz
    };
  };

  /* точка 3D — для лучей прожекторов */
  View.prototype.proj3 = function (p, B) {
    var dx = p.x - this.cam.x;
    var dy = p.y - this.cam.y;
    var dz = p.z - this.eyeH;
    var cz = dx * B.f.x + dy * B.f.y + dz * B.f.z;
    return {
      x: this.w / 2 + this.focal * (dx * B.r.x + dy * B.r.y + dz * B.r.z) / cz,
      y: this.h / 2 - this.focal * (dx * B.u.x + dy * B.u.y + dz * B.u.z) / cz,
      cz: cz
    };
  };

  /* направление (звёзды, солнце, вектор скорости) */
  View.prototype.projDir = function (d, B) {
    var cz = d.x * B.f.x + d.y * B.f.y + d.z * B.f.z;
    return {
      x: this.w / 2 + this.focal * (d.x * B.r.x + d.y * B.r.y + d.z * B.r.z) / cz,
      y: this.h / 2 - this.focal * (d.x * B.u.x + d.y * B.u.y + d.z * B.u.z) / cz,
      cz: cz
    };
  };

  View.prototype.steer = function (dy) {
    this.pitchTarget = S.clamp(this.pitchTarget - dy * 0.0016, -0.5, 0.62);
  };

  /* ---------- Кадр ---------- */

  View.prototype.render = function (world, dt) {
    var ctx = this.ctx;
    this.time += dt;

    var heading = S.fromAngle(world.ship.angle);
    var tx = world.ship.p.x + heading.x * NOSE;
    var ty = world.ship.p.y + heading.y * NOSE;
    if (!this.camReady) {
      this.cam.x = tx;
      this.cam.y = ty;
      this.camReady = true;
    }
    var k = 1 - Math.exp(-dt * 26);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    this.pitch += (this.pitchTarget - this.pitch) * (1 - Math.exp(-dt * 9));
    /* на причале взгляд пилота опускается на точку бурения,
       а кресло проваливается ниже — причал попадает в кадр */
    this.eyeH += ((world.docked ? 2.2 : CAM_H) - this.eyeH) * Math.min(1, dt * 2.2);
    if (world.docked) {
      this.pitchTarget += (-0.3 - this.pitchTarget) * Math.min(1, dt * 2.2);
    }

    /* камера не заходит внутрь камня: у стыковочного узла она почти на грунте,
       и без этого клампа соседние грани меша отсекаются — видно небо насквозь */
    var astC = world.target;
    if (astC) {
      var awayX = this.cam.x - astC.p.x;
      var awayY = this.cam.y - astC.p.y;
      var dc = Math.hypot(awayX, awayY) || 1;
      var surf = S.surfaceRadius(astC, Math.atan2(awayY, awayX)) + 3;
      if (dc < surf) {
        this.cam.x = astC.p.x + awayX / dc * surf;
        this.cam.y = astC.p.y + awayY / dc * surf;
      }
    }

    /* тряска: от работающих двигателей и от бура на причале */
    var thr = Math.abs(world.ship.input.main || 0) + Math.abs(world.ship.input.strafe || 0);
    var amp = world.docked ? 0.32 : Math.min(1, thr) * 0.85;
    this.shake += (amp - this.shake) * Math.min(1, dt * 8);
    var jx = (Math.random() - 0.5) * this.shake * 2.4;
    var jy = (Math.random() - 0.5) * this.shake * 2.4;

    var B = this.basis(world);
    /* направление на Солнце в осях камеры — общий свет для мешей */
    this._sunCam = {
      x: SUN3.x * B.r.x + SUN3.y * B.r.y + SUN3.z * B.r.z,
      y: SUN3.x * B.u.x + SUN3.y * B.u.y + SUN3.z * B.u.z,
      z: SUN3.x * B.f.x + SUN3.y * B.f.y + SUN3.z * B.f.z
    };

    ctx.setTransform(this.dpr, 0, 0, this.dpr, jx * this.dpr, jy * this.dpr);
    ctx.clearRect(-24, -24, this.w + 48, this.h + 48);

    var sunP = this.projDir(SUN3, B);
    this.drawBackground(B, sunP);
    this.drawDust(world, B);
    this.drawRocks(world, B);
    this.drawThrust(world);
    if (world.lights) this.drawBeams(B);
    this.drawCockpit(world);
    if (world.target) this.drawGuidance(world, B);
    this.drawReticle(world);

    /* вспышка при захвате */
    if (world.docked && !this.wasDocked) this.flash = 1;
    this.wasDocked = world.docked;
    this.flash = Math.max(0, this.flash - dt * 0.9);
    if (this.flash > 0 && (world.dockedTo || world.target)) {
      var p = this.proj(S.portPos(world.dockedTo || world.target), B);
      ctx.globalAlpha = this.flash * 0.6;
      ctx.strokeStyle = C.ice;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (1 - this.flash) * 110 + 8, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    this.renderMap(world);
  };

  /* ---------- Фон ---------- */

  View.prototype.drawBackground = function (B, sunP) {
    var ctx = this.ctx;
    var w = this.w, h = this.h;

    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#04060b');
    g.addColorStop(0.55, '#060a11');
    g.addColorStop(1, '#04070c');
    ctx.fillStyle = g;
    ctx.fillRect(-24, -24, w + 48, h + 48);

    var neb = ctx.createRadialGradient(w * 0.72, h * 0.2, 0, w * 0.72, h * 0.2, w * 0.7);
    neb.addColorStop(0, 'rgba(170, 136, 246, .09)');
    neb.addColorStop(0.55, 'rgba(90, 60, 150, .035)');
    neb.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = neb;
    ctx.fillRect(-24, -24, w + 48, h + 48);

    /* звёзды — направления на сфере, поворачиваются вместе с кабиной */
    for (var i = 0; i < this.stars.length; i++) {
      var st = this.stars[i];
      var cz = st.x * B.f.x + st.y * B.f.y + st.z * B.f.z;
      if (cz < 0.03) continue;
      var x = w / 2 + this.focal * (st.x * B.r.x + st.y * B.r.y + st.z * B.r.z) / cz;
      var y = h / 2 - this.focal * (st.x * B.u.x + st.y * B.u.y + st.z * B.u.z) / cz;
      if (x < -8 || x > w + 8 || y < -8 || y > h + 8) continue;
      if (sunP.cz > 0.03) {
        var ds = Math.hypot(x - sunP.x, y - sunP.y);
        if (ds < 120) continue;
      }
      ctx.globalAlpha = st.a;
      ctx.fillStyle = st.teal ? C.teal : '#dce8e8';
      ctx.fillRect(x, y, st.s, st.s);
    }
    ctx.globalAlpha = 1;

    /* Солнце — далёкий диск с ореолом в левой нижней четверти */
    if (sunP.cz > 0.03) {
      var halo = ctx.createRadialGradient(sunP.x, sunP.y, 0, sunP.x, sunP.y, w * 0.46);
      halo.addColorStop(0, 'rgba(234, 255, 251, .22)');
      halo.addColorStop(0.3, 'rgba(150, 232, 220, .07)');
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(-24, -24, w + 48, h + 48);

      ctx.fillStyle = '#f2fffc';
      ctx.beginPath();
      ctx.arc(sunP.x, sunP.y, 4.2, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = C.ice;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sunP.x - 26, sunP.y);
      ctx.lineTo(sunP.x + 26, sunP.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  };

  /* ---------- Пыль: ощущение движения ---------- */

  View.prototype.drawDust = function (world, B) {
    var ctx = this.ctx;
    var box = 170;
    var v = world.ship.v;
    var speed = S.len(v);
    var vn = speed > 0.01 ? S.mul(v, 1 / speed) : S.vec(0, 0);
    var streak = Math.min(5.5, speed * 0.09);
    var i, d;

    if (!this.dust.length) {
      for (i = 0; i < 130; i++) {
        this.dust.push({
          x: this.cam.x + (Math.random() - 0.5) * 2 * box,
          y: this.cam.y + (Math.random() - 0.5) * 2 * box,
          d: 0.3 + Math.random() * 0.7
        });
      }
    }
    for (i = 0; i < this.dust.length; i++) {
      d = this.dust[i];
      if (Math.abs(d.x - this.cam.x) > box || Math.abs(d.y - this.cam.y) > box) {
        d.x = this.cam.x + (Math.random() - 0.5) * 2 * box;
        d.y = this.cam.y + (Math.random() - 0.5) * 2 * box;
      }
      var p = this.proj(d, B);
      if (p.cz < 1.5 || p.x < -10 || p.x > this.w + 10 || p.y < -10 || p.y > this.h + 10) continue;
      ctx.globalAlpha = 0.08 + d.d * 0.22;
      if (streak > 0.4) {
        var t = this.proj(S.vec(d.x - vn.x * streak, d.y - vn.y * streak), B);
        ctx.strokeStyle = '#bffcfc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#bffcfc';
        ctx.fillRect(p.x, p.y, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  };

  /* ---------- 3D-меши астероидов ----------
     Сфера по широтам: экватор повторяет 2D-форму из модели (причал на грунте),
     к полюсам радиус уходит к среднему с шумом. Кратеры — вмятины по конусам,
     рудные прожилки — цветные пятна на гранях. Всё строится один раз. */

  View.prototype.rockMesh = function (ast) {
    if (ast._mesh) return ast._mesh;
    var SEG = 20;
    var LATS = [-1.309, -0.8727, -0.4363, 0, 0.4363, 0.8727, 1.309];

    var step = TAU / ast.shape.length;
    var mean = 0;
    for (var i = 0; i < ast.shape.length; i++) mean += ast.shape[i].r;
    mean /= ast.shape.length;

    function shapeAt(lon) {
      var a = lon % TAU;
      if (a < 0) a += TAU;
      var fi = a / step;
      var i0 = Math.floor(fi) % ast.shape.length;
      var i1 = (i0 + 1) % ast.shape.length;
      return ast.shape[i0].r + (ast.shape[i1].r - ast.shape[i0].r) * (fi - Math.floor(fi));
    }

    /* кратеры из модели (2D) переносим на сферу */
    var craters = [];
    for (var c = 0; c < ast.craters.length; c++) {
      var cr = ast.craters[c];
      var lat = (hash2(c, 11) - 0.5) * 1.6;
      craters.push({
        dx: Math.cos(cr.a) * Math.cos(lat),
        dy: Math.sin(cr.a) * Math.cos(lat),
        dz: Math.sin(lat),
        ang: 0.16 + cr.r * 1.5,
        depth: 0.08 + cr.r * 0.55
      });
    }

    /* по пятну руды на каждую фракцию */
    var veins = [];
    for (var m = 0; m < ast.mix.length; m++) {
      var u = hash2(m, 41), v = hash2(m, 73);
      var zz = u * 2 - 1, aa = v * TAU;
      var rr2 = Math.sqrt(Math.max(0, 1 - zz * zz));
      veins.push({
        x: Math.cos(aa) * rr2, y: Math.sin(aa) * rr2, z: zz,
        ang: 0.45 + hash2(m, 97) * 0.4,
        col: hexRgb(ast.mix[m].color)
      });
    }

    var verts = [];
    var rings = [];
    for (var L = 0; L < LATS.length; L++) {
      var lat = LATS[L];
      var cl = Math.cos(lat), sl = Math.sin(lat);
      var kk = Math.pow(Math.abs(sl), 0.75);
      var row = [];
      for (var s = 0; s < SEG; s++) {
        var lon = s / SEG * TAU;
        var rad = shapeAt(lon) * (1 - kk) + mean * kk * (0.82 + 0.36 * hash2(L * 7 + 3, s * 13 + 1));
        var dir = { x: cl * Math.cos(lon), y: cl * Math.sin(lon), z: sl };
        for (var q = 0; q < craters.length; q++) {
          var cq = craters[q];
          var dot = dir.x * cq.dx + dir.y * cq.dy + dir.z * cq.dz;
          var angD = Math.acos(Math.max(-1, Math.min(1, dot)));
          if (angD < cq.ang) {
            var f = 1 - Math.pow(angD / cq.ang, 2);
            rad *= 1 - cq.depth * f * f;
          }
        }
        row.push(verts.length);
        verts.push({ x: dir.x * rad, y: dir.y * rad, z: dir.z * rad });
      }
      rings.push(row);
    }
    var topI = verts.length;
    verts.push({ x: 0, y: 0, z: mean * 0.86 });
    var botI = verts.length;
    verts.push({ x: 0, y: 0, z: -mean * 0.86 });

    var faces = [];
    var fi = 0;
    function addFace(idx) {
      var j;
      var cx = 0, cy = 0, cz = 0;
      for (j = 0; j < idx.length; j++) {
        cx += verts[idx[j]].x; cy += verts[idx[j]].y; cz += verts[idx[j]].z;
      }
      cx /= idx.length; cy /= idx.length; cz /= idx.length;
      var cl2 = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
      var nx = cx / cl2, ny = cy / cl2, nz = cz / cl2;

      /* намотка наружу от центра */
      var p0 = verts[idx[0]], p1 = verts[idx[1]], p2 = verts[idx[2]];
      var u2 = { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z };
      var v2 = { x: p2.x - p0.x, y: p2.y - p0.y, z: p2.z - p0.z };
      var cr2 = {
        x: u2.y * v2.z - u2.z * v2.y,
        y: u2.z * v2.x - u2.x * v2.z,
        z: u2.x * v2.y - u2.y * v2.x
      };
      if (cr2.x * nx + cr2.y * ny + cr2.z * nz < 0) {
        if (idx.length === 3) idx = [idx[0], idx[2], idx[1]];
        else idx = [idx[0], idx[3], idx[2], idx[1]];
      }

      /* цвет грани: серо-синий базовый + руда + затемнение в кратерах */
      var jb = 0.25 + 0.75 * hash2(fi, 5);
      var r = 24 + 44 * jb, g = 32 + 52 * jb, b = 46 + 62 * jb;
      for (j = 0; j < veins.length; j++) {
        var vn3 = veins[j];
        var dv = nx * vn3.x + ny * vn3.y + nz * vn3.z;
        var av = Math.acos(Math.max(-1, Math.min(1, dv)));
        if (av < vn3.ang) {
          var wv = 1 - av / vn3.ang;
          r += (vn3.col.r - r) * wv * 0.5;
          g += (vn3.col.g - g) * wv * 0.5;
          b += (vn3.col.b - b) * wv * 0.5;
        }
      }
      for (j = 0; j < craters.length; j++) {
        var cq2 = craters[j];
        var dc = nx * cq2.dx + ny * cq2.dy + nz * cq2.dz;
        var ac = Math.acos(Math.max(-1, Math.min(1, dc)));
        if (ac < cq2.ang) {
          var dk = 1 - 0.22 * (1 - ac / cq2.ang);
          r *= dk; g *= dk; b *= dk;
        }
      }
      faces.push({ idx: idx, col: { r: r | 0, g: g | 0, b: b | 0 } });
      fi++;
    }

    for (var band = 0; band < rings.length - 1; band++) {
      for (var s2 = 0; s2 < SEG; s2++) {
        addFace([
          rings[band][s2],
          rings[band][(s2 + 1) % SEG],
          rings[band + 1][(s2 + 1) % SEG],
          rings[band + 1][s2]
        ]);
      }
    }
    var last = rings.length - 1;
    for (var s3 = 0; s3 < SEG; s3++) {
      addFace([topI, rings[0][s3], rings[0][(s3 + 1) % SEG]]);
      addFace([botI, rings[last][(s3 + 1) % SEG], rings[last][s3]]);
    }

    ast._mesh = { verts: verts, faces: faces };
    return ast._mesh;
  };

  View.prototype.drawRocks = function (world, B) {
    var list = world.asteroids.slice();
    var cam = this.cam;
    list.sort(function (a, b) {
      var da = (a.p.x - cam.x) * (a.p.x - cam.x) + (a.p.y - cam.y) * (a.p.y - cam.y);
      var db = (b.p.x - cam.x) * (b.p.x - cam.x) + (b.p.y - cam.y) * (b.p.y - cam.y);
      return db - da;
    });
    for (var i = 0; i < list.length; i++) {
      this.drawRock(world, list[i], list[i] === world.target, B);
    }
  };

  View.prototype.drawRock = function (world, ast, isTarget, B) {
    var ctx = this.ctx;
    var dx = ast.p.x - this.cam.x;
    var dy = ast.p.y - this.cam.y;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    var c = this.proj(ast.p, B);
    if (c.cz < 1.2) return;
    var R = this.focal * ast.radius / c.cz;
    var depleted = ast.oreLeft <= 0.05;

    if (R < 0.7) {
      ctx.globalAlpha = isTarget ? 0.8 : 0.35;
      ctx.fillStyle = isTarget ? C.teal : '#7e9393';
      ctx.fillRect(c.x - 1, c.y - 1, 2, 2);
      ctx.globalAlpha = 1;
      return;
    }

    /* далёкий ЛОД: плоский диск, освещённый с солнечной стороны */
    if (R < 7) {
      var gx = SUN3.x * B.r.x + SUN3.y * B.r.y + SUN3.z * B.r.z;
      var gy = -(SUN3.x * B.u.x + SUN3.y * B.u.y + SUN3.z * B.u.z);
      var gl = Math.hypot(gx, gy) || 1;
      gx /= gl; gy /= gl;
      var lg = ctx.createLinearGradient(c.x - gx * R, c.y - gy * R, c.x + gx * R, c.y + gy * R);
      lg.addColorStop(0, depleted ? '#141c28' : '#3c5270');
      lg.addColorStop(1, '#080d14');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(c.x, c.y, R, 0, TAU);
      ctx.fill();
      if (isTarget) {
        ctx.strokeStyle = 'rgba(117, 223, 210, .4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(c.x, c.y, R + 4, 0, TAU);
        ctx.stroke();
      }
      return;
    }

    var mesh = this.rockMesh(ast);
    var n = mesh.verts.length;
    var vx = this._vx, vy = this._vy, vz = this._vz;
    while (vx.length < n) { vx.push(0); vy.push(0); vz.push(0); }
    var ca = Math.cos(ast.angle), sa = Math.sin(ast.angle);
    var f = B.f, r = B.r, u = B.u;
    var i;

    /* вершины: поворот вокруг оси Z (вращение камня) и перенос в мир */
    for (i = 0; i < n; i++) {
      var p = mesh.verts[i];
      var wx = p.x * ca - p.y * sa + ast.p.x;
      var wy = p.x * sa + p.y * ca + ast.p.y;
      var ddx = wx - this.cam.x;
      var ddy = wy - this.cam.y;
      var ddz = p.z - this.eyeH;
      vz[i] = ddx * f.x + ddy * f.y + ddz * f.z;
      vx[i] = ddx * r.x + ddy * r.y + ddz * r.z;
      vy[i] = ddx * u.x + ddy * u.y + ddz * u.z;
    }

    /* прожектор: свет от камеры на камень */
    var headW = 0;
    if (world.lights && d < 950) {
      var fh = Math.hypot(f.x, f.y) || 1;
      var cosA = (dx / d) * (f.x / fh) + (dy / d) * (f.y / fh);
      if (cosA > 0.78) headW = (1 - d / 950) * Math.min(1, (cosA - 0.78) * 6) * 1.1;
    }
    var mul = depleted ? 0.55 : 1;
    var sunCam = this._sunCam;
    var out = [];

    for (var fi = 0; fi < mesh.faces.length; fi++) {
      var face = mesh.faces[fi];
      var ix = face.idx;
      var i0 = ix[0], i1 = ix[1], i2 = ix[2];
      var ax = vx[i1] - vx[i0], ay = vy[i1] - vy[i0], az = vz[i1] - vz[i0];
      var bx = vx[i2] - vx[i0], by = vy[i2] - vy[i0], bz = vz[i2] - vz[i0];
      var nx = ay * bz - az * by;
      var ny = az * bx - ax * bz;
      var nz = ax * by - ay * bx;
      if (nz > 0) continue; /* грань отвёрнута от камеры */
      var nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;

      var light = (0.15 + Math.max(0, nx * sunCam.x + ny * sunCam.y + nz * sunCam.z) * 0.95 +
        headW * Math.max(0, -nz)) * mul;
      if (light > 1.25) light = 1.25;

      var zsum = 0;
      var ok = true;
      var pts3 = [];
      for (var k = 0; k < ix.length; k++) {
        zsum += vz[ix[k]];
        if (vz[ix[k]] < NEAR) ok = false;
        pts3.push({ x: vx[ix[k]], y: vy[ix[k]], z: vz[ix[k]] });
      }
      if (!ok) {
        pts3 = clipNear(pts3);
        if (pts3.length < 3) continue;
      }
      var col = face.col;
      out.push({
        z: zsum / ix.length,
        pts: pts3,
        css: 'rgb(' + Math.min(255, col.r * light | 0) + ',' +
          Math.min(255, col.g * light | 0) + ',' +
          Math.min(255, col.b * light | 0) + ')'
      });
    }

    out.sort(function (a, b) { return b.z - a.z; });
    for (i = 0; i < out.length; i++) {
      var poly = out[i];
      ctx.beginPath();
      for (var q2 = 0; q2 < poly.pts.length; q2++) {
        var pt = poly.pts[q2];
        var inv = this.focal / pt.z;
        var sx = this.w / 2 + pt.x * inv;
        var sy = this.h / 2 - pt.y * inv;
        if (q2 === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fillStyle = poly.css;
      ctx.strokeStyle = poly.css;
      ctx.lineWidth = 0.6;
      ctx.fill();
      ctx.stroke();
    }

    if (isTarget) {
      ctx.strokeStyle = 'rgba(117, 223, 210, .22)';
      ctx.setLineDash([3, 6]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(c.x, c.y, R + 14, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  /* ---------- 3D-кабина ----------
     Рама вокруг окна: панели заданы в экранных долях с глубиной (для нормалей
     и освещения), собираются один раз в offscreen-канву. Корпуса прожекторов
     на доске рисуются поверх — они меняются по клавише H. */

  View.prototype.buildCockpit = function () {
    var dpr = this.dpr, w = this.w, h = this.h;
    var cv = document.createElement('canvas');
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    var g = cv.getContext('2d');
    g.scale(dpr, dpr);

    var focal = this.focal;
    function pt3(fx, fy, z) {
      return { x: (fx * w - w / 2) / focal * z, y: (h / 2 - fy * h) / focal * z, z: z };
    }

    /* свет в кабине — из-за плеча пилота, сверху */
    var L = { x: -0.25, y: 0.55, z: -0.8 };
    var ll = Math.hypot(L.x, L.y, L.z);
    L.x /= ll; L.y /= ll; L.z /= ll;

    var panels = [
      /* верхняя балка */
      { poly: [[-0.05, -0.08, 2.0], [1.05, -0.08, 2.0], [0.985, 0.075, 1.05], [0.015, 0.075, 1.05]] },
      /* левая стойка */
      { poly: [[-0.05, -0.05, 2.0], [0.015, 0.075, 1.05], [0.115, 0.52, 1.08], [0.02, 0.87, 1.12], [-0.05, 0.95, 1.9]] },
      /* правая стойка */
      { poly: [[1.05, -0.05, 2.0], [0.985, 0.075, 1.05], [0.885, 0.52, 1.08], [0.98, 0.87, 1.12], [1.05, 0.95, 1.9]] },
      /* левый борт */
      { poly: [[-0.05, 0.95, 1.9], [0.02, 0.87, 1.12], [0.13, 1.08, 1.3], [-0.05, 1.10, 2.0]] },
      /* правый борт */
      { poly: [[1.05, 0.95, 1.9], [0.98, 0.87, 1.12], [0.87, 1.08, 1.3], [1.05, 1.10, 2.0]] },
      /* приборная доска */
      { poly: [[0.02, 0.87, 1.12], [0.98, 0.87, 1.12], [0.90, 1.10, 0.85], [0.10, 1.10, 0.85]] },
      /* раскосы поверх стекла */
      { poly: [[0.235, 0.075, 1.05], [0.275, 0.075, 1.05], [0.150, 0.42, 1.25], [0.118, 0.38, 1.25]], rib: true },
      { poly: [[0.765, 0.075, 1.05], [0.725, 0.075, 1.05], [0.850, 0.42, 1.25], [0.882, 0.38, 1.25]], rib: true }
    ];

    for (var i = 0; i < panels.length; i++) {
      var pn = panels[i];
      var pts = [];
      for (var j = 0; j < pn.poly.length; j++) {
        pts.push(pt3(pn.poly[j][0], pn.poly[j][1], pn.poly[j][2]));
      }
      var u2 = { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y, z: pts[1].z - pts[0].z };
      var v2 = { x: pts[2].x - pts[0].x, y: pts[2].y - pts[0].y, z: pts[2].z - pts[0].z };
      var nx = u2.y * v2.z - u2.z * v2.y;
      var ny = u2.z * v2.x - u2.x * v2.z;
      var nz = u2.x * v2.y - u2.y * v2.x;
      var nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      var l = Math.max(0.12, nx * L.x + ny * L.y + nz * L.z);
      var base = pn.rib ? [8, 11, 17] : [11, 15, 23];
      var hi = pn.rib ? [24, 32, 46] : [32, 43, 60];
      var rr = base[0] + (hi[0] - base[0]) * l;
      var gg = base[1] + (hi[1] - base[1]) * l;
      var bb = base[2] + (hi[2] - base[2]) * l;

      g.beginPath();
      for (var q = 0; q < pts.length; q++) {
        var sx = pn.poly[q][0] * w;
        var sy = pn.poly[q][1] * h;
        if (q === 0) g.moveTo(sx, sy);
        else g.lineTo(sx, sy);
      }
      g.closePath();
      g.fillStyle = 'rgb(' + (rr | 0) + ',' + (gg | 0) + ',' + (bb | 0) + ')';
      g.fill();
      g.strokeStyle = 'rgba(4, 7, 11, .75)';
      g.lineWidth = 1;
      g.stroke();
    }

    /* кромка оконного проёма */
    var ap = [[0.015, 0.075], [0.985, 0.075], [0.98, 0.87], [0.02, 0.87]];
    g.beginPath();
    for (i = 0; i < ap.length; i++) {
      if (i === 0) g.moveTo(ap[i][0] * w, ap[i][1] * h);
      else g.lineTo(ap[i][0] * w, ap[i][1] * h);
    }
    g.closePath();
    g.strokeStyle = 'rgba(150, 190, 255, .22)';
    g.lineWidth = 1;
    g.stroke();

    /* угловые уголки */
    g.strokeStyle = 'rgba(150, 190, 255, .4)';
    for (i = 0; i < ap.length; i++) {
      var a2 = ap[i];
      var b2 = ap[(i + 1) % ap.length];
      var dxs = (b2[0] - a2[0]) * w, dys = (b2[1] - a2[1]) * h;
      var len = Math.hypot(dxs, dys) || 1;
      g.beginPath();
      g.moveTo(a2[0] * w + dxs / len * 26, a2[1] * h + dys / len * 26);
      g.lineTo(a2[0] * w + dxs / len * 40, a2[1] * h + dys / len * 40);
      g.stroke();
    }

    this.cockpitCanvas = cv;
  };

  View.prototype.drawCockpit = function (world) {
    var ctx = this.ctx;
    if (this.cockpitCanvas) {
      ctx.drawImage(this.cockpitCanvas, 0, 0, this.w, this.h);
    }

    /* корпуса прожекторов на доске */
    var lamps = [[0.275, 0.965], [0.725, 0.965]];
    for (var i = 0; i < lamps.length; i++) {
      var x = lamps[i][0] * this.w;
      var y = lamps[i][1] * this.h;
      var lw = Math.max(26, this.w * 0.028);
      var lh = Math.max(9, this.h * 0.013);
      if (world.lights) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        var gl = ctx.createRadialGradient(x + lw / 2, y + lh / 2, 0, x + lw / 2, y + lh / 2, 46);
        gl.addColorStop(0, 'rgba(226, 255, 250, .34)');
        gl.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gl;
        ctx.fillRect(x - 46, y - 46, lw + 92, lh + 92);
        ctx.restore();
        ctx.fillStyle = 'rgba(220, 255, 250, .92)';
      } else {
        ctx.fillStyle = '#0c141d';
      }
      ctx.strokeStyle = world.lights ? 'rgba(191, 252, 252, .8)' : 'rgba(150, 190, 255, .3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(x, y, lw, lh);
      ctx.fill();
      ctx.stroke();
    }
  };

  /* ---------- Причал и подсказки наведения ---------- */

  View.prototype.drawGuidance = function (world, B) {
    var ctx = this.ctx;
    var ast = world.target;
    var port = S.portPos(ast);
    var P = this.proj(port, B);
    var vRel = S.sub(world.ship.v, S.portVel(ast));
    var toPort = S.unit(S.sub(port, world.ship.p));
    var closing = S.dot(vRel, toPort);
    var dPort = S.dist(world.ship.p, port);
    var inView = P.cz > 0.8;
    var onScreen = inView && P.x > 46 && P.x < this.w - 46 && P.y > 46 && P.y < this.h - 110;

    /* маяк причала */
    if (inView) {
      var R = this.focal * ast.radius / P.cz;
      var blink = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.time * 4.2 + ast.p.x));
      ctx.globalAlpha = blink;
      ctx.fillStyle = C.teal;
      ctx.fillRect(P.x - 1.5, P.y - 1.5, 3, 3);
      ctx.globalAlpha = 1;
      if (R > 20 && P.cz < 400) {
        ctx.fillStyle = 'rgba(117, 223, 210, .8)';
        ctx.font = '8px ' + MONO;
        ctx.textAlign = 'center';
        ctx.fillText('ПРИЧАЛ', P.x, P.y - 12);
      }
    }

    if (onScreen) {
      /* линия визирования из центра кабины */
      if (dPort < 700 && !world.docked) {
        ctx.save();
        ctx.setLineDash([3, 7]);
        ctx.strokeStyle = 'rgba(117, 223, 210, .2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.w / 2, this.h / 2);
        ctx.lineTo(P.x, P.y);
        ctx.stroke();
        ctx.restore();
      }

      /* скобы на точке стыковки */
      var s = 9;
      ctx.strokeStyle = world.docked ? C.teal : 'rgba(191, 252, 252, .85)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(P.x - s, P.y - s); ctx.lineTo(P.x - s, P.y - s + 5);
      ctx.moveTo(P.x - s, P.y - s); ctx.lineTo(P.x - s + 5, P.y - s);
      ctx.moveTo(P.x + s, P.y - s); ctx.lineTo(P.x + s, P.y - s + 5);
      ctx.moveTo(P.x + s, P.y - s); ctx.lineTo(P.x + s - 5, P.y - s);
      ctx.moveTo(P.x - s, P.y + s); ctx.lineTo(P.x - s, P.y + s - 5);
      ctx.moveTo(P.x - s, P.y + s); ctx.lineTo(P.x - s + 5, P.y + s);
      ctx.moveTo(P.x + s, P.y + s); ctx.lineTo(P.x + s, P.y + s - 5);
      ctx.moveTo(P.x + s, P.y + s); ctx.lineTo(P.x + s - 5, P.y + s);
      ctx.stroke();

      /* подписи: имя и дистанция, ниже — скорость сближения */
      ctx.textAlign = 'center';
      ctx.font = '500 10px ' + MONO;
      ctx.fillStyle = '#dce8e8';
      ctx.fillText(ast.id + ' · ' + fmtMeters(dPort), P.x, P.y + s + 16);
      ctx.font = '9px ' + MONO;
      var closeText = (closing >= 0 ? '+' : '−') + Math.abs(closing).toFixed(1).replace('.', ',') + ' м/с';
      if (dPort < 90 && closing > 3) {
        ctx.fillStyle = C.danger;
        closeText += ' · ТОРМОЗИ';
      } else {
        ctx.fillStyle = closing > 0.2 ? 'rgba(117, 223, 210, .9)' : C.dim;
      }
      ctx.fillText(closeText, P.x, P.y + s + 28);
    } else {
      this.drawOffscreen(world, B, port, dPort);
    }

    /* маркеры дрейфа: куда несёт относительно причала (прямое/обратное) */
    var vLen = S.len(vRel);
    if (vLen > 0.5) {
      var dir = S.mul(vRel, 1 / vLen);
      var pr = this.projDir({ x: dir.x, y: dir.y, z: 0 }, B);
      if (pr.cz > 0.05) {
        ctx.strokeStyle = 'rgba(170, 136, 246, .85)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, 5.5, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = C.violet;
        ctx.fillRect(pr.x - 1, pr.y - 1, 2, 2);
        ctx.font = '7px ' + MONO;
        ctx.fillStyle = 'rgba(170, 136, 246, .8)';
        ctx.textAlign = 'center';
        ctx.fillText('ДРЕЙФ', pr.x, pr.y - 10);
      }
      var rt = this.projDir({ x: -dir.x, y: -dir.y, z: 0 }, B);
      if (rt.cz > 0.05) {
        ctx.strokeStyle = 'rgba(170, 136, 246, .4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(rt.x, rt.y, 5, 0, TAU);
        ctx.moveTo(rt.x - 3, rt.y - 3); ctx.lineTo(rt.x + 3, rt.y + 3);
        ctx.moveTo(rt.x + 3, rt.y - 3); ctx.lineTo(rt.x - 3, rt.y + 3);
        ctx.stroke();
      }
    }
  };

  /* Стрелка у края экрана, если причал за кадром или за спиной. */
  View.prototype.drawOffscreen = function (world, B, port, dPort) {
    var ctx = this.ctx;
    var dx = port.x - this.cam.x;
    var dy = port.y - this.cam.y;
    var dz = -this.eyeH;
    var tx = dx * B.r.x + dy * B.r.y + dz * B.r.z;
    var tyUp = dx * B.u.x + dy * B.u.y + dz * B.u.z;
    var sdx = tx, sdy = -tyUp;
    var L = Math.hypot(sdx, sdy);
    if (L < 1e-3) {
      /* цель ровно за спиной: показываем сторону кратчайшего разворота */
      var yawErr = S.wrapAngle(Math.atan2(dy, dx) - world.ship.angle);
      sdx = yawErr >= 0 ? 1 : -1;
      sdy = 0;
      L = 1;
    }
    var nx = sdx / L, ny = sdy / L;
    var ex = this.w / 2 - 74;
    var ey = this.h / 2 - 96;
    var scale = Math.min(ex / Math.max(Math.abs(nx), 1e-4), ey / Math.max(Math.abs(ny), 1e-4));
    var x = this.w / 2 + nx * scale;
    var y = this.h / 2 + ny * scale;
    var ang = Math.atan2(ny, nx);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(117, 223, 210, .9)';
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(-3, -6);
    ctx.lineTo(-3, 6);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(-18, -5);
    ctx.lineTo(-18, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(191, 252, 252, .85)';
    ctx.font = '9px ' + MONO;
    ctx.textAlign = 'center';
    ctx.fillText(fmtMeters(dPort), x, y + 20);
  };

  /* ---------- Прицел и тяга ---------- */

  View.prototype.drawReticle = function (world) {
    var ctx = this.ctx;
    var x = this.w / 2, y = this.h / 2;
    var ast = world.target;
    var hot = false;
    if (ast && !world.docked) {
      var toPort = S.sub(S.portPos(ast), world.ship.p);
      var err = Math.abs(S.wrapAngle(Math.atan2(toPort.y, toPort.x) - world.ship.angle));
      hot = err < 0.12 && S.len(toPort) < 2600;
    }
    ctx.strokeStyle = hot ? 'rgba(117, 223, 210, .8)' : 'rgba(117, 223, 210, .32)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 20, y); ctx.lineTo(x - 14, y);
    ctx.moveTo(x + 14, y); ctx.lineTo(x + 20, y);
    ctx.moveTo(x, y - 20); ctx.lineTo(x, y - 14);
    ctx.moveTo(x, y + 14); ctx.lineTo(x, y + 20);
    ctx.stroke();
    ctx.fillStyle = hot ? C.teal : 'rgba(191, 252, 252, .55)';
    ctx.fillRect(x - 1, y - 1, 2, 2);

    ctx.font = '9px ' + MONO;
    ctx.textAlign = 'center';
    ctx.fillStyle = C.dim;
    ctx.fillText('V ' + S.len(world.ship.v).toFixed(1).replace('.', ',') + ' М/С', x, y + 34);
  };

  View.prototype.drawThrust = function (world) {
    var ctx = this.ctx;
    var inp = world.ship.input;
    var main = inp.main || 0;
    var strafe = inp.strafe || 0;
    if (Math.abs(main) < 0.04 && Math.abs(strafe) < 0.04) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var x = this.w / 2, y = this.h + 8;
    if (main > 0.04) {
      var g = ctx.createRadialGradient(x, y, 0, x, y, this.w * 0.24);
      g.addColorStop(0, 'rgba(191, 252, 252, ' + 0.13 * main + ')');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - this.w * 0.24, y - this.w * 0.24, this.w * 0.48, this.w * 0.24);
    }
    if (Math.abs(strafe) > 0.04) {
      var side = strafe > 0 ? -1 : 1; /* струя из противоположного борта */
      var jx = x + side * this.w * 0.055;
      var jy = this.h - 6;
      ctx.strokeStyle = 'rgba(191, 252, 252, ' + 0.5 * Math.abs(strafe) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(jx, jy);
      ctx.lineTo(jx + side * (8 + 16 * Math.abs(strafe)), jy - 4);
      ctx.stroke();
    }
    ctx.restore();
  };

  /* ---------- Прожекторы: два конуса от корпусов на доске ---------- */

  View.prototype.drawBeams = function (B) {
    var ctx = this.ctx;
    /* при наклоне вниз лучи почти параллельны взгляду — приглушаем,
       иначе они заливают экран */
    var fade = S.clamp((this.pitch + 0.25) * 2.4, 0.12, 1);
    var far = this.proj3({
      x: this.cam.x + B.f.x * 420,
      y: this.cam.y + B.f.y * 420,
      z: this.eyeH + B.f.z * 420
    }, B);
    if (far.cz < 8) return;
    var flicker = 0.9 + 0.1 * Math.sin(this.time * 31.7);
    flicker *= fade;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var lamps = [this.w * 0.275 + this.w * 0.014, this.w * 0.725 + this.w * 0.014];
    for (var i = 0; i < lamps.length; i++) {
      var lx = lamps[i];
      var spread = this.w * 0.065;
      var g = ctx.createLinearGradient(0, this.h * 0.975, 0, far.y);
      g.addColorStop(0, 'rgba(191, 252, 252, ' + 0.14 * flicker + ')');
      g.addColorStop(1, 'rgba(191, 252, 252, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(lx - 14, this.h * 1.03);
      ctx.lineTo(lx + 14, this.h * 1.03);
      ctx.lineTo(far.x + spread, far.y);
      ctx.lineTo(far.x - spread, far.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };

  /* ---------- Схема орбиты вокруг Солнца ---------- */

  View.prototype.renderMap = function (world) {
    var ctx = this.mctx;
    if (!ctx) return;
    var w = this.mapW;
    var h = this.mapH;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var cx = w * 0.5;
    var cy = h * 0.54;
    var R = Math.min(w, h) * 0.33;

    ctx.save();
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = 'rgba(150, 190, 255, .28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();
    ctx.restore();

    var sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16);
    sg.addColorStop(0, 'rgba(191, 252, 252, .95)');
    sg.addColorStop(0.35, 'rgba(117, 223, 210, .55)');
    sg.addColorStop(1, 'rgba(117, 223, 210, 0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#bffcfc';
    ctx.beginPath();
    ctx.arc(cx, cy, 2.4, 0, TAU);
    ctx.fill();

    var phase = world.orbitPhase;
    var ax = cx + Math.cos(phase) * R;
    var ay = cy + Math.sin(phase) * R;

    /* корабль отстаёт по орбите на столько же, на сколько он отстаёт в мире */
    var d = world.target ? S.dist(world.ship.p, world.target.p) : 0;
    var off = S.clamp(d / 2600, 0.05, 0.42);
    var sp = phase - off;
    var sx = cx + Math.cos(sp) * R;
    var sy = cy + Math.sin(sp) * R;

    ctx.strokeStyle = 'rgba(117, 223, 210, .45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R, sp, phase);
    ctx.stroke();

    ctx.fillStyle = C.teal;
    ctx.beginPath();
    ctx.arc(sx, sy, 2.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = C.violet;
    ctx.fillRect(ax - 2.6, ay - 2.6, 5.2, 5.2);
    ctx.strokeStyle = 'rgba(170, 136, 246, .55)';
    ctx.beginPath();
    ctx.arc(ax, ay, 6, 0, TAU);
    ctx.stroke();

    ctx.font = '7px ' + MONO;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(170, 136, 246, .95)';
    ctx.fillText(world.target ? world.target.id : '—', ax, ay - 10);
    ctx.fillStyle = 'rgba(117, 223, 210, .9)';
    ctx.fillText('СУДНО', sx, sy + 13);
    ctx.fillStyle = 'rgba(126, 147, 147, .9)';
    ctx.fillText('СОЛНЦЕ', cx, cy + 18);

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(99, 122, 122, .95)';
    ctx.fillText(S.CFG.orbitAU.toFixed(1).replace('.', ',') + ' А.Е.', 6, h - 6);
  };

  function fmtMeters(m) {
    if (m >= 1000) return (m / 1000).toFixed(2).replace('.', ',') + ' км';
    if (m >= 100) return Math.round(m) + ' м';
    return (Math.round(m * 10) / 10).toString().replace('.', ',') + ' м';
  }

  global.View = View;
  global.View.fmtMeters = fmtMeters;
})(typeof window !== 'undefined' ? window : globalThis);
