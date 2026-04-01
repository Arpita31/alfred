import { useState, useCallback } from 'react';
import { ChatMessage, Intervention, FeedbackResponse } from '../types/intervention';
import { generateIntervention, submitFeedback } from '../lib/api/interventions';
import { sendChatMessage } from '../lib/api/chat';
import { useApp } from '../context/AppContext';

export interface AIChatVM {
  messages: ChatMessage[];
  intervention: Intervention | null;
  chatInput: string;
  loading: boolean;
  setChatInput: (v: string) => void;
  sendMessage: (text?: string) => Promise<void>;
  respondToIntervention: (response: FeedbackResponse) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAIChat(): AIChatVM {
  const { userId } = useApp();
  const [messages, setMessages]         = useState<ChatMessage[]>([]);
  const [intervention, setIntervention] = useState<Intervention | null>(null);
  const [chatInput, setChatInput]       = useState('');
  const [loading, setLoading]           = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const iv = await generateIntervention(userId);
      setIntervention(iv);
    } catch {
      // no intervention available — that's fine
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? chatInput).trim();
    if (!content) return;
    setChatInput('');
    const userMsg: ChatMessage = { role: 'user', text: content };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const reply = await sendChatMessage(content, userId);
      setMessages(prev => [...prev, { role: 'alfred', text: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'alfred', text: 'Sorry, I could not reach the server.' }]);
    } finally {
      setLoading(false);
    }
  }, [chatInput, userId]);

  const respondToIntervention = useCallback(async (response: FeedbackResponse) => {
    if (!intervention) return;
    await submitFeedback(intervention.id, response).catch(() => null);
    setIntervention(null);
  }, [intervention]);

  return {
    messages, intervention, chatInput, loading,
    setChatInput, sendMessage, respondToIntervention, refresh,
  };
}
