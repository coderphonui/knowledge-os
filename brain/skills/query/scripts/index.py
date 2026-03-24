#!/usr/bin/env python3
"""
KB Semantic Indexer

Chunks all markdown notes in data/ and stores embeddings in ChromaDB (embedded mode).
No server or Docker required — the vector store is a local directory on disk.

Usage:
    python index.py                          # incremental (default)
    python index.py full                     # full rebuild
    python index.py incremental              # only re-index changed/new files
    python index.py file data/topics/x.md   # re-index a single file

Environment variables:
    KB_EMBED_MODEL      Ollama model name (default: bge-m3)
    OLLAMA_BASE_URL     Ollama server URL  (default: http://localhost:11434)
    KB_CHUNK_WORDS      Max words per chunk (default: 400)
"""

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

# ── Dependency check ──────────────────────────────────────────────────────────
try:
    import chromadb
    import ollama
    import yaml
except ImportError as e:
    print(f"Missing dependency: {e}", file=sys.stderr)
    print("Run: pip install chromadb ollama pyyaml", file=sys.stderr)
    sys.exit(1)

# ── Paths ─────────────────────────────────────────────────────────────────────
# Use resolve() so paths are correct whether running directly or via symlink
SCRIPT_DIR  = Path(__file__).resolve().parent
SKILL_DIR   = SCRIPT_DIR.parent

# ── Load skill-local config.env (optional overrides) ──────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(SKILL_DIR / "config.env")
except ImportError:
    pass


def _find_repo_root() -> Path:
    """Walk up from this script to find the repo root via .git or CLAUDE.md marker."""
    for p in Path(__file__).resolve().parents:
        if (p / ".git").exists() or (p / "CLAUDE.md").exists():
            return p
    return SKILL_DIR.parent.parent.parent  # structural fallback


REPO_ROOT   = Path(os.environ["KB_ROOT"]) if os.environ.get("KB_ROOT") else _find_repo_root()
DATA_DIR    = REPO_ROOT / "data"
VECTOR_DIR  = SKILL_DIR / "vector_store"
STATE_FILE  = VECTOR_DIR / "index_state.json"
CHROMA_DIR  = VECTOR_DIR / "chroma"

# ── Config ────────────────────────────────────────────────────────────────────
COLLECTION  = "knowledge_base"
EMBED_MODEL = os.environ.get("KB_EMBED_MODEL", "bge-m3")
OLLAMA_URL  = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
MAX_WORDS   = int(os.environ.get("KB_CHUNK_WORDS", "400"))

# Directories to skip during indexing
SKIP_DIRS = {"_templates", "_assets"}

# Files to skip — _index.md are folder navigation hubs (useful in Obsidian/wikilinks)
# but contain directory listings rather than substantive content, so they add noise
# to vector search results. Individual notes in the folder are indexed instead.
SKIP_FILES = {"_index.md"}


# ── ChromaDB helpers ──────────────────────────────────────────────────────────

def get_client():
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(path=str(CHROMA_DIR))


def get_collection(client=None):
    c = client or get_client()
    return c.get_or_create_collection(
        name=COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )


# ── Embedding ─────────────────────────────────────────────────────────────────

