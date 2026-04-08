import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ChatComposerComponent } from './components/chat-composer/chat-composer.component';
import { ChatHeaderComponent } from './components/chat-header/chat-header.component';
import { ChatMessagesComponent } from './components/chat-messages/chat-messages.component';
import { ChatSidebarComponent } from './components/chat-sidebar/chat-sidebar.component';
import { ChatMessage, ChatSession } from './lib/interfaces/chat.models';
import { ChatService } from './lib/services/chat.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ChatSidebarComponent, ChatHeaderComponent, ChatMessagesComponent, ChatComposerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private chatService = inject(ChatService);

  sessions = signal<ChatSession[]>([
    {
      id: this.generateSessionId(),
      title: 'New Chat',
      messages: [],
      updatedAt: new Date(),
    },
  ]);

  activeSessionId = signal<string>(this.sessions()[0].id);
  isLoading = signal<boolean>(false);

  activeSession = computed(() => this.sessions().find((session) => session.id === this.activeSessionId()) || this.sessions()[0]);
  messages = computed(() => this.activeSession().messages);

  messageControl = new FormControl('', { nonNullable: true });

  createNewSession() {
    if (this.isLoading()) {
      return;
    }

    const newSession: ChatSession = {
      id: this.generateSessionId(),
      title: 'New Chat',
      messages: [],
      updatedAt: new Date(),
    };

    this.sessions.update((sessions) => [newSession, ...sessions]);
    this.activeSessionId.set(newSession.id);
    this.messageControl.setValue('');
  }

  setActiveSession(sessionId: string) {
    this.activeSessionId.set(sessionId);
  }

  sendMessage() {
    const text = this.messageControl.value.trim();
    if (!text || this.isLoading()) {
      return;
    }

    const currentSessionId = this.activeSessionId();

    const userMessage: ChatMessage = {
      id: this.generateId(),
      sender: 'user',
      text,
      timestamp: new Date(),
    };

    this.sessions.update((sessions) =>
      sessions.map((session) => {
        if (session.id === currentSessionId) {
          const isFirstMessage = session.messages.length === 0;
          return {
            ...session,
            messages: [...session.messages, userMessage],
            title: isFirstMessage ? (text.length > 25 ? `${text.substring(0, 25)}...` : text) : session.title,
            updatedAt: new Date(),
          };
        }
        return session;
      }),
    );

    this.messageControl.setValue('');
    this.isLoading.set(true);

    this.chatService.ask(text, currentSessionId).subscribe({
      next: (responseMetadata) => {
        const assistantMessage: ChatMessage = {
          id: this.generateId(),
          sender: 'assistant',
          text: responseMetadata.answer,
          timestamp: new Date(),
          metadata: responseMetadata,
        };

        this.sessions.update((sessions) =>
          sessions.map((session) => {
            if (session.id === currentSessionId) {
              return {
                ...session,
                messages: [...session.messages, assistantMessage],
                updatedAt: new Date(),
              };
            }
            return session;
          }),
        );
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  clearCurrentSession() {
    if (this.isLoading()) {
      return;
    }

    const currentId = this.activeSessionId();

    this.chatService.resetSession(currentId).subscribe(() => {
      this.sessions.update((sessions) => {
        const filtered = sessions.filter((session) => session.id !== currentId);

        if (filtered.length === 0) {
          const newSession: ChatSession = {
            id: this.generateSessionId(),
            title: 'New Chat',
            messages: [],
            updatedAt: new Date(),
          };
          this.activeSessionId.set(newSession.id);
          return [newSession];
        }

        this.activeSessionId.set(filtered[0].id);
        return filtered;
      });
      this.messageControl.setValue('');
    });
  }

  private generateSessionId(): string {
    return `sess_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateId(): string {
    return `${Date.now().toString()}${Math.random().toString(36).substring(2, 5)}`;
  }
}
