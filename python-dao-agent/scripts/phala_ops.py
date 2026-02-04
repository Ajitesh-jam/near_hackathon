"""
Phala Cloud operations via phala CLI (npx phala).
"""
import subprocess


PHALA_VERSION = "1.1.1"


def deploy_to_phala(phala_api_key: str, docker_tag: str) -> str | None:
    """
    Login to Phala Cloud and deploy the app.
    Returns app_id if successful.
    """
    # Login
    print("Logging in to Phala Cloud...")
    login_cmd = ["npx", f"phala@{PHALA_VERSION}", "auth", "login", phala_api_key]
    try:
        subprocess.run(login_cmd, check=True, capture_output=True, text=True)
        print("Successfully logged in to Phala Cloud")
    except subprocess.CalledProcessError as e:
        print(f"Error authenticating with Phala Cloud: {e}")
        print(e.stdout)
        print(e.stderr)
        return None
    
    # Deploy
    print("Deploying to Phala Cloud...")
    app_name = docker_tag.split("/")[-1]
    if len(app_name) <= 3:
        print("Error: Docker tag app name must be longer than 3 characters")
        return None
    
    deploy_cmd = [
        "npx", f"phala@{PHALA_VERSION}",
        "cvms", "create",
        "--name", app_name,
        "--vcpu", "1",
        "--compose", "./docker-compose.yaml",
        "--env-file", "./.env.development.local",
    ]
    
    try:
        result = subprocess.run(deploy_cmd, capture_output=True, text=True, check=True)
        print("Deployed to Phala Cloud")
        print(result.stdout)
        
        # Extract App ID
        import re
        match = re.search(r"App ID\s*│\s*(app_[a-f0-9]+)", result.stdout)
        if match:
            app_id = match.group(1)
            print(f"App ID: {app_id}")
            
            # Extract deployment URL if present
            url_match = re.search(r"App URL\s*│\s*(https://[^\s]+)", result.stdout)
            if url_match:
                print(f"\n🎉 Your deployment: {url_match.group(1)}")
            
            return app_id
        else:
            print("Warning: Could not extract App ID from output")
            return None
    except subprocess.CalledProcessError as e:
        print(f"Error deploying to Phala Cloud: {e}")
        print(e.stdout)
        print(e.stderr)
        return None
