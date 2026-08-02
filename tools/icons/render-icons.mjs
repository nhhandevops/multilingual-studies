/**
 * One-off PNG icon generation from the 语 favicon, using installed Chrome via
 * playwright-core (the e2e harness pattern) — no native image deps in the repo.
 * Outputs to apps/web/public/icons/. Re-run only when the glyph art changes:
 *   cd tools/e2e && npm install && node ../icons/render-icons.mjs
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = join(here, '..', '..');
// playwright-core lives in tools/e2e's node_modules (the e2e harness owns that dep)
const require_ = createRequire(join(REPO, 'tools', 'e2e', 'package.json'));
const { chromium } = require_('playwright-core');
const { CHROME } = await import(new URL('../e2e/paths.mjs', import.meta.url).href);

const OUT = join(REPO, 'apps', 'web', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

// Same art as favicon.svg; maskable adds safe-zone padding (icon content within inner 80%).
const tile = (pad) => `<!doctype html><meta charset="utf-8"><body style="margin:0">
  <div style="width:512px;height:512px;background:#0b6e4f;border-radius:${pad ? 0 : 96}px;
              display:flex;align-items:center;justify-content:center">
    <span style="font:${pad ? 280 : 340}px serif;color:#fff">语</span>
  </div></body>`;

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });

for (const { name, size, pad } of [
  { name: 'icon-512.png', size: 512, pad: false },
  { name: 'icon-512-maskable.png', size: 512, pad: true },
  { name: 'icon-192.png', size: 192, pad: false },
  { name: 'apple-touch-icon-180.png', size: 180, pad: true }, // iOS rounds corners itself
]) {
  await page.setContent(tile(pad));
  const el = page.locator('div');
  const shot = await el.screenshot({ type: 'png' });
  if (size !== 512) {
    // Downscale in-page: draw the 512 PNG onto a canvas of the target size.
    const b64 = shot.toString('base64');
    const resized = await page.evaluate(
      async ({ b64, size }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, size, size);
        return canvas.toDataURL('image/png').split(',')[1];
      },
      { b64, size },
    );
    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(OUT, name), Buffer.from(resized, 'base64'));
  } else {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(OUT, name), shot);
  }
  console.log('✓', name);
}
await browser.close();
