/**
 * <summary>
 * Represents a client-side chat session shown in the sidebar.
 * </summary>
 */
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: Date;
}

/**
 * <summary>
 * Represents a backend context message returned for traceability.
 * </summary>
 */
export interface ChatApiMessage {
  role: string;
  content: string;
  timestamp_utc: string;
}

/**
 * <summary>
 * Request payload sent when asking a new question.
 * </summary>
 */
export interface ChatAskRequest {
  session_id?: string;
  message: string;
}

/**
 * <summary>
 * Metadata returned by the ask endpoint for rendering the assistant response.
 * </summary>
 */
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

/**
 * <summary>
 * Response payload returned after resetting a chat session.
 * </summary>
 */
export interface ResetSessionResponse {
  session_id: string;
  cleared: boolean;
}

/**
 * <summary>
 * Normalized message model used by the chat UI.
 * </summary>
 */
export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  priorityText?: string;
  warningText?: string;
  metadata?: ChatResponseMetadata;
}
