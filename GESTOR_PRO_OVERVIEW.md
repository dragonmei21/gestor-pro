# Gestor Pro
## AI-Native Financial Operations Platform for Spanish Autónomos

---

## The Problem

Spain has 3.3 million self-employed workers (autónomos). Every quarter, each one manually reconciles invoices, calculates IVA and IRPF, prepares VeriFactu-compliant XML submissions for the tax authority (AEAT), and produces financial reports — work that requires an accountant or hours of spreadsheet hell. The regulatory complexity is real: Spain's RD 1007/2023 mandates certified invoicing software by 2027, with technical specs spanning 200+ pages of XML schema definitions.

We built Gestor Pro to automate the entire financial back-office with AI — from invoice ingestion to tax compliance to executive reporting.

---

## What It Does

Gestor Pro is a full-stack financial platform with six core modules:

**1. Invoice Scanner** — Upload a PDF, JPG, or PNG invoice. The system extracts every field (vendor NIF, amounts, IVA rate, IRPF) using a multi-step AI pipeline, validates the data deterministically, auto-repairs errors with a second LLM call, and books the entry directly into the accounting ledger. No manual data entry.

**2. VeriFactu Compliance Copilot** — Upload any invoice and receive an instant compliance score (0–100) against Spain's 10 VeriFactu 2025 rules (RD 1007/2023). The engine flags exact violations, suggests fixes, and generates a corrected XML file in the AEAT VeriFactu 1.0 schema — ready for submission.

**3. AI Financial Assistant** — A conversational agent with live access to the accounting database. Ask "How much IVA do I owe this quarter?" and it calls the real ledger, runs the calculation, and answers with exact figures. Every tool call is logged and shown inline so the reasoning is transparent.

**4. CFO Report** — On demand, the system reads the full ledger, runs a cashflow forecast model, and sends structured data to GPT-4o which writes a 4-paragraph executive narrative in Spanish — the kind of analysis a CFO would present to a board. Historical + 3-month forward projection, risk assessment, and concrete action items.

**5. Gmail Invoice Ingestion** — Connects via Google OAuth to automatically scan the inbox for invoices, extract attachments, and parse them through the same AI pipeline. Invoices arrive in Gmail and land in the ledger without touching the keyboard.

**6. Financial Dashboard** — Real-time KPIs (Revenue, Expenses, VAT Payable, Net Profit), cash position with receivables vs payables bars, and a full ledger with payment status — all pulled live from the database.

---

## Why the Data Is Credible

This is not a chatbot guessing at numbers. Every financial figure comes from a structured SQLite ledger with typed fields — amounts, dates, VAT rates, payment states. The AI does not generate financial data; it reads verified records and reasons over them.

The architecture enforces this separation:

- **Deterministic layer** — validation rules, tax calculations, totals consistency, NIF format checks. These run in pure Python, no AI involved.
- **AI layer** — reads the deterministic output and produces human-readable analysis. If the underlying ledger data changes, every report and conversation automatically reflects reality.
- **MCP tool layer** — the chat agent cannot fabricate numbers because it has no parametric knowledge of the user's books. It must call `get_ledger_summary` or `filter_ledger` and return what the database says.

The VeriFactu compliance engine implements 10 specific rules from RD 1007/2023 with exact arithmetic checks — it tells you which field is wrong, why, and what the correct value should be.

---

## The Tech Stack

| Layer | Technology |
|---|---|
| **Backend API** | FastAPI (Python) + Uvicorn ASGI |
| **Database** | SQLite via SQLAlchemy ORM |
| **AI Models** | GPT-4o (reasoning, narratives), GPT-4o-mini (extraction, repair) |
| **Agent Framework** | MCP (Model Context Protocol) — 6 tools over stdio transport |
| **OCR** | Tesseract (primary) + GPT-4o Vision (fallback for images) |
| **PDF Parsing** | pdfplumber |
| **Frontend** | React + Vite (Lovable-built) + Tailwind CSS |
| **Routing / Auth** | react-router-dom, Google OAuth 2.0 |
| **Infrastructure** | Ubuntu (Hetzner), Nginx reverse proxy, PM2 process manager |
| **Email Integration** | Google Gmail API |

---

## The Pipelines

### Invoice Extraction Pipeline (5 steps)

