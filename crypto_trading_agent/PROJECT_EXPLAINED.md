# Crypto Trading Agent – Project and File Guide

This document explains what the **crypto_trading_agent** project does and what each file is for, in the context of **NEAR Protocol** and **Shade Agents**.

---

## What the Overall Project Does

The project is a **verifiable ETH price oracle** built on the **Shade Agent** framework. It:

1. **Runs an agent** (Node.js server) that can be deployed **locally** or inside a **TEE (Trusted Execution Environment)** on Phala Cloud.
2. **Fetches the current ETH price** from OKX and Coinbase, averages it, and **pushes that price** to an **Ethereum (Sepolia) smart contract**.
3. **Uses NEAR** for:
   - **Agent identity and attestation**: the agent registers with a NEAR contract by proving it runs in an approved TEE (or is whitelisted for local dev).
   - **Signing**: the agent does **not** hold Ethereum private keys. It asks a **NEAR MPC (multi-party computation) contract** to sign the Ethereum transaction. That way, signing is done in a controlled, attestable way.

So in one sentence: **“A NEAR-backed agent that proves who it is (attestation), gets ETH price from exchanges, and updates an Ethereum oracle contract by having NEAR Chain Signatures (MPC) sign the tx.”**

### NEAR Protocol Concepts Used

- **NEAR blockchain**: host for the **Shade Agent contract** (Rust smart contract) that stores agent registrations and forwards sign requests to the MPC contract.
- **Shade Agents**: framework for running **verifiable agents** (with optional TEE attestation) that interact with NEAR and other chains.
- **Chain Signatures (MPC)**: NEAR’s signer contract (`v1.signer-prod.testnet` / `v1.signer` mainnet) that can sign for **Ethereum** (and other chains) so the agent never holds the EVM private key.
- **TEE (e.g. Phala)**: optional secure environment; the contract can require that only agents running in an approved TEE can register.

---

## High-Level Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  Frontend (UI)  │────▶│  Agent (Node / TEE)   │────▶│  NEAR Agent Contract │
│  React + Vite   │     │  Hono API + logic     │     │  (Rust, attestation  │
│                 │     │  - Fetch ETH price    │     │   + request_signature)│
└─────────────────┘     │  - Build EVM tx       │     └──────────┬──────────┘
                        │  - requestSignature() │                │
                        └──────────┬───────────┘                │
                                   │                             │
                                   │  MPC sign                   ▼
                        ┌──────────▼───────────┐     ┌─────────────────────┐
                        │  NEAR MPC Contract   │     │  Ethereum (Sepolia) │
                        │  (Chain Signatures)  │────▶│  Price Oracle       │
                        │  Signs for EVM key   │     │  updatePrice(price) │
                        └──────────────────────┘     └─────────────────────┘
