# Database Schema — Gestor Pro

> Stack: SQLite (dev) → Postgres (prod). SQLAlchemy ORM.
> File: `backend/db/models.py`

---

## Tables Overview

```
users              — single demo user (skip auth for prototype)
invoices           — every invoice ever parsed (raw + extracted)
ledger_entries     — AP/AR double-entry style ledger
compliance_reports — VeriFactu check results per invoice
cfo_reports        — generated CFO narratives + chart data
```

---

## Table: `users`

Single hardcoded demo user. No auth needed for prototype.

```python
class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    nombre        = Column(String, default="Demo Autónomo")
    nif           = Column(String, default="12345678A")
    actividad     = Column(String, default="Consultoría IT")  # epígrafe IAE
    regimen_iva   = Column(String, default="general")         # general | simplificado | recargo
    trimestre_act = Column(String, default="2025-Q1")
    created_at    = Column(DateTime, default=datetime.utcnow)

    invoices      = relationship("Invoice", back_populates="user")
    ledger_entries = relationship("LedgerEntry", back_populates="user")
```

---

## Table: `invoices`

Stores every invoice uploaded, both raw extraction and validated result.

```python
class Invoice(Base):
    __tablename__ = "invoices"

    id                  = Column(Integer, primary_key=True, index=True)
    user_id             = Column(Integer, ForeignKey("users.id"))

    # File metadata
    filename            = Column(String)
    file_type           = Column(String)   # pdf | jpg | png
    raw_text            = Column(Text)     # OCR / pdfplumber output

    # Extracted fields (from LLM step 1)
    numero_factura      = Column(String)
    fecha_emision       = Column(Date)
    fecha_vencimiento   = Column(Date, nullable=True)
    proveedor_nombre    = Column(String)
    proveedor_nif       = Column(String)
    cliente_nombre      = Column(String, nullable=True)
    cliente_nif         = Column(String, nullable=True)
    concepto            = Column(Text)
    base_imponible      = Column(Float)
    iva_porcentaje      = Column(Float)    # 0, 4, 10, or 21
    iva_cuota           = Column(Float)
    irpf_porcentaje     = Column(Float)    # 0, 7, 15, 19
    irpf_retencion      = Column(Float)
    total               = Column(Float)
    moneda              = Column(String, default="EUR")

    # Classification (deterministic post-LLM)
    tipo                = Column(String)   # ingreso | gasto
    categoria           = Column(String)   # servicios | material | software | viaje | otro
    deducible           = Column(Boolean, default=True)

    # Validation metadata
    extraction_model    = Column(String)   # claude-haiku-4-5
    validation_passed   = Column(Boolean)
    validation_errors   = Column(JSON, default=list)   # list of error strings
    repair_attempted    = Column(Boolean, default=False)
    repair_succeeded    = Column(Boolean, nullable=True)

    # VeriFactu compliance
    verifactu_score     = Column(Integer, nullable=True)   # 0-100
    verifactu_status    = Column(String, nullable=True)    # compliant | violations | unchecked

    created_at          = Column(DateTime, default=datetime.utcnow)

    user                = relationship("User", back_populates="invoices")
    ledger_entry        = relationship("LedgerEntry", back_populates="invoice", uselist=False)
    compliance_report   = relationship("ComplianceReport", back_populates="invoice", uselist=False)
```

---

## Table: `ledger_entries`

AP/AR ledger — one entry per invoice, enriched with payment status.

```python
class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"))
    invoice_id      = Column(Integer, ForeignKey("invoices.id"), nullable=True)

    # Core fields
    fecha           = Column(Date)
    concepto        = Column(String)
    contraparte     = Column(String)   # proveedor or client name
    tipo            = Column(String)   # ingreso | gasto
    categoria       = Column(String)

    # Amounts
    base_imponible  = Column(Float)
    iva             = Column(Float)
    irpf            = Column(Float)
    total           = Column(Float)

    # Payment tracking
    estado_pago     = Column(String, default="pendiente")  # pendiente | pagado | vencido
    fecha_pago      = Column(Date, nullable=True)
    metodo_pago     = Column(String, nullable=True)        # transferencia | tarjeta | efectivo

    # Period
    trimestre       = Column(String)   # e.g. "2025-Q1"
    ejercicio       = Column(Integer)  # e.g. 2025

    created_at      = Column(DateTime, default=datetime.utcnow)

    user            = relationship("User", back_populates="ledger_entries")
    invoice         = relationship("Invoice", back_populates="ledger_entry")
```

---

## Table: `compliance_reports`

Stores VeriFactu compliance check results. One per invoice check.

```python
class ComplianceReport(Base):
    __tablename__ = "compliance_reports"

    id                  = Column(Integer, primary_key=True, index=True)
    invoice_id          = Column(Integer, ForeignKey("invoices.id"))

    # Score
    compliance_score    = Column(Integer)          # 0-100
    status              = Column(String)           # compliant | minor_violations | major_violations

    # Violations (list of violation objects)
    violations          = Column(JSON, default=list)
    # Each violation: { "field": str, "rule": str, "severity": "error"|"warning", "fix": str }

    # Generated output
    corrected_xml       = Column(Text, nullable=True)    # VeriFactu-compliant XML
    agent_narrative     = Column(Text)                   # Claude's plain-Spanish explanation

    # Model metadata
    model_used          = Column(String, default="claude-sonnet-4-6")
    tool_calls_made     = Column(Integer)                # how many MCP tool calls agent made
    processing_time_ms  = Column(Integer)

    created_at          = Column(DateTime, default=datetime.utcnow)

    invoice             = relationship("Invoice", back_populates="compliance_report")
```

