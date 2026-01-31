"""
Docker operations: build, push, update .env and docker-compose.yaml.
"""
import re
import subprocess
import sys
from pathlib import Path


def build_and_push_image(docker_tag: str, cache_flag: str = "") -> str | None:
    """
    Build and push Docker image, return the new APP_CODEHASH (sha256 digest).
    Updates .env.development.local and docker-compose.yaml with the new codehash.
    """
    print("Building Docker image...")
    build_cmd = [
        "docker", "build",
        "--platform", "linux/amd64",
        "-t", f"{docker_tag}:latest",
        ".",
    ]
    if cache_flag:
        build_cmd.insert(2, cache_flag)
    
    try:
        subprocess.run(build_cmd, check=True)
        print("Docker image built")
    except subprocess.CalledProcessError as e:
        print(f"Error building Docker image: {e}")
        return None
    
    print("Pushing Docker image...")
    push_cmd = ["docker", "push", f"{docker_tag}:latest"]
    try:
        result = subprocess.run(push_cmd, capture_output=True, text=True, check=True)
        print("Docker image pushed")
        
        # Extract sha256 digest from push output
        match = re.search(r"sha256:([a-f0-9]{64})", result.stdout + result.stderr)
        if not match:
            print("Error: Could not find sha256 digest in docker push output")
            return None
        
        new_codehash = match.group(1)
        print(f"New APP_CODEHASH: {new_codehash}")
        
        # Update .env.development.local
        if not _update_env_codehash(new_codehash):
            print("Warning: Failed to update .env.development.local")
        
        # Update docker-compose.yaml
        if not _update_compose_codehash(docker_tag, new_codehash):
            print("Warning: Failed to update docker-compose.yaml")
        
        return new_codehash
    except subprocess.CalledProcessError as e:
        print(f"Error pushing Docker image: {e}")
        print(e.stdout)
        print(e.stderr)
        return None


def _update_env_codehash(codehash: str) -> bool:
    """Update APP_CODEHASH in .env.development.local."""
    env_path = Path.cwd() / ".env.development.local"
    try:
        data = env_path.read_text()
        updated = re.sub(r"APP_CODEHASH=[a-f0-9]{64}", f"APP_CODEHASH={codehash}", data)
        if updated == data:
            # Not found, append
            updated = data.rstrip() + f"\nAPP_CODEHASH={codehash}\n"
        env_path.write_text(updated)
        print("Codehash replaced in .env.development.local")
        return True
    except Exception as e:
        print(f"Error updating .env.development.local: {e}")
        return False


def _update_compose_codehash(docker_tag: str, codehash: str) -> bool:
    """Update the second @sha256:... (shade-agent-app) in docker-compose.yaml."""
    compose_path = Path.cwd() / "docker-compose.yaml"
    try:
        data = compose_path.read_text()
        # Find all @sha256:... and replace the second one (app image)
        matches = list(re.finditer(r"@sha256:[a-f0-9]{64}", data))
        if len(matches) < 2:
            print("Warning: Could not find shade-agent-app image digest in docker-compose.yaml")
            return False
        
        app_digest_match = matches[1]
        new_digest = f"@sha256:{codehash}"
        # Replace the digest
        data = data[:app_digest_match.start()] + new_digest + data[app_digest_match.end():]
        
        # Also update the image: line before that digest to use docker_tag
        # Find "image:" before the new_digest position
        image_pattern = r"image:\s*[^\s@]+"
        image_start = data.rfind("image:", 0, app_digest_match.start())
        if image_start != -1:
            # Find the end of the image name (before @sha256)
            image_end = data.find("\n", image_start)
            if image_end == -1:
                image_end = len(data)
            # Extract and replace
            old_image_line = data[image_start:image_end]
            new_image_line = f"image: {docker_tag}{new_digest}"
            data = data[:image_start] + new_image_line + data[image_end:]
        
        compose_path.write_text(data)
        print("Codehash replaced in docker-compose.yaml")
        return True
    except Exception as e:
        print(f"Error updating docker-compose.yaml: {e}")
        return False


def stop_container():
    """Stop any container on port 3140 (shade-agent-api local)."""
    print("Stopping container on port 3140...")
    try:
        result = subprocess.run(
            ["docker", "ps", "-q", "--filter", "publish=3140"],
            capture_output=True,
            text=True,
            check=True,
        )
        container_id = result.stdout.strip()
        if container_id:
            subprocess.run(["docker", "stop", container_id], check=True)
            print(f"Stopped container {container_id} on port 3140")
        else:
            print("No container found on port 3140")
    except subprocess.CalledProcessError as e:
        print(f"Warning: Error stopping container: {e}")


def run_api_locally(api_codehash: str):
    """Run shade-agent-api locally on port 3140 (foreground)."""
    stop_container()
    
    print("Starting shade-agent-api on port 3140...")
    cmd = [
        "docker", "run",
        "-p", "0.0.0.0:3140:3140",
        "--platform", "linux/amd64",
        "--env-file", ".env.development.local",
        "--rm",
        "-e", "PORT=3140",
        f"mattdlockyer/shade-agent-api@sha256:{api_codehash}",
    ]
    
    print(f"Running: {' '.join(cmd)}")
    print("Press Ctrl+C to stop")
    
    try:
        subprocess.run(cmd)
    except KeyboardInterrupt:
        print("\nStopping API...")
        stop_container()
