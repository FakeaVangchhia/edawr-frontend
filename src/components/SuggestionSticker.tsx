'use client';

import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { submitSuggestion } from '@/lib/store-api';
import {
  forgetSuggestionSent,
  getSuggestionSentServerSnapshot,
  getSuggestionSentSnapshot,
  markSuggestionSent,
  subscribeToSuggestionSent,
} from '@/lib/suggestion-sent';
import { cn } from '@/lib/utils';

/** The question, verbatim. It is also what the console page is titled after. */
const QUESTION = 'What would you want delivered in 15 minutes?';

/** Matches `SuggestionCreateSerializer.text.max_length`. */
const MAX_LENGTH = 280;

/**
 * The poll sticker.
 *
 * A question, a box and a button — and it is a real question: the answer goes
 * to `POST /api/store/suggestions` and lands in the console, where the store
 * reads every one. A sticker that thanked the customer and threw the text away
 * would be the decoration-dressed-as-data this codebase keeps refusing to ship.
 *
 * **Red on purpose, and its own red.** The brief asked for it to stand out,
 * and everything else on this page is navy, white and amber. `--rose` is a
 * separate token rather than `destructive` so a question does not borrow the
 * colour that means "something failed" on the checkout page.
 *
 * The thanks state is remembered per device (`lib/suggestion-sent.ts`), so a
 * regular customer is asked once rather than daily. "Send another" is right
 * there for anyone with a second idea; the server's throttle is what stops a
 * script from having two hundred.
 */
export function SuggestionSticker() {
  const sent = useSyncExternalStore(
    subscribeToSuggestionSent,
    getSuggestionSentSnapshot,
    getSuggestionSentServerSnapshot,
  );
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError('');
    try {
      await submitSuggestion(trimmed);
      markSuggestionSent();
      setText('');
    } catch (caught) {
      // Inline, never a toast: a toast on an error path that a retry can hit
      // again is how a page ends up shouting. 429 is the one status worth
      // translating — it is the throttle, and the honest thing to say is "not
      // now" rather than "something went wrong".
      setError(
        caught instanceof ApiError && caught.status === 429
          ? 'That is plenty for now — try again in a little while.'
          : 'Could not send that. Check your connection and try again.',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="py-8" aria-labelledby="poll-heading">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-4xl border border-rose/25 bg-rose-soft p-6 sm:p-8 lg:p-10">
          {/* The sticker itself: a corner ribbon. A 160px band rotated 45°
              runs across the top-right corner and the card's overflow-hidden
              cuts both ends on the straight edges, the way a real ribbon is
              trimmed flush — so the band is deliberately wider than the card
              corner and deliberately bleeds past it. The band's centre sits
              40px in from each edge; that puts its inner face ~43px from the
              corner point, clear of the 44px radius curve (which only comes
              within ~18px of it), so the cut is a clean diagonal rather than
              an arc. The label is centred in the band, and the visible
              stretch (~113px) is longer than the word, so nothing is lost to
              the trim. */}
          <span
            aria-hidden
            className="absolute -right-10 top-[26px] w-40 rotate-45 bg-rose py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-rose-foreground sm:text-xs"
          >
            Poll
          </span>

          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-rose">
              <Sparkles className="size-3.5" aria-hidden />
              Tell us
            </p>
            <h2
              id="poll-heading"
              className="mt-2 text-[24px] font-semibold leading-[1.15] sm:text-[30px]"
            >
              {QUESTION}
            </h2>

            {sent ? (
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <p className="text-sm text-muted-foreground">
                  Thanks — we read every one, and the shelves change because of them.
                </p>
                <button
                  type="button"
                  onClick={forgetSuggestionSent}
                  className="text-sm font-medium text-rose underline-offset-4 hover:underline"
                >
                  Send another
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-5">
                <label htmlFor="poll-answer" className="sr-only">
                  Your answer
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="poll-answer"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    maxLength={MAX_LENGTH}
                    placeholder="Hot momos, a birthday cake, Pepsi at midnight…"
                    autoComplete="off"
                    aria-describedby={error ? 'poll-error' : undefined}
                    aria-invalid={error ? true : undefined}
                    className="h-12 min-w-0 flex-1 rounded-full border border-rose/30 bg-background px-5 text-sm placeholder:text-muted-foreground/70 focus:border-rose"
                  />
                  <button
                    type="submit"
                    disabled={sending || !text.trim()}
                    className={cn(
                      'inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-rose px-6 text-sm font-semibold text-rose-foreground transition-all duration-300 ease-[var(--ease-apple)]',
                      'hover:-translate-y-0.5 hover:shadow-lift disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none',
                    )}
                  >
                    {sending ? 'Sending…' : 'Send'}
                    <Send className="size-4" aria-hidden />
                  </button>
                </div>
                {error && (
                  <p id="poll-error" role="alert" className="mt-2 text-sm text-destructive">
                    {error}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
