#!/usr/bin/env python3
"""PreToolUse guard for mcp__supabase__execute_sql.

Reads the Claude Code hook JSON from stdin, inspects tool_input.query and
answers with a hookSpecificOutput.permissionDecision of allow / ask / deny.

Policy (see repo CLAUDE.md "Работа с БД"):
  - Any DB mutation keyword  -> deny  (send SQL to Vlad in chat for review)
  - Pure read (select/with/explain, whitelisted functions only) -> allow
  - Anything uncertain, unreadable input, or empty query -> ask
The hook must NEVER silently allow on error: unknown == ask.
"""

from __future__ import annotations

import json
import re
import sys

# --- word lists -------------------------------------------------------------

# Mutations / dangerous statements -> hard deny.
DENY_WORDS = [
    "insert", "update", "delete", "drop", "create", "alter", "grant", "revoke",
    "truncate", "copy", "call", "do", "vacuum", "reindex", "cluster",
    "lock", "refresh", "merge", "import", "reassign",
]

# Present anywhere -> not allow (fall through to ask). Not deny-worthy, but
# they take SQL outside the plain read-only path (session state, CTE side
# effects, EXPLAIN ANALYZE which actually executes, transaction control, ...).
NOT_ALLOW_WORDS = [
    "set", "reset", "into", "perform", "execute", "begin", "commit", "rollback",
    "savepoint", "analyze", "prepare", "deallocate", "discard", "load",
    "owner", "comment", "security", "cascade", "listen", "notify",
]

# Only these identifiers may appear immediately before "(" in an allowed query.
FUNC_WHITELIST = {
    "count", "sum", "min", "max", "avg", "coalesce", "nullif", "greatest",
    "least", "string_agg", "array_agg", "json_agg", "jsonb_agg",
    "json_build_object", "jsonb_build_object", "array_to_string", "unnest",
    "lower", "upper", "length", "round", "abs", "now", "date_trunc", "to_char",
    "extract", "cast", "exists", "any", "all", "in", "case", "filter", "over",
    "row_number", "lateral", "values", "aclexplode", "pg_get_functiondef",
    "pg_get_function_arguments", "pg_get_function_result", "pg_get_userbyid",
    "pg_get_expr", "pg_get_triggerdef", "pg_get_viewdef", "pg_get_constraintdef",
    "pg_get_indexdef", "format_type", "obj_description", "col_description",
    "has_table_privilege", "has_function_privilege", "has_schema_privilege",
    "pg_relation_size", "pg_total_relation_size", "pg_size_pretty",
    "current_setting", "to_regclass", "to_regproc",
}

# SQL keywords that can legally sit before "(" without being a function call.
KEYWORD_BEFORE_PAREN = {
    "in", "exists", "values", "over", "filter", "any", "all", "cast", "case",
    "lateral", "from", "join", "on", "and", "or", "not", "as", "select",
    "where",
}

ALLOWED_BEFORE_PAREN = FUNC_WHITELIST | KEYWORD_BEFORE_PAREN

STATEMENT_START_RE = re.compile(r"^\(*\s*(select|with|explain)\b")
FUNC_CALL_RE = re.compile(r"([a-z_][a-z0-9_]*)\s*\(")

DENY_REASON = ("изменение БД (обнаружено «{word}») — не выполняю. "
               "Пришли SQL в чат Vlad'у на проверку.")


def normalize(sql: str) -> str:
    """Strip comments, blank out string literals, lowercase.

    Single state-machine pass so that a `--`/`'` inside the other construct
    is not mis-tokenised (e.g. `-- it's`, `'a--b'`).
    """
    out = []
    i, n = 0, len(sql)
    while i < n:
        two = sql[i:i + 2]
        if two == "--":                       # line comment -> space
            nl = sql.find("\n", i)
            out.append(" ")
            if nl == -1:
                break
            i = nl
            continue
        if two == "/*":                       # block comment -> space
            end = sql.find("*/", i + 2)
            out.append(" ")
            if end == -1:
                break
            i = end + 2
            continue
        if sql[i] == "'":                     # string literal -> ''
            i += 1
            while i < n:
                if sql[i] == "'":
                    if i + 1 < n and sql[i + 1] == "'":   # escaped ''
                        i += 2
                        continue
                    i += 1
                    break
                i += 1
            out.append("''")
            continue
        out.append(sql[i])
        i += 1
    return "".join(out).lower()


def _find_word(text: str, words) -> str | None:
    m = re.search(r"\b(" + "|".join(words) + r")\b", text)
    return m.group(1) if m else None


def decide(query):
    """Return (decision, reason)."""
    if not isinstance(query, str) or not query.strip():
        return "ask", "пустой или нечитаемый query — проверка вручную"

    norm = normalize(query)
    if not norm.strip():
        return "ask", "после удаления комментариев запрос пуст — проверка вручную"

    # 1) hard deny on any mutation keyword
    bad = _find_word(norm, DENY_WORDS)
    if bad:
        return "deny", DENY_REASON.format(word=bad)

    # 1b) constructs the normaliser cannot reason about. Double quotes,
    # dollar-quoting ($$...$$) and backslash/E'' escapes can hide a function
    # call from the single-quote/comment stripper (e.g. "a--b", $$'$$, E'\'').
    # Checked on the ORIGINAL query, after deny (deny only tightens).
    for ch in ('"', "$", "\\"):
        if ch in query:
            return "ask", ("кавычки/спецсимволы (\", $, \\) — "
                           "нормализатор не может гарантировать разбор")

    # 2) allow only if everything is read-only
    statements = [s for s in norm.split(";") if s.strip()]
    if not statements:
        return "ask", "не нашёл ни одного оператора — проверка вручную"

    for stmt in statements:
        if not STATEMENT_START_RE.match(stmt.strip()):
            head = stmt.strip()[:40]
            return "ask", f"оператор не начинается с select/with/explain: «{head}»"

    bad = _find_word(norm, NOT_ALLOW_WORDS)
    if bad:
        return "ask", f"слово «{bad}» выводит запрос за пределы простого чтения"

    for m in FUNC_CALL_RE.finditer(norm):
        name = m.group(1)
        if name not in ALLOWED_BEFORE_PAREN:
            return "ask", f"функция «{name}» не в белом списке — проверка вручную"

    return "allow", "только чтение: select/with/explain, функции из белого списка"


def main():
    try:
        payload = json.load(sys.stdin)
        query = payload.get("tool_input", {}).get("query")
    except Exception:
        decision, reason = "ask", "не удалось разобрать JSON хука — проверка вручную"
    else:
        decision, reason = decide(query)

    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": decision,
            "permissionDecisionReason": reason,
        }
    }, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    main()
