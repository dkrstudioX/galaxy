# -*- coding: utf-8 -*-
"""Генератор каталога лун для карты «Солнечной системы».

Источники:
  * JPL SSD «Planetary Satellite Mean Elements» — a, e, ω, M, i, node, P;
  * JPL SSD «Planetary Satellite Physical Parameters» — средний радиус;
  * Wikipedia «List of natural satellites» — радиусы для тех лун, которых
    нет в физической таблице JPL (включая провизорные обозначения).

Плутон и его луны не входят: Плутона нет на карте.

Запуск из папки space/:
    py data/build-moons.py
Пишет js/moons_data.js. Файл сгенерированный — вручную не править.
"""
import difflib
import json
import pathlib
import re
import sys
import urllib.request
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'js' / 'moons_data.js'

ELEM_URL = 'https://ssd.jpl.nasa.gov/sats/elem/'
PHYS_URL = 'https://ssd.jpl.nasa.gov/sats/phys_par/'
WIKI_URL = 'https://en.wikipedia.org/wiki/List_of_natural_satellites'

PLANETS = ('Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune')

# Наклон оси планеты к плоскости её орбиты, градусы. Для систем, заданных в
# плоскости Лапласа или экватора планеты, наклон пересчитывается в эклиптику.
AXIAL_TILT = {
    'Earth': 23.44, 'Mars': 25.19, 'Jupiter': 3.13,
    'Saturn': 26.73, 'Uranus': 97.77, 'Neptune': 28.32
}

# Русские имена крупных и хорошо известных лун. Для остальных показывается
# обозначение JPL (латиница) — так их и ищут в каталоге.
RU = {
    'Moon': 'Луна', 'Phobos': 'Фобос', 'Deimos': 'Деймос',
    'Io': 'Ио', 'Europa': 'Европа', 'Ganymede': 'Ганимед', 'Callisto': 'Каллисто',
    'Amalthea': 'Амальтея', 'Himalia': 'Гималия', 'Elara': 'Элара',
    'Pasiphae': 'Пасифе', 'Sinope': 'Синоне', 'Lysithea': 'Лиситея',
    'Carme': 'Карме', 'Ananke': 'Ананке', 'Leda': 'Леда', 'Thebe': 'Фива',
    'Adrastea': 'Адрастея', 'Metis': 'Метида',
    'Mimas': 'Мимас', 'Enceladus': 'Энцелад', 'Tethys': 'Тефия',
    'Dione': 'Диона', 'Rhea': 'Рея', 'Titan': 'Титан', 'Iapetus': 'Япет',
    'Hyperion': 'Гиперион', 'Phoebe': 'Феба', 'Janus': 'Янус',
    'Epimetheus': 'Эпиметей', 'Prometheus': 'Прометей', 'Pandora': 'Пандора',
    'Pan': 'Пан', 'Atlas': 'Атлас', 'Calypso': 'Калипсо', 'Telesto': 'Телесто',
    'Helene': 'Елена', 'Daphnis': 'Дафнис', 'Methone': 'Метона',
    'Pallene': 'Паллена', 'Polydeuces': 'Полидевк', 'Aegaeon': 'Эгеон',
    'Anthe': 'Анфа',
    'Miranda': 'Миранда', 'Ariel': 'Ариэль', 'Umbriel': 'Умбриэль',
    'Titania': 'Титания', 'Oberon': 'Оберон', 'Puck': 'Пак',
    'Cordelia': 'Корделия', 'Ophelia': 'Офелия', 'Bianca': 'Бианка',
    'Cressida': 'Крессида', 'Desdemona': 'Дездемона', 'Juliet': 'Джульетта',
    'Portia': 'Порция', 'Rosalind': 'Розалинда', 'Belinda': 'Белинда',
    'Perdita': 'Пердита', 'Mab': 'Маб', 'Cupid': 'Купидон',
    'Francisco': 'Франциско', 'Ferdinand': 'Фердинанд', 'Margaret': 'Маргарита',
    'Prospero': 'Просперо', 'Setebos': 'Сетебос', 'Stephano': 'Стефано',
    'Trinculo': 'Тринкуло', 'Sycorax': 'Скоракса', 'Caliban': 'Калибан',
    'Proteus': 'Протей', 'Triton': 'Тритон', 'Nereid': 'Нереида',
    'Naiad': 'Наяда', 'Thalassa': 'Таласья', 'Despina': 'Деспина',
    'Galatea': 'Галатея', 'Larissa': 'Ларисса', 'Hippocamp': 'Гиппокамп',
    'Halimede': 'Галимеда', 'Sao': 'Сао', 'Laomedeia': 'Лаомедея',
    'Psamathe': 'Псамафа', 'Neso': 'Несо',
}


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read().decode('utf-8', 'replace')


def rows(html):
    """Все строки таблиц: список ячеек без тегов."""
    out = []
    for m in re.finditer(r'<tr[^>]*>(.*?)</tr>', html, re.S):
        cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', m.group(1), re.S)
        cells = [re.sub(r'<[^>]+>', '', c).replace('&nbsp;', ' ').strip() for c in cells]
        cells = [re.sub(r'\s+', ' ', c) for c in cells]
        if cells:
            out.append(cells)
    return out


def num(s):
    """Первое число в ячейке; None, если его нет."""
    m = re.match(r'\s*(-?[\d.]+)', str(s).replace(',', ''))
    return float(m.group(1)) if m else None


def norm(s):
    return re.sub(r'[^a-z0-9]', '', s.lower())


