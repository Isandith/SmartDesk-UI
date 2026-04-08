import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';

@Component({
  selector: 'app-chat-composer',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './chat-composer.component.html',
})
export class ChatComposerComponent {
  @Input({ required: true }) messageControl!: FormControl<string>;
  @Input() isLoading = false;
  @Input() sessionId = '';

  @Output() sendMessage = new EventEmitter<void>();

  handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage.emit();
    }
  }
}
