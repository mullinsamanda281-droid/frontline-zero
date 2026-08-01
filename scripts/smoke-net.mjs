import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const results = [];
function report(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const server = spawn('npx', ['tsx', 'server/index.ts'], {
  env: Object.assign({}, process.env, { PORT: '18090' }),
  stdio: ['ignore', 'pipe', 'pipe'],
  timeout: 60000,
});
server.stdout?.on('data', (d) => console.log('[SERVER]', d.toString().trim()));
server.stderr?.on('data', (d) => console.error('[SERVER ERR]', d.toString().trim()));

await new Promise((resolve) => setTimeout(resolve, 4000));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));

const base = process.env.SMOKE_URL ?? 'http://localhost:5173/';
const query = '?net=ws://localhost:18090&room=SMOKE&name=TEST-PLAYER';
await page.goto(`${base}${query}`, { waitUntil: 'networkidle' });
await page.locator('#start').click();
await page.waitForTimeout(2000);

report('net mode HUD visible', await page.locator('#net-ping').isVisible());
report('no console errors', errors.length === 0, errors.join(' | '));

await browser.close();
server.kill();

const failed = results.filter((r) => !r.pass);
if (failed.length > 0) {
  console.error(`\nNET SMOKE FAILED: ${failed.length}/${results.length} checks failed`);
  process.exit(1);
}
console.log(`\nNET SMOKE PASSED: all ${results.length} checks green`);