"""
Scrapeling-based Web Scraper for Defense GPT
Modern web scraping with stealth browsers, adaptive parsing, and no domain restrictions.
"""

import logging
import re
from typing import List, Dict, Any
from html import unescape
from urllib.parse import urlparse, quote

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


def _host(url: str) -> str:
    """Extract hostname from URL."""
    try:
        return (urlparse(url).hostname or "").lower()
    except Exception:
        return ""


def _trust_label(url: str) -> str:
    """Assign trust label based on domain."""
    host = _host(url)
    # High trust: Government and official sources
    if host.endswith((".gov.in", ".nic.in", ".cdac.in", ".gov")):
        return "high"
    # High trust: Reputable news agencies
    if host.endswith((".reuters.com", ".apnews.com", ".bbc.com", ".aljazeera.com")):
        return "high"
    # High trust: Educational and reference
    if host.endswith((".edu", ".ac.in", ".wikipedia.org")):
        return "high"
    return "medium"


def _clean_text(text: str, max_length: int = 500) -> str:
    """Clean and truncate text content."""
    if not text:
        return ""
    # Remove excessive whitespace
    text = re.sub(r"\s+", " ", text).strip()
    # Unescape HTML entities
    text = unescape(text)
    return text[:max_length]


def _extract_page_content(page) -> str:
    """Extract clean text content from a Scrapling page object."""
    try:
        # Try to get all text content, excluding script and style tags
        text = page.get_all_text(ignore_tags=('script', 'style'))
        return _clean_text(text, max_length=1000)
    except Exception as e:
        logger.warning(f"Failed to extract text content: {e}")
        return ""


def search_with_searxng(query: str, limit: int = 10) -> List[Dict[str, str]]:
    """
    Search using SearXNG public instances (no API key needed).
    Returns list of {title, link, snippet} dictionaries.
    """
    try:
        from scrapling.fetchers import Fetcher

        # Use a public SearXNG instance
        searx_instances = [
            "https://search.sapti.me/search",
            "https://searx.be/search",
            "https://search.bus-hit.me/search",
        ]

        for base_url in searx_instances:
            try:
                params = f"?q={quote(query)}&format=html"
                url = base_url + params

                page = Fetcher.get(url, stealthy_headers=True, timeout=20)

                results = []
                seen_links = set()

                # Parse SearXNG result articles
                for article in page.css('article.result'):
                    # Get title and link
                    title_elem = article.css('h3 a')
                    if not title_elem:
                        continue

                    href = title_elem[0].attrib.get('href', '')
                    title = title_elem[0].text if hasattr(title_elem[0], 'text') else 'Untitled'

                    if not href or href in seen_links:
                        continue

                    seen_links.add(href)

                    # Get snippet
                    snippet = ""
                    snippet_elem = article.css('p.content, .content p')
                    if snippet_elem:
                        snippet = snippet_elem[0].text if hasattr(snippet_elem[0], 'text') else ''

                    results.append({
                        "title": title,
                        "link": href,
                        "snippet": snippet
                    })

                    if len(results) >= limit:
                        break

                if results:
                    logger.info(f"SearXNG found {len(results)} results from {base_url}")
                    return results

            except Exception as e:
                logger.debug(f"SearXNG instance {base_url} failed: {e}")
                continue

        logger.warning("All SearXNG instances failed")
        return []

    except Exception as e:
        logger.error(f"SearXNG search failed: {e}")
        return []


def search_duckduckgo(query: str, limit: int = 10) -> List[Dict[str, str]]:
    """
    Search DuckDuckGo Lite for URLs related to the query.
    Returns list of {title, link, snippet} dictionaries.
    """
    try:
        from scrapling.fetchers import Fetcher
        from urllib.parse import parse_qs, unquote

        # Use DuckDuckGo Lite (simpler HTML, easier to parse)
        encoded_query = quote(query, safe='')
        search_url = f"https://lite.duckduckgo.com/lite/?q={encoded_query}"

        page = Fetcher.get(search_url, stealthy_headers=True, timeout=20)

        results = []
        seen_links = set()

        # Parse DuckDuckGo Lite results
        for link in page.css('a'):
            href = link.attrib.get('href', '')

            # Skip empty or javascript links
            if not href or href.startswith('#') or 'javascript' in href.lower():
                continue

            # Decode DuckDuckGo redirect URLs
            if 'uddg=' in href:
                # Parse the redirect URL
                if href.startswith('//'):
                    href = 'https:' + href
                parsed = urlparse(href)
                params = parse_qs(parsed.query)
                if 'uddg' in params:
                    href = unquote(params['uddg'][0])

            # Skip internal DuckDuckGo links (after decoding)
            if 'duckduckgo.com' in _host(href):
                continue

            if href in seen_links:
                continue

            title = link.text if hasattr(link, 'text') else ''
            if not title or len(title) < 3:
                continue

            seen_links.add(href)

            results.append({
                "title": title.strip(),
                "link": href,
                "snippet": ""
            })

            if len(results) >= limit:
                break

        logger.info(f"DuckDuckGo Lite found {len(results)} results for query: {query[:50]}")
        return results

    except Exception as e:
        logger.error(f"DuckDuckGo Lite search failed: {e}")
        return []


