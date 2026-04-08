import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-chat-header',
  standalone: true,
  templateUrl: './chat-header.component.html',
})
export class ChatHeaderComponent {
  @Input() title = '';

  @Output() deleteChat = new EventEmitter<void>();
}
