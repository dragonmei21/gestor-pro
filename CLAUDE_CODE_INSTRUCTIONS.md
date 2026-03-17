# Claude Code Instructions — Gestor Pro

> Paste this at the start of your Claude Code session.
> It tells Claude Code exactly what to build and in what order.

---

## CLAUDE CODE PROMPT (copy this verbatim)

```
You are building "Gestor Pro" — an AI-powered financial platform for Spanish autónomos and SMEs.
Read all the spec files before writing any code.

Spec files to read first (in this order):
1. GESTOR_PRO_MASTER_PLAN.md     — overall structure and timeline
2. DATABASE_SCHEMA.md            — exact table definitions
3. MCP_SERVER_SPEC.md            — MCP tools + agent loop pattern
4. BACKEND_ENGINE_SPEC.md        — verifactu.py, invoice_parser.py, cfo_engine.py
5. FRONTEND_SPEC.md              — Next.js pages, components, API calls

Key decisions already made — do NOT change these:
- Backend: FastAPI + SQLAlchemy + SQLite
- LLM: Anthropic Claude (claude-haiku-4-5 for extraction, claude-sonnet-4-6 for narratives)
- MCP: Python mcp library, stdio transport
- Frontend: Next.js 14 App Router + Tailwind + shadcn/ui
- Database: SQLite dev, Postgres prod (use DATABASE_URL env var)

Start with this task sequence:
1. Create full directory structure
2. Build db/models.py (exact schema from DATABASE_SCHEMA.md)
3. Build db/database.py + db/seed.py
4. Build engine/verifactu.py (all 10 rules + XML generator)
5. Build mcp_server.py (all 6 tools)
6. Build main.py FastAPI endpoints
7. Build engine/invoice_parser.py (multi-step repair loop)
8. Build engine/cfo_engine.py + narrative generator
9. Build frontend pages in order: layout → dashboard → compliance → chat → cfo → invoices

After each file, run a quick sanity check before moving on.
Use demo/hardcoded data everywhere — we are building a prototype, not production code.
Never put API keys in code — use os.getenv() and .env file.
```

---

## Batch 1: Run These Together

```bash
# After Claude Code creates the files, run these to verify
cd backend
pip install -r requirements.txt

# Create DB tables
python -c "
from db.database import engine
from db.models import Base
Base.metadata.create_all(engine)
print('Tables created OK')
"

# Seed demo data  
python -m db.seed

# Verify
python -c "
from db.database import SessionLocal
from db import models
db = SessionLocal()
print(f'Users: {db.query(models.User).count()}')
print(f'Ledger entries: {db.query(models.LedgerEntry).count()}')
print(f'Invoices: {db.query(models.Invoice).count()}')
"

# Start server
uvicorn main:app --reload --port 8000
```

## Batch 2: Test MCP Tools

```bash
# Test each tool manually
python -c "
import asyncio, json
from mcp_server import validate_invoice

test_invoice = {
    'numero_factura': '2025-001',
    'fecha_emision': '2025-03-15',
    'proveedor_nombre': 'Test SL',
    'proveedor_nif': '12345678A',
    'base_imponible': 1000,
    'iva_porcentaje': 21,
    'iva_cuota': 210,
    'irpf_porcentaje': 15,
    'irpf_retencion': 150,
    'total': 1060,
    'concepto': 'Servicios de consultoría'
}

# Should return compliance_score: 100, status: compliant
result = asyncio.run(validate_invoice('validate_invoice', {'invoice_data': test_invoice}))
print(json.loads(result[0].text))
"
```

## Batch 3: Test Endpoints

```bash
# Test compliance endpoint with a broken invoice PDF
curl -X POST http://localhost:8000/api/compliance/check \
  -F "file=@data/demo_invoices/sample_broken.pdf"

# Test chatbot
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "¿Cuánto IVA debo declarar este trimestre?", "history": []}'

# Test CFO report with demo data
curl -X POST http://localhost:8000/api/cfo/report \
  -F "use_demo=true"
```

---

## VeriFactu Demo Invoice (deliberately broken — use for demo)

Save as `data/demo_invoices/broken_invoice.txt` and have the parser treat as text input:

```
FACTURA
Número: (missing)
Fecha: 15/03/25  <-- wrong format
De: TechConsult
NIF: 1234567     <-- invalid (7 digits, no letter)
Para: Cliente ABC
NIF Cliente: (missing)

Servicios web: 1000.00
IVA 21%: 200.00  <-- WRONG (should be 210)
Total: 1250.00   <-- WRONG (inconsistent)
```

