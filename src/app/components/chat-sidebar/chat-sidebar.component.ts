import { CommonModule, DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ChatSession } from '../../lib/interfaces/chat.models';

@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './chat-sidebar.component.html',
})
/**
 * <summary>
 * Displays saved chat sessions and emits user actions for session management.
 * </summary>
 */
export class ChatSidebarComponent {
  @Input() sessions: ChatSession[] = [];
  @Input() activeSessionId = '';

  @Output() sessionSelected = new EventEmitter<string>();
  @Output() createSession = new EventEmitter<void>();
  @Output() deleteSession = new EventEmitter<string>();

  /**
   * <summary>
   * Stops list-item selection when deleting a session from the sidebar.
   * </summary>
   * <param name="event">Click event fired by the delete action.</param>
   * <param name="sessionId">Identifier of the session to remove.</param>
   */
  onDeleteSession(event: MouseEvent, sessionId: string) {
    event.stopPropagation();
    this.deleteSession.emit(sessionId);
  }
}
