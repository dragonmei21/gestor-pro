"""
Multi-step invoice extraction + repair loop.
Step 1: Text extraction (pdfplumber for PDF, OCR/vision for images)
Step 2: gpt-4o-mini extraction → structured JSON
Step 3: Python validation (totals, IVA rate, date, NIF)
Step 4: If errors → gpt-4o-mini repair call with error context
Step 5: Deterministic classification (tipo, categoria, deducible)
"""
import os
import io
import json
import base64
import re
from datetime import datetime

import openai
from dotenv import load_dotenv

load_dotenv()

EXTRACTION_PROMPT = """Extract invoice data from the text below and return ONLY valid JSON.

Required fields:
- numero_factura: string
- fecha_emision: string (YYYY-MM-DD format)
- proveedor_nombre: string
- proveedor_nif: string (Spanish NIF/CIF)
- cliente_nombre: string or null
- cliente_nif: string or null
- concepto: string (description of service/goods)
- base_imponible: number (tax base, without IVA)
- iva_porcentaje: number (0, 4, 10, or 21)
- iva_cuota: number (IVA amount)
- irpf_porcentaje: number (0, 7, 15, or 19)
- irpf_retencion: number (IRPF amount, positive number)
- total: number (final amount)
- moneda: string (default "EUR")

Return ONLY the JSON object. No explanation, no markdown, no code blocks.

Invoice text:
{text}"""

REPAIR_PROMPT = """The invoice extraction has validation errors. Fix them and return corrected JSON.

Original extraction:
{original_json}

Validation errors found:
{errors}

Return ONLY the corrected JSON object. Fix all errors listed above. No explanation, no markdown."""

VISION_PROMPT = """Extract all invoice data from this image and return ONLY valid JSON.

Required fields:
- numero_factura: string
- fecha_emision: string (YYYY-MM-DD format)
- proveedor_nombre: string
- proveedor_nif: string (Spanish NIF/CIF)
- cliente_nombre: string or null
- cliente_nif: string or null
- concepto: string (description of service/goods)
- base_imponible: number (tax base, without IVA)
- iva_porcentaje: number (0, 4, 10, or 21)
- iva_cuota: number (IVA amount)
- irpf_porcentaje: number (0, 7, 15, or 19)
- irpf_retencion: number (IRPF amount, positive number)
- total: number (final amount)
- moneda: string (default "EUR")

Return ONLY the JSON object. No explanation, no markdown, no code blocks."""


# ── text extraction ────────────────────────────────────────────────────────────

def extract_pdf_text(file_bytes: bytes) -> str:
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
        return "\n".join(pages).strip()
    except Exception as e:
        return f"[PDF extraction failed: {e}]"


def extract_image_text(file_bytes: bytes, filename: str) -> tuple[str, bool]:
    """Returns (text, used_vision). Tries Tesseract first, falls back to GPT-4o vision."""
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(io.BytesIO(file_bytes))
        text = pytesseract.image_to_string(img, lang="spa")
        if len(text.strip()) > 50:
            return text.strip(), False
    except Exception:
        pass
    # Fall back to vision — return empty string and signal to use multimodal
    return "", True


# ── validation ─────────────────────────────────────────────────────────────────

VALID_IVA_RATES  = {0, 4, 10, 21}
VALID_IRPF_RATES = {0, 7, 15, 19}


def validate_extraction(data: dict) -> list[str]:
    errors = []

    # Date format
    fecha = data.get("fecha_emision")
    if not fecha:
        errors.append("fecha_emision is missing")
    else:
        try:
            datetime.strptime(str(fecha), "%Y-%m-%d")
        except ValueError:
            errors.append(f"fecha_emision '{fecha}' is not in YYYY-MM-DD format")

    # NIF format
    nif = str(data.get("proveedor_nif") or "")
    if not re.match(r'^[A-Z0-9]\d{7}[A-Z0-9]$', nif):
        errors.append(f"proveedor_nif '{nif}' has invalid format (expected e.g. 12345678A)")

    # IVA rate
    try:
        iva_rate = float(data.get("iva_porcentaje", -1))
        if iva_rate not in VALID_IVA_RATES:
            errors.append(f"iva_porcentaje {iva_rate} is not valid (must be 0, 4, 10, or 21)")
    except (TypeError, ValueError):
        errors.append("iva_porcentaje is not a number")

    # IRPF rate
    try:
        irpf_rate = float(data.get("irpf_porcentaje", 0))
        if irpf_rate not in VALID_IRPF_RATES:
            errors.append(f"irpf_porcentaje {irpf_rate} is not valid (must be 0, 7, 15, or 19)")
    except (TypeError, ValueError):
        errors.append("irpf_porcentaje is not a number")

    # Totals consistency
    try:
        base  = float(data.get("base_imponible", 0))
        iva   = float(data.get("iva_cuota", 0))
        irpf  = float(data.get("irpf_retencion", 0))
        total = float(data.get("total", 0))
        expected_iva   = round(base * float(data.get("iva_porcentaje", 0)) / 100, 2)
        expected_total = round(base + iva - irpf, 2)
        if abs(iva - expected_iva) > 0.05:
            errors.append(f"iva_cuota {iva} doesn't match base×rate ({expected_iva})")
        if abs(total - expected_total) > 0.05:
            errors.append(f"total {total} doesn't match base+iva-irpf ({expected_total})")
        if base <= 0:
            errors.append("base_imponible must be positive")
    except (TypeError, ValueError):
        errors.append("Numeric fields (base_imponible, iva_cuota, total) are not valid numbers")

    return errors


# ── deterministic classification ───────────────────────────────────────────────

