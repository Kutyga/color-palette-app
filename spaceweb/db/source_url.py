#!/usr/bin/env python3
"""Печатает строки подключения к Supabase, пригодные для GitHub Actions.

Прямой адрес db.<ref>.supabase.co доступен только по IPv6, которого у GitHub нет. Такой адрес
переводится на пулер Supavisor (IPv4, режим session — в нём работает pg_dump) того же региона;
имя пулера бывает aws-0-… и aws-1-…, поэтому печатаются оба. Остальные адреса — как есть.
Использование: python3 source_url.py "$SUPABASE_DB_URL" [регион]
"""
import sys
import urllib.parse as u

url = sys.argv[1].strip()
region = sys.argv[2] if len(sys.argv) > 2 else "eu-central-1"
p = u.urlsplit(url)
host = p.hostname or ""
if host.startswith("db.") and host.endswith(".supabase.co"):
    ref = host.split(".")[1]
    for prefix in ("aws-0", "aws-1"):
        print(f"postgresql://postgres.{ref}:{p.password or ''}@{prefix}-{region}.pooler.supabase.com:5432/postgres")
else:
    print(url)
