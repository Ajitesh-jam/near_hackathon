#!/bin/bash

# deply.sh - Shim for shade-agent-cli with custom contract deployment.
# Run from project root (must contain .env.development.local, Dockerfile, docker-compose.yaml).
#
# Usage:
#   ./deply.sh                         # Full deployment (skips contract build)
#   ./deply.sh --compile               # Build contract + full deployment
#   ./deply.sh --compile-only          # Build contract only (no deployment)
#   FUNDING=5 ./deply.sh               # Fund contract with 5 NEAR
#   ./deply.sh --funding 5             # Same, via flag
#   Use FUNDING=10 or FUNDING=15 to avoid LackBalanceForState when the agent
#   runs pay_by_agent (NEAR reserves balance for storage). To top up after
#   deploy: near transfer ac-proxy.<NEAR_ACCOUNT_ID> 5 --accountId <NEAR_ACCOUNT_ID>
#   ./deply.sh --no-phala              # Skip Phala Cloud deployment
#   ./deply.sh --no-build              # Skip Docker build (redeploy same agent)
#   ./deply.sh --phala-only            # Deploy to Phala Cloud only

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

WASM_PATH="${WASM_PATH:-contract/target/near/contract.wasm}"

# Parse --compile and --compile-only from args (filter out before passing to shade-agent-cli)
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

if ! command -v shade-agent-cli &> /dev/null; then
  echo "Error: shade-agent-cli not found. Install with: npm i -g @neardefi/shade-agent-cli"
  exit 1
fi

ARGS=(--wasm "$WASM_PATH")
[[ -n "${FUNDING}" ]] && ARGS+=(--funding "$FUNDING")
shade-agent-cli "${ARGS[@]}" "${CLI_ARGS[@]}"
