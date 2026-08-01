import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import fs from 'node:fs';

const URL = process.env.SMOKE_URL ?? 'http://localhost:5173/';
const screenshotPath = process.env.SMOKE_SHOT ?? '/tmp/frontline-zero-smoke.png';

const results = [];
function report(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.locator('#start').click();
await page.waitForTimeout(1000);

report('overlay hides on deploy', !(await page.locator('#overlay').isVisible()));
report('weapon name rendered', (await page.locator('#weapon-name').textContent()).trim().length > 0);

const ammoBefore = (await page.locator('#ammo-count').textContent()).trim();
await page.keyboard.down('ShiftLeft');
await page.keyboard.down('KeyW');
await page.waitForTimeout(1200);
const stamina = await page.locator('#stamina-fill').evaluate((el) => el.style.width);
await page.keyboard.up('KeyW');
await page.keyboard.up('ShiftLeft');
report('stamina drains while sprinting', parseInt(stamina) < 50, `stamina ${stamina}`);

await page.mouse.down();
await page.waitForTimeout(1000);
await page.mouse.up();
const ammoAfter = (await page.locator('#ammo-count').textContent()).trim();
report('firing consumes ammo', ammoBefore !== ammoAfter, `${ammoBefore} -> ${ammoAfter}`);

await page.keyboard.press('KeyR');
await page.waitForTimeout(2500);
const ammoReloaded = (await page.locator('#ammo-count').textContent()).trim();
report('reload refills magazine', ammoReloaded.startsWith('30'), `after reload ${ammoReloaded}`);

await page.keyboard.press('Digit3');
report('weapon switching works', (await page.locator('#weapon-name').textContent()).trim() === 'SR-21 Reaper');

report('bots spawned', (await page.evaluate(() => window.__smoke?.botCount)) === 3);

await page
  .waitForFunction(() => window.__smoke?.phase() === 'playing', null, { timeout: 15000 })
  .then(() => report('match enters playing phase', true))
  .catch(() => report('match enters playing phase', false, 'stuck in warmup'));

await page
  .waitForFunction(() => (window.__smoke?.botShots() ?? 0) > 0, null, { timeout: 25000 })
  .then(() => report('bots engage and damage the player', true))
  .catch(() => report('bots engage and damage the player', false, 'no bot damage within 25s'));

await page.screenshot({ path: screenshotPath });
const png = PNG.sync.read(fs.readFileSync(screenshotPath));
let nonBlack = 0;
let total = 0;
for (let i = 0; i < png.data.length; i += 4) {
  total++;
  if (png.data[i] + png.data[i + 1] + png.data[i + 2] > 30) nonBlack++;
}
report('scene renders (non-black pixels)', nonBlack / total > 0.9, `${((100 * nonBlack) / total).toFixed(1)}% non-black`);
report('no console/page errors', errors.length === 0, errors.join(' | '));

await browser.close();

const failed = results.filter((r) => !r.pass);
if (failed.length > 0) {
  console.error(`\nSMOKE TEST FAILED: ${failed.length}/${results.length} checks failed`);
  process.exit(1);
}
console.log(`\nSMOKE TEST PASSED: all ${results.length} checks green`);
