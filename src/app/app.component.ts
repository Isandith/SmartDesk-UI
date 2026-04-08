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
/**
 * <summary>
 * Coordinates chat sessions, message flow, persistence, and UI warnings.
 * </summary>
 */
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

  /**
   * <summary>
   * Initializes autosave behavior for session state persistence.
   * </summary>
   */
  constructor() {
    // Auto-save sessions to localStorage whenever they change
    effect(() => {
      this.saveSessionsToStorage(this.sessions());
    });
  }

  /**
   * <summary>
   * Creates a new empty session or reuses an existing empty one.
   * </summary>
   */
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

  /**
   * <summary>
   * Switches the active session and prunes an abandoned empty session.
   * </summary>
   * <param name="sessionId">Identifier of the session to activate.</param>
   */
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

  /**
   * <summary>
   * Sends the current user message and appends the assistant response.
   * </summary>
   */
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

  /**
   * <summary>
   * Clears the active session on both backend and UI.
   * </summary>
   */
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

  /**
   * <summary>
   * Deletes a session and removes it locally even if backend cleanup fails.
   * </summary>
   * <param name="sessionId">Identifier of the session to delete.</param>
   */
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

  /**
   * <summary>
   * Removes a session from local state and ensures a valid active session exists.
   * </summary>
   * <param name="sessionId">Identifier of the session to remove from UI.</param>
   */
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

  /**
   * <summary>
   * Generates a client session identifier.
   * </summary>
   * <returns>New pseudo-random session id.</returns>
   */
  private generateSessionId(): string {
    return `sess_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * <summary>
   * Parses a backend answer payload into content, warning, priority, and popup fields.
   * </summary>
   * <param name="answer">Raw backend answer string.</param>
   * <returns>Parsed message segments and quota-notice metadata.</returns>
   */
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

  /**
   * <summary>
   * Extracts symbol-based quota notices and returns cleaned text.
   * </summary>
   * <param name="value">Text to inspect.</param>
   * <returns>Cleaned text, extracted notice, and removal flag.</returns>
   */
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

  /**
   * <summary>
   * Finds the first symbol-prefixed notice line in a message block.
   * </summary>
   * <param name="value">Text to inspect.</param>
   * <returns>Original text plus an optional extracted notice.</returns>
   */
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

  /**
   * <summary>
   * Shows a warning popup only once for the current flow.
   * </summary>
   * <param name="message">Warning message to display.</param>
   */
  private showStatusPopupOnce(message: string): void {
    if (!message || this.hasShownStatusPopup) {
      return;
    }

    this.hasShownStatusPopup = true;
    this.showWarningToast(message);
  }

  /**
   * <summary>
   * Hides the warning toast.
   * </summary>
   */
  dismissWarningToast() {
    this.warningToast.set(null);
  }

  /**
   * <summary>
   * Displays a warning toast with automatic timeout cleanup.
   * </summary>
   * <param name="message">Toast text to display.</param>
   */
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

  /**
   * <summary>
   * Detects transport or server failures from HTTP errors.
   * </summary>
   * <param name="error">Candidate error value from request handlers.</param>
   * <returns>True when the backend appears unavailable.</returns>
   */
  private isBackendDownError(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) {
      return false;
    }

    return error.status === 0 || error.status >= 500;
  }

  /**
   * <summary>
   * Loads sessions from local storage and rehydrates date fields.
   * </summary>
   * <returns>Stored sessions or a default starter session.</returns>
   */
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

  /**
   * <summary>
   * Persists current sessions to local storage.
   * </summary>
   * <param name="sessions">Session list to persist.</param>
   */
  private saveSessionsToStorage(sessions: ChatSession[]): void {
    try {
      localStorage.setItem(AppComponent.STORAGE_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('Failed to save sessions to localStorage:', error);
    }
  }

  /**
   * <summary>
   * Generates a unique message identifier.
   * </summary>
   * <returns>Combined timestamp and random suffix identifier.</returns>
   */
  private generateId(): string {
    return `${Date.now().toString()}${Math.random().toString(36).substring(2, 5)}`;
  }
}
