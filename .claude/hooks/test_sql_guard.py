#!/usr/bin/env python3
"""Tests for sql-guard.py. Run: python3 .claude/hooks/test_sql_guard.py

Loads the hook module by path (the filename has a hyphen, so it can't be a
plain import) and runs the decide() function over a fixed set of cases.
Prints a «запрос → решение → ожидалось» table and exits non-zero on any miss.
"""

import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("sql_guard", os.path.join(HERE, "sql-guard.py"))
sql_guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sql_guard)

CASES = [
    ("select * from markers limit 1", "allow"),
    ("select count(*) from marker_votes where vote = 'delete me'", "allow"),
    ("select tablename, policyname from pg_policies", "allow"),
    ("with t as (select 1) select * from t", "allow"),
    ("select cast_marker_vote('x','still_there')", "ask"),
    ("select set_config('a','b',false)", "ask"),
    ("select * into tmp from markers", "ask"),
    ("explain analyze select 1", "ask"),
    ("delete from markers", "deny"),
    ("select 1; drop table markers", "deny"),
    ("update profiles set x=1", "deny"),
    ("/* drop */ select 1", "allow"),
    ("create or replace function f() returns void as $$ begin end $$ language plpgsql",
     "deny"),
    ("", "ask"),
    # double quotes / dollar-quoting / backslash escapes hide function calls
    ('select "a--b", pg_terminate_backend(1) from markers', "ask"),
    ("select $$'$$, pg_terminate_backend(1), $$'$$", "ask"),
    ("select E'\\'', pg_terminate_backend(1) --'", "ask"),
    ('select "set_config"(\'a\',\'b\',false)', "ask"),
    ("select rolname as owner from pg_roles", "ask"),
    ("select public.cast_marker_vote('x','y')", "ask"),
    ("select * from markers for update", "deny"),
]


def main():
    width = max(len(q) for q, _ in CASES)
    print(f"{'запрос':<{width}}  {'решение':<8}  {'ожидалось':<9}  причина")
    print("-" * (width + 50))
    failures = 0
    for query, expected in CASES:
        decision, reason = sql_guard.decide(query)
        ok = decision == expected
        mark = "✓" if ok else "✗ FAIL"
        shown = query if query else "(пусто)"
        print(f"{shown:<{width}}  {decision:<8}  {expected:<9}  {mark}  {reason}")
        if not ok:
            failures += 1

    print("-" * (width + 50))
    if failures:
        print(f"ПРОВАЛ: {failures} из {len(CASES)} кейсов не совпали")
        sys.exit(1)
    print(f"OK: все {len(CASES)} кейсов прошли")
    sys.exit(0)


if __name__ == "__main__":
    main()
