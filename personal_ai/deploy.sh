#!/bin/bash

# deploy.sh - Build contract and/or Docker image for Personal AI.
# Run from project root.
#
# Usage:
#   ./deploy.sh                    # Build Docker image only
#   ./deploy.sh --compile          # Build contract + Docker image
#   ./deploy.sh --compile-only     # Build contract only (no Docker)
#   FUNDING=5 ./deploy.sh          # (Reserved for future NEAR deploy)
#   ./deploy.sh --funding 5        # Same, via flag

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

WASM_PATH="${WASM_PATH:-contract/target/near/contract.wasm}"

# Parse --compile and --compile-only from args
CLI_ARGS=()
for arg in "$@"; do
  if [[ "$arg" == "--compile" ]]; then
    DO_COMPILE=1
  elif [[ "$arg" == "--compile-only" ]]; then
    echo "Building contract..."
    (cd contract && docker run --rm -v "$(pwd)":/workspace pivortex/near-builder@sha256:cdffded38c6cff93a046171269268f99d517237fac800f58e5ad1bcd8d6e2418 cargo near build non-reproducible-wasm)
    exit 0
  else
    CLI_ARGS+=("$arg")
  fi
done

# Compile contract (only when --compile is passed)
if [[ -n "${DO_COMPILE}" ]]; then
  echo "Building contract..."
  (cd contract && docker run --rm -v "$(pwd)":/workspace pivortex/near-builder@sha256:cdffded38c6cff93a046171269268f99d517237fac800f58e5ad1bcd8d6e2418 cargo near build non-reproducible-wasm)
fi

echo "Build complete. Run 'npm run docker:build' to build the app image, or 'npm run dev' for local development."
