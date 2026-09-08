/**
 * Every icon in the eDawr estate, generated from one file.
 *
 *   node scripts/generate-brand-assets.mjs
 *
 * The master is `public/assets/edawr_profile_darknavy.png` — a 2720x2720 RGBA
 * badge: the wordmark "eDawr" on a navy disc, transparent outside the circle.
 * Nothing else in the tree is a logo. Before this script there were six
 * different marks pretending to be one (a lucide <Zap>, a second copy of it in
 * React Native, an abstract icon.svg, two text-only console lockups, an
 * Ionicons bicycle on the rider login) and the stock create-next-app favicon
 * underneath them all.
 *
 * It writes into all four applications, which is unusual and deliberate: the
 * repository root is not a version-controlled tree, so there is nowhere shared
 * to put a build step. Derived files are committed in whichever repository
 * receives them. Do not hand-edit them — change the master, or change this
 * script, and re-run.
 *
 * `sharp` is not a dependency of this project. It arrives with Next.js and is
 * already in node_modules; this script is the only thing that uses it, and it
 * runs by hand rather than in a build.
 *
 * TWO TIERS, and the reason for them
 * ----------------------------------
 * The badge's entire content is the word "eDawr". At a 32px favicon its cap
 * height is about four pixels — it reads as a navy smudge. So:
 *
 *   badge  the master, wherever it is >= ~96px and actually legible:
 *          app icons, splash screens, PWA install icons, OG cards.
 *   mark   the amber "e" alone, lifted out of the badge (see MARK_CROP) and
 *          set on a navy square: favicons, header tiles, and the Android
 *          notification silhouette.
 *
 * Same pixels, same file, no second design to keep in sync.
 *
 * TWO THINGS THAT ARE WRONG BY DEFAULT
 * ------------------------------------
 * - iOS app icons must carry NO alpha channel. The master is transparent
 *   outside the circle, so every iOS-bound asset is flattened onto NAVY first.
 *   Ship the transparency and App Store review rejects the build.
 * - Android renders a notification icon as a WHITE MASK: it keeps the alpha
 *   channel and throws the colours away. A coloured crop arrives as a solid
 *   white blob. `notification-icon.png` is therefore built from the amber
 *   glyph's coverage alone, painted white.
 */

import { Buffer } from 'node:buffer';
import { mkdir, writeFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(HERE, '..');
const ROOT = path.resolve(FRONTEND, '..');

const ADMIN = path.join(ROOT, 'admin');
const CUSTOMER_APP = path.join(ROOT, 'customer-app');
const MOBILE = path.join(ROOT, 'mobile');

const MASTER = path.join(FRONTEND, 'public/assets/edawr_profile_darknavy.png');

/** The master's own palette, sampled from it rather than typed from a brand deck. */
const NAVY = '#080E20';

/**
 * The amber "e", lifted out of the master.
 *
 * Measured by walking the decoded pixels: the glyph itself occupies
 * x 456-776, y 1349-1708, and the white "D" beside it starts at x 830. So
 * there are only 54px of clearance on the right, and any square crop centred
 * on the "e" that is wide enough to look unhurried collides with the "D".
 *
 * Hence a *rectangle* — the glyph plus a 20px navy margin, stopping well short
 * of the "D" — which is then composited onto a square navy field at
 * MARK_GLYPH_SCALE. Padding becomes a number to tune rather than a constraint
 * the neighbouring letter imposes.
 */
const MARK_CROP = { left: 436, top: 1329, width: 360, height: 400 };

/** How much of the square the crop fills. The rest is navy breathing room. */
const MARK_GLYPH_SCALE = 0.66;

/** Amber is #F5A623. Loose bounds, because the master is anti-aliased. */
const isAmber = (r, g, b) => r > 150 && g > 90 && g < 210 && b < 110;

/* -------------------------------------------------------------------------- */
/* primitives                                                                 */
/* -------------------------------------------------------------------------- */

const badge = () => sharp(MASTER);

/**
 * The mark, rendered once at 1024 and then downscaled for every size that
 * needs it. Composing at each target size instead would resample a 16px crop
 * from a 2720px source in one step, and the strokes come out muddy.
 */
let markMaster;
async function mark() {
  if (!markMaster) {
    const height = Math.round(1024 * MARK_GLYPH_SCALE);
    const width = Math.round(MARK_CROP.width * (height / MARK_CROP.height));
    const glyph = await badge().extract(MARK_CROP).resize(width, height).png().toBuffer();
    markMaster = await sharp({
      create: { width: 1024, height: 1024, channels: 4, background: NAVY },
    })
      .composite([{ input: glyph, gravity: 'centre' }])
      .png()
      .toBuffer();
  }
  return sharp(markMaster);
}

/** The badge at `size`, transparent outside the disc. Splash and adaptive foregrounds. */
const badgeTransparent = (size) =>
  badge()
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png();

/** The badge at `size` on solid navy, alpha stripped. Anything iOS will read. */
const badgeOnNavy = (size) =>
  badge().resize(size, size).flatten({ background: NAVY }).removeAlpha().png();

/**
 * The badge inset into Android's 66% adaptive-icon safe zone, on transparency.
 * The launcher masks this to whatever shape the handset uses, and anything
 * outside the inner 66% can be clipped away.
 */
const badgeMaskable = async (size) => {
  const inner = Math.round(size * 0.66);
  const art = await badge().resize(inner, inner).png().toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: art, gravity: 'centre' }])
    .png();
};

