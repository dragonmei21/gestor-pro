# Gestor Pro — Session 2 Bug Fixes Log

**Date:** 2026-03-18
**Files changed:** `backend/engine/invoice_parser.py`, `backend/engine/cfo_engine.py`, `backend/main.py`

---

## Issues Found + How Each Was Fixed

---

### Issue 1 — Invoice parser silently returns zeros on JSON parse failure
**File:** `backend/engine/invoice_parser.py`
**Severity:** HIGH — worst demo failure possible

**What was wrong:**
When gpt-4o-mini returned anything unexpected (text before/after the JSON,
markdown code fences, explanation mixed in), `json.loads()` would throw a
JSONDecodeError. The bare `except Exception` caught it and returned a fake
invoice with all fields set to 0 — `base_imponible: 0`, `total: 0`, etc.
This got silently saved to the database. No error shown to the user.

**How it was fixed:**
Added `_safe_parse_json()` — a 3-strategy extractor:
1. Try `json.loads()` directly
2. Strip markdown fences (` ```json ... ``` `) then try again
3. Use regex to find the first `{...}` block anywhere in the text

If all 3 fail, call `_empty_extraction()` which returns a result with
`concepto: "Extracción fallida: <reason>"` so the failure is visible
in the UI instead of silently saving zeros.

---

### Issue 2 — NIF validation too strict, triggers unnecessary repair loops
**File:** `backend/engine/invoice_parser.py`
**Severity:** MEDIUM — wastes an API call, slows down the demo

**What was wrong:**
The NIF regex `^[A-Z0-9]\d{7}[A-Z0-9]$` required uppercase letters.
If gpt-4o-mini returned `12345678a` (lowercase), the regex failed,
validation reported an error, and the repair loop fired — costing an
extra API call and adding ~2 seconds of latency for no real reason.

**How it was fixed:**
Added `.upper().strip()` before running the regex:
```python
nif = str(data.get("proveedor_nif") or "").upper().strip()
```
Now `12345678a` becomes `12345678A` before checking, passes validation,
and the repair loop is not triggered.

---

### Issue 3 — Agent loop crashes on malformed chat history
**File:** `backend/main.py`
**Severity:** HIGH — crashes the entire /api/chat endpoint with a 500

**What was wrong:**
`messages += history` appended the raw history list from the frontend
directly to the OpenAI messages array with no validation. If any message
was missing a `role` key, missing `content`, or had the wrong structure
(which can happen after a previous tool call response), OpenAI would
return a 400 error. This was completely unhandled and crashed the endpoint.

**How it was fixed:**
Added a filter before appending history:
```python
safe_history = [
    m for m in history
    if isinstance(m, dict) and m.get("role") and m.get("content")
]
messages += safe_history
```
Any malformed message is silently dropped. The rest of the conversation
continues normally.

---

### Issue 4 — CFO narrative API failure crashes the entire /api/cfo/report endpoint
**File:** `backend/engine/cfo_engine.py`
**Severity:** HIGH — the whole CFO page returns 500 if OpenAI times out

**What was wrong:**
`generate_cfo_narrative()` made one OpenAI call with no try/except around it.
If the API timed out, returned an error, or hit a rate limit, the exception
propagated up and crashed the entire `/api/cfo/report` endpoint — meaning
the chart data, forecast, and all other numbers were also lost even though
they were already computed successfully.

**How it was fixed:**
Wrapped the OpenAI call in try/except. On failure, returns a short
hardcoded Spanish fallback narrative that uses the already-computed
`avg_monthly_income` / `avg_monthly_expense` numbers:
```
"Los datos muestran unos ingresos medios mensuales de X€ y gastos de Y€..."
```
The chart still renders. The user sees something useful instead of a blank page.

---

### Issue 5 — Compliance report always shows "Agent made 3 tool calls" even when it didn't
**File:** `backend/main.py`
**Severity:** LOW — cosmetic but dishonest in the demo

**What was wrong:**
`tool_calls_made` was hardcoded to `3` regardless of what actually ran.
If invoice extraction failed early, only 1 or 2 tools actually executed —
but the report still showed "Agent made 3 tool calls."

**How it was fixed:**
Added a `tools_ran` counter that starts at 0 and increments after each
tool actually completes:
- +1 after `validate_invoice` runs
- +1 after `generate_verifactu_xml` runs
- +1 after the GPT-4o narrative call succeeds

`tool_calls_made: tools_ran` is now the real number (1, 2, or 3).

---

### Issue 6 — CFO report ledger query hardcoded to "2025-Q1"
**File:** `backend/main.py`
**Severity:** MEDIUM — returns zero stats if you run the demo at any other time

**What was wrong:**
The ledger query inside `/api/cfo/report` filtered on
`trimestre == "2025-Q1"` literally. If the demo data changes, a new quarter
is seeded, or someone runs this after Q1, the ingresos/gastos/IVA summary
stats come back as 0 even though the forecast chart (which queries all data)
renders fine. Confusing split behavior.

**How it was fixed:**
Query the most recent quarter that actually has data in the DB:
```python
active_quarter = db.query(models.LedgerEntry.trimestre)
    .order_by(models.LedgerEntry.fecha.desc()).first()
quarter_to_use = active_quarter[0] if active_quarter else _current_quarter()
```
The stats now always match whatever data is actually in the ledger.

---

## Summary Table

| # | File | Issue | Severity | Status |
|---|---|---|---|---|
| 1 | invoice_parser.py | Silent zeros on JSON parse failure | HIGH | Fixed |
| 2 | invoice_parser.py | NIF regex rejects lowercase, triggers repair loop | MEDIUM | Fixed |
| 3 | main.py | Malformed chat history crashes /api/chat | HIGH | Fixed |
| 4 | cfo_engine.py | OpenAI timeout crashes entire /api/cfo/report | HIGH | Fixed |
| 5 | main.py | tool_calls_made hardcoded to 3 | LOW | Fixed |
| 6 | main.py | CFO ledger query hardcoded to "2025-Q1" | MEDIUM | Fixed |

---

## What Is Still Reliable Without Changes

- `verifactu.py` — all 10 rules are pure Python, no API calls, fully reliable
- `execute_tool()` ledger queries — pure SQLAlchemy, no failure modes
- `simulate_tax` — pure math, no failure modes
- `forecast_cashflow` math — has fallback demo data if DB is empty
- `db/seed.py` — deterministic, idempotent (skips if already seeded)
