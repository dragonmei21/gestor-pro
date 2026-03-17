from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    nombre        = Column(String, default="Demo Autónomo")
    nif           = Column(String, default="12345678A")
    actividad     = Column(String, default="Consultoría IT")
    regimen_iva   = Column(String, default="general")
    trimestre_act = Column(String, default="2025-Q1")
    created_at    = Column(DateTime, default=datetime.utcnow)

    invoices       = relationship("Invoice", back_populates="user")
    ledger_entries = relationship("LedgerEntry", back_populates="user")
    cfo_reports    = relationship("CFOReport", back_populates="user")


class Invoice(Base):
    __tablename__ = "invoices"

    id                  = Column(Integer, primary_key=True, index=True)
    user_id             = Column(Integer, ForeignKey("users.id"))

    filename            = Column(String)
    file_type           = Column(String)
    raw_text            = Column(Text)

    numero_factura      = Column(String)
    fecha_emision       = Column(Date)
    fecha_vencimiento   = Column(Date, nullable=True)
    proveedor_nombre    = Column(String)
    proveedor_nif       = Column(String)
    cliente_nombre      = Column(String, nullable=True)
    cliente_nif         = Column(String, nullable=True)
    concepto            = Column(Text)
    base_imponible      = Column(Float)
    iva_porcentaje      = Column(Float)
    iva_cuota           = Column(Float)
    irpf_porcentaje     = Column(Float)
    irpf_retencion      = Column(Float)
    total               = Column(Float)
    moneda              = Column(String, default="EUR")

    tipo                = Column(String)
    categoria           = Column(String)
    deducible           = Column(Boolean, default=True)

    extraction_model    = Column(String)
    validation_passed   = Column(Boolean)
    validation_errors   = Column(JSON, default=list)
    repair_attempted    = Column(Boolean, default=False)
    repair_succeeded    = Column(Boolean, nullable=True)

    verifactu_score     = Column(Integer, nullable=True)
    verifactu_status    = Column(String, nullable=True)

    created_at          = Column(DateTime, default=datetime.utcnow)

    user              = relationship("User", back_populates="invoices")
    ledger_entry      = relationship("LedgerEntry", back_populates="invoice", uselist=False)
    compliance_report = relationship("ComplianceReport", back_populates="invoice", uselist=False)


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"))
    invoice_id      = Column(Integer, ForeignKey("invoices.id"), nullable=True)

    fecha           = Column(Date)
    concepto        = Column(String)
    contraparte     = Column(String)
    tipo            = Column(String)
    categoria       = Column(String)

    base_imponible  = Column(Float)
    iva             = Column(Float)
    irpf            = Column(Float)
    total           = Column(Float)

    estado_pago     = Column(String, default="pendiente")
    fecha_pago      = Column(Date, nullable=True)
    metodo_pago     = Column(String, nullable=True)

    trimestre       = Column(String)
    ejercicio       = Column(Integer)

    created_at      = Column(DateTime, default=datetime.utcnow)

    user    = relationship("User", back_populates="ledger_entries")
    invoice = relationship("Invoice", back_populates="ledger_entry")


class ComplianceReport(Base):
    __tablename__ = "compliance_reports"

    id                  = Column(Integer, primary_key=True, index=True)
    invoice_id          = Column(Integer, ForeignKey("invoices.id"))

    compliance_score    = Column(Integer)
    status              = Column(String)

    violations          = Column(JSON, default=list)
    corrected_xml       = Column(Text, nullable=True)
    agent_narrative     = Column(Text)

    model_used          = Column(String, default="gpt-4o")
    tool_calls_made     = Column(Integer)
    processing_time_ms  = Column(Integer)

    created_at          = Column(DateTime, default=datetime.utcnow)

    invoice = relationship("Invoice", back_populates="compliance_report")


class CFOReport(Base):
    __tablename__ = "cfo_reports"

    id                  = Column(Integer, primary_key=True, index=True)
    user_id             = Column(Integer, ForeignKey("users.id"))

    fecha_inicio        = Column(Date)
    fecha_fin           = Column(Date)
    trimestre           = Column(String)

    total_ingresos      = Column(Float)
    total_gastos        = Column(Float)
    beneficio_neto      = Column(Float)
    iva_a_pagar         = Column(Float)
    irpf_retenido       = Column(Float)

    forecast_data       = Column(JSON)
    narrative_es        = Column(Text)
    risk_flags          = Column(JSON, default=list)
    action_items        = Column(JSON, default=list)

    model_used          = Column(String, default="gpt-4o")
    created_at          = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="cfo_reports")