---

## Table: `cfo_reports`

Stores generated CFO narratives and the underlying chart data.

```python
class CFOReport(Base):
    __tablename__ = "cfo_reports"

    id                  = Column(Integer, primary_key=True, index=True)
    user_id             = Column(Integer, ForeignKey("users.id"))

    # Period covered
    fecha_inicio        = Column(Date)
    fecha_fin           = Column(Date)
    trimestre           = Column(String)

    # Summary stats (used to generate narrative)
    total_ingresos      = Column(Float)
    total_gastos        = Column(Float)
    beneficio_neto      = Column(Float)
    iva_a_pagar         = Column(Float)
    irpf_retenido       = Column(Float)

    # Forecast data (JSON array for Recharts)
    forecast_data       = Column(JSON)
    # Structure: [{ "mes": "Ene", "ingresos": 5200, "gastos": 3100, "neto": 2100 }, ...]

    # AI outputs
    narrative_es        = Column(Text)     # CFO narrative in Spanish
    risk_flags          = Column(JSON, default=list)   # list of risk strings
    action_items        = Column(JSON, default=list)   # list of recommended actions

    # Model metadata
    model_used          = Column(String, default="claude-sonnet-4-6")
    created_at          = Column(DateTime, default=datetime.utcnow)
```

---

## Relationships Diagram

```
User
 ├── invoices[]         → Invoice
 │     ├── ledger_entry → LedgerEntry
 │     └── compliance_report → ComplianceReport
 └── ledger_entries[]   → LedgerEntry
 └── cfo_reports[]      → CFOReport
```

---

## Seed Data (`db/seed.py`)

Seed with one demo user + 20 ledger entries + 5 invoices spanning 2025-Q1.

```python
DEMO_LEDGER = [
    # Ingresos
    {"fecha": "2025-01-15", "concepto": "Desarrollo web - Cliente A", "contraparte": "Empresa Digital SL",
     "tipo": "ingreso", "categoria": "servicios", "base_imponible": 4000, "iva": 840, "irpf": -600, "total": 4240},
    {"fecha": "2025-01-28", "concepto": "Consultoría estratégica", "contraparte": "StartupBCN",
     "tipo": "ingreso", "categoria": "servicios", "base_imponible": 2500, "iva": 525, "irpf": -375, "total": 2650},
    {"fecha": "2025-02-10", "concepto": "Proyecto UX/UI - Fase 2", "contraparte": "Empresa Digital SL",
     "tipo": "ingreso", "categoria": "servicios", "base_imponible": 3200, "iva": 672, "irpf": -480, "total": 3392},
    {"fecha": "2025-02-20", "concepto": "Mantenimiento mensual", "contraparte": "RetailTech SL",
     "tipo": "ingreso", "categoria": "servicios", "base_imponible": 1200, "iva": 252, "irpf": -180, "total": 1272},
    {"fecha": "2025-03-05", "concepto": "Auditoría de seguridad", "contraparte": "FinanceGroup SA",
     "tipo": "ingreso", "categoria": "servicios", "base_imponible": 5500, "iva": 1155, "irpf": -825, "total": 5830},
    # Gastos
    {"fecha": "2025-01-02", "concepto": "Cuota autónomo SS", "contraparte": "Seguridad Social",
     "tipo": "gasto", "categoria": "cuota_ss", "base_imponible": 320, "iva": 0, "irpf": 0, "total": 320},
    {"fecha": "2025-01-05", "concepto": "Suscripción Adobe Creative", "contraparte": "Adobe Systems",
     "tipo": "gasto", "categoria": "software", "base_imponible": 54.95, "iva": 11.54, "irpf": 0, "total": 66.49},
    {"fecha": "2025-01-10", "concepto": "Material oficina", "contraparte": "Staples España",
     "tipo": "gasto", "categoria": "material", "base_imponible": 145, "iva": 30.45, "irpf": 0, "total": 175.45},
    {"fecha": "2025-02-01", "concepto": "Hosting + dominios", "contraparte": "OVH SAS",
     "tipo": "gasto", "categoria": "software", "base_imponible": 89, "iva": 18.69, "irpf": 0, "total": 107.69},
    {"fecha": "2025-02-15", "concepto": "Desplazamiento cliente Madrid", "contraparte": "Renfe",
     "tipo": "gasto", "categoria": "viaje", "base_imponible": 112, "iva": 11.2, "irpf": 0, "total": 123.2},
    # ... add 10 more entries for realism
]
```

---

## Migration Commands

```bash
# Create tables
python -c "from backend.db.database import engine; from backend.db.models import Base; Base.metadata.create_all(engine)"

# Seed demo data
python -m backend.db.seed

# Verify
sqlite3 gestor.db "SELECT COUNT(*) FROM ledger_entries;"
```
