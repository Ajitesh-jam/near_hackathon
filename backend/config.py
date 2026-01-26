import os
import json

MERCHANTS_FILE = os.path.join(".", "Data", "merchants.json")
SPENDING_LIMIT_ETH = float(os.getenv("SPENDING_LIMIT_ETH", "1.0"))