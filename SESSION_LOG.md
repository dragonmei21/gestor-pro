# Gestor Pro — Session 1 Build Log

**Date:** 2026-03-17
**Stack:** FastAPI + SQLAlchemy + SQLite + OpenAI API + Next.js (frontend pending)

---

## What Was Built This Session

### Infrastructure
- `.gitignore` — protects `.env`, `node_modules`, `*.db`, `chroma_db`
- `backend/requirements.txt` — all Python dependencies pinned
- `backend/__init__.py`, `backend/db/__init__.py`, `backend/engine/__init__.py`

### Database Layer
- `backend/db/models.py` — 5 SQLAlchemy ORM tables:
  - `User`, `Invoice`, `LedgerEntry`, `ComplianceReport`, `CFOReport`
- `backend/db/database.py` — SQLite engine + `get_db` FastAPI dependency
- `backend/db/seed.py` — 1 demo user + 21 ledger entries (2025-Q1 autónomo data)

### Engine Layer
- `backend/engine/verifactu.py` — 10 VeriFactu 2025 rules (VF-001 to VF-010), `check()` + `generate_xml()` + `_auto_fix()`
- `backend/engine/invoice_parser.py` — multi-step extraction + repair loop:
  - Step 1: pdfplumber (PDF) or Tesseract/GPT-4o vision (images)
  - Step 2: gpt-4o-mini structured JSON extraction
  - Step 3: Python validation (date, NIF, IVA rate, totals)
  - Step 4: gpt-4o-mini repair call if errors found
  - Step 5: deterministic tipo/categoria/deducible classification
- `backend/engine/cfo_engine.py` — cashflow forecast (avg + trend methods) + gpt-4o CFO board narrative in Spanish

### MCP Server
- `backend/mcp_server.py` — 6 tools over stdio transport:
  - `validate_invoice` — VeriFactu compliance check
  - `get_ledger_summary` — quarterly financial aggregation
  - `filter_ledger` — filtered ledger queries
  - `simulate_tax` — deterministic IVA/IRPF calculator
  - `forecast_cashflow` — historical + projected cashflow
  - `generate_verifactu_xml` — compliant XML generation

### FastAPI App
- `backend/main.py` — all 7 HTTP endpoints:
  - `GET  /api/health`
  - `GET  /api/ledger`
  - `GET  /api/ledger/summary`
  - `POST /api/invoices/parse`
  - `POST /api/compliance/check`
  - `POST /api/cfo/report`
  - `POST /api/chat` — OpenAI gpt-4o agent loop (max 5 tool-calling iterations)

---

## Key Decisions
- **LLM:** OpenAI (`gpt-4o-mini` for extraction, `gpt-4o` for narratives + agent)
- **API key:** `OPENAI_API_KEY` in `.env` (gitignored)
- **DB:** SQLite dev (`gestor.db`) via `DATABASE_URL` env var

---

## Sanity Check Results
| Component | Result |
|---|---|
| verifactu good invoice | compliant, score 100 |
| verifactu bad invoice | major_violations, score 0, 7 errors |
| All 6 MCP tools | passing |
| invoice_parser validation | 0 errors on good, 7 errors on bad |
| cfo_engine forecast | 3 historical + 3 forecast months |
| main.py /api/ledger | 21 entries |
| main.py /api/ledger/summary | ingresos €19,200, IVA a pagar €3,728 |

---

## TODO — Next Session
- [ ] Frontend: `npx create-next-app@latest frontend --tailwind --app --typescript`
- [ ] `app/layout.tsx` — sidebar nav
- [ ] `app/page.tsx` — dashboard with 4 KPI cards
- [ ] `app/compliance/page.tsx` — VeriFactu upload + report
- [ ] `app/cfo/page.tsx` — CFO narrative + Recharts area chart
- [ ] `app/chat/page.tsx` — tool-calling chatbot with live tool visualization
- [ ] `app/invoices/page.tsx` — invoice scanner + ledger table
- [ ] `lib/api.ts` + `lib/types.ts`
- [ ] Deploy: Railway (backend) + Vercel (frontend)
