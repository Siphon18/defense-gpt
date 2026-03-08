"""
RAG Engine — Retrieval-Augmented Generation using MongoDB Atlas Vector Search
Handles semantic search over ingested PDF content stored in MongoDB.
"""

import os
from pymongo import MongoClient
from sentence_transformers import SentenceTransformer
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = "defensegpt"
COLLECTION_NAME = "chunks"
VECTOR_INDEX_NAME = "vector_index"


@dataclass
class RetrievedChunk:
    text: str
    source: str
    page: int
    score: float


class RAGEngine:
    def __init__(self):
        self._model = None
        self._client = None
        self._db = None
        self._collection = None

    @property
    def model(self):
        if self._model is None:
            print("Loading embedding model...")
            self._model = SentenceTransformer('all-MiniLM-L6-v2')
        return self._model

    @property
    def collection(self):
        if self._collection is None:
            self._client = MongoClient(MONGODB_URI)
            self._db = self._client[DB_NAME]
            self._collection = self._db[COLLECTION_NAME]
        return self._collection

    def get_stats(self) -> dict:
        """Get knowledge base statistics."""
        count = self.collection.count_documents({})

        if count > 0:
            pipeline = [
                {"$group": {"_id": "$source"}},
                {"$sort": {"_id": 1}}
            ]
            sources = [doc["_id"] for doc in self.collection.aggregate(pipeline)]
            return {
                "total_chunks": count,
                "total_pdfs": len(sources),
                "pdf_names": sources
            }
        return {"total_chunks": 0, "total_pdfs": 0, "pdf_names": []}

    def search(self, query: str, top_k: int = 5, source_filter: str | None = None) -> list[RetrievedChunk]:
        """
        Search the knowledge base for relevant chunks using MongoDB Atlas Vector Search.

        Args:
            query: User's question
            top_k: Number of results to return
            source_filter: Optional PDF filename to filter by

        Returns:
            List of RetrievedChunk with text, source, page, and relevance score
        """
        if self.collection.count_documents({}) == 0:
            return []

        # Generate query embedding
        query_embedding = self.model.encode(query).tolist()

        # Build the $vectorSearch aggregation pipeline
        vector_search_stage = {
            "$vectorSearch": {
                "index": VECTOR_INDEX_NAME,
                "path": "embedding",
                "queryVector": query_embedding,
                "numCandidates": top_k * 10,
                "limit": top_k,
            }
        }

        # Add source filter if specified
        if source_filter:
            vector_search_stage["$vectorSearch"]["filter"] = {
                "source": source_filter
            }

        pipeline = [
            vector_search_stage,
            {
                "$project": {
                    "text": 1,
                    "source": 1,
                    "page": 1,
                    "score": {"$meta": "vectorSearchScore"},
                }
            }
        ]

        results = list(self.collection.aggregate(pipeline))

        chunks = []
        for doc in results:
            chunks.append(RetrievedChunk(
                text=doc["text"],
                source=doc.get("source", "unknown"),
                page=doc.get("page", 0),
                score=round(doc.get("score", 0), 4)
            ))

        return chunks

    def build_context(self, query: str, top_k: int = 5, source_filter: str | None = None) -> tuple[str, list[RetrievedChunk]]:
        """
        Search and build a formatted context string for the LLM.

        Returns:
            Tuple of (context_string, retrieved_chunks)
        """
        chunks = self.search(query, top_k=top_k, source_filter=source_filter)

        if not chunks:
            return "", []

        context_parts = []
        for i, chunk in enumerate(chunks, 1):
            context_parts.append(
                f"[Source: {chunk.source}, Page {chunk.page}] (Relevance: {chunk.score:.0%})\n"
                f"{chunk.text}"
            )

        context = "\n\n---\n\n".join(context_parts)
        return context, chunks


# Singleton instance
rag_engine = RAGEngine()
