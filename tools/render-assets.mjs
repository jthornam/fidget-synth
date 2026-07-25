#!/usr/bin/env node
/**
 * Renders a link-preview card and an app-icon set by screenshotting a page
 * with the Chrome already installed on this machine. No npm install.
 *
 *   node render-assets.mjs --page index.html --card-query '?poster=9' \
 *                          --icon-query '?poster=9&bare=1'
 *
 * Options (all optional):
 *   --page <path>        page to shoot                    default index.html
 *   --out <dir>          where images land                default page's dir
 *   --card-query <qs>    query string for the card shot   default ''
 *   --icon-query <qs>    query string for the icon shot   default ''
 *   --card <WxH>         card dimensions                  default 1200x630
 *   --icon <px>          icon master size                 default 1024
 *   --sizes <a,b,c>      downsampled icons                default 512,192,180
 *   --settle <ms>        page time before the shutter     default 4000
 *   --no-card | --no-icons
 *
 * Two things about this that are not obvious and cost real time to discover:
 *
 * 1. Headless Chrome writes the screenshot and then does not exit if the page
 *    runs an endless requestAnimationFrame loop — which any animated page
 *    does. Waiting on the process hangs forever. So we watch for the file to
 *    appear and stop growing, then kill Chrome.
 *
 * 2. Icons are rendered once large and downsampled, never rendered natively
 *    at 180px. Canvas point sprites, stroke widths and font sizes are in
 *    absolute pixels, so a small viewport gives you a few enormous marks
 *    where the full-size render has a field of fine ones.
 */

import { execFile, spawn } from 'node:child_process';
import { mkdir, rm, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';

const run = promisify(execFile);

/* ── arguments ── */
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const has = name => argv.includes(`--${name}`);

const PAGE       = path.resolve(flag('page', 'index.html'));
const OUT        = path.resolve(flag('out', path.dirname(PAGE)));
// fidget-synth poses: fixed seed + frozen phase, mode 0 (warped bands).
// bare=1 centers and enlarges the dial cluster for the icon.
const CARD_QUERY = flag('card-query', '?poster=7&mode=0');
const ICON_QUERY = flag('icon-query', '?poster=7&mode=0&bare=1');
const SETTLE     = Number(flag('settle', 4000));
const ICON_PX    = Number(flag('icon', 1024));
const SIZES      = flag('sizes', '512,192,180').split(',').map(Number);
const [CARD_W, CARD_H] = flag('card', '1200x630').split('x').map(Number);

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  process.env.CHROME_PATH,
].filter(Boolean);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const exists = async p => { try { await stat(p); return true; } catch { return false; } };

async function findChrome() {
  for (const c of CHROME_CANDIDATES) if (await exists(c)) return c;
  throw new Error(
    'No Chrome/Chromium found. Install Google Chrome, or set CHROME_PATH to its binary.'
  );
}

const PROFILE = path.join(OUT, '.chrome-render-profile');

async function shoot(chrome, { out, w, h, query }) {
  const dest = path.join(OUT, out);
  await mkdir(PROFILE, { recursive: true });
  await rm(dest, { force: true });

  const child = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    // The page uses ES modules, which file:// blocks under default CORS rules.
    '--allow-file-access-from-files',
    // Chrome 128+ refuses software WebGL without this; without it the art
    // canvas silently renders nothing and the shot is a flat background.
    '--enable-unsafe-swiftshader',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    `--user-data-dir=${PROFILE}`,     // never contend with the user's open Chrome
    `--window-size=${w},${h}`,
    `--virtual-time-budget=${SETTLE}`,
    `--screenshot=${dest}`,
    `file://${PAGE}${query}`,
  ], { stdio: 'ignore' });

  const deadline = Date.now() + SETTLE + 45_000;
  let last = -1, settled = 0;
  try {
    for (;;) {
      if (Date.now() > deadline) throw new Error(`timed out rendering ${out}`);
      await sleep(250);
      let size = -1;
      try { ({ size } = await stat(dest)); } catch { /* not written yet */ }
      if (size > 0 && size === last && ++settled >= 2) break;  // flushed
      if (size !== last) settled = 0;
      last = size;
    }
  } finally {
    child.kill('SIGKILL');
  }
  console.log(`  ${out.padEnd(16)} ${w}×${h}`.padEnd(38) + `${(last / 1024).toFixed(0)} KB`);
}

/** sips on macOS, ImageMagick elsewhere. */
let resizer = null;
async function resize(src, dest, px) {
  if (!resizer) {
    for (const [bin, args] of [
      ['sips',    (s, d, n) => ['-z', String(n), String(n), s, '--out', d]],
      ['magick',  (s, d, n) => [s, '-resize', `${n}x${n}`, d]],
      ['convert', (s, d, n) => [s, '-resize', `${n}x${n}`, d]],
    ]) {
      try { await run(bin, ['--version']).catch(() => run(bin, ['-h'])); resizer = [bin, args]; break; }
      catch { /* try the next one */ }
    }
    if (!resizer) throw new Error('Need sips (macOS) or ImageMagick to downsample icons.');
  }
  const [bin, args] = resizer;
  await run(bin, args(src, dest, px));
}

const chrome = await findChrome();
console.log(`rendering ${path.basename(PAGE)} via ${path.basename(chrome)}\n`);

if (!has('no-card')) {
  await shoot(chrome, { out: 'og.png', w: CARD_W, h: CARD_H, query: CARD_QUERY });
}

if (!has('no-icons')) {
  const master = `icon-${ICON_PX}.png`;
  await shoot(chrome, { out: master, w: ICON_PX, h: ICON_PX, query: ICON_QUERY });
  for (const px of SIZES) {
    const out = `icon-${px}.png`;
    await resize(path.join(OUT, master), path.join(OUT, out), px);
    const { size } = await stat(path.join(OUT, out));
    console.log(`  ${out.padEnd(16)} ${px}×${px}`.padEnd(38) + `${(size / 1024).toFixed(0)} KB`);
  }
}

await rm(PROFILE, { recursive: true, force: true });

console.log(`
Now look at the images before shipping them — open the icon at the size it
will actually be seen (~120px). Renders that are gorgeous at 1024 routinely
turn to grey mush at icon scale.
`);
