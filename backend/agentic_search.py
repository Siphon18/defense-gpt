"""
Agentic Search Module for Defense GPT
Implements Adaptive RAG with Tool-Calling & Reasoning Loop.
Tools:
  1. pdf_rag_search: Vector Search over syllabus PDFs in MongoDB Atlas
  2. web_search: Real-time search using Scrapeling (no domain restrictions)
"""

import json
import logging
import os
from typing import AsyncGenerator, Dict, Any, List
from dotenv import load_dotenv

from backend.rag_engine import rag_engine
from backend.scrapeling_scraper import web_search as scrapeling_web_search

load_dotenv()
logger = logging.getLogger(__name__)

def _get_groq_client():
    from backend.groq_client import groq_client
    return groq_client


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
            "chunks": chunks,
            "chunks_found": len(chunks),
        }
    except Exception as e:
        logger.error(f"Agent tool execute_pdf_search error: {e}")
        return {"success": False, "context": "", "sources": [], "chunks": [], "error": str(e)}


def execute_web_search(query: str) -> Dict[str, Any]:
    """Execute Live Web Search tool using Scrapeling with no domain restrictions."""
    try:
        items = scrapeling_web_search(query, limit=5)
        engine_used = "scrapeling/duckduckgo"

        if not items:
            return {
                "success": False,
                "context": "WEB_VERIFICATION: unavailable (no results found for query)",
                "sources": [],
            }

        lines = []
        sources = []
        for idx, item in enumerate(items, 1):
            title = item.get("title") or "Web Intel"
            snippet = item.get("snippet") or item.get("content") or ""
            link = item.get("link") or ""
            trust = item.get("trust", "medium")
            lines.append(f"[{idx}] {title}\nSnippet: {snippet}\nURL: {link}")

            sources.append({
                "source": "web",
                "title": title,
                "preview": snippet[:200],
                "link": link,
                "trust": trust,
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
    """Orchestrates Agentic Reasoning Loop with Smart Vector DB Priority & Adaptive Web Fallback."""

    async def run_agentic_stream(
        self,
        query: str,
        exam_type: str = "General",
        model: str = "auto",
        temperature: float = None,
        top_k: int = 5,
        use_live_web_search: bool = True,
        context_mode: str = "hybrid",
        chat_history: List[Dict[str, str]] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Runs agent reasoning loop:
          Step 1: Execute Vector DB search first.
          Step 2: Evaluate vector results. Web Search runs ONLY if vector results are insufficient or query has real-time current affairs intent.
          Step 3: Auto-route model & synthesize final briefing tokens.
          Step 4: Yield follow-up suggestions and done signal.
        """
        all_sources = []
        combined_context = []
        chunks = []

        # Yield initial thinking step
        yield f"data: {json.dumps({'type': 'agent_step', 'step': 'Analyzing query intent & knowledge base...'})}\n\n"

        # ── Step 1: Execute PDF Vector DB Search Tool ────────────────────
        if context_mode in ["auto", "hybrid", "pdf_only"]:
            yield f"data: {json.dumps({'type': 'agent_step', 'step': f'Searching {exam_type} syllabus knowledge base...'})}\n\n"
            pdf_res = execute_pdf_search(query, exam_type=exam_type, top_k=top_k)

            if pdf_res["success"] and pdf_res["context"]:
                combined_context.append(pdf_res["context"])
                all_sources.extend(pdf_res["sources"])
                chunks = pdf_res.get("chunks", [])

        # ── Step 2: Adaptive Web Search Decision (Run ONLY if needed) ─────
        from backend.api import should_use_web_search
        web_needed, reason = should_use_web_search(
            query=query,
            use_live_web_search=use_live_web_search,
            chunks=chunks,
            context_mode=context_mode,
        )

        if web_needed:
            yield f"data: {json.dumps({'type': 'agent_step', 'step': 'Searching live web for verified updates...'})}\n\n"
            web_res = execute_web_search(query)

            if web_res["success"] and web_res["context"]:
                combined_context.append(web_res["context"])
                all_sources.extend(web_res["sources"])
        else:
            logger.info(f"Agentic Search skipped web search: reason={reason}")

        # Send retrieved sources to UI early
        if all_sources:
            yield f"data: {json.dumps({'type': 'sources', 'sources': all_sources})}\n\n"

        # ── Step 3: Synthesize Final Briefing with Auto-Routed LLM ───────
        yield f"data: {json.dumps({'type': 'agent_step', 'step': 'Synthesizing response...'})}\n\n"

        full_context_str = "\n\n---\n\n".join(combined_context)

        client = _get_groq_client()
        full_answer = ""
        for token in client.stream_response(
            query=query,
            context=full_context_str,
            exam_type=exam_type,
            chat_history=chat_history,
            model=model,
            temperature=temperature,
        ):
            full_answer += token
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        # ── Step 4: Follow-up Suggestions & Completion Signal ────────────
        try:
            suggestions = client.generate_suggestions(query, full_answer, exam_type)
            if suggestions:
                yield f"data: {json.dumps({'type': 'suggestions', 'suggestions': suggestions})}\n\n"
        except Exception as e:
            logger.debug(f"Failed to generate suggestions: {e}")

        yield f"data: {json.dumps({'type': 'done'})}\n\n"


agentic_runner = AgenticSearchRunner()
