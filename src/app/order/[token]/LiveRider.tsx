'use client';

import { useEffect, useState } from 'react';
import { LocateFixed, Loader2, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { useRiderPosition } from '@/hooks/useRiderPosition';
import { ApiError } from '@/lib/api';
import {
  GEOLOCATION_MESSAGES,
  requestPosition,
  type Coordinates,
} from '@/lib/geolocation';
import { describeRider, radarPoint } from '@/lib/live-rider';
import { shareCustomerPosition } from '@/lib/store-api';
import { cn } from '@/lib/utils';
import type { RiderPosition } from '@/types';

/**
 * Where the rider is, while they are carrying this order.
 *
 * The other half of the API's live location. The rider app reports every
 * fifteen seconds while a `Dispatched` order is in hand; this reads it back
 * under the tracking token and draws the little that the API lets a customer
 * see — a distance, a direction and how fresh the fix is. No name beyond what
 * the "Your rider" card already shows, and never an ETA: straight-line
 * distance over Aizawl's ridges says which side of town, not how long.
 *
 * **Sharing back is opt-in and stays optional.** "Share my location" reads the
 * browser's position and posts it to the order, so the rider's dashboard shows
 * where the customer is actually standing rather than where the address
 * geocoded to. Declining changes nothing about the delivery. While it is on,
 * it re-sends every minute so the rider's copy does not go stale — and only
 * while the tab is visible, like every other poll on this page.
 *
 * There is deliberately no tile map here. One needs a tile origin in the CSP
 * and either a billing account or a provider's usage policy, and neither is a
 * decision this page should make on the shop's behalf. The radar below draws
 * the same two points — rider and customer — with no third party involved,
 * and the whole thing is one component to swap when the map exists.
 */

const RESHARE_MS = 60_000;

/** A clock for the "updated N s ago" line, ticking once a second. */
function useNow(enabled: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [enabled]);
  return now;
}

export function LiveRider({ token, active }: { token: string; active: boolean }) {
  const { position, loaded, refresh } = useRiderPosition(token, active);
  const [me, setMe] = useState<Coordinates | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const now = useNow(active && position !== null);

  /**
   * Read the browser's position and hand it to the order.
   *
   * Every failure resolves to a sentence, never a thrown error — the address
   * is the real input and this is a courtesy on top. A 409 is the one
   * interesting failure: the order ended while the prompt was up.
   */
  const share = async () => {
    if (sharing) return;
    setSharing(true);
    setShareNote('');
    try {
      const { coords, failure, accuracyM } = await requestPosition();
      if (!coords) {
        setShareNote(failure ? GEOLOCATION_MESSAGES[failure] : '');
        return;
      }
      await shareCustomerPosition(token, { ...coords, accuracy_m: accuracyM ?? null });
      setMe(coords);
      refresh();
      toast.success('Location shared', {
        description: 'Your rider can now see where you are waiting.',
      });
    } catch (caught: unknown) {
      if (caught instanceof ApiError && caught.status === 409) {
        setShareNote('This order has already been completed.');
        return;
      }
      setShareNote('We could not share your location just now. Your address is enough.');
    } finally {
      setSharing(false);
    }
  };

  /**
   * Keep the rider's copy fresh once the customer has opted in. Re-reads the
   * browser position rather than re-sending the old one, so somebody who walks
   * out to the gate is shown at the gate. Silent on failure: the last shared
   * point is still on the rider's screen, which is better than a toast.
   */
  useEffect(() => {
    if (!active || me === null) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      requestPosition()
        .then(({ coords, accuracyM }) => {
          if (!coords) return;
          return shareCustomerPosition(token, {
            ...coords,
            accuracy_m: accuracyM ?? null,
          }).then(() => setMe(coords));
        })
        .catch(() => {
          /* the previous share stands */
        });
    }, RESHARE_MS);
    return () => clearInterval(timer);
  }, [active, me, token]);

  if (!active) return null;

  const described = position ? describeRider(position, me, now) : null;

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-3xl bg-primary p-5 text-primary-foreground">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
            <span
              className={cn(
                'relative inline-flex size-2 rounded-full',
                described && !described.stale ? 'bg-success' : 'bg-primary-foreground/40',
              )}
              aria-hidden
            >
              {described && !described.stale ? (
                <span className="absolute inset-0 animate-ping rounded-full bg-success/60" />
              ) : null}
            </span>
            {described && !described.stale ? 'Live' : 'Waiting for signal'}
          </span>
          {described ? (
            <span className="num text-xs text-primary-foreground/70" aria-live="polite">
              {described.freshness}
            </span>
          ) : null}
        </div>

        {described ? (
          <div className="mt-4 flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <p className="num text-2xl font-semibold leading-tight">{described.distance}</p>
              {described.direction ? (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-primary-foreground/70">
                  <Navigation className="size-3.5" aria-hidden />
                  {described.direction}
                </p>
              ) : null}
              {described.stale ? (
                <p className="mt-2 text-xs text-primary-foreground/70">
                  Their phone has not reported for a while — probably a dead spot on the hill.
                </p>
              ) : null}
            </div>
            {me ? <Radar rider={position!} me={me} /> : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-primary-foreground/70">
            {loaded
              ? 'Your rider is on the way. Their position appears here as soon as their phone reports it.'
              : 'Looking for your rider…'}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={share}
          disabled={sharing}
          className={cn(
            'inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-all duration-300 ease-[var(--ease-apple)] disabled:pointer-events-none disabled:opacity-60',
            me
              ? 'border border-border bg-background hover:bg-secondary'
              : 'bg-amber text-amber-foreground hover:-translate-y-0.5 hover:shadow-lift',
          )}
        >
          {sharing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <LocateFixed className="size-4" aria-hidden />
          )}
          {sharing ? 'Finding you…' : me ? 'Update my location' : 'Share my location'}
        </button>
        <p className="text-xs text-muted-foreground">
          {me
            ? 'Your rider can see where you are waiting. It refreshes while this page is open.'
            : 'Optional — helps the rider find you if the address is hard to spot.'}
        </p>
      </div>

      {/* Always mounted, like the tracker's own status line, so a failure is
          announced rather than silently appearing. */}
      <p role="status" aria-live="polite" className={cn('text-sm', shareNote ? 'text-muted-foreground' : 'sr-only')}>
        {shareNote}
      </p>
    </div>
  );
}

