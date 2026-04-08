import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-chat-header',
  standalone: true,
  templateUrl: './chat-header.component.html',
})
/**
 * <summary>
 * Renders the chat title and emits requests to reset the current conversation.
 * </summary>
 */
export class ChatHeaderComponent {
  @Input() title = '';

  @Output() resetSessionRequested = new EventEmitter<void>();
}
