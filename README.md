# 🎖️ Defense GPT — Indian Defense Exam Preparation AI

An AI-powered study assistant built with **RAG (Retrieval-Augmented Generation)** to help you ace Indian defense exams. Just drop your study PDFs and start asking questions!

## Supported Exams
- **NDA** (National Defence Academy)
- **CDS** (Combined Defence Services)
- **AFCAT** (Air Force Common Admission Test)
- **Indian Navy** (SSR/AA/MR)
- **Territorial Army**
- **CAPF** (Central Armed Police Forces)
- **ACC** (Army Cadet College)

## Tech Stack
- **LLM**: Groq API (Llama 3.3 70B) or Google Gemini (configurable)
- **RAG**: ChromaDB + Sentence Transformers
- **PDF Processing**: PyMuPDF + pdfplumber
- **Backend**: FastAPI
- **Frontend**: Next.js 14 + NextAuth + Tailwind CSS
- **Alt Frontend**: Streamlit (legacy)
- **Embeddings**: all-MiniLM-L6-v2

## Quick Start

### 1. Install Backend Dependencies
```bash
cd defense-gpt
pip install -r requirements.txt
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env and set your LLM provider + API key
# Groq (default): get free key at https://console.groq.com/keys
# Gemini (alt):   get free key at https://aistudio.google.com/apikey
```

### 3. Add Your PDFs
```bash
# Drop your study material PDFs into the /pdfs folder
# NDA books, CDS papers, GK notes, anything!
```

### 4. Ingest PDFs
```bash
python ingest.py
```

### 5. Start the Backend
```bash
uvicorn backend.api:app --reload --port 8000
```

### 6. Start the Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local  # Edit with your NextAuth + Google OAuth secrets
npm run dev
```

Visit **http://localhost:3000** — the frontend proxies API calls to `localhost:8000`.

### Alternative: Streamlit UI
```bash
streamlit run app.py
```

## Project Structure
```
defense-gpt/
├── app.py                  # Streamlit frontend (alternative UI)
├── ingest.py               # PDF ingestion script
├── requirements.txt
├── .env                    # LLM config (create from .env.example)
├── .env.example
├── backend/
│   ├── api.py              # FastAPI REST endpoints
│   ├── groq_client.py      # LLM client (supports Groq & Gemini)
│   ├── rag_engine.py       # RAG pipeline (ChromaDB + embeddings)
│   └── pdf_ingestion.py    # PDF extraction & chunking
├── frontend/               # Next.js 14 frontend
│   ├── src/
│   │   ├── app/            # Pages (landing, login, signup, chat)
│   │   ├── components/     # React components
│   │   └── lib/            # API client, auth config, chat store
│   └── .env.local          # NextAuth secrets (create from template)
├── pdfs/                   # Drop your PDF study materials here
└── chroma_db/              # Vector database (auto-generated)
```

## How It Works
1. **Drop PDFs** — Add any defense exam study material to `/pdfs` folder
2. **Ingest** — PDFs are extracted, chunked, embedded, and stored in ChromaDB
3. **Ask** — Type any question about any topic
4. **RAG Retrieval** — System finds the most relevant chunks from your PDFs
5. **LLM** — Generates precise, exam-focused answers with source references
6. **Study** — Structured response with key points, exam tips, and practice MCQs

## Features
- 📄 **PDF-based RAG** — Your own study material powers the AI
- 🎯 **Exam-specific mode** — Select NDA/CDS/AFCAT for tailored answers
- 📝 **Practice MCQs** — Auto-generated questions after each explanation
- ⚡ **Ultra-fast** — Groq gives responses in ~1 second
- 🔍 **Source references** — See exactly which PDF page the answer came from
- 📤 **Upload from UI** — Drag & drop PDFs directly in the app
- 🔄 **Smart ingestion** — Only processes new/changed PDFs
- 💬 **Chat memory** — Multi-turn conversations for deep topic exploration
- 🛑 **Stop generation** — Cancel AI responses mid-stream
- 🔒 **Auth** — NextAuth with Google OAuth + credentials (demo mode)

## LLM Provider Configuration

Set `LLM_PROVIDER` in `.env`:

| Provider | Env Var | Default Model |
|----------|---------|---------------|
| `groq` (default) | `GROQ_API_KEY` | llama-3.3-70b-versatile |
| `gemini` | `GEMINI_API_KEY` | gemini-2.0-flash |

## Auth Note

Authentication uses NextAuth with a **demo credentials provider** that accepts any email + 6-char password. For production, replace with a real user database (Prisma + bcrypt recommended).
