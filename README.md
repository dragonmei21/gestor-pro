# Gestor Pro

> **AI-native financial back-office for Spanish autónomos.**
> Invoice OCR → VeriFactu compliance → cashflow forecasting → conversational accounting — fully automated.

Live at **http://204.168.140.34**

---

## What Is This

Spain has 3.3 million self-employed workers. Every quarter they manually reconcile invoices, calculate IVA/IRPF, generate VeriFactu XML for the tax authority (AEAT), and write financial reports — or pay an accountant €200/month to do it.

Gestor Pro automates the entire back-office with a multi-layer AI stack. Not a wrapper around ChatGPT. A real pipeline: OCR → deterministic validation → LLM extraction → repair loop → structured ledger → agent reasoning over live data.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (React/Vite)                     │
│  Dashboard · VeriFactu · CFO Report · Invoices · Chat · Gmail   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP (relative /api/*)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NGINX  (port 80)                             │
│   /api/*  ──────────────────────────► :8000 (FastAPI)          │
│   /*      ──► /root/lovable-ui/dist  (static SPA + fallback)   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               FastAPI  (Uvicorn, port 8000)                     │
│                                                                 │
│  /api/invoices/parse    ──► InvoiceParser (OCR + LLM)          │
│  /api/compliance/check  ──► VeriFactuEngine + GPT-4o           │
│  /api/cfo/report        ──► CFOEngine (forecast + narrative)   │
│  /api/chat              ──► Agent Loop → MCP subprocess        │
│  /api/ledger            ──► SQLAlchemy ORM → SQLite            │
│  /api/gmail/*           ──► Google OAuth + Gmail API           │
│                                                                 │
│              ┌──────────────────────────┐                      │
│              │   MCP Server (stdio)     │                      │
│              │  6 tools over subprocess │                      │
│              │  → queries SQLite live   │                      │
│              └──────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SQLite  (gestor.db)                          │
│   User · Invoice · LedgerEntry · ComplianceReport · CFOReport  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
gestor-pro/
│
├── backend/
│   ├── main.py                  # FastAPI app — all endpoints
│   ├── mcp_server.py            # MCP server — 6 tools over stdio
│   ├── requirements.txt
│   │
│   ├── db/
│   │   ├── database.py          # SQLAlchemy session + engine
│   │   ├── models.py            # 5 ORM models (33-field Invoice etc.)
│   │   └── seed.py              # Demo Q1 2025 data generator
│   │
│   └── engine/
│       ├── invoice_parser.py    # OCR + LLM extraction + repair loop
│       ├── verifactu.py         # 10-rule compliance engine + XML gen
│       ├── cfo_engine.py        # Cashflow forecast + GPT-4o narrative
│       └── gmail_watcher.py     # OAuth flow + inbox scanner
│
├── frontend/                    # Next.js app (port 3000, legacy)
│   └── app/
│       ├── page.tsx             # Dashboard (inline styles, no deps)
│       ├── chat/page.tsx        # Chat + MCP banner
│       ├── compliance/page.tsx  # VeriFactu upload + pipeline viz
│       ├── cfo/page.tsx         # CFO report + area chart
│       ├── invoices/page.tsx    # OCR upload + ledger table
│       └── globals.css          # Dark green design system
│
├── lovable-ui/                  # Vite/React app (port 3001, active)
│   └── src/
│       ├── pages/               # All 6 page components
│       ├── components/
│       │   ├── AppLayout.tsx    # Responsive layout + mobile nav
│       │   ├── AppSidebar.tsx   # Collapsible sidebar w/ hamburger
│       │   └── dashboard/       # KPICards, RecentActivity, MCPInsights
│       └── App.tsx              # react-router-dom routes
│
├── GESTOR_PRO_OVERVIEW.md       # Full technical two-pager
└── README.md                    # You are here
```

---

## The Pipelines

### 1. Invoice OCR — 5-Step Extraction Pipeline

```
 ┌──────────┐
 │  Upload  │  PDF · JPG · PNG
 └────┬─────┘
      │
      ▼
 ┌─────────────────────────────────────────┐
 │  Step 1 — Text Extraction               │
 │  PDF  ──► pdfplumber                    │
 │  Image ──► Tesseract (Spanish lang)     │
 │         └► GPT-4o Vision (if OCR fails) │
 └────┬────────────────────────────────────┘
      │
      ▼
 ┌─────────────────────────────────────────┐
 │  Step 2 — LLM Field Extraction          │
 │  PDF text  ──► gpt-4o-mini  (cheap)     │
 │  Image     ──► gpt-4o       (vision)    │
 │  Extracts 12 fields: NIF, amounts,      │
 │  IVA rate, IRPF, totals, currency       │
 └────┬────────────────────────────────────┘
      │
      ▼
 ┌─────────────────────────────────────────┐
 │  Step 3 — Deterministic Validation      │
 │  • Date format: YYYY-MM-DD              │
 │  • NIF regex: /^\d{8}[A-Z]$/           │
 │  • IVA rate ∈ {0, 4, 10, 21}           │
 │  • IRPF rate ∈ {0, 7, 15, 19}          │
 │  • total = base + IVA − IRPF           │
 └────┬──────────────┬──────────────────────┘
      │ valid        │ errors
      │              ▼
      │     ┌────────────────────────────────┐
      │     │  Step 4 — Repair Loop          │
      │     │  gpt-4o-mini + error context   │
      │     │  Re-validates output           │
      │     │  Flags repair_attempted +      │
      │     │  repair_succeeded              │
      │     └────────┬───────────────────────┘
      │              │
      ▼              ▼
 ┌─────────────────────────────────────────┐
 │  Step 5 — Deterministic Classification  │
 │  tipo: ingreso / gasto                  │
 │  categoria: software / viaje / material │
 │             formacion / cuota_ss /      │
 │             servicios                   │
 │  deducible: bool                        │
 └────┬────────────────────────────────────┘
      │
      ▼
  LedgerEntry → SQLite
```

---

### 2. VeriFactu Compliance — 10-Rule Engine

```
Upload ──► Same 5-step extraction ──► Rules Engine
                                           │
              ┌────────────────────────────▼──────────────────────┐
              │  RD 1007/2023 Validation Rules                    │
              │                                                    │
              │  VF-001  Vendor NIF format           [ERROR]      │
              │  VF-002  Invoice number present      [ERROR]      │
              │  VF-003  Date ISO 8601               [ERROR]      │
              │  VF-004  Base imponible > 0          [ERROR]      │
              │  VF-005  IVA rate ∈ {0,4,10,21}%    [ERROR]      │
              │  VF-006  IVA cuota = base × rate     [ERROR]      │
              │  VF-007  total = base+IVA−IRPF       [ERROR]      │
              │  VF-008  Concepto length > 3         [WARNING]    │
              │  VF-009  Client NIF if total > €3k   [WARNING]    │
              │  VF-010  Currency ∈ {EUR,USD,GBP}    [WARNING]    │
              └──────────────────────┬─────────────────────────────┘
                                     │
                         ┌───────────┴───────────┐
                         ▼                       ▼
                    Auto-fix pass           Score calc
                    (recalc IVA)     0 err = compliant (100)
                                     N warn = minor (≥70)
                                     M err  = major (0–69)
                                     │
                                     ▼
                              GPT-4o narrative
                              AEAT XML generation
                              ──► Download
```

---

### 3. Chat Agent — MCP Tool Loop

```
User message
     │
     ▼
 GPT-4o  ◄── system prompt (Spanish, real data only)
     │    ◄── conversation history
     │    ◄── 6 MCP tool schemas
     │
     │  decides which tools to call
     ▼
 ┌─────────────────────────────────────────────────────┐
 │             MCP Server (subprocess/stdio)           │
 │                                                     │
 │  get_ledger_summary   → Q1 P&L, IVA, top clients   │
 │  filter_ledger        → search entries by any field │
 │  simulate_tax         → IVA/IRPF calculation        │
 │  forecast_cashflow    → 3-month projection + risk   │
 │  validate_invoice     → run VeriFactu rules         │
 │  generate_verifactu_xml → produce AEAT XML          │
 └───────────────────────┬─────────────────────────────┘
                         │ JSON results
                         ▼
                    GPT-4o synthesizes
                    ──► response + tool log
                    (repeats up to 5 iterations)
```

The agent **cannot hallucinate financial data** — it has no parametric knowledge of your books. Every number must come from a tool call against the live SQLite database.

---

### 4. CFO Report — Two-Call Generation

```
Button click
     │
     ▼
 Load ledger ──► group by year-month
     │
     ▼
 Forecast model (deterministic Python)
 ├── rolling average OR trend analysis
 ├── 3-month forward projection
 └── risk: low / medium / high
          (by frequency of negative net months)
     │
     ▼
 GPT-4o call
 ├── Input: structured historical + forecast JSON
 ├── Prompt: "You are CFO. 4-paragraph board summary. Spanish."
 └── Output: narrative + risk_flags + action_items
     │
     ▼
 Persisted to CFOReport table
 Returned: KPIs + chart data + narrative
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Backend API | FastAPI + Uvicorn (Python 3.12) |
| ORM / DB | SQLAlchemy 2.0 + SQLite |
| AI Models | GPT-4o · GPT-4o-mini · GPT-4o Vision |
| Agent Framework | MCP (Model Context Protocol) v1.0 |
| OCR | Tesseract + pdfplumber + Pillow |
| Frontend (active) | React 18 + Vite + Tailwind CSS |
| Frontend (legacy) | Next.js 16 + Tailwind v4 |
| Routing | react-router-dom (SPA) |
| Charts | Recharts |
| Email | Google Gmail API + OAuth 2.0 |
| Server | Ubuntu 24.04 · Hetzner · Nginx · PM2 |

---

## Why the Numbers Are Reliable

Most "AI finance tools" pass numbers through a language model and hope for the best. This doesn't.

**Every financial figure is calculated deterministically in Python** before any LLM touches it. The AI layer only reads the output of validated, typed database records — it cannot modify them, invent them, or round them differently.

```
User asks: "How much IVA do I owe?"
     │
     ▼
Agent calls get_ledger_summary({ quarter: "2025-Q1" })
     │
     ▼
Python: SELECT SUM(iva) FROM ledger_entries WHERE tipo='ingreso'
        − SELECT SUM(iva) FROM ledger_entries WHERE tipo='gasto'
     │
     ▼
Returns: { iva_repercutido: 4032.00, iva_soportado: 525.45,
           iva_a_pagar: 3506.55 }
     │
     ▼
GPT-4o: "Debes declarar €3.506,55 de IVA este trimestre..."
```

The model answers with a fact. Not an estimate.

---

## Regulatory Coverage

| Regulation | What It Governs | Status |
|---|---|---|
| RD 1619/2012 | Mandatory invoice fields, numbering | ✓ Validated |
| RD 1007/2023 | VeriFactu invoicing system | ✓ Field-level rules |
| OM HAC/1177/2024 | AEAT XML schema + technical specs | ✓ XML generation |
| Modelo 303 | Quarterly IVA declaration | ✓ Calculation |
| Modelo 130 | IRPF quarterly payments | ✓ Calculation |

**VeriFactu mandatory dates:** Corporations → 2027-01-01 · Autónomos → 2027-07-01

---

## Running Locally

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # add OPENAI_API_KEY
uvicorn backend.main:app --reload --port 8000

# Frontend (Vite)
cd lovable-ui
npm install
npm run dev  # http://localhost:5173

# Or Next.js frontend
cd frontend
npm install
npm run dev  # http://localhost:3000
```

---

## API Reference

```
GET  /api/ledger                          All ledger entries
GET  /api/ledger/summary?quarter=2025-Q1  Quarterly P&L + IVA
POST /api/invoices/parse          (file)  OCR + extract + book
POST /api/compliance/check        (file)  VeriFactu check + XML
POST /api/cfo/report              (form)  Forecast + narrative
POST /api/chat                    (json)  Agent loop
GET  /api/gmail/status                    OAuth status
POST /api/gmail/scan                      Scan inbox + parse
GET  /api/health                          Health check
```

---

## Seed Data

Demo runs on a realistic Q1 2025 Spanish autónomo:

| | Amount |
|---|---|
| Revenue (Q1) | €19,200 |
| Expenses (Q1) | ~€2,500 |
| Net Profit | ~€16,700 |
| IVA Payable | ~€3,500 |
| Clients | Empresa Digital SL, StartupBCN, FinanceGroup SA |
| Expense categories | cuota_ss × 3, software (Adobe/GitHub), viaje, material |

---

*FastAPI · GPT-4o · MCP · React · Vite · Nginx · SQLite · Ubuntu*
