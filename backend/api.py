"""
FastAPI Backend for Defense GPT
Provides REST API endpoints for the frontend.
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, APIRouter
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator
from pathlib import Path
import shutil
import json
import asyncio
import os
import re

from backend.rag_engine import rag_engine
from backend.groq_client import groq_client

app = FastAPI(
    title="Defense GPT API",
    description="AI-powered Indian Defense Exam Preparation Assistant",
    version="1.0.0"
)

# CORS — allow all origins by default in production to easily connect Vercel
cors_env = os.getenv("CORS_ORIGINS", "*")
ALLOWED_ORIGINS = ["*"] if cors_env == "*" else cors_env.split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    chat_history: list[dict] = []
    model: str | None = None
    temperature: float = 0.3
    image_data: str | None = None

    @field_validator("top_k")
    @classmethod
    def clamp_top_k(cls, v):
        return max(1, min(v, 20))

    @field_validator("temperature")
    @classmethod
    def clamp_temperature(cls, v):
        return max(0.0, min(v, 1.0))


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
    """Ask a question to Defense GPT with RAG-powered context."""
    try:
        # Step 1: Retrieve relevant content from knowledge base
        context, chunks = rag_engine.build_context(
            query=request.query,
            top_k=request.top_k,
            source_filter=request.source_filter,
        )
        
        # Step 2: Generate response via Groq
        answer = groq_client.generate_response(
            query=request.query,
            context=context,
            exam_type=request.exam_type,
            chat_history=request.chat_history,
            model=request.model,
            temperature=request.temperature,
            image_data=request.image_data,
        )
        
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
        
        return QueryResponse(
            answer=answer,
            sources=sources,
            model_used=request.model or groq_client.default_model
        )
    except Exception as e:
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
        # Read with size limit
        content = await file.read()
        if len(content) > MAX_PDF_SIZE:
            raise HTTPException(status_code=413, detail="File too large (max 50 MB)")
        file_path.write_bytes(content)
        return {"message": f"Uploaded {safe_name}", "filename": safe_name}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingest")
def trigger_ingest():
    """Trigger PDF ingestion into the vector database."""
    try:
        from backend.pdf_ingestion import ingest_pdfs as run_ingestion
        run_ingestion()
        stats = rag_engine.get_stats()
        return {"message": "Ingestion complete!", "stats": stats}
    except Exception as e:
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
    context, chunks = rag_engine.build_context(
        query=request.query,
        top_k=request.top_k,
        source_filter=request.source_filter,
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


# Register API router
app.include_router(router)

# Serve React frontend (mount LAST so API routes take priority)
FRONTEND_DIR = BASE_DIR / "frontend" / "dist"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
