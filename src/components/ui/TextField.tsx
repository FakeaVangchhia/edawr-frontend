'use client';

import { cn } from '@/lib/utils';

/**
 * One labelled text input, used by checkout, sign-in, sign-up, the address
 * book and the account page.
 *
 * `id` is required rather than optional because three things depend on it: the
 * label's `for`, `aria-describedby` pointing at the error or hint, and any
 * "jump to the first invalid field" logic, which finds the input by id. It is
 * also the `name`, so the browser and the password manager have something
 * stable to hang a saved autofill entry on — on a sign-in form that is the
 * difference between one tap and typing a password on a phone.
 *
 * The error is wired with `aria-describedby` and `role="alert"`. `aria-invalid`
 * alone tells a screen reader *that* the field is wrong and never *what* is
 * wrong with it. Whichever note is rendered — error first, else hint — is the
 * one the input points at.
 */
export function TextField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
  error,
  inputMode,
  autoComplete,
  disabled,
  onEnter,
  surface = 'surface',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'tel' | 'password';
  placeholder?: string;
  hint?: string;
  error?: string;
  inputMode?: 'tel' | 'text';
  autoComplete?: string;
  disabled?: boolean;
  /**
   * What Enter does instead of submitting the form.
   *
   * Inside a `<form>` every input gets implicit submission, which is right for
   * the required fields — Enter after typing your address means "I am done".
   * It is wrong for an optional free-text box where Enter is a habitual
   * keystroke rather than an instruction; there it would place a cash order
   * outright. Pass a handler that moves on instead.
   */
  onEnter?: () => void;
  /** The input's background: the page's surface tint, or plain background. */
  surface?: 'surface' | 'background';
}) {
  const noteId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="block">
      <label
        htmlFor={id}
        className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={noteId}
        onKeyDown={
          onEnter
            ? (event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                onEnter();
              }
            : undefined
        }
        className={cn(
          'mt-2 h-12 w-full rounded-2xl border px-4 text-sm outline-none transition-colors',
          surface === 'surface' ? 'bg-surface' : 'bg-background',
          'disabled:cursor-not-allowed disabled:opacity-60',
          error ? 'border-destructive' : 'border-border focus:border-primary/25',
        )}
      />
      {error ? (
        <span id={noteId} role="alert" className="mt-1.5 block text-xs text-destructive">
          {error}
        </span>
      ) : hint ? (
        <span id={noteId} className="mt-1.5 block text-xs text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
