import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Rocket, 
  Wrench, 
  FileCode, 
  MessageSquare,
  ChevronRight,
  Loader2,
  Play,
  Send,
  Bot,
  User,
  HelpCircle,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  UploadCloud
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Navbar } from '@/components/Navbar';
import { ToolsSection, Tool } from '@/components/ToolsSection';
import { PromptEditor, defaultPrompt } from '@/components/PromptEditor';
import { CodeEditor, FileNode } from '@/components/CodeEditor';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useForgeSession } from '@/hooks/useForgeSession';
import { templateCodeToFileNodes, getStepIndexForStage, fileNodesToTemplateCode } from '@/lib/workflowUtils';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api/client';

// Environment variable fields (required + optional)
const ENV_FIELDS = [
  { key: 'NEAR_ACCOUNT_ID', label: 'NEAR Account ID', required: true, type: 'text' as const },
  { key: 'NEAR_SEED_PHRASE', label: 'NEAR Seed Phrase', required: true, type: 'password' as const },
  { key: 'PHALA_API_KEY', label: 'Phala API Key (optional)', required: true, type: 'password' as const },
  { key: 'NEAR_AI_API_KEY', label: 'NEAR AI API Key (optional)', required: false, type: 'password' as const },
] as const;

// Simplified steps matching the exact workflow
const steps = [
  { id: 'start', label: 'Start Session', icon: Play },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'prompt', label: 'Prompt', icon: MessageSquare },
  { id: 'clarification', label: 'Clarification and Confirmation', icon: HelpCircle },
  { id: 'env', label: 'Environment Variables', icon: KeyRound },
  { id: 'code', label: 'Code Review & Finalize', icon: FileCode },
  { id: 'deploy', label: 'Deploy Agent', icon: UploadCloud },
];

