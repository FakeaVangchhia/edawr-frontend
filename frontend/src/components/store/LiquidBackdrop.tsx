/**
 * The page ground, and one warm wash across the top of it.
 *
 * This used to be three animated gold orbs, a perspective grid and a vignette,
 * and every one of those existed to give `backdrop-filter` something to bend
 * behind the glass panels. On a light theme none of it survives contact with
 * the ground it sits on:
 *
 *   - Three amber orbs at 34% opacity over white is a yellow haze across the
 *     whole viewport. It does not read as depth; it reads as a dirty screen or
 *     a miscalibrated display.
 *   - The grid was amber at 10% opacity, which against white is about 1.02:1.
 *     Invisible, and still repainting forever.
 *   - The vignette darkened the corners of a page whose whole point is that it
 *     is light.
 *   - And the glass they were built to refract is gone (see globals.css): over
 *     white, a backdrop blur blurs white.
 *
 * So it is one static gradient now. Keeping the component rather than folding
 * it into `layout.tsx` keeps the page ground defined in one place, and keeping
 * it a server component means it still ships as pure HTML.
 *
 * Removing the animations takes four infinite CSS animations and four promoted
 * compositor layers off every screen in the app, and removes the only inline
 * `<style>` block the application itself ships.
 *
 * `aria-hidden` and `pointer-events-none` — this is scenery. It must never be
 * reachable by a screen reader or intercept a tap meant for the store.
 */
export default function LiquidBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[var(--color-surface-sunken)]"
    >
      {/* A single amber wash falling from the top edge, at 5.5% — far enough
          below the threshold of "a colour" that it registers as warmth in the
          paper rather than as a tint someone applied. Any stronger and it
          fights the white cards sitting on top of it. */}
      <div className="absolute inset-0 bg-[radial-gradient(90%_45%_at_50%_0%,rgba(245,166,35,0.055)_0%,transparent_70%)]" />
    </div>
  );
}
