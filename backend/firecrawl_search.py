import logging
import os
from typing import Any

from dotenv import load_dotenv
from firecrawl import Firecrawl

load_dotenv()

logger = logging.getLogger(__name__)

FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY")
_firecrawl_client = Firecrawl(api_key=FIRECRAWL_API_KEY) if FIRECRAWL_API_KEY else None


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


def firecrawl_search(query: str, limit: int = 3) -> list[dict]:
    """Search the web via Firecrawl and return normalized snippets."""
    if not _firecrawl_client:
        logger.warning("FIRECRAWL_API_KEY missing; skipping web search.")
        return []

    try:
        search_results = _firecrawl_client.search(query=query, limit=limit)
        payload = _to_dict(search_results)
        web_items = payload.get("web") or []

        results = []
        for item in web_items:
            row = _to_dict(item)
            url = row.get("url")
            title = row.get("title") or "Untitled"
            snippet = row.get("description") or row.get("snippet") or ""
            if not url:
                continue
            try:
                scraped = _firecrawl_client.scrape(url=url, formats=["markdown", "summary"])
                content = _extract_content(scraped)
            except Exception as scrape_error:
                logger.warning("Firecrawl scrape failed for %s: %s", url, scrape_error)
                content = ""

            results.append({
                "title": title,
                "snippet": snippet,
                "link": url,
                "content": content,
            })

        return results
    except Exception as search_error:
        logger.error("Firecrawl search failed: %s", search_error)
        return []
