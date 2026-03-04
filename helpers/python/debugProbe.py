import datetime
import json
import os
import urllib.error
import urllib.request


def debug_probe(label, data=None, meta=None):
    try:
        if os.getenv("DEBUGHUB_ENABLED") != "1":
            return

        session_id = os.getenv("DEBUGHUB_SESSION")
        if not session_id:
            return

        endpoint = os.getenv("DEBUGHUB_ENDPOINT")
        if not endpoint:
            return

        meta = meta or {}
        level = meta.get("level") or "info"
        if level not in ("info", "warn", "error"):
            level = "info"

        event = {
            "ts": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
            "sessionId": session_id,
            "label": label,
            "data": data if data is not None else None,
            "hypothesisId": meta.get("hypothesisId"),
            "loc": meta.get("loc"),
            "level": level,
            "tags": meta.get("tags") if isinstance(meta.get("tags"), dict) else None,
            "runtime": "python",
        }

        payload = json.dumps(event).encode("utf-8")
        target = endpoint.rstrip("/") + "/event"

        req = urllib.request.Request(
            target,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=2):
            pass
    except Exception:
        return


def debugProbe(label, data=None, meta=None):
    debug_probe(label, data, meta)
