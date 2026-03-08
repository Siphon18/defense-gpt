"""
Quick ingestion script — run this after adding PDFs to the /pdfs folder.
Usage:
    python ingest.py           # Ingest new PDFs only
    python ingest.py --force   # Re-ingest all PDFs
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from backend.pdf_ingestion import ingest_pdfs

if __name__ == "__main__":
    force = "--force" in sys.argv
    ingest_pdfs(force=force)
