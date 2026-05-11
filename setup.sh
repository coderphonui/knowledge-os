#!/usr/bin/env bash
# =============================================================================
# setup.sh — Knowledge OS: project setup (pi-only)
# Delegates to brain/setup.sh for all actual work.
# =============================================================================
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/brain/setup.sh" "$@"
