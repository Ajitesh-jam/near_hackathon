import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Code2, 
  Loader2,
  Settings,
  Key,
  Wallet,
  Rocket,
  FileCode,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Navbar } from '@/components/Navbar';
import { CodeEditor, FileNode } from '@/components/CodeEditor';
import { generateAgentFiles } from '@/lib/agentTemplates';
import { defaultTools } from '@/components/ToolsSection';
import { defaultPrompt } from '@/components/PromptEditor';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isEditing?: boolean;
  codeChanges?: { file: string; change: string }[];
}

const initialMessages: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: `Hello! I'm your AI Agent Builder assistant. I can help you create a custom Shade Agent from scratch.

Just tell me what kind of agent you want to build, and I'll:
- Select appropriate tools
- Configure the LLM
- Write custom prompts
- Generate all the code

What would you like your agent to do?`,
  },
];

const AiChat = () => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeys, setApiKeys] = useState({ llm: '', phala: '' });
  const [nearAccount, setNearAccount] = useState('');
  const [generatedFiles, setGeneratedFiles] = useState<FileNode[]>([]);
  const [showCode, setShowCode] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const simulateCodeEditing = async (setMessages: React.Dispatch<React.SetStateAction<Message[]>>, messageId: string) => {
    const codeChanges = [
      { file: 'main.py', change: 'Updating agent initialization...' },
      { file: 'config.py', change: 'Configuring LLM settings...' },
      { file: 'tools/__init__.py', change: 'Adding selected tools...' },
      { file: 'prompts/system_prompt.py', change: 'Customizing agent prompt...' },
    ];

    for (const change of codeChanges) {
      await new Promise(resolve => setTimeout(resolve, 800));
      setMessages(prev => prev.map(m => 
        m.id === messageId 
          ? { 
              ...m, 
              isEditing: true,
              codeChanges: [...(m.codeChanges || []), change],
              content: m.content + `\n\n📝 Editing \`${change.file}\`: ${change.change}`
            }
          : m
      ));
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    await new Promise(resolve => setTimeout(resolve, 1500));

    const assistantMessageId = (Date.now() + 1).toString();
    
    // Check if this is a request to build an agent
    const isBuildRequest = input.toLowerCase().includes('build') || 
                          input.toLowerCase().includes('create') || 
                          input.toLowerCase().includes('make') ||
                          input.toLowerCase().includes('agent');

    if (isBuildRequest && !showCode) {
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: `Great! I'll help you build a Shade Agent. Let me analyze your requirements and generate the code...

 Analyzing requirements...
 Selected tools: Web Search, Database Query, Blockchain Transaction
 Recommended LLM: GPT-4 for complex reasoning
 Generating custom prompt based on your needs...

I'm now editing the code files:`,
        isEditing: true,
        codeChanges: [],
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);

      // Simulate code editing
      await simulateCodeEditing(setMessages, assistantMessageId);

      // Generate actual files
      const files = generateAgentFiles(
        defaultTools.slice(0, 3),
        defaultPrompt,
        'openai',
        nearAccount || 'agent.near',
        []
      );
      setGeneratedFiles(files);
      setShowCode(true);

      // Final message
      setMessages(prev => prev.map(m =>
        m.id === assistantMessageId
          ? {
              ...m,
              isEditing: false,
              content: m.content + `\n\n**Code generation complete!**\n\nI've created a full Shade Agent with:\n- 3 powerful tools (Web Search, Database, Blockchain)\n- GPT-4 integration\n- Custom system prompt\n- Full deployment configuration\n\nYou can review and edit the code below. Would you like me to modify anything?`
            }
          : m
      ));

    } else if (showCode) {
      // Handle code editing requests
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: `I understand you want to make changes. Let me update the code...`,
        isEditing: true,
        codeChanges: [],
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);

      await simulateCodeEditing(setMessages, assistantMessageId);

      setMessages(prev => prev.map(m =>
        m.id === assistantMessageId
          ? {
              ...m,
              isEditing: false,
              content: m.content + `\n\nChanges applied! The code has been updated according to your requirements. Check the editor below to review the changes.`
            }
          : m
      ));

    } else {
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: `I can help you with that! To build your Shade Agent, I need to understand a few things:

1. **What should your agent do?** (e.g., trading bot, data analyzer, cross-chain bridge)
2. **Which blockchains** should it interact with?
3. **Any specific tools** you need? (web search, databases, APIs)

Just describe your use case, and I'll generate the perfect agent configuration for you!`,
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }
  };

  const handleDeploy = async () => {
    if (!apiKeys.llm || !apiKeys.phala || !nearAccount) {
      toast.error('Please fill in all required settings first');
      setShowSettings(true);
      return;
    }

    setIsDeploying(true);
    await new Promise(resolve => setTimeout(resolve, 3000));
    setIsDeploying(false);
    toast.success('Agent deployed successfully!', {
      description: 'Your Shade Agent is now running on Phala Network.',
    });
  };

  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      <Navbar />
      
      <div className="flex-1 pt-20 flex flex-col lg:flex-row">
        {/* Chat Section */}
        <div className={cn(
          "flex flex-col transition-all duration-300",
          showCode ? "lg:w-1/2" : "w-full max-w-4xl mx-auto"
        )}>
          {/* Chat Header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/20">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="font-bold">AI Agent Builder</h1>
                <p className="text-xs text-muted-foreground">
                  Describe your agent, I'll code it for you
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>

          {/* Settings Panel */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-b border-border overflow-hidden"
              >
                <div className="p-4 space-y-4 bg-card/50">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium flex items-center gap-2 mb-2">
                        <Key className="h-4 w-4" />
                        LLM API Key
                      </label>
                      <Input
                        type="password"
                        placeholder="Enter API key..."
                        value={apiKeys.llm}
                        onChange={(e) => setApiKeys({ ...apiKeys, llm: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium flex items-center gap-2 mb-2">
                        <Key className="h-4 w-4" />
                        Phala API Key
                      </label>
                      <Input
                        type="password"
                        placeholder="Enter Phala key..."
                        value={apiKeys.phala}
                        onChange={(e) => setApiKeys({ ...apiKeys, phala: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium flex items-center gap-2 mb-2">
                        <Wallet className="h-4 w-4" />
                        NEAR Account
                      </label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="your-account"
                          value={nearAccount}
                          onChange={(e) => setNearAccount(e.target.value)}
                        />
                        <span className="flex items-center px-3 bg-secondary rounded-lg text-sm text-muted-foreground">
                          .near
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
          <div className="flex-1 overflow-auto p-4 space-y-4 custom-scrollbar">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex gap-3",
                  message.role === 'user' && "flex-row-reverse"
                )}
              >
                <div className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0",
                  message.role === 'user' 
                    ? "bg-accent/20" 
                    : "bg-primary/20"
                )}>
                  {message.role === 'user' ? (
                    <User className="h-5 w-5 text-accent" />
                  ) : (
                    <Bot className="h-5 w-5 text-primary" />
                  )}
                </div>
                
                <div className={cn(
                  "flex-1 max-w-[80%]",
                  message.role === 'user' && "text-right"
                )}>
                  <div className={cn(
                    "inline-block p-4 rounded-2xl",
                    message.role === 'user'
                      ? "bg-accent/20 text-left"
                      : "glass-card"
                  )}>
                    <div className="whitespace-pre-wrap text-sm">
                      {message.content}
                    </div>
                    
                    {message.isEditing && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-3 flex items-center gap-2 text-xs text-primary"
                      >
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          <Code2 className="h-4 w-4" />
                        </motion.div>
                        <span>Editing code...</span>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            
            {isTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="glass-card p-4 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              </motion.div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe your agent or ask for changes..."
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                className="flex-1"
              />
              <Button onClick={handleSend} disabled={isTyping || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Code Editor Section */}
        <AnimatePresence>
          {showCode && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '50%', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="hidden lg:flex flex-col border-l border-border"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-primary" />
                  <span className="font-bold">Generated Code</span>
                </div>
                <Button
                  variant="glow"
                  size="sm"
                  onClick={handleDeploy}
                  disabled={isDeploying}
                >
                  {isDeploying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4 mr-2" />
                      Deploy Agent
                    </>
                  )}
                </Button>
              </div>
              
              <div className="flex-1">
                <CodeEditor
                  initialFiles={generatedFiles}
                  height="100%"
                  className="h-full rounded-none border-0"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Code Toggle */}
        {showCode && (
          <div className="lg:hidden fixed bottom-20 left-1/2 -translate-x-1/2">
            <Button
              variant="glow"
              onClick={() => {
                // Toggle code view on mobile
                toast.info('Use the Build Agent page for full code editing on mobile');
              }}
            >
              <Code2 className="h-4 w-4 mr-2" />
              View Code
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiChat;
