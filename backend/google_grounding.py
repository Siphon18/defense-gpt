import json
import logging
import os
import re
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


def _host(url: str) -> str:
    try:
        return (urlparse(url).hostname or "").lower()
    except Exception:
        return ""


def _is_allowed_url(url: str, allowed_domains: list[str]) -> bool:
    host = _host(url)
    return any(host == d or host.endswith(f".{d}") for d in allowed_domains)


def _trust_label(url: str) -> str:
    host = _host(url)
    if host.endswith(("gov.in", "nic.in", "cdac.in")):
        return "high"
    if host.endswith(("reuters.com", "apnews.com", "bbc.com", "aljazeera.com")):
        return "high"
    return "medium"


def _extract_json(text: str) -> dict:
    text = (text or "").strip()
    if not text:
        return {}
    try:
        return json.loads(text)
    except Exception:
        pass

    # Model may wrap JSON with markdown fences or extra text.
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    if fenced:
        try:
            return json.loads(fenced.group(1))
        except Exception:
            pass

    inline = re.search(r"(\{.*\})", text, re.DOTALL)
    if inline:
        try:
            return json.loads(inline.group(1))
        except Exception:
            return {}
    return {}


def google_grounding_search(
    query: str,
    limit: int = 3,
    allowed_domains: list[str] | None = None,
    return_meta: bool = False,
):
    """
    Use Gemini grounding with Google Search for retrieval only.
    Returns normalized web items, not final prose generation.
    """
    meta = {
        "status": "ok",
        "reason": "fetched",
        "candidates": 0,
        "filtered_out": 0,
    }

    if os.getenv("GOOGLE_GROUNDING_ENABLED", "true").strip().lower() in {"0", "false", "no"}:
        meta.update({"status": "disabled", "reason": "google_grounding_disabled"})
        return ([], meta) if return_meta else []

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        meta.update({"status": "disabled", "reason": "missing_gemini_api_key"})
        return ([], meta) if return_meta else []

    domains = [d.strip().lower() for d in (allowed_domains or []) if d and d.strip()]
    if not domains:
        meta.update({"status": "disabled", "reason": "missing_allowed_domains"})
        return ([], meta) if return_meta else []

    prompt = (
        "Use Google Search grounding and return ONLY valid JSON with this schema:\n"
        "{\n"
        '  "results": [\n'
        '    {"title":"...", "url":"...", "snippet":"...", "published_at":""}\n'
        "  ]\n"
        "}\n"
        f"Find up to {max(1, min(limit * 3, 12))} recent, relevant results for this query:\n"
        f"{query}\n"
        "Prefer primary/credible sources. Do not include any text outside JSON."
    )

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model_name = os.getenv("GEMINI_GROUNDING_MODEL", "gemini-2.0-flash-lite")
        model = genai.GenerativeModel(model_name=model_name)

        kwargs = {
            "generation_config": genai.types.GenerationConfig(
                temperature=0.1,
                max_output_tokens=800,
                response_mime_type="application/json",
            ),
        }

        # Try modern search tool first, then legacy fallback.
        response = None
        tool_errors = []
        for tools in ([{"google_search": {}}], [{"google_search_retrieval": {}}]):
            try:
                response = model.generate_content(prompt, tools=tools, **kwargs)
                break
            except Exception as e:
                tool_errors.append(str(e))
                continue

        if response is None:
            meta.update({"status": "error", "reason": "google_grounding_error"})
            logger.warning("Gemini grounding tool invocation failed: %s", " | ".join(tool_errors))
            return ([], meta) if return_meta else []

        payload = _extract_json(getattr(response, "text", "") or "")
        rows = payload.get("results", []) if isinstance(payload, dict) else []
        meta["candidates"] = len(rows)
        if not rows:
            meta.update({"status": "unavailable", "reason": "grounding_no_results"})
            return ([], meta) if return_meta else []

        out = []
        seen = set()
        for row in rows:
            if not isinstance(row, dict):
                continue
            url = (row.get("url") or "").strip()
            if not url or url in seen:
                continue
            seen.add(url)
            if not _is_allowed_url(url, domains):
                meta["filtered_out"] += 1
                continue
            out.append({
                "title": row.get("title") or "Untitled",
                "snippet": row.get("snippet") or "",
                "link": url,
                "domain": _host(url),
                "trust": _trust_label(url),
                "published_at": row.get("published_at") or "",
                "content": (row.get("snippet") or "")[:500],
            })
            if len(out) >= limit:
                break

        if not out:
            if meta["filtered_out"] > 0:
                meta.update({"status": "unavailable", "reason": "filtered_by_allowed_domains"})
            else:
                meta.update({"status": "unavailable", "reason": "grounding_no_results"})
        return (out, meta) if return_meta else out
    except Exception as e:
        logger.warning("Gemini grounding failed: %s", e)
        meta.update({"status": "error", "reason": "google_grounding_error"})
        return ([], meta) if return_meta else []
