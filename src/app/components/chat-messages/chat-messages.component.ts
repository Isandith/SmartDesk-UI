import { CommonModule, DatePipe } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { ChatMessage } from '../../lib/interfaces/chat.models';

@Component({
  selector: 'app-chat-messages',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './chat-messages.component.html',
})
export class ChatMessagesComponent implements AfterViewChecked {
  private static readonly defaultPriorityMessage = "Priority Support: We're sorry you're facing this issue. A human support specialist is now reviewing your case.";

  @Input() messages: ChatMessage[] = [];
  @Input() isLoading = false;

  @ViewChild('chatContainer') private chatContainer!: ElementRef<HTMLElement>;

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  hasSentiment(message: ChatMessage): boolean {
    return typeof message.metadata?.sentiment_score === 'number' && Number.isFinite(message.metadata.sentiment_score);
  }

  hasAssistantMetadata(message: ChatMessage): boolean {
    return message.sender === 'assistant' && !!message.metadata;
  }

  hasResponseSource(message: ChatMessage): boolean {
    return typeof message.metadata?.response_source === 'string' && message.metadata.response_source.trim().length > 0;
  }

  getResponseSourceLabel(message: ChatMessage): string {
    return message.metadata?.response_source?.trim().toLowerCase() ?? 'unknown';
  }

  getEscalationStatus(message: ChatMessage): string {
    return message.metadata?.priority_escalation ? 'true' : 'false';
  }

  getPriorityHeading(message: ChatMessage): string {
    const lines = this.getPriorityLines(message);
    return lines[0] ?? 'Priority Support';
  }

  getPriorityDetails(message: ChatMessage): string[] {
    const lines = this.getPriorityLines(message);
    return lines.slice(1);
  }

  private getPriorityLines(message: ChatMessage): string[] {
    const rawMessage = (message.priorityText || ChatMessagesComponent.defaultPriorityMessage).replace(/^[\u26A0\u2757\u2139\u2705\uD83D\uDEA8\s]+/, '').trim();
    const lines = rawMessage
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return ['Priority Support'];
    }

    return lines;
  }

  getSentimentClass(score: number): string {
    if (score >= 0.35) {
      return 'sentiment-positive';
    }

    if (score <= -0.35) {
      return 'sentiment-negative';
    }

    return 'sentiment-neutral';
  }

  private scrollToBottom(): void {
    try {
      const element = this.chatContainer.nativeElement;
      if (element.scrollHeight > element.clientHeight) {
        element.scrollTop = element.scrollHeight;
      }
    } catch {
      // Ignore scroll failures when the view is not ready.
    }
  }
}
