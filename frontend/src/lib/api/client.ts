// Simple API client - minimal implementation
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// API functions matching backend endpoints
export const api = {
  // Health check
  healthCheck: () => request<{ status: string; time: number }>('/'),

  // Agent chat
  agentChat: (message: string) => 
    request<{ text: string; auto_fill?: any }>('/agent/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  // Tools
  listTools: (userId?: string) => {
    const url = userId ? `/tools/list?user_id=${userId}` : '/tools/list';
    return request<{ tools: any[] }>(url);
  },

  generateTool: (requirements: string, existingTools: any[]) =>
    request<{ tools: any[] }>('/tools/generate', {
      method: 'POST',
      body: JSON.stringify({ requirements, existing_tools: existingTools }),
    }),

  // Forge workflow
  forgeProcess: (userMessage: string, userId: string) =>
    request<{
      agent_id: string;
      selected_tools: any[];
      generated_tools: any[];
      logic_code: string;
      current_step: string;
    }>('/forge/process', {
      method: 'POST',
      body: JSON.stringify({ user_message: userMessage, user_id: userId }),
    }),

  // Logic generation
  generateLogic: (selectedTools: any[], userIntent: string, agentConfig: any) =>
    request<{ logic_code: string }>('/logic/generate', {
      method: 'POST',
      body: JSON.stringify({
        selected_tools: selectedTools,
        user_intent: userIntent,
        agent_config: agentConfig,
      }),
    }),

  // Agents
  listAgents: (userId: string) =>
    request<{ agents: any[] }>(`/agents/list?user_id=${userId}`),

  createAgent: (userId: string, agentId: string | undefined, selectedTools: any[], config: any) =>
    request<{ status: string; agent_id: string; path: string }>('/agents', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        agent_id: agentId,
        selected_tools: selectedTools,
        config,
      }),
    }),

  removeAgent: (agentId: string, userId: string) =>
    request<{ status: string; agent_id: string }>(
      `/agents/${agentId}?user_id=${userId}`,
      { method: 'DELETE' }
    ),

  // HITL Workflow endpoints
  startForgeSession: (userId: string) =>
    request<{ session_id: string; status: string }>('/forge/start', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),

  getSessionStatus: (sessionId: string) =>
    request<{
      session_id: string;
      waiting_for_input: boolean;
      waiting_stage: string;
      current_step: string;
      template_code?: Record<string, string>;
      code_errors?: Array<{
        file_path: string;
        error_type: string;
        message: string;
        line_number?: number;
      }>;
      user_clarifications?: Array<{ question: string; answer: string }>;
      tool_changes?: { add: string[]; remove: string[]; reason: string };
      selected_tools?: any[];
      agent_id?: string;
    }>(`/forge/session/${sessionId}/status`),

  submitTools: (sessionId: string, tools: any[]) =>
    request<{
      session_id: string;
      waiting_for_input: boolean;
      waiting_stage: string;
      current_step: string;
    }>(`/forge/session/${sessionId}/tools`, {
      method: 'POST',
      body: JSON.stringify({ tools }),
    }),

  submitCustomTools: (sessionId: string, requirements: string) =>
    request<{
      session_id: string;
      waiting_for_input: boolean;
      waiting_stage: string;
      current_step: string;
    }>(`/forge/session/${sessionId}/custom-tools`, {
      method: 'POST',
      body: JSON.stringify({ requirements }),
    }),

  submitPrompt: (sessionId: string, prompt: string) =>
    request<{
      session_id: string;
      waiting_for_input: boolean;
      waiting_stage: string;
      current_step: string;
    }>(`/forge/session/${sessionId}/prompt`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),

  submitClarification: (sessionId: string, answers: Array<{ question: string; answer: string }>) =>
    request<{
      session_id: string;
      waiting_for_input: boolean;
      waiting_stage: string;
      current_step: string;
    }>(`/forge/session/${sessionId}/clarification`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),

  submitToolReview: (sessionId: string, changes: { add: string[]; remove: string[]; confirmed: boolean }) =>
    request<{
      session_id: string;
      waiting_for_input: boolean;
      waiting_stage: string;
      current_step: string;
    }>(`/forge/session/${sessionId}/tool-review`, {
      method: 'POST',
      body: JSON.stringify({ changes }),
    }),

  updateCode: (sessionId: string, filePath: string, content: string) =>
    request<{
      session_id: string;
      waiting_for_input: boolean;
      waiting_stage: string;
      current_step: string;
    }>(`/forge/session/${sessionId}/code-update`, {
      method: 'POST',
      body: JSON.stringify({ file_path: filePath, content }),
    }),

  finalizeAgent: (sessionId: string) =>
    request<{
      session_id: string;
      waiting_for_input: boolean;
      waiting_stage: string;
      current_step: string;
      agent_id?: string;
    }>(`/forge/session/${sessionId}/finalize`, {
      method: 'POST',
    }),
};
