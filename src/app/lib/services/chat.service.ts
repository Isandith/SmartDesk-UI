import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChatAskRequest, ChatResponseMetadata, ResetSessionResponse } from '../interfaces/chat.models';

@Injectable({ providedIn: 'root' })
/**
 * <summary>
 * Wraps HTTP calls for chat ask and session reset operations.
 * </summary>
 */
export class ChatService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  /**
   * <summary>
   * Sends a user message to the backend and returns response metadata.
   * </summary>
   * <param name="message">User text to submit.</param>
   * <param name="sessionId">Current session identifier.</param>
   * <returns>Observable with assistant response metadata.</returns>
   */
  ask(message: string, sessionId: string): Observable<ChatResponseMetadata> {
    const payload: ChatAskRequest = {
      session_id: sessionId,
      message,
    };

    return this.http.post<ChatResponseMetadata>(`${this.baseUrl}/api/chat/ask`, payload);
  }

  /**
   * <summary>
   * Requests server-side reset for a specific chat session.
   * </summary>
   * <param name="sessionId">Session identifier to clear.</param>
   * <returns>Observable indicating reset success state.</returns>
   */
  resetSession(sessionId: string): Observable<ResetSessionResponse> {
    return this.http.post<ResetSessionResponse>(`${this.baseUrl}/api/chat/reset/${encodeURIComponent(sessionId)}`, {});
  }
}
