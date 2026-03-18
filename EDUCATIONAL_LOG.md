# Gestor Pro — Educational Log
## How Everything Was Built and How It All Connects

---

## 1. What Is Gestor Pro?

Gestor Pro is an AI-powered financial management platform for Spanish freelancers (autónomos) and small businesses. It automates the boring parts of running a business in Spain:

- Scanning invoices (uploaded or from Gmail)
- Categorising expenses and income automatically
- Checking legal compliance (VeriFactu 2025 regulations)
- Generating CFO-style financial reports with forecasts
- Answering financial questions in a chat interface

The entire system has three layers:

```
Browser (Next.js 14)
        ↕  HTTP/REST (JSON)
FastAPI Backend (Python)
        ↕  SQLite (file)  +  OpenAI API  +  Gmail API
Data & AI layer
```

---

## 2. The Backend — Layer by Layer

### 2a. The Database (`backend/db/`)

**`models.py`** defines the database schema using SQLAlchemy ORM. There are 5 tables:

| Table | Purpose |
|---|---|
| `User` | One demo user (NIF: 12345678A) |
| `Invoice` | Every invoice parsed — stores all extracted fields |
| `LedgerEntry` | Every income/expense line item in the financial ledger |
| `ComplianceReport` | Results of each VeriFactu compliance check |
| `CFOReport` | Saved CFO narrative reports |

**`database.py`** creates the SQLite engine and provides a `get_db()` dependency that FastAPI uses to inject a database session into any endpoint that needs it.

**`seed.py`** populates the database with 21 demo ledger entries spanning 2025-Q1 so the dashboard shows real-looking data on first launch. It's idempotent — running it twice doesn't create duplicates.

**Key pattern:** FastAPI endpoints receive a `db: Session = Depends(get_db)` parameter. SQLAlchemy ORM lets them query with `db.query(models.LedgerEntry).filter(...)` instead of writing raw SQL.

---

### 2b. Invoice Parser (`backend/engine/invoice_parser.py`)

This is the core intelligence of the system. When a user uploads a PDF or image, it runs a 5-step pipeline:

```
File bytes
    ↓
Step 1: TEXT EXTRACTION
    PDF → pdfplumber (reads text layer)
    Image → Tesseract OCR (or GPT-4o vision if OCR fails)
    ↓
Step 2: LLM EXTRACTION (gpt-4o-mini)
    Send raw text + prompt → get structured JSON back
    {numero_factura, fecha_emision, proveedor_nombre, total, iva_porcentaje, ...}
    ↓
Step 3: VALIDATION
    - Date format correct? (YYYY-MM-DD)
    - NIF format valid? (Spanish tax ID regex)
    - IVA rate in {0, 4, 10, 21}? (only valid Spanish rates)
    - Total ≈ base + IVA - IRPF? (math check)
    ↓
Step 4: REPAIR (if validation failed)
    Send errors + original text back to gpt-4o-mini
    "Fix these specific problems: ..."
    ↓
Step 5: CLASSIFICATION (deterministic, no LLM)
    classify_tipo() → "ingreso" or "gasto"
    classify_categoria() → "software", "viaje", "marketing", etc.
    is_deducible() → True/False based on Spanish tax rules
```

**Why 3 LLM calls max?** The first call extracts, the second call repairs if needed. GPT-4o vision is only used as a last resort for unreadable images. This keeps costs low.

**Reliability fix — `_safe_parse_json()`:** LLMs sometimes wrap JSON in markdown code fences (` ```json ... ``` `). The safe parser tries three strategies:
1. Direct `json.loads()`
2. Strip code fences, try again
3. Regex-search for `{...}` anywhere in the response

Without this, malformed LLM output would silently save a zero-value invoice to the database.

---

### 2c. VeriFactu Compliance Engine (`backend/engine/verifactu.py`)

VeriFactu is a Spanish tax authority regulation (2025) that mandates specific invoice formats. This engine checks 10 rules deterministically — no LLM involved, just Python logic.

| Rule | What it checks |
|---|---|
| VF-001 | Invoice number present |
| VF-002 | Issue date present and valid format |
| VF-003 | Supplier NIF present and valid format |
| VF-004 | Tax base > 0 |
| VF-005 | IVA rate is a valid Spanish rate (0, 4, 10, or 21%) |
| VF-006 | Totals are mathematically consistent |
| VF-007 | Invoice type ("ingreso"/"gasto") is declared |
| VF-008 | Invoice number has no special characters |
| VF-009 | Deductibility flag is set |
| VF-010 | Supplier name is present |

