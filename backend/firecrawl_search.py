import logging
import os
from urllib.parse import urlparse
from typing import Any

from dotenv import load_dotenv
from firecrawl import Firecrawl
import requests

load_dotenv()

logger = logging.getLogger(__name__)

FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY")
_firecrawl_client = Firecrawl(api_key=FIRECRAWL_API_KEY) if FIRECRAWL_API_KEY else None

CLOUDFLARE_ACCOUNT_ID = os.getenv("CLOUDFLARE_ACCOUNT_ID")
CLOUDFLARE_API_TOKEN = os.getenv("CLOUDFLARE_API_TOKEN")

DEFAULT_DEFENSE_STUDY_DOMAINS = [
    "upsc.gov.in",
    "upsconline.nic.in",
    "joinindianarmy.nic.in",
    "joinindiannavy.gov.in",
    "careerindianairforce.cdac.in",
    "afcat.cdac.in",
    "agnipathvayu.cdac.in",
    "drdo.gov.in",
    "pib.gov.in",
    "mod.gov.in",
    "prepp.in",
    "testbook.com",
    "ssbcrack.com",
    "defencexp.com",
    "affairscloud.com",
    "gktoday.in",
    "jagranjosh.com",
    "selfstudys.com",
    "cdsjourney.com",
    "jovikdefenceprep.com",
]


def _allowed_domains() -> list[str]:
    raw = os.getenv("DEFENSE_STUDY_DOMAINS", "").strip()
    if not raw:
        return DEFAULT_DEFENSE_STUDY_DOMAINS
    domains = [d.strip().lower() for d in raw.split(",") if d.strip()]
    return domains or DEFAULT_DEFENSE_STUDY_DOMAINS


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
    high = ("gov.in", "nic.in", "cdac.in")
    if any(host.endswith(suffix) for suffix in high):
        return "high"
    return "medium"


def _to_dict(value: Any) -> dict:
    if isinstance(value, dict):
        return value
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if hasattr(value, "__dict__"):
        return dict(value.__dict__)
    return {}


def _extract_content(scraped: Any) -> str:
    data = _to_dict(scraped)
    markdown = data.get("markdown") or ""
    summary = data.get("summary") or ""
    return (markdown or summary)[:500]


def _cloudflare_markdown(url: str) -> str:
    if not CLOUDFLARE_ACCOUNT_ID or not CLOUDFLARE_API_TOKEN:
        return ""
    endpoint = f"https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/browser-rendering/markdown"
    headers = {
        "Authorization": f"Bearer {CLOUDFLARE_API_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "url": url,
        "gotoOptions": {"waitUntil": "networkidle2"},
    }
    try:
        res = requests.post(endpoint, json=payload, headers=headers, timeout=25)
        res.raise_for_status()
        data = res.json()
        if data.get("success"):
            return (data.get("result") or "")[:500]
        return ""
    except Exception as e:
        logger.warning("Cloudflare markdown failed for %s: %s", url, e)
        return ""


def firecrawl_search(query: str, limit: int = 3) -> list[dict]:
    """Search defense-study domains via Firecrawl and enrich with Cloudflare markdown when configured."""
    if not _firecrawl_client:
        logger.warning("FIRECRAWL_API_KEY missing; skipping web search.")
        return []

    allowed_domains = _allowed_domains()
    try:
        candidates = []
        # Use site-scoped discovery so we only pull study-relevant domains.
        for domain in allowed_domains:
            scoped_query = f"site:{domain} {query}"
            search_results = _firecrawl_client.search(query=scoped_query, limit=1)
            payload = _to_dict(search_results)
            web_items = payload.get("web") or []
            if web_items:
                candidates.extend(web_items)

        # fallback to broad query if scoped queries found nothing
        if not candidates:
            fallback = _to_dict(_firecrawl_client.search(query=query, limit=max(limit, 5)))
            candidates = fallback.get("web") or []

        seen_links = set()
        results = []
        for item in candidates:
            row = _to_dict(item)
            url = row.get("url")
            title = row.get("title") or "Untitled"
            snippet = row.get("description") or row.get("snippet") or ""
            if not url or url in seen_links:
                continue
            if not _is_allowed_url(url, allowed_domains):
                continue
            seen_links.add(url)
            try:
                content = _cloudflare_markdown(url)
                if not content:
                    scraped = _firecrawl_client.scrape(url=url, formats=["markdown", "summary"])
                    content = _extract_content(scraped)
            except Exception as scrape_error:
                logger.warning("Firecrawl scrape failed for %s: %s", url, scrape_error)
                content = ""

            results.append({
                "title": title,
                "snippet": snippet,
                "link": url,
                "domain": _host(url),
                "trust": _trust_label(url),
                "content": content,
            })
            if len(results) >= limit:
                break

        return results
    except Exception as search_error:
        logger.error("Firecrawl search failed: %s", search_error)
        return []