```

- **Frontend**: talks to the agent’s HTTP API (agent account, derived ETH account, “set price”).
- **Agent**: gets price → builds EVM tx → calls NEAR contract `request_signature` → NEAR contract calls MPC → agent gets signature → broadcasts signed tx to Sepolia.
- **NEAR contract**: checks caller is a registered (and approved) agent, then forwards the sign request to the MPC contract.

---

## Repository Layout

```
crypto_trading_agent/
├── contract/          # NEAR smart contract (Rust)
├── src/               # Agent server (TypeScript)
├── frontend/          # React UI
├── tools.config.json  # (if present) tool config
├── package.json       # Agent app
├── Dockerfile         # Agent image for Phala/local
└── docker-compose.yaml
```

---

## 1. NEAR Contract (`contract/`)

The contract is a **NEAR smart contract** (Rust, near-sdk). It implements the **Shade Agent** on-chain logic: who is allowed to act as an agent (attestation/whitelist) and how they request **Chain Signature** signings.

### `contract/Cargo.toml`

- **Crate**: `shade-contract-template`.
- **Dependencies**:
  - `near-sdk`: NEAR smart contract SDK.
  - `shade-attestation`: local path `../shade-attestation` – TEE attestation types and verification (Dstack/Phala). If you don’t have that repo as a sibling, the build will fail until you add it or point to the right crate.
- **Build**: `cdylib` + `rlib` for compiling to WASM and running tests.

### `contract/src/lib.rs`

- **Contract state** (`Contract`):
  - `requires_tee`: if true, only TEE-attested agents can register; if false, local dev with whitelist.
  - `owner_id`: admin account (add/remove measurements, PPIDs, agents).
  - `mpc_contract_id`: NEAR account of the Chain Signatures / MPC signer (e.g. `v1.signer-prod.testnet`).
  - `approved_measurements` / `approved_ppids`: which TEE measurements and PPIDs are allowed.
  - `agents`: map of registered agent account IDs to their attested measurements and PPID.
  - `whitelisted_agents_for_local`: for non-TEE mode, which accounts can register.
- **Main methods**:
  - **`register_agent(attestation)`**: agent calls this to register; contract verifies attestation (or whitelist + default measurements in local mode) and stores the agent.
  - **`request_signature(path, payload, key_type)`**: only a **valid registered agent** can call this; it forwards the sign request to the MPC contract (Ecdsa/Eddsa).
- **Owner methods**: update owner, MPC contract ID, approve/remove measurements and PPIDs, remove agents, whitelist (local only).

**Note:** The file has `mod attestation;` but the actual source file is `attestations.rs`. In Rust, `mod attestation;` expects `attestation.rs`. So you may need to rename `attestations.rs` to `attestation.rs` or change the module declaration to match the filename.

### `contract/src/attestations.rs`

- **`verify_attestation(attestation)`**:
  - **TEE mode** (`requires_tee == true`): checks that the caller is an implicit account (64 hex chars), builds expected report data from account ID, and calls `attestation.verify(...)` (from `shade_attestation`) against approved measurements and PPIDs. Only then is the agent considered verified for registration.
  - **Local mode** (`requires_tee == false`): checks that the caller is whitelisted and that default measurements/PPID are approved; no real TEE attestation.

So this file is the **bridge** between the Shade Agent contract and the TEE attestation library.

### `contract/src/chainsig.rs`

- **External trait** `MPCContract`: defines the cross-contract call to the MPC (Chain Signatures) contract: `sign(request)`.
- **`internal_request_signature(path, payload, key_type)`**: builds a `SignRequest` (Ecdsa or Eddsa payload, path, domain_id), then calls `mpc_contract::ext(...).sign(request)` with gas and a tiny attached deposit.
- So this file is **“request a signature from the NEAR MPC contract”** (which then signs for the Ethereum key).

### `contract/src/helpers.rs`

- **`require_owner()`**: asserts predecessor is `owner_id`.
- **`require_valid_agent()`**: asserts the caller is a registered agent whose measurements and PPID are still approved (and in local mode, that they’re whitelisted). Used before processing `request_signature`.

Access control helpers used across the contract.

### `contract/src/update_contract.rs`

- **`update_contract()`**: owner-only. Reads input as `[8-byte gas (u64 LE)] + [WASM bytes]`, deploys the new code on the same account, and calls `migrate()` with the rest of the gas. Used for **upgrading the contract** without redeploying from scratch.

### `contract/src/views.rs`

- View (read-only) methods:
  - `get_requires_tee`, `get_approved_ppids`, `get_approved_measurements`, `get_agent`, `get_agents`, `get_whitelisted_agents_for_local`.
- No state changes; used by frontends and tooling to inspect configuration and registered agents.

---

## 2. Agent Server (`src/`)

The agent is a **Node.js (TypeScript) HTTP server** (Hono) that runs next to the Shade Agent runtime. It exposes APIs the frontend uses and performs the “fetch price → build tx → request NEAR signature → broadcast to Ethereum” flow.

### `src/index.ts`

- Creates Hono app, CORS, mounts routes under `/api/`:
  - `/api/agent-account` → agent account + balance.
  - `/api/eth-account` → derived Ethereum address + balance.
  - `/api/transaction` → “set ETH price” (fetch price, build tx, request signature, broadcast).
- Loads `.env.development.local` in non-production.
- Starts the server on `PORT` (default 3000).

### `src/routes/agentAccount.ts`

- **GET `/api/agent-account`** (or `/` under that route):
  - Uses `@neardefi/shade-agent-js`: `agentAccountId()` and `agent("getBalance")`.
  - Returns the **NEAR agent account ID** and its **NEAR balance** (so the user knows what to fund).

### `src/routes/ethAccount.ts`

- **GET `/api/eth-account`**:
  - Uses `Evm.deriveAddressAndPublicKey(contractId, "ethereum-1")` to get the **Ethereum address** derived from the agent’s NEAR/MPC path.
  - Returns that address and its **Sepolia ETH balance** (so the user knows to fund it for gas).

### `src/routes/transaction.ts`

- **GET `/api/transaction`** (trigger: “set price”):
  1. Fetches **ETH price in USD** via `getEthereumPriceUSD()` (OKX + Coinbase average, ×100 integer).
  2. Builds the **EVM payload**: `updatePrice(ethPrice)` for the oracle contract.
  3. Uses `Evm.prepareTransactionForSigning(...)` to get the **transaction** and **hashesToSign**.
  4. Calls **`requestSignature`** from `@neardefi/shade-agent-js` with path `"ethereum-1"`, payload (hex of hash to sign), key type `"Ecdsa"`. This goes to the **NEAR agent contract** → **MPC contract**; the agent receives the signature.
  5. **`Evm.finalizeTransactionSigning`** + **`Evm.broadcastTx`** to send the signed tx to Sepolia.
  6. Returns `txHash` and `newPrice` to the frontend.

So this file is the **core “crypto trading / oracle” action**: one API call that updates the on-chain ETH price using NEAR-backed signing.

### `src/utils/ethereum.ts`

- **EVM config**: Sepolia RPC (`ethRpcUrl`), oracle contract address and ABI (`updatePrice`, `getPrice`).
- **Chain Signatures**: instantiates `ChainSignatureContract` for `testnet` and `v1.signer-prod.testnet`.
- **`Evm`**: chain adapter (from `chainsig.js`) used to:
  - **Derive** the Ethereum address/public key for path `ethereum-1`.
  - **Prepare** a transaction for signing (returns tx + hashes to sign).
  - **Finalize** signing with RSV from the MPC and **broadcast** the tx.

So this file is the **Ethereum + Chain Signatures** glue used by the agent.

### `src/utils/fetch-eth-price.ts`

- **`getEthereumPriceUSD()`**:
  - Fetches ETH price from **OKX** and **Coinbase**.
  - Returns the **average × 100** as an integer (so the contract can store e.g. cents or fixed-point).
- Used by `transaction.ts` to get the price before calling `updatePrice`.

---

## 3. Frontend (`frontend/`)

React (Vite) app that talks to the agent API and shows agent account, derived ETH account, current on-chain price, and a “Set ETH Price” button.

### `frontend/src/config.js`

- **`API_URL`**: base URL of the agent (e.g. `http://localhost:3000` or your Phala deployment URL). No trailing slash.

