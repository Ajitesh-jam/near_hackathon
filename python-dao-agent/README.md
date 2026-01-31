# verifiable-ai-dao

> [!WARNING]  
> This technology has not yet undergone a formal audit. Please conduct your own due diligence and exercise caution before integrating or relying on it in production environments.

This example is a DAO that blends NEAR smart contracts, yield-resume, Shade Agents, and verifiable AI all together.

When the user makes a makes a proposal to the DAO via a function call to the smart contract on NEAR, the contract halts its execution and files a new proposal in the contract, the Shade Agent indexes this proposal and calls NEAR AI's private/verifiable AI to make a decision on the proposal based on the DAO's manifesto, then submits the decision back to the contract when it resumes its execution and stores the proposal and decision in a list of finalized proposals.

This example shows:

- Using a NEAR smart contract with a Shade Agent.
- Having a Shade Agent fulfill a yield-resume request.
- A Shade Agent using verifiable AI.

This is the best way to add verifiable AI to a smart contract where the agent and LLM essentially becomes a part of the contract.

Please note that whilst the example uses NEAR AI's private/verifiable AI endpoints, the example does not yet actually verify the AI inside of the Shade Agent yet (this is TODO).

[Agent](./src/) - [Smart Contract](./contract/) - [Frontend](./frontend/)

---

## Prerequisites

- First, `clone` this repository

  ```bash
  git clone https://github.com/NearDeFi/verifiable-ai-dao
  cd verifiable-ai-dao
  ```

- Install NEAR and Shade Agent tooling:

  ```bash
  # Install the NEAR CLI
  curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/near-cli-rs/releases/latest/download/near-cli-rs-installer.sh | sh

  # Install the Shade Agent CLI
  npm i -g @neardefi/shade-agent-cli
  ```

- Create a `NEAR testnet account` and record the account name and `seed phrase`:

  ```bash
  export ACCOUNT_ID=example-name.testnet
  near account create-account sponsor-by-faucet-service $ACCOUNT_ID autogenerate-new-keypair save-to-keychain network-config testnet create
  ```

  replacing `example-name.testnet` with a unique account ID

