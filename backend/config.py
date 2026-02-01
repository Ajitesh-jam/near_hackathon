import os
import json

PORT_TO_START_AGENT = int(os.getenv("PORT_TO_START_AGENT", "7000"))


class Config:
    def __init__(self):
        self.port_to_start_agent = int(os.getenv("PORT_TO_START_AGENT", "7000"))
        self.docker_host = os.getenv("DOCKER_HOST", "ajitesh99")