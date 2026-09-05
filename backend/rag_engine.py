"""
RAG Engine — Retrieval-Augmented Generation using MongoDB Atlas Vector Search
Handles semantic search over ingested PDF content stored in MongoDB.
"""

import os
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = "defensegpt"
COLLECTION_NAME = "chunks"
VECTOR_INDEX_NAME = "vector_index"

# all-MiniLM-L6-v2 embeddings are compared via cosine similarity, so scores
# fall in [0, 1] (well-configured Atlas vector index). Chunks below this are
# treated as noise rather than genuine matches, so the LLM layer's grounding
# rules can correctly fall back to "general knowledge" instead of citing a
# barely-related chunk as if it were authoritative.
MIN_RELEVANCE_SCORE = 0.35
MIN_CANDIDATES = 50


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
            from sentence_transformers import SentenceTransformer
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
        try:
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
        except PyMongoError as e:
            print(f"RAGEngine.get_stats: MongoDB error: {e}")
            return {"total_chunks": 0, "total_pdfs": 0, "pdf_names": [], "error": "knowledge_base_unavailable"}

    def search(self, query: str, top_k: int = 5, source_filter: str | None = None,
               min_score: float = MIN_RELEVANCE_SCORE) -> list[RetrievedChunk]:
        """
        Search the knowledge base for relevant chunks using MongoDB Atlas Vector Search.

        Args:
            query: User's question
            top_k: Number of results to return
            source_filter: Optional PDF filename to filter by
            min_score: Minimum cosine-similarity score to keep a chunk. Weak
                matches are dropped rather than returned as if they were
                genuine hits — an empty result here should mean "the LLM
                layer falls back to general knowledge," not "here's our best
                guess dressed up as ground truth."

        Returns:
            List of RetrievedChunk with text, source, page, and relevance score.
            Empty list if the knowledge base is empty, unreachable, or has
            nothing relevant enough to the query.
        """
        if not query or not query.strip():
            return []

        try:
            if self.collection.count_documents({}) == 0:
                return []

            query_embedding = self.model.encode(query).tolist()

            vector_search_stage = {
                "$vectorSearch": {
                    "index": VECTOR_INDEX_NAME,
                    "path": "embedding",
                    "queryVector": query_embedding,
                    "numCandidates": max(top_k * 10, MIN_CANDIDATES),
                    "limit": top_k,
                }
            }

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
        except PyMongoError as e:
            print(f"RAGEngine.search: MongoDB error: {e}")
            return []
        except Exception as e:
            print(f"RAGEngine.search: embedding/search error: {e}")
            return []

        chunks = []
        seen_text = set()
        for doc in results:
            score = round(doc.get("score", 0), 4)
            if score < min_score:
                continue
            text = doc["text"]
            # Skip near-duplicate chunks (e.g. the same PDF ingested twice,
            # or heavily overlapping chunk windows) so we don't burn context
            # budget repeating the same passage.
            dedup_key = text.strip()[:300]
            if dedup_key in seen_text:
                continue
            seen_text.add(dedup_key)

            chunks.append(RetrievedChunk(
                text=text,
                source=doc.get("source", "unknown"),
                page=doc.get("page", 0),
                score=score,
            ))

        return chunks

    def build_context(self, query: str, top_k: int = 5, source_filter: str | None = None) -> tuple[str, list[RetrievedChunk]]:
        """
        Search and build a formatted context string for the LLM.

        Returns:
            Tuple of (context_string, retrieved_chunks). Both are empty when
            nothing sufficiently relevant was found — this is the intended
            signal for the LLM layer to answer from general knowledge and
            flag it as such, rather than being fed weak or irrelevant chunks.
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
