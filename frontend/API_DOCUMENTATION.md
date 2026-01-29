# API Documentation

## Error Responses

All endpoints may return the following error codes:

- **503 Service Unavailable**: Service not initialized (missing API keys or configuration)
- **404 Not Found**: Resource not found
- **422 Unprocessable Entity**: Validation error (invalid request body)
- **500 Internal Server Error**: Server error

Error response format:
```json
{
  "detail": "Error message description"
}
```

---

## Endpoints

### 1. Health Check

Check if the API server is running and healthy.

**Endpoint:** `GET /`

**Query Parameters:** None

**Request Body:** None

**Response:**
```json
{
  "status": "healthy",
  "time": 1704067200.123
}
```

**Example:**
```bash
curl http://localhost:8080/
```

---

### 2. Agent Chat

Send a chat message to an agent and receive a response.

**Endpoint:** `POST /agent/chat`

**Request Body:**
```json
{
  "message": "string"
}
```

**Response:**
```json
{
  "text": "Agent response text",
  "auto_fill": {
    // Optional: Auto-fill data for forms
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/agent/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, can you help me create a trading agent?"
  }'
```

**Note:** This endpoint may be incomplete. Consider using `/forge/process` for agent creation workflows.

---

### 3. List Tools

Get all available tools (platform tools + temporary user-specific tools if `user_id` is provided).

**Endpoint:** `GET /tools/list`

**Query Parameters:**
- `user_id` (optional, string): User ID to include temporary AI-generated tools

**Request Body:** None

**Response:**
```json
{
  "active": [
    {
      "name": "CryptoPriceChecker",
      "type": "active",
      "description": "Monitors cryptocurrency prices",
      "config_schema": {
        "symbol": {
          "type": "string",
          "required": true
        },
        "threshold": {
          "type": "number",
          "required": false
        }
      }
    }
  ],
  "reactive": [
    {
      "name": "TradeExecutor",
      "type": "reactive",
      "description": "Executes trades on exchanges",
      "config_schema": {
        "exchange": {
          "type": "string",
          "required": true
        }
      }
    }
  ]
}
```

**Example:**
```bash
# Get all platform tools
curl http://localhost:8080/tools/list

# Get platform tools + user's temporary tools
curl "http://localhost:8080/tools/list?user_id=user123"
```

---

### 4. Forge Process (Main Workflow)

Main LangGraph workflow endpoint that creates an agent from a user message. This endpoint:
1. Understands user intent
2. Suggests platform tools
3. Generates custom tools (if needed)
4. Generates logic code
5. Creates the agent

**Endpoint:** `POST /forge/process`

**Request Body:**
```json
{
  "user_message": "I want to create a trading agent that monitors BTC price and executes trades",
  "user_id": "user123"
}
```

**Response:**
```json
{
  "agent_id": "agent_1",
  "selected_tools": [
    {
      "name": "CryptoPriceChecker",
      "type": "active",
      "description": "Monitors cryptocurrency prices"
    },
    {
      "name": "TradeExecutor",
      "type": "reactive",
      "description": "Executes trades"
    }
  ],
  "generated_tools": [
    {
      "name": "CustomTool",
      "type": "reactive",
      "code": "class CustomTool(Tool): ..."
    }
  ],
  "logic_code": "class AgentLogic:\n    async def on_trigger(self, tool_name, result):\n        ...",
  "current_step": "completed"
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/forge/process \
  -H "Content-Type: application/json" \
  -d '{
    "user_message": "Create a trading agent for BTC",
    "user_id": "user123"
  }'
```

**Error Responses:**
- `503`: AI services not initialized (missing `GOOGLE_API_KEY` or `GEMINI_API_KEY`)

---

### 5. Generate Tool

AI generates custom tool code based on requirements. This is an optional/addon endpoint for granular control.

**Endpoint:** `POST /tools/generate`

**Request Body:**
```json
{
  "requirements": "I need a tool that checks social media sentiment for a given cryptocurrency",
  "existing_tools": [
    {
      "name": "CryptoPriceChecker",
      "type": "active"
    }
  ]
}
```

