# Gmail Integration Spec — Gestor Pro

> File: `backend/engine/gmail_watcher.py`
> Claude Code: read this whole file before writing any code.
> Strategy: DEMO_MODE=true by default (no OAuth needed for demo). Real mode is opt-in.

---

## How it fits into the system

When a user connects Gmail, the app polls their inbox for emails with PDF/image
attachments. Each attachment is routed through `invoice_parser.py` exactly like
a manual upload. The result is saved as an `Invoice` + `LedgerEntry` row in the DB.
The only new part is getting the file bytes from Gmail instead of from a form upload.

```
Gmail inbox
    ↓  (google-auth + gmail API)
gmail_watcher.py  →  get_attachment_bytes()
    ↓
invoice_parser.py  →  parse_invoice()   ← same pipeline as manual upload
    ↓
DB: Invoice row + LedgerEntry row
    ↓
Frontend: "3 new invoices found in Gmail" toast notification
```

---

## Setup — Google OAuth credentials

### Step 1: Create credentials (one-time, do this before coding)

1. Go to https://console.cloud.google.com/
2. Create a project called "gestor-pro"
3. Enable the **Gmail API**
4. Go to APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
5. Application type: **Desktop app**
6. Download the JSON → save as `backend/credentials/gmail_credentials.json`
7. Add to `.gitignore`: `backend/credentials/`

### Step 2: Scopes needed

```python
SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    # readonly is enough — we only download attachments, never send or modify
]
```

### Step 3: Token flow (first run per user)

```python
# First run: browser opens → user authorises → token saved
# Subsequent runs: token refreshed automatically
TOKEN_PATH = "backend/credentials/gmail_token.json"
```

---

## Dependencies

```bash
pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client
```

Add to `requirements.txt`:
```
google-auth>=2.0.0
google-auth-oauthlib>=1.0.0
google-auth-httplib2>=0.2.0
google-api-python-client>=2.0.0
```

---

## Full Implementation

```python
# backend/engine/gmail_watcher.py

import os
import base64
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
CREDENTIALS_PATH = Path("backend/credentials/gmail_credentials.json")
TOKEN_PATH = Path("backend/credentials/gmail_token.json")

SUPPORTED_MIME_TYPES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/heic": ".heic",
}


# ─────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────

def get_gmail_service():
    """
    Returns authenticated Gmail API service object.
    First call: opens browser for OAuth consent.
    Subsequent calls: loads token from disk, refreshes if expired.
    """
    creds = None

    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not CREDENTIALS_PATH.exists():
                raise FileNotFoundError(
                    f"Gmail credentials not found at {CREDENTIALS_PATH}. "
                    "Download OAuth credentials from Google Cloud Console."
                )
            flow = InstalledAppFlow.from_client_secrets_file(
                str(CREDENTIALS_PATH), SCOPES
            )
            creds = flow.run_local_server(port=0)

        TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
        TOKEN_PATH.write_text(creds.to_json())

    return build("gmail", "v1", credentials=creds)


def is_gmail_connected() -> bool:
    """Returns True if a valid token exists. No API call made."""
    if not TOKEN_PATH.exists():
        return False
    try:
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
        return creds.valid or (creds.expired and creds.refresh_token is not None)
    except Exception:
        return False


def disconnect_gmail():
    """Remove stored token. User will need to re-auth."""
    if TOKEN_PATH.exists():
        TOKEN_PATH.unlink()


# ─────────────────────────────────────────────
# CORE: SCAN + EXTRACT
# ─────────────────────────────────────────────

def check_new_invoices(hours_back: int = 24) -> list[dict]:
    """
    Main entry point. Scans Gmail for emails with invoice attachments
    received in the last `hours_back` hours.

    Returns list of raw attachment dicts:
    [
        {
            "filename": "factura_aws.pdf",
            "mime_type": "application/pdf",
            "bytes": b"...",
            "email_subject": "Your AWS invoice",
            "email_date": "2025-03-15T10:30:00Z",
            "email_from": "billing@amazon.com",
            "message_id": "18abc123...",
        },
        ...
    ]

    In DEMO_MODE: returns get_mock_attachments() without calling Gmail API.
    """
    if os.getenv("GMAIL_DEMO_MODE", "true").lower() == "true":
        logger.info("Gmail demo mode — returning mock attachments")
        return get_mock_attachments()

    try:
        service = get_gmail_service()
        since = datetime.utcnow() - timedelta(hours=hours_back)
        # Gmail query syntax: after: uses unix timestamp
        query = f"after:{int(since.timestamp())} has:attachment"

        results = service.users().messages().list(
            userId="me", q=query, maxResults=20
        ).execute()

        messages = results.get("messages", [])
        attachments = []

        for msg_ref in messages:
            try:
                msg = service.users().messages().get(
                    userId="me", id=msg_ref["id"], format="full"
                ).execute()
                attachments.extend(_extract_attachments(service, msg))
            except Exception as e:
                logger.warning(f"Failed to process message {msg_ref['id']}: {e}")
                continue

        logger.info(f"Found {len(attachments)} invoice attachments in Gmail")
        return attachments

    except Exception as e:
        logger.error(f"Gmail scan failed: {e}")
        return []


def _extract_attachments(service, message: dict) -> list[dict]:
    """
    Extract all invoice-type attachments from a single Gmail message.
    Returns list of attachment dicts with bytes included.
    """
    attachments = []

    # Get email metadata
    headers = {h["name"]: h["value"] for h in message["payload"]["headers"]}
    email_subject = headers.get("Subject", "")
    email_from = headers.get("From", "")
    email_date = headers.get("Date", "")

    # Walk MIME parts recursively
    parts = _get_all_parts(message["payload"])

    for part in parts:
        mime_type = part.get("mimeType", "")
        filename = part.get("filename", "")

        if mime_type not in SUPPORTED_MIME_TYPES:
            continue
        if not filename:
            continue

        # Get attachment bytes
        body = part.get("body", {})
        attachment_id = body.get("attachmentId")

        if attachment_id:
            # Large attachment — fetch separately
            att = service.users().messages().attachments().get(
                userId="me",
                messageId=message["id"],
                id=attachment_id
            ).execute()
            file_bytes = base64.urlsafe_b64decode(att["data"])
        elif body.get("data"):
            # Small attachment — inline in message
            file_bytes = base64.urlsafe_b64decode(body["data"])
        else:
            continue

        attachments.append({
            "filename": filename,
            "mime_type": mime_type,
            "bytes": file_bytes,
            "email_subject": email_subject,
            "email_date": email_date,
            "email_from": email_from,
            "message_id": message["id"],
        })

    return attachments


def _get_all_parts(payload: dict) -> list[dict]:
    """Recursively collect all MIME parts from a message payload."""
    parts = []
    if "parts" in payload:
        for part in payload["parts"]:
            parts.extend(_get_all_parts(part))
    else:
        parts.append(payload)
    return parts


# ─────────────────────────────────────────────
# DEMO DATA
# ─────────────────────────────────────────────

def get_mock_attachments() -> list[dict]:
    """
    Returns fake attachment dicts for demo mode.
    The bytes fields contain minimal valid PDF/JPEG headers so invoice_parser
    won't crash on mime type detection.
    In the real pipeline, these would be routed through invoice_parser.parse_invoice().
    For the demo, we short-circuit and return pre-extracted invoice data instead.
    """
    return [
        {
            "filename": "factura_aws_marzo.pdf",
            "mime_type": "application/pdf",
            "bytes": b"%PDF-1.4 mock",
            "email_subject": "Tu factura de Amazon Web Services - Marzo 2025",
            "email_date": "2025-03-01T08:00:00Z",
            "email_from": "aws-invoices@amazon.com",
            "message_id": "mock_001",
            # Pre-extracted for demo — invoice_parser would normally produce this
            "_demo_extracted": {
                "numero_factura": "AWS-2025-03-001",
                "fecha_emision": "2025-03-01",
                "proveedor_nombre": "Amazon Web Services EMEA SARL",
                "proveedor_nif": "LU26375245",
                "concepto": "Servicios de computación en la nube - EC2, S3",
                "base_imponible": 89.99,
                "iva_porcentaje": 21,
                "iva_cuota": 18.90,
                "irpf_porcentaje": 0,
                "irpf_retencion": 0,
                "total": 108.89,
                "tipo": "gasto",
                "categoria": "software",
                "deducible": True,
                "origen": "gmail",
            }
        },
        {
            "filename": "renfe_billete.pdf",
            "mime_type": "application/pdf",
            "bytes": b"%PDF-1.4 mock",
            "email_subject": "Tu billete Renfe - Madrid-Barcelona",
            "email_date": "2025-03-10T09:15:00Z",
            "email_from": "noreply@renfe.es",
            "message_id": "mock_002",
            "_demo_extracted": {
                "numero_factura": "RENFE-20250310-4821",
                "fecha_emision": "2025-03-10",
                "proveedor_nombre": "Renfe Viajeros SA",
                "proveedor_nif": "A28139662",
                "concepto": "Billete AVE Madrid-Barcelona clase Turista",
                "base_imponible": 90.91,
                "iva_porcentaje": 10,
                "iva_cuota": 9.09,
                "irpf_porcentaje": 0,
                "irpf_retencion": 0,
                "total": 100.00,
                "tipo": "gasto",
                "categoria": "viaje",
                "deducible": True,
                "origen": "gmail",
            }
        },
        {
            "filename": "adobe_subscription.pdf",
            "mime_type": "application/pdf",
            "bytes": b"%PDF-1.4 mock",
            "email_subject": "Your Adobe invoice for March 2025",
            "email_date": "2025-03-05T12:00:00Z",
            "email_from": "customercare@adobe.com",
            "message_id": "mock_003",
            "_demo_extracted": {
                "numero_factura": "AD-ES-2025-03-98234",
                "fecha_emision": "2025-03-05",
                "proveedor_nombre": "Adobe Systems Software Ireland Ltd",
                "proveedor_nif": "IE4713815D",
                "concepto": "Adobe Creative Cloud - Plan completo - Mensual",
                "base_imponible": 54.95,
                "iva_porcentaje": 21,
                "iva_cuota": 11.54,
                "irpf_porcentaje": 0,
                "irpf_retencion": 0,
                "total": 66.49,
                "tipo": "gasto",
                "categoria": "software",
                "deducible": True,
                "origen": "gmail",
            }
        },
    ]


# ─────────────────────────────────────────────
# FASTAPI ENDPOINT WIRING (add to main.py)
# ─────────────────────────────────────────────

"""
Add these endpoints to backend/main.py:

@app.get("/api/gmail/status")
async def gmail_status():
    from engine.gmail_watcher import is_gmail_connected
    return {"connected": is_gmail_connected(), "demo_mode": os.getenv("GMAIL_DEMO_MODE", "true") == "true"}

@app.post("/api/gmail/connect")
async def gmail_connect():
    # Opens browser OAuth flow — only works when running locally
    # For demo: just return mock status
    if os.getenv("GMAIL_DEMO_MODE", "true") == "true":
        return {"status": "demo_mode", "message": "Running in demo mode — Gmail connection simulated"}
    try:
        from engine.gmail_watcher import get_gmail_service
        get_gmail_service()  # triggers OAuth if not already done
        return {"status": "connected"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/gmail/disconnect")
async def gmail_disconnect():
    from engine.gmail_watcher import disconnect_gmail
    disconnect_gmail()
    return {"status": "disconnected"}

@app.post("/api/gmail/scan")
async def gmail_scan(hours_back: int = 24, db: Session = Depends(get_db)):
    from engine.gmail_watcher import check_new_invoices
    from engine.invoice_parser import parse_invoice

    attachments = check_new_invoices(hours_back=hours_back)
    results = []

    for att in attachments:
        try:
            # Demo mode: use pre-extracted data directly
            if "_demo_extracted" in att:
                extracted = att["_demo_extracted"]
            else:
                # Real mode: run through full invoice parser
                extracted = await parse_invoice(att["bytes"], att["filename"])

            # Save to DB (same as /api/invoices/parse)
            invoice = models.Invoice(
                user_id=1,
                filename=att["filename"],
                file_type=att["mime_type"].split("/")[1],
                **{k: v for k, v in extracted.items() if hasattr(models.Invoice, k)},
                origen="gmail",
            )
            db.add(invoice)
            db.flush()

            ledger_entry = models.LedgerEntry(
                user_id=1,
                invoice_id=invoice.id,
                fecha=extracted.get("fecha_emision"),
                concepto=extracted.get("concepto"),
                contraparte=extracted.get("proveedor_nombre"),
                tipo=extracted.get("tipo", "gasto"),
                categoria=extracted.get("categoria", "otro"),
                base_imponible=extracted.get("base_imponible", 0),
                iva=extracted.get("iva_cuota", 0),
                irpf=extracted.get("irpf_retencion", 0),
                total=extracted.get("total", 0),
                trimestre=_current_quarter(),
                ejercicio=datetime.now().year,
            )
            db.add(ledger_entry)
            results.append({"filename": att["filename"], "status": "saved", "total": extracted.get("total")})

        except Exception as e:
            results.append({"filename": att["filename"], "status": "error", "error": str(e)})

    db.commit()
    return {"scanned": len(attachments), "results": results}
"""
```

---

## Environment Variables

```bash
# backend/.env
GMAIL_DEMO_MODE=true          # set to false to use real Gmail API
GMAIL_POLL_INTERVAL_HOURS=24  # how far back to scan on each poll
```

---

## Testing

```bash
# Test demo mode (no credentials needed)
curl -X POST http://localhost:8000/api/gmail/scan

# Test status
curl http://localhost:8000/api/gmail/status

# Expected response (demo mode):
# {"scanned": 3, "results": [{"filename": "factura_aws_marzo.pdf", "status": "saved", "total": 108.89}, ...]}
```

---

## What to show in the demo

1. Dashboard shows a "Gmail" badge with green dot (connected)
2. Click "Scan Gmail" button in the nav
3. Toast appears: "3 new invoices found"
4. Ledger table updates with the 3 mock invoices auto-categorised
5. Chatbot: ask "¿Cuánto gasté en software este mes?" → agent calls filter_ledger → returns Adobe + AWS = €175.38

This is a complete story that takes 45 seconds to demo and looks genuinely impressive.
