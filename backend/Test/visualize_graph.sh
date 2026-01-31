#!/bin/bash
# Quick script to visualize the graph using venv
cd "$(dirname "$0")"
source venv/bin/activate
python visualize_graph.py "$@"
