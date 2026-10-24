#!/usr/bin/env python3
# =============================================================================
# build-positions.py — генератор space/data/planet-positions.json (схема 2).
#
# Считает те же положения, что карта: элементы планет из space/js/data.js,
# симметричные эклиптические долготы на эпоху 2026-10-23 (0°, 45°, … 315°),
# кеплеровская орбита с реальными e/peri/inc/node. Формулы повторяют
# space/js/math.js: keplerPos + orbitPoint3 (y — вниз, z — север).
#
# Единицы: 1 а.е. = 1000 wu (units.js), 1 км = 1000 / 149 597 870.7 wu.
# JSON — справочный файл: карта читает data.js, а не его.
#
# Запуск: py space/data/build-positions.py
# =============================================================================

import json
import math
from datetime import datetime, timezone
from pathlib import Path

AU_KM = 149597870.7
AU_WU = 1000.0
KM_WU = AU_WU / AU_KM

J2000 = datetime(2000, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
EPOCH = datetime(2026, 10, 23, 0, 0, 0, tzinfo=timezone.utc)
T_DAYS = (EPOCH - J2000).total_seconds() / 86400.0

# name, ru, color, radiusKm, aAu, periodDays, l0 (J2000), e, peri, inc, node
PLANETS = [
    ('Mercury', 'Меркурий', '#b5b5b5', 2439.7, 0.387098, 87.969, 271.670338,
     0.205636, 77.458, 7.005, 48.331),
    ('Venus', 'Венера', '#e8cda0', 6051.8, 0.723332, 224.701, 198.483416,
     0.006777, 131.602, 3.395, 76.680),
    ('Earth', 'Земля', '#4488ff', 6371.0, 1.000000, 365.256, 159.822344,
     0.016711, 102.938, 0.000, 0.000),
    ('Mars', 'Марс', '#c1440e', 3389.5, 1.523679, 686.980, 39.827744,
     0.093394, 336.041, 1.850, 49.579),
    ('Jupiter', 'Юпитер', '#c88b3a', 69911.0, 5.20260, 4332.589, 84.954805,
     0.048386, 14.728, 1.304, 100.464),
    ('Saturn', 'Сатурн', '#e8d191', 58232.0, 9.55491, 10759.22, 252.676195,
     0.053862, 92.599, 2.488, 113.665),
    ('Uranus', 'Уран', '#7de8e8', 25362.0, 19.21845, 30685.4, 149.751982,
     0.047257, 170.954, 0.773, 74.006),
    ('Neptune', 'Нептун', '#3f54ba', 24622.0, 30.11039, 60189.0, 257.421335,
     0.008590, 44.965, 1.770, 131.784),
]

SUN_RADIUS_KM = 696340.0
RAD = math.pi / 180.0


def norm_deg(v):
    return v % 360.0


def rnd(v, nd):
    """Округлить и убрать «-0» / шум на нуле (y = 1e-09 и т.п.)."""
    r = round(v, nd)
    return 0.0 if abs(r) < 0.5 * 10 ** (-nd) else r


def kepler_pos3(a, e, peri, m0, period, t, inc, node):
    """Позиция на наклонной орбите: как keplerPos3 в math.js, но в а.е."""
    turns = (m0 / 360.0 + t / period) % 1.0
    M = turns * 2.0 * math.pi

    E = M + e * math.sin(M)
    for _ in range(8):
        E -= (E - e * math.sin(E) - M) / (1.0 - e * math.cos(E))

    nu = 2.0 * math.atan2(math.sqrt(1.0 + e) * math.sin(E / 2.0),
                          math.sqrt(1.0 - e) * math.cos(E / 2.0))
    r = a * (1.0 - e * math.cos(E))
    lon = nu + peri * RAD

    u = lon - node * RAD
    cu, su = math.cos(u), math.sin(u)
    ci, si = math.cos(inc * RAD), math.sin(inc * RAD)
    co, so = math.cos(node * RAD), math.sin(node * RAD)

    return {
        'x': r * (co * cu - so * su * ci),
        'y': -r * (so * cu + co * su * ci),
        'z': r * su * si,
    }, r, nu


def main():
    planets = []
    for (name, ru, color, radius_km, a_au, period, l0,
         e, peri, inc, node) in PLANETS:
        m0 = norm_deg(l0 - peri)
        pos, r_au, nu = kepler_pos3(a_au, e, peri, m0, period, T_DAYS, inc, node)
        lon = norm_deg(round(math.degrees(math.atan2(-pos['y'], pos['x'])), 3))
        lat = math.degrees(math.asin(max(-1.0, min(1.0, pos['z'] / r_au))))

        planets.append({
            'id': name.lower(),
            'name': name,
            'ru': ru,
            'color': color,
            'radiusKm': radius_km,
            'radiusMap': rnd(radius_km * KM_WU, 9),
            'orbit': {
                'semiMajorAxisAu': a_au,
                'semiMajorAxisMap': rnd(a_au * AU_WU, 6),
                'eccentricity': e,
                'perihelionLongitudeDeg': peri,
                'inclinationDeg': inc,
                'ascendingNodeLongitudeDeg': node,
                'periodDays': period,
                'meanMotionDegPerDay': rnd(360.0 / period, 9),
                'meanAnomalyAtEpochDeg': rnd(norm_deg(m0 + 360.0 * T_DAYS / period), 6),
                'meanLongitudeAtEpochDeg': rnd(norm_deg(l0 + 360.0 * T_DAYS / period), 6),
                'trueAnomalyAtEpochDeg': rnd(norm_deg(math.degrees(nu)), 6),
            },
            'positionAu': {k: rnd(v, 9) for k, v in pos.items()},
            'distanceAu': rnd(r_au, 9),
            'longitudeDeg': lon,
            'latitudeDeg': rnd(lat, 6),
            'positionMap': {k: rnd(v * AU_WU, 6) for k, v in pos.items()},
            'distanceMap': rnd(r_au * AU_WU, 6),
        })

    doc = {
        'schema': 'galaxy.planet-positions/2',
        'generatedAt': EPOCH.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'epoch': EPOCH.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'model': {
            'name': 'symmetric-keplerian',
            'description': (
                'Симметричная кеплеровская модель: реальные эксцентриситеты, '
                'перигелии, наклоны, узлы и периоды; эклиптические долготы '
                'планет на эпоху распределены равномерно.'
            ),
            'isActualEphemeris': False,
            'symmetry': {
                'type': 'ecliptic-longitude',
                'offsetDeg': 0,
                'stepDeg': 45,
                'order': [p[0] for p in PLANETS],
            },
            'coordinateSystems': {
                'positionAu': (
                    'Гелиоцентрическая эклиптическая J2000: x — точка весеннего '
                    'равноденствия, y — 90° эклиптической долготы (вниз, как на '
                    'карте), z — север.'
                ),
                'positionMap': (
                    'Игровые raw-координаты space/js/math.js orbitPoint3: '
                    'x вправо, y вниз, z вверх.'
                ),
            },
            'units': {
                'positionAu': 'AU',
                'positionMap': 'world units, 1 а.е. = 1000 wu',
                'lengthMap': '1 км = 6.684587e-6 wu',
                'angles': 'degrees',
                'time': 'days',
            },
            'source': 'space/js/data.js; semi-major axes — стандартные J2000.',
        },
        'sun': {
            'name': 'Sun',
            'ru': 'Солнце',
            'radiusKm': SUN_RADIUS_KM,
            'radiusMap': round(SUN_RADIUS_KM * KM_WU, 9),
        },
        'planets': planets,
    }

    out = Path(__file__).with_name('planet-positions.json')
    out.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('written', out, '-', len(planets), 'planets, epoch', doc['epoch'])


if __name__ == '__main__':
    main()
