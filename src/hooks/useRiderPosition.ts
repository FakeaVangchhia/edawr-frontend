'use client';

import { useEffect, useState } from 'react';
import { fetchRiderPosition } from '@/lib/store-api';
import type { RiderPosition } from '@/types';

/** A few seconds apart: the handset reports every fifteen, and a marker
 *  redrawn between reports is redrawn in the same place. */
const POLL_MS = 5_000;

export interface RiderPositionState {
  /** Where the rider is, or null while there is nothing to draw. */
  position: RiderPosition | null;
  /** False until the first answer has arrived, so "nothing yet" is not drawn
   *  as "nobody reporting" for the half-second before we know. */
  loaded: boolean;
  /** Bumps the poll from an event handler — "share my location" calls it so
   *  the picture updates the moment the customer's own point exists. */
  refresh: () => void;
}

/**
 * The rider's position, polled while somebody is watching.
 *
 * `active` is "the order is Dispatched": before that nobody is carrying it and
 * afterwards it is over, and the API answers `null` either way — so the poll
 * is not even started. It also stops while the tab is hidden, exactly as the
 * order poll does, for the same battery-and-data reasons; coming back
 * refreshes at once.
 *
 * Every `setState` here runs from a promise callback, a timer or an event —
 * never synchronously inside an effect — which is the rule the storefront
 * follows to satisfy `react-hooks/set-state-in-effect`.
 *
 * **This hook is the seam for a push source.** If rider positions ever arrive
 * over a Firebase (or any other) listener, that subscription replaces the
 * fetch-and-timer pair below and produces the same `RiderPosition | null`;
 * the page above it does not change.
 */
export function useRiderPosition(token: string, active: boolean): RiderPositionState {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<{ token: string; position: RiderPosition | null } | null>(
    null,
  );

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();

    fetchRiderPosition(token, controller.signal)
      .then((position) => {
        if (controller.signal.aborted) return;
        setState({ token, position });
      })
      .catch(() => {
        // A failed poll is not news the customer can act on. The previous
        // answer stays on screen and ages visibly, which is the honest picture.
        if (controller.signal.aborted) return;
        setState((current) => current ?? { token, position: null });
      });

    return () => controller.abort();
  }, [token, active, tick]);

  useEffect(() => {
    if (!active) return;

    const refresh = () => setTick((value) => value + 1);
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      timer ??= setInterval(refresh, POLL_MS);
    };
    const stop = () => {
      if (timer === undefined) return;
      clearInterval(timer);
      timer = undefined;
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        refresh();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [active]);

  const current = active && state?.token === token ? state : null;

  return {
    position: current?.position ?? null,
    loaded: current !== null,
    refresh: () => setTick((value) => value + 1),
  };
}
