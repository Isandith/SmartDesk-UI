import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
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
  private static readonly MarkerDelimiter = '!$!@$!$!';
  private static readonly WarningToken = '[WARNING]';
  private static readonly PriorityToken = '[PRIORITY]';
  private static readonly ContentToken = '[CONTENT]';
  private static readonly BreakToken = '[BREAK]';
  private static readonly PopupSymbols = ['ℹ️', '⚠️', '🚨', '❗', '✅'];
  private static readonly STORAGE_KEY = 'smartdesk_sessions';

  private chatService = inject(ChatService);

  sessions = signal<ChatSession[]>(this.loadSessionsFromStorage());

  activeSessionId = signal<string>(this.sessions()[0].id);
  isLoading = signal<boolean>(false);

  activeSession = computed(() => this.sessions().find((session) => session.id === this.activeSessionId()) || this.sessions()[0]);
  messages = computed(() => this.activeSession().messages);

  messageControl = new FormControl('', { nonNullable: true });
  warningToast = signal<string | null>(null);
  private warningToastTimer: ReturnType<typeof setTimeout> | null = null;
  private hasShownStatusPopup = false;
  private hasShownManualModeWarning = false;

  constructor() {
    // Auto-save sessions to localStorage whenever they change
    effect(() => {
      this.saveSessionsToStorage(this.sessions());
    });
  }

  createNewSession() {
    if (this.isLoading()) {
      return;
    }

    const existingEmptySession = this.sessions().find((session) => session.messages.length === 0);

    if (existingEmptySession) {
      this.activeSessionId.set(existingEmptySession.id);
      this.messageControl.setValue('');
      this.hasShownStatusPopup = false;
      this.hasShownManualModeWarning = false;
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
    this.hasShownStatusPopup = false;
    this.hasShownManualModeWarning = false;
    this.messageControl.setValue('');
  }

  setActiveSession(sessionId: string) {
    const currentSessionId = this.activeSessionId();
    const currentSession = this.sessions().find((session) => session.id === currentSessionId);

    if (currentSession && currentSession.id !== sessionId && currentSession.messages.length === 0) {
      this.sessions.update((sessions) => sessions.filter((session) => session.id !== currentSession.id));
    }

    this.activeSessionId.set(sessionId);
    this.hasShownStatusPopup = false;
    this.hasShownManualModeWarning = false;
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
        const parsed = this.parseResponseAnswer(responseMetadata.answer);

        const assistantWarning =
          parsed.warning || (responseMetadata.manual_mode && parsed.removedQuotaNotice && !this.hasShownManualModeWarning ? 'Switched to manual mode.' : '');

        if (assistantWarning === 'Switched to manual mode.') {
          this.hasShownManualModeWarning = true;
        }

        const assistantMessage: ChatMessage = {
          id: this.generateId(),
          sender: 'assistant',
          text: parsed.content,
          timestamp: new Date(),
          priorityText: parsed.priority,
          warningText: assistantWarning,
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

        this.showStatusPopupOnce(parsed.popupNotice);

        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.isLoading.set(false);

        if (this.isBackendDownError(error)) {
          this.showWarningToast('Support service is temporarily unavailable. Please try again in a moment.');
          return;
        }

        this.showWarningToast('Something went wrong while sending your message. Please try again.');
      },
    });
  }

  resetCurrentSession() {
    if (this.isLoading()) {
      return;
    }

    const currentId = this.activeSessionId();

    this.chatService.resetSession(currentId).subscribe({
      next: () => {
        this.sessions.update((sessions) =>
          sessions.map((session) => {
            if (session.id === currentId) {
              return {
                ...session,
                title: 'New Chat',
                messages: [],
                updatedAt: new Date(),
              };
            }

            return session;
          }),
        );

        this.messageControl.setValue('');
      },
      error: (error: unknown) => {
        if (this.isBackendDownError(error)) {
          this.showWarningToast('Support service is temporarily unavailable. Reset was not synced yet.');
          return;
        }

        this.showWarningToast('Could not reset this chat right now. Please try again.');
      },
    });
  }

  deleteSession(sessionId: string) {
    if (this.isLoading()) {
      return;
    }

    this.chatService.resetSession(sessionId).subscribe({
      next: () => {
        this.removeSessionFromUi(sessionId);
      },
      error: (error: unknown) => {
        if (this.isBackendDownError(error)) {
          this.showWarningToast('Support service is temporarily unavailable. Chat was removed locally only.');
        }
        this.removeSessionFromUi(sessionId);
      },
    });
  }

  private removeSessionFromUi(sessionId: string) {
    const remainingSessions = this.sessions().filter((session) => session.id !== sessionId);

    if (remainingSessions.length === 0) {
      const replacementSession: ChatSession = {
        id: this.generateSessionId(),
        title: 'New Chat',
        messages: [],
        updatedAt: new Date(),
      };

      this.sessions.set([replacementSession]);
      this.activeSessionId.set(replacementSession.id);
      this.messageControl.setValue('');
      this.hasShownStatusPopup = false;
      this.hasShownManualModeWarning = false;
      return;
    }

    this.sessions.set(remainingSessions);

    if (this.activeSessionId() === sessionId) {
      this.activeSessionId.set(remainingSessions[0].id);
      this.messageControl.setValue('');
      this.hasShownStatusPopup = false;
      this.hasShownManualModeWarning = false;
    }
  }

  private generateSessionId(): string {
    return `sess_${Math.random().toString(36).substring(2, 9)}`;
  }

  private parseResponseAnswer(answer: string): {
    content: string;
    priority: string;
    warning: string;
    popupNotice: string;
    removedQuotaNotice: boolean;
  } {
    const normalizeBreaks = (value: string) => value.replaceAll(AppComponent.BreakToken, '\n\n').trim();
    const normalizedAnswer = answer ?? '';

    if (!normalizedAnswer.includes(AppComponent.MarkerDelimiter)) {
      return {
        content: normalizeBreaks(normalizedAnswer),
        priority: '',
        warning: '',
        popupNotice: '',
        removedQuotaNotice: false,
      };
    }

    const segments = normalizedAnswer
      .split(AppComponent.MarkerDelimiter)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    const contentParts: string[] = [];
    const priorityParts: string[] = [];
    const warningParts: string[] = [];

    for (const segment of segments) {
      if (segment.startsWith(AppComponent.WarningToken)) {
        warningParts.push(normalizeBreaks(segment.substring(AppComponent.WarningToken.length)));
        continue;
      }

      if (segment.startsWith(AppComponent.PriorityToken)) {
        priorityParts.push(normalizeBreaks(segment.substring(AppComponent.PriorityToken.length)));
        continue;
      }

      if (segment.startsWith(AppComponent.ContentToken)) {
        contentParts.push(normalizeBreaks(segment.substring(AppComponent.ContentToken.length)));
        continue;
      }

      contentParts.push(normalizeBreaks(segment));
    }

    const content = contentParts.filter(Boolean).join('\n\n').trim();
    const priority = priorityParts.filter(Boolean).join('\n\n').trim();
    const warning = warningParts.filter(Boolean).join('\n\n').trim();

    const contentNotice = this.extractQuotaPopupNotice(content);
    const warningQuotaNotice = this.extractQuotaPopupNotice(warning);
    const warningSymbolNotice = this.extractPopupNotice(warningQuotaNotice.cleaned);

    // Strip "Switched to manual mode." from content if already shown once
    let cleanedContent = contentNotice.cleaned;
    if (this.hasShownManualModeWarning) {
      cleanedContent = cleanedContent
        .split('\n')
        .filter(line => !line.trim().startsWith('Switched to manual mode.'))
        .join('\n')
        .trim();
    }

    return {
      content: cleanedContent,
      priority,
      warning: warningQuotaNotice.cleaned,
      popupNotice: contentNotice.notice || warningQuotaNotice.notice || warningSymbolNotice.notice,
      removedQuotaNotice: contentNotice.removed || warningQuotaNotice.removed,
    };
  }

  private extractQuotaPopupNotice(value: string): { cleaned: string; notice: string; removed: boolean } {
    if (!value) {
      return { cleaned: value, notice: '', removed: false };
    }

    const lines = value.split('\n');
    const keptLines: string[] = [];
    let notice = '';
    let removed = false;

    for (const line of lines) {
      const trimmed = line.trim();
      const isSymbolNotice = AppComponent.PopupSymbols.some((symbol) => trimmed.startsWith(symbol));
      const isQuotaNotice = /gemini|quota|rate\s*limit/i.test(trimmed);

      if (isSymbolNotice && isQuotaNotice) {
        removed = true;
        if (!notice) {
          notice = trimmed;
        }
        continue;
      }

      keptLines.push(line);
    }

    return {
      cleaned: keptLines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
      notice,
      removed,
    };
  }

  private extractPopupNotice(value: string): { cleaned: string; notice: string } {
    if (!value) {
      return { cleaned: value, notice: '' };
    }

    const noticeLine = value
      .split('\n')
      .map((line) => line.trim())
      .find((line) => AppComponent.PopupSymbols.some((symbol) => line.startsWith(symbol)));

    return {
      cleaned: value,
      notice: noticeLine ?? '',
    };
  }

  private showStatusPopupOnce(message: string): void {
    if (!message || this.hasShownStatusPopup) {
      return;
    }

    this.hasShownStatusPopup = true;
    this.showWarningToast(message);
  }

  dismissWarningToast() {
    this.warningToast.set(null);
  }

  private showWarningToast(message: string) {
    this.warningToast.set(message);

    if (this.warningToastTimer !== null) {
      clearTimeout(this.warningToastTimer);
    }

    this.warningToastTimer = setTimeout(() => {
      this.warningToast.set(null);
      this.warningToastTimer = null;
    }, 5000);
  }

  private isBackendDownError(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) {
      return false;
    }

    return error.status === 0 || error.status >= 500;
  }

  private loadSessionsFromStorage(): ChatSession[] {
    try {
      const stored = localStorage.getItem(AppComponent.STORAGE_KEY);
      if (stored) {
        const sessions = JSON.parse(stored) as ChatSession[];
        // Convert date strings back to Date objects
        sessions.forEach((session) => {
          session.updatedAt = new Date(session.updatedAt);
          session.messages.forEach((msg) => {
            msg.timestamp = new Date(msg.timestamp);
          });
        });
        return sessions;
      }
    } catch (error) {
      console.error('Failed to load sessions from localStorage:', error);
    }

    // Return default session if nothing is stored
    return [
      {
        id: this.generateSessionId(),
        title: 'New Chat',
        messages: [],
        updatedAt: new Date(),
      },
    ];
  }

  private saveSessionsToStorage(sessions: ChatSession[]): void {
    try {
      localStorage.setItem(AppComponent.STORAGE_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('Failed to save sessions to localStorage:', error);
    }
  }

  private generateId(): string {
    return `${Date.now().toString()}${Math.random().toString(36).substring(2, 5)}`;
  }
}