```
Upload (PDF/Image)
    ↓
1. TEXT EXTRACTION
   PDF → pdfplumber
   Image → Tesseract OCR (Spanish language model)
         → GPT-4o Vision if OCR confidence low
    ↓
2. LLM EXTRACTION
   PDF text → GPT-4o-mini  (fast, cheap)
   Image    → GPT-4o        (multimodal)
   Extracts: invoice number, date, vendor NIF, amounts,
             IVA rate, IRPF rate, totals, currency
    ↓
3. DETERMINISTIC VALIDATION
   • Date format (ISO 8601)
   • NIF regex (8 digits + letter)
   • IVA rate must be in {0, 4, 10, 21}%
   • IRPF rate must be in {0, 7, 15, 19}%
   • Total = base + IVA − IRPF (arithmetic check)
    ↓
4. REPAIR LOOP (if errors)
   → Second GPT-4o-mini call with error context
   → Re-validates output
   → Marks repair_attempted, repair_succeeded
    ↓
5. CLASSIFICATION (deterministic)
   tipo: ingreso / gasto (keyword matching + IRPF heuristic)
   categoria: software / viaje / material / formacion /
              cuota_ss / servicios
   deducible: true/false
    ↓
OUTPUT → LedgerEntry saved to database
```

### Chat Agent Loop

```
User message
    ↓
GPT-4o receives: system prompt + conversation history
                 + 6 MCP tool schemas
    ↓
Model decides which tools to call (or none)
    ↓
Tool calls dispatched to MCP server (subprocess, stdio)
MCP queries SQLite and returns structured JSON
    ↓
Results injected back into conversation
    ↓
Model synthesizes final response
    ↓
Repeats up to 5 iterations (multi-step reasoning)
    ↓
Response + tool_calls log returned to frontend
```

**Available tools:** `get_ledger_summary`, `filter_ledger`, `simulate_tax`, `forecast_cashflow`, `validate_invoice`, `generate_verifactu_xml`

### VeriFactu Compliance Check

```
Invoice upload
    ↓
Same 4-step extraction pipeline (above)
    ↓
10-rule validation engine (RD 1007/2023):
  VF-001  Vendor NIF format
  VF-002  Invoice number present
  VF-003  Date format ISO 8601
  VF-004  Base amount positive
  VF-005  IVA rate legal value
  VF-006  IVA arithmetic (base × rate = cuota)
  VF-007  Total arithmetic (base + IVA − IRPF)
  VF-008  Concept description length
  VF-009  Client NIF required if total > €3,000
  VF-010  Currency code valid
    ↓
Scoring:
  No violations         → compliant (100)
  Warnings only         → minor_violations (≥70)
  Errors present        → major_violations (0–69)
    ↓
Auto-fix pass (recalculates IVA cuota + total if valid base)
    ↓
GPT-4o generates compliance narrative
    ↓
AEAT VeriFactu 1.0 XML generated
    ↓
OUTPUT: score, violations, narrative, downloadable XML
```

### CFO Report Generation

```
Button click
    ↓
Load full ledger from database
Group by year-month → historical monthly P&L
    ↓
Forecast model (deterministic):
  Method: rolling average or trend analysis
  Horizon: 3 months forward
  Risk: low / medium / high
  (based on frequency of negative net months)
    ↓
GPT-4o call:
  Input: historical data + forecast + risk reason
  Prompt: "You are CFO. Write 4-paragraph
           executive summary for board. Spanish."
  Output: narrative (200–300 words)
    ↓
OUTPUT: KPIs + forecast + risk flags +
        action items + full narrative
```

---

## Regulatory Context

Spain's **VeriFactu regulation (RD 1007/2023)** requires businesses to use certified invoicing software that maintains tamper-proof hash chains of all invoices. The mandatory dates: corporations by 2027-01-01, autónomos by 2027-07-01. AEAT's production environment is live as of April 2025.

Gestor Pro implements the field-level validation layer of VeriFactu compliance. Full certification requires hash chaining and e-signature infrastructure — this platform gives autónomos a compliance readiness tool and AEAT-schema XML output ahead of that deadline.

---

## Current State

The platform is live at **http://204.168.140.34** running on a Hetzner cloud server. Backend API, AI pipelines, and all six frontend modules are operational. The system uses demo ledger data seeded with a realistic Q1 2025 Spanish autónomo P&L (€19,200 revenue, ~€2,500 expenses, ~€3,500 IVA payable).

AI features (invoice extraction, compliance analysis, CFO narrative, chat agent) require OpenAI API credits. All financial calculation, validation, and data display logic runs independently of the AI layer.

---

*Built with FastAPI · GPT-4o · MCP · React · Nginx · SQLite*
