#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera INDEX.md de una skill con biblioteca de referencias: una línea por documento (ruta, líneas, título).
Uso:  py -3 tools/build-index.py core/skills/ddd-hexagonal
"""
import re, sys
from pathlib import Path

skill = Path(sys.argv[1]).resolve()
out = [f"# Índice de `{skill.name}`", "",
       "Un documento por tema, ≤ 250 líneas, con índice interno. Lee solo el que indique `SKILL.md` §2 y solo su sección.", ""]
for base in ("references", "templates"):
    root = skill / base
    if not root.exists():
        continue
    out.append(f"## {base}/")
    out.append("")
    cur = None
    for f in sorted(root.rglob("*")):
        if not f.is_file():
            continue
        rel = f.relative_to(skill).as_posix()
        folder = f.relative_to(root).parent.as_posix()
        if folder != cur:
            cur = folder
            out.append(f"### {base}/{folder + '/' if folder != '.' else ''}")
            out.append("")
        try:
            text = f.read_text(encoding="utf-8", errors="replace")
        except Exception:
            text = ""
        n = text.count("\n") + 1
        title = ""
        m = re.search(r"(?m)^#\s+(.+)$", text)
        if m and f.suffix == ".md":
            title = m.group(1).strip()
        else:
            # primera línea de comentario para código
            m2 = re.search(r"(?m)^\s*(?://|#|\*|/\*\*?)\s*(.{10,120})$", text)
            title = m2.group(1).strip() if m2 else ""
        out.append(f"- `{rel}` ({n} líneas){' — ' + title if title else ''}")
    out.append("")
(skill / "INDEX.md").write_text("\n".join(out) + "\n", encoding="utf-8")
print(f"INDEX.md: {sum(1 for l in out if l.startswith('- '))} entradas")
