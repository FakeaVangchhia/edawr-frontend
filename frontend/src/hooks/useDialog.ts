'use client';

import { useEffect, useRef } from 'react';

/**
 * The four things an `aria-modal="true"` element has to actually do.
 *
 * Both drawers already claimed to be modal dialogs and only did half of it:
 * focus moved in, but Tab walked straight out the back into the product grid
 * behind the scrim, and closing dropped focus on `<body>` — which for a
 * keyboard user means being returned to the top of a sixty-item page with no
 * idea where they were.
 *
 * So this hook does all four, together, because they are one behaviour:
 *
 *   1. Move focus into the dialog on open.
 *   2. Keep Tab and Shift+Tab inside it.
 *   3. Restore focus to whatever opened it on close.
 *   4. Stop the page behind from scrolling.
 *
 * Escape is deliberately NOT here. The cart closes on Escape unconditionally,
 * but the checkout sheet must not while a submission is in flight, and folding
 * a conditional into a shared hook would hide exactly the difference that
 * matters. Each caller keeps its own key handler.
 */
export function useDialog<T extends HTMLElement>({
  onClose,
  initialFocusRef,
}: {
  onClose: () => void;
  /** Where focus should land. Falls back to the first tabbable element. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Captured before focus moves, so it is the control that opened the dialog
    // rather than anything inside it.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const tabbable = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
        // Queried fresh on every Tab rather than cached: the contents change as
        // the customer edits the basket, and a stale list would send focus to
        // an element that is no longer on screen.
      ).filter((element) => element.offsetParent !== null || element === document.activeElement);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const elements = tabbable();
      if (elements.length === 0) {
        // Nothing to focus — hold focus on the container rather than letting it
        // escape to the page behind.
        event.preventDefault();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !container.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    // Without this, scrolling the drawer on a phone scrolls the product grid
    // underneath it once the drawer's own list hits its end.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const target = initialFocusRef?.current ?? tabbable()[0];
    target?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      // `isConnected` guards the case where the trigger itself was removed
      // while the dialog was open — focusing a detached node silently sends
      // focus to the body, which is the bug this is here to prevent.
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [initialFocusRef, onClose]);

  return containerRef;
}
