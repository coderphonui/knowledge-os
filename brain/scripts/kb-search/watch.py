#!/usr/bin/env python3
"""
KB File Watcher

Watches data/ for changes and automatically triggers incremental re-indexing.
Uses debouncing to batch rapid changes (e.g., saving a file multiple times).

This is an optional complement to the Claude Code PostToolUse hook:
  - Hook  → catches edits made by Claude
  - Watcher → catches edits made in Obsidian, VS Code, or any external editor

Usage:
    python watch.py           # watch indefinitely (Ctrl+C to stop)
    python watch.py --once    # run incremental index once and exit
    python watch.py --daemon  # run as background daemon (logs to watch.log)
"""

import argparse
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

try:
    from watchdog.events import FileSystemEvent, FileSystemEventHandler
    from watchdog.observers import Observer
except ImportError:
    print("Missing dependency: watchdog", file=sys.stderr)
    print("Run: pip install watchdog", file=sys.stderr)
    sys.exit(1)

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent

def _find_repo_root() -> Path:
    """Walk up from this script to find the repo root via .git or CLAUDE.md marker."""
    for p in Path(__file__).resolve().parents:
        if (p / ".git").exists() or (p / "CLAUDE.md").exists():
            return p
    return SCRIPT_DIR.parent.parent.parent  # structural fallback


REPO_ROOT  = Path(os.environ.get("KB_ROOT", _find_repo_root()))
DATA_DIR   = REPO_ROOT / "data"
LOG_FILE   = REPO_ROOT / "brain" / "data" / "vector_store" / "watch.log"

# ── Load shared script config.env (optional overrides) ──────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(SCRIPT_DIR / "config.env")
except ImportError:
    pass

# ── Config ────────────────────────────────────────────────────────────────────
DEBOUNCE_SECONDS = 3.0   # wait for burst of edits to settle before indexing
SKIP_DIRS        = {"_templates", "_assets"}


# ── Event handler ─────────────────────────────────────────────────────────────

class KBEventHandler(FileSystemEventHandler):
    """
    Watches for .md file changes, batches them with a debounce timer,
    then calls index.py to update only the affected files.
    """

    def __init__(self, logger=None):
        self._timer: threading.Timer | None = None
        self._lock = threading.Lock()
        self._pending: set[Path] = set()   # files to re-index
        self._needs_cleanup = False        # trigger stale-entry cleanup
        self.log = logger or print

    # ── Watchdog callbacks ────────────────────────────────────────────────────

    def on_created(self, event: FileSystemEvent):
        self._enqueue(event)

    def on_modified(self, event: FileSystemEvent):
        self._enqueue(event)

    def on_deleted(self, event: FileSystemEvent):
        # Deletion: file won't exist → let incremental cleanup handle it
        if not event.is_directory and Path(event.src_path).suffix == ".md":
            with self._lock:
                self._needs_cleanup = True
                self._reset_timer()

    def on_moved(self, event: FileSystemEvent):
        # Treat as: old path deleted + new path created
        src = Path(event.src_path)
        dst = Path(getattr(event, "dest_path", ""))
        if src.suffix == ".md" or dst.suffix == ".md":
            with self._lock:
                self._needs_cleanup = True
                if dst.suffix == ".md":
                    self._pending.add(dst)
                self._reset_timer()

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _enqueue(self, event: FileSystemEvent):
        if event.is_directory:
            return
        p = Path(event.src_path)
        if p.suffix != ".md":
            return
        if any(skip in p.parts for skip in SKIP_DIRS):
            return

        with self._lock:
            self._pending.add(p)
            self._reset_timer()

    def _reset_timer(self):
        """Cancel any pending timer and start a fresh debounce countdown."""
        if self._timer and self._timer.is_alive():
            self._timer.cancel()
        self._timer = threading.Timer(DEBOUNCE_SECONDS, self._flush)
        self._timer.daemon = True
        self._timer.start()

    def _flush(self):
        """Called after debounce — run the indexer for accumulated changes."""
        with self._lock:
            files = list(self._pending)
            self._pending.clear()
            needs_cleanup = self._needs_cleanup
            self._needs_cleanup = False

        n = len(files)
        label = f"{n} file(s)" if n else "cleanup"
        self.log(f"[watcher] Change detected — re-indexing {label}...")

        # Index individual changed files
        for filepath in files:
            if filepath.exists():
                result = subprocess.run(
                    [sys.executable, str(SCRIPT_DIR / "index.py"), "file", str(filepath)],
                    capture_output=True,
                    text=True,
                )
                if result.returncode == 0:
                    self.log(f"  ✓ {filepath.name}")
                else:
                    self.log(f"  ✗ {filepath.name}: {result.stderr.strip()}")

        # If any deletions/renames happened, run incremental to clean stale entries
        if needs_cleanup or not files:
            subprocess.run(
                [sys.executable, str(SCRIPT_DIR / "index.py"), "incremental"],
                capture_output=True,
            )

        self.log("[watcher] Index updated. Watching for changes...")


# ── Run modes ─────────────────────────────────────────────────────────────────

def run_watch(logger=None):
    log = logger or print
    log(f"[watcher] Watching {DATA_DIR}")
    log("[watcher] Press Ctrl+C to stop.")
    log("")

    handler  = KBEventHandler(logger=log)
    observer = Observer()
    observer.schedule(handler, str(DATA_DIR), recursive=True)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        log("\n[watcher] Stopped.")
    finally:
        observer.join()


def run_once():
    """Run incremental index once and exit. Useful for cron jobs."""
    result = subprocess.run(
        [sys.executable, str(SCRIPT_DIR / "index.py"), "incremental"]
    )
    sys.exit(result.returncode)


def run_daemon():
    """
    Detach from terminal and run as a background daemon.
    Logs are written to vector_store/watch.log.
    PID is written to vector_store/watch.pid.
    """
    pid_file = SKILL_DIR / "vector_store" / "watch.pid"
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Double-fork to fully detach
    if os.fork() > 0:
        sys.exit(0)

    os.setsid()

    if os.fork() > 0:
        sys.exit(0)

    # Redirect stdio to log file
    log_fd = open(LOG_FILE, "a", buffering=1)
    sys.stdout = log_fd
    sys.stderr = log_fd

    pid_file.write_text(str(os.getpid()))

    def log(msg: str):
        ts = time.strftime("%Y-%m-%d %H:%M:%S")
        print(f"{ts}  {msg}", flush=True)

    log(f"[watcher] Daemon started (PID {os.getpid()})")
    run_watch(logger=log)


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="KB File Watcher — auto-reindex data/ on any markdown change"
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--once",   action="store_true",
        help="Run incremental index once and exit (good for cron)"
    )
    group.add_argument(
        "--daemon", action="store_true",
        help="Detach and run as background daemon (logs to vector_store/watch.log)"
    )
    args = parser.parse_args()

    if args.once:
        run_once()
    elif args.daemon:
        run_daemon()
    else:
        run_watch()


if __name__ == "__main__":
    main()
