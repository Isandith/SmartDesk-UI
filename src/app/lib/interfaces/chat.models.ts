export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: Date;
}

export interface ChatApiMessage {
  role: string;
  content: string;
  timestamp_utc: string;
}

export interface ChatAskRequest {
  session_id?: string;
  message: string;
}

export interface ChatResponseMetadata {
  session_id: string;
  user_message: string;
  answer: string;
  sentiment_score: number;
  priority_escalation: boolean;
  response_source: string;
  manual_mode?: boolean;
  context: ChatApiMessage[];
}

export interface ResetSessionResponse {
  session_id: string;
  cleared: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  priorityText?: string;
  warningText?: string;
  metadata?: ChatResponseMetadata;
}
