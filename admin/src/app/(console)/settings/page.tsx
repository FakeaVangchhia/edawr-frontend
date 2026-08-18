'use client';

import { ExternalLink, Info } from 'lucide-react';

import { ErrorBanner, PageHeader, Panel } from '@/components/ui';
import { API_BASE_URL } from '@/lib/api';
import { minutes, money } from '@/lib/format';
import { storeConfig } from '@/lib/queries';
import { useResource } from '@/lib/use-resource';

/**
 * Store settings — currently read-only, and honest about why.
 *
 * Every value here comes from an environment variable on the API server, not
 * from a database row, so there is nothing for a form on this page to write to.
 * The tempting alternative was to render editable-looking inputs and wire them
 * to nothing; a control that silently does not work is worse than no control,
 * because it costs the operator a support call to discover.
 *
 * Making these editable means moving them into a settings table on the backend.
 * That is a real change with a real migration, and it is not this one.
 */
export default function SettingsPage() {
  const config = useResource('store-config', (signal) => storeConfig(signal));
  const data = config.data;

  return (
    <>
      <PageHeader
        title="Settings"
        description="How the storefront prices and promises delivery."
      />

      <div className="mb-4 flex items-start gap-2 rounded-[0.4rem] border border-line bg-raised px-3 py-2.5 text-xs text-ink-soft">
        <Info size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
        <p>
          These are read from the API server&apos;s environment, so they are shown here rather
          than edited here — changing one means changing the server&apos;s configuration and
          redeploying. They are on this page because a manager needs to know what the store is
          currently promising, not because the page can change it.
        </p>
      </div>

      {config.error ? (
        <div className="mb-4">
          <ErrorBanner message={config.error} onRetry={config.refresh} />
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Store">
          {data ? (
            <dl className="space-y-2 text-sm">
              <Row label="Name" value={data.store_name} />
              <Row label="City" value={data.store_city} />
              <Row label="Minimum order" value={money(data.min_order_value)} />
              <Row label="Free delivery above" value={money(data.free_delivery_above)} />
              <Row label="Handling fee" value={money(data.handling_fee)} />
            </dl>
          ) : (
            <div className="skeleton h-32" />
          )}
        </Panel>

        <Panel title="Delivery tiers">
          {data ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Tier</th>
                  <th className="num">Fee</th>
                  <th className="num">Promise</th>
                </tr>
              </thead>
              <tbody>
                {data.delivery_tiers.map((tier) => (
                  <tr key={tier.type}>
                    <td>
                      {tier.label}
                      {tier.type === data.default_delivery_type ? (
                        <span className="badge badge-accent ml-1.5">Default</span>
                      ) : null}
                    </td>
                    <td className="num">{money(tier.fee)}</td>
                    <td className="num">{minutes(tier.promise_minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="skeleton h-32" />
          )}
        </Panel>
      </div>

      <Panel title="This console" className="mt-3">
        <dl className="space-y-2 text-sm">
          <Row label="API server" value={API_BASE_URL || 'Not configured'} mono />
        </dl>
        <p className="mt-3 text-xs text-ink-faint">
          If screens load but stay empty, this is the first thing to check — the browser blocks
          any request to an origin the console was not built to talk to.
        </p>
      </Panel>

      <Panel title="Known gaps" className="mt-3">
        {/* Stated rather than hidden. An operator who knows the system cannot
            do something will work around it; one who assumes it can will find
            out at the worst moment. */}
        <ul className="space-y-2 text-sm text-ink-soft">
          <Gap title="No opening hours and no closed state">
            An order placed at 3am is accepted and promised in 15 minutes, whether or not anyone
            is there. There is also no way to pause checkout during a stock-take or a power cut.
          </Gap>
          <Gap title="No delivery-zone check">
            Checkout accepts any address. One outside the delivery area is charged and promised
            like any other, then never appears in a rider&apos;s feed.
          </Gap>
          <Gap title="A dispatched order cannot be cancelled">
            Once a rider has it, the only recorded outcome is Delivered. A refused delivery has no
            correct button in any of the three apps, and the stock is never returned.
          </Gap>
          <Gap title="Cash is recorded as intent, not collection">
            There is no record of money actually taken, so end-of-shift reconciliation means
            summing order totals and trusting them.
          </Gap>
        </ul>
        <p className="mt-3 flex items-center gap-1 text-xs text-ink-faint">
          <ExternalLink size={12} aria-hidden="true" />
          These are tracked in the project&apos;s backlog, not discovered here.
        </p>
      </Panel>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2 last:border-0 last:pb-0">
      <dt className="text-ink-faint">{label}</dt>
      <dd className={mono ? 'mono text-right' : 'numeric text-right font-medium'}>{value}</dd>
    </div>
  );
}

function Gap({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li>
      <p className="font-medium text-ink">{title}</p>
      <p className="text-xs">{children}</p>
    </li>
  );
}
