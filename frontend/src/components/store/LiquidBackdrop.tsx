/**
 * The animated field the glass has something to refract.
 *
 * `backdrop-filter` blurs whatever is *behind* an element. Over a flat black
 * page that is a no-op — the panels would read as slightly lighter rectangles
 * and the whole liquid-glass idea would collapse into grey. These slow gold
 * orbs are what the blur actually bends, and they are why the panels shift
 * subtly as the page scrolls over them.
 *
 * Deliberately not a client component: it renders identical markup on every
 * request, holds no state and handles no events, so it ships as pure server
 * HTML with no JavaScript attached. The motion is CSS on the compositor.
 *
 * `aria-hidden` and `pointer-events-none` throughout — this is scenery. It
 * must never be reachable by a screen reader or intercept a tap meant for the
 * store, and `prefers-reduced-motion` freezes every orb in place (see
 * globals.css).
 */
export default function LiquidBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[var(--color-surface-sunken)]"
    >
      {/* Orbs. Heavily blurred and low-opacity: the goal is a warm depth you
          notice only when it moves, not three visible yellow circles. */}
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="orb orb-c" />

      {/* A fine grid, thrown into perspective so it recedes toward the
          horizon. This is what gives the page an actual sense of depth for
          the glass to sit in front of. */}
      <div className="perspective-grid" />

      {/* Vignette. Pulls the corners down so the gold never washes out the
          text near the edges of a wide screen. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,transparent_35%,rgba(4,3,8,0.75)_100%)]" />

      <style>{`
        .orb {
          position: absolute;
          border-radius: 9999px;
          filter: blur(90px);
          opacity: 0.5;
          will-change: transform;
        }
        .orb-a {
          top: -18vh; left: -12vw;
          width: 58vw; height: 58vw;
          max-width: 720px; max-height: 720px;
          background: radial-gradient(circle at 35% 35%, rgba(212,175,55,0.55), transparent 68%);
          animation: drift-a 26s ease-in-out infinite;
        }
        .orb-b {
          top: 24vh; right: -20vw;
          width: 52vw; height: 52vw;
          max-width: 640px; max-height: 640px;
          background: radial-gradient(circle at 60% 40%, rgba(184,145,42,0.5), transparent 70%);
          animation: drift-b 32s ease-in-out infinite;
        }
        .orb-c {
          bottom: -22vh; left: 18vw;
          width: 46vw; height: 46vw;
          max-width: 560px; max-height: 560px;
          background: radial-gradient(circle at 50% 50%, rgba(244,220,147,0.35), transparent 72%);
          animation: drift-c 38s ease-in-out infinite;
        }

        /* Translate and scale only — both composited, so this animates on the
           GPU and never triggers layout. */
        @keyframes drift-a {
          0%, 100% { transform: translate3d(0,0,0) scale(1); }
          50%      { transform: translate3d(9vw, 7vh, 0) scale(1.14); }
        }
        @keyframes drift-b {
          0%, 100% { transform: translate3d(0,0,0) scale(1.05); }
          50%      { transform: translate3d(-11vw, -6vh, 0) scale(0.92); }
        }
        @keyframes drift-c {
          0%, 100% { transform: translate3d(0,0,0) scale(0.95); }
          50%      { transform: translate3d(7vw, -9vh, 0) scale(1.12); }
        }

        .perspective-grid {
          position: absolute;
          left: -50%;
          bottom: -10%;
          width: 200%;
          height: 70%;
          background-image:
            linear-gradient(rgba(212,175,55,0.16) 1px, transparent 1px),
            linear-gradient(90deg, rgba(212,175,55,0.16) 1px, transparent 1px);
          background-size: 64px 64px;
          transform: perspective(520px) rotateX(74deg);
          transform-origin: 50% 100%;
          /* Fades the grid out before it reaches the content, so it reads as
             depth rather than as a texture laid over the products. */
          mask-image: linear-gradient(to top, rgba(0,0,0,0.85), transparent 72%);
          -webkit-mask-image: linear-gradient(to top, rgba(0,0,0,0.85), transparent 72%);
          animation: grid-glide 22s linear infinite;
        }

        @keyframes grid-glide {
          from { background-position: 0 0, 0 0; }
          to   { background-position: 0 64px, 64px 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .orb, .perspective-grid { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
