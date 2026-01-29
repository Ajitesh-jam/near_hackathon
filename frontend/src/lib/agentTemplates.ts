import { FileNode } from '@/components/CodeEditor';
import { Tool } from '@/components/ToolsSection';

export interface CustomTool {
  name: string;
  code: string;
  requirements: string;
}

export function generateAgentFiles(
  selectedTools: Tool[],
  prompt: string,
  llm: string,
  nearAccount: string,
  customTools: CustomTool[]
): FileNode[] {
  const generateId = () => Math.random().toString(36).substr(2, 9);
  
  // Generate main.py
  const mainPyContent = `from phala import Agent, ToolRegistry
from tools import *

# Initialize agent
agent = Agent(
    account_id="${nearAccount || 'agent.near'}",
    llm_provider="${llm}",
    system_prompt="""${prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"""
)

# Register tools
tool_registry = ToolRegistry()
${selectedTools.map(tool => `tool_registry.register(${tool.name.toLowerCase().replace(/\s+/g, '_')}())`).join('\n')}
${customTools.map(tool => `tool_registry.register(${tool.name.toLowerCase().replace(/\s+/g, '_')}())`).join('\n')}

# Main execution loop
if __name__ == "__main__":
    agent.run(tool_registry)
`;

  // Generate logic.py
  const logicPyContent = `"""
Agent logic implementation
Generated based on selected tools and prompt
"""

def process_request(user_input: str, context: dict) -> str:
    """
    Main processing function for agent logic
    
    Args:
        user_input: User's input message
        context: Current conversation context
        
    Returns:
        Agent's response string
    """
    # TODO: Implement agent logic based on:
    # - Selected tools: ${selectedTools.map(t => t.name).join(', ') || 'None'}
    # - System prompt: ${prompt.substring(0, 100)}...
    # - LLM Provider: ${llm}
    
    return agent.process(user_input, context)
`;

  // Generate requirements.txt
  const requirementsContent = `phala-sdk>=0.1.0
openai>=1.0.0
anthropic>=0.18.0
python-dotenv>=1.0.0
requests>=2.31.0
${customTools.map(tool => tool.requirements).filter(Boolean).join('\n')}
`.trim();

  // Generate Dockerfile
  const dockerfileContent = `FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "main.py"]
`;

  // Generate .env.example
  const envExampleContent = `# LLM API Keys
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# NEAR Account
NEAR_ACCOUNT_ID=${nearAccount || 'agent.near'}
NEAR_PRIVATE_KEY=your_near_private_key_here

# Phala Network
PHALA_RPC_URL=https://phala-rpc.polkadot.io
`;

  // Generate tool files
  const toolFiles: FileNode[] = selectedTools.map(tool => ({
    id: generateId(),
    name: `${tool.name.toLowerCase().replace(/\s+/g, '_')}.py`,
    type: 'file' as const,
    content: tool.code || `# ${tool.name} tool implementation\n\ndef execute():\n    pass\n`,
    language: 'python'
  }));

  // Generate custom tool files
  const customToolFiles: FileNode[] = customTools.map(tool => ({
    id: generateId(),
    name: `${tool.name.toLowerCase().replace(/\s+/g, '_')}.py`,
    type: 'file' as const,
    content: tool.code || `# Custom tool: ${tool.name}\n\ndef execute():\n    pass\n`,
    language: 'python'
  }));

  // Build file tree structure
  return [
    {
      id: generateId(),
      name: 'main.py',
      type: 'file',
      content: mainPyContent,
      language: 'python'
    },
    {
      id: generateId(),
      name: 'logic.py',
      type: 'file',
      content: logicPyContent,
      language: 'python'
    },
    {
      id: generateId(),
      name: 'requirements.txt',
      type: 'file',
      content: requirementsContent,
      language: 'plaintext'
    },
    {
      id: generateId(),
      name: 'Dockerfile',
      type: 'file',
      content: dockerfileContent,
      language: 'dockerfile'
    },
    {
      id: generateId(),
      name: '.env.example',
      type: 'file',
      content: envExampleContent,
      language: 'plaintext'
    },
    {
      id: generateId(),
      name: 'tools',
      type: 'folder',
      children: [
        {
          id: generateId(),
          name: '__init__.py',
          type: 'file',
          content: `# Tools package\n${selectedTools.map(t => `from .${t.name.toLowerCase().replace(/\s+/g, '_')} import *`).join('\n')}\n${customTools.length > 0 ? customTools.map(t => `from .${t.name.toLowerCase().replace(/\s+/g, '_')} import *`).join('\n') : ''}\n`,
          language: 'python'
        },
        ...toolFiles,
        ...customToolFiles
      ]
    }
  ];
}
