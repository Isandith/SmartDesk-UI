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
  private static readonly defaultPriorityMessage = "Priority Support: We're sorry you're facing this issue. A human support specialist is now reviewing your case.";

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
   * Indicates whether assistant metadata is available for a message.
   * </summary>
   * <param name="message">Message being inspected.</param>
   * <returns>True when metadata exists on an assistant response.</returns>
   */
  hasAssistantMetadata(message: ChatMessage): boolean {
    return message.sender === 'assistant' && !!message.metadata;
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
   * Converts the priority escalation flag to a string representation.
   * </summary>
   * <param name="message">Message being inspected.</param>
   * <returns>True or false as a string.</returns>
   */
  getEscalationStatus(message: ChatMessage): string {
    return message.metadata?.priority_escalation ? 'true' : 'false';
  }

  /**
   * <summary>
   * Resolves the headline line for priority notices.
   * </summary>
   * <param name="message">Message being inspected.</param>
   * <returns>Priority heading text.</returns>
   */
  getPriorityHeading(message: ChatMessage): string {
    const lines = this.getPriorityLines(message);
    return lines[0] ?? 'Priority Support';
  }

  /**
   * <summary>
   * Resolves the body lines for priority notices.
   * </summary>
   * <param name="message">Message being inspected.</param>
   * <returns>Priority detail lines without the heading.</returns>
   */
  getPriorityDetails(message: ChatMessage): string[] {
    const lines = this.getPriorityLines(message);
    return lines.slice(1);
  }

  /**
   * <summary>
   * Parses and normalizes priority message content into display lines.
   * </summary>
   * <param name="message">Message being inspected.</param>
   * <returns>Array of non-empty lines, defaulting to a fallback heading.</returns>
   */
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
