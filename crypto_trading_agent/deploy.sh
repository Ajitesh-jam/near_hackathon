#!/bin/bash
# Deploy script for crypto_trading_agent: build NEAR contract (optional) and run shade-agent-cli
# for Phala Cloud (or local) deployment.
#
# Prerequisites: .env.development.local with NEAR_ACCOUNT_ID, NEAR_SEED_PHRASE,
#                NEXT_PUBLIC_contractId (ac-sandbox.<account> for Phala), PHALA_API_KEY, etc.
#
# Usage:
#   ./deploy.sh                    # Deploy agent (no contract build; use existing WASM)
#   ./deploy.sh --compile          # Build contract + full deployment
#   ./deploy.sh --compile-only     # Build contract only (no deployment)
#   FUNDING=5 ./deploy.sh          # Fund contract with 5 NEAR
#   ./deploy.sh --funding 5        # Same
#   ./deploy.sh --no-phala         # Skip Phala Cloud deployment
#   ./deploy.sh --no-build         # Skip Docker build (redeploy same agent image)
#   ./deploy.sh --phala-only       # Deploy to Phala Cloud only

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

WASM_PATH="${WASM_PATH:-contract/target/near/contract.wasm}"

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
