"""
FastAPI Backend for Defense GPT
Provides REST API endpoints for the frontend.
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, APIRouter, BackgroundTasks
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator, Field
from pathlib import Path
import shutil
import json
import asyncio
import os
import re
import logging
from threading import Lock

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO))

from backend.rag_engine import rag_engine
from backend.groq_client import groq_client
from backend.firecrawl_search import firecrawl_search
from backend.firecrawl_search import _allowed_domains
from backend.google_grounding import google_grounding_search

WEB_KEYWORDS = [
    'news', 'latest', 'current', 'today', 'event', 'update', 'breaking', 'headline', 'happening', 'recent', 'trending', 'report', 'web', 'internet', 'online'
]

TIME_INTENT_TERMS = [
    "latest", "current", "today", "now", "recent", "recently", "breaking",
    "update", "updates", "this week", "this month", "new", "as of"
]

ENTITY_TERMS = [
    "india", "indian", "jammu", "kashmir", "pakistan", "china", "usa", "russia",
    "army", "navy", "air force", "drdo", "mod", "ministry of defence", "cds",
    "general", "admiral", "marshal", "lt general", "missile", "defence", "defense",
    "ssb", "nda", "cds exam", "afcat", "upsc", "poonch", "kupwara", "srinagar",
    "loc", "border", "terror", "security", "ed", "eow",
    # Geopolitical and maritime current-affairs entities
    "strait of hormuz", "hormuz", "persian gulf", "gulf of oman", "arabian sea",
    "iran", "iraq", "israel", "middle east", "red sea", "bab el-mandeb"
]

STATIC_FACT_TERMS = [
    "what is", "define", "explain", "full form", "difference between",
    "syllabus", "formula", "meaning", "how to", "strategy", "tips for"
]

DEFENSE_EXAM_WEB_TERMS = [
    "nda", "cds", "afcat", "ssb", "upsc", "notification", "eligibility",
    "syllabus", "cutoff", "exam date", "admit card", "vacancy", "selection process"
]

RAG_CONFIDENCE_TOP_THRESHOLD = 0.82
RAG_CONFIDENCE_AVG_THRESHOLD = 0.75


def has_time_intent(query: str) -> bool:
    q = query.lower()
    return any(term in q for term in TIME_INTENT_TERMS)


def has_entity_intent(query: str) -> bool:
    q = query.lower()
    if any(term in q for term in ENTITY_TERMS):
        return True
    # Uppercase acronyms like CDS/DRDO/NDA are strong entity hints.
    return bool(re.search(r"\b[A-Z]{2,}\b", query))


def is_static_fact_query(query: str) -> bool:
    q = query.lower().strip()
    if has_time_intent(q):
        return False
    return any(term in q for term in STATIC_FACT_TERMS)


def has_high_confidence_rag(chunks: list) -> bool:
    if not chunks:
        return False
    scores = [float(getattr(c, "score", 0.0) or 0.0) for c in chunks[:3]]
    top_score = scores[0]
    avg_score = sum(scores) / len(scores)
    return top_score >= RAG_CONFIDENCE_TOP_THRESHOLD and avg_score >= RAG_CONFIDENCE_AVG_THRESHOLD


def should_use_web_search(query: str, use_live_web_search: bool, chunks: list, context_mode: str = "hybrid") -> tuple[bool, str]:
    if not use_live_web_search:
        return False, "disabled-by-user"

    if context_mode == "pdf_only":
        return False, "disabled-by-context-mode"

    if context_mode == "web_only":
        return True, "forced-web-only-mode"

    time_intent = has_time_intent(query)
    entity_intent = has_entity_intent(query)
    exam_web_intent = any(t in query.lower() for t in DEFENSE_EXAM_WEB_TERMS)
    if not ((time_intent and entity_intent) or exam_web_intent):
        return False, "requires-time-intent-and-entity"

    if is_static_fact_query(query) and has_high_confidence_rag(chunks):
        return False, "high-confidence-rag-static-query"

    return True, "enabled"


def _human_web_reason(reason: str) -> str:
    mapping = {
        "missing_firecrawl_api_key": "web search is not configured on the server",
        "no_search_results": "no recent web matches were returned",
        "filtered_by_allowed_domains": "results were outside approved study domains",
        "scrape_failed": "web pages could not be scraped at this time",
        "search_error": "web provider request failed",
        "no_usable_results": "no usable verified snippets were extracted",
        "google_grounding_disabled": "google grounding is disabled on the server",
        "missing_gemini_api_key": "gemini key is missing for grounding",
        "google_grounding_error": "google grounding request failed",
        "google_grounding_quota_exceeded": "gemini grounding quota/rate limit exceeded",
        "grounding_no_results": "google grounding returned no usable results",
        "missing_allowed_domains": "no approved domains are configured",
    }
    return mapping.get(reason, reason or "unknown")


def build_web_summary(web_results: list[dict], attempted: bool = False, web_meta: dict | None = None) -> str:
    if not web_results:
        if attempted:
            reason = _human_web_reason((web_meta or {}).get("reason", "unknown"))
            return (
                "\n\nWEB_VERIFICATION: unavailable\n"
                f"Reason: {reason}. "
                "No verified web results were retrieved for this current-affairs query. "
                "Do not present unverified latest claims as facts."
            )
        return ""
    lines = []
    for item in web_results:
        title = item.get("title", "Untitled")
        snippet = item.get("snippet", "")
        link = item.get("link", "")
        content = (item.get("content") or "").replace("\n", " ").strip()
        content = content[:220] + ("..." if len(content) > 220 else "")
        lines.append(f"- {title}: {snippet} ({link}) | Extract: {content}")
    return "\n\nWEB_VERIFICATION: available\nWeb findings:\n" + "\n".join(lines)

app = FastAPI(
    title="Defense GPT API",
    description="AI-powered Indian Defense Exam Preparation Assistant",
    version="1.0.0"
)

# CORS configuration:
# - wildcard origins cannot be used with credentials in browsers
# - enable credentials only when explicit origins are configured
cors_env = os.getenv("CORS_ORIGINS", "*")
if cors_env.strip() == "*":
    ALLOWED_ORIGINS = ["*"]
    ALLOW_CREDENTIALS = False
else:
    ALLOWED_ORIGINS = [o.strip() for o in cors_env.split(",") if o.strip()]
    ALLOW_CREDENTIALS = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)

if not ALLOW_CREDENTIALS:
    logging.info("CORS credentials disabled because CORS_ORIGINS is wildcard '*'.")

MAX_PDF_SIZE = 50 * 1024 * 1024  # 50 MB

# All API routes go under /api prefix
router = APIRouter(prefix="/api")

BASE_DIR = Path(__file__).parent.parent
PDF_DIR = BASE_DIR / "pdfs"


# ─── Request/Response Models ───

class QueryRequest(BaseModel):
    query: str
    exam_type: str = "General"
    top_k: int = 5
    source_filter: str | None = None
    chat_history: list[dict] = Field(default_factory=list)
    model: str | None = None
    temperature: float = 0.3
    image_data: str | None = None
    use_live_web_search: bool = True
    context_mode: str = "hybrid"  # hybrid | pdf_only | web_only

    @field_validator("top_k")
    @classmethod
    def clamp_top_k(cls, v):
        return max(1, min(v, 20))

    @field_validator("temperature")
    @classmethod
    def clamp_temperature(cls, v):
        return max(0.0, min(v, 1.0))

    @field_validator("context_mode")
    @classmethod
    def validate_context_mode(cls, v):
        allowed = {"hybrid", "pdf_only", "web_only"}
        if v not in allowed:
            return "hybrid"
        return v


class QueryResponse(BaseModel):
    answer: str
    sources: list[dict]
    model_used: str


class StatsResponse(BaseModel):
    total_chunks: int
    total_pdfs: int
    pdf_names: list[str]


class QuizRequest(BaseModel):
    exam_type: str = "NDA"
    topic: str = "General Knowledge"
    num_questions: int = 5
    difficulty: str = "Medium"

class QuizQuestion(BaseModel):
    id: int
    text: str
    options: list[str]
    correct_answer: str
    explanation: str

class QuizResponse(BaseModel):
    title: str
    questions: list[QuizQuestion]


# ─── Root health check (for Render/deployment probes) ───

@app.get("/")
def root_health():
    return {"message": "Defense GPT API is running!", "version": "1.0.0"}


# ─── Endpoints ───

@router.get("/")
def root():
    return {"message": "Defense GPT API is running!", "version": "1.0.0"}


@router.get("/health")
def health():
    return {"status": "healthy"}


@router.post("/ask", response_model=QueryResponse)
def ask_question(request: QueryRequest):
    """Ask a question to Defense GPT with RAG-powered context and web search if needed."""
    try:
        # Step 1: Retrieve relevant content from knowledge base
        context = ""
        chunks = []
        if request.context_mode != "web_only":
            context, chunks = rag_engine.build_context(
                query=request.query,
                top_k=request.top_k,
                source_filter=request.source_filter,
            )
        logging.debug("Retrieved %d RAG chunks for query.", len(chunks))
        web_results = []
        web_meta = {}
        logging.debug(f"Received query: {request.query}")
        web_attempted, web_reason = should_use_web_search(
            request.query,
            request.use_live_web_search,
            chunks,
            request.context_mode,
        )
        logging.debug(f"Web fetch decision: attempted={web_attempted}, reason={web_reason}")
        if web_attempted:
            logging.debug("Web fetch triggered.")
            allowed_domains = _allowed_domains()
            web_results, web_meta = google_grounding_search(
                request.query,
                limit=3,
                allowed_domains=allowed_domains,
                return_meta=True,
            )
            if not web_results:
                fallback_results, fallback_meta = firecrawl_search(request.query, return_meta=True)
                if fallback_results:
                    web_results = fallback_results
                    web_meta = {"status": "ok", "reason": "firecrawl_fallback_success"}
                else:
                    web_meta = fallback_meta or web_meta
            logging.debug(f"Web results: {web_results}")
        # Step 2: Generate response via Groq, blending web results if present
        web_summary = build_web_summary(web_results, attempted=web_attempted, web_meta=web_meta)
        answer = groq_client.generate_response(
            query=request.query,
            context=context + web_summary,
            exam_type=request.exam_type,
            chat_history=request.chat_history,
            model=request.model,
            temperature=request.temperature,
            image_data=request.image_data,
        )
        if isinstance(answer, str) and answer.startswith("Error generating response:"):
            raise RuntimeError(answer)
        logging.debug(f"LLM answer: {answer}")
        # Step 3: Format sources
        sources = [
            {
                "source": c.source,
                "page": c.page,
                "score": c.score,
                "preview": c.text[:200] + "..." if len(c.text) > 200 else c.text
            }
            for c in chunks
        ]
        if web_results:
            import json
            sources.append({
                "source": "web",
                "page": None,
                "score": None,
                "preview": json.dumps(web_results)
            })
        return QueryResponse(
            answer=answer,
            sources=sources,
            model_used=request.model or groq_client.default_model
        )
    except Exception as e:
        logging.error(f"ask_question error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quiz/generate", response_model=QuizResponse)
def generate_quiz(request: QuizRequest):
    """Generate a tactical quiz using RAG context if available, returning strict JSON."""
    try:
        # Build prompt dynamic search context
        search_query = f"{request.exam_type} {request.topic} syllabus questions and formulas"
        context, _ = rag_engine.build_context(query=search_query, top_k=5)

        system_prompt = f"""You are an elite Defense Exam Quiz Generator. You must output ONLY valid JSON.