**Response:**
```json
{
  "tools": [
    {
      "name": "SocialSentimentChecker",
      "code": "class SocialSentimentChecker(Tool):\n    def _determine_type(self):\n        return ToolType.ACTIVE\n    ...",
      "type": "active"
    }
  ]
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/tools/generate \
  -H "Content-Type: application/json" \
  -d '{
    "requirements": "A tool to check social media sentiment",
    "existing_tools": []
  }'
```

**Error Responses:**
- `503`: AI services not initialized (missing `GOOGLE_API_KEY` or `GEMINI_API_KEY`)

---

### 6. Generate Logic

AI generates `logic.py` code that connects tools based on user intent. This is an optional/addon endpoint for granular control.

**Endpoint:** `POST /logic/generate`

**Request Body:**
```json
{
  "selected_tools": [
    {
      "name": "CryptoPriceChecker",
      "type": "active"
    },
    {
      "name": "TradeExecutor",
      "type": "reactive"
    }
  ],
  "user_intent": "Monitor BTC price and execute buy orders when price drops below $50000",
  "agent_config": {
    "user_id": "user123",
    "agent_id": "agent_1"
  }
}
```

**Response:**
```json
{
  "logic_code": "class AgentLogic:\n    def __init__(self, active_tools, reactive_tools):\n        self.active_tools = active_tools\n        self.reactive_tools = reactive_tools\n        self.state = {}\n    \n    async def on_trigger(self, tool_name, result):\n        if tool_name == 'CryptoPriceChecker' and result['price'] < 50000:\n            return {\"action\": \"execute\", \"tool\": \"TradeExecutor\", \"params\": {\"action\": \"buy\", \"amount\": 0.1}}\n        return {\"action\": \"wait\"}\n    \n    async def on_execution(self, decision, result):\n        self.state[\"last_action\"] = {\"decision\": decision, \"result\": result}"
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/logic/generate \
  -H "Content-Type: application/json" \
  -d '{
    "selected_tools": [
      {"name": "CryptoPriceChecker", "type": "active"},
      {"name": "TradeExecutor", "type": "reactive"}
    ],
    "user_intent": "Monitor BTC and trade when price drops",
    "agent_config": {"user_id": "user123"}
  }'
```

**Error Responses:**
- `503`: AI services not initialized (missing `GOOGLE_API_KEY` or `GEMINI_API_KEY`)

---

### 7. List Agents

Get all agents for a specific user.

**Endpoint:** `GET /agents/list`

**Query Parameters:**
- `user_id` (required, string): User ID to list agents for

**Request Body:** None

**Response:**
```json
{
  "agents": [
    {
      "agent_id": "agent_1",
      "user_id": "user123",
      "tools": [
        {
          "name": "CryptoPriceChecker",
          "type": "active"
        }
      ],
      "config": {
        "user_id": "user123",
        "agent_id": "agent_1"
      },
      "path": "Temp/user123/agent_1",
      "created_at": "/path/to/current/directory"
    }
  ]
}
```

**Example:**
```bash
curl "http://localhost:8080/agents/list?user_id=user123"
```

**Error Responses:**
- `503`: Services not initialized

---

### 8. Create Agent

Create a new agent directly (without using the forge workflow). This endpoint creates the agent codebase structure.

**Endpoint:** `POST /agents`

**Request Body:**
```json
{
  "user_id": "user123",
  "agent_id": "agent_1",
  "selected_tools": [
    {
      "name": "CryptoPriceChecker",
      "type": "active",
      "code": null
    },
    {
      "name": "TradeExecutor",
      "type": "reactive",
      "code": null
    }
  ],
  "config": {
    "user_id": "user123",
    "agent_id": "agent_1",
    "description": "Trading agent for BTC"
  }
}
```

**Response:**
```json
{
  "status": "created",
  "agent_id": "agent_1",
  "path": "Temp/user123/agent_1"
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/agents \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "selected_tools": [
      {"name": "CryptoPriceChecker", "type": "active"},
      {"name": "TradeExecutor", "type": "reactive"}
    ],
    "config": {"user_id": "user123", "description": "Trading agent"}
  }'
```

**Error Responses:**
- `503`: Services not initialized

**Note:** The `logic_code` parameter is currently set to empty string. You may want to generate logic separately using `/logic/generate` or use `/forge/process` which handles everything.

---

### 9. Delete Agent

Remove an agent and its associated codebase.

**Endpoint:** `DELETE /agents/{agent_id}`

