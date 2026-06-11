#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

. .venv/bin/activate
pip install -q -e .

exec r2-bridge --host "${R2_BRIDGE_HOST:-0.0.0.0}" --port "${R2_BRIDGE_PORT:-8765}" --auto-connect "$@"
