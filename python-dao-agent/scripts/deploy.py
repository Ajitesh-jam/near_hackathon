#!/usr/bin/env python3
"""
Python deployment script - replaces shade-agent-cli for Python shade agents.
Based on: https://github.com/NearDeFi/shade-agent-cli
"""
import argparse
import os
import sys
from pathlib import Path

# Add parent to path so we can import from scripts/
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
from near_ops import create_account, deploy_contract, init_contract, approve_codehash
from docker_ops import build_and_push_image, run_api_locally, stop_container
from phala_ops import deploy_to_phala


def load_env():
    """Load .env.development.local and validate required vars."""
    env_path = Path.cwd() / ".env.development.local"
    if not env_path.exists():
        print("Error: .env.development.local not found")
        print("Copy .env.development.local.example to .env.development.local and configure it")
        sys.exit(1)
    
    load_dotenv(env_path)
    
    required = ["NEAR_ACCOUNT_ID", "NEAR_SEED_PHRASE", "NEXT_PUBLIC_contractId", "API_CODEHASH", "DOCKER_TAG"]
    for var in required:
        if not os.getenv(var):
            print(f"Error: {var} not set in .env.development.local")
            sys.exit(1)
    
    return {
        "near_account": os.getenv("NEAR_ACCOUNT_ID"),
        "seed_phrase": os.getenv("NEAR_SEED_PHRASE"),
        "contract_id": os.getenv("NEXT_PUBLIC_contractId"),
        "api_codehash": os.getenv("API_CODEHASH"),
        "app_codehash": os.getenv("APP_CODEHASH", ""),
        "docker_tag": os.getenv("DOCKER_TAG"),
        "phala_api_key": os.getenv("PHALA_API_KEY", ""),
    }


def main():
    parser = argparse.ArgumentParser(description="Deploy shade agent (Python replacement for shade-agent-cli)")
    parser.add_argument("-w", "--wasm", help="WASM path to deploy custom contract")
    parser.add_argument("-f", "--funding", type=str, default="8", help="Funding amount for contract account in NEAR")
    parser.add_argument("-i", "--image-only", action="store_true", help="Just build and push the Docker image")
    parser.add_argument("-c", "--contract-only", action="store_true", help="Build/push image and deploy contract only")
    parser.add_argument("--phala-only", action="store_true", help="Just deploy to Phala Cloud")
    parser.add_argument("--no-redeploy", action="store_true", help="Skip redeploying the contract")
    parser.add_argument("--no-build", action="store_true", help="Skip building/pushing Docker image")
    parser.add_argument("--no-phala", action="store_true", help="Skip deploying to Phala Cloud")
    parser.add_argument("--no-cache", action="store_true", help="Run docker build with --no-cache")
    
    args = parser.parse_args()
    config = load_env()
    
    # Determine if sandbox (ac-sandbox) or local proxy (ac-proxy)
    contract_prefix = config["contract_id"].split(".")[0]
    if contract_prefix not in ["ac-sandbox", "ac-proxy"]:
        print(f"Error: Invalid contract ID prefix: {contract_prefix}")
        print("Expected 'ac-sandbox' or 'ac-proxy'")
        sys.exit(1)
    
    is_sandbox = contract_prefix == "ac-sandbox"
    print(f"Mode: {'SANDBOX (Phala)' if is_sandbox else 'LOCAL PROXY'}")
    
    # Phala-only: just deploy to Phala
    if args.phala_only:
        if not config["phala_api_key"]:
            print("Error: PHALA_API_KEY not set")
            sys.exit(1)
        deploy_to_phala(config["phala_api_key"], config["docker_tag"])
        return
    
    # Build and push Docker image (if sandbox and --no-build not set)
    new_app_codehash = config["app_codehash"]
    if is_sandbox and not args.no_build:
        cache_flag = "" if not args.no_cache else "--no-cache"
        new_app_codehash = build_and_push_image(config["docker_tag"], cache_flag)
        if not new_app_codehash:
            print("Error: Failed to build/push Docker image")
            sys.exit(1)
        print(f"New APP_CODEHASH: {new_app_codehash}")
    
    # Stop if --image-only
    if args.image_only:
        return
    
    # Create account and deploy contract (if --no-redeploy not set)
    if not args.no_redeploy:
        # Create contract account
        if not create_account(
            config["contract_id"],
            config["near_account"],
            config["seed_phrase"],
            config["funding"],
        ):
            print("Error: Failed to create account")
            sys.exit(1)
        
        # Deploy contract
        if args.wasm:
            if not deploy_contract(
                config["contract_id"],
                config["near_account"],
                config["seed_phrase"],
                wasm_path=args.wasm,
            ):
                print("Error: Failed to deploy custom contract")
                sys.exit(1)
        else:
            print("Error: No --wasm specified and global contract not yet supported")
            sys.exit(1)
    
    # Stop if --contract-only
    if args.contract_only:
        return
    
    # Initialize contract (if --no-redeploy not set)
    if not args.no_redeploy:
        if not init_contract(
            config["contract_id"],
            config["near_account"],
            config["seed_phrase"],
        ):
            print("Error: Failed to initialize contract")
            sys.exit(1)
    
    # Approve API codehash
    if not approve_codehash(
        config["contract_id"],
        config["near_account"],
        config["seed_phrase"],
        config["api_codehash"],
    ):
        print("Error: Failed to approve API codehash")
        sys.exit(1)
    
    # Approve APP codehash (if sandbox)
    if is_sandbox:
        if not approve_codehash(
            config["contract_id"],
            config["near_account"],
            config["seed_phrase"],
            new_app_codehash,
        ):
            print("Error: Failed to approve APP codehash")
            sys.exit(1)
        
        # Deploy to Phala (if --no-phala not set)
        if not args.no_phala:
            if not config["phala_api_key"]:
                print("Warning: PHALA_API_KEY not set, skipping Phala deploy")
            else:
                deploy_to_phala(config["phala_api_key"], config["docker_tag"])
    else:
        # Local proxy: run shade-agent-api locally
        print("Running shade-agent-api locally on port 3140...")
        run_api_locally(config["api_codehash"])


if __name__ == "__main__":
    main()
