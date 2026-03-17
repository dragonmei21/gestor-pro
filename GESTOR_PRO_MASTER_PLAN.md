# Gestor Pro — 48-Hour Vibe Coding Master Plan

> **Goal:** Ship a working prototype that impresses on Assignment 2 AND looks like a real investable product.
> **Stack:** FastAPI backend + MCP server + Next.js frontend + Claude API + SQLite
> **Two demo paths:** VeriFactu Compliance Copilot + AI CFO Narrative

---

## What We're Building

**Gestor Pro** is an AI-powered financial operations platform for Spanish autónomos and SMEs. It combines:
1. **VeriFactu Compliance Copilot** — upload invoices, get exact violations + auto-fixed XML
2. **AI CFO Module** — upload transactions, get cashflow forecast + CFO board narrative in Spanish
3. **Smart Chatbot** — tool-calling agent that queries your ledger in real time
4. **Invoice Scanner** — OCR + multimodal LLM extraction with validation repair loop

The Claude agent doesn't just answer questions — it calls MCP tools mid-reasoning, gets structured data back, and synthesizes everything into actionable output. That's the assignment's "non-straightforward LLM use" requirement nailed.

---

## Repo Structure

```
gestor-pro/
├── backend/
│   ├── main.py                  # FastAPI app — all HTTP endpoints
│   ├── mcp_server.py            # MCP server — all tools Claude can call
│   ├── engine/
│   │   ├── invoice_parser.py    # OCR + multimodal LLM extraction + repair loop
│   │   ├── verifactu.py         # VeriFactu validation rules engine
│   │   ├── tax_rules.py         # IVA/IRPF deterministic logic (keep from v1)
│   │   ├── rag_retriever.py     # ChromaDB RAG (upgrade from v1)
│   │   ├── cfo_engine.py        # Cashflow forecast + FP&A logic
│   │   └── chat_tools.py        # Tool definitions for chatbot agent
│   ├── db/
│   │   ├── database.py          # SQLite connection + session
│   │   ├── models.py            # SQLAlchemy ORM models
│   │   └── seed.py              # Demo data seeder
│   ├── data/
│   │   ├── verifactu_rules.json # VeriFactu 2025 compliance ruleset
│   │   ├── tax_rules_2025.json  # IVA/IRPF rules (carry over from v1)
│   │   └── demo_invoices/       # Sample invoices for demo
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # Landing / dashboard
│   │   │   ├── compliance/page.tsx   # VeriFactu Compliance Copilot
│   │   │   ├── cfo/page.tsx          # AI CFO + FP&A
│   │   │   ├── invoices/page.tsx     # Invoice scanner + ledger
│   │   │   └── chat/page.tsx         # Tool-calling chatbot
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn components
│   │   │   ├── InvoiceUploader.tsx
│   │   │   ├── ComplianceReport.tsx
│   │   │   ├── CFOReport.tsx
│   │   │   ├── LedgerTable.tsx
│   │   │   └── ChatInterface.tsx
│   │   └── lib/
│   │       ├── api.ts                # All fetch calls to backend
│   │       └── types.ts              # Shared TypeScript types
│   ├── package.json
│   └── tailwind.config.ts
├── .env.example
└── README.md
```

---

## Day 1 — Backend + MCP (Hours 0–24)

### Hour 0–2: Project scaffold
- [ ] `git init gestor-pro`, create folder structure above
- [ ] Copy `engine/tax_rules.py`, `engine/rag_retriever.py`, `data/tax_rules_2025.json` from v1
- [ ] Create `.env` with `ANTHROPIC_API_KEY`, `DATABASE_URL=sqlite:///./gestor.db`
- [ ] `pip install fastapi uvicorn anthropic mcp sqlalchemy chromadb pytesseract pdfplumber opencv-python-headless python-multipart`
- [ ] Verify: `uvicorn backend.main:app --reload` starts with no errors

### Hour 2–5: Database
- [ ] Build `db/models.py` — see `DATABASE_SCHEMA.md` for exact tables
- [ ] Build `db/database.py` — SQLite engine + get_db dependency
- [ ] Build `db/seed.py` — insert 20 demo invoices + ledger entries
- [ ] Run `python -m backend.db.seed` — verify rows in DB
- [ ] **Checkpoint:** `sqlite3 gestor.db ".tables"` shows all 5 tables

