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
  private static readonly STORAGE_KEY = 'smartdesk_sessions';

  private chatService = inject(ChatService);

  sessions = signal<ChatSession[]>(this.loadSessionsFromStorage());

  activeSessionId = signal<string>(this.sessions()[0].id);
  isLoading = signal<boolean>(false);
  isSidebarOpen = signal<boolean>(false);

  activeSession = computed(() => this.sessions().find((session) => session.id === this.activeSessionId()) || this.sessions()[0]);
  messages = computed(() => this.activeSession().messages);

  messageControl = new FormControl('', { nonNullable: true });
  warningToast = signal<string | null>(null);
  private warningToastTimer: ReturnType<typeof setTimeout> | null = null;

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
      this.sessions.update((sessions) =>
        sessions.map((session) =>
          session.id === existingEmptySession.id
            ? {
                ...session,
                manualModeNoticeShown: false,
              }
            : session,
        ),
      );

      this.activeSessionId.set(existingEmptySession.id);
      this.messageControl.setValue('');
      this.closeSidebar();
      return;
    }

    const newSession: ChatSession = {
      id: this.generateSessionId(),
      title: 'New Chat',
      messages: [],
      updatedAt: new Date(),
      manualModeNoticeShown: false,
    };

    this.sessions.update((sessions) => [newSession, ...sessions]);
    this.activeSessionId.set(newSession.id);
    this.messageControl.setValue('');
    this.closeSidebar();
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
    this.closeSidebar();
  }

  /**
   * <summary>
   * Toggles the mobile session sidebar drawer.
   * </summary>
   */
  toggleSidebar() {
    this.isSidebarOpen.update((isOpen) => !isOpen);
  }

  /**
   * <summary>
   * Closes the mobile session sidebar drawer.
   * </summary>
   */
  closeSidebar() {
    this.isSidebarOpen.set(false);
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
        const resolvedSessionId = this.reconcileSessionId(currentSessionId, responseMetadata.session_id);
        const session = this.sessions().find((item) => item.id === resolvedSessionId);
        const manualModeMessage = responseMetadata.system_status_message?.trim() || 'Switched to manual mode.';
        const shouldShowManualModeNotice =
          responseMetadata.manual_mode === true &&
          !session?.manualModeNoticeShown;

        if (shouldShowManualModeNotice) {
          this.showWarningToast(manualModeMessage);
        }

        const assistantMetadata = {
          ...responseMetadata,
          system_status_message: responseMetadata.manual_mode === true ? undefined : responseMetadata.system_status_message,
        };

        const assistantMessage: ChatMessage = {
          id: this.generateId(),
          sender: 'assistant',
          text: responseMetadata.answer?.trim() ?? '',
          timestamp: new Date(),
          metadata: assistantMetadata,
        };

        this.sessions.update((sessions) =>
          sessions.map((session) => {
            if (session.id === resolvedSessionId) {
              return {
                ...session,
                messages: [...session.messages, assistantMessage],
                updatedAt: new Date(),
                manualModeNoticeShown: session.manualModeNoticeShown || shouldShowManualModeNotice,
              };
            }
            return session;
          }),
        );

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

    this.sessions.update((sessions) =>
      sessions.map((session) => {
        if (session.id === currentId) {
          return {
            ...session,
            title: 'New Chat',
            messages: [],
            updatedAt: new Date(),
            manualModeNoticeShown: false,
          };
        }

        return session;
      }),
    );

    this.messageControl.setValue('');

    this.chatService.resetSession(currentId).subscribe({
      next: (response) => {
        const resolvedSessionId = this.reconcileSessionId(currentId, response.session_id);

        this.sessions.update((sessions) =>
          sessions.map((session) =>
            session.id === resolvedSessionId
              ? {
                  ...session,
                  title: 'New Chat',
                  messages: [],
                  updatedAt: new Date(),
                  manualModeNoticeShown: false,
                }
              : session,
          ),
        );

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

    this.removeSessionFromUi(sessionId);
    this.closeSidebar();

    this.chatService.resetSession(sessionId).subscribe({
      next: () => {},
      error: (error: unknown) => {
        if (this.isBackendDownError(error)) {
          this.showWarningToast('Support service is temporarily unavailable. Chat was removed locally only.');
          return;
        }

        this.showWarningToast('Chat was removed locally, but backend cleanup failed.');
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
        manualModeNoticeShown: false,
      };

      this.sessions.set([replacementSession]);
      this.activeSessionId.set(replacementSession.id);
      this.messageControl.setValue('');
      return;
    }

    this.sessions.set(remainingSessions);

    if (this.activeSessionId() === sessionId) {
      this.activeSessionId.set(remainingSessions[0].id);
      this.messageControl.setValue('');
    }
  }

  /**
   * <summary>
   * Reconciles the local session id with the id returned by the backend.
   * </summary>
   * <param name="previousSessionId">Client-side session identifier before the response.</param>
   * <param name="nextSessionId">Session identifier returned by the backend.</param>
   * <returns>The resolved session identifier used in local state.</returns>
   */
  private reconcileSessionId(previousSessionId: string, nextSessionId?: string): string {
    const resolvedSessionId = nextSessionId?.trim() || previousSessionId;

    if (resolvedSessionId === previousSessionId) {
      return resolvedSessionId;
    }

    this.sessions.update((sessions) =>
      sessions.map((session) =>
        session.id === previousSessionId
          ? {
              ...session,
              id: resolvedSessionId,
            }
          : session,
      ),
    );

    if (this.activeSessionId() === previousSessionId) {
      this.activeSessionId.set(resolvedSessionId);
    }

    return resolvedSessionId;
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
