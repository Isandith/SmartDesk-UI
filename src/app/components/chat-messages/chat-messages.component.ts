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
  @Input() messages: ChatMessage[] = [];
  @Input() isLoading = false;

  @ViewChild('chatContainer') private chatContainer!: ElementRef<HTMLElement>;

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  hasSentiment(message: ChatMessage): boolean {
    return typeof message.metadata?.sentiment_score === 'number' && Number.isFinite(message.metadata.sentiment_score);
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