**Path Parameters:**
- `agent_id` (required, string): ID of the agent to delete

**Query Parameters:**
- `user_id` (required, string): User ID that owns the agent

**Request Body:** None

**Response:**
```json
{
  "status": "deleted",
  "agent_id": "agent_1"
}
```

**Example:**
```bash
curl -X DELETE "http://localhost:8080/agents/agent_1?user_id=user123"
```

**Error Responses:**
- `404`: Agent not found
- `503`: Services not initialized

---

## Workflow Recommendations

### Recommended: Full Forge Workflow

For creating agents, use the `/forge/process` endpoint which handles everything automatically:

1. User sends message → `/forge/process`
2. System understands intent, selects tools, generates custom tools (if needed), generates logic, and creates agent
3. Returns complete agent with all code generated

**Example Flow:**
```typescript
const response = await fetch('http://localhost:8080/forge/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_message: 'Create a trading agent for BTC',
    user_id: 'user123'
  })
});

const result = await response.json();
// result contains: agent_id, selected_tools, generated_tools, logic_code
```

### Alternative: Step-by-Step Workflow

For more granular control, use the individual endpoints:

1. Get available tools → `GET /tools/list`
2. Generate custom tools (if needed) → `POST /tools/generate`
3. Generate logic → `POST /logic/generate`
4. Create agent → `POST /agents`

---

## TypeScript Types

For TypeScript projects, here are the type definitions:

```typescript
// Request Types
interface AgentChatRequest {
  message: string;
}

interface ForgeProcessRequest {
  user_message: string;
  user_id: string;
}

interface ToolGenerationRequest {
  requirements: string;
  existing_tools: Tool[];
}

interface LogicGenerationRequest {
  selected_tools: Tool[];
  user_intent: string;
  agent_config: Record<string, any>;
}

interface AgentGenerationRequest {
  user_id: string;
  agent_id?: string;
  selected_tools: Tool[];
  config: Record<string, any>;
}

// Response Types
interface AgentChatResponse {
  text: string;
  auto_fill?: Record<string, any>;
}

interface ForgeProcessResponse {
  agent_id: string;
  selected_tools: Tool[];
  generated_tools: Tool[];
  logic_code: string;
  current_step: string;
}

interface ToolGenerationResponse {
  tools: Tool[];
}

interface LogicGenerationResponse {
  logic_code: string;
}

interface AgentGenerationResponse {
  status: string;
  agent_id: string;
  path: string;
}

interface AgentListResponse {
  agents: Agent[];
}

interface AgentDeleteResponse {
  status: string;
  agent_id: string;
}

interface ToolsListResponse {
  active: Tool[];
  reactive: Tool[];
}

// Common Types
interface Tool {
  name: string;
  type: 'active' | 'reactive';
  description?: string;
  code?: string;
  config_schema?: Record<string, any>;
}

interface Agent {
  agent_id: string;
  user_id: string;
  tools: Tool[];
  config: Record<string, any>;
  path: string;
  created_at: string;
}
```

---

## Environment Variables Required

The backend requires the following environment variables:

- `GOOGLE_API_KEY` or `GEMINI_API_KEY`: Required for AI features (tool generation, logic generation, forge workflow)

Without these keys, the following endpoints will return `503`:
- `/forge/process`
- `/tools/generate`
- `/logic/generate`


## Notes

1. **Agent Chat Endpoint**: The `/agent/chat` endpoint may be incomplete as it references a `run_agent` function that may not be fully implemented. Consider using `/forge/process` for agent creation workflows.

2. **Tool Types**: Tools can be either:
   - **active**: Continuously monitor and trigger actions (e.g., price checkers)
   - **reactive**: Execute on-demand when called (e.g., trade executors)

3. **Agent Structure**: Created agents are stored in `Temp/{user_id}/{agent_id}/` with the following structure:
   - `main.py`: Agent entry point
   - `logic.py`: Agent logic code
   - `tools/`: Tool implementations
   - `requirements.txt`: Python dependencies
   - `Dockerfile`: Container configuration
   - `.env.example`: Environment variable template

4. **Forge Workflow**: The `/forge/process` endpoint uses LangGraph to orchestrate the agent creation process. It automatically handles tool selection, custom tool generation, and logic generation in a single call.

---

## Support

For issues or questions, please refer to the backend documentation or contact the backend team.