/** Same inset, but on navy — the PWA `purpose: "maskable"` entry. */
const badgeMaskableOnNavy = async (size) => {
  const inner = Math.round(size * 0.66);
  const art = await badge().resize(inner, inner).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: NAVY } })
    .composite([{ input: art, gravity: 'centre' }])
    .png();
};

const markPng = async (size) => (await mark()).resize(size, size).png().toBuffer();

/**
 * A social card: the badge centred on navy at 1200x630.
 *
 * Worth having because both Next apps' metadata already declare
 * `twitter:card = summary_large_image` and neither has ever supplied an image,
 * so every share of the storefront has rendered blank.
 */
const socialCard = async () => {
  const art = await badge().resize(440, 440).png().toBuffer();
  return sharp({ create: { width: 1200, height: 630, channels: 4, background: NAVY } })
    .composite([{ input: art, gravity: 'centre' }])
    .png();
};

/**
 * The Android notification silhouette: the "e" as pure white coverage on
 * transparency.
 *
 * Built from the glyph's own pixels rather than redrawn, so the shape is the
 * real one. Android keeps only the alpha channel here and discards the colour,
 * which is why shipping the amber crop would put a featureless white square in
 * the status bar.
 */
const notificationIcon = async (size) => {
  const { data, info } = await (await mark())
    .resize(size, size)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i += 1) {
    const o = i * info.channels;
    out[i * 4] = 255;
    out[i * 4 + 1] = 255;
    out[i * 4 + 2] = 255;
    out[i * 4 + 3] = isAmber(data[o], data[o + 1], data[o + 2]) ? 255 : 0;
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png();
};

/* -------------------------------------------------------------------------- */
/* .ico                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * An ICO carrying PNG payloads at 16, 32 and 48.
 *
 * sharp cannot write .ico, and the container is trivial: a 6-byte header, one
 * 16-byte directory entry per image, then the payloads back to back.
 * PNG-inside-ICO is understood by every browser this application supports; the
 * BMP encoding it replaces was for IE.
 */
async function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon, 2 = cursor
  header.writeUInt16LE(pngs.length, 4);

  const directory = Buffer.alloc(16 * pngs.length);
  let offset = header.length + directory.length;

  pngs.forEach(({ size, data }, i) => {
    const at = i * 16;
    directory[at] = size >= 256 ? 0 : size; // 0 means 256
    directory[at + 1] = size >= 256 ? 0 : size;
    directory[at + 2] = 0; // palette entries
    directory[at + 3] = 0; // reserved
    directory.writeUInt16LE(1, at + 4); // colour planes
    directory.writeUInt16LE(32, at + 6); // bits per pixel
    directory.writeUInt32LE(data.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });

  return Buffer.concat([header, directory, ...pngs.map((p) => p.data)]);
}

