"""
Gmail Watcher — polls inbox for invoice attachments and routes them through invoice_parser.
GMAIL_DEMO_MODE=true (default) returns mock data — no OAuth needed for demo.
Set GMAIL_DEMO_MODE=false + provide backend/credentials/gmail_credentials.json for real mode.
"""
import os
import base64
import logging
from datetime import datetime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
CREDENTIALS_PATH = Path("backend/credentials/gmail_credentials.json")
TOKEN_PATH       = Path("backend/credentials/gmail_token.json")

SUPPORTED_MIME_TYPES = {
    "application/pdf": ".pdf",
    "image/jpeg":      ".jpg",
    "image/jpg":       ".jpg",
    "image/png":       ".png",
    "image/heic":      ".heic",
}


# ── auth ───────────────────────────────────────────────────────────────────────

def get_gmail_service():
    """
    Returns authenticated Gmail API service object.
    First call: opens browser for OAuth consent.
    Subsequent calls: loads token from disk, refreshes if expired.
    """
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build

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
                    "Download OAuth 2.0 credentials from Google Cloud Console "
                    "and save as backend/credentials/gmail_credentials.json"
                )
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_PATH), SCOPES)
            creds = flow.run_local_server(port=0)

        TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
        TOKEN_PATH.write_text(creds.to_json())

    return build("gmail", "v1", credentials=creds)


def is_gmail_connected() -> bool:
    """Returns True if a valid token exists. No API call made."""
    if not TOKEN_PATH.exists():
        return False
    try:
        from google.oauth2.credentials import Credentials
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
        return creds.valid or (creds.expired and creds.refresh_token is not None)
    except Exception:
        return False


def disconnect_gmail():
    """Remove stored token. User will need to re-auth on next connect."""
    if TOKEN_PATH.exists():
        TOKEN_PATH.unlink()


# ── core: scan + extract ───────────────────────────────────────────────────────

def check_new_invoices(hours_back: int = 24) -> list[dict]:
    """
    Main entry point. Scans Gmail for emails with invoice attachments
    received in the last `hours_back` hours.

    Returns list of attachment dicts with file bytes + email metadata.
    In GMAIL_DEMO_MODE=true: returns mock data, no API call made.
    """
    if os.getenv("GMAIL_DEMO_MODE", "true").lower() == "true":
        logger.info("Gmail demo mode — returning mock attachments")
        return get_mock_attachments()

    try:
        service = get_gmail_service()
        since   = datetime.utcnow() - timedelta(hours=hours_back)
        query   = f"after:{int(since.timestamp())} has:attachment"

        results  = service.users().messages().list(
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
                logger.warning(f"Skipping message {msg_ref['id']}: {e}")

        logger.info(f"Found {len(attachments)} invoice attachments in Gmail")
        return attachments

    except Exception as e:
        logger.error(f"Gmail scan failed: {e}")
        return []


def _extract_attachments(service, message: dict) -> list[dict]:
    """Extract all invoice-type attachments from a single Gmail message."""
    attachments = []
    headers      = {h["name"]: h["value"] for h in message["payload"]["headers"]}

    for part in _get_all_parts(message["payload"]):
        mime_type = part.get("mimeType", "")
        filename  = part.get("filename", "")

        if mime_type not in SUPPORTED_MIME_TYPES or not filename:
            continue

        body          = part.get("body", {})
        attachment_id = body.get("attachmentId")

        if attachment_id:
            att = service.users().messages().attachments().get(
                userId="me", messageId=message["id"], id=attachment_id
            ).execute()
            file_bytes = base64.urlsafe_b64decode(att["data"])
        elif body.get("data"):
            file_bytes = base64.urlsafe_b64decode(body["data"])
        else:
            continue

        attachments.append({
            "filename":      filename,
            "mime_type":     mime_type,
            "bytes":         file_bytes,
            "email_subject": headers.get("Subject", ""),
            "email_date":    headers.get("Date", ""),
            "email_from":    headers.get("From", ""),
            "message_id":    message["id"],
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


# ── demo data ──────────────────────────────────────────────────────────────────

def get_mock_attachments() -> list[dict]:
    """
    Fake attachments for demo mode. Each has `_demo_extracted` with pre-built
    invoice fields so the scan endpoint can skip the LLM parser entirely and
    still produce realistic ledger entries instantly.
    """
    return [
        {
            "filename":      "factura_aws_marzo.pdf",
            "mime_type":     "application/pdf",
            "bytes":         b"%PDF-1.4 mock",
            "email_subject": "Tu factura de Amazon Web Services - Marzo 2025",
            "email_date":    "2025-03-01T08:00:00Z",
            "email_from":    "aws-invoices@amazon.com",
            "message_id":    "mock_001",
            "_demo_extracted": {
                "numero_factura":  "AWS-2025-03-001",
                "fecha_emision":   "2025-03-01",
                "proveedor_nombre": "Amazon Web Services EMEA SARL",
                "proveedor_nif":   "LU26375245",
                "concepto":        "Servicios de computación en la nube - EC2, S3",
                "base_imponible":  89.99,
                "iva_porcentaje":  21,
                "iva_cuota":       18.90,
                "irpf_porcentaje": 0,
                "irpf_retencion":  0,
                "total":           108.89,
                "tipo":            "gasto",
                "categoria":       "software",
                "deducible":       True,
            },
        },
        {
            "filename":      "renfe_billete.pdf",
            "mime_type":     "application/pdf",
            "bytes":         b"%PDF-1.4 mock",
            "email_subject": "Tu billete Renfe - Madrid-Barcelona",
            "email_date":    "2025-03-10T09:15:00Z",
            "email_from":    "noreply@renfe.es",
            "message_id":    "mock_002",
            "_demo_extracted": {
                "numero_factura":  "RENFE-20250310-4821",
                "fecha_emision":   "2025-03-10",
                "proveedor_nombre": "Renfe Viajeros SA",
                "proveedor_nif":   "A28139662",
                "concepto":        "Billete AVE Madrid-Barcelona clase Turista",
                "base_imponible":  90.91,
                "iva_porcentaje":  10,
                "iva_cuota":       9.09,
                "irpf_porcentaje": 0,
                "irpf_retencion":  0,
                "total":           100.00,
                "tipo":            "gasto",
                "categoria":       "viaje",
                "deducible":       True,
            },
        },
        {
            "filename":      "adobe_subscription.pdf",
            "mime_type":     "application/pdf",
            "bytes":         b"%PDF-1.4 mock",
            "email_subject": "Your Adobe invoice for March 2025",
            "email_date":    "2025-03-05T12:00:00Z",
            "email_from":    "customercare@adobe.com",
            "message_id":    "mock_003",
            "_demo_extracted": {
                "numero_factura":  "AD-ES-2025-03-98234",
                "fecha_emision":   "2025-03-05",
                "proveedor_nombre": "Adobe Systems Software Ireland Ltd",
                "proveedor_nif":   "IE4713815D",
                "concepto":        "Adobe Creative Cloud - Plan completo - Mensual",
                "base_imponible":  54.95,
                "iva_porcentaje":  21,
                "iva_cuota":       11.54,
                "irpf_porcentaje": 0,
                "irpf_retencion":  0,
                "total":           66.49,
                "tipo":            "gasto",
                "categoria":       "software",
                "deducible":       True,
            },
        },
    ]