The `VeriFactuValidator` class:
- `check(invoice_dict)` → returns list of violations with severity (error/warning)
- `_auto_fix(invoice_dict)` → tries to patch common issues programmatically
- `generate_xml(invoice_dict)` → produces a compliant VeriFactu XML blob

**Score calculation:** `score = 100 - (errors × 20) - (warnings × 5)`. Score ≥ 80 → compliant.

---

### 2d. CFO Engine (`backend/engine/cfo_engine.py`)

Generates executive-level financial reports with cash flow forecasts.

**Forecast algorithm:**
1. Pull last 6 months of ledger data from DB
2. Calculate average monthly income and expenses
3. Apply trend coefficient (are things trending up or down?)
4. Project forward 3 months
5. Call GPT-4o for a narrative "CFO memo" in Spanish

**Reliability fix:** The GPT-4o call is wrapped in `try/except`. If the API call fails or times out, the endpoint returns a pre-written Spanish fallback narrative using the already-computed numbers. The endpoint never crashes.

---

### 2e. Gmail Watcher (`backend/engine/gmail_watcher.py`)

Connects to Gmail via OAuth2 and scans for invoice attachments.

**Authentication flow:**
```
First run:
  Check for gmail_token.json → not found
  Load gmail_credentials.json (downloaded from Google Cloud Console)
  Open browser → user clicks "Allow" → Google sends back token
  Save token to gmail_token.json

Subsequent runs:
  Load gmail_token.json
  If expired → refresh automatically (no browser needed)
```

**GMAIL_DEMO_MODE=true (default):** No OAuth needed. Returns 3 hardcoded mock invoices (AWS €108.89, Renfe €100, Adobe €66.49) with pre-built extracted fields. This lets the demo run without any Google credentials.

**Real mode flow:**
```
check_new_invoices(hours_back=24)
    → Gmail API: search "after:{timestamp} has:attachment"
    → For each email: walk MIME parts recursively
    → Find PDF/image attachments
    → Download bytes (large: separate API call; small: inline in message)
    → Return list of {filename, bytes, email_from, email_subject, ...}
```

---

### 2f. MCP Server (`backend/mcp_server.py`)

MCP (Model Context Protocol) is a standard that lets AI models call external tools in a structured way. The MCP server exposes 6 financial tools:

| Tool | What it does |
|---|---|
| `validate_invoice` | Run VeriFactu rules on an invoice |
| `get_ledger_summary` | Total income/expenses/IVA for a quarter |
| `filter_ledger` | Filter entries by category/type/date |
| `simulate_tax` | Calculate estimated quarterly tax bill |
| `forecast_cashflow` | Project next 3 months |
| `generate_verifactu_xml` | Produce compliance XML |

The server runs over **stdio transport** — it reads JSON-RPC messages from stdin and writes responses to stdout. This means the FastAPI backend can spawn it as a subprocess and talk to it through pipes.

**Why a real subprocess?** The original implementation called these tools inline (just Python function calls). The real MCP pattern requires the server to be a separate process so it can be called by any MCP-compatible client (not just this FastAPI app). It's also a better architecture — the AI agent drives the tool calls, not hardcoded application logic.

---

### 2g. FastAPI Main App (`backend/main.py`)

The HTTP API layer. Handles requests from the frontend and orchestrates everything above.

**Endpoints:**

| Method | Path | What it does |
|---|---|---|
| GET | `/api/health` | Returns `{status: "ok"}` — used by frontend to check if backend is running |
| GET | `/api/ledger` | Returns all ledger entries (optionally filtered by quarter) |
| GET | `/api/ledger/summary` | Returns KPI totals: ingresos, gastos, IVA neta, beneficio |
| POST | `/api/invoices/parse` | Accepts file upload → runs invoice parser → saves to DB |
| POST | `/api/compliance/check` | Accepts file upload → parse → VeriFactu check → returns score + violations |
| POST | `/api/cfo/report` | Generates CFO forecast + GPT-4o narrative |
| POST | `/api/chat` | Runs the AI agent loop (see below) |
| GET | `/api/gmail/status` | Returns `{connected: bool, demo_mode: bool}` |
| POST | `/api/gmail/connect` | Triggers OAuth flow (or returns demo_mode status) |
| POST | `/api/gmail/disconnect` | Deletes stored token |
| POST | `/api/gmail/scan` | Scans Gmail → parse all attachments → save to DB |

