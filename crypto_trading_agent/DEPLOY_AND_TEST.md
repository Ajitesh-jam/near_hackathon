# Deploy and Test Guide: Crypto Trading Agent (NEAR + Phala)

This guide walks you through deploying the **NEAR contract** and **Shade Agent** from `crypto_trading_agent` to **Phala Cloud**, and how to test each part of the workflow.

---

## Overview

1. **NEAR contract** (Rust): Deployed on NEAR testnet. It handles agent registration (with TEE attestation or local whitelist) and forwards sign requests to the NEAR MPC (Chain Signatures) contract.
2. **Shade Agent** (Node/TypeScript): Your app that fetches ETH price and updates the Ethereum oracle. It runs inside a TEE on **Phala Cloud** and talks to your NEAR contract.
3. **shade-agent-cli**: Builds your contract (WASM), deploys it to NEAR, builds your Docker image, and deploys the agent to Phala Cloud.

---

## Prerequisites

### 1. Install tools

```bash
# NEAR CLI (near-cli-rs)
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/near-cli-rs/releases/latest/download/near-cli-rs-installer.sh | sh

# Shade Agent CLI
npm i -g @neardefi/shade-agent-cli
```

### 2. NEAR testnet account

Create an account and **save the seed phrase**:

```bash
export ACCOUNT_ID=your-name.testnet
near account create-account sponsor-by-faucet-service $ACCOUNT_ID autogenerate-new-keypair print-to-terminal network-config testnet create
```

Replace `your-name.testnet` with a unique name. Record the **account ID** and **seed phrase**.

### 3. Phala Cloud

- Register: https://cloud.phala.network/register  
- Get API key: https://cloud.phala.network/dashboard/tokens  
- Save the **PHALA_API_KEY**.

### 4. Docker

- Install Docker (Mac: Docker Desktop; Linux: `sudo systemctl start docker`).
- Log in: `docker login` (or `sudo docker login` on Linux).

### 5. Contract dependency: `shade-attestation`

The contract depends on a local crate `../shade-attestation`. You have two options:

**Option A – Use the official sandbox repo (recommended)**  
Clone the repo that already has contract + attestation in the right layout:

```bash
cd /Users/ajitesh/Desktop/near_hackathon
git clone https://github.com/NearDeFi/shade-agent-sandbox-template.git crypto_trading_agent_sandbox
cd crypto_trading_agent_sandbox
# Copy your app code (src/, frontend/, Dockerfile, package.json, etc.) from crypto_trading_agent into this repo, then deploy from here.
```

**Option B – Build from this repo**  
If you have (or clone) `shade-attestation` as a **sibling** of `crypto_trading_agent`:

```bash
cd /Users/ajitesh/Desktop/near_hackathon
git clone https://github.com/NearDeFi/shade-agent-js.git
# If shade-attestation is inside shade-agent-js, symlink or copy it:
# ls shade-agent-js/contracts/  # find shade-attestation or sandbox contract
```

Then ensure the path in `contract/Cargo.toml` matches. If `shade-attestation` lives at `../shade-attestation` (sibling of `crypto_trading_agent`), clone it there:

```bash
cd /Users/ajitesh/Desktop/near_hackathon
git clone https://github.com/NearDeFi/shade-attestation.git
# or wherever the crate is provided
```

Build the contract (see “Build the contract” below). If the dependency is missing, the build will fail until the path is correct.

---

## Step 1: Configure environment

1. Copy the example env file:

```bash
cd /Users/ajitesh/Desktop/near_hackathon/crypto_trading_agent
cp .env.development.local.example .env.development.local
```

2. Edit `.env.development.local`:

```bash
# From NEAR account creation
NEAR_ACCOUNT_ID=your-name.testnet
NEAR_SEED_PHRASE="your twelve or twenty four word seed phrase here"

# For Phala: use ac-sandbox.<your NEAR account>
NEXT_PUBLIC_contractId=ac-sandbox.your-name.testnet

# Shade Agent API (do not change unless instructed)
API_CODEHASH=a86e3a4300b069c08d629a38d61a3d780f7992eaf36aa505e4527e466553e2e5

# After first deploy, shade-agent-cli may update this
APP_CODEHASH=af0c4432864489eb8c6650a6dc61f03ef831240a4199e602cd4d6bd8f4d7163f

# Your Docker Hub image (create account at hub.docker.com)
DOCKER_TAG=your-docker-username/my-app

# From Phala dashboard
PHALA_API_KEY=your_phala_api_key_here
```

For **local only** (no Phala), use `NEXT_PUBLIC_contractId=ac-proxy.your-name.testnet` and run the CLI in local mode.

---

## Step 2: Build the contract (WASM)

The contract uses a TEE attestation dependency that typically requires building inside Docker (especially on Mac).

From the **project root** (`crypto_trading_agent`), with `shade-attestation` available at `../shade-attestation`:

```bash
cd contract
docker run --rm -v "$(pwd)":/workspace pivortex/near-builder@sha256:cdffded38c6cff93a046171269268f99d517237fac800f58e5ad1bcd8d6e2418 cargo near build non-reproducible-wasm
cd ..
```

Or use the deploy script (compile only):

```bash
chmod +x deploy.sh
./deploy.sh --compile-only
```

Output WASM: `contract/target/near/contract.wasm`. If the build fails with “can't find crate shade_attestation”, fix the `shade-attestation` path (see Prerequisites).

---

## Step 3: Deploy contract + agent to Phala Cloud

One command deploys both the NEAR contract and the agent (Docker image + Phala):

