# -*- coding: utf-8 -*-
# Собирает js/*.js (ES-модули) в один hangar.js — обычный скрипт, который
# работает без сервера и без сборщика: страницу можно открыть как file://.
# Порядок = порядок зависимостей: всё, что импортируется, объявляется раньше.
# Запуск: py build.py (из папки hangar)
import re, pathlib

ROOT = pathlib.Path(__file__).parent
ORDER = ['base', 'state', 'catalog', 'categories', 'ship', 'shop',
         'ship-view', 'info', 'hangar-tab', 'dock', 'app']

out = ['/* СГЕНЕРИРОВАНО build.py — не редактировать вручную: править js/*.js и пересобрать.',
       '   Без ES-модулей, чтобы страница открывалась без сервера. */',
       '(function () {',
       "  'use strict';",
       '']
for name in ORDER:
    src = (ROOT / 'js' / f'{name}.js').read_text(encoding='utf-8')
    src = re.sub(r'^import\b[^;]*;', '', src, flags=re.M)            # убрать импорты
    src = re.sub(r'^export\s+(?=(?:const|let|var|function|class)\b)', '', src, flags=re.M)  # убрать export
    out.append(f'// ===== {name}.js =====')
    out.append(src.strip())
    out.append('')

out.append('})();')
text = '\n'.join(out)
(ROOT / 'hangar.js').write_text(text, encoding='utf-8')
print('ok: hangar.js', len(text.encode('utf-8')), 'bytes')
