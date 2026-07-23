"""
Agentic Search Module for Defense GPT
Implements Adaptive RAG with Tool-Calling & Reasoning Loop.
Tools:
  1. pdf_rag_search: Vector Search over syllabus PDFs in MongoDB Atlas
  2. web_search: Real-time search over official Indian defense & news domains
"""

import json
import logging
import os
from typing import AsyncGenerator, Dict, Any, List
from dotenv import load_dotenv

from backend.rag_engine import rag_engine
from backend.firecrawl_search import firecrawl_search
from backend.web_search import google_search

load_dotenv()
logger = logging.getLogger(__name__)

def _get_groq_client():
    from backend.groq_client import groq_client
    return groq_client

# ── Available Tools Definition for Agent ────────────────────────────
AGENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_syllabus_pdfs",
            "description": "Search official Indian defense exam syllabus documents (NDA, CDS, AFCAT, SSB, CAPF) in MongoDB Atlas vector database.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Targeted search query for syllabus topics, exam patterns, or formulas."
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "Number of PDF chunks to retrieve (default: 5)."
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_live_web",
            "description": "Search the live web across verified Indian defense portals (upsc.gov.in, joinindianarmy.nic.in, pib.gov.in, Reuters, The Hindu) for current affairs, recent notifications, cutoffs, and geopolitical defense updates.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query for current defense news, latest exam notifications, or current affairs."
                    }
                },
                "required": ["query"]
            }
        }
    }
]


def execute_pdf_search(query: str, exam_type: str = "General", top_k: int = 5) -> Dict[str, Any]:
    """Execute PDF Vector Search tool."""
    try:
        context_str, chunks = rag_engine.build_context(query, top_k=top_k)
        sources = [
            {
                "source": c.source,
                "page": c.page,
                "preview": c.text[:180],
                "score": c.score,
            }
            for c in chunks
        ]
        return {
            "success": True,
            "context": context_str,
            "sources": sources,
            "chunks_found": len(chunks),
        }
    except Exception as e:
        logger.error(f"Agent tool execute_pdf_search error: {e}")
        return {"success": False, "context": "", "sources": [], "error": str(e)}


def execute_web_search(query: str) -> Dict[str, Any]:
    """Execute Live Web Search tool using Firecrawl / Google / DuckDuckGo fallback."""
    try:
        # Try Firecrawl / DuckDuckGo curated defense domain search
        items, engine_used = firecrawl_search(query, max_results=4)

        # Fallback to Google Custom Search if Firecrawl returns no results
        if not items:
            g_items = google_search(query, num_results=4)
            if g_items:
                items = g_items
                engine_used = "google-custom-search"

        if not items:
            return {
                "success": False,
                "context": "WEB_VERIFICATION: unavailable (no results found for query)",
                "sources": [],
            }

        # Format context string for LLM
        lines = []
        sources = []
        for idx, item in enumerate(items, 1):
            title = item.get("title") or item.get("source") or "Web Intel"
            snippet = item.get("snippet") or item.get("content") or ""
            link = item.get("link") or ""
            lines.append(f"[{idx}] {title}\nSnippet: {snippet}\nURL: {link}")

            sources.append({
                "source": "web",
                "title": title,
                "preview": snippet[:200],
                "link": link,
                "trust": "high" if any(dom in link for dom in ["gov.in", "nic.in", "reuters.com", "pib.gov.in"]) else "medium",
            })

        formatted_web_context = f"## Live Web Intelligence ({engine_used}):\n" + "\n\n".join(lines)
        return {
            "success": True,
            "context": formatted_web_context,
            "sources": sources,
            "engine": engine_used,
        }
    except Exception as e:
        logger.error(f"Agent tool execute_web_search error: {e}")
        return {"success": False, "context": "", "sources": [], "error": str(e)}


class AgenticSearchRunner:
    """Orchestrates Agentic Reasoning Loop with Tool Calls and SSE Streaming."""

    async def run_agentic_stream(
        self,
        query: str,
        exam_type: str = "General",
        model: str = "llama-3.3-70b-versatile",
        temperature: float = 0.3,
        top_k: int = 5,
        use_live_web_search: bool = True,
        context_mode: str = "hybrid",
        chat_history: List[Dict[str, str]] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Runs agent reasoning loop:
          Step 1: Yield progress event (`agent_step`).
          Step 2: Determine tool calls (PDF Search and/or Web Search).
          Step 3: Execute tool calls and combine context.
          Step 4: Stream final synthesized briefing tokens.
        """
        all_sources = []
        combined_context = []

        # Yield initial thinking step
        yield f"data: {json.dumps({'type': 'agent_step', 'step': 'Analyzing query & routing tactical tools...'})}\n\n"

        # ── Step 1: Execute PDF Search Tool ─────────────────────────────
        if context_mode in ["hybrid", "pdf_only"]:
            yield f"data: {json.dumps({'type': 'agent_step', 'step': f'Searching {exam_type} syllabus knowledge base...'})}\n\n"
            pdf_res = execute_pdf_search(query, exam_type=exam_type, top_k=top_k)

            if pdf_res["success"] and pdf_res["context"]:
                combined_context.append(pdf_res["context"])
                all_sources.extend(pdf_res["sources"])

        # ── Step 2: Execute Web Search Tool (if enabled/needed) ──────────
        should_web = (
            use_live_web_search and context_mode in ["hybrid", "web_only"]
        )

        if should_web:
            yield f"data: {json.dumps({'type': 'agent_step', 'step': 'Searching live web across verified defense portals...'})}\n\n"
            web_res = execute_web_search(query)

            if web_res["success"] and web_res["context"]:
                combined_context.append(web_res["context"])
                all_sources.extend(web_res["sources"])

        # Send retrieved sources to UI early
        if all_sources:
            yield f"data: {json.dumps({'type': 'sources', 'sources': all_sources})}\n\n"

        # ── Step 3: Synthesize Final Briefing with LLM ───────────────────
        yield f"data: {json.dumps({'type': 'agent_step', 'step': 'Synthesizing final intelligence briefing...'})}\n\n"

        full_context_str = "\n\n---\n\n".join(combined_context)

        # Delegate final streaming generation to groq_client
        client = _get_groq_client()
        for token in client.stream_response(
            query=query,
            context=full_context_str,
            exam_type=exam_type,
            chat_history=chat_history,
            model=model,
            temperature=temperature,
        ):
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"


agentic_runner = AgenticSearchRunner()