```bash
cd /Users/ajitesh/Desktop/near_hackathon/crypto_trading_agent

# Optional: build contract first if you didn’t in Step 2
# ./deploy.sh --compile-only

# Deploy with custom WASM; 5 NEAR funding for contract deployment
./deploy.sh --wasm contract/target/near/contract.wasm --funding 5
# or
FUNDING=5 ./deploy.sh --compile
```

Without `--compile`, `deploy.sh` uses the existing `contract/target/near/contract.wasm`. The script runs **shade-agent-cli**, which will:

1. Deploy the WASM to NEAR (account derived from your config).
2. Build your app Docker image and push to Docker Hub (using `DOCKER_TAG`).
3. Deploy the agent to Phala Cloud (using `PHALA_API_KEY`).

At the end, the CLI prints the **agent URL** (e.g. `https://xxxx-3000.dstack-prod8.phala.network`). Use this as the base URL for testing and for the frontend.

If you only want to build the contract and not deploy:

```bash
./deploy.sh --compile-only
```

---

## Step 4: Test the workflow

Replace `BASE_URL` with your Phala deployment URL (or `http://localhost:3000` for local).

### 4.1 Agent account (NEAR)

Returns the agent’s NEAR account ID and balance.

```bash
curl -s "https://BASE_URL/api/agent-account"
```

Example: `{"accountId":"...", "balance":"..."}`. Fund this account with testnet NEAR if needed (e.g. https://near-faucet.io/).

### 4.2 Derived Ethereum account (Sepolia)

Returns the Ethereum address derived for the agent and its Sepolia ETH balance. This address must be funded to pay gas for updating the oracle.

```bash
curl -s "https://BASE_URL/api/eth-account"
```

Example: `{"senderAddress":"0x...", "balance":...}`. Fund with Sepolia ETH (e.g. https://cloud.google.com/application/web3/faucet/ethereum/sepolia).

### 4.3 Update ETH price (transaction)

Triggers: fetch ETH price (OKX + Coinbase) → request NEAR signature → broadcast tx to Sepolia oracle.

```bash
curl -s "https://BASE_URL/api/transaction"
```

Example: `{"txHash":"0x...", "newPrice":"3456.78"}`.

### 4.4 Test from the frontend

1. In `frontend/src/config.js` set:

```js
export const API_URL = "https://YOUR_PHALA_URL";  // no trailing slash
```

2. Run the frontend:

```bash
cd frontend
npm i
npm run dev
```

3. Open the app, then:
   - Check agent and Sepolia addresses/balances.
   - Click “Set ETH Price” and confirm the new price and Etherscan link.

---

## Step 5: Test NEAR contract functions (optional)

If you want to call the agent contract on NEAR directly (e.g. views or owner functions), use **NEAR CLI** or a small script. Replace `CONTRACT_ID` with your deployed contract ID (e.g. `ac-sandbox.your-name.testnet`).

**View methods (no gas key needed):**

```bash
# Requires contract to be deployed and env set
export CONTRACT_ID=ac-sandbox.your-name.testnet

# Get whether TEE is required
near view $CONTRACT_ID get_requires_tee

# List approved PPIDs
near view $CONTRACT_ID get_approved_ppids

# Get approved measurements (paginated)
near view $CONTRACT_ID get_approved_measurements '{"from_index": null, "limit": null}'

# Get registered agents
near view $CONTRACT_ID get_agents '{"from_index": null, "limit": null}'

# Get one agent (use the agent’s NEAR account ID from /api/agent-account)
near view $CONTRACT_ID get_agent '{"account_id": "AGENT_ACCOUNT_ID"}'
```

**Change methods (need owner key or agent key):**

- Owner (e.g. your `NEAR_ACCOUNT_ID`) can call: `update_owner_id`, `approve_measurements`, `approve_ppids`, `remove_agent`, `whitelist_agent_for_local`, etc.
- Only a registered agent can call `request_signature`; your app does this via `@neardefi/shade-agent-js` when you hit `/api/transaction`.

Example (owner adds default measurements for local mode):

```bash
near call $CONTRACT_ID approve_measurements '{"measurements": {...}}' --accountId your-name.testnet
```

(You’d need the exact `measurements` shape from the contract or docs.)

---

## Troubleshooting

| Issue | What to do |
|-------|------------|
| **Contract build fails (shade_attestation)** | Ensure `shade-attestation` is at `../shade-attestation` or adjust `Cargo.toml`; or build from the official sandbox repo that includes it. |
| **shade-agent-cli not found** | Run `npm i -g @neardefi/shade-agent-cli`. |
| **Deploy fails (insufficient NEAR)** | Add `--funding 5` (or higher). Get testnet NEAR from a faucet. |
| **Agent not registered / request_signature fails** | For Phala (TEE): ensure measurements/PPIDs are approved and agent has registered. For local: use `ac-proxy.*`, whitelist the agent, and approve default measurements/PPID. |
| **Ethereum tx fails** | Fund the **derived Sepolia address** from `/api/eth-account` with Sepolia ETH. |
| **Phala app not responding** | Check the Phala dashboard for logs and that the deployment URL is correct. |

---

## Quick reference

| Goal | Command |
|------|--------|
| Build contract only | `./deploy.sh --compile-only` |
| Deploy to Phala (existing WASM) | `./deploy.sh` |
| Build + deploy with 5 NEAR funding | `FUNDING=5 ./deploy.sh --compile` |
| Deploy without Phala | `./deploy.sh --no-phala` |
| Test agent account | `curl BASE_URL/api/agent-account` |
| Test ETH account | `curl BASE_URL/api/eth-account` |
| Test set price | `curl BASE_URL/api/transaction` |

Using this flow you can deploy the contract, deploy the Shade Agent to Phala, and test each function end-to-end.
