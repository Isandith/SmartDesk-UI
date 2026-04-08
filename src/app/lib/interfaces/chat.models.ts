export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: Date;
}

export interface ChatResponseMetadata {
  session_id: string;
  user_message: string;
  answer: string;
  sentiment_score: number;
  priority_escalation: boolean;
  response_source: string;
  context: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  metadata?: ChatResponseMetadata;
}