### Hour 5–9: MCP Server (the star of the show)
- [ ] Build `mcp_server.py` — see `MCP_SERVER_SPEC.md` for all tool definitions
- [ ] Implement `validate_invoice(invoice_data)` → returns violations list + score
- [ ] Implement `get_ledger_summary(quarter, year)` → returns structured financial summary
- [ ] Implement `filter_ledger(tipo, proveedor, date_range)` → returns filtered entries
- [ ] Implement `simulate_tax(base_imponible, iva_rate, irpf_rate)` → returns tax breakdown
- [ ] Implement `forecast_cashflow(months)` → returns monthly projections
- [ ] Implement `generate_verifactu_xml(invoice_data)` → returns compliant XML string
- [ ] Test each tool in isolation with `pytest backend/tests/test_mcp_tools.py`
- [ ] **Checkpoint:** All 6 tools return structured JSON with no errors

### Hour 9–14: Invoice Parser (upgrade from v1)
- [ ] Build multi-step extraction with repair loop in `engine/invoice_parser.py`:
  - Step 1: OCR or pdfplumber extraction
  - Step 2: Claude `claude-haiku-4-5` single call → structured JSON extraction
  - Step 3: Python validation (totals check, IVA rate valid, date format, NIF format)
  - Step 4: If validation fails → Claude repair call with error context
  - Step 5: Deterministic IVA/IRPF classification