GASTO_KEYWORDS = ["adobe", "ovh", "github", "renfe", "iberia", "staples", "seguridad social",
                  "hosting", "suscripción", "licencia", "alquiler", "coworking", "udemy",
                  "jetbrains", "notion", "figma", "mapfre", "gestoría", "asesoría"]

SOFTWARE_KEYWORDS = ["adobe", "github", "hosting", "ovh", "suscripción", "licencia",
                     "jetbrains", "notion", "figma", "software", "saas", "cloud"]

VIAJE_KEYWORDS = ["renfe", "iberia", "vueling", "taxi", "hotel", "desplazamiento", "viaje", "tren", "avión"]

MATERIAL_KEYWORDS = ["material", "staples", "impresora", "tóner", "papel", "oficina"]

FORMACION_KEYWORDS = ["udemy", "coursera", "formación", "curso", "training", "bootcamp"]


def classify_tipo(data: dict) -> str:
    concepto    = (data.get("concepto") or "").lower()
    contraparte = (data.get("proveedor_nombre") or "").lower()
    text = concepto + " " + contraparte
    if any(kw in text for kw in GASTO_KEYWORDS):
        return "gasto"
    # If there's IRPF retention it's likely an ingreso (service invoice)
    if float(data.get("irpf_retencion", 0)) > 0:
        return "ingreso"
    return "gasto"


def classify_categoria(data: dict) -> str:
    concepto    = (data.get("concepto") or "").lower()
    contraparte = (data.get("proveedor_nombre") or "").lower()
    text = concepto + " " + contraparte
    if any(kw in text for kw in SOFTWARE_KEYWORDS):
        return "software"
    if any(kw in text for kw in VIAJE_KEYWORDS):
        return "viaje"
    if any(kw in text for kw in MATERIAL_KEYWORDS):
        return "material"
    if any(kw in text for kw in FORMACION_KEYWORDS):
        return "formacion"
    if "seguridad social" in text or "cuota autónomo" in text:
        return "cuota_ss"
    return "servicios"


def is_deducible(data: dict) -> bool:
    categoria = classify_categoria(data)
    # Personal expenses are not deductible
    non_deductible = {"personal", "multa", "sancion"}
    return categoria not in non_deductible


# ── main parse function ────────────────────────────────────────────────────────

async def parse_invoice(file_bytes: bytes, filename: str) -> dict:
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    ext = filename.lower().split(".")[-1]
    use_vision = False
    raw_text = ""

    # Step 1: Extract text
    if ext == "pdf":
        raw_text = extract_pdf_text(file_bytes)
    else:
        raw_text, use_vision = extract_image_text(file_bytes, filename)

    # Step 2: LLM extraction
    extracted = {}
    try:
        if use_vision or (not raw_text and ext in {"jpg", "jpeg", "png", "webp"}):
            # Multimodal path — send image directly to gpt-4o
            b64 = base64.b64encode(file_bytes).decode()
            mime = "image/jpeg" if ext in {"jpg", "jpeg"} else f"image/{ext}"
            response = client.chat.completions.create(
                model="gpt-4o",
                max_tokens=1000,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text",  "text": VISION_PROMPT},
                        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
                    ]
                }]
            )
            extraction_model = "gpt-4o"
        else:
            # Text path — cheaper gpt-4o-mini
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=1000,
                messages=[{"role": "user", "content": EXTRACTION_PROMPT.format(text=raw_text)}]
            )
            extraction_model = "gpt-4o-mini"

        raw_json = response.choices[0].message.content.strip()
        # Strip markdown code fences if model added them
        if raw_json.startswith("```"):
            raw_json = re.sub(r"^```[a-z]*\n?", "", raw_json)
            raw_json = re.sub(r"\n?```$", "", raw_json)
        extracted = json.loads(raw_json)

    except (json.JSONDecodeError, Exception) as e:
        # Return a best-effort empty result so the endpoint doesn't crash
        extracted = {
            "numero_factura": None, "fecha_emision": None,
            "proveedor_nombre": "Error en extracción", "proveedor_nif": "",
            "cliente_nombre": None, "cliente_nif": None,
            "concepto": str(e), "base_imponible": 0,
            "iva_porcentaje": 21, "iva_cuota": 0,
            "irpf_porcentaje": 0, "irpf_retencion": 0,
            "total": 0, "moneda": "EUR",
        }
        extraction_model = "gpt-4o-mini"

    # Step 3: Validate
    errors = validate_extraction(extracted)

    # Step 4: Repair if needed
    repair_attempted = False
    repair_succeeded = None

    if errors:
        repair_attempted = True
        try:
            repair_response = client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=1000,
                messages=[{"role": "user", "content": REPAIR_PROMPT.format(
                    original_json=json.dumps(extracted, indent=2, ensure_ascii=False),
                    errors="\n".join(f"- {e}" for e in errors)
                )}]
            )
            repaired_raw = repair_response.choices[0].message.content.strip()
            if repaired_raw.startswith("```"):
                repaired_raw = re.sub(r"^```[a-z]*\n?", "", repaired_raw)
                repaired_raw = re.sub(r"\n?```$", "", repaired_raw)
            extracted = json.loads(repaired_raw)
            errors = validate_extraction(extracted)
            repair_succeeded = len(errors) == 0
        except Exception:
            repair_succeeded = False

    # Step 5: Deterministic classification
    extracted["tipo"]      = classify_tipo(extracted)
    extracted["categoria"] = classify_categoria(extracted)
    extracted["deducible"] = is_deducible(extracted)

    return {
        **extracted,
        "raw_text":          raw_text,
        "validation_passed": len(errors) == 0,
        "validation_errors": errors,
        "repair_attempted":  repair_attempted,
        "repair_succeeded":  repair_succeeded,
        "extraction_model":  extraction_model,
    }
