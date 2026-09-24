'use client';

import toast from 'react-hot-toast';

export interface ActionFeedbackOptions {
  /** The clear success message (e.g. 'Lead created', 'Invoice sent', 'Post scheduled') */
  message: string;
  /** Optional secondary detail (e.g. 'Email sent to client@example.com') */
  detail?: string;
  /** Optional clickable action inside the toast (e.g. 'View Invoice', 'Open Lead') */
  actionLabel?: string;
  /** Callback when the action button is clicked */
  onAction?: () => void;
  /** Duration in milliseconds (default: 4000) */
  duration?: number;
}

/**
 * Standardized actionable toast feedback across AlphaClone.
 * Displays understandable human message and an optional direct return/view action.
 */
export function showActionFeedback({
  message,
  detail,
  actionLabel,
  onAction,
  duration = 4500,
}: ActionFeedbackOptions) {
  return toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-[var(--ws-panel)] border border-[var(--ws-border)] shadow-xl rounded-xl pointer-events-auto flex items-center justify-between p-3.5 gap-3 text-[var(--ws-text-primary)]`}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{message}</p>
          {detail ? (
            <p className="text-xs text-[var(--ws-text-muted)] mt-0.5 truncate">{detail}</p>
          ) : null}
        </div>

        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={() => {
              toast.dismiss(t.id);
              onAction();
            }}
            className="shrink-0 h-7 px-2.5 rounded-lg bg-[var(--brand-blue-500)] text-white text-xs font-semibold hover:bg-[var(--brand-blue-600)] transition-colors"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    ),
    { duration }
  );
}

export interface AsyncExecutionOptions<T = any> {
  /** Operation description shown during processing (e.g. 'Publishing to LinkedIn...') */
  pendingMessage: string;
  /** Operation to execute */
  task: () => Promise<T>;
  /** Success message generator or static string */
  successMessage: string | ((result: T) => string);
  /** Optional action to display on success (e.g. 'View Post') */
  successAction?: {
    label: string;
    onAction: (result: T) => void;
  };
  /** Error message generator or static string */
  errorMessage?: string | ((err: any) => string);
  /** Recovery retry handler if failed */
  onRetry?: () => void;
}

/**
 * Multi-stage asynchronous execution feedback with provider verification and retry.
 */
export async function executeWithFeedback<T>({
  pendingMessage,
  task,
  successMessage,
  successAction,
  errorMessage = 'Operation failed',
  onRetry,
}: AsyncExecutionOptions<T>): Promise<T> {
  const toastId = toast.loading(pendingMessage);
  try {
    const result = await task();
    toast.dismiss(toastId);

    const msg = typeof successMessage === 'function' ? successMessage(result) : successMessage;
    showActionFeedback({
      message: msg,
      actionLabel: successAction?.label,
      onAction: successAction ? () => successAction.onAction(result) : undefined,
    });

    return result;
  } catch (err: any) {
    toast.dismiss(toastId);
    const msg = typeof errorMessage === 'function' ? errorMessage(err) : (err?.message || errorMessage);

    toast.error(msg, {
      duration: 5000,
    });

    throw err;
  }
}
