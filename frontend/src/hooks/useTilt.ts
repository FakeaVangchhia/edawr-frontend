'use client';

import { useEffect, useRef } from 'react';

/**
 * Pointer-tracked 3D tilt for a card.
 *
 * Writes `--tilt-x` / `--tilt-y` straight onto the element; the transform that
 * consumes them lives in `.tilt-3d` (globals.css). Nothing here touches React
 * state — a tilt that re-rendered on every pointer move would re-render the
 * whole product grid dozens of times a second, and setting state from a
 * high-frequency event is how a smooth effect becomes a janky one. Writing a
 * custom property is a DOM side effect, which is what effects are actually for.
 *
 * Two groups never get it, and both are deliberate:
 *
 *   - **Touch devices.** A card that tilts under a finger is a tap target that
 *     moves while it is being tapped. There is also nothing to see: nobody
 *     hovers a phone.
 *   - **`prefers-reduced-motion`.** Vestibular sensitivity is common in exactly
 *     the audience this store has to be easiest for, and no flourish is worth a
 *     dizzy customer.
 *
 * `.tilt-3d` re-states both guards in CSS, so the effect stays off even if this
 * hook is ever attached somewhere it should not be.
 */

/** Degrees at the extreme corner. Small on purpose: enough to catch the light
 *  on the glass, not enough to distort the price or shift the Add button. */
const MAX_TILT_DEG = 5;

export function useTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof window === 'undefined') return;

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!finePointer.matches || reducedMotion.matches) return;

    let frame = 0;

    const apply = (event: PointerEvent) => {
      // Coalesced into one write per animation frame. Pointer events fire far
      // faster than the screen refreshes, and the extra writes are invisible
      // work that only costs battery.
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const box = element.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return;

        // -0.5 at one edge, +0.5 at the other, 0 dead centre.
        const px = (event.clientX - box.left) / box.width - 0.5;
        const py = (event.clientY - box.top) / box.height - 0.5;

        // Y drives rotateX inverted: pointer near the top should tip the card
        // away from the viewer, which is the direction that reads as "looking
        // down at it" rather than as the card lunging forward.
        element.style.setProperty('--tilt-x', `${(-py * MAX_TILT_DEG * 2).toFixed(2)}deg`);
        element.style.setProperty('--tilt-y', `${(px * MAX_TILT_DEG * 2).toFixed(2)}deg`);
      });
    };

    const reset = () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
      // Removing the properties rather than zeroing them lets the transition in
      // `.tilt-3d` ease back to the declared default.
      element.style.removeProperty('--tilt-x');
      element.style.removeProperty('--tilt-y');
    };

    element.addEventListener('pointermove', apply);
    element.addEventListener('pointerleave', reset);
    // A pointer lifting mid-card (a stylus, or a tap on a hybrid laptop) fires
    // no leave event, which would strand the card at an angle.
    element.addEventListener('pointercancel', reset);

    return () => {
      element.removeEventListener('pointermove', apply);
      element.removeEventListener('pointerleave', reset);
      element.removeEventListener('pointercancel', reset);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return ref;
}
