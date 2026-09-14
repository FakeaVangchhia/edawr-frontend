/**
 * Whether this device has already answered the poll sticker.
 *
 * Remembered so the home page can say "thanks" on the next visit instead of
 * asking the same question of the same person every day. It is a courtesy,
 * not a lock: "Send another" is still there, and the server has its own
 * throttle for anyone who takes that literally. Nothing depends on this value
 * and losing it costs the customer a repeat question at most.
 */

import { createLocalStore } from './local-store';

const store = createLocalStore<boolean>({
  key: 'edawr-suggestion-sent-v1',
  empty: false,
  parse: (raw) => (typeof raw === 'boolean' ? raw : null),
});

export const subscribeToSuggestionSent = store.subscribe;
export const getSuggestionSentSnapshot = store.getSnapshot;
export const getSuggestionSentServerSnapshot = store.getServerSnapshot;

export function markSuggestionSent(): void {
  store.write(true);
}

export function forgetSuggestionSent(): void {
  store.write(false);
}
