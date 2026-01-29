import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Bot, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface LLM {
  id: string;
  name: string;
  provider: string;
  icon: React.ReactNode;
  description: string;
  requiresKey: boolean;
}

const llmOptions: LLM[] = [
  {
    id: 'gemini',
    name: 'Gemini Pro',
    provider: 'Google',
    icon: <Sparkles className="h-6 w-6" />,
    description: 'Google\'s most capable AI model',
    requiresKey: true,
  },
  {
    id: 'openai',
    name: 'GPT-4',
    provider: 'OpenAI',
    icon: <Brain className="h-6 w-6" />,
    description: 'Advanced reasoning and coding',
    requiresKey: true,
  },
  {
    id: 'nearai',
    name: 'NEAR AI',
    provider: 'NEAR Protocol',
    icon: <Bot className="h-6 w-6" />,
    description: 'Decentralized AI on NEAR',
    requiresKey: true,
  },
];

interface LLMSelectorProps {
  selectedLLM: string | null;
  onLLMChange: (llmId: string, apiKey?: string) => void;
  apiKeys: Record<string, string>;
  onApiKeyChange: (llmId: string, key: string) => void;
}

export const LLMSelector: React.FC<LLMSelectorProps> = ({
  selectedLLM,
  onLLMChange,
  apiKeys,
  onApiKeyChange,
}) => {
  const [uploadingModel, setUploadingModel] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-2">Choose Your LLM</h3>
        <p className="text-sm text-muted-foreground">
          Select the language model that will power your agent's intelligence
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {llmOptions.map((llm) => (
          <motion.div
            key={llm.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onLLMChange(llm.id)}
            className={cn(
              "glass-card p-6 cursor-pointer transition-all duration-300",
              selectedLLM === llm.id
                ? "neon-border bg-primary/5"
                : "card-hover"
            )}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={cn(
                "p-3 rounded-xl",
                selectedLLM === llm.id ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
              )}>
                {llm.icon}
              </div>
              {selectedLLM === llm.id && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="h-3 w-3 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]"
                />
              )}
            </div>
            
            <h4 className="font-bold mb-1">{llm.name}</h4>
            <p className="text-xs text-muted-foreground mb-2">{llm.provider}</p>
            <p className="text-sm text-muted-foreground">{llm.description}</p>
          </motion.div>
        ))}
      </div>

      {/* API Key Input */}
      {selectedLLM && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6"
        >
          <h4 className="font-medium mb-4">
            Enter {llmOptions.find(l => l.id === selectedLLM)?.name} API Key
          </h4>
          <Input
            type="password"
            placeholder="Enter your API key..."
            value={apiKeys[selectedLLM] || ''}
            onChange={(e) => onApiKeyChange(selectedLLM, e.target.value)}
            className="bg-background"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Your API key is stored securely and never shared.
          </p>
        </motion.div>
      )}

      {/* Upload Custom Model */}
      <div className="glass-card p-6">
        <h4 className="font-medium mb-4">Or Upload Custom Model</h4>
        <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
          <input
            type="file"
            className="hidden"
            id="model-upload"
            accept=".gguf,.bin,.safetensors"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                setUploadingModel(true);
                // Simulate upload
                setTimeout(() => setUploadingModel(false), 2000);
              }
            }}
          />
          <label htmlFor="model-upload" className="cursor-pointer">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {uploadingModel ? 'Uploading...' : 'Drop your model file or click to browse'}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Supports .gguf, .bin, .safetensors
            </p>
          </label>
        </div>
      </div>
    </div>
  );
};
