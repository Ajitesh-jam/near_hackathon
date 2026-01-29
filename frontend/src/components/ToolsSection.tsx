import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RefreshCw, 
  Search, 
  Database, 
  Send, 
  Globe, 
  FileText, 
  Shield, 
  Lock,
  Code2,
  ChevronDown,
  Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Tool {
  id: string;
  name: string;
  description: string;
  code: string;
  isHighlighted?: boolean;
}

const defaultTools: Tool[] = [
  {
    id: 'web_search',
    name: 'Web Search',
    description: 'Performs web searches to find relevant information from the internet.',
    code: `import requests
from typing import List, Dict

def web_search(query: str, num_results: int = 5) -> List[Dict]:
    """
    Perform a web search and return results.
    
    Args:
        query: Search query string
        num_results: Number of results to return
        
    Returns:
        List of search results with title, url, snippet
    """
    api_key = os.environ.get("SEARCH_API_KEY")
    response = requests.get(
        "https://api.search.com/v1/search",
        params={"q": query, "limit": num_results},
        headers={"Authorization": f"Bearer {api_key}"}
    )
    return response.json()["results"]`,
  },
  {
    id: 'database_query',
    name: 'Database Query',
    description: 'Executes SQL queries against connected databases safely.',
    code: `import sqlite3
from typing import Any, List

def database_query(sql: str, params: tuple = ()) -> List[Any]:
    """
    Execute a SQL query and return results.
    
    Args:
        sql: SQL query string
        params: Query parameters for safe execution
        
    Returns:
        Query results as list of rows
    """
    conn = sqlite3.connect(os.environ.get("DB_PATH"))
    cursor = conn.cursor()
    cursor.execute(sql, params)
    results = cursor.fetchall()
    conn.close()
    return results`,
  },
  {
    id: 'confidential_send',
    name: 'Confidential Data Sending',
    description: 'Securely sends encrypted data through confidential channels using TEE attestation.',
    code: `from cryptography.fernet import Fernet
import requests
import os

def confidential_send(
    data: dict, 
    recipient: str,
    attestation_required: bool = True
) -> dict:
    """
    Send data confidentially with TEE attestation.
    
    This tool ensures data is encrypted end-to-end and
    verified through Trusted Execution Environment.
    
    Args:
        data: Data to send securely
        recipient: Recipient address or identifier
        attestation_required: Require TEE attestation
        
    Returns:
        Transaction receipt with verification proof
    """
    key = Fernet.generate_key()
    cipher = Fernet(key)
    encrypted = cipher.encrypt(json.dumps(data).encode())
    
    # Generate TEE attestation
    attestation = generate_tee_attestation()
    
    response = requests.post(
        "https://confidential.shade.network/send",
        json={
            "encrypted_data": encrypted.decode(),
            "recipient": recipient,
            "attestation": attestation,
            "key_share": create_key_share(key)
        },
        headers={"X-TEE-Proof": get_tee_proof()}
    )
    return response.json()`,
    isHighlighted: true,
  },
  {
    id: 'file_read',
    name: 'File Reader',
    description: 'Reads and parses files from the local filesystem or IPFS.',
    code: `import os
from typing import Union

def file_read(
    path: str, 
    encoding: str = "utf-8"
) -> Union[str, bytes]:
    """
    Read file contents from path or IPFS.
    
    Args:
        path: File path or IPFS CID
        encoding: Text encoding (None for binary)
        
    Returns:
        File contents
    """
    if path.startswith("ipfs://"):
        return fetch_from_ipfs(path[7:])
    
    with open(path, "r" if encoding else "rb") as f:
        return f.read()`,
  },
  {
    id: 'blockchain_tx',
    name: 'Blockchain Transaction',
    description: 'Signs and sends transactions across multiple blockchains.',
    code: `from near_api import Account
from web3 import Web3

def blockchain_tx(
    chain: str,
    action: dict,
    gas_limit: int = None
) -> dict:
    """
    Execute cross-chain transactions.
    
    Args:
        chain: Target blockchain (near, ethereum, etc)
        action: Transaction action details
        gas_limit: Optional gas limit
        
    Returns:
        Transaction receipt
    """
    if chain == "near":
        account = Account.from_shade_key()
        return account.function_call(**action)
    elif chain == "ethereum":
        w3 = Web3(Web3.HTTPProvider(os.environ["ETH_RPC"]))
        return w3.eth.send_transaction(action)`,
  },
];

