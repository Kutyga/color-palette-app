#!/usr/bin/env python3
"""Готовит дамп схем Supabase (pg_dump, обычный текст) к загрузке на SpaceWeb.

Читает stdin, пишет stdout. Убирает то, что на SpaceWeb сделать нельзя или делается иначе:
  - правила RLS (POLICY) — их создаёт export-policies.sql уже без ролей anon/authenticated;
  - публикации Realtime и комментарий к схеме public (он принадлежит не нам);
  - «CREATE SCHEMA public» — схема уже есть.
Каждый объект в дампе начинается с заголовка «-- Name: …; Type: …; Schema: …», по нему и режем.
"""
import re
import sys

DROP_TYPES = {"POLICY", "PUBLICATION", "PUBLICATION TABLE", "PUBLICATION TABLES IN SCHEMA"}
HEADER = re.compile(r"^--\n-- (?:Data for )?Name: (?P<name>.*?); Type: (?P<type>.*?); Schema: (?P<schema>.*?);", re.M)


def keep(name: str, kind: str) -> bool:
    if kind in DROP_TYPES:
        return False
    if kind == "COMMENT" and name == "SCHEMA public":
        return False
    return True


def main() -> None:
    text = sys.stdin.read()
    starts = [m.start() for m in HEADER.finditer(text)]
    out = [text[: starts[0]] if starts else text]
    for i, start in enumerate(starts):
        block = text[start : starts[i + 1] if i + 1 < len(starts) else len(text)]
        m = HEADER.match(block)
        if m and not keep(m["name"], m["type"]):
            continue
        out.append(block)
    result = "".join(out)
    result = re.sub(r"^CREATE SCHEMA public;$", "CREATE SCHEMA IF NOT EXISTS public;", result, flags=re.M)
    sys.stdout.write(result)


if __name__ == "__main__":
    main()
