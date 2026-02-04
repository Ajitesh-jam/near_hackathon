# Python Deployment Scripts

Python replacement for `shade-agent-cli` so you can deploy without Node/Yarn issues.

## Prerequisites

- **near-cli-rs** – Install: `curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/near-cli-rs/releases/latest/download/near-cli-rs-installer.sh | sh`
- **Docker** – Logged in: `docker login`
- **Python 3.9+** with pip
- **npx** (for Phala deploy only) – Comes with npm/node

Install script dependencies:

```bash
pip install -r scripts/requirements.txt
```

## Usage

From the project root (python-dao-agent/):

### 1. Build contract

```bash
cd contract
cargo near build non-reproducible-wasm
cd ..
```

Or on Mac:

```bash
cd contract
docker run --rm -v "$(pwd)":/workspace pivortex/near-builder@sha256:cdffded38c6cff93a046171269268f99d517237fac800f58e5ad1bcd8d6e2418 cargo near build non-reproducible-wasm
cd ..
```

Output: `contract/target/near/contract.wasm`

### 2. Configure .env.development.local

Set at least:

- `NEAR_ACCOUNT_ID` – Your NEAR account
- `NEAR_SEED_PHRASE` – Seed phrase
- `NEXT_PUBLIC_contractId` – `ac-proxy.<account>.testnet` (local) or `ac-sandbox.<account>.testnet` (Phala)
- `API_CODEHASH` – `555a166f4c648a579061f65000ad66c757c70881b468a1ae3b1b4cd67238f2e0` (shade-agent-api)
- `DOCKER_TAG` – Your Docker Hub image (e.g. `ajitesh99/python-ai-dao`)
- `PHALA_API_KEY` – (for Phala deploy only)

### 3. Deploy

**Local proxy (ac-proxy):**

```bash
python scripts/deploy.py --wasm contract/target/near/contract.wasm --funding 7
```

This will:

- Create contract account (ac-proxy.<account>.testnet)
- Deploy the contract WASM
- Call `init(owner_id)`
- Approve API_CODEHASH
- Run shade-agent-api locally on port 3140

Then in another terminal:

```bash
export SHADE_AGENT_API_HOST=localhost
python -m src.index
```

**Phala (ac-sandbox):**

```bash
python scripts/deploy.py --wasm contract/target/near/contract.wasm --funding 7
```

This will:

- Build and push your Docker image (gets new APP_CODEHASH)
- Create contract account (ac-sandbox.<account>.testnet)
- Deploy the contract
- Init contract
- Approve API_CODEHASH and APP_CODEHASH
- Deploy to Phala Cloud

## Flags

- `--wasm PATH` – Custom contract WASM path
- `--funding N` – Funding for contract account in NEAR (default: 8)
- `--image-only` – Just build/push Docker image, stop
- `--contract-only` – Build/push and deploy contract, stop
- `--phala-only` – Just deploy to Phala (assumes image already built/pushed)
- `--no-redeploy` – Skip account creation and contract deploy
- `--no-build` – Skip Docker build/push (use existing APP_CODEHASH from .env)
- `--no-phala` – Skip Phala deploy (for sandbox mode)
- `--no-cache` – Docker build with --no-cache

## Examples

Build image only:

```bash
python scripts/deploy.py --image-only
```

Deploy contract only (no Phala):

```bash
python scripts/deploy.py --wasm contract/target/near/contract.wasm --no-phala
```

Deploy to Phala after contract is deployed:

```bash
python scripts/deploy.py --phala-only
```

Redeploy with existing image:

```bash
python scripts/deploy.py --wasm contract/target/near/contract.wasm --no-build
```

## What the scripts do

- **deploy.py** – Main orchestrator (like cli.js): parses args, reads .env, calls near/docker/phala operations.
- **near_ops.py** – NEAR operations via `near` CLI subprocess: create account, deploy contract, init, approve_codehash.
- **docker_ops.py** – Docker via subprocess: build/push image, extract sha256 digest, update .env and docker-compose.yaml.
- **phala_ops.py** – Phala deploy via `npx phala`: login and create CVM.

## Notes

- The scripts use **near-cli-rs** via subprocess, so you need the `near` command in PATH.
- For Phala, the scripts use **npx phala** (requires node/npm for that one command only).
- Docker operations use `docker` CLI (no sudo; add to docker group on Linux or use Docker Desktop on Mac).