const BuildAgent = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTools, setSelectedTools] = useState<Tool[]>([]);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<number, string>>({});
  const [codeEditorFiles, setCodeEditorFiles] = useState<FileNode[]>([]);
  const [envVariables, setEnvVariables] = useState<Record<string, string>>({});
  const [toolRequirements, setToolRequirements] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isBuildingDocker, setIsBuildingDocker] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const hasUserSelectedTools = useRef(false);
  const lastWaitingStage = useRef<string | null>(null);
  const hadTemplateCodeRef = useRef(false); // only auto-advance to code review when template_code first appears
  const hasFetchedAgentFilesRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
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
    submitEnvVariables: submitEnvVariablesToWorkflow,
    updateCode: updateCodeInWorkflow,
    finalizeAgent: finalizeAgentInWorkflow,
    resetSession,
  } = useForgeSession('default_user');

  // Sync local state with HITL session status
  useEffect(() => {
    if (sessionStatus) {
      // Only sync selected tools when:
      // 1. We're entering the tools stage for the first time (waiting_stage changed to 'tools')
      // 2. User hasn't manually selected tools yet
      const isEnteringToolsStage = sessionStatus.waiting_stage === 'tools' && 
                                    lastWaitingStage.current !== 'tools';
      
      if (isEnteringToolsStage && !hasUserSelectedTools.current && sessionStatus.selected_tools) {
        const tools = sessionStatus.selected_tools.map((tool: any) => ({
          id: tool.name?.toLowerCase().replace(/\s+/g, '_') || '',
          name: tool.name || '',
          description: tool.description || '',
          code: tool.code || '',
        }));
        setSelectedTools(tools);
      }
      
      // Reset user selection flag when leaving tools stage
      if (lastWaitingStage.current === 'tools' && sessionStatus.waiting_stage !== 'tools') {
        hasUserSelectedTools.current = false;
      }
      
      // Sync code editor files when template_code first becomes available
      // (fallback - full agent files are fetched in Code Review step via useEffect)
      if (sessionStatus.template_code && Object.keys(sessionStatus.template_code).length > 0 && !hasFetchedAgentFilesRef.current) {
        if (codeEditorFiles.length === 0) {
          const files = templateCodeToFileNodes(sessionStatus.template_code);
          setCodeEditorFiles(files);
        }
      }
      
      // Auto-navigate only when the *backend* stage changes (so Back button is not overridden)
      const hasTemplateCode = !!(sessionStatus.template_code && Object.keys(sessionStatus.template_code).length > 0);
      if (!hasTemplateCode) {
        hadTemplateCodeRef.current = false;
      }
      
      if (sessionStatus.waiting_for_input) {
        // Only jump to step when waiting_stage actually changed (e.g. backend moved to clarification)
        if (sessionStatus.waiting_stage !== lastWaitingStage.current) {
          const stepIndex = getStepIndexForStage(sessionStatus.waiting_stage);
          setCurrentStep(stepIndex);
        }
        lastWaitingStage.current = sessionStatus.waiting_stage;
      } else {
        lastWaitingStage.current = sessionStatus.waiting_stage;
        // Only auto-advance to env vars step when template_code *first* appears (not when user went Back)
        if (hasTemplateCode && !hadTemplateCodeRef.current) {
          hadTemplateCodeRef.current = true;
          setCurrentStep(4); // Step 4 = Environment Variables
        }
      }
    }
  }, [sessionStatus, currentStep]);
  
  // Fetch all agent files (contract/, .env, docker-compose, etc.) when in Code Review step
  useEffect(() => {
    if (
      currentStep !== 5 ||
      !sessionId ||
      !sessionStatus ||
      (Object.keys(sessionStatus.template_code || {}).length === 0 && !sessionStatus.agent_id)
    ) return;

    const hasCodeReady = (sessionStatus.template_code && Object.keys(sessionStatus.template_code).length > 0) || sessionStatus.agent_id;
    if (!hasCodeReady) return;

    const fetchAgentFiles = async () => {
      try {
        let templateCode: Record<string, string> = {};
        if (sessionStatus.agent_id) {
          const res = await api.getAgentFiles(sessionId);
          templateCode = res.template_code || {};
        } else {
          const res = await api.getSessionAgentFiles(sessionId);
          templateCode = res.template_code || {};
        }
        // Merge: agent files as base, session template_code overwrites (user edits)
        const merged = { ...templateCode, ...(sessionStatus.template_code || {}) };
        hasFetchedAgentFilesRef.current = true;
        setCodeEditorFiles(templateCodeToFileNodes(merged));
      } catch (err) {
        console.error('Failed to fetch agent files:', err);
        // Fallback to session template_code
        if (sessionStatus.template_code && Object.keys(sessionStatus.template_code).length > 0) {
          setCodeEditorFiles(templateCodeToFileNodes(sessionStatus.template_code));
        }
      }
    };

    fetchAgentFiles();
  }, [currentStep, sessionId, sessionStatus?.agent_id, sessionStatus?.template_code]);

  // Reset fetch ref when leaving code review or starting new session
  useEffect(() => {
    if (currentStep !== 5) hasFetchedAgentFilesRef.current = false;
  }, [currentStep]);

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleStartSession = async () => {
    try {
      hasUserSelectedTools.current = false;
      lastWaitingStage.current = null;
      hadTemplateCodeRef.current = false;
      hasFetchedAgentFilesRef.current = false;
      await startSession();
      setCurrentStep(1);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleSubmitTools = async () => {
    if (selectedTools.length === 0) {
      toast.error('Please select at least one tool');
      return;
    }
    
    try {
      const toolsForApi = selectedTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        code: tool.code,
      }));
      await submitToolsToWorkflow(toolsForApi);
      // Reset flag after successful submission
      hasUserSelectedTools.current = false;
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleSubmitPrompt = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }
    
    try {
      await submitPromptToWorkflow(prompt);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleSubmitClarification = async () => {
    if (!sessionStatus?.user_clarifications) return;
    
    try {
      const answers = sessionStatus.user_clarifications.map((item, index) => ({
        question: item.question,
        answer: clarificationAnswers[index] || item.answer || '',
      }));
      
      // Validate all answers are provided
      if (!answers.every(a => a.answer.trim())) {
        toast.error('Please answer all questions');
        return;
      }
      
      await submitClarificationToWorkflow(answers);
      setClarificationAnswers({});
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleSaveCodeChanges = async () => {
    if (!sessionStatus?.template_code) return;
    
    try {
      const templateCode = fileNodesToTemplateCode(
        codeEditorFiles.length > 0 
          ? codeEditorFiles 
          : templateCodeToFileNodes(sessionStatus.template_code)
      );
      
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
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || !sessionId) return;
    
    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsGeneratingCode(true);
    
    try {
      // Use the logic generation API to get AI suggestions
      const toolsForApi = selectedTools.map(tool => ({
        name: tool.name,
        type: 'reactive',
        description: tool.description,
      }));
      
      const result = await api.generateLogic(
        toolsForApi,
        `${prompt}\n\nUser request: ${userMessage}`,
        {
          user_id: 'default_user',
          llm_provider: 'openai',
          near_account: '',
        }
      );
      
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Here's the updated code based on your request:\n\n\`\`\`python\n${result.logic_code}\n\`\`\`` 
      }]);
      
      // Update the logic.py file in the editor
      if (codeEditorFiles.length > 0) {
        const updatedFiles = codeEditorFiles.map(file => {
          if (file.name === 'logic.py') {
            return { ...file, content: result.logic_code };
          }
          return file;
        });
        setCodeEditorFiles(updatedFiles);
      }
      
      toast.success('Code updated based on your request');
    } catch (error) {
      console.error('Failed to generate code:', error);
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error while generating the code. Please try again.' 
      }]);
      toast.error('Failed to generate code', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleFinalize = async () => {
    // console.log('handleFinalize', sessionStatus);
    // if (sessionStatus?.waiting_stage !== 'code_review' && !sessionStatus?.agent_id) {
    //   toast.error('Please wait for code generation to complete');
    //   return;
    // }
    
    try {
      await finalizeAgentInWorkflow();
      setCurrentStep(6); // Advance to Deploy step
      toast.success('Agent created successfully!', {
        description: sessionStatus?.agent_id ? `Agent ID: ${sessionStatus.agent_id}` : '',
      });
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleCompileContract = async () => {
    if (!sessionId) return;
    setIsCompiling(true);
    try {
      await api.compileContract(sessionId);
      toast.success('Contract compiled successfully');
    } catch (err) {
      toast.error('Compile failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsCompiling(false);
    }
  };

  const handleBuildDockerImage = async () => {
    if (!sessionId) return;
    setIsBuildingDocker(true);
    try {
      await api.buildDockerImage(sessionId);
      toast.success('Docker image built and pushed successfully');
    } catch (err) {
      toast.error('Build failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsBuildingDocker(false);
    }
  };

  const handleDeployAgent = async () => {
    if (!sessionId) return;
    setIsDeploying(true);
    try {
      await api.deployAgent(sessionId);
      toast.success('Agent deployed to Phala Cloud successfully');
    } catch (err) {
      toast.error('Deploy failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsDeploying(false);
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
              Create a decentralized AI agent using the HITL workflow
            </p>
            
            {/* Session Status Indicator */}
            {sessionId && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex justify-center"
              >
                <div className="glass-card p-3 inline-flex items-center gap-3">
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
                </div>
              </motion.div>
            )}
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
              const isActive = currentStep === index;
              const deployStepReady = index === steps.length - 1 && (
                (sessionStatus?.template_code && Object.keys(sessionStatus.template_code).length > 0) ||
                !!sessionStatus?.agent_id
              );
              const isCompleted = currentStep > index || (sessionStatus?.agent_id && index === steps.length - 1);
              const canNavigate = isActive || isCompleted || deployStepReady;
              
              return (
                <button
                  key={step.id}
                  onClick={() => {
                    if (canNavigate) {
                      setCurrentStep(index);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300",
                    isActive
                      ? "bg-primary/20 text-primary neon-border"
                      : isCompleted || deployStepReady
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
            {/* Step 0: Start Session */}
            {currentStep === 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-card p-8"
              >
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <Play className="h-6 w-6 text-primary" />
                  Initialize Session
                </h2>
                
                <div className="space-y-6 mb-8">
                  <div className="flex gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold">1</span>
                    </div>
                    <div>
                      <h3 className="font-bold mb-1">Start Workflow</h3>
                      <p className="text-sm text-muted-foreground">
                        Initialize a new HITL workflow session. This will create a session and prepare the agent template.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold">2</span>
                    </div>
                    <div>
                      <h3 className="font-bold mb-1">Select Tools</h3>
                      <p className="text-sm text-muted-foreground">
                        Choose the capabilities your agent will have from the available tools.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold">3</span>
                    </div>
                    <div>
                      <h3 className="font-bold mb-1">Define Prompt</h3>
                      <p className="text-sm text-muted-foreground">
                        Describe what you want your agent to do. The system may ask for clarification.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-accent font-bold">4</span>
                    </div>
                    <div>
                      <h3 className="font-bold mb-1 neon-text-emerald">Review & Finalize</h3>
                      <p className="text-sm text-muted-foreground">
                        Review the generated code, make any necessary edits, and finalize your agent.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-4">
                  {!sessionId ? (
                    <Button
                      variant="glow"
                      onClick={handleStartSession}
                      disabled={isSessionLoading}
                    >
                      {isSessionLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Starting...
                        </>
                      ) : (
                        <>
                          Start Workflow
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button variant="glow" onClick={() => setCurrentStep(1)}>
                      Continue
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
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
                {sessionStatus?.waiting_stage === 'tool_review' && sessionStatus.tool_changes && (
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
                {sessionStatus?.waiting_stage === 'custom_tools' && (
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
                  onToolsChange={(tools) => {
                    hasUserSelectedTools.current = true;
                    setSelectedTools(tools);
                  }}
                />

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(0)}>
                    Back
                  </Button>
                  {sessionStatus?.waiting_stage === 'tools' ? (
                    <Button
                      variant="glow"
                      onClick={handleSubmitTools}
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
                <PromptEditor
                  prompt={prompt}
                  onPromptChange={setPrompt}
                />

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(1)}>
                    Back
                  </Button>
                  {sessionStatus?.waiting_stage === 'prompt' ? (
                    <Button
                      variant="glow"
                      onClick={handleSubmitPrompt}
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

            {/* Step 3: Clarification & Confirmation */}
            {currentStep === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <div className="glass-card p-8">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <HelpCircle className="h-6 w-6 text-primary" />
                    Clarification & Confirmation
                  </h2>
                  
                  {sessionStatus?.waiting_stage === 'clarification' && sessionStatus.user_clarifications ? (
                    <div className="space-y-6">
                      <p className="text-muted-foreground">
                        Please answer the following questions to help us build your agent correctly:
                      </p>
                      
                      <div className="space-y-4">
                        {sessionStatus.user_clarifications.map((item, index) => (
                          <div key={index} className="glass-card p-4 space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                <span className="text-primary font-bold text-sm">{index + 1}</span>
                              </div>
                              <div className="flex-1 space-y-2">
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
                                  className="bg-background/50"
                                />
                              </div>
                              {(clarificationAnswers[index] || item.answer || '').trim() && (
                                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-1" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex justify-end">
                        <Button
                          variant="glow"
                          onClick={handleSubmitClarification}
                          disabled={isSessionLoading || !sessionStatus.user_clarifications?.every((q, i) => (clarificationAnswers[i] || q.answer || '').trim())}
                        >
                          {isSessionLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              Submit & Generate Code
                              <ChevronRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : sessionStatus?.template_code && Object.keys(sessionStatus.template_code).length > 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-bold mb-2">Clarification Complete</h3>
                      <p className="text-muted-foreground">
                        Your answers have been processed and the code has been generated. Redirecting to Environment Variables...
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                      <p className="text-muted-foreground">
                        Waiting for clarification questions...
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Please submit your prompt first to receive clarification questions.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(2)}>
                    Back
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Environment Variables */}
            {currentStep === 4 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <div className="glass-card p-8">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <KeyRound className="h-6 w-6 text-primary" />
                    Environment Variables
                  </h2>
                  
                  {/* Security info banner */}
                  <div className="mb-8 p-6 rounded-xl bg-primary/10 border-2 border-primary/30 flex gap-4">
                    <ShieldCheck className="h-10 w-10 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-lg mb-2">100% Secure — Your keys never leave the Shade Agent</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        All secret keys are sent directly to your Shade Agent running in a Trusted Execution Environment (TEE). 
                        We developers and the deploying authority cannot see, log, or access your credentials. 
                        Your API keys and seed phrases are fully encrypted and never exposed. It is 100% secure to provide your keys here.
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {ENV_FIELDS.map(({ key, label, required, type }) => (
                      <div key={key} className="space-y-2">
                        <Label htmlFor={key} className="text-sm font-medium flex items-center gap-2">
                          {label}
                          {required && <span className="text-destructive">*</span>}
                        </Label>
                        <Input
                          id={key}
                          type={type}
                          placeholder={required ? `Enter ${label}` : `Optional: ${label}`}
                          value={envVariables[key] || ''}
                          onChange={(e) => setEnvVariables(prev => ({ ...prev, [key]: e.target.value }))}
                          className="bg-background/50 font-mono text-sm"
                          autoComplete={type === 'password' ? 'off' : 'on'}
                        />
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex justify-end mt-6">
                    <Button
                      variant="glow"
                      onClick={async () => {
                        const requiredFilled = ENV_FIELDS.filter(f => f.required).every(
                          f => (envVariables[f.key] || '').trim()
                        );
                        if (!requiredFilled) {
                          toast.error('Please fill all required fields');
                          return;
                        }
                        try {
                          await submitEnvVariablesToWorkflow(envVariables);
                          setCurrentStep(5);
                          toast.success('Environment variables saved securely');
                        } catch {
                          // Error handled in hook
                        }
                      }}
                      disabled={isSessionLoading || !ENV_FIELDS.filter(f => f.required).every(
                        f => (envVariables[f.key] || '').trim()
                      )}
                    >
                      {isSessionLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          Save & Continue to Code Review
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(3)}>
                    Back
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 5: Code Review & Finalize */}
            {currentStep === 5 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold mb-2">Review Generated Code</h3>
                    <p className="text-sm text-muted-foreground">
                      {sessionStatus?.waiting_stage === 'code_review' || sessionStatus?.template_code
                        ? 'Review and edit the generated agent code. Use the chat to request AI-assisted edits or edit directly in the code editor.'
                        : 'Waiting for code generation...'}
                    </p>
                  </div>
                </div>

                {/* Code Errors Display */}
                {sessionStatus?.code_errors && sessionStatus.code_errors.length > 0 && (
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

                {/* Code Editor and Chat Side by Side */}
                {sessionStatus?.template_code && Object.keys(sessionStatus.template_code).length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Code Editor - Takes 2/3 of the space */}
                    <div className="lg:col-span-2">
                      <CodeEditor
                        initialFiles={
                          codeEditorFiles.length > 0 
                            ? codeEditorFiles 
                            : templateCodeToFileNodes(sessionStatus.template_code)
                        }
                        onFilesChange={(files) => {
                          setCodeEditorFiles(files);
                        }}
                        height="600px"
                      />
                    </div>
                    
                    {/* Chat Interface - Takes 1/3 of the space */}
                    <div className="glass-card flex flex-col" style={{ height: '600px' }}>
                      <div className="p-4 border-b border-border">
                        <h4 className="font-bold flex items-center gap-2">
                          <Bot className="h-4 w-4 text-primary" />
                          AI Code Assistant
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Ask me to modify or improve your code
                        </p>
                      </div>
                      
                      {/* Chat Messages */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {chatMessages.length === 0 ? (
                          <div className="text-center text-muted-foreground text-sm py-8">
                            <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>Start a conversation to edit your code</p>
                            <p className="text-xs mt-2">Try: "Add error handling" or "Optimize this function"</p>
                          </div>
                        ) : (
                          chatMessages.map((msg, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "flex gap-2",
                                msg.role === 'user' ? 'justify-end' : 'justify-start'
                              )}
                            >
                              {msg.role === 'assistant' && (
                                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                  <Bot className="h-3 w-3 text-primary" />
                                </div>
                              )}
                              <div
                                className={cn(
                                  "rounded-lg p-3 max-w-[80%] text-sm",
                                  msg.role === 'user'
                                    ? "bg-primary/20 text-primary"
                                    : "bg-secondary text-foreground"
                                )}
                              >
                                <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                              </div>
                              {msg.role === 'user' && (
                                <div className="h-6 w-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                                  <User className="h-3 w-3 text-accent" />
                                </div>
                              )}
                            </div>
                          ))
                        )}
                        {isGeneratingCode && (
                          <div className="flex gap-2 justify-start">
                            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                              <Bot className="h-3 w-3 text-primary" />
                            </div>
                            <div className="bg-secondary rounded-lg p-3">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            </div>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>
                      
                      {/* Chat Input */}
                      <div className="p-4 border-t border-border">
                        <div className="flex gap-2">
                          <Textarea
                            placeholder="Ask me to modify your code..."
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleChatSubmit();
                              }
                            }}
                            className="min-h-[60px] resize-none"
                            disabled={isGeneratingCode || !sessionId}
                          />
                          <Button
                            variant="glow"
                            onClick={handleChatSubmit}
                            disabled={isGeneratingCode || !chatInput.trim() || !sessionId}
                            className="self-end"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="glass-card p-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-muted-foreground">Generating code...</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      This may take a few moments
                    </p>
                  </div>
                )}
                
                {/* Code Update Controls */}
                {sessionStatus?.waiting_stage === 'code_review' && sessionStatus?.template_code && (
                  <div className="glass-card p-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Make your edits above, then click "Save Changes" to update the workflow
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleSaveCodeChanges}
                      disabled={isSessionLoading}
                    >
                      Save Changes
                    </Button>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(4)}>
                    Back
                  </Button>
                  {(sessionStatus?.waiting_stage === 'code_review' || 
                    (sessionStatus?.template_code && Object.keys(sessionStatus.template_code).length > 0)) && 
                   !sessionStatus?.agent_id ? (
                    <Button
                      variant="glow"
                      onClick={handleFinalize}
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
                  ) : sessionStatus?.agent_id ? (
                    <Button
                      variant="glow"
                      onClick={() => setCurrentStep(6)}
                    >
                      <UploadCloud className="h-4 w-4 mr-2" />
                      Continue to Deploy
                    </Button>
                  ) : (
                    <Button variant="glow" disabled>
                      Waiting for code generation...
                    </Button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 6: Deploy Agent */}
            {currentStep === 6 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-card p-8"
              >
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <UploadCloud className="h-6 w-6 text-primary" />
                  Deploy Agent
                </h2>
                <p className="text-muted-foreground mb-8">
                  Compile the contract, build the Docker image, and deploy your agent to Phala Cloud. 
                  Run each step in order, or use the full deploy to do everything at once.
                </p>
                <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-3">
                  <div className="glass-card p-6 border border-border/50">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-primary" />
                      Compile Contract
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Build the NEAR contract WASM file
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleCompileContract}
                      disabled={!sessionId || isCompiling}
                      className="w-full"
                    >
                      {isCompiling ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Compile Contract'
                      )}
                    </Button>
                  </div>
                  <div className="glass-card p-6 border border-border/50">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-primary" />
                      Build Docker Image
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Build and push the Docker image
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleBuildDockerImage}
                      disabled={!sessionId || isBuildingDocker}
                      className="w-full"
                    >
                      {isBuildingDocker ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Build Docker Image'
                      )}
                    </Button>
                  </div>
                  <div className="glass-card p-6 border border-border/50">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Rocket className="h-4 w-4 text-primary" />
                      Deploy to Phala Cloud
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Compile, build, and deploy the full agent
                    </p>
                    <Button
                      variant="glow"
                      onClick={handleDeployAgent}
                      disabled={!sessionId || isDeploying}
                      className="w-full"
                    >
                      {isDeploying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Deploy Agent'
                      )}
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between mt-8">
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