def scrape_url(url: str, use_browser: bool = False, timeout: int = 25) -> Dict[str, Any]:
    """
    Scrape a single URL and extract content.

    Args:
        url: URL to scrape
        use_browser: If True, use StealthyFetcher for JS rendering
        timeout: Request timeout in seconds

    Returns:
        Dict with title, content, domain, trust, link
    """
    result = {
        "title": "",
        "content": "",
        "domain": _host(url),
        "trust": _trust_label(url),
        "link": url,
        "success": False
    }

    try:
        if use_browser:
            # Use stealth browser for JS-heavy sites
            try:
                from scrapling.fetchers import StealthyFetcher
                page = StealthyFetcher.fetch(
                    url,
                    disable_resources=True,
                    block_ads=True,
                    timeout=timeout,
                    wait_selector='body'
                )
            except ImportError:
                logger.warning("StealthyFetcher not available, falling back to Fetcher")
                from scrapling.fetchers import Fetcher
                page = Fetcher.get(url, stealthy_headers=True, timeout=timeout)
        else:
            # Use fast HTTP fetcher
            from scrapling.fetchers import Fetcher
            page = Fetcher.get(url, stealthy_headers=True, timeout=timeout)

        # Extract title
        title_elem = page.css('title')
        if title_elem:
            result["title"] = title_elem[0].text if hasattr(title_elem[0], 'text') else ""

        # Extract main content
        result["content"] = _extract_page_content(page)
        result["success"] = True

        logger.info(f"Successfully scraped: {url[:60]}")

    except Exception as e:
        logger.warning(f"Failed to scrape {url}: {e}")
        result["error"] = str(e)

    return result


def search_and_scrape(
    query: str,
    max_results: int = 5,
    use_browser_for_scraping: bool = False,
    fallback_to_browser: bool = True
) -> List[Dict[str, Any]]:
    """
    Search for query and scrape the resulting pages.

    Args:
        query: Search query
        max_results: Maximum number of results to return
        use_browser_for_scraping: Use browser for all scraping (slower but handles JS)
        fallback_to_browser: If HTTP fetch fails, retry with browser

    Returns:
        List of result dictionaries with title, content, domain, trust, link
    """
    # Step 1: Try multiple search methods
    search_results = search_duckduckgo(query, limit=max_results * 3)

    if not search_results:
        search_results = search_with_searxng(query, limit=max_results * 3)

    if not search_results:
        logger.warning(f"No search results found for query: {query[:50]}")
        return []

    # Step 2: Scrape each result
    scraped_results = []
    for sr in search_results[:max_results * 2]:  # Try more than needed
        url = sr.get("link")
        if not url:
            continue

        # Skip PDFs (they need special handling)
        if url.lower().endswith('.pdf'):
            logger.debug(f"Skipping PDF: {url}")
            continue

        # Try HTTP fetch first
        result = scrape_url(url, use_browser=use_browser_for_scraping)

        # If HTTP failed and fallback enabled, try browser
        if not result["success"] and fallback_to_browser and not use_browser_for_scraping:
            logger.info(f"Retrying with browser: {url[:60]}")
            result = scrape_url(url, use_browser=True)

        # Add search metadata
        result["title"] = result["title"] or sr.get("title", "Untitled")
        result["snippet"] = sr.get("snippet", "")

        # Only include if we got some content
        if result["content"] or result["snippet"]:
            scraped_results.append(result)

        if len(scraped_results) >= max_results:
            break

    # Sort by trust and content quality
    scraped_results.sort(
        key=lambda r: (
            1 if r["trust"] == "high" else 0,
            len(r.get("content", "")),
            len(r.get("snippet", ""))
        ),
        reverse=True
    )

    logger.info(f"Scraped {len(scraped_results)} pages for query: {query[:50]}")
    return scraped_results[:max_results]


def web_search(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Main web search function compatible with existing Defense GPT architecture.

    Args:
        query: Search query
        limit: Maximum results to return

    Returns:
        List of result dictionaries
    """
    return search_and_scrape(
        query=query,
        max_results=limit,
        use_browser_for_scraping=False,
        fallback_to_browser=True
    )


# Async versions for better performance
async def async_web_search(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Async version of web search for better performance.
    Falls back to sync version for simplicity.
    """
    return web_search(query, limit)
