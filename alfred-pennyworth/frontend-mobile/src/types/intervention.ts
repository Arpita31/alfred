export interface Intervention {
  id: number;
  title: string;
  message: string;
  confidence_score: number;
  status: string;
  signal_type?: string;
}

export type FeedbackResponse = 'accepted' | 'snoozed';

export interface ChatMessage {
  role: 'user' | 'alfred';
  text: string;
}
