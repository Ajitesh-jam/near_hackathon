# Eve and Wall E: The Verifiable Life-Ops Protocol 🛡️🤖

Welcome to **Eve and WallE**, the first "Meta-Agent Factory" designed for the decentralized world. Eve and WallE empowers non-technical users to deploy **Eve and WallE Agents**—autonomous, private, and verifiable AI assistants—into secure hardware enclaves (TEEs) using nothing but natural language.

Our flagship agent, **WallE**, acts as your "Confidential Life-Ops Manager," handling everything from your Netflix passwords to your multi-chain wealth.

## 🚀 The Core Philosophy: Why "Eve and WallE"?

- **Trustless Autonomy:** You don't trust us (the developers). You trust the **Hardware Enclave (TEE)** and the **Verifiable Code Hash**.
- **Privacy-First Compute:** Your keys, medical logs, and passwords never leave the secure CPU. Even if the physical server is hacked, your data remains encrypted in memory.
- **Persistent Execution:** Unlike a chatbot, these agents live on the **Phala Network**. They keep working (monitoring your will, tracking trades, paying bills) long after you close your browser tab.
- **"Can't Be Evil":** Because the deployment is verifiable, the agent can only execute the code you approved. No backdoors, no front-running.

---

## 🤖 Meet the Agents

### 1. WallE (Your Personal AI Assistant)

The ultimate digital vault with a brain. WallE manages your "Confidential RAG" (Knowledge Base) and handles high-stakes tasks.

- **Confidentiality:** "WallE, what is my Netflix password?" or "WallE, here is my private medical log for today."
- **Financial Agency:** "WallE, schedule my rent payment for the 1st of every month using my NEAR wallet."
- **Privacy-Preserving Advice:** Get spending insights without a bank seeing your data.

### 2. The Will Executor (Proof-of-Life)

A "Dead Man's Switch" for the 21st century. It monitors your "Proof of Life" (YouTube activity, Gmail, or custom triggers) and autonomously executes your will to distribute assets to your beneficiaries if you go silent.

### 3. The Crypto Trading Agent (Proprietary Alpha)

A trading bot where the **strategy is the secret**. Deploy custom algorithms into a TEE so that RPC nodes and competitors can't front-run your logic or steal your alpha.

---

## 🔗 Live Demos

- **Deployed WallE Agent:** [https://14bee907669e86509fa4fd53b9389aba27264bf7-3000.dstack-prod5.phala.network](https://14bee907669e86509fa4fd53b9389aba27264bf7-3000.dstack-prod5.phala.network)
- **Project Dashboard:** [nearhackathon.vercel.app](https://nearhackathon.vercel.app)

### Proof of Deployment

The WallE agent is live on **Phala Network's dStack**, running in a Trusted Execution Environment (TEE):

![WallE Agent Deployed on Phala Network](imgs/agent_deployed.png)

_Screenshot: Phala dStack dashboard showing the personal-ai-new agent in RUNNING state with API logs (including successful `/notifications` requests)._

---

## 🛠️ Getting Started

### 1. Master Agent (The Factory)

This is the backend that orchestrates the deployment of your personal agents.

**Backend Setup:**

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

pip install -r requirements.txt
uvicorn main:app --port 8000 --reload
```

**Frontend Setup:**

```bash
cd frontend
npm install
npm run dev
```

### 2. WallE (Personal AI)

**Agent Backend:**

```bash
cd personal_ai
npm install
npm run dev
```

**Agent Frontend:**

```bash
cd personal_ai_frontend
npm install
npm run dev
```

---

## 🛡️ Security Note

All deployments through ShadeMaster are sent directly to **Phala Network's dStack**. Your `NEAR_SEED_PHRASE` and other secrets are encrypted before deployment and are only ever decrypted inside the hardware-level security of a TEE.

---

> _"We are moving from 'Don't be evil' to 'Can't be evil'. Your life, your data, your agent."_
