import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Edit3, Sparkles, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const defaultPrompt = `You are a Shade Agent, a decentralized AI assistant operating in a Trusted Execution Environment (TEE) on the NEAR Protocol blockchain.

Your core capabilities:
1. You can autonomously sign and execute transactions across multiple blockchains
2. You have access to various tools for web search, database queries, and file operations
3. You operate with persistent account control through NEAR's decentralized key management
4. All your computations are verifiable and privacy-preserving

Guidelines:
- Always prioritize user safety and asset security
- Verify transaction details before execution
- Use tools efficiently and explain your reasoning
- Maintain transparency about your actions and limitations
- Never expose private keys or sensitive data

When executing blockchain transactions:
- Double-check addresses and amounts
- Estimate gas fees before confirmation
- Provide clear transaction summaries

You are helpful, accurate, and security-conscious.`;

interface PromptEditorProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
}

export const PromptEditor: React.FC<PromptEditorProps> = ({
  prompt,
  onPromptChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    onPromptChange(defaultPrompt);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">Agent Prompt</h3>
          <p className="text-sm text-muted-foreground">
            Define your agent's personality and behavior
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            variant={isEditing ? "default" : "outline"}
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Edit3 className="h-4 w-4 mr-2" />
            {isEditing ? 'Done' : 'Edit'}
          </Button>
        </div>
      </div>

      <motion.div
        layout
        className={cn(
          "glass-card overflow-hidden transition-all duration-300",
          isEditing && "neon-border"
        )}
      >
        {isEditing ? (
          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            className="w-full h-80 p-6 bg-transparent font-mono text-sm resize-none focus:outline-none custom-scrollbar"
            placeholder="Enter your agent's system prompt..."
          />
        ) : (
          <pre className="p-6 font-mono text-sm text-muted-foreground whitespace-pre-wrap overflow-auto max-h-80 custom-scrollbar">
            {prompt}
          </pre>
        )}
      </motion.div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="px-2 py-1 bg-secondary rounded">
          {prompt.length} characters
        </span>
        <span className="px-2 py-1 bg-secondary rounded">
          ~{Math.ceil(prompt.length / 4)} tokens
        </span>
      </div>
    </div>
  );
};

export { defaultPrompt };
