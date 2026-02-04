from pathlib import Path
import shutil
import logging
import os
from typing import Dict

logger = logging.getLogger(__name__)

TEMPLATE_SKIP_NAMES = frozenset({"agent_templates.py", "__pycache__"})

def _copy_template_to_agent(template_dir: Path, agent_dir: Path) -> Dict[str, str]:
    """Copies all template contents to agent dir except backend-only files."""

    template_code: Dict[str, str] = {}

    for root, dirs, files in os.walk(template_dir):
        root_path = Path(root)

        dirs[:] = [
            directory for directory in dirs
            if directory not in TEMPLATE_SKIP_NAMES
        ]

        for directory in dirs:
            dst_dir = agent_dir / (root_path / directory).relative_to(template_dir)
            dst_dir.mkdir(parents=True, exist_ok=True)

        for file_name in files:
            if file_name in TEMPLATE_SKIP_NAMES or file_name.endswith(".pyc"):
                continue

            src_path = root_path / file_name
            relative_path = src_path.relative_to(template_dir).as_posix()
            dst_path = agent_dir / relative_path

            dst_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_path, dst_path)

            try:
                content = dst_path.read_text()
            except UnicodeDecodeError:
                content = dst_path.read_bytes().decode("utf-8", errors="ignore")
                logger.warning(
                    "Non-text template file decoded with UTF-8 ignore: %s",
                    relative_path,
                )

            template_code[relative_path] = content
            logger.info(f"Copied {relative_path} to agent dir")

    return template_code

def _read_all_files_from_dir(path: "Path", prefix: str = "") -> Dict[str, str]:
    """
    Recursively read all files from a directory, including subdirectories, into a flat mapping:
    path/to/file -> content. Includes dotfiles and all files and folders (e.g., contract/).
    Skips __pycache__ directories and .pyc files.
    """
    result: Dict[str, str] = {}
    if not path.exists() or not path.is_dir():
        return result

    for item in sorted(path.iterdir()):
        if item.name == "node_modules":
            continue
        if item.is_file():
            rel_path = f"{prefix}/{item.name}" if prefix else item.name
            try:
                content = item.read_text(encoding="utf-8")  
                result[rel_path] = content
            except Exception as e:
                result[rel_path] = f"# Error reading file: {e}"
        elif item.is_dir():
            rel_dir = f"{prefix}/{item.name}" if prefix else item.name
            result.update(_read_all_files_from_dir(item, rel_dir))
    return result