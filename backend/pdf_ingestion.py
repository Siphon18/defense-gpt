"""
PDF Ingestion Pipeline for Defense GPT
Reads PDFs from the /pdfs folder, extracts text, chunks it,
generates embeddings, and stores in MongoDB Atlas.
"""

import os
import sys
import gc
import fitz  # PyMuPDF
import pdfplumber
from pathlib import Path
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pymongo import MongoClient, UpdateOne
from sentence_transformers import SentenceTransformer
import hashlib
import re
from dotenv import load_dotenv

load_dotenv()

# Directories
BASE_DIR = Path(__file__).parent.parent
PDF_DIR = BASE_DIR / "pdfs"

# MongoDB
MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = "defensegpt"
COLLECTION_NAME = "chunks"


def extract_text_pymupdf(pdf_path: str) -> list[dict]:
    """Extract text from PDF using PyMuPDF (fast, good for text-heavy PDFs)."""
    doc = fitz.open(pdf_path)
    pages = []
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        text = page.get_text("text")
        if text.strip():
            pages.append({
                "text": text.strip(),
                "page": page_num + 1,
                "source": os.path.basename(pdf_path)
            })
    doc.close()
    return pages


def extract_text_pdfplumber(pdf_path: str) -> list[dict]:
    """Extract text using pdfplumber (better for tables/structured content)."""
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text and text.strip():
                pages.append({
                    "text": text.strip(),
                    "page": page_num + 1,
                    "source": os.path.basename(pdf_path)
                })

            # Also extract tables if present
            tables = page.extract_tables()
            for table in tables:
                table_text = "\n".join(
                    [" | ".join([cell or "" for cell in row]) for row in table if row]
                )
                if table_text.strip():
                    pages.append({
                        "text": f"[TABLE]\n{table_text.strip()}",
                        "page": page_num + 1,
                        "source": os.path.basename(pdf_path)
                    })
    return pages


def extract_text_from_pdf(pdf_path: str) -> list[dict]:
    """Try PyMuPDF first, fall back to pdfplumber if needed."""
    try:
        pages = extract_text_pymupdf(pdf_path)
        if pages:
            return pages
    except Exception as e:
        print(f"  PyMuPDF failed for {pdf_path}: {e}")

    try:
        pages = extract_text_pdfplumber(pdf_path)
        if pages:
            return pages
    except Exception as e:
        print(f"  pdfplumber also failed for {pdf_path}: {e}")

    return []


def clean_text(text: str) -> str:
    """Clean extracted text."""
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'Page \d+ of \d+', '', text)
    text = re.sub(r'www\.\S+', '', text)
    text = re.sub(r' {2,}', ' ', text)
    return text.strip()


def chunk_documents(pages: list[dict], chunk_size: int = 800, chunk_overlap: int = 200) -> list[dict]:
    """Split extracted pages into smaller chunks for better retrieval."""
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", ", ", " ", ""],
        length_function=len,
    )

    chunks = []
    for page_data in pages:
        cleaned = clean_text(page_data["text"])
        if len(cleaned) < 50:
            continue

        splits = text_splitter.split_text(cleaned)
        for i, split in enumerate(splits):
            chunk_id = hashlib.md5(f"{page_data['source']}_{page_data['page']}_{i}".encode()).hexdigest()
            chunks.append({
                "chunk_id": chunk_id,
                "text": split,
                "source": page_data["source"],
                "page": page_data["page"],
                "chunk_index": i,
            })

    return chunks


def get_file_hash(filepath: str) -> str:
    """Get MD5 hash of a file to detect changes."""
    hasher = hashlib.md5()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            hasher.update(chunk)
    return hasher.hexdigest()


