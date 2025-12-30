#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUBMODULE_DIR="$ROOT_DIR/Tokamak-Zk-EVM"
ENV_FILE="$ROOT_DIR/.env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing .env.local at $ENV_FILE" >&2
  exit 1
fi

RPC_KEY="$(sed -n 's/^NEXT_PUBLIC_ALCHEMY_API_KEY=//p' "$ENV_FILE" | head -n1 | tr -d '"' | tr -d "'")"
if [ -z "$RPC_KEY" ]; then
  echo "NEXT_PUBLIC_ALCHEMY_API_KEY is empty in .env.local" >&2
  exit 1
fi

if [ ! -d "$SUBMODULE_DIR" ] || [ -z "$(ls -A "$SUBMODULE_DIR" 2>/dev/null)" ]; then
  echo "Initializing Tokamak-Zk-EVM submodule from main branch..."
  git submodule update --init -- "$SUBMODULE_DIR"
  git -C "$SUBMODULE_DIR" fetch origin main
  git -C "$SUBMODULE_DIR" checkout main
  git -C "$SUBMODULE_DIR" pull --ff-only origin main
else
  echo "Tokamak-Zk-EVM submodule not empty; skipping update."
fi

TOKAMAK_CLI="$SUBMODULE_DIR/tokamak-cli"
if [ ! -x "$TOKAMAK_CLI" ]; then
  echo "tokamak-cli not found or not executable at $TOKAMAK_CLI" >&2
  exit 1
fi

(
  cd "$SUBMODULE_DIR"
  TOKAMAK_ZK_EVM_ROOT="$SUBMODULE_DIR" "$TOKAMAK_CLI" --install "$RPC_KEY" --bun
)
