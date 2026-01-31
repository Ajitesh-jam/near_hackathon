"""
NEAR operations via near-cli-rs subprocess calls.
"""
import subprocess
import time


def _run_near_cmd(cmd: list[str]) -> bool:
    """Run a near CLI command and return True if successful."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error running: {' '.join(cmd)}")
        print(e.stdout)
        print(e.stderr)
        return False


def create_account(
    contract_id: str,
    master_account: str,
    seed_phrase: str,
    funding: str,
) -> bool:
    """
    Create the contract account (delete if exists, then create).
    Uses near-cli-rs: near account delete-account / create-account
    """
    print(f"Creating account: {contract_id}")
    
    # Try to delete if exists (ignore failure)
    print("Checking if account exists (delete if so)...")
    delete_cmd = [
        "near", "account", "delete-account",
        contract_id,
        "beneficiary", master_account,
        "network-config", "testnet",
        "sign-with-seed-phrase",
        seed_phrase,
        "--seed-phrase-hd-path", "m/44'/397'/0'",
        "send",
    ]
    subprocess.run(delete_cmd, capture_output=True, text=True)  # ignore result
    time.sleep(1)
    
    # Create account
    create_cmd = [
        "near", "account", "create-account",
        "fund-myself", contract_id,
        f"{funding} NEAR",
        "use-manually-provided-seed-phrase",
        seed_phrase,
        "--seed-phrase-hd-path", "m/44'/397'/0'",
        "network-config", "testnet",
        "create",
    ]
    if _run_near_cmd(create_cmd):
        print(f"Contract account created: {contract_id}")
        time.sleep(1)
        return True
    return False


def deploy_contract(
    contract_id: str,
    master_account: str,
    seed_phrase: str,
    wasm_path: str,
) -> bool:
    """
    Deploy the contract WASM to the contract account.
    Uses: near contract deploy <contract_id> use-file <wasm> ...
    """
    print(f"Deploying contract: {wasm_path} to {contract_id}")
    
    cmd = [
        "near", "contract", "deploy",
        contract_id,
        "use-file", wasm_path,
        "without-init-call",
        "network-config", "testnet",
        "sign-with-seed-phrase",
        seed_phrase,
        "--seed-phrase-hd-path", "m/44'/397'/0'",
        "send",
    ]
    if _run_near_cmd(cmd):
        print(f"Custom contract deployed: {contract_id}")
        time.sleep(1)
        return True
    return False


def init_contract(
    contract_id: str,
    owner_account: str,
    seed_phrase: str,
) -> bool:
    """
    Call init(owner_id) on the contract.
    """
    print(f"Initializing contract: {contract_id} with owner {owner_account}")
    
    cmd = [
        "near", "contract", "call-function",
        "as-transaction", contract_id,
        "init",
        "json-args", f'{{"owner_id": "{owner_account}"}}',
        "prepaid-gas", "30 Tgas",
        "attached-deposit", "0 NEAR",
        "sign-as", owner_account,
        "network-config", "testnet",
        "sign-with-seed-phrase",
        seed_phrase,
        "--seed-phrase-hd-path", "m/44'/397'/0'",
        "send",
    ]
    if _run_near_cmd(cmd):
        print("Contract initialized: true")
        time.sleep(1)
        return True
    return False


def approve_codehash(
    contract_id: str,
    owner_account: str,
    seed_phrase: str,
    codehash: str,
) -> bool:
    """
    Call approve_codehash(codehash) on the contract.
    """
    print(f"Approving codehash: {codehash}")
    
    cmd = [
        "near", "contract", "call-function",
        "as-transaction", contract_id,
        "approve_codehash",
        "json-args", f'{{"codehash": "{codehash}"}}',
        "prepaid-gas", "30 Tgas",
        "attached-deposit", "0 NEAR",
        "sign-as", owner_account,
        "network-config", "testnet",
        "sign-with-seed-phrase",
        seed_phrase,
        "--seed-phrase-hd-path", "m/44'/397'/0'",
        "send",
    ]
    if _run_near_cmd(cmd):
        print(f"Codehash approved: true")
        time.sleep(1)
        return True
    return False
