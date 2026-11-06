---
title: Defense GPT — Indian Defense Exam Preparation AI
emoji: "🎖️"
colorFrom: green
colorTo: blue
sdk: docker
sdk_version: "0.0.0"
app_file: Dockerfile
pinned: false
---

# 🎖️ Defense GPT — Indian Defense Exam Preparation AI

An AI-powered study assistant built with **RAG (Retrieval-Augmented Generation)** to help you ace Indian defense exams. Just drop your study PDFs and start asking questions!

## Architecture Update 🚀
Defense GPT has been upgraded to a full production-ready cloud architecture:
- **Backend (API & RAG)**: Deployed on **Hugging Face Spaces** (Docker, 16GB RAM) to handle PyTorch ML models without OOM or cold-boot freezing.
- **Frontend (UI)**: Deployed on **Vercel** for lightning-fast edge delivery.
- **Vector Database**: Migrated from local ChromaDB to **MongoDB Atlas Vector Search** for scalable, cloud-hosted embeddings.

## Tech Stack
- **LLM & Multimodal Vision**: Groq (`openai/gpt-oss-20b`, `meta-llama/llama-4-scout-17b-16e-instruct`, `qwen/qwen3.8-27b`)
- **RAG Datastore**: MongoDB Atlas Vector Search
- **Embeddings**: `all-MiniLM-L6-v2` via PyTorch (`sentence-transformers`)
- **Web Intelligence**: Scrapling (stealth search & adaptive scraping with zero third-party API keys)
- **Backend**: FastAPI + Uvicorn (Dockerized for Hugging Face Spaces)
- **Frontend**: Next.js 14 + NextAuth + Tailwind CSS (Deployed on Vercel)

## Deployment Guide

### 1. Backend Integration (Hugging Face Spaces)
The backend runs in a Docker container on Hugging Face Spaces with sufficient RAM for PyTorch embeddings:
1. Create a **Docker Space** on Hugging Face.
2. Link this GitHub repository.
3. Configure the following in your Space **Settings › Variables and Secrets**:
   - `MONGODB_URI`: Full MongoDB Atlas connection string (`mongodb+srv://...`)
   - `LLM_PROVIDER`: `groq`
   - `GROQ_API_KEY`: Your Groq API key (handles both text generation and multimodal vision)
   - `GROQ_MODEL`: Default text model (e.g. `openai/gpt-oss-20b`)
   - `GROQ_VISION_MODEL`: Default multimodal vision model (`meta-llama/llama-4-scout-17b-16e-instruct`)
   - `CORS_ORIGINS`: `*` or your Vercel deployment URL (e.g. `https://your-defensegpt.vercel.app`)
   - `GEMINI_API_KEY` *(optional)*: Secondary fallback for multimodal queries if desired

### 2. Frontend Integration (Vercel)
Deploy the `frontend` directory on Vercel. 
Configure the following Environment Variables in Vercel:
- `NEXT_PUBLIC_API_URL`: Your Hugging Face Space URL (e.g. `https://username-defensegpt.hf.space`)
- `MONGODB_URI`: Full MongoDB Atlas Connection String
- `NEXTAUTH_URL`: Your Vercel production domain (e.g. `https://your-defensegpt.vercel.app`)
- `NEXTAUTH_SECRET`: Random 32-char string (`openssl rand -base64 32`)
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
