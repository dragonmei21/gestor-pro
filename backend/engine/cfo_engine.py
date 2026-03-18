"""
CFO Engine — cashflow forecast + GPT-4o board narrative in Spanish.
"""
import os
import json
from datetime import date

import openai
from dotenv import load_dotenv
from sqlalchemy.orm import Session

from backend.db import models

load_dotenv()

MONTH_NAMES_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun",
                  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

CFO_NARRATIVE_PROMPT = """Eres el CFO de una empresa y debes escribir el resumen financiero mensual para la junta directiva.

Datos financieros del período:
{data}

Escribe un informe ejecutivo en español (máximo 4 párrafos) que incluya:
1. Resumen de resultados del trimestre (usa los números exactos del JSON)
2. Tendencias observadas (positivas y negativas)
3. Proyección para los próximos meses basada en el forecast
4. 2-3 acciones recomendadas concretas

Tono: profesional pero directo. Usa números concretos con símbolo €. Sé honesto sobre los riesgos."""


def _month_name(offset: int) -> str:
    today = date.today()
    month_idx = (today.month - 1 + offset) % 12
    year = today.year + ((today.month - 1 + offset) // 12)
    return f"{MONTH_NAMES_ES[month_idx]} {year}"


class CFOEngine:
    def __init__(self, db: Session):
        self.db = db

    def _load_entries(self):
        return self.db.query(models.LedgerEntry).all()

    def _aggregate_by_month(self, entries) -> list[dict]:
        monthly: dict = {}
        for e in entries:
            key = (e.fecha.year, e.fecha.month)
            if key not in monthly:
                monthly[key] = {"ingresos": 0.0, "gastos": 0.0}
            if e.tipo == "ingreso":
                monthly[key]["ingresos"] += e.base_imponible
            else:
                monthly[key]["gastos"] += e.base_imponible

        result = []
        for (yr, mo) in sorted(monthly.keys()):
            d = monthly[(yr, mo)]
            result.append({
                "mes": f"{MONTH_NAMES_ES[mo - 1]} {yr}",
                "ingresos": round(d["ingresos"], 2),
                "gastos":   round(d["gastos"], 2),
                "neto":     round(d["ingresos"] - d["gastos"], 2),
                "is_forecast": False,
            })
        return result

    async def generate_forecast(self, months: int = 3, method: str = "avg") -> dict:
        entries    = self._load_entries()
        historical = self._aggregate_by_month(entries)

        # Fallback demo data if DB is empty
        if not historical:
            historical = [
                {"mes": "Ene 2025", "ingresos": 6500, "gastos": 2100, "neto": 4400, "is_forecast": False},
                {"mes": "Feb 2025", "ingresos": 4700, "gastos": 1890, "neto": 2810, "is_forecast": False},
                {"mes": "Mar 2025", "ingresos": 5500, "gastos": 2340, "neto": 3160, "is_forecast": False},
            ]

        avg_inc = sum(h["ingresos"] for h in historical) / len(historical)
        avg_exp = sum(h["gastos"]   for h in historical) / len(historical)

        inc_slope = exp_slope = 0.0
        if method == "trend" and len(historical) >= 2:
            inc_vals  = [h["ingresos"] for h in historical]
            exp_vals  = [h["gastos"]   for h in historical]
            inc_slope = (inc_vals[-1] - inc_vals[0]) / max(len(inc_vals) - 1, 1)
            exp_slope = (exp_vals[-1] - exp_vals[0]) / max(len(exp_vals) - 1, 1)

        forecast = []
        for i in range(months):
            proj_inc = max(0, round(avg_inc + inc_slope * (i + 1), 2))
            proj_exp = max(0, round(avg_exp + exp_slope * (i + 1), 2))
            forecast.append({
                "mes":         _month_name(i + 1),
                "ingresos":    proj_inc,
                "gastos":      proj_exp,
                "neto":        round(proj_inc - proj_exp, 2),
                "is_forecast": True,
            })

        netos = [h["neto"] for h in historical]
        neg   = sum(1 for n in netos if n < 0)
        if neg == 0:
            cashflow_risk = "low"
            risk_reason   = "Ingresos estables, sin meses negativos en el histórico."
        elif neg == 1:
            cashflow_risk = "medium"
            risk_reason   = "Un mes con flujo negativo detectado — vigilar liquidez."
        else:
            cashflow_risk = "high"
            risk_reason   = f"{neg} meses con flujo negativo — riesgo de tensión de tesorería."

        return {
            "historical":    historical,
            "forecast":      forecast,
            "cashflow_risk": cashflow_risk,
            "risk_reason":   risk_reason,
            "summary": {
                "avg_monthly_income":  round(avg_inc, 2),
                "avg_monthly_expense": round(avg_exp, 2),
                "avg_monthly_net":     round(avg_inc - avg_exp, 2),
            },
        }

    async def generate_cfo_narrative(self, forecast_data: dict) -> str:
        client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        # Build a clean summary for the prompt
        summary_for_prompt = {
            "resumen_historico": forecast_data.get("historical", []),
            "proyeccion":        forecast_data.get("forecast", []),
            "riesgo_tesoreria":  forecast_data.get("cashflow_risk"),
            "motivo_riesgo":     forecast_data.get("risk_reason"),
            "promedios":         forecast_data.get("summary", {}),
        }

        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                max_tokens=800,
                messages=[{
                    "role": "user",
                    "content": CFO_NARRATIVE_PROMPT.format(
                        data=json.dumps(summary_for_prompt, indent=2, ensure_ascii=False)
                    )
                }]
            )
            return response.choices[0].message.content
        except Exception:
            avg = forecast_data.get("summary", {})
            return (
                f"**Resumen financiero del período**\n\n"
                f"Los datos muestran unos ingresos medios mensuales de {avg.get('avg_monthly_income', 0):,.2f}€ "
                f"y gastos de {avg.get('avg_monthly_expense', 0):,.2f}€, "
                f"con un neto mensual de {avg.get('avg_monthly_net', 0):,.2f}€. "
                f"El análisis narrativo completo no está disponible en este momento. "
                f"Por favor, revisa los datos del gráfico para más detalles."
            )