def embed(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts using Ollama. Returns list of embedding vectors."""
    try:
        client = ollama.Client(host=OLLAMA_URL)
        return [client.embeddings(model=EMBED_MODEL, prompt=t)["embedding"] for t in texts]
    except Exception as e:
        err = str(e)
        if "connection" in err.lower() or "refused" in err.lower():
            print(
                f"\n✗ Cannot connect to Ollama at {OLLAMA_URL}\n"
                "  Make sure Ollama is running: ollama serve\n"
                f"  And the model is pulled: ollama pull {EMBED_MODEL}",
                file=sys.stderr,
            )
        else:
            print(f"✗ Embedding error: {e}", file=sys.stderr)
        sys.exit(1)


# ── Frontmatter + Chunking ────────────────────────────────────────────────────

def parse_frontmatter(content: str) -> tuple[dict, str]:
    """Extract YAML frontmatter and return (metadata, body)."""
    if not content.startswith("---"):
        return {}, content
    try:
        end = content.index("---", 3)
        fm = yaml.safe_load(content[3:end]) or {}
        body = content[end + 3:].strip()
        return fm, body
    except (ValueError, yaml.YAMLError):
        return {}, content


def chunk_markdown(filepath: Path) -> list[dict]:
    """
    Parse a markdown file and split into semantic chunks.

    Strategy:
      1. Parse YAML frontmatter → extract metadata
      2. Split body on H1–H3 headings — each section is a chunk
      3. If a section exceeds MAX_WORDS, split further by paragraph
      4. Prepend title + tags to every chunk so the embedding model has context

    Returns a list of chunk dicts ready for ChromaDB.
    """
    try:
        content = filepath.read_text(encoding="utf-8")
    except Exception:
        return []

    if not content.strip():
        return []

    fm, body = parse_frontmatter(content)
    if not body.strip():
        return []

    # Metadata
    title      = fm.get("title", filepath.stem)
    note_type  = str(fm.get("type", ""))
    status     = str(fm.get("status", ""))
    date_str   = str(fm.get("date_created", ""))
    tags_raw   = fm.get("tags", [])
    tags_str   = ", ".join(tags_raw) if isinstance(tags_raw, list) else str(tags_raw)

    # Context prefix prepended to every chunk — helps the model ground each chunk
    prefix = f"Title: {title}"
    if tags_str:
        prefix += f"\nTags: {tags_str}"
    prefix += "\n\n"

    rel_path = str(filepath.relative_to(REPO_ROOT))
    chunks: list[dict] = []
    chunk_idx = 0

    def push_chunk(text: str, heading: str):
        nonlocal chunk_idx
        full_text = prefix + text.strip()
        if not full_text.strip():
            return
        chunks.append({
            "id":      f"{rel_path}::chunk_{chunk_idx}",
            "text":    full_text,
            "file":    rel_path,
            "section": heading,
            "type":    note_type,
            "status":  status,
            "date":    date_str,
        })
        chunk_idx += 1

    # Split on headings (H1–H3)
    parts = re.split(r"(?m)^(?=#{1,3} )", body)

    for part in parts:
        part = part.strip()
        if not part:
            continue

        heading_m = re.match(r"(#{1,3} .+)", part)
        heading = heading_m.group(1).strip() if heading_m else ""

        # Fast path: section fits in one chunk
        if len((prefix + part).split()) <= MAX_WORDS:
            push_chunk(part, heading)
            continue

        # Slow path: split long section by paragraph with overlap
        paragraphs = re.split(r"\n{2,}", part)
        current = (heading + "\n\n") if heading else ""

        for para in paragraphs:
            candidate = current + para + "\n\n"
            if len((prefix + candidate).split()) > MAX_WORDS and current.strip():
                push_chunk(current.rstrip(), heading)
                # Start new chunk with overlap: keep heading context
                current = (heading + "\n\n") if heading else ""
                current += para + "\n\n"
            else:
                current = candidate

        if current.strip():
            push_chunk(current.rstrip(), heading)

    # Fallback: entire body as single chunk (no headings found)
    if not chunks and body.strip():
        push_chunk(body, "")

    return chunks


# ── State tracking ────────────────────────────────────────────────────────────

def file_hash(filepath: Path) -> str:
    return hashlib.md5(filepath.read_bytes()).hexdigest()


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            pass
    return {}


def save_state(state: dict):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False))


# ── Core index operations ─────────────────────────────────────────────────────

def index_file(filepath: Path, collection, state: dict, verbose=True) -> int:
    """
    Index a single file into ChromaDB.

    Steps:
      1. Chunk the markdown file
      2. Delete all existing chunks for this file (handles count changes)
      3. Embed all chunks in one batch
      4. Insert into ChromaDB
      5. Update state hash

    Returns the number of chunks indexed (0 = skipped).
    """
    rel = str(filepath.relative_to(REPO_ROOT))

    chunks = chunk_markdown(filepath)
    if not chunks:
        if verbose:
            print(f"  skip (empty/no-content): {rel}")
        return 0

    # Always delete → re-insert to avoid stale chunks when count changes
    try:
        collection.delete(where={"file": rel})
    except Exception:
        pass  # collection may be empty, that's fine

    texts = [c["text"] for c in chunks]
    embeddings = embed(texts)  # exits on Ollama error

    collection.add(
        ids=[c["id"] for c in chunks],
        embeddings=embeddings,
        documents=texts,
        metadatas=[{
            "file":    c["file"],
            "section": c["section"],
            "type":    c["type"],
            "status":  c["status"],
            "date":    c["date"],
        } for c in chunks],
    )

    state[rel] = {
        "hash":        file_hash(filepath),
        "indexed_at":  datetime.now().isoformat(),
        "chunk_count": len(chunks),
    }

    if verbose:
        print(f"  ✓ {len(chunks):2d} chunks  {rel}")

    return len(chunks)


def remove_deleted_files(collection, state: dict) -> list[str]:
    """
    Detect files that exist in the index but no longer on disk.
    Removes their chunks from ChromaDB and their entry from state.
    Returns list of removed relative paths.
    """
    removed = []
    for rel_path in list(state.keys()):
        if not (REPO_ROOT / rel_path).exists():
            try:
                collection.delete(where={"file": rel_path})
            except Exception:
                pass
            del state[rel_path]
            removed.append(rel_path)

    if removed:
        print(f"  Cleaned up {len(removed)} deleted file(s):")
        for r in removed:
            print(f"    - {r}")

    return removed


def collect_md_files() -> list[Path]:
    """Walk data/ and return all .md files, excluding skipped directories."""
    files = []
    for f in DATA_DIR.rglob("*.md"):
        if not any(skip in f.parts for skip in SKIP_DIRS) and f.name not in SKIP_FILES:
            files.append(f)
    return files


# ── Commands ──────────────────────────────────────────────────────────────────

def cmd_full(_args):
    """Wipe and rebuild the entire index from scratch."""
    print("Building full index (this may take a while)...")
    client = get_client()

    # Wipe existing collection
    try:
        client.delete_collection(COLLECTION)
        print("  Cleared existing collection.")
    except Exception:
        pass

    collection = client.get_or_create_collection(
        name=COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )
    state: dict = {}

    md_files = collect_md_files()
    print(f"  Found {len(md_files)} markdown files\n")

    total_chunks = 0
    for f in md_files:
        total_chunks += index_file(f, collection, state)

    save_state(state)
    print(f"\nDone. {len(md_files)} files → {total_chunks} chunks indexed.")
    print(f"Vector store: {CHROMA_DIR}")


def cmd_incremental(_args):
    """Only re-index files that are new or have changed since last run."""
    collection = get_collection()
    state = load_state()

    # Step 1: remove stale entries for deleted files
    remove_deleted_files(collection, state)

    # Step 2: find changed/new files
    md_files = collect_md_files()
    changed = []
    for f in md_files:
        rel = str(f.relative_to(REPO_ROOT))
        if rel not in state or state[rel]["hash"] != file_hash(f):
            changed.append(f)

    if not changed:
        print("KB index is up to date — no changes detected.")
        save_state(state)
        return

    print(f"Re-indexing {len(changed)} changed file(s):\n")
    total_chunks = 0
    for f in changed:
        total_chunks += index_file(f, collection, state)

    save_state(state)
    print(f"\nDone. {len(changed)} files updated → {total_chunks} chunks.")


def cmd_file(args):
    """Re-index a single file."""
    filepath = Path(args.file)
    if not filepath.is_absolute():
        filepath = REPO_ROOT / filepath

    if not filepath.exists():
        print(f"File not found: {filepath}", file=sys.stderr)
        sys.exit(1)

    collection = get_collection()
    state = load_state()

    n = index_file(filepath, collection, state)
    save_state(state)
    print(f"\nDone. {n} chunks indexed for {filepath.name}.")


def cmd_status(_args):
    """Show index statistics."""
    state = load_state()
    if not state:
        print("Index is empty. Run: python index.py full")
        return

    total_chunks = sum(v.get("chunk_count", 0) for v in state.values())
    last_updated = max(v.get("indexed_at", "") for v in state.values())

    print(f"Index status:")
    print(f"  Files indexed : {len(state)}")
    print(f"  Total chunks  : {total_chunks}")
    print(f"  Last updated  : {last_updated}")
    print(f"  Model         : {EMBED_MODEL}")
    print(f"  Vector store  : {CHROMA_DIR}")

    # Check for unindexed files
    md_files = collect_md_files()
    unindexed = [
        f for f in md_files
        if str(f.relative_to(REPO_ROOT)) not in state
    ]
    if unindexed:
        print(f"\n  ⚠  {len(unindexed)} unindexed file(s) — run: python index.py incremental")


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="KB Semantic Indexer — build and maintain the vector search index"
    )
    sub = parser.add_subparsers(dest="cmd")

    sub.add_parser("full",        help="Full rebuild (wipes existing index)")
    sub.add_parser("incremental", help="Re-index only changed/new files (default)")
    sub.add_parser("status",      help="Show index statistics")

    file_p = sub.add_parser("file", help="Re-index a single file")
    file_p.add_argument("file", help="Path to the markdown file (relative to repo root or absolute)")

    args = parser.parse_args()

    dispatch = {
        "full":        cmd_full,
        "incremental": cmd_incremental,
        "file":        cmd_file,
        "status":      cmd_status,
    }

    fn = dispatch.get(args.cmd, cmd_incremental)
    fn(args)


if __name__ == "__main__":
    main()
