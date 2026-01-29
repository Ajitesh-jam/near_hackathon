// Optional: Type definitions matching backend schemas
export interface Tool {
  name: string;
  type: string;
  description: string;
  config_schema: Record<string, any>;
}

export interface Agent {
  agent_id: string;
  user_id: string;
  tools: Tool[];
  config: Record<string, any>;
  path: string;
  created_at: string;
}
