#!/bin/bash
# Quick wrapper: python scripts/deploy.py with args
cd "$(dirname "$0")"
python3 scripts/deploy.py "$@"