**The Agent Loop (`/api/chat`):**

This is the most complex part of the system. When a user asks a financial question:

```
User: "¿Cuánto gasté en software este mes?"

1. FastAPI receives message + conversation history

2. Start MCP session:
   - Spawn backend/mcp_server.py as subprocess
   - Open stdio pipe connection
   - Initialize MCP session (handshake)

3. Get available tools list from MCP server

4. Call GPT-4o with:
   - System prompt (CFO assistant persona)
   - Conversation history
   - User message
   - Tool definitions (from MCP)

5. GPT-4o responds with tool_calls:
   [{"name": "filter_ledger", "args": {"categoria": "software", "tipo": "gasto"}}]

6. Forward tool call to MCP server via session.call_tool()
   MCP server runs the tool → queries DB → returns JSON

7. Add tool result to conversation, call GPT-4o again

8. GPT-4o now has the data → generates Spanish narrative answer

9. Return to frontend:
   {
     "response": "Este mes gastaste €175.38 en software...",
     "tools_called": ["filter_ledger"],
     "tool_calls_made": 1,
     "iterations": 2
   }
```

Max 5 iterations to prevent infinite loops. Each iteration = one GPT-4o call.

---

## 3. The Frontend — Page by Page

The frontend is a Next.js 14 App Router application. All pages are React Server/Client components. Communication with the backend happens through typed fetch functions in `frontend/lib/api.ts`.

### Navigation Structure

```
Layout (app/layout.tsx)
├── Sidebar (dark navy #0a1628, teal accent #0FA876)
│   ├── Dashboard        → /
│   ├── Facturas         → /invoices
│   ├── Compliance       → /compliance
│   ├── CFO              → /cfo
│   ├── Chat             → /chat
│   └── Gmail            → /gmail
└── Demo mode banner (top)
```

---

### Dashboard (`app/page.tsx`)

**What it does:** Shows the financial overview for the current quarter.

**How it connects:**
```
Page loads
    → GET /api/ledger/summary
    → Returns {ingresos, gastos, iva_neta, beneficio}
    → 4 KPI cards update

    → GET /api/ledger?limit=10
    → Returns recent ledger entries
    → Table renders with category badges
```

**Key UI:** 4 metric cards at top, then a table of recent transactions with color-coded tipo badges (ingreso = green, gasto = red).

---

### Invoices (`app/invoices/page.tsx`)

**What it does:** Upload invoices, see extracted fields, browse full ledger.

**How it connects:**
```
User drops PDF/image onto dropzone
    → POST /api/invoices/parse (multipart/form-data)
    → Backend: text extraction → LLM extraction → validation → repair if needed
    → Returns extracted invoice fields + repair status
    → Page shows: grid of extracted fields, repair badge ("Reparado" if repair ran)

Tabs at bottom: Todos / Ingresos / Gastos
    → GET /api/ledger (already cached)
    → Filter client-side by tipo
```

---

### Compliance (`app/compliance/page.tsx`)

**What it does:** Upload an invoice, get a VeriFactu compliance score with detailed violations.

**How it connects:**
```
User uploads file
    → POST /api/compliance/check
    → Backend: parse invoice → run 10 VeriFactu rules
    → Returns:
      {
        score: 85,
        compliant: true,
        violations: [{rule: "VF-005", message: "...", severity: "warning"}],
        invoice: {...extracted fields...},
        narrative: "GPT-4o explanation of issues",
        tool_calls_made: 2
      }
    → Score badge (green ≥80, yellow 60-80, red <60)
    → Violations list with severity icons
    → "Descargar XML" button → calls /api/compliance/check again for XML
```

**Real tool calls counter:** The `tool_calls_made` field shows how many MCP tools the agent actually called (not hardcoded). This was a bug fix — previously always showed 3.

---

### CFO Report (`app/cfo/page.tsx`)

**What it does:** Generate an AI financial forecast with charts and executive narrative.

**How it connects:**
```
User clicks "Generar informe CFO"
    → POST /api/cfo/report
    → Backend:
        1. Query last 6 months from DB
        2. Calculate avg income/expenses
        3. Apply trend projection
        4. GPT-4o generates Spanish CFO narrative
    → Returns:
      {
        quarter: "2025-Q1",
        historical: [{month: "Ene", ingresos: 3200, gastos: 1800}, ...],
        forecast: [{month: "Abr", ingresos: 3500, gastos: 2000}, ...],
        narrative: "## Análisis Ejecutivo\n...",
        risk_flags: ["Margen decreciente en Q1"],
        action_items: ["Revisar gastos de marketing"]
      }

Chart: Recharts AreaChart
    - Historical months: solid lines
    - Forecast months: dashed lines (after today's date)
    - Two series: ingresos (teal) + gastos (red/orange)

Narrative: rendered as Markdown via ReactMarkdown component
```

---

### Chat (`app/chat/page.tsx`)

**What it does:** Full conversational interface powered by GPT-4o + MCP tool calls.

**How it connects:**
```
User types question (or clicks suggested question chip)
    → POST /api/chat
      {message: "¿Cuánto IVA debo pagar este trimestre?", history: [...]}
    → Backend: agent loop (up to 5 iterations)
    → Returns:
      {
        response: "Tu IVA a pagar este trimestre es €847.20...",
        tools_called: ["get_ledger_summary", "simulate_tax"],
        tool_calls_made: 2,
        iterations: 3
      }

Message bubble: user right / assistant left
Tool calls: small teal badge showing wrench icon + tool name + result preview
Typing indicator: 3 bouncing dots while waiting

History management: each exchange appends {role, content} to local state
    → Sent with next message so GPT-4o has full conversation context
```

**Suggested questions (pre-wired):**
- "¿Cuánto IVA debo pagar este trimestre?"
- "¿Cuáles son mis gastos deducibles?"
- "Haz una previsión de cash flow para los próximos 3 meses"
- "¿Gasté más en software o en viajes?"

---

### Gmail (`app/gmail/page.tsx`)

**What it does:** Show Gmail connection status, trigger inbox scan, display found invoices.

**How it connects:**
```
Page loads
    → GET /api/gmail/status
    → Returns {connected: false, demo_mode: true}
    → Shows "Demo Mode" badge (or "Conectado" green badge if real mode)

"Escanear Gmail" button
    → POST /api/gmail/scan?hours_back=24
    → Backend (demo mode):
        get_mock_attachments() → 3 fake invoices with _demo_extracted fields
        Skip LLM parser → save directly to DB
        Return results list
    → Toast: "3 facturas encontradas en Gmail"
    → Results list: filename + status badge (saved/error) + total amount

"Conectar Gmail" button (real mode only)
    → POST /api/gmail/connect
    → Opens browser for OAuth consent
    → Token saved to backend/credentials/gmail_token.json
```

---

## 4. The Full Data Flow — End to End

Here's what happens when a user uploads an invoice and then asks about it in the chat:

```
1. USER drops "factura_aws.pdf" on /invoices page

2. FRONTEND sends:
   POST /api/invoices/parse
   Content-Type: multipart/form-data
   Body: file bytes

3. BACKEND (invoice_parser.py):
   pdfplumber extracts text
   gpt-4o-mini: "Extract invoice fields" → returns JSON
   validate_extraction() checks 4 rules
   → All pass → no repair needed
   classify_tipo() → "gasto"
   classify_categoria() → "software"

4. BACKEND (main.py):
   Creates Invoice row in SQLite
   Creates LedgerEntry row in SQLite
   Returns extracted fields to frontend

5. FRONTEND shows:
   Grid of extracted fields
   "Guardado" badge

---

6. USER goes to /chat, types:
   "¿Cuánto gasté en software este mes?"

7. FRONTEND sends:
   POST /api/chat
   {message: "...", history: []}

8. BACKEND:
   Spawns mcp_server.py as subprocess
   Opens stdio pipe

9. BACKEND calls GPT-4o:
   System: "Eres un asistente CFO..."
   User: "¿Cuánto gasté en software este mes?"
   Tools: [validate_invoice, get_ledger_summary, filter_ledger, ...]

10. GPT-4o responds:
    tool_calls: [{name: "filter_ledger", args: {categoria: "software", tipo: "gasto"}}]

11. BACKEND forwards to MCP server:
    session.call_tool("filter_ledger", {categoria: "software", tipo: "gasto"})
    MCP server queries DB → returns [AWS €108.89, Adobe €66.49]

12. BACKEND calls GPT-4o again with tool result:
    GPT-4o generates answer: "Este mes gastaste €175.38 en software:
    - Amazon Web Services: €108.89
    - Adobe Creative Cloud: €66.49"

13. FRONTEND receives:
    {response: "...", tools_called: ["filter_ledger"], tool_calls_made: 1}
    Renders message bubble + tool call badge
```

