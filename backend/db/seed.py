"""Seed demo data — run with: python -m db.seed (from backend/) or python -m backend.db.seed (from project root)"""
import sys
import os

# Support running from either project root or backend/
_here = os.path.dirname(os.path.abspath(__file__))
_backend_dir = os.path.dirname(_here)
_project_dir = os.path.dirname(_backend_dir)
for _p in (_backend_dir, _project_dir):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from datetime import date
try:
    from db.database import engine, SessionLocal
    from db.models import Base, User, LedgerEntry
except ModuleNotFoundError:
    from backend.db.database import engine, SessionLocal
    from backend.db.models import Base, User, LedgerEntry

DEMO_LEDGER = [
    # Ingresos Q1 2025
    {"fecha": date(2025, 1, 15), "concepto": "Desarrollo web - Cliente A", "contraparte": "Empresa Digital SL",
     "tipo": "ingreso", "categoria": "servicios", "base_imponible": 4000, "iva": 840, "irpf": -600, "total": 4240,
     "estado_pago": "pagado", "fecha_pago": date(2025, 1, 20), "metodo_pago": "transferencia",
     "trimestre": "2025-Q1", "ejercicio": 2025},
    {"fecha": date(2025, 1, 28), "concepto": "Consultoría estratégica", "contraparte": "StartupBCN",
     "tipo": "ingreso", "categoria": "servicios", "base_imponible": 2500, "iva": 525, "irpf": -375, "total": 2650,
     "estado_pago": "pagado", "fecha_pago": date(2025, 2, 5), "metodo_pago": "transferencia",
     "trimestre": "2025-Q1", "ejercicio": 2025},
    {"fecha": date(2025, 2, 10), "concepto": "Proyecto UX/UI - Fase 2", "contraparte": "Empresa Digital SL",
     "tipo": "ingreso", "categoria": "servicios", "base_imponible": 3200, "iva": 672, "irpf": -480, "total": 3392,
     "estado_pago": "pagado", "fecha_pago": date(2025, 2, 18), "metodo_pago": "transferencia",
     "trimestre": "2025-Q1", "ejercicio": 2025},
    {"fecha": date(2025, 2, 20), "concepto": "Mantenimiento mensual", "contraparte": "RetailTech SL",
     "tipo": "ingreso", "categoria": "servicios", "base_imponible": 1200, "iva": 252, "irpf": -180, "total": 1272,
     "estado_pago": "pagado", "fecha_pago": date(2025, 3, 1), "metodo_pago": "transferencia",
     "trimestre": "2025-Q1", "ejercicio": 2025},
    {"fecha": date(2025, 3, 5), "concepto": "Auditoría de seguridad", "contraparte": "FinanceGroup SA",
     "tipo": "ingreso", "categoria": "servicios", "base_imponible": 5500, "iva": 1155, "irpf": -825, "total": 5830,
     "estado_pago": "pendiente", "fecha_pago": None, "metodo_pago": None,
     "trimestre": "2025-Q1", "ejercicio": 2025},
    {"fecha": date(2025, 3, 18), "concepto": "Formación interna equipos", "contraparte": "TechCorp Madrid",
     "tipo": "ingreso", "categoria": "servicios", "base_imponible": 2800, "iva": 588, "irpf": -420, "total": 2968,
     "estado_pago": "pendiente", "fecha_pago": None, "metodo_pago": None,
     "trimestre": "2025-Q1", "ejercicio": 2025},
    # Gastos Q1 2025
    {"fecha": date(2025, 1, 2), "concepto": "Cuota autónomo SS", "contraparte": "Seguridad Social",
     "tipo": "gasto", "categoria": "cuota_ss", "base_imponible": 320, "iva": 0, "irpf": 0, "total": 320,
     "estado_pago": "pagado", "fecha_pago": date(2025, 1, 2), "metodo_pago": "transferencia",
     "trimestre": "2025-Q1", "ejercicio": 2025},
    {"fecha": date(2025, 1, 5), "concepto": "Suscripción Adobe Creative", "contraparte": "Adobe Systems",
     "tipo": "gasto", "categoria": "software", "base_imponible": 54.95, "iva": 11.54, "irpf": 0, "total": 66.49,
     "estado_pago": "pagado", "fecha_pago": date(2025, 1, 5), "metodo_pago": "tarjeta",
     "trimestre": "2025-Q1", "ejercicio": 2025},
    {"fecha": date(2025, 1, 10), "concepto": "Material oficina", "contraparte": "Staples España",
     "tipo": "gasto", "categoria": "material", "base_imponible": 145, "iva": 30.45, "irpf": 0, "total": 175.45,
     "estado_pago": "pagado", "fecha_pago": date(2025, 1, 10), "metodo_pago": "tarjeta",
     "trimestre": "2025-Q1", "ejercicio": 2025},
    {"fecha": date(2025, 2, 1), "concepto": "Hosting + dominios", "contraparte": "OVH SAS",
     "tipo": "gasto", "categoria": "software", "base_imponible": 89, "iva": 18.69, "irpf": 0, "total": 107.69,
     "estado_pago": "pagado", "fecha_pago": date(2025, 2, 1), "metodo_pago": "tarjeta",
     "trimestre": "2025-Q1", "ejercicio": 2025},
    {"fecha": date(2025, 2, 2), "concepto": "Cuota autónomo SS", "contraparte": "Seguridad Social",
     "tipo": "gasto", "categoria": "cuota_ss", "base_imponible": 320, "iva": 0, "irpf": 0, "total": 320,
     "estado_pago": "pagado", "fecha_pago": date(2025, 2, 2), "metodo_pago": "transferencia",
     "trimestre": "2025-Q1", "ejercicio": 2025},
    {"fecha": date(2025, 2, 15), "concepto": "Desplazamiento cliente Madrid", "contraparte": "Renfe",
     "tipo": "gasto", "categoria": "viaje", "base_imponible": 112, "iva": 11.2, "irpf": 0, "total": 123.2,
     "estado_pago": "pagado", "fecha_pago": date(2025, 2, 15), "metodo_pago": "tarjeta",
     "trimestre": "2025-Q1", "ejercicio": 2025},
    {"fecha": date(2025, 2, 20), "concepto": "Suscripción GitHub Teams", "contraparte": "GitHub Inc",
     "tipo": "gasto", "categoria": "software", "base_imponible": 42, "iva": 8.82, "irpf": 0, "total": 50.82,
     "estado_pago": "pagado", "fecha_pago": date(2025, 2, 20), "metodo_pago": "tarjeta",
     "trimestre": "2025-Q1", "ejercicio": 2025},
    {"fecha": date(2025, 3, 2), "concepto": "Cuota autónomo SS", "contraparte": "Seguridad Social",
     "tipo": "gasto", "categoria": "cuota_ss", "base_imponible": 320, "iva": 0, "irpf": 0, "total": 320,
     "estado_pago": "pagado", "fecha_pago": date(2025, 3, 2), "metodo_pago": "transferencia",
     "trimestre": "2025-Q1", "ejercicio": 2025},
    {"fecha": date(2025, 3, 8), "concepto": "Alquiler coworking marzo", "contraparte": "WeWork BCN",
     "tipo": "gasto", "categoria": "oficina", "base_imponible": 450, "iva": 94.5, "irpf": 0, "total": 544.5,
     "estado_pago": "pagado", "fecha_pago": date(2025, 3, 8), "metodo_pago": "transferencia",
     "trimestre": "2025-Q1", "ejercicio": 2025},
    {"fecha": date(2025, 3, 12), "concepto": "Formación online Python avanzado", "contraparte": "Udemy",
     "tipo": "gasto", "categoria": "formacion", "base_imponible": 29.99, "iva": 6.3, "irpf": 0, "total": 36.29,
     "estado_pago": "pagado", "fecha_pago": date(2025, 3, 12), "metodo_pago": "tarjeta",
     "trimestre": "2025-Q1", "ejercicio": 2025},
    {"fecha": date(2025, 3, 15), "concepto": "Asesoría fiscal Q1", "contraparte": "Gestoría Pérez & Assoc",
     "tipo": "gasto", "categoria": "servicios", "base_imponible": 250, "iva": 52.5, "irpf": 0, "total": 302.5,
     "estado_pago": "pendiente", "fecha_pago": None, "metodo_pago": None,
     "trimestre": "2025-Q1", "ejercicio": 2025},
    {"fecha": date(2025, 1, 18), "concepto": "Suscripción Notion + Figma", "contraparte": "SaaS Tools Bundle",
     "tipo": "gasto", "categoria": "software", "base_imponible": 35, "iva": 7.35, "irpf": 0, "total": 42.35,
     "estado_pago": "pagado", "fecha_pago": date(2025, 1, 18), "metodo_pago": "tarjeta",
     "trimestre": "2025-Q1", "ejercicio": 2025},
    {"fecha": date(2025, 2, 28), "concepto": "Comida cliente - reunión proyecto", "contraparte": "Restaurant La Boqueria",
     "tipo": "gasto", "categoria": "representacion", "base_imponible": 87.5, "iva": 9.62, "irpf": 0, "total": 97.12,
     "estado_pago": "pagado", "fecha_pago": date(2025, 2, 28), "metodo_pago": "tarjeta",
     "trimestre": "2025-Q1", "ejercicio": 2025},
    {"fecha": date(2025, 3, 20), "concepto": "Licencia Jetbrains IDE", "contraparte": "JetBrains s.r.o.",
     "tipo": "gasto", "categoria": "software", "base_imponible": 249, "iva": 52.29, "irpf": 0, "total": 301.29,
     "estado_pago": "vencido", "fecha_pago": None, "metodo_pago": None,
     "trimestre": "2025-Q1", "ejercicio": 2025},
    {"fecha": date(2025, 1, 25), "concepto": "Seguro responsabilidad civil", "contraparte": "Mapfre Seguros",
     "tipo": "gasto", "categoria": "seguros", "base_imponible": 180, "iva": 0, "irpf": 0, "total": 180,
     "estado_pago": "pagado", "fecha_pago": date(2025, 1, 25), "metodo_pago": "transferencia",
     "trimestre": "2025-Q1", "ejercicio": 2025},
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        force = os.getenv("FORCE_SEED", "false").lower() == "true"
        if force:
            db.query(LedgerEntry).delete()
            db.query(User).delete()
            db.commit()
        else:
            # Skip if already seeded
            if db.query(User).count() > 0:
                print("DB already seeded. Skipping.")
                return

        user = User(
            nombre="Demo Autónomo",
            nif="12345678A",
            actividad="Consultoría IT",
            regimen_iva="general",
            trimestre_act="2025-Q1",
        )
        db.add(user)
        db.flush()

        for entry_data in DEMO_LEDGER:
            entry = LedgerEntry(user_id=user.id, **entry_data)
            db.add(entry)

        db.commit()
        count = db.query(LedgerEntry).count()
        print(f"Seeded 1 user + {count} ledger entries OK")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
