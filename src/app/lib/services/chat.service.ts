import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ChatAskRequest, ChatResponseMetadata, ResetSessionResponse } from '../interfaces/chat.models';

@Injectable({ providedIn: 'root' })
/**
 * <summary>
 * Wraps HTTP calls for chat ask and session reset operations.
 * </summary>
 */
export class ChatService {
  private readonly baseUrls = this.getBaseUrls();

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

    return this.postWithFallback<ChatResponseMetadata>('/api/chat/ask', payload);
  }

  /**
   * <summary>
   * Requests server-side reset for a specific chat session.
   * </summary>
   * <param name="sessionId">Session identifier to clear.</param>
   * <returns>Observable indicating reset success state.</returns>
   */
  resetSession(sessionId: string): Observable<ResetSessionResponse> {
    return this.postWithFallback<ResetSessionResponse>(`/api/chat/reset/${encodeURIComponent(sessionId)}`, {});
  }

  private postWithFallback<T>(path: string, body: unknown): Observable<T> {
    const [primaryUrl, fallbackUrl] = this.baseUrls;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    const primaryRequest = this.http.post<T>(`${primaryUrl}${normalizedPath}`, body);

    if (!fallbackUrl) {
      return primaryRequest;
    }

    return primaryRequest.pipe(
      catchError(() => this.http.post<T>(`${fallbackUrl}${normalizedPath}`, body))
    );
  }

  private getBaseUrls(): [string, string?] {
    const fallbackCandidate = (environment as { apiFallbackBaseUrl?: string }).apiFallbackBaseUrl;
    const fallbackUrl = fallbackCandidate && fallbackCandidate !== environment.apiBaseUrl ? fallbackCandidate : undefined;

    return [environment.apiBaseUrl, fallbackUrl];
  }
}