interface ToolCardProps {
  tool: Tool;
  onSelect: (tool: Tool) => void;
  isSelected: boolean;
}

const ToolCard: React.FC<ToolCardProps> = ({ tool, onSelect, isSelected }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <motion.div
      layout
      className="perspective-1000"
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}
    >
      <motion.div
        className={cn(
          "relative h-64 cursor-pointer transition-all duration-500",
          "transform-style-3d",
          isFlipped && "rotate-y-180"
        )}
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
        onClick={() => onSelect(tool)}
      >
        {/* Front */}
        <div
          className={cn(
            "absolute inset-0 backface-hidden glass-card p-6 flex flex-col",
            tool.isHighlighted 
              ? "border-2 border-accent shadow-[0_0_30px_hsl(var(--accent)/0.3)]" 
              : "card-hover",
            isSelected && "ring-2 ring-primary"
          )}
          style={{ backfaceVisibility: 'hidden' }}
        >
          {tool.isHighlighted && (
            <div className="absolute -top-3 -right-3 p-2 rounded-full bg-accent text-accent-foreground">
              <Star className="h-4 w-4" />
            </div>
          )}
          
          <div className={cn(
            "p-3 rounded-xl w-fit mb-4",
            tool.isHighlighted ? "bg-accent/20" : "bg-primary/10"
          )}>
            {tool.id === 'web_search' && <Search className={cn("h-6 w-6", tool.isHighlighted ? "text-accent" : "text-primary")} />}
            {tool.id === 'database_query' && <Database className={cn("h-6 w-6", tool.isHighlighted ? "text-accent" : "text-primary")} />}
            {tool.id === 'confidential_send' && <Lock className={cn("h-6 w-6", tool.isHighlighted ? "text-accent" : "text-primary")} />}
            {tool.id === 'file_read' && <FileText className={cn("h-6 w-6", tool.isHighlighted ? "text-accent" : "text-primary")} />}
            {tool.id === 'blockchain_tx' && <Globe className={cn("h-6 w-6", tool.isHighlighted ? "text-accent" : "text-primary")} />}
          </div>
          
          <h3 className={cn(
            "text-lg font-bold mb-2",
            tool.isHighlighted && "neon-text-emerald"
          )}>
            {tool.name}
          </h3>
          <p className="text-sm text-muted-foreground flex-1">
            {tool.description}
          </p>
          
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Hover to see code
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground animate-bounce" />
          </div>
        </div>

        {/* Back */}
        <div
          className={cn(
            "absolute inset-0 backface-hidden glass-card p-4 overflow-hidden",
            tool.isHighlighted 
              ? "border-2 border-accent" 
              : "border border-border"
          )}
          style={{ 
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-primary">{tool.name}.py</span>
            <Code2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <pre className="text-[10px] font-mono text-muted-foreground overflow-auto h-[calc(100%-2rem)] custom-scrollbar">
            <code>{tool.code}</code>
          </pre>
        </div>
      </motion.div>
    </motion.div>
  );
};

interface ToolsSectionProps {
  selectedTools: Tool[];
  onToolsChange: (tools: Tool[]) => void;
}

export const ToolsSection: React.FC<ToolsSectionProps> = ({
  selectedTools,
  onToolsChange,
}) => {
  const [tools, setTools] = useState<Tool[]>(defaultTools);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setTools([...defaultTools]);
    setIsRefreshing(false);
  };

  const handleSelectTool = (tool: Tool) => {
    const isSelected = selectedTools.some(t => t.id === tool.id);
    if (isSelected) {
      onToolsChange(selectedTools.filter(t => t.id !== tool.id));
    } else {
      onToolsChange([...selectedTools, tool]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">Agent Tools</h3>
          <p className="text-sm text-muted-foreground">
            Select the tools your agent can use
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
          Refresh Tools
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            onSelect={handleSelectTool}
            isSelected={selectedTools.some(t => t.id === tool.id)}
          />
        ))}
      </div>

      {selectedTools.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 glass-card"
        >
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-primary">{selectedTools.length}</span> tools selected: {selectedTools.map(t => t.name).join(', ')}
          </p>
        </motion.div>
      )}
    </div>
  );
};

export { defaultTools };
export type { Tool };
