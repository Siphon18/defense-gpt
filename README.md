# 🎖️ Defense GPT — Indian Defense Exam Preparation AI

An AI-powered study assistant built with **RAG (Retrieval-Augmented Generation)** to help you ace Indian defense exams. Just drop your study PDFs and start asking questions!

## Architecture Update 🚀
Defense GPT has been upgraded to a full production-ready cloud architecture:
- **Backend (API & RAG)**: Deployed on **Hugging Face Spaces** (Docker, 16GB RAM) to handle PyTorch ML models without OOM or cold-boot freezing.
- **Frontend (UI)**: Deployed on **Vercel** for lightning-fast edge delivery.
- **Vector Database**: Migrated from local ChromaDB to **MongoDB Atlas Vector Search** for scalable, cloud-hosted embeddings.

## Tech Stack
- **LLM**: Groq (Llama 3) or Google Gemini (configurable)
- **RAG Datastore**: MongoDB Atlas Vector Search
- **Embeddings**: `all-MiniLM-L6-v2` via PyTorch (`sentence-transformers`)
- **Backend**: FastAPI + Uvicorn
- **Frontend**: Next.js 14 + NextAuth + Tailwind CSS

## Deployment Guide

### 1. Backend Integration (Hugging Face Spaces)
The backend requires a machine with sufficient RAM to dynamically load ML models. 
1. Create a **Docker Space** on Hugging Face.
2. Link this GitHub repository.
3. Add the following to your Space **Secrets**:
   - `MONGODB_URI`
   - `LLM_PROVIDER` (set `groq` for Groq-only mode)
   - `GROQ_API_KEY`
   - `GROQ_MODEL`
   - `FIRECRAWL_API_KEY` (for web search augmentation)
   - `GEMINI_API_KEY` and `GEMINI_MODEL` (optional, only needed for image prompts)

### 2. Frontend Integration (Vercel)
Deploy the `frontend` directory using Vercel. 
Configure the following Environment Variables in Vercel:
- `NEXT_PUBLIC_API_URL`: Your Hugging Face Space URL (e.g. `https://username-defense-gpt-api.hf.space`)
- `MONGODB_URI`: Full MongoDB Connection String
- `NEXTAUTH_SECRET`: Random 32-char string
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: For Google OAuth Login

*(Note: Don't forget to whitelist your new Vercel domain in your Google Cloud Console OAuth Authorized Redirect URIs).*

## Local Development Quick Start

### 1. Ingest Study Materials
Copy your target PDFs into the root `/pdfs` folder, then run:
```bash
python ingest.py
```
*(This extracts, chunks, generates embeddings for the PDFs, and safely uploads them to your MongoDB Atlas cluster).*

### 2. Start the Backend
```bash
pip install -r requirements.txt
cp .env.example .env # Configure your keys
uvicorn backend.api:app --reload --port 8000
```

### 3. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```

Visit **http://localhost:3000** — the frontend proxies API calls to `localhost:8000` via Next.js rewrites when running locally in development mode.

## Features
- 📄 **PDF-based RAG** — Your own study material powers the AI via MongoDB Vector Search
- 🎯 **Exam-specific mode** — Select NDA/CDS/AFCAT for tailored answers
- 📝 **Practice MCQs** — Auto-generated questions after each explanation
- ⚡ **Ultra-fast** — Groq gives responses in ~1 second
- 🔍 **Source references** — See exactly which PDF page the answer came from
- 🔄 **Smart ingestion** — Only processes new/changed PDFs automatically
- 💬 **Chat memory** — Multi-turn conversations for deep topic exploration
- 🛑 **Stop generation** — Cancel AI responses mid-stream
- 🔒 **Auth** — NextAuth with Google OAuth + credentials

## Auth Note
Authentication uses NextAuth with a **demo credentials provider** that accepts any email + 6-char password. For production, Google OAuth is fully integrated.
