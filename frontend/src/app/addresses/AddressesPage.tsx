'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, MapPin, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  addAddress,
  removeAddress,
  selectAddress,
  selectedAddress,
  toDeliveryAddress,
} from '@/lib/addresses';
import { useAddressBook, useStoreConfig } from '@/hooks/useStoreData';
import { isValidAddress } from '@/lib/validation';
import { cn } from '@/lib/utils';

/**
 * The address book.
 *
 * Saved in this browser and nowhere else — see `lib/addresses.ts`. The page says
 * so plainly rather than presenting itself as an account feature, because the
 * failure mode (clearing site data) is silent and the customer should not first
 * discover it at checkout.
 */
export function AddressesPage() {
  const book = useAddressBook();
  const config = useStoreConfig();
  const current = selectedAddress(book);

  const [isAdding, setIsAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [line, setLine] = useState('');
  const [city, setCity] = useState('');
  const [landmark, setLandmark] = useState('');

  const reset = () => {
    setLabel('');
    setLine('');
    setCity('');
    setLandmark('');
    setIsAdding(false);
  };

  const save = () => {
    if (!label.trim() || !isValidAddress(line)) return;
    addAddress({
      label: label.trim(),
      line: line.trim(),
      city: city.trim() || config?.store_city || '',
      landmark: landmark.trim(),
    });
    toast.success('Address saved on this device');
    reset();
  };

  return (
    <div className="container-page py-10 lg:py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold lg:text-5xl">Addresses</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Saved in this browser so checkout can fill itself in. There is no account behind them —
            clearing your site data clears these too.
          </p>
        </div>

        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all duration-300 ease-[var(--ease-apple)] hover:-translate-y-0.5 hover:shadow-lift"
          >
            <Plus className="size-4" aria-hidden />
            Add address
          </button>
        )}
      </div>

      {isAdding && (
        <section className="mt-8 rounded-4xl border border-border/70 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">New address</h2>
            <button
              type="button"
              onClick={reset}
              aria-label="Cancel"
              className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Label" value={label} onChange={setLabel} placeholder="Home, Work, Mum's" />
            <Field
              label="City"
              value={city}
              onChange={setCity}
              placeholder={config?.store_city ?? 'Aizawl'}
            />
          </div>
          <div className="mt-4 grid gap-4">
            <Field
              label="Address"
              value={line}
              onChange={setLine}
              placeholder="House, street, locality"
            />
            <Field
              label="Landmark (optional)"
              value={landmark}
              onChange={setLandmark}
              placeholder="Near the church, opposite the bank"
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={save}
              disabled={!label.trim() || !isValidAddress(line)}
              className="inline-flex h-12 items-center rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground transition-all duration-300 ease-[var(--ease-apple)] hover:-translate-y-0.5 hover:shadow-lift disabled:pointer-events-none disabled:opacity-50"
            >
              Save address
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-12 items-center rounded-full border border-border px-7 text-sm font-medium transition-colors hover:bg-secondary"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {book.entries.length === 0 && !isAdding ? (
        <div className="mt-10 rounded-4xl border border-border/70 py-20 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-secondary">
            <MapPin className="size-7 text-muted-foreground" aria-hidden />
          </span>
          <h2 className="mt-6 text-lg font-semibold">No saved addresses</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Add one and checkout will fill itself in. You can also just type an address at checkout.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {book.entries.map((entry) => {
            const active = entry.id === current?.id;
            return (
              <div
                key={entry.id}
                className={cn(
                  'rounded-3xl border p-5 transition-all duration-300 ease-[var(--ease-apple)]',
                  active ? 'border-primary bg-secondary' : 'border-border/70 hover:bg-surface',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{entry.label}</p>
                  {active && (
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary">
                      <Check className="size-3 text-primary-foreground" aria-hidden />
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {toDeliveryAddress(entry)}
                </p>
                {entry.landmark && (
                  <p className="mt-1 text-xs text-muted-foreground">Near {entry.landmark}</p>
                )}

                <div className="mt-5 flex items-center gap-2 border-t pt-4">
                  {!active && (
                    <button
                      type="button"
                      onClick={() => selectAddress(entry.id)}
                      className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
                    >
                      Deliver here
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      removeAddress(entry.id);
                      toast.success('Address removed');
                    }}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Link
        href="/account"
        className="mt-10 inline-block text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Back to your account
      </Link>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm outline-none transition-colors focus:border-primary/25"
      />
    </label>
  );
}
