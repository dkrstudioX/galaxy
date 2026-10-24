# -*- coding: utf-8 -*-
# Собирает js/*.js (ES-модули) в один app.js — обычный скрипт, работает с file://.
# Порядок = порядок зависимостей: всё, что импортируется, объявляется раньше.
# Запуск: py build.py (из папки space)
import re, pathlib

ROOT = pathlib.Path(__file__).parent
ORDER = ['units', 'config', 'math', 'moons_data', 'data', 'state', 'iso', 'paint', 'scene', 'smallbodies', 'bases_name', 'bases_removed', 'bases', 'sky', 'render', 'hover', 'input', 'ui', 'main']

out = ['// СГЕНЕРИРОВАНО build.py — не редактировать вручную, править js/*.js и пересобрать.',
       '// Без модулей, чтобы страница открывалась как file:// без сервера.', '']
for name in ORDER:
    src = (ROOT / 'js' / f'{name}.js').read_text(encoding='utf-8')
    src = re.sub(r"^import\b[^;]*;", '', src, flags=re.M)      # убрать импорты
    src = re.sub(r"^export\s+(?=(const|let|function|class)\b)", '', src, flags=re.M)  # убрать export
    out.append(f'// ===== {name}.js =====')
    out.append(src.strip())
    out.append('')

(ROOT / 'app.js').write_text('\n'.join(out), encoding='utf-8')
print('ok: app.js', sum(len(o) for o in out), 'bytes')