/**
 * The customer at the centre, the rider where they are.
 *
 * Three rings on a square-root scale (see `radarPoint`), north up, no tiles.
 * The rider dot carries the handset's heading as a small arrow when the
 * handset knows it. Decorative in the accessibility sense — the sentences
 * beside it say the same thing — so it is hidden from assistive technology.
 */
function Radar({ rider, me }: { rider: RiderPosition; me: Coordinates }) {
  const point = radarPoint(rider, me);
  const size = 112;
  const cx = point.x * size;
  const cy = point.y * size;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="shrink-0"
      aria-hidden
    >
      {[1, 0.66, 0.33].map((ring) => (
        <circle
          key={ring}
          cx={size / 2}
          cy={size / 2}
          r={(size / 2 - 2) * ring}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.18}
          strokeWidth={1}
        />
      ))}
      <line
        x1={size / 2}
        y1={2}
        x2={size / 2}
        y2={size - 2}
        stroke="currentColor"
        strokeOpacity={0.1}
        strokeWidth={1}
      />
      <line
        x1={2}
        y1={size / 2}
        x2={size - 2}
        y2={size / 2}
        stroke="currentColor"
        strokeOpacity={0.1}
        strokeWidth={1}
      />
      <text
        x={size / 2}
        y={11}
        textAnchor="middle"
        fontSize={8}
        fill="currentColor"
        fillOpacity={0.6}
      >
        N
      </text>
      {/* the customer */}
      <circle cx={size / 2} cy={size / 2} r={4} fill="currentColor" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={7}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.4}
      />
      {/* the rider */}
      <g transform={`translate(${cx} ${cy})`}>
        <circle r={9} className="fill-amber/30" />
        <circle r={5} className="fill-amber" />
        {rider.heading !== null ? (
          <polygon
            points="0,-13 3,-7 -3,-7"
            className="fill-amber"
            transform={`rotate(${rider.heading})`}
          />
        ) : null}
      </g>
    </svg>
  );
}
