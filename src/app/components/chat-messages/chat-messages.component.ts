import { CommonModule, DatePipe } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { ChatMessage } from '../../lib/interfaces/chat.models';

@Component({
  selector: 'app-chat-messages',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './chat-messages.component.html',
})
/**
 * <summary>
 * Displays conversation messages and helper metadata for sentiment, source, and priority status.
 * </summary>
 */
export class ChatMessagesComponent implements AfterViewChecked {
  @Input() messages: ChatMessage[] = [];
  @Input() isLoading = false;

  @ViewChild('chatContainer') private chatContainer!: ElementRef<HTMLElement>;

  /**
   * <summary>
   * Keeps the message list pinned to the latest message after each view check.
   * </summary>
   */
  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  /**
   * <summary>
   * Indicates whether a message includes a finite sentiment score.
   * </summary>
   * <param name="message">Message being inspected.</param>
   * <returns>True when a valid numeric sentiment score exists.</returns>
   */
  hasSentiment(message: ChatMessage): boolean {
    return typeof message.metadata?.sentiment_score === 'number' && Number.isFinite(message.metadata.sentiment_score);
  }

  /**
   * <summary>
   * Indicates whether a response source label is present.
   * </summary>
   * <param name="message">Message being inspected.</param>
   * <returns>True when a non-empty response source is available.</returns>
   */
  hasResponseSource(message: ChatMessage): boolean {
    return typeof message.metadata?.response_source === 'string' && message.metadata.response_source.trim().length > 0;
  }

  /**
   * <summary>
   * Returns a normalized response source label for display.
   * </summary>
   * <param name="message">Message being inspected.</param>
   * <returns>Lower-cased source label or unknown.</returns>
   */
  getResponseSourceLabel(message: ChatMessage): string {
    return message.metadata?.response_source?.trim().toLowerCase() ?? 'unknown';
  }

  /**
   * <summary>
   * Indicates whether a manual mode status chip should be shown.
   * </summary>
   * <param name="message">Message being inspected.</param>
   * <returns>True when the backend reports manual mode.</returns>
   */
  hasManualMode(message: ChatMessage): boolean {
    return message.sender === 'assistant' && message.metadata?.manual_mode === true;
  }

  /**
   * <summary>
   * Indicates whether a system status message should be shown.
   * </summary>
   * <param name="message">Message being inspected.</param>
   * <returns>True when the backend returns a status message.</returns>
   */
  hasSystemStatusMessage(message: ChatMessage): boolean {
    return message.sender === 'assistant' && typeof message.metadata?.system_status_message === 'string' && message.metadata.system_status_message.trim().length > 0;
  }

  /**
   * <summary>
   * Converts the priority escalation flag to a user-facing label.
   * </summary>
   * <param name="message">Message being inspected.</param>
   * <returns>Escalated or standard.</returns>
   */
  getEscalationLabel(message: ChatMessage): string {
    return message.metadata?.priority_escalation ? 'Escalated' : 'Standard';
  }

  /**
   * <summary>
   * Maps sentiment score to the matching CSS class.
   * </summary>
   * <param name="score">Sentiment score provided by the backend.</param>
   * <returns>Class name used by the sentiment badge.</returns>
   */
  getSentimentClass(score: number): string {
    if (score >= 0.35) {
      return 'sentiment-positive';
    }

    if (score <= -0.35) {
      return 'sentiment-negative';
    }

    return 'sentiment-neutral';
  }

  /**
   * <summary>
   * Scrolls the chat container to the latest message when overflow exists.
   * </summary>
   */
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