Your task is to generate a {request.num_questions}-question multiple choice quiz for the {request.exam_type} exam on the topic "{request.topic}".
The difficulty should be {request.difficulty.upper()}.

"""
        if context:
            system_prompt += f"Use the following study material as a factual basis if relevant:\n{context}\n\n"

        system_prompt += """Return a JSON object with this exact structure:
{
  "title": "Exam Topic Quiz Title",
  "questions": [
    {
      "id": 1,
      "text": "Clearly worded question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A",
      "explanation": "Brief explanation of why the answer is correct."
    }
  ]
}
Ensure there are exactly %d questions. The options array must contain exactly 4 strings. The correct_answer must exactly match one of the string elements in the options array.
""" % request.num_questions

        json_str = groq_client.generate_json(system_prompt=system_prompt)
        quiz_data = json.loads(json_str)
        return QuizResponse(**quiz_data)

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"LLM failed to output valid JSON: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {str(e)}")


@router.get("/stats", response_model=StatsResponse)
def get_stats():
    """Get knowledge base statistics."""
    stats = rag_engine.get_stats()
    return StatsResponse(**stats)


def _sanitize_filename(filename: str) -> str:
    """Sanitize uploaded filename to prevent path traversal."""
    # Take only the basename, strip path separators
    name = os.path.basename(filename)
    # Remove any non-alphanumeric characters except dot, hyphen, underscore, space
    name = re.sub(r'[^\w.\- ]', '_', name)
    if not name.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    return name


@router.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    """Upload a PDF to the knowledge base."""
    safe_name = _sanitize_filename(file.filename or "upload.pdf")
    
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    file_path = PDF_DIR / safe_name
    
    try:
        # Stream upload to disk with size checks to avoid loading full file into memory.
        total_size = 0
        chunk_size = 1024 * 1024
        with file_path.open("wb") as out:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > MAX_PDF_SIZE:
                    out.close()
                    if file_path.exists():
                        file_path.unlink()
                    raise HTTPException(status_code=413, detail="File too large (max 50 MB)")
                out.write(chunk)
        return {"message": f"Uploaded {safe_name}", "filename": safe_name}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


_INGEST_LOCK = Lock()
_INGEST_IN_PROGRESS = False


def _run_ingestion_job():
    global _INGEST_IN_PROGRESS
    try:
        from backend.pdf_ingestion import ingest_pdfs as run_ingestion
        run_ingestion()
    finally:
        with _INGEST_LOCK:
            _INGEST_IN_PROGRESS = False


@router.post("/ingest")
def trigger_ingest(background_tasks: BackgroundTasks):
    """Trigger PDF ingestion into the vector database."""
    global _INGEST_IN_PROGRESS
    try:
        with _INGEST_LOCK:
            if _INGEST_IN_PROGRESS:
                return {"message": "Ingestion already running"}
            _INGEST_IN_PROGRESS = True
        background_tasks.add_task(_run_ingestion_job)
        return {"message": "Ingestion started"}
    except Exception as e:
        with _INGEST_LOCK:
            _INGEST_IN_PROGRESS = False
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models")
def get_models():
    """Get available LLM models."""
    return {
        "models": groq_client.get_available_models(),
        "default": groq_client.default_model,
    }


@router.get("/pdfs")
def list_pdfs():
    """List uploaded PDFs."""
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    pdfs = [f.name for f in PDF_DIR.glob("*.pdf")]
    return {"pdfs": pdfs, "count": len(pdfs)}


@router.delete("/pdfs/{filename}")
def delete_pdf(filename: str):
    """Delete a PDF from the knowledge base."""
    safe_name = os.path.basename(filename)
    file_path = PDF_DIR / safe_name
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="PDF not found")
    file_path.unlink()
    return {"message": f"Deleted {safe_name}"}


@router.post("/ask/stream")
async def ask_stream(request: QueryRequest):
    """Stream a response token-by-token using SSE."""
    context = ""
    chunks = []
    if request.context_mode != "web_only":
        try:
            # Run the CPU-heavy/blocking embedding function in a thread
            context, chunks = await asyncio.to_thread(
                rag_engine.build_context,
                query=request.query,
                top_k=request.top_k,
                source_filter=request.source_filter,
            )
        except Exception as e:
            logging.warning("RAG retrieval failed in /ask/stream: %s", e)

    web_results = []
    web_meta = {}
    web_attempted, web_reason = should_use_web_search(
        request.query,
        request.use_live_web_search,
        chunks,
        request.context_mode,
    )
    logging.debug(f"Web fetch decision (/ask/stream): attempted={web_attempted}, reason={web_reason}")
    try:
        if web_attempted:
            allowed_domains = _allowed_domains()
            web_results, web_meta = await asyncio.to_thread(
                google_grounding_search, request.query, 3, allowed_domains, True
            )
            if not web_results:
                fallback_results, fallback_meta = await asyncio.to_thread(
                    firecrawl_search, request.query, 3, True
                )
                if fallback_results:
                    web_results = fallback_results
                    web_meta = {"status": "ok", "reason": "firecrawl_fallback_success"}
                else:
                    web_meta = fallback_meta or web_meta
    except Exception as e:
        logging.warning("Web search failed in /ask/stream: %s", e)

    context = (context or "") + build_web_summary(
        web_results, attempted=web_attempted, web_meta=web_meta
    )

    sources = [
        {
            "source": c.source,
            "page": c.page,
            "score": c.score,
            "preview": c.text[:200] + "..." if len(c.text) > 200 else c.text
        }
        for c in chunks
    ]
    if web_results:
        sources.append({
            "source": "web",
            "page": None,
            "score": None,
            "preview": json.dumps(web_results)
        })

    async def event_stream():
        # Send sources first
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

        # Stream LLM tokens — run sync iterator in a thread
        try:
            loop = asyncio.get_running_loop()
            queue: asyncio.Queue = asyncio.Queue()

            def _run_sync_stream():
                try:
                    for token in groq_client.stream_response(
                        query=request.query,
                        context=context,
                        exam_type=request.exam_type,
                        chat_history=request.chat_history,
                        model=request.model,
                        temperature=request.temperature,
                        image_data=request.image_data,
                    ):
                        loop.call_soon_threadsafe(queue.put_nowait, ("token", token))
                    loop.call_soon_threadsafe(queue.put_nowait, ("done", None))
                except Exception as e:
                    loop.call_soon_threadsafe(queue.put_nowait, ("error", str(e)))

            loop.run_in_executor(None, _run_sync_stream)

            full_answer = ""
            while True:
                kind, value = await queue.get()
                if kind == "token":
                    full_answer += value
                    yield f"data: {json.dumps({'type': 'token', 'content': value})}\n\n"
                elif kind == "error":
                    yield f"data: {json.dumps({'type': 'error', 'content': value})}\n\n"
                    break
                elif kind == "done":
                    break

            # Generate follow-up suggestions
            try:
                suggestions = await loop.run_in_executor(
                    None,
                    lambda: groq_client.generate_suggestions(
                        request.query, full_answer, request.exam_type
                    ),
                )
                if suggestions:
                    yield f"data: {json.dumps({'type': 'suggestions', 'suggestions': suggestions})}\n\n"
            except Exception:
                pass

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/web/sources")
def web_sources():
    """Expose approved defense-study web domains used for web context retrieval."""
    domains = _allowed_domains()
    rows = []
    for d in domains:
        trust = "high" if d.endswith(("gov.in", "nic.in", "cdac.in")) else "medium"
        rows.append({"domain": d, "trust": trust})
    return {"domains": rows, "count": len(rows)}


@router.get("/web/debug")
def web_debug(query: str, limit: int = 3):
    """
    Debug helper to inspect web retrieval behavior.
    Returns retriever selection, reasons, and top normalized results.
    """
    capped_limit = max(1, min(limit, 8))
    domains = _allowed_domains()

    primary_results, primary_meta = google_grounding_search(
        query=query,
        limit=capped_limit,
        allowed_domains=domains,
        return_meta=True,
    )

    used = "google_grounding"
    fallback_meta = None
    final_results = primary_results

    if not primary_results:
        used = "firecrawl_fallback"
        fallback_results, fallback_meta = firecrawl_search(
            query=query, limit=capped_limit, return_meta=True
        )
        final_results = fallback_results

    return {
        "query": query,
        "limit": capped_limit,
        "used_retriever": used,
        "result_count": len(final_results),
        "primary_meta": primary_meta,
        "fallback_meta": fallback_meta,
        "results": final_results,
    }


# Register API router
app.include_router(router)

# Serve React frontend (mount LAST so API routes take priority)
FRONTEND_DIR = BASE_DIR / "frontend" / "dist"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
