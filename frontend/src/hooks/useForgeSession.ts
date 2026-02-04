import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';

export interface SessionStatus {
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
}

// Polling interval in ms - only poll when workflow is processing (not waiting for user)
const POLLING_INTERVAL = 5000;

export function useForgeSession(userId: string = 'default_user') {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to determine if we should poll
  const shouldPoll = useCallback((status: SessionStatus | null): boolean => {
    if (!status) return false;
    // Don't poll if waiting for user input or if agent is finalized
    if (status.waiting_for_input) return false;
    if (status.agent_id) return false;
    // Only poll when workflow is actively processing
    return true;
  }, []);

  // Start a new session
  const startSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.startForgeSession(userId);
      setSessionId(response.session_id);
      setSessionStatus(response);
      // Only start polling if workflow is processing (not waiting for input)
      setIsPolling(shouldPoll(response));
      toast.success('HITL workflow started', {
        description: 'Session initialized successfully',
      });
      return response.session_id;
    } catch (error) {
      console.error('Failed to start session:', error);
      toast.error('Failed to start workflow', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [userId, shouldPoll]);

  // Poll session status
  const pollStatus = useCallback(async (id: string) => {
    try {
      const status = await api.getSessionStatus(id);
      setSessionStatus(status);
      
      // Update polling state based on new status
      const shouldContinuePolling = shouldPoll(status);
      setIsPolling(shouldContinuePolling);
      
      // Notify if agent is finalized
      if (status.agent_id && !sessionStatus?.agent_id) {
        toast.success('Agent finalized successfully!', {
          description: `Agent ID: ${status.agent_id}`,
        });
      }
      
      return status;
    } catch (error) {
      console.error('Failed to poll status:', error);
      return null;
    }
  }, [shouldPoll, sessionStatus?.agent_id]);

  // Start polling when session is active and workflow is processing
  useEffect(() => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (sessionId && isPolling) {
      // Poll at intervals (don't poll immediately since we have status from last action)
      pollingIntervalRef.current = setInterval(() => {
        pollStatus(sessionId);
      }, POLLING_INTERVAL);
    }
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [sessionId, isPolling, pollStatus]);

  // Submit tools
  const submitTools = useCallback(async (tools: any[]) => {
    if (!sessionId) throw new Error('No active session');
    
    setIsLoading(true);
    try {
      const status = await api.submitTools(sessionId, tools);
      setSessionStatus(status);
      // Only poll if workflow is still processing
      setIsPolling(shouldPoll(status));
      return status;
    } catch (error) {
      console.error('Failed to submit tools:', error);
      toast.error('Failed to submit tools', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, shouldPoll]);

  // Submit custom tools
  const submitCustomTools = useCallback(async (requirements: string) => {
    if (!sessionId) throw new Error('No active session');
    
    setIsLoading(true);
    try {
      const status = await api.submitCustomTools(sessionId, requirements);
      setSessionStatus(status);
      setIsPolling(shouldPoll(status));
      return status;
    } catch (error) {
      console.error('Failed to submit custom tools:', error);
      toast.error('Failed to submit custom tools', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, shouldPoll]);

  // Submit prompt
  const submitPrompt = useCallback(async (prompt: string) => {
    if (!sessionId) throw new Error('No active session');
    
    setIsLoading(true);
    try {
      const status = await api.submitPrompt(sessionId, prompt);
      setSessionStatus(status);
      setIsPolling(shouldPoll(status));
      return status;
    } catch (error) {
      console.error('Failed to submit prompt:', error);
      toast.error('Failed to submit prompt', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, shouldPoll]);

  // Submit clarification
  const submitClarification = useCallback(async (answers: Array<{ question: string; answer: string }>) => {
    if (!sessionId) throw new Error('No active session');
    
    setIsLoading(true);
    try {
      const status = await api.submitClarification(sessionId, answers);
      setSessionStatus(status);
      setIsPolling(shouldPoll(status));
      return status;
    } catch (error) {
      console.error('Failed to submit clarification:', error);
      toast.error('Failed to submit clarification', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, shouldPoll]);

  // Submit tool review
  const submitToolReview = useCallback(async (changes: { add: string[]; remove: string[]; confirmed: boolean }) => {
    if (!sessionId) throw new Error('No active session');
    
    setIsLoading(true);
    try {
      const status = await api.submitToolReview(sessionId, changes);
      setSessionStatus(status);
      setIsPolling(shouldPoll(status));
      return status;
    } catch (error) {
      console.error('Failed to submit tool review:', error);
      toast.error('Failed to submit tool review', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, shouldPoll]);

  // Submit environment variables
  const submitEnvVariables = useCallback(async (envVariables: Record<string, string>) => {
    if (!sessionId) throw new Error('No active session');
    
    setIsLoading(true);
    try {
      const status = await api.submitEnvVariables(sessionId, envVariables);
      setSessionStatus(status);
      setIsPolling(shouldPoll(status));
      return status;
    } catch (error) {
      console.error('Failed to submit env variables:', error);
      toast.error('Failed to submit env variables', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, shouldPoll]);

  // Update code
  const updateCode = useCallback(async (filePath: string, content: string) => {
    if (!sessionId) throw new Error('No active session');
    
    setIsLoading(true);
    try {
      const status = await api.updateCode(sessionId, filePath, content);
      setSessionStatus(status);
      setIsPolling(shouldPoll(status));
      return status;
    } catch (error) {
      console.error('Failed to update code:', error);
      toast.error('Failed to update code', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, shouldPoll]);

  // Finalize agent
  const finalizeAgent = useCallback(async () => {
    if (!sessionId) throw new Error('No active session');
    
    setIsLoading(true);
    try {
      const status = await api.finalizeAgent(sessionId);
      setSessionStatus(status);
      setIsPolling(false); // Always stop polling after finalize
      toast.success('Agent finalized!', {
        description: status.agent_id ? `Agent ID: ${status.agent_id}` : 'Agent created successfully',
      });
      return status;
    } catch (error) {
      console.error('Failed to finalize agent:', error);
      toast.error('Failed to finalize agent', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Reset session
  const resetSession = useCallback(() => {
    setSessionId(null);
    setSessionStatus(null);
    setIsPolling(false);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  return {
    sessionId,
    sessionStatus,
    isPolling,
    isLoading,
    startSession,
    submitTools,
    submitCustomTools,
    submitPrompt,
    submitClarification,
    submitToolReview,
    submitEnvVariables,
    updateCode,
    finalizeAgent,
    resetSession,
    pollStatus,
  };
}
