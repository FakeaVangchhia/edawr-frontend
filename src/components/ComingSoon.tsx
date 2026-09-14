import { COMING_SOON } from '@/lib/coming-soon';

/**
 * The "Coming soon" row: four things the shop intends to do next.
 *
 * Tiles, not links — there is nowhere to go yet, and a card that looks
 * tappable and does nothing teaches a customer not to tap. The list itself is
 * `lib/coming-soon.ts`; this file only draws it.
 */
export function ComingSoon() {
  if (COMING_SOON.length === 0) return null;

  return (
    <section className="border-t border-border/70 py-10" aria-labelledby="coming-soon-heading">
      <div className="container-page">
        <div className="mb-5">
          <h2 id="coming-soon-heading" className="text-2xl font-semibold sm:text-[28px]">
            Coming soon
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What we are working on next. Not in the shop yet — soon.
          </p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {COMING_SOON.map(({ key, title, blurb, icon: Icon }) => (
            <li
              key={key}
              className="relative rounded-3xl border border-dashed border-border bg-surface p-5"
            >
              <span className="absolute right-4 top-4 rounded-full bg-amber-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-foreground">
                Soon
              </span>
              <span className="grid size-11 place-items-center rounded-2xl bg-amber-soft">
                <Icon className="size-5 text-amber-foreground" aria-hidden />
              </span>
              <p className="mt-4 text-[15px] font-semibold">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{blurb}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