---

## 5. Technology Decisions

| Decision | Why |
|---|---|
| SQLite (not Postgres) | Zero config for dev/demo. Switch by changing DATABASE_URL in .env |
| gpt-4o-mini for extraction | Fast + cheap. Extraction is a structured task, doesn't need full GPT-4o |
| gpt-4o for agent loop + CFO | Complex reasoning tasks benefit from the more capable model |
| MCP over direct function calls | Industry standard for AI tool use. Any MCP client (Claude Desktop, etc.) can connect to the same server |
| GMAIL_DEMO_MODE=true default | Demo works without any Google credentials. Real mode is opt-in |
| Next.js App Router | Server components reduce client bundle size. Layout nesting is clean for the sidebar pattern |
| shadcn/ui | Accessible, unstyled-by-default components. Easy to theme to the navy/teal palette |
| Recharts | Best React charting library for the historical+forecast split line pattern |

---

## 6. File Map

```
gestor-pro/
├── backend/
│   ├── main.py                    ← FastAPI app, all 11 endpoints, agent loop
│   ├── mcp_server.py              ← MCP server (6 tools, stdio transport)
│   ├── requirements.txt           ← Python dependencies
│   ├── db/
│   │   ├── models.py              ← SQLAlchemy ORM (5 tables)
│   │   ├── database.py            ← Engine + get_db() dependency
│   │   └── seed.py                ← 21 demo ledger entries
│   └── engine/
│       ├── invoice_parser.py      ← 5-step PDF/image → structured data pipeline
│       ├── verifactu.py           ← 10 VeriFactu compliance rules (no LLM)
│       ├── cfo_engine.py          ← Forecast + GPT-4o CFO narrative
│       └── gmail_watcher.py       ← Gmail OAuth2 + attachment scanner
├── frontend/
│   ├── app/
│   │   ├── layout.tsx             ← Sidebar navigation + demo banner
│   │   ├── page.tsx               ← Dashboard (KPIs + recent ledger)
│   │   ├── invoices/page.tsx      ← Upload + parse + ledger table
│   │   ├── compliance/page.tsx    ← VeriFactu check + score + XML
│   │   ├── cfo/page.tsx           ← Forecast chart + CFO narrative
│   │   ├── chat/page.tsx          ← GPT-4o chat + tool call visualisation
│   │   └── gmail/page.tsx         ← Gmail status + scan results
│   └── lib/
│       ├── api.ts                 ← Typed fetch wrappers for all endpoints
│       └── types.ts               ← TypeScript interfaces
├── .env                           ← OPENAI_API_KEY, DATABASE_URL (gitignored)
├── .gitignore
├── gmail_integration_spec.md      ← Gmail feature spec
├── FRONTEND_SPEC.md               ← Frontend design spec
└── EDUCATIONAL_LOG.md             ← This file
```

---

## 7. Running the Project

```bash
# Backend
cd backend
pip install -r requirements.txt
python db/seed.py          # seed demo data (run once)
uvicorn main:app --reload  # starts on http://localhost:8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                # starts on http://localhost:3000
```

Environment variables needed in `backend/.env`:
```
OPENAI_API_KEY=sk-...
DATABASE_URL=sqlite:///./gestor.db
GMAIL_DEMO_MODE=true
```

---

## 8. What Makes This Production-Ready vs. Demo

| Feature | Current (Demo) | Production |
|---|---|---|
| Database | SQLite file | PostgreSQL with connection pooling |
| Auth | User ID hardcoded = 1 | JWT / OAuth2 per user |
| Gmail | GMAIL_DEMO_MODE=true | Real OAuth per user, token stored in DB |
| File storage | In-memory bytes | S3 or similar object storage |
| MCP server | Spawned per request | Persistent process with connection pool |
| Rate limiting | None | API rate limits per user |
| Error monitoring | Python logging | Sentry / Datadog |
