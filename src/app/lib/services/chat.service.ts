import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChatAskRequest, ChatResponseMetadata, ResetSessionResponse } from '../interfaces/chat.models';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  ask(message: string, sessionId: string): Observable<ChatResponseMetadata> {
    const payload: ChatAskRequest = {
      session_id: sessionId,
      message,
    };

    return this.http.post<ChatResponseMetadata>(`${this.baseUrl}/api/chat/ask`, payload);
  }

  resetSession(sessionId: string): Observable<ResetSessionResponse> {
    return this.http.post<ResetSessionResponse>(`${this.baseUrl}/api/chat/reset/${encodeURIComponent(sessionId)}`, {});
  }
}
