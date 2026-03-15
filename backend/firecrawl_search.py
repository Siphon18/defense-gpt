import logging
import os
import re
from html import unescape
from urllib.parse import urlparse, parse_qs, unquote
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
    # Reputable news domains for current-affairs and geopolitical defense queries
    "reuters.com",
    "apnews.com",
    "aljazeera.com",
    "bbc.com",
    "thehindu.com",
    "indianexpress.com",
    "timesofindia.indiatimes.com",
    "hindustantimes.com",
    "economictimes.indiatimes.com",
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


def _is_pdf_url(url: str) -> bool:
    try:
        path = (urlparse(url).path or "").lower()
        return path.endswith(".pdf")
    except Exception:
        return False


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


def _strip_html(html: str) -> str:
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", html or "")
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:500]


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


def _http_extract(url: str, timeout: int = 12) -> str:
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        res = requests.get(url, headers=headers, timeout=timeout)
        res.raise_for_status()
        ctype = (res.headers.get("Content-Type") or "").lower()
        if "application/pdf" in ctype or _is_pdf_url(url):
            return ""
        return _strip_html(res.text)
    except Exception:
        return ""


def _decode_ddg_url(url: str) -> str:
    # DuckDuckGo wraps outbound URLs as /l/?uddg=<encoded-url>
    if "duckduckgo.com/l/?" in url and "uddg=" in url:
        try:
            parsed = urlparse(url)
            q = parse_qs(parsed.query)
            uddg = q.get("uddg", [""])[0]
            if uddg:
                return unquote(uddg)
        except Exception:
            return url
    return url


def _extract_ddg_candidates(html: str, limit: int = 8) -> tuple[list[dict], str]:
    rows = []
    seen = set()

    # Strategy 1: html.duckduckgo.com result blocks
    blocks = re.findall(r'(?s)<div class="result.*?</div>\s*</div>', html)
    for block in blocks:
        m_link = re.search(r'<a[^>]*class="result__a"[^>]*href="([^"]+)"', block)
        if not m_link:
            continue
        raw_link = unescape(m_link.group(1))
        link = _decode_ddg_url(raw_link)
        if not link.startswith("http") or link in seen:
            continue
        seen.add(link)

        m_title = re.search(r'<a[^>]*class="result__a"[^>]*>(.*?)</a>', block, re.DOTALL)
        title = _strip_html(m_title.group(1)) if m_title else "Untitled"

        m_snip = re.search(r'<a[^>]*class="result__snippet"[^>]*>(.*?)</a>', block, re.DOTALL)
        if not m_snip:
            m_snip = re.search(r'<div[^>]*class="result__snippet"[^>]*>(.*?)</div>', block, re.DOTALL)
        snippet = _strip_html(m_snip.group(1)) if m_snip else ""

        rows.append({"title": title, "snippet": snippet, "link": link})
        if len(rows) >= limit:
            return rows, "result_blocks"

    # Strategy 2: generic DDG redirect anchors (/l/?uddg=...)
    for m in re.finditer(r'<a[^>]*href="([^"]*duckduckgo\.com/l/\?[^"]+uddg=[^"]+)"[^>]*>(.*?)</a>', html, re.DOTALL):
        raw_link = unescape(m.group(1))
        link = _decode_ddg_url(raw_link)
        if not link.startswith("http") or link in seen:
            continue
        seen.add(link)
        title = _strip_html(m.group(2)) or "Untitled"
        rows.append({"title": title, "snippet": "", "link": link})
        if len(rows) >= limit:
            return rows, "redirect_anchors"

    # Strategy 3: ultra-loose fallback for direct outbound anchors
    for m in re.finditer(r'<a[^>]*href="(https?://[^"]+)"[^>]*>(.*?)</a>', html, re.DOTALL):
        link = unescape(m.group(1)).strip()
        if "duckduckgo.com" in _host(link):
            continue
        if link in seen:
            continue
        seen.add(link)
        title = _strip_html(m.group(2)) or "Untitled"
        rows.append({"title": title, "snippet": "", "link": link})
        if len(rows) >= limit:
            return rows, "generic_anchors"

    return rows, "no_match"


