import { CalendarClock, HeartPulse, PawPrint, Smartphone, type LucideIcon } from 'lucide-react';

/**
 * What the "Coming soon" row on the home page teases.
 *
 * A static list, on purpose. Nothing here is a promise the API can keep yet —
 * that is what "coming soon" means — so there is no endpoint to read it from,
 * and putting it in the console would invite someone to schedule a feature
 * nobody is building. Edit this file when the plan changes; every entry is a
 * sentence the store is willing to be held to.
 *
 * **These four are placeholders.** They are plausible next steps for a
 * quick-commerce grocer, not a roadmap anyone has agreed. Replace them with
 * the real one before this ships to customers; `coming-soon.test.ts` only
 * checks the shape.
 */

export interface ComingSoonItem {
  key: string;
  title: string;
  blurb: string;
  icon: LucideIcon;
}

export const COMING_SOON: readonly ComingSoonItem[] = [
  {
    key: 'scheduled',
    title: 'Scheduled delivery',
    blurb: 'Pick a slot for tomorrow and have it at the door before breakfast.',
    icon: CalendarClock,
  },
  {
    key: 'upi',
    title: 'Pay by UPI',
    blurb: 'Settle at checkout instead of counting change at the door.',
    icon: Smartphone,
  },
  {
    key: 'pharmacy',
    title: 'Pharmacy & wellness',
    blurb: 'Everyday medicines and first aid, on the same 15-minute promise.',
    icon: HeartPulse,
  },
  {
    key: 'pets',
    title: 'Pet supplies',
    blurb: 'Food, litter and treats for the other members of the house.',
    icon: PawPrint,
  },
];
