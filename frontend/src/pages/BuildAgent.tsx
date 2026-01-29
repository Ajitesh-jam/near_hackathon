import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Rocket, 
  Zap, 
  Wrench, 
  Bot, 
  FileCode, 
  MessageSquare,
  ChevronRight,
  Plus,
  Trash2,
  Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Navbar } from '@/components/Navbar';
import { ToolsSection, Tool, defaultTools } from '@/components/ToolsSection';
import { LLMSelector } from '@/components/LLMSelector';
import { PromptEditor, defaultPrompt } from '@/components/PromptEditor';
import { CodeEditor, FileNode } from '@/components/CodeEditor';
import { generateAgentFiles } from '@/lib/agentTemplates';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const steps = [
  { id: 'instructions', label: 'Instructions', icon: FileCode },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'llm', label: 'LLM', icon: Bot },
  { id: 'prompt', label: 'Prompt', icon: MessageSquare },
  { id: 'account', label: 'Account', icon: Wallet },
  { id: 'code', label: 'Code', icon: FileCode },
  { id: 'deploy', label: 'Deploy', icon: Rocket },
];

const BuildAgent = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTools, setSelectedTools] = useState<Tool[]>([]);
  const [selectedLLM, setSelectedLLM] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [nearAccount, setNearAccount] = useState('');
  const [customTools, setCustomTools] = useState<{ name: string; code: string; requirements: string }[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);

  // Generate files based on current configuration
  const generatedFiles = useMemo(() => {
    return generateAgentFiles(
      selectedTools,
      prompt,
      selectedLLM || 'openai',
      nearAccount,
      customTools
    );
  }, [selectedTools, prompt, selectedLLM, nearAccount, customTools]);

  const handleDeploy = async () => {
    setIsDeploying(true);
    // Simulate deployment
    await new Promise(resolve => setTimeout(resolve, 3000));
    setIsDeploying(false);
    toast.success('Agent deployed successfully!', {
      description: 'Your Shade Agent is now running on Phala Network.',
    });
  };

  const addCustomTool = () => {
    setCustomTools([...customTools, { name: '', code: '', requirements: '' }]);
  };

  const updateCustomTool = (index: number, field: string, value: string) => {
    const updated = [...customTools];
    updated[index] = { ...updated[index], [field]: value };
    setCustomTools(updated);
  };

  const removeCustomTool = (index: number) => {
    setCustomTools(customTools.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen gradient-bg">
      <Navbar />
      
      <div className="pt-24 pb-12">
        <div className="container mx-auto px-4">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Build Your <span className="neon-text">Shade Agent</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Configure and deploy a decentralized AI agent with persistent account control
            </p>
          </motion.div>

          {/* Progress Steps */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap justify-center gap-2 mb-12"
          >
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(index)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300",
                    currentStep === index
                      ? "bg-primary/20 text-primary neon-border"
                      : currentStep > index
                      ? "bg-accent/20 text-accent"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
                  {index < steps.length - 1 && (
                    <ChevronRight className="h-4 w-4 ml-1 hidden md:block" />
                  )}
                </button>
              );
            })}
          </motion.div>

          {/* Content Sections */}
          <div className="max-w-6xl mx-auto">
            {/* Step 0: Instructions */}
            {currentStep === 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-card p-8"
              >
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <Zap className="h-6 w-6 text-primary" />
                  How to Build Your Agent
                </h2>
                
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-bold">1</span>
                      </div>
                      <div>
                        <h3 className="font-bold mb-1">Select Your Tools</h3>
                        <p className="text-sm text-muted-foreground">
                          Choose the capabilities your agent will have - web search, database access, blockchain transactions, and more.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-bold">2</span>
                      </div>
                      <div>
                        <h3 className="font-bold mb-1">Choose Your LLM</h3>
                        <p className="text-sm text-muted-foreground">
                          Pick the language model that powers your agent's intelligence - GPT-4, Gemini, or NEAR AI.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-bold">3</span>
                      </div>
                      <div>
                        <h3 className="font-bold mb-1">Define the Prompt</h3>
                        <p className="text-sm text-muted-foreground">
                          Customize your agent's personality, behavior, and instructions.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-bold">4</span>
                      </div>
                      <div>
                        <h3 className="font-bold mb-1">Connect NEAR Account</h3>
                        <p className="text-sm text-muted-foreground">
                          Link your NEAR account for persistent key management across TEE instances.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-bold">5</span>
                      </div>
                      <div>
                        <h3 className="font-bold mb-1">Review & Edit Code</h3>
                        <p className="text-sm text-muted-foreground">
                          See the generated code, make any final adjustments before deployment.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-4">
                      <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-accent font-bold">6</span>
                      </div>
                      <div>
                        <h3 className="font-bold mb-1 neon-text-emerald">Deploy on Phala</h3>
                        <p className="text-sm text-muted-foreground">
                          Launch your agent on Phala Network's TEE infrastructure for trustless execution.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <Button variant="glow" onClick={() => setCurrentStep(1)}>
                    Get Started
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 1: Tools */}
            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <ToolsSection
                  selectedTools={selectedTools}
                  onToolsChange={setSelectedTools}
                />

                {/* Custom Tool Creator */}
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold">Custom Tools</h3>
                      <p className="text-sm text-muted-foreground">
                        Add your own tools with custom Python code
                      </p>
                    </div>
                    <Button variant="outline" onClick={addCustomTool}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Custom Tool
                    </Button>
                  </div>

                  {customTools.map((tool, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-6 p-4 bg-secondary/30 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <Input
                          placeholder="Tool Name"
                          value={tool.name}
                          onChange={(e) => updateCustomTool(index, 'name', e.target.value)}
                          className="w-64"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCustomTool(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Tool Code</label>
                          <CodeEditor
                            initialFiles={[{
                              id: `custom-tool-${index}`,
                              name: `${tool.name || 'custom'}.py`,
                              type: 'file',
                              content: tool.code,
                            }]}
                            onFilesChange={(files) => {
                              if (files[0]?.content) {
                                updateCustomTool(index, 'code', files[0].content);
                              }
                            }}
                            height="300px"
                          />
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium mb-2 block">requirements.txt additions</label>
                          <Input
                            placeholder="e.g., numpy==1.24.0, pandas>=2.0"
                            value={tool.requirements}
                            onChange={(e) => updateCustomTool(index, 'requirements', e.target.value)}
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(0)}>
                    Back
                  </Button>
                  <Button variant="glow" onClick={() => setCurrentStep(2)}>
                    Continue
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 2: LLM */}
            {currentStep === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <LLMSelector
                  selectedLLM={selectedLLM}
                  onLLMChange={setSelectedLLM}
                  apiKeys={apiKeys}
                  onApiKeyChange={(llmId, key) => setApiKeys({ ...apiKeys, [llmId]: key })}
                />

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(1)}>
                    Back
                  </Button>
                  <Button variant="glow" onClick={() => setCurrentStep(3)}>
                    Continue
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Prompt */}
            {currentStep === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <PromptEditor
                  prompt={prompt}
                  onPromptChange={setPrompt}
                />

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(2)}>
                    Back
                  </Button>
                  <Button variant="glow" onClick={() => setCurrentStep(4)}>
                    Continue
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 4: NEAR Account */}
            {currentStep === 4 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <div className="glass-card p-8">
                  <h3 className="text-xl font-bold mb-2">NEAR Account</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Enter your NEAR account name for persistent key management
                  </p>

                  <div className="max-w-md">
                    <div className="flex gap-2">
                      <Input
                        placeholder="your-account"
                        value={nearAccount.replace('.near', '')}
                        onChange={(e) => setNearAccount(e.target.value.replace('.near', ''))}
                        className="bg-background"
                      />
                      <span className="flex items-center px-4 bg-secondary rounded-lg text-muted-foreground">
                        .near
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      This account will be used for cross-chain key management
                    </p>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(3)}>
                    Back
                  </Button>
                  <Button variant="glow" onClick={() => setCurrentStep(5)}>
                    Continue
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 5: Code Review */}
            {currentStep === 5 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="text-xl font-bold mb-2">Review Generated Code</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Review and edit the generated agent code before deployment
                  </p>
                </div>

                <CodeEditor
                  initialFiles={generatedFiles}
                  height="600px"
                />

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(4)}>
                    Back
                  </Button>
                  <Button variant="glow" onClick={() => setCurrentStep(6)}>
                    Continue to Deploy
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 6: Deploy */}
            {currentStep === 6 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <div className="glass-card p-8 text-center neon-border">
                  <Rocket className="h-16 w-16 mx-auto text-primary mb-6" />
                  <h2 className="text-3xl font-bold mb-4">
                    Ready to Deploy!
                  </h2>
                  <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                    Your Shade Agent is configured and ready to be deployed on Phala Network's 
                    Trusted Execution Environment.
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 max-w-2xl mx-auto">
                    <div className="glass-card p-4">
                      <div className="text-2xl font-bold text-primary">
                        {selectedTools.length + customTools.length}
                      </div>
                      <div className="text-xs text-muted-foreground">Tools</div>
                    </div>
                    <div className="glass-card p-4">
                      <div className="text-2xl font-bold text-primary">
                        {selectedLLM?.toUpperCase() || 'N/A'}
                      </div>
                      <div className="text-xs text-muted-foreground">LLM</div>
                    </div>
                    <div className="glass-card p-4">
                      <div className="text-2xl font-bold text-primary truncate">
                        {nearAccount || 'N/A'}
                      </div>
                      <div className="text-xs text-muted-foreground">Account</div>
                    </div>
                    <div className="glass-card p-4">
                      <div className="text-2xl font-bold text-accent">TEE</div>
                      <div className="text-xs text-muted-foreground">Phala</div>
                    </div>
                  </div>

                  <Button
                    variant="glow"
                    size="xl"
                    onClick={handleDeploy}
                    disabled={isDeploying}
                    className="min-w-64"
                  >
                    {isDeploying ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          <Rocket className="h-5 w-5 mr-2" />
                        </motion.div>
                        Deploying...
                      </>
                    ) : (
                      <>
                        <Rocket className="h-5 w-5 mr-2" />
                        Deploy Agent
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex justify-start">
                  <Button variant="outline" onClick={() => setCurrentStep(5)}>
                    Back
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuildAgent;