### `frontend/src/App.jsx`

- **State**: agent address/balance, ETH address/balance, contract price, last tx hash, errors, toast message.
- **Effects**: on load, fetches agent account, ETH account, and current contract price.
- **Actions**:
  - **Get agent account**: `GET /api/agent-account` → show NEAR account and balance + link to NEAR faucet.
  - **Get ETH account**: `GET /api/eth-account` → show derived Sepolia address and balance + link to Sepolia faucet.
  - **Set price**: `GET /api/transaction` → show “sending…” then update displayed price and show Etherscan link.
- **Display**: “ETH Price Oracle”, instructions (fund agent, fund Sepolia, send price), current price box, tx link, two “Fund” cards and one “Set ETH Price” card.

### `frontend/src/ethereum.js`

- Likely helpers for reading the **current price** from the Ethereum contract (`getPrice`) and formatting balances; used by `App.jsx` (e.g. `getContractPrice`, `formatBalance`).

### `frontend/src/Overlay.jsx`

- UI overlay (e.g. loading or success message) when the user triggers “Set ETH Price”.

### Other frontend files

- **`main.jsx`**: React entry, mounts `App`.
- **`index.html`**: HTML entry.
- **`styles/globals.css`**: global styles.
- **`vite.config.js`**: Vite config for the frontend app.

---

## 4. DevOps / Deployment

- **`Dockerfile`**: builds the **agent** (Node app) for running in a container (e.g. Phala or local).
- **`docker-compose.yaml`**: composes the agent service (and any dependencies) for local or Phala deployment.
- **`package.json`** (root): scripts for `dev`, `build`, `start`, and Phala deploy (`phala:deploy`). The agent runs under `shade-agent-cli` in production so it can register and call the NEAR contract.

---

## 5. How It Fits NEAR and Shade Agents

- **NEAR**: hosts the agent contract (Rust) and the MPC (Chain Signatures) contract. The agent’s identity and permissions are on NEAR; signing for Ethereum is delegated to NEAR’s signer.
- **Shade Agent**: the contract and the agent server follow the Shade Agent pattern (register with attestation, request signatures via the contract). The agent never holds the Ethereum key; the MPC does.
- **TEE (Phala)**: optional; when `requires_tee` is true, only agents whose TEE attestation matches the approved measurements/PPIDs can register. That gives a “verifiable” agent in a known environment.

---

## Quick Reference Table

| Layer        | Role |
|-------------|------|
| **Frontend** | UI: show agent account, ETH account, current price, “Set ETH Price”; call agent API. |
| **Agent (src/)** | HTTP API; fetch ETH price; build EVM tx; call NEAR `request_signature`; broadcast signed tx to Sepolia. |
| **NEAR contract (contract/)** | Register agents (with attestation/whitelist); allow only valid agents to call `request_signature`; forward sign requests to MPC. |
| **NEAR MPC** | Hold Ethereum key (derived from path); sign payloads; no key on agent. |
| **Ethereum (Sepolia)** | Oracle contract stores last ETH price; agent calls `updatePrice(price)`. |

If you want, the next step can be a short “flow diagram” of one “Set ETH Price” click (frontend → agent → NEAR contract → MPC → Sepolia) or a deeper dive into attestation or Chain Signatures.