def parse_elements(html):
    out = []
    for r in rows(html):
        if len(r) < 14 or r[1] not in PLANETS:
            continue
        a, e, w, M = num(r[7]), num(r[8]), num(r[9]), num(r[10])
        inc, node, P = num(r[11]), num(r[12]), num(r[13])
        if None in (a, e, w, M, inc, node, P):
            continue
        out.append({
            'planet': r[1], 'n': r[2], 'code': r[3], 'frame': r[5].lower(),
            'a': a, 'e': e, 'peri': (w + node) % 360, 'm0': M,
            'inc': inc, 'node': node, 'period': P,
        })
    return out


def parse_phys(html):
    out = {}
    for r in rows(html):
        if len(r) >= 5 and r[0] in PLANETS:
            rad = num(r[4])
            if rad is not None:
                out[r[2]] = rad
    return out


def parse_wiki(html):
    """(родитель, нормализованное имя) -> радиус, плюс списки по планетам."""
    m = re.search(r'<table[^>]*class="[^"]*sortable[^"]*"[^>]*>(.*?)</table>', html, re.S)
    if not m:
        raise SystemExit('Wikipedia: не найдена таблица спутников')
    exact = {}
    by_planet = {}
    for r in rows(m.group(1))[1:]:
        if len(r) <= 5 or r[2] not in PLANETS:
            continue
        rad = num(r[5])
        if rad is None:
            continue
        key = (r[2], norm(r[0]))
        exact[key] = rad
        by_planet.setdefault(r[2], []).append((norm(r[0]), rad))
    return exact, by_planet


def attach_radii(moons, phys, wiki_exact, wiki_by_planet):
    fuzzy = 0
    missing = []
    for m in moons:
        rad = phys.get(m['code'])
        if rad is None:
            rad = wiki_exact.get((m['planet'], norm(m['n'])))
        if rad is None:
            candidates = wiki_by_planet.get(m['planet'], [])
            match = difflib.get_close_matches(
                norm(m['n']), [c[0] for c in candidates], n=1, cutoff=0.82)
            if match:
                rad = dict(candidates)[match[0]]
                fuzzy += 1
        if rad is None:
            missing.append(m['planet'] + '/' + m['n'])
        m['rad'] = rad
    if missing:
        raise SystemExit('Нет радиуса у %d лун: %s' % (len(missing), ', '.join(missing[:20])))
    return fuzzy


def to_ecliptic(m):
    """Плоскости Лапласа/экватора -> эклиптика: добавляем наклон оси планеты.

    Для прямых орбит (inc <= 90°) наклон складывается, для обратных —
    вычитается, чтобы луна осталась обратной. Если сумма перешла через 180°,
    узел и перигелий поворачиваются на 180°.
    """
    if m['frame'] not in ('laplace', 'equatorial'):
        return
    tilt = AXIAL_TILT[m['planet']]
    inc = m['inc'] + tilt if m['inc'] <= 90 else m['inc'] - tilt
    node, peri = m['node'], m['peri']
    if inc < 0:
        inc += 180
        node += 180
        peri += 180
    if inc > 180:
        inc -= 180
        node += 180
        peri += 180
    m['inc'] = inc
    m['node'] = node % 360
    m['peri'] = peri % 360


def main():
    print('JPL elements ...')
    moons = parse_elements(fetch(ELEM_URL))
    print('  всего', len(moons), dict(Counter(x['planet'] for x in moons)))

    print('JPL physical parameters ...')
    phys = parse_phys(fetch(PHYS_URL))
    print('  радиусов', len(phys))

    print('Wikipedia list ...')
    wiki_exact, wiki_by_planet = parse_wiki(fetch(WIKI_URL))

    fuzzy = attach_radii(moons, phys, wiki_exact, wiki_by_planet)
    print('  радиусов всего', len(moons), 'нечётких совпадений', fuzzy)

    for m in moons:
        to_ecliptic(m)
        m['period'] = abs(m['period'])
        m['peri'] = round(m['peri'] % 360, 4)
        m['m0'] = round(m['m0'] % 360, 4)
        m['inc'] = round(m['inc'], 4)
        m['node'] = round(m['node'] % 360, 4)
        m['a'] = round(m['a'], 3)
        m['e'] = round(m['e'], 6)
        m['period'] = round(m['period'], 6)
        m['rad'] = round(m['rad'], 3)
        m['ru'] = RU.get(m['n'], '')
        del m['code']

    order = {p: i for i, p in enumerate(PLANETS)}
    moons.sort(key=lambda x: (order[x['planet']], x['a']))

    lines = [
        '// СГЕНЕРИРОВАНО build-moons.py — не редактировать вручную.',
        '// Источники: JPL SSD (элементы и физические параметры), Wikipedia',
        '// «List of natural satellites» (радиусы для остальных лун).',
        '// Плутон и его луны не входят: Плутона нет на карте.',
        'export const moonCatalog = [',
    ]
    for m in moons:
        fields = [
            "planet: %s" % json.dumps(m['planet']),
            "n: %s" % json.dumps(m['n'], ensure_ascii=False),
            "ru: %s" % json.dumps(m['ru'], ensure_ascii=False),
            "a: %s" % m['a'],
            "e: %s" % m['e'],
            "peri: %s" % m['peri'],
            "m0: %s" % m['m0'],
            "inc: %s" % m['inc'],
            "node: %s" % m['node'],
            "period: %s" % m['period'],
            "rad: %s" % m['rad'],
            "frame: %s" % json.dumps(m['frame']),
        ]
        lines.append('    { ' + ', '.join(fields) + ' },')
    lines.append('];')
    OUT.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('ok:', OUT, len(moons), 'лун', OUT.stat().st_size, 'байт')


if __name__ == '__main__':
    main()
