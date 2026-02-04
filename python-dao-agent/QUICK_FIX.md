# Quick Fix for Current Error

## Problem
Your shade-agent-api cannot fund the agent account because `ajitesh-1.testnet` only has **0.08 NEAR**.

The API needs at least **1.5 NEAR** to:
- Fund the agent account with 0.3 NEAR
- Pay for transaction fees
- Register the agent in the contract

## Solution (3 steps)

### Step 1: Get Testnet NEAR Tokens

Visit one of these faucets and request tokens for `ajitesh-1.testnet`:
- https://near-faucet.io/
- https://testnet.mynearwallet.com/faucet

Request at least **2 NEAR** to have some buffer.

### Step 2: Verify You Have Enough NEAR

```bash
near account view-account-summary ajitesh-1.testnet network-config testnet now
```

Look for "Native account balance" - should be **>1.5 NEAR**.

### Step 3: Redeploy to Phala Cloud

Once your account is funded:
1. Go to Phala Cloud UI
2. Navigate to your CVM
3. Click "Redeploy" or "Restart"
4. Wait 2 minutes for initialization

## Expected Success Logs

After funding and redeploying, `shade-agent-api` logs should show:

```
✓ worker agent NEAR account ID: [some-hash]
✓ getBalance: [some amount]
✓ Funded agent account with 0.3 NEAR
✓ Agent registered in contract
✓ Shade Agent API ready on port: 3140
```

And `shade-agent-app` logs should show:

```
✓ API reachable at http://shade-agent-api:3140 (status: 200) after 1 attempts
Starting responder loop
Checking for new proposals...
```

## Still Not Working?

If you still get errors after funding:
1. Check the full `shade-agent-api` logs for other errors
2. Ensure the contract is initialized (see PHALA_TROUBLESHOOTING.md)
3. Verify codehashes are approved (see PHALA_TROUBLESHOOTING.md)

---

**Current Status:**
- ❌ Account balance: 0.08 NEAR (need 1.5+)
- ✓ Docker image built and pushed
- ✓ Docker compose configured correctly
- ✓ Environment variables set correctly
- ⏸️  Waiting for account funding to proceed
