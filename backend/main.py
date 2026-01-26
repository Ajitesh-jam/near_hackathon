from fastapi import FastAPI, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import services.agent_service as agent_service
from utils.schemas import (
    AgentChatRequestSchema,
    AgentChatResponseSchema,
)
import time
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

COMMON_HEADERS = {
    "X-Service-Name": "agent-api",
    "X-Service-Status": "ok",
}

@app.get("/")
def health_check(response: Response):
    response.headers.update(COMMON_HEADERS)
    response.headers["X-Timestamp"] = str(time.time())
    return {"status": "healthy", "time": time.time()}

@app.post("/agent/chat")
async def agent_chat(request: AgentChatRequestSchema) -> AgentChatResponseSchema:
    response_data = agent_service.run_agent(request.message)
    return AgentChatResponseSchema(text=response_data["text"], auto_fill=response_data["auto_fill"])

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080, reload=True)