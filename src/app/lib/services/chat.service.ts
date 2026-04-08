import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { ChatResponseMetadata } from '../interfaces/chat.models';

@Injectable({ providedIn: 'root' })
export class ChatService {
  ask(message: string, sessionId: string): Observable<ChatResponseMetadata> {
    const isAngry = message.toLowerCase().match(/(angry|mad|terrible|bad|worst|hate|frustrated)/);
    const sentiment = isAngry ? 0.1 : 0.85;
    const escalation = !!isAngry;

    const response: ChatResponseMetadata = {
      session_id: sessionId,
      user_message: message,
      answer: this.getMockAnswer(message),
      sentiment_score: sentiment,
      priority_escalation: escalation,
      response_source: 'faq_knowledge_base',
      context: 'General support queries',
    };

    const mockDelay = Math.floor(Math.random() * 1500) + 1000;
    return of(response).pipe(delay(mockDelay));
  }

  resetSession(sessionId: string): Observable<{ success: boolean }> {
    return of({ success: true }).pipe(delay(500));
  }

  private getMockAnswer(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('password')) {
      return "To reset your password, click on the 'Forgot Password' link on the login page. An email with reset instructions will be sent to your registered address.";
    }

    if (lowerMessage.includes('refund')) {
      return 'Refunds can be processed within 30 days of purchase. Please visit our billing portal to initiate a refund request.';
    }

    if (lowerMessage.includes('shipping') || lowerMessage.includes('track')) {
      return 'You can track your order using the tracking link sent in your confirmation email, or by logging into your account and viewing your order history.';
    }

    if (lowerMessage.includes('human') || lowerMessage.match(/(angry|mad|terrible)/)) {
      return 'I apologize for the frustration you are experiencing. I am escalating this to a human support agent right away. Someone will be with you shortly.';
    }

    return 'Thank you for reaching out! This is a mock response from the SmartDesk AI. Please try asking about passwords, refunds, or shipping.';
  }
}