- Set up Docker if you have not already:
  - Install Docker for [Mac](https://docs.docker.com/desktop/setup/install/mac-install/) or [Linux](https://docs.docker.com/desktop/setup/install/linux/) and create an account

  - Log in to Docker, using `docker login` for Mac or `sudo docker login` for Linux

- Set up a free Phala Cloud account at https://cloud.phala.network/register, then get an API key from https://cloud.phala.network/dashboard/tokens

- Get a NEAR AI API key at https://cloud.near.ai/dashboard/keys (you will need to fund your account)

---

## Set up

- Rename the `.env.development.local.example` file name to `.env.development.local` and configure your environment variables

- Start up Docker:

  For Mac

  Simply open the Docker Desktop application or run:

  ```bash
  open -a Docker
  ```

  For Linux

  ```bash
  sudo systemctl start docker
  ```

- Install dependencies

  ```bash
  npm i
  ```

---

## Local development (with Python deployment scripts)

The repo includes **Python deployment scripts** in `scripts/` as a replacement for `shade-agent-cli` to avoid Node/Yarn issues with Python agents. See [scripts/README.md](scripts/README.md) for full usage.

**Quick start:**

```bash
# Build contract
cd contract && cargo near build non-reproducible-wasm && cd ..

# Deploy (local proxy)
python scripts/deploy.py --wasm contract/target/near/contract.wasm --funding 7

# Or use the wrapper:
./deploy.sh --wasm contract/target/near/contract.wasm --funding 7
```

Then run the Python app in another terminal: `python -m src.index` (with `SHADE_AGENT_API_HOST=localhost`).

---

## Local development (with Python deployment scripts)

The repo includes **Python deployment scripts** in `scripts/` as a replacement for `shade-agent-cli` to avoid Node/Yarn issues with Python agents. See [scripts/README.md](scripts/README.md) for details.

**Quick deploy:**

```bash
# Build contract
cd contract && cargo near build non-reproducible-wasm && cd ..

# Deploy with Python scripts (local proxy mode)
python scripts/deploy.py --wasm contract/target/near/contract.wasm --funding 7
```

Or use the wrapper:

```bash
./deploy.sh --wasm contract/target/near/contract.wasm --funding 7
```

This will deploy the contract, approve codehashes, and run shade-agent-api on port 3140. Then in another terminal:

```bash
export SHADE_AGENT_API_HOST=localhost
python -m src.index
```

---

## Local development (original with shade-agent-cli)

If you want to use the original Node-based `shade-agent-cli`, note that it will fail with Yarn/Corepack errors after deploying the contract (see the Python app run instructions above).

- [Comment out the require approved code hash line](./contract/src/dao.rs#L106) so it works for local deployment

- Compile the contract

  For Mac

  ```bash
  cd contract
  docker run --rm -v "$(pwd)":/workspace pivortex/near-builder@sha256:cdffded38c6cff93a046171269268f99d517237fac800f58e5ad1bcd8d6e2418 cargo near build non-reproducible-wasm
  ```

  For Linux

  ```bash
  cd contract
  cargo near build non-reproducible-wasm
  ```

- Make sure the `NEXT_PUBLIC_contractId` prefix is set to `ac-proxy.` followed by your NEAR accountId

- In one terminal, run the Shade Agent CLI with the wasm flag to deploy a custom contract and the funding flag:

  ```bash
  shade-agent-cli --wasm contract/target/near/contract.wasm --funding 7
  ```

  The CLI on Linux may prompt you to enter your `sudo password`.

- In another terminal, start your app:

  ```bash
  npm run dev
  ```

  If you use `ac-sandbox.*` as `NEXT_PUBLIC_contractId` but run the app locally (`npm run dev`), set `SHADE_AGENT_API_HOST=localhost` in `.env.development.local` so the app reaches the API at `localhost:3140`. Otherwise the app tries to connect to `shade-agent-api` (Docker service name), which only resolves when the app runs inside Docker Compose.

---

### TEE Deployment

- [Re-introduce the require approved code hash line](./contract/src/dao.rs#L106) so it requires the agent to be running in a TEE

- Compile the contract

  For Mac

  ```bash
  cd contract
  docker run --rm -v "$(pwd)":/workspace pivortex/near-builder@sha256:cdffded38c6cff93a046171269268f99d517237fac800f58e5ad1bcd8d6e2418 cargo near build non-reproducible-wasm
  ```

  For Linux

  ```bash
  cd contract
  cargo near build non-reproducible-wasm
  ```

- Change the `NEXT_PUBLIC_contractId` prefix to `ac-sandbox.` followed by your NEAR accountId.

- Run the Shade Agent CLI with the wasm flag to deploy a custom contract and the funding flag

  ```bash
  shade-agent-cli --wasm contract/target/near/contract.wasm --funding 7
  ```

  The CLI on Linux may prompt you to enter your `sudo password`.

  **If Phala deploy fails with a "Schema validation error"** (e.g. `Expected string, received null` for `base_image`, `manifest_version`, `version`, `runner`), the CLI’s `cvms create` flow hits a legacy API whose response doesn’t match the schema.

  **Do not use `shade-agent-cli --phala-only`** — it uses the same broken path. Use **`npm run phala:only`** or **`npm run phala:deploy`** instead (they run `phala deploy`, which works).
  - **Option A – One command (recommended):** Run both steps via npm:

    ```bash
    npm run deploy:tee
    ```

    This runs `shade-agent-cli --no-phala` (build, push, contract) then `phala:deploy` (Phala only).

  - **Option B – Two steps:**
    1. Deploy everything except Phala:

       ```bash
       shade-agent-cli --wasm contract/target/near/contract.wasm --funding 7 --no-phala
       ```

    2. Deploy to Phala only:

       ```bash
       npm run phala:deploy
       ```

  - **Option C – Phala failed only:** If you already ran the full CLI and it failed only at the Phala step (build/push/contract are done), run:

    ```bash
    npm run phala:deploy
    ```

  Ensure `PHALA_API_KEY` is set in `.env.development.local`.

  If `phala:deploy` fails with **"Node X requires a KMS ID"**, the default Phala node needs on-chain KMS. You can either run `npm run phala:deploy` in **interactive** mode and follow the prompts (select node/KMS if offered), or create the CVM via the [Phala Cloud UI](https://cloud.phala.network): **Create CVM** → **Docker Compose** → paste your `docker-compose.yaml` and set env vars (use Encrypted Secrets for `NEAR_SEED_PHRASE`, etc.).

  **Phala / Docker:** The Python app must reach the shade-agent-api container. `docker-compose.yaml` sets `SHADE_AGENT_API_HOST=shade-agent-api` for the app service. If you set env vars in the Phala Cloud UI, do **not** set `SHADE_AGENT_API_HOST=localhost` (that would make the app try to connect to localhost inside the container and fail). Use `shade-agent-api` or leave it unset so the compose value is used.

---

## Interacting with the protocol

- Set the manifesto in the contract

  ```bash
  near contract call-function as-transaction <contractId> set_manifesto json-args '{"manifesto_text": "This DAO only approves gaming related proposals and rejects everything else"}' prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' sign-as <accountId> network-config testnet sign-with-seed-phrase '<seed phrase>' --seed-phrase-hd-path 'm/44'\''/397'\''/0'\''' send
  ```

  Replacing the <contractId> (ac-sandbox.NEAR_ACCOUNT_ID), <accountId> (NEAR_ACCOUNT_ID), <seed phrase>, and optionally the manifesto text.

- Set your contractId in the frontend's [config.js](./frontend/src/config.js) file

- Start the frontend

```bash
cd frontend
npm i
npm run dev
```

---

## Troubleshooting

If you encounter issues with Phala Cloud deployment (especially `httpx.ConnectError: All connection attempts failed`), see the comprehensive troubleshooting guide:

**[PHALA_TROUBLESHOOTING.md](./PHALA_TROUBLESHOOTING.md)**

The guide covers:
- Checking if both containers are running
- Verifying shade-agent-api logs
- Ensuring correct environment variables
- Debugging network connectivity
- Contract initialization issues
- Common solutions and fixes
