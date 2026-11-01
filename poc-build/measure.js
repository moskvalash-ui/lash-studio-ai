// Performance comparison harness (TASK 09). Headless desktop Chromium
// with a mobile viewport EMULATED — this is explicitly NOT a physical
// phone measurement; reported as such in every output line.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'tests/e2e/node_modules/@playwright/test'));

const BASE = 'http://localhost:8935';
const PAGES = { original: '/index.html', precompiled: '/index.precompiled.html' };
const RUNS = 5;

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function range(arr) { return `${Math.min(...arr)}-${Math.max(...arr)}`; }

async function measureOne(context, url, mode) {
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 150)); });
  page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message.slice(0, 150)));

  await page.addInitScript(() => { window.__t0 = Date.now(); });

  const navStart = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const domContentLoaded = Date.now() - navStart;

  let rootMountedAt = null;
  if (mode === 'reload') {
    const reloadStart = Date.now();
    await page.addInitScript(() => { window.__t0 = Date.now(); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('root') && document.getElementById('root').childElementCount > 0, { timeout: 60000 });
    rootMountedAt = Date.now() - reloadStart;
  } else {
    await page.waitForFunction(() => document.getElementById('root') && document.getElementById('root').childElementCount > 0, { timeout: 60000 });
    rootMountedAt = Date.now() - navStart;
  }

  // basic functional smoke: at least one real button rendered
  const buttonCount = await page.locator('button').count();

  await page.close();
  return { domContentLoaded, rootMountedAt, buttonCount, errors: consoleErrors };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = {};

  for (const [label, p] of Object.entries(PAGES)) {
    for (const mode of ['cold', 'reload']) {
      const key = `${label}_${mode}`;
      results[key] = [];
      for (let i = 0; i < RUNS; i++) {
        // fresh context per COLD run (no HTTP cache carried over);
        // for RELOAD, also fresh context per run but the measured
        // segment is the in-context reload() itself (HTTP cache warm
        // from the initial goto within that same context/run).
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
        });
        const r = await measureOne(context, BASE + p, mode);
        results[key].push(r);
        console.log(`${key} run${i + 1}: domContentLoaded=${r.domContentLoaded}ms rootMounted=${r.rootMountedAt}ms buttons=${r.buttonCount} errors=${r.errors.length}`);
        if (r.errors.length) r.errors.forEach(e => console.log('   console error:', e));
        await context.close();
      }
    }
  }

  await browser.close();

  console.log('\n=== SUMMARY (median / range, ms) — rootMounted (time to usable screen) ===');
  for (const [key, runs] of Object.entries(results)) {
    const vals = runs.map(r => r.rootMountedAt);
    const totalErrors = runs.reduce((a, r) => a + r.errors.length, 0);
    console.log(`${key.padEnd(22)} median=${median(vals).toFixed(0).padStart(6)}ms  range=${range(vals).padEnd(11)}  totalConsoleErrors=${totalErrors}`);
  }
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
