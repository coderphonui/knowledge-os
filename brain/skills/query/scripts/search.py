#!/usr/bin/env python3
"""
KB Semantic Search

Queries the vector index for notes relevant to a natural-language query.

Usage:
    python search.py "autonomous agents architecture"
    python search.py "interview questions for C# engineers" --top-k 8
    python search.py "marketing strategy" --type topic --status evergreen
    python search.py "what do I know about RAG" --json

Exit codes:
    0  — results found
    1  — error
    2  — index not built yet (run index.py first)

Environment variables:
    KB_EMBED_MODEL     Ollama model name (default: bge-m3)
    OLLAMA_BASE_URL    Ollama server URL  (default: http://localhost:11434)
"""

import argparse
import json
import os
import sys
from pathlib import Path

# ── Dependency check ──────────────────────────────────────────────────────────
try:
    import chromadb
    import ollama
except ImportError as e:
    print(f"Missing dependency: {e}", file=sys.stderr)
    print("Run: pip install chromadb ollama", file=sys.stderr)
    sys.exit(1)

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = Path(__file__).resolve().parent
SKILL_DIR   = SCRIPT_DIR.parent
CHROMA_DIR  = SKILL_DIR / "vector_store" / "chroma"
COLLECTION  = "knowledge_base"

# ── Load skill-local config.env (optional overrides) ──────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(SKILL_DIR / "config.env")
except ImportError:
    pass

# ── Config ────────────────────────────────────────────────────────────────────
EMBED_MODEL = os.environ.get("KB_EMBED_MODEL", "bge-m3")
OLLAMA_URL  = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
MIN_SCORE   = 0.25  # below this threshold, results are likely noise


# ── ChromaDB helpers ──────────────────────────────────────────────────────────

def get_collection():
    if not CHROMA_DIR.exists():
        print(
            "Vector index not found.\n"
            "Build it first: python skills/query/scripts/index.py full",
            file=sys.stderr,
        )
        sys.exit(2)

    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    try:
        return client.get_collection(COLLECTION)
    except Exception:
        print(
            "Collection not found in vector store.\n"
            "Build it first: python skills/query/scripts/index.py full",
            file=sys.stderr,
        )
        sys.exit(2)


# ── Embedding ─────────────────────────────────────────────────────────────────

def embed_query(text: str) -> list[float]:
    try:
        client = ollama.Client(host=OLLAMA_URL)
        return client.embeddings(model=EMBED_MODEL, prompt=text)["embedding"]
    except Exception as e:
        err = str(e)
        if "connection" in err.lower() or "refused" in err.lower():
            print(
                f"Cannot connect to Ollama at {OLLAMA_URL}\n"
                "Make sure Ollama is running: ollama serve",
                file=sys.stderr,
            )
        else:
            print(f"Embedding error: {e}", file=sys.stderr)
        sys.exit(1)


# ── Search ────────────────────────────────────────────────────────────────────

def search(
    query: str,
    top_k: int = 5,
    filter_type: str | None = None,
    filter_status: str | None = None,
    min_score: float = MIN_SCORE,
) -> list[dict]:
    """
    Perform semantic search over the KB vector index.

    Returns a list of hit dicts sorted by score (highest first):
      {rank, score, file, section, type, status, date}

    Deduplicates by file — each file appears at most once, using its
    highest-scoring chunk.
    """
    collection = get_collection()

    if collection.count() == 0:
        return []

    where: dict = {}
    if filter_type:
        where["type"] = filter_type
    if filter_status:
        where["status"] = filter_status

    query_vec = embed_query(query)

    n_results = min(top_k * 3, collection.count())  # over-fetch, then deduplicate by file

    kwargs: dict = dict(
        query_embeddings=[query_vec],
        n_results=n_results,
        include=["metadatas", "distances"],
    )
    if where:
        kwargs["where"] = where

    results = collection.query(**kwargs)

    ids       = results["ids"][0]
    distances = results["distances"][0]
    metadatas = results["metadatas"][0]

    # Deduplicate: keep highest score per file
    seen_files: dict[str, dict] = {}
    for chunk_id, distance, meta in zip(ids, distances, metadatas):
        score = round(1.0 - distance, 4)   # cosine distance → similarity
        if score < min_score:
            continue
        fpath = meta["file"]
        if fpath not in seen_files or score > seen_files[fpath]["score"]:
            seen_files[fpath] = {
                "score":   score,
                "file":    fpath,
                "section": meta.get("section", ""),
                "type":    meta.get("type", ""),
                "status":  meta.get("status", ""),
                "date":    meta.get("date", ""),
                "chunk_id": chunk_id,
            }

    # Sort by score descending, take top_k
    hits = sorted(seen_files.values(), key=lambda h: h["score"], reverse=True)[:top_k]

    # Add rank
    for i, hit in enumerate(hits):
        hit["rank"] = i + 1

    return hits


# ── Output formatters ─────────────────────────────────────────────────────────

def format_human(hits: list[dict], query: str):
    if not hits:
        print("No relevant notes found in KB.")
        print("The index may be stale — run: python skills/query/scripts/index.py incremental")
        return

    print(f'Semantic search: "{query}"\n')
    for hit in hits:
        section_str = f"  §  {hit['section']}" if hit["section"] else ""
        status_str  = f"  [{hit['status']}]"    if hit["status"]  else ""
        date_str    = f"  {hit['date'][:10]}"   if hit["date"]    else ""

        print(f"  [{hit['rank']}] {hit['score']:.3f}  {hit['file']}")
        details = "".join(filter(None, [section_str, status_str, date_str]))
        if details:
            print(f"            {details.strip()}")

    print()


def format_json(hits: list[dict]):
    # Remove internal chunk_id before outputting
    out = [{k: v for k, v in h.items() if k != "chunk_id"} for h in hits]
    print(json.dumps(out, indent=2, ensure_ascii=False))


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="KB Semantic Search — find relevant notes by meaning, not keywords"
    )
    parser.add_argument("query",       help="Natural-language search query")
    parser.add_argument("--top-k",     type=int,   default=5,         help="Max results (default: 5)")
    parser.add_argument("--type",      type=str,   default=None,      help="Filter by note type (topic, project, reference, journal, …)")
    parser.add_argument("--status",    type=str,   default=None,      help="Filter by status (draft, active, evergreen, archived)")
    parser.add_argument("--min-score", type=float, default=MIN_SCORE, help=f"Minimum similarity score (default: {MIN_SCORE})")
    parser.add_argument("--json",      action="store_true",           help="Output results as JSON (for programmatic use)")
    args = parser.parse_args()

    hits = search(
        query=args.query,
        top_k=args.top_k,
        filter_type=args.type,
        filter_status=args.status,
        min_score=args.min_score,
    )

    if args.json:
        format_json(hits)
    else:
        format_human(hits, args.query)


if __name__ == "__main__":
    main()