const faviconIco = async () =>
  ico([
    { size: 16, data: await markPng(16) },
    { size: 32, data: await markPng(32) },
    { size: 48, data: await markPng(48) },
  ]);

/* -------------------------------------------------------------------------- */
/* writing                                                                    */
/* -------------------------------------------------------------------------- */

const written = [];

async function put(target, source) {
  await mkdir(path.dirname(target), { recursive: true });
  const resolved = await source;
  const data = Buffer.isBuffer(resolved) ? resolved : await resolved.toBuffer();
  await writeFile(target, data);
  written.push([path.relative(ROOT, target), data.length]);
}

/** Removed rather than left to rot — a retired mark that is still served gets reused. */
async function remove(target) {
  try {
    await stat(target);
  } catch {
    return;
  }
  await rm(target);
  written.push([`${path.relative(ROOT, target)} (deleted)`, 0]);
}

async function main() {
  await stat(MASTER).catch(() => {
    throw new Error(`master logo missing: ${MASTER}`);
  });

  /* ---- storefront ------------------------------------------------------- */
  // favicon.ico here replaces the 25,931-byte create-next-app default, which
  // was the last piece of framework branding shipping to customers.
  await put(path.join(FRONTEND, 'src/app/favicon.ico'), await faviconIco());
  await put(path.join(FRONTEND, 'src/app/icon.png'), markPng(512));
  await put(path.join(FRONTEND, 'src/app/apple-icon.png'), badgeOnNavy(180));
  await put(path.join(FRONTEND, 'src/app/opengraph-image.png'), await socialCard());
  await put(path.join(FRONTEND, 'src/app/twitter-image.png'), await socialCard());

  await put(path.join(FRONTEND, 'public/icon-192.png'), badgeOnNavy(192));
  await put(path.join(FRONTEND, 'public/icon-512.png'), badgeOnNavy(512));
  await put(path.join(FRONTEND, 'public/icon-maskable-512.png'), await badgeMaskableOnNavy(512));
  await put(path.join(FRONTEND, 'public/assets/edawr-mark-512.png'), markPng(512));
  // The abstract navy-square-and-bolt that predates the real logo.
  await remove(path.join(FRONTEND, 'public/icon.svg'));

  /* ---- console ---------------------------------------------------------- */
  // It has never had a favicon of any kind: every tab showed the browser's
  // default globe and every page load logged a 404 for /favicon.ico.
  await put(path.join(ADMIN, 'src/app/favicon.ico'), await faviconIco());
  await put(path.join(ADMIN, 'src/app/icon.png'), markPng(512));
  await put(path.join(ADMIN, 'src/app/apple-icon.png'), badgeOnNavy(180));
  await put(path.join(ADMIN, 'public/edawr-mark-512.png'), markPng(512));

  /* ---- the two Expo apps ------------------------------------------------ */
  // Identical sets. The rider app was purple (#6d28d9 / #2e1065 / #4169E1) and
  // had no notification icon at all; the customer app was a hair off-navy at
  // #070D1E and shipped a 512px splash and a 48px favicon.
  for (const app of [CUSTOMER_APP, MOBILE]) {
    await put(path.join(app, 'assets/icon.png'), badgeOnNavy(1024));
    await put(path.join(app, 'assets/adaptive-icon.png'), await badgeMaskable(1024));
    await put(path.join(app, 'assets/splash-icon.png'), badgeTransparent(1024));
    await put(path.join(app, 'assets/favicon.png'), markPng(196));
    await put(path.join(app, 'assets/notification-icon.png'), await notificationIcon(96));
    await put(path.join(app, 'assets/mark.png'), markPng(512));
  }

  const width = Math.max(...written.map(([name]) => name.length));
  for (const [name, size] of written) {
    console.log(`  ${name.padEnd(width)}  ${size ? `${size.toLocaleString()} B` : ''}`);
  }
  console.log(`\n${written.length} files from ${path.relative(ROOT, MASTER)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
