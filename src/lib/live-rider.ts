/**
 * Turning a rider's position into sentences and a picture.
 *
 * Pure, so it can be tested without a browser and so the component that draws
 * it stays a component. Everything here is *description*: nothing decides
 * anything, nothing is an ETA. Straight-line distance across Aizawl's ridges
 * says which side of town somebody is on, not how long they will be — the API
 * makes the same promise about `distance_km`, and this keeps it.
 */

import { bearingDegrees, compassPoint, haversineKm, type Coordinates } from '@/lib/geolocation';
import type { RiderPosition } from '@/types';

/** Past this, the page stops calling a fix "live". Matches the API's own gate. */
export const STALE_AFTER_SECONDS = 90;

/** How far the picture can show: anything further sits on the outer ring. */
export const RADAR_MAX_KM = 3;

export interface RiderDescription {
  /** "1.2 km away", "400 m away", or "On the move" when nobody knows. */
  distance: string;
  /**
   * "Coming from the north-east" when the customer has shared where they
   * stand; "Heading north" when only the handset's heading is known; empty
   * when neither is.
   */
  direction: string;
  /** "Updated just now" / "Updated 40 s ago". */
  freshness: string;
  /** Seconds since the server took the fix, floored at zero. */
  ageSeconds: number;
  stale: boolean;
}

/**
 * Distance for a person: metres under a kilometre, one decimal above it, and
 * nothing at all — rather than "0.0 km" — when the fix is on top of them.
 */
export function formatDistance(km: number): string {
  if (km < 0.05) return 'Right here';
  if (km < 1) return `${Math.round(km / 0.05) * 50} m away`;
  return `${km.toFixed(1)} km away`;
}

export function formatAge(ageSeconds: number): string {
  if (ageSeconds < 10) return 'Updated just now';
  if (ageSeconds < 60) return `Updated ${Math.round(ageSeconds)} s ago`;
  return `Updated ${Math.round(ageSeconds / 60)} min ago`;
}

/**
 * The distance to show: measured from where the customer is standing when they
 * have said, otherwise the server's figure from the delivery address. The
 * customer's own fix wins because it is the one they can check against the
 * window.
 */
export function riderDistanceKm(rider: RiderPosition, me: Coordinates | null): number | null {
  if (me) return haversineKm(me, rider);
  return rider.distance_km;
}

export function describeRider(
  rider: RiderPosition,
  me: Coordinates | null,
  now: Date = new Date(),
): RiderDescription {
  const received = Date.parse(rider.received_at);
  const ageSeconds = Number.isFinite(received)
    ? Math.max(0, (now.getTime() - received) / 1000)
    : 0;

  const km = riderDistanceKm(rider, me);

  let direction = '';
  if (me) {
    direction = `Coming from the ${compassPoint(bearingDegrees(me, rider))}`;
  } else if (rider.heading !== null) {
    direction = `Heading ${compassPoint(rider.heading)}`;
  }

  return {
    distance: km === null ? 'On the move' : formatDistance(km),
    direction,
    freshness: formatAge(ageSeconds),
    ageSeconds,
    stale: ageSeconds > STALE_AFTER_SECONDS,
  };
}

export interface RadarPoint {
  /** Unit-square coordinates, `0..1`, with the customer at `(0.5, 0.5)`. */
  x: number;
  y: number;
  /** How far out the point sits, `0..1` of the outer ring. */
  radius: number;
}

/**
 * Where to draw the rider relative to the customer.
 *
 * Distance is placed on a square-root scale rather than a linear one: the last
 * few hundred metres are where a customer is actually watching, and a linear
 * radar spends most of its area on the kilometres that do not matter. Anything
 * past `RADAR_MAX_KM` sits on the outer ring — still visible, still in the
 * right direction.
 */
export function radarPoint(rider: RiderPosition, me: Coordinates): RadarPoint {
  const km = haversineKm(me, rider);
  const radius = Math.min(1, Math.sqrt(km / RADAR_MAX_KM));
  const bearing = (bearingDegrees(me, rider) * Math.PI) / 180;
  return {
    x: 0.5 + 0.5 * radius * Math.sin(bearing),
    y: 0.5 - 0.5 * radius * Math.cos(bearing),
    radius,
  };
}