When you run this through the compliance checker:
- VF-001 fires (invalid NIF format)
- VF-002 fires (missing invoice number)  
- VF-003 fires (wrong date format)
- VF-006 fires (IVA amount mismatch)
- VF-007 fires (total inconsistent)
- Score: ~25/100
- Agent generates corrected XML
- This is your best demo moment

---

## Assignment 2-Pager Template

```markdown
# Gestor Pro — Assignment 2 Report

## What We Built
Gestor Pro es una plataforma de operaciones financieras con IA para autónomos y PYMEs españolas. 
Combina dos módulos principales: un Copiloto de Cumplimiento VeriFactu y un módulo de CFO con IA.

## Main Questions Answered

**Question 1: ¿Cómo puede un LLM gestionar un flujo de validación multi-paso?**
Implementamos un pipeline de extracción con bucle de reparación:
- Paso 1: Extracción OCR/PDF → texto
- Paso 2: Claude haiku-4-5 extrae JSON estructurado
- Paso 3: Validación determinista Python (totales, tasas IVA, formato NIF)
- Paso 4: Si hay errores → segunda llamada Claude con contexto de errores → reparación
- Paso 5: Clasificación IVA/IRPF determinista

Esto va más allá de "un prompt → output": hay lógica Python entre llamadas LLM que condiciona la siguiente llamada.

**Question 2: ¿Puede un agente LLM llamar herramientas para responder preguntas financieras?**
El chatbot usa tool-calling de Anthropic. El agente decide qué herramientas llamar:
- get_ledger_summary → obtiene totales reales del trimestre
- filter_ledger → filtra entradas específicas
- simulate_tax → calcula impuestos para cualquier importe
- forecast_cashflow → genera proyecciones

El loop puede hacer hasta 5 iteraciones. Probamos con "¿Cuánto IVA debo este trimestre?" 
→ el agente llama get_ledger_summary, obtiene €2.728, responde con ese número exacto.

**Question 3: ¿Cómo usar un MCP server como capa de herramientas?**
Implementamos un servidor MCP con 6 herramientas. El servidor MCP desacopla la lógica de 
herramientas del agente — se puede extender sin cambiar el código del agente.

## Main Difficulties

**Dificultad 1: El repair loop necesitó prompt engineering**
La primera versión del repair prompt devolvía JSON con markdown backticks, 
rompiendo el JSON.parse(). Solución: añadir "Return ONLY raw JSON, no markdown" 
y envolver en try/catch con fallback a la extracción original.

**Dificultad 2: Tool-calling loop con estado**
El loop de tool-calling requiere mantener el historial de mensajes entre iteraciones 
(incluyendo los bloques tool_result). Documentamos el patrón exacto en MCP_SERVER_SPEC.md.

**Dificultad 3: VeriFactu rules necesitaron investigación**
La documentación oficial de VeriFactu es técnica y extensa. Usamos IA para resumir 
las 10 reglas más críticas e implementarlas como funciones lambda testeables.

## How We Leveraged AI

- **Claude (claude.ai)**: generó los spec files completos (DATABASE_SCHEMA.md, MCP_SERVER_SPEC.md, 
  BACKEND_ENGINE_SPEC.md, FRONTEND_SPEC.md) que usamos como blueprint exacto
- **Claude Code**: implementó el código siguiendo los specs, con checkpoints de revisión
- **claude-haiku-4-5**: extracción de facturas en producción (rápido y barato)
- **claude-sonnet-4-6**: narrativas CFO y agente chatbot (mayor calidad)

El flujo fue: brainstorm con Claude → specs detallados → Claude Code implementa → 
revisión humana en checkpoints → iteración.

## Technical Stack
- Backend: FastAPI + SQLAlchemy + SQLite
- LLM: Anthropic Claude API (haiku-4-5 + sonnet-4-6)
- MCP: Python mcp library (stdio transport)
- RAG: ChromaDB con query rewriting
- Frontend: Next.js 14 + Tailwind + shadcn/ui + Recharts
- Deploy: Railway (backend) + Vercel (frontend)
```

---

## Git Setup

```bash
# .gitignore essentials
echo "
.env
__pycache__/
*.pyc
chroma_db/
gestor.db
node_modules/
.next/
*.egg-info/
" > .gitignore

# Never commit
# - .env files (API keys)
# - gestor.db (SQLite database)
# - chroma_db/ (vector store)
```

---

## Deploy in 10 Minutes

```bash
# Backend → Railway
npm install -g railway
railway login
railway init
railway up   # deploys FastAPI on Railway

# Frontend → Vercel
npm install -g vercel
cd frontend
vercel --prod   # auto-detects Next.js

# Set env vars in Railway dashboard:
# ANTHROPIC_API_KEY = your key
# DATABASE_URL = sqlite:///./gestor.db (or Railway Postgres URL)
```
