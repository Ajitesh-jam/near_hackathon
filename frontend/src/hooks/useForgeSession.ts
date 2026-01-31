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

export function useForgeSession(userId: string = 'default_user') {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start a new session
  const startSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.startForgeSession(userId);
      setSessionId(response.session_id);
      setIsPolling(true);
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
  }, [userId]);

  // Poll session status
  const pollStatus = useCallback(async (id: string) => {
    try {
      const status = await api.getSessionStatus(id);
      setSessionStatus(status);
      
      // Stop polling if workflow is complete
      if (!status.waiting_for_input && status.agent_id) {
        setIsPolling(false);
        toast.success('Agent finalized successfully!', {
          description: `Agent ID: ${status.agent_id}`,
        });
      }
      
      return status;
    } catch (error) {
      console.error('Failed to poll status:', error);
      // Don't show error toast on every poll failure, just log it
      return null;
    }
  }, []);

  // Start polling when session is active
  useEffect(() => {
    if (sessionId && isPolling) {
      // Poll immediately
      pollStatus(sessionId);
      
      // Then poll every 2 seconds
      pollingIntervalRef.current = setInterval(() => {
        pollStatus(sessionId);
      }, 2000);
      
      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    }
  }, [sessionId, isPolling, pollStatus]);

  // Submit tools
  const submitTools = useCallback(async (tools: any[]) => {
    if (!sessionId) throw new Error('No active session');
    
    setIsLoading(true);
    try {
      const status = await api.submitTools(sessionId, tools);
      setSessionStatus(status);
      setIsPolling(true);
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
  }, [sessionId]);

  // Submit custom tools
  const submitCustomTools = useCallback(async (requirements: string) => {
    if (!sessionId) throw new Error('No active session');
    
    setIsLoading(true);
    try {
      const status = await api.submitCustomTools(sessionId, requirements);
      setSessionStatus(status);
      setIsPolling(true);
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
  }, [sessionId]);

  // Submit prompt
  const submitPrompt = useCallback(async (prompt: string) => {
    if (!sessionId) throw new Error('No active session');
    
    setIsLoading(true);
    try {
      const status = await api.submitPrompt(sessionId, prompt);
      setSessionStatus(status);
      setIsPolling(true);
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
  }, [sessionId]);

  // Submit clarification
  const submitClarification = useCallback(async (answers: Array<{ question: string; answer: string }>) => {
    if (!sessionId) throw new Error('No active session');
    
    setIsLoading(true);
    try {
      const status = await api.submitClarification(sessionId, answers);
      setSessionStatus(status);
      setIsPolling(true);
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
  }, [sessionId]);

  // Submit tool review
  const submitToolReview = useCallback(async (changes: { add: string[]; remove: string[]; confirmed: boolean }) => {
    if (!sessionId) throw new Error('No active session');
    
    setIsLoading(true);
    try {
      const status = await api.submitToolReview(sessionId, changes);
      setSessionStatus(status);
      setIsPolling(true);
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
  }, [sessionId]);

  // Update code
  const updateCode = useCallback(async (filePath: string, content: string) => {
    if (!sessionId) throw new Error('No active session');
    
    setIsLoading(true);
    try {
      const status = await api.updateCode(sessionId, filePath, content);
      setSessionStatus(status);
      setIsPolling(true);
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
  }, [sessionId]);

  // Finalize agent
  const finalizeAgent = useCallback(async () => {
    if (!sessionId) throw new Error('No active session');
    
    setIsLoading(true);
    try {
      const status = await api.finalizeAgent(sessionId);
      setSessionStatus(status);
      setIsPolling(false);
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
    updateCode,
    finalizeAgent,
    resetSession,
    pollStatus,
  };
}
