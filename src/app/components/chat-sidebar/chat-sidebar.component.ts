import { CommonModule, DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ChatSession } from '../../lib/interfaces/chat.models';

@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './chat-sidebar.component.html',
})
export class ChatSidebarComponent {
  @Input() sessions: ChatSession[] = [];
  @Input() activeSessionId = '';

  @Output() sessionSelected = new EventEmitter<string>();
  @Output() createSession = new EventEmitter<void>();
  @Output() deleteSession = new EventEmitter<string>();

  onDeleteSession(event: MouseEvent, sessionId: string) {
    event.stopPropagation();
    this.deleteSession.emit(sessionId);
  }
}
