import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * A section's title row: heading, optional one-line subtitle, optional "View
 * all", optional icon beside the heading. The home page and every product
 * rail share it, so the sections cannot drift apart by a class or two.
 */
export function SectionHeading({
  title,
  subtitle,
  href,
  icon,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-semibold sm:text-[28px]">
          {icon}
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="shrink-0 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          View all
        </Link>
      )}
    </div>
  );
}
