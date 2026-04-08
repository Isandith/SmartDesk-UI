import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';

@Component({
  selector: 'app-chat-composer',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './chat-composer.component.html',
})
/**
 * <summary>
 * Presents the message input and emits send actions for the active chat session.
 * </summary>
 */
export class ChatComposerComponent {
  @Input({ required: true }) messageControl!: FormControl<string>;
  @Input() isLoading = false;
  @Input() sessionId = '';

  @Output() sendMessage = new EventEmitter<void>();

  /**
   * <summary>
   * Sends the message on Enter while allowing Shift+Enter for multiline input.
   * </summary>
   * <param name="event">Keyboard event from the composer textarea.</param>
   */
  handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage.emit();
    }
  }
}