def duckduckgo_search(query: str, limit: int = 8, return_meta: bool = False):
    """
    Scrape DuckDuckGo HTML results and return raw candidates:
    [{title, snippet, link}]
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    meta = {
        "engine": "duckduckgo",
        "endpoint": "",
        "parser": "",
        "errors": [],
        "sample": "",
    }
    endpoints = [
        ("html_post", "https://html.duckduckgo.com/html/", "post"),
        ("lite_get", "https://lite.duckduckgo.com/lite/", "get"),
    ]
    try:
        for label, url, method in endpoints:
            try:
                if method == "post":
                    res = requests.post(
                        url,
                        headers={**headers, "Content-Type": "application/x-www-form-urlencoded"},
                        data={"q": query},
                        timeout=18,
                    )
                else:
                    res = requests.get(url, headers=headers, params={"q": query}, timeout=18)
                res.raise_for_status()
                html = res.text or ""
                rows, parser = _extract_ddg_candidates(html, limit=limit)
                meta["endpoint"] = label
                meta["parser"] = parser
                meta["sample"] = re.sub(r"\s+", " ", html[:220]).strip()
                if rows:
                    return (rows, meta) if return_meta else rows
            except Exception as e:
                meta["errors"].append(f"{label}:{str(e)[:180]}")
                continue
        return ([], meta) if return_meta else []
    except Exception as e:
        logger.warning("DuckDuckGo scrape failed: %s", e)
        meta["errors"].append(f"fatal:{str(e)[:180]}")
        return ([], meta) if return_meta else []


def firecrawl_search(query: str, limit: int = 3, return_meta: bool = False):
    """DuckDuckGo scrape -> crawl/extract content -> filter/normalize."""
    meta = {
        "status": "ok",
        "reason": "fetched",
        "candidates": 0,
        "filtered_out": 0,
        "scrape_failures": 0,
    }

    allowed_domains = _allowed_domains()
    try:
        candidates, ddg_meta = duckduckgo_search(query, limit=max(limit * 4, 10), return_meta=True)
        meta["search_endpoint"] = ddg_meta.get("endpoint", "")
        meta["search_parser"] = ddg_meta.get("parser", "")
        if ddg_meta.get("errors"):
            meta["search_errors"] = ddg_meta.get("errors", [])
        meta["candidates"] = len(candidates)
        if not candidates:
            meta.update({"status": "unavailable", "reason": "no_search_results"})
            return ([], meta) if return_meta else []

        seen_links = set()
        results = []
        for row in candidates:
            url = row.get("link")
            title = row.get("title") or "Untitled"
            snippet = row.get("snippet") or ""
            if not url or url in seen_links:
                continue
            if not _is_allowed_url(url, allowed_domains):
                meta["filtered_out"] += 1
                continue
            seen_links.add(url)
            # PDF scraping is often slow/flaky; rely on search metadata for these.
            if _is_pdf_url(url):
                content = snippet[:500]
            else:
                try:
                    content = _cloudflare_markdown(url)
                    if not content and _firecrawl_client:
                        scraped = _firecrawl_client.scrape(url=url, formats=["markdown", "summary"])
                        content = _extract_content(scraped)
                    if not content:
                        content = _http_extract(url)
                except Exception as scrape_error:
                    logger.warning("Firecrawl scrape failed for %s: %s", url, scrape_error)
                    meta["scrape_failures"] += 1
                    content = _http_extract(url)
                if not content:
                    meta["scrape_failures"] += 1

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
        if not results:
            if meta["filtered_out"] > 0:
                meta.update({"status": "unavailable", "reason": "filtered_by_allowed_domains"})
            elif meta["scrape_failures"] > 0:
                meta.update({"status": "unavailable", "reason": "scrape_failed"})
            else:
                meta.update({"status": "unavailable", "reason": "no_usable_results"})
        return (results, meta) if return_meta else results
    except Exception as search_error:
        logger.error("Firecrawl search failed: %s", search_error)
        meta.update({"status": "error", "reason": "search_error"})
        return ([], meta) if return_meta else []