def ingest_pdfs(force: bool = False):
    """
    Main ingestion function.
    Scans /pdfs folder, extracts text, chunks it, and stores in MongoDB Atlas.

    Args:
        force: If True, re-ingest all PDFs even if already processed.
    """
    PDF_DIR.mkdir(parents=True, exist_ok=True)

    # Find all PDFs
    pdf_files = list(PDF_DIR.glob("*.pdf"))
    if not pdf_files:
        print("=" * 60)
        print("  No PDFs found!")
        print(f"  Please add your PDF files to: {PDF_DIR}")
        print("  Supported: NDA, CDS, AFCAT study materials,")
        print("  previous year papers, GK books, etc.")
        print("=" * 60)
        return

    print(f"\n📄 Found {len(pdf_files)} PDF(s) in {PDF_DIR}\n")

    # Initialize embedding model
    print("🔄 Loading embedding model (all-MiniLM-L6-v2)...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    print("✅ Embedding model loaded!\n")

    # Connect to MongoDB
    print("🔄 Connecting to MongoDB Atlas...")
    client = MongoClient(MONGODB_URI)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]
    ingestion_meta = db["ingestion_log"]
    print("✅ Connected to MongoDB Atlas!\n")

    total_chunks = 0

    for pdf_path in pdf_files:
        filename = pdf_path.name
        file_hash = get_file_hash(str(pdf_path))

        # Skip if already fully ingested (unless forced)
        if not force:
            existing = ingestion_meta.find_one({"filename": filename, "hash": file_hash})
            if existing and existing.get("status") != "partial":
                print(f"⏭️  Skipping {filename} (already ingested)")
                continue

        print(f"📖 Processing: {filename}")

        # Step 1: Extract text
        print(f"   Extracting text...")
        pages = extract_text_from_pdf(str(pdf_path))
        if not pages:
            print(f"   ⚠️  No text extracted from {filename}")
            continue
        print(f"   Found {len(pages)} pages with text")

        # Step 2: Chunk the text
        print(f"   Chunking text...")
        chunks = chunk_documents(pages)
        print(f"   Created {len(chunks)} chunks")

        if not chunks:
            continue

        # If forcing, delete old chunks for this file first
        if force:
            deleted = collection.delete_many({"source": filename})
            print(f"   Cleared {deleted.deleted_count} old chunks")

        # Step 3: Generate embeddings and store in MongoDB
        print(f"   Generating embeddings & storing in MongoDB...")

        batch_size = 25
        total_batches = (len(chunks) + batch_size - 1) // batch_size

        for batch_idx in range(total_batches):
            i = batch_idx * batch_size
            batch = chunks[i:i + batch_size]

            texts = [c["text"] for c in batch]
            embeddings = model.encode(texts).tolist()

            # Build bulk upsert operations
            operations = []
            for chunk_data, embedding in zip(batch, embeddings):
                operations.append(
                    UpdateOne(
                        {"chunk_id": chunk_data["chunk_id"]},
                        {"$set": {
                            "chunk_id": chunk_data["chunk_id"],
                            "text": chunk_data["text"],
                            "source": chunk_data["source"],
                            "page": chunk_data["page"],
                            "chunk_index": chunk_data["chunk_index"],
                            "embedding": embedding,
                            "file_hash": file_hash,
                        }},
                        upsert=True
                    )
                )

            collection.bulk_write(operations)

            # Free memory periodically
            del texts, embeddings, operations, batch
            if batch_idx % 10 == 0:
                gc.collect()

            # Progress bar
            done = batch_idx + 1
            pct = done / total_batches
            bar_len = 30
            filled = int(bar_len * pct)
            bar = "=" * filled + "-" * (bar_len - filled)
            print(f"\r   [{bar}] {pct:.0%} ({done}/{total_batches})", end="", flush=True)

            # Save progress every 10 batches
            if done % 10 == 0:
                ingestion_meta.update_one(
                    {"filename": filename},
                    {"$set": {
                        "filename": filename,
                        "hash": file_hash,
                        "pages": len(pages),
                        "chunks": len(chunks),
                        "batches_done": done,
                        "total_batches": total_batches,
                        "status": "partial",
                    }},
                    upsert=True
                )

        print()  # newline after progress bar
        total_chunks += len(chunks)

        # Update log — mark as fully done
        ingestion_meta.update_one(
            {"filename": filename},
            {"$set": {
                "filename": filename,
                "hash": file_hash,
                "pages": len(pages),
                "chunks": len(chunks),
                "status": "complete",
            }},
            upsert=True
        )
        print(f"   ✅ Done! ({len(chunks)} chunks stored)\n")

    # Summary
    total_in_db = collection.count_documents({})
    print("=" * 60)
    print(f"  ✅ Ingestion complete!")
    print(f"  📊 New chunks added: {total_chunks}")
    print(f"  📊 Total chunks in DB: {total_in_db}")
    print(f"  📁 PDFs processed: {len(pdf_files)}")
    print("=" * 60)


if __name__ == "__main__":
    force = "--force" in sys.argv
    ingest_pdfs(force=force)