- [ ] Add multimodal path: if image invoice, send directly to Claude vision (skip OCR)
- [ ] Fix naming: rename all `claude_client` / `get_claude_client` references to `openai_client` OR migrate fully to `anthropic` SDK (recommended — use Anthropic since that's what the agent uses)
- [ ] **Checkpoint:** Upload `data/demo_invoices/sample.pdf` → get valid JSON with `validation_errors: []`

### Hour 14–18: Tool-Calling Chatbot
- [ ] Build `engine/chat_tools.py` — tool schemas in Anthropic format (see `MCP_SERVER_SPEC.md`)
- [ ] Upgrade `chatbot` endpoint in `main.py`:
  - Load ledger summary + user profile into system prompt
  - Send message to Claude with tools enabled
  - If Claude returns `tool_use` block → execute the matching function → send result back
  - Loop until Claude returns final `text` response (max 5 turns)
- [ ] Upgrade RAG: add query rewriting step before ChromaDB retrieval
- [ ] Add citations: tag each RAG chunk with source (ledger entry ID or rule name)
- [ ] **Checkpoint:** Ask "¿Cuánto IVA debo declarar este trimestre?" → gets real number from ledger tool

### Hour 18–22: VeriFactu Compliance Engine
- [ ] Build `engine/verifactu.py` — load `data/verifactu_rules.json`, expose `check_compliance(invoice)` 
- [ ] Wire into `/api/compliance/check` endpoint: parse invoice → validate → agent writes narrative report
- [ ] Agent flow: extract fields → call `validate_invoice` tool → call `generate_verifactu_xml` tool → synthesize violation report with fixes
- [ ] **Checkpoint:** Upload a deliberately broken invoice → get report listing 3+ violations with fixes

### Hour 22–24: CFO Narrative Engine
- [ ] Build `engine/cfo_engine.py` — pandas-based cashflow model, 3-month rolling forecast
- [ ] Wire into `/api/cfo/report` endpoint:
  - Load last 90 days from ledger
  - Call `forecast_cashflow` MCP tool → get projection data
  - Claude `claude-sonnet-4-6` call: write CFO board narrative in Spanish with numbers injected
  - Return narrative + chart data JSON
- [ ] **Checkpoint:** Hit endpoint → get Spanish narrative + monthly chart data array

---

## Day 2 — Frontend + Polish (Hours 24–48)

### Hour 24–28: Next.js scaffold + Dashboard
- [ ] `npx create-next-app@latest frontend --tailwind --app`
- [ ] `npx shadcn-ui@latest init` — choose slate theme
- [ ] Install: `npm i recharts react-dropzone react-markdown`
- [ ] Build `app/page.tsx` — dashboard with 4 KPI cards (revenue, expenses, IVA owed, compliance score)
- [ ] Build `lib/api.ts` — typed fetch wrappers for all backend endpoints
- [ ] **Checkpoint:** Dashboard loads with seeded demo data numbers

### Hour 28–33: Compliance Copilot page
- [ ] Build `components/InvoiceUploader.tsx` — drag-drop, shows filename + preview
- [ ] Build `compliance/page.tsx`:
  - Upload zone → POST to `/api/compliance/check`
  - Loading state with "Analizando factura..." spinner
  - `ComplianceReport` component: score badge, violations list (each with severity + fix description), download XML button
- [ ] Make violations visually punchy: red/amber/green badges, clear fix text
- [ ] **Checkpoint:** Full demo path works — upload → score → violations → download XML

### Hour 33–38: AI CFO page
- [ ] Build `cfo/page.tsx`:
  - CSV upload OR "use demo data" button
  - POST to `/api/cfo/report`
  - Loading: "Tu CFO está analizando los datos..."
  - `CFOReport` component: Recharts area chart (monthly cashflow) + AI narrative rendered as markdown
- [ ] Style the narrative nicely — looks like a real board report
- [ ] **Checkpoint:** Demo data → chart renders + Spanish CFO narrative appears

### Hour 38–42: Chatbot page
- [ ] Build `chat/page.tsx` — clean chat UI, message bubbles
- [ ] Show tool calls visually: when agent calls a tool, show a subtle "🔧 consultando ledger..." indicator
- [ ] This is the best demo moment — seeing the agent think + call tools live
- [ ] **Checkpoint:** "¿Cuánto IVA debo este trimestre?" → agent shows tool call → returns exact number

### Hour 42–45: Invoice Scanner page  
- [ ] Build `invoices/page.tsx` — upload + extracted fields side by side
- [ ] Show validation errors inline if repair was needed (shows engineering depth)
- [ ] Ledger table below with all entries
- [ ] **Checkpoint:** Upload PDF → see extracted JSON → see it added to ledger table

### Hour 45–47: Polish sprint
- [ ] Add Gestor Pro logo (teal + white, use existing SVG or rebuild)
- [ ] Consistent nav sidebar with icons
- [ ] Mobile-responsive (Tailwind makes this easy)
- [ ] Add demo mode banner: "Usando datos demo — sube tus propias facturas"
- [ ] Error states: if API fails, show friendly message not stack trace
- [ ] Loading skeletons on all data-heavy components

### Hour 47–48: Demo prep
- [ ] Seed the DB with a compelling demo story (realistic autónomo data, one quarter)
- [ ] Record Loom: 3-minute walkthrough hitting all 4 features
- [ ] Deploy backend to Railway (one command: `railway up`)
- [ ] Deploy frontend to Vercel (`vercel --prod`)
- [ ] Push to GitHub, make sure no API keys in repo
- [ ] Write 2-pager (see `ASSIGNMENT_2_PAGER.md`)

---

## API Endpoints Reference

```
POST /api/invoices/parse          # Upload invoice → extracted JSON
POST /api/compliance/check        # Upload invoice → compliance report + XML
POST /api/cfo/report              # Upload CSV or use demo → CFO narrative + chart data
POST /api/chat                    # Send message → agent response (tool-calling loop)
GET  /api/ledger                  # Get all ledger entries
GET  /api/ledger/summary          # Get quarterly summary stats
GET  /api/health                  # Health check
```

---

## Environment Variables

```bash
# backend/.env
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=sqlite:///./gestor.db
CHROMA_PATH=./chroma_db
DEBUG=true
DEMO_MODE=true
```

---

## Assignment 2 Compliance Checklist

- [x] **Non-straightforward LLM use #1:** Multi-step extraction + validation + repair loop (3 LLM calls, structured output, deterministic post-processing)
- [x] **Non-straightforward LLM use #2:** Tool-calling chatbot (multi-call loop, agent decides when to call tools, real computation returned)
- [x] **Bonus complexity:** VeriFactu agent flow (extract → validate → generate XML → synthesize report = 4-step pipeline)
- [x] **RAG upgrade:** Query rewriting + metadata filters + citations
- [x] **LLM API:** Anthropic Claude (fixes the OpenAI/Claude naming inconsistency from v1)
- [x] **New feature beyond v1:** VeriFactu compliance module didn't exist
- [x] **Code in GitHub:** Yes
- [x] **Video/demo URL:** Loom + Vercel deploy
- [x] **2-pager:** See `ASSIGNMENT_2_PAGER.md`

---

## If You Run Out of Time (Priority Order)

1. **Must have:** Multi-step repair loop + tool-calling chatbot (core assignment req)
2. **Must have:** VeriFactu compliance page working end-to-end (the wow moment)
3. **Nice to have:** CFO narrative (impressive but second priority)
4. **Skip if needed:** Mobile polish, full invoice scanner UI, CSV upload for CFO
5. **Always fake:** Use demo data everywhere, don't waste time on real AEAT API calls
