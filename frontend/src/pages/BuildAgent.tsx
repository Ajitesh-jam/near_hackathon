import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Rocket, 
  Wrench, 
  FileCode, 
  MessageSquare,
  ChevronRight,
  Loader2,
  Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Navbar } from '@/components/Navbar';
import { ToolsSection, Tool } from '@/components/ToolsSection';
import { PromptEditor, defaultPrompt } from '@/components/PromptEditor';
import { CodeEditor, FileNode } from '@/components/CodeEditor';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useForgeSession } from '@/hooks/useForgeSession';
import { templateCodeToFileNodes, getStepIndexForStage, fileNodesToTemplateCode } from '@/lib/workflowUtils';
import { Label } from '@/components/ui/label';

// Simplified steps matching the exact workflow
const steps = [
  { id: 'start', label: 'Start Session', icon: Play },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'prompt', label: 'Prompt', icon: MessageSquare },
  { id: 'code', label: 'Code Review & Finalize', icon: FileCode },
];

const BuildAgent = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTools, setSelectedTools] = useState<Tool[]>([]);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<number, string>>({});
  const [codeEditorFiles, setCodeEditorFiles] = useState<FileNode[]>([]);
  const [toolRequirements, setToolRequirements] = useState('');
  const hasUserSelectedTools = useRef(false);
  const lastWaitingStage = useRef<string | null>(null);
  
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
      
      lastWaitingStage.current = sessionStatus.waiting_stage;
      
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
  }, [sessionStatus]);

  const handleStartSession = async () => {
    try {
      hasUserSelectedTools.current = false;
      lastWaitingStage.current = null;
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

  const handleFinalize = async () => {
    try {
      await finalizeAgentInWorkflow();
      toast.success('Agent created successfully!', {
        description: sessionStatus?.agent_id ? `Agent ID: ${sessionStatus.agent_id}` : '',
      });
    } catch (error) {
      // Error handled in hook
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
              const isCompleted = currentStep > index || (sessionStatus?.agent_id && index === steps.length - 1);
              
              return (
                <button
                  key={step.id}
                  onClick={() => {
                    // Only allow navigation to completed steps or current step
                    if (isActive || isCompleted) {
                      setCurrentStep(index);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300",
                    isActive
                      ? "bg-primary/20 text-primary neon-border"
                      : isCompleted
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
                {/* Clarification Stage */}
                {sessionStatus?.waiting_stage === 'clarification' && sessionStatus.user_clarifications && (
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
                        onClick={handleSubmitClarification}
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

            {/* Step 3: Code Review & Finalize */}
            {currentStep === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold mb-2">Review Generated Code</h3>
                    <p className="text-sm text-muted-foreground">
                      {sessionStatus?.waiting_stage === 'code_review'
                        ? 'Review and edit the generated agent code. Fix any errors before finalizing.'
                        : 'Review the generated agent code before finalizing.'}
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

                <CodeEditor
                  initialFiles={
                    sessionStatus?.template_code
                      ? templateCodeToFileNodes(sessionStatus.template_code)
                      : []
                  }
                  onFilesChange={(files) => {
                    setCodeEditorFiles(files);
                  }}
                  height="600px"
                />
                
                {/* Code Update Controls */}
                {sessionStatus?.waiting_stage === 'code_review' && (
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
                  <Button variant="outline" onClick={() => setCurrentStep(2)}>
                    Back
                  </Button>
                  {sessionStatus?.waiting_stage === 'code_review' || sessionStatus?.agent_id ? (
                    <Button
                      variant="glow"
                      onClick={handleFinalize}
                      disabled={isSessionLoading || !!sessionStatus?.agent_id}
                    >
                      {isSessionLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Finalizing...
                        </>
                      ) : sessionStatus?.agent_id ? (
                        <>
                          <Rocket className="h-4 w-4 mr-2" />
                          Agent Created: {sessionStatus.agent_id}
                        </>
                      ) : (
                        <>
                          <Rocket className="h-4 w-4 mr-2" />
                          Finalize Agent
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button variant="glow" onClick={() => setCurrentStep(3)} disabled>
                      Waiting for code generation...
                    </Button>
                  )}
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
