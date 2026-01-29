import React, { useState, useMemo, useEffect } from 'react';
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
  Wallet,
  Sparkles,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Navbar } from '@/components/Navbar';
import { ToolsSection, Tool } from '@/components/ToolsSection';
import { PromptEditor, defaultPrompt } from '@/components/PromptEditor';
import { CodeEditor, FileNode } from '@/components/CodeEditor';
import { generateAgentFiles } from '@/lib/agentTemplates';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { api } from '@/lib/api/client';
import { useForgeSession } from '@/hooks/useForgeSession';
import { templateCodeToFileNodes, getStepIndexForStage, fileNodesToTemplateCode } from '@/lib/workflowUtils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

const steps = [
  { id: 'instructions', label: 'Instructions', icon: FileCode },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'prompt', label: 'Prompt', icon: MessageSquare },
  { id: 'account', label: 'Account', icon: Wallet },
  { id: 'code', label: 'Code', icon: FileCode },
  { id: 'deploy', label: 'Deploy', icon: Rocket },
];

const BuildAgent = () => {
  const [workflowMode, setWorkflowMode] = useState<'direct' | 'hitl'>('direct');
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTools, setSelectedTools] = useState<Tool[]>([]);
  const [selectedLLM, setSelectedLLM] = useState<string>('openai'); // Default to OpenAI
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [nearAccount, setNearAccount] = useState('');
  const [customTools, setCustomTools] = useState<{ name: string; code: string; requirements: string }[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isGeneratingTool, setIsGeneratingTool] = useState(false);
  const [toolRequirements, setToolRequirements] = useState('');
  const [isGeneratingLogic, setIsGeneratingLogic] = useState(false);
  const [aiGeneratedLogic, setAiGeneratedLogic] = useState<string | null>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<number, string>>({});
  const [codeEditorFiles, setCodeEditorFiles] = useState<FileNode[]>([]);
  
  // HITL workflow session
  const {
    sessionId,
    sessionStatus,
    isPolling,
    isLoading: isSessionLoading,
    startSession,
    submitTools: submitToolsToWorkflow,
    submitCustomTools: submitCustomToolsToWorkflow,
    submitPrompt: submitPromptToWorkflow,
    submitClarification: submitClarificationToWorkflow,
    submitToolReview: submitToolReviewToWorkflow,
    updateCode: updateCodeInWorkflow,
    finalizeAgent: finalizeAgentInWorkflow,
    resetSession,
  } = useForgeSession('default_user');

  // Generate files based on current configuration
  const generatedFiles = useMemo(() => {
    // In HITL mode, use template_code from session if available
    if (workflowMode === 'hitl' && sessionStatus?.template_code) {
      return templateCodeToFileNodes(sessionStatus.template_code);
    }
    
    const files = generateAgentFiles(
      selectedTools,
      prompt,
      selectedLLM,
      nearAccount,
      customTools
    );
    
    // Replace logic.py with AI-generated logic if available
    if (aiGeneratedLogic) {
      const logicFileIndex = files.findIndex(f => f.name === 'logic.py');
      if (logicFileIndex !== -1) {
        files[logicFileIndex] = {
          ...files[logicFileIndex],
          content: aiGeneratedLogic,
        };
      }
    }
    
    return files;
  }, [workflowMode, sessionStatus?.template_code, selectedTools, prompt, selectedLLM, nearAccount, customTools, aiGeneratedLogic]);

  // Helper function to get file path from FileNode
  const getFilePathFromNode = (node: FileNode, allFiles: FileNode[], currentPath: string = ''): string | null => {
    const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;
    
    if (node.type === 'file') {
      return nodePath;
    }
    
    if (node.children) {
      for (const child of node.children) {
        const result = getFilePathFromNode(child, allFiles, nodePath);
        if (result) return result;
      }
    }
    
    return null;
  };

  const handleGenerateLogic = async () => {
    if (selectedTools.length === 0) {
      toast.error('Please select at least one tool first');
      return;
    }

    setIsGeneratingLogic(true);
    try {
      const toolsForApi = [
        ...selectedTools.map(tool => ({
          name: tool.name,
          type: 'reactive', // Default type
          description: tool.description,
        })),
        ...customTools.map(tool => ({
          name: tool.name,
          type: 'reactive',
          description: '',
        })),
      ];

      const result = await api.generateLogic(
        toolsForApi,
        prompt,
        {
          user_id: 'default_user',
          llm_provider: selectedLLM,
          near_account: nearAccount,
        }
      );

      setAiGeneratedLogic(result.logic_code);
      toast.success('Logic code generated successfully!', {
        description: 'Review the updated logic.py file',
      });
    } catch (error) {
      console.error('Failed to generate logic:', error);
      toast.error('Failed to generate logic', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsGeneratingLogic(false);
    }
  };

  const handleDeploy = async () => {
    if (!nearAccount) {
      toast.error('Please enter a NEAR account');
      return;
    }

    setIsDeploying(true);
    try {
      const toolsForApi = [
        ...selectedTools.map(tool => ({
          name: tool.name,
          type: 'reactive', // Default type - could be enhanced to detect from tool
          description: tool.description,
          config_schema: {},
        })),
        ...customTools.map(tool => ({
          name: tool.name,
          type: 'reactive',
          description: '',
          config_schema: {},
        })),
      ];

      const result = await api.createAgent(
        'default_user', // TODO: get from auth context
        undefined, // auto-generate agent_id
        toolsForApi,
        {
          llm_provider: selectedLLM,
          system_prompt: prompt,
          near_account: nearAccount,
        }
      );

      toast.success('Agent created successfully!', {
        description: `Code generated at: ${result.path}`,
      });
      
      // Refresh agents list
      await fetchAgents();
    } catch (error) {
      console.error('Failed to create agent:', error);
      toast.error('Failed to create agent', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const fetchAgents = async () => {
    setIsLoadingAgents(true);
    try {
      const result = await api.listAgents('default_user');
      setAgents(result.agents || []);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      // Silently fail - agents list is optional
    } finally {
      setIsLoadingAgents(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  // Sync local state with HITL session status
  useEffect(() => {
    if (workflowMode === 'hitl' && sessionStatus) {
      // Sync selected tools
      if (sessionStatus.selected_tools) {
        const tools = sessionStatus.selected_tools.map((tool: any) => ({
          id: tool.name?.toLowerCase().replace(/\s+/g, '_') || '',
          name: tool.name || '',
          description: tool.description || '',
          code: tool.code || '',
        }));
        setSelectedTools(tools);
      }
      
      // Sync prompt
      if (sessionStatus.waiting_stage === 'prompt' && sessionStatus.current_step) {
        // Prompt will be set when user submits
      }
      
      // Sync code editor files when template_code changes
      if (sessionStatus.template_code && Object.keys(sessionStatus.template_code).length > 0) {
        const files = templateCodeToFileNodes(sessionStatus.template_code);
        setCodeEditorFiles(files);
      }
      
      // Auto-navigate to appropriate step based on waiting_stage
      if (sessionStatus.waiting_for_input) {
        const stepIndex = getStepIndexForStage(sessionStatus.waiting_stage);
        setCurrentStep(stepIndex);
      }
    }
  }, [workflowMode, sessionStatus]);

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm(`Are you sure you want to delete agent "${agentId}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.removeAgent(agentId, 'default_user');
      toast.success('Agent deleted successfully');
      await fetchAgents(); // Refresh list
    } catch (error) {
      console.error('Failed to delete agent:', error);
      toast.error('Failed to delete agent', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
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

  const handleGenerateTool = async () => {
    if (!toolRequirements.trim()) {
      toast.error('Please describe what tool you want to generate');
      return;
    }

    setIsGeneratingTool(true);
    try {
      const existingTools = [
        ...selectedTools.map(t => ({ name: t.name, type: 'reactive' })),
        ...customTools.map(t => ({ name: t.name, type: 'reactive' })),
      ];

      const result = await api.generateTool(toolRequirements, existingTools);
      
      if (result.tools && result.tools.length > 0) {
        const generatedTool = result.tools[0];
        setCustomTools([
          ...customTools,
          {
            name: generatedTool.name || 'Generated Tool',
            code: generatedTool.code || `# ${generatedTool.name} tool\n\ndef execute():\n    pass\n`,
            requirements: '',
          },
        ]);
        setToolRequirements('');
        toast.success('Tool generated successfully!', {
          description: `Generated: ${generatedTool.name}`,
        });
      } else {
        toast.error('No tools were generated', {
          description: 'Please try a different description',
        });
      }
    } catch (error) {
      console.error('Failed to generate tool:', error);
      toast.error('Failed to generate tool', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsGeneratingTool(false);
    }
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
            
            {/* Workflow Mode Toggle */}
            <div className="mt-6 flex justify-center">
              <div className="glass-card p-4 inline-flex items-center gap-4">
                <Label className="text-sm font-medium">Workflow Mode:</Label>
                <RadioGroup
                  value={workflowMode}
                  onValueChange={(value) => {
                    setWorkflowMode(value as 'direct' | 'hitl');
                    if (value === 'direct' && sessionId) {
                      resetSession();
                    }
                  }}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="direct" id="direct" />
                    <Label htmlFor="direct" className="cursor-pointer">Direct Mode</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="hitl" id="hitl" />
                    <Label htmlFor="hitl" className="cursor-pointer">HITL Workflow</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
            
            {/* HITL Session Status Indicator */}
            {workflowMode === 'hitl' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex justify-center"
              >
                <div className="glass-card p-3 inline-flex items-center gap-3">
                  {sessionId ? (
                    <>
                      <div className={cn(
                        "h-2 w-2 rounded-full",
                        isPolling ? "bg-green-500 animate-pulse" : "bg-gray-500"
                      )} />
                      <span className="text-sm">
                        {sessionStatus?.waiting_for_input 
                          ? `Waiting for input: ${sessionStatus.waiting_stage}`
                          : sessionStatus?.agent_id
                          ? `Agent created: ${sessionStatus.agent_id}`
                          : 'Session active'}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">No active session</span>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* My Agents Section */}
          {agents.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <div className="glass-card p-6">
                <h2 className="text-xl font-bold mb-4">My Agents</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {agents.map((agent) => (
                    <div
                      key={agent.agent_id}
                      className="p-4 bg-secondary/30 rounded-lg border border-border hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-primary">{agent.agent_id}</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {agent.tools?.length || 0} tools
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleDeleteAgent(agent.agent_id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 truncate">
                        {agent.path}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Created: {new Date(agent.created_at || Date.now()).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

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
                        <span className="text-primary font-bold">3</span>
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
                        <span className="text-primary font-bold">4</span>
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
                        <span className="text-accent font-bold">5</span>
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

                <div className="mt-8 flex justify-end gap-4">
                  {workflowMode === 'hitl' && !sessionId && (
                    <Button
                      variant="glow"
                      onClick={async () => {
                        try {
                          await startSession();
                          setCurrentStep(1);
                        } catch (error) {
                          // Error handled in hook
                        }
                      }}
                      disabled={isSessionLoading}
                    >
                      {isSessionLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Starting...
                        </>
                      ) : (
                        <>
                          Start HITL Workflow
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  )}
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
                {/* Tool Review Stage */}
                {workflowMode === 'hitl' && sessionStatus?.waiting_stage === 'tool_review' && sessionStatus.tool_changes && (
                  <div className="glass-card p-6 mb-6 border-2 border-primary/50">
                    <h3 className="text-lg font-bold mb-4">Tool Review Suggestions</h3>
                    <p className="text-sm text-muted-foreground mb-4">{sessionStatus.tool_changes.reason}</p>
                    {(sessionStatus.tool_changes.add?.length > 0 || sessionStatus.tool_changes.remove?.length > 0) && (
                      <div className="space-y-3">
                        {sessionStatus.tool_changes.add?.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-green-400 mb-2">Suggested additions:</p>
                            <ul className="list-disc list-inside text-sm text-muted-foreground">
                              {sessionStatus.tool_changes.add.map((tool: string) => (
                                <li key={tool}>{tool}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {sessionStatus.tool_changes.remove?.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-red-400 mb-2">Suggested removals:</p>
                            <ul className="list-disc list-inside text-sm text-muted-foreground">
                              {sessionStatus.tool_changes.remove.map((tool: string) => (
                                <li key={tool}>{tool}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="flex gap-2 mt-4">
                          <Button
                            variant="outline"
                            onClick={async () => {
                              try {
                                await submitToolReviewToWorkflow({
                                  add: sessionStatus.tool_changes?.add || [],
                                  remove: sessionStatus.tool_changes?.remove || [],
                                  confirmed: true,
                                });
                              } catch (error) {
                                // Error handled in hook
                              }
                            }}
                            disabled={isSessionLoading}
                          >
                            Accept Changes
                          </Button>
                          <Button
                            variant="outline"
                            onClick={async () => {
                              try {
                                await submitToolReviewToWorkflow({
                                  add: [],
                                  remove: [],
                                  confirmed: false,
                                });
                              } catch (error) {
                                // Error handled in hook
                              }
                            }}
                            disabled={isSessionLoading}
                          >
                            Reject Changes
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Custom Tools Stage */}
                {workflowMode === 'hitl' && sessionStatus?.waiting_stage === 'custom_tools' && (
                  <div className="glass-card p-6 mb-6 border-2 border-primary/50">
                    <h3 className="text-lg font-bold mb-4">Add Custom Tools (Optional)</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Describe custom tools you'd like to generate, or skip to continue.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Describe custom tool requirements..."
                        value={toolRequirements}
                        onChange={(e) => setToolRequirements(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        variant="glow"
                        onClick={async () => {
                          if (!toolRequirements.trim()) {
                            toast.error('Please enter tool requirements');
                            return;
                          }
                          try {
                            await submitCustomToolsToWorkflow(toolRequirements);
                            setToolRequirements('');
                          } catch (error) {
                            // Error handled in hook
                          }
                        }}
                        disabled={isSessionLoading || !toolRequirements.trim()}
                      >
                        {isSessionLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          'Generate & Add'
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            await submitCustomToolsToWorkflow('');
                          } catch (error) {
                            // Error handled in hook
                          }
                        }}
                        disabled={isSessionLoading}
                      >
                        Skip
                      </Button>
                    </div>
                  </div>
                )}
                
                <ToolsSection
                  selectedTools={selectedTools}
                  onToolsChange={async (tools) => {
                    setSelectedTools(tools);
                    // In HITL mode, submit tools when waiting for tools stage
                    if (workflowMode === 'hitl' && sessionStatus?.waiting_stage === 'tools') {
                      try {
                        const toolsForApi = tools.map(tool => ({
                          name: tool.name,
                          description: tool.description,
                          code: tool.code,
                        }));
                        await submitToolsToWorkflow(toolsForApi);
                      } catch (error) {
                        // Error handled in hook
                      }
                    }
                  }}
                />

                {/* Custom Tool Creator */}
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold">Custom Tools</h3>
                      <p className="text-sm text-muted-foreground">
                        Add your own tools with custom Python code or generate with AI
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={addCustomTool}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Custom Tool
                      </Button>
                    </div>
                  </div>

                  {/* AI Tool Generator */}
                  <div className="mb-6 p-4 bg-primary/10 rounded-lg border border-primary/20">
                    <label className="text-sm font-medium mb-2 block">
                      Generate Tool with AI
                    </label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Describe the tool you want to generate (e.g., 'A tool that checks social media sentiment for cryptocurrencies')"
                        value={toolRequirements}
                        onChange={(e) => setToolRequirements(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleGenerateTool();
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        variant="glow"
                        onClick={handleGenerateTool}
                        disabled={isGeneratingTool || !toolRequirements.trim()}
                      >
                        {isGeneratingTool ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generate
                          </>
                        )}
                      </Button>
                    </div>
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
                  {workflowMode === 'hitl' && sessionStatus?.waiting_stage === 'tools' ? (
                    <Button
                      variant="glow"
                      onClick={async () => {
                        try {
                          const toolsForApi = selectedTools.map(tool => ({
                            name: tool.name,
                            description: tool.description,
                            code: tool.code,
                          }));
                          await submitToolsToWorkflow(toolsForApi);
                        } catch (error) {
                          // Error handled in hook
                        }
                      }}
                      disabled={isSessionLoading || selectedTools.length === 0}
                    >
                      {isSessionLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          Continue
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button variant="glow" onClick={() => setCurrentStep(2)}>
                      Continue
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 2: Prompt */}
            {currentStep === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                {/* Clarification Stage */}
                {workflowMode === 'hitl' && sessionStatus?.waiting_stage === 'clarification' && sessionStatus.user_clarifications && (
                  <div className="glass-card p-6 mb-6 border-2 border-primary/50">
                    <h3 className="text-lg font-bold mb-4">Clarification Needed</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Please answer the following questions to help us build your agent:
                    </p>
                    <div className="space-y-4">
                      {sessionStatus.user_clarifications.map((item, index) => (
                        <div key={index} className="space-y-2">
                          <Label className="text-sm font-medium">{item.question}</Label>
                          <Input
                            placeholder="Your answer..."
                            value={clarificationAnswers[index] || item.answer || ''}
                            onChange={(e) => {
                              setClarificationAnswers(prev => ({
                                ...prev,
                                [index]: e.target.value,
                              }));
                            }}
                          />
                        </div>
                      ))}
                      <Button
                        variant="glow"
                        onClick={async () => {
                          try {
                            const answers = sessionStatus.user_clarifications!.map((item, index) => ({
                              question: item.question,
                              answer: clarificationAnswers[index] || item.answer || '',
                            }));
                            await submitClarificationToWorkflow(answers);
                            setClarificationAnswers({});
                          } catch (error) {
                            // Error handled in hook
                          }
                        }}
                        disabled={isSessionLoading || !sessionStatus.user_clarifications?.every((q, i) => (clarificationAnswers[i] || q.answer || '').trim())}
                        className="mt-4"
                      >
                        {isSessionLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          'Submit Answers'
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                
                <PromptEditor
                  prompt={prompt}
                  onPromptChange={setPrompt}
                />

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(1)}>
                    Back
                  </Button>
                  {workflowMode === 'hitl' && sessionStatus?.waiting_stage === 'prompt' ? (
                    <Button
                      variant="glow"
                      onClick={async () => {
                        try {
                          await submitPromptToWorkflow(prompt);
                        } catch (error) {
                          // Error handled in hook
                        }
                      }}
                      disabled={isSessionLoading || !prompt.trim()}
                    >
                      {isSessionLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          Continue
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button variant="glow" onClick={() => setCurrentStep(3)}>
                      Continue
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 3: NEAR Account */}
            {currentStep === 3 && (
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

            {/* Step 4: Code Review */}
            {currentStep === 4 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold mb-2">Review Generated Code</h3>
                    <p className="text-sm text-muted-foreground">
                      {workflowMode === 'hitl' && sessionStatus?.waiting_stage === 'code_review'
                        ? 'Review and edit the generated agent code. Fix any errors before finalizing.'
                        : 'Review and edit the generated agent code before deployment'}
                    </p>
                  </div>
                  {workflowMode !== 'hitl' && (
                    <Button
                      variant="outline"
                      onClick={handleGenerateLogic}
                      disabled={isGeneratingLogic || selectedTools.length === 0}
                    >
                      {isGeneratingLogic ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating Logic...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Logic with AI
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Code Errors Display */}
                {workflowMode === 'hitl' && sessionStatus?.code_errors && sessionStatus.code_errors.length > 0 && (
                  <div className="glass-card p-4 border-2 border-red-500/50">
                    <h4 className="text-sm font-bold text-red-400 mb-2">Code Validation Errors</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {sessionStatus.code_errors.map((error, index) => (
                        <div key={index} className="text-xs">
                          <span className="font-medium">{error.file_path}</span>
                          {error.line_number && <span className="text-muted-foreground">:{error.line_number}</span>}
                          <span className="text-muted-foreground"> - </span>
                          <span className="text-red-400">{error.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <CodeEditor
                  initialFiles={
                    workflowMode === 'hitl' && sessionStatus?.template_code
                      ? templateCodeToFileNodes(sessionStatus.template_code)
                      : generatedFiles
                  }
                  onFilesChange={(files) => {
                    setCodeEditorFiles(files);
                  }}
                  height="600px"
                />
                
                {/* Code Update Controls for HITL */}
                {workflowMode === 'hitl' && sessionStatus?.waiting_stage === 'code_review' && (
                  <div className="glass-card p-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Make your edits above, then click "Save Changes" to update the workflow
                    </p>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        if (!sessionStatus?.template_code) return;
                        
                        try {
                          const templateCode = fileNodesToTemplateCode(codeEditorFiles.length > 0 ? codeEditorFiles : templateCodeToFileNodes(sessionStatus.template_code));
                          // Update all changed files
                          for (const [filePath, content] of Object.entries(templateCode)) {
                            if (sessionStatus.template_code[filePath] !== content) {
                              await updateCodeInWorkflow(filePath, content);
                            }
                          }
                          toast.success('Code changes saved');
                        } catch (error) {
                          // Error handled in hook
                        }
                      }}
                      disabled={isSessionLoading}
                    >
                      Save Changes
                    </Button>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(3)}>
                    Back
                  </Button>
                  {workflowMode === 'hitl' && sessionStatus?.waiting_stage === 'code_review' ? (
                    <div className="flex gap-2">
                      <Button
                        variant="glow"
                        onClick={async () => {
                          try {
                            await finalizeAgentInWorkflow();
                            await fetchAgents();
                          } catch (error) {
                            // Error handled in hook
                          }
                        }}
                        disabled={isSessionLoading}
                      >
                        {isSessionLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Finalizing...
                          </>
                        ) : (
                          <>
                            <Rocket className="h-4 w-4 mr-2" />
                            Finalize Agent
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <Button variant="glow" onClick={() => setCurrentStep(5)}>
                      Continue to Deploy
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 5: Deploy */}
            {currentStep === 5 && (
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
                        {selectedLLM.toUpperCase()}
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
                  <Button variant="outline" onClick={() => setCurrentStep(4)}>
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
